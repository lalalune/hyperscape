/**
 * Asset Normalization Service
 * Handles normalization of 3D models to meet standard conventions
 */

import * as THREE from 'three'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { getConvention, NormalizationResult, AssetConvention } from '../../types/NormalizationConventions'

export interface NormalizedAssetResult {
  glb: ArrayBuffer
  metadata: {
    originalBounds: THREE.Box3
    normalizedBounds: THREE.Box3
    transformsApplied: {
      translation: THREE.Vector3
      rotation: THREE.Euler
      scale: number
    }
    dimensions: {
      width: number
      height: number
      depth: number
    }
  }
}

export class AssetNormalizationService {
  private loader: GLTFLoader
  private exporter: GLTFExporter
  
  constructor() {
    this.loader = new GLTFLoader()
    this.exporter = new GLTFExporter()
  }
  
  /**
   * Normalize a weapon model - grip at origin, blade up
   */
  async normalizeWeapon(
    modelPath: string,
    weaponType: string = 'sword',
    gripPoint?: THREE.Vector3
  ): Promise<NormalizedAssetResult> {
    console.log(`🔧 Normalizing weapon: ${weaponType}`)
    
    // Load model
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    // Get original bounds
    const originalBounds = new THREE.Box3().setFromObject(model)
    const originalSize = originalBounds.getSize(new THREE.Vector3())
    
    // If no grip point provided, estimate it
    if (!gripPoint) {
      // For most weapons, grip is at bottom 20% of the model
      const center = originalBounds.getCenter(new THREE.Vector3())
      gripPoint = new THREE.Vector3(
        center.x,
        originalBounds.min.y + originalSize.y * 0.2,
        center.z
      )
      console.log(`📍 Estimated grip point: ${gripPoint.x.toFixed(3)}, ${gripPoint.y.toFixed(3)}, ${gripPoint.z.toFixed(3)}`)
    }
    
    // Move grip point to origin
    model.position.sub(gripPoint)
    model.updateMatrixWorld(true)
    
    // Ensure blade points up (+Y)
    // This should already be handled by orientation detection
    
    // Bake transforms into geometry
    this.bakeTransforms(model)
    
    // Get normalized bounds
    const normalizedBounds = new THREE.Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new THREE.Vector3())
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: gripPoint.clone().negate(),
          rotation: new THREE.Euler(0, 0, 0),
          scale: 1
        },
        dimensions: {
          width: normalizedSize.x,
          height: normalizedSize.y,
          depth: normalizedSize.z
        }
      }
    }
  }
  
  /**
   * Normalize a character model - exact height, feet at origin
   */
  async normalizeCharacter(
    modelPath: string,
    targetHeight: number = 1.83
  ): Promise<NormalizedAssetResult> {
    console.log(`🔧 Normalizing character to ${targetHeight}m height`)
    
    // Load model
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    // Get original bounds
    const originalBounds = new THREE.Box3().setFromObject(model)
    const originalSize = originalBounds.getSize(new THREE.Vector3())
    const originalHeight = originalSize.y
    
    console.log(`📏 Original height: ${originalHeight.toFixed(3)}m`)
    
    // Calculate scale factor to reach target height
    const scaleFactor = targetHeight / originalHeight
    model.scale.multiplyScalar(scaleFactor)
    model.updateMatrixWorld(true)
    
    // Position feet at origin
    const scaledBounds = new THREE.Box3().setFromObject(model)
    model.position.y = -scaledBounds.min.y
    model.updateMatrixWorld(true)
    
    // Ensure facing +Z (should already be correct from generation)
    // Characters should be generated facing forward
    
    // Bake transforms into geometry
    this.bakeTransforms(model)
    
    // Get normalized bounds
    const normalizedBounds = new THREE.Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new THREE.Vector3())
    
    console.log(`✅ Normalized height: ${normalizedSize.y.toFixed(3)}m`)
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: new THREE.Vector3(0, -scaledBounds.min.y, 0),
          rotation: new THREE.Euler(0, 0, 0),
          scale: scaleFactor
        },
        dimensions: {
          width: normalizedSize.x,
          height: normalizedSize.y,
          depth: normalizedSize.z
        }
      }
    }
  }
  
  /**
   * Normalize armor piece - centered, correct orientation
   */
  async normalizeArmor(
    modelPath: string,
    armorType: string = 'chest'
  ): Promise<NormalizedAssetResult> {
    console.log(`🔧 Normalizing armor: ${armorType}`)
    
    // Load model
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    // Get original bounds
    const originalBounds = new THREE.Box3().setFromObject(model)
    
    // Center at origin based on armor type
    const center = originalBounds.getCenter(new THREE.Vector3())
    
    if (armorType === 'helmet') {
      // For helmets, attachment point is at neck (bottom center)
      model.position.x = -center.x
      model.position.y = -originalBounds.min.y
      model.position.z = -center.z
    } else {
      // For other armor, center completely
      model.position.sub(center)
    }
    
    model.updateMatrixWorld(true)
    
    // Bake transforms
    this.bakeTransforms(model)
    
    // Get normalized bounds
    const normalizedBounds = new THREE.Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new THREE.Vector3())
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: center.clone().negate(),
          rotation: new THREE.Euler(0, 0, 0),
          scale: 1
        },
        dimensions: {
          width: normalizedSize.x,
          height: normalizedSize.y,
          depth: normalizedSize.z
        }
      }
    }
  }
  
  /**
   * Normalize building - ground at Y=0, entrance facing +Z
   */
  async normalizeBuilding(
    modelPath: string
  ): Promise<NormalizedAssetResult> {
    console.log(`🔧 Normalizing building`)
    
    // Load model
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    // Get original bounds
    const originalBounds = new THREE.Box3().setFromObject(model)
    const center = originalBounds.getCenter(new THREE.Vector3())
    
    // Position with ground at Y=0 and center on X/Z
    model.position.x = -center.x
    model.position.y = -originalBounds.min.y
    model.position.z = -center.z
    model.updateMatrixWorld(true)
    
    // Bake transforms
    this.bakeTransforms(model)
    
    // Get normalized bounds
    const normalizedBounds = new THREE.Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new THREE.Vector3())
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: new THREE.Vector3(-center.x, -originalBounds.min.y, -center.z),
          rotation: new THREE.Euler(0, 0, 0),
          scale: 1
        },
        dimensions: {
          width: normalizedSize.x,
          height: normalizedSize.y,
          depth: normalizedSize.z
        }
      }
    }
  }
  
  /**
   * Generic normalization based on asset type
   */
  async normalizeAsset(
    modelPath: string,
    assetType: string,
    subtype?: string,
    options?: {
      targetHeight?: number
      gripPoint?: THREE.Vector3
    }
  ): Promise<NormalizedAssetResult> {
    // Route to appropriate normalizer
    if (assetType === 'character') {
      return this.normalizeCharacter(modelPath, options?.targetHeight)
    } else if (assetType === 'weapon') {
      return this.normalizeWeapon(modelPath, subtype || 'sword', options?.gripPoint)
    } else if (assetType === 'armor') {
      return this.normalizeArmor(modelPath, subtype || 'chest')
    } else if (assetType === 'building') {
      return this.normalizeBuilding(modelPath)
    } else {
      // Default: center at origin
      return this.normalizeItem(modelPath)
    }
  }
  
  /**
   * Normalize generic item - center at origin
   */
  private async normalizeItem(modelPath: string): Promise<NormalizedAssetResult> {
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    const originalBounds = new THREE.Box3().setFromObject(model)
    const center = originalBounds.getCenter(new THREE.Vector3())
    
    // Center at origin
    model.position.sub(center)
    model.updateMatrixWorld(true)
    
    // Bake transforms
    this.bakeTransforms(model)
    
    const normalizedBounds = new THREE.Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new THREE.Vector3())
    
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: center.clone().negate(),
          rotation: new THREE.Euler(0, 0, 0),
          scale: 1
        },
        dimensions: {
          width: normalizedSize.x,
          height: normalizedSize.y,
          depth: normalizedSize.z
        }
      }
    }
  }
  
  /**
   * Validate that a model meets normalization conventions
   */
  async validateNormalization(
    modelPath: string,
    assetType: string,
    subtype?: string
  ): Promise<NormalizationResult> {
    const convention = getConvention(assetType, subtype)
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    
    const errors: string[] = []
    let originCorrect = false
    let orientationCorrect = true
    let scaleCorrect = true
    
    // Check origin
    if (assetType === 'character') {
      // Feet should be at Y=0
      originCorrect = Math.abs(bounds.min.y) < 0.01
      if (!originCorrect) {
        errors.push(`Feet not at origin. Min Y: ${bounds.min.y.toFixed(3)}`)
      }
    } else if (assetType === 'weapon') {
      // Grip should be near origin
      const expectedGripY = bounds.min.y + size.y * 0.2
      originCorrect = Math.abs(expectedGripY) < 0.1
      if (!originCorrect) {
        errors.push(`Grip not at origin. Expected grip Y: ${expectedGripY.toFixed(3)}`)
      }
    } else {
      // Center should be at origin
      originCorrect = center.length() < 0.1
      if (!originCorrect) {
        errors.push(`Center not at origin. Center: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`)
      }
    }
    
    // Check scale
    if (assetType === 'character') {
      // Height should be reasonable (0.3m to 10m)
      scaleCorrect = size.y >= 0.3 && size.y <= 10
      if (!scaleCorrect) {
        errors.push(`Character height out of range: ${size.y.toFixed(3)}m`)
      }
    } else if (assetType === 'weapon') {
      // Weapon should be reasonable size
      const maxDim = Math.max(size.x, size.y, size.z)
      scaleCorrect = maxDim >= 0.1 && maxDim <= 5
      if (!scaleCorrect) {
        errors.push(`Weapon size out of range: ${maxDim.toFixed(3)}m`)
      }
    }
    
    // Check transforms on root
    const hasTransforms = model.position.length() > 0.01 ||
                         model.rotation.x !== 0 || model.rotation.y !== 0 || model.rotation.z !== 0 ||
                         model.scale.x !== 1 || model.scale.y !== 1 || model.scale.z !== 1
    
    if (hasTransforms) {
      errors.push('Root node has non-identity transforms')
    }
    
    return {
      success: errors.length === 0,
      normalized: originCorrect && orientationCorrect && scaleCorrect && !hasTransforms,
      conventions: convention,
      transformsApplied: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1
      },
      validation: {
        originCorrect,
        orientationCorrect,
        scaleCorrect,
        errors
      }
    }
  }
  
  /**
   * Load a GLTF/GLB model
   */
  private async loadModel(modelPath: string): Promise<GLTF> {
    // Handle file:// URLs
    const path = modelPath.replace('file://', '')
    
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error)
      )
    })
  }
  
  /**
   * Export model to GLB format
   */
  private async exportModel(scene: THREE.Object3D): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      this.exporter.parse(
        scene,
        (result) => resolve(result as ArrayBuffer),
        (error) => reject(error),
        { binary: true }
      )
    })
  }
  
  /**
   * Bake transforms into geometry
   */
  private bakeTransforms(model: THREE.Object3D): void {
    model.updateMatrixWorld(true)
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        // Clone geometry to avoid modifying shared geometry
        child.geometry = child.geometry.clone()
        
        // Apply world matrix to geometry
        child.geometry.applyMatrix4(child.matrixWorld)
        
        // Reset transform to identity
        child.position.set(0, 0, 0)
        child.rotation.set(0, 0, 0)
        child.scale.set(1, 1, 1)
        child.updateMatrix()
      }
    })
    
    // Reset root transform
    model.position.set(0, 0, 0)
    model.rotation.set(0, 0, 0)
    model.scale.set(1, 1, 1)
    model.updateMatrixWorld(true)
  }
} 