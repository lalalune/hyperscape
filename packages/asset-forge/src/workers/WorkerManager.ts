/**
 * Worker Manager
 * Provides high-level API for using workers with automatic fallback
 */

import { Box3, BufferGeometry, Mesh, SkinnedMesh, Vector3 } from 'three'
import { createLogger } from '../utils/logger'
import { WorkerPool } from './WorkerPool'

const logger = createLogger('WorkerManager')
import type {
  MeshFittingData,
  MeshFittingResult,
  ArmorFittingData,
  ArmorFittingResult,
  AssetNormalizationData,
  AssetNormalizationResult,
} from './types'

// Check if workers are supported
const WORKERS_SUPPORTED = typeof Worker !== 'undefined'

export class WorkerManager {
  private meshFittingPool: WorkerPool | null = null
  private armorFittingPool: WorkerPool | null = null
  private assetNormalizationPool: WorkerPool | null = null
  private useWorkers: boolean = WORKERS_SUPPORTED

  constructor(useWorkers: boolean = WORKERS_SUPPORTED) {
    this.useWorkers = useWorkers && WORKERS_SUPPORTED

    if (!WORKERS_SUPPORTED) {
      logger.warn('Web Workers not supported - will use main thread fallback')
    } else if (!useWorkers) {
      logger.info('Web Workers disabled by configuration')
    } else {
      logger.info('Web Workers enabled')
    }
  }

  /**
   * Initialize worker pools lazily when first needed
   */
  private initMeshFittingPool(): void {
    if (!this.meshFittingPool && this.useWorkers) {
      this.meshFittingPool = new WorkerPool({
        workerScript: new URL('./MeshFittingWorker.ts', import.meta.url).href,
        maxWorkers: 2, // Limit to 2 workers for mesh fitting
      })
    }
  }

  private initArmorFittingPool(): void {
    if (!this.armorFittingPool && this.useWorkers) {
      this.armorFittingPool = new WorkerPool({
        workerScript: new URL('./ArmorFittingWorker.ts', import.meta.url).href,
        maxWorkers: 2, // Limit to 2 workers for armor fitting
      })
    }
  }

  private initAssetNormalizationPool(): void {
    if (!this.assetNormalizationPool && this.useWorkers) {
      this.assetNormalizationPool = new WorkerPool({
        workerScript: new URL('./AssetNormalizationWorker.ts', import.meta.url).href,
        maxWorkers: 4, // Can handle more normalization tasks
      })
    }
  }

  /**
   * Fit mesh to target using worker or fallback
   */
  async fitMeshToTarget(
    sourceMesh: Mesh,
    targetMesh: Mesh,
    parameters: {
      iterations: number
      stepSize: number
      targetOffset: number
      smoothingIterations: number
      smoothingFactor: number
      constraintBounds?: Box3
      lockedVertices?: number[]
    },
    onProgress?: (progress: number) => void
  ): Promise<{ positions: Float32Array; metadata: MeshFittingResult['metadata'] }> {
    if (!this.useWorkers) {
      logger.warn('Worker not available, using main thread fallback')
      // For now, throw error - fallback would be implemented in calling service
      throw new Error('Worker fallback not implemented - use service directly')
    }

    this.initMeshFittingPool()

    // Extract geometry data
    const sourceGeometry = sourceMesh.geometry as BufferGeometry
    const targetGeometry = targetMesh.geometry as BufferGeometry

    const sourcePositions = new Float32Array(sourceGeometry.attributes.position.array)
    const targetPositions = new Float32Array(targetGeometry.attributes.position.array)

    const sourceIndices = sourceGeometry.index
      ? new Uint32Array(sourceGeometry.index.array)
      : undefined

    const targetIndices = targetGeometry.index
      ? new Uint32Array(targetGeometry.index.array)
      : undefined

    // Extract matrices
    sourceMesh.updateMatrixWorld(true)
    targetMesh.updateMatrixWorld(true)

    const sourceMatrix = sourceMesh.matrixWorld.elements
    const targetMatrix = targetMesh.matrixWorld.elements

    // Prepare worker data
    const data: MeshFittingData = {
      sourcePositions,
      sourceIndices,
      targetPositions,
      targetIndices,
      sourceMatrix: Array.from(sourceMatrix),
      targetMatrix: Array.from(targetMatrix),
      parameters: {
        iterations: parameters.iterations,
        stepSize: parameters.stepSize,
        targetOffset: parameters.targetOffset,
        smoothingIterations: parameters.smoothingIterations,
        smoothingFactor: parameters.smoothingFactor,
        constraintBounds: parameters.constraintBounds
          ? {
              min: [
                parameters.constraintBounds.min.x,
                parameters.constraintBounds.min.y,
                parameters.constraintBounds.min.z,
              ],
              max: [
                parameters.constraintBounds.max.x,
                parameters.constraintBounds.max.y,
                parameters.constraintBounds.max.z,
              ],
            }
          : undefined,
        lockedVertices: parameters.lockedVertices,
      },
    }

    // Execute in worker
    const result = await this.meshFittingPool!.execute<MeshFittingData, MeshFittingResult>(
      'FIT_MESH',
      data,
      onProgress
    )

    return {
      positions: result.positions,
      metadata: result.metadata,
    }
  }

  /**
   * Fit armor to body using worker or fallback
   */
  async fitArmorToBody(
    armorMesh: Mesh,
    bodyMesh: SkinnedMesh,
    parameters: {
      iterations: number
      stepSize: number
      targetOffset: number
      preserveOpenings: boolean
      armorType: string
    },
    onProgress?: (progress: number) => void
  ): Promise<{
    positions: Float32Array
    skinIndices?: Float32Array
    skinWeights?: Float32Array
    metadata: ArmorFittingResult['metadata']
  }> {
    if (!this.useWorkers) {
      logger.warn('Worker not available, using main thread fallback')
      throw new Error('Worker fallback not implemented - use service directly')
    }

    this.initArmorFittingPool()

    // Extract geometry data
    const armorGeometry = armorMesh.geometry as BufferGeometry
    const bodyGeometry = bodyMesh.geometry as BufferGeometry

    const armorPositions = new Float32Array(armorGeometry.attributes.position.array)
    const bodyPositions = new Float32Array(bodyGeometry.attributes.position.array)

    const armorIndices = armorGeometry.index
      ? new Uint32Array(armorGeometry.index.array)
      : undefined

    const bodyIndices = bodyGeometry.index ? new Uint32Array(bodyGeometry.index.array) : undefined

    // Extract skin data
    const bodySkinIndices = bodyGeometry.attributes.skinIndex
      ? new Float32Array(bodyGeometry.attributes.skinIndex.array)
      : undefined

    const bodySkinWeights = bodyGeometry.attributes.skinWeight
      ? new Float32Array(bodyGeometry.attributes.skinWeight.array)
      : undefined

    // Extract bone matrices
    const boneMatrices: number[][] = []
    if (bodyMesh.skeleton) {
      bodyMesh.skeleton.bones.forEach(bone => {
        bone.updateMatrixWorld(true)
        boneMatrices.push(Array.from(bone.matrixWorld.elements))
      })
    }

    // Extract matrices
    armorMesh.updateMatrixWorld(true)
    bodyMesh.updateMatrixWorld(true)

    const armorMatrix = armorMesh.matrixWorld.elements
    const bodyMatrix = bodyMesh.matrixWorld.elements

    // Prepare worker data
    const data: ArmorFittingData = {
      armorPositions,
      armorIndices,
      bodyPositions,
      bodyIndices,
      bodySkinIndices,
      bodySkinWeights,
      boneMatrices,
      armorMatrix: Array.from(armorMatrix),
      bodyMatrix: Array.from(bodyMatrix),
      parameters,
    }

    // Execute in worker
    const result = await this.armorFittingPool!.execute<ArmorFittingData, ArmorFittingResult>(
      'SHRINKWRAP_ARMOR',
      data,
      onProgress
    )

    return {
      positions: result.positions,
      skinIndices: result.skinIndices,
      skinWeights: result.skinWeights,
      metadata: result.metadata,
    }
  }

  /**
   * Normalize asset using worker or fallback
   */
  async normalizeAsset(
    geometry: BufferGeometry,
    assetType: string,
    subtype?: string,
    parameters?: {
      targetHeight?: number
      gripPoint?: Vector3
    },
    onProgress?: (progress: number) => void
  ): Promise<{
    positions: Float32Array
    normals?: Float32Array
    metadata: AssetNormalizationResult['metadata']
  }> {
    if (!this.useWorkers) {
      logger.warn('Worker not available, using main thread fallback')
      throw new Error('Worker fallback not implemented - use service directly')
    }

    this.initAssetNormalizationPool()

    // Extract geometry data
    const positions = new Float32Array(geometry.attributes.position.array)
    const indices = geometry.index ? new Uint32Array(geometry.index.array) : undefined
    const normals = geometry.attributes.normal
      ? new Float32Array(geometry.attributes.normal.array)
      : undefined
    const uvs = geometry.attributes.uv ? new Float32Array(geometry.attributes.uv.array) : undefined

    // Prepare worker data
    const data: AssetNormalizationData = {
      positions,
      indices,
      normals,
      uvs,
      assetType,
      subtype,
      parameters: {
        targetHeight: parameters?.targetHeight,
        gripPoint: parameters?.gripPoint
          ? [parameters.gripPoint.x, parameters.gripPoint.y, parameters.gripPoint.z]
          : undefined,
      },
    }

    // Execute in worker
    const result = await this.assetNormalizationPool!.execute<
      AssetNormalizationData,
      AssetNormalizationResult
    >('NORMALIZE_ASSET', data, onProgress)

    return {
      positions: result.positions,
      normals: result.normals,
      metadata: result.metadata,
    }
  }

  /**
   * Get statistics for all worker pools
   */
  getStats() {
    return {
      enabled: this.useWorkers,
      supported: WORKERS_SUPPORTED,
      pools: {
        meshFitting: this.meshFittingPool?.getStats(),
        armorFitting: this.armorFittingPool?.getStats(),
        assetNormalization: this.assetNormalizationPool?.getStats(),
      },
    }
  }

  /**
   * Terminate all worker pools
   */
  terminate(): void {
    if (this.meshFittingPool) {
      this.meshFittingPool.terminateAll()
      this.meshFittingPool = null
    }
    if (this.armorFittingPool) {
      this.armorFittingPool.terminateAll()
      this.armorFittingPool = null
    }
    if (this.assetNormalizationPool) {
      this.assetNormalizationPool.terminateAll()
      this.assetNormalizationPool = null
    }
  }

  /**
   * Clear metrics from all pools
   */
  clearMetrics(): void {
    this.meshFittingPool?.clearMetrics()
    this.armorFittingPool?.clearMetrics()
    this.assetNormalizationPool?.clearMetrics()
  }
}

// Singleton instance
let workerManager: WorkerManager | null = null

/**
 * Get or create the global worker manager instance
 */
export function getWorkerManager(useWorkers: boolean = WORKERS_SUPPORTED): WorkerManager {
  if (!workerManager) {
    workerManager = new WorkerManager(useWorkers)
  }
  return workerManager
}

/**
 * Terminate the global worker manager
 */
export function terminateWorkerManager(): void {
  if (workerManager) {
    workerManager.terminate()
    workerManager = null
  }
}
