/**
 * Three.js Resource Manager
 * Provides safe and comprehensive cleanup of Three.js resources to prevent memory leaks
 */

import { THREE } from '@hyperscape/shared';

export class ThreeResourceManager {
  private static disposedObjects = new WeakSet();

  /**
   * Safely dispose of a Three.js object and all its children
   * @param object The Three.js object to dispose
   * @param options Disposal options
   */
  static disposeObject(object: THREE.Object3D, options: {
    disposeGeometry?: boolean;
    disposeMaterial?: boolean;
    disposeTextures?: boolean;
    removeFromParent?: boolean;
  } = {}): void {
    const {
      disposeGeometry = true,
      disposeMaterial = true,
      disposeTextures = true,
      removeFromParent = true
    } = options;

    // Prevent double disposal
    if (this.disposedObjects.has(object)) {
      console.warn('[ThreeResourceManager] Object already disposed:', object);
      return;
    }

    // Traverse all children and dispose recursively
    object.traverse((child) => {
      this.disposeObjectInternal(child as THREE.Object3D, {
        disposeGeometry,
        disposeMaterial,
        disposeTextures
      });
    });

    // Remove from parent if requested
    if (removeFromParent && object.parent) {
      object.parent.remove(object);
    }

    // Mark as disposed
    this.disposedObjects.add(object);

    console.log(`[ThreeResourceManager] Disposed object and ${object.children.length} children`);
  }

  /**
   * Internal disposal logic for individual objects
   */
  private static disposeObjectInternal(object: THREE.Object3D, options: {
    disposeGeometry: boolean;
    disposeMaterial: boolean;
    disposeTextures: boolean;
  }): void {
    const { disposeGeometry, disposeMaterial, disposeTextures } = options;

    // Handle mesh objects
    if (object instanceof THREE.Mesh) {
      // Dispose geometry
      if (disposeGeometry && object.geometry && !this.disposedObjects.has(object.geometry)) {
        object.geometry.dispose();
        this.disposedObjects.add(object.geometry);
      }

      // Dispose materials
      if (disposeMaterial && object.material) {
        this.disposeMaterial(object.material, disposeTextures);
      }
    }

    // Handle lights
    if (object instanceof THREE.Light) {
      // Some lights have shadow cameras that need disposal
      if ('shadow' in object && object.shadow) {
        if (object.shadow.map) {
          object.shadow.map.dispose();
        }
        // Clean up shadow cameras
        if (object.shadow.camera) {
          object.shadow.camera = null;
        }
      }
    }

    // Handle cameras with render targets
    if (object instanceof THREE.Camera) {
      // Cameras themselves don't need disposal, but any attached render targets do
      // This is handled elsewhere, but we clear references
      object.clear();
    }

    // Clear any custom userData that might hold references
    if (object.userData) {
      Object.keys(object.userData).forEach(key => {
        delete object.userData[key];
      });
    }
  }

  /**
   * Dispose of materials safely
   */
  private static disposeMaterial(material: THREE.Material | THREE.Material[], disposeTextures: boolean): void {
    const materials = Array.isArray(material) ? material : [material];

    materials.forEach(mat => {
      if (this.disposedObjects.has(mat)) {
        return;
      }

      // Dispose textures if requested
      if (disposeTextures) {
        this.disposeMaterialTextures(mat);
      }

      // Dispose the material itself
      mat.dispose();
      this.disposedObjects.add(mat);
    });
  }

  /**
   * Dispose of all textures in a material
   */
  private static disposeMaterialTextures(material: THREE.Material): void {
    const textureProperties = [
      'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 
      'envMap', 'alphaMap', 'emissiveMap', 'displacementMap', 
      'roughnessMap', 'metalnessMap', 'aoMap', 'clearcoatMap',
      'clearcoatRoughnessMap', 'clearcoatNormalMap', 'transmissionMap'
    ];

    textureProperties.forEach(prop => {
      // Access texture properties dynamically
      const texture = material[prop] as THREE.Texture | undefined;
      if (texture && texture instanceof THREE.Texture && !this.disposedObjects.has(texture)) {
        texture.dispose();
        this.disposedObjects.add(texture);
      }
    });
  }

  /**
   * Dispose of a renderer and its resources
   */
  static disposeRenderer(renderer: THREE.WebGLRenderer): void {
    // Dispose of render targets
    renderer.dispose();

    // Clear the context if possible
    const gl = renderer.getContext();
    if (gl && 'getExtension' in gl) {
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
  }

  /**
   * Dispose of a scene and all its contents
   */
  static disposeScene(scene: THREE.Scene, options: {
    disposeGeometry?: boolean;
    disposeMaterial?: boolean;
    disposeTextures?: boolean;
  } = {}): void {
    // Clone children array since we'll be modifying it
    const children = [...scene.children];
    
    children.forEach(child => {
      this.disposeObject(child as THREE.Object3D, {
        ...options,
        removeFromParent: true
      });
    });

    // Clear the scene
    scene.clear();
    
      }

  /**
   * Get memory usage information (if available)
   */
  static getMemoryInfo(): { geometries: number; textures: number; programs: number } {
    const renderer = new THREE.WebGLRenderer();
    const info = renderer.info;
    renderer.dispose();
    
    return {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length || 0
    };
  }

  /**
   * Force garbage collection of disposed objects (development helper)
   */
  static forceCleanup(): void {
    // Call garbage collection if available
    if (window.gc) {
      window.gc();
    }
      }
}

/**
 * Hook for React components to ensure proper cleanup
 */
export function useThreeCleanup() {
  const cleanupFunctions = new Set<() => void>();

  const addCleanup = (cleanupFn: () => void) => {
    cleanupFunctions.add(cleanupFn);
  };

  const cleanup = () => {
    cleanupFunctions.forEach(fn => {
      fn();
    });
    cleanupFunctions.clear();
  };

  return { addCleanup, cleanup };
}