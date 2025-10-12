/**
 * Model Cache System
 * 
 * Loads 3D models once and caches them for reuse across multiple entity instances.
 * This prevents loading the same GLB file hundreds of times for items/mobs.
 */

import THREE from '../extras/three';

interface CachedModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  loadedAt: number;
  cloneCount: number;
}

export class ModelCache {
  private static instance: ModelCache;
  private cache = new Map<string, CachedModel>();
  private loading = new Map<string, Promise<CachedModel>>();
  
  private constructor() {}
  
  static getInstance(): ModelCache {
    if (!ModelCache.instance) {
      ModelCache.instance = new ModelCache();
    }
    return ModelCache.instance;
  }
  
  /**
   * Load a model (with caching)
   * Returns a cloned scene ready to use
   */
  async loadModel(
    path: string,
    gltfLoader: { loadAsync: (url: string) => Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> }
  ): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[]; fromCache: boolean }> {
    
    // Check cache first
    const cached = this.cache.get(path);
    if (cached) {
      console.log(`[ModelCache] ♻️  Using cached model: ${path} (clone #${cached.cloneCount + 1})`);
      cached.cloneCount++;
      
      // Clone the scene for this instance
      const clonedScene = cached.scene.clone(true);
      
      return {
        scene: clonedScene,
        animations: cached.animations,
        fromCache: true
      };
    }
    
    // Check if already loading
    const loadingPromise = this.loading.get(path);
    if (loadingPromise) {
      console.log(`[ModelCache] ⏳ Waiting for in-progress load: ${path}`);
      const result = await loadingPromise;
      result.cloneCount++;
      return {
        scene: result.scene.clone(true),
        animations: result.animations,
        fromCache: true
      };
    }
    
    // Load for the first time
    console.log(`[ModelCache] 📥 Loading new model: ${path}`);
    
    const promise = gltfLoader.loadAsync(path).then(gltf => {
      const cachedModel: CachedModel = {
        scene: gltf.scene,
        animations: gltf.animations,
        loadedAt: Date.now(),
        cloneCount: 0
      };
      
      this.cache.set(path, cachedModel);
      this.loading.delete(path);
      
      console.log(`[ModelCache] ✅ Cached model: ${path}`, {
        meshCount: this.countMeshes(gltf.scene),
        animations: gltf.animations.length
      });
      
      return cachedModel;
    }).catch(error => {
      this.loading.delete(path);
      throw error;
    });
    
    this.loading.set(path, promise);
    const result = await promise;
    result.cloneCount++;
    
    return {
      scene: result.scene.clone(true),
      animations: result.animations,
      fromCache: false
    };
  }
  
  /**
   * Check if a model is cached
   */
  has(path: string): boolean {
    return this.cache.has(path);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { total: number; paths: string[]; totalClones: number } {
    const paths: string[] = [];
    let totalClones = 0;
    
    for (const [path, model] of this.cache.entries()) {
      paths.push(path);
      totalClones += model.cloneCount;
    }
    
    return {
      total: this.cache.size,
      paths,
      totalClones
    };
  }
  
  /**
   * Clear the cache (useful for hot reload)
   */
  clear(): void {
    console.log(`[ModelCache] Clearing cache of ${this.cache.size} models`);
    this.cache.clear();
    this.loading.clear();
  }
  
  /**
   * Remove a specific model from cache
   */
  remove(path: string): boolean {
    return this.cache.delete(path);
  }
  
  /**
   * Count meshes in a scene
   */
  private countMeshes(scene: THREE.Object3D): number {
    let count = 0;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
        count++;
      }
    });
    return count;
  }
}

// Export singleton instance
export const modelCache = ModelCache.getInstance();

