import {
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type HandlerOptions,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core'
import { HyperscapeService } from '../service'
import { BankDepositCompleteData } from '../types/rpg-events'

// Event types for banking
const BANK_DEPOSIT_ALL = 'rpg:bank:deposit_all'
const BANK_DEPOSIT_SUCCESS = 'rpg:bank:deposit_success'

/**
 * BANK_ITEMS Action
 *
 * Finds nearest bank and deposits items via event system
 */
export const bankItemsAction: Action = {
  name: 'BANK_ITEMS',
  similes: ['DEPOSIT_ITEMS', 'STORE_ITEMS', 'BANK_LOGS', 'DEPOSIT_LOGS', 'GO_TO_BANK'],
  description: 'Find and navigate to the nearest bank, then deposit items into it',

  validate: async (runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
    const world = service?.getWorld()

    // Basic connection check
    if (!service || !service.isConnected() || !world) {
      return false
    }

    // Check for nearby banks
    const entities = world?.entities?.items
    const player = world?.entities?.player
    const playerPos = player?.position

    if (!entities || !playerPos) {
      return false
    }

    let hasNearbyBank = false
    for (const [_id, entity] of entities.entries()) {
      const entityType = entity?.type as string
      const entityName = entity?.name || ''

      if (
        entityType?.includes('bank') ||
        entityName.toLowerCase().includes('bank') ||
        entityName.toLowerCase().includes('banker')
      ) {
        const entityPos = entity?.position
        if (entityPos) {
          const dx = entityPos.x - playerPos.x
          const dz = entityPos.z - playerPos.z
          const distance = Math.sqrt(dx * dx + dz * dz)

          if (distance <= 15) {
            hasNearbyBank = true
            break
          }
        }
      }
    }

    // Only show action if there's a bank nearby
    return hasNearbyBank
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
    const world = service?.getWorld()
    const player = world?.entities?.player

    if (!service || !world || !player) {
      logger.error('[BANK_ITEMS] Hyperscape service, world, or player not available')
      if (callback) {
        await callback({
          text: 'Error: Cannot bank items. Hyperscape connection unavailable.',
          actions: ['BANK_ITEMS'],
          source: 'hyperscape',
        })
      }
      return {
        text: 'Error: Cannot bank items. Hyperscape connection unavailable.',
        success: false,
        values: { success: false, error: 'service_unavailable' },
        data: { action: 'BANK_ITEMS' },
      }
    }

    try {
      logger.info('[BANK_ITEMS] Starting banking via event system')
      
      await callback?.({
        text: 'Looking for nearest bank... 🏦',
        actions: ['BANK_ITEMS'],
        source: 'hyperscape',
      })

      // Emit bank deposit all event and wait for completion
      const bankResult = await new Promise<BankDepositCompleteData | { success: boolean; error: string }>((resolve) => {
        const completionHandler = (data: BankDepositCompleteData) => {
          if (data.playerId === player.id) {
            clearTimeout(timeout)
            world.off(BANK_DEPOSIT_SUCCESS, completionHandler)

            logger.info(`[BANK_ITEMS] Received bank completion for player ${data.playerId}`)
            resolve(data)
          }
        }

        const timeout = setTimeout(() => {
          world.off(BANK_DEPOSIT_SUCCESS, completionHandler)
          logger.error('[BANK_ITEMS] Banking timeout')
          resolve({ success: false, error: 'Banking timeout' })
        }, 15000)

        world.on(BANK_DEPOSIT_SUCCESS, completionHandler)

        // Emit bank deposit all event
        world.emit(BANK_DEPOSIT_ALL, {
          playerId: player.id,
          itemId: 'logs'  // Could be parameterized
        })
        
        logger.info(`[BANK_ITEMS] Emitted BANK_DEPOSIT_ALL for logs`)
      })

      if ('error' in bankResult) {
        logger.error(`[BANK_ITEMS] Banking failed: ${bankResult.error}`)
        await callback?.({
          text: `Failed to bank items: ${bankResult.error}`,
          actions: ['BANK_ITEMS'],
          source: 'hyperscape',
        })
        return {
          text: `Failed to bank items: ${bankResult.error}`,
          success: false,
          values: { success: false, error: bankResult.error },
          data: { action: 'BANK_ITEMS' },
        }
      }

      const itemCount = bankResult.items?.length || 0
      logger.info(`[BANK_ITEMS] Successfully banked ${itemCount} items`)

      await callback?.({
        text: `Banking complete! ${itemCount} item${itemCount !== 1 ? 's' : ''} deposited. ✅`,
        actions: ['BANK_ITEMS'],
        source: 'hyperscape',
      })

      return {
        text: `Banking complete! ${itemCount} item${itemCount !== 1 ? 's' : ''} deposited. ✅`,
        success: true,
        values: {
          success: true,
          itemCount,
        },
        data: {
          action: 'BANK_ITEMS',
          itemsDeposited: bankResult.items,
          itemCount
        },
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[BANK_ITEMS] Error:', error instanceof Error ? error.message : String(error))

      await callback?.({
        text: `Banking error: ${errorMsg}`,
        actions: ['BANK_ITEMS'],
        source: 'hyperscape',
      })

      return {
        text: `Banking error: ${errorMsg}`,
        success: false,
        values: { success: false, error: 'execution_failed', detail: errorMsg },
        data: { action: 'BANK_ITEMS' },
      }
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: { text: 'Bank my logs' }
      },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to store logs at a bank',
          text: 'Looking for nearest bank... 🏦',
          actions: ['BANK_ITEMS'],
          source: 'hyperscape',
        }
      }
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'My inventory is full, store these items' }
      },
      {
        name: '{{agent}}',
        content: {
          thought: 'Inventory is full - I should find a bank and deposit items',
          text: 'Looking for nearest bank... 🏦',
          actions: ['BANK_ITEMS'],
          source: 'hyperscape',
        }
      }
    ],
  ] as ActionExample[][]
}
