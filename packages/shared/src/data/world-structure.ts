/**
 * GDD-Compliant World Structure
 * Defines biomes, zones, starter towns, and world layout per Game Design Document
 */

import type {
  BiomeData,
  PlayerSpawnPointData,
  ResourceSpawnPointData,
  ZoneData
} from '../types/core';
import { calculateDistance2D } from '../utils/EntityUtils';

// Re-export types for external use
export type { DeathLocationData } from '../types/core';

/**
 * Helper to create BiomeData with defaults for duplicated properties
 */
function createBiome(partial: Partial<BiomeData> & {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 0 | 1 | 2 | 3;
  terrain: 'forest' | 'wastes' | 'plains' | 'frozen' | 'corrupted' | 'lake' | 'mountain';
  resources: string[];
  mobs: string[];
  fogIntensity: number;
  colorScheme: { primary: string; secondary: string; fog: string };
}): BiomeData {
  return {
    ...partial,
    // Default values for additional required fields
    ambientSound: partial.ambientSound || 'ambient_generic',
    color: parseInt(partial.colorScheme.primary.replace('#', '0x'), 16),
    heightRange: partial.heightRange || [0.0, 1.0] as [number, number],
    terrainMultiplier: partial.terrainMultiplier || 1.0,
    waterLevel: partial.waterLevel || 0.0,
    maxSlope: partial.maxSlope || 0.8,
    mobTypes: partial.mobs, // Use mobs as mobTypes
    difficulty: partial.difficultyLevel, // Use difficultyLevel as difficulty
    baseHeight: partial.baseHeight || 0.0,
    heightVariation: partial.heightVariation || 0.5,
    resourceDensity: partial.resourceDensity || 0.5,
    resourceTypes: partial.resources // Use resources as resourceTypes
  };
}

/**
 * Biome Definitions per GDD
 */
export const BIOMES: Record<string, BiomeData> = {
  // Safe Zones (Level 0)
  starter_plains: createBiome({
    id: 'starter_plains',
    name: 'Peaceful Plains',
    description: 'Safe grasslands where new adventurers begin their journey.',
    difficultyLevel: 0,
    terrain: 'plains',
    resources: ['trees', 'fishing_spots'],
    mobs: [], // No hostile mobs in safe zones
    fogIntensity: 0.1,
    ambientSound: 'wind_gentle',
    colorScheme: {
      primary: '#4CAF50', // Green
      secondary: '#8BC34A', // Light green
      fog: '#E8F5E8'
    },
    heightRange: [0.0, 0.2] as [number, number],
    maxSlope: 0.6,
    heightVariation: 0.1
  }),

  // Level 1 - Beginner Areas
  mistwood_valley: createBiome({
    id: 'mistwood_valley',
    name: 'Mistwood Valley',
    description: 'Foggy forests with goblin camps hidden among the trees.',
    difficultyLevel: 1,
    terrain: 'forest',
    resources: ['trees', 'fishing_spots'],
    mobs: ['goblin', 'bandit'],
    fogIntensity: 0.6,
    ambientSound: 'forest_mysterious',
    colorScheme: {
      primary: '#2E7D32', // Dark green
      secondary: '#66BB6A', // Medium green  
      fog: '#B0BEC5'
    },
    heightRange: [0.2, 0.5] as [number, number],
    maxSlope: 0.8,
    heightVariation: 0.2
  }),

  goblin_wastes: createBiome({
    id: 'goblin_wastes',
    name: 'Goblin Wastes',
    description: 'Barren lands dominated by goblin tribes and desperate bandits.',
    difficultyLevel: 1,
    terrain: 'wastes',
    resources: ['trees'],
    mobs: ['goblin', 'bandit', 'barbarian'],
    fogIntensity: 0.3,
    ambientSound: 'wind_desolate',
    colorScheme: {
      primary: '#8D6E63', // Brown
      secondary: '#BCAAA4', // Light brown
      fog: '#D7CCC8'
    },
    heightRange: [0.1, 0.3] as [number, number],
    maxSlope: 0.6,
    heightVariation: 0.15
  }),

  northern_plains: createBiome({
    id: 'northern_plains',
    name: 'Northern Plains',
    description: 'Open grasslands where barbarian camps can be found.',
    difficultyLevel: 1,
    terrain: 'plains',
    resources: ['trees', 'fishing_spots'],
    mobs: ['barbarian', 'bandit'],
    fogIntensity: 0.2,
    ambientSound: 'wind_plains',
    colorScheme: {
      primary: '#689F38', // Olive green
      secondary: '#9CCC65', // Light olive
      fog: '#F1F8E9'
    }
  }),

  // Level 2 - Intermediate Areas
  darkwood_forest: createBiome({
    id: 'darkwood_forest',
    name: 'Darkwood Forest',
    description: 'Dense, shadowy woods hiding dark warriors and corrupted guards.',
    difficultyLevel: 2,
    terrain: 'forest',
    resources: ['trees'],
    mobs: [], // Loaded from JSON manifests - spawn locations defined below in spawnPoints
    fogIntensity: 0.8,
    ambientSound: 'forest_dark',
    colorScheme: {
      primary: '#1B5E20', // Very dark green
      secondary: '#388E3C', // Dark green
      fog: '#424242'
    }
  }),

  corrupted_ruins: createBiome({
    id: 'corrupted_ruins',
    name: 'Corrupted Ruins',
    description: 'Ancient fortress ruins where corrupted guards patrol endlessly.',
    difficultyLevel: 2,
    terrain: 'corrupted',
    resources: [],
    mobs: [], // Loaded from JSON manifests
    fogIntensity: 0.7,
    ambientSound: 'ruins_haunted',
    colorScheme: {
      primary: '#424242', // Dark gray
      secondary: '#616161', // Medium gray
      fog: '#9E9E9E'
    }
  }),

  // Level 3 - Advanced Areas
  blasted_lands: createBiome({
    id: 'blasted_lands',
    name: 'Blasted Lands',
    description: 'Desolate areas corrupted by dark magic, home to the most dangerous foes.',
    difficultyLevel: 3,
    terrain: 'corrupted',
    resources: [],
    mobs: [], // Loaded from JSON manifests
    fogIntensity: 0.9,
    ambientSound: 'wasteland_cursed',
    colorScheme: {
      primary: '#B71C1C', // Dark red
      secondary: '#D32F2F', // Red
      fog: '#FFCDD2'
    }
  }),

  northern_reaches: createBiome({
    id: 'northern_reaches',
    name: 'Northern Reaches',
    description: 'Frozen tundra with ice caves hiding ancient ice warriors.',
    difficultyLevel: 3,
    terrain: 'frozen',
    resources: ['fishing_spots'],
    mobs: [], // Loaded from JSON manifests
    fogIntensity: 0.5,
    ambientSound: 'wind_arctic',
    colorScheme: {
      primary: '#0D47A1', // Dark blue
      secondary: '#1976D2', // Blue
      fog: '#E3F2FD'
    }
  }),

  black_knight_fortress: createBiome({
    id: 'black_knight_fortress',
    name: 'Black Knight Fortress',
    description: 'Dark strongholds where elite Black Knights guard ancient secrets.',
    difficultyLevel: 3,
    terrain: 'corrupted',
    resources: [],
    mobs: [], // Loaded from JSON manifests
    fogIntensity: 0.8,
    ambientSound: 'fortress_ominous',
    colorScheme: {
      primary: '#212121', // Almost black
      secondary: '#424242', // Dark gray
      fog: '#757575'
    }
  }),

  // Special Zones
  lake_serenity: createBiome({
    id: 'lake_serenity',
    name: 'Lake Serenity',
    description: 'Peaceful fishing spots along shorelines throughout the world.',
    difficultyLevel: 0,
    terrain: 'lake',
    resources: ['fishing_spots'],
    mobs: [],
    fogIntensity: 0.1,
    ambientSound: 'water_gentle',
    colorScheme: {
      primary: '#0288D1', // Light blue
      secondary: '#03A9F4', // Bright blue
      fog: '#E1F5FE'
    }
  })
};

/**
 * Starter Town Definitions per GDD
 * Multiple starter towns with random assignment
 */
export const STARTER_TOWNS: ZoneData[] = [
  {
    id: 'town_central',
    name: 'Central Haven',
    biome: 'starter_plains',
    bounds: { x: -10, z: -10, width: 20, height: 20 },
    difficultyLevel: 0,
    isTown: true,
    hasBank: true,
    hasGeneralStore: true,
    spawnPoints: [
      {
        type: 'player',
        position: { x: 0, y: 2, z: 0 },
        data: { isMainSpawn: true } as PlayerSpawnPointData
      },
      {
        type: 'resource',
        position: { x: 5, y: 2, z: 8 },
        data: { type: 'bank', name: 'Central Bank', resourceId: 'central_bank', respawnTime: 0 } as ResourceSpawnPointData
      },
      {
        type: 'resource',
        position: { x: -5, y: 2, z: 8 },
        data: { type: 'general_store', name: 'Central General Store', resourceId: 'central_store', respawnTime: 0 } as ResourceSpawnPointData
      }
    ]
  },
  {
    id: 'town_eastern',
    name: 'Eastern Outpost',
    biome: 'starter_plains',
    bounds: { x: 90, z: -10, width: 20, height: 20 },
    difficultyLevel: 0,
    isTown: true,
    hasBank: true,
    hasGeneralStore: true,
    spawnPoints: [
      {
        type: 'player',
        position: { x: 100, y: 2, z: 0 },
        data: { isMainSpawn: true } as PlayerSpawnPointData
      },
      {
        type: 'resource',
        position: { x: 105, y: 2, z: 8 },
        data: { type: 'bank', name: 'Eastern Bank', resourceId: 'eastern_bank', respawnTime: 0 } as ResourceSpawnPointData
      },
      {
        type: 'resource',
        position: { x: 95, y: 2, z: 8 },
        data: { type: 'general_store', name: 'Eastern General Store', resourceId: 'eastern_store', respawnTime: 0 } as ResourceSpawnPointData
      }
    ]
  },
  {
    id: 'town_western',
    name: 'Western Settlement',
    biome: 'starter_plains',
    bounds: { x: -110, z: -10, width: 20, height: 20 },
    difficultyLevel: 0,
    isTown: true,
    hasBank: true,
    hasGeneralStore: true,
    spawnPoints: [
      {
        type: 'player',
        position: { x: -100, y: 2, z: 0 },
        data: { isMainSpawn: true } as PlayerSpawnPointData
      },
      {
        type: 'resource',
        position: { x: -95, y: 2, z: 8 },
        data: { type: 'bank', name: 'Western Bank', resourceId: 'western_bank', respawnTime: 0 } as ResourceSpawnPointData
      },
      {
        type: 'resource',  
        position: { x: -105, y: 2, z: 8 },
        data: { type: 'general_store', name: 'Western General Store', resourceId: 'western_store', respawnTime: 0 } as ResourceSpawnPointData
      }
    ]
  },
  {
    id: 'town_northern',
    name: 'Northern Village',
    biome: 'starter_plains',
    bounds: { x: -10, z: 90, width: 20, height: 20 },
    difficultyLevel: 0,
    isTown: true,
    hasBank: true,
    hasGeneralStore: true,
    spawnPoints: [
      {
        type: 'player',
        position: { x: 0, y: 2, z: 100 },
        data: { isMainSpawn: true } as PlayerSpawnPointData
      },
      {
        type: 'resource',
        position: { x: 5, y: 2, z: 108 },
        data: { type: 'bank', name: 'Northern Bank', resourceId: 'northern_bank', respawnTime: 0 } as ResourceSpawnPointData
      },
      {
        type: 'resource',
        position: { x: -5, y: 2, z: 108 },
        data: { type: 'general_store', name: 'Northern General Store', resourceId: 'northern_store', respawnTime: 0 } as ResourceSpawnPointData
      }
    ]
  },
  {
    id: 'town_southern',
    name: 'Southern Camp',
    biome: 'starter_plains',
    bounds: { x: -10, z: -110, width: 20, height: 20 },
    difficultyLevel: 0,
    isTown: true,
    hasBank: true,
    hasGeneralStore: true,
    spawnPoints: [
      {
        type: 'player',
        position: { x: 0, y: 2, z: -100 },
        data: { isMainSpawn: true } as PlayerSpawnPointData
      },
      {
        type: 'resource',
        position: { x: 5, y: 2, z: -92 },
        data: { type: 'bank', name: 'Southern Bank', resourceId: 'southern_bank', respawnTime: 0 } as ResourceSpawnPointData
      },
      {
        type: 'resource',
        position: { x: -5, y: 2, z: -92 },
        data: { type: 'general_store', name: 'Southern General Store', resourceId: 'southern_store', respawnTime: 0 } as ResourceSpawnPointData
      }
    ]
  }
];

/**
 * World Zones Layout per GDD
 * Distributed across the map with appropriate difficulty levels
 */
export const WORLD_ZONES: ZoneData[] = [
  ...STARTER_TOWNS,
  
  // Level 1 Zones
  {
    id: 'zone_mistwood_north',
    name: 'Northern Mistwood',
    biome: 'mistwood_valley',
    bounds: { x: 30, z: 30, width: 40, height: 40 },
    difficultyLevel: 1,
    isTown: false,
    hasBank: false,
    hasGeneralStore: false,
    spawnPoints: [
      // Goblin spawns
      { type: 'mob', position: { x: 35, y: 2, z: 35 }, data: { type: 'goblin', mobId: 'goblin', spawnRadius: 5, maxCount: 3, respawnTime: 60000 } },
      { type: 'mob', position: { x: 45, y: 2, z: 40 }, data: { type: 'goblin', mobId: 'goblin', spawnRadius: 5, maxCount: 3, respawnTime: 60000 } },
      { type: 'mob', position: { x: 55, y: 2, z: 50 }, data: { type: 'goblin', mobId: 'goblin', spawnRadius: 5, maxCount: 3, respawnTime: 60000 } },
      // Resources
      { type: 'resource', position: { x: 40, y: 2, z: 60 }, data: { type: 'trees', name: 'Oak Trees', resourceId: 'oak_tree', respawnTime: 30000 } },
      { type: 'resource', position: { x: 65, y: 2, z: 45 }, data: { type: 'fishing_spot', name: 'River Fishing Spot', resourceId: 'fishing_spot', respawnTime: 5000 } }
    ]
  },

  {
    id: 'zone_goblin_wastes_central',
    name: 'Central Wastes',
    biome: 'goblin_wastes',
    bounds: { x: -60, z: 20, width: 50, height: 50 },
    difficultyLevel: 1,
    isTown: false,
    hasBank: false,
    hasGeneralStore: false,
    spawnPoints: [
      // Mixed Level 1 mobs
      { type: 'mob', position: { x: -50, y: 2, z: 30 }, data: { type: 'goblin', mobId: 'goblin', spawnRadius: 5, maxCount: 2, respawnTime: 60000 } },
      { type: 'mob', position: { x: -40, y: 2, z: 35 }, data: { type: 'bandit', mobId: 'bandit', spawnRadius: 5, maxCount: 2, respawnTime: 60000 } },
      { type: 'mob', position: { x: -30, y: 2, z: 45 }, data: { type: 'barbarian', mobId: 'barbarian', spawnRadius: 5, maxCount: 2, respawnTime: 60000 } },
      // Sparse resources
      { type: 'resource', position: { x: -35, y: 2, z: 60 }, data: { type: 'trees', name: 'Dark Trees', resourceId: 'dark_tree', respawnTime: 45000 } }
    ]
  },

  // Level 2 Zones
  {
    id: 'zone_darkwood_deep',
    name: 'Deep Darkwood',
    biome: 'darkwood_forest',
    bounds: { x: 80, z: 80, width: 60, height: 60 },
    difficultyLevel: 2,
    isTown: false,
    hasBank: false,
    hasGeneralStore: false,
    spawnPoints: [
      // Level 2 mobs
      { type: 'mob', position: { x: 90, y: 2, z: 90 }, data: { type: 'hobgoblin', mobId: 'hobgoblin', spawnRadius: 6, maxCount: 2, respawnTime: 90000 } },
      { type: 'mob', position: { x: 110, y: 2, z: 100 }, data: { type: 'guard', mobId: 'guard', spawnRadius: 6, maxCount: 2, respawnTime: 90000 } },
      { type: 'mob', position: { x: 120, y: 2, z: 120 }, data: { type: 'dark_warrior', mobId: 'dark_warrior', spawnRadius: 6, maxCount: 2, respawnTime: 90000 } },
      // Limited resources
      { type: 'resource', position: { x: 100, y: 2, z: 130 }, data: { type: 'trees', name: 'Darkwood Trees', resourceId: 'darkwood_tree', respawnTime: 60000 } }
    ]
  },

  {
    id: 'zone_corrupted_ruins_main',
    name: 'Ancient Fortress Ruins',
    biome: 'corrupted_ruins',
    bounds: { x: -80, z: 60, width: 50, height: 50 },
    difficultyLevel: 2,
    isTown: false,
    hasBank: false,
    hasGeneralStore: false,
    spawnPoints: [
      // Fortress guards and hobgoblins
      { type: 'mob', position: { x: -70, y: 2, z: 70 }, data: { type: 'guard', mobId: 'guard', spawnRadius: 6, maxCount: 2, respawnTime: 120000 } },
      { type: 'mob', position: { x: -60, y: 2, z: 80 }, data: { type: 'guard', mobId: 'guard', spawnRadius: 6, maxCount: 2, respawnTime: 120000 } },
      { type: 'mob', position: { x: -50, y: 2, z: 90 }, data: { type: 'hobgoblin', mobId: 'hobgoblin', spawnRadius: 6, maxCount: 2, respawnTime: 120000 } }
    ]
  },

  // Level 3 Zones
  {
    id: 'zone_blasted_lands_main',
    name: 'Heart of Corruption',
    biome: 'blasted_lands',
    bounds: { x: 150, z: 150, width: 80, height: 80 },
    difficultyLevel: 3,
    isTown: false,
    hasBank: false,
    hasGeneralStore: false,
    spawnPoints: [
      // Elite enemies
      { type: 'mob', position: { x: 170, y: 2, z: 170 }, data: { type: 'black_knight', mobId: 'black_knight', spawnRadius: 8, maxCount: 1, respawnTime: 300000 } },
      { type: 'mob', position: { x: 190, y: 2, z: 180 }, data: { type: 'dark_ranger', mobId: 'dark_ranger', spawnRadius: 8, maxCount: 1, respawnTime: 300000 } },
      { type: 'mob', position: { x: 200, y: 2, z: 200 }, data: { type: 'black_knight', mobId: 'black_knight', spawnRadius: 8, maxCount: 1, respawnTime: 300000 } }
    ]
  },

  {
    id: 'zone_northern_reaches_ice_caves',
    name: 'Frozen Depths',
    biome: 'northern_reaches',
    bounds: { x: -150, z: 150, width: 70, height: 70 },
    difficultyLevel: 3,
    isTown: false,
    hasBank: false,
    hasGeneralStore: false,
    spawnPoints: [
      // Ice warriors in caves
      { type: 'mob', position: { x: -140, y: 2, z: 170 }, data: { type: 'ice_warrior', mobId: 'ice_warrior', spawnRadius: 8, maxCount: 1, respawnTime: 300000 } },
      { type: 'mob', position: { x: -120, y: 2, z: 180 }, data: { type: 'ice_warrior', mobId: 'ice_warrior', spawnRadius: 8, maxCount: 1, respawnTime: 300000 } },
      // Fishing spots in frozen lakes
      { type: 'resource', position: { x: -130, y: 2, z: 200 }, data: { type: 'fishing_spot', name: 'Frozen Lake', resourceId: 'ice_fishing_spot', respawnTime: 10000 } }
    ]
  },

  {
    id: 'zone_black_knight_fortress',
    name: 'Fortress of Darkness',
    biome: 'black_knight_fortress',
    bounds: { x: 180, z: -120, width: 60, height: 60 },
    difficultyLevel: 3,
    isTown: false,
    hasBank: false,
    hasGeneralStore: false,
    spawnPoints: [
      // Elite Black Knights
      { type: 'mob', position: { x: 200, y: 2, z: -100 }, data: { type: 'black_knight', mobId: 'black_knight', spawnRadius: 10, maxCount: 1, respawnTime: 600000 } },
      { type: 'mob', position: { x: 210, y: 2, z: -90 }, data: { type: 'black_knight', mobId: 'black_knight', spawnRadius: 10, maxCount: 1, respawnTime: 600000 } },
      { type: 'mob', position: { x: 220, y: 2, z: -80 }, data: { type: 'black_knight', mobId: 'black_knight', spawnRadius: 10, maxCount: 1, respawnTime: 600000 } }
    ]
  }
];

/**
 * Death and Respawn Mechanics per GDD
 */
// DeathLocationData and HeadstoneData are now imported from types/core

export function getNearestTown(position: { x: number; y: number; z: number }): ZoneData {
  let nearestTown = STARTER_TOWNS[0];
  let minDistance = Infinity;

  for (const town of STARTER_TOWNS) {
    const spawnPoint = town.spawnPoints.find(sp => sp.type === 'player');
    if (spawnPoint) {
      const distance = calculateDistance2D(position, spawnPoint.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestTown = town;
      }
    }
  }

  return nearestTown;
}

export function getRandomTown(): ZoneData {
  return STARTER_TOWNS[Math.floor(Math.random() * STARTER_TOWNS.length)];
}

export function getZoneByPosition(position: { x: number; z: number }): ZoneData | null {
  for (const zone of WORLD_ZONES) {
    const bounds = zone.bounds;
    if (
      position.x >= bounds.x &&
      position.x <= bounds.x + bounds.width &&
      position.z >= bounds.z &&
      position.z <= bounds.z + bounds.height
    ) {
      return zone;
    }
  }
  return null;
}

export function getZonesByDifficulty(level: 0 | 1 | 2 | 3): ZoneData[] {
  return WORLD_ZONES.filter(zone => zone.difficultyLevel === level);
}

export function isValidPlayerMovement(_from: { x: number; z: number }, _to: { x: number; z: number }): boolean {
  // Check if movement crosses water bodies or impassable terrain
  // For MVP, all land movement is valid
  return true;
}

export function getTerrainHeight(_x: number, _z: number): number {
  // Return ground level height for position
  // For MVP, return standard ground level
  return 2;
}

/**
 * World Constants per GDD
 */
export const WORLD_CONSTANTS = {
  GRID_SIZE: 4, // Block size for grid-based movement
  DEFAULT_SPAWN_HEIGHT: 2,
  WATER_LEVEL: 0,
  MAX_BUILD_HEIGHT: 100,
  SAFE_ZONE_RADIUS: 15, // Radius around starter towns with no hostile mobs
  RESPAWN_TIME: 30000, // 30 seconds respawn timer per GDD
  DEATH_ITEM_DESPAWN_TIME: 300000 // 5 minutes for items to despawn at death location
} as const;