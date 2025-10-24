/**
 * Sprite Generation Service
 * Renders 2D sprites from 3D models at various angles
 */

import {
  AmbientLight, Box3, DirectionalLight, Mesh, OrthographicCamera, PCFSoftShadowMap, Scene, SkinnedMesh,
  Texture, Vector3, WebGLRenderer
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  CANVAS_SIZE_LARGE,
  DEFAULT_SPRITE_SIZE,
  DEFAULT_PADDING,
  AMBIENT_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_INTENSITY,
  CAMERA_NEAR_CLIP,
  CAMERA_FAR_CLIP,
  SHADOW_CAMERA_FAR,
  SHADOW_CAMERA_BOUNDS,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_CAMERA_Y_POSITION,
  ISOMETRIC_CAMERA_DISTANCE,
  FRUSTUM_SIZE,
  ISOMETRIC_ANGLE,
  SPRITE_ANGLES_8_DIR,
  SPRITE_ANGLES_4_DIR,
  CANVAS_SIZE_SMALL
} from '@/constants/dimensions'

export interface SpriteGenerationOptions {
  modelPath: string
  outputSize?: number
  angles?: number[]
  backgroundColor?: string
  padding?: number
}

export interface SpriteResult {
  angle: string
  imageUrl: string
  width: number
  height: number
}

export class SpriteGenerationService {
  private renderer: WebGLRenderer
  private scene: Scene
  private camera: OrthographicCamera
  private loader: GLTFLoader
  
  constructor() {
    // Create renderer
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(CANVAS_SIZE_LARGE, CANVAS_SIZE_LARGE)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap

    // Create scene
    this.scene = new Scene()

    // Create camera
    const aspect = 1
    this.camera = new OrthographicCamera(
      FRUSTUM_SIZE * aspect / -2,
      FRUSTUM_SIZE * aspect / 2,
      FRUSTUM_SIZE / 2,
      FRUSTUM_SIZE / -2,
      CAMERA_NEAR_CLIP,
      CAMERA_FAR_CLIP
    )
    this.camera.position.set(DEFAULT_CAMERA_DISTANCE, DEFAULT_CAMERA_DISTANCE, DEFAULT_CAMERA_DISTANCE)
    this.camera.lookAt(0, 0, 0)

    // Add lights
    const ambientLight = new AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY)
    this.scene.add(ambientLight)

    const directionalLight = new DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_INTENSITY)
    directionalLight.position.set(DEFAULT_CAMERA_DISTANCE, 10, DEFAULT_CAMERA_DISTANCE)
    directionalLight.castShadow = true
    directionalLight.shadow.camera.near = CAMERA_NEAR_CLIP
    directionalLight.shadow.camera.far = SHADOW_CAMERA_FAR
    directionalLight.shadow.camera.left = -SHADOW_CAMERA_BOUNDS
    directionalLight.shadow.camera.right = SHADOW_CAMERA_BOUNDS
    directionalLight.shadow.camera.top = SHADOW_CAMERA_BOUNDS
    directionalLight.shadow.camera.bottom = -SHADOW_CAMERA_BOUNDS
    this.scene.add(directionalLight)
    
    // Create loader
    this.loader = new GLTFLoader()
  }
  
  /**
   * Generate sprites from a 3D model
   */
  async generateSprites(options: SpriteGenerationOptions): Promise<SpriteResult[]> {
    const {
      modelPath,
      outputSize = DEFAULT_SPRITE_SIZE,
      angles = SPRITE_ANGLES_8_DIR,
      backgroundColor = 'transparent',
      padding = DEFAULT_PADDING
    } = options
    
    // Update renderer size
    this.renderer.setSize(outputSize, outputSize)
    
    // Set background
    if (backgroundColor === 'transparent') {
      this.renderer.setClearColor(0x000000, 0)
    } else {
      this.renderer.setClearColor(backgroundColor)
    }
    
    // Load model
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    // Center and scale model
    const box = new Box3().setFromObject(model)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    
    // Move model to origin
    model.position.sub(center)
    
    // Scale to fit in view with padding
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = (this.camera.right - this.camera.left) * (1 - padding) / maxDim
    model.scale.multiplyScalar(scale)
    
    // Add model to scene
    this.scene.add(model)
    
    // Generate sprites for each angle
    const sprites: SpriteResult[] = []
    
    for (const angle of angles) {
      // Rotate camera around Y axis
      const radian = (angle * Math.PI) / 180
      this.camera.position.x = Math.sin(radian) * ISOMETRIC_CAMERA_DISTANCE
      this.camera.position.z = Math.cos(radian) * ISOMETRIC_CAMERA_DISTANCE
      this.camera.position.y = DEFAULT_CAMERA_Y_POSITION
      this.camera.lookAt(0, 0, 0)
      
      // Render
      this.renderer.render(this.scene, this.camera)
      
      // Get image data
      const imageUrl = this.renderer.domElement.toDataURL('image/png')
      
      sprites.push({
        angle: `${angle}deg`,
        imageUrl,
        width: outputSize,
        height: outputSize
      })
    }
    
    // Clean up
    this.scene.remove(model)
    
    return sprites
  }
  
  /**
   * Load GLTF model
   */
  private loadModel(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf: GLTF) => resolve(gltf),
        undefined,
        (error) => reject(error instanceof Error ? error : new Error(String(error)))
      )
    })
  }
  
  /**
   * Generate isometric sprites (8 directions)
   */
  async generateIsometricSprites(
    modelPath: string,
    outputSize: number = CANVAS_SIZE_SMALL
  ): Promise<SpriteResult[]> {
    // Set isometric camera
    this.camera.position.set(DEFAULT_CAMERA_DISTANCE, DEFAULT_CAMERA_DISTANCE * Math.tan(ISOMETRIC_ANGLE), DEFAULT_CAMERA_DISTANCE)
    this.camera.lookAt(0, 0, 0)

    return this.generateSprites({
      modelPath,
      outputSize,
      angles: SPRITE_ANGLES_8_DIR,
      backgroundColor: 'transparent'
    })
  }
  
  /**
   * Generate character sprites with multiple poses
   */
  async generateCharacterSprites(
    modelPath: string,
//     animations?: string[],
    outputSize: number = DEFAULT_SPRITE_SIZE
  ): Promise<Record<string, SpriteResult[]>> {
    // GitHub Issue #8: Implement animation frame extraction for sprite generation
    // For now, just return idle poses
    const idleSprites = await this.generateSprites({
      modelPath,
      outputSize,
      angles: SPRITE_ANGLES_4_DIR,
      backgroundColor: 'transparent'
    })

    return {
      idle: idleSprites
    }
  }
  
  /**
   * Cleanup resources
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
  }
}

// Export singleton instance
export const spriteGenerator = new SpriteGenerationService() 