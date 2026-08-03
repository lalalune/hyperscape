/**
 * Resource and Processing Types
 * All resource gathering, skilling, fires, and processing action type definitions
 */

import * as THREE from "../../extras/three/three";
import type { Position3D } from "../core/base-types";

// ============== RESOURCE TYPES ==============

/**
 * Resource footprint - predefined sizes for how many tiles a resource occupies
 * Used for rules-accurate tile-based positioning and interaction
 *
 * - standard: 1×1 tile (normal trees, rocks, fishing spots)
 * - large: 2×2 tiles (ancient trees, large ore veins)
 * - massive: 3×3 tiles (world trees, raid objects)
 *
 * Multi-tile resources use the SW (south-west) tile as their anchor,
 * matching classic MMORPG behavior for large objects.
 *
 */
export type ResourceFootprint = "standard" | "large" | "massive";

/**
 * Direct footprint dimensions for arbitrary shapes
 * Use when predefined sizes don't fit (e.g., 2×1 counter, 1×3 wall)
 */
export interface FootprintDimensions {
  /** Width in tiles (X axis) */
  width: number;
  /** Depth in tiles (Z axis) */
  depth: number;
}

/**
 * Flexible footprint specification - accepts either:
 * - Predefined string: "standard", "large", "massive"
 * - Direct dimensions: { width: 2, depth: 1 }
 */
export type FootprintSpec = ResourceFootprint | FootprintDimensions;

/**
 * Tile dimensions for each predefined footprint type
 * Used to calculate occupied tiles and interaction positions
 */
export const FOOTPRINT_SIZES: Record<
  ResourceFootprint,
  { x: number; z: number }
> = {
  standard: { x: 1, z: 1 },
  large: { x: 2, z: 2 },
  massive: { x: 3, z: 3 },
};

/**
 * Resolve any footprint spec to dimensions { x, z }
 * Handles both predefined strings and direct dimensions
 *
 * @param footprint - Predefined string or direct dimensions
 * @returns Dimensions in { x, z } format
 */
export function resolveFootprint(footprint: FootprintSpec): {
  x: number;
  z: number;
} {
  if (typeof footprint === "string") {
    return FOOTPRINT_SIZES[footprint] || FOOTPRINT_SIZES.standard;
  }
  return { x: footprint.width, z: footprint.depth };
}

/**
 * Resource - a gatherable resource in the world
 */
export interface Resource {
  id: string;
  type: "tree" | "fishing_spot" | "ore" | "herb_patch" | "mine";
  name: string;
  position: Position3D;
  skillRequired: string;
  levelRequired: number;
  toolRequired: string; // Tool item ID
  /** Secondary consumable required (e.g., "fishing_bait" for rod fishing, "feathers" for fly fishing) */
  secondaryRequired?: string;
  respawnTime: number; // Milliseconds
  isAvailable: boolean;
  lastDepleted: number;
  drops: ResourceDrop[];
  /** Tile footprint - defaults to "standard" (1×1) if not specified */
  footprint?: ResourceFootprint;
}

/**
 * Resource drop - what a resource can drop when gathered
 *
 * For fishing with classic MMORPG priority rolling:
 * - `levelRequired`: Minimum skill level to catch this fish
 * - `catchLow`: Catch rate at level 1 (x/256 numerator)
 * - `catchHigh`: Catch rate at level 99 (x/256 numerator)
 *
 * Fish are rolled in priority order (highest level first).
 */
export interface ResourceDrop {
  itemId: string;
  itemName: string;
  quantity: number;
  chance: number; // 0-1 (for weighted random) or 1.0 (for priority rolling)
  xpAmount: number;
  stackable: boolean;
  /** Skill level required to catch this specific item */
  levelRequired?: number;
  /** classic MMORPG catch rate numerator at level 1 (x/256) */
  catchLow?: number;
  /** classic MMORPG catch rate numerator at level 99 (x/256) */
  catchHigh?: number;
}

// ============== FIRE TYPES ==============

/**
 * Fire - a fire created by the firemaking skill
 */
export interface Fire {
  id: string;
  position: Position3D;
  playerId: string; // Who lit the fire
  createdAt: number;
  duration: number; // How long fire lasts in milliseconds
  isActive: boolean;
  mesh?: THREE.Object3D;
}

// ============== PROCESSING TYPES ==============

/**
 * Processing action - firemaking and cooking actions
 *
 * Note: Item IDs are always strings. The manifest uses string IDs
 * (e.g., "raw_shrimp", "logs") as the source of truth.
 */
export interface ProcessingAction {
  playerId: string;
  actionType: "firemaking" | "cooking";
  primaryItem: { id: string; slot: number }; // Item being used (tinderbox/raw fish)
  targetItem?: { id: string; slot: number }; // Target item (logs/fire)
  targetFire?: string; // Fire ID for cooking
  startPosition?: Position3D; // Cached position at start (for firemaking movement detection)
  startTime: number;
  duration: number;
  xpReward: number;
  skillRequired: string;
}

// ============== DEATH AND RESPAWN TYPES ==============

/**
 * Death data - information about a player's death
 */
export interface DeathData {
  playerId: string;
  deathLocation: Position3D;
  killedBy: string;
  deathTime: number;
  respawnTime: number;
  itemsDropped?: string[];
}
