/**
 * Centralized Pipeline Polling Service
 *
 * Singleton service that manages pipeline status polling across all components.
 * Eliminates duplicate API calls by sharing a single polling instance across
 * multiple subscribers.
 *
 * Features:
 * - Single GenerationAPIClient instance
 * - Event-based status updates
 * - Auto-cleanup when no subscribers
 * - Request deduplication
 */

import { GenerationAPIClient, PipelineResult } from './api/GenerationAPIClient'
import { createLogger } from '../utils/logger.ts'

const logger = createLogger('PipelinePollingService')

type PipelineStatusCallback = (status: PipelineResult) => void
type PipelineCompleteCallback = (status: PipelineResult) => void
type PipelineErrorCallback = (error: string) => void

interface PipelineSubscription {
  onStatusUpdate?: PipelineStatusCallback
  onComplete?: PipelineCompleteCallback
  onError?: PipelineErrorCallback
}

class PipelinePollingService {
  private static instance: PipelinePollingService | null = null

  private apiClient: GenerationAPIClient
  private subscribers: Map<string, Map<string, PipelineSubscription>> = new Map()
  private activePipelines: Set<string> = new Set()

  private constructor() {
    this.apiClient = new GenerationAPIClient()
    this.setupEventListeners()
    logger.debug('Pipeline polling service initialized')
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PipelinePollingService {
    if (!PipelinePollingService.instance) {
      PipelinePollingService.instance = new PipelinePollingService()
    }
    return PipelinePollingService.instance
  }

  /**
   * Setup event listeners on the API client
   */
  private setupEventListeners(): void {
    // Listen for status updates
    this.apiClient.on('update', (status: PipelineResult) => {
      this.notifySubscribers(status.id, 'onStatusUpdate', status)
    })

    // Listen for completion
    this.apiClient.on('pipeline:completed', (status: PipelineResult) => {
      this.notifySubscribers(status.id, 'onComplete', status)
      this.cleanupPipeline(status.id)
    })

    // Listen for failures
    this.apiClient.on('pipeline:failed', ({ pipelineId, error }) => {
      const errorMessage = error || 'Pipeline failed'
      this.notifySubscribers(pipelineId, 'onError', errorMessage)
      this.cleanupPipeline(pipelineId)
    })

    // Listen for errors
    this.apiClient.on('error', ({ pipelineId, error }) => {
      const errorMessage = typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || 'Unknown error'
      this.notifySubscribers(pipelineId, 'onError', errorMessage)
    })
  }

  /**
   * Notify all subscribers for a pipeline
   */
  private notifySubscribers(
    pipelineId: string,
    callbackType: keyof PipelineSubscription,
    data: PipelineResult | string
  ): void {
    const pipelineSubscribers = this.subscribers.get(pipelineId)
    if (!pipelineSubscribers) return

    for (const subscription of pipelineSubscribers.values()) {
      const callback = subscription[callbackType]
      if (callback) {
        try {
          callback(data as any)
        } catch (error) {
          logger.error('Subscriber callback error', { pipelineId, callbackType, error })
        }
      }
    }
  }

  /**
   * Subscribe to pipeline status updates
   * Returns an unsubscribe function
   */
  subscribe(
    pipelineId: string,
    subscription: PipelineSubscription
  ): () => void {
    // Generate unique subscriber ID
    const subscriberId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create subscribers map for this pipeline if it doesn't exist
    if (!this.subscribers.has(pipelineId)) {
      this.subscribers.set(pipelineId, new Map())
    }

    // Add subscriber
    const pipelineSubscribers = this.subscribers.get(pipelineId)!
    pipelineSubscribers.set(subscriberId, subscription)

    // Start polling if not already active
    if (!this.activePipelines.has(pipelineId)) {
      this.startPolling(pipelineId)
    }

    logger.debug('Subscriber added', {
      pipelineId,
      subscriberId,
      totalSubscribers: pipelineSubscribers.size
    })

    // Return unsubscribe function
    return () => {
      this.unsubscribe(pipelineId, subscriberId)
    }
  }

  /**
   * Unsubscribe from pipeline updates
   */
  private unsubscribe(pipelineId: string, subscriberId: string): void {
    const pipelineSubscribers = this.subscribers.get(pipelineId)
    if (!pipelineSubscribers) return

    pipelineSubscribers.delete(subscriberId)

    logger.debug('Subscriber removed', {
      pipelineId,
      subscriberId,
      remainingSubscribers: pipelineSubscribers.size
    })

    // Stop polling if no more subscribers
    if (pipelineSubscribers.size === 0) {
      this.stopPolling(pipelineId)
      this.subscribers.delete(pipelineId)
    }
  }

  /**
   * Start polling for a pipeline
   * Note: GenerationAPIClient handles the actual polling internally
   */
  private startPolling(pipelineId: string): void {
    if (this.activePipelines.has(pipelineId)) {
      logger.warn('Polling already active', { pipelineId })
      return
    }

    this.activePipelines.add(pipelineId)
    logger.info('Polling started', {
      pipelineId,
      activePipelines: this.activePipelines.size
    })

    // The GenerationAPIClient automatically starts polling when a pipeline is started
    // For existing pipelines (e.g., page refresh), we need to check if polling is active
    // If not, we can check the cached status or fetch it to ensure we have the latest state
    const cachedStatus = this.apiClient.getPipelineStatus(pipelineId)
    if (cachedStatus) {
      // Emit initial status update from cache
      this.notifySubscribers(pipelineId, 'onStatusUpdate', cachedStatus)
    } else {
      // Fetch status to get initial state (this won't start polling loop in GenerationAPIClient)
      this.apiClient.fetchPipelineStatus(pipelineId).then(status => {
        this.notifySubscribers(pipelineId, 'onStatusUpdate', status)
      }).catch(error => {
        logger.error('Initial fetch failed', { pipelineId, error })
        this.notifySubscribers(pipelineId, 'onError', error.message || 'Failed to fetch pipeline status')
      })
    }
  }

  /**
   * Stop polling for a pipeline
   */
  private stopPolling(pipelineId: string): void {
    if (!this.activePipelines.has(pipelineId)) return

    this.apiClient.cancelPolling(pipelineId)
    this.activePipelines.delete(pipelineId)

    logger.info('Polling stopped', {
      pipelineId,
      activePipelines: this.activePipelines.size
    })
  }

  /**
   * Cleanup pipeline resources
   */
  private cleanupPipeline(pipelineId: string): void {
    // Keep subscribers around briefly to receive final updates
    // But stop polling immediately
    this.stopPolling(pipelineId)
  }

  /**
   * Start a new pipeline
   */
  async startPipeline(config: any): Promise<string> {
    const pipelineId = await this.apiClient.startPipeline(config)
    logger.info('Pipeline started', { pipelineId })
    return pipelineId
  }

  /**
   * Get current status of a pipeline (synchronous, from cache)
   */
  getPipelineStatus(pipelineId: string): PipelineResult | undefined {
    return this.apiClient.getPipelineStatus(pipelineId)
  }

  /**
   * Get all active pipeline IDs
   */
  getActivePipelineIds(): string[] {
    return Array.from(this.activePipelines)
  }

  /**
   * Get subscriber count for a pipeline
   */
  getSubscriberCount(pipelineId: string): number {
    return this.subscribers.get(pipelineId)?.size || 0
  }

  /**
   * Get metrics for all pipelines
   */
  getMetrics(): {
    activePipelines: number
    totalSubscribers: number
    pipelineDetails: Array<{ pipelineId: string; subscribers: number }>
  } {
    const pipelineDetails = Array.from(this.subscribers.entries()).map(
      ([pipelineId, subs]) => ({
        pipelineId,
        subscribers: subs.size
      })
    )

    const totalSubscribers = pipelineDetails.reduce(
      (sum, detail) => sum + detail.subscribers,
      0
    )

    return {
      activePipelines: this.activePipelines.size,
      totalSubscribers,
      pipelineDetails
    }
  }

  /**
   * Get the underlying API client (for advanced usage)
   */
  getApiClient(): GenerationAPIClient {
    return this.apiClient
  }

  /**
   * Cleanup all resources (for testing or shutdown)
   */
  destroy(): void {
    this.apiClient.destroy()
    this.subscribers.clear()
    this.activePipelines.clear()
    PipelinePollingService.instance = null
    logger.info('Pipeline polling service destroyed')
  }
}

// Export singleton instance getter
export const pipelinePollingService = PipelinePollingService.getInstance()

// Export types
export type { PipelineSubscription, PipelineStatusCallback, PipelineCompleteCallback, PipelineErrorCallback }
