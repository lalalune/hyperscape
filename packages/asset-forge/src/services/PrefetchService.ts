/**
 * Prefetch Service
 *
 * Intelligent prefetching service to reduce perceived load times.
 * Implements multiple prefetching strategies based on user behavior.
 *
 * Strategies:
 * - Hover Prefetch: Prefetch on link hover
 * - Idle Prefetch: Prefetch during browser idle time
 * - Predictive Prefetch: Prefetch based on user patterns
 * - Related Asset Prefetch: Prefetch related assets
 *
 * @example
 * ```typescript
 * const prefetch = PrefetchService.getInstance()
 *
 * // Prefetch on hover
 * prefetch.prefetchOnHover('/assets/123')
 *
 * // Prefetch related assets
 * prefetch.prefetchRelated('asset-123')
 *
 * // Prefetch during idle
 * prefetch.prefetchOnIdle(['/api/assets', '/api/material-presets'])
 * ```
 */

import { createLogger } from '@/utils/logger'
import { AssetService } from './api/AssetService'
import { IndexedDBCache } from './IndexedDBCache'

const logger = createLogger('PrefetchService')

interface PrefetchConfig {
  enabled: boolean
  hoverDelay: number // ms to wait before prefetching on hover
  idleDelay: number // ms to wait after idle before prefetching
  maxConcurrent: number // max concurrent prefetch requests
  maxIdlePrefetch: number // max items to prefetch during idle
  connectionAware: boolean // respect user's connection speed
}

interface PrefetchQueueItem {
  url: string
  priority: number // 0-10, higher is more important
  type: 'hover' | 'idle' | 'predictive' | 'related'
}

interface UserPattern {
  route: string
  nextRoutes: Map<string, number> // route -> visit count
  lastVisited: number
}

class PrefetchServiceClass {
  private config: PrefetchConfig
  private hoverTimeouts: Map<string, number>
  private prefetchQueue: PrefetchQueueItem[]
  private prefetching: Set<string>
  private prefetched: Set<string>
  private idleCallback: number | null
  private userPatterns: Map<string, UserPattern>
  private currentRoute: string | null
  private cache: Awaited<ReturnType<typeof IndexedDBCache.getInstance>> | null

  constructor() {
    this.config = {
      enabled: true,
      hoverDelay: 300,
      idleDelay: 2000,
      maxConcurrent: 3,
      maxIdlePrefetch: 10,
      connectionAware: true
    }

    this.hoverTimeouts = new Map()
    this.prefetchQueue = []
    this.prefetching = new Set()
    this.prefetched = new Set()
    this.idleCallback = null
    this.userPatterns = new Map()
    this.currentRoute = null
    this.cache = null

    this.init()
  }

  /**
   * Initialize prefetch service
   */
  private async init(): Promise<void> {
    // Initialize IndexedDB cache
    this.cache = await IndexedDBCache.getInstance()

    // Load user patterns from storage
    this.loadUserPatterns()

    // Setup idle detection
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      this.setupIdleDetection()
    }

    logger.info('PrefetchService initialized')
  }

  /**
   * Configure prefetch service
   */
  configure(config: Partial<PrefetchConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('PrefetchService configured', config)
  }

  /**
   * Prefetch on hover
   */
  prefetchOnHover(url: string, priority = 5): void {
    if (!this.config.enabled || !this.shouldPrefetch()) {
      return
    }

    // Clear existing timeout for this URL
    const existingTimeout = this.hoverTimeouts.get(url)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout
    const timeout = window.setTimeout(() => {
      this.addToQueue({ url, priority, type: 'hover' })
      this.hoverTimeouts.delete(url)
    }, this.config.hoverDelay)

    this.hoverTimeouts.set(url, timeout)
  }

  /**
   * Cancel hover prefetch
   */
  cancelHoverPrefetch(url: string): void {
    const timeout = this.hoverTimeouts.get(url)
    if (timeout) {
      clearTimeout(timeout)
      this.hoverTimeouts.delete(url)
    }
  }

  /**
   * Prefetch related assets
   */
  async prefetchRelated(assetId: string, priority = 3): Promise<void> {
    if (!this.config.enabled || !this.shouldPrefetch()) {
      return
    }

    try {
      // Get asset details
      const assets = await AssetService.listAssets()
      const asset = assets.find(a => a.id === assetId)

      if (!asset) {
        return
      }

      // Prefetch assets of the same type
      const relatedAssets = assets.filter(
        a => a.type === asset.type && a.id !== assetId
      ).slice(0, 5) // Limit to 5 related assets

      for (const related of relatedAssets) {
        const url = AssetService.getModelUrl(related.id)
        this.addToQueue({ url, priority, type: 'related' })
      }

      logger.debug(`Queued ${relatedAssets.length} related assets for prefetch`)
    } catch (error) {
      logger.error('Failed to prefetch related assets', error)
    }
  }

  /**
   * Prefetch during browser idle time
   */
  prefetchOnIdle(urls: string[], priority = 2): void {
    if (!this.config.enabled || !this.shouldPrefetch()) {
      return
    }

    // Add to queue with idle priority
    for (const url of urls.slice(0, this.config.maxIdlePrefetch)) {
      this.addToQueue({ url, priority, type: 'idle' })
    }

    logger.debug(`Queued ${urls.length} URLs for idle prefetch`)
  }

  /**
   * Predictive prefetch based on user patterns
   */
  async predictAndPrefetch(): Promise<void> {
    if (!this.config.enabled || !this.shouldPrefetch() || !this.currentRoute) {
      return
    }

    const pattern = this.userPatterns.get(this.currentRoute)
    if (!pattern || pattern.nextRoutes.size === 0) {
      return
    }

    // Get most likely next routes (sorted by visit count)
    const sortedRoutes = Array.from(pattern.nextRoutes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3) // Top 3 most likely routes

    for (const [route, count] of sortedRoutes) {
      // Priority based on likelihood (visit count)
      const priority = Math.min(10, Math.floor(count / 2) + 4)
      this.addToQueue({ url: route, priority, type: 'predictive' })
    }

    logger.debug(`Predictive prefetch: ${sortedRoutes.length} routes queued`)
  }

  /**
   * Track route navigation for pattern learning
   */
  trackNavigation(from: string, to: string): void {
    // Update pattern for 'from' route
    let pattern = this.userPatterns.get(from)
    if (!pattern) {
      pattern = {
        route: from,
        nextRoutes: new Map(),
        lastVisited: Date.now()
      }
      this.userPatterns.set(from, pattern)
    }

    const currentCount = pattern.nextRoutes.get(to) || 0
    pattern.nextRoutes.set(to, currentCount + 1)
    pattern.lastVisited = Date.now()

    // Update current route
    this.currentRoute = to

    // Save patterns
    this.saveUserPatterns()

    // Trigger predictive prefetch
    this.predictAndPrefetch()
  }

  /**
   * Add item to prefetch queue
   */
  private addToQueue(item: PrefetchQueueItem): void {
    // Skip if already prefetched or currently prefetching
    if (this.prefetched.has(item.url) || this.prefetching.has(item.url)) {
      return
    }

    // Skip if already in queue
    if (this.prefetchQueue.some(i => i.url === item.url)) {
      return
    }

    // Add to queue
    this.prefetchQueue.push(item)

    // Sort queue by priority (higher priority first)
    this.prefetchQueue.sort((a, b) => b.priority - a.priority)

    // Process queue
    this.processQueue()
  }

  /**
   * Process prefetch queue
   */
  private async processQueue(): Promise<void> {
    // Check if we can start more prefetch requests
    while (
      this.prefetching.size < this.config.maxConcurrent &&
      this.prefetchQueue.length > 0
    ) {
      const item = this.prefetchQueue.shift()
      if (!item) {
        break
      }

      this.prefetchItem(item)
    }
  }

  /**
   * Prefetch a single item
   */
  private async prefetchItem(item: PrefetchQueueItem): Promise<void> {
    this.prefetching.add(item.url)

    try {
      logger.debug(`Prefetching [${item.type}]: ${item.url}`)

      const response = await fetch(item.url, {
        priority: 'low' as RequestPriority
      })

      if (response.ok) {
        // For JSON responses, store in IndexedDB
        if (response.headers.get('content-type')?.includes('application/json')) {
          const data = await response.clone().json()
          if (this.cache) {
            await this.cache.set(`prefetch:${item.url}`, data, 30 * 60 * 1000) // 30 min TTL
          }
        }

        this.prefetched.add(item.url)
        logger.debug(`Prefetched successfully: ${item.url}`)
      }
    } catch (error) {
      logger.warn(`Failed to prefetch: ${item.url}`, error)
    } finally {
      this.prefetching.delete(item.url)

      // Process next item in queue
      this.processQueue()
    }
  }

  /**
   * Setup idle detection for background prefetching
   */
  private setupIdleDetection(): void {
    const scheduleIdlePrefetch = () => {
      if (this.idleCallback !== null) {
        return
      }

      this.idleCallback = window.requestIdleCallback(
        (deadline) => {
          if (deadline.timeRemaining() > 0 && this.prefetchQueue.length > 0) {
            this.processQueue()
          }

          this.idleCallback = null
          scheduleIdlePrefetch()
        },
        { timeout: this.config.idleDelay }
      )
    }

    scheduleIdlePrefetch()
  }

  /**
   * Check if we should prefetch (connection-aware)
   */
  private shouldPrefetch(): boolean {
    if (!this.config.connectionAware) {
      return true
    }

    // Check Network Information API
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection
    if (connection) {
      // Don't prefetch on slow connections or save data mode
      if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return false
      }
    }

    return true
  }

  /**
   * Load user patterns from storage
   */
  private loadUserPatterns(): void {
    try {
      const stored = localStorage.getItem('prefetch:userPatterns')
      if (stored) {
        const parsed = JSON.parse(stored)
        this.userPatterns = new Map(
          Object.entries(parsed).map(([key, value]: [string, UserPattern]) => [
            key,
            {
              ...value,
              nextRoutes: new Map(Object.entries(value.nextRoutes))
            }
          ])
        )
        logger.debug(`Loaded ${this.userPatterns.size} user patterns`)
      }
    } catch (error) {
      logger.error('Failed to load user patterns', error)
    }
  }

  /**
   * Save user patterns to storage
   */
  private saveUserPatterns(): void {
    try {
      const toStore: Record<string, { route: string; nextRoutes: Record<string, number>; lastVisited: number }> = {}
      for (const [key, value] of this.userPatterns.entries()) {
        toStore[key] = {
          route: value.route,
          nextRoutes: Object.fromEntries(value.nextRoutes),
          lastVisited: value.lastVisited
        }
      }
      localStorage.setItem('prefetch:userPatterns', JSON.stringify(toStore))
    } catch (error) {
      logger.error('Failed to save user patterns', error)
    }
  }

  /**
   * Get prefetch statistics
   */
  getStats(): { queued: number; prefetching: number; prefetched: number } {
    return {
      queued: this.prefetchQueue.length,
      prefetching: this.prefetching.size,
      prefetched: this.prefetched.size
    }
  }

  /**
   * Clear all prefetch data
   */
  clear(): void {
    this.hoverTimeouts.forEach(timeout => clearTimeout(timeout))
    this.hoverTimeouts.clear()
    this.prefetchQueue = []
    this.prefetching.clear()
    this.prefetched.clear()
    this.userPatterns.clear()

    localStorage.removeItem('prefetch:userPatterns')

    logger.info('Prefetch service cleared')
  }
}

// Singleton instance
let instance: PrefetchServiceClass | null = null

/**
 * Get singleton instance of PrefetchService
 */
export function getPrefetchService(): PrefetchServiceClass {
  if (!instance) {
    instance = new PrefetchServiceClass()
  }
  return instance
}

export const PrefetchService = {
  getInstance: getPrefetchService
}

export default PrefetchService
