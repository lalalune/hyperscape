/**
 * TerrainQuadChunkGenerator — N-channel attribute forwarding tests.
 *
 * Phase 2.1 follow-up cut 1 contract pinner. The QuadChunkWorker
 * emits `biomeIndices` (Uint8Array, 4/vertex) and `biomeWeights`
 * (Float32Array, 4/vertex); `assembleQuadChunkGeometry` must
 * forward both into the BufferGeometry as vec4 attributes
 * preserving per-vertex values, and skirt vertices must copy
 * from the matching main-grid edge vertex.
 *
 * These tests run synchronous TypeScript only — no worker, no
 * GPU, no DOM. They construct a minimal `QuadChunkWorkerOutput`
 * fixture and assert against the resulting geometry's vertex
 * attributes.
 */

import { describe, it, expect } from "vitest";
import * as THREE from "three";

import {
  assembleQuadChunkGeometry,
  type ChunkTerrainProvider,
} from "../TerrainQuadChunkGenerator";
import type { QuadChunkWorkerOutput } from "../../../../utils/workers/QuadChunkWorker";

const TILE_SIZE = 100;
const SKIRT_DROP = 1.0;

function makeProvider(): ChunkTerrainProvider {
  return {
    TILE_SIZE,
    calculateRoadInfluenceAtVertex() {
      return 0;
    },
    getFlatZoneHeight() {
      return null;
    },
    getHeightAtComputed() {
      return 0;
    },
  };
}

/**
 * Build a worker output fixture with the given resolution.
 * Per-vertex N-channel data is deterministic so tests can
 * assert exact values: indices[vertex i] = (i, i+1, i+2, i+3)
 * mod 256; weights[vertex i] = (1, 0, 0, 0) — a top-1-only
 * distribution that makes index 0 the visible biome.
 */
function makeWorkerData(
  resolution: number,
  withNChannel: boolean,
): QuadChunkWorkerOutput {
  const vertexCount = resolution * resolution;
  const heightData = new Float32Array(vertexCount);
  const normalData = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) normalData[i * 3 + 1] = 1;
  const colorData = new Float32Array(vertexCount * 3);
  const biomeData = new Uint8Array(vertexCount);
  const biomeForestWeight = new Float32Array(vertexCount);
  const biomeCanyonWeight = new Float32Array(vertexCount);
  const riverProximity = new Float32Array(vertexCount);

  const out: QuadChunkWorkerOutput = {
    type: "quadChunkResult",
    centerX: 0,
    centerZ: 0,
    size: TILE_SIZE,
    resolution,
    heightData,
    normalData,
    colorData,
    biomeData,
    biomeForestWeight,
    biomeCanyonWeight,
    riverProximity,
  };

  if (withNChannel) {
    const biomeIndices = new Uint8Array(vertexCount * 4);
    const biomeWeights = new Float32Array(vertexCount * 4);
    for (let i = 0; i < vertexCount; i++) {
      const i4 = i * 4;
      biomeIndices[i4] = i % 256;
      biomeIndices[i4 + 1] = (i + 1) % 256;
      biomeIndices[i4 + 2] = (i + 2) % 256;
      biomeIndices[i4 + 3] = (i + 3) % 256;
      biomeWeights[i4] = 1;
      biomeWeights[i4 + 1] = 0;
      biomeWeights[i4 + 2] = 0;
      biomeWeights[i4 + 3] = 0;
    }
    out.biomeIndices = biomeIndices;
    out.biomeWeights = biomeWeights;
  }
  return out;
}

describe("assembleQuadChunkGeometry — N-channel attribute registration", () => {
  it("registers biomeIndices as a vec4 BufferAttribute when worker emits it", () => {
    const data = makeWorkerData(4, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeIndices");
    expect(attr).toBeDefined();
    expect(attr.itemSize).toBe(4);
  });

  it("registers biomeWeights as a vec4 BufferAttribute when worker emits it", () => {
    const data = makeWorkerData(4, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeWeights");
    expect(attr).toBeDefined();
    expect(attr.itemSize).toBe(4);
  });

  it("preserves Uint8 storage for biomeIndices (palette is integer-indexed)", () => {
    const data = makeWorkerData(4, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeIndices");
    expect(attr.array).toBeInstanceOf(Uint8Array);
  });

  it("preserves Float32 storage for biomeWeights (palette blend weights)", () => {
    const data = makeWorkerData(4, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeWeights");
    expect(attr.array).toBeInstanceOf(Float32Array);
  });
});

describe("assembleQuadChunkGeometry — N-channel forwarding (main grid)", () => {
  it("forwards exact per-vertex biomeIndices from worker output", () => {
    const resolution = 4;
    const data = makeWorkerData(resolution, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeIndices");
    // First main-grid vertex (idx 0) should have the synthetic
    // pattern (0, 1, 2, 3).
    expect(attr.array[0]).toBe(0);
    expect(attr.array[1]).toBe(1);
    expect(attr.array[2]).toBe(2);
    expect(attr.array[3]).toBe(3);
    // Vertex idx 5 (row 1, col 1) — synthetic pattern (5, 6, 7, 8).
    const i4 = 5 * 4;
    expect(attr.array[i4]).toBe(5);
    expect(attr.array[i4 + 1]).toBe(6);
    expect(attr.array[i4 + 2]).toBe(7);
    expect(attr.array[i4 + 3]).toBe(8);
  });

  it("forwards exact per-vertex biomeWeights from worker output", () => {
    const resolution = 4;
    const data = makeWorkerData(resolution, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeWeights");
    expect(attr.array[0]).toBe(1);
    expect(attr.array[1]).toBe(0);
    expect(attr.array[2]).toBe(0);
    expect(attr.array[3]).toBe(0);
  });
});

describe("assembleQuadChunkGeometry — fallback when worker omits N-channel", () => {
  it("still registers biomeIndices/biomeWeights attributes as zeros (shader-safe)", () => {
    const data = makeWorkerData(4, /* withNChannel */ false);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const idx = geometry.getAttribute("biomeIndices");
    const w = geometry.getAttribute("biomeWeights");
    // Attrs exist and are correctly typed even when worker
    // didn't emit them — every value is 0 so the shader's
    // 3-channel fallback path (forestWeight/canyonWeight) is
    // the one that gets sampled.
    expect(idx).toBeDefined();
    expect(w).toBeDefined();
    let nonZeroIdx = 0;
    let nonZeroW = 0;
    for (let i = 0; i < idx.array.length; i++) {
      if (idx.array[i] !== 0) nonZeroIdx++;
    }
    for (let i = 0; i < w.array.length; i++) {
      if (w.array[i] !== 0) nonZeroW++;
    }
    expect(nonZeroIdx).toBe(0);
    expect(nonZeroW).toBe(0);
  });
});

describe("assembleQuadChunkGeometry — skirt vertices copy from main grid", () => {
  it("copies biomeIndices from edge vertices into skirt vertices", () => {
    const resolution = 4;
    const data = makeWorkerData(resolution, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeIndices");
    const segments = resolution;
    const mainCount = segments * segments; // 16

    // Skirt layout (per source): first segments verts = bottom
    // edge (z=0), next = top edge, next = left edge, next =
    // right edge. Bottom edge main indices are ix=0..segments-1.
    // First skirt vertex (skirtIdx == mainCount) copies from
    // mainIdx=0.
    const skirtV0 = mainCount * 4;
    expect(attr.array[skirtV0]).toBe(attr.array[0]);
    expect(attr.array[skirtV0 + 1]).toBe(attr.array[1]);
    expect(attr.array[skirtV0 + 2]).toBe(attr.array[2]);
    expect(attr.array[skirtV0 + 3]).toBe(attr.array[3]);
  });

  it("copies biomeWeights from edge vertices into skirt vertices", () => {
    const resolution = 4;
    const data = makeWorkerData(resolution, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const attr = geometry.getAttribute("biomeWeights");
    const mainCount = resolution * resolution;
    const skirtV0 = mainCount * 4;
    expect(attr.array[skirtV0]).toBe(1);
    expect(attr.array[skirtV0 + 1]).toBe(0);
    expect(attr.array[skirtV0 + 2]).toBe(0);
    expect(attr.array[skirtV0 + 3]).toBe(0);
  });

  it("allocates the right total length: (mainCount + skirtCount) * 4", () => {
    const resolution = 5;
    const data = makeWorkerData(resolution, true);
    const { geometry } = assembleQuadChunkGeometry(
      data,
      makeProvider(),
      SKIRT_DROP,
    );
    const expectedTotalVerts = resolution * resolution + resolution * 4;
    const idxAttr = geometry.getAttribute("biomeIndices");
    const wAttr = geometry.getAttribute("biomeWeights");
    expect(idxAttr.array.length).toBe(expectedTotalVerts * 4);
    expect(wAttr.array.length).toBe(expectedTotalVerts * 4);
  });
});
