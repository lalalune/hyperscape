/**
 * AnimationClipPool - Shared Animation Clip Caching System
 *
 * Provides centralized caching for animation clips to prevent duplicate loading
 * and memory allocation when multiple entities play the same animation.
 *
 * Key optimizations:
 * - Network-level caching: One fetch per URL regardless of entity count
 * - Base clip caching: One parse per URL
 * - Retargeted clip caching: One retarget per skeleton configuration
 *
 * Usage:
 * ```ts
 * const pool = AnimationClipPool.getInstance();
 * const clip = await pool.getClip(url, loader, { rootToHips, version, getBoneName });
 * const action = mixer.clipAction(clip); // Each entity gets unique action
 * ```
 */

import THREE from "../../extras/three/three";

/**
 * Options for retargeting an animation clip to a specific skeleton
 */
interface RetargetOptions {
  rootToHips: number;
  version: string;
  getBoneName: (name: string) => string | undefined;
}

/**
 * Cached animation data
 */
interface CachedAnimation {
  /** The loaded emote factory (contains toClip method) */
  factory: {
    toClip: (options: RetargetOptions) => THREE.AnimationClip | null;
  };
  /** Retargeted clips keyed by skeleton configuration hash */
  retargetedClips: Map<string, THREE.AnimationClip>;
  /** When this animation was first loaded */
  loadedAt: number;
  /** Number of times this animation has been accessed */
  accessCount: number;
  /** Estimated memory size in bytes */
  estimatedSize: number;
}

/**
 * Loader interface matching ClientLoader's load method signature
 */
interface AnimationLoader {
  load: (
    type: "emote",
    url: string,
  ) => Promise<{
    toClip: (options: RetargetOptions) => THREE.AnimationClip | null;
  }>;
}

/**
 * Pool statistics for monitoring
 */
interface PoolStats {
  cachedAnimations: number;
  totalRetargetedClips: number;
  totalAccessCount: number;
  estimatedMemoryBytes: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * AnimationClipPool - Singleton for shared animation clip caching
 */
export class AnimationClipPool {
  private static instance: AnimationClipPool;

  /** Cached animations by URL */
  private cache = new Map<string, CachedAnimation>();

  /** Currently loading animations (prevents duplicate fetches) */
  private loading = new Map<
    string,
    Promise<{
      toClip: (options: RetargetOptions) => THREE.AnimationClip | null;
    }>
  >();

  /** Statistics */
  private cacheHits = 0;
  private cacheMisses = 0;

  /** Maximum cache size before LRU eviction (100 animations) */
  private maxCacheSize = 100;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AnimationClipPool {
    if (!AnimationClipPool.instance) {
      AnimationClipPool.instance = new AnimationClipPool();
    }
    return AnimationClipPool.instance;
  }

  /**
   * Generate a cache key for retargeted clips based on skeleton configuration
   *
   * We round rootToHips to 2 decimal places since small differences
   * in skeleton proportions don't significantly affect animation quality.
   */
  private getRetargetKey(options: RetargetOptions): string {
    const roundedRootToHips = Math.round(options.rootToHips * 100) / 100;
    return `${roundedRootToHips}_${options.version}`;
  }

  /**
   * Estimate memory size of an animation clip
   */
  private estimateClipSize(clip: THREE.AnimationClip): number {
    let size = 0;
    for (const track of clip.tracks) {
      // Each keyframe value is a Float32 (4 bytes)
      size += track.values.length * 4;
      // Each time value is a Float32 (4 bytes)
      size += track.times.length * 4;
      // Track name string (rough estimate)
      size += track.name.length * 2;
    }
    // Add overhead for clip object itself
    size += 200;
    return size;
  }

  /**
   * Perform LRU eviction if cache is too large
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxCacheSize) {
      return;
    }

    // Find least recently accessed entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);

    // Remove oldest 20% of cache
    const removeCount = Math.ceil(this.cache.size * 0.2);
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Load an animation and get a retargeted clip for the given skeleton configuration.
   *
   * This is the main entry point. It:
   * 1. Returns cached clip if available for this skeleton config
   * 2. Otherwise, loads the animation (with deduplication)
   * 3. Retargets to the skeleton and caches the result
   *
   * @param url - Animation URL (e.g., "asset://emotes/emote-idle.glb")
   * @param loader - Loader instance with load("emote", url) method
   * @param options - Retarget options including rootToHips, version, getBoneName
   * @returns Retargeted AnimationClip ready for use with mixer.clipAction()
   */
  async getClip(
    url: string,
    loader: AnimationLoader,
    options: RetargetOptions,
  ): Promise<THREE.AnimationClip | null> {
    const retargetKey = this.getRetargetKey(options);

    // Check if we have this animation cached
    const cached = this.cache.get(url);
    if (cached) {
      cached.accessCount++;
      this.cacheHits++;

      // Check if we have a retargeted clip for this skeleton config
      const existingClip = cached.retargetedClips.get(retargetKey);
      if (existingClip) {
        return existingClip;
      }

      // We have the factory but not a retargeted clip for this skeleton
      // Create and cache the retargeted clip
      const newClip = cached.factory.toClip(options);
      if (newClip) {
        cached.retargetedClips.set(retargetKey, newClip);
        cached.estimatedSize += this.estimateClipSize(newClip);
      }
      return newClip;
    }

    this.cacheMisses++;

    // Check if already loading
    let loadPromise = this.loading.get(url);

    if (!loadPromise) {
      // Start loading
      loadPromise = loader.load("emote", url);
      this.loading.set(url, loadPromise);
    }

    // Wait for load to complete
    const factory = await loadPromise;

    // Remove from loading map
    this.loading.delete(url);

    // Create the retargeted clip
    const clip = factory.toClip(options);

    // Cache the factory and retargeted clip
    const cacheEntry: CachedAnimation = {
      factory,
      retargetedClips: new Map(),
      loadedAt: Date.now(),
      accessCount: 1,
      estimatedSize: clip ? this.estimateClipSize(clip) : 0,
    };

    if (clip) {
      cacheEntry.retargetedClips.set(retargetKey, clip);
    }

    this.cache.set(url, cacheEntry);

    // Check if we need to evict old entries
    this.evictIfNeeded();

    return clip;
  }

  /**
   * Check if an animation is already cached (without loading)
   */
  hasAnimation(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * Check if a specific retargeted clip is cached
   */
  hasRetargetedClip(url: string, options: RetargetOptions): boolean {
    const cached = this.cache.get(url);
    if (!cached) return false;
    return cached.retargetedClips.has(this.getRetargetKey(options));
  }

  /**
   * Preload animations without needing skeleton config.
   * Useful for loading common animations at startup.
   *
   * @param urls - Array of animation URLs to preload
   * @param loader - Loader instance
   */
  async preload(urls: string[], loader: AnimationLoader): Promise<void> {
    const loadPromises = urls.map(async (url) => {
      if (this.cache.has(url) || this.loading.has(url)) {
        return; // Already cached or loading
      }

      const loadPromise = loader.load("emote", url);
      this.loading.set(url, loadPromise);

      const factory = await loadPromise;
      this.loading.delete(url);

      // Cache the factory (no retargeted clips yet)
      this.cache.set(url, {
        factory,
        retargetedClips: new Map(),
        loadedAt: Date.now(),
        accessCount: 0,
        estimatedSize: 0,
      });
    });

    await Promise.all(loadPromises);
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let totalRetargetedClips = 0;
    let totalAccessCount = 0;
    let estimatedMemoryBytes = 0;

    for (const entry of this.cache.values()) {
      totalRetargetedClips += entry.retargetedClips.size;
      totalAccessCount += entry.accessCount;
      estimatedMemoryBytes += entry.estimatedSize;
    }

    return {
      cachedAnimations: this.cache.size,
      totalRetargetedClips,
      totalAccessCount,
      estimatedMemoryBytes,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
    };
  }

  /**
   * Clear all cached animations
   */
  clear(): void {
    this.cache.clear();
    this.loading.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Remove a specific animation from cache
   */
  remove(url: string): boolean {
    return this.cache.delete(url);
  }
}

/** Singleton instance export for convenience */
export const animationClipPool = AnimationClipPool.getInstance();

