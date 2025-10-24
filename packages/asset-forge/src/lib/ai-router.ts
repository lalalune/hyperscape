/**
 * AI Router
 * 
 * Multi-provider AI model routing system supporting OpenRouter, OpenAI, and Anthropic.
 * Provides task-specific model selection with cost/quality/speed optimization.
 * 
 * Based on pipeline project's ai-router.ts
 */

import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export type TaskType =
  | 'npc_dialogue'
  | 'dialogue_tree'
  | 'quest_generation'
  | 'lore_writing'

export type Priority = 'cost' | 'quality' | 'speed'

interface ModelConfig {
  cost: string
  quality: string
  speed: string
}

const MODEL_MATRIX: Record<TaskType, ModelConfig> = {
  npc_dialogue: {
    cost: 'openai/gpt-4o-mini',
    quality: 'anthropic/claude-sonnet-4',
    speed: 'openai/gpt-4o',
  },
  dialogue_tree: {
    cost: 'openai/gpt-4o-mini',
    quality: 'anthropic/claude-sonnet-4',
    speed: 'openai/gpt-4o',
  },
  quest_generation: {
    cost: 'openai/gpt-4o-mini',
    quality: 'anthropic/claude-sonnet-4',
    speed: 'openai/gpt-4o',
  },
  lore_writing: {
    cost: 'openai/gpt-4o',
    quality: 'anthropic/claude-opus-4',
    speed: 'openai/gpt-4o',
  },
}

// Lazy initialization to avoid build-time errors
let openrouterClient: ReturnType<typeof createOpenAI> | null = null
let openaiClient: ReturnType<typeof createOpenAI> | null = null

// Check which API provider is configured (server-side only)
function getConfiguredProvider(): 'openrouter' | 'openai' | 'anthropic' | null {
  if (typeof process !== 'undefined' && process.env?.OPENROUTER_API_KEY) return 'openrouter'
  if (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) return 'openai'
  if (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) return 'anthropic'

  return null
}

function getOpenRouterClient(): ReturnType<typeof createOpenAI> {
  if (openrouterClient) {
    return openrouterClient
  }

  const OPENROUTER_API_KEY =
    (typeof process !== 'undefined' && process.env?.OPENROUTER_API_KEY)

  if (!OPENROUTER_API_KEY) {
    throw new Error(
      'OPENROUTER_API_KEY not found. Set OPENROUTER_API_KEY in server .env'
    )
  }

  openrouterClient = createOpenAI({
    apiKey: OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  })

  return openrouterClient
}

function getOpenAIClient(): ReturnType<typeof createOpenAI> {
  if (openaiClient) {
    return openaiClient
  }

  const OPENAI_API_KEY =
    (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY)

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found. Set OPENAI_API_KEY in server .env')
  }

  openaiClient = createOpenAI({
    apiKey: OPENAI_API_KEY,
  })

  return openaiClient
}

export function selectModel(task: TaskType, priority: Priority = 'cost'): string {
  return MODEL_MATRIX[task]?.[priority] || 'openai/gpt-4o-mini'
}

export function getModelForTask(
  task: TaskType,
  customModel?: string,
  priority: Priority = 'cost'
): LanguageModel {
  // Select model ID
  const modelId = customModel ?? selectModel(task, priority)

  // Determine which provider to use
  const provider = getConfiguredProvider()

  if (!provider) {
    throw new Error(
      'No AI provider configured. This should be configured on the server. Contact administrator.'
    )
  }

  // If using OpenRouter, use it for all models
  if (provider === 'openrouter') {
    const openrouter = getOpenRouterClient()
    return openrouter(modelId)
  }

  // If using direct OpenAI and model is OpenAI, use direct client
  if (provider === 'openai' && modelId.startsWith('openai/')) {
    const openai = getOpenAIClient()
    // Remove the "openai/" prefix for direct API
    const directModelId = modelId.replace('openai/', '')
    return openai(directModelId)
  }

  // If using Anthropic and model is Anthropic
  if (provider === 'anthropic' && modelId.startsWith('anthropic/')) {
    const ANTHROPIC_API_KEY =
      (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY)

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found. Set ANTHROPIC_API_KEY in server .env')
    }
    // Remove the "anthropic/" prefix
    const directModelId = modelId.replace('anthropic/', '')
    return anthropic(directModelId)
  }

  // Fallback: if we have OpenAI key but model is not OpenAI, warn and use default
  if (provider === 'openai') {
    console.warn(
      `Model ${modelId} requested but only OpenAI is configured. Falling back to gpt-4o-mini. ` +
        `For full model support, configure OPENROUTER_API_KEY on server.`
    )
    const openai = getOpenAIClient()
    return openai('gpt-4o-mini')
  }

  // Should not reach here, but fallback to OpenRouter
  const openrouter = getOpenRouterClient()
  return openrouter(modelId)
}

export const AVAILABLE_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'cost' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', tier: 'speed' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', tier: 'quality' },
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', tier: 'quality' },
] as const

