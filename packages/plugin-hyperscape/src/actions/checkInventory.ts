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

/**
 * Inventory data structure
 */
type InventoryItem = {
  itemId: string
  quantity?: number
  itemName?: string
}

type InventoryData = {
  items: InventoryItem[]
  coins: number
}

type PlayerInventoryData = {
  inventory?: InventoryItem[] | InventoryData
}

/**
 * CHECK_INVENTORY Action
 *
 * Displays current inventory contents by reading from world state
 */
export const checkInventoryAction: Action = {
  name: 'CHECK_INVENTORY',
  similes: ['INVENTORY', 'CHECK_ITEMS', 'WHAT_DO_I_HAVE', 'SHOW_INVENTORY'],
  description: 'Check what items are in your inventory',

  validate: async (runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
    return !!service && service.isConnected() && !!service.getWorld()
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    __options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
    const world = service?.getWorld()
    const player = world?.entities?.player

    if (!service || !world || !player) {
      logger.error('[CHECK_INVENTORY] Hyperscape service, world, or player not available')
      if (callback) {
        await callback({
          text: 'Error: Cannot check inventory. Hyperscape connection unavailable.',
          actions: ['CHECK_INVENTORY'],
          source: 'hyperscape',
        })
      }
      return {
        text: 'Error: Cannot check inventory. Hyperscape connection unavailable.',
        success: false,
        values: { success: false, error: 'service_unavailable' },
        data: { action: 'CHECK_INVENTORY' },
      }
    }

    try {
      logger.info('[CHECK_INVENTORY] Reading inventory from world state')

      // Read inventory from player data - handle both array and object formats
      const playerData = player.data as PlayerInventoryData
      const rawInventory = playerData?.inventory

      // Normalize inventory to standard format
      let inventory: InventoryData
      if (!rawInventory) {
        // No inventory data
        inventory = { items: [], coins: 100 }
      } else if (Array.isArray(rawInventory)) {
        // Inventory is an array of items
        inventory = { items: rawInventory, coins: 100 }
      } else {
        // Inventory is already an object with items and coins
        inventory = rawInventory
      }

      const items = inventory.items

      if (items.length === 0) {
        logger.info('[CHECK_INVENTORY] Inventory is empty')
        await callback?.({
          text: `My inventory is empty. I have ${inventory.coins} coins.`,
          actions: ['CHECK_INVENTORY'],
          source: 'hyperscape',
        })
        return {
          text: `My inventory is empty. I have ${inventory.coins} coins.`,
          success: true,
          values: { success: true, empty: true, coins: inventory.coins },
          data: { action: 'CHECK_INVENTORY', inventory },
        }
      }

      const itemList = items
        .map(item => `${item.quantity || 1}x ${item.itemName || item.itemId}`)
        .join(', ')

      const freeSlots = 28 - items.length
      logger.info(`[CHECK_INVENTORY] ${items.length} item types in inventory`)

      await callback?.({
        text: `I have: ${itemList}. ${inventory.coins} coins. ${freeSlots}/28 slots free.`,
        actions: ['CHECK_INVENTORY'],
        source: 'hyperscape',
      })

      return {
        text: `I have: ${itemList}. ${inventory.coins} coins. ${freeSlots}/28 slots free.`,
        success: true,
        values: { success: true, itemCount: items.length, coins: inventory.coins },
        data: { action: 'CHECK_INVENTORY', inventory },
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[CHECK_INVENTORY] Error:', error instanceof Error ? error.message : String(error))

      await callback?.({
        text: `Error checking inventory: ${errorMsg}`,
        actions: ['CHECK_INVENTORY'],
        source: 'hyperscape',
      })

      return {
        text: `Error checking inventory: ${errorMsg}`,
        success: false,
        values: { success: false, error: 'execution_failed', detail: errorMsg },
        data: { action: 'CHECK_INVENTORY' },
      }
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: { text: 'What do you have?' }
      },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants to know my inventory',
          text: 'I have: 5x Logs. 100 coins. 26/28 slots free.',
          actions: ['CHECK_INVENTORY'],
          source: 'hyperscape',
        }
      }
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'Check your inventory' }
      },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to check my items',
          text: 'My inventory is empty. I have 100 coins.',
          actions: ['CHECK_INVENTORY'],
          source: 'hyperscape',
        }
      }
    ]
  ] as ActionExample[][]
}
