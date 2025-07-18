/**
 * Comprehensive API Type Definitions
 * 
 * Replaces loose typing in MeshyAIService and related API integrations
 * with strict validation and error handling.
 */

/**
 * Meshy API Configuration and Authentication
 */
export interface MeshyConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  maxConcurrentRequests?: number
  quotaLimit?: number
  costPerRequest?: number
}

export interface MeshyQuotaInfo {
  used: number
  limit: number
  remaining: number
  resetDate: Date
  costAccrued: number
}

/**
 * Meshy API Request Types
 */
export interface TextTo3DRequest {
  prompt: string
  artStyle?: MeshyArtStyle
  negativePrompt?: string
  seed?: number
  topology?: MeshyTopology
  targetPolycount?: number
  enablePbr?: boolean
  surfaceMode?: MeshySurfaceMode
}

export interface ImageTo3DRequest {
  imageUrl: string
  enablePbr?: boolean
  surfaceMode?: MeshySurfaceMode
  targetPolycount?: number
  topology?: MeshyTopology
  enhanceDetails?: boolean
}

export interface RiggingRequest {
  modelUrl: string
  rigType?: MeshyRigType
  enableAnimation?: boolean
  animationStyle?: MeshyAnimationStyle
  boneCount?: number
}

export type MeshyArtStyle = 'realistic' | 'cartoon' | 'low-poly' | 'sculpture' | 'pbr' | 'stylized'
export type MeshyTopology = 'quad' | 'triangle'
export type MeshySurfaceMode = 'hard' | 'organic' | 'mixed'
export type MeshyRigType = 'gaming' | 'standard' | 'realistic' | 'simple'
export type MeshyAnimationStyle = 'game' | 'film' | 'basic'

/**
 * Meshy API Response Types
 */
export interface MeshyTaskResponse {
  result: string
  id: string
  status: MeshyTaskStatus
  progress?: number
  error?: MeshyError
  model_urls?: MeshyModelUrls
  thumbnail_url?: string
  video_url?: string
  created_at: string
  started_at?: string
  finished_at?: string
  estimated_time?: number
  metadata?: MeshyTaskMetadata
}

export interface MeshyModelUrls {
  glb?: string
  fbx?: string
  usdz?: string
  obj?: string
  mtl?: string
  ply?: string
  texture_urls?: string[]
  normal_map_urls?: string[]
  roughness_map_urls?: string[]
  metallic_map_urls?: string[]
}

export interface MeshyTaskMetadata {
  prompt?: string
  artStyle?: string
  polycount?: number
  textureResolution?: string
  processingTime?: number
  modelSize?: number
  validationStatus?: 'passed' | 'failed' | 'warning'
  validationErrors?: string[]
}

export type MeshyTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'

export interface MeshyError {
  code: string
  message: string
  details?: Record<string, unknown>
  retryable: boolean
  quotaExceeded?: boolean
}

/**
 * API Health and Status Types
 */
export interface MeshyHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  apiKey: boolean
  connectivity: boolean
  quotaStatus: MeshyQuotaInfo
  averageResponseTime: number
  errorRate: number
  lastChecked: Date
}

/**
 * Generation Request Types (Internal)
 */
export interface GenerationRequest {
  id: string
  name: string
  description: string
  type: GenerationType
  category: string
  priority: RequestPriority
  sourceData: ItemData
  requiredFeatures: string[]
  meshyRequest: TextTo3DRequest | ImageTo3DRequest
  metadata: GenerationMetadata
  retryCount: number
  maxRetries: number
  timeout: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface GenerationMetadata {
  userId?: string
  sessionId?: string
  batchId?: string
  tags?: string[]
  version: string
  source: string
  estimatedCost: number
  estimatedTime: number
}

export type GenerationType = 'text-to-3d' | 'image-to-3d' | 'rigging' | 'retexturing'
export type RequestPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Generation Result Types
 */
export interface GenerationResult {
  id: string
  requestId: string
  status: GenerationStatus
  meshyTaskId: string
  meshyResult?: MeshyTaskResponse
  hardpoints?: DetectedHardpoints
  retexturing?: RetexturingResult
  visualizations?: VisualizationData
  error?: GenerationError
  metadata: GenerationResultMetadata
}

export interface GenerationResultMetadata {
  processingTime: number
  cacheHit: boolean
  actualCost: number
  qualityScore: number
  validationStatus: 'passed' | 'failed' | 'warning'
  validationErrors: string[]
  performance: PerformanceMetrics
  version: string
}

export interface PerformanceMetrics {
  parseTime: number
  hardpointTime: number
  retexturingTime: number
  visualizationTime: number
  totalTime: number
  memoryUsed: number
  apiCalls: number
}

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface GenerationError {
  code: string
  message: string
  phase: 'request' | 'meshy-api' | 'parsing' | 'hardpoints' | 'retexturing' | 'validation'
  retryable: boolean
  details?: Record<string, unknown>
  timestamp: Date
}

/**
 * Batch Processing Types
 */
export interface BatchRequest {
  id: string
  items: ItemData[]
  options: BatchOptions
  createdAt: Date
  userId?: string
}

export interface BatchOptions {
  maxConcurrentTasks: number
  retryAttempts: number
  enableHardpointDetection: boolean
  enableRetexturing: boolean
  enableVisualization: boolean
  priority: RequestPriority
  timeout: number
  cachingEnabled: boolean
}

export interface BatchResult {
  id: string
  requestId: string
  status: BatchStatus
  progress: BatchProgress
  results: GenerationResult[]
  summary: BatchSummary
  error?: GenerationError
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface BatchProgress {
  total: number
  completed: number
  failed: number
  inProgress: number
  pending: number
  percentage: number
  estimatedTimeRemaining: number
}

export interface BatchSummary {
  totalItems: number
  successfulItems: number
  failedItems: number
  cacheHits: number
  totalCost: number
  totalTime: number
  averageQuality: number
  errors: string[]
  warnings: string[]
}

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled'

/**
 * Validation Functions for API Types
 */
export function validateMeshyConfig(obj: unknown): obj is MeshyConfig {
  if (typeof obj !== 'object' || obj === null) return false
  
  const config = obj as MeshyConfig
  
  return (
    typeof config.apiKey === 'string' &&
    config.apiKey.length > 0 &&
    config.apiKey.startsWith('msy_') &&
    (config.baseUrl === undefined || typeof config.baseUrl === 'string') &&
    (config.timeout === undefined || (typeof config.timeout === 'number' && config.timeout > 0)) &&
    (config.retryAttempts === undefined || (typeof config.retryAttempts === 'number' && config.retryAttempts >= 0))
  )
}

export function validateTextTo3DRequest(obj: unknown): obj is TextTo3DRequest {
  if (typeof obj !== 'object' || obj === null) return false
  
  const request = obj as TextTo3DRequest
  
  return (
    typeof request.prompt === 'string' &&
    request.prompt.length > 0 &&
    request.prompt.length <= 1000 &&
    (request.artStyle === undefined || ['realistic', 'cartoon', 'low-poly', 'sculpture', 'pbr', 'stylized'].includes(request.artStyle)) &&
    (request.topology === undefined || ['quad', 'triangle'].includes(request.topology)) &&
    (request.seed === undefined || (typeof request.seed === 'number' && request.seed >= 0))
  )
}

export function validateMeshyTaskResponse(obj: unknown): obj is MeshyTaskResponse {
  if (typeof obj !== 'object' || obj === null) return false
  
  const response = obj as MeshyTaskResponse
  
  return (
    typeof response.result === 'string' &&
    typeof response.id === 'string' &&
    typeof response.status === 'string' &&
    ['PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(response.status) &&
    typeof response.created_at === 'string'
  )
}

export function validateGenerationRequest(obj: unknown): obj is GenerationRequest {
  if (typeof obj !== 'object' || obj === null) return false
  
  const request = obj as GenerationRequest
  
  return (
    typeof request.id === 'string' &&
    typeof request.name === 'string' &&
    typeof request.description === 'string' &&
    typeof request.type === 'string' &&
    ['text-to-3d', 'image-to-3d', 'rigging', 'retexturing'].includes(request.type) &&
    typeof request.priority === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(request.priority) &&
    typeof request.retryCount === 'number' &&
    request.retryCount >= 0 &&
    request.createdAt instanceof Date
  )
}

/**
 * Type guards and assertions
 */
export function assertMeshyConfig(obj: unknown): asserts obj is MeshyConfig {
  if (!validateMeshyConfig(obj)) {
    throw new Error(`Invalid MeshyConfig: ${JSON.stringify(obj)}`)
  }
}

export function assertTextTo3DRequest(obj: unknown): asserts obj is TextTo3DRequest {
  if (!validateTextTo3DRequest(obj)) {
    throw new Error(`Invalid TextTo3DRequest: ${JSON.stringify(obj)}`)
  }
}

export function assertMeshyTaskResponse(obj: unknown): asserts obj is MeshyTaskResponse {
  if (!validateMeshyTaskResponse(obj)) {
    throw new Error(`Invalid MeshyTaskResponse: ${JSON.stringify(obj)}`)
  }
}

/**
 * Factory functions for creating valid objects
 */
export function createGenerationRequest(
  id: string,
  itemData: ItemData,
  meshyRequest: TextTo3DRequest | ImageTo3DRequest,
  options: Partial<GenerationRequest> = {}
): GenerationRequest {
  return {
    id,
    name: itemData.name,
    description: itemData.examine,
    type: 'text-to-3d',
    category: itemData.category,
    priority: 'medium',
    sourceData: itemData,
    requiredFeatures: [],
    meshyRequest,
    metadata: {
      version: '1.0.0',
      source: 'ai-creation-service',
      estimatedCost: 0.1,
      estimatedTime: 120000, // 2 minutes
      ...options.metadata
    },
    retryCount: 0,
    maxRetries: 3,
    timeout: 300000, // 5 minutes
    createdAt: new Date(),
    ...options
  }
}

export function createMeshyError(
  code: string,
  message: string,
  retryable: boolean = false,
  details?: Record<string, unknown>
): MeshyError {
  return {
    code,
    message,
    retryable,
    quotaExceeded: code === 'QUOTA_EXCEEDED',
    details
  }
}

// Re-export types from geometry.ts to maintain compatibility
export type {
  Vector3,
  Vector2,
  Quaternion,
  BoundingBox,
  GeometryData,
  ItemData,
  EquipmentData,
  TextureData,
  TextureAtlas
} from './geometry'