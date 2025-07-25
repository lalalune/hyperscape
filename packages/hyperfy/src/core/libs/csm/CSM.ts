import * as THREE from '../../extras/three';

export interface CSMOptions {
  mode?: string;
  maxCascades?: number;
  maxFar?: number;
  lightDirection?: THREE.Vector3;
  fade?: boolean;
  parent?: THREE.Scene;
  camera?: THREE.Camera;
  cascades?: number;
  shadowMapSize?: number;
  castShadow?: boolean;
  lightIntensity?: number;
  shadowBias?: number;
  shadowNormalBias?: number;
  lightNear?: number;
  lightFar?: number;
  lightMargin?: number;
  noLastCascadeCutOff?: boolean;
}

/**
 * Cascaded Shadow Maps (CSM) Implementation
 * 
 * A simplified CSM implementation for Hyperfy that provides
 * basic shadow mapping functionality.
 */
export class CSM {
  public lightDirection: THREE.Vector3;
  public lights: THREE.DirectionalLight[] = [];
  
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private options: CSMOptions;
  private shadowCascades: number;
  private shadowMapSize: number;

  constructor(options: CSMOptions) {
    this.options = options;
    this.scene = options.parent || new THREE.Scene();
    this.camera = options.camera || new THREE.PerspectiveCamera();
    this.lightDirection = options.lightDirection || new THREE.Vector3(0, -1, 0);
    this.shadowCascades = options.cascades || 3;
    this.shadowMapSize = options.shadowMapSize || 2048;
    
    this.initializeLights();
  }

  private initializeLights(): void {
    // Create directional lights for shadow cascades
    for (let i = 0; i < this.shadowCascades; i++) {
      const light = new THREE.DirectionalLight(0xffffff, this.options.lightIntensity || 1);
      
      // Configure shadow properties
      light.castShadow = this.options.castShadow ?? true;
      light.shadow.mapSize.width = this.shadowMapSize;
      light.shadow.mapSize.height = this.shadowMapSize;
      light.shadow.camera.near = this.options.lightNear || 0.1;
      light.shadow.camera.far = this.options.lightFar || 100;
      light.shadow.bias = this.options.shadowBias || -0.0001;
      light.shadow.normalBias = this.options.shadowNormalBias || 0.001;
      
      // Set light direction
      light.position.copy(this.lightDirection).multiplyScalar(-50);
      light.target.position.set(0, 0, 0);
      
      // Configure shadow camera
      const d = 50;
      light.shadow.camera.left = -d;
      light.shadow.camera.right = d;
      light.shadow.camera.top = d;
      light.shadow.camera.bottom = -d;
      
      this.lights.push(light);
      
      if (this.scene) {
        this.scene.add(light);
        this.scene.add(light.target);
      }
    }
    
    console.log(`[CSM] Initialized ${this.lights.length} directional lights for shadow cascades`);
  }

  public update(): void {
    // Update light positions and shadow cameras
    for (const light of this.lights) {
      if (light.castShadow) {
        light.position.copy(this.lightDirection).multiplyScalar(-50);
        light.shadow.camera.updateProjectionMatrix();
      }
    }
  }

  public updateCascades(cascades: number): void {
    if (cascades === this.shadowCascades) return;
    
    // Remove existing lights
    this.dispose();
    
    // Update cascade count and recreate lights
    this.shadowCascades = cascades;
    this.lights = [];
    this.initializeLights();
    
    console.log(`[CSM] Updated to ${cascades} shadow cascades`);
  }

  public updateShadowMapSize(size: number): void {
    if (size === this.shadowMapSize) return;
    
    this.shadowMapSize = size;
    
    for (const light of this.lights) {
      light.shadow.mapSize.width = size;
      light.shadow.mapSize.height = size;
      
      // Force shadow map regeneration
      if (light.shadow.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    }
    
    console.log(`[CSM] Updated shadow map size to ${size}x${size}`);
  }

  public updateFrustums(): void {
    // Update shadow camera frustums based on main camera
    for (const light of this.lights) {
      light.shadow.camera.updateProjectionMatrix();
    }
  }

  public setupMaterial(material: THREE.Material): void {
    // This would normally set up CSM-specific shader uniforms
    // For now, just ensure the material can receive shadows
    (material as any).shadowSide = THREE.BackSide;
  }

  public dispose(): void {
    // Clean up lights and shadow maps
    for (const light of this.lights) {
      if (light.shadow.map) {
        light.shadow.map.dispose();
      }
      
      if (this.scene) {
        this.scene.remove(light);
        this.scene.remove(light.target);
      }
    }
    
    this.lights = [];
    console.log('[CSM] Disposed all shadow resources');
  }
}