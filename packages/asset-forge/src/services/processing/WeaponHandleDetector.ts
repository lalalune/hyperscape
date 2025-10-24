import {
  AmbientLight, Box3, Color, DirectionalLight, Light, Mesh, Object3D, OrthographicCamera,
  Raycaster, Scene, Texture, Vector2, Vector3, WebGLRenderer
} from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { GripBounds, GripCoordinates, GripDetectionData } from '../../types'

import { apiFetch } from '@/utils/api'

interface HandleDetectionResult {
  gripPoint: Vector3
  vertices: Vector3[]
  confidence: number
  annotatedImage: string
  redBoxBounds?: GripBounds
  orientationFlipped?: boolean
}

export type { HandleDetectionResult }

interface RedPixelBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export class WeaponHandleDetector {
  private renderer: WebGLRenderer
  private scene: Scene
  private camera: OrthographicCamera
  private loader: GLTFLoader
  
  constructor() {
    // Initialize Three.js components
    this.renderer = new WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(512, 512)
    this.renderer.setClearColor(0x1a1a1a, 1)
    
    this.scene = new Scene()
    this.scene.background = new Color(0x1a1a1a)
    
    this.camera = new OrthographicCamera(
      -1, 1, 1, -1, 0.1, 100
    )
    
    this.loader = new GLTFLoader()
  }
  
  async detectHandleArea(modelUrl: string, useConsensus: boolean = false): Promise<HandleDetectionResult> {
    console.log('🎯 Starting weapon handle detection for:', modelUrl)
    console.log('Using consensus mode:', useConsensus)
    
    // Ensure everything is initialized
    if (!this.scene || !this.camera || !this.renderer || !this.loader) {
      throw new Error('WeaponHandleDetector not properly initialized')
    }
    
    // 1. Load the GLB model
    const model = await this.loadModel(modelUrl)
    
    // 2. Setup orthographic camera to frame weapon
    const orientationFlipped = await this.setupOrthographicCamera(model)
    
    let gripData: GripDetectionData | null = null
    let annotatedImage: string
    
    if (useConsensus) {
      // Multi-angle consensus approach
      const multiAngleCanvases = this.renderMultipleAngles(model)
      
      // Get consensus from multiple AI detections
      gripData = await this.getConsensusGripCoordinates(multiAngleCanvases)
      
      if (!gripData) {
        throw new Error('Failed to detect grip coordinates')
      }
      
      // Use the side view for annotation (first canvas)
      const sideCanvas = multiAngleCanvases[0].canvas
      const annotatedCanvas = this.drawGripArea(sideCanvas, gripData.gripBounds)
      annotatedImage = annotatedCanvas.toDataURL('image/png')
    } else {
      // Single view approach (original)
      const canvas = this.renderToCanvas(model)
      const coordinates = await this.getGripCoordinates(canvas)
      
      if (!coordinates) {
        throw new Error('Failed to detect grip coordinates')
      }
      
      // Convert GripCoordinates to GripDetectionData
      gripData = {
        gripBounds: coordinates.gripBounds || coordinates.bounds,
        confidence: coordinates.confidence || 0.8,
        weaponType: 'sword', // Default for single view
        gripDescription: 'Single view detection'
      }
      
      const annotatedCanvas = this.drawGripArea(canvas, gripData.gripBounds)
      annotatedImage = annotatedCanvas.toDataURL('image/png')
    }
    
    // Convert pixel coordinates to normalized bounds
    const normalizedBounds = {
      minX: gripData.gripBounds.minX / 512,
      maxX: gripData.gripBounds.maxX / 512,
      minY: gripData.gripBounds.minY / 512,
      maxY: gripData.gripBounds.maxY / 512
    }
    
    // Back-project to 3D
    const handle3DRegion = this.backProjectTo3D(normalizedBounds, model)
    
    // Calculate grip center
    const gripPoint = this.calculateGripCenter(handle3DRegion)
    
    // Validate the grip point
    const modelBounds = new Box3().setFromObject(model)
    const modelSize = new Vector3()
    modelBounds.getSize(modelSize)
    
    // Check if grip point is within reasonable bounds
    const isValid = gripPoint.x !== 0 || gripPoint.y !== 0 || gripPoint.z !== 0
    
    if (!isValid) {
      console.warn('Invalid grip point detected, using fallback position')
      
      // Use a reasonable default based on the detected red box position
      const gripY = modelBounds.min.y + modelSize.y * ((gripData.gripBounds.minY + gripData.gripBounds.maxY) / 2 / 512)
      gripPoint.set(0, gripY, 0)
      
      console.log('Fallback grip point:', gripPoint)
    }
    
    // Ensure grip point is not too far from the model
    const distanceFromCenter = gripPoint.length()
    if (distanceFromCenter > modelSize.length()) {
      console.warn('Grip point too far from model center, clamping')
      gripPoint.multiplyScalar(modelSize.length() / distanceFromCenter)
    }
    
    // Clean up - remove model and lights from scene
    if (model && model.parent === this.scene) {
      this.scene.remove(model)
    }
    
    // Remove all lights
    const lightsToRemove: Light[] = []
    this.scene.traverse((child) => {
      if (child instanceof Light) {
        lightsToRemove.push(child)
      }
    })
    
    lightsToRemove.forEach(light => {
      this.scene.remove(light)
    })
    
    return {
      gripPoint,
      vertices: handle3DRegion,
      confidence: gripData.confidence || 0.85,
      annotatedImage,
      redBoxBounds: gripData.gripBounds,
      orientationFlipped: orientationFlipped
    }
  }
  
  /**
   * Export a normalized weapon with grip at origin
   */
  async exportNormalizedWeapon(
    modelPath: string,
    outputPath?: string
  ): Promise<{
    normalizedGlb: ArrayBuffer
    originalGripPoint: Vector3
    dimensions: { length: number; width: number; height: number }
    orientationFlipped: boolean
  }> {
    console.log('🔧 Exporting normalized weapon...')
    
    // Step 1: Detect grip point using our existing detection
    const detection = await this.detectHandleArea(modelPath, true)
    
    // Step 2: Load model
    const gltf = await this.loader.loadAsync(modelPath)
    const model = gltf.scene
    
    // Step 3: Apply orientation correction if needed
    if (detection.orientationFlipped) {
      console.log('🔄 Applying orientation correction (180° rotation)')
      model.rotateZ(Math.PI)
      model.updateMatrixWorld(true)
    }
    
    // Step 4: Move grip point to origin
    console.log(`📍 Moving grip point to origin from: ${detection.gripPoint.x.toFixed(3)}, ${detection.gripPoint.y.toFixed(3)}, ${detection.gripPoint.z.toFixed(3)}`)
    model.position.sub(detection.gripPoint)
    model.updateMatrixWorld(true)
    
    // Step 5: Bake transforms into geometry
    // NOTE: Modifying geometry IN PLACE for export (no clone needed)
    model.traverse((child) => {
      if (child instanceof Mesh && child.geometry) {
        // Apply world matrix to geometry IN PLACE (no clone needed for export)
        child.geometry.applyMatrix4(child.matrixWorld)

        // Reset transforms
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
    
    // Step 6: Get final dimensions
    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    
    console.log(`📏 Normalized weapon dimensions: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`)
    
    // Step 7: Export normalized model
    const exporter = new GLTFExporter()
    const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        model,
        (result) => resolve(result as ArrayBuffer),
        (error) => reject(error),
        { binary: true }
      )
    })
    
    // Step 8: Save if output path provided
    if (outputPath) {
      const buffer = Buffer.from(glb)
      const fs = await import('fs')
      await fs.promises.writeFile(outputPath, buffer)
      console.log(`💾 Saved normalized weapon to: ${outputPath}`)
    }
    
    // Clean up
    this.disposeModel(model)
    
    return {
      normalizedGlb: glb,
      originalGripPoint: detection.gripPoint,
      dimensions: {
        length: size.y,  // Y is up (blade direction)
        width: size.x,
        height: size.z
      },
      orientationFlipped: detection.orientationFlipped || false
    }
  }
  
  private async loadModel(modelUrl: string): Promise<Object3D> {
    console.log('📦 Loading model from:', modelUrl)
    
    try {
      const gltf = await this.loader.loadAsync(modelUrl)
      const model = gltf.scene
      
      console.log('✅ Model loaded successfully')
      
      // Ensure model has proper structure
      if (!model) {
        throw new Error('Model scene is undefined')
      }
      
      // Log model info
      let meshCount = 0
      model.traverse((child) => {
        if (child instanceof Mesh) {
          meshCount++
        }
      })
      
      console.log(`Model contains ${meshCount} meshes`)
      
      return model
    } catch (error) {
      console.error('❌ Failed to load model:', error)
      throw new Error(`Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  private async setupOrthographicCamera(model: Object3D): Promise<boolean> {
    console.log('📐 Setting up orthographic camera for weapon')
    
    const box = new Box3().setFromObject(model)
    const size = new Vector3()
    box.getSize(size)
    const center = new Vector3()
    box.getCenter(center)
    
    console.log('Model dimensions:', { x: size.x, y: size.y, z: size.z })
    console.log('Model center:', { x: center.x, y: center.y, z: center.z })
    
    // Center the model at origin first
    model.position.sub(center)
    
    // Auto-orient weapon vertically if needed
    const dimensions = [
      { axis: 'x', size: size.x },
      { axis: 'y', size: size.y },
      { axis: 'z', size: size.z }
    ].sort((a, b) => b.size - a.size)
    
    console.log('Longest dimension:', dimensions[0].axis, dimensions[0].size)
    
    // Rotate to make vertical if needed
    if (dimensions[0].axis !== 'y') {
      if (dimensions[0].axis === 'x') {
        model.rotation.z = -Math.PI / 2
        console.log('Rotating weapon around Z axis')
      } else if (dimensions[0].axis === 'z') {
        model.rotation.x = Math.PI / 2
        console.log('Rotating weapon around X axis')
      }
      
      // Recalculate bounds after rotation
      box.setFromObject(model)
      box.getSize(size)
      box.getCenter(center)
      model.position.set(0, 0, 0)
      model.position.sub(center)
    }
    
    // Add lighting for better visibility
    const ambientLight = new AmbientLight(0xffffff, 0.8)
    this.scene.add(ambientLight)
    
    const directionalLight1 = new DirectionalLight(0xffffff, 0.6)
    directionalLight1.position.set(1, 1, 1)
    this.scene.add(directionalLight1)
    
    const directionalLight2 = new DirectionalLight(0xffffff, 0.4)
    directionalLight2.position.set(-1, 0.5, -1)
    this.scene.add(directionalLight2)
    
    const cameraLight = new DirectionalLight(0xffffff, 0.3)
    cameraLight.position.copy(this.camera.position)
    this.scene.add(cameraLight)
    
    // Add model to scene
    this.scene.add(model)
    model.updateMatrixWorld(true)
    
    // Determine camera distance
    const maxDim = Math.max(size.x, size.y, size.z)
    
    // Setup orthographic frustum with padding
    const frustumSize = maxDim * 1.5
    this.camera.left = -frustumSize / 2
    this.camera.right = frustumSize / 2
    this.camera.top = frustumSize / 2
    this.camera.bottom = -frustumSize / 2
    this.camera.near = -maxDim * 10
    this.camera.far = maxDim * 10
    
    // Position camera to look at the weapon from the side (X axis)
    this.camera.position.set(maxDim * 3, 0, 0)
    this.camera.lookAt(0, 0, 0)
    
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld(true)
    
    // Render once to check orientation
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(this.renderer.domElement, 0, 0)
    
    // Use AI to check if weapon needs flipping
    const needsFlip = await this.detectWeaponOrientation(canvas)
    
    if (needsFlip) {
      console.log('🔄 Flipping weapon 180 degrees based on AI detection')
      model.rotation.x += Math.PI
      model.updateMatrixWorld(true)
      
      // Re-center after flip
      box.setFromObject(model)
      box.getCenter(center)
      model.position.set(0, 0, 0)
      model.position.sub(center)
      return true
    }
    
    console.log('Camera setup complete')
    return false
  }
  
  private renderToCanvas(_model: Object3D): HTMLCanvasElement {
    // Model is already added to scene in setupOrthographicCamera
    
    // Create offscreen canvas
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    
    // Set renderer to use the correct size
    this.renderer.setSize(512, 512)
    
    // Clear and render the scene
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    
    // Copy to our canvas
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(this.renderer.domElement, 0, 0)
    
    // Add debug grid lines to help visualize sections
    const SHOW_DEBUG_GRID = false
    if (SHOW_DEBUG_GRID) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 1
      
      // Draw horizontal thirds
      ctx.beginPath()
      ctx.moveTo(0, 512 / 3)
      ctx.lineTo(512, 512 / 3)
      ctx.moveTo(0, 512 * 2 / 3)
      ctx.lineTo(512, 512 * 2 / 3)
      ctx.stroke()
      
      // Label sections
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = '12px Arial'
      ctx.fillText('Top Third', 5, 20)
      ctx.fillText('Middle Third', 5, 512 / 2)
      ctx.fillText('Bottom Third', 5, 512 - 50)
    }
    
    console.log('✅ Rendered weapon to canvas')
    
    return canvas
  }
  
  private preprocessCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const processedCanvas = document.createElement('canvas')
    processedCanvas.width = canvas.width
    processedCanvas.height = canvas.height
    const ctx = processedCanvas.getContext('2d')!
    
    // Draw original image
    ctx.drawImage(canvas, 0, 0)
    
    // Add edge detection overlay to highlight shape changes
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // Simple edge detection to find width changes
    const edges: number[][] = []
    for (let y = 0; y < canvas.height; y++) {
      edges[y] = []
      for (let x = 0; x < canvas.width; x++) {
        edges[y][x] = 0
      }
    }
    
    // Detect horizontal edges (width changes)
    for (let y = 1; y < canvas.height - 1; y++) {
      let leftEdge = -1
      let rightEdge = -1
      
      // Find left edge
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        if (brightness > 50 && leftEdge === -1) {
          leftEdge = x
          break
        }
      }
      
      // Find right edge
      for (let x = canvas.width - 1; x >= 0; x--) {
        const idx = (y * canvas.width + x) * 4
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        if (brightness > 50 && rightEdge === -1) {
          rightEdge = x
          break
        }
      }
      
      if (leftEdge !== -1 && rightEdge !== -1) {
        edges[y][0] = rightEdge - leftEdge // Store width
      }
    }
    
    // Find significant width changes (potential handle location)
    const widthProfile: number[] = []
    for (let y = 0; y < canvas.height; y++) {
      widthProfile[y] = edges[y][0] || 0
    }
    
    // Smooth the profile
    const smoothedProfile: number[] = []
    for (let y = 2; y < canvas.height - 2; y++) {
      let sum = 0
      for (let dy = -2; dy <= 2; dy++) {
        sum += widthProfile[y + dy]
      }
      smoothedProfile[y] = sum / 5
    }
    
    // Find narrowest continuous section (likely the handle)
    let minWidth = Infinity
    let narrowStart = -1
    let narrowEnd = -1
    let inNarrowSection = false
    
    for (let y = canvas.height * 0.5; y < canvas.height * 0.9; y++) {
      const width = smoothedProfile[y]
      if (width > 0 && width < minWidth * 1.2) {
        if (!inNarrowSection) {
          narrowStart = y
          inNarrowSection = true
        }
        narrowEnd = y
        minWidth = Math.min(minWidth, width)
      } else if (inNarrowSection && width > minWidth * 1.5) {
        break // End of narrow section
      }
    }
    
    // Draw helper lines
    if (narrowStart !== -1 && narrowEnd !== -1) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      
      // Draw lines at detected handle region
      ctx.beginPath()
      ctx.moveTo(0, narrowStart)
      ctx.lineTo(canvas.width, narrowStart)
      ctx.moveTo(0, narrowEnd)
      ctx.lineTo(canvas.width, narrowEnd)
      ctx.stroke()
      
      // Add text labels
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'
      ctx.font = '14px Arial'
      ctx.fillText('Handle region detected', 10, narrowStart - 5)
    }
    
    return processedCanvas
  }
  
  private async getGripCoordinates(canvas: HTMLCanvasElement): Promise<GripCoordinates> {
    // Preprocess the canvas to highlight handle region
    const processedCanvas = this.preprocessCanvas(canvas)
    const base64Image = processedCanvas.toDataURL('image/png')
    
    try {
      const response = await apiFetch('/api/weapon-handle-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `API error: ${response.status}`)
      }
      
      const data = await response.json()
      if (!data?.success || !data?.gripData) {
        throw new Error('Invalid response from handle detection API')
      }

      // Validate the detected bounds
      const gripData = data.gripData
      const bounds = gripData?.gripBounds

      if (!bounds) {
        throw new Error('No grip bounds found in response')
      }
      
      // If it's a sword, use our specialized detector
      if (gripData.weaponType === 'sword' || gripData.weaponType === 'dagger') {
        const swordHandle = this.detectSwordHandle(canvas)
        if (swordHandle) {
          console.log('Using specialized sword handle detection')
          const centerX = (bounds.minX + bounds.maxX) / 2
          bounds.minY = swordHandle.minY
          bounds.maxY = swordHandle.maxY
          bounds.minX = centerX - 40
          bounds.maxX = centerX + 40
          gripData.confidence = Math.max(gripData.confidence, 0.85)
          gripData.gripDescription = 'Detected using sword-specific algorithm'
        }
      }
      
      // Check if the detection is in the blade area (upper part of weapon)
      if (bounds.minY < 150) { // Top 30% of image
        console.warn('Detection appears to be on blade, adjusting to handle area')
        
        // Try specialized detection first
        const swordHandle = this.detectSwordHandle(canvas)
        if (swordHandle) {
          const centerX = (bounds.minX + bounds.maxX) / 2
          bounds.minY = swordHandle.minY
          bounds.maxY = swordHandle.maxY
          bounds.minX = centerX - 40
          bounds.maxX = centerX + 40
        } else {
          // Fallback to lower portion
          bounds.minY = 350
          bounds.maxY = 450
        }
        gripData.confidence *= 0.5 // Lower confidence due to correction
      }
      
      // Ensure bounds are reasonable
      const width = bounds.maxX - bounds.minX
      const height = bounds.maxY - bounds.minY
      
      if (width > 200 || height > 200) {
        console.warn('Detected area too large, likely includes non-handle parts')
        // Shrink to more reasonable size
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2
        bounds.minX = centerX - 50
        bounds.maxX = centerX + 50
        bounds.minY = centerY - 50
        bounds.maxY = centerY + 50
        gripData.confidence *= 0.7
      }
      
      return gripData
    } catch (error) {
      console.error('Failed to get grip coordinates:', error)
      throw new Error(`Handle detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  private async getConsensusGripCoordinates(canvases: { angle: string, canvas: HTMLCanvasElement }[]): Promise<GripDetectionData | null> {
    console.log('🤖 Running multi-AI consensus detection...')
    
    const allDetections: GripDetectionData[] = []
    
    // Different prompting strategies for variety
    const promptVariations = [
      "Focus on where the hand would naturally grip for combat. The handle is the narrow wrapped section, NOT the blade.",
      "Identify the handle/hilt area where fingers wrap around. This is NOT the wide flat blade part.",
      "Find the cylindrical grip section, usually wrapped in leather or cord. Avoid the metallic blade."
    ]
    
    // Get detections from multiple angles and prompts
    for (const { angle, canvas } of canvases) {
      const promptIndex = canvases.indexOf(canvases.find(c => c.angle === angle)!) % promptVariations.length
      
      // Preprocess each canvas
      const processedCanvas = this.preprocessCanvas(canvas)
      const base64Image = processedCanvas.toDataURL('image/png')
      
      try {
        const response = await apiFetch('/api/weapon-handle-detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64Image,
            angle: angle,
            promptHint: promptVariations[promptIndex]
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data?.success && data?.gripData) {
            const gripData = data.gripData

            // Validate this detection
            const bounds = gripData?.gripBounds

            if (!bounds) {
              continue
            }
            const isValidDetection = bounds.minY > 200 && // Not in top 40% (blade area)
                                    bounds.maxY < 500 && // Not at very bottom (pommel)
                                    (bounds.maxX - bounds.minX) < 150 && // Not too wide
                                    (bounds.maxY - bounds.minY) < 150    // Not too tall
            
            if (isValidDetection) {
              allDetections.push({
                ...gripData,
                angle: angle,
                promptUsed: promptIndex
              })
            } else {
              console.warn(`Invalid detection from angle ${angle}: bounds outside handle area`)
            }
          }
        }
      } catch (error) {
        console.warn(`Detection failed for angle ${angle}:`, error)
      }
    }
    
    console.log(`Got ${allDetections.length} valid detections`)
    
    if (allDetections.length === 0) {
      // Fallback: use a reasonable default for sword handle
      console.warn('No valid detections, using fallback position')
      return {
        gripBounds: { 
          minX: 230, 
          minY: 360, 
          maxX: 280, 
          maxY: 440,
          x: 230,
          y: 360,
          width: 50,
          height: 80
        },
        confidence: 0.3,
        weaponType: "sword",
        gripDescription: "Fallback handle position"
      }
    }
    
    // Find consensus by averaging high-confidence results
    const highConfidenceDetections = allDetections.filter(d => d.confidence >= 0.7)
    const detectionsToUse = highConfidenceDetections.length >= 2 ? highConfidenceDetections : allDetections
    
    // Calculate average bounds
    const avgBounds: GripBounds = {
      minX: 0, minY: 0, maxX: 0, maxY: 0,
      x: 0, y: 0, width: 0, height: 0
    }
    
    for (const detection of detectionsToUse) {
      avgBounds.minX += detection.gripBounds.minX
      avgBounds.minY += detection.gripBounds.minY
      avgBounds.maxX += detection.gripBounds.maxX
      avgBounds.maxY += detection.gripBounds.maxY
    }
    
    const count = detectionsToUse.length
    avgBounds.minX = Math.round(avgBounds.minX / count)
    avgBounds.minY = Math.round(avgBounds.minY / count)
    avgBounds.maxX = Math.round(avgBounds.maxX / count)
    avgBounds.maxY = Math.round(avgBounds.maxY / count)
    
    // Final validation
    if (avgBounds.minY < 250) {
      console.warn('Consensus still detecting blade area, forcing to handle region')
      const height = avgBounds.maxY - avgBounds.minY
      avgBounds.minY = 350
      avgBounds.maxY = avgBounds.minY + height
    }
    
    // Calculate x, y, width, height from min/max values
    avgBounds.x = avgBounds.minX
    avgBounds.y = avgBounds.minY
    avgBounds.width = avgBounds.maxX - avgBounds.minX
    avgBounds.height = avgBounds.maxY - avgBounds.minY
    
    // Calculate average confidence
    const avgConfidence = detectionsToUse.reduce((sum, d) => sum + d.confidence, 0) / count
    
    // Get most common weapon type
    const weaponTypes = detectionsToUse.map(d => d.weaponType)
    const weaponType = weaponTypes.sort((a, b) => 
      weaponTypes.filter(t => t === a).length - weaponTypes.filter(t => t === b).length
    ).pop()
    
    console.log('Consensus result:', {
      bounds: avgBounds,
      confidence: avgConfidence,
      weaponType: weaponType,
      basedOn: `${count} detections`
    })
    
    return {
      gripBounds: avgBounds,
      confidence: avgConfidence,
      weaponType: weaponType,
      gripDescription: `Consensus from ${count} AI detections`
    }
  }
  
  private drawGripArea(canvas: HTMLCanvasElement, gripBounds: GripBounds): HTMLCanvasElement {
    // Create a copy of the canvas
    const annotatedCanvas = document.createElement('canvas')
    annotatedCanvas.width = canvas.width
    annotatedCanvas.height = canvas.height
    const ctx = annotatedCanvas.getContext('2d')!
    
    // Copy original image
    ctx.drawImage(canvas, 0, 0)
    
    // Draw red box
    ctx.strokeStyle = '#FF0000'
    ctx.lineWidth = 3
    ctx.strokeRect(
      gripBounds.minX,
      gripBounds.minY,
      gripBounds.maxX - gripBounds.minX,
      gripBounds.maxY - gripBounds.minY
    )
    
    // Draw center point
    const centerX = (gripBounds.minX + gripBounds.maxX) / 2
    const centerY = (gripBounds.minY + gripBounds.maxY) / 2
    ctx.fillStyle = '#FF0000'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2)
    ctx.fill()
    
    return annotatedCanvas
  }
  
  private backProjectTo3D(
    redBoxBounds: RedPixelBounds,
    model: Object3D
  ): Vector3[] {
    console.log('🎯 Starting back-projection with bounds:', redBoxBounds)
    
    const vertices: Vector3[] = []
    const raycaster = new Raycaster()
    
    // Ensure the model and all its children are updated
    model.updateMatrixWorld(true)
    
    // Force update camera matrices
    this.camera.updateMatrixWorld(true)
    this.camera.updateProjectionMatrix()
    
    // Get all meshes in the model
    const meshes: Mesh[] = []
    model.traverse((child) => {
      if (child instanceof Mesh) {
        child.updateMatrixWorld(true)
        meshes.push(child)
      }
    })
    
    console.log(`Found ${meshes.length} meshes in model`)
    
    // Debug: Check mesh bounds
    if (meshes.length > 0) {
      const meshBounds = new Box3().setFromObject(meshes[0])
      console.log('First mesh bounds:', {
        min: { x: meshBounds.min.x, y: meshBounds.min.y, z: meshBounds.min.z },
        max: { x: meshBounds.max.x, y: meshBounds.max.y, z: meshBounds.max.z }
      })
      
      // Debug camera position and direction
      console.log('Camera position:', {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      })
      
      // Test direct ray from camera to mesh center
      const meshCenter = new Vector3()
      meshBounds.getCenter(meshCenter)
      console.log('Mesh center:', { x: meshCenter.x, y: meshCenter.y, z: meshCenter.z })
      
      // Shoot a test ray directly at mesh center
      const testRaycaster = new Raycaster()
      const rayOrigin = this.camera.position.clone()
      const rayDir = meshCenter.clone().sub(rayOrigin).normalize()
      
      testRaycaster.set(rayOrigin, rayDir)
      const testIntersects = testRaycaster.intersectObjects(meshes, true)
      console.log(`Test ray from camera to mesh center: ${testIntersects.length} hits`)
      
      if (testIntersects.length > 0) {
        console.log('Test hit at:', testIntersects[0].point)
      }
    }
    
    // Sample points within the red box bounds
    const sampleCount = 30 // Increase sample density
    let hitCount = 0
    
    // Use weighted sampling - more samples in the center
    for (let i = 0; i <= sampleCount; i++) {
      for (let j = 0; j <= sampleCount; j++) {
        // Convert normalized coordinates to screen space
        const u = i / sampleCount
        const v = j / sampleCount
        
        // Add slight bias towards center for better consistency
        const centerBias = 0.8
        const uBiased = 0.5 + (u - 0.5) * centerBias
        const vBiased = 0.5 + (v - 0.5) * centerBias
        
        // Calculate screen coordinates within the red box
        const screenX = redBoxBounds.minX + (redBoxBounds.maxX - redBoxBounds.minX) * uBiased
        const screenY = redBoxBounds.minY + (redBoxBounds.maxY - redBoxBounds.minY) * vBiased
        
        // Convert to NDC (-1 to 1)
        const ndcX = (screenX * 2) - 1
        const ndcY = 1 - (screenY * 2) // Flip Y
        
        // Use Three.js built-in method which handles orthographic cameras correctly
        raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.camera)
        
        // Find intersections with all meshes
        const intersects = raycaster.intersectObjects(meshes, true)
        
        if (intersects.length > 0) {
          // Add the first intersection point
          const point = intersects[0].point.clone()
          vertices.push(point)
          hitCount++
          
          // Debug first few hits
          if (hitCount <= 3) {
            console.log(`Hit ${hitCount} at screen (${screenX.toFixed(3)}, ${screenY.toFixed(3)}) -> world (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`)
          }
        }
      }
    }
    
    console.log(`Back-projection found ${hitCount} hits out of ${(sampleCount + 1) * (sampleCount + 1)} samples`)
    
    // If we found some hits but not many, also sample the exact center
    if (vertices.length > 0 && vertices.length < 50) {
      const centerX = (redBoxBounds.minX + redBoxBounds.maxX) / 2
      const centerY = (redBoxBounds.minY + redBoxBounds.maxY) / 2
      
      const ndcX = (centerX * 2) - 1
      const ndcY = 1 - (centerY * 2)
      
      raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.camera)
      const centerIntersects = raycaster.intersectObjects(meshes, true)
      
      if (centerIntersects.length > 0) {
        // Add center point multiple times to give it more weight
        for (let i = 0; i < 5; i++) {
          vertices.push(centerIntersects[0].point.clone())
        }
        console.log('Added center point for stability:', centerIntersects[0].point)
      }
    }
    
    return vertices
  }
  
  private calculateGripCenter(vertices: Vector3[]): Vector3 {
    if (vertices.length === 0) {
      console.warn('No vertices found for grip center calculation')
      return new Vector3(0, 0, 0)
    }
    
    // First, calculate the initial center
    const initialCenter = new Vector3()
    for (const vertex of vertices) {
      initialCenter.add(vertex)
    }
    initialCenter.divideScalar(vertices.length)
    
    // Filter out outliers (points too far from the initial center)
    const maxDistance = 0.2 // Maximum distance from center in world units
    const filteredVertices = vertices.filter(vertex => {
      const distance = vertex.distanceTo(initialCenter)
      return distance <= maxDistance
    })
    
    // If we filtered out too many points, use all vertices
    const finalVertices = filteredVertices.length >= vertices.length * 0.3 
      ? filteredVertices 
      : vertices
    
    // Calculate the final center from filtered vertices
    const center = new Vector3()
    for (const vertex of finalVertices) {
      center.add(vertex)
    }
    center.divideScalar(finalVertices.length)
    
    // Round to 3 decimal places for consistency
    center.x = Math.round(center.x * 1000) / 1000
    center.y = Math.round(center.y * 1000) / 1000
    center.z = Math.round(center.z * 1000) / 1000
    
    console.log(`Grip center calculated from ${finalVertices.length} vertices (filtered from ${vertices.length})`)
    console.log(`Final grip center: (${center.x}, ${center.y}, ${center.z})`)
    
    return center
  }
  
  private renderMultipleAngles(model: Object3D): { angle: string, canvas: HTMLCanvasElement }[] {
    const angles = [
      { name: 'side', rotation: 0 },
      { name: 'front', rotation: Math.PI / 2 },
      { name: 'diagonal', rotation: Math.PI / 4 },
      { name: 'back', rotation: Math.PI }
    ]
    
    const results: { angle: string, canvas: HTMLCanvasElement }[] = []
    
    // Store original rotation
    const originalRotation = model.rotation.y
    
    for (const angle of angles) {
      // Rotate model
      model.rotation.y = angle.rotation
      model.updateMatrixWorld(true)
      
      // Render
      this.renderer.clear()
      this.renderer.render(this.scene, this.camera)
      
      // Create canvas
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(this.renderer.domElement, 0, 0)
      
      results.push({ angle: angle.name, canvas })
    }
    
    // Restore original rotation
    model.rotation.y = originalRotation
    model.updateMatrixWorld(true)
    
    return results
  }
  
  private detectSwordHandle(canvas: HTMLCanvasElement): { minY: number, maxY: number } | null {
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // Analyze weapon profile
    const widthProfile: number[] = []
    
    for (let y = 0; y < canvas.height; y++) {
      let leftX = -1
      let rightX = -1
      
      // Find edges
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        
        if (brightness > 40 && leftX === -1) {
          leftX = x
        }
        if (brightness > 40) {
          rightX = x
        }
      }
      
      widthProfile[y] = rightX - leftX
    }
    
    // Find the guard/crossguard (sudden width increase)
    let guardY = -1
    let maxWidthChange = 0
    
    for (let y = canvas.height * 0.2; y < canvas.height * 0.8; y++) {
      if (widthProfile[y] > 0 && widthProfile[y + 5] > 0) {
        const widthChange = widthProfile[y] - widthProfile[y + 5]
        if (widthChange > maxWidthChange && widthChange > widthProfile[y + 5] * 0.5) {
          maxWidthChange = widthChange
          guardY = y
        }
      }
    }
    
    if (guardY === -1) {
      // Try reverse search for guard
      for (let y = canvas.height * 0.8; y > canvas.height * 0.2; y--) {
        if (widthProfile[y] > 0 && widthProfile[y - 5] > 0) {
          const widthChange = widthProfile[y - 5] - widthProfile[y]
          if (widthChange > maxWidthChange && widthChange > widthProfile[y] * 0.5) {
            maxWidthChange = widthChange
            guardY = y - 5
          }
        }
      }
    }
    
    if (guardY !== -1) {
      console.log(`Found guard/crossguard at Y: ${guardY}`)
      
      // Handle is below the guard
      const handleStart = guardY + 10
      
      // Find where handle ends (pommel or significant width change)
      let handleEnd = handleStart + 80 // Default length
      
      for (let y = handleStart + 20; y < Math.min(handleStart + 120, canvas.height - 10); y++) {
        // Check for pommel (width increase at bottom)
        if (widthProfile[y] > widthProfile[handleStart] * 1.3) {
          handleEnd = y - 5
          break
        }
        // Check if we're reaching the bottom
        if (widthProfile[y] === 0) {
          handleEnd = y - 10
          break
        }
      }
      
      return { minY: handleStart, maxY: handleEnd }
    }
    
    return null
  }
  
  private async detectWeaponOrientation(canvas: HTMLCanvasElement): Promise<boolean> {
    // Ask AI which end is which
    const base64Image = canvas.toDataURL('image/png')
    
    try {
      const response = await apiFetch('/api/weapon-orientation-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      })
      
      if (!response.ok) {
        console.warn('Orientation detection failed, using fallback')
        // Fallback: analyze brightness gradient
        return this.fallbackOrientationCheck(canvas)
      }
      
      const data = await response.json()
      if (data?.success && data?.needsFlip) {
        console.log('AI detected weapon needs flipping:', data.reason ?? 'No reason provided')
        return true
      }
      
      return false
    } catch (error) {
      console.error('Orientation detection error:', error)
      // Use fallback method
      return this.fallbackOrientationCheck(canvas)
    }
  }
  
  private fallbackOrientationCheck(canvas: HTMLCanvasElement): boolean {
    // Simple check: weapons usually have handle at bottom (darker/narrower)
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // Calculate average brightness for top and bottom thirds
    let topBrightness = 0
    let bottomBrightness = 0
    let topCount = 0
    let bottomCount = 0
    
    const oneThird = Math.floor(canvas.height / 3)
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        
        if (brightness > 30) { // Only count non-background pixels
          if (y < oneThird) {
            topBrightness += brightness
            topCount++
          } else if (y > canvas.height - oneThird) {
            bottomBrightness += brightness
            bottomCount++
          }
        }
      }
    }
    
    if (topCount > 0 && bottomCount > 0) {
      topBrightness /= topCount
      bottomBrightness /= bottomCount
      
      // If bottom is significantly brighter (like a shiny blade), flip it
      if (bottomBrightness > topBrightness * 1.3) {
        console.log('Fallback: Bottom appears brighter, likely blade - flipping')
        return true
      }
    }
    
    return false
  }
  
  // Cleanup method
  dispose(): void {
    // Clean up Three.js resources with comprehensive texture disposal
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        if (object.geometry) {
          object.geometry.dispose()
        }
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

    // Clear the scene
    while(this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0])
    }

    this.renderer.dispose()
  }

  /**
   * Dispose of Three.js resources
   */
  private disposeModel(object: Object3D): void {
    object.traverse((child) => {
      if (child instanceof Mesh) {
        if (child.geometry) {
          child.geometry.dispose()
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    })
  }
} 