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
import type { HyperiaService } from "../services/HyperiaService.js";
import type { Entity, InventoryItem } from "../types.js";
import {
  hasAxe,
  hasPickaxe,
  hasTinderbox,
  hasFishingEquipment,
  getItemName,
} from "../utils/item-detection.js";
import { getToolIds } from "../utils/world-data.js";

/** Weapon patterns that are always essential (not derivable from tools manifest).
 * Uses specific patterns to avoid false positives (e.g. "swordfish"). */
const WEAPON_PATTERNS = [
  "shortsword",
  "longsword",
  "2h sword",
  "2h_sword",
  "scimitar",
  "dagger",
];

/** Cached essential item patterns — derived from tools manifest + weapon patterns */
let cachedEssentialPatterns: string[] | null = null;

function getEssentialPatterns(): string[] {
  if (cachedEssentialPatterns) return cachedEssentialPatterns;

  // Derive tool keywords from manifest (e.g. "bronze_hatchet" → "hatchet")
  const toolIds = getToolIds();
  const toolKeywords = new Set<string>();
  for (const id of toolIds) {
    // Extract the base tool name: remove tier prefix (bronze_, iron_, etc.)
    const parts = id.split("_");
    if (parts.length > 1) {
      // e.g. "bronze_hatchet" → "hatchet", "small_fishing_net" → "fishing_net"
      toolKeywords.add(parts.slice(1).join("_"));
      // Also add space variant
      toolKeywords.add(parts.slice(1).join(" "));
    }
    toolKeywords.add(id); // full name too
  }

  // Always include tinderbox and hammer (not in tools manifest but essential)
  toolKeywords.add("tinderbox");
  toolKeywords.add("hammer");

  cachedEssentialPatterns = [...toolKeywords, ...WEAPON_PATTERNS];
  return cachedEssentialPatterns;
}

function isEssentialItem(item: InventoryItem): boolean {
  const name = getItemName(item);
  return getEssentialPatterns().some((p) => name.includes(p));
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
  service: HyperiaService,
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
    const service = runtime.getService<HyperiaService>("hyperiaService");
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
      const service = runtime.getService<HyperiaService>("hyperiaService");
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

      const verified = await service.waitForInventoryUpdate(2000);
      if (!verified) {
        logger.warn("[BANK_DEPOSIT] Deposit not verified by inventory update");
      }
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
    const service = runtime.getService<HyperiaService>("hyperiaService");
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
      const service = runtime.getService<HyperiaService>("hyperiaService");
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
      const verified = await service.waitForInventoryUpdate(2000);
      if (!verified) {
        logger.warn(`[BANK_WITHDRAW] Withdraw not verified for ${itemName}`);
      }
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
    const service = runtime.getService<HyperiaService>("hyperiaService");
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
      const service = runtime.getService<HyperiaService>("hyperiaService");
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

      // Deposit only non-essential items individually (keeps tools safe in inventory)
      let depositedCount = 0;
      const failedItems: typeof bankableItems = [];
      for (const item of bankableItems) {
        const itemId = item.itemId || item.name || "";
        if (itemId) {
          await service.bankDeposit(itemId, item.quantity ?? 1);
          const verified = await service.waitForInventoryUpdate(2000);
          if (verified) {
            depositedCount++;
          } else {
            failedItems.push(item);
          }
        }
      }

      // Retry pass: one more attempt for items that failed
      for (const item of failedItems) {
        const itemId = item.itemId || item.name || "";
        if (itemId) {
          await service.bankDeposit(itemId, item.quantity ?? 1);
          const verified = await service.waitForInventoryUpdate(3000);
          if (verified) {
            depositedCount++;
          } else {
            logger.warn(
              `[BANK_DEPOSIT_ALL] Deposit failed after retry: ${itemId}`,
            );
          }
        }
      }

      await service.closeBank();

      // Verify actual success rate — if most items remain, report failure
      const successRate =
        bankableItems.length > 0 ? depositedCount / bankableItems.length : 1;
      if (successRate < 0.5) {
        const failText = `Only deposited ${depositedCount}/${bankableItems.length} items — banking unreliable`;
        logger.warn(`[BANK_DEPOSIT_ALL] ${failText}`);
        await callback?.({ text: failText, action: "BANK_DEPOSIT_ALL" });
        return { success: false, error: new Error(failText) };
      }

      const responseText = `Banked ${depositedCount}/${bankableItems.length} items. Kept ${essentialItems.length} essential tools.`;
      await callback?.({ text: responseText, action: "BANK_DEPOSIT_ALL" });
      logger.info(`[BANK_DEPOSIT_ALL] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: {
          action: "BANK_DEPOSIT_ALL",
          deposited: depositedCount,
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
