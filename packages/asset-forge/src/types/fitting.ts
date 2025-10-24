import type { Box3 } from 'three'

export interface MeshFittingParameters {
  iterations: number
  stepSize: number
  smoothingRadius: number
  smoothingStrength: number
  targetOffset: number
  sampleRate: number
  preserveFeatures: boolean
  featureAngleThreshold: number
  useImprovedShrinkwrap?: boolean
  targetBounds?: Box3
  preserveOpenings?: boolean  // New parameter for edge preservation
  pushInteriorVertices?: boolean  // Restore interior vertices to their pre-shrinkwrap positions
  
  // Debug visualization parameters
  showDebugArrows?: boolean
  debugArrowDensity?: number  // Show every Nth vertex (1 = all, 10 = every 10th)
  debugColorMode?: 'direction' | 'magnitude' | 'sidedness'
} 