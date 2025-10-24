/**
 * Web Worker Types and Interfaces
 * Defines message types for worker communication
 */

// Base message types
export type WorkerMessageType =
  | 'INIT'
  | 'FIT_MESH'
  | 'SHRINKWRAP_ARMOR'
  | 'NORMALIZE_ASSET'
  | 'CALCULATE_WEIGHTS'
  | 'PROGRESS'
  | 'SUCCESS'
  | 'ERROR'

export interface BaseWorkerMessage {
  id: string
  type: WorkerMessageType
}

export interface WorkerRequest<T = unknown> extends BaseWorkerMessage {
  data: T
}

export interface WorkerResponse<T = unknown> extends BaseWorkerMessage {
  data?: T
  error?: string
  progress?: number
}

// Mesh Fitting Worker Messages
export interface MeshFittingData {
  sourcePositions: Float32Array
  sourceIndices?: Uint32Array
  targetPositions: Float32Array
  targetIndices?: Uint32Array
  sourceMatrix: number[] // 4x4 matrix as array
  targetMatrix: number[] // 4x4 matrix as array
  parameters: {
    iterations: number
    stepSize: number
    targetOffset: number
    smoothingIterations: number
    smoothingFactor: number
    constraintBounds?: {
      min: [number, number, number]
      max: [number, number, number]
    }
    lockedVertices?: number[]
  }
}

export interface MeshFittingResult {
  positions: Float32Array
  displacements: Float32Array
  metadata: {
    iterations: number
    maxDisplacement: number
    averageDisplacement: number
    processingTime: number
  }
}

// Armor Fitting Worker Messages
export interface ArmorFittingData {
  armorPositions: Float32Array
  armorIndices?: Uint32Array
  bodyPositions: Float32Array
  bodyIndices?: Uint32Array
  bodySkinIndices?: Float32Array
  bodySkinWeights?: Float32Array
  boneMatrices: number[][] // Array of 4x4 matrices
  armorMatrix: number[]
  bodyMatrix: number[]
  parameters: {
    iterations: number
    stepSize: number
    targetOffset: number
    preserveOpenings: boolean
    armorType: string
  }
}

export interface ArmorFittingResult {
  positions: Float32Array
  skinIndices?: Float32Array
  skinWeights?: Float32Array
  metadata: {
    iterations: number
    verticesProcessed: number
    processingTime: number
  }
}

// Asset Normalization Worker Messages
export interface AssetNormalizationData {
  positions: Float32Array
  indices?: Uint32Array
  normals?: Float32Array
  uvs?: Float32Array
  assetType: string
  subtype?: string
  parameters: {
    targetHeight?: number
    gripPoint?: [number, number, number]
  }
}

export interface AssetNormalizationResult {
  positions: Float32Array
  normals?: Float32Array
  metadata: {
    originalBounds: {
      min: [number, number, number]
      max: [number, number, number]
    }
    normalizedBounds: {
      min: [number, number, number]
      max: [number, number, number]
    }
    transformsApplied: {
      translation: [number, number, number]
      rotation: [number, number, number]
      scale: number
    }
    processingTime: number
  }
}

// Worker Pool Task
export interface WorkerTask<TData = unknown, TResult = unknown> {
  id: string
  type: WorkerMessageType
  data: TData
  resolve: (result: TResult) => void
  reject: (error: Error) => void
  onProgress?: (progress: number) => void
}

// Worker Pool Configuration
export interface WorkerPoolConfig {
  maxWorkers?: number
  workerScript: string
  terminateOnIdle?: boolean
  idleTimeout?: number
}

// Performance Metrics
export interface WorkerMetrics {
  taskId: string
  workerIndex: number
  startTime: number
  endTime: number
  duration: number
  type: WorkerMessageType
  success: boolean
  error?: string
}
