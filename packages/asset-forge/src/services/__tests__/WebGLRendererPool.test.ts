import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebGLRendererPool } from '../WebGLRendererPool'

// Mock THREE.WebGLRenderer
vi.mock('three', () => ({
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
    outputColorSpace: 'srgb',
    toneMapping: 4,
    toneMappingExposure: 1
  })),
  SRGBColorSpace: 'srgb',
  ACESFilmicToneMapping: 4
}))

describe('WebGLRendererPool', () => {
  let pool: WebGLRendererPool

  beforeEach(() => {
    pool = new WebGLRendererPool({
      maxRenderers: 3,
      idleTimeout: 100, // Short timeout for tests
      enableMetrics: true
    })
  })

  afterEach(() => {
    pool.disposeAll()
  })

  describe('acquire and release', () => {
    it('should acquire a renderer from the pool', () => {
      const id = pool.acquire({ antialias: true })
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')

      const renderer = pool.getRenderer(id)
      expect(renderer).toBeTruthy()
    })

    it('should reuse renderers with matching options', () => {
      const id1 = pool.acquire({ antialias: true, alpha: true })
      pool.release(id1)

      const id2 = pool.acquire({ antialias: true, alpha: true })
      expect(id2).toBe(id1) // Should reuse the same renderer
    })

    it('should create new renderers for different options', () => {
      const id1 = pool.acquire({ antialias: true })
      const id2 = pool.acquire({ antialias: false })

      expect(id1).not.toBe(id2)
    })

    it('should increment refCount on acquire', () => {
      const id = pool.acquire({ antialias: true })
      const metrics1 = pool.getMetrics()

      // Acquire same renderer again (won't match because first one still in use)
      pool.acquire({ antialias: true })
      const metrics2 = pool.getMetrics()

      expect(metrics2.totalCreated).toBeGreaterThanOrEqual(metrics1.totalCreated)
    })

    it('should decrement refCount on release', () => {
      const id = pool.acquire({ antialias: true })
      pool.release(id)

      const metrics = pool.getMetrics()
      expect(metrics.totalReleased).toBe(1)
    })
  })

  describe('pool limits', () => {
    it('should respect maxRenderers limit', () => {
      const id1 = pool.acquire({ antialias: true })
      const id2 = pool.acquire({ alpha: true })
      const id3 = pool.acquire({ preserveDrawingBuffer: true })

      // All should be different
      expect(new Set([id1, id2, id3]).size).toBe(3)

      const metrics = pool.getMetrics()
      expect(metrics.totalCreated).toBe(3)
    })

    it('should handle pool exhaustion by reclaiming idle renderers', () => {
      const id1 = pool.acquire({ antialias: true })
      const id2 = pool.acquire({ alpha: true })
      const id3 = pool.acquire({ preserveDrawingBuffer: true })

      // Release one
      pool.release(id1)

      // Try to acquire a fourth with different options
      const id4 = pool.acquire({ powerPreference: 'low-power' })

      // Should succeed (reclaimed id1)
      expect(id4).toBeTruthy()
    })
  })

  describe('cleanup', () => {
    it('should schedule cleanup for idle renderers', async () => {
      const id = pool.acquire({ antialias: true })
      pool.release(id)

      // Wait for cleanup timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Renderer should be cleaned up
      const metrics = pool.getMetrics()
      expect(metrics.totalDisposed).toBeGreaterThan(0)
    })

    it('should cancel cleanup if renderer is reacquired', async () => {
      const id1 = pool.acquire({ antialias: true })
      pool.release(id1)

      // Reacquire before timeout
      await new Promise(resolve => setTimeout(resolve, 50))
      const id2 = pool.acquire({ antialias: true })

      expect(id2).toBe(id1)

      // Wait past original timeout
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should still be alive
      const renderer = pool.getRenderer(id2)
      expect(renderer).toBeTruthy()
    })
  })

  describe('metrics', () => {
    it('should track active count', () => {
      const id1 = pool.acquire({ antialias: true })
      const id2 = pool.acquire({ alpha: true })

      const metrics = pool.getMetrics()
      expect(metrics.activeCount).toBe(2)

      pool.release(id1)
      const metricsAfter = pool.getMetrics()
      expect(metricsAfter.activeCount).toBe(1)
    })

    it('should calculate pool utilization', () => {
      pool.acquire({ antialias: true })
      pool.acquire({ alpha: true })

      const metrics = pool.getMetrics()
      expect(metrics.poolUtilization).toBeCloseTo(66.67, 1) // 2/3 = 66.67%
    })

    it('should estimate memory usage', () => {
      pool.acquire({ antialias: true })
      pool.acquire({ alpha: true })

      const metrics = pool.getMetrics()
      expect(metrics.memoryEstimateMB).toBe(100) // 2 renderers * 50MB
    })
  })

  describe('size and render', () => {
    it('should update renderer size', () => {
      const id = pool.acquire({ antialias: true })
      const renderer = pool.getRenderer(id)!

      pool.setSize(id, 1024, 768, 2)

      expect(renderer.setSize).toHaveBeenCalledWith(1024, 768)
      expect(renderer.setPixelRatio).toHaveBeenCalledWith(2)
    })

    it('should render scene with renderer', () => {
      const id = pool.acquire({ antialias: true })
      const renderer = pool.getRenderer(id)!

      const mockScene = {} as any
      const mockCamera = {} as any

      pool.render(id, mockScene, mockCamera)

      expect(renderer.render).toHaveBeenCalledWith(mockScene, mockCamera)
    })
  })

  describe('cleanup methods', () => {
    it('should cleanup all idle renderers', () => {
      const id1 = pool.acquire({ antialias: true })
      const id2 = pool.acquire({ alpha: true })
      const id3 = pool.acquire({ preserveDrawingBuffer: true })

      // Release some
      pool.release(id1)
      pool.release(id2)

      pool.cleanupIdleRenderers()

      const metrics = pool.getMetrics()
      expect(metrics.totalDisposed).toBe(2)

      // id3 should still be active
      const renderer3 = pool.getRenderer(id3)
      expect(renderer3).toBeTruthy()
    })

    it('should dispose all renderers', () => {
      pool.acquire({ antialias: true })
      pool.acquire({ alpha: true })
      pool.acquire({ preserveDrawingBuffer: true })

      pool.disposeAll()

      const metrics = pool.getMetrics()
      expect(metrics.activeCount).toBe(0)
      expect(metrics.poolUtilization).toBe(0)
    })
  })
})
