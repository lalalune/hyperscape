/**
 * Game-related type definitions
 * 
 * Shared types for game mechanics and data
 */

import THREE from '../extras/three'
import type { Item, Player } from './core'
import type { ItemRarity } from './entities'

// Storage-related types used by systems and data layer
export interface StorageSlot {
  id: string;
  itemId: string;
  quantity: number;
  metadata?: Record<string, string | number | boolean> | null;
  slotIndex?: number;
}

// Loot and item spawning interfaces
export interface LootItem extends Item {
  quantity: number
  rarity: ItemRarity
}

export interface ItemSpawnerStats {
  totalItems: number
  shopItems: number
  treasureItems: number
  chestItems: number
  resourceItems: number
  lootItems: number
  byType: Record<string, number>
  byLocation?: Record<string, number>
  spawnedItems?: number
}

// Movement and testing interfaces
export interface PlayerWithProxy extends Player {
  visualProxy?: THREE.Object3D
}

// Network entity interface for multiplayer
export interface NetworkEntity {
  id?: string
  position?: unknown
  rotation?: unknown
  velocity?: unknown
  serialize?: () => Record<string, unknown>
}

// AI Navigation shared types
export interface NavigationNode {
  x: number;
  z: number;
  y: number; // Height at this position
  walkable: boolean;
  slope: number;
  biome: string;
  cost: number; // Movement cost multiplier
  neighbors: NavigationNode[];
  parent?: NavigationNode; // For pathfinding
  gScore: number; // Distance from start
  hScore: number; // Heuristic distance to goal
  fScore: number; // gScore + hScore
}

export interface PathfindingRequest {
  id: string;
  agentId: string;
  start: { x: number; z: number };
  goal: { x: number; z: number };
  agentSize: number;
  maxSlope: number;
  allowedBiomes?: string[];
  priority: 'low' | 'normal' | 'high';
  callback: (path: PathResult | null) => void;
}

export interface PathResult {
  success: boolean;
  path: { x: number; y: number; z: number }[];
  totalDistance: number;
  estimatedTime: number;
  errorMessage?: string;
}

export interface AgentNavigationState {
  agentId: string;
  position: { x: number; y: number; z: number }
  targetPosition: { x: number; y: number; z: number }
  currentPath: { x: number; y: number; z: number }[];
  pathIndex: number;
  speed: number;
  size: number;
  maxSlope: number;
  isMoving: boolean;
  isStuck: boolean;
  stuckTimer: number;
  lastValidPosition: { x: number; y: number; z: number }
}