import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
} from "@elizaos/core";
import { HyperscapeService } from "../service";

export const bankingProvider: Provider = {
  name: "BANKING_INFO",
  description:
    "Provides nearby bank locations, inventory status, and banking availability",
  dynamic: true, // Only loaded when explicitly requested by banking actions
  position: 2, // Contextual skills come after world state, before actions
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );

    if (!service || !service.isConnected()) {
      return {
        text: "# Banking\nStatus: Not connected to world",
        values: {
          banking_available: false,
        },
        data: {},
      };
    }

    const world = service.getWorld();
    const player = world?.entities?.player;
    const playerData = player?.data as
      | {
          inventory?: {
            items?: Array<{ itemId: string; quantity: number }>;
            maxSlots?: number;
          };
        }
      | undefined;

    // Get inventory status
    const inventory = playerData?.inventory?.items || [];
    const maxSlots = playerData?.inventory?.maxSlots || 28;
    const usedSlots = inventory.length;
    const freeSlots = maxSlots - usedSlots;

    // Find nearby banks
    const entities = world?.entities?.items;
    const playerPos = player?.position;
    const nearbyBanks: Array<{ id: string; name: string; distance: number }> =
      [];

    if (entities && playerPos) {
      for (const [id, entity] of entities.entries()) {
        const entityType = entity?.type as string;
        const entityName = entity?.name || "Unnamed";

        if (
          entityType?.includes("bank") ||
          entityName?.toLowerCase().includes("bank") ||
          entityName?.toLowerCase().includes("banker")
        ) {
          const entityPos = entity?.position;
          if (entityPos) {
            const dx = entityPos.x - playerPos.x;
            const dz = entityPos.z - playerPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance <= 15) {
              nearbyBanks.push({ id, name: entityName, distance });
            }
          }
        }
      }
    }

    const bankList = nearbyBanks
      .map((bank) => `- ${bank.name} (${bank.distance.toFixed(1)}m away)`)
      .join("\n");

    const inventoryList = inventory
      .slice(0, 10)
      .map((item) => `- ${item.itemId} x${item.quantity}`)
      .join("\n");

    const text = `# Banking

## Inventory Status
- Used Slots: ${usedSlots}/${maxSlots}
- Free Slots: ${freeSlots}

## Current Inventory (showing first 10)
${inventory.length > 0 ? inventoryList : "Inventory is empty"}
${inventory.length > 10 ? `... and ${inventory.length - 10} more items` : ""}

## Nearby Banks (${nearbyBanks.length})
${nearbyBanks.length > 0 ? bankList : "No banks nearby"}

## Banking Tips
- Use BANK_ITEMS action when near a bank
- Banks are located in towns
- Each town has its own bank storage
- Unlimited bank storage per town`;

    return {
      text,
      values: {
        inventory_slots_used: usedSlots,
        inventory_slots_free: freeSlots,
        inventory_slots_total: maxSlots,
        nearby_banks_count: nearbyBanks.length,
        banking_available: nearbyBanks.length > 0,
      },
      data: {
        inventory,
        nearbyBanks,
      },
    };
  },
};
