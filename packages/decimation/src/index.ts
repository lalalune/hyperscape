/**
 * Seam-Aware Mesh Decimation
 *
 * Main entry point for the decimation library.
 * Implements seam-aware mesh simplification that preserves UV boundaries.
 *
 * Based on "Seamless: Seam erasure and seam-aware decal projection for 3D meshes"
 * SIGGRAPH Asia 2017
 *
 * @module @hyperforge/decimation
 */

import {
  type Vec2,
  type Vec3,
  MeshData,
  type DecimationOptions,
} from "./types.js";
import {
  decimate as decimateInternal,
  type StopReason,
} from "./decimation/decimate.js";

// ============================================================================
// OPTIMIZED IMPLEMENTATION EXPORTS
// ============================================================================

/**
 * High-performance optimized decimation using typed arrays.
 *
 * The optimized module provides:
 * - 2-5x faster decimation using flat typed arrays
 * - Zero-copy worker transfers
 * - Cache-friendly memory layout
 * - WebGPU-ready data structures
 *
 * @example
 * ```typescript
 * import {
 *   OptimizedMeshData,
 *   decimateOptimized,
 *   fromLegacyMeshData,
 *   toLegacyMeshData,
 * } from '@hyperforge/decimation/optimized';
 *
 * // Convert from legacy format
 * const optimizedMesh = fromLegacyMeshData(mesh);
 *
 * // Or use directly with typed arrays
 * const mesh = new OptimizedMeshData(positions, uvs, faceVertices, faceTexCoords);
 * const result = decimateOptimized(mesh, { targetPercent: 50 });
 *
 * // Convert back if needed
 * const legacyMesh = toLegacyMeshData(result.mesh);
 * ```
 */
export * as optimized from "./optimized/index.js";

/**
 * Optimized decimation function using typed arrays.
 * This is a re-export for convenient access.
 */
export { decimateOptimized, OptimizedMeshData } from "./optimized/index.js";
export type {
  OptimizedDecimationOptions,
  OptimizedDecimationResult,
} from "./optimized/index.js";

/**
 * Parallel decimation using Web Workers.
 * Falls back to sequential processing if workers are unavailable.
 */
export {
  decimateParallel,
  workersAvailable,
  getRecommendedWorkerCount,
  DecimationWorkerPool,
} from "./optimized/index.js";
export type {
  ParallelDecimationOptions,
  WorkerPoolOptions,
  BatchComputeResult,
} from "./optimized/index.js";

/**
 * GPU-accelerated decimation using WebGPU.
 * Falls back to CPU if WebGPU is unavailable.
 */
export {
  decimateGPU,
  shouldUseGPU,
  GPUDecimationContext,
  isWebGPUAvailable,
  getGPUInfo,
} from "./optimized/index.js";
export type {
  GPUDecimationOptions,
  GPUContextOptions,
} from "./optimized/index.js";

/**
 * RECOMMENDED: Fully off-thread decimation.
 * Runs the entire algorithm in a Web Worker - zero main thread blocking.
 */
export {
  decimateOffThread,
  decimateBatchOffThread,
  decimateTimeSliced,
} from "./optimized/index.js";
export type {
  OffThreadDecimationOptions,
  DecimationProgress,
} from "./optimized/index.js";

/**
 * SharedArrayBuffer-based parallel processing.
 * Uses shared memory for true zero-copy worker communication.
 */
export {
  SharedMemoryWorkerPool,
  sharedArrayBufferAvailable,
  decimateSharedMemory,
} from "./optimized/index.js";

/**
 * SIMD-accelerated math operations.
 * Uses WebAssembly SIMD for high-performance matrix operations.
 */
export {
  simdAvailable,
  initSIMD,
  quadform6SIMD,
  batchQuadform6,
  add6x6InplaceSIMD,
} from "./optimized/index.js";

/**
 * Spatial indexing for O(1) neighbor lookups.
 * Accelerates "find affected edges" operations after collapse.
 */
export {
  EdgeSpatialHash,
  buildEdgeSpatialHash,
  VertexEdgeIndex,
  buildVertexEdgeIndex,
} from "./optimized/index.js";
export type { SpatialHashConfig } from "./optimized/index.js";

// Re-export types
export * from "./types.js";
export type { StopReason } from "./decimation/decimate.js";

// Re-export utilities
export {
  buildEdgeFlaps,
  getHalfEdgeBundle,
  edgeCollapseIsValid,
} from "./mesh/half-edge.js";
export { buildSeamEdges, containsEdge, insertEdge } from "./mesh/edge-map.js";
export {
  computeHalfEdgeQSlim5D,
  getCombinedMetric,
  computeQuadricErrorMetric3D,
} from "./decimation/quadric.js";
export { costAndPlacement5D } from "./decimation/cost-placement.js";
export {
  checkNoFoldover,
  wouldCauseFoldover,
  signedTriangleArea,
  twoPointsOnSameSide,
} from "./decimation/foldover.js";

/**
 * Decimation result with statistics
 */
export interface DecimationResult {
  /** Simplified mesh data */
  mesh: MeshData;
  /** Original vertex count */
  originalVertices: number;
  /** Final vertex count */
  finalVertices: number;
  /** Original face count */
  originalFaces: number;
  /** Final face count */
  finalFaces: number;
  /** Number of edge collapses performed */
  collapses: number;
  /** Reason decimation stopped */
  stopReason: StopReason;
}

/**
 * Decimate a mesh to reduce vertex/face count while preserving UV seams
 *
 * @param mesh Input mesh data with vertices, faces, and UVs
 * @param options Decimation options (target vertices, percentage, strictness)
 * @returns Decimation result with simplified mesh and statistics
 *
 * @example
 * ```typescript
 * import { decimate, MeshData } from '@hyperforge/decimation';
 *
 * const mesh = new MeshData(vertices, faces, texCoords, faceTexCoords);
 * const result = decimate(mesh, { targetPercent: 50 }); // Reduce to 50%
 * console.log(`Reduced from ${result.originalVertices} to ${result.finalVertices} vertices`);
 * ```
 */
export function decimate(
  mesh: MeshData,
  options: DecimationOptions = {},
): DecimationResult {
  const originalVertices = mesh.V.length;
  const originalFaces = mesh.F.length;

  // Use the internal decimation implementation
  const internalResult = decimateInternal(mesh, options);

  return {
    mesh: internalResult.mesh,
    originalVertices,
    finalVertices: internalResult.finalVertexCount,
    originalFaces,
    finalFaces: internalResult.mesh.F.length,
    collapses: internalResult.collapses,
    stopReason: internalResult.stopReason,
  };
}

/**
 * Convert Three.js BufferGeometry to MeshData format
 * Utility function for integration with Three.js
 */
export function fromBufferGeometry(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array,
  uvs?: Float32Array,
): MeshData {
  // Extract vertices
  const V: Vec3[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    V.push([positions[i], positions[i + 1], positions[i + 2]]);
  }

  // Extract faces
  const F: [number, number, number][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    F.push([indices[i], indices[i + 1], indices[i + 2]]);
  }

  // Extract UVs (or create default)
  const TC: Vec2[] = [];
  if (uvs) {
    for (let i = 0; i < uvs.length; i += 2) {
      TC.push([uvs[i], uvs[i + 1]]);
    }
  } else {
    // Create default UVs
    for (let i = 0; i < V.length; i++) {
      TC.push([0, 0]);
    }
  }

  // Face texture indices (same as face indices if 1:1 mapping)
  const FT: [number, number, number][] = F.map(
    (f) => [...f] as [number, number, number],
  );

  return new MeshData(V, F, TC, FT);
}

/**
 * Convert MeshData back to arrays suitable for Three.js BufferGeometry
 */
export function toBufferGeometry(mesh: MeshData): {
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array;
} {
  const positions = new Float32Array(mesh.V.length * 3);
  for (let i = 0; i < mesh.V.length; i++) {
    positions[i * 3] = mesh.V[i][0];
    positions[i * 3 + 1] = mesh.V[i][1];
    positions[i * 3 + 2] = mesh.V[i][2];
  }

  const indices = new Uint32Array(mesh.F.length * 3);
  for (let i = 0; i < mesh.F.length; i++) {
    indices[i * 3] = mesh.F[i][0];
    indices[i * 3 + 1] = mesh.F[i][1];
    indices[i * 3 + 2] = mesh.F[i][2];
  }

  const uvs = new Float32Array(mesh.TC.length * 2);
  for (let i = 0; i < mesh.TC.length; i++) {
    uvs[i * 2] = mesh.TC[i][0];
    uvs[i * 2 + 1] = mesh.TC[i][1];
  }

  return { positions, indices, uvs };
}

// =============================================================================
// BATCH LOD GENERATION
// =============================================================================

/**
 * Configuration for a single LOD level
 */
export interface LODLevelConfig {
  /** LOD level name (e.g., "lod1", "lod2") */
  name: string;
  /** Target percentage of original vertices (1-100) */
  targetPercent: number;
  /** Minimum vertices to preserve */
  minVertices?: number;
  /** Decimation strictness (0=fast, 1=balanced, 2=seam-aware) */
  strictness?: 0 | 1 | 2;
}

/**
 * Result for a single LOD level generation
 */
export interface LODLevelResult {
  /** LOD level name */
  name: string;
  /** Simplified mesh data */
  mesh: MeshData;
  /** Original vertex count */
  originalVertices: number;
  /** Final vertex count */
  finalVertices: number;
  /** Original face count */
  originalFaces: number;
  /** Final face count */
  finalFaces: number;
  /** Vertex reduction percentage achieved */
  reductionPercent: number;
  /** Time taken to generate this LOD (ms) */
  processingTimeMs: number;
}

/**
 * Result of batch LOD generation
 */
export interface BatchLODResult {
  /** Results for each LOD level, in order */
  levels: LODLevelResult[];
  /** Total processing time for all levels (ms) */
  totalProcessingTimeMs: number;
  /** Statistics summary */
  summary: {
    originalVertices: number;
    originalFaces: number;
    /** Map of level name to final vertex count */
    verticesByLevel: Record<string, number>;
    /** Map of level name to final face count */
    facesByLevel: Record<string, number>;
  };
}

/**
 * Default LOD level configurations for vegetation assets
 */
export const VEGETATION_LOD_PRESETS: Record<string, LODLevelConfig[]> = {
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
  default: [
    { name: "lod1", targetPercent: 30, minVertices: 100, strictness: 2 },
    { name: "lod2", targetPercent: 10, minVertices: 30, strictness: 2 },
  ],
};

/**
 * Generate multiple LOD levels from a single mesh
 *
 * Each LOD level is decimated from the original mesh (not cascaded) to ensure
 * consistent quality at each level.
 *
 * @param mesh Input mesh data
 * @param levels Array of LOD level configurations
 * @returns Batch LOD result with all generated levels
 *
 * @example
 * ```typescript
 * import { generateLODLevels, MeshData, VEGETATION_LOD_PRESETS } from '@hyperforge/decimation';
 *
 * const mesh = new MeshData(vertices, faces, texCoords, faceTexCoords);
 *
 * // Use preset configuration for trees
 * const result = generateLODLevels(mesh, VEGETATION_LOD_PRESETS.tree);
 *
 * // Or use custom configuration
 * const result = generateLODLevels(mesh, [
 *   { name: "lod1", targetPercent: 50, minVertices: 100 },
 *   { name: "lod2", targetPercent: 25, minVertices: 50 },
 *   { name: "lod3", targetPercent: 10, minVertices: 20 },
 * ]);
 *
 * console.log(`Generated ${result.levels.length} LOD levels`);
 * for (const level of result.levels) {
 *   console.log(`${level.name}: ${level.finalVertices} vertices (${level.reductionPercent.toFixed(1)}% reduction)`);
 * }
 * ```
 */
export function generateLODLevels(
  mesh: MeshData,
  levels: LODLevelConfig[],
): BatchLODResult {
  const totalStartTime = performance.now();
  const originalVertices = mesh.V.length;
  const originalFaces = mesh.F.length;

  const results: LODLevelResult[] = [];
  const verticesByLevel: Record<string, number> = {};
  const facesByLevel: Record<string, number> = {};

  // Generate each LOD level from the original mesh
  for (const levelConfig of levels) {
    const levelStartTime = performance.now();

    // Calculate effective target based on minVertices
    let effectiveTargetPercent = levelConfig.targetPercent;
    if (levelConfig.minVertices && originalVertices > 0) {
      const minPercent = (levelConfig.minVertices / originalVertices) * 100;
      effectiveTargetPercent = Math.max(effectiveTargetPercent, minPercent);
    }

    // Clone mesh for decimation (decimation modifies in place)
    const meshCopy = mesh.clone();

    // Perform decimation
    const decimationResult = decimate(meshCopy, {
      targetPercent: effectiveTargetPercent,
      strictness: levelConfig.strictness ?? 2,
    });

    const levelEndTime = performance.now();
    const reductionPercent =
      originalVertices > 0
        ? ((originalVertices - decimationResult.finalVertices) /
            originalVertices) *
          100
        : 0;

    const levelResult: LODLevelResult = {
      name: levelConfig.name,
      mesh: decimationResult.mesh,
      originalVertices,
      finalVertices: decimationResult.finalVertices,
      originalFaces,
      finalFaces: decimationResult.finalFaces,
      reductionPercent,
      processingTimeMs: levelEndTime - levelStartTime,
    };

    results.push(levelResult);
    verticesByLevel[levelConfig.name] = decimationResult.finalVertices;
    facesByLevel[levelConfig.name] = decimationResult.finalFaces;
  }

  const totalEndTime = performance.now();

  return {
    levels: results,
    totalProcessingTimeMs: totalEndTime - totalStartTime,
    summary: {
      originalVertices,
      originalFaces,
      verticesByLevel,
      facesByLevel,
    },
  };
}

/**
 * Generate LOD levels using a preset configuration
 *
 * @param mesh Input mesh data
 * @param category Asset category (tree, bush, rock, plant, or default)
 * @returns Batch LOD result
 *
 * @example
 * ```typescript
 * const result = generateLODLevelsFromPreset(treeMesh, "tree");
 * ```
 */
export function generateLODLevelsFromPreset(
  mesh: MeshData,
  category: keyof typeof VEGETATION_LOD_PRESETS,
): BatchLODResult {
  const presetLevels =
    VEGETATION_LOD_PRESETS[category] || VEGETATION_LOD_PRESETS.default;
  return generateLODLevels(mesh, presetLevels);
}

/**
 * Generate a single LOD level with simplified options
 *
 * @param mesh Input mesh data
 * @param targetPercent Target percentage of vertices to keep
 * @param options Additional decimation options
 * @returns Decimation result
 *
 * @example
 * ```typescript
 * const lod1 = generateSingleLOD(mesh, 30); // 30% of original
 * const lod2 = generateSingleLOD(mesh, 10, { minVertices: 50 });
 * ```
 */
export function generateSingleLOD(
  mesh: MeshData,
  targetPercent: number,
  options: {
    minVertices?: number;
    strictness?: 0 | 1 | 2;
  } = {},
): DecimationResult {
  const originalVertices = mesh.V.length;

  // Calculate effective target based on minVertices
  let effectiveTargetPercent = targetPercent;
  if (options.minVertices && originalVertices > 0) {
    const minPercent = (options.minVertices / originalVertices) * 100;
    effectiveTargetPercent = Math.max(effectiveTargetPercent, minPercent);
  }

  // Clone mesh for decimation
  const meshCopy = mesh.clone();

  return decimate(meshCopy, {
    targetPercent: effectiveTargetPercent,
    strictness: options.strictness ?? 2,
  });
}
