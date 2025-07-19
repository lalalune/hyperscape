import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type ActionExample,
  type HandlerCallback,
  ModelType,
  logger,
} from '../types/eliza-mock'
import { HyperfyService } from '../service'
import type { HyperfyWorld } from '../types/hyperfy'

/**
 * Represents an action descriptor from a Hyperfy world
 */
export interface HyperfyActionDescriptor {
  name: string
  description: string
  parameters: {
    name: string
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required: boolean
    description: string
    default?: any
  }[]
  examples: string[]
  category:
    | 'combat'
    | 'inventory'
    | 'skills'
    | 'quest'
    | 'social'
    | 'movement'
    | 'other'
  handler?: string // Optional custom handler code from world
}

/**
 * Manages dynamic discovery and registration of actions from Hyperfy worlds
 */
export class DynamicActionLoader {
  private runtime: IAgentRuntime
  private registeredActions: Map<string, Action> = new Map()
  private worldActions: Map<string, HyperfyActionDescriptor> = new Map()

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
  }

  /**
   * Discovers available actions from a Hyperfy world
   */
  async discoverActions(
    world: HyperfyWorld
  ): Promise<HyperfyActionDescriptor[]> {
    try {
      logger.info('[DynamicActionLoader] Discovering actions from world...')

      // Check if world exposes actions through a specific protocol
      if (world.actions?.getAvailableActions) {
        const actions = await world.actions.getAvailableActions()
        logger.info(
          `[DynamicActionLoader] Found ${actions.length} actions from world`
        )
        return actions
      }

      // Fallback: Query world entities for action providers
      const actionProviders = []
      if (world.entities?.items) {
        world.entities.items.forEach((entity: any) => {
          if (
            entity.components?.find((c: any) => c.type === 'action-provider')
          ) {
            const actionComponent = entity.components.find(
              (c: any) => c.type === 'action-provider'
            )
            if (actionComponent?.data?.actions) {
              actionProviders.push(...actionComponent.data.actions)
            }
          }
        })
      }

      logger.info(
        `[DynamicActionLoader] Found ${actionProviders.length} actions from entity scan`
      )
      return actionProviders
    } catch (error) {
      logger.error('[DynamicActionLoader] Error discovering actions:', error)
      return []
    }
  }

  /**
   * Registers a discovered action with the runtime
   */
  async registerAction(
    descriptor: HyperfyActionDescriptor,
    runtime: IAgentRuntime
  ): Promise<void> {
    logger.info(`[DynamicActionLoader] Registering action: ${descriptor.name}`)

    // Create Action object from descriptor
    const action: Action = {
      name: descriptor.name,
      description: descriptor.description,
      similes: this.generateSimiles(descriptor),

      validate: async (runtime: IAgentRuntime): Promise<boolean> => {
        const service = runtime.getService<HyperfyService>(
          HyperfyService.serviceName
        )
        return !!service && service.isConnected() && !!service.getWorld()
      },

      handler: this.createDynamicHandler(descriptor),

      examples: this.generateExamples(descriptor) as ActionExample[],
    }

    // Store the action
    this.registeredActions.set(descriptor.name, action)
    this.worldActions.set(descriptor.name, descriptor)

    // Register with runtime
    if (runtime.registerAction) {
      await runtime.registerAction(action)
      logger.info(
        `[DynamicActionLoader] Successfully registered action: ${descriptor.name}`
      )
    } else {
      // Fallback: Add to runtime actions array if available
      if (runtime.actions && Array.isArray(runtime.actions)) {
        runtime.actions.push(action)
        logger.info(
          `[DynamicActionLoader] Added action to runtime: ${descriptor.name}`
        )
      } else {
        logger.warn(
          `[DynamicActionLoader] Unable to register action - no registration method available`
        )
      }
    }
  }

  /**
   * Unregisters an action from the runtime
   */
  async unregisterAction(
    actionName: string,
    runtime: IAgentRuntime
  ): Promise<void> {
    logger.info(`[DynamicActionLoader] Unregistering action: ${actionName}`)

    this.registeredActions.delete(actionName)
    this.worldActions.delete(actionName)

    if (runtime.unregisterAction) {
      await runtime.unregisterAction(actionName)
    } else if (runtime.actions && Array.isArray(runtime.actions)) {
      // Fallback: Remove from actions array
      const index = runtime.actions.findIndex(a => a.name === actionName)
      if (index !== -1) {
        runtime.actions.splice(index, 1)
      }
    }
  }

  /**
   * Creates a dynamic handler for a discovered action
   */
  private createDynamicHandler(descriptor: HyperfyActionDescriptor) {
    return async (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
      _options?: {},
      callback?: HandlerCallback
    ): Promise<any> => {
      logger.info(`[DynamicAction] Executing ${descriptor.name}`)

      const service = runtime.getService<HyperfyService>(
        HyperfyService.serviceName
      )
      const world = service?.getWorld()

      if (!world) {
        if (callback) {
          await callback({
            text: `Cannot execute ${descriptor.name}: World not connected`,
            error: true,
          })
        }
        return {
          success: false,
          error: 'World not connected',
        }
      }

      // Extract parameters from message or state
      const params = await this.extractParameters(
        descriptor,
        message,
        state,
        runtime
      )

      try {
        // Execute the action through world interface
        let result
        if (world.actions?.execute) {
          result = await world.actions.execute(descriptor.name, params)
        } else {
          // Fallback: Send as network command
          if (world.network?.send) {
            world.network.send('executeAction', {
              action: descriptor.name,
              parameters: params,
            })
            result = { success: true, pending: true }
          } else {
            throw new Error('No execution method available')
          }
        }

        // Generate response based on result
        const responseText = await this.generateResponse(
          descriptor,
          params,
          result,
          runtime,
          state
        )

        if (callback) {
          await callback({
            text: responseText,
            metadata: { action: descriptor.name, result },
          })
        }

        return {
          text: responseText,
          success: true,
          data: { action: descriptor.name, parameters: params, result },
        }
      } catch (error) {
        logger.error(
          `[DynamicAction] Error executing ${descriptor.name}:`,
          error
        )

        if (callback) {
          await callback({
            text: `Failed to execute ${descriptor.name}: ${error.message}`,
            error: true,
          })
        }

        return {
          success: false,
          error: error.message,
        }
      }
    }
  }

  /**
   * Extracts parameters for an action from the message and state
   */
  private async extractParameters(
    descriptor: HyperfyActionDescriptor,
    message: Memory,
    state: State | undefined,
    runtime: IAgentRuntime
  ): Promise<Record<string, any>> {
    const params: Record<string, any> = {}

    // Simple extraction from message text
    const messageText = message.content?.text || ''

    for (const param of descriptor.parameters) {
      if (param.type === 'string') {
        // Extract quoted strings or specific patterns
        const regex = new RegExp(`${param.name}[:\\s]+["']?([^"']+)["']?`, 'i')
        const match = messageText.match(regex)
        if (match) {
          params[param.name] = match[1]
        }
      } else if (param.type === 'number') {
        // Extract numbers
        const regex = new RegExp(`${param.name}[:\\s]+(\\d+)`, 'i')
        const match = messageText.match(regex)
        if (match) {
          params[param.name] = parseInt(match[1])
        }
      }

      // Use default if not found and required
      if (params[param.name] === undefined && param.default !== undefined) {
        params[param.name] = param.default
      }
    }

    return params
  }

  /**
   * Generates response text for an executed action
   */
  private async generateResponse(
    descriptor: HyperfyActionDescriptor,
    params: Record<string, any>,
    result: any,
    runtime: IAgentRuntime,
    state?: State
  ): Promise<string> {
    // Simple response generation
    if (result.success) {
      return `Successfully executed ${descriptor.name}${result.message ? ': ' + result.message : ''}`
    } else {
      return `Failed to execute ${descriptor.name}: ${result.error || 'Unknown error'}`
    }
  }

  /**
   * Generates similes for an action based on its descriptor
   */
  private generateSimiles(descriptor: HyperfyActionDescriptor): string[] {
    const similes: string[] = []

    // Generate based on category
    switch (descriptor.category) {
      case 'combat':
        similes.push('FIGHT', 'ATTACK', 'BATTLE')
        break
      case 'inventory':
        similes.push('MANAGE_ITEMS', 'INVENTORY')
        break
      case 'skills':
        similes.push('TRAIN', 'PRACTICE', 'SKILL')
        break
      case 'quest':
        similes.push('QUEST', 'MISSION', 'TASK')
        break
      case 'social':
        similes.push('INTERACT', 'COMMUNICATE')
        break
      case 'movement':
        similes.push('MOVE', 'NAVIGATE', 'GO')
        break
    }

    // Add name variations
    const words = descriptor.name.split('_')
    if (words.length > 1) {
      similes.push(words.join(' '))
      similes.push(
        words
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join('')
      )
    }

    return similes
  }

  /**
   * Generates examples for an action from its descriptor
   */
  private generateExamples(descriptor: HyperfyActionDescriptor): any[] {
    const examples: any[] = []

    // Use provided examples
    for (const exampleText of descriptor.examples || []) {
      examples.push([
        {
          user: '{{user}}',
          content: { text: exampleText },
        },
        {
          user: '{{agent}}',
          content: {
            text: `I'll ${descriptor.name.toLowerCase().replace(/_/g, ' ')} for you.`,
            action: descriptor.name,
          },
        },
      ])
    }

    // Generate category-specific examples if none provided
    if (examples.length === 0) {
      switch (descriptor.category) {
        case 'combat':
          examples.push([
            {
              user: '{{user}}',
              content: { text: `Attack the goblin` },
            },
            {
              user: '{{agent}}',
              content: {
                text: `Engaging in combat!`,
                action: descriptor.name,
              },
            },
          ])
          break
        // Add more category-specific examples as needed
      }
    }

    return examples
  }

  /**
   * Gets all registered actions
   */
  getRegisteredActions(): Map<string, Action> {
    return new Map(this.registeredActions)
  }

  /**
   * Gets world action descriptors
   */
  getWorldActions(): Map<string, HyperfyActionDescriptor> {
    return new Map(this.worldActions)
  }

  /**
   * Clears all registered actions
   */
  clear(): void {
    this.registeredActions.clear()
    this.worldActions.clear()
  }
}
