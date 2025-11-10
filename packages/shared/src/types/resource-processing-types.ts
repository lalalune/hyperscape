/**
 * Resource and Processing Types
 * All resource gathering, skilling, fires, and processing action type definitions
 */

import THREE from "../extras/three";
import type { Position3D } from "./base-types";

// ============== RESOURCE TYPES ==============

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
  respawnTime: number; // Milliseconds
  isAvailable: boolean;
  lastDepleted: number;
  drops: Array<{
    itemId: string;
    quantity: number;
    chance: number; // 0-1
  }>;
}

/**
 * Resource drop - what a resource can drop when gathered
 */
export interface ResourceDrop {
  itemId: string;
  itemName: string;
  quantity: number;
  chance: number; // 0-1
  xpAmount: number;
  stackable: boolean;
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
 */
export interface ProcessingAction {
  playerId: string;
  actionType: "firemaking" | "cooking";
  primaryItem: { id: number; slot: number }; // Item being used (tinderbox/raw fish)
  targetItem?: { id: number; slot: number }; // Target item (logs/fire)
  targetFire?: string; // Fire ID for cooking
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
