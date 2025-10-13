/**
 * Content and state management types for Hyperscape plugin
 */

import { Action, Provider } from "@elizaos/core";
import { World, Vector3 } from "./core-types";
import { Position, ContentInstance } from "./core-types";

// RPG State Manager interface
export interface RPGStateManager {
  // Player state
  getPlayerState(playerId: string): PlayerState | null;
  updatePlayerState(playerId: string, updates: Partial<PlayerState>): void;

  // Inventory management
  getInventory(playerId: string): InventoryState;
  addItem(playerId: string, itemId: string, quantity: number): boolean;
  removeItem(playerId: string, itemId: string, quantity: number): boolean;

  // Combat state
  getCombatState(entityId: string): CombatState | null;
  updateCombatState(entityId: string, updates: Partial<CombatState>): void;

  // World state
  getWorldState(): WorldState;
  saveWorldState(): Promise<void>;
  loadWorldState(): Promise<void>;
}

// Player state
export interface PlayerState {
  id: string;
  name: string;
  level: number;
  experience: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  position: Position;
  stats: RPGPlayerStats;
  skills: Record<string, SkillInfo>;
}

// Player stats - renamed to avoid conflict with imported PlayerStats
export interface RPGPlayerStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  wisdom: number;
  charisma: number;
}

// Skill information
export interface SkillInfo {
  level: number;
  experience: number;
  maxExperience: number;
}

// Inventory state
export interface InventoryState {
  items: InventoryItem[];
  capacity: number;
  weight: number;
  maxWeight: number;
}

// Inventory item
export interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  slot?: number;
  equipped?: boolean;
  metadata?: Record<string, unknown>;
}

// Combat state
export interface CombatState {
  inCombat: boolean;
  target?: string;
  attackStyle?: "melee" | "ranged" | "magic";
  lastAttackTime?: number;
  combatStats: CombatStats;
}

// Combat stats
export interface CombatStats {
  attackPower: number;
  defense: number;
  criticalChance: number;
  criticalDamage: number;
  accuracy: number;
  evasion: number;
}

// World state
export interface WorldState {
  id: string;
  name: string;
  time: number;
  weather: WeatherState;
  entities: Map<string, EntityState>;
  resources: Map<string, ResourceState>;
}

// Weather state
export interface WeatherState {
  type: "clear" | "rain" | "snow" | "fog" | "storm";
  intensity: number;
  windDirection: number;
  windSpeed: number;
}

// Entity state
export interface EntityState {
  id: string;
  type: string;
  position: Position;
  health?: number;
  maxHealth?: number;
  behavior?: string;
  metadata?: Record<string, unknown>;
}

// Resource state
export interface ResourceState {
  id: string;
  type: string;
  position: Position;
  quantity: number;
  maxQuantity: number;
  respawnTime?: number;
  lastHarvestTime?: number;
}

// Content instance - using the one from core-types
// (removed duplicate definition)

// Entity modification data
export interface EntityModificationData {
  position?: Position;
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  velocity?: Position;
  health?: number;
  state?: string;
  metadata?: Record<string, unknown>;
}

// Teleport options
export interface TeleportOptions {
  position: Position;
  rotationY?: number;
  instant?: boolean;
}

// Physics options
export interface PhysicsBodyOptions {
  id?: string;
  position?: Position;
  mass?: number;
  friction?: number;
  restitution?: number;
  shape?: "box" | "sphere" | "capsule";
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
  };
}

// Character controller options
export interface CharacterControllerOptions {
  height?: number;
  radius?: number;
  stepHeight?: number;
  slopeLimit?: number;
  skinWidth?: number;
  minMoveDistance?: number;
  center?: { x: number; y: number; z: number };
  mass?: number;
  drag?: number;
  angularDrag?: number;
  useGravity?: boolean;
  isKinematic?: boolean;
}

// Physics body options
export interface PhysicsBodyOptions {
  type?: "static" | "dynamic" | "kinematic";
  mass?: number;
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  isTrigger?: boolean;
  lockRotation?: boolean;
}

// Teleport options
export interface TeleportOptions {
  position: Vector3;
  rotation?: { x: number; y: number; z: number; w: number };
  validatePosition?: boolean;
  fadeTransition?: boolean;
  fadeDuration?: number;
  checkCollisions?: boolean;
}

// Entity modification data
export interface EntityModificationData {
  position?: Vector3;
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  components?: Record<string, any>;
  metadata?: Record<string, unknown>;
  visible?: boolean;
  active?: boolean;
}
