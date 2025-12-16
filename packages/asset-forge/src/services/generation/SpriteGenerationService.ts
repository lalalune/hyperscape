/**
 * Sprite Generation Service
 * Renders 2D sprites from 3D models at various angles
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

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
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private loader: GLTFLoader;

  constructor() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(512, 512);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
   * Generate sprites from a 3D model
   */
  async generateSprites(
    options: SpriteGenerationOptions,
  ): Promise<SpriteResult[]> {
    const {
      modelPath,
      outputSize = 256,
      angles = [0, 45, 90, 135, 180, 225, 270, 315],
      backgroundColor = "transparent",
      padding = 0.1,
    } = options;

    // Update renderer size
    this.renderer.setSize(outputSize, outputSize);

    // Set background
    if (backgroundColor === "transparent") {
      this.renderer.setClearColor(0x000000, 0);
    } else {
      this.renderer.setClearColor(backgroundColor);
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
    animations?: string[],
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
    this.renderer.dispose();
  }
}

// Export singleton instance
export const spriteGenerator = new SpriteGenerationService();
