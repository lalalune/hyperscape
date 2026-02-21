/**
 * Type definitions for @hyperscape/plugin-hyperscape
 *
 * This file defines the TypeScript interfaces and types used throughout the plugin
 * to connect ElizaOS AI agents to Hyperscape game worlds.
 *
 * NOTE: This plugin is standalone and defines all types it needs based on the
 * Hyperscape server's WebSocket protocol. It does NOT import from @hyperscape/shared.
 */

import type { IAgentRuntime } from "@elizaos/core";

/**
 * Basic types matching Hyperscape server protocol
 */

// Event types that the Hyperscape server sends
export type EventType =
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "PLAYER_SPAWNED"
  | "PLAYER_DIED"
  | "ENTITY_JOINED"
  | "ENTITY_LEFT"
  | "ENTITY_UPDATED"
  | "COMBAT_STARTED"
  | "COMBAT_ENDED"
  | "COMBAT_KILL"
  | "COMBAT_ATTACK"
  | "RESOURCE_GATHERED"
  | "RESOURCE_DEPLETED"
  | "RESOURCE_RESPAWNED"
  | "SKILLS_LEVEL_UP"
  | "SKILLS_XP_GAINED"
  | "SKILLS_UPDATED"
  | "INVENTORY_UPDATED"
  | "ITEM_PICKED_UP"
  | "ITEM_DROPPED"
  | "PLAYER_EQUIPMENT_CHANGED"
  | "CHAT_MESSAGE"
  | "DUEL_FIGHT_START"
  | "DUEL_COMPLETED";

// Goal types used by the autonomous behavior system
export type AvailableGoalType =
  | "combat_training"
  | "woodcutting"
  | "fishing"
  | "mining"
  | "exploration"
  | "idle";

// CurrentGoal can include internal user-command goals
export type GoalType = AvailableGoalType | "user_command";

// Network message from server
export interface NetworkEvent {
  type: EventType;
  data: unknown;
  timestamp?: number;
}

// Combat styles
export type CombatStyle = "attack" | "strength" | "defense" | "ranged";

// Inventory item structure
// Items have 'name' (display name) and optionally 'itemId' (item type identifier)
export interface InventoryItem {
  id: string;
  name: string;
  itemId?: string;
  quantity: number;
  slot?: number;
  item?: { name?: string };
}

// Skills structure
export interface Skills {
  attack: { level: number; xp: number };
  strength: { level: number; xp: number };
  defense: { level: number; xp: number };
  constitution: { level: number; xp: number };
  ranged: { level: number; xp: number };
  woodcutting: { level: number; xp: number };
  mining: { level: number; xp: number };
  fishing: { level: number; xp: number };
  firemaking: { level: number; xp: number };
  cooking: { level: number; xp: number };
  [key: string]: { level: number; xp: number };
}

// Equipment structure
export interface Equipment {
  weapon: string | null;
  shield: string | null;
  helmet: string | null;
  body: string | null;
  legs: string | null;
  boots: string | null;
  gloves: string | null;
  cape: string | null;
  amulet: string | null;
  ring: string | null;
  arrows: string | null;
}

// Base entity structure
// Nearby entities from the server can be players, mobs, resources, NPCs, or items.
// All share these fields; optional fields cover the polymorphic server data.
export interface Entity {
  id: string;
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number, number];
  type?: string;
  entityType?: string;
  alive?: boolean;
  dead?: boolean;
  level?: number;
  mobType?: string;
  resourceType?: string;
  resourceId?: string;
  requiredLevel?: number;
  harvestSkill?:
    | "woodcutting"
    | "fishing"
    | "mining"
    | "firemaking"
    | "cooking";
  depleted?: boolean;
  itemId?: string;
  playerId?: string;
  playerName?: string;
  health?: { current: number; max: number };
  npcType?: string;
}

// Player entity structure (what we receive from server)
export interface PlayerEntity extends Entity {
  playerId: string;
  playerName: string;
  hyperscapePlayerId: string;

  // Health & Status
  health: { current: number; max: number };
  stamina: { current: number; max: number };
  alive: boolean;

  // Skills
  skills: Skills;

  // Inventory
  items: InventoryItem[];
  coins: number;

  // Equipment
  equipment: Equipment;

  // Combat
  combatStyle: CombatStyle;
  inCombat: boolean;
  combatTarget: string | null;
}

// Mob/NPC entity (for type checking)
export interface MobEntity extends Entity {
  mobType: string;
  level?: number;
}

// Resource entity (for type checking)
export interface ResourceEntity extends Entity {
  resourceType: string;
  requiredLevel?: number;
  harvestSkill?:
    | "woodcutting"
    | "fishing"
    | "mining"
    | "firemaking"
    | "cooking";
  depleted?: boolean;
}

/**
 * Quest data from the server
 */
export interface QuestData {
  name?: string;
  questId?: string;
  status?: string;
  description?: string;
  stageProgress?: Record<string, number>;
}

/**
 * Plugin configuration from environment variables
 */
export interface HyperscapePluginConfig {
  HYPERSCAPE_SERVER_URL?: string;
  HYPERSCAPE_SERVER_PORT?: string;
  HYPERSCAPE_AUTO_RECONNECT?: string;
}

/**
 * Cached game state maintained by HyperscapeService
 */
/**
 * World map data received from server snapshot
 * Contains town and POI locations for agent navigation
 */
export interface WorldMapTown {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  size: string;
  biome: string;
  buildings: Array<{ type: string }>;
}

export interface WorldMapPOI {
  id: string;
  name: string;
  category: string;
  position: { x: number; y: number; z: number };
  biome: string;
}

export interface WorldMapData {
  towns: WorldMapTown[];
  pois: WorldMapPOI[];
}

export interface GameStateCache {
  playerEntity: PlayerEntity | null;
  nearbyEntities: Map<string, Entity>;
  currentRoomId: string | null;
  worldId: string | null;
  lastUpdate: number;
  /** World map data (towns + POIs) from server snapshot */
  worldMap?: WorldMapData;
  /** Active quests */
  quests: QuestData[];
}

/**
 * WebSocket connection state
 */
export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  lastConnectAttempt: number;
  reconnectAttempts: number;
}

/**
 * Command payloads for game actions
 */
export interface MoveToCommand {
  target: [number, number, number]; // [x, y, z]
  runMode?: boolean;
  cancel?: boolean; // If true, cancels current movement path
}

export interface AttackEntityCommand {
  targetEntityId: string;
  combatStyle?: CombatStyle;
}

export interface UseItemCommand {
  itemId: string;
  slot?: number;
}

export interface EquipItemCommand {
  itemId: string;
  equipSlot: keyof Equipment;
}

export interface ChatMessageCommand {
  message: string;
  roomId?: string;
}

export interface GatherResourceCommand {
  resourceEntityId: string;
  skill: "woodcutting" | "mining" | "fishing" | "firemaking" | "cooking";
}

export interface BankCommand {
  action: "deposit" | "withdraw";
  itemId?: string;
  amount?: number;
}

/**
 * Duel system command payloads
 */
export interface DuelChallengeCommand {
  targetPlayerId: string;
}

export interface DuelChallengeResponseCommand {
  challengeId: string;
  accept: boolean;
}

/**
 * Pending duel challenge from another player
 */
export interface PendingDuelChallenge {
  challengeId: string;
  challengerId: string;
  challengerName: string;
  challengerCombatLevel: number;
  expiresAt: number;
}

/**
 * Action validation context
 */
export interface ActionContext {
  playerEntity: PlayerEntity;
  nearbyEntities: Entity[];
  availableItems: InventoryItem[];
}

/**
 * Provider result data structures
 */
export interface GameStateData {
  health: { current: number; max: number };
  stamina: { current: number; max: number };
  position: [number, number, number];
  inCombat: boolean;
  combatTarget: string | null;
  alive: boolean;
}

export interface InventoryData {
  items: InventoryItem[];
  coins: number;
  freeSlots: number;
}

export interface NearbyEntitiesData {
  players: Array<{
    name: string;
    entityId: string;
    position: [number, number, number];
  }>;
  npcs: Array<{
    name: string;
    entityId: string;
    position: [number, number, number];
  }>;
  resources: Array<{
    name: string;
    entityId: string;
    position: [number, number, number];
    type: string;
  }>;
}

export interface SkillsData {
  skills: Skills;
  totalLevel: number;
  combatLevel: number;
}

export interface EquipmentData {
  weapon: string | null;
  shield: string | null;
  armor: {
    helmet: string | null;
    body: string | null;
    legs: string | null;
    boots: string | null;
    gloves: string | null;
    cape: string | null;
  };
  accessories: {
    amulet: string | null;
    ring: string | null;
    arrows: string | null;
  };
}

/**
 * Memory storage types for game events
 */
export interface GameEventMemory {
  eventType: EventType;
  timestamp: number;
  description: string;
  tags: string[];
  data: Record<string, unknown>;
}

export interface CombatMemory extends GameEventMemory {
  opponent: string;
  outcome: "victory" | "defeat" | "ongoing";
  damageDealt: number;
  damageTaken: number;
}

export interface ResourceMemory extends GameEventMemory {
  resourceType: string;
  location: [number, number, number];
  skillUsed: string;
  xpGained: number;
}

/**
 * Service interface extensions
 */
export interface HyperscapeServiceInterface {
  // Connection management
  connect(serverUrl: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // State access
  getPlayerEntity(): PlayerEntity | null;
  getNearbyEntities(): Entity[];
  getGameState(): GameStateCache;

  // Command execution
  executeMove(command: MoveToCommand): Promise<void>;
  executeAttack(command: AttackEntityCommand): Promise<void>;
  executeUseItem(command: UseItemCommand): Promise<void>;
  executeEquipItem(command: EquipItemCommand): Promise<void>;
  executeChatMessage(command: ChatMessageCommand): Promise<void>;
  executeGatherResource(command: GatherResourceCommand): Promise<void>;
  executeBankAction(command: BankCommand): Promise<void>;
  executeTogglePrayer(prayerId: string): Promise<void>;

  // Event registration
  onGameEvent(
    eventType: EventType,
    handler: (data: unknown) => void | Promise<void>,
  ): void;
  offGameEvent(
    eventType: EventType,
    handler: (data: unknown) => void | Promise<void>,
  ): void;

  // Duel commands
  executeDuelChallenge(command: DuelChallengeCommand): Promise<void>;
  executeDuelChallengeResponse(
    command: DuelChallengeResponseCommand,
  ): Promise<void>;
  getPendingDuelChallenge(): PendingDuelChallenge | null;

  // Quest system
  getQuestState(): QuestData[];
  requestQuestList(): void;
  sendQuestAccept(questId: string): void;
  sendQuestComplete(questId: string): void;
}

/**
 * Runtime extensions
 */
export interface HyperscapeAgentRuntime extends IAgentRuntime {
  getService<T>(serviceType: string): T;
}
