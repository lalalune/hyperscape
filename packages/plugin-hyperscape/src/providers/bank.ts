/**
 * Bank Provider - Supplies bank contents to the agent
 *
 * Provides:
 * - List of items stored in bank
 * - Bank coins
 * - Available slots
 * - Bank tab information
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

export const bankProvider: Provider = {
  name: "bank",
  description: "Provides current bank contents, coins, and available slots",
  dynamic: true,
  position: 8,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const bankState = service?.getBankState?.();

    if (!bankState || !bankState.isOpen) {
      return {
        text: "Bank is not currently open. Move near a bank booth and interact with it to access your bank.",
        values: { isOpen: false },
        data: { isOpen: false },
      };
    }

    // Count items by tab
    const itemsByTab = new Map<number, typeof bankState.items>();
    bankState.items.forEach((item) => {
      if (!itemsByTab.has(item.tabIndex)) {
        itemsByTab.set(item.tabIndex, []);
      }
      itemsByTab.get(item.tabIndex)!.push(item);
    });

    // Count actual items (quantity > 0)
    const actualItems = bankState.items.filter((i) => i.quantity > 0);
    const usedSlots = actualItems.length;
    const freeSlots = bankState.maxSlots - usedSlots;

    // Build text description
    const lines: string[] = ["## Your Bank"];
    lines.push(`- **Bank ID**: ${bankState.bankId}`);
    lines.push(`- **Bank Coins**: ${bankState.coins} gp`);
    lines.push(`- **Used Slots**: ${usedSlots}/${bankState.maxSlots}`);
    lines.push(`- **Free Slots**: ${freeSlots}`);
    lines.push(`- **Tabs**: ${bankState.tabs.length || 1}`);
    lines.push("");

    // List items by tab
    if (actualItems.length > 0) {
      lines.push("**Items:**");

      // Group by tab
      const tabs = Array.from(itemsByTab.entries()).sort((a, b) => a[0] - b[0]);
      for (const [tabIndex, items] of tabs) {
        const tabItems = items.filter((i) => i.quantity > 0);
        if (tabItems.length === 0) continue;

        if (bankState.tabs.length > 1) {
          lines.push(`\nTab ${tabIndex + 1}:`);
        }
        tabItems.slice(0, 20).forEach((item, idx) => {
          lines.push(`  ${idx + 1}. ${item.itemId} x${item.quantity}`);
        });
        if (tabItems.length > 20) {
          lines.push(`  ... and ${tabItems.length - 20} more items`);
        }
      }
    } else {
      lines.push("**Items**: (bank is empty)");
    }

    return {
      text: lines.join("\n"),
      values: {
        isOpen: true,
        coins: bankState.coins,
        itemCount: actualItems.length,
        freeSlots,
        tabCount: bankState.tabs.length || 1,
      },
      data: {
        isOpen: true,
        bankId: bankState.bankId,
        items: actualItems,
        tabs: bankState.tabs,
        coins: bankState.coins,
        maxSlots: bankState.maxSlots,
        alwaysSetPlaceholder: bankState.alwaysSetPlaceholder,
      },
    };
  },
};
