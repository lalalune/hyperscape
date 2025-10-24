/**
 * Workers Module
 * Exports worker management utilities
 */

export { WorkerPool } from './WorkerPool'
export { WorkerManager, getWorkerManager, terminateWorkerManager } from './WorkerManager'
export type {
  WorkerMessageType,
  BaseWorkerMessage,
  WorkerRequest,
  WorkerResponse,
  MeshFittingData,
  MeshFittingResult,
  ArmorFittingData,
  ArmorFittingResult,
  AssetNormalizationData,
  AssetNormalizationResult,
  WorkerTask,
  WorkerPoolConfig,
  WorkerMetrics,
} from './types'
