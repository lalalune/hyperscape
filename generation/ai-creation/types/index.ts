/**
 * Comprehensive Type Definitions Index
 * 
 * Central export point for all AI Creation Service types,
 * replacing unsafe 'any' types throughout the codebase.
 */

// Core geometry and 3D types
export type {
  Vector3,
  Vector2,
  Quaternion,
  BoundingBox,
  GeometryData,
  GeometryMetadata,
  MaterialData,
  ItemData,
  EquipmentData,
  EquipmentStats,
  ItemRequirements,
  ItemCategory,
  EquipmentSlot,
  WeaponType as GeometryWeaponType,
  ArmorType,
  TextureData,
  TextureMetadata,
  TextureFormat,
  TextureAtlas,
  AtlasRegion,
  AtlasMetadata
} from './geometry'

export {
  validateVector3,
  validateQuaternion,
  validateGeometryData,
  validateItemData,
  assertVector3,
  assertGeometryData,
  assertItemData,
  createVector3,
  createQuaternion,
  createBoundingBox
} from './geometry'

// API and service types
export type {
  MeshyConfig,
  MeshyQuotaInfo,
  TextTo3DRequest,
  ImageTo3DRequest,
  RiggingRequest,
  MeshyArtStyle,
  MeshyTopology,
  MeshySurfaceMode,
  MeshyRigType,
  MeshyAnimationStyle,
  MeshyTaskResponse,
  MeshyModelUrls,
  MeshyTaskMetadata,
  MeshyTaskStatus,
  MeshyError,
  MeshyHealthResponse,
  GenerationRequest,
  GenerationMetadata,
  GenerationType,
  RequestPriority,
  GenerationResult,
  GenerationResultMetadata,
  PerformanceMetrics,
  GenerationStatus,
  GenerationError,
  BatchRequest,
  BatchOptions,
  BatchResult,
  BatchProgress,
  BatchSummary,
  BatchStatus
} from './api'

export {
  validateMeshyConfig,
  validateTextTo3DRequest,
  validateMeshyTaskResponse,
  validateGenerationRequest,
  assertMeshyConfig,
  assertTextTo3DRequest,
  assertMeshyTaskResponse,
  createGenerationRequest,
  createMeshyError
} from './api'

// Hardpoint detection types
export type {
  GeometryAnalysis,
  PrincipalAxes,
  GeometryComplexity,
  GeometryQuality,
  HardpointCandidate,
  GeometricFeatures,
  HardpointValidation,
  HardpointMetadata,
  HardpointType,
  HardpointDetectionMethod,
  DetectedHardpoints,
  HardpointAnalysisMetadata,
  WeaponType,
  VisualizationData,
  HardpointMarker,
  OrientationVector,
  GeometryHighlight,
  ConfidenceHeatmap,
  AnalysisOverlay,
  MarkerShape,
  MarkerAnimation,
  VectorType,
  HighlightType,
  HighlightAnimation,
  ColorMapType,
  HardpointAccuracyMetrics,
  DetailedAccuracyMetrics,
  BenchmarkComparison,
  HardpointDetectionConfig,
  WeaponSpecificConfig,
  ToleranceSettings,
  HardpointTemplate
} from './hardpoints'

export {
  validateHardpointCandidate,
  validateDetectedHardpoints,
  validateGeometryAnalysis,
  assertHardpointCandidate,
  assertDetectedHardpoints,
  assertGeometryAnalysis,
  createHardpointCandidate,
  createDefaultVisualizationData,
  calculateConfidenceScore,
  findBestCandidate,
  validateHardpointConfiguration
} from './hardpoints'

// Retexturing and texture processing types
export type {
  RetexturingRequest,
  RetexturingOptions,
  RetexturingMetadata,
  PrimitiveType,
  TextureStyle,
  TextureResolution,
  CompressionLevel,
  RetexturingResult,
  GeneratedTextures,
  ProcessedGeometry,
  GeometryChanges,
  GeometryValidation,
  PerformanceGains,
  QualityMetrics,
  RetexturingResultMetadata,
  RetexturingStatus,
  RetexturingError,
  MaterialDefinition,
  MaterialProperties,
  MaterialTextures,
  TexturePattern,
  ShaderDefinition,
  ShaderUniform,
  ShaderAttribute,
  MaterialValidation,
  MaterialType,
  PatternType,
  BlendMode,
  MappingMode,
  ShaderFeature,
  AtlasGenerationRequest,
  AtlasGenerationOptions,
  AtlasConstraints,
  AtlasOptimization,
  SortMethod,
  PackingMethod,
  UVMappingRequest,
  UVMappingOptions,
  UVConstraints,
  UVMappingMethod,
  BorderHandling,
  BatchRetexturingRequest,
  BatchRetexturingOptions,
  BatchOptimization,
  BatchProgress as RetexturingBatchProgress,
  ErrorHandling
} from './retexturing'

export {
  validateRetexturingRequest,
  validateRetexturingResult,
  validateTextureAtlas,
  assertRetexturingRequest,
  assertRetexturingResult,
  assertTextureAtlas,
  createRetexturingRequest,
  createDefaultPerformanceGains,
  createDefaultQualityMetrics,
  calculateCompressionRatio,
  calculatePackingEfficiency,
  isValidHexColor,
  normalizeColor
} from './retexturing'

/**
 * Common service interfaces
 */
export interface ServiceConfig {
  enabled: boolean
  version: string
  timeout: number
  maxConcurrency: number
  cacheEnabled: boolean
  cacheTTL: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  metricsEnabled: boolean
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  requestCount: number
  errorCount: number
  averageResponseTime: number
  memoryUsage: number
  lastHealthCheck: Date
  dependencies: Record<string, boolean>
}

export interface ServiceMetrics {
  requests: {
    total: number
    successful: number
    failed: number
    avgResponseTime: number
    minResponseTime: number
    maxResponseTime: number
  }
  resources: {
    memoryUsed: number
    memoryPeak: number
    cpuUsage: number
    diskUsage: number
  }
  cache: {
    hits: number
    misses: number
    hitRate: number
    size: number
    evictions: number
  }
  errors: {
    total: number
    byType: Record<string, number>
    recent: Array<{ timestamp: Date; error: string }>
  }
}

/**
 * Error handling types
 */
export interface ServiceError {
  code: string
  message: string
  service: string
  operation: string
  timestamp: Date
  retryable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, unknown>
  stackTrace?: string
}

export interface ValidationError {
  field: string
  value: unknown
  expected: string
  message: string
  code: string
}

export interface ProcessingError {
  phase: string
  step: string
  input?: unknown
  output?: unknown
  error: Error
  timestamp: Date
  metadata?: Record<string, unknown>
}

/**
 * Cache types
 */
export interface CacheEntry<T = unknown> {
  key: string
  value: T
  timestamp: Date
  ttl: number
  size: number
  hits: number
  lastAccessed: Date
  metadata?: Record<string, unknown>
}

export interface CacheStats {
  entries: number
  totalSize: number
  hitRate: number
  hits: number
  misses: number
  evictions: number
  oldestEntry?: Date
  newestEntry?: Date
}

/**
 * Configuration types
 */
export interface AICreationConfig {
  meshy: MeshyConfig
  hardpointDetection: HardpointDetectionConfig
  retexturing: {
    enabled: boolean
    defaultOptions: RetexturingOptions
    maxTextureSize: TextureResolution
    compressionLevel: CompressionLevel
    atlasGeneration: boolean
  }
  batchProcessing: {
    maxConcurrentTasks: number
    maxBatchSize: number
    timeout: number
    retryAttempts: number
    enableCaching: boolean
    cacheMaxSize: number
    cacheMaxAge: number
  }
  visualization: {
    enabled: boolean
    renderQuality: 'low' | 'medium' | 'high'
    maxMarkers: number
    animationsEnabled: boolean
    interactiveMode: boolean
  }
  performance: {
    maxMemoryUsage: number
    gcThreshold: number
    profilingEnabled: boolean
    metricsInterval: number
  }
  security: {
    apiKeyValidation: boolean
    requestValidation: boolean
    responseValidation: boolean
    rateLimiting: boolean
    requestLogging: boolean
  }
}

/**
 * Plugin integration types
 */
export interface PluginContext {
  runtime: unknown // ElizaOS runtime
  logger: unknown // Logger instance
  config: AICreationConfig
  services: {
    meshy: unknown // MeshyAIService
    hardpoints: unknown // HardpointDetectionService
    retexturing: unknown // RetexturingService
    batch: unknown // BatchGenerationService
  }
}

export interface PluginAction {
  name: string
  description: string
  examples: string[]
  handler: (context: PluginContext, params: Record<string, unknown>) => Promise<unknown>
  validation?: (params: Record<string, unknown>) => ValidationError[]
}

export interface PluginProvider {
  name: string
  description: string
  get: (context: PluginContext) => Promise<string>
  refresh?: (context: PluginContext) => Promise<void>
}

export interface PluginEvaluator {
  name: string
  description: string
  examples: string[]
  similes: string[]
  handler: (context: PluginContext, message: unknown) => Promise<boolean>
  validate?: (context: PluginContext, message: unknown) => Promise<boolean>
}

/**
 * Export all type categories for easy importing
 */
export const TypeCategories = {
  Geometry: [
    'Vector3', 'Vector2', 'Quaternion', 'BoundingBox', 'GeometryData',
    'MaterialData', 'TextureData', 'TextureAtlas'
  ],
  API: [
    'MeshyConfig', 'TextTo3DRequest', 'MeshyTaskResponse', 'GenerationRequest',
    'GenerationResult', 'BatchRequest', 'BatchResult'
  ],
  Hardpoints: [
    'HardpointCandidate', 'DetectedHardpoints', 'GeometryAnalysis',
    'VisualizationData', 'HardpointAccuracyMetrics'
  ],
  Retexturing: [
    'RetexturingRequest', 'RetexturingResult', 'MaterialDefinition',
    'AtlasGenerationRequest', 'UVMappingRequest'
  ],
  Service: [
    'ServiceConfig', 'ServiceHealth', 'ServiceMetrics', 'ServiceError',
    'CacheEntry', 'CacheStats'
  ],
  Plugin: [
    'PluginContext', 'PluginAction', 'PluginProvider', 'PluginEvaluator'
  ]
} as const

/**
 * Type utility functions
 */
export function isValidType<T>(obj: unknown, validator: (obj: unknown) => obj is T): obj is T {
  return validator(obj)
}

export function assertValidType<T>(
  obj: unknown,
  validator: (obj: unknown) => obj is T,
  typeName: string
): asserts obj is T {
  if (!validator(obj)) {
    throw new Error(`Invalid ${typeName}: ${JSON.stringify(obj, null, 2)}`)
  }
}

export function createTypeGuard<T>(
  validator: (obj: unknown) => obj is T
): (obj: unknown) => obj is T {
  return validator
}

export function createAssertion<T>(
  validator: (obj: unknown) => obj is T,
  typeName: string
): (obj: unknown) => asserts obj is T {
  return (obj: unknown): asserts obj is T => {
    if (!validator(obj)) {
      throw new Error(`Invalid ${typeName}: ${JSON.stringify(obj, null, 2)}`)
    }
  }
}