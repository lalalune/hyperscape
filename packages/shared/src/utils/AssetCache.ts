/**
 * AssetCache.ts - Asset Caching & Batching System
 *
 * Provides centralized caching for all asset types with:
 * - Texture caching with LRU eviction
 * - Model caching (delegates to ModelCache)
 * - Audio buffer caching
 * - Geometry caching for reusable shapes
 * - Memory tracking and limits
 * - Batch loading with progress
 *
 * Usage:
 * ```ts
 * const cache = AssetCache.getInstance();
 *
 * // Load with caching
 * const texture = await cache.loadTexture('path/to/texture.png');
 * const model = await cache.loadModel('path/to/model.glb');
 * const audio = await cache.loadAudio('path/to/sound.mp3');
 *
 * // Batch load
 * await cache.batchLoad([
 *   { type: 'texture', url: 'tex1.png' },
 *   { type: 'model', url: 'model.glb' },
 * ], (progress) => console.log(progress));
 * ```
 */

import THREE from "../extras/three/three";
import { modelCache } from "./rendering/ModelCache";
import type { World } from "../core/World";

// Enable Three.js built-in caching
THREE.Cache.enabled = true;

/**
 * Cache entry with metadata for LRU eviction
 */
interface CacheEntry<T> {
  data: T;
  url: string;
  loadedAt: number;
  lastAccess: number;
  accessCount: number;
  estimatedSize: number; // bytes
}

/**
 * Batch load item
 */
interface BatchLoadItem {
  type: "texture" | "model" | "audio" | "geometry";
  url: string;
  priority?: number; // Higher = load first
}

/**
 * Cache statistics
 */
interface CacheStats {
  textures: { count: number; size: number; hits: number; misses: number };
  models: { count: number; clones: number };
  audio: { count: number; size: number };
  geometry: { count: number };
  totalMemory: number;
}

/**
 * AssetCache - Singleton for all asset caching
 */
export class AssetCache {
  private static instance: AssetCache;

  // Texture cache
  private textureCache = new Map<string, CacheEntry<THREE.Texture>>();
  private textureLoader = new THREE.TextureLoader();
  private textureLoading = new Map<string, Promise<THREE.Texture>>();
  private textureHits = 0;
  private textureMisses = 0;

  // Audio cache
  private audioCache = new Map<string, CacheEntry<AudioBuffer>>();
  private audioLoading = new Map<string, Promise<AudioBuffer>>();
  private audioContext?: AudioContext;

  // Geometry cache (for reusable shapes)
  private geometryCache = new Map<string, THREE.BufferGeometry>();

  // Config
  private maxTextureMemory = 256 * 1024 * 1024; // 256MB
  private maxAudioMemory = 64 * 1024 * 1024; // 64MB
  private maxTextures = 200;
  private maxAudioBuffers = 100;

  // World reference for URL resolution
  private world?: World;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AssetCache {
    if (!AssetCache.instance) {
      AssetCache.instance = new AssetCache();
    }
    return AssetCache.instance;
  }

  /**
   * Set world reference for URL resolution
   */
  setWorld(world: World): void {
    this.world = world;
  }

  /**
   * Resolve asset URL using world or CDN fallback
   */
  private resolveUrl(url: string): string {
    if (this.world) {
      return this.world.resolveURL(url);
    }

    // Fallback for asset:// URLs
    if (url.startsWith("asset://")) {
      const cdnUrl =
        typeof window !== "undefined"
          ? (window as unknown as { __CDN_URL?: string }).__CDN_URL ||
            "http://localhost:8080"
          : "http://localhost:8080";
      return url.replace("asset://", `${cdnUrl}/`);
    }

    return url;
  }

  // ============================================
  // TEXTURE CACHING
  // ============================================

  /**
   * Load a texture with caching
   */
  async loadTexture(
    url: string,
    options?: {
      wrapS?: THREE.Wrapping;
      wrapT?: THREE.Wrapping;
      magFilter?: THREE.TextureFilter;
      minFilter?: THREE.TextureFilter;
      colorSpace?: THREE.ColorSpace;
      flipY?: boolean;
    },
  ): Promise<THREE.Texture> {
    const resolvedUrl = this.resolveUrl(url);

    // Check cache
    const cached = this.textureCache.get(resolvedUrl);
    if (cached) {
      cached.lastAccess = Date.now();
      cached.accessCount++;
      this.textureHits++;
      return cached.data;
    }

    // Check if already loading
    const loading = this.textureLoading.get(resolvedUrl);
    if (loading) {
      this.textureHits++;
      return loading;
    }

    // Load new texture
    this.textureMisses++;
    const promise = this.textureLoader
      .loadAsync(resolvedUrl)
      .then((texture) => {
        // Apply options
        if (options?.wrapS) texture.wrapS = options.wrapS;
        if (options?.wrapT) texture.wrapT = options.wrapT;
        if (options?.magFilter) texture.magFilter = options.magFilter;
        if (options?.minFilter) texture.minFilter = options.minFilter;
        if (options?.colorSpace) texture.colorSpace = options.colorSpace;
        if (options?.flipY !== undefined) texture.flipY = options.flipY;

        // Estimate memory size
        const width = texture.image?.width || 512;
        const height = texture.image?.height || 512;
        const estimatedSize = width * height * 4; // RGBA

        // Store in cache
        this.textureCache.set(resolvedUrl, {
          data: texture,
          url: resolvedUrl,
          loadedAt: Date.now(),
          lastAccess: Date.now(),
          accessCount: 1,
          estimatedSize,
        });

        this.textureLoading.delete(resolvedUrl);

        // Evict old textures if necessary
        this.evictTextures();

        return texture;
      });

    this.textureLoading.set(resolvedUrl, promise);
    return promise;
  }

  /**
   * Get a cached texture (null if not cached)
   */
  getTexture(url: string): THREE.Texture | null {
    const resolvedUrl = this.resolveUrl(url);
    const cached = this.textureCache.get(resolvedUrl);
    if (cached) {
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data;
    }
    return null;
  }

  /**
   * Evict least recently used textures if over limit
   */
  private evictTextures(): void {
    if (this.textureCache.size <= this.maxTextures) return;

    // Calculate total memory
    let totalMemory = 0;
    for (const entry of this.textureCache.values()) {
      totalMemory += entry.estimatedSize;
    }

    if (
      totalMemory <= this.maxTextureMemory &&
      this.textureCache.size <= this.maxTextures
    ) {
      return;
    }

    // Sort by LRU score (last access + access count)
    const entries = Array.from(this.textureCache.entries()).map(
      ([url, entry]) => ({
        url,
        entry,
        score: entry.lastAccess + entry.accessCount * 10000, // Favor frequently used
      }),
    );
    entries.sort((a, b) => a.score - b.score);

    // Evict oldest until under limit
    const toEvict = Math.max(1, Math.floor(this.textureCache.size * 0.2)); // Evict 20%
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const { url, entry } = entries[i];
      entry.data.dispose();
      this.textureCache.delete(url);
    }
  }

  // ============================================
  // MODEL CACHING (delegates to ModelCache)
  // ============================================

  /**
   * Load a model with caching
   */
  async loadModel(
    url: string,
    world?: World,
  ): Promise<{
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
    fromCache: boolean;
  }> {
    return modelCache.loadModel(url, world || this.world);
  }

  /**
   * Get model cache statistics
   */
  getModelStats(): { total: number; paths: string[]; totalClones: number } {
    return modelCache.getStats();
  }

  // ============================================
  // AUDIO CACHING
  // ============================================

  /**
   * Get or create audio context (browser only)
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") {
      return null; // Server-side or no audio support
    }
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * Load an audio buffer with caching (browser only)
   */
  async loadAudio(url: string): Promise<AudioBuffer> {
    // Audio loading only works in browser
    const audioCtx = this.getAudioContext();
    if (!audioCtx) {
      throw new Error("Audio loading not supported on server");
    }

    const resolvedUrl = this.resolveUrl(url);

    // Check cache
    const cached = this.audioCache.get(resolvedUrl);
    if (cached) {
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data;
    }

    // Check if already loading
    const loading = this.audioLoading.get(resolvedUrl);
    if (loading) {
      return loading;
    }

    // Load new audio
    const promise = fetch(resolvedUrl)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        // Estimate memory size
        const estimatedSize =
          audioBuffer.length * audioBuffer.numberOfChannels * 4;

        // Store in cache
        this.audioCache.set(resolvedUrl, {
          data: audioBuffer,
          url: resolvedUrl,
          loadedAt: Date.now(),
          lastAccess: Date.now(),
          accessCount: 1,
          estimatedSize,
        });

        this.audioLoading.delete(resolvedUrl);

        // Evict old audio if necessary
        this.evictAudio();

        return audioBuffer;
      });

    this.audioLoading.set(resolvedUrl, promise);
    return promise;
  }

  /**
   * Evict least recently used audio buffers
   */
  private evictAudio(): void {
    if (this.audioCache.size <= this.maxAudioBuffers) return;

    // Calculate total memory
    let totalMemory = 0;
    for (const entry of this.audioCache.values()) {
      totalMemory += entry.estimatedSize;
    }

    if (
      totalMemory <= this.maxAudioMemory &&
      this.audioCache.size <= this.maxAudioBuffers
    ) {
      return;
    }

    // Sort by LRU
    const entries = Array.from(this.audioCache.entries()).map(
      ([url, entry]) => ({
        url,
        entry,
        score: entry.lastAccess + entry.accessCount * 10000,
      }),
    );
    entries.sort((a, b) => a.score - b.score);

    // Evict oldest 20%
    const toEvict = Math.max(1, Math.floor(this.audioCache.size * 0.2));
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const { url } = entries[i];
      this.audioCache.delete(url);
    }
  }

  // ============================================
  // GEOMETRY CACHING
  // ============================================

  /**
   * Get or create a cached geometry
   */
  getGeometry(
    key: string,
    factory: () => THREE.BufferGeometry,
  ): THREE.BufferGeometry {
    let geometry = this.geometryCache.get(key);
    if (!geometry) {
      geometry = factory();
      this.geometryCache.set(key, geometry);
    }
    return geometry;
  }

  /**
   * Get common geometries
   */
  getBoxGeometry(width = 1, height = 1, depth = 1): THREE.BufferGeometry {
    const key = `box_${width}_${height}_${depth}`;
    return this.getGeometry(
      key,
      () => new THREE.BoxGeometry(width, height, depth),
    );
  }

  getSphereGeometry(radius = 1, segments = 32): THREE.BufferGeometry {
    const key = `sphere_${radius}_${segments}`;
    return this.getGeometry(
      key,
      () => new THREE.SphereGeometry(radius, segments, segments),
    );
  }

  getPlaneGeometry(width = 1, height = 1): THREE.BufferGeometry {
    const key = `plane_${width}_${height}`;
    return this.getGeometry(key, () => new THREE.PlaneGeometry(width, height));
  }

  getCylinderGeometry(
    radiusTop = 1,
    radiusBottom = 1,
    height = 1,
  ): THREE.BufferGeometry {
    const key = `cylinder_${radiusTop}_${radiusBottom}_${height}`;
    return this.getGeometry(
      key,
      () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32),
    );
  }

  // ============================================
  // BATCH LOADING
  // ============================================

  /**
   * Batch load multiple assets with progress callback
   */
  async batchLoad(
    items: BatchLoadItem[],
    onProgress?: (loaded: number, total: number, currentUrl: string) => void,
  ): Promise<Map<string, THREE.Texture | THREE.Object3D | AudioBuffer>> {
    const results = new Map<
      string,
      THREE.Texture | THREE.Object3D | AudioBuffer
    >();

    // Sort by priority (higher first)
    const sorted = [...items].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0),
    );

    let loaded = 0;
    const total = sorted.length;

    for (const item of sorted) {
      try {
        onProgress?.(loaded, total, item.url);

        switch (item.type) {
          case "texture": {
            const texture = await this.loadTexture(item.url);
            results.set(item.url, texture);
            break;
          }
          case "model": {
            const { scene } = await this.loadModel(item.url);
            results.set(item.url, scene);
            break;
          }
          case "audio": {
            const audio = await this.loadAudio(item.url);
            results.set(item.url, audio);
            break;
          }
        }
      } catch (error) {
        console.error(
          `[AssetCache] Failed to load ${item.type}: ${item.url}`,
          error,
        );
      }

      loaded++;
    }

    onProgress?.(total, total, "complete");
    return results;
  }

  /**
   * Preload assets in the background
   */
  preload(items: BatchLoadItem[]): void {
    // Load in background without blocking
    this.batchLoad(items).catch((error) => {
      console.error("[AssetCache] Preload failed:", error);
    });
  }

  // ============================================
  // STATISTICS & MANAGEMENT
  // ============================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let textureSize = 0;
    for (const entry of this.textureCache.values()) {
      textureSize += entry.estimatedSize;
    }

    let audioSize = 0;
    for (const entry of this.audioCache.values()) {
      audioSize += entry.estimatedSize;
    }

    const modelStats = modelCache.getStats();

    return {
      textures: {
        count: this.textureCache.size,
        size: textureSize,
        hits: this.textureHits,
        misses: this.textureMisses,
      },
      models: {
        count: modelStats.total,
        clones: modelStats.totalClones,
      },
      audio: {
        count: this.audioCache.size,
        size: audioSize,
      },
      geometry: {
        count: this.geometryCache.size,
      },
      totalMemory: textureSize + audioSize,
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    // Clear textures
    for (const entry of this.textureCache.values()) {
      entry.data.dispose();
    }
    this.textureCache.clear();

    // Clear geometries
    for (const geometry of this.geometryCache.values()) {
      geometry.dispose();
    }
    this.geometryCache.clear();

    // Clear audio (nothing to dispose)
    this.audioCache.clear();

    // Clear model cache
    modelCache.clear();

    // Reset stats
    this.textureHits = 0;
    this.textureMisses = 0;
  }

  /**
   * Set cache limits
   */
  setLimits(config: {
    maxTextureMemory?: number;
    maxAudioMemory?: number;
    maxTextures?: number;
    maxAudioBuffers?: number;
  }): void {
    if (config.maxTextureMemory)
      this.maxTextureMemory = config.maxTextureMemory;
    if (config.maxAudioMemory) this.maxAudioMemory = config.maxAudioMemory;
    if (config.maxTextures) this.maxTextures = config.maxTextures;
    if (config.maxAudioBuffers) this.maxAudioBuffers = config.maxAudioBuffers;
  }

  /**
   * Get the shared texture loader (for systems that need direct access)
   */
  getTextureLoader(): THREE.TextureLoader {
    return this.textureLoader;
  }
}

// Export singleton instance
export const assetCache = AssetCache.getInstance();
