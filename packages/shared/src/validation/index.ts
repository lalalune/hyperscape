/**
 * Strict Validation Module
 *
 * THROW-ON-ERROR validators for all system inputs.
 * Use these at system boundaries to catch invalid data early.
 *
 * Design principles:
 * - Fail fast: throw immediately on invalid input
 * - Clear messages: include context in error messages
 * - Type narrowing: use assertion functions to narrow types
 * - No silent failures: never swallow errors or return defaults
 */

import { INPUT_LIMITS } from "../constants";

// =============================================================================
// VALIDATION ERROR CLASS
// =============================================================================

/**
 * Custom error for validation failures.
 * Includes field name and value for debugging.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(`${field}: ${message}`);
    this.name = "ValidationError";
  }
}

/**
 * Throw a validation error with context
 */
function fail(field: string, message: string, value: unknown): never {
  throw new ValidationError(message, field, value);
}

// =============================================================================
// PRIMITIVE VALIDATORS
// =============================================================================

/**
 * Assert value is a string
 */
export function assertString(
  value: unknown,
  field: string
): asserts value is string {
  if (typeof value !== "string") {
    fail(field, `expected string, got ${typeof value}`, value);
  }
}

/**
 * Assert value is a non-empty string
 */
export function assertNonEmptyString(
  value: unknown,
  field: string
): asserts value is string {
  assertString(value, field);
  if (value.length === 0) {
    fail(field, "cannot be empty", value);
  }
}

/**
 * Assert value is a number
 */
export function assertNumber(
  value: unknown,
  field: string
): asserts value is number {
  if (typeof value !== "number") {
    fail(field, `expected number, got ${typeof value}`, value);
  }
  if (!Number.isFinite(value)) {
    fail(field, `must be finite, got ${value}`, value);
  }
}

/**
 * Assert value is an integer
 */
export function assertInteger(
  value: unknown,
  field: string
): asserts value is number {
  assertNumber(value, field);
  if (!Number.isInteger(value)) {
    fail(field, `must be integer, got ${value}`, value);
  }
}

/**
 * Assert value is a positive integer (> 0)
 */
export function assertPositiveInteger(
  value: unknown,
  field: string
): asserts value is number {
  assertInteger(value, field);
  if (value <= 0) {
    fail(field, `must be positive, got ${value}`, value);
  }
}

/**
 * Assert value is a non-negative integer (>= 0)
 */
export function assertNonNegativeInteger(
  value: unknown,
  field: string
): asserts value is number {
  assertInteger(value, field);
  if (value < 0) {
    fail(field, `cannot be negative, got ${value}`, value);
  }
}

/**
 * Assert value is a boolean
 */
export function assertBoolean(
  value: unknown,
  field: string
): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail(field, `expected boolean, got ${typeof value}`, value);
  }
}

/**
 * Assert value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  field: string
): asserts value is T {
  if (value === null || value === undefined) {
    fail(field, `is required, got ${value}`, value);
  }
}

/**
 * Assert value is an object (not null)
 */
export function assertObject(
  value: unknown,
  field: string
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    fail(field, `expected object, got ${value === null ? "null" : typeof value}`, value);
  }
}

/**
 * Assert value is an array
 */
export function assertArray(
  value: unknown,
  field: string
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    fail(field, `expected array, got ${typeof value}`, value);
  }
}

// =============================================================================
// GAME-SPECIFIC VALIDATORS
// =============================================================================

/**
 * Assert valid player ID
 * - Non-empty string
 * - No control characters
 * - Within length limit
 */
export function assertPlayerId(
  value: unknown,
  field: string = "playerId"
): asserts value is string {
  assertNonEmptyString(value, field);

  if (value.length > INPUT_LIMITS.MAX_ITEM_ID_LENGTH) {
    fail(field, `exceeds max length ${INPUT_LIMITS.MAX_ITEM_ID_LENGTH}`, value);
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(value)) {
    fail(field, "contains control characters", value);
  }
}

/**
 * Assert valid item ID
 * - Non-empty string
 * - No control characters
 * - Within length limit
 */
export function assertItemId(
  value: unknown,
  field: string = "itemId"
): asserts value is string {
  assertNonEmptyString(value, field);

  if (value.length > INPUT_LIMITS.MAX_ITEM_ID_LENGTH) {
    fail(field, `exceeds max length ${INPUT_LIMITS.MAX_ITEM_ID_LENGTH}`, value);
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(value)) {
    fail(field, "contains control characters", value);
  }
}

/**
 * Assert valid entity ID
 */
export function assertEntityId(
  value: unknown,
  field: string = "entityId"
): asserts value is string {
  assertNonEmptyString(value, field);

  if (value.length > 256) {
    fail(field, "exceeds max length 256", value);
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(value)) {
    fail(field, "contains control characters", value);
  }
}

/**
 * Assert valid inventory slot index
 */
export function assertSlotIndex(
  value: unknown,
  field: string = "slot"
): asserts value is number {
  assertInteger(value, field);

  if (value < 0 || value >= INPUT_LIMITS.MAX_INVENTORY_SLOTS) {
    fail(
      field,
      `must be in range [0, ${INPUT_LIMITS.MAX_INVENTORY_SLOTS})`,
      value
    );
  }
}

/**
 * Assert valid quantity
 */
export function assertQuantity(
  value: unknown,
  field: string = "quantity"
): asserts value is number {
  assertInteger(value, field);

  if (value < 1) {
    fail(field, "must be at least 1", value);
  }

  if (value > INPUT_LIMITS.MAX_QUANTITY) {
    fail(field, `exceeds max ${INPUT_LIMITS.MAX_QUANTITY}`, value);
  }
}

/**
 * Assert valid position
 */
export function assertPosition(
  value: unknown,
  field: string = "position"
): asserts value is { x: number; y: number; z: number } {
  assertObject(value, field);

  const pos = value as Record<string, unknown>;
  assertNumber(pos.x, `${field}.x`);
  assertNumber(pos.y, `${field}.y`);
  assertNumber(pos.z, `${field}.z`);

  const MAX_COORD = 10000;
  if (Math.abs(pos.x as number) > MAX_COORD) {
    fail(`${field}.x`, `exceeds world bounds ±${MAX_COORD}`, pos.x);
  }
  if (Math.abs(pos.z as number) > MAX_COORD) {
    fail(`${field}.z`, `exceeds world bounds ±${MAX_COORD}`, pos.z);
  }
}

/**
 * Assert valid 2D position
 */
export function assertPosition2D(
  value: unknown,
  field: string = "position"
): asserts value is { x: number; z: number } {
  assertObject(value, field);

  const pos = value as Record<string, unknown>;
  assertNumber(pos.x, `${field}.x`);
  assertNumber(pos.z, `${field}.z`);
}

/**
 * Assert valid attack type
 */
export type AttackTypeName = "melee" | "ranged" | "magic";

export function assertAttackType(
  value: unknown,
  field: string = "attackType"
): asserts value is AttackTypeName {
  assertString(value, field);

  const validTypes: AttackTypeName[] = ["melee", "ranged", "magic"];
  if (!validTypes.includes(value as AttackTypeName)) {
    fail(field, `must be one of [${validTypes.join(", ")}]`, value);
  }
}

/**
 * Assert valid equipment slot
 */
export type EquipmentSlotName =
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

export function assertEquipmentSlot(
  value: unknown,
  field: string = "slot"
): asserts value is EquipmentSlotName {
  assertString(value, field);

  const validSlots: EquipmentSlotName[] = [
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

  if (!validSlots.includes(value as EquipmentSlotName)) {
    fail(field, `must be one of [${validSlots.join(", ")}]`, value);
  }
}

/**
 * Assert valid session type
 */
export type SessionTypeName = "store" | "bank" | "dialogue";

export function assertSessionType(
  value: unknown,
  field: string = "sessionType"
): asserts value is SessionTypeName {
  assertString(value, field);

  const validTypes: SessionTypeName[] = ["store", "bank", "dialogue"];
  if (!validTypes.includes(value as SessionTypeName)) {
    fail(field, `must be one of [${validTypes.join(", ")}]`, value);
  }
}

/**
 * Assert valid tick number
 */
export function assertTick(
  value: unknown,
  field: string = "tick"
): asserts value is number {
  assertNonNegativeInteger(value, field);
}

/**
 * Assert valid health value
 */
export function assertHealth(
  value: unknown,
  maxHealth: number,
  field: string = "health"
): asserts value is number {
  assertNonNegativeInteger(value, field);

  if (value > maxHealth) {
    fail(field, `exceeds max health ${maxHealth}`, value);
  }
}

/**
 * Assert valid damage value
 */
export function assertDamage(
  value: unknown,
  field: string = "damage"
): asserts value is number {
  assertNonNegativeInteger(value, field);
}

// =============================================================================
// COMPOSITE VALIDATORS
// =============================================================================

/**
 * Validate a move item request
 */
export interface MoveItemInput {
  playerId: string;
  fromSlot: number;
  toSlot: number;
}

export function assertMoveItemInput(
  value: unknown,
  field: string = "moveItem"
): asserts value is MoveItemInput {
  assertObject(value, field);

  const input = value as Record<string, unknown>;

  // Handle parameter name variations
  const fromSlot = input.fromSlot ?? input.sourceSlot;
  const toSlot = input.toSlot ?? input.targetSlot;

  assertPlayerId(input.playerId, `${field}.playerId`);
  assertSlotIndex(fromSlot, `${field}.fromSlot`);
  assertSlotIndex(toSlot, `${field}.toSlot`);

  // Normalize to standard property names
  (input as MoveItemInput).fromSlot = fromSlot as number;
  (input as MoveItemInput).toSlot = toSlot as number;
}

/**
 * Validate a pickup item request
 */
export interface PickupItemInput {
  playerId: string;
  entityId: string;
  itemId?: string;
}

export function assertPickupItemInput(
  value: unknown,
  field: string = "pickupItem"
): asserts value is PickupItemInput {
  assertObject(value, field);

  const input = value as Record<string, unknown>;
  assertPlayerId(input.playerId, `${field}.playerId`);
  assertEntityId(input.entityId, `${field}.entityId`);

  if (input.itemId !== undefined) {
    assertItemId(input.itemId, `${field}.itemId`);
  }
}

/**
 * Validate a drop item request
 */
export interface DropItemInput {
  playerId: string;
  itemId: string;
  quantity: number;
  slot?: number;
}

export function assertDropItemInput(
  value: unknown,
  field: string = "dropItem"
): asserts value is DropItemInput {
  assertObject(value, field);

  const input = value as Record<string, unknown>;
  assertPlayerId(input.playerId, `${field}.playerId`);
  assertItemId(input.itemId, `${field}.itemId`);
  assertQuantity(input.quantity, `${field}.quantity`);

  if (input.slot !== undefined) {
    assertSlotIndex(input.slot, `${field}.slot`);
  }
}

/**
 * Validate an attack request
 */
export interface AttackInput {
  playerId: string;
  targetId: string;
  attackType?: AttackTypeName;
}

export function assertAttackInput(
  value: unknown,
  field: string = "attack"
): asserts value is AttackInput {
  assertObject(value, field);

  const input = value as Record<string, unknown>;
  assertPlayerId(input.playerId, `${field}.playerId`);
  assertEntityId(input.targetId, `${field}.targetId`);

  if (input.attackType !== undefined) {
    assertAttackType(input.attackType, `${field}.attackType`);
  }
}

/**
 * Validate a bank operation request
 */
export interface BankOperationInput {
  playerId: string;
  bankId: string;
  itemId?: string;
  quantity?: number;
}

export function assertBankOperationInput(
  value: unknown,
  field: string = "bankOperation"
): asserts value is BankOperationInput {
  assertObject(value, field);

  const input = value as Record<string, unknown>;
  assertPlayerId(input.playerId, `${field}.playerId`);
  assertEntityId(input.bankId, `${field}.bankId`);

  if (input.itemId !== undefined) {
    assertItemId(input.itemId, `${field}.itemId`);
  }
  if (input.quantity !== undefined) {
    assertQuantity(input.quantity, `${field}.quantity`);
  }
}

/**
 * Validate a trade request
 */
export interface TradeInput {
  playerId: string;
  targetPlayerId: string;
}

export function assertTradeInput(
  value: unknown,
  field: string = "trade"
): asserts value is TradeInput {
  assertObject(value, field);

  const input = value as Record<string, unknown>;
  assertPlayerId(input.playerId, `${field}.playerId`);
  assertPlayerId(input.targetPlayerId, `${field}.targetPlayerId`);

  if (input.playerId === input.targetPlayerId) {
    fail(field, "cannot trade with yourself", input);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Clamp a quantity to valid range (use AFTER validation for user input)
 */
export function clampQuantity(value: number): number {
  return Math.max(1, Math.min(Math.floor(value), INPUT_LIMITS.MAX_QUANTITY));
}

/**
 * Check if a value would overflow when added
 */
export function wouldOverflow(current: number, add: number): boolean {
  return current > INPUT_LIMITS.MAX_QUANTITY - add;
}

/**
 * Safe parseInt that throws on invalid input
 */
export function parseIntStrict(value: string, field: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    fail(field, `cannot parse "${value}" as integer`, value);
  }
  return parsed;
}
