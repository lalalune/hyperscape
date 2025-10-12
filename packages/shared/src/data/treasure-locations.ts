/**
 * Treasure Spawn Locations - GDD Implementation
 * Defines locations where treasure items spawn across different difficulty zones
 */

import type { TreasureLocation } from '../types/core'

/**
 * Treasure spawn locations organized by difficulty level
 */
export const TREASURE_LOCATIONS: Record<string, TreasureLocation> = {
  // Level 1 - Beginner treasure locations
  // Y=0 for all positions - will be grounded to terrain
  'lumbridge_chest_1': {
    id: 'lumbridge_chest_1',
    position: { x: 6, y: 0, z: 6 },
    difficulty: 1,
    areaId: 'lumbridge',
    description: 'Hidden chest near Lumbridge castle',
    respawnTime: 1800000, // 30 minutes
    maxItems: 3
  },
  'lumbridge_chest_2': {
    id: 'lumbridge_chest_2',
    position: { x: -6, y: 0, z: 6 },
    difficulty: 1,
    areaId: 'lumbridge',
    description: 'Buried treasure by the river',
    respawnTime: 1800000,
    maxItems: 3
  },
  'lumbridge_chest_3': {
    id: 'lumbridge_chest_3',
    position: { x: 6, y: 0, z: -6 },
    difficulty: 1,
    areaId: 'lumbridge',
    description: 'Ancient cache in the woods',
    respawnTime: 1800000,
    maxItems: 3
  },
  'lumbridge_chest_4': {
    id: 'lumbridge_chest_4',
    position: { x: -6, y: 0, z: -6 },
    difficulty: 1,
    areaId: 'lumbridge',
    description: 'Forgotten stash near the bridge',
    respawnTime: 1800000,
    maxItems: 3
  },

  // Level 2 - Intermediate treasure locations
  'mistwood_hoard_1': {
    id: 'mistwood_hoard_1',
    position: { x: 12, y: 0, z: 12 },
    difficulty: 2,
    areaId: 'mistwood_valley',
    description: 'Bandit treasure cache',
    respawnTime: 2700000, // 45 minutes
    maxItems: 4
  },
  'mistwood_hoard_2': {
    id: 'mistwood_hoard_2',
    position: { x: -12, y: 0, z: 12 },
    difficulty: 2,
    areaId: 'mistwood_valley',
    description: 'Hidden goblin treasure',
    respawnTime: 2700000,
    maxItems: 4
  },
  'mistwood_hoard_3': {
    id: 'mistwood_hoard_3',
    position: { x: 12, y: 0, z: -12 },
    difficulty: 2,
    areaId: 'mistwood_valley',
    description: 'Ancient warrior burial site',
    respawnTime: 2700000,
    maxItems: 4
  },
  'mistwood_hoard_4': {
    id: 'mistwood_hoard_4',
    position: { x: -12, y: 0, z: -12 },
    difficulty: 2,
    areaId: 'mistwood_valley',
    description: 'Mysterious shrine offering',
    respawnTime: 2700000,
    maxItems: 4
  },

  // Level 3 - Advanced treasure locations
  'shadowlands_vault_1': {
    id: 'shadowlands_vault_1',
    position: { x: 16, y: 0, z: 16 },
    difficulty: 3,
    areaId: 'shadowlands',
    description: 'Dark knight treasure vault',
    respawnTime: 3600000, // 60 minutes
    maxItems: 5
  },
  'shadowlands_vault_2': {
    id: 'shadowlands_vault_2',
    position: { x: -16, y: 0, z: 16 },
    difficulty: 3,
    areaId: 'shadowlands',
    description: 'Frozen warrior tomb',
    respawnTime: 3600000,
    maxItems: 5
  },
  'shadowlands_vault_3': {
    id: 'shadowlands_vault_3',
    position: { x: 16, y: 0, z: -16 },
    difficulty: 3,
    areaId: 'shadowlands',
    description: 'Dark ranger secret stash',
    respawnTime: 3600000,
    maxItems: 5
  }
};

/**
 * Get treasure locations by difficulty level
 */
export function getTreasureLocationsByDifficulty(difficulty: 1 | 2 | 3): TreasureLocation[] {
  return Object.values(TREASURE_LOCATIONS).filter(location => location.difficulty === difficulty);
}

/**
 * Get treasure locations in a specific area
 */
export function getTreasureLocationsInArea(areaId: string): TreasureLocation[] {
  return Object.values(TREASURE_LOCATIONS).filter(location => location.areaId === areaId);
}

/**
 * Get all treasure locations
 */
export function getAllTreasureLocations(): TreasureLocation[] {
  return Object.values(TREASURE_LOCATIONS);
}

/**
 * Treasure spawn constants
 */
export const TREASURE_CONSTANTS = {
  DEFAULT_RESPAWN_TIME: 1800000, // 30 minutes
  MAX_ITEMS_PER_LOCATION: 5,
  SPAWN_RADIUS: 2, // Meters around the location where items can spawn
} as const;