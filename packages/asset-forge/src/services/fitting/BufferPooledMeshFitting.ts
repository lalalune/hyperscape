/**
 * Buffer-Pooled Mesh Fitting Wrapper
 * Wraps MeshFittingService methods to use buffer pooling
 */

import { bufferPool, acquireFloat32, acquireUint32, releaseBuffer, releaseBuffers } from '../BufferPool'

/**
 * Helper class to manage pooled buffers for mesh fitting operations
 */
export class BufferPooledMeshFitting {
  /**
   * Create a pooled displacement buffer
   */
  static createDisplacementBuffer(vertexCount: number): Float32Array {
    return acquireFloat32(vertexCount * 3)
  }

  /**
   * Create a pooled position buffer
   */
  static createPositionBuffer(vertexCount: number): Float32Array {
    return acquireFloat32(vertexCount * 3)
  }

  /**
   * Create a pooled normal buffer
   */
  static createNormalBuffer(vertexCount: number): Float32Array {
    return acquireFloat32(vertexCount * 3)
  }

  /**
   * Create a pooled index buffer
   */
  static createIndexBuffer(indexCount: number): Uint32Array {
    return acquireUint32(indexCount)
  }

  /**
   * Create pooled skin weight buffers (4 weights per vertex)
   */
  static createSkinWeightBuffers(vertexCount: number): {
    indices: Float32Array
    weights: Float32Array
  } {
    return {
      indices: acquireFloat32(vertexCount * 4),
      weights: acquireFloat32(vertexCount * 4)
    }
  }

  /**
   * Release a single buffer back to pool
   */
  static releaseBuffer(buffer: Float32Array | Uint32Array): void {
    releaseBuffer(buffer)
  }

  /**
   * Release multiple buffers back to pool
   */
  static releaseBuffers(...buffers: (Float32Array | Uint32Array)[]): void {
    releaseBuffers(...buffers)
  }

  /**
   * Execute a function with automatic buffer cleanup
   */
  static async withBuffers<T>(
    fn: (pool: typeof BufferPooledMeshFitting) => T | Promise<T>
  ): Promise<T> {
    const acquiredBuffers: (Float32Array | Uint32Array)[] = []

    // Create a proxy that tracks all buffer acquisitions
    const trackingPool = new Proxy(BufferPooledMeshFitting, {
      get(target, prop) {
        const value = target[prop as keyof typeof BufferPooledMeshFitting]

        // Track buffer creation methods
        if (
          prop === 'createDisplacementBuffer' ||
          prop === 'createPositionBuffer' ||
          prop === 'createNormalBuffer' ||
          prop === 'createIndexBuffer'
        ) {
          return (...args: never[]) => {
            const buffer = (value as CallableFunction)(...args) as Float32Array | Uint32Array
            acquiredBuffers.push(buffer)
            return buffer
          }
        }

        // Track skin weight buffer creation
        if (prop === 'createSkinWeightBuffers') {
          return (...args: never[]) => {
            const result = (value as CallableFunction)(...args) as {
              indices: Float32Array
              weights: Float32Array
            }
            acquiredBuffers.push(result.indices, result.weights)
            return result
          }
        }

        return value
      }
    })

    try {
      return await fn(trackingPool)
    } finally {
      // Automatically release all acquired buffers
      if (acquiredBuffers.length > 0) {
        releaseBuffers(...acquiredBuffers)
      }
    }
  }

  /**
   * Copy Float32Array data using pooled temporary buffer
   */
  static copyFloat32Array(source: Float32Array): Float32Array {
    const copy = acquireFloat32(source.length)
    copy.set(source)
    return copy
  }

  /**
   * Get pool statistics
   */
  static getPoolStats(): void {
    bufferPool.logStats()
  }

  /**
   * Clear the buffer pool
   */
  static clearPool(): void {
    bufferPool.clear()
  }

  /**
   * Reset pool statistics
   */
  static resetPoolStats(): void {
    bufferPool.resetStats()
  }
}
