import * as THREE from 'three'
import React from 'react'

export interface HandBoneStructure {
  wrist: THREE.Bone
  palm?: THREE.Bone
  fingers: {
    thumb: THREE.Bone[]
    index: THREE.Bone[]
    middle: THREE.Bone[]
    ring: THREE.Bone[]
    pinky: THREE.Bone[]
  }
}

export interface HandRiggingResult {
  leftHand?: {
    bones: HandBoneStructure
    detectionConfidence: number
    vertexCount: number
  }
  rightHand?: {
    bones: HandBoneStructure
    detectionConfidence: number
    vertexCount: number
  }
  riggedModel: ArrayBuffer // GLB data
  metadata: {
    originalBoneCount: number
    addedBoneCount: number
    processingTime: number
  }
}

export interface HandRiggingResultWithDebug extends HandRiggingResult {
  debugCaptures?: Record<string, string> // Map of capture name to base64 image string
}

export interface HandRiggingOptions {
  smoothingIterations?: number
  minConfidence?: number
  debugMode?: boolean
  captureResolution?: number
    viewerRef?: React.RefObject<{
    captureHandViews: () => Promise<{
      leftHandCloseup?: HTMLCanvasElement
      rightHandCloseup?: HTMLCanvasElement
      topDown?: HTMLCanvasElement
      topView?: HTMLCanvasElement
      frontView?: HTMLCanvasElement
      handPositions?: Record<string, {
        position: { x: number; y: number; z: number }
        rotation?: { x: number; y: number; z: number }
        scale?: number
      }> | {
        left?: { screen: { x: number; y: number }; world: { x: number; y: number; z: number } }
        right?: { screen: { x: number; y: number }; world: { x: number; y: number; z: number } }
      }
      debugCaptures?: Record<string, string>
    }> 
  }>
}

// Extended type for required options
export interface RequiredHandRiggingOptions extends Required<Omit<HandRiggingOptions, 'viewerRef'>> {
  viewerRef?: HandRiggingOptions['viewerRef']
} 