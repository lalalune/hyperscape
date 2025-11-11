/**
 * Game Types - Game systems and entity types
 *
 * Contains TypeScript types for game systems, entities, and gameplay logic.
 * These types are used throughout the server for game state management,
 * player interactions, and world simulation.
 *
 * **Type Categories**:
 * - World configuration (SpawnData, WorldOptions)
 * - Game systems (TerrainSystem, ResourceSystem, InventorySystemData)
 * - Player entities (PlayerEntity)
 * - Server statistics (ServerStats)
 * - Chat system (ChatMessage)
 *
 * **Referenced by**: Game systems, handlers, API routes
 */

import type { Entity } from "@hyperscape/shared";

// Re-export WorldOptions from shared
export type { WorldOptions } from "@hyperscape/shared";

// ============================================================================
// WORLD CONFIGURATION
// ============================================================================

/**
 * Player spawn point data (position and rotation)
 *
 * Defines where players spawn when entering the world or respawning.
 */
export interface SpawnData {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

// ============================================================================
// GAME SYSTEMS
// ============================================================================

/**
 * Terrain system interface for height queries
 *
 * Provides terrain height information for player movement,
 * pathfinding, and object placement.
 */
export type TerrainSystem = {
  getHeightAt: (x: number, z: number) => number;
  isReady: () => boolean;
};

/**
 * Resource entity (tree, rock, etc.) for gathering systems
 *
 * Represents harvestable resources in the world with respawn logic.
 */
export interface ResourceEntity {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  isAvailable: boolean;
  lastDepleted?: number;
  respawnTime?: number;
}

/**
 * Resource system interface
 *
 * Manages resource entities in the world (trees, rocks, fishing spots).
 */
export interface ResourceSystem {
  getAllResources?: () => ResourceEntity[];
}

/**
 * Inventory system data interface
 *
 * Provides access to player inventory data and item management.
 */
export interface InventorySystemData {
  getInventoryData?: (playerId: string) => {
    items: unknown[];
    coins: number;
    maxSlots: number;
  };
}

// ============================================================================
// PLAYER ENTITIES
// ============================================================================

/**
 * Player entity with server-specific properties
 *
 * Extends the base Entity type with player-specific data and methods.
 */
export type PlayerEntity = Entity & {
  data: {
    id: string;
    userId?: string;
    [key: string]: unknown;
  };
  serialize: () => unknown;
};

// ============================================================================
// SERVER STATISTICS
// ============================================================================

/**
 * Server performance statistics
 *
 * Contains real-time metrics about server resource usage.
 */
export interface ServerStats {
  currentCPU: number;
  currentMemory: number;
  maxMemory: number;
}

// ============================================================================
// CHAT SYSTEM
// ============================================================================

/**
 * Chat message data structure
 *
 * Represents a chat message sent by a player in the game world.
 */
export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  channel?: string;
}
