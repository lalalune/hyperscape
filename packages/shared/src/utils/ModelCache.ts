/**
 * Model Cache System
 * 
 * Loads 3D models once and caches them for reuse across multiple entity instances.
 * This prevents loading the same GLB file hundreds of times for items/mobs.
 */

import THREE from '../extras/three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { World } from '../World';

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
  private gltfLoader: GLTFLoader;
  
  private constructor() {
    // Use our own GLTFLoader to ensure we get pure THREE.Object3D (not Hyperscape Nodes)
    this.gltfLoader = new GLTFLoader();
  }
  
  static getInstance(): ModelCache {
    if (!ModelCache.instance) {
      ModelCache.instance = new ModelCache();
    }
    return ModelCache.instance;
  }
  
  /**
   * Load a model (with caching)
   * Returns a cloned scene ready to use
   * 
   * NOTE: This returns pure THREE.Object3D, NOT Hyperscape Nodes!
   * Use world.loader.load('model', url) if you need Hyperscape Nodes.
   * 
   * @param path - Model path (can be asset:// URL or absolute URL)
   * @param world - World instance for URL resolution (resolves asset:// protocol)
   */
  async loadModel(
    path: string,
    world?: World
  ): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[]; fromCache: boolean }> {
    
    // Resolve asset:// URLs to actual URLs
    let resolvedPath = world ? world.resolveURL(path) : path;
    
    // CRITICAL: If resolveURL failed (returned asset:// unchanged), manually resolve
    if (resolvedPath.startsWith('asset://')) {
      // Fallback: Use CDN URL from window or default to localhost
      const cdnUrl = (typeof window !== 'undefined' && (window as Window & { __CDN_URL?: string }).__CDN_URL)
        || (world?.assetsUrl?.replace(/\/$/, ''))
        || 'http://localhost:8080';
      resolvedPath = resolvedPath.replace('asset://', `${cdnUrl}/`);
      console.log(`[ModelCache] Manual URL resolution: ${path} → ${resolvedPath}`);
    }
    
    // Check cache first (use resolved path as key)
    const cached = this.cache.get(resolvedPath);
    if (cached) {
      console.log(`[ModelCache] ♻️  Using cached model: ${path} (clone #${cached.cloneCount + 1})`);
      
      // CRITICAL: Verify cached scene is pure THREE.Object3D
      if ('ctx' in cached.scene || 'isDirty' in cached.scene) {
        console.error('[ModelCache] Cached model is a Hyperscape Node, not THREE.Object3D! Clearing cache...');
        this.cache.delete(resolvedPath);
        // Retry load with fresh GLTFLoader
        return this.loadModel(path, world);
      }
      
      cached.cloneCount++;
      
      // Clone the scene for this instance
      const clonedScene = cached.scene.clone(true);
      
      return {
        scene: clonedScene,
        animations: cached.animations,
        fromCache: true
      };
    }
    
    // Check if already loading (use resolved path as key)
    const loadingPromise = this.loading.get(resolvedPath);
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
    console.log(`[ModelCache] 📥 Loading new model: ${path} (resolved: ${resolvedPath})`);
    
    // Use our own GLTFLoader to ensure pure THREE.js objects (not Hyperscape Nodes)
    const promise = this.gltfLoader.loadAsync(resolvedPath).then(gltf => {
      // CRITICAL: Verify we got a pure THREE.Object3D, not a Hyperscape Node
      if ('ctx' in gltf.scene || 'isDirty' in gltf.scene) {
        console.error('[ModelCache] ERROR: GLTFLoader returned Hyperscape Node instead of THREE.Object3D!');
        console.error('[ModelCache] Scene type:', gltf.scene.constructor.name);
        throw new Error('ModelCache received Hyperscape Node - this indicates a loader system conflict');
      }
      
      const cachedModel: CachedModel = {
        scene: gltf.scene,
        animations: gltf.animations,
        loadedAt: Date.now(),
        cloneCount: 0
      };
      
      this.cache.set(resolvedPath, cachedModel);
      this.loading.delete(resolvedPath);
      
      console.log(`[ModelCache] ✅ Cached model: ${path}`, {
        meshCount: this.countMeshes(gltf.scene),
        animations: gltf.animations.length,
        sceneType: gltf.scene.constructor.name
      });
      
      return cachedModel;
    }).catch(error => {
      this.loading.delete(resolvedPath);
      throw error;
    });
    
    this.loading.set(resolvedPath, promise);
    const result = await promise;
    result.cloneCount++;
    
    const clonedScene = result.scene.clone(true);
    
    // FINAL VALIDATION: Ensure we're returning pure THREE.Object3D
    if ('ctx' in clonedScene || 'isDirty' in clonedScene) {
      console.error('[ModelCache] CRITICAL: Cloned scene is a Hyperscape Node!');
      console.error('[ModelCache] This should never happen. Scene type:', clonedScene.constructor.name);
      throw new Error('ModelCache clone produced Hyperscape Node instead of THREE.Object3D');
    }
    
    return {
      scene: clonedScene,
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
   * Should be called when code is rebuilt to prevent stale Hyperscape Nodes
   */
  clear(): void {
    console.log(`[ModelCache] Clearing cache of ${this.cache.size} models`);
    this.cache.clear();
    this.loading.clear();
  }
  
  /**
   * Clear cache and verify all entries are pure THREE.Object3D
   * Call this on world initialization to ensure clean state
   */
  resetAndVerify(): void {
    console.log('[ModelCache] Resetting cache to ensure pure THREE.Object3D loading');
    this.clear();
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

