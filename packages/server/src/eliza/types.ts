/**
 * Types for embedded Eliza agents in Hyperscape server
 */

import type { World } from "@hyperscape/shared";

/**
 * Configuration for an embedded agent
 */
export interface EmbeddedAgentConfig {
  /** Character ID in Hyperscape database */
  characterId: string;
  /** Account ID that owns the agent */
  accountId: string;
  /** Agent name for display */
  name: string;
  /** Scripted role for non-LLM bots */
  scriptedRole?: "combat" | "woodcutting" | "fishing" | "mining" | "balanced";
  /** Path to ElizaOS character JSON file (optional) */
  characterJsonPath?: string;
  /** Inline character configuration (alternative to JSON file) */
  characterConfig?: AgentCharacterConfig;
  /** Whether to auto-start the agent on creation */
  autoStart?: boolean;
  /** AI model provider (openai, anthropic, groq, xai) */
  modelProvider?: "openai" | "anthropic" | "groq" | "xai" | "openrouter";
  /** Specific model to use */
  model?: string;
}

/**
 * Agent character configuration for ElizaOS
 */
export interface AgentCharacterConfig {
  name: string;
  username?: string;
  system?: string;
  bio?: string[];
  topics?: string[];
  adjectives?: string[];
  plugins?: string[];
  /** AI model provider */
  modelProvider?: "openai" | "anthropic" | "groq" | "xai" | "openrouter";
  settings?: {
    secrets?: Record<string, string>;
    avatar?: string;
    /** Specific model to use */
    model?: string;
    [key: string]: unknown;
  };
  style?: {
    all?: string[];
    chat?: string[];
    post?: string[];
  };
}

/**
 * State of an embedded agent
 */
export type AgentState =
  | "initializing"
  | "running"
  | "paused"
  | "stopped"
  | "error";

/**
 * Information about a running embedded agent
 */
export interface EmbeddedAgentInfo {
  agentId: string;
  characterId: string;
  accountId: string;
  name: string;
  scriptedRole?: "combat" | "woodcutting" | "fishing" | "mining" | "balanced";
  state: AgentState;
  entityId: string | null;
  position: [number, number, number] | null;
  health: number | null;
  maxHealth: number | null;
  startedAt: number;
  lastActivity: number;
  error?: string;
}

/**
 * Game state for an embedded agent (provided to ElizaOS)
 */
export interface EmbeddedGameState {
  playerId: string;
  position: [number, number, number] | null;
  health: number;
  maxHealth: number;
  alive: boolean;
  skills: Record<string, { level: number; xp: number }>;
  inventory: Array<{ slot: number; itemId: string; quantity: number }>;
  equipment: Record<string, { itemId: string }>;
  nearbyEntities: NearbyEntityData[];
  inCombat: boolean;
  currentTarget: string | null;
  activePrayers: string[];
}

/**
 * Data about a nearby entity
 */
export interface NearbyEntityData {
  id: string;
  name: string;
  type: "player" | "mob" | "npc" | "item" | "resource" | "object";
  position: [number, number, number];
  distance: number;
  health?: number;
  maxHealth?: number;
  level?: number;
  mobType?: string;
  itemId?: string;
  resourceType?: string;
  equippedWeapon?: string;
}

/**
 * Command types that agents can execute
 */
export type AgentCommandType =
  | "move"
  | "attack"
  | "gather"
  | "pickup"
  | "drop"
  | "equip"
  | "unequip"
  | "use"
  | "chat"
  | "stop"
  | "bank_deposit"
  | "bank_withdraw";

/**
 * Base command interface
 */
export interface AgentCommand {
  type: AgentCommandType;
  timestamp: number;
}

/**
 * Move command
 */
export interface MoveCommand extends AgentCommand {
  type: "move";
  target: [number, number, number];
  runMode?: boolean;
}

/**
 * Attack command
 */
export interface AttackCommand extends AgentCommand {
  type: "attack";
  targetId: string;
}

/**
 * Gather resource command
 */
export interface GatherCommand extends AgentCommand {
  type: "gather";
  resourceId: string;
}

/**
 * Pickup item command
 */
export interface PickupCommand extends AgentCommand {
  type: "pickup";
  itemId: string;
}

/**
 * Active quest progress data returned to agent actions
 */
export interface AgentQuestProgress {
  questId: string;
  name: string;
  status: string;
  currentStage: string;
  stageDescription: string;
  stageProgress: Record<string, number>;
  stageType: "dialogue" | "kill" | "gather" | "interact" | "travel" | "unknown";
  stageTarget?: string;
  stageCount?: number;
  startNpc: string;
}

/**
 * Quest definition info returned to agent actions for quest discovery
 */
export interface AgentQuestInfo {
  questId: string;
  name: string;
  description: string;
  difficulty: string;
  status: string;
  startNpc: string;
  onStartItems: Array<{ itemId: string; quantity: number }>;
  rewardItems: Array<{ itemId: string; quantity: number }>;
  stages: Array<{
    id: string;
    type: string;
    description: string;
    target?: string;
    count?: number;
  }>;
}

/**
 * Interface for the embedded Hyperscape service
 * Provides direct world access instead of WebSocket
 */
export interface IEmbeddedHyperscapeService {
  /** Get the world instance */
  getWorld(): World;

  /** Get current game state for the agent */
  getGameState(): EmbeddedGameState | null;

  /** Get nearby entities */
  getNearbyEntities(): NearbyEntityData[];

  /** Execute a move command */
  executeMove(
    target: [number, number, number],
    runMode?: boolean,
  ): Promise<void>;

  /** Execute an attack command */
  executeAttack(targetId: string): Promise<void>;

  /** Execute a gather resource command */
  executeGather(resourceId: string): Promise<void>;

  /** Execute a pickup item command */
  executePickup(itemId: string): Promise<void>;

  /** Execute a drop item command */
  executeDrop(itemId: string, quantity?: number): Promise<void>;

  /** Execute an equip item command */
  executeEquip(itemId: string): Promise<void>;

  /** Execute a use item command */
  executeUse(itemId: string): Promise<void>;

  /** Execute a prayer toggle command */
  executePrayer(prayerId: string): Promise<void>;

  /** Execute a chat message command */
  executeChat(message: string): Promise<void>;

  /** Stop current action */
  executeStop(): Promise<void>;

  /** Check if the agent's player entity is spawned */
  isSpawned(): boolean;

  /** Get the agent's player entity ID */
  getPlayerId(): string | null;

  /** Register event handler */
  onGameEvent(event: string, handler: (data: unknown) => void): void;

  /** Unregister event handler */
  offGameEvent(event: string, handler: (data: unknown) => void): void;

  /** Get active quest state with progress details */
  getQuestState(): AgentQuestProgress[];

  /** Get all quest definitions with status for quest discovery */
  getAvailableQuests(): AgentQuestInfo[];

  /** Get all NPC positions in the world (for quest navigation) */
  getAllNPCPositions(): Array<{
    id: string;
    name: string;
    npcId: string;
    position: [number, number, number];
  }>;

  /** Accept a quest by ID */
  executeQuestAccept(questId: string): Promise<boolean>;

  /** Complete a quest by ID (must be ready_to_complete) */
  executeQuestComplete(questId: string): Promise<boolean>;
}
