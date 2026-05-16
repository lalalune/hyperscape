/**
 * QuadChunkWorker — Offloads quad-tree terrain chunk computation to Web Worker.
 *
 * Computes heights (with overflow grid for normals), per-vertex normals,
 * biome-blended colors, and biome IDs for an arbitrary world-space region
 * defined by (centerX, centerZ, size, resolution).
 *
 * Road influence and flat-zone application stay on the main thread because
 * they depend on runtime game state (road network, building footprints).
 *
 * The inline worker code duplicates the same noise / height / biome logic
 * used by TerrainWorker.ts, keeping both in sync with TerrainHeightParams.ts.
 */

import { WorkerPool } from "./WorkerPool";
import {
  buildGetBaseHeightAtJS,
  buildComputeBiomeWeightsJS,
  MAX_HEIGHT,
  WATER_LEVEL_NORMALIZED,
} from "../../systems/shared/world/TerrainHeightParams";
import { buildBiomeConstantsJS } from "../../systems/shared/world/TerrainBiomeTypes";
import {
  buildNoiseGeneratorJS,
  buildHeightHelpersJS,
  buildBiomeInfluencesJS,
  buildCreateBiomeNoiseSetsJS,
} from "./TerrainWorkerShared";

export interface QuadChunkWorkerConfig {
  MAX_HEIGHT: number;
  BIOME_GAUSSIAN_COEFF: number;
  BIOME_BOUNDARY_NOISE_SCALE: number;
  BIOME_BOUNDARY_NOISE_AMOUNT: number;
  WATER_THRESHOLD: number;
  WATER_LEVEL_NORMALIZED: number;
  SHORELINE_THRESHOLD: number;
  SHORELINE_STRENGTH: number;
  SHORELINE_MIN_SLOPE: number;
  SHORELINE_SLOPE_SAMPLE_DISTANCE: number;
  SHORELINE_LAND_BAND: number;
  SHORELINE_LAND_MAX_MULTIPLIER: number;
  SHORELINE_UNDERWATER_BAND: number;
  UNDERWATER_DEPTH_MULTIPLIER: number;
}

export interface QuadChunkWorkerInput {
  type: "generateQuadChunk";
  centerX: number;
  centerZ: number;
  size: number;
  resolution: number;
  config: QuadChunkWorkerConfig;
  seed: number;
  biomeCenters: Array<{
    x: number;
    z: number;
    type: string;
    influence: number;
  }>;
  biomes: Record<string, { color: { r: number; g: number; b: number } }>;
  /**
   * Phase 2.1 follow-up — stable palette ordering for N-channel
   * terrain shading. Position in this array == palette texture
   * row index the shader will sample. Parent thread builds this
   * via `getActiveBiomePaletteOrder()`. When omitted (legacy
   * callers), the worker still emits the new `biomeIndices` +
   * `biomeWeights` attrs but all indices are 0 — the shader
   * falls back to the 3-channel `biomeForestWeight` /
   * `biomeCanyonWeight` path which remains dual-written.
   */
  biomeOrder?: ReadonlyArray<string>;
}

export interface QuadChunkWorkerOutput {
  type: "quadChunkResult";
  centerX: number;
  centerZ: number;
  size: number;
  resolution: number;
  heightData: Float32Array;
  normalData: Float32Array;
  colorData: Float32Array;
  biomeData: Uint8Array;
  biomeForestWeight: Float32Array;
  biomeCanyonWeight: Float32Array;
  riverProximity: Float32Array;
  /**
   * Phase 2.1 follow-up — top-4 biome palette indices per
   * vertex (vec4 packed as 4 consecutive bytes). Each byte is
   * a row index into the palette texture the parent thread
   * uploads. Length = vertexCount * 4. Optional because the
   * sync-fallback path in `TerrainQuadChunkGenerator` doesn't
   * emit it; live worker output always populates it.
   */
  biomeIndices?: Uint8Array;
  /**
   * Top-4 biome blend weights per vertex (vec4 packed as 4
   * consecutive floats). Sum is renormalized to 1 across the
   * 4 retained channels. Length = vertexCount * 4. Optional
   * for the same reason as `biomeIndices`.
   */
  biomeWeights?: Float32Array;
}

const QUAD_CHUNK_WORKER_CODE = `
${buildNoiseGeneratorJS()}
${buildBiomeConstantsJS()}

var BIOME_IDS = {};
BIOME_IDS[BT_TUNDRA] = 0;
BIOME_IDS[BT_FOREST] = 1;
BIOME_IDS[BT_CANYON] = 2;

function generateQuadChunk(input) {
  const { centerX, centerZ, size, resolution, config, seed, biomeCenters, biomes, biomeOrder } = input;
  // Build biome-id → palette index lookup from the optional
  // ordering. Missing ids resolve to 0 (the shader's safe
  // default-biome slot). When biomeOrder is omitted, every
  // index resolves to 0 — the N-channel shader path falls
  // back to the 3-channel path via the dual-written legacy
  // attrs.
  var paletteIndex = Object.create(null);
  if (biomeOrder) {
    for (var pi = 0; pi < biomeOrder.length; pi++) {
      paletteIndex[biomeOrder[pi]] = pi;
    }
  }
  const {
    MAX_HEIGHT,
    BIOME_GAUSSIAN_COEFF,
    BIOME_BOUNDARY_NOISE_SCALE,
    BIOME_BOUNDARY_NOISE_AMOUNT,
    WATER_THRESHOLD,
    WATER_LEVEL_NORMALIZED,
    SHORELINE_THRESHOLD,
    SHORELINE_STRENGTH,
    SHORELINE_MIN_SLOPE,
    SHORELINE_SLOPE_SAMPLE_DISTANCE,
    SHORELINE_LAND_BAND,
    SHORELINE_LAND_MAX_MULTIPLIER,
    SHORELINE_UNDERWATER_BAND,
    UNDERWATER_DEPTH_MULTIPLIER
  } = config;

  const noise = new NoiseGenerator(seed);
  const segments = resolution;
  const vertexCount = segments * segments;
  const halfSize = size * 0.5;
  const gridStep = size / (segments - 1);

  ${buildComputeBiomeWeightsJS()}
  ${buildGetBaseHeightAtJS()}
  ${buildCreateBiomeNoiseSetsJS()}
  var biomeNoiseSets = createBiomeNoiseSets(seed);
  ${buildHeightHelpersJS()}
  ${buildBiomeInfluencesJS()}

  // Overflow grid for normals: (segments+2)^2
  const gRes = segments + 2;
  const overflowGrid = new Float32Array(gRes * gRes);

  for (let gz = 0; gz < gRes; gz++) {
    const localZ = -halfSize + (gz - 1) * gridStep;
    const worldZ = centerZ + localZ;
    for (let gx = 0; gx < gRes; gx++) {
      const localX = -halfSize + (gx - 1) * gridStep;
      const worldX = centerX + localX;
      overflowGrid[gz * gRes + gx] = getHeightComputed(worldX, worldZ);
    }
  }

  const heightData = new Float32Array(vertexCount);
  for (let iz = 0; iz < segments; iz++) {
    const srcRow = (iz + 1) * gRes + 1;
    const dstRow = iz * segments;
    for (let ix = 0; ix < segments; ix++) {
      heightData[dstRow + ix] = overflowGrid[srcRow + ix];
    }
  }

  // Normals via centered finite differences
  const normalData = new Float32Array(vertexCount * 3);
  const invTwoStep = 1 / (2 * gridStep);
  for (let iz = 0; iz < segments; iz++) {
    const gz = iz + 1;
    for (let ix = 0; ix < segments; ix++) {
      const gx = ix + 1;
      const hL = overflowGrid[gz * gRes + (gx - 1)];
      const hR = overflowGrid[gz * gRes + (gx + 1)];
      const hD = overflowGrid[(gz - 1) * gRes + gx];
      const hU = overflowGrid[(gz + 1) * gRes + gx];
      const dhdx = (hR - hL) * invTwoStep;
      const dhdz = (hU - hD) * invTwoStep;
      const nx = -dhdx;
      const ny = 1;
      const nz = -dhdz;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const i3 = (iz * segments + ix) * 3;
      normalData[i3] = nx / len;
      normalData[i3 + 1] = ny / len;
      normalData[i3 + 2] = nz / len;
    }
  }

  // Colors and biome IDs
  const colorData = new Float32Array(vertexCount * 3);
  const biomeData = new Uint8Array(vertexCount);
  const biomeForestWeight = new Float32Array(vertexCount);
  const biomeCanyonWeight = new Float32Array(vertexCount);
  const riverProximity = new Float32Array(vertexCount);
  // Phase 2.1 follow-up — N-channel palette indices + weights.
  // 4 entries per vertex packed as vec4 the shader samples.
  const biomeIndices = new Uint8Array(vertexCount * 4);
  const biomeWeights = new Float32Array(vertexCount * 4);
  // Scratch sort buffer reused per vertex.
  var topIds = [null, null, null, null];
  var topWeights = [0, 0, 0, 0];

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const idx = iz * segments + ix;
      const height = heightData[idx];
      const normalizedHeight = height / MAX_HEIGHT;

      const localX = -halfSize + ix * gridStep;
      const localZ = -halfSize + iz * gridStep;
      const worldX = centerX + localX;
      const worldZ = centerZ + localZ;

      var bw = computeBiomeWeightsByPosition(worldX, worldZ);
      var forestW = bw[BT_FOREST] || 0;
      var canyonW = bw[BT_CANYON] || 0;
      biomeForestWeight[idx] = forestW;
      biomeCanyonWeight[idx] = canyonW;

      var dominantBiome = BT_DEFAULT;
      var dominantWeight = -1;
      // Reset top-4 scratch buffers per vertex.
      topIds[0] = null; topIds[1] = null; topIds[2] = null; topIds[3] = null;
      topWeights[0] = 0; topWeights[1] = 0; topWeights[2] = 0; topWeights[3] = 0;
      for (var bk in bw) {
        var bwVal = bw[bk];
        if (bwVal > dominantWeight) { dominantWeight = bwVal; dominantBiome = bk; }
        // Maintain a descending-by-weight top-4 via in-place
        // insertion. Cheap for 4 slots; avoids allocating an
        // array per vertex.
        if (bwVal > topWeights[3]) {
          if (bwVal > topWeights[0]) {
            topWeights[3] = topWeights[2]; topIds[3] = topIds[2];
            topWeights[2] = topWeights[1]; topIds[2] = topIds[1];
            topWeights[1] = topWeights[0]; topIds[1] = topIds[0];
            topWeights[0] = bwVal; topIds[0] = bk;
          } else if (bwVal > topWeights[1]) {
            topWeights[3] = topWeights[2]; topIds[3] = topIds[2];
            topWeights[2] = topWeights[1]; topIds[2] = topIds[1];
            topWeights[1] = bwVal; topIds[1] = bk;
          } else if (bwVal > topWeights[2]) {
            topWeights[3] = topWeights[2]; topIds[3] = topIds[2];
            topWeights[2] = bwVal; topIds[2] = bk;
          } else {
            topWeights[3] = bwVal; topIds[3] = bk;
          }
        }
      }
      biomeData[idx] = BIOME_IDS[dominantBiome] || 0;
      // Renormalize the retained top-4 so they sum to 1 — the
      // shader expects post-renormalization weights so dropped
      // long-tail biomes don't darken the blend.
      var topSum = topWeights[0] + topWeights[1] + topWeights[2] + topWeights[3];
      var invTopSum = topSum > 0 ? 1 / topSum : 0;
      var i4 = idx * 4;
      for (var s = 0; s < 4; s++) {
        var bid = topIds[s];
        biomeIndices[i4 + s] = bid !== null ? (paletteIndex[bid] || 0) : 0;
        biomeWeights[i4 + s] = topWeights[s] * invTopSum;
      }

      let colorR = 0, colorG = 0, colorB = 0;
      for (var bk2 in bw) {
        var bwt = bw[bk2];
        var biomeConfig = biomes[bk2] || { color: { r: 0.4, g: 0.6, b: 0.3 } };
        var color = biomeConfig.color || { r: 0.4, g: 0.6, b: 0.3 };
        colorR += color.r * bwt;
        colorG += color.g * bwt;
        colorB += color.b * bwt;
      }

      if (normalizedHeight > WATER_LEVEL_NORMALIZED && normalizedHeight < SHORELINE_THRESHOLD) {
        const shoreFactor = (1.0 - (normalizedHeight - WATER_LEVEL_NORMALIZED) /
                           (SHORELINE_THRESHOLD - WATER_LEVEL_NORMALIZED)) * SHORELINE_STRENGTH;
        colorR = colorR + (0.545 - colorR) * shoreFactor;
        colorG = colorG + (0.451 - colorG) * shoreFactor;
        colorB = colorB + (0.333 - colorB) * shoreFactor;
      }

      colorData[idx * 3] = colorR;
      colorData[idx * 3 + 1] = colorG;
      colorData[idx * 3 + 2] = colorB;
    }
  }

  return {
    type: 'quadChunkResult',
    centerX,
    centerZ,
    size,
    resolution,
    heightData,
    normalData,
    colorData,
    biomeData,
    biomeForestWeight,
    biomeCanyonWeight,
    riverProximity,
    biomeIndices,
    biomeWeights
  };
}

self.onmessage = function(e) {
  const input = e.data;
  if (input.type === 'generateQuadChunk') {
    try {
      const result = generateQuadChunk(input);
      self.postMessage({ result }, [
        result.heightData.buffer,
        result.normalData.buffer,
        result.colorData.buffer,
        result.biomeData.buffer,
        result.biomeForestWeight.buffer,
        result.biomeCanyonWeight.buffer,
        result.riverProximity.buffer,
        result.biomeIndices.buffer,
        result.biomeWeights.buffer
      ]);
    } catch (error) {
      self.postMessage({ error: error.message || 'Unknown error' });
    }
  }
};
`;

let quadChunkWorkerPool: WorkerPool<
  QuadChunkWorkerInput,
  QuadChunkWorkerOutput
> | null = null;

let workersChecked = false;
let workersAvailable = false;

export function isQuadChunkWorkerAvailable(): boolean {
  if (!workersChecked) {
    workersChecked = true;
    if (typeof Worker === "undefined" || typeof Blob === "undefined") {
      workersAvailable = false;
      return workersAvailable;
    }
    if (
      typeof process !== "undefined" &&
      process.versions &&
      "bun" in process.versions
    ) {
      workersAvailable = false;
      return workersAvailable;
    }
    if (typeof window === "undefined") {
      workersAvailable = false;
      return workersAvailable;
    }
    workersAvailable = true;
  }
  return workersAvailable;
}

export function getQuadChunkWorkerPool(
  poolSize?: number,
): WorkerPool<QuadChunkWorkerInput, QuadChunkWorkerOutput> | null {
  if (!isQuadChunkWorkerAvailable()) {
    return null;
  }

  if (!quadChunkWorkerPool) {
    quadChunkWorkerPool = new WorkerPool<
      QuadChunkWorkerInput,
      QuadChunkWorkerOutput
    >(QUAD_CHUNK_WORKER_CODE, poolSize);
  }
  return quadChunkWorkerPool;
}

export async function generateQuadChunkAsync(
  input: QuadChunkWorkerInput,
): Promise<QuadChunkWorkerOutput | null> {
  const pool = getQuadChunkWorkerPool();
  if (!pool) {
    return null;
  }
  return pool.execute(input);
}

export function terminateQuadChunkWorkerPool(): void {
  if (quadChunkWorkerPool) {
    quadChunkWorkerPool.terminate();
    quadChunkWorkerPool = null;
  }
}
