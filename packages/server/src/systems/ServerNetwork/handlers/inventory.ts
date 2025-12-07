/**
 * Inventory Handler
 *
 * Handles item pickup and drop actions from clients.
 * All inputs are validated before processing.
 * Includes rate limiting to prevent spam attacks.
 */

import type { ServerSocket } from "../../../shared/types";
import {
  EventType,
  World,
  COMBAT_CONSTANTS,
  INPUT_LIMITS,
} from "@hyperscape/shared";
import { isValidItemId } from "../services/InputValidation";

// Regex to detect control characters (security)
const CONTROL_CHAR_REGEX = /[\x00-\x1f]/;

// Rate limiting for pickup requests
const MAX_PICKUPS_PER_SECOND = 5;
const pickupRateLimiter = new Map<
  string,
  { count: number; resetTime: number }
>();

/**
 * Check and update rate limit for a player
 * @returns true if request is allowed, false if rate limited
 */
function checkPickupRateLimit(playerId: string): boolean {
  const now = Date.now();
  const playerLimit = pickupRateLimiter.get(playerId);

  if (playerLimit) {
    if (now < playerLimit.resetTime) {
      if (playerLimit.count >= MAX_PICKUPS_PER_SECOND) {
        // Rate limited - reject request
        return false;
      }
      playerLimit.count++;
    } else {
      // Reset window
      playerLimit.count = 1;
      playerLimit.resetTime = now + 1000;
    }
  } else {
    pickupRateLimiter.set(playerId, { count: 1, resetTime: now + 1000 });
  }

  return true;
}

// Clean up stale rate limit entries periodically (every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [playerId, limit] of pickupRateLimiter.entries()) {
    if (now > limit.resetTime + 60000) {
      // Entry is more than 60 seconds stale
      pickupRateLimiter.delete(playerId);
    }
  }
}, 60000);

/**
 * Validate entity ID for ground items
 * Similar to itemId validation but for world entity IDs
 */
function isValidEntityId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 && // Entity IDs can be longer (e.g., "ground_item_mob_123")
    !CONTROL_CHAR_REGEX.test(value)
  );
}

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

  // Rate limit check - prevent spam attacks
  if (!checkPickupRateLimit(playerEntity.id)) {
    // Rate limited - silently ignore (don't log to prevent log spam)
    return;
  }

  // Validate payload structure
  if (!data || typeof data !== "object") {
    console.warn("[Inventory] handlePickupItem: invalid payload");
    return;
  }

  const payload = data as Record<string, unknown>;

  // The client sends the entity ID as 'itemId' in the payload
  const entityId = payload.itemId;

  // Validate entityId
  if (!isValidEntityId(entityId)) {
    console.warn("[Inventory] handlePickupItem: invalid entityId");
    return;
  }

  // Server-side distance validation
  const itemEntity = world.entities.get(entityId);
  if (itemEntity) {
    const distance = Math.sqrt(
      Math.pow(playerEntity.position.x - itemEntity.position.x, 2) +
        Math.pow(playerEntity.position.z - itemEntity.position.z, 2),
    );

    // Use constant for pickup range (slightly larger than client to account for movement)
    const pickupRange = COMBAT_CONSTANTS.PICKUP_RANGE ?? 2.5;
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

  // Validate payload structure
  if (!data || typeof data !== "object") {
    console.warn("[Inventory] handleDropItem: invalid payload");
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate itemId
  if (!isValidItemId(payload.itemId)) {
    console.warn("[Inventory] handleDropItem: invalid itemId");
    return;
  }

  // Validate and clamp quantity
  let quantity = 1;
  if (payload.quantity !== undefined) {
    if (
      typeof payload.quantity !== "number" ||
      !Number.isInteger(payload.quantity)
    ) {
      console.warn("[Inventory] handleDropItem: invalid quantity type");
      return;
    }
    quantity = Math.max(
      1,
      Math.min(payload.quantity, INPUT_LIMITS.MAX_QUANTITY),
    );
  }

  // Validate slot if provided
  const slot =
    typeof payload.slot === "number" &&
    Number.isInteger(payload.slot) &&
    payload.slot >= 0
      ? payload.slot
      : undefined;

  world.emit(EventType.ITEM_DROP, {
    playerId: playerEntity.id,
    itemId: payload.itemId,
    quantity,
    slot,
  });
}

export function handleEquipItem(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Inventory] handleEquipItem: no player entity for socket");
    return;
  }

  // Validate payload structure
  if (!data || typeof data !== "object") {
    console.warn("[Inventory] handleEquipItem: invalid payload");
    return;
  }

  const payload = data as Record<string, unknown>;

  // itemId can be string or number (some systems use numeric IDs)
  const itemId = payload.itemId;
  if (
    (typeof itemId !== "string" && typeof itemId !== "number") ||
    (typeof itemId === "string" && !isValidItemId(itemId))
  ) {
    console.warn("[Inventory] handleEquipItem: invalid itemId");
    return;
  }

  // Validate inventorySlot if provided
  const inventorySlot =
    typeof payload.inventorySlot === "number" &&
    Number.isInteger(payload.inventorySlot) &&
    payload.inventorySlot >= 0
      ? payload.inventorySlot
      : undefined;

  // Emit event for EquipmentSystem to handle
  world.emit(EventType.INVENTORY_ITEM_RIGHT_CLICK, {
    playerId: playerEntity.id,
    itemId,
    slot: inventorySlot,
  });
}

// Valid equipment slot names
const VALID_EQUIPMENT_SLOTS = new Set([
  "weapon",
  "shield",
  "head",
  "body",
  "legs",
  "feet",
  "hands",
  "cape",
  "neck",
  "ring",
  "ammo",
]);

export function handleUnequipItem(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Inventory] handleUnequipItem: no player entity for socket");
    return;
  }

  // Validate payload structure
  if (!data || typeof data !== "object") {
    console.warn("[Inventory] handleUnequipItem: invalid payload");
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate slot - must be a valid equipment slot name
  const slot = payload.slot;
  if (typeof slot !== "string" || !VALID_EQUIPMENT_SLOTS.has(slot)) {
    console.warn("[Inventory] handleUnequipItem: invalid slot");
    return;
  }

  // Emit event for EquipmentSystem to handle
  world.emit(EventType.EQUIPMENT_UNEQUIP, {
    playerId: playerEntity.id,
    slot,
  });
}
