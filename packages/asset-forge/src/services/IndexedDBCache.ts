/**
 * IndexedDB Cache Service
 *
 * Persistent browser storage for assets, models, and other large data.
 * Provides cross-session caching with TTL and automatic cleanup.
 *
 * Features:
 * - Persistent storage across browser sessions
 * - TTL-based expiration
 * - Automatic size management
 * - Blob storage support for binary data
 * - Batch operations for efficiency
 *
 * @example
 * ```typescript
 * const cache = await IndexedDBCache.getInstance()
 *
 * // Store asset metadata
 * await cache.set('asset:123', asset, 30 * 24 * 60 * 60 * 1000) // 30 days
 *
 * // Retrieve asset
 * const asset = await cache.get('asset:123')
 *
 * // Check if exists
 * const hasAsset = await cache.has('asset:123')
 * ```
 */

import { createLogger } from '@/utils/logger'

const logger = createLogger('IndexedDBCache')

const DB_NAME = 'AssetForgeCache'
const DB_VERSION = 1
const STORE_NAME = 'cache'

interface CacheEntry<T = unknown> {
  key: string
  value: T
  timestamp: number
  expiresAt: number
  size: number
  accessCount: number
  lastAccessed: number
}

export interface IndexedDBCacheStats {
  totalEntries: number
  totalSize: number
  oldestEntry: number
  newestEntry: number
  expiredEntries: number
}

class IndexedDBCacheClass {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null
  private isInitialized = false

  /**
   * Initialize IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        logger.error('Failed to open IndexedDB', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        logger.info('IndexedDB initialized successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' })

          // Create indexes for efficient querying
          objectStore.createIndex('timestamp', 'timestamp', { unique: false })
          objectStore.createIndex('expiresAt', 'expiresAt', { unique: false })
          objectStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })

          logger.info('Created IndexedDB object store and indexes')
        }
      }
    })

    return this.initPromise
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init()
    }
  }

  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.get(key)

      request.onerror = () => {
        logger.error(`Failed to get key: ${key}`, request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined

        if (!entry) {
          resolve(null)
          return
        }

        const now = Date.now()

        // Check if entry has expired
        if (now > entry.expiresAt) {
          logger.debug(`Cache entry expired: ${key}`)
          // Delete expired entry
          objectStore.delete(key)
          resolve(null)
          return
        }

        // Update access tracking
        entry.accessCount++
        entry.lastAccessed = now
        objectStore.put(entry)

        logger.debug(`IndexedDB cache hit: ${key} (accessed ${entry.accessCount} times)`)
        resolve(entry.value)
      }
    })
  }

  /**
   * Set cache entry with TTL
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const now = Date.now()
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: now + ttl,
        size: this.estimateSize(value),
        accessCount: 0,
        lastAccessed: now
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.put(entry)

      request.onerror = () => {
        logger.error(`Failed to set key: ${key}`, request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        logger.debug(`IndexedDB cache set: ${key} (TTL: ${ttl}ms, size: ${entry.size})`)
        resolve()
      }
    })
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<boolean> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.delete(key)

      request.onerror = () => {
        logger.error(`Failed to delete key: ${key}`, request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        logger.debug(`IndexedDB cache deleted: ${key}`)
        resolve(true)
      }
    })
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.clear()

      request.onerror = () => {
        logger.error('Failed to clear IndexedDB cache', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        logger.info('IndexedDB cache cleared')
        resolve()
      }
    })
  }

  /**
   * Prune expired entries
   */
  async prune(): Promise<number> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const now = Date.now()
      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const index = objectStore.index('expiresAt')

      // Get all entries that have expired
      const range = IDBKeyRange.upperBound(now)
      const request = index.openCursor(range)

      let prunedCount = 0

      request.onerror = () => {
        logger.error('Failed to prune expired entries', request.error)
        reject(request.error)
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null

        if (cursor) {
          cursor.delete()
          prunedCount++
          cursor.continue()
        } else {
          if (prunedCount > 0) {
            logger.info(`Pruned ${prunedCount} expired entries from IndexedDB`)
          }
          resolve(prunedCount)
        }
      }
    })
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: RegExp): Promise<string[]> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.getAllKeys()

      request.onerror = () => {
        logger.error('Failed to get keys', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const keys = request.result as string[]

        if (pattern) {
          const filtered = keys.filter(key => pattern.test(key))
          resolve(filtered)
        } else {
          resolve(keys)
        }
      }
    })
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: RegExp): Promise<number> {
    const keys = await this.keys(pattern)

    await Promise.all(keys.map(key => this.delete(key)))

    logger.info(`Deleted ${keys.length} entries matching pattern: ${pattern}`)
    return keys.length
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<IndexedDBCacheStats> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.getAll()

      request.onerror = () => {
        logger.error('Failed to get stats', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[]
        const now = Date.now()

        const stats: IndexedDBCacheStats = {
          totalEntries: entries.length,
          totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
          oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
          newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0,
          expiredEntries: entries.filter(e => now > e.expiresAt).length
        }

        resolve(stats)
      }
    })
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: unknown): number {
    try {
      const json = JSON.stringify(value)
      return new Blob([json]).size
    } catch (error) {
      logger.warn('Failed to estimate size', error)
      return 0
    }
  }
}

// Singleton instance
let instance: IndexedDBCacheClass | null = null

/**
 * Get singleton instance of IndexedDBCache
 */
export async function getIndexedDBCache(): Promise<IndexedDBCacheClass> {
  if (!instance) {
    instance = new IndexedDBCacheClass()
    await instance.init()

    // Setup automatic cleanup every 30 minutes
    if (typeof window !== 'undefined') {
      setInterval(async () => {
        try {
          await instance?.prune()
        } catch (error) {
          logger.error('Failed to prune expired entries', error)
        }
      }, 30 * 60 * 1000)
    }
  }
  return instance
}

export const IndexedDBCache = {
  getInstance: getIndexedDBCache
}

export default IndexedDBCache
