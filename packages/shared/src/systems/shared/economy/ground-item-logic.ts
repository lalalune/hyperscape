/**
 * Ground Item Pure Logic Module
 *
 * PURE FUNCTIONS for ground item operations.
 * No side effects, no system dependencies, fully unit testable.
 */

import {
  ValidationError,
  assertPlayerId,
  assertEntityId,
  assertItemId,
  assertQuantity,
  assertNonNegativeInteger,
} from "../../../validation";
import { INPUT_LIMITS } from "../../../constants";

// =============================================================================
// TYPES
// =============================================================================

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface GroundItem {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  position: Position3D;
  droppedBy?: string;
  droppedAt: number;
  despawnAt: number;
  isPublic: boolean;
  stackable: boolean;
}

export interface DropResult {
  success: boolean;
  error?: string;
  groundItem?: GroundItem;
}

export interface PickupResult {
  success: boolean;
  error?: string;
  itemId?: string;
  quantity?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const GROUND_ITEM_CONSTANTS = {
  // Default despawn time in ticks (about 3 minutes)
  DEFAULT_DESPAWN_TICKS: 300,

  // Time until item becomes public (60 seconds)
  PUBLIC_DELAY_TICKS: 100,

  // Max distance to pick up item
  PICKUP_RANGE: 2.0,

  // Max ground items per tile
  MAX_ITEMS_PER_TILE: 128,

  // Stacking behavior
  STACK_SAME_ITEMS: true,
} as const;

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a drop item request
 * @throws ValidationError if invalid
 */
export function validateDropRequest(
  playerId: unknown,
  itemId: unknown,
  quantity: unknown,
  position?: unknown
): { playerId: string; itemId: string; quantity: number } {
  assertPlayerId(playerId, "playerId");
  assertItemId(itemId, "itemId");
  assertQuantity(quantity, "quantity");

  if (position) {
    validatePosition(position as Position3D);
  }

  return {
    playerId: playerId as string,
    itemId: itemId as string,
    quantity: quantity as number,
  };
}

/**
 * Validate a pickup request
 * @throws ValidationError if invalid
 */
export function validatePickupRequest(
  playerId: unknown,
  groundItemId: unknown,
  playerPosition?: unknown
): { playerId: string; groundItemId: string } {
  assertPlayerId(playerId, "playerId");
  assertEntityId(groundItemId, "groundItemId");

  return {
    playerId: playerId as string,
    groundItemId: groundItemId as string,
  };
}

/**
 * Validate a position object
 * @throws ValidationError if invalid
 */
export function validatePosition(position: Position3D): void {
  if (typeof position !== "object" || position === null) {
    throw new ValidationError("must be an object", "position", position);
  }

  if (typeof position.x !== "number" || !Number.isFinite(position.x)) {
    throw new ValidationError("x must be a finite number", "position.x", position.x);
  }
  if (typeof position.y !== "number" || !Number.isFinite(position.y)) {
    throw new ValidationError("y must be a finite number", "position.y", position.y);
  }
  if (typeof position.z !== "number" || !Number.isFinite(position.z)) {
    throw new ValidationError("z must be a finite number", "position.z", position.z);
  }

  const MAX_COORD = 10000;
  if (Math.abs(position.x) > MAX_COORD) {
    throw new ValidationError(`x exceeds world bounds ±${MAX_COORD}`, "position.x", position.x);
  }
  if (Math.abs(position.z) > MAX_COORD) {
    throw new ValidationError(`z exceeds world bounds ±${MAX_COORD}`, "position.z", position.z);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate a unique ground item ID
 */
export function generateGroundItemId(
  itemId: string,
  position: Position3D,
  tick: number
): string {
  return `ground_${itemId}_${Math.floor(position.x)}_${Math.floor(position.z)}_${tick}`;
}

/**
 * Calculate distance between two 3D positions
 */
export function calculateDistance(pos1: Position3D, pos2: Position3D): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate 2D distance (ignoring Y)
 */
export function calculateDistance2D(
  pos1: { x: number; z: number },
  pos2: { x: number; z: number }
): number {
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Check if player is within pickup range of ground item
 */
export function isInPickupRange(
  playerPosition: Position3D,
  itemPosition: Position3D,
  range: number = GROUND_ITEM_CONSTANTS.PICKUP_RANGE
): boolean {
  return calculateDistance2D(playerPosition, itemPosition) <= range;
}

// =============================================================================
// PURE LOGIC FUNCTIONS
// =============================================================================

/**
 * Create a ground item from a dropped item
 */
export function createGroundItem(
  itemId: string,
  itemName: string,
  quantity: number,
  position: Position3D,
  droppedBy: string | undefined,
  currentTick: number,
  isStackable: boolean = true,
  despawnTicks: number = GROUND_ITEM_CONSTANTS.DEFAULT_DESPAWN_TICKS
): GroundItem {
  const id = generateGroundItemId(itemId, position, currentTick);

  return {
    id,
    itemId,
    name: itemName,
    quantity,
    position: { ...position },
    droppedBy,
    droppedAt: currentTick,
    despawnAt: currentTick + despawnTicks,
    isPublic: droppedBy === undefined, // Public if no owner
    stackable: isStackable,
  };
}

/**
 * Check if ground item has despawned
 */
export function hasItemDespawned(item: GroundItem, currentTick: number): boolean {
  return currentTick >= item.despawnAt;
}

/**
 * Check if ground item is now public
 */
export function isItemPublic(item: GroundItem, currentTick: number): boolean {
  if (item.isPublic) return true;

  const publicAt = item.droppedAt + GROUND_ITEM_CONSTANTS.PUBLIC_DELAY_TICKS;
  return currentTick >= publicAt;
}

/**
 * Check if player can pick up ground item
 *
 * PURE FUNCTION - does not modify state
 */
export function canPickupItem(
  item: GroundItem,
  playerId: string,
  playerPosition: Position3D,
  currentTick: number
): { canPickup: boolean; reason?: string } {
  // Check if item has despawned
  if (hasItemDespawned(item, currentTick)) {
    return { canPickup: false, reason: "Item has despawned" };
  }

  // Check if player is in range
  if (!isInPickupRange(playerPosition, item.position)) {
    return { canPickup: false, reason: "Too far away" };
  }

  // Check visibility (owner or public)
  if (!isItemPublic(item, currentTick) && item.droppedBy !== playerId) {
    return { canPickup: false, reason: "Item belongs to another player" };
  }

  return { canPickup: true };
}

/**
 * Check if drop is valid
 */
export function canDropItem(
  groundItems: ReadonlyArray<GroundItem>,
  position: Position3D,
  maxItemsPerTile: number = GROUND_ITEM_CONSTANTS.MAX_ITEMS_PER_TILE
): { canDrop: boolean; reason?: string } {
  // Count items at this tile
  const itemsAtTile = countItemsAtTile(groundItems, position);

  if (itemsAtTile >= maxItemsPerTile) {
    return { canDrop: false, reason: "Too many items at this location" };
  }

  return { canDrop: true };
}

/**
 * Count ground items at a tile position
 */
export function countItemsAtTile(
  groundItems: ReadonlyArray<GroundItem>,
  position: Position3D,
  tileSize: number = 1
): number {
  const tileX = Math.floor(position.x / tileSize);
  const tileZ = Math.floor(position.z / tileSize);

  return groundItems.filter((item) => {
    const itemTileX = Math.floor(item.position.x / tileSize);
    const itemTileZ = Math.floor(item.position.z / tileSize);
    return itemTileX === tileX && itemTileZ === tileZ;
  }).length;
}

/**
 * Find ground items at a position
 */
export function getItemsAtPosition(
  groundItems: ReadonlyArray<GroundItem>,
  position: Position3D,
  range: number = 0.5
): GroundItem[] {
  return groundItems.filter((item) =>
    calculateDistance2D(item.position, position) <= range
  );
}

/**
 * Find ground item by ID
 */
export function findGroundItem(
  groundItems: ReadonlyArray<GroundItem>,
  itemId: string
): GroundItem | undefined {
  return groundItems.find((item) => item.id === itemId);
}

/**
 * Find items visible to a player (owned or public)
 */
export function getVisibleItems(
  groundItems: ReadonlyArray<GroundItem>,
  playerId: string,
  currentTick: number
): GroundItem[] {
  return groundItems.filter(
    (item) =>
      !hasItemDespawned(item, currentTick) &&
      (isItemPublic(item, currentTick) || item.droppedBy === playerId)
  );
}

/**
 * Find items within range of a position
 */
export function getItemsInRange(
  groundItems: ReadonlyArray<GroundItem>,
  position: Position3D,
  range: number
): GroundItem[] {
  return groundItems.filter(
    (item) => calculateDistance2D(item.position, position) <= range
  );
}

/**
 * Calculate drop result
 *
 * PURE FUNCTION - returns drop result without modifying state
 */
export function calculateDrop(
  groundItems: ReadonlyArray<GroundItem>,
  itemId: string,
  itemName: string,
  quantity: number,
  position: Position3D,
  droppedBy: string | undefined,
  currentTick: number,
  isStackable: boolean = true
): DropResult {
  // Check if drop is allowed
  const validation = canDropItem(groundItems, position);
  if (!validation.canDrop) {
    return { success: false, error: validation.reason };
  }

  // Create the ground item
  const groundItem = createGroundItem(
    itemId,
    itemName,
    quantity,
    position,
    droppedBy,
    currentTick,
    isStackable
  );

  return { success: true, groundItem };
}

/**
 * Calculate pickup result
 *
 * PURE FUNCTION - returns pickup result without modifying state
 */
export function calculatePickup(
  groundItems: ReadonlyArray<GroundItem>,
  groundItemId: string,
  playerId: string,
  playerPosition: Position3D,
  currentTick: number
): PickupResult {
  const item = findGroundItem(groundItems, groundItemId);

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  const validation = canPickupItem(item, playerId, playerPosition, currentTick);
  if (!validation.canPickup) {
    return { success: false, error: validation.reason };
  }

  return {
    success: true,
    itemId: item.itemId,
    quantity: item.quantity,
  };
}

/**
 * Remove despawned items from list
 *
 * PURE FUNCTION - returns new array without despawned items
 */
export function removeExpiredItems(
  groundItems: ReadonlyArray<GroundItem>,
  currentTick: number
): GroundItem[] {
  return groundItems.filter((item) => !hasItemDespawned(item, currentTick));
}

/**
 * Update public status of items
 *
 * PURE FUNCTION - returns new array with updated public status
 */
export function updateItemVisibility(
  groundItems: ReadonlyArray<GroundItem>,
  currentTick: number
): GroundItem[] {
  return groundItems.map((item) => {
    if (item.isPublic) return item;

    const publicAt = item.droppedAt + GROUND_ITEM_CONSTANTS.PUBLIC_DELAY_TICKS;
    if (currentTick >= publicAt) {
      return { ...item, isPublic: true };
    }

    return item;
  });
}

/**
 * Add ground item to list
 *
 * PURE FUNCTION - returns new array with added item
 */
export function addGroundItem(
  groundItems: ReadonlyArray<GroundItem>,
  item: GroundItem
): GroundItem[] {
  return [...groundItems, item];
}

/**
 * Remove ground item from list by ID
 *
 * PURE FUNCTION - returns new array without the item
 */
export function removeGroundItem(
  groundItems: ReadonlyArray<GroundItem>,
  itemId: string
): GroundItem[] {
  return groundItems.filter((item) => item.id !== itemId);
}

/**
 * Get the closest ground item to a position
 */
export function getClosestItem(
  groundItems: ReadonlyArray<GroundItem>,
  position: Position3D
): GroundItem | undefined {
  if (groundItems.length === 0) return undefined;

  let closest: GroundItem | undefined;
  let closestDistance = Infinity;

  for (const item of groundItems) {
    const dist = calculateDistance2D(position, item.position);
    if (dist < closestDistance) {
      closestDistance = dist;
      closest = item;
    }
  }

  return closest;
}

/**
 * Sort ground items by distance from position
 */
export function sortByDistance(
  groundItems: ReadonlyArray<GroundItem>,
  position: Position3D
): GroundItem[] {
  return [...groundItems].sort((a, b) => {
    const distA = calculateDistance2D(a.position, position);
    const distB = calculateDistance2D(b.position, position);
    return distA - distB;
  });
}

/**
 * Sort ground items by despawn time (soonest first)
 */
export function sortByDespawnTime(
  groundItems: ReadonlyArray<GroundItem>
): GroundItem[] {
  return [...groundItems].sort((a, b) => a.despawnAt - b.despawnAt);
}
