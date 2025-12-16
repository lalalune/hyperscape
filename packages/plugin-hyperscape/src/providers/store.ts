/**
 * Store Provider - Supplies store/shop inventory to the agent
 *
 * Provides:
 * - List of items available for purchase
 * - Store name and ID
 * - Buyback rate
 * - Item prices and stock quantities
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

export const storeProvider: Provider = {
  name: "store",
  description: "Provides current store inventory, prices, and stock levels",
  dynamic: true,
  position: 9,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const storeState = service?.getStoreState?.();

    if (!storeState || !storeState.isOpen) {
      return {
        text: "No store is currently open. Interact with a shopkeeper NPC to open a store.",
        values: { isOpen: false },
        data: { isOpen: false },
      };
    }

    // Build text description
    const lines: string[] = [`## ${storeState.storeName}`];
    lines.push(`- **Store ID**: ${storeState.storeId}`);
    lines.push(
      `- **Buyback Rate**: ${Math.round(storeState.buybackRate * 100)}%`,
    );
    lines.push(`- **Items Available**: ${storeState.items.length}`);
    lines.push("");

    // Group items by category
    const categories = new Map<string, typeof storeState.items>();
    storeState.items.forEach((item) => {
      const cat = item.category || "General";
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat)!.push(item);
    });

    // List items
    if (storeState.items.length > 0) {
      lines.push("**Available Items:**");

      if (categories.size > 1) {
        // Multiple categories - show by category
        for (const [category, items] of categories.entries()) {
          lines.push(`\n${category}:`);
          items.slice(0, 15).forEach((item) => {
            const stock =
              item.stockQuantity > 0
                ? ` (${item.stockQuantity} in stock)`
                : " (out of stock)";
            lines.push(`  - ${item.name}: ${item.price} gp${stock}`);
          });
          if (items.length > 15) {
            lines.push(`  ... and ${items.length - 15} more items`);
          }
        }
      } else {
        // Single category - flat list
        storeState.items.slice(0, 20).forEach((item) => {
          const stock =
            item.stockQuantity > 0
              ? ` (${item.stockQuantity} in stock)`
              : " (out of stock)";
          lines.push(`  - ${item.name}: ${item.price} gp${stock}`);
        });
        if (storeState.items.length > 20) {
          lines.push(`  ... and ${storeState.items.length - 20} more items`);
        }
      }
    } else {
      lines.push("**Available Items**: (store is empty)");
    }

    return {
      text: lines.join("\n"),
      values: {
        isOpen: true,
        storeId: storeState.storeId,
        storeName: storeState.storeName,
        itemCount: storeState.items.length,
        buybackRate: storeState.buybackRate,
      },
      data: {
        isOpen: true,
        storeId: storeState.storeId,
        storeName: storeState.storeName,
        buybackRate: storeState.buybackRate,
        items: storeState.items,
        npcEntityId: storeState.npcEntityId,
      },
    };
  },
};
