/**
 * Generic hook for modal state management
 *
 * Consolidates common patterns from:
 * - RegenerateModal
 * - SpriteGenerationModal
 * - RetextureModal
 *
 * Features:
 * - Status state management (idle, processing, success, error)
 * - Progress tracking
 * - Message management
 * - Automatic ref cleanup
 * - Timeout handling
 */

import { useState, useRef, useEffect, useCallback } from 'react'

export type ModalStatus = 'idle' | 'processing' | 'success' | 'error' | 'loading' | 'viewing' | 'generating'

export interface ModalStateOptions {
  /**
   * Initial status
   */
  initialStatus?: ModalStatus

  /**
   * Initial message
   */
  initialMessage?: string

  /**
   * Auto-close delay after success (ms)
   * Set to 0 to disable auto-close
   */
  successAutoCloseDelay?: number

  /**
   * Called when success auto-close triggers
   */
  onSuccessAutoClose?: () => void
}

export interface ModalState {
  /**
   * Current status
   */
  status: ModalStatus

  /**
   * Current message
   */
  message: string

  /**
   * Current progress (0-100)
   */
  progress: number

  /**
   * Set status
   */
  setStatus: (status: ModalStatus) => void

  /**
   * Set message
   */
  setMessage: (message: string) => void

  /**
   * Set progress
   */
  setProgress: (progress: number) => void

  /**
   * Update multiple states at once
   */
  update: (updates: Partial<{ status: ModalStatus; message: string; progress: number }>) => void

  /**
   * Reset to initial state
   */
  reset: () => void

  /**
   * Mark as processing
   */
  startProcessing: (message?: string) => void

  /**
   * Mark as success
   */
  markSuccess: (message?: string) => void

  /**
   * Mark as error
   */
  markError: (message?: string) => void

  /**
   * Create a timeout that auto-cleans up
   */
  createTimeout: (callback: () => void, delay: number) => void

  /**
   * Create an interval that auto-cleans up
   */
  createInterval: (callback: () => void, delay: number) => void

  /**
   * Clear all timeouts and intervals
   */
  clearAllTimers: () => void
}

/**
 * Hook for managing modal state with automatic cleanup
 *
 * @example
 * ```typescript
 * function MyModal({ onClose, onComplete }) {
 *   const modal = useModalState({
 *     successAutoCloseDelay: 2000,
 *     onSuccessAutoClose: onComplete
 *   })
 *
 *   const handleSubmit = async () => {
 *     modal.startProcessing('Processing...')
 *
 *     try {
 *       await someAsyncOperation()
 *       modal.markSuccess('Success!')
 *     } catch (error) {
 *       modal.markError(error.message)
 *     }
 *   }
 *
 *   return (
 *     <Modal>
 *       {modal.status === 'idle' && <IdleContent />}
 *       {modal.status === 'processing' && (
 *         <ProcessingContent progress={modal.progress} message={modal.message} />
 *       )}
 *       {modal.status === 'success' && <SuccessContent />}
 *       {modal.status === 'error' && <ErrorContent message={modal.message} />}
 *     </Modal>
 *   )
 * }
 * ```
 */
export function useModalState(options: ModalStateOptions = {}): ModalState {
  const {
    initialStatus = 'idle',
    initialMessage = '',
    successAutoCloseDelay = 0,
    onSuccessAutoClose
  } = options

  const [status, setStatus] = useState<ModalStatus>(initialStatus)
  const [message, setMessage] = useState(initialMessage)
  const [progress, setProgress] = useState(0)

  const timersRef = useRef<{
    timeouts: ReturnType<typeof setTimeout>[]
    intervals: ReturnType<typeof setInterval>[]
  }>({
    timeouts: [],
    intervals: []
  })

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.timeouts.forEach(clearTimeout)
      timersRef.current.intervals.forEach(clearInterval)
    }
  }, [])

  const clearAllTimers = useCallback(() => {
    timersRef.current.timeouts.forEach(clearTimeout)
    timersRef.current.intervals.forEach(clearInterval)
    timersRef.current.timeouts = []
    timersRef.current.intervals = []
  }, [])

  const createTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(callback, delay)
    timersRef.current.timeouts.push(timeout)
  }, [])

  const createInterval = useCallback((callback: () => void, delay: number) => {
    const interval = setInterval(callback, delay)
    timersRef.current.intervals.push(interval)
  }, [])

  const update = useCallback((updates: Partial<{ status: ModalStatus; message: string; progress: number }>) => {
    if (updates.status !== undefined) setStatus(updates.status)
    if (updates.message !== undefined) setMessage(updates.message)
    if (updates.progress !== undefined) setProgress(updates.progress)
  }, [])

  const reset = useCallback(() => {
    setStatus(initialStatus)
    setMessage(initialMessage)
    setProgress(0)
    clearAllTimers()
  }, [initialStatus, initialMessage, clearAllTimers])

  const startProcessing = useCallback((msg = 'Processing...') => {
    setStatus('processing')
    setMessage(msg)
    setProgress(0)
  }, [])

  const markSuccess = useCallback((msg = 'Success!') => {
    setStatus('success')
    setMessage(msg)
    setProgress(100)

    // Auto-close after delay if configured
    if (successAutoCloseDelay > 0 && onSuccessAutoClose) {
      createTimeout(onSuccessAutoClose, successAutoCloseDelay)
    }
  }, [successAutoCloseDelay, onSuccessAutoClose, createTimeout])

  const markError = useCallback((msg = 'An error occurred') => {
    setStatus('error')
    setMessage(msg)
    setProgress(0)
    clearAllTimers()
  }, [clearAllTimers])

  return {
    status,
    message,
    progress,
    setStatus,
    setMessage,
    setProgress,
    update,
    reset,
    startProcessing,
    markSuccess,
    markError,
    createTimeout,
    createInterval,
    clearAllTimers
  }
}
