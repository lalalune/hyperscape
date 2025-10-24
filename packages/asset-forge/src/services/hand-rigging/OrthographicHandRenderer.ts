/**
 * Orthographic Hand Renderer Service
 * Captures orthographic views of hands from 3D models for pose detection
 */

import {
  AmbientLight, AxesHelper, Bone, Color, DirectionalLight, DoubleSide, MathUtils, Matrix4,
  Mesh, MeshBasicMaterial, Object3D, OrthographicCamera, Quaternion, Scene, SkinnedMesh, Texture,
  Vector3, WebGLRenderer
} from 'three'
// Reserved for future enhancement: external model loading
// See GitHub issue #141 for planned implementation
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface CaptureOptions {
  resolution?: number
  backgroundColor?: string
  padding?: number
  showAxes?: boolean
}

export interface HandCaptureResult {
  canvas: HTMLCanvasElement
  imageData: ImageData
  cameraMatrix: Matrix4
  projectionMatrix: Matrix4
  worldBounds: {
    min: Vector3
    max: Vector3
  }
  wristPosition: Vector3
  handNormal: Vector3
  side: 'left' | 'right'
}

export interface WristBoneInfo {
  bone: Bone
  position: Vector3
  normal: Vector3
  side: 'left' | 'right'
}

export class OrthographicHandRenderer {
  private renderer: WebGLRenderer
  private scene: Scene
  private camera: OrthographicCamera
  // Reserved for future enhancement: external model loading
  // See GitHub issue #141 for planned implementation
  // private loader: GLTFLoader
  
  // Default capture settings
  private readonly DEFAULT_RESOLUTION = 512
  private readonly DEFAULT_PADDING = 0.2
  private readonly CAPTURE_DISTANCE = 1.0
  
  constructor() {
    // Create WebGL renderer
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(this.DEFAULT_RESOLUTION, this.DEFAULT_RESOLUTION)
    this.renderer.shadowMap.enabled = false
    
    // Create scene
    this.scene = new Scene()
    this.scene.background = new Color(0x000000)
    
    // Create orthographic camera
    const aspect = 1
    const frustumSize = 1
    this.camera = new OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      10
    )
    
    // Add comprehensive lighting for better hand visibility
    const ambientLight = new AmbientLight(0xffffff, 0.9)
    this.scene.add(ambientLight)
    
    // Multiple directional lights from different angles
    const directionalLight1 = new DirectionalLight(0xffffff, 0.7)
    directionalLight1.position.set(1, 1, 1)
    this.scene.add(directionalLight1)
    
    const directionalLight2 = new DirectionalLight(0xffffff, 0.5)
    directionalLight2.position.set(-1, 0.5, -1)
    this.scene.add(directionalLight2)
    
    const directionalLight3 = new DirectionalLight(0xffffff, 0.3)
    directionalLight3.position.set(0, -1, 0)
    this.scene.add(directionalLight3)

    // Reserved for future enhancement: external model loading
    // See GitHub issue #141 for planned implementation
    // this.loader = new GLTFLoader()
  }
  
  /**
   * Find wrist bones in a model
   */
  findWristBones(model: Object3D): WristBoneInfo[] {
    const wristBones: WristBoneInfo[] = []
    
    // Common wrist bone names
    const wristNames = [
      'hand_l', 'hand_r',
      'Hand_L', 'Hand_R',
      'leftHand', 'rightHand',
      'LeftHand', 'RightHand',
      'mixamorig:LeftHand', 'mixamorig:RightHand',
      'Bip01_L_Hand', 'Bip01_R_Hand',
      'wrist_l', 'wrist_r',
      'Wrist_L', 'Wrist_R'
    ]
    
    model.traverse((child) => {
      if (child instanceof Bone) {
        const lowerName = child.name.toLowerCase()
        
        // Check if this is a wrist bone
        const isWrist = wristNames.some(name => 
          child.name === name || lowerName.includes('hand') || lowerName.includes('wrist')
        )
        
        if (isWrist) {
          // Determine side
          const isLeft = lowerName.includes('left') || lowerName.includes('_l') || 
                        lowerName.endsWith('l') || lowerName.includes('l_')
          const isRight = lowerName.includes('right') || lowerName.includes('_r') || 
                         lowerName.endsWith('r') || lowerName.includes('r_')
          
          if (isLeft || isRight) {
            // Get world position and orientation
            const worldPos = new Vector3()
            const worldQuat = new Quaternion()
            const worldScale = new Vector3()
            
            child.updateWorldMatrix(true, false)
            child.matrixWorld.decompose(worldPos, worldQuat, worldScale)
            
            // Calculate hand normal (usually pointing along the bone)
            const normal = new Vector3(0, 1, 0)
            normal.applyQuaternion(worldQuat)
            
            wristBones.push({
              bone: child,
              position: worldPos,
              normal: normal,
              side: isLeft ? 'left' : 'right'
            })
            
            console.log(`🦴 Found wrist bone: ${child.name} (${isLeft ? 'left' : 'right'})`)
          }
        }
      }
    })
    
    return wristBones
  }
  
  /**
   * Capture orthographic view of a hand
   */
  async captureHand(
    model: Object3D,
    wristInfo: WristBoneInfo,
    options: CaptureOptions = {}
  ): Promise<HandCaptureResult> {
    const resolution = options.resolution || this.DEFAULT_RESOLUTION
    const padding = options.padding || this.DEFAULT_PADDING
    const backgroundColor = options.backgroundColor || '#000000'
    
    // Update renderer size
    this.renderer.setSize(resolution, resolution)
    
    // Clear scene
    while (this.scene.children.length > 2) { // Keep lights
      const child = this.scene.children[2]
      this.scene.remove(child)
    }
    
    // Set background
    this.scene.background = new Color(backgroundColor)
    
    // Clone and add model to scene
    const modelClone = model.clone(true)
    
          // Ensure materials are properly cloned and set up for capture
      modelClone.traverse((child) => {
        if (child instanceof Mesh || child instanceof SkinnedMesh) {
          if (child.material) {
            // Create simple materials for better hand detection
            const simpleMaterial = new MeshBasicMaterial({
              color: 0xffa080, // More visible skin color
              side: DoubleSide
            })
            
            if (Array.isArray(child.material)) {
              child.material = child.material.map(() => simpleMaterial.clone())
            } else {
              child.material = simpleMaterial
            }
          }
          
          // Ensure the mesh is visible
          child.visible = true
          child.frustumCulled = false
          
          // For skinned meshes, ensure they're in bind pose
          if (child instanceof SkinnedMesh && child.skeleton) {
            child.skeleton.pose()
          }
        }
      })
    
    this.scene.add(modelClone)
    
    // Ensure the model is at world scale
    modelClone.updateMatrixWorld(true)
    
    // Calculate camera position
    const cameraPos = this.calculateCameraPosition(
      wristInfo.position,
      wristInfo.normal,
      this.CAPTURE_DISTANCE
    )
    
    // Position camera
    this.camera.position.copy(cameraPos)
    
    // Look at a point forward from the wrist (towards fingers)
    const lookAtPoint = wristInfo.position.clone()
    lookAtPoint.add(wristInfo.normal.clone().multiplyScalar(0.08))
    
    this.camera.lookAt(lookAtPoint)
    this.camera.up.set(0, 1, 0)
    
    // Update camera projection to frame the hand region
    const handBounds = this.estimateHandBounds(wristInfo.position, wristInfo.normal)
    this.updateCameraFrustum(handBounds, padding)
    
    // Update matrices
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
    
    // Add debug axes if requested
    if (options.showAxes) {
      const axesHelper = new AxesHelper(0.1)
      axesHelper.position.copy(wristInfo.position)
      this.scene.add(axesHelper)
    }
    
    // Render
    this.renderer.render(this.scene, this.camera)
    
    // Get canvas and create a 2D copy for image data extraction
    const webglCanvas = this.renderer.domElement
    
    // Ensure the WebGL canvas has content
    if (!webglCanvas || webglCanvas.width === 0 || webglCanvas.height === 0) {
      throw new Error('WebGL canvas is not properly initialized')
    }
    
    // Create result canvas and copy WebGL content
    const resultCanvas = document.createElement('canvas')
    resultCanvas.width = resolution
    resultCanvas.height = resolution
    const resultCtx = resultCanvas.getContext('2d')
    
    if (!resultCtx) {
      throw new Error('Failed to get 2D context for result canvas')
    }
    
    // Draw the WebGL canvas to the 2D canvas
    resultCtx.drawImage(webglCanvas, 0, 0)
    
    // Now get the image data from the 2D canvas
    const imageData = resultCtx.getImageData(0, 0, resolution, resolution)
    
    // Clean up cloned model
    this.scene.remove(modelClone)
    
    return {
      canvas: resultCanvas,
      imageData,
      cameraMatrix: this.camera.matrixWorld.clone(),
      projectionMatrix: this.camera.projectionMatrix.clone(),
      worldBounds: handBounds,
      wristPosition: wristInfo.position.clone(),
      handNormal: wristInfo.normal.clone(),
      side: wristInfo.side
    }
  }
  
  /**
   * Calculate optimal camera position for hand capture
   */
  private calculateCameraPosition(
    wristPos: Vector3,
    wristNormal: Vector3,
    distance: number
  ): Vector3 {
    // Position camera along the normal direction
    const cameraPos = wristPos.clone()
    
    // For hands, we need different angles for better detection
    const adjustedNormal = wristNormal.clone()
    
    // Try to capture from palm side by inverting the normal
    adjustedNormal.multiplyScalar(-1)
    
    // Add slight upward angle to see fingers better
    adjustedNormal.add(new Vector3(0, 0.5, 0)).normalize()
    
    cameraPos.addScaledVector(adjustedNormal, distance)
    
    return cameraPos
  }
  
  /**
   * Estimate hand bounds based on wrist position
   */
  private estimateHandBounds(
    wristPos: Vector3,
    wristNormal: Vector3
  ): { min: Vector3, max: Vector3 } {
    // Estimate hand size (typical proportions) - increased for better capture
    const handLength = 0.3 // 30cm (increased for better capture)
    const handWidth = 0.15  // 15cm (increased for better capture)
    
    // Create basis vectors
    const forward = wristNormal.clone().normalize()
    const right = new Vector3()
    
    // Create right vector perpendicular to forward
    if (Math.abs(forward.y) > 0.9) {
      right.crossVectors(forward, new Vector3(1, 0, 0))
    } else {
      right.crossVectors(forward, new Vector3(0, 1, 0))
    }
    right.normalize()
    
    const up = new Vector3().crossVectors(right, forward).normalize()
    
    // Calculate bounds
    // Offset center to better capture the hand (not just from wrist)
    const center = wristPos.clone().addScaledVector(forward, handLength * 0.6)
    
    const halfExtents = new Vector3(
      handWidth / 2,
      handWidth / 2,
      handLength / 2
    )
    
    // Transform to world space
    const points: Vector3[] = []
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const point = center.clone()
          point.addScaledVector(right, halfExtents.x * x)
          point.addScaledVector(up, halfExtents.y * y)
          point.addScaledVector(forward, halfExtents.z * z)
          points.push(point)
        }
      }
    }
    
    // Find min/max
    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = new Vector3(-Infinity, -Infinity, -Infinity)
    
    points.forEach(point => {
      min.min(point)
      max.max(point)
    })
    
    return { min, max }
  }
  
  /**
   * Update camera frustum to frame bounds
   */
  private updateCameraFrustum(
    bounds: { min: Vector3, max: Vector3 },
    padding: number
  ): void {
    // Project bounds to camera space
    const cameraMatrixInverse = this.camera.matrixWorldInverse
    
    const minCamera = bounds.min.clone().applyMatrix4(cameraMatrixInverse)
    const maxCamera = bounds.max.clone().applyMatrix4(cameraMatrixInverse)
    
    // Calculate required frustum size
    const width = maxCamera.x - minCamera.x
    const height = maxCamera.y - minCamera.y
    
    const frustumSize = Math.max(width, height) * (1 + padding)
    
    // Update camera frustum
    const aspect = 1
    this.camera.left = -frustumSize * aspect / 2
    this.camera.right = frustumSize * aspect / 2
    this.camera.top = frustumSize / 2
    this.camera.bottom = -frustumSize / 2
    
    this.camera.updateProjectionMatrix()
  }
  
  /**
   * Capture multiple angles for better detection
   */
  async captureMultipleAngles(
    model: Object3D,
    wristInfo: WristBoneInfo,
    angles: number[] = [0, 45, -45],
    options: CaptureOptions = {}
  ): Promise<HandCaptureResult[]> {
    const results: HandCaptureResult[] = []
    
    for (const angle of angles) {
      // Rotate normal around up axis
      const rotatedNormal = wristInfo.normal.clone()
      const axis = new Vector3(0, 1, 0)
      const quaternion = new Quaternion().setFromAxisAngle(
        axis,
        MathUtils.degToRad(angle)
      )
      rotatedNormal.applyQuaternion(quaternion)
      
      // Create modified wrist info
      const rotatedWristInfo: WristBoneInfo = {
        ...wristInfo,
        normal: rotatedNormal
      }
      
      const result = await this.captureHand(model, rotatedWristInfo, options)
      results.push(result)
    }
    
    return results
  }
  
  /**
   * Debug: Save capture to image
   */
  saveCapture(capture: HandCaptureResult, filename: string): void {
    console.log(`💾 Saving capture: ${filename}`)
    const link = document.createElement('a')
    link.download = filename
    link.href = capture.canvas.toDataURL()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Also log the data URL for debugging
    console.log(`📸 Capture preview: ${capture.canvas.toDataURL().substring(0, 100)}...`)
  }
  
  /**
   * Cleanup resources
   */
  /**
   * Dispose of all resources (renderer, scene, geometries, materials, textures)
   */
  dispose(): void {
    // Dispose of all scene objects
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof SkinnedMesh) {
        // Dispose geometry
        if (object.geometry) {
          object.geometry.dispose()
        }

        // Dispose materials and their textures
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(material => {
            // Dispose all textures in the material
            Object.keys(material).forEach(key => {
              const value = material[key as keyof typeof material]
              if (value && value instanceof Texture) {
                value.dispose()
              }
            })
            material.dispose()
          })
        }
      }
    })

    // Dispose renderer
    this.renderer.dispose()

    console.log('✅ OrthographicHandRenderer disposed successfully')
  }
} 