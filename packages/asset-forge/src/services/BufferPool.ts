/**
 * Buffer Pool Service
 * Manages pooling of TypedArrays to reduce memory allocations and GC pressure
 * during intensive mesh operations
 */

export type PoolableArrayType = 'Float32Array' | 'Uint32Array' | 'Uint16Array' | 'Int32Array'
export type TypedArrayType = Float32Array | Uint32Array | Uint16Array | Int32Array

export interface PoolStats {
  totalBuffers: number
  totalMemoryBytes: number
  poolsByType: Map<string, PoolTypeStats>
  hitRate: number
  missRate: number
  acquisitions: number
  releases: number
  reuses: number
}

export interface PoolTypeStats {
  type: string
  size: number
  count: number
  memoryBytes: number
}

/**
 * Size categories for buffer pooling
 */
const BufferSizeCategory = {
  SMALL: 'small' as const,    // < 1KB (256 floats)
  MEDIUM: 'medium' as const,  // 1KB - 100KB (256 - 25600 floats)
  LARGE: 'large' as const,    // 100KB - 1MB (25600 - 256000 floats)
  XLARGE: 'xlarge' as const   // > 1MB
}

type BufferSizeCategoryType = typeof BufferSizeCategory[keyof typeof BufferSizeCategory]

/**
 * BufferPool manages typed array allocations with automatic pooling
 */
export class BufferPool {
  private pools: Map<string, TypedArrayType[]> = new Map()
  private readonly maxPoolSize: number
  private readonly maxBufferAge: number = 60000 // 60 seconds

  // Statistics
  private acquisitions = 0
  private releases = 0
  private reuses = 0
  private misses = 0

  // Tracking for cleanup
  private bufferTimestamps: Map<TypedArrayType, number> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(maxPoolSize: number = 100) {
    this.maxPoolSize = maxPoolSize
    this.startCleanupTimer()
  }

  /**
   * Acquire a buffer from the pool or create a new one
   */
  acquire(size: number, type: PoolableArrayType = 'Float32Array'): TypedArrayType {
    this.acquisitions++

    const category = this.getSizeCategory(size, type)
    const key = `${type}_${category}_${size}`
    const pool = this.pools.get(key) || []

    if (pool.length > 0) {
      const buffer = pool.pop()!
      this.reuses++
      this.bufferTimestamps.delete(buffer)
      return buffer
    }

    // Pool miss - create new buffer
    this.misses++
    return this.createBuffer(size, type)
  }

  /**
   * Release a buffer back to the pool
   */
  release(buffer: TypedArrayType): void {
    this.releases++

    const type = buffer.constructor.name as PoolableArrayType
    const size = buffer.length
    const category = this.getSizeCategory(size, type)
    const key = `${type}_${category}_${size}`

    const pool = this.pools.get(key) || []

    // Only pool if under limit
    if (pool.length < this.maxPoolSize) {
      // Clear buffer before returning to pool
      buffer.fill(0)
      pool.push(buffer)
      this.pools.set(key, pool)
      this.bufferTimestamps.set(buffer, Date.now())
    }
    // Otherwise let it be garbage collected
  }

  /**
   * Release multiple buffers at once
   */
  releaseAll(buffers: TypedArrayType[]): void {
    for (const buffer of buffers) {
      this.release(buffer)
    }
  }

  /**
   * Acquire and automatically release a buffer after use
   */
  async withBuffer<T>(
    size: number,
    type: PoolableArrayType,
    fn: (buffer: TypedArrayType) => T | Promise<T>
  ): Promise<T> {
    const buffer = this.acquire(size, type)
    try {
      return await fn(buffer)
    } finally {
      this.release(buffer)
    }
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.pools.clear()
    this.bufferTimestamps.clear()
    this.resetStats()
  }

  /**
   * Clear pools of a specific type
   */
  clearType(type: PoolableArrayType): void {
    const keysToDelete: string[] = []

    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(type)) {
        // Remove timestamps for these buffers
        for (const buffer of pool) {
          this.bufferTimestamps.delete(buffer)
        }
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.pools.delete(key)
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let totalBuffers = 0
    let totalMemoryBytes = 0
    const poolsByType = new Map<string, PoolTypeStats>()

    for (const [key, pool] of this.pools.entries()) {
      totalBuffers += pool.length

      if (pool.length > 0) {
        const sample = pool[0]
        const bytesPerElement = sample.BYTES_PER_ELEMENT
        const memoryBytes = pool.reduce((sum, buf) => sum + buf.length * bytesPerElement, 0)
        totalMemoryBytes += memoryBytes

        const [type, category, size] = key.split('_')
        const typeKey = `${type}_${category}`

        if (!poolsByType.has(typeKey)) {
          poolsByType.set(typeKey, {
            type: typeKey,
            size: parseInt(size, 10),
            count: pool.length,
            memoryBytes
          })
        } else {
          const stats = poolsByType.get(typeKey)!
          stats.count += pool.length
          stats.memoryBytes += memoryBytes
        }
      }
    }

    const hitRate = this.acquisitions > 0 ? this.reuses / this.acquisitions : 0
    const missRate = this.acquisitions > 0 ? this.misses / this.acquisitions : 0

    return {
      totalBuffers,
      totalMemoryBytes,
      poolsByType,
      hitRate,
      missRate,
      acquisitions: this.acquisitions,
      releases: this.releases,
      reuses: this.reuses
    }
  }

  /**
   * Log current pool statistics
   */
  logStats(): void {
    const stats = this.getStats()

    console.log('📊 Buffer Pool Statistics:')
    console.log(`  Total Buffers: ${stats.totalBuffers}`)
    console.log(`  Total Memory: ${(stats.totalMemoryBytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`)
    console.log(`  Miss Rate: ${(stats.missRate * 100).toFixed(1)}%`)
    console.log(`  Acquisitions: ${stats.acquisitions}`)
    console.log(`  Releases: ${stats.releases}`)
    console.log(`  Reuses: ${stats.reuses}`)

    if (stats.poolsByType.size > 0) {
      console.log('  Pools by Type:')
      for (const [key, typeStats] of stats.poolsByType.entries()) {
        console.log(`    ${key}: ${typeStats.count} buffers, ${(typeStats.memoryBytes / 1024).toFixed(1)} KB`)
      }
    }
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.acquisitions = 0
    this.releases = 0
    this.reuses = 0
    this.misses = 0
  }

  /**
   * Clean up old buffers that haven't been used recently
   */
  private cleanup(): void {
    const now = Date.now()
    const buffersToRemove: TypedArrayType[] = []

    for (const [buffer, timestamp] of this.bufferTimestamps.entries()) {
      if (now - timestamp > this.maxBufferAge) {
        buffersToRemove.push(buffer)
      }
    }

    // Remove old buffers from pools
    for (const buffer of buffersToRemove) {
      const type = buffer.constructor.name as PoolableArrayType
      const size = buffer.length
      const category = this.getSizeCategory(size, type)
      const key = `${type}_${category}_${size}`

      const pool = this.pools.get(key)
      if (pool) {
        const index = pool.indexOf(buffer)
        if (index >= 0) {
          pool.splice(index, 1)
        }

        if (pool.length === 0) {
          this.pools.delete(key)
        }
      }

      this.bufferTimestamps.delete(buffer)
    }

    if (buffersToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${buffersToRemove.length} old buffers from pool`)
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    // Clean up every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000)

    // Prevent interval from keeping process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }

  /**
   * Create a new typed array buffer
   */
  private createBuffer(size: number, type: PoolableArrayType): TypedArrayType {
    switch (type) {
      case 'Float32Array':
        return new Float32Array(size)
      case 'Uint32Array':
        return new Uint32Array(size)
      case 'Uint16Array':
        return new Uint16Array(size)
      case 'Int32Array':
        return new Int32Array(size)
      default:
        throw new Error(`Unknown buffer type: ${type}`)
    }
  }

  /**
   * Determine size category for a buffer
   */
  private getSizeCategory(size: number, type: PoolableArrayType): BufferSizeCategoryType {
    // Calculate bytes
    const bytesPerElement = this.getBytesPerElement(type)
    const bytes = size * bytesPerElement

    if (bytes < 1024) {
      return BufferSizeCategory.SMALL
    } else if (bytes < 102400) {
      return BufferSizeCategory.MEDIUM
    } else if (bytes < 1048576) {
      return BufferSizeCategory.LARGE
    } else {
      return BufferSizeCategory.XLARGE
    }
  }

  /**
   * Get bytes per element for a type
   */
  private getBytesPerElement(type: PoolableArrayType): number {
    switch (type) {
      case 'Float32Array':
      case 'Uint32Array':
      case 'Int32Array':
        return 4
      case 'Uint16Array':
        return 2
      default:
        return 4
    }
  }
}

// Global singleton instance
export const bufferPool = new BufferPool()

// Export helper functions
export function acquireFloat32(size: number): Float32Array {
  return bufferPool.acquire(size, 'Float32Array') as Float32Array
}

export function acquireUint32(size: number): Uint32Array {
  return bufferPool.acquire(size, 'Uint32Array') as Uint32Array
}

export function acquireUint16(size: number): Uint16Array {
  return bufferPool.acquire(size, 'Uint16Array') as Uint16Array
}

export function acquireInt32(size: number): Int32Array {
  return bufferPool.acquire(size, 'Int32Array') as Int32Array
}

export function releaseBuffer(buffer: TypedArrayType): void {
  bufferPool.release(buffer)
}

export function releaseBuffers(...buffers: TypedArrayType[]): void {
  bufferPool.releaseAll(buffers)
}
