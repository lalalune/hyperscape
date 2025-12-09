/**
 * Database row types for the persistence layer
 * These types represent the structure of data as stored in the database
 */

import type { Knex } from "knex";
import { EquipmentSlotName } from "../core/core";

// Database transaction type (Knex transaction)
export type DatabaseTransaction = Knex.Transaction;

// Boolean representation in database (0 or 1 for compatibility)
type SQLiteBoolean = 0 | 1;

// Types for database method parameters
export interface InventorySaveItem {
  itemId: string;
  quantity: number;
  slotIndex: number;
  metadata: Record<string, string | number | boolean> | null;
}

export interface EquipmentSaveItem {
  slotType: string;
  itemId: string;
  quantity: number;
}

export interface WorldChunkData {
  chunkX: number;
  chunkZ: number;
  data: string; // JSON-serialized chunk data
  lastActive: number;
  playerCount: number;
  version: number;
}

// Player data row
export interface PlayerRow {
  id: number;
  playerId: string;
  name: string;
  combatLevel: number;
  attackLevel: number;
  strengthLevel: number;
  defenseLevel: number;
  constitutionLevel: number;
  rangedLevel: number;
  attackXp: number;
  strengthXp: number;
  defenseXp: number;
  constitutionXp: number;
  rangedXp: number;
  health: number;
  maxHealth: number;
  coins: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  attackStyle?: string; // Combat style preference (accurate, aggressive, defensive)
  lastLogin: number;
  createdAt: number;
  woodcuttingLevel: number;
  woodcuttingXp: number;
  fishingLevel: number;
  fishingXp: number;
  firemakingLevel: number;
  firemakingXp: number;
  cookingLevel: number;
  cookingXp: number;
}

// Item definition row
export interface ItemRow {
  id: number;
  name: string;
  type: string;
  description: string;
  value: number;
  weight: number;
  stackable: SQLiteBoolean;
  tradeable: SQLiteBoolean;
  attackLevel: number | null;
  strengthLevel: number | null;
  defenseLevel: number | null;
  rangedLevel: number | null;
  attackBonus: number;
  strengthBonus: number;
  defenseBonus: number;
  rangedBonus: number;
  heals: number | null;
  maxStackSize: number;
  equipSlot: string | null;
}

// Player inventory row
export interface InventoryRow {
  id: number;
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
  metadata: string | null; // JSON string for additional item data
}

// Player equipment row
export interface EquipmentRow {
  id: number;
  playerId: string;
  slotType: EquipmentSlotName;
  itemId: string | null;
  quantity: number;
}

// Bank storage row
export interface BankRow {
  id: number;
  playerId: string;
  bankId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
  metadata: string | null;
}

// Store inventory row
export interface StoreRow {
  id: number;
  storeId: string;
  itemId: string;
  price: number;
  stock: number;
  maxStock: number;
  restockTime: number;
  lastRestock: number;
}

// Player session row
export interface SessionRow {
  id: number;
  sessionId: string;
  playerId: string;
  startTime: number;
  endTime: number | null;
  isActive: SQLiteBoolean;
  lastActivity: number;
  ipAddress: string | null;
  userAgent: string | null;
}

// Combat log row
export interface CombatLogRow {
  id: number;
  attackerId: string;
  attackerType: "player" | "mob";
  targetId: string;
  targetType: "player" | "mob";
  damage: number;
  weaponType: "melee" | "ranged" | "magic";
  combatStyle: "attack" | "strength" | "defense" | "ranged";
  timestamp: number;
  sessionId: string;
}

// Death log row
export interface DeathLogRow {
  id: number;
  playerId: string;
  killedBy: string;
  killerType: "player" | "mob" | "environment";
  deathLocation: string; // JSON string with x, y, z
  itemsLost: string | null; // JSON array of item IDs
  timestamp: number;
  sessionId: string;
}

// Resource respawn row
export interface ResourceRespawnRow {
  id: number;
  resourceId: string;
  resourceType: "tree" | "rock" | "fishing_spot";
  position: string; // JSON string with x, y, z
  respawnTime: number;
  lastHarvested: number;
  harvestedBy: string;
}

// NPC state row
export interface NPCStateRow {
  id: number;
  npcId: string;
  npcType: string;
  position: string; // JSON string with x, y, z
  health: number;
  maxHealth: number;
  state: "idle" | "combat" | "fleeing" | "dead";
  lastUpdate: number;
}

// Quest progress row
export interface QuestProgressRow {
  id: number;
  playerId: string;
  questId: string;
  status: "not_started" | "in_progress" | "completed" | "failed";
  progress: string; // JSON string with quest-specific progress data
  startTime: number | null;
  completionTime: number | null;
}

// NPC kills row
export interface NPCKillsRow {
  id: number;
  playerId: string;
  npcId: string;
  killCount: number;
}

// Trade log row
export interface TradeLogRow {
  id: number;
  player1Id: string;
  player2Id: string;
  player1Items: string; // JSON array of items traded
  player2Items: string; // JSON array of items traded
  timestamp: number;
  sessionId: string;
}

// Helper type for JSON columns with type safety
export type JSONString<T> = string & { __json: T };

// Helper functions for JSON serialization
export function toJSONString<T>(data: T): JSONString<T> {
  return JSON.stringify(data) as JSONString<T>;
}

export function fromJSONString<T>(
  json: JSONString<T> | string | null,
): T | null {
  if (!json) return null;
  return JSON.parse(json) as T;
}

// Database System types
export interface WorldChunkRow extends WorldChunkData {
  needsReset: SQLiteBoolean;
}

export interface PlayerSessionRow {
  id: string;
  sessionId: string; // Alias for id to maintain compatibility
  playerId: string;
  sessionStart: number;
  sessionEnd: number | null;
  playtimeMinutes: number;
  reason: string | null;
  lastActivity: number;
}

// Client token/session types for client identity
export interface ClientPlayerToken {
  playerId: string;
  tokenSecret: string;
  playerName: string;
  createdAt: Date;
  lastSeen: Date;
  sessionId: string;
  machineId: string;
  clientVersion: string;
  hyperscapeUserId: string;
  hyperscapeLinked: boolean;
  persistenceVersion: number;
}

export interface PlayerSession {
  sessionId: string;
  playerId: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

// Database migration interfaces
export interface PluginMigration {
  name: string;
  up: (knex: unknown) => Promise<void>; // Using unknown to avoid Knex dependency in types
  down?: (knex: unknown) => Promise<void>;
}

// SystemDatabase type definition
export type SystemDatabase = (table: string) => {
  where: (
    key: string,
    value: unknown,
  ) => {
    first: () => Promise<unknown>;
    update: (data: Record<string, unknown>) => Promise<number>;
    delete: () => Promise<number>;
  };
  select: (columns?: string | string[]) => {
    where: (
      key: string,
      value: unknown,
    ) => {
      first: () => Promise<unknown>;
    };
  };
  insert: (
    data: Record<string, unknown> | Record<string, unknown>[],
  ) => Promise<void>;
  update: (data: Record<string, unknown>) => Promise<number>;
  delete: () => Promise<number>;
  first: () => Promise<unknown>;
  then: <T>(onfulfilled: (value: unknown[]) => T) => Promise<T>;
  catch: <T>(onrejected: (reason: unknown) => T) => Promise<T>;
};

// TypedKnexDatabase - alias for SystemDatabase with type safety
export type TypedKnexDatabase = SystemDatabase;

// Core database row types
export interface ConfigRow {
  key: string;
  value: string;
}

export interface UserRow {
  id: string;
  name: string;
  roles: string;
  createdAt: string;
  avatar: string | null;
  privyUserId: string | null;
  farcasterFid: string | null;
}

export interface EntityRow {
  id: string;
  data: string;
  createdAt: string;
  updatedAt: string;
}

// Generic DatabaseRow type for any row
export type DatabaseRow = Record<string, unknown>;

// Database helper functions
export const dbHelpers = {
  async setConfig(
    db: SystemDatabase,
    key: string,
    value: string,
  ): Promise<void> {
    const existing = await db("config").where("key", key).first();
    if (existing) {
      await db("config").where("key", key).update({ value });
      return;
    }
    await db("config").insert({ key, value });
  },
};

// Type guard for checking if an object is a SystemDatabase instance
export function isDatabaseInstance(db: unknown): db is SystemDatabase {
  return typeof db === "function";
}
