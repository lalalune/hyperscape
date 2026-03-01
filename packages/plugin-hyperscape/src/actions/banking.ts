/**
 * Banking actions - BANK_DEPOSIT, BANK_WITHDRAW, BANK_DEPOSIT_ALL
 *
 * Autonomous-friendly banking: agents walk to bank, open session,
 * deposit/withdraw using proper server packet protocol, then close.
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { Entity, InventoryItem } from "../types.js";
import {
  hasAxe,
  hasPickaxe,
  hasTinderbox,
  hasFishingEquipment,
  getItemName,
} from "../utils/item-detection.js";

/** Items we never want to deposit — essential tools the agent needs to keep.
 * Uses specific patterns to avoid false positives (e.g. "swordfish").
 * Validated against packages/server/world/assets/manifests/ item data. */
const ESSENTIAL_ITEM_PATTERNS = [
  // Gathering tools
  "hatchet",
  "pickaxe",
  "tinderbox",
  "fishing net",
  "fishing_net",
  "fishing rod",
  "fishing_rod",
  "hammer",
  // Melee weapons (specific enough to not match food like "swordfish")
  "shortsword",
  "longsword",
  "2h sword",
  "2h_sword",
  "scimitar",
  "dagger",
];

function isEssentialItem(item: InventoryItem): boolean {
  const name = getItemName(item);
  return ESSENTIAL_ITEM_PATTERNS.some((p) => name.includes(p));
}

function getPlayerPosition(player: {
  position?: unknown;
}): [number, number, number] | null {
  const pos = player.position;
  if (Array.isArray(pos) && pos.length >= 3) {
    return [pos[0], pos[1], pos[2]];
  }
  if (pos && typeof pos === "object" && "x" in pos) {
    const p = pos as { x: number; y?: number; z: number };
    return [p.x, p.y ?? 0, p.z];
  }
  return null;
}

function distanceBetween(
  a: [number, number, number],
  b: unknown,
): number | null {
  let bx: number, bz: number;
  if (Array.isArray(b) && b.length >= 3) {
    bx = b[0];
    bz = b[2];
  } else if (b && typeof b === "object" && "x" in b) {
    const p = b as { x: number; z: number };
    bx = p.x;
    bz = p.z;
  } else {
    return null;
  }
  const dx = a[0] - bx;
  const dz = a[2] - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Find nearest bank entity from nearby entities or world map stations
 */
function findNearestBank(
  service: HyperscapeService,
  playerPos: [number, number, number],
): { id: string; position: [number, number, number] } | null {
  const nearbyEntities = service.getNearbyEntities();

  // Check nearby entities for bank/banker
  let bestBank: { id: string; position: [number, number, number] } | null =
    null;
  let bestDist = Infinity;

  for (const entity of nearbyEntities) {
    const entityType = (entity.entityType || "").toLowerCase();
    const type = (entity.type || "").toLowerCase();
    const name = (entity.name || "").toLowerCase();

    const isBank =
      entityType === "banker" ||
      entityType === "bank" ||
      type === "bank" ||
      type === "banker" ||
      name.includes("bank");

    if (!isBank || !entity.position) continue;

    const dist = distanceBetween(playerPos, entity.position);
    if (dist !== null && dist < bestDist) {
      bestDist = dist;
      const pos = Array.isArray(entity.position)
        ? ([entity.position[0], entity.position[1], entity.position[2]] as [
            number,
            number,
            number,
          ])
        : [
            (entity.position as { x: number }).x,
            0,
            (entity.position as { z: number }).z,
          ];
      bestBank = {
        id: entity.id,
        position: pos as [number, number, number],
      };
    }
  }

  if (bestBank) return bestBank;

  // Fall back to world map stations
  const worldMap = service.getWorldMap?.();
  if (worldMap?.stations) {
    for (const station of worldMap.stations) {
      const sType = (station.type || "").toLowerCase();
      if (!sType.includes("bank")) continue;

      const dist = distanceBetween(playerPos, station.position);
      if (dist !== null && dist < bestDist) {
        bestDist = dist;
        bestBank = {
          id: station.id,
          position: [
            station.position.x,
            station.position.y,
            station.position.z,
          ],
        };
      }
    }
  }

  return bestBank;
}

const BANK_INTERACTION_RANGE = 5;

// ============================================================================
// BANK_DEPOSIT — deposit specific items
// ============================================================================

export const bankDepositAction: Action = {
  name: "BANK_DEPOSIT",
  similes: ["DEPOSIT", "BANK_ITEMS", "STORE"],
  description:
    "Deposit items into the bank. Walks to nearest bank if not already there. Use BANK_DEPOSIT_ALL for bulk depositing.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;
    if (player.inCombat) return false;

    const inventoryItems = Array.isArray(player.items) ? player.items : [];
    return inventoryItems.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return { success: false, error: new Error("Service not available") };
      }

      const player = service.getPlayerEntity();
      if (!player) {
        return { success: false, error: new Error("No player entity") };
      }

      const playerPos = getPlayerPosition(player);
      if (!playerPos) {
        return {
          success: false,
          error: new Error("Cannot determine position"),
        };
      }

      // Find nearest bank
      const bank = findNearestBank(service, playerPos);
      if (!bank) {
        await callback?.({
          text: "No bank found nearby. I need to travel to a town with a bank.",
          action: "BANK_DEPOSIT",
        });
        return { success: false, error: new Error("No bank found nearby") };
      }

      const dist = distanceBetween(playerPos, bank.position);

      // Walk to bank if too far — await arrival then proceed
      if (dist !== null && dist > BANK_INTERACTION_RANGE) {
        logger.info(`[BANK_DEPOSIT] Walking to bank (${dist.toFixed(1)} away)`);
        await service.executeMove({ target: bank.position, runMode: true });
        await callback?.({
          text: `Walking to the bank... (${dist.toFixed(0)} units away)`,
          action: "BANK_DEPOSIT",
        });
        await service.waitForMovementComplete(15000);
      }

      // Parse what to deposit from message
      const content = message.content.text || "";
      const inventoryItems = Array.isArray(player.items) ? player.items : [];

      // Open bank session
      await service.openBank(bank.id);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check for "all" keyword
      if (content.toLowerCase().includes("all")) {
        await service.bankDepositAll();
      } else {
        // Try to find specific item
        const term = content
          .toLowerCase()
          .replace(/deposit\s*/i, "")
          .replace(/\d+\s*/g, "")
          .trim();
        const item = inventoryItems.find((i) => getItemName(i).includes(term));
        if (item) {
          await service.bankDeposit(
            item.id || item.itemId || "",
            item.quantity || 1,
          );
        } else {
          await service.bankDepositAll();
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
      await service.closeBank();

      const responseText = "Deposited items into the bank.";
      await callback?.({ text: responseText, action: "BANK_DEPOSIT" });
      return { success: true, text: responseText };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[BANK_DEPOSIT] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to deposit: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Deposit all logs" } },
      {
        name: "agent",
        content: {
          text: "Deposited items into the bank.",
          action: "BANK_DEPOSIT",
        },
      },
    ],
  ],
};

// ============================================================================
// BANK_WITHDRAW — withdraw specific items
// ============================================================================

export const bankWithdrawAction: Action = {
  name: "BANK_WITHDRAW",
  similes: ["WITHDRAW", "TAKE_FROM_BANK"],
  description:
    "Withdraw items from the bank. Walks to nearest bank if not already there.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;
    if (player.inCombat) return false;

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return { success: false, error: new Error("Service not available") };
      }

      const player = service.getPlayerEntity();
      if (!player) {
        return { success: false, error: new Error("No player entity") };
      }

      const playerPos = getPlayerPosition(player);
      if (!playerPos) {
        return {
          success: false,
          error: new Error("Cannot determine position"),
        };
      }

      const bank = findNearestBank(service, playerPos);
      if (!bank) {
        await callback?.({
          text: "No bank found nearby. I need to travel to a town with a bank.",
          action: "BANK_WITHDRAW",
        });
        return { success: false, error: new Error("No bank found nearby") };
      }

      const dist = distanceBetween(playerPos, bank.position);

      // Walk to bank if too far — await arrival then proceed
      if (dist !== null && dist > BANK_INTERACTION_RANGE) {
        logger.info(
          `[BANK_WITHDRAW] Walking to bank (${dist.toFixed(1)} away)`,
        );
        await service.executeMove({ target: bank.position, runMode: true });
        await callback?.({
          text: `Walking to the bank... (${dist.toFixed(0)} units away)`,
          action: "BANK_WITHDRAW",
        });
        await service.waitForMovementComplete(15000);
      }

      const content = message.content.text || "";
      const itemName = content
        .toLowerCase()
        .replace(/withdraw\s*/i, "")
        .replace(/\d+\s*/g, "")
        .trim();

      if (!itemName) {
        await callback?.({
          text: "Please specify which item to withdraw.",
          action: "BANK_WITHDRAW",
        });
        return {
          success: false,
          error: new Error("No item specified for withdrawal"),
        };
      }

      const quantityMatch = content.match(/(\d+)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;

      // Open bank, withdraw, close
      await service.openBank(bank.id);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await service.bankWithdraw(itemName, quantity);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await service.closeBank();

      const amountLabel = quantity > 1 ? `${quantity}x ` : "";
      const responseText = `Withdrew ${amountLabel}${itemName} from the bank.`;
      await callback?.({ text: responseText, action: "BANK_WITHDRAW" });
      return { success: true, text: responseText };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[BANK_WITHDRAW] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to withdraw: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Withdraw axe" } },
      {
        name: "agent",
        content: {
          text: "Withdrew axe from the bank.",
          action: "BANK_WITHDRAW",
        },
      },
    ],
  ],
};

// ============================================================================
// BANK_DEPOSIT_ALL — autonomous bulk banking
// ============================================================================

export const bankDepositAllAction: Action = {
  name: "BANK_DEPOSIT_ALL",
  similes: ["BANK_ALL", "DUMP_INVENTORY", "BANK_EVERYTHING"],
  description:
    "Deposit all non-essential items at the bank. Keeps tools (axe, pickaxe, tinderbox, net). Use when inventory is full from gathering.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;
    if (player.inCombat) return false;

    const inventoryItems = Array.isArray(player.items) ? player.items : [];
    // Only useful if we have more than just essential tools
    const bankableCount = inventoryItems.filter(
      (i) => !isEssentialItem(i),
    ).length;
    return bankableCount > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return { success: false, error: new Error("Service not available") };
      }

      const player = service.getPlayerEntity();
      if (!player) {
        return { success: false, error: new Error("No player entity") };
      }

      const playerPos = getPlayerPosition(player);
      if (!playerPos) {
        return {
          success: false,
          error: new Error("Cannot determine position"),
        };
      }

      const bank = findNearestBank(service, playerPos);
      if (!bank) {
        await callback?.({
          text: "No bank found nearby. I need to travel to a town with a bank first.",
          action: "BANK_DEPOSIT_ALL",
        });
        return { success: false, error: new Error("No bank found nearby") };
      }

      const dist = distanceBetween(playerPos, bank.position);

      // Walk to bank if too far — await arrival then proceed
      if (dist !== null && dist > BANK_INTERACTION_RANGE) {
        logger.info(
          `[BANK_DEPOSIT_ALL] Walking to bank (${dist.toFixed(1)} away)`,
        );
        await service.executeMove({ target: bank.position, runMode: true });
        await callback?.({
          text: `Walking to the bank to deposit items... (${dist.toFixed(0)} units away)`,
          action: "BANK_DEPOSIT_ALL",
        });
        await service.waitForMovementComplete(15000);
      }

      const inventoryItems = Array.isArray(player.items) ? player.items : [];
      const bankableItems = inventoryItems.filter((i) => !isEssentialItem(i));
      const essentialItems = inventoryItems.filter((i) => isEssentialItem(i));

      logger.info(
        `[BANK_DEPOSIT_ALL] At bank. Depositing ${bankableItems.length} items, keeping ${essentialItems.length} essentials`,
      );

      // Open bank session
      await service.openBank(bank.id);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Deposit all items
      await service.bankDepositAll();
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Withdraw back essential tools that we want to keep.
      // Validated against packages/server/world/assets/manifests/items/.
      const toolsToKeep = [
        // Gathering tools
        "bronze_hatchet",
        "iron_hatchet",
        "steel_hatchet",
        "mithril_hatchet",
        "adamant_hatchet",
        "rune_hatchet",
        "bronze_pickaxe",
        "iron_pickaxe",
        "steel_pickaxe",
        "mithril_pickaxe",
        "adamant_pickaxe",
        "rune_pickaxe",
        "tinderbox",
        "hammer",
        "small_fishing_net",
        "fishing_rod",
        "fly_fishing_rod",
        "harpoon",
        "lobster_pot",
        // Melee weapons
        "bronze_shortsword",
        "iron_shortsword",
        "steel_shortsword",
        "mithril_shortsword",
        "adamant_shortsword",
        "rune_shortsword",
        "bronze_longsword",
        "iron_longsword",
        "steel_longsword",
        "bronze_scimitar",
        "iron_scimitar",
        "steel_scimitar",
        "bronze_dagger",
        "iron_dagger",
        "steel_dagger",
      ];

      // Only withdraw tools we actually had before depositing
      const essentialNames = essentialItems.map((i) =>
        (i.itemId || i.name || "").toLowerCase(),
      );
      for (const toolId of toolsToKeep) {
        if (
          essentialNames.some((n) => n.includes(toolId) || toolId.includes(n))
        ) {
          await service.bankWithdraw(toolId, 1);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      await service.closeBank();

      const responseText = `Banked ${bankableItems.length} items. Kept essential tools.`;
      await callback?.({ text: responseText, action: "BANK_DEPOSIT_ALL" });
      logger.info(`[BANK_DEPOSIT_ALL] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: {
          action: "BANK_DEPOSIT_ALL",
          deposited: bankableItems.length,
          keptEssentials: essentialItems.length,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[BANK_DEPOSIT_ALL] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to bank items: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      {
        name: "system",
        content: { text: "Inventory full with 28 shrimp, near a bank" },
      },
      {
        name: "agent",
        content: {
          text: "Banked 24 items. Kept essential tools.",
          action: "BANK_DEPOSIT_ALL",
        },
      },
    ],
  ],
};

export const bankingActions = [
  bankDepositAction,
  bankWithdrawAction,
  bankDepositAllAction,
];
