/**
 * Worker Pool
 * Manages a pool of Web Workers for parallel processing
 */

import { createLogger } from '../utils/logger'
import type {
  WorkerTask,
  WorkerPoolConfig,
  WorkerMetrics,
  WorkerMessageType,
  WorkerRequest,
  WorkerResponse,
} from './types'

const logger = createLogger('WorkerPool')

interface WorkerState {
  worker: Worker
  busy: boolean
  currentTask: WorkerTask | null
  tasksCompleted: number
  lastUsed: number
}

export class WorkerPool {
  private workers: WorkerState[] = []
  private queue: WorkerTask[] = []
  private config: Required<WorkerPoolConfig>
  private metrics: WorkerMetrics[] = []
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private taskCounter = 0

  constructor(config: WorkerPoolConfig) {
    this.config = {
      maxWorkers: config.maxWorkers || navigator.hardwareConcurrency || 4,
      workerScript: config.workerScript,
      terminateOnIdle: config.terminateOnIdle ?? true,
      idleTimeout: config.idleTimeout ?? 30000, // 30 seconds
    }

    logger.info(`WorkerPool initialized with ${this.config.maxWorkers} workers`)
  }

  /**
   * Execute a task using the worker pool
   */
  async execute<TData, TResult>(
    type: WorkerMessageType,
    data: TData,
    onProgress?: (progress: number) => void
  ): Promise<TResult> {
    const taskId = `task-${++this.taskCounter}-${Date.now()}`

    return new Promise<TResult>((resolve, reject) => {
      const task: WorkerTask<TData, TResult> = {
        id: taskId,
        type,
        data,
        resolve,
        reject,
        onProgress,
      }

      this.queue.push(task as WorkerTask<unknown, unknown>)
      this.processQueue()
    })
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    // Clear idle timer if tasks are being processed
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }

    while (this.queue.length > 0) {
      const worker = this.getAvailableWorker()
      if (!worker) {
        // All workers are busy, wait for one to become available
        break
      }

      const task = this.queue.shift()
      if (!task) break

      this.executeTask(worker, task)
    }

    // Set idle timer if all workers are idle
    if (this.queue.length === 0 && this.allWorkersIdle() && this.config.terminateOnIdle) {
      this.idleTimer = setTimeout(() => {
        this.terminateAll()
      }, this.config.idleTimeout)
    }
  }

  /**
   * Execute a task on a specific worker
   */
  private executeTask(workerState: WorkerState, task: WorkerTask): void {
    workerState.busy = true
    workerState.currentTask = task
    workerState.lastUsed = Date.now()

    const startTime = performance.now()
    const workerIndex = this.workers.indexOf(workerState)

    // Set up message handler
    const handleMessage = (event: MessageEvent<WorkerResponse>): void => {
      const response = event.data

      if (response.id !== task.id) {
        // Message is for a different task, ignore
        return
      }

      if (response.type === 'PROGRESS' && task.onProgress && response.progress !== undefined) {
        task.onProgress(response.progress)
      } else if (response.type === 'SUCCESS') {
        const endTime = performance.now()

        // Record metrics
        this.metrics.push({
          taskId: task.id,
          workerIndex,
          startTime,
          endTime,
          duration: endTime - startTime,
          type: task.type,
          success: true,
        })

        // Cleanup
        workerState.worker.removeEventListener('message', handleMessage)
        workerState.worker.removeEventListener('error', handleError)
        workerState.busy = false
        workerState.currentTask = null
        workerState.tasksCompleted++

        task.resolve(response.data!)
        this.processQueue()
      } else if (response.type === 'ERROR') {
        const endTime = performance.now()

        // Record metrics
        this.metrics.push({
          taskId: task.id,
          workerIndex,
          startTime,
          endTime,
          duration: endTime - startTime,
          type: task.type,
          success: false,
          error: response.error,
        })

        // Cleanup
        workerState.worker.removeEventListener('message', handleMessage)
        workerState.worker.removeEventListener('error', handleError)
        workerState.busy = false
        workerState.currentTask = null

        task.reject(new Error(response.error || 'Worker error'))
        this.processQueue()
      }
    }

    const handleError = (error: ErrorEvent): void => {
      const endTime = performance.now()

      // Record metrics
      this.metrics.push({
        taskId: task.id,
        workerIndex,
        startTime,
        endTime,
        duration: endTime - startTime,
        type: task.type,
        success: false,
        error: error.message,
      })

      // Cleanup
      workerState.worker.removeEventListener('message', handleMessage)
      workerState.worker.removeEventListener('error', handleError)
      workerState.busy = false
      workerState.currentTask = null

      task.reject(new Error(`Worker error: ${error.message}`))
      this.processQueue()
    }

    workerState.worker.addEventListener('message', handleMessage)
    workerState.worker.addEventListener('error', handleError)

    // Send task to worker
    const request: WorkerRequest = {
      id: task.id,
      type: task.type,
      data: task.data,
    }

    workerState.worker.postMessage(request)
  }

  /**
   * Get an available worker or create a new one
   */
  private getAvailableWorker(): WorkerState | null {
    // Check for idle workers
    const idleWorker = this.workers.find(w => !w.busy)
    if (idleWorker) {
      return idleWorker
    }

    // Create new worker if under limit
    if (this.workers.length < this.config.maxWorkers) {
      return this.createWorker()
    }

    // All workers busy and at max capacity
    return null
  }

  /**
   * Create a new worker
   */
  private createWorker(): WorkerState {
    const worker = new Worker(this.config.workerScript, { type: 'module' })

    const workerState: WorkerState = {
      worker,
      busy: false,
      currentTask: null,
      tasksCompleted: 0,
      lastUsed: Date.now(),
    }

    this.workers.push(workerState)
    logger.info(`Created worker ${this.workers.length}/${this.config.maxWorkers}`)

    return workerState
  }

  /**
   * Check if all workers are idle
   */
  private allWorkersIdle(): boolean {
    return this.workers.every(w => !w.busy)
  }

  /**
   * Terminate all workers
   */
  terminateAll(): void {
    logger.info(`Terminating ${this.workers.length} workers`)

    for (const workerState of this.workers) {
      workerState.worker.terminate()
    }

    this.workers = []
    this.queue = []

    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const totalTasks = this.metrics.length
    const successfulTasks = this.metrics.filter(m => m.success).length
    const failedTasks = totalTasks - successfulTasks
    const averageDuration = totalTasks > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalTasks
      : 0

    return {
      workers: {
        total: this.workers.length,
        busy: this.workers.filter(w => w.busy).length,
        idle: this.workers.filter(w => !w.busy).length,
      },
      queue: {
        pending: this.queue.length,
      },
      tasks: {
        total: totalTasks,
        successful: successfulTasks,
        failed: failedTasks,
        averageDuration: Math.round(averageDuration),
      },
      metrics: this.metrics.slice(-100), // Last 100 tasks
    }
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }
}
