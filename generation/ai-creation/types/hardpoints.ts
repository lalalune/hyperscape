/**
 * Comprehensive Hardpoint Detection Type Definitions
 * 
 * Replaces loose typing in HardpointDetectionService with strict
 * validation and comprehensive interfaces.
 */

import type {
  Vector3,
  Quaternion,
  BoundingBox,
  GeometryData,
  validateVector3,
  validateQuaternion
} from './geometry'

/**
 * Geometric Analysis Types
 */
export interface GeometryAnalysis {
  boundingBox: BoundingBox
  vertexCount: number
  triangleCount: number
  surfaceArea: number
  volume: number
  massCenter: Vector3
  principalAxes: PrincipalAxes
  complexity: GeometryComplexity
  quality: GeometryQuality
  validated: boolean
  processingTime: number
}

export interface PrincipalAxes {
  primary: Vector3
  secondary: Vector3
  tertiary: Vector3
  confidence: number
  method: 'pca' | 'covariance' | 'heuristic'
}

export interface GeometryComplexity {
  score: number // 0-1, where 1 is very complex
  vertexDensity: number
  triangleDensity: number
  surfaceVariation: number
  symmetryScore: number
}

export interface GeometryQuality {
  score: number // 0-1, where 1 is high quality
  degenerateTriangles: number
  duplicateVertices: number
  manifoldEdges: number
  waterTight: boolean
  validNormals: boolean
  validUVs: boolean
}

/**
 * Hardpoint Detection Types
 */
export interface HardpointCandidate {
  position: Vector3
  rotation: Quaternion
  confidence: number
  type: HardpointType
  reasoning: string[]
  geometricFeatures: GeometricFeatures
  validation: HardpointValidation
  metadata: HardpointMetadata
}

export interface GeometricFeatures {
  localRadius: number
  surfaceCurvature: number
  symmetry: number
  accessibility: number
  stability: number
  ergonomics: number
}

export interface HardpointValidation {
  positionValid: boolean
  rotationValid: boolean
  accessibilityValid: boolean
  ergonomicsValid: boolean
  functionalityValid: boolean
  errors: string[]
  warnings: string[]
}

export interface HardpointMetadata {
  detectionMethod: HardpointDetectionMethod
  alternativePositions: Vector3[]
  confidence: number
  processingTime: number
  validated: boolean
  version: string
}

export type HardpointType = 
  | 'primary_grip'
  | 'secondary_grip'
  | 'attachment'
  | 'projectile_origin'
  | 'impact_point'
  | 'balance_point'
  | 'guard_position'
  | 'pommel_position'

export type HardpointDetectionMethod = 
  | 'geometric_analysis'
  | 'machine_learning'
  | 'heuristic'
  | 'template_matching'
  | 'user_defined'

/**
 * Detected Hardpoints Result
 */
export interface DetectedHardpoints {
  weaponType: WeaponType
  primaryGrip: HardpointCandidate
  secondaryGrip?: HardpointCandidate
  attachmentPoints: HardpointCandidate[]
  projectileOrigin?: HardpointCandidate
  impactPoint?: HardpointCandidate
  balancePoint?: HardpointCandidate
  specialPoints: Record<string, HardpointCandidate>
  confidence: number
  analysisMetadata: HardpointAnalysisMetadata
}

export interface HardpointAnalysisMetadata {
  geometryAnalysis: GeometryAnalysis
  detectionMethod: HardpointDetectionMethod
  processingTime: number
  memoryUsed: number
  alternativeConfigurations: number
  validationStatus: 'passed' | 'failed' | 'warning'
  visualizationData: VisualizationData
  version: string
  timestamp: Date
}

export type WeaponType = 
  | 'sword'
  | 'axe'
  | 'bow'
  | 'crossbow'
  | 'dagger'
  | 'staff'
  | 'shield'
  | 'mace'
  | 'spear'
  | 'wand'
  | 'hammer'
  | 'polearm'
  | 'whip'
  | 'throwing'

/**
 * Visualization Types
 */
export interface VisualizationData {
  hardpointMarkers: HardpointMarker[]
  orientationVectors: OrientationVector[]
  geometryHighlights: GeometryHighlight[]
  confidenceHeatmap: ConfidenceHeatmap
  analysisOverlay: AnalysisOverlay
  interactive: boolean
  renderTime: number
}

export interface HardpointMarker {
  id: string
  position: Vector3
  type: HardpointType
  confidence: number
  color: string
  size: number
  shape: MarkerShape
  label?: string
  animation?: MarkerAnimation
}

export interface OrientationVector {
  id: string
  origin: Vector3
  direction: Vector3
  type: VectorType
  color: string
  length: number
  thickness: number
  animated?: boolean
}

export interface GeometryHighlight {
  id: string
  vertices: number[]
  type: HighlightType
  color: string
  opacity: number
  animation?: HighlightAnimation
  metadata?: Record<string, unknown>
}

export interface ConfidenceHeatmap {
  vertices: Vector3[]
  confidenceValues: number[]
  colorMap: ColorMapType
  resolution: number
  smoothing: number
  renderQuality: 'low' | 'medium' | 'high'
}

export interface AnalysisOverlay {
  boundingBox: boolean
  principalAxes: boolean
  massCenter: boolean
  statistics: boolean
  measurements: boolean
  errors: boolean
  warnings: boolean
}

export type MarkerShape = 'sphere' | 'cube' | 'cylinder' | 'cone' | 'custom'
export type MarkerAnimation = 'pulse' | 'rotate' | 'bob' | 'glow' | 'none'
export type VectorType = 'grip_direction' | 'attack_direction' | 'balance_axis' | 'normal' | 'tangent'
export type HighlightType = 'handle_area' | 'blade_area' | 'guard_area' | 'pommel_area' | 'impact_zone' | 'grip_zone'
export type HighlightAnimation = 'fade' | 'pulse' | 'flow' | 'none'
export type ColorMapType = 'red_to_green' | 'blue_to_red' | 'rainbow' | 'heat' | 'cool'

/**
 * Accuracy and Quality Metrics
 */
export interface HardpointAccuracyMetrics {
  overallScore: number
  gripAccuracy: number
  orientationAccuracy: number
  functionalityScore: number
  ergonomicsScore: number
  detailedMetrics: DetailedAccuracyMetrics
  benchmarkComparison?: BenchmarkComparison
}

export interface DetailedAccuracyMetrics {
  gripPositionError: number
  gripOrientationError: number
  balancePointAccuracy: number
  functionalAlignmentScore: number
  accessibilityScore: number
  stabilityScore: number
  symmetryScore: number
  reachabilityScore: number
}

export interface BenchmarkComparison {
  standardTemplate: string
  deviationFromStandard: number
  betterThanAverage: boolean
  percentileRank: number
  similarWeapons: string[]
}

/**
 * Configuration Types
 */
export interface HardpointDetectionConfig {
  confidenceThreshold: number
  visualizationEnabled: boolean
  detectionMethod: HardpointDetectionMethod
  maxAlternatives: number
  processingTimeout: number
  memoryLimit: number
  qualityThreshold: number
  validationEnabled: boolean
  cacheEnabled: boolean
  performanceMode: 'fast' | 'balanced' | 'accurate'
}

export interface WeaponSpecificConfig {
  weaponType: WeaponType
  expectedGripCount: number
  requiresProjectileOrigin: boolean
  requiresImpactPoint: boolean
  specialRequirements: string[]
  tolerances: ToleranceSettings
  templates: HardpointTemplate[]
}

export interface ToleranceSettings {
  positionTolerance: number
  rotationTolerance: number
  confidenceTolerance: number
  symmetryTolerance: number
  accessibilityTolerance: number
}

export interface HardpointTemplate {
  id: string
  weaponType: WeaponType
  name: string
  description: string
  expectedHardpoints: Partial<DetectedHardpoints>
  tolerances: ToleranceSettings
  weight: number
  validated: boolean
}

/**
 * Validation Functions
 */
export function validateHardpointCandidate(obj: unknown): obj is HardpointCandidate {
  if (typeof obj !== 'object' || obj === null) return false
  
  const candidate = obj as HardpointCandidate
  
  return (
    validateVector3(candidate.position) &&
    validateQuaternion(candidate.rotation) &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    typeof candidate.type === 'string' &&
    Array.isArray(candidate.reasoning) &&
    candidate.reasoning.every(r => typeof r === 'string') &&
    typeof candidate.geometricFeatures === 'object' &&
    candidate.geometricFeatures !== null
  )
}

export function validateDetectedHardpoints(obj: unknown): obj is DetectedHardpoints {
  if (typeof obj !== 'object' || obj === null) return false
  
  const hardpoints = obj as DetectedHardpoints
  
  return (
    typeof hardpoints.weaponType === 'string' &&
    validateHardpointCandidate(hardpoints.primaryGrip) &&
    Array.isArray(hardpoints.attachmentPoints) &&
    hardpoints.attachmentPoints.every(validateHardpointCandidate) &&
    typeof hardpoints.confidence === 'number' &&
    hardpoints.confidence >= 0 &&
    hardpoints.confidence <= 1 &&
    typeof hardpoints.analysisMetadata === 'object' &&
    hardpoints.analysisMetadata !== null
  )
}

export function validateGeometryAnalysis(obj: unknown): obj is GeometryAnalysis {
  if (typeof obj !== 'object' || obj === null) return false
  
  const analysis = obj as GeometryAnalysis
  
  return (
    typeof analysis.boundingBox === 'object' &&
    analysis.boundingBox !== null &&
    typeof analysis.vertexCount === 'number' &&
    analysis.vertexCount >= 0 &&
    typeof analysis.triangleCount === 'number' &&
    analysis.triangleCount >= 0 &&
    typeof analysis.surfaceArea === 'number' &&
    analysis.surfaceArea >= 0 &&
    typeof analysis.volume === 'number' &&
    analysis.volume >= 0 &&
    validateVector3(analysis.massCenter) &&
    typeof analysis.principalAxes === 'object' &&
    analysis.principalAxes !== null
  )
}

/**
 * Type Guards and Assertions
 */
export function assertHardpointCandidate(obj: unknown): asserts obj is HardpointCandidate {
  if (!validateHardpointCandidate(obj)) {
    throw new Error(`Invalid HardpointCandidate: ${JSON.stringify(obj, null, 2)}`)
  }
}

export function assertDetectedHardpoints(obj: unknown): asserts obj is DetectedHardpoints {
  if (!validateDetectedHardpoints(obj)) {
    throw new Error(`Invalid DetectedHardpoints: ${JSON.stringify(obj, null, 2)}`)
  }
}

export function assertGeometryAnalysis(obj: unknown): asserts obj is GeometryAnalysis {
  if (!validateGeometryAnalysis(obj)) {
    throw new Error(`Invalid GeometryAnalysis: ${JSON.stringify(obj, null, 2)}`)
  }
}

/**
 * Factory Functions
 */
export function createHardpointCandidate(
  position: Vector3,
  rotation: Quaternion,
  type: HardpointType,
  confidence: number,
  reasoning: string[] = []
): HardpointCandidate {
  if (!validateVector3(position)) {
    throw new Error(`Invalid position: ${JSON.stringify(position)}`)
  }
  
  if (!validateQuaternion(rotation)) {
    throw new Error(`Invalid rotation: ${JSON.stringify(rotation)}`)
  }
  
  if (confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${confidence} (must be 0-1)`)
  }
  
  return {
    position,
    rotation,
    confidence,
    type,
    reasoning,
    geometricFeatures: {
      localRadius: 0.03,
      surfaceCurvature: 0.2,
      symmetry: 0.8,
      accessibility: 0.9,
      stability: 0.8,
      ergonomics: 0.7
    },
    validation: {
      positionValid: true,
      rotationValid: true,
      accessibilityValid: true,
      ergonomicsValid: true,
      functionalityValid: true,
      errors: [],
      warnings: []
    },
    metadata: {
      detectionMethod: 'geometric_analysis',
      alternativePositions: [],
      confidence,
      processingTime: 0,
      validated: true,
      version: '1.0.0'
    }
  }
}

export function createDefaultVisualizationData(): VisualizationData {
  return {
    hardpointMarkers: [],
    orientationVectors: [],
    geometryHighlights: [],
    confidenceHeatmap: {
      vertices: [],
      confidenceValues: [],
      colorMap: 'red_to_green',
      resolution: 100,
      smoothing: 0.5,
      renderQuality: 'medium'
    },
    analysisOverlay: {
      boundingBox: true,
      principalAxes: true,
      massCenter: true,
      statistics: true,
      measurements: true,
      errors: true,
      warnings: true
    },
    interactive: true,
    renderTime: 0
  }
}

/**
 * Utility Functions
 */
export function calculateConfidenceScore(candidates: HardpointCandidate[]): number {
  if (candidates.length === 0) return 0
  
  const totalConfidence = candidates.reduce((sum, candidate) => sum + candidate.confidence, 0)
  return totalConfidence / candidates.length
}

export function findBestCandidate(candidates: HardpointCandidate[], type: HardpointType): HardpointCandidate | undefined {
  const typeCandidates = candidates.filter(c => c.type === type)
  if (typeCandidates.length === 0) return undefined
  
  return typeCandidates.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  )
}

export function validateHardpointConfiguration(hardpoints: DetectedHardpoints): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check required hardpoints by weapon type
  switch (hardpoints.weaponType) {
    case 'bow':
    case 'crossbow':
      if (!hardpoints.projectileOrigin) {
        errors.push(`${hardpoints.weaponType} requires projectile origin`)
      }
      break
    
    case 'sword':
    case 'dagger':
    case 'axe':
    case 'mace':
      if (!hardpoints.impactPoint) {
        errors.push(`${hardpoints.weaponType} requires impact point`)
      }
      break
    
    case 'shield':
      if (hardpoints.attachmentPoints.length < 2) {
        errors.push('Shield requires at least 2 attachment points')
      }
      break
  }
  
  // Check confidence thresholds
  if (hardpoints.primaryGrip.confidence < 0.5) {
    errors.push('Primary grip confidence too low')
  }
  
  if (hardpoints.confidence < 0.4) {
    errors.push('Overall confidence too low')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}