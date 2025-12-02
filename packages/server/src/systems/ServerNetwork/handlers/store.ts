/**
 * Store Packet Handlers
 *
 * Handles all store-related network packets:
 * - storeBuy: Player buys item from store
 * - storeSell: Player sells item to store
 * - storeClose: Player closes store interface
 */

import { type World, EventType } from "@hyperscape/shared";
import type { ServerSocket } from "../../../shared/types";

/**
 * Get player ID from socket
 */
function getPlayerId(socket: ServerSocket): string | null {
  return socket.player?.id || null;
}

/**
 * Handle store open request (from Trade button)
 *
 * Emits STORE_OPEN_REQUEST which is handled by EventBridge
 * to look up the store and send storeState packet.
 */
export function handleStoreOpen(
  socket: ServerSocket,
  data: { npcId: string; storeId?: string; npcEntityId?: string },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeOpen");
    return;
  }

  console.log(
    `[StoreHandler] Opening store for ${playerId}, npcId: ${data.npcId}, storeId: ${data.storeId || "auto-lookup"}`,
  );

  // Emit STORE_OPEN_REQUEST - EventBridge handles store lookup and state sending
  world.emit(EventType.STORE_OPEN_REQUEST, {
    playerId,
    npcId: data.npcId,
    storeId: data.storeId,
    npcEntityId: data.npcEntityId,
  });
}

/**
 * Handle store buy request
 */
export async function handleStoreBuy(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeBuy");
    return;
  }

  world.emit(EventType.STORE_BUY, {
    playerId,
    storeId: data.storeId,
    itemId: data.itemId,
    quantity: data.quantity,
  });
}

/**
 * Handle store sell request
 */
export async function handleStoreSell(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeSell");
    return;
  }

  world.emit(EventType.STORE_SELL, {
    playerId,
    storeId: data.storeId,
    itemId: data.itemId,
    quantity: data.quantity,
  });
}

/**
 * Handle store close request
 */
export function handleStoreClose(
  socket: ServerSocket,
  data: { storeId: string },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeClose");
    return;
  }

  world.emit(EventType.STORE_CLOSE, {
    playerId,
    storeId: data.storeId,
  });
}
