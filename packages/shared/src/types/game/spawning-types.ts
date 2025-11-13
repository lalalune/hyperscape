/**
 * Spawning Types
 * All spawn point, respawn, and spawner related type definitions
 */

import THREE from "../../extras/three/three";
import type { Position3D } from "../core/base-types";
import type { World } from "../../core/World";

// ============== SPAWN POINT TYPES ==============

/**
 * SpawnPoint - represents a location where NPCs/mobs can spawn
 */
export interface SpawnPoint {
  id: string;
  position: Position3D;
  npcId: number;
  maxCount: number;
  respawnTime: number;
  radius: number;
  active: boolean;
  currentCount: number;
  lastSpawnTime: number;
}

/**
 * RespawnTask - queued respawn task for an entity
 */
export interface RespawnTask {
  spawnerId: string;
  npcId: number;
  respawnTime: number;
  scheduledTime: number;
}

// ============== SPAWNER TYPES ==============

/**
 * Spawner - advanced spawner with conditional spawning logic
 */
export interface Spawner {
  id: string;
  position: Position3D;
  conditions?: SpawnConditions;
  activationRange: number;
}

/**
 * SpawnConditions - conditions that must be met for spawning to occur
 */
export interface SpawnConditions {
  // Time-based conditions
  timeOfDay?: {
    start: number; // 0-24
    end: number;
  };

  // Player conditions
  minPlayers?: number;
  maxPlayers?: number;
  playerLevel?: {
    min: number;
    max: number;
  };

  // Custom conditions
  customCondition?: (spawner: Spawner, world: World) => boolean;
}

// Note: PlayerSpawnData is defined in player-types.ts since it's player-specific data
