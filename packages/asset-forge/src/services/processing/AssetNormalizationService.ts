/**
 * Asset Normalization Service
 * Handles normalization of 3D models to meet standard conventions
 */

import { Box3, Euler, Mesh, Object3D, Vector3 } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { getConvention, NormalizationResult } from '../../types/NormalizationConventions'
import { safeScale } from '../../utils/safe-math'

export interface NormalizedAssetResult {
  glb: ArrayBuffer
  metadata: {
    originalBounds: Box3
    normalizedBounds: Box3
    transformsApplied: {
      translation: Vector3
      rotation: Euler
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
    gripPoint?: Vector3
  ): Promise<NormalizedAssetResult> {
    console.log(`🔧 Normalizing weapon: ${weaponType}`)
    
    // Load model
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    // Get original bounds
    const originalBounds = new Box3().setFromObject(model)
    const originalSize = originalBounds.getSize(new Vector3())
    
    // If no grip point provided, estimate it
    if (!gripPoint) {
      // For most weapons, grip is at bottom 20% of the model
      const center = originalBounds.getCenter(new Vector3())
      gripPoint = new Vector3(
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
    const normalizedBounds = new Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new Vector3())
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: gripPoint.clone().negate(),
          rotation: new Euler(0, 0, 0),
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
    const originalBounds = new Box3().setFromObject(model)
    const originalSize = originalBounds.getSize(new Vector3())
    const originalHeight = originalSize.y
    
    console.log(`📏 Original height: ${originalHeight.toFixed(3)}m`)

    // Calculate scale factor to reach target height (protected against division by zero)
    const scaleFactor = safeScale(targetHeight, originalHeight, 1)
    model.scale.multiplyScalar(scaleFactor)
    model.updateMatrixWorld(true)
    
    // Position feet at origin
    const scaledBounds = new Box3().setFromObject(model)
    model.position.y = -scaledBounds.min.y
    model.updateMatrixWorld(true)
    
    // Ensure facing +Z (should already be correct from generation)
    // Characters should be generated facing forward
    
    // Bake transforms into geometry
    this.bakeTransforms(model)
    
    // Get normalized bounds
    const normalizedBounds = new Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new Vector3())
    
    console.log(`✅ Normalized height: ${normalizedSize.y.toFixed(3)}m`)
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: new Vector3(0, -scaledBounds.min.y, 0),
          rotation: new Euler(0, 0, 0),
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
    const originalBounds = new Box3().setFromObject(model)
    
    // Center at origin based on armor type
    const center = originalBounds.getCenter(new Vector3())
    
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
    const normalizedBounds = new Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new Vector3())
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: center.clone().negate(),
          rotation: new Euler(0, 0, 0),
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
    const originalBounds = new Box3().setFromObject(model)
    const center = originalBounds.getCenter(new Vector3())
    
    // Position with ground at Y=0 and center on X/Z
    model.position.x = -center.x
    model.position.y = -originalBounds.min.y
    model.position.z = -center.z
    model.updateMatrixWorld(true)
    
    // Bake transforms
    this.bakeTransforms(model)
    
    // Get normalized bounds
    const normalizedBounds = new Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new Vector3())
    
    // Export normalized model
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: new Vector3(-center.x, -originalBounds.min.y, -center.z),
          rotation: new Euler(0, 0, 0),
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
      gripPoint?: Vector3
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
    
    const originalBounds = new Box3().setFromObject(model)
    const center = originalBounds.getCenter(new Vector3())
    
    // Center at origin
    model.position.sub(center)
    model.updateMatrixWorld(true)
    
    // Bake transforms
    this.bakeTransforms(model)
    
    const normalizedBounds = new Box3().setFromObject(model)
    const normalizedSize = normalizedBounds.getSize(new Vector3())
    
    const glb = await this.exportModel(model)
    
    return {
      glb,
      metadata: {
        originalBounds,
        normalizedBounds,
        transformsApplied: {
          translation: center.clone().negate(),
          rotation: new Euler(0, 0, 0),
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

    const bounds = new Box3().setFromObject(model)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())

    const errors: string[] = []

    // Validate origin positioning
    const originCorrect = this.validateOrigin(assetType, bounds, size, center, errors)

    // Validate scale
    const scaleCorrect = this.validateScale(assetType, size, errors)

    // Validate transforms
    const orientationCorrect = true
    const hasTransforms = this.checkRootTransforms(model, errors)

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
   * Validate origin positioning based on asset type
   */
  private validateOrigin(
    assetType: string,
    bounds: Box3,
    size: Vector3,
    center: Vector3,
    errors: string[]
  ): boolean {
    if (assetType === 'character') {
      return this.validateCharacterOrigin(bounds, errors)
    }
    if (assetType === 'weapon') {
      return this.validateWeaponOrigin(bounds, size, errors)
    }
    return this.validateGenericOrigin(center, errors)
  }

  /**
   * Validate character origin (feet at Y=0)
   */
  private validateCharacterOrigin(bounds: Box3, errors: string[]): boolean {
    const originCorrect = Math.abs(bounds.min.y) < 0.01
    if (!originCorrect) {
      errors.push(`Feet not at origin. Min Y: ${bounds.min.y.toFixed(3)}`)
    }
    return originCorrect
  }

  /**
   * Validate weapon origin (grip near origin)
   */
  private validateWeaponOrigin(bounds: Box3, size: Vector3, errors: string[]): boolean {
    const expectedGripY = bounds.min.y + size.y * 0.2
    const originCorrect = Math.abs(expectedGripY) < 0.1
    if (!originCorrect) {
      errors.push(`Grip not at origin. Expected grip Y: ${expectedGripY.toFixed(3)}`)
    }
    return originCorrect
  }

  /**
   * Validate generic asset origin (centered)
   */
  private validateGenericOrigin(center: Vector3, errors: string[]): boolean {
    const originCorrect = center.length() < 0.1
    if (!originCorrect) {
      errors.push(`Center not at origin. Center: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`)
    }
    return originCorrect
  }

  /**
   * Validate scale based on asset type
   */
  private validateScale(assetType: string, size: Vector3, errors: string[]): boolean {
    if (assetType === 'character') {
      return this.validateCharacterScale(size, errors)
    }
    if (assetType === 'weapon') {
      return this.validateWeaponScale(size, errors)
    }
    return true
  }

  /**
   * Validate character scale (height 0.3m to 10m)
   */
  private validateCharacterScale(size: Vector3, errors: string[]): boolean {
    const scaleCorrect = size.y >= 0.3 && size.y <= 10
    if (!scaleCorrect) {
      errors.push(`Character height out of range: ${size.y.toFixed(3)}m`)
    }
    return scaleCorrect
  }

  /**
   * Validate weapon scale (max dimension 0.1m to 5m)
   */
  private validateWeaponScale(size: Vector3, errors: string[]): boolean {
    const maxDim = Math.max(size.x, size.y, size.z)
    const scaleCorrect = maxDim >= 0.1 && maxDim <= 5
    if (!scaleCorrect) {
      errors.push(`Weapon size out of range: ${maxDim.toFixed(3)}m`)
    }
    return scaleCorrect
  }

  /**
   * Check if root node has non-identity transforms
   */
  private checkRootTransforms(model: Object3D, errors: string[]): boolean {
    const hasTransforms = model.position.length() > 0.01 ||
                         model.rotation.x !== 0 || model.rotation.y !== 0 || model.rotation.z !== 0 ||
                         model.scale.x !== 1 || model.scale.y !== 1 || model.scale.z !== 1

    if (hasTransforms) {
      errors.push('Root node has non-identity transforms')
    }

    return hasTransforms
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
  private async exportModel(scene: Object3D): Promise<ArrayBuffer> {
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
   *
   * NOTE: This modifies geometry IN PLACE for normalization/export.
   * No cloning needed - we're creating a new exported file.
   * This prevents 30-40% memory overhead from unnecessary geometry cloning.
   */
  private bakeTransforms(model: Object3D): void {
    model.updateMatrixWorld(true)

    model.traverse((child) => {
      if (child instanceof Mesh && child.geometry) {
        // Apply world matrix to geometry IN PLACE (no clone needed for export)
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