/**
 * Asset Service
 * Clean API interface for asset operations with multi-layer caching
 *
 * Caching Layers:
 * 1. Memory Cache (AssetCacheService) - Fast, 5 min TTL
 * 2. IndexedDB Cache - Persistent, 30 day TTL
 * 3. Service Worker Cache - Network-first with offline fallback
 */

import { MaterialPreset, AssetMetadata } from '../../types'

import { apiFetch } from '@/utils/api'
import { AssetCacheService, type CacheStats } from '../AssetCacheService'
import { IndexedDBCache } from '../IndexedDBCache'
import { CacheInvalidationService } from '../CacheInvalidationService'
import { createLogger } from '@/utils/logger'

const logger = createLogger('AssetService')

export type { MaterialPreset }

export interface Asset {
  id: string
  name: string
  description: string
  type: string
  metadata: AssetMetadata
  hasModel: boolean
  modelFile?: string
  generatedAt: string
}

export interface RetextureRequest {
  baseAssetId: string
  materialPreset: MaterialPreset
  outputName?: string
}

export interface RetextureResponse {
  success: boolean
  assetId: string
  message: string
  asset?: Asset
}

class AssetServiceClass {
  private baseUrl = '/api'
  private cache = AssetCacheService.getInstance()
  private indexedDBCache: Awaited<ReturnType<typeof IndexedDBCache.getInstance>> | null = null
  private invalidation = CacheInvalidationService.getInstance()
  private readonly ASSETS_CACHE_KEY = 'assets:list'
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initAsync()
  }

  /**
   * Initialize async dependencies
   */
  private async initAsync(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = (async () => {
      this.indexedDBCache = await IndexedDBCache.getInstance()
      logger.info('AssetService initialized with multi-layer caching')
    })()

    return this.initPromise
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
    }
  }

  async listAssets(bypassCache = false): Promise<Asset[]> {
    await this.ensureInitialized()

    // Check cache first unless bypassed
    if (!bypassCache) {
      // Layer 1: Memory cache
      const memoryCached = this.cache.get<Asset[]>(this.ASSETS_CACHE_KEY)
      if (memoryCached) {
        logger.info(`Memory cache hit for assets list (${memoryCached.length} assets)`)
        return memoryCached
      }

      // Layer 2: IndexedDB cache
      if (this.indexedDBCache) {
        const indexedDBCached = await this.indexedDBCache.get<Asset[]>(this.ASSETS_CACHE_KEY)
        if (indexedDBCached) {
          logger.info(`IndexedDB cache hit for assets list (${indexedDBCached.length} assets)`)

          // Populate memory cache from IndexedDB
          this.cache.set(this.ASSETS_CACHE_KEY, indexedDBCached, 'metadata')

          return indexedDBCached
        }
      }
    }

    // Cache miss or bypass - fetch from API
    const startTime = performance.now()
    logger.info('Fetching assets from API...')

    const response = await apiFetch(`${this.baseUrl}/assets?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeoutMs: 15000
    })

    if (!response.ok) {
      throw new Error('Failed to fetch assets')
    }

    const assets: Asset[] = await response.json()
    const loadTime = Math.round(performance.now() - startTime)

    // Store in both caches
    this.cache.set(this.ASSETS_CACHE_KEY, assets, 'metadata')

    if (this.indexedDBCache) {
      await this.indexedDBCache.set(this.ASSETS_CACHE_KEY, assets, 30 * 24 * 60 * 60 * 1000) // 30 days
    }

    logger.info(`Assets loaded from API in ${loadTime}ms (${assets.length} assets) and cached`)

    return assets
  }

  async getMaterialPresets(bypassCache = false): Promise<MaterialPreset[]> {
    await this.ensureInitialized()

    const cacheKey = 'presets:material'

    // Check cache first unless bypassed
    if (!bypassCache) {
      // Layer 1: Memory cache
      const memoryCached = this.cache.get<MaterialPreset[]>(cacheKey)
      if (memoryCached) {
        logger.info(`Memory cache hit for material presets (${memoryCached.length} presets)`)
        return memoryCached
      }

      // Layer 2: IndexedDB cache
      if (this.indexedDBCache) {
        const indexedDBCached = await this.indexedDBCache.get<MaterialPreset[]>(cacheKey)
        if (indexedDBCached) {
          logger.info(`IndexedDB cache hit for material presets (${indexedDBCached.length} presets)`)

          // Populate memory cache
          this.cache.set(cacheKey, indexedDBCached, 'preset')

          return indexedDBCached
        }
      }
    }

    const response = await apiFetch(`${this.baseUrl}/material-presets`, { timeoutMs: 10000 })
    if (!response.ok) {
      throw new Error('Failed to fetch material presets')
    }

    const presets: MaterialPreset[] = await response.json()

    // Store in both caches
    this.cache.set(cacheKey, presets, 'preset')

    if (this.indexedDBCache) {
      await this.indexedDBCache.set(cacheKey, presets, 30 * 24 * 60 * 60 * 1000) // 30 days
    }

    logger.info(`Material presets loaded and cached (${presets.length} presets)`)

    return presets
  }

  async retexture(request: RetextureRequest): Promise<RetextureResponse> {
    const response = await apiFetch(`${this.baseUrl}/retexture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request),
      timeoutMs: 30000
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Retexturing failed')
    }

    const result: RetextureResponse = await response.json()

    // Invalidate assets cache across all layers
    await this.invalidation.invalidateOnCreate(result.assetId)

    return result
  }

  /**
   * Invalidate all cached assets
   */
  async invalidateAssetsCache(): Promise<void> {
    await this.invalidation.invalidatePattern(/^assets?:/)
    logger.info('Assets cache invalidated across all layers')
  }

  /**
   * Invalidate specific asset cache entry
   */
  async invalidateAssetCache(assetId: string): Promise<void> {
    await this.invalidation.invalidateAsset(assetId)
    logger.info(`Cache invalidated for asset: ${assetId}`)
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats()
  }

  /**
   * Clear all caches across all layers
   */
  async clearCache(): Promise<void> {
    await this.invalidation.invalidateAll()
    logger.info('All caches cleared across all layers')
  }

  getModelUrl(assetId: string): string {
    return `/assets/${assetId}/${assetId}.glb`
  }

  getConceptArtUrl(assetId: string): string {
    return `/assets/${assetId}/concept-art.png`
  }
}

export const AssetService = new AssetServiceClass()