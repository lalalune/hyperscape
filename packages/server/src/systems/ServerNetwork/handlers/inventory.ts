/**
 * Inventory Handler
 *
 * Handles inventory operations from clients:
 * - Item pickup from ground
 * - Item drop to ground
 * - Item equip/unequip
 * - Inventory slot swapping (OSRS-style)
 *
 * All inputs are validated before processing.
 * Includes rate limiting to prevent spam attacks.
 *
 * Security measures:
 * - Input validation (type, range, format)
 * - Rate limiting per operation type
 * - Server-side distance validation
 * - Control character filtering
 * - Audit logging for sensitive operations
 */

import type { ServerSocket } from "../../../shared/types";
import {
  EventType,
  World,
  COMBAT_CONSTANTS,
  INPUT_LIMITS,
} from "@hyperscape/shared";
import {
  isValidItemId,
  isValidInventorySlot,
  isValidEntityId,
  validateRequestTimestamp,
} from "../services/InputValidation";
import {
  getPickupRateLimiter,
  getMoveRateLimiter,
  getDropRateLimiter,
  getEquipRateLimiter,
} from "../services/SlidingWindowRateLimiter";
import { getIdempotencyService } from "../services/IdempotencyService";

/**
 * Valid equipment slot names for unequip operations
 * Matches OSRS equipment slots
 */
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

/**
 * Send error feedback to client
 * Used when operations fail due to validation or rate limiting
 *
 * @param socket - Client socket
 * @param operation - Operation that failed
 * @param reason - Human-readable reason
 */
function sendInventoryError(
  socket: ServerSocket,
  _operation: string,
  reason: string,
): void {
  if (socket.send) {
    socket.send("showToast", {
      message: reason,
      type: "error",
    });
  }
}

/**
 * Log inventory operation for security audit
 *
 * @param operation - Operation name
 * @param playerId - Player who performed operation
 * @param details - Operation-specific details
 * @param success - Whether operation succeeded
 */
function auditLog(
  operation: string,
  playerId: string,
  details: Record<string, unknown>,
  success: boolean,
): void {
  // In production, this would write to a secure audit log
  // For now, log to console in a structured format
  if (process.env.AUDIT_LOG === "1") {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "INVENTORY_AUDIT",
        operation,
        playerId,
        success,
        ...details,
      }),
    );
  }
}

/**
 * Handle item pickup from ground
 *
 * Security:
 * - Rate limited to 5/sec
 * - Timestamp validation (prevents replay attacks)
 * - Distance validation (must be within pickup range)
 * - Entity ID validation
 *
 * @param socket - Client socket with player entity
 * @param data - Pickup request data
 * @param world - Game world instance
 */
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
  if (!getPickupRateLimiter().check(playerEntity.id)) {
    // Silently ignore rate limited requests (don't log to prevent log spam)
    return;
  }

  // Validate payload structure
  if (!data || typeof data !== "object") {
    console.warn("[Inventory] handlePickupItem: invalid payload");
    return;
  }

  const payload = data as Record<string, unknown>;

  // Idempotency check - prevent duplicate pickup requests
  const idempotencyKey = getIdempotencyService().generateKey(
    playerEntity.id,
    "pickup",
    { entityId: payload.itemId },
  );
  if (!getIdempotencyService().checkAndMark(idempotencyKey)) {
    // Duplicate request within 5 second window - silently ignore
    return;
  }

  // Timestamp validation - prevents replay attacks
  // Client should send { itemId, timestamp: Date.now() }
  const timestampResult = validateRequestTimestamp(payload.timestamp);
  if (!timestampResult.valid) {
    console.warn(
      `[Inventory] handlePickupItem: ${timestampResult.reason} for player ${playerEntity.id}`,
    );
    auditLog(
      "PICKUP_REPLAY_ATTEMPT",
      playerEntity.id,
      { timestamp: payload.timestamp, reason: timestampResult.reason },
      false,
    );
    return;
  }

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
      auditLog(
        "PICKUP_DISTANCE_VIOLATION",
        playerEntity.id,
        { entityId, distance, maxRange: pickupRange },
        false,
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

  auditLog("PICKUP", playerEntity.id, { entityId }, true);
}

/**
 * Handle item drop to ground
 *
 * Security:
 * - Rate limited to 5/sec
 * - Item ID validation
 * - Quantity validation and clamping
 *
 * @param socket - Client socket with player entity
 * @param data - Drop request data
 * @param world - Game world instance
 */
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

  // Rate limit check
  if (!getDropRateLimiter().check(playerEntity.id)) {
    return;
  }

  // Validate payload structure
  if (!data || typeof data !== "object") {
    console.warn("[Inventory] handleDropItem: invalid payload");
    return;
  }

  const payload = data as Record<string, unknown>;

  // Idempotency check - prevent duplicate drop requests
  const idempotencyKey = getIdempotencyService().generateKey(
    playerEntity.id,
    "drop",
    { itemId: payload.itemId, slot: payload.slot },
  );
  if (!getIdempotencyService().checkAndMark(idempotencyKey)) {
    // Duplicate request within 5 second window - silently ignore
    return;
  }

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
    payload.slot >= 0 &&
    payload.slot < INPUT_LIMITS.MAX_INVENTORY_SLOTS
      ? payload.slot
      : undefined;

  world.emit(EventType.ITEM_DROP, {
    playerId: playerEntity.id,
    itemId: payload.itemId,
    quantity,
    slot,
  });

  auditLog(
    "DROP",
    playerEntity.id,
    { itemId: payload.itemId, quantity, slot },
    true,
  );
}

/**
 * Handle item equip request
 *
 * Security:
 * - Rate limited to 5/sec
 * - Item ID validation
 * - Inventory slot validation
 *
 * @param socket - Client socket with player entity
 * @param data - Equip request data
 * @param world - Game world instance
 */
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

  // Rate limit check
  if (!getEquipRateLimiter().check(playerEntity.id)) {
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
  const inventorySlot = isValidInventorySlot(payload.inventorySlot)
    ? payload.inventorySlot
    : undefined;

  // Emit event for EquipmentSystem to handle
  world.emit(EventType.INVENTORY_ITEM_RIGHT_CLICK, {
    playerId: playerEntity.id,
    itemId,
    slot: inventorySlot,
  });

  auditLog("EQUIP", playerEntity.id, { itemId, inventorySlot }, true);
}

/**
 * Handle item unequip request
 *
 * Security:
 * - Rate limited to 5/sec (shared with equip)
 * - Equipment slot validation (must be valid slot name)
 *
 * @param socket - Client socket with player entity
 * @param data - Unequip request data
 * @param world - Game world instance
 */
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

  // Rate limit check (shared with equip)
  if (!getEquipRateLimiter().check(playerEntity.id)) {
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

  auditLog("UNEQUIP", playerEntity.id, { slot }, true);
}

/**
 * Handle inventory slot move/swap request (OSRS-style)
 *
 * Implements OSRS-style SWAP behavior:
 * - Dragging item A to slot B swaps them
 * - Does NOT shift/insert like typical drag-drop
 *
 * Security:
 * - Rate limited to 10/sec
 * - Slot index validation (0-27)
 * - Same-slot rejection (no-op)
 *
 * @param socket - Client socket with player entity
 * @param data - Move request data { fromSlot, toSlot }
 * @param world - Game world instance
 */
export function handleMoveItem(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Inventory] handleMoveItem: no player entity for socket");
    return;
  }

  // Rate limit check
  if (!getMoveRateLimiter().check(playerEntity.id)) {
    // Send feedback to client so they know why action didn't work
    sendInventoryError(socket, "move", "Too many actions, please slow down.");
    return;
  }

  // Validate payload structure
  if (!data || typeof data !== "object") {
    console.warn("[Inventory] handleMoveItem: invalid payload");
    sendInventoryError(socket, "move", "Invalid request.");
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate fromSlot
  if (!isValidInventorySlot(payload.fromSlot)) {
    console.warn("[Inventory] handleMoveItem: invalid fromSlot");
    sendInventoryError(socket, "move", "Invalid slot.");
    return;
  }

  // Validate toSlot
  if (!isValidInventorySlot(payload.toSlot)) {
    console.warn("[Inventory] handleMoveItem: invalid toSlot");
    sendInventoryError(socket, "move", "Invalid slot.");
    return;
  }

  // Can't move to same slot (no-op)
  if (payload.fromSlot === payload.toSlot) {
    return;
  }

  // Emit event for InventorySystem to handle
  world.emit(EventType.INVENTORY_MOVE, {
    playerId: playerEntity.id,
    fromSlot: payload.fromSlot,
    toSlot: payload.toSlot,
  });

  auditLog(
    "MOVE",
    playerEntity.id,
    { fromSlot: payload.fromSlot, toSlot: payload.toSlot },
    true,
  );
}
