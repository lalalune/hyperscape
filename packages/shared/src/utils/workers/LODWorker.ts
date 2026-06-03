/**
 * LODWorker - Worker-based mesh decimation with sync fallback.
 * Sync path uses real @hyperforge/decimation (seam-aware QSlim).
 * Worker path uses simplified stride decimation (ES modules can't load in workers).
 */

import { WorkerPool } from "./WorkerPool";
import { decimateOptimized, optimized } from "@hyperforge/decimation";

// Use optimized functions that support skin weights
const { fromBufferGeometry, toBufferGeometryData } = optimized;

export interface LODLevelConfig {
  name: string;
  targetPercent: number;
  minVertices?: number;
  strictness?: 0 | 1 | 2;
}

export interface LODWorkerInput {
  meshId: string;
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  uvs?: Float32Array;
  /** Skin bone indices (4 per vertex) for skinned meshes like characters */
  skinIndex?: Uint16Array;
  /** Skin bone weights (4 per vertex) for skinned meshes like characters */
  skinWeight?: Float32Array;
  lodConfigs: LODLevelConfig[];
  category?: string;
}

export interface LODLevelOutput {
  name: string;
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array;
  /** Preserved skin bone indices (4 per vertex) - only present for skinned meshes */
  skinIndex?: Uint16Array;
  /** Preserved skin bone weights (4 per vertex) - only present for skinned meshes */
  skinWeight?: Float32Array;
  originalVertices: number;
  finalVertices: number;
  reductionPercent: number;
  processingTimeMs: number;
}

export interface LODWorkerOutput {
  meshId: string;
  levels: LODLevelOutput[];
  totalProcessingTimeMs: number;
  error?: string;
}

export const LOD_PRESETS: Record<string, LODLevelConfig[]> = {
  tree: [
    { name: "lod1", targetPercent: 30, minVertices: 200, strictness: 2 },
    { name: "lod2", targetPercent: 10, minVertices: 50, strictness: 2 },
  ],
  bush: [
    { name: "lod1", targetPercent: 35, minVertices: 100, strictness: 2 },
    { name: "lod2", targetPercent: 15, minVertices: 30, strictness: 2 },
  ],
  rock: [
    { name: "lod1", targetPercent: 40, minVertices: 80, strictness: 2 },
    { name: "lod2", targetPercent: 15, minVertices: 30, strictness: 2 },
  ],
  plant: [{ name: "lod1", targetPercent: 40, minVertices: 50, strictness: 2 }],
  building: [
    { name: "lod1", targetPercent: 50, minVertices: 500, strictness: 2 },
    { name: "lod2", targetPercent: 20, minVertices: 100, strictness: 2 },
  ],
  character: [
    { name: "lod1", targetPercent: 50, minVertices: 300, strictness: 2 },
    { name: "lod2", targetPercent: 25, minVertices: 100, strictness: 2 },
  ],
  item: [{ name: "lod1", targetPercent: 50, minVertices: 50, strictness: 2 }],
  default: [
    { name: "lod1", targetPercent: 30, minVertices: 100, strictness: 2 },
    { name: "lod2", targetPercent: 10, minVertices: 30, strictness: 2 },
  ],
};

/** Generate LODs synchronously using real QSlim decimation */
export function generateLODsSync(input: LODWorkerInput): LODWorkerOutput {
  const startTime = performance.now();

  try {
    const originalVertices = input.positions.length / 3;
    const levels: LODLevelOutput[] = [];
    const configs =
      input.lodConfigs.length > 0
        ? input.lodConfigs
        : (LOD_PRESETS[input.category ?? "default"] ?? LOD_PRESETS.default);

    // Build geometry object for fromBufferGeometry, including skin weights if present
    const geometryInput: {
      attributes: {
        position: { array: Float32Array; count: number };
        uv?: { array: Float32Array; count: number };
        skinIndex?: { array: Uint16Array; count: number };
        skinWeight?: { array: Float32Array; count: number };
      };
      index?: { array: Uint16Array | Uint32Array };
    } = {
      attributes: {
        position: { array: input.positions, count: originalVertices },
      },
    };

    if (input.uvs) {
      geometryInput.attributes.uv = {
        array: input.uvs,
        count: input.uvs.length / 2,
      };
    }

    if (input.skinIndex && input.skinWeight) {
      geometryInput.attributes.skinIndex = {
        array: input.skinIndex,
        count: originalVertices,
      };
      geometryInput.attributes.skinWeight = {
        array: input.skinWeight,
        count: originalVertices,
      };
    }

    if (input.indices) {
      geometryInput.index = { array: input.indices };
    }

    const meshData = fromBufferGeometry(geometryInput);
    const hasSkinWeights = meshData.hasSkinWeights();

    for (const config of configs) {
      const levelStart = performance.now();

      let effectiveTargetPercent = config.targetPercent;
      if (config.minVertices && originalVertices > 0) {
        const minPercent = (config.minVertices / originalVertices) * 100;
        effectiveTargetPercent = Math.max(effectiveTargetPercent, minPercent);
      }

      const meshCopy = meshData.clone();
      const decimationResult = decimateOptimized(meshCopy, {
        targetPercent: effectiveTargetPercent,
        strictness: config.strictness ?? 2,
      });

      const outputData = toBufferGeometryData(decimationResult.mesh);
      const reductionPercent =
        originalVertices > 0
          ? ((originalVertices - decimationResult.finalVertices) /
              originalVertices) *
            100
          : 0;

      const levelOutput: LODLevelOutput = {
        name: config.name,
        positions: outputData.position,
        indices: outputData.index,
        uvs: outputData.uv,
        originalVertices,
        finalVertices: decimationResult.finalVertices,
        reductionPercent,
        processingTimeMs: performance.now() - levelStart,
      };

      // Include skin weights if the mesh had them
      if (hasSkinWeights && outputData.skinIndex && outputData.skinWeight) {
        levelOutput.skinIndex = outputData.skinIndex;
        levelOutput.skinWeight = outputData.skinWeight;
      }

      levels.push(levelOutput);
    }

    return {
      meshId: input.meshId,
      levels,
      totalProcessingTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    return {
      meshId: input.meshId,
      levels: [],
      totalProcessingTimeMs: performance.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Inline worker code - uses deterministic stride sampling (not random)
const LOD_WORKER_CODE = `
function strideDecimate(positions, indices, uvs, targetPercent) {
  const vertexCount = positions.length / 3;
  const targetVerts = Math.max(4, Math.floor(vertexCount * targetPercent / 100));
  
  if (targetVerts >= vertexCount) {
    return { 
      positions: new Float32Array(positions), 
      indices: new Uint32Array(indices),
      uvs: uvs ? new Float32Array(uvs) : new Float32Array(0),
    };
  }
  
  const stride = Math.max(1, Math.floor(vertexCount / targetVerts));
  const keepVertex = new Array(vertexCount).fill(false);
  const newIndex = new Array(vertexCount).fill(-1);
  
  let kept = 0;
  for (let i = 0; i < vertexCount && kept < targetVerts; i += stride) {
    keepVertex[i] = true;
    newIndex[i] = kept++;
  }
  
  const newPositions = new Float32Array(kept * 3);
  const newUVs = uvs ? new Float32Array(kept * 2) : null;
  let pi = 0;
  let ui = 0;
  
  for (let i = 0; i < vertexCount; i++) {
    if (keepVertex[i]) {
      newPositions[pi++] = positions[i * 3];
      newPositions[pi++] = positions[i * 3 + 1];
      newPositions[pi++] = positions[i * 3 + 2];
      
      if (newUVs && uvs) {
        newUVs[ui++] = uvs[i * 2];
        newUVs[ui++] = uvs[i * 2 + 1];
      }
    }
  }
  
  const newIndicesArray = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = newIndex[indices[i]];
    const b = newIndex[indices[i + 1]];
    const c = newIndex[indices[i + 2]];
    if (a >= 0 && b >= 0 && c >= 0 && a !== b && b !== c && c !== a) {
      newIndicesArray.push(a, b, c);
    }
  }
  
  return {
    positions: newPositions,
    indices: new Uint32Array(newIndicesArray),
    uvs: newUVs || new Float32Array(0),
  };
}

self.onmessage = function(e) {
  const { meshId, positions, indices, uvs, lodConfigs } = e.data;
  const startTime = performance.now();
  
  try {
    const levels = [];
    const originalVertices = positions.length / 3;
    const configs = lodConfigs && lodConfigs.length > 0 ? lodConfigs : [
      { name: "lod1", targetPercent: 30, minVertices: 100 },
      { name: "lod2", targetPercent: 10, minVertices: 30 },
    ];
    
    for (const config of configs) {
      const levelStart = performance.now();
      let effectiveTargetPercent = config.targetPercent;
      if (config.minVertices && originalVertices > 0) {
        const minPercent = (config.minVertices / originalVertices) * 100;
        effectiveTargetPercent = Math.max(effectiveTargetPercent, minPercent);
      }
      
      const result = strideDecimate(positions, indices, uvs, effectiveTargetPercent);
      const finalVertices = result.positions.length / 3;
      const reductionPercent = originalVertices > 0
        ? ((originalVertices - finalVertices) / originalVertices) * 100
        : 0;
      
      levels.push({
        name: config.name,
        positions: result.positions,
        indices: result.indices,
        uvs: result.uvs,
        originalVertices,
        finalVertices,
        reductionPercent,
        processingTimeMs: levelEnd - levelStart,
      });
    }
    
    // Transfer ownership of ArrayBuffers for zero-copy
    const transfers = levels.flatMap(l => [
      l.positions.buffer,
      l.indices.buffer,
      l.uvs.buffer,
    ]);
    
    self.postMessage({
      result: {
        meshId,
        levels,
        totalProcessingTimeMs: performance.now() - startTime,
      }
    }, transfers);
  } catch (error) {
    self.postMessage({
      result: {
        meshId,
        levels: [],
        totalProcessingTimeMs: performance.now() - startTime,
        error: error.message || 'Worker error',
      }
    });
  }
};
`;

let lodWorkerPool: WorkerPool<LODWorkerInput, LODWorkerOutput> | null = null;

/** Track if workers are available */
let workersChecked = false;
let workersAvailable = false;

/**
 * Check if LOD workers are available (client-side with Worker + Blob URL support)
 * Bun provides Worker and Blob but doesn't support blob URLs for workers
 */
function checkWorkerAvailability(): boolean {
  if (!workersChecked) {
    workersChecked = true;
    // Check basic Worker/Blob availability
    if (typeof Worker === "undefined" || typeof Blob === "undefined") {
      workersAvailable = false;
      return workersAvailable;
    }
    // Detect Bun runtime - Bun has Worker/Blob but blob URLs don't work for workers
    if (
      typeof process !== "undefined" &&
      process.versions &&
      "bun" in process.versions
    ) {
      workersAvailable = false;
      return workersAvailable;
    }
    // Detect Node.js runtime (no browser globals like window)
    if (typeof window === "undefined") {
      workersAvailable = false;
      return workersAvailable;
    }
    workersAvailable = true;
  }
  return workersAvailable;
}

export function getLODWorkerPool(
  poolSize?: number,
): WorkerPool<LODWorkerInput, LODWorkerOutput> | null {
  // Return null if workers not available (graceful degradation for server/Bun)
  if (!checkWorkerAvailability()) {
    return null;
  }

  if (!lodWorkerPool) {
    lodWorkerPool = new WorkerPool<LODWorkerInput, LODWorkerOutput>(
      LOD_WORKER_CODE,
      poolSize,
      generateLODsSync,
    );
  }
  return lodWorkerPool;
}

export function isLODWorkerAvailable(): boolean {
  const pool = getLODWorkerPool();
  return pool !== null && pool.hasWorkers();
}

export async function generateLODsAsync(
  input: LODWorkerInput,
): Promise<LODWorkerOutput> {
  const pool = getLODWorkerPool();

  // Fall back to sync generation if workers not available (server/Bun)
  if (!pool) {
    return generateLODsSync(input);
  }

  const positions = new Float32Array(input.positions);
  const indices =
    input.indices instanceof Uint32Array
      ? new Uint32Array(input.indices)
      : new Uint32Array(input.indices);
  const uvs = input.uvs ? new Float32Array(input.uvs) : undefined;
  const transfers: Transferable[] = [positions.buffer, indices.buffer];
  if (uvs) transfers.push(uvs.buffer);

  return pool.execute({ ...input, positions, indices, uvs }, transfers);
}

export async function generateLODsBatch(
  inputs: LODWorkerInput[],
): Promise<LODWorkerOutput[]> {
  return Promise.all(inputs.map(generateLODsAsync));
}

export function terminateLODWorkerPool(): void {
  if (lodWorkerPool) {
    lodWorkerPool.terminate();
    lodWorkerPool = null;
  }
}

export function getLODWorkerStats() {
  const pool = getLODWorkerPool();
  if (!pool) {
    return {
      workerCount: 0,
      busyCount: 0,
      queuedTasks: 0,
      totalTasksProcessed: 0,
      workersAvailable: false,
      initError: "Workers not available in this environment",
    };
  }
  return pool.getStats();
}
