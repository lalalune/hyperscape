/**
 * Visual system type definitions
 */

import { Vector3 } from './index'
// import * as THREE from 'three';

/**
 * Visual template configuration
 */
export interface VisualTemplate {
  /** Base color of the visual */
  color: number
  /** Size dimensions */
  size: {
    width: number
    height: number
    depth: number
  }
  /** Available animations for this template */
  animations: string[]
  /** Optional material properties */
  material?: {
    metalness?: number
    roughness?: number
    emissive?: number
    emissiveIntensity?: number
    opacity?: number
  }
  /** Optional custom geometry type */
  geometryType?: 'box' | 'sphere' | 'cylinder' | 'cone'
}

/**
 * Animation state for an entity
 */
export interface AnimationState {
  entityId: string
  animationType: string
  startTime: number
  duration: number
  loop: boolean
  originalPosition?: Vector3
  originalRotation?: Vector3
  /** Animation-specific parameters */
  params?: Record<string, any>
}

/**
 * Visual component attached to entities
 */
export interface VisualComponent {
  /** Reference to the Hyperfy mesh node */
  mesh: any // Hyperfy Mesh node
  /** Container group for the visual */
  group: any // Hyperfy Group node
  /** Template used for this visual */
  template: VisualTemplate
  /** Whether visual is currently visible */
  visible: boolean
  /** LOD level (0 = highest detail) */
  lodLevel: number
}

/**
 * Visual system configuration
 */
export interface VisualSystemConfig {
  /** Enable shadow casting/receiving */
  enableShadows?: boolean
  /** Maximum view distance for visuals */
  maxViewDistance?: number
  /** LOD distances [high, medium, low] */
  lodDistances?: [number, number, number]
  /** Enable debug visuals */
  debug?: boolean
}
