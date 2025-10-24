/**
 * Worker Service Adapter
 * Provides utilities to integrate workers into existing services with fallback
 */

import { createLogger } from '../utils/logger'
import { getWorkerManager } from './WorkerManager'

const logger = createLogger('WorkerServiceAdapter')

export interface WorkerOptions {
  enabled?: boolean
  onProgress?: (progress: number) => void
  fallback?: () => Promise<unknown>
}

/**
 * Execute a task with worker or fallback to main thread
 */
export async function executeWithWorkerOrFallback<T>(
  taskName: string,
  workerTask: () => Promise<T>,
  fallbackTask: () => Promise<T>,
  options: WorkerOptions = {}
): Promise<T> {
  const { enabled = true, onProgress: _onProgress } = options

  const workerManager = getWorkerManager(enabled)
  const stats = workerManager.getStats()

  if (!stats.enabled || !stats.supported) {
    logger.info(`${taskName}: Using main thread (workers ${!stats.supported ? 'not supported' : 'disabled'})`)
    return fallbackTask()
  }

  try {
    logger.info(`${taskName}: Using Web Worker`)
    const startTime = performance.now()

    const result = await workerTask()

    const duration = performance.now() - startTime
    logger.info(`${taskName}: Completed in worker (${duration.toFixed(0)}ms)`)

    return result
  } catch (error) {
    logger.error(`${taskName}: Worker failed, falling back to main thread`, error)
    return fallbackTask()
  }
}

/**
 * Check if workers should be used for a given task
 */
export function shouldUseWorker(taskName: string, options: WorkerOptions = {}): boolean {
  const { enabled = true } = options

  if (!enabled) {
    logger.debug(`${taskName}: Workers disabled by option`)
    return false
  }

  const workerManager = getWorkerManager(enabled)
  const stats = workerManager.getStats()

  if (!stats.supported) {
    logger.debug(`${taskName}: Workers not supported`)
    return false
  }

  if (!stats.enabled) {
    logger.debug(`${taskName}: Workers disabled globally`)
    return false
  }

  return true
}

/**
 * Performance comparison utility
 */
export class PerformanceComparison {
  private workerTimes: number[] = []
  private fallbackTimes: number[] = []

  recordWorker(duration: number): void {
    this.workerTimes.push(duration)
  }

  recordFallback(duration: number): void {
    this.fallbackTimes.push(duration)
  }

  getStats() {
    const avgWorker = this.workerTimes.length > 0
      ? this.workerTimes.reduce((a, b) => a + b, 0) / this.workerTimes.length
      : 0

    const avgFallback = this.fallbackTimes.length > 0
      ? this.fallbackTimes.reduce((a, b) => a + b, 0) / this.fallbackTimes.length
      : 0

    const improvement = avgFallback > 0 ? ((avgFallback - avgWorker) / avgFallback) * 100 : 0

    return {
      worker: {
        count: this.workerTimes.length,
        average: Math.round(avgWorker),
        min: this.workerTimes.length > 0 ? Math.round(Math.min(...this.workerTimes)) : 0,
        max: this.workerTimes.length > 0 ? Math.round(Math.max(...this.workerTimes)) : 0,
      },
      fallback: {
        count: this.fallbackTimes.length,
        average: Math.round(avgFallback),
        min: this.fallbackTimes.length > 0 ? Math.round(Math.min(...this.fallbackTimes)) : 0,
        max: this.fallbackTimes.length > 0 ? Math.round(Math.max(...this.fallbackTimes)) : 0,
      },
      improvement: Math.round(improvement),
    }
  }

  reset(): void {
    this.workerTimes = []
    this.fallbackTimes = []
  }
}

// Global performance tracker
const performanceTrackers = new Map<string, PerformanceComparison>()

/**
 * Get or create a performance tracker for a specific operation
 */
export function getPerformanceTracker(operation: string): PerformanceComparison {
  if (!performanceTrackers.has(operation)) {
    performanceTrackers.set(operation, new PerformanceComparison())
  }
  return performanceTrackers.get(operation)!
}

/**
 * Get all performance statistics
 */
export function getAllPerformanceStats(): Record<string, ReturnType<PerformanceComparison['getStats']>> {
  const stats: Record<string, ReturnType<PerformanceComparison['getStats']>> = {}
  performanceTrackers.forEach((tracker, operation) => {
    stats[operation] = tracker.getStats()
  })
  return stats
}

/**
 * Reset all performance trackers
 */
export function resetAllPerformanceTrackers(): void {
  performanceTrackers.forEach(tracker => tracker.reset())
  performanceTrackers.clear()
}
