/**
 * Death System Type Definitions
 * Centralized types for player death, loot, and resurrection mechanics
 */

import type { InventoryItem } from "../core/core";

/**
 * Zone types for death handling
 */
export enum ZoneType {
  SAFE_AREA = "safe_area",
  WILDERNESS = "wilderness",
  PVP_ZONE = "pvp_zone",
  UNKNOWN = "unknown",
}

/**
 * Zone properties for death mechanics
 */
export interface ZoneProperties {
  type: ZoneType;
  isSafe: boolean;
  isPvPEnabled: boolean;
  isWilderness: boolean;
  name: string;
  difficultyLevel: number;
}

/**
 * Death lock state stored in database
 * Prevents item duplication on reconnect
 */
export interface DeathLock {
  playerId: string;
  gravestoneId?: string; // Present in safe zones
  groundItemIds?: string[]; // Present in wilderness or after gravestone expires
  position: { x: number; y: number; z: number };
  timestamp: number;
  zoneType: ZoneType;
  itemCount: number;
}

/**
 * Ground item spawn options
 * Config accepts milliseconds for backwards compatibility,
 * internally converted to ticks by GroundItemManager
 */
export interface GroundItemOptions {
  despawnTime: number; // Milliseconds until despawn (converted to ticks internally)
  droppedBy?: string; // Player who dropped it
  lootProtection?: number; // Milliseconds of loot protection (converted to ticks internally)
  scatter?: boolean; // Scatter items around position
  scatterRadius?: number; // Radius for scattering
}

/**
 * Ground item data tracked by GroundItemManager (TICK-BASED)
 * Uses tick numbers for OSRS-accurate despawn timing
 */
export interface GroundItemData {
  entityId: string;
  itemId: string;
  quantity: number;
  position: { x: number; y: number; z: number };
  despawnTick: number; // Tick number when item despawns
  droppedBy?: string;
  lootProtectionTick?: number; // Tick number when loot protection ends
  spawnedAt: number; // Timestamp for logging only
}

/**
 * Death event data
 */
export interface DeathEventData {
  playerId: string;
  position: { x: number; y: number; z: number };
  items: InventoryItem[];
  killedBy: string;
  zoneType: ZoneType;
}

/**
 * Reconnect validation result
 */
export interface ReconnectValidation {
  hasActiveDeath: boolean;
  gravestoneExists: boolean;
  groundItemsExist: string[]; // List of existing ground item IDs
  shouldBlockInventoryLoad: boolean;
  deathData?: DeathLock;
}
