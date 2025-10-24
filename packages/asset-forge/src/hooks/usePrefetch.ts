/**
 * usePrefetch Hook
 *
 * React hook for intelligent prefetching.
 * Provides simple API for prefetching resources.
 *
 * @example
 * ```typescript
 * function AssetCard({ assetId }) {
 *   const { prefetchOnHover, cancelPrefetch, prefetchRelated } = usePrefetch()
 *
 *   return (
 *     <div
 *       onMouseEnter={() => prefetchOnHover(`/assets/${assetId}`)}
 *       onMouseLeave={() => cancelPrefetch(`/assets/${assetId}`)}
 *       onClick={() => prefetchRelated(assetId)}
 *     >
 *       Asset {assetId}
 *     </div>
 *   )
 * }
 * ```
 */

import { useEffect, useRef } from 'react'
import { PrefetchService } from '@/services/PrefetchService'

interface PrefetchHook {
  prefetchOnHover: (url: string, priority?: number) => void
  cancelPrefetch: (url: string) => void
  prefetchRelated: (assetId: string, priority?: number) => Promise<void>
  prefetchOnIdle: (urls: string[], priority?: number) => void
  trackNavigation: (from: string, to: string) => void
  getStats: () => { queued: number; prefetching: number; prefetched: number }
}

export function usePrefetch(): PrefetchHook {
  const prefetchService = useRef(PrefetchService.getInstance())

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      // Service is singleton, so we don't clear it
    }
  }, [])

  return {
    prefetchOnHover: (url: string, priority?: number) => {
      prefetchService.current.prefetchOnHover(url, priority)
    },

    cancelPrefetch: (url: string) => {
      prefetchService.current.cancelHoverPrefetch(url)
    },

    prefetchRelated: async (assetId: string, priority?: number) => {
      await prefetchService.current.prefetchRelated(assetId, priority)
    },

    prefetchOnIdle: (urls: string[], priority?: number) => {
      prefetchService.current.prefetchOnIdle(urls, priority)
    },

    trackNavigation: (from: string, to: string) => {
      prefetchService.current.trackNavigation(from, to)
    },

    getStats: () => {
      return prefetchService.current.getStats()
    }
  }
}

export default usePrefetch
