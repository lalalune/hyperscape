/**
 * Cache Statistics Hook
 *
 * Provides real-time cache statistics for monitoring performance
 */

import { useState, useEffect } from 'react'

import { AssetService } from '@/services/api/AssetService'

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  capacity: number
  hitRate: number
  averageAccessCount: number
}

/**
 * Hook for accessing cache statistics
 * Refreshes every 1 second when enabled
 */
export function useCacheStats(enabled = true) {
  const [stats, setStats] = useState<CacheStats | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const updateStats = () => {
      const currentStats = AssetService.getCacheStats()
      setStats(currentStats)
    }

    // Update immediately
    updateStats()

    // Update every second
    const interval = setInterval(updateStats, 1000)

    return () => clearInterval(interval)
  }, [enabled])

  const clearCache = () => {
    AssetService.clearCache()
    setStats(AssetService.getCacheStats())
  }

  return {
    stats,
    clearCache
  }
}
