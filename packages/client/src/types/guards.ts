/**
 * Type Guards
 *
 * Runtime type validation functions for common data structures.
 * Use these to safely narrow unknown types in event handlers and API responses.
 *
 * @packageDocumentation
 */

import type { InventorySlotViewItem } from "../game/types";

// ============================================================================
// Inventory Event Guards
// ============================================================================

/**
 * Type guard for inventory update events
 */
export interface InventoryUpdateEvent {
  items: InventorySlotViewItem[];
  coins?: number;
}

export function isInventoryUpdateEvent(
  data: unknown,
): data is InventoryUpdateEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return "items" in obj && Array.isArray(obj.items);
}

/**
 * Type guard for coin update events
 */
export interface CoinUpdateEvent {
  coins: number;
}

export function isCoinUpdateEvent(data: unknown): data is CoinUpdateEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return "coins" in obj && typeof obj.coins === "number";
}

// ============================================================================
// UI Update Event Guards
// ============================================================================

/**
 * Type guard for UI update events
 */
export interface UIUpdateEvent {
  component: string;
  data: unknown;
}

export function isUIUpdateEvent(data: unknown): data is UIUpdateEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    "component" in obj && typeof obj.component === "string" && "data" in obj
  );
}

// ============================================================================
// Skills Event Guards
// ============================================================================

/**
 * Type guard for skills update events
 */
export interface SkillsUpdateEvent {
  playerId: string;
  skills: Record<string, { level: number; xp: number }>;
}

export function isSkillsUpdateEvent(data: unknown): data is SkillsUpdateEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    "playerId" in obj &&
    typeof obj.playerId === "string" &&
    "skills" in obj &&
    typeof obj.skills === "object"
  );
}

// ============================================================================
// Equipment Event Guards
// ============================================================================

/**
 * Type guard for equipment update events
 */
export interface EquipmentUpdateEvent {
  playerId?: string;
  equipment: Record<string, unknown>;
}

export function isEquipmentUpdateEvent(
  data: unknown,
): data is EquipmentUpdateEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return "equipment" in obj && typeof obj.equipment === "object";
}

// ============================================================================
// Loading Event Guards
// ============================================================================

/**
 * Type guard for loading progress events
 */
export interface LoadingProgressEvent {
  progress: number;
  stage?: string;
  message?: string;
}

export function isLoadingProgressEvent(
  data: unknown,
): data is LoadingProgressEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return "progress" in obj && typeof obj.progress === "number";
}

// ============================================================================
// Death Screen Event Guards
// ============================================================================

/**
 * Type guard for death screen events
 */
export interface DeathScreenEvent {
  message: string;
  killedBy: string;
  respawnTime?: number;
}

export function isDeathScreenEvent(data: unknown): data is DeathScreenEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    "message" in obj &&
    typeof obj.message === "string" &&
    "killedBy" in obj &&
    typeof obj.killedBy === "string"
  );
}

// ============================================================================
// Generic Object Guards
// ============================================================================

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Check if a value has a specific string property
 */
export function hasStringProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, string> {
  return isObject(value) && key in value && typeof value[key] === "string";
}

/**
 * Check if a value has a specific number property
 */
export function hasNumberProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, number> {
  return isObject(value) && key in value && typeof value[key] === "number";
}

/**
 * Check if a value has a specific array property
 */
export function hasArrayProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, unknown[]> {
  return isObject(value) && key in value && Array.isArray(value[key]);
}
