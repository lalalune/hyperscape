/**
 * Test Validation Utilities
 *
 * Expect/throw pattern validators for test inputs.
 * These ensure test data matches production constraints,
 * catching test setup errors early with clear messages.
 */

import { INPUT_LIMITS } from "../constants";

/**
 * Position in 3D world space
 */
export interface TestPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Validate a position is within reasonable world bounds
 * @throws Error if position is invalid
 */
export function expectValidPosition(
  pos: TestPosition,
  context: string = "position",
): asserts pos is TestPosition {
  if (typeof pos.x !== "number" || !Number.isFinite(pos.x)) {
    throw new Error(`${context}.x must be a finite number, got: ${pos.x}`);
  }
  if (typeof pos.y !== "number" || !Number.isFinite(pos.y)) {
    throw new Error(`${context}.y must be a finite number, got: ${pos.y}`);
  }
  if (typeof pos.z !== "number" || !Number.isFinite(pos.z)) {
    throw new Error(`${context}.z must be a finite number, got: ${pos.z}`);
  }

  // World bounds check
  const MAX_WORLD_COORD = 10000;
  if (Math.abs(pos.x) > MAX_WORLD_COORD) {
    throw new Error(
      `${context}.x exceeds world bounds: ${pos.x} (max: ±${MAX_WORLD_COORD})`,
    );
  }
  if (Math.abs(pos.z) > MAX_WORLD_COORD) {
    throw new Error(
      `${context}.z exceeds world bounds: ${pos.z} (max: ±${MAX_WORLD_COORD})`,
    );
  }
}

/**
 * Validate inventory slot index
 * @throws Error if slot is invalid
 */
export function expectValidSlot(
  slot: number,
  context: string = "slot",
): asserts slot is number {
  if (!Number.isInteger(slot)) {
    throw new Error(`${context} must be an integer, got: ${slot}`);
  }
  if (slot < 0 || slot >= INPUT_LIMITS.MAX_INVENTORY_SLOTS) {
    throw new Error(
      `${context} out of bounds: ${slot} (valid: 0-${INPUT_LIMITS.MAX_INVENTORY_SLOTS - 1})`,
    );
  }
}

/**
 * Validate item quantity
 * @throws Error if quantity is invalid
 */
export function expectValidQuantity(
  quantity: number,
  context: string = "quantity",
): asserts quantity is number {
  if (!Number.isInteger(quantity)) {
    throw new Error(`${context} must be an integer, got: ${quantity}`);
  }
  if (quantity < 1) {
    throw new Error(`${context} must be positive, got: ${quantity}`);
  }
  if (quantity > INPUT_LIMITS.MAX_QUANTITY) {
    throw new Error(
      `${context} exceeds maximum: ${quantity} (max: ${INPUT_LIMITS.MAX_QUANTITY})`,
    );
  }
}

/**
 * Validate player ID format
 * @throws Error if player ID is invalid
 */
export function expectValidPlayerId(
  playerId: string,
  context: string = "playerId",
): asserts playerId is string {
  if (typeof playerId !== "string") {
    throw new Error(`${context} must be a string, got: ${typeof playerId}`);
  }
  if (playerId.length === 0) {
    throw new Error(`${context} cannot be empty`);
  }
  if (playerId.length > INPUT_LIMITS.MAX_ITEM_ID_LENGTH) {
    throw new Error(
      `${context} exceeds maximum length: ${playerId.length} (max: ${INPUT_LIMITS.MAX_ITEM_ID_LENGTH})`,
    );
  }
  // Check for control characters (security)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(playerId)) {
    throw new Error(`${context} contains control characters: "${playerId}"`);
  }
}

/**
 * Validate item ID format
 * @throws Error if item ID is invalid
 */
export function expectValidItemId(
  itemId: string,
  context: string = "itemId",
): asserts itemId is string {
  if (typeof itemId !== "string") {
    throw new Error(`${context} must be a string, got: ${typeof itemId}`);
  }
  if (itemId.length === 0) {
    throw new Error(`${context} cannot be empty`);
  }
  if (itemId.length > INPUT_LIMITS.MAX_ITEM_ID_LENGTH) {
    throw new Error(
      `${context} exceeds maximum length: ${itemId.length} (max: ${INPUT_LIMITS.MAX_ITEM_ID_LENGTH})`,
    );
  }
  // Check for control characters (security)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(itemId)) {
    throw new Error(`${context} contains control characters: "${itemId}"`);
  }
}

/**
 * Validate attack type
 * @throws Error if attack type is invalid
 */
export type ValidAttackType = "melee" | "ranged" | "magic";

export function expectValidAttackType(
  attackType: string,
  context: string = "attackType",
): asserts attackType is ValidAttackType {
  const validTypes: ValidAttackType[] = ["melee", "ranged", "magic"];
  if (!validTypes.includes(attackType as ValidAttackType)) {
    throw new Error(
      `${context} must be one of [${validTypes.join(", ")}], got: "${attackType}"`,
    );
  }
}

/**
 * Validate equipment slot name
 * @throws Error if slot name is invalid
 */
export type ValidEquipmentSlot =
  | "weapon"
  | "shield"
  | "head"
  | "body"
  | "legs"
  | "feet"
  | "hands"
  | "cape"
  | "neck"
  | "ring"
  | "ammo";

export function expectValidEquipmentSlot(
  slot: string,
  context: string = "equipmentSlot",
): asserts slot is ValidEquipmentSlot {
  const validSlots: ValidEquipmentSlot[] = [
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
  ];
  if (!validSlots.includes(slot as ValidEquipmentSlot)) {
    throw new Error(
      `${context} must be one of [${validSlots.join(", ")}], got: "${slot}"`,
    );
  }
}

/**
 * Validate distance value (must be non-negative)
 * @throws Error if distance is invalid
 */
export function expectValidDistance(
  distance: number,
  context: string = "distance",
): asserts distance is number {
  if (typeof distance !== "number" || !Number.isFinite(distance)) {
    throw new Error(`${context} must be a finite number, got: ${distance}`);
  }
  if (distance < 0) {
    throw new Error(`${context} cannot be negative, got: ${distance}`);
  }
}

/**
 * Validate health value
 * @throws Error if health is invalid
 */
export function expectValidHealth(
  health: number,
  maxHealth: number,
  context: string = "health",
): void {
  if (!Number.isInteger(health)) {
    throw new Error(`${context} must be an integer, got: ${health}`);
  }
  if (health < 0) {
    throw new Error(`${context} cannot be negative, got: ${health}`);
  }
  if (health > maxHealth) {
    throw new Error(`${context} exceeds maxHealth: ${health} > ${maxHealth}`);
  }
}

/**
 * Validate damage value
 * @throws Error if damage is invalid
 */
export function expectValidDamage(
  damage: number,
  context: string = "damage",
): asserts damage is number {
  if (!Number.isInteger(damage)) {
    throw new Error(`${context} must be an integer, got: ${damage}`);
  }
  if (damage < 0) {
    throw new Error(`${context} cannot be negative, got: ${damage}`);
  }
}

/**
 * Validate tick number (game tick counter)
 * @throws Error if tick is invalid
 */
export function expectValidTick(
  tick: number,
  context: string = "tick",
): asserts tick is number {
  if (!Number.isInteger(tick)) {
    throw new Error(`${context} must be an integer, got: ${tick}`);
  }
  if (tick < 0) {
    throw new Error(`${context} cannot be negative, got: ${tick}`);
  }
}
