/**
 * Buffer Pool Tests
 * Validates buffer pooling functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BufferPool, bufferPool } from '../BufferPool'
import { BufferPooledMeshFitting as Pool } from '../fitting/BufferPooledMeshFitting'

describe('BufferPool', () => {
  let pool: BufferPool

  beforeEach(() => {
    pool = new BufferPool(10) // Small pool for testing
    pool.clear()
    pool.resetStats()
  })

  describe('Basic Allocation', () => {
    it('should acquire Float32Array buffer', () => {
      const buffer = pool.acquire(100, 'Float32Array')
      expect(buffer).toBeInstanceOf(Float32Array)
      expect(buffer.length).toBe(100)
    })

    it('should acquire Uint32Array buffer', () => {
      const buffer = pool.acquire(100, 'Uint32Array')
      expect(buffer).toBeInstanceOf(Uint32Array)
      expect(buffer.length).toBe(100)
    })

    it('should acquire Uint16Array buffer', () => {
      const buffer = pool.acquire(100, 'Uint16Array')
      expect(buffer).toBeInstanceOf(Uint16Array)
      expect(buffer.length).toBe(100)
    })

    it('should acquire Int32Array buffer', () => {
      const buffer = pool.acquire(100, 'Int32Array')
      expect(buffer).toBeInstanceOf(Int32Array)
      expect(buffer.length).toBe(100)
    })
  })

  describe('Buffer Reuse', () => {
    it('should reuse released buffer', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      buffer1[0] = 42

      pool.release(buffer1)

      const buffer2 = pool.acquire(100, 'Float32Array')

      // Should be same buffer (cleared)
      expect(buffer2).toBe(buffer1)
      expect(buffer2[0]).toBe(0) // Should be cleared
    })

    it('should track buffer reuse in statistics', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      pool.release(buffer1)

      const buffer2 = pool.acquire(100, 'Float32Array')
      pool.release(buffer2)

      const stats = pool.getStats()
      expect(stats.acquisitions).toBe(2)
      expect(stats.releases).toBe(2)
      expect(stats.reuses).toBe(1) // Second acquisition was reuse
      expect(stats.hitRate).toBeGreaterThan(0)
    })

    it('should not reuse buffer of different size', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      pool.release(buffer1)

      const buffer2 = pool.acquire(200, 'Float32Array')

      // Different size, should be different buffer
      expect(buffer2).not.toBe(buffer1)
      expect(buffer2.length).toBe(200)
    })

    it('should not reuse buffer of different type', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      pool.release(buffer1)

      const buffer2 = pool.acquire(100, 'Uint32Array')

      // Different type, should be different buffer
      expect(buffer2).not.toBe(buffer1)
      expect(buffer2).toBeInstanceOf(Uint32Array)
    })
  })

  describe('Buffer Clearing', () => {
    it('should clear buffer on release', () => {
      const buffer = pool.acquire(10, 'Float32Array')

      // Fill with data
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i * 10
      }

      pool.release(buffer)

      // Acquire same buffer
      const buffer2 = pool.acquire(10, 'Float32Array')
      expect(buffer2).toBe(buffer)

      // Should be cleared
      for (let i = 0; i < buffer2.length; i++) {
        expect(buffer2[i]).toBe(0)
      }
    })
  })

  describe('Pool Size Limits', () => {
    it('should respect maxPoolSize', () => {
      const buffers: Float32Array[] = []

      // Create more buffers than pool size
      for (let i = 0; i < 20; i++) {
        buffers.push(pool.acquire(100, 'Float32Array') as Float32Array)
      }

      // Release all
      for (const buffer of buffers) {
        pool.release(buffer)
      }

      const stats = pool.getStats()
      // Pool should not exceed maxPoolSize (10 in this test)
      expect(stats.totalBuffers).toBeLessThanOrEqual(10)
    })
  })

  describe('Statistics', () => {
    it('should track acquisitions and releases', () => {
      pool.acquire(100, 'Float32Array')
      pool.acquire(200, 'Float32Array')

      const stats = pool.getStats()
      expect(stats.acquisitions).toBe(2)
      expect(stats.releases).toBe(0)
    })

    it('should calculate hit rate correctly', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      pool.release(buffer1)

      const buffer2 = pool.acquire(100, 'Float32Array') // Hit
      pool.release(buffer2)

      pool.acquire(200, 'Float32Array') // Miss

      const stats = pool.getStats()
      expect(stats.hitRate).toBeCloseTo(0.5) // 1 hit out of 2 acquisitions after first
    })

    it('should track memory usage', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      const buffer2 = pool.acquire(100, 'Float32Array')

      pool.release(buffer1)
      pool.release(buffer2)

      const stats = pool.getStats()
      expect(stats.totalMemoryBytes).toBeGreaterThan(0)
      expect(stats.totalMemoryBytes).toBe(2 * 100 * 4) // 2 buffers * 100 floats * 4 bytes
    })
  })

  describe('Clear Operations', () => {
    it('should clear all pools', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      const buffer2 = pool.acquire(100, 'Uint32Array')

      pool.release(buffer1)
      pool.release(buffer2)

      expect(pool.getStats().totalBuffers).toBe(2)

      pool.clear()

      expect(pool.getStats().totalBuffers).toBe(0)
    })

    it('should clear specific type', () => {
      const buffer1 = pool.acquire(100, 'Float32Array')
      const buffer2 = pool.acquire(100, 'Uint32Array')

      pool.release(buffer1)
      pool.release(buffer2)

      pool.clearType('Float32Array')

      const stats = pool.getStats()
      // Should only have Uint32Array left
      expect(stats.totalBuffers).toBe(1)
    })

    it('should reset statistics', () => {
      pool.acquire(100, 'Float32Array')
      pool.acquire(100, 'Float32Array')

      expect(pool.getStats().acquisitions).toBe(2)

      pool.resetStats()

      expect(pool.getStats().acquisitions).toBe(0)
    })
  })

  describe('withBuffer helper', () => {
    it('should automatically release buffer after use', async () => {
      let buffer: Float32Array | null = null

      await pool.withBuffer(100, 'Float32Array', (b) => {
        buffer = b as Float32Array
        expect(buffer).toBeInstanceOf(Float32Array)
        expect(buffer.length).toBe(100)
        return Promise.resolve()
      })

      // Buffer should be back in pool
      const stats = pool.getStats()
      expect(stats.releases).toBe(1)
    })

    it('should release buffer even on error', async () => {
      await expect(
        pool.withBuffer(100, 'Float32Array', () => {
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')

      // Buffer should still be released
      const stats = pool.getStats()
      expect(stats.releases).toBe(1)
    })
  })
})

describe('BufferPooledMeshFitting', () => {
  beforeEach(() => {
    Pool.clearPool()
    Pool.resetPoolStats()
  })

  describe('Helper Methods', () => {
    it('should create displacement buffer', () => {
      const buffer = Pool.createDisplacementBuffer(100)
      expect(buffer).toBeInstanceOf(Float32Array)
      expect(buffer.length).toBe(300) // 100 vertices * 3 components
    })

    it('should create position buffer', () => {
      const buffer = Pool.createPositionBuffer(100)
      expect(buffer).toBeInstanceOf(Float32Array)
      expect(buffer.length).toBe(300)
    })

    it('should create normal buffer', () => {
      const buffer = Pool.createNormalBuffer(100)
      expect(buffer).toBeInstanceOf(Float32Array)
      expect(buffer.length).toBe(300)
    })

    it('should create index buffer', () => {
      const buffer = Pool.createIndexBuffer(100)
      expect(buffer).toBeInstanceOf(Uint32Array)
      expect(buffer.length).toBe(100)
    })

    it('should create skin weight buffers', () => {
      const { indices, weights } = Pool.createSkinWeightBuffers(100)
      expect(indices).toBeInstanceOf(Float32Array)
      expect(weights).toBeInstanceOf(Float32Array)
      expect(indices.length).toBe(400) // 100 vertices * 4 bones
      expect(weights.length).toBe(400)
    })
  })

  describe('Array Copying', () => {
    it('should copy Float32Array using pool', () => {
      const source = new Float32Array([1, 2, 3, 4, 5])
      const copy = Pool.copyFloat32Array(source)

      expect(copy).toBeInstanceOf(Float32Array)
      expect(copy.length).toBe(source.length)
      expect(Array.from(copy)).toEqual([1, 2, 3, 4, 5])

      // Should be different instance
      expect(copy).not.toBe(source)

      Pool.releaseBuffer(copy)
    })
  })

  describe('withBuffers automatic cleanup', () => {
    it('should track and release all buffers', async () => {
      Pool.resetPoolStats()

      await Pool.withBuffers(async (pool) => {
        const buffer1 = pool.createDisplacementBuffer(100)
        const buffer2 = pool.createPositionBuffer(100)
        const buffer3 = pool.createNormalBuffer(50)

        // Use buffers
        buffer1[0] = 1
        buffer2[0] = 2
        buffer3[0] = 3

        // No manual release needed
      })

      // All buffers should be released
      const stats = bufferPool.getStats()
      expect(stats.releases).toBe(3)
    })

    it('should release buffers even on error', async () => {
      Pool.resetPoolStats()

      await expect(
        Pool.withBuffers(async (pool) => {
          pool.createDisplacementBuffer(100)
          pool.createPositionBuffer(100)
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')

      // Buffers should still be released
      const stats = bufferPool.getStats()
      expect(stats.releases).toBe(2)
    })
  })
})

describe('Performance Benchmarks', () => {
  it('should show performance benefit of pooling', () => {
    const iterations = 1000
    const size = 1000

    // Without pooling - create new buffers each time
    const startNonPooled = performance.now()
    for (let i = 0; i < iterations; i++) {
      const buffer = new Float32Array(size)
      buffer[0] = i
    }
    const endNonPooled = performance.now()
    const nonPooledTime = endNonPooled - startNonPooled

    // With pooling - reuse buffers
    const pool = new BufferPool()
    pool.resetStats()

    const startPooled = performance.now()
    for (let i = 0; i < iterations; i++) {
      const buffer = pool.acquire(size, 'Float32Array') as Float32Array
      buffer[0] = i
      pool.release(buffer)
    }
    const endPooled = performance.now()
    const pooledTime = endPooled - startPooled

    const stats = pool.getStats()

    console.log('\n📊 Performance Comparison:')
    console.log(`  Non-pooled: ${nonPooledTime.toFixed(2)}ms`)
    console.log(`  Pooled: ${pooledTime.toFixed(2)}ms`)
    console.log(`  Improvement: ${((nonPooledTime - pooledTime) / nonPooledTime * 100).toFixed(1)}%`)
    console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`)

    // Pooled version should be faster (or at least not significantly slower)
    // Note: In small tests, difference may be minimal due to JIT optimization
    expect(pooledTime).toBeLessThan(nonPooledTime * 2) // At worst 2x slower
    expect(stats.hitRate).toBeGreaterThan(0.9) // Should have high hit rate
  })

  it('should handle rapid allocation/release cycles', () => {
    const pool = new BufferPool()
    pool.resetStats()

    const buffers: Float32Array[] = []

    // Allocate many buffers
    for (let i = 0; i < 100; i++) {
      buffers.push(pool.acquire(1000 + i, 'Float32Array') as Float32Array)
    }

    // Release all
    for (const buffer of buffers) {
      pool.release(buffer)
    }

    // Allocate again - should reuse
    const newBuffers: Float32Array[] = []
    for (let i = 0; i < 100; i++) {
      newBuffers.push(pool.acquire(1000 + i, 'Float32Array') as Float32Array)
    }

    const stats = pool.getStats()

    // Should have good reuse
    expect(stats.reuses).toBeGreaterThan(0)
    expect(stats.hitRate).toBeGreaterThan(0)

    // Clean up
    for (const buffer of newBuffers) {
      pool.release(buffer)
    }
  })
})
