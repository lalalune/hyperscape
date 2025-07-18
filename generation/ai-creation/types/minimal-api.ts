/**
 * Minimal API Types for Testing
 * 
 * Simplified type definitions to get tests working.
 */

import type { ItemData } from './geometry'

export interface GenerationRequest {
  id: string
  name: string
  description: string
  type: 'text-to-3d' | 'image-to-3d' | 'rigging' | 'retexturing'
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  sourceData: ItemData
  requiredFeatures: string[]
  meshyRequest: any
  metadata: {
    version: string
    source: string
    estimatedCost: number
    estimatedTime: number
  }
  retryCount: number
  maxRetries: number
  timeout: number
  createdAt: Date
}

export interface GenerationResult {
  id: string
  requestId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  meshyTaskId: string
  meshyResult?: any
  hardpoints?: any
  retexturing?: any
  visualizations?: any
  error?: {
    code: string
    message: string
    phase: string
    retryable: boolean
    timestamp: Date
  }
  metadata: {
    processingTime: number
    cacheHit: boolean
    actualCost: number
    qualityScore: number
    validationStatus: 'passed' | 'failed' | 'warning'
    validationErrors: string[]
    performance: {
      parseTime: number
      hardpointTime: number
      retexturingTime: number
      visualizationTime: number
      totalTime: number
      memoryUsed: number
      apiCalls: number
    }
    version: string
  }
}

export function validateGenerationRequest(obj: unknown): obj is GenerationRequest {
  if (typeof obj !== 'object' || obj === null) return false
  
  const request = obj as GenerationRequest
  
  return (
    typeof request.id === 'string' &&
    typeof request.name === 'string' &&
    typeof request.description === 'string' &&
    typeof request.type === 'string' &&
    ['text-to-3d', 'image-to-3d', 'rigging', 'retexturing'].includes(request.type) &&
    typeof request.priority === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(request.priority) &&
    typeof request.retryCount === 'number' &&
    request.retryCount >= 0 &&
    request.createdAt instanceof Date
  )
}

export function assertGenerationRequest(obj: unknown): asserts obj is GenerationRequest {
  if (!validateGenerationRequest(obj)) {
    throw new Error(`Invalid GenerationRequest: ${JSON.stringify(obj)}`)
  }
}

export function createGenerationRequest(
  id: string,
  itemData: ItemData,
  meshyRequest: any,
  options: Partial<GenerationRequest> = {}
): GenerationRequest {
  return {
    id,
    name: itemData.name,
    description: itemData.examine,
    type: 'text-to-3d',
    category: itemData.category,
    priority: 'medium',
    sourceData: itemData,
    requiredFeatures: [],
    meshyRequest,
    metadata: {
      version: '1.0.0',
      source: 'ai-creation-service',
      estimatedCost: 0.1,
      estimatedTime: 120000,
      ...options.metadata
    },
    retryCount: 0,
    maxRetries: 3,
    timeout: 300000,
    createdAt: new Date(),
    ...options
  }
}