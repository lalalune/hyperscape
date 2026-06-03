/**
 * Trade Item Handlers
 *
 * Handles trade item operations:
 * - handleTradeAddItem: Add item from inventory to trade offer
 * - handleTradeRemoveItem: Remove item from trade offer
 * - handleTradeSetQuantity: Change quantity of item in trade
 */

import { type World, getItem, isValidSlotNumber } from "@hyperforge/shared";
import type { ServerSocket } from "../../../../shared/types";
import { InventoryRepository } from "../../../../database/repositories/InventoryRepository";
import type { DatabaseConnection } from "./types";
import {
  rateLimiter,
  getTradingSystem,
  sendTradeError,
  sendTradeUpdate,
  getPlayerId,
} from "./helpers";

// ============================================================================
// Add Item Handler
// ============================================================================

/**
 * Handle adding item to trade offer
 */
export async function handleTradeAddItem(
  socket: ServerSocket,
  data: { tradeId: string; inventorySlot: number; quantity?: number },
  world: World,
  db: DatabaseConnection,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    sendTradeError(socket, "Not authenticated", "NOT_AUTHENTICATED");
    return;
  }

  const tradingSystem = getTradingSystem(world);
  if (!tradingSystem) {
    sendTradeError(socket, "Trading system unavailable", "SYSTEM_ERROR");
    return;
  }

  // Rate limit
  if (!rateLimiter.tryOperation(playerId)) {
    sendTradeError(socket, "Too fast", "RATE_LIMITED");
    return;
  }

  // Validate trade session
  const session = tradingSystem.getTradeSession(data.tradeId);
  if (!session || session.status !== "active") {
    sendTradeError(socket, "Not in an active trade", "NOT_IN_TRADE");
    return;
  }

  // Validate slot
  const slot = data.inventorySlot;
  if (!isValidSlotNumber(slot) || slot < 0 || slot > 27) {
    sendTradeError(socket, "Invalid inventory slot", "INVALID_SLOT");
    return;
  }

  // Get item from database inventory
  const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);
  const inventoryItems = await inventoryRepo.getPlayerInventoryAsync(playerId);
  const inventoryItem = inventoryItems.find((item) => item.slotIndex === slot);

  if (!inventoryItem) {
    sendTradeError(socket, "No item in that slot", "INVALID_ITEM");
    return;
  }

  // Validate item exists in item database
  const itemData = getItem(inventoryItem.itemId);
  if (!itemData) {
    sendTradeError(socket, "Invalid item", "INVALID_ITEM");
    return;
  }

  // Validate item is tradeable
  if (itemData.tradeable === false) {
    sendTradeError(socket, "That item cannot be traded", "UNTRADEABLE_ITEM");
    return;
  }

  // Check if item is staked in a duel (can't trade staked items)
  const duelSystem = world.getSystem("duel") as
    | { getStakedSlots?: (id: string) => Set<number> }
    | undefined;
  const stakedSlots = duelSystem?.getStakedSlots?.(playerId);
  if (stakedSlots?.has(slot)) {
    sendTradeError(socket, "That item is staked in a duel", "ITEM_STAKED");
    return;
  }

  // Determine quantity (for stackable items, use provided quantity or all)
  let quantity = data.quantity ?? inventoryItem.quantity;
  if (quantity <= 0 || quantity > inventoryItem.quantity) {
    quantity = inventoryItem.quantity;
  }

  // Check if item is already offered from this slot
  const participant =
    session.initiator.playerId === playerId
      ? session.initiator
      : session.recipient;

  const existingOffer = participant.offeredItems.find(
    (item) => item.inventorySlot === slot,
  );
  if (existingOffer) {
    // Already offered - update quantity if different
    if (existingOffer.quantity === quantity) {
      return; // No change needed
    }
  }

  // Add/update in trading system
  const result = tradingSystem.addItemToTrade(
    data.tradeId,
    playerId,
    slot,
    inventoryItem.itemId,
    quantity,
  );

  if (!result.success) {
    sendTradeError(socket, result.error!, result.errorCode || "UNKNOWN");
    return;
  }

  // Send updated trade state to both players
  sendTradeUpdate(world, tradingSystem, data.tradeId);
}

// ============================================================================
// Remove Item Handler
// ============================================================================

/**
 * Handle removing item from trade offer
 */
export function handleTradeRemoveItem(
  socket: ServerSocket,
  data: { tradeId: string; tradeSlot: number },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    sendTradeError(socket, "Not authenticated", "NOT_AUTHENTICATED");
    return;
  }

  const tradingSystem = getTradingSystem(world);
  if (!tradingSystem) {
    sendTradeError(socket, "Trading system unavailable", "SYSTEM_ERROR");
    return;
  }

  // Rate limit
  if (!rateLimiter.tryOperation(playerId)) {
    sendTradeError(socket, "Too fast", "RATE_LIMITED");
    return;
  }

  const result = tradingSystem.removeItemFromTrade(
    data.tradeId,
    playerId,
    data.tradeSlot,
  );

  if (!result.success) {
    sendTradeError(socket, result.error!, result.errorCode || "UNKNOWN");
    return;
  }

  // Send updated trade state
  sendTradeUpdate(world, tradingSystem, data.tradeId);
}

// ============================================================================
// Set Quantity Handler
// ============================================================================

/**
 * Handle setting quantity for stackable item
 */
export async function handleTradeSetQuantity(
  socket: ServerSocket,
  data: { tradeId: string; tradeSlot: number; quantity: number },
  world: World,
  db: DatabaseConnection,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    sendTradeError(socket, "Not authenticated", "NOT_AUTHENTICATED");
    return;
  }

  const tradingSystem = getTradingSystem(world);
  if (!tradingSystem) {
    sendTradeError(socket, "Trading system unavailable", "SYSTEM_ERROR");
    return;
  }

  const session = tradingSystem.getTradeSession(data.tradeId);
  if (!session || session.status !== "active") {
    sendTradeError(socket, "Not in an active trade", "NOT_IN_TRADE");
    return;
  }

  // Find the offered item
  const participant =
    session.initiator.playerId === playerId
      ? session.initiator
      : session.recipient;

  const offeredItem = participant.offeredItems.find(
    (item) => item.tradeSlot === data.tradeSlot,
  );
  if (!offeredItem) {
    sendTradeError(socket, "Item not found in trade", "INVALID_SLOT");
    return;
  }

  // Validate quantity against actual inventory
  const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);
  const inventoryItems = await inventoryRepo.getPlayerInventoryAsync(playerId);
  const inventoryItem = inventoryItems.find(
    (item) => item.slotIndex === offeredItem.inventorySlot,
  );

  if (!inventoryItem || inventoryItem.quantity < data.quantity) {
    sendTradeError(socket, "Not enough items", "INVALID_QUANTITY");
    return;
  }

  // Update in trading system (reuse addItemToTrade which handles updates)
  const result = tradingSystem.addItemToTrade(
    data.tradeId,
    playerId,
    offeredItem.inventorySlot,
    offeredItem.itemId,
    data.quantity,
  );

  if (!result.success) {
    sendTradeError(socket, result.error!, result.errorCode || "UNKNOWN");
    return;
  }

  sendTradeUpdate(world, tradingSystem, data.tradeId);
}
