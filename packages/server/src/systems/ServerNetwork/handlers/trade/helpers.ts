/**
 * Trade Handler Utilities
 *
 * Shared utilities for all trade handler modules.
 * IMPORTANT: This module must NOT import from any handler module to prevent circular imports.
 */

import {
  type World,
  getItem,
  type TradeOfferView,
  type TradeOfferItem,
} from "@hyperforge/shared";
import type { ServerSocket } from "../../../../shared/types";
import { RateLimitService } from "../../services";
import { sendToSocket, getPlayerId, getEntityPosition } from "../common";
import type { TradingSystem } from "../../../TradingSystem";
import type { PendingTradeManager } from "../../PendingTradeManager";

// ============================================================================
// SHARED STATE
// ============================================================================

/** Single rate limiter instance shared across all trade modules */
export const rateLimiter = new RateLimitService();

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum distance in tiles for players to initiate a trade (OSRS-style)
 * Players must be adjacent (1 tile) to trade
 */
export const TRADE_PROXIMITY_TILES = 1;

// ============================================================================
// SYSTEM ACCESS
// ============================================================================

/**
 * Get TradingSystem from world
 */
export function getTradingSystem(world: World): TradingSystem | undefined {
  const worldWithTrading = world as { tradingSystem?: TradingSystem };
  return worldWithTrading.tradingSystem;
}

/**
 * Get PendingTradeManager from world
 */
export function getPendingTradeManager(
  world: World,
): PendingTradeManager | undefined {
  const worldWithPending = world as {
    pendingTradeManager?: PendingTradeManager;
  };
  return worldWithPending.pendingTradeManager;
}

// ============================================================================
// PLAYER INFORMATION
// ============================================================================

/**
 * Get player name from world entities
 *
 * Returns player's display name, or "Unknown" if entity not found.
 * This can happen during race conditions (player disconnecting during trade).
 */
export function getPlayerName(world: World, playerId: string): string {
  const player = world.entities?.players?.get(playerId);
  if (!player) {
    console.debug(
      "[TradeHandler] Player entity not found for name lookup:",
      playerId,
    );
    return "Unknown";
  }
  const entity = player as {
    name?: string;
    data?: { name?: string };
    playerName?: string;
  };
  const name = entity.name || entity.data?.name || entity.playerName;
  if (!name) {
    console.warn(
      "[TradeHandler] Player entity found but no name property:",
      playerId,
    );
    return "Unknown";
  }
  return name;
}

/**
 * Get player combat level from world entities
 *
 * Returns player's combat level, or 3 (minimum) if not found.
 * Level 3 is the base combat level in OSRS.
 */
export function getPlayerCombatLevel(world: World, playerId: string): number {
  const player = world.entities?.players?.get(playerId);
  if (!player) {
    return 3;
  }
  const entity = player as unknown as {
    combatLevel?: number;
    data?: { combatLevel?: number };
    level?: number;
  };
  const level = entity.combatLevel || entity.data?.combatLevel || entity.level;
  if (typeof level !== "number" || level < 3) {
    return 3;
  }
  return Math.min(level, 126);
}

// ============================================================================
// PROXIMITY CHECKS
// ============================================================================

/**
 * Calculate Chebyshev distance between two positions (tile-based)
 * In OSRS, adjacency is measured using Chebyshev distance (allows diagonals)
 */
export function chebyshevDistance(
  pos1: { x: number; z: number },
  pos2: { x: number; z: number },
): number {
  return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.z - pos2.z));
}

/**
 * Check if two players are within trade range
 * Returns true if players are adjacent (within TRADE_PROXIMITY_TILES)
 */
export function arePlayersInTradeRange(
  world: World,
  playerId1: string,
  playerId2: string,
): boolean {
  const player1 = world.entities?.players?.get(playerId1);
  const player2 = world.entities?.players?.get(playerId2);

  if (!player1 || !player2) return false;

  const pos1 = getEntityPosition(player1);
  const pos2 = getEntityPosition(player2);

  if (!pos1 || !pos2) return false;

  const distance = chebyshevDistance(pos1, pos2);
  return distance <= TRADE_PROXIMITY_TILES;
}

// ============================================================================
// SOCKET UTILITIES
// ============================================================================

/**
 * Get socket by player ID from ServerNetwork's socket map
 */
export function getSocketByPlayerId(
  world: World,
  playerId: string,
): ServerSocket | undefined {
  const serverNetwork = world.getSystem("network") as
    | {
        broadcastManager?: {
          getPlayerSocket: (id: string) => ServerSocket | undefined;
        };
        sockets?: Map<string, ServerSocket>;
      }
    | undefined;

  if (!serverNetwork) return undefined;

  if (serverNetwork.broadcastManager?.getPlayerSocket) {
    return serverNetwork.broadcastManager.getPlayerSocket(playerId);
  }

  if (serverNetwork.sockets) {
    for (const [, socket] of serverNetwork.sockets) {
      if (getPlayerId(socket) === playerId) {
        return socket;
      }
    }
  }

  return undefined;
}

// ============================================================================
// TRADE STATE COMMUNICATION
// ============================================================================

/**
 * Send trade error to socket
 */
export function sendTradeError(
  socket: ServerSocket,
  message: string,
  code: string,
): void {
  sendToSocket(socket, "tradeError", { message, code });
}

/**
 * Calculate total value of trade offer items
 * Used for wealth transfer indicator
 */
export function calculateOfferValue(items: TradeOfferView["items"]): number {
  let total = 0;
  for (const offer of items) {
    const itemDef = getItem(offer.itemId);
    if (itemDef) {
      const value = itemDef.value ?? 1;
      total += value * offer.quantity;
    }
  }
  return total;
}

/**
 * Calculate the number of free inventory slots for a player
 * Takes into account items currently being offered in trade (which will be freed)
 */
export function calculateFreeSlots(
  world: World,
  playerId: string,
  offeredItems: TradeOfferItem[],
): number {
  const inventorySystem = world.getSystem("inventory") as
    | {
        getInventoryData?: (playerId: string) =>
          | {
              items: Array<{ slotIndex: number } | null>;
              coins: number;
              maxSlots: number;
            }
          | undefined;
      }
    | undefined;

  if (!inventorySystem?.getInventoryData) {
    return 28; // OSRS inventory size
  }

  const inventoryData = inventorySystem.getInventoryData(playerId);
  if (!inventoryData) {
    return 28;
  }

  const maxSlots = inventoryData.maxSlots || 28;

  const usedSlots = new Set<number>();
  for (const item of inventoryData.items) {
    if (item !== null && typeof item.slotIndex === "number") {
      usedSlots.add(item.slotIndex);
    }
  }

  const offeredSlots = new Set<number>();
  for (const offer of offeredItems) {
    offeredSlots.add(offer.inventorySlot);
  }

  let freeCount = 0;
  for (let i = 0; i < maxSlots; i++) {
    if (!usedSlots.has(i) || offeredSlots.has(i)) {
      freeCount++;
    }
  }

  return freeCount;
}

/**
 * Send trade state update to both participants
 */
export function sendTradeUpdate(
  world: World,
  tradingSystem: TradingSystem,
  tradeId: string,
): void {
  const session = tradingSystem.getTradeSession(tradeId);
  if (
    !session ||
    (session.status !== "active" && session.status !== "confirming")
  )
    return;

  const initiatorOffer: TradeOfferView = {
    items: session.initiator.offeredItems,
    accepted: session.initiator.accepted,
  };
  const recipientOffer: TradeOfferView = {
    items: session.recipient.offeredItems,
    accepted: session.recipient.accepted,
  };

  const initiatorFreeSlots = calculateFreeSlots(
    world,
    session.initiator.playerId,
    session.initiator.offeredItems,
  );
  const recipientFreeSlots = calculateFreeSlots(
    world,
    session.recipient.playerId,
    session.recipient.offeredItems,
  );

  const initiatorSocket = getSocketByPlayerId(
    world,
    session.initiator.playerId,
  );
  if (initiatorSocket) {
    sendToSocket(initiatorSocket, "tradeUpdated", {
      tradeId,
      myOffer: initiatorOffer,
      theirOffer: recipientOffer,
      partnerFreeSlots: recipientFreeSlots,
    });
  }

  const recipientSocket = getSocketByPlayerId(
    world,
    session.recipient.playerId,
  );
  if (recipientSocket) {
    sendToSocket(recipientSocket, "tradeUpdated", {
      tradeId,
      myOffer: recipientOffer,
      theirOffer: initiatorOffer,
      partnerFreeSlots: initiatorFreeSlots,
    });
  }
}

/**
 * Send confirmation screen packet to both participants (OSRS two-screen flow)
 * Includes item values for wealth transfer indicator
 */
export function sendTradeConfirmScreen(
  world: World,
  tradingSystem: TradingSystem,
  tradeId: string,
): void {
  const session = tradingSystem.getTradeSession(tradeId);
  if (!session || session.status !== "confirming") return;

  const initiatorValue = calculateOfferValue(session.initiator.offeredItems);
  const recipientValue = calculateOfferValue(session.recipient.offeredItems);

  const initiatorSocket = getSocketByPlayerId(
    world,
    session.initiator.playerId,
  );
  if (initiatorSocket) {
    sendToSocket(initiatorSocket, "tradeConfirmScreen", {
      tradeId,
      myOffer: session.initiator.offeredItems,
      theirOffer: session.recipient.offeredItems,
      myOfferValue: initiatorValue,
      theirOfferValue: recipientValue,
    });
  }

  const recipientSocket = getSocketByPlayerId(
    world,
    session.recipient.playerId,
  );
  if (recipientSocket) {
    sendToSocket(recipientSocket, "tradeConfirmScreen", {
      tradeId,
      myOffer: session.recipient.offeredItems,
      theirOffer: session.initiator.offeredItems,
      myOfferValue: recipientValue,
      theirOfferValue: initiatorValue,
    });
  }
}

// Re-export common utilities for convenience
export { sendToSocket, getPlayerId } from "../common";
