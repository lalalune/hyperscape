import { useEffect, useRef, useState } from 'react'
import { WebGLRenderer } from 'three'
import { getRendererPool, type RendererOptions } from '../services/WebGLRendererPool'
import { createLogger } from '../utils/logger'

const logger = createLogger('useRendererPool')

export interface UseRendererPoolOptions extends RendererOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  enabled?: boolean
}

export interface UseRendererPoolReturn {
  renderer: WebGLRenderer | null
  rendererId: string | null
  isReady: boolean
}

/**
 * Hook for acquiring and managing a renderer from the WebGL renderer pool.
 * Automatically handles acquisition, release, and resize events.
 */
export function useRendererPool(options: UseRendererPoolOptions): UseRendererPoolReturn {
  const { containerRef, enabled = true, ...rendererOptions } = options
  const [isReady, setIsReady] = useState(false)
  const rendererIdRef = useRef<string | null>(null)
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null)

  useEffect(() => {
    if (!enabled) {
      logger.debug('Renderer pool disabled')
      return
    }

    const container = containerRef.current
    if (!container) {
      logger.debug('Container not ready')
      return
    }

    const pool = getRendererPool()

    // Acquire renderer from pool
    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    const id = pool.acquire({
      ...rendererOptions,
      width,
      height
    })

    rendererIdRef.current = id
    const rendererInstance = pool.getRenderer(id)

    if (rendererInstance) {
      // Append to container
      container.appendChild(rendererInstance.domElement)
      setRenderer(rendererInstance)
      setIsReady(true)

      logger.debug(`Acquired renderer ${id} for container`)
    }

    // Handle resize
    const handleResize = () => {
      if (!container || !rendererIdRef.current) return

      const newWidth = container.clientWidth
      const newHeight = container.clientHeight

      pool.setSize(
        rendererIdRef.current,
        newWidth,
        newHeight,
        rendererOptions.pixelRatio || Math.min(window.devicePixelRatio, 2)
      )
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)

      if (rendererIdRef.current) {
        const rendererInstance = pool.getRenderer(rendererIdRef.current)

        // Remove from DOM
        if (rendererInstance?.domElement.parentNode === container) {
          container.removeChild(rendererInstance.domElement)
        }

        // Release back to pool
        pool.release(rendererIdRef.current)
        logger.debug(`Released renderer ${rendererIdRef.current}`)

        rendererIdRef.current = null
        setRenderer(null)
        setIsReady(false)
      }
    }
  }, [enabled, containerRef, rendererOptions])

  return {
    renderer,
    rendererId: rendererIdRef.current,
    isReady
  }
}
