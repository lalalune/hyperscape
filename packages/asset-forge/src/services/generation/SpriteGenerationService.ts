/**
 * Sprite Generation Service
 * Renders 2D sprites from 3D models at various angles
 * Uses WebGPU renderer for optimal performance
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  THREE,
  createWebGPURenderer,
  type HyperForgeRenderer,
} from "../../utils/webgpu-renderer";

export interface SpriteGenerationOptions {
  modelPath: string;
  outputSize?: number;
  angles?: number[];
  backgroundColor?: string;
  padding?: number;
}

export interface SpriteResult {
  angle: string;
  imageUrl: string;
  width: number;
  height: number;
}

export class SpriteGenerationService {
  private renderer: HyperForgeRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private loader: GLTFLoader;
  private initialized: boolean = false;

  constructor() {
    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    const aspect = 1;
    const frustumSize = 5;
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    this.scene.add(directionalLight);

    // Create loader
    this.loader = new GLTFLoader();
  }

  /**
   * Initialize the WebGPU renderer (must be called before generating sprites)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    this.renderer = await createWebGPURenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(512, 512);

    this.initialized = true;
  }

  /**
   * Ensure the renderer is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Generate sprites from a 3D model
   */
  async generateSprites(
    options: SpriteGenerationOptions,
  ): Promise<SpriteResult[]> {
    await this.ensureInitialized();

    if (!this.renderer) {
      throw new Error("Renderer not initialized");
    }

    const {
      modelPath,
      outputSize = 256,
      angles = [0, 45, 90, 135, 180, 225, 270, 315],
      backgroundColor = "transparent",
      padding = 0.1,
    } = options;

    // Update renderer size
    this.renderer.setSize(outputSize, outputSize);

    // Set background via scene.background for WebGPU
    if (backgroundColor === "transparent") {
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(backgroundColor);
    }

    // Load model
    const gltf = await this.loadModel(modelPath);
    const model = gltf.scene;

    // Center and scale model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Move model to origin
    model.position.sub(center);

    // Scale to fit in view with padding
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale =
      ((this.camera.right - this.camera.left) * (1 - padding)) / maxDim;
    model.scale.multiplyScalar(scale);

    // Add model to scene
    this.scene.add(model);

    // Generate sprites for each angle
    const sprites: SpriteResult[] = [];

    for (const angle of angles) {
      // Rotate camera around Y axis
      const radian = (angle * Math.PI) / 180;
      const distance = 7;
      this.camera.position.x = Math.sin(radian) * distance;
      this.camera.position.z = Math.cos(radian) * distance;
      this.camera.position.y = 5;
      this.camera.lookAt(0, 0, 0);

      // Render
      this.renderer.render(this.scene, this.camera);

      // Get image data
      const imageUrl = this.renderer.domElement.toDataURL("image/png");

      sprites.push({
        angle: `${angle}deg`,
        imageUrl,
        width: outputSize,
        height: outputSize,
      });
    }

    // Clean up
    this.scene.remove(model);

    return sprites;
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
        (error) =>
          reject(error instanceof Error ? error : new Error(String(error))),
      );
    });
  }

  /**
   * Generate isometric sprites (8 directions)
   */
  async generateIsometricSprites(
    modelPath: string,
    outputSize: number = 128,
  ): Promise<SpriteResult[]> {
    // Set isometric camera
    const angle = Math.PI / 6; // 30 degrees
    this.camera.position.set(5, 5 * Math.tan(angle), 5);
    this.camera.lookAt(0, 0, 0);

    return this.generateSprites({
      modelPath,
      outputSize,
      angles: [0, 45, 90, 135, 180, 225, 270, 315],
      backgroundColor: "transparent",
    });
  }

  /**
   * Generate character sprites with multiple poses
   */
  async generateCharacterSprites(
    modelPath: string,
    _animations?: string[],
    outputSize: number = 256,
  ): Promise<Record<string, SpriteResult[]>> {
    // TODO: Implement animation frame extraction
    // For now, just return idle poses
    const idleSprites = await this.generateSprites({
      modelPath,
      outputSize,
      angles: [0, 90, 180, 270], // Front, right, back, left
      backgroundColor: "transparent",
    });

    return {
      idle: idleSprites,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.initialized = false;
  }
}

// Export factory function for creating initialized instance
export async function createSpriteGenerator(): Promise<SpriteGenerationService> {
  const service = new SpriteGenerationService();
  await service.init();
  return service;
}

// Export singleton instance (lazy initialization)
let _spriteGeneratorInstance: SpriteGenerationService | null = null;
export async function getSpriteGenerator(): Promise<SpriteGenerationService> {
  if (!_spriteGeneratorInstance) {
    _spriteGeneratorInstance = await createSpriteGenerator();
  }
  return _spriteGeneratorInstance;
}

// For backwards compatibility - but callers should use getSpriteGenerator() instead
export const spriteGenerator = new SpriteGenerationService();
