/**
 * useDataFetch Hook
 * Generic hook for fetching data with automatic loading and error handling
 */

import { useState, useEffect, useRef } from 'react'

export interface DataFetchState<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

export interface UseDataFetchOptions {
  enabled?: boolean
  refetchInterval?: number
}

export function useDataFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseDataFetchOptions = {}
): DataFetchState<T> & { refetch: () => Promise<void> } {
  const { enabled = true, refetchInterval } = options
  const [state, setState] = useState<DataFetchState<T>>({
    data: null,
    isLoading: false,
    error: null
  })

  const isMountedRef = useRef(true)

  const refetch = async () => {
    if (!enabled) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await fetchFn()
      if (isMountedRef.current) {
        setState({ data: result, isLoading: false, error: null })
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err))
        setState({ data: null, isLoading: false, error })
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    refetch()

    if (refetchInterval) {
      const interval = setInterval(refetch, refetchInterval)
      return () => clearInterval(interval)
    }
  }, [enabled, refetchInterval])

  return {
    ...state,
    refetch
  }
}
