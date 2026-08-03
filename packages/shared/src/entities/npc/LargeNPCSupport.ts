/**
 * LargeNPCSupport - Multi-tile NPC handling
 *
 * classic MMORPG large NPCs:
 * - Occupy multiple tiles (2x2, 3x3, 4x4, etc.)
 * - SW tile is "true" position for most calculations
 * - Attack range originates from ALL occupied tiles
 * - Players can walk through occupied tiles (with entity collision)
 *
 * This module provides utilities for handling NPCs that occupy more than
 * one tile, matching classic tick-based mechanics for boss fights and large creatures.
 *
 * @see MOB_AGGRO_IMPLEMENTATION_PLAN.md
 */

import type { TileCoord } from "../../systems/shared/movement/TileSystem";
import type { Position3D } from "../../types";
import {
  TILE_SIZE,
  worldToTile,
} from "../../systems/shared/movement/TileSystem";

/**
 * NPC size in tiles
 */
export interface NPCSize {
  /** Tiles in X direction */
  width: number;
  /** Tiles in Z direction */
  depth: number;
}

/**
 * Default NPC sizes for common mob types
 *
 * Size 1x1: Standard mobs (goblin, cow, etc.)
 * Size 2x2: Large bosses (GWD bosses, KQ, etc.)
 * Size 3x3: Very large bosses (Corp, Cerberus, KBD)
 * Size 4x4: Massive bosses (Vorkath)
 * Size 5x5: Raid bosses (Olm)
 */
export const NPC_SIZES: Record<string, NPCSize> = {
  // 1x1 (default)
  goblin: { width: 1, depth: 1 },
  cow: { width: 1, depth: 1 },
  chicken: { width: 1, depth: 1 },
  rat: { width: 1, depth: 1 },
  spider: { width: 1, depth: 1 },
  skeleton: { width: 1, depth: 1 },
  zombie: { width: 1, depth: 1 },
  imp: { width: 1, depth: 1 },
  guard: { width: 1, depth: 1 },
  dark_wizard: { width: 1, depth: 1 },
  hill_giant: { width: 1, depth: 1 },
  moss_giant: { width: 1, depth: 1 },
  lesser_demon: { width: 1, depth: 1 },
  greater_demon: { width: 1, depth: 1 },

  // 2x2
  general_graardor: { width: 2, depth: 2 },
  kril_tsutsaroth: { width: 2, depth: 2 },
  commander_zilyana: { width: 2, depth: 2 },
  kreearra: { width: 2, depth: 2 },
  giant_mole: { width: 2, depth: 2 },
  kalphite_queen: { width: 2, depth: 2 },
  dagannoth_rex: { width: 2, depth: 2 },
  dagannoth_prime: { width: 2, depth: 2 },
  dagannoth_supreme: { width: 2, depth: 2 },
  sarachnis: { width: 2, depth: 2 },

  // 3x3
  corporeal_beast: { width: 3, depth: 3 },
  cerberus: { width: 3, depth: 3 },
  king_black_dragon: { width: 3, depth: 3 },
  chaos_elemental: { width: 3, depth: 3 },
  nightmare: { width: 3, depth: 3 },

  // 4x4
  vorkath: { width: 4, depth: 4 },
  zulrah: { width: 4, depth: 4 },

  // 5x5
  olm_head: { width: 5, depth: 5 },
  verzik_vitur: { width: 5, depth: 5 },
};

/**
 * Get NPC size by mob type, defaulting to 1x1
 *
 * @param mobType - The mob type string (e.g., "goblin", "corporeal_beast")
 * @returns Size in tiles
 */
export function getNPCSize(mobType: string): NPCSize {
  return NPC_SIZES[mobType.toLowerCase()] ?? { width: 1, depth: 1 };
}

/**
 * Calculate the SW (southwest) tile for an NPC
 *
 * The SW tile is the tile with the smallest X and Z coordinates
 * that the NPC occupies. This is the "true" position for most
 * classic MMORPG calculations (pathfinding, hunt range, etc.)
 *
 * @param worldPos - NPC's world position
 * @returns SW tile coordinate
 */
export function getSWTile(worldPos: Position3D): TileCoord {
  return worldToTile(worldPos.x, worldPos.z);
}

/**
 * Calculate all tiles occupied by a large NPC
 *
 * @param swTile - The NPC's SW tile
 * @param size - The NPC's size
 * @param buffer - Pre-allocated buffer to fill (zero allocation)
 * @returns Number of tiles filled
 */
export function getOccupiedTiles(
  swTile: TileCoord,
  size: NPCSize,
  buffer: TileCoord[],
): number {
  const width = size.width || 1;
  const depth = size.depth || 1;

  // Ensure buffer has enough space
  const neededSize = width * depth;
  while (buffer.length < neededSize) {
    buffer.push({ x: 0, z: 0 });
  }

  let index = 0;
  for (let dx = 0; dx < width; dx++) {
    for (let dz = 0; dz < depth; dz++) {
      buffer[index].x = swTile.x + dx;
      buffer[index].z = swTile.z + dz;
      index++;
    }
  }

  return index;
}

/**
 * Check if a tile is occupied by a large NPC
 *
 * @param tile - Tile to check
 * @param npcSWTile - NPC's SW tile
 * @param size - NPC's size
 * @returns True if tile is within NPC's occupied area
 */
export function isTileOccupiedByNPC(
  tile: TileCoord,
  npcSWTile: TileCoord,
  size: NPCSize,
): boolean {
  return (
    tile.x >= npcSWTile.x &&
    tile.x < npcSWTile.x + (size.width || 1) &&
    tile.z >= npcSWTile.z &&
    tile.z < npcSWTile.z + (size.depth || 1)
  );
}

/**
 * Get the center tile of a large NPC
 *
 * For visual centering or area-of-effect calculations.
 *
 * @param swTile - NPC's SW tile
 * @param size - NPC's size
 * @returns Center tile (floored for odd sizes)
 */
export function getCenterTile(swTile: TileCoord, size: NPCSize): TileCoord {
  return {
    x: swTile.x + Math.floor((size.width || 1) / 2),
    z: swTile.z + Math.floor((size.depth || 1) / 2),
  };
}

/**
 * Get the center world position of a large NPC
 *
 * @param swTile - NPC's SW tile
 * @param size - NPC's size
 * @returns Center position in world coordinates
 */
export function getCenterWorldPosition(
  swTile: TileCoord,
  size: NPCSize,
): { x: number; z: number } {
  const width = size.width || 1;
  const depth = size.depth || 1;

  return {
    x: (swTile.x + width / 2) * TILE_SIZE,
    z: (swTile.z + depth / 2) * TILE_SIZE,
  };
}

/**
 * Check if two NPCs overlap (for collision detection)
 *
 * @param npc1SW - First NPC's SW tile
 * @param npc1Size - First NPC's size
 * @param npc2SW - Second NPC's SW tile
 * @param npc2Size - Second NPC's size
 * @returns True if NPCs overlap
 */
export function doNPCsOverlap(
  npc1SW: TileCoord,
  npc1Size: NPCSize,
  npc2SW: TileCoord,
  npc2Size: NPCSize,
): boolean {
  const npc1MaxX = npc1SW.x + (npc1Size.width || 1);
  const npc1MaxZ = npc1SW.z + (npc1Size.depth || 1);
  const npc2MaxX = npc2SW.x + (npc2Size.width || 1);
  const npc2MaxZ = npc2SW.z + (npc2Size.depth || 1);

  // Check for non-overlap (more efficient than checking overlap)
  if (npc1MaxX <= npc2SW.x) return false; // npc1 is left of npc2
  if (npc1SW.x >= npc2MaxX) return false; // npc1 is right of npc2
  if (npc1MaxZ <= npc2SW.z) return false; // npc1 is below npc2
  if (npc1SW.z >= npc2MaxZ) return false; // npc1 is above npc2

  return true;
}

/**
 * Get the closest tile of a large NPC to a target tile
 *
 * Used for pathfinding - find which occupied tile is closest to target.
 *
 * @param npcSWTile - NPC's SW tile
 * @param size - NPC's size
 * @param targetTile - Target tile
 * @returns Closest occupied tile to target
 */
export function getClosestOccupiedTile(
  npcSWTile: TileCoord,
  size: NPCSize,
  targetTile: TileCoord,
): TileCoord {
  const width = size.width || 1;
  const depth = size.depth || 1;

  // Clamp target to NPC's occupied area
  const closestX = Math.max(
    npcSWTile.x,
    Math.min(npcSWTile.x + width - 1, targetTile.x),
  );
  const closestZ = Math.max(
    npcSWTile.z,
    Math.min(npcSWTile.z + depth - 1, targetTile.z),
  );

  return { x: closestX, z: closestZ };
}

/**
 * Calculate the area in tiles that a large NPC occupies
 *
 * @param size - NPC's size
 * @returns Number of tiles
 */
export function getOccupiedArea(size: NPCSize): number {
  return (size.width || 1) * (size.depth || 1);
}
