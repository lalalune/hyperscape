/**
 * Terrain system constants
 */

export const TERRAIN_CONSTANTS = {
  // Tile configuration
  TILE_SIZE: 100,
  SEGMENTS_PER_TILE: 50,
  MAX_LOADED_TILES: 9, // 3x3 grid around player
  
  // World bounds
  WORLD_SIZE: 1000,
  WORLD_HALF_SIZE: 500,
  
  // Chunk system
  CHUNK_SIZE: 200,
  CHUNK_CACHE_TIME_MS: 15 * 60 * 1000, // 15 minutes
  CHUNK_SERIALIZATION_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes
  
  // Loading strategy
  CORE_CHUNK_RANGE: 1, // 3x3 grid
  RING_CHUNK_RANGE: 2, // Additional ring around core
  
  // Terrain generation
  HEIGHT_SCALE: 5,
  BASE_TERRAIN_SCALE: 0.01,
  DETAIL_TERRAIN_SCALE: 0.05,
  FINE_TERRAIN_SCALE: 0.1,
  
  // Update intervals
  PLAYER_MOVEMENT_CHECK_INTERVAL_MS: 100,
  TERRAIN_UPDATE_INTERVAL_MS: 0.1,
  
  // Biome noise
  BIOME_SCALE: 0.003,
  BIOME_NOISE_OCTAVES: 3,
  
  // Resources
  TREE_DENSITY: 0.02,
  ROCK_DENSITY: 0.01,
  RESOURCE_MIN_DISTANCE: 5,
  
  // Roads
  ROAD_WIDTH: 6,
  ROAD_SMOOTHING_RADIUS: 20,
  ROAD_VERTEX_INFLUENCE_RADIUS: 15,
  
  // Water
  WATER_THRESHOLD: -0.5,
  LAKE_MIN_SIZE: 10,
  
  // Performance
  MAX_RESOURCES_PER_TILE: 50,
  MAX_LAKES_PER_TILE: 5,
  
} as const;

// Biome configuration - mob types loaded from JSON manifests
// These just define biome properties, actual mob spawning uses world-areas.ts
export const BIOME_CONFIG = {
  'plains': {
    name: 'Plains',
    color: 0x90EE90,
    heightRange: [0, 2] as [number, number],
    terrainMultiplier: 0.5,
    waterLevel: -1,
    maxSlope: 0.5,
    mobTypes: [], // Loaded from manifests
    difficulty: 0,
    baseHeight: 0,
    heightVariation: 1,
    resourceDensity: 0.02,
    resourceTypes: ['tree', 'rock']
  },
  'forest': {
    name: 'Forest',
    color: 0x228B22,
    heightRange: [1, 4] as [number, number],
    terrainMultiplier: 0.7,
    waterLevel: -0.5,
    maxSlope: 0.7,
    mobTypes: [], // Loaded from manifests
    difficulty: 1,
    baseHeight: 1,
    heightVariation: 1.5,
    resourceDensity: 0.05,
    resourceTypes: ['tree', 'rock']
  },
  'mountains': {
    name: 'Mountains',
    color: 0x8B7355,
    heightRange: [3, 10] as [number, number],
    terrainMultiplier: 2,
    waterLevel: 1,
    maxSlope: 1.5,
    mobTypes: [], // Loaded from manifests
    difficulty: 2,
    baseHeight: 5,
    heightVariation: 3,
    resourceDensity: 0.03,
    resourceTypes: ['rock', 'ore']
  },
  'desert': {
    name: 'Desert',
    color: 0xEDC9AF,
    heightRange: [0, 1] as [number, number],
    terrainMultiplier: 0.3,
    waterLevel: -2,
    maxSlope: 0.3,
    mobTypes: [], // Loaded from manifests
    difficulty: 3,
    baseHeight: 0.5,
    heightVariation: 0.5,
    resourceDensity: 0.01,
    resourceTypes: ['rock']
  },
  'tundra': {
    name: 'Tundra',
    color: 0xB0C4DE,
    heightRange: [1, 3] as [number, number],
    terrainMultiplier: 0.6,
    waterLevel: 0,
    maxSlope: 0.6,
    mobTypes: [], // Loaded from manifests
    difficulty: 3,
    baseHeight: 1.5,
    heightVariation: 1,
    resourceDensity: 0.015,
    resourceTypes: ['rock', 'ice']
  }
} as const;

export type BiomeName = keyof typeof BIOME_CONFIG;