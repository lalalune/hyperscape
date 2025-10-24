/**
 * useAsyncOperation Hook
 * Generic hook for handling async operations with loading, error, and success states
 */

import { useState, useCallback } from 'react'

export interface AsyncOperationState<T> {
  isLoading: boolean
  error: Error | null
  data: T | null
}

export interface UseAsyncOperationResult<T, Args extends unknown[]> {
  execute: (...args: Args) => Promise<T | null>
  isLoading: boolean
  error: Error | null
  data: T | null
  reset: () => void
}

export function useAsyncOperation<T, Args extends unknown[] = []>(
  operation: (...args: Args) => Promise<T>
): UseAsyncOperationResult<T, Args> {
  const [state, setState] = useState<AsyncOperationState<T>>({
    isLoading: false,
    error: null,
    data: null
  })

  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    setState({ isLoading: true, error: null, data: null })

    try {
      const result = await operation(...args)
      setState({ isLoading: false, error: null, data: result })
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState({ isLoading: false, error, data: null })
      return null
    }
  }, [operation])

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, data: null })
  }, [])

  return {
    execute,
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    reset
  }
}
