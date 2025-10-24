import { ACESFilmicToneMapping, Camera, SRGBColorSpace, Scene, WebGLRenderer } from 'three'
import { createLogger } from '../utils/logger.ts'

const logger = createLogger('WebGLRendererPool')

export interface RendererOptions {
  antialias?: boolean
  alpha?: boolean
  preserveDrawingBuffer?: boolean
  powerPreference?: 'default' | 'high-performance' | 'low-power'
  width?: number
  height?: number
  pixelRatio?: number
}

export interface RendererMetrics {
  activeCount: number
  totalCreated: number
  totalReleased: number
  totalDisposed: number
  poolUtilization: number
  memoryEstimateMB: number
}

interface RendererEntry {
  id: string
  renderer: WebGLRenderer
  refCount: number
  lastUsed: number
  options: RendererOptions
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

/**
 * WebGL Renderer Pool - Manages a shared pool of WebGL renderers to prevent
 * "Too many active WebGL contexts" errors and reduce memory usage.
 *
 * Features:
 * - Automatic renderer reuse across components
 * - Reference counting for safe disposal
 * - Idle timeout cleanup (30s default)
 * - Performance monitoring and metrics
 * - Fallback handling for pool exhaustion
 */
export class WebGLRendererPool {
  private renderers: Map<string, RendererEntry> = new Map()
  private readonly maxRenderers: number
  private readonly idleTimeout: number
  private readonly enableMetrics: boolean
  private metrics: RendererMetrics = {
    activeCount: 0,
    totalCreated: 0,
    totalReleased: 0,
    totalDisposed: 0,
    poolUtilization: 0,
    memoryEstimateMB: 0
  }

  constructor(options: {
    maxRenderers?: number
    idleTimeout?: number
    enableMetrics?: boolean
  } = {}) {
    this.maxRenderers = options.maxRenderers || 4
    this.idleTimeout = options.idleTimeout || 30000 // 30 seconds
    this.enableMetrics = options.enableMetrics !== false

    logger.debug(`WebGLRendererPool initialized: maxRenderers=${this.maxRenderers}, idleTimeout=${this.idleTimeout}ms`)
  }

  /**
   * Acquire a renderer from the pool. Creates a new one if needed and pool limit not reached.
   * Returns a unique ID for this renderer instance.
   */
  acquire(options: RendererOptions = {}): string {
    // Try to find a compatible renderer
    const compatibleId = this.findCompatibleRenderer(options)

    if (compatibleId) {
      const entry = this.renderers.get(compatibleId)!
      entry.refCount++
      entry.lastUsed = Date.now()

      // Cancel any pending cleanup
      if (entry.cleanupTimer) {
        clearTimeout(entry.cleanupTimer)
        entry.cleanupTimer = null
      }

      logger.debug(`Reusing renderer ${compatibleId} (refCount: ${entry.refCount})`)
      this.updateMetrics()
      return compatibleId
    }

    // Create new renderer if under limit
    if (this.renderers.size < this.maxRenderers) {
      const id = this.createRenderer(options)
      logger.debug(`Created new renderer ${id} (pool size: ${this.renderers.size}/${this.maxRenderers})`)
      return id
    }

    // Pool exhausted - try to reclaim an idle renderer
    const reclaimedId = this.reclaimIdleRenderer()
    if (reclaimedId) {
      logger.warn(`Pool exhausted, reclaimed idle renderer ${reclaimedId}`)
      // Dispose and recreate with new options
      this.disposeRenderer(reclaimedId)
      return this.createRenderer(options)
    }

    // Fallback: create a temporary renderer that will be disposed immediately
    logger.error(`Pool exhausted (${this.renderers.size}/${this.maxRenderers}), creating temporary renderer`)
    return this.createRenderer(options)
  }

  /**
   * Release a renderer back to the pool. Decrements reference count and
   * schedules cleanup if no longer in use.
   */
  release(id: string): void {
    const entry = this.renderers.get(id)
    if (!entry) {
      logger.warn(`Attempted to release unknown renderer: ${id}`)
      return
    }

    entry.refCount = Math.max(0, entry.refCount - 1)
    entry.lastUsed = Date.now()

    logger.debug(`Released renderer ${id} (refCount: ${entry.refCount})`)

    // Schedule cleanup if no longer in use
    if (entry.refCount === 0 && !entry.cleanupTimer) {
      entry.cleanupTimer = setTimeout(() => {
        this.cleanupRenderer(id)
      }, this.idleTimeout)

      logger.debug(`Scheduled cleanup for renderer ${id} in ${this.idleTimeout}ms`)
    }

    this.updateMetrics()
  }

  /**
   * Get the renderer instance by ID
   */
  getRenderer(id: string): WebGLRenderer | null {
    const entry = this.renderers.get(id)
    return entry ? entry.renderer : null
  }

  /**
   * Update renderer size (useful for responsive layouts)
   */
  setSize(id: string, width: number, height: number, pixelRatio?: number): void {
    const renderer = this.getRenderer(id)
    if (renderer) {
      renderer.setSize(width, height)
      if (pixelRatio !== undefined) {
        renderer.setPixelRatio(pixelRatio)
      }
    }
  }

  /**
   * Render a scene with the specified renderer
   */
  render(id: string, scene: Scene, camera: Camera): void {
    const renderer = this.getRenderer(id)
    if (renderer) {
      renderer.render(scene, camera)
    } else {
      logger.warn(`Attempted to render with unknown renderer: ${id}`)
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): RendererMetrics {
    return { ...this.metrics }
  }

  /**
   * Force cleanup of all idle renderers (refCount === 0)
   */
  cleanupIdleRenderers(): void {
    const idleIds: string[] = []

    this.renderers.forEach((entry, id) => {
      if (entry.refCount === 0) {
        idleIds.push(id)
      }
    })

    logger.debug(`Cleaning up ${idleIds.length} idle renderers`)
    idleIds.forEach(id => this.cleanupRenderer(id))
  }

  /**
   * Dispose all renderers and clear the pool (use with caution)
   */
  disposeAll(): void {
    logger.warn('Disposing all renderers in pool')

    const ids = Array.from(this.renderers.keys())
    ids.forEach(id => {
      const entry = this.renderers.get(id)
      if (entry?.cleanupTimer) {
        clearTimeout(entry.cleanupTimer)
      }
      this.disposeRenderer(id)
    })

    this.renderers.clear()
    this.updateMetrics()
  }

  // Private methods

  private createRenderer(options: RendererOptions): string {
    const id = `renderer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const renderer = new WebGLRenderer({
      antialias: options.antialias !== false,
      alpha: options.alpha !== false,
      preserveDrawingBuffer: options.preserveDrawingBuffer || false,
      powerPreference: options.powerPreference || 'high-performance'
    })

    // Apply size and pixel ratio
    const width = options.width || 800
    const height = options.height || 600
    const pixelRatio = options.pixelRatio || Math.min(window.devicePixelRatio, 2)

    renderer.setSize(width, height)
    renderer.setPixelRatio(pixelRatio)

    // Default settings for quality
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1

    const entry: RendererEntry = {
      id,
      renderer,
      refCount: 1,
      lastUsed: Date.now(),
      options,
      cleanupTimer: null
    }

    this.renderers.set(id, entry)
    this.metrics.totalCreated++
    this.updateMetrics()

    return id
  }

  private findCompatibleRenderer(options: RendererOptions): string | null {
    // Look for a renderer with matching options and refCount === 0
    for (const [id, entry] of this.renderers.entries()) {
      if (entry.refCount === 0 && this.optionsMatch(entry.options, options)) {
        return id
      }
    }
    return null
  }

  private optionsMatch(a: RendererOptions, b: RendererOptions): boolean {
    // Match key options (ignoring size which can be changed dynamically)
    return (
      a.antialias === b.antialias &&
      a.alpha === b.alpha &&
      a.preserveDrawingBuffer === b.preserveDrawingBuffer &&
      a.powerPreference === b.powerPreference
    )
  }

  private cleanupRenderer(id: string): void {
    const entry = this.renderers.get(id)
    if (!entry) return

    // Only cleanup if still idle
    if (entry.refCount === 0) {
      logger.debug(`Cleaning up idle renderer ${id}`)

      if (entry.cleanupTimer) {
        clearTimeout(entry.cleanupTimer)
      }

      this.disposeRenderer(id)
      this.renderers.delete(id)
      this.metrics.totalDisposed++
      this.updateMetrics()
    }
  }

  private disposeRenderer(id: string): void {
    const entry = this.renderers.get(id)
    if (!entry) return

    const { renderer } = entry

    // Dispose render targets if any
    const renderTarget = renderer.getRenderTarget()
    if (renderTarget) {
      renderTarget.dispose()
    }

    // Dispose renderer
    renderer.dispose()

    // Remove canvas if in DOM
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }

    logger.debug(`Disposed renderer ${id}`)
  }

  private reclaimIdleRenderer(): string | null {
    let oldestId: string | null = null
    let oldestTime = Infinity

    this.renderers.forEach((entry, id) => {
      if (entry.refCount === 0 && entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed
        oldestId = id
      }
    })

    return oldestId
  }

  private updateMetrics(): void {
    if (!this.enableMetrics) return

    let activeCount = 0
    let memoryEstimate = 0

    this.renderers.forEach(entry => {
      if (entry.refCount > 0) {
        activeCount++
      }

      // Rough memory estimate: ~50MB per renderer (conservative)
      memoryEstimate += 50
    })

    this.metrics.activeCount = activeCount
    this.metrics.poolUtilization = (this.renderers.size / this.maxRenderers) * 100
    this.metrics.memoryEstimateMB = memoryEstimate
  }
}

// Singleton instance
let poolInstance: WebGLRendererPool | null = null

/**
 * Get the global renderer pool instance
 */
export function getRendererPool(): WebGLRendererPool {
  if (!poolInstance) {
    poolInstance = new WebGLRendererPool({
      maxRenderers: 4,
      idleTimeout: 30000,
      enableMetrics: true
    })
  }
  return poolInstance
}

/**
 * Reset the global pool (useful for testing)
 */
export function resetRendererPool(): void {
  if (poolInstance) {
    poolInstance.disposeAll()
    poolInstance = null
  }
}
