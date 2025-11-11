/**
 * Inventory Handler
 *
 * Handles item pickup and drop actions from clients
 */

import type { ServerSocket } from "../../../shared/types";
import { EventType, World } from "@hyperscape/shared";

export function handlePickupItem(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Inventory] handlePickupItem: no player entity for socket");
    return;
  }

  const payload = data as { itemId?: string; entityId?: string };

  // The client sends the entity ID as 'itemId' in the payload
  // entityId is the world entity ID (required), itemId is the item definition (optional)
  const entityId = payload.itemId; // Client sends entity ID as 'itemId'

  if (!entityId) {
    console.warn("[Inventory] handlePickupItem: no entityId in payload");
    return;
  }

  // Server-side distance validation
  const itemEntity = world.entities.get(entityId);
  if (itemEntity) {
    const distance = Math.sqrt(
      Math.pow(playerEntity.position.x - itemEntity.position.x, 2) +
        Math.pow(playerEntity.position.z - itemEntity.position.z, 2),
    );

    const pickupRange = 2.5; // Slightly larger than client range to account for movement
    if (distance > pickupRange) {
      console.warn(
        `[Inventory] Player ${playerEntity.id} tried to pickup item ${entityId} from too far away (${distance.toFixed(2)}m > ${pickupRange}m)`,
      );
      return;
    }
  }

  // Forward to InventorySystem with entityId (required) and itemId (optional)
  world.emit(EventType.ITEM_PICKUP, {
    playerId: playerEntity.id,
    entityId,
    itemId: undefined, // Will be extracted from entity properties
  });
}

export function handleDropItem(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Inventory] handleDropItem: no player entity for socket");
    return;
  }
  const payload = data as {
    itemId?: string;
    slot?: number;
    quantity?: number;
  };
  if (!payload?.itemId) {
    console.warn("[Inventory] handleDropItem: missing itemId");
    return;
  }
  const quantity = Math.max(1, Number(payload.quantity) || 1);
  // Basic sanity: clamp quantity to 1000 to avoid abuse
  const q = Math.min(quantity, 1000);
  world.emit(EventType.ITEM_DROP, {
    playerId: playerEntity.id,
    itemId: payload.itemId,
    quantity: q,
    slot: payload.slot,
  });
}
