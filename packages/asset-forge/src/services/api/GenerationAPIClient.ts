/**
 * Generation API Client
 * Handles communication with the backend generation service
 */

import { ExtendedImportMeta } from '../../types'
import { GenerationConfig } from '../../types/generation'
import { TypedEventEmitter } from '../../utils/TypedEventEmitter'
import { ExponentialBackoff } from '../../utils/helpers'

import { apiFetch } from '@/utils/api'
import { createLogger } from '@/utils/logger'

const logger = createLogger('GenerationAPIClient')

// Define pipeline types matching backend
export interface PipelineStage {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
}

export interface PipelineStages {
  generation: PipelineStage
  retexturing: PipelineStage
  sprites: PipelineStage
}

export interface PipelineResults {
  image3D?: {
    localPath?: string
    modelUrl?: string
  }
  rigging?: {
    localPath?: string
    modelUrl?: string
  }
  textureGeneration?: {
    variants?: Array<{ name: string; modelUrl: string }>
  }
  spriteGeneration?: {
    status?: string
    sprites?: Array<{ angle: number; imageUrl: string }>
  }
}

export interface PipelineResult {
  id: string
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  progress: number
  stages: PipelineStages
  config: GenerationConfig
  results: PipelineResults
  error?: string
  baseAsset?: {
    id: string
    name: string
    modelUrl?: string
    conceptArtUrl?: string
  }
  variants?: Array<{ name: string; modelUrl: string }>
  sprites?: Array<{ angle: number; imageUrl: string }>
}

// Event map for type-safe event handling
export type GenerationAPIEvents = {
  'pipeline:started': { pipelineId: string }
  'progress': { pipelineId: string; progress: number }
  'statusChange': { pipelineId: string; status: string }
  'update': PipelineResult
  'pipeline:completed': PipelineResult
  'pipeline:failed': { pipelineId: string; error?: string }
  'error': { pipelineId: string; error: Error | string | { message: string; code?: string } }
}

// Type helper to extract event arguments
type EventArgs<T extends keyof GenerationAPIEvents> = GenerationAPIEvents[T]

export class GenerationAPIClient extends TypedEventEmitter<GenerationAPIEvents> {
  private apiUrl: string
  private pipelineConfigs: Map<string, GenerationConfig> = new Map()
  private activePipelines: Map<string, PipelineResult> = new Map()
  private pollingControllers: Map<string, AbortController> = new Map()
  private backoffManagers: Map<string, ExponentialBackoff> = new Map()
  private readonly maxPollTimeout: number = 600000 // 10 minutes

  constructor(apiUrl?: string) {
    super()
    // Use environment variable if available, otherwise default to localhost
    const envApiUrl = (import.meta as ExtendedImportMeta).env?.VITE_GENERATION_API_URL
    this.apiUrl = apiUrl || envApiUrl || 'http://localhost:3001/api'
  }
  
  /**
   * Start a new generation pipeline
   */
  async startPipeline(config: GenerationConfig): Promise<string> {
    const response = await apiFetch(`${this.apiUrl}/generation/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config),
      timeoutMs: 30000
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start pipeline')
    }
    
    const result = await response.json()
    
    // Store config for later retrieval
    this.pipelineConfigs.set(result.pipelineId, config)
    
    // Create and store initial pipeline result
    const pipelineResult: PipelineResult = {
      id: result.pipelineId,
      status: 'initializing',
      progress: 0,
      stages: {
        generation: { status: 'pending', progress: 0 },
        retexturing: { status: 'pending', progress: 0 },
        sprites: { status: 'pending', progress: 0 }
      },
      config,
      results: {}
    }
    
    this.activePipelines.set(result.pipelineId, pipelineResult)
    
    // Emit pipeline started event
    this.emit('pipeline:started', { pipelineId: result.pipelineId })
    
    // Start polling for status updates
    this.pollPipelineStatus(result.pipelineId)
    
    return result.pipelineId
  }
  
  /**
   * Fetch pipeline status from API
   */
  async fetchPipelineStatus(pipelineId: string): Promise<PipelineResult> {
    const response = await apiFetch(`${this.apiUrl}/generation/pipeline/${pipelineId}`, { timeoutMs: 15000 })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get pipeline status')
    }
    
    const status = await response.json()
    
    // Retrieve stored config
    const config = this.pipelineConfigs.get(pipelineId) || {} as GenerationConfig
    
    // Convert backend format to frontend format
    return {
      id: status.id,
      status: status.status,
      progress: status.progress,
      stages: status.stages,
      config,
      results: status.results || {},
      error: status.error
    }
  }
  
  /**
   * Poll pipeline status and emit events with exponential backoff and race condition protection
   */
  private async pollPipelineStatus(pipelineId: string) {
    // Cancel any existing poll for this pipeline to prevent race conditions
    if (this.pollingControllers.has(pipelineId)) {
      this.pollingControllers.get(pipelineId)!.abort()
    }

    // Create new abort controller for this polling session
    const controller = new AbortController()
    this.pollingControllers.set(pipelineId, controller)

    // Create exponential backoff manager for this pipeline
    const backoff = new ExponentialBackoff(2000, 30000, 1.5, 0.1)
    this.backoffManagers.set(pipelineId, backoff)

    let previousStatus = ''
    let previousProgress = 0

    const poll = async () => {
      try {
        // Check if polling was cancelled
        if (controller.signal.aborted) {
          this.logPipelineMetrics(pipelineId)
          return
        }

        // Check for max timeout
        if (backoff.isTimedOut(this.maxPollTimeout)) {
          logger.warn('Pipeline polling', `Pipeline ${pipelineId} exceeded max timeout (10 minutes)`)
          this.emit('error', {
            pipelineId,
            error: new Error('Pipeline polling timeout exceeded')
          })
          this.cleanup(pipelineId)
          return
        }

        const status = await this.fetchPipelineStatus(pipelineId)

        // Check again after async operation
        if (controller.signal.aborted) {
          this.logPipelineMetrics(pipelineId)
          return
        }

        // Update local cache
        this.activePipelines.set(pipelineId, status)

        // Track if we should reset backoff
        let shouldResetBackoff = false

        // Emit progress updates
        if (status.progress !== previousProgress) {
          this.emit('progress', { pipelineId, progress: status.progress })
          previousProgress = status.progress
          shouldResetBackoff = true
        }

        // Emit status changes
        if (status.status !== previousStatus) {
          this.emit('statusChange', { pipelineId, status: status.status })
          previousStatus = status.status
          shouldResetBackoff = true
        }

        // Reset backoff on any status/progress change for faster updates
        if (shouldResetBackoff) {
          backoff.reset()
          logger.debug('Pipeline polling', `Backoff reset for pipeline ${pipelineId} due to status/progress change`)
        }

        // Emit stage updates
        this.emit('update', status)

        // Stop polling if complete or failed
        if (status.status === 'completed') {
          this.emit('pipeline:completed', status)
          this.logPipelineMetrics(pipelineId)
          this.cleanup(pipelineId)
          return
        } else if (status.status === 'failed') {
          this.emit('pipeline:failed', { pipelineId, error: status.error })
          this.logPipelineMetrics(pipelineId)
          this.cleanup(pipelineId)
          return
        }

        // Get next delay with exponential backoff and jitter
        const nextDelay = backoff.getNextDelay()

        // Log polling metrics periodically (every 10 polls)
        const metrics = backoff.getMetrics()
        if (metrics.totalPolls % 10 === 0) {
          logger.debug(`Pipeline polling - Pipeline ${pipelineId} metrics:`, metrics)
        }

        // Continue polling with exponential backoff
        await this.delay(nextDelay, controller.signal)
        poll()
      } catch (error) {
        // Don't emit errors for cancelled operations
        if (controller.signal.aborted) {
          this.logPipelineMetrics(pipelineId)
          return
        }
        logger.error(`Pipeline polling - Error polling pipeline ${pipelineId}:`, error)
        this.emit('error', { pipelineId, error: (error as Error) })
        this.cleanup(pipelineId)
      }
    }

    // Start polling
    poll()
  }

  /**
   * Log final metrics for a pipeline
   */
  private logPipelineMetrics(pipelineId: string): void {
    const backoff = this.backoffManagers.get(pipelineId)
    if (backoff) {
      const metrics = backoff.getMetrics()
      logger.info(`Pipeline polling - Final metrics for pipeline ${pipelineId}:`, {
        totalPolls: metrics.totalPolls,
        elapsedSeconds: (metrics.elapsedTime / 1000).toFixed(1),
        averageIntervalSeconds: (metrics.averageInterval / 1000).toFixed(1),
        finalDelay: metrics.currentDelay
      })
    }
  }

  /**
   * Cleanup polling resources for a pipeline
   */
  private cleanup(pipelineId: string): void {
    this.pollingControllers.delete(pipelineId)
    this.backoffManagers.delete(pipelineId)
  }

  /**
   * Delay with abort signal support
   */
  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Polling cancelled'))
        return
      }

      const timeout = setTimeout(() => {
        signal.removeEventListener('abort', abortHandler)
        resolve()
      }, ms)

      const abortHandler = () => {
        clearTimeout(timeout)
        reject(new Error('Polling cancelled'))
      }

      signal.addEventListener('abort', abortHandler, { once: true })
    })
  }
  
  /**
   * Check if API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await apiFetch(`${this.apiUrl}/health`, { timeoutMs: 5000 })
      return response.ok
    } catch {
      return false
    }
  }
  
  /**
   * Get all active pipelines
   */
  getActivePipelines(): PipelineResult[] {
    return Array.from(this.activePipelines.values())
  }
  
  /**
   * Get cached pipeline status (synchronous)
   */
  getPipelineStatus(pipelineId: string): PipelineResult | undefined {
    return this.activePipelines.get(pipelineId)
  }
  
  /**
   * Clear completed or failed pipelines
   */
  clearInactivePipelines(): void {
    for (const [id, pipeline] of this.activePipelines.entries()) {
      if (pipeline.status === 'completed' || pipeline.status === 'failed') {
        this.activePipelines.delete(id)
        this.pipelineConfigs.delete(id)
        // Cancel any active polling for this pipeline
        this.cancelPolling(id)
      }
    }
  }

  /**
   * Get polling metrics for a pipeline
   */
  getPipelineMetrics(pipelineId: string): ReturnType<ExponentialBackoff['getMetrics']> | null {
    const backoff = this.backoffManagers.get(pipelineId)
    return backoff ? backoff.getMetrics() : null
  }

  /**
   * Get metrics for all active pipelines
   */
  getAllPipelineMetrics(): Record<string, ReturnType<ExponentialBackoff['getMetrics']>> {
    const metrics: Record<string, ReturnType<ExponentialBackoff['getMetrics']>> = {}
    for (const [pipelineId, backoff] of this.backoffManagers.entries()) {
      metrics[pipelineId] = backoff.getMetrics()
    }
    return metrics
  }

  /**
   * Cancel polling for a specific pipeline
   */
  cancelPolling(pipelineId: string): void {
    const controller = this.pollingControllers.get(pipelineId)
    if (controller) {
      controller.abort()
      this.cleanup(pipelineId)
    }
  }

  /**
   * Cancel all active polling operations
   */
  cancelAllPolling(): void {
    for (const controller of this.pollingControllers.values()) {
      controller.abort()
    }
    this.pollingControllers.clear()
    this.backoffManagers.clear()
  }

  /**
   * Cleanup and destroy the client
   * Should be called when the component unmounts or client is no longer needed
   */
  destroy(): void {
    this.cancelAllPolling()
    this.activePipelines.clear()
    this.pipelineConfigs.clear()
    // Remove all event listeners
    this.removeAllListeners()
  }

  /**
   * Remove event listener (alias for removeListener)
   */
  off<K extends keyof GenerationAPIEvents>(
    event: K,
    listener: (data: EventArgs<K>) => void
  ): this {
    return this.removeListener(event, listener)
  }
} 