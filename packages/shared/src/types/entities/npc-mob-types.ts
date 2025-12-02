/**
 * NPC and Mob Types
 * All NPC (non-player character) and Mob (hostile entity) related type definitions
 */

import type { Position3D } from "../core/base-types";
import type { AttackType } from "../game/item-types";
import type { NPCComponent, MeshUserData } from "./entity-types";
import type { CombatTarget } from "../game/combat-types";

// Temporary imports from core.ts - will be updated when those modules are created
import type { LootEntry } from "../core/core";

// Re-export types that are defined elsewhere but conceptually belong to NPC/Mob system
export type { NPCComponent, MeshUserData, CombatTarget };

// ============== NPC & MOB ENUMS ==============

/**
 * NPC Behavior types
 */
export enum NPCBehavior {
  AGGRESSIVE = "aggressive",
  DEFENSIVE = "defensive",
  PASSIVE = "passive",
  FRIENDLY = "friendly",
  PATROL = "patrol",
  WANDER = "wander",
}

/**
 * NPC State types
 */
export enum NPCState {
  IDLE = "idle",
  WANDERING = "wandering",
  CHASING = "chasing",
  COMBAT = "combat",
  ATTACKING = "attacking",
  FLEEING = "fleeing",
  PATROLLING = "patrolling",
}

/**
 * NPC Category Classification
 * All characters in the game are NPCs, categorized by behavior:
 * - 'mob': Combat NPCs (goblins, bandits, guards) - aggressive entities
 * - 'boss': Powerful special combat encounters - unique bosses
 * - 'neutral': Non-combat NPCs (shopkeepers, bank clerks)
 * - 'quest': Quest-related NPCs (quest givers, quest objectives)
 */
export type NPCCategory = "mob" | "boss" | "neutral" | "quest";

/**
 * Mob AI State type
 */
export type MobAIStateType =
  | "idle"
  | "patrol"
  | "chase"
  | "attack"
  | "flee"
  | "dead"
  | "combat"
  | "returning";

// ============== SIMPLE NPC/MOB INTERFACES ==============

/**
 * Simple Mob interface - basic mob representation
 */
export interface Mob {
  id: string;
  name: string;
  type: string; // Mob ID from mobs.json
  level: number;
  position: Position3D;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  lootTable: string[];
  respawnTime: number;
  aggroRange: number;
}

/**
 * Simple NPC interface - basic NPC representation
 */
export interface NPC {
  id: string;
  name: string;
  type: string;
  position: Position3D;
  dialogue: string[];
  shopItems: string[];
  questIds: string[];
}

// ============== NPC COMPONENT (ECS) ==============
// NPCComponent is defined in entity-types.ts and re-exported above

// ============== MOB AI AND STATE ==============

/**
 * Mob entity data - used for mob data retrieval
 */
export interface MobEntityData {
  id: string;
  name: string;
  type: string; // Mob ID from mobs.json
  level: number;
  health: number;
  maxHealth: number;
  attack: number; // Attack level for accuracy
  attackPower: number; // Strength-based, for max hit
  defense: number;
  attackSpeedTicks: number; // Game ticks between attacks (1 tick = 600ms)
  xpReward: number;
  aiState: "idle" | "wander" | "chase" | "attack" | "return" | "dead";
  targetPlayerId: string | null;
  spawnPoint: Position3D;
  position: Position3D;
}

/**
 * Mob AI State Data - comprehensive AI state tracking
 */
export interface MobAIStateData {
  mobId: string;
  type: string; // Mob ID from mobs.json
  state: MobAIStateType;
  targetId: string | null;
  lastStateChange: number;
  patrolPath: Position3D[];
  patrolIndex: number;
  behavior: "aggressive" | "passive";
  lastAction: number;
  isInCombat: boolean;
  currentTarget: string | null;
  aggroTargets: Map<string, AggroTarget>;
  combatCooldown: number;
  lastAttack: number;
  homePosition: Position3D;
  currentPosition: Position3D;
  isPatrolling: boolean;
  isChasing: boolean;
  detectionRange: number;
  leashRange: number;
  chaseSpeed: number;
  patrolRadius: number;
  patrolTarget: Position3D | null;
  combatTarget: CombatTarget | null;
  levelIgnore: number;
}

/**
 * Aggro Target - tracks player aggro levels
 */
export interface AggroTarget {
  playerId: string;
  aggroLevel: number;
  lastDamageTime: number;
  lastSeen: number;
  distance: number;
  inRange: boolean;
}

// CombatTarget is defined in combat-types.ts and re-exported above

// ============== DROP SYSTEM ==============

/**
 * RuneScape-style Drop Rarity Tiers
 */
export type DropRarity =
  | "always"
  | "common"
  | "uncommon"
  | "rare"
  | "very_rare";

/**
 * Drop Table Entry - RuneScape-style loot system
 */
export interface DropTableEntry {
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  chance: number; // 0-1 probability (1 = 100%, 0.01 = 1%)
  rarity: DropRarity;
  noted?: boolean; // Whether item drops in noted form
}

/**
 * Default Drops Configuration
 * Every NPC type has a default drop (bones, ashes, etc.)
 */
export interface DefaultDropConfig {
  itemId: string; // e.g., 'bones', 'big_bones', 'dragon_bones', 'ashes'
  quantity: number;
  enabled: boolean; // Flag to disable default drop if needed
}

// ============== UNIFIED NPC DATA STRUCTURE ==============

/**
 * NPCDataInput - Used for JSON input where most fields are optional
 * DataManager.normalizeNPC() converts this to full NPCData with all defaults filled in
 *
 * Only core identity fields (id, name, description, category) are required.
 * All other fields will be filled with sensible defaults by normalizeNPC().
 */
export interface NPCDataInput {
  // REQUIRED - Core identity
  id: string;
  name: string;
  description: string;
  category: NPCCategory;

  // OPTIONAL - Will be filled with defaults by normalizeNPC()
  faction?: string;
  stats?: Partial<NPCStats>;
  combat?: Partial<NPCCombatConfig>;
  movement?: Partial<NPCMovementConfig>;
  drops?: Partial<NPCDrops>;
  services?: Partial<NPCServicesConfig>;
  behavior?: Partial<NPCBehaviorConfig>;
  appearance?: Partial<NPCAppearanceConfig>;
  position?: Position3D;
  spawnBiomes?: string[];
  dialogue?: NPCDialogueTree;
}

/**
 * NPC Stats - Unified across all NPCs
 * Note: In OSRS, monster "hitpoints" IS the max HP directly (no multiplication).
 * The `health` field is the hitpoints level AND max HP (1:1 ratio).
 */
export interface NPCStats {
  level: number;
  health: number; // This IS the hitpoints level AND max HP (OSRS style)
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  magic: number;
}

/**
 * NPC Combat Configuration - All NPCs can potentially fight
 */
export interface NPCCombatConfig {
  attackable: boolean; // Can players attack this NPC?
  aggressive: boolean; // Does NPC attack players on sight?
  retaliates: boolean; // Fights back when attacked?
  aggroRange: number; // Detection range (0 = non-aggressive)
  combatRange: number; // Attack range
  attackSpeedTicks: number; // Game ticks between attacks (4 = standard sword, 600ms/tick)
  respawnTime: number; // Milliseconds to respawn
  xpReward: number; // XP rewarded on kill
  poisonous: boolean; // Can poison players?
  immuneToPoison: boolean; // Immune to poison damage?
}

/**
 * NPC Movement Configuration
 */
export interface NPCMovementConfig {
  type: "stationary" | "wander" | "patrol";
  speed: number;
  wanderRadius: number; // Radius for wander behavior
  patrolPath?: Position3D[]; // Waypoints for patrol behavior
  roaming: boolean; // Can leave spawn area?
}

/**
 * NPC Drops - RuneScape-style tiered drop system
 * ALL NPCs drop something (at minimum, bones/ashes)
 */
export interface NPCDrops {
  defaultDrop: DefaultDropConfig; // Always drops (bones, ashes, etc.)
  always: DropTableEntry[]; // 100% drop rate items
  common: DropTableEntry[]; // Common drops (1/4 - 1/10)
  uncommon: DropTableEntry[]; // Uncommon drops (1/10 - 1/50)
  rare: DropTableEntry[]; // Rare drops (1/50 - 1/500)
  veryRare: DropTableEntry[]; // Very rare drops (1/500+)
  rareDropTable: boolean; // Access to rare drop table?
  rareDropTableChance?: number; // Chance to roll RDT (if enabled)
}

/**
 * NPC Services Configuration
 */
export interface NPCServicesConfig {
  enabled: boolean;
  types: ("bank" | "shop" | "quest" | "skill_trainer" | "teleport")[];
  shopInventory?: Array<{
    itemId: string;
    quantity: number;
    price: number;
    stockRefreshTime?: number;
  }>;
  questIds?: string[]; // Quest IDs this NPC is involved in
}

/**
 * NPC Dialogue Response - A single response option in a dialogue node
 * Note: Uses string-based conditions/effects for JSON serialization (vs function-based DialogueOption)
 */
export interface NPCDialogueResponse {
  text: string; // Display text for this response option
  nextNodeId: string; // ID of the next dialogue node
  condition?: string; // Optional condition (e.g., "hasItem:coins:100")
  effect?: string; // Optional effect when selected (e.g., "openBank", "startQuest:goblin_slayer")
}

/**
 * NPC Dialogue Node - A single node in a dialogue tree
 * Note: Data-only for JSON serialization (vs function-based DialogueNode in animation-dialogue-types)
 */
export interface NPCDialogueNode {
  id: string; // Unique identifier for this node
  text: string; // NPC's dialogue text
  responses?: NPCDialogueResponse[]; // Player response options (if empty, dialogue ends)
}

/**
 * NPC Dialogue Tree - Full conversation tree for an NPC
 */
export interface NPCDialogueTree {
  entryNodeId: string; // Starting node ID
  nodes: NPCDialogueNode[]; // All dialogue nodes
}

/**
 * NPC Behavior AI Configuration
 */
export interface NPCBehaviorConfig {
  enabled: boolean;
  config?: unknown; // Complex behavior tree (kept as unknown for flexibility)
}

/**
 * NPC Appearance Configuration
 */
export interface NPCAppearanceConfig {
  modelPath: string;
  iconPath?: string;
  scale: number;
  tint?: string; // Hex color tint
}

/**
 * NPC Data - UNIFIED STRUCTURE FOR ALL NPCs
 *
 * This is the single, standardized interface for ALL non-player characters.
 * Every NPC uses the same structure with flags to enable/disable features.
 *
 * Key Design Principles:
 * - All NPCs can be attacked (flag to disable)
 * - All NPCs drop something (minimum: bones/ashes)
 * - All NPCs have stats (even if passive)
 * - All NPCs can move (flag to disable)
 * - Flexible drop system with RuneScape-style rarity tiers
 */
export interface NPCData {
  // ========== CORE IDENTITY ==========
  id: string;
  name: string;
  description: string;
  category: NPCCategory; // 'mob' | 'boss' | 'neutral'
  faction: string; // Group affiliation

  // ========== STATS (ALL NPCs) ==========
  stats: NPCStats;

  // ========== COMBAT (ALL NPCs - use flags to disable) ==========
  combat: NPCCombatConfig;

  // ========== MOVEMENT (ALL NPCs - use flags to disable) ==========
  movement: NPCMovementConfig;

  // ========== DROPS (ALL NPCs - everyone drops something) ==========
  drops: NPCDrops;

  // ========== SERVICES (Optional - mainly for neutral NPCs) ==========
  services: NPCServicesConfig;

  // ========== BEHAVIOR AI (Optional - for complex behaviors) ==========
  behavior: NPCBehaviorConfig;

  // ========== DIALOGUE (Optional - for NPC conversations) ==========
  dialogue?: NPCDialogueTree;

  // ========== APPEARANCE ==========
  appearance: NPCAppearanceConfig;

  // ========== SPAWN INFO ==========
  position: Position3D;
  spawnBiomes?: string[]; // Which biomes this NPC can spawn in
}

// ============== LEGACY MOB DATA STRUCTURES ==============

/**
 * Mob Stats
 * Used by MobData for backward compatibility with existing mob systems
 * Note: health IS the max HP (OSRS style)
 */
export interface MobStats {
  level: number;
  health: number; // This IS max HP (OSRS style)
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
}

/**
 * Mob spawner statistics interface
 */
export interface MobSpawnStats {
  totalMobs: number;
  level1Mobs: number;
  level2Mobs: number;
  level3Mobs: number;
  byType: Record<string, number>;
  spawnedMobs: number;
}

/**
 * Mob Drop Item - individual mob drop entry
 */
export interface MobDropItem {
  itemId: string;
  quantity: number;
  chance: number; // 0-1 probability
  isGuaranteed: boolean;
}

/**
 * Mob Behavior - behavior configuration for mobs
 */
export interface MobBehavior {
  aggressive: boolean;
  aggroRange: number; // meters
  chaseRange: number; // meters
  returnToSpawn: boolean;
  ignoreLowLevelPlayers: boolean; // Level threshold for aggression
  levelThreshold: number;
}

/**
 * Mob Data - Legacy interface for mob/boss category NPCs
 * This is populated from NPCs with category='mob' or category='boss'
 * Maintained for backward compatibility with existing mob systems
 */
export interface MobData {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 1 | 2 | 3; // Per GDD: Level 1-3 mobs
  mobType: string; // Optional type identifier for spawning system
  type: string; // Alias for mobType for compatibility
  stats: MobStats;
  behavior: MobBehavior;
  drops: MobDropItem[];
  lootTable?: {
    guaranteedDrops: LootEntry[];
    commonDrops: LootEntry[];
    uncommonDrops: LootEntry[];
    rareDrops: LootEntry[];
  };
  spawnBiomes: string[];
  modelPath: string;
  attackSpeedTicks?: number; // Game ticks between attacks (4 = standard sword, 600ms/tick)
  moveSpeed?: number; // Units per second
  combatRange?: number; // Distance in units
  animationSet?: {
    idle: string;
    walk: string;
    attack: string;
    death: string;
  };
  respawnTime: number; // milliseconds
  xpReward: number; // Base XP for killing this mob

  // Shortcut properties for easier access
  health: number;
  maxHealth: number;
  level: number;
}

/**
 * Mob Instance - runtime instance of a mob in the game world
 */
export interface MobInstance {
  id: string;
  type: string; // Mob ID from mobs.json
  name: string;
  description: string;
  difficultyLevel: 1 | 2 | 3;
  mobType: string; // Same as type, for compatibility
  level: number;
  health: number;
  maxHealth: number;
  position: Position3D;
  isAlive: boolean;
  isAggressive: boolean;
  aggroRange: number;
  wanderRadius: number;
  respawnTime: number;
  spawnLocation: Position3D;
  spawnBiomes: string[];
  modelPath: string;
  animationSet: {
    idle: string;
    walk: string;
    attack: string;
    death: string;
  };
  xpReward: number;

  // Combat stats per GDD
  stats: {
    level: number;
    health: number;
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
  };

  // Behavior configuration
  behavior: MobBehavior;
  drops: MobDropItem[];

  // Equipment and drops
  equipment: {
    weapon: { id: number; name: string; type: AttackType } | null;
    armor: { id: number; name: string } | null;
  };

  // Loot table reference
  lootTable: string;

  // AI state
  aiState:
    | "idle"
    | "patrolling"
    | "chasing"
    | "attacking"
    | "returning"
    | "dead";
  target: string | null; // Player ID being targeted
  lastAI: number; // Last AI update timestamp
  homePosition: Position3D;
}

/**
 * Mob Spawn Config - configuration for spawning mobs
 */
export interface MobSpawnConfig {
  type: string; // Mob ID from mobs.json
  name: string;
  level: number;
  health: number; // OSRS: hitpoints = max HP directly
  description?: string;
  difficultyLevel?: 1 | 2 | 3;
  stats?: {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
  };
  behavior?: MobBehavior;
  drops?: MobDropItem[];
  spawnBiomes?: string[];
  modelPath?: string;
  animationSet?: {
    idle: string;
    walk: string;
    attack: string;
    death: string;
  };
  xpReward?: number;
  equipment?: {
    weapon?: {
      name?: string;
      type?: "melee" | "ranged";
      damage?: number;
    } | null;
    armor?: {
      name?: string;
    } | null;
  };
  lootTable: string;
  isAggressive: boolean;
  aggroRange: number;
  respawnTime: number;
}

// ============== MESH USER DATA ==============
// MeshUserData is defined in entity-types.ts and re-exported above
