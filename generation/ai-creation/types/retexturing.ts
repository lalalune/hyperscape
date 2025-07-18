/**
 * Comprehensive Retexturing and Texture Atlas Type Definitions
 * 
 * Replaces loose typing in RetexturingService with strict validation
 * and comprehensive texture processing interfaces.
 */

import type {
  Vector2,
  Vector3,
  TextureData,
  TextureAtlas,
  GeometryData
} from './geometry'

/**
 * Retexturing Request Types
 */
export interface RetexturingRequest {
  id: string
  geometry: GeometryData
  primitiveType: PrimitiveType
  baseColor: string
  textureStyle: TextureStyle
  scale: number
  options: RetexturingOptions
  metadata: RetexturingMetadata
}

export interface RetexturingOptions {
  resolution: TextureResolution
  format: TextureFormat
  compression: CompressionLevel
  generateMipmaps: boolean
  generateNormals: boolean
  generateRoughness: boolean
  generateMetallic: boolean
  atlasOptimization: boolean
  uvOptimization: boolean
  seamsMinimization: boolean
  tileable: boolean
  preserveDetails: boolean
}

export interface RetexturingMetadata {
  userId?: string
  sessionId?: string
  batchId?: string
  version: string
  priority: 'low' | 'medium' | 'high'
  estimatedSize: number
  estimatedTime: number
  source: string
  tags: string[]
}

export type PrimitiveType = 
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'plane'
  | 'torus'
  | 'cone'
  | 'pyramid'
  | 'custom'
  | 'weapon'
  | 'armor'
  | 'building'

export type TextureStyle = 
  | 'pbr'
  | 'cartoon'
  | 'realistic'
  | 'stylized'
  | 'pixel'
  | 'hand_painted'
  | 'procedural'
  | 'photographic'

export type TextureResolution = 256 | 512 | 1024 | 2048 | 4096 | 8192
export type TextureFormat = 'PNG' | 'JPEG' | 'WEBP' | 'DDS' | 'KTX' | 'BASIS'
export type CompressionLevel = 'none' | 'low' | 'medium' | 'high' | 'maximum'

/**
 * Retexturing Result Types
 */
export interface RetexturingResult {
  id: string
  requestId: string
  status: RetexturingStatus
  textures: GeneratedTextures
  atlas?: TextureAtlas
  geometry: ProcessedGeometry
  performance: PerformanceGains
  quality: QualityMetrics
  metadata: RetexturingResultMetadata
  error?: RetexturingError
}

export interface GeneratedTextures {
  diffuse: TextureData
  normal?: TextureData
  roughness?: TextureData
  metallic?: TextureData
  emissive?: TextureData
  occlusion?: TextureData
  height?: TextureData
  mask?: TextureData
}

export interface ProcessedGeometry {
  original: GeometryData
  optimized: GeometryData
  uvMapped: GeometryData
  changes: GeometryChanges
  validation: GeometryValidation
}

export interface GeometryChanges {
  verticesAdded: number
  verticesRemoved: number
  trianglesAdded: number
  trianglesRemoved: number
  uvsGenerated: number
  uvsOptimized: number
  seamsReduced: number
  materialsSplit: number
}

export interface GeometryValidation {
  uvCoverage: number // 0-1, percentage of geometry with valid UVs
  uvOverlap: number // 0-1, amount of UV overlap
  texelDensity: number // texels per unit area
  seamsLength: number // total UV seam length
  distortion: number // UV distortion measure
  wastedSpace: number // unused atlas space
}

export interface PerformanceGains {
  originalDrawCalls: number
  optimizedDrawCalls: number
  originalTextureMemory: number
  optimizedTextureMemory: number
  memoryReduction: number
  renderingSpeedup: number
  loadingSpeedup: number
  compressionRatio: number
}

export interface QualityMetrics {
  visualQuality: number // 0-1, overall visual quality
  textureFidelity: number // 0-1, texture detail preservation
  geometryFidelity: number // 0-1, geometry detail preservation
  colorAccuracy: number // 0-1, color reproduction accuracy
  normalAccuracy: number // 0-1, normal map accuracy
  artifactLevel: number // 0-1, visual artifacts amount
  consistency: number // 0-1, texture consistency across model
}

export interface RetexturingResultMetadata {
  processingTime: number
  memoryUsed: number
  texturesGenerated: number
  atlasesCreated: number
  optimizationLevel: string
  qualityProfile: string
  warnings: string[]
  suggestions: string[]
  version: string
  timestamp: Date
}

export type RetexturingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface RetexturingError {
  code: string
  message: string
  phase: 'validation' | 'uv_mapping' | 'texture_generation' | 'atlas_creation' | 'optimization'
  retryable: boolean
  details?: Record<string, unknown>
  suggestions?: string[]
}

/**
 * Material and Texture Pattern Types
 */
export interface MaterialDefinition {
  id: string
  name: string
  type: MaterialType
  properties: MaterialProperties
  textures: MaterialTextures
  shader: ShaderDefinition
  validation: MaterialValidation
}

export interface MaterialProperties {
  baseColor: string
  metallic: number
  roughness: number
  emissive: string
  transparency: number
  refraction: number
  subsurface: number
  anisotropy: number
  clearcoat: number
  sheen: number
}

export interface MaterialTextures {
  diffusePattern?: TexturePattern
  normalPattern?: TexturePattern
  roughnessPattern?: TexturePattern
  metallicPattern?: TexturePattern
  emissivePattern?: TexturePattern
  heightPattern?: TexturePattern
}

export interface TexturePattern {
  type: PatternType
  scale: Vector2
  offset: Vector2
  rotation: number
  parameters: Record<string, number>
  blending: BlendMode
  mapping: MappingMode
}

export interface ShaderDefinition {
  vertex: string
  fragment: string
  uniforms: Record<string, ShaderUniform>
  attributes: Record<string, ShaderAttribute>
  features: ShaderFeature[]
}

export interface ShaderUniform {
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat3' | 'mat4' | 'sampler2D'
  value: number | number[] | string
  description: string
}

export interface ShaderAttribute {
  type: 'float' | 'vec2' | 'vec3' | 'vec4'
  location: number
  description: string
}

export interface MaterialValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  performance: 'excellent' | 'good' | 'fair' | 'poor'
  compatibility: string[]
}

export type MaterialType = 'standard' | 'subsurface' | 'metallic' | 'dielectric' | 'emission' | 'glass' | 'fabric' | 'organic'
export type PatternType = 'solid' | 'brick' | 'stone' | 'wood' | 'metal' | 'fabric' | 'noise' | 'custom'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft_light' | 'hard_light' | 'add' | 'subtract'
export type MappingMode = 'uv' | 'planar' | 'cylindrical' | 'spherical' | 'box' | 'triplanar'
export type ShaderFeature = 'lighting' | 'shadows' | 'reflections' | 'transparency' | 'animation' | 'vertex_colors'

/**
 * Atlas Generation Types
 */
export interface AtlasGenerationRequest {
  id: string
  textures: TextureData[]
  options: AtlasGenerationOptions
  constraints: AtlasConstraints
  optimization: AtlasOptimization
}

export interface AtlasGenerationOptions {
  maxSize: TextureResolution
  padding: number
  powerOfTwo: boolean
  allowRotation: boolean
  allowFlipping: boolean
  sortMethod: SortMethod
  packingMethod: PackingMethod
  compressionEnabled: boolean
  mipmapGeneration: boolean
}

export interface AtlasConstraints {
  maxAtlases: number
  minEfficiency: number
  maxWastedSpace: number
  groupByMaterial: boolean
  groupBySize: boolean
  preserveAspectRatio: boolean
  fixedSizes?: TextureResolution[]
}

export interface AtlasOptimization {
  enabled: boolean
  iterations: number
  geneticAlgorithm: boolean
  simulated_annealing: boolean
  localSearch: boolean
  parallelProcessing: boolean
}

export type SortMethod = 'area' | 'width' | 'height' | 'perimeter' | 'max_side' | 'ratio'
export type PackingMethod = 'shelf' | 'skyline' | 'bottom_left' | 'best_fit' | 'genetic' | 'maxrects'

/**
 * UV Mapping Types
 */
export interface UVMappingRequest {
  geometry: GeometryData
  method: UVMappingMethod
  options: UVMappingOptions
  constraints: UVConstraints
}

export interface UVMappingOptions {
  seamMinimization: boolean
  distortionMinimization: boolean
  areaPreservation: boolean
  anglePreservation: boolean
  borderHandling: BorderHandling
  packingEfficiency: number
  texelDensity: number
  smoothingIterations: number
}

export interface UVConstraints {
  preserveExistingUVs: boolean
  maxSeamLength: number
  maxDistortion: number
  minTexelDensity: number
  symmetryPreservation: boolean
  fixedEdges: number[]
  pinnedVertices: Array<{ vertex: number; uv: Vector2 }>
}

export type UVMappingMethod = 'planar' | 'cylindrical' | 'spherical' | 'conformal' | 'angle_based' | 'least_squares'
export type BorderHandling = 'clamp' | 'repeat' | 'mirror' | 'border'

/**
 * Batch Processing Types
 */
export interface BatchRetexturingRequest {
  id: string
  items: RetexturingRequest[]
  options: BatchRetexturingOptions
  optimization: BatchOptimization
}

export interface BatchRetexturingOptions {
  maxConcurrent: number
  groupSimilar: boolean
  sharedAtlases: boolean
  materialLibrary: boolean
  progressCallback?: (progress: BatchProgress) => void
  errorHandling: ErrorHandling
}

export interface BatchOptimization {
  enabled: boolean
  crossItemOptimization: boolean
  sharedMaterialDetection: boolean
  atlasConsolidation: boolean
  memoryOptimization: boolean
  parallelProcessing: boolean
}

export interface BatchProgress {
  total: number
  completed: number
  failed: number
  inProgress: number
  percentage: number
  estimatedTimeRemaining: number
  currentItem?: string
  errors: string[]
}

export type ErrorHandling = 'stop_on_error' | 'continue_on_error' | 'retry_failed' | 'skip_failed'

/**
 * Validation Functions
 */
export function validateRetexturingRequest(obj: unknown): obj is RetexturingRequest {
  if (typeof obj !== 'object' || obj === null) return false
  
  const request = obj as RetexturingRequest
  
  return (
    typeof request.id === 'string' &&
    typeof request.primitiveType === 'string' &&
    typeof request.baseColor === 'string' &&
    request.baseColor.match(/^#[0-9A-Fa-f]{6}$/) !== null &&
    typeof request.textureStyle === 'string' &&
    typeof request.scale === 'number' &&
    request.scale > 0 &&
    typeof request.options === 'object' &&
    request.options !== null
  )
}

export function validateRetexturingResult(obj: unknown): obj is RetexturingResult {
  if (typeof obj !== 'object' || obj === null) return false
  
  const result = obj as RetexturingResult
  
  return (
    typeof result.id === 'string' &&
    typeof result.requestId === 'string' &&
    typeof result.status === 'string' &&
    ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(result.status) &&
    typeof result.textures === 'object' &&
    result.textures !== null &&
    typeof result.performance === 'object' &&
    result.performance !== null &&
    typeof result.quality === 'object' &&
    result.quality !== null
  )
}

export function validateTextureAtlas(obj: unknown): obj is TextureAtlas {
  if (typeof obj !== 'object' || obj === null) return false
  
  const atlas = obj as TextureAtlas
  
  return (
    typeof atlas.id === 'string' &&
    typeof atlas.texture === 'object' &&
    atlas.texture !== null &&
    Array.isArray(atlas.regions) &&
    typeof atlas.packingEfficiency === 'number' &&
    atlas.packingEfficiency >= 0 &&
    atlas.packingEfficiency <= 1 &&
    typeof atlas.totalRegions === 'number' &&
    atlas.totalRegions >= 0
  )
}

/**
 * Type Guards and Assertions
 */
export function assertRetexturingRequest(obj: unknown): asserts obj is RetexturingRequest {
  if (!validateRetexturingRequest(obj)) {
    throw new Error(`Invalid RetexturingRequest: ${JSON.stringify(obj, null, 2)}`)
  }
}

export function assertRetexturingResult(obj: unknown): asserts obj is RetexturingResult {
  if (!validateRetexturingResult(obj)) {
    throw new Error(`Invalid RetexturingResult: ${JSON.stringify(obj, null, 2)}`)
  }
}

export function assertTextureAtlas(obj: unknown): asserts obj is TextureAtlas {
  if (!validateTextureAtlas(obj)) {
    throw new Error(`Invalid TextureAtlas: ${JSON.stringify(obj, null, 2)}`)
  }
}

/**
 * Factory Functions
 */
export function createRetexturingRequest(
  id: string,
  geometry: GeometryData,
  primitiveType: PrimitiveType,
  baseColor: string,
  textureStyle: TextureStyle = 'pbr',
  scale: number = 1
): RetexturingRequest {
  return {
    id,
    geometry,
    primitiveType,
    baseColor,
    textureStyle,
    scale,
    options: {
      resolution: 1024,
      format: 'PNG',
      compression: 'medium',
      generateMipmaps: true,
      generateNormals: true,
      generateRoughness: true,
      generateMetallic: false,
      atlasOptimization: true,
      uvOptimization: true,
      seamsMinimization: true,
      tileable: false,
      preserveDetails: true
    },
    metadata: {
      version: '1.0.0',
      priority: 'medium',
      estimatedSize: 1024 * 1024 * 4, // 4MB estimate
      estimatedTime: 30000, // 30 seconds
      source: 'retexturing-service',
      tags: []
    }
  }
}

export function createDefaultPerformanceGains(): PerformanceGains {
  return {
    originalDrawCalls: 1,
    optimizedDrawCalls: 1,
    originalTextureMemory: 0,
    optimizedTextureMemory: 0,
    memoryReduction: 0,
    renderingSpeedup: 1.0,
    loadingSpeedup: 1.0,
    compressionRatio: 1.0
  }
}

export function createDefaultQualityMetrics(): QualityMetrics {
  return {
    visualQuality: 0.8,
    textureFidelity: 0.8,
    geometryFidelity: 1.0,
    colorAccuracy: 0.9,
    normalAccuracy: 0.8,
    artifactLevel: 0.1,
    consistency: 0.85
  }
}

/**
 * Utility Functions
 */
export function calculateCompressionRatio(original: number, compressed: number): number {
  if (compressed === 0) return Infinity
  return original / compressed
}

export function calculatePackingEfficiency(usedArea: number, totalArea: number): number {
  if (totalArea === 0) return 0
  return Math.min(1, usedArea / totalArea)
}

export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

export function normalizeColor(color: string): string {
  if (isValidHexColor(color)) return color.toUpperCase()
  
  // Convert named colors to hex
  const namedColors: Record<string, string> = {
    'red': '#FF0000',
    'green': '#00FF00',
    'blue': '#0000FF',
    'white': '#FFFFFF',
    'black': '#000000',
    'yellow': '#FFFF00',
    'cyan': '#00FFFF',
    'magenta': '#FF00FF',
    'silver': '#C0C0C0',
    'gray': '#808080',
    'brown': '#8B4513',
    'orange': '#FFA500',
    'purple': '#800080'
  }
  
  const normalized = color.toLowerCase()
  return namedColors[normalized] || '#808080' // Default to gray
}