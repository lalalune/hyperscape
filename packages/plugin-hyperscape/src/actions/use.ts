import {
  ModelType,
  type Action,
  type ActionResult,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
} from '@elizaos/core'
import { Entity } from '../types/core-types'
import type { World as HyperscapeWorld } from '@hyperscape/shared'
import type { HyperscapeService } from '../service'
import { composeContext, generateMessageResponse } from '../utils/ai-helpers'

interface UseActionResponse {
  itemName?: string
  action?: string
  result?: string
}

const useAction: Action = {
  name: 'use',
  description: 'Use, equip, or wield an item in the Hyperscape world',
  similes: ['use', 'equip', 'wield', 'activate', 'employ'],
  examples: [
    [
      { name: 'user', content: { text: 'use sword' } },
      { name: 'agent', content: { actions: ['USE'], text: 'Using sword' } },
    ],
    [
      { name: 'user', content: { text: 'equip armor' } },
      { name: 'agent', content: { actions: ['USE'], text: 'Equipping armor' } },
    ],
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    params?: { [key: string]: any },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>('hyperscape')
    if (!service || !service.isConnected()) {
      return { success: false, text: 'Hyperscape service not connected' }
    }

    const world = service.getWorld()
    if (!world) {
      return { success: false, text: 'Not in a Hyperscape world' }
    }

    const context = await composeContext({
      state: state,
      template: `
# Use Action Validation

## Context
A user wants to use an item.

## Available Items
- Key
- Sword
- Shield

## Target
${params?.target}

Decide if this is a valid use action.
`,
    })

    const response = await generateMessageResponse({
      runtime,
      context,
      modelType: ModelType.TEXT_SMALL,
    })

    const itemName = response.text.trim()
    if (itemName) {
      const entity = findEntityByName(world, itemName)
      if (entity && entity.data?.usable) {
        const result = { success: true, text: `Used ${entity.name}` }
        await callback({
          text: result.text,
          actions: ['HYPERSCAPE_USE'],
          source: 'hyperscape',
        })
        return result
      } else {
        return { success: false, text: `Cannot use ${itemName}` }
      }
    } else {
      return { success: false, text: 'No item specified' }
    }
  },
}

/**
 * Extract item name from text
 */
function extractItemName(text: string): string | null {
  const lowerText = text.toLowerCase()

  // Look for patterns like "use the sword", "equip shield", "wield bow"
  const patterns = [
    /(?:use|equip|wield|activate|employ)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s+(?:please|now|$))/i,
    /(?:use|equip|wield|activate|employ)\s+([a-zA-Z\s]+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Find an item in the world by name (fuzzy matching)
 */
function findEntityByName(world: HyperscapeWorld, name: string): Entity | null {
  // Direct exact name match
  for (const entity of world.entities.items.values()) {
    if (entity.name === name) {
      return entity
    }
  }

  // Then try partial name match
  for (const entity of world.entities.items.values()) {
    const entityName = (entity.data?.name || entity.name || '').toLowerCase()
    if (
      entityName.includes(name.toLowerCase()) ||
      name.toLowerCase().includes(entityName)
    ) {
      return entity
    }
  }

  return null
}

export { useAction }
