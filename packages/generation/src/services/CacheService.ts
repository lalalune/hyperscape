/**
 * Cache Service
 * Handles caching of generation results and intermediate outputs
 */

import NodeCache from 'node-cache'
import { CacheEntry } from '../types'

export interface CacheConfig {
  enabled: boolean
  ttl: number // Time to live in seconds
  maxSize: number // Max cache size in MB
  checkPeriod?: number // Interval to check for expired items
}

export class CacheService {
  private cache: NodeCache
  private config: CacheConfig
  private currentSize: number = 0

  constructor(config: CacheConfig) {
    this.config = config
    this.cache = new NodeCache({
      stdTTL: config.ttl,
      checkperiod: config.checkPeriod || 600,
      useClones: false
    })

    // Monitor cache size
    this.cache.on('set', (key: string, value: any) => {
      this.currentSize += this.estimateSize(value)
      this.enforceMaxSize()
    })

    this.cache.on('del', (key: string, value: any) => {
      this.currentSize -= this.estimateSize(value)
    })
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null
    
    try {
      return this.cache.get<T>(key) || null
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Set item in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) return
    
    try {
      this.cache.set(key, value, ttl || this.config.ttl)
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
    }
  }

  /**
   * Delete item from cache
   */
  async delete(key: string): Promise<void> {
    try {
      this.cache.del(key)
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.flushAll()
    this.currentSize = 0
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      size: this.currentSize,
      maxSize: this.config.maxSize * 1024 * 1024
    }
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Get all keys matching pattern
   */
  getKeys(pattern?: string): string[] {
    const allKeys = this.cache.keys()
    if (!pattern) return allKeys
    
    const regex = new RegExp(pattern)
    return allKeys.filter((key: string) => regex.test(key))
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2 // Unicode chars
    }
    
    try {
      return JSON.stringify(value).length * 2
    } catch {
      return 1024 // Default 1KB for non-serializable objects
    }
  }

  /**
   * Enforce maximum cache size
   */
  private enforceMaxSize(): void {
    const maxBytes = this.config.maxSize * 1024 * 1024
    
    if (this.currentSize <= maxBytes) return
    
    // Remove oldest entries until size is under limit
    const keys = this.cache.keys()
    const entries: Array<{ key: string; created: number }> = []
    
    for (const key of keys) {
      const ttl = this.cache.getTtl(key)
      if (ttl) {
        entries.push({ 
          key, 
          created: Date.now() - (this.config.ttl * 1000 - ttl) 
        })
      }
    }
    
    // Sort by creation time (oldest first)
    entries.sort((a, b) => a.created - b.created)
    
    // Remove oldest entries
    for (const entry of entries) {
      if (this.currentSize <= maxBytes) break
      this.cache.del(entry.key)
    }
  }
} 