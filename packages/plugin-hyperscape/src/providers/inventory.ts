/**
 * inventoryProvider - Supplies inventory context to the agent
 *
 * Provides:
 * - List of items in inventory
 * - Coin count
 * - Free inventory slots
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { InventoryData } from "../types.js";

export const inventoryProvider: Provider = {
  name: "inventory",
  description: "Provides current inventory items, coins, and free slots",
  dynamic: true,
  position: 2,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const playerEntity = service?.getPlayerEntity();

    if (!playerEntity) {
      return {
        text: "Inventory unavailable",
        values: {},
        data: {},
      };
    }

    const MAX_SLOTS = 28;
    const freeSlots = MAX_SLOTS - playerEntity.items.length;

    const inventoryData: InventoryData = {
      items: playerEntity.items,
      coins: playerEntity.coins,
      freeSlots,
    };

    const itemsList =
      playerEntity.items.length > 0
        ? playerEntity.items
            .map((item, idx) => `  ${idx + 1}. ${item.name} x${item.quantity}`)
            .join("\n")
        : "  (empty)";

    const text = `## Your Inventory
- **Coins**: ${playerEntity.coins} gp
- **Free Slots**: ${freeSlots}/${MAX_SLOTS}
- **Items**:
${itemsList}`;

    return {
      text,
      values: {
        coins: playerEntity.coins,
        itemCount: playerEntity.items.length,
        freeSlots,
      },
      data: inventoryData,
    };
  },
};
