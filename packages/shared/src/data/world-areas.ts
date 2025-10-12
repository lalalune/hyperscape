/**
 * World Areas and Biomes - GDD Implementation
 * Defines all world locations, biomes, spawn points, and positioned NPCs
 */

import type {
  WorldPosition,
  BiomeResource,
  NPCLocation,
  MobSpawnPoint,
  WorldArea
} from '../types/core';

// Re-export types from core
export type { WorldArea, BiomeResource, NPCLocation, MobSpawnPoint } from '../types/core';

/**
 * Starter Towns (Safe Zones)
 */
export const STARTER_TOWNS: Record<string, WorldArea> = {
  lumbridge: {
    id: 'lumbridge',
    name: 'Lumbridge',
    description: 'A peaceful starting town by the river, protected by ancient wards.',
    difficultyLevel: 0,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    biomeType: 'starter_town',
    safeZone: true,
    npcs: [
      {
        id: 'lumbridge_banker',
        name: 'Bank Clerk Harold',
        type: 'bank',
        position: { x: 5, y: 0, z: 5 },
        services: ['banking', 'item_storage'],
        // modelPath: '/assets/models/npcs/bank_clerk.glb', // TODO: Generate in 3D Asset Forge
        description: 'A helpful bank clerk who manages the town vault.'
      },
      {
        id: 'lumbridge_shopkeeper',
        name: 'General Store Owner Mara',
        type: 'general_store',
        position: { x: -8, y: 0, z: 10 },
        services: ['buy_items', 'sell_items'],
        // modelPath: '/assets/models/npcs/shopkeeper.glb', // TODO: Generate in 3D Asset Forge
        description: 'Sells basic tools and supplies for new adventurers.'
      }
    ],
    resources: [
      {
        type: 'tree',
        position: { x: 15, y: 0, z: -10 },
        resourceId: 'logs',
        respawnTime: 60000,
        level: 1
      },
      {
        type: 'fishing_spot',
        position: { x: 18, y: 0, z: 15 },
        resourceId: 'raw_shrimps',
        respawnTime: 30000,
        level: 1
      }
    ],
    mobSpawns: [
      // Add some weak mobs near spawn for testing/tutorial
      {
        mobId: 'goblin',
        position: { x: 10, y: 0, z: 10 },
        spawnRadius: 3,
        maxCount: 2,
        respawnTime: 300000 // 5 minutes
      },
      {
        mobId: 'goblin',
        position: { x: -10, y: 0, z: -10 },
        spawnRadius: 3,
        maxCount: 2,
        respawnTime: 300000
      }
    ],
    connections: ['mistwood_valley', 'northern_plains'],
    specialFeatures: ['tutorial_area', 'spawn_point_1']
  },

  draynor: {
    id: 'draynor',
    name: 'Draynor Village',
    description: 'A small farming community nestled between marshlands and plains.',
    difficultyLevel: 0,
    bounds: { minX: 80, maxX: 120, minZ: -20, maxZ: 20 },
    biomeType: 'starter_town',
    safeZone: true,
    npcs: [
      {
        id: 'draynor_banker',
        name: 'Bank Clerk Niles',
        type: 'bank',
        position: { x: 95, y: 0, z: 5 },
        services: ['banking', 'item_storage'],
        // modelPath: '/assets/models/npcs/bank_clerk.glb', // TODO: Generate in 3D Asset Forge
        description: 'Guards the village treasury with diligence.'
      },
      {
        id: 'draynor_shopkeeper',
        name: 'Merchant Willem',
        type: 'general_store',
        position: { x: 105, y: 0, z: -8 },
        services: ['buy_items', 'sell_items'],
        // modelPath: '/assets/models/npcs/shopkeeper.glb', // TODO: Generate in 3D Asset Forge
        description: 'A traveling merchant who settled in this quiet village.'
      }
    ],
    resources: [
      {
        type: 'tree',
        position: { x: 85, y: 0, z: 12 },
        resourceId: 'willow_logs',
        respawnTime: 120000,
        level: 20
      },
      {
        type: 'fishing_spot',
        position: { x: 115, y: 0, z: 18 },
        resourceId: 'raw_trout',
        respawnTime: 90000,
        level: 20
      }
    ],
    mobSpawns: [],
    connections: ['goblin_wastes', 'northern_plains'],
    specialFeatures: ['willow_grove', 'spawn_point_2']
  },

  falador: {
    id: 'falador',
    name: 'Falador',
    description: 'A fortified city that serves as a major trading hub.',
    difficultyLevel: 0,
    bounds: { minX: -120, maxX: -80, minZ: 80, maxZ: 120 },
    biomeType: 'starter_town',
    safeZone: true,
    npcs: [
      {
        id: 'falador_banker',
        name: 'Master Banker Gregorian',
        type: 'bank',
        position: { x: -95, y: 0, z: 95 },
        services: ['banking', 'item_storage'],
        // modelPath: '/assets/models/npcs/bank_clerk.glb', // TODO: Generate in 3D Asset Forge
        description: 'The most experienced banker in the kingdom.'
      },
      {
        id: 'falador_shopkeeper',
        name: 'Arms Dealer Thorek',
        type: 'general_store',
        position: { x: -110, y: 0, z: 105 },
        services: ['buy_items', 'sell_items'],
        // modelPath: '/assets/models/npcs/shopkeeper.glb', // TODO: Generate in 3D Asset Forge
        description: 'Specializes in weapons and armor for adventurers.'
      }
    ],
    resources: [
      {
        type: 'tree',
        position: { x: -85, y: 0, z: 85 },
        resourceId: 'oak_logs',
        respawnTime: 90000,
        level: 10
      },
      {
        type: 'fishing_spot',
        position: { x: -115, y: 0, z: 115 },
        resourceId: 'raw_salmon',
        respawnTime: 150000,
        level: 30
      }
    ],
    mobSpawns: [],
    connections: ['darkwood_forest', 'northern_plains'],
    specialFeatures: ['trading_center', 'spawn_point_3']
  }
};

/**
 * Level 1 Difficulty Areas (Beginner Combat)
 */
export const LEVEL_1_AREAS: Record<string, WorldArea> = {
  mistwood_valley: {
    id: 'mistwood_valley',
    name: 'Mistwood Valley',
    description: 'Foggy forests with goblin camps scattered throughout the misty undergrowth.',
    difficultyLevel: 1,
    bounds: { minX: 20, maxX: 80, minZ: -80, maxZ: -20 },
    biomeType: 'misty_forest',
    safeZone: false,
    npcs: [],
    resources: [
      {
        type: 'tree',
        position: { x: 35, y: 0, z: -45 },
        resourceId: 'logs',
        respawnTime: 60000,
        level: 1
      },
      {
        type: 'tree',
        position: { x: 55, y: 0, z: -65 },
        resourceId: 'logs',
        respawnTime: 60000,
        level: 1
      },
      {
        type: 'tree',
        position: { x: 70, y: 0, z: -30 },
        resourceId: 'oak_logs',
        respawnTime: 90000,
        level: 10
      }
    ],
    mobSpawns: [
      {
        mobId: 'goblin',
        position: { x: 40, y: 0, z: -50 },
        spawnRadius: 5,
        maxCount: 3,
        respawnTime: 900000
      },
      {
        mobId: 'goblin',
        position: { x: 60, y: 0, z: -40 },
        spawnRadius: 4,
        maxCount: 2,
        respawnTime: 900000
      },
      {
        mobId: 'bandit',
        position: { x: 25, y: 0, z: -70 },
        spawnRadius: 6,
        maxCount: 2,
        respawnTime: 900000
      }
    ],
    connections: ['lumbridge', 'goblin_wastes'],
    specialFeatures: ['foggy_atmosphere', 'goblin_camps']
  },

  goblin_wastes: {
    id: 'goblin_wastes',
    name: 'Goblin Wastes',
    description: 'Barren lands dominated by goblin tribes and desperate bandits.',
    difficultyLevel: 1,
    bounds: { minX: 80, maxX: 160, minZ: -80, maxZ: 40 },
    biomeType: 'wasteland',
    safeZone: false,
    npcs: [],
    resources: [
      {
        type: 'tree',
        position: { x: 90, y: 0, z: -20 },
        resourceId: 'logs',
        respawnTime: 60000,
        level: 1
      },
      {
        type: 'fishing_spot',
        position: { x: 145, y: 0, z: 25 },
        resourceId: 'raw_sardine',
        respawnTime: 60000,
        level: 5
      }
    ],
    mobSpawns: [
      {
        mobId: 'goblin',
        position: { x: 100, y: 0, z: -30 },
        spawnRadius: 8,
        maxCount: 4,
        respawnTime: 900000
      },
      {
        mobId: 'goblin',
        position: { x: 130, y: 0, z: 10 },
        spawnRadius: 6,
        maxCount: 3,
        respawnTime: 900000
      },
      {
        mobId: 'bandit',
        position: { x: 110, y: 0, z: -60 },
        spawnRadius: 5,
        maxCount: 2,
        respawnTime: 900000
      },
      {
        mobId: 'barbarian',
        position: { x: 150, y: 0, z: -40 },
        spawnRadius: 7,
        maxCount: 2,
        respawnTime: 900000
      }
    ],
    connections: ['mistwood_valley', 'draynor', 'darkwood_forest'],
    specialFeatures: ['goblin_stronghold', 'bandit_camps']
  },

  northern_plains: {
    id: 'northern_plains',
    name: 'Northern Plains',
    description: 'General purpose areas with roads connecting major settlements.',
    difficultyLevel: 1,
    bounds: { minX: -80, maxX: 80, minZ: 20, maxZ: 80 },
    biomeType: 'plains',
    safeZone: false,
    npcs: [],
    resources: [
      {
        type: 'tree',
        position: { x: -20, y: 0, z: 40 },
        resourceId: 'logs',
        respawnTime: 60000,
        level: 1
      },
      {
        type: 'tree',
        position: { x: 30, y: 0, z: 60 },
        resourceId: 'oak_logs',
        respawnTime: 90000,
        level: 10
      },
      {
        type: 'fishing_spot',
        position: { x: 0, y: 0, z: 75 },
        resourceId: 'raw_trout',
        respawnTime: 90000,
        level: 20
      }
    ],
    mobSpawns: [
      {
        mobId: 'bandit',
        position: { x: -40, y: 0, z: 50 },
        spawnRadius: 6,
        maxCount: 2,
        respawnTime: 900000
      },
      {
        mobId: 'barbarian',
        position: { x: 50, y: 0, z: 35 },
        spawnRadius: 8,
        maxCount: 3,
        respawnTime: 900000
      }
    ],
    connections: ['lumbridge', 'draynor', 'falador', 'darkwood_forest'],
    specialFeatures: ['trade_roads', 'river_crossing']
  }
};

/**
 * Level 2 Difficulty Areas (Intermediate Combat)
 */
export const LEVEL_2_AREAS: Record<string, WorldArea> = {
  darkwood_forest: {
    id: 'darkwood_forest',
    name: 'Darkwood Forest',
    description: 'Dense, shadowy woods hiding dark warriors and corrupted guards.',
    difficultyLevel: 2,
    bounds: { minX: -160, maxX: -80, minZ: -40, maxZ: 80 },
    biomeType: 'dark_forest',
    safeZone: false,
    npcs: [],
    resources: [
      {
        type: 'tree',
        position: { x: -120, y: 0, z: 20 },
        resourceId: 'oak_logs',
        respawnTime: 90000,
        level: 10
      },
      {
        type: 'tree',
        position: { x: -140, y: 0, z: -20 },
        resourceId: 'willow_logs',
        respawnTime: 120000,
        level: 20
      },
      {
        type: 'fishing_spot',
        position: { x: -100, y: 0, z: 60 },
        resourceId: 'raw_salmon',
        respawnTime: 150000,
        level: 30
      }
    ],
    mobSpawns: [
      {
        mobId: 'hobgoblin',
        position: { x: -110, y: 0, z: 10 },
        spawnRadius: 8,
        maxCount: 3,
        respawnTime: 900000
      },
      {
        mobId: 'guard',
        position: { x: -130, y: 0, z: 40 },
        spawnRadius: 6,
        maxCount: 2,
        respawnTime: 900000
      },
      {
        mobId: 'dark_warrior',
        position: { x: -150, y: 0, z: -10 },
        spawnRadius: 10,
        maxCount: 2,
        respawnTime: 900000
      }
    ],
    connections: ['northern_plains', 'falador', 'corrupted_ruins'],
    specialFeatures: ['shadow_groves', 'abandoned_shrines']
  },

  corrupted_ruins: {
    id: 'corrupted_ruins',
    name: 'Corrupted Ruins',
    description: 'Ancient fortresses now serving dark masters, patrolled by corrupted guards.',
    difficultyLevel: 2,
    bounds: { minX: -200, maxX: -160, minZ: 40, maxZ: 120 },
    biomeType: 'ruins',
    safeZone: false,
    npcs: [],
    resources: [
      {
        type: 'tree',
        position: { x: -180, y: 0, z: 70 },
        resourceId: 'willow_logs',
        respawnTime: 120000,
        level: 20
      }
    ],
    mobSpawns: [
      {
        mobId: 'hobgoblin',
        position: { x: -180, y: 0, z: 80 },
        spawnRadius: 10,
        maxCount: 4,
        respawnTime: 900000
      },
      {
        mobId: 'guard',
        position: { x: -190, y: 0, z: 60 },
        spawnRadius: 8,
        maxCount: 3,
        respawnTime: 900000
      },
      {
        mobId: 'guard',
        position: { x: -170, y: 0, z: 100 },
        spawnRadius: 6,
        maxCount: 2,
        respawnTime: 900000
      }
    ],
    connections: ['darkwood_forest'],
    specialFeatures: ['ancient_fortress', 'corrupted_altars']
  }
};

/**
 * Level 3 Difficulty Areas (Advanced Combat)
 */
export const LEVEL_3_AREAS: Record<string, WorldArea> = {
  northern_reaches: {
    id: 'northern_reaches',
    name: 'Northern Reaches',
    description: 'Frozen tundra with ice caves hiding ancient warriors of Valorhall.',
    difficultyLevel: 3,
    bounds: { minX: -80, maxX: 80, minZ: 120, maxZ: 200 },
    biomeType: 'frozen_tundra',
    safeZone: false,
    npcs: [],
    resources: [
      {
        type: 'fishing_spot',
        position: { x: 0, y: 0, z: 160 },
        resourceId: 'raw_salmon',
        respawnTime: 150000,
        level: 30
      }
    ],
    mobSpawns: [
      {
        mobId: 'ice_warrior',
        position: { x: -20, y: 0, z: 140 },
        spawnRadius: 12,
        maxCount: 2,
        respawnTime: 900000
      },
      {
        mobId: 'ice_warrior',
        position: { x: 40, y: 0, z: 180 },
        spawnRadius: 10,
        maxCount: 1,
        respawnTime: 900000
      }
    ],
    connections: [],
    specialFeatures: ['ice_caves', 'frozen_lakes', 'valorhall_treasures']
  },

  blasted_lands: {
    id: 'blasted_lands',
    name: 'Blasted Lands',
    description: 'Desolate areas corrupted by dark magic, home to the most dangerous enemies.',
    difficultyLevel: 3,
    bounds: { minX: 160, maxX: 240, minZ: -120, maxZ: 40 },
    biomeType: 'corrupted_wasteland',
    safeZone: false,
    npcs: [],
    resources: [], // No resources in this hostile area
    mobSpawns: [
      {
        mobId: 'dark_ranger',
        position: { x: 180, y: 0, z: -60 },
        spawnRadius: 15,
        maxCount: 2,
        respawnTime: 900000
      },
      {
        mobId: 'black_knight',
        position: { x: 220, y: 0, z: -20 },
        spawnRadius: 12,
        maxCount: 1,
        respawnTime: 900000
      },
      {
        mobId: 'dark_ranger',
        position: { x: 200, y: 0, z: 10 },
        spawnRadius: 10,
        maxCount: 1,
        respawnTime: 900000
      }
    ],
    connections: ['black_knight_fortress'],
    specialFeatures: ['corrupted_magic', 'dark_energy_vortex']
  },

  black_knight_fortress: {
    id: 'black_knight_fortress',
    name: 'Black Knight Fortress',
    description: 'Dark strongholds where the most feared Black Knights gather.',
    difficultyLevel: 3,
    bounds: { minX: 200, maxX: 260, minZ: 40, maxZ: 100 },
    biomeType: 'dark_fortress',
    safeZone: false,
    npcs: [],
    resources: [], // No resources - pure combat zone
    mobSpawns: [
      {
        mobId: 'black_knight',
        position: { x: 230, y: 0, z: 70 },
        spawnRadius: 15,
        maxCount: 3,
        respawnTime: 900000
      },
      {
        mobId: 'black_knight',
        position: { x: 210, y: 0, z: 60 },
        spawnRadius: 8,
        maxCount: 1,
        respawnTime: 900000
      }
    ],
    connections: ['blasted_lands'],
    specialFeatures: ['black_knight_castle', 'dark_throne_room']
  }
};

/**
 * Complete World Database
 */
export const ALL_WORLD_AREAS: Record<string, WorldArea> = {
  ...STARTER_TOWNS,
  ...LEVEL_1_AREAS,
  ...LEVEL_2_AREAS,
  ...LEVEL_3_AREAS
};

/**
 * Helper Functions
 */
export function getAreaById(areaId: string): WorldArea | null {
  return ALL_WORLD_AREAS[areaId] || null;
}

export function getAreasByDifficulty(level: 0 | 1 | 2 | 3): WorldArea[] {
  return Object.values(ALL_WORLD_AREAS).filter(area => area.difficultyLevel === level);
}

export function getSafeZones(): WorldArea[] {
  return Object.values(ALL_WORLD_AREAS).filter(area => area.safeZone);
}

export function getConnectedAreas(areaId: string): WorldArea[] {
  const area = getAreaById(areaId);
  if (!area) return [];
  
  return area.connections
    .map(id => getAreaById(id))
    .filter(area => area !== null) as WorldArea[];
}

export function getNPCsInArea(areaId: string): NPCLocation[] {
  const area = getAreaById(areaId);
  return area ? area.npcs : [];
}

export function getResourcesInArea(areaId: string): BiomeResource[] {
  const area = getAreaById(areaId);
  return area ? area.resources : [];
}

export function getMobSpawnsInArea(areaId: string): MobSpawnPoint[] {
  const area = getAreaById(areaId);
  return area ? area.mobSpawns : [];
}

/**
 * Player Spawn Points for Random Assignment
 */
export const PLAYER_SPAWN_POINTS: WorldPosition[] = [
  { x: 0, y: 0, z: 0 },     // Lumbridge center - Y will be grounded to terrain
  { x: 100, y: 0, z: 0 },   // Draynor center - Y will be grounded to terrain
  { x: -100, y: 0, z: 100 } // Falador center - Y will be grounded to terrain
];

export function getRandomSpawnPoint(): WorldPosition {
  const index = Math.floor(Math.random() * PLAYER_SPAWN_POINTS.length);
  return { ...PLAYER_SPAWN_POINTS[index] };
}

/**
 * World Generation Constants
 */
export const WORLD_CONSTANTS = {
  TOTAL_WORLD_SIZE: 500, // 500x500 meter world
  SAFE_ZONE_RADIUS: 25,  // 25 meter radius around spawn points
  RESOURCE_RESPAWN_VARIANCE: 0.2, // ±20% respawn time variance
  MOB_SPAWN_CHECK_RADIUS: 5, // Don't spawn mobs within 5m of players
  AREA_TRANSITION_OVERLAP: 5, // 5 meter overlap between adjacent areas
} as const;