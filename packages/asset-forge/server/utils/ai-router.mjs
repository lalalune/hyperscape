/**
 * AI Router (Server-side)
 * Multi-provider AI model routing for Node.js/Express
 */

import { createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

const MODEL_MATRIX = {
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

let openrouterClient = null
let openaiClient = null

function getConfiguredProvider() {
  if (process.env.OPENROUTER_API_KEY) return 'openrouter'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  return null
}

function getOpenRouterClient() {
  if (openrouterClient) return openrouterClient

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not found in environment')
  }

  openrouterClient = createOpenAI({
    apiKey: OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  })

  return openrouterClient
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment')
  }

  openaiClient = createOpenAI({
    apiKey: OPENAI_API_KEY,
  })

  return openaiClient
}

export function selectModel(task, priority = 'cost') {
  return MODEL_MATRIX[task]?.[priority] || 'openai/gpt-4o-mini'
}

export function getModelForTask(task, customModel, priority = 'cost') {
  const modelId = customModel ?? selectModel(task, priority)
  const provider = getConfiguredProvider()

  if (!provider) {
    throw new Error(
      'No AI provider configured. Set one of: OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY'
    )
  }

  if (provider === 'openrouter') {
    const openrouter = getOpenRouterClient()
    return openrouter(modelId)
  }

  if (provider === 'openai' && modelId.startsWith('openai/')) {
    const openai = getOpenAIClient()
    const directModelId = modelId.replace('openai/', '')
    return openai(directModelId)
  }

  if (provider === 'anthropic' && modelId.startsWith('anthropic/')) {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found in environment')
    }
    const directModelId = modelId.replace('anthropic/', '')
    return anthropic(directModelId, { apiKey: ANTHROPIC_API_KEY })
  }

  if (provider === 'openai') {
    console.warn(`Model ${modelId} requested but only OpenAI configured. Falling back to gpt-4o-mini`)
    const openai = getOpenAIClient()
    return openai('gpt-4o-mini')
  }

  // Last resort: try OpenRouter if configured
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = getOpenRouterClient()
    return openrouter(modelId)
  }

  throw new Error(
    `Cannot use model ${modelId}: OPENROUTER_API_KEY not configured. ` +
    `Please set OPENROUTER_API_KEY in your environment to use this model.`
  )
}

