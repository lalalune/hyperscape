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
  | "CHAT_MESSAGE";

// Network message from server
export interface NetworkEvent {
  type: EventType;
  data: unknown;
  timestamp?: number;
}

// Combat styles
export type CombatStyle = "attack" | "strength" | "defense" | "ranged";

// Inventory item structure
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  slot?: number;
}

// Skills structure
export interface Skills {
  attack: { level: number; xp: number };
  strength: { level: number; xp: number };
  defense: { level: number; xp: number };
  constitution: { level: number; xp: number };
  ranged: { level: number; xp: number };
  woodcutting: { level: number; xp: number };
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
export interface Entity {
  id: string;
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number, number];
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
export interface GameStateCache {
  playerEntity: PlayerEntity | null;
  nearbyEntities: Map<string, Entity>;
  currentRoomId: string | null;
  worldId: string | null;
  lastUpdate: number;
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

/** Chat type for message routing */
export type ChatType = "global" | "local" | "whisper" | "party" | "system";

export interface ChatMessageCommand {
  message: string;
  roomId?: string;
  chatType?: ChatType; // Default: "global"
  targetId?: string; // For whisper messages
}

export interface GatherResourceCommand {
  resourceEntityId: string;
  skill: "woodcutting" | "fishing" | "firemaking" | "cooking";
}

export interface BankCommand {
  action: "deposit" | "withdraw";
  itemId?: string;
  amount?: number;
}

export interface DropItemCommand {
  itemId: string;
  quantity?: number;
}

export interface PickupItemCommand {
  entityId: string;
}

export interface EmoteCommand {
  emote: string;
}

export interface InteractNpcCommand {
  npcId: string;
}

export interface LootCorpseCommand {
  corpseId: string;
}

export interface ChangeAttackStyleCommand {
  style: CombatStyle;
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
  [key: string]: unknown;
}

export interface InventoryData {
  items: InventoryItem[];
  coins: number;
  freeSlots: number;
  [key: string]: unknown;
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
  [key: string]: unknown;
}

export interface SkillsData {
  skills: Skills;
  totalLevel: number;
  combatLevel: number;
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  executeUnequipItem(slot: string): Promise<void>;
  executeChatMessage(command: ChatMessageCommand): Promise<void>;
  executeGatherResource(command: GatherResourceCommand): Promise<void>;
  executeBankAction(command: BankCommand): Promise<void>;
  executeDropItem(command: DropItemCommand): Promise<void>;
  executePickupItem(command: PickupItemCommand): Promise<void>;
  executeEmote(command: EmoteCommand): Promise<void>;
  executeInteractNpc(command: InteractNpcCommand): Promise<void>;
  executeLootCorpse(command: LootCorpseCommand): Promise<void>;
  executeRespawn(): Promise<void>;
  executeChangeAttackStyle(command: ChangeAttackStyleCommand): Promise<void>;
  executeStoreBuy(itemId: string, quantity?: number): Promise<void>;
  executeStoreSell(itemId: string, quantity?: number): Promise<void>;
  executeDialogueResponse(responseIndex: number): Promise<void>;
  executeCloseDialogue(): Promise<void>;

  // Event registration
  onGameEvent(eventType: EventType, handler: (data: unknown) => void): void;
  offGameEvent(eventType: EventType, handler: (data: unknown) => void): void;
}

/**
 * Runtime extensions
 */
export interface HyperscapeAgentRuntime extends IAgentRuntime {
  getService<T>(serviceType: string): T;
}
