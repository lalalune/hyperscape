/**
 * Cache Invalidation Service
 *
 * Smart cache invalidation across all caching layers.
 * Coordinates invalidation between memory cache, IndexedDB, and Service Worker.
 *
 * Features:
 * - Multi-layer invalidation
 * - Pattern-based invalidation
 * - Dependency tracking
 * - Automatic invalidation on mutations
 * - Bulk invalidation operations
 *
 * @example
 * ```typescript
 * const invalidation = CacheInvalidationService.getInstance()
 *
 * // Invalidate specific asset
 * await invalidation.invalidateAsset('asset-123')
 *
 * // Invalidate by pattern
 * await invalidation.invalidatePattern(/^assets:/)
 *
 * // Invalidate all caches
 * await invalidation.invalidateAll()
 * ```
 */

import { createLogger } from '@/utils/logger'
import { AssetCacheService } from './AssetCacheService'
import { IndexedDBCache } from './IndexedDBCache'

const logger = createLogger('CacheInvalidationService')

interface InvalidationRule {
  pattern: RegExp
  dependencies: string[]
  ttl?: number
}

interface InvalidationEvent {
  type: 'asset' | 'preset' | 'voice' | 'manifest' | 'custom'
  id?: string
  pattern?: RegExp
  timestamp: number
}

class CacheInvalidationServiceClass {
  private memoryCache = AssetCacheService.getInstance()
  private indexedDBCache: Awaited<ReturnType<typeof IndexedDBCache.getInstance>> | null = null
  private invalidationRules: Map<string, InvalidationRule>
  private invalidationHistory: InvalidationEvent[]
  private maxHistorySize = 100

  constructor() {
    this.invalidationRules = new Map()
    this.invalidationHistory = []

    this.init()
    this.setupDefaultRules()
  }

  /**
   * Initialize service
   */
  private async init(): Promise<void> {
    this.indexedDBCache = await IndexedDBCache.getInstance()
    logger.info('CacheInvalidationService initialized')
  }

  /**
   * Setup default invalidation rules
   */
  private setupDefaultRules(): void {
    // When an asset is updated, invalidate related caches
    this.addRule('asset-update', {
      pattern: /^asset:/,
      dependencies: ['assets:list', 'prefetch:']
    })

    // When material presets change, invalidate preset caches
    this.addRule('preset-update', {
      pattern: /^preset:/,
      dependencies: ['presets:material']
    })

    // When voice profiles change, invalidate voice caches
    this.addRule('voice-update', {
      pattern: /^voice:/,
      dependencies: ['voice:library', 'voice:presets']
    })

    // When manifests change, invalidate manifest caches
    this.addRule('manifest-update', {
      pattern: /^manifest:/,
      dependencies: ['manifests:list']
    })
  }

  /**
   * Add invalidation rule
   */
  addRule(name: string, rule: InvalidationRule): void {
    this.invalidationRules.set(name, rule)
    logger.debug(`Added invalidation rule: ${name}`)
  }

  /**
   * Remove invalidation rule
   */
  removeRule(name: string): boolean {
    const removed = this.invalidationRules.delete(name)
    if (removed) {
      logger.debug(`Removed invalidation rule: ${name}`)
    }
    return removed
  }

  /**
   * Invalidate specific asset across all cache layers
   */
  async invalidateAsset(assetId: string): Promise<void> {
    logger.info(`Invalidating asset: ${assetId}`)

    // Memory cache
    this.memoryCache.invalidate(new RegExp(`^asset:${assetId}`))
    this.memoryCache.delete('assets:list') // Invalidate list since it contains this asset

    // IndexedDB
    if (this.indexedDBCache) {
      await this.indexedDBCache.deletePattern(new RegExp(`^asset:${assetId}`))
      await this.indexedDBCache.delete('assets:list')
    }

    // Service Worker
    await this.invalidateServiceWorkerCache(`/assets/${assetId}`)

    // Apply rules
    await this.applyRules('asset-update', assetId)

    // Track invalidation
    this.trackInvalidation({
      type: 'asset',
      id: assetId,
      timestamp: Date.now()
    })
  }

  /**
   * Invalidate by pattern across all cache layers
   */
  async invalidatePattern(pattern: RegExp): Promise<void> {
    logger.info(`Invalidating by pattern: ${pattern}`)

    // Memory cache
    this.memoryCache.invalidate(pattern)

    // IndexedDB
    if (this.indexedDBCache) {
      await this.indexedDBCache.deletePattern(pattern)
    }

    // Service Worker
    await this.invalidateServiceWorkerCache(pattern.source)

    // Track invalidation
    this.trackInvalidation({
      type: 'custom',
      pattern,
      timestamp: Date.now()
    })
  }

  /**
   * Invalidate stale data (expired entries)
   */
  async invalidateExpired(): Promise<{ memory: number; indexedDB: number }> {
    logger.info('Invalidating expired entries')

    // Memory cache cleanup
    const memoryCount = this.memoryCache.cleanupExpired()

    // IndexedDB cleanup
    const indexedDBCount = this.indexedDBCache
      ? await this.indexedDBCache.prune()
      : 0

    logger.info(
      `Invalidated ${memoryCount} memory entries, ${indexedDBCount} IndexedDB entries`
    )

    return {
      memory: memoryCount,
      indexedDB: indexedDBCount
    }
  }

  /**
   * Invalidate all caches
   */
  async invalidateAll(): Promise<void> {
    logger.info('Invalidating all caches')

    // Memory cache
    this.memoryCache.clear()

    // IndexedDB
    if (this.indexedDBCache) {
      await this.indexedDBCache.clear()
    }

    // Service Worker
    await this.clearServiceWorkerCaches()

    // Track invalidation
    this.trackInvalidation({
      type: 'custom',
      timestamp: Date.now()
    })

    logger.info('All caches invalidated')
  }

  /**
   * Invalidate on asset creation
   */
  async invalidateOnCreate(assetId: string): Promise<void> {
    logger.info(`Invalidating on asset creation: ${assetId}`)

    // Invalidate lists since a new asset was added
    this.memoryCache.delete('assets:list')

    if (this.indexedDBCache) {
      await this.indexedDBCache.delete('assets:list')
    }

    // Apply rules
    await this.applyRules('asset-update', assetId)

    // Track invalidation
    this.trackInvalidation({
      type: 'asset',
      id: assetId,
      timestamp: Date.now()
    })
  }

  /**
   * Invalidate on asset update
   */
  async invalidateOnUpdate(assetId: string): Promise<void> {
    await this.invalidateAsset(assetId)
  }

  /**
   * Invalidate on asset delete
   */
  async invalidateOnDelete(assetId: string): Promise<void> {
    logger.info(`Invalidating on asset deletion: ${assetId}`)

    // Remove asset from all caches
    await this.invalidateAsset(assetId)

    // Invalidate lists
    this.memoryCache.delete('assets:list')

    if (this.indexedDBCache) {
      await this.indexedDBCache.delete('assets:list')
    }

    // Track invalidation
    this.trackInvalidation({
      type: 'asset',
      id: assetId,
      timestamp: Date.now()
    })
  }

  /**
   * Invalidate material presets
   */
  async invalidatePresets(): Promise<void> {
    logger.info('Invalidating material presets')

    // Memory cache
    this.memoryCache.invalidate(/^presets?:/)

    // IndexedDB
    if (this.indexedDBCache) {
      await this.indexedDBCache.deletePattern(/^presets?:/)
    }

    // Service Worker
    await this.invalidateServiceWorkerCache('/api/material-presets')

    // Track invalidation
    this.trackInvalidation({
      type: 'preset',
      timestamp: Date.now()
    })
  }

  /**
   * Invalidate voice data
   */
  async invalidateVoice(): Promise<void> {
    logger.info('Invalidating voice data')

    // Memory cache
    this.memoryCache.invalidate(/^voice:/)

    // IndexedDB
    if (this.indexedDBCache) {
      await this.indexedDBCache.deletePattern(/^voice:/)
    }

    // Service Worker
    await this.invalidateServiceWorkerCache('/api/voice')

    // Track invalidation
    this.trackInvalidation({
      type: 'voice',
      timestamp: Date.now()
    })
  }

  /**
   * Invalidate manifests
   */
  async invalidateManifests(): Promise<void> {
    logger.info('Invalidating manifests')

    // Memory cache
    this.memoryCache.invalidate(/^manifests?:/)

    // IndexedDB
    if (this.indexedDBCache) {
      await this.indexedDBCache.deletePattern(/^manifests?:/)
    }

    // Service Worker
    await this.invalidateServiceWorkerCache('/api/manifests')

    // Track invalidation
    this.trackInvalidation({
      type: 'manifest',
      timestamp: Date.now()
    })
  }

  /**
   * Apply invalidation rules
   */
  private async applyRules(ruleName: string, context?: string): Promise<void> {
    const rule = this.invalidationRules.get(ruleName)
    if (!rule) {
      return
    }

    // Invalidate dependencies
    for (const dep of rule.dependencies) {
      const pattern = new RegExp(dep)

      // Memory cache
      this.memoryCache.invalidate(pattern)

      // IndexedDB
      if (this.indexedDBCache) {
        await this.indexedDBCache.deletePattern(pattern)
      }
    }

    logger.debug(`Applied rule: ${ruleName} (context: ${context || 'none'})`)
  }

  /**
   * Invalidate Service Worker cache
   */
  private async invalidateServiceWorkerCache(pattern: string): Promise<void> {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      return
    }

    try {
      const messageChannel = new MessageChannel()

      await new Promise<void>((resolve, reject) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            resolve()
          } else {
            reject(new Error('Service worker invalidation failed'))
          }
        }

        navigator.serviceWorker.controller!.postMessage(
          {
            type: 'INVALIDATE_CACHE',
            payload: { pattern }
          },
          [messageChannel.port2]
        )

        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Service worker timeout')), 5000)
      })

      logger.debug(`Service worker cache invalidated: ${pattern}`)
    } catch (error) {
      logger.error('Failed to invalidate service worker cache', error)
    }
  }

  /**
   * Clear all Service Worker caches
   */
  private async clearServiceWorkerCaches(): Promise<void> {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      return
    }

    try {
      const messageChannel = new MessageChannel()

      await new Promise<void>((resolve, reject) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            resolve()
          } else {
            reject(new Error('Service worker clear failed'))
          }
        }

        navigator.serviceWorker.controller!.postMessage(
          {
            type: 'CLEAR_ALL_CACHES'
          },
          [messageChannel.port2]
        )

        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Service worker timeout')), 5000)
      })

      logger.info('All service worker caches cleared')
    } catch (error) {
      logger.error('Failed to clear service worker caches', error)
    }
  }

  /**
   * Track invalidation event
   */
  private trackInvalidation(event: InvalidationEvent): void {
    this.invalidationHistory.push(event)

    // Limit history size
    if (this.invalidationHistory.length > this.maxHistorySize) {
      this.invalidationHistory.shift()
    }
  }

  /**
   * Get invalidation history
   */
  getHistory(): InvalidationEvent[] {
    return [...this.invalidationHistory]
  }

  /**
   * Get invalidation statistics
   */
  getStats(): {
    totalInvalidations: number
    byType: Record<string, number>
    recentInvalidations: InvalidationEvent[]
  } {
    const byType: Record<string, number> = {}

    for (const event of this.invalidationHistory) {
      byType[event.type] = (byType[event.type] || 0) + 1
    }

    return {
      totalInvalidations: this.invalidationHistory.length,
      byType,
      recentInvalidations: this.invalidationHistory.slice(-10)
    }
  }

  /**
   * Clear invalidation history
   */
  clearHistory(): void {
    this.invalidationHistory = []
    logger.info('Invalidation history cleared')
  }
}

// Singleton instance
let instance: CacheInvalidationServiceClass | null = null

/**
 * Get singleton instance of CacheInvalidationService
 */
export function getCacheInvalidationService(): CacheInvalidationServiceClass {
  if (!instance) {
    instance = new CacheInvalidationServiceClass()
  }
  return instance
}

export const CacheInvalidationService = {
  getInstance: getCacheInvalidationService
}

export default CacheInvalidationService
