/**
 * Database row types for the persistence layer
 * These types represent the structure of data as stored in the database
 */

import { EquipmentSlotName } from "../core/core";

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

/** Complete custody state committed by one authoritative combat-loadout change. */
export interface CombatLoadoutPersistenceSnapshot {
  inventory: InventorySaveItem[];
  equipment: EquipmentSaveItem[];
  selectedSpell: string | null;
}

/**
 * Idempotent database request for changing a combat loadout. The expected
 * snapshot fences the write against stale in-memory state, while the operation
 * receipt makes a lost commit response safe to replay after process recovery.
 */
export interface CombatLoadoutCommitRequest {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  expected: CombatLoadoutPersistenceSnapshot;
  committed: CombatLoadoutPersistenceSnapshot;
}

export interface CombatLoadoutCommitReceipt {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  committed: CombatLoadoutPersistenceSnapshot;
}

/** One exact bank row included in a selected-contestant preparation commit. */
export interface BankSaveItem {
  itemId: string;
  quantity: number;
  slot: number;
  tabIndex: number;
}

/** Complete bank, carried inventory, equipment, and autocast custody state. */
export interface DuelPreparationPlanPersistenceSnapshot extends CombatLoadoutPersistenceSnapshot {
  bank: BankSaveItem[];
}

/**
 * Immutable public planning evidence stored beside the private custody receipt.
 * The server owns the concrete schema and validates it again before readiness;
 * the shared custody layer only requires a plain JSON object.
 */
export type DuelPreparationPlanRecoveryEvidence = Record<string, unknown>;

/**
 * One idempotent whole-plan selected-contestant preparation transition. The
 * expected snapshot fences stale planners; the database verifies custody
 * conservation before committing every bank/equipment/autocast row together.
 */
export interface DuelPreparationPlanCommitRequest {
  operationId: string;
  preparationId: string;
  playerId: string;
  requestFingerprint: string;
  expected: DuelPreparationPlanPersistenceSnapshot;
  committed: DuelPreparationPlanPersistenceSnapshot;
  recoveryEvidence: DuelPreparationPlanRecoveryEvidence;
}

export interface DuelPreparationPlanRecoveryRequest {
  operationId: string;
  preparationId: string;
  playerId: string;
}

export interface DuelPreparationPlanCommitReceipt {
  operationId: string;
  preparationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  committed: DuelPreparationPlanPersistenceSnapshot;
  recoveryEvidence: DuelPreparationPlanRecoveryEvidence;
}

/** One item quantity included in an authoritative inventory debit. */
export interface InventoryDebitRequirement {
  itemId: string;
  quantity: number;
}

/**
 * Idempotent request for consuming several inventory items as one custody
 * transition. The database derives the committed inventory from its locked,
 * authoritative state; callers never perform a sequence of partial removals.
 */
export interface InventoryDebitCommitRequest {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  requirements: InventoryDebitRequirement[];
}

export interface InventoryDebitCommitReceipt {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  requirements: InventoryDebitRequirement[];
  committed: InventorySaveItem[];
}

/** One idempotent bone burial that consumes custody and awards Prayer XP. */
export interface BoneBurialCommitRequest {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  itemId: string;
  xpAmount: number;
  levelRequired: number;
}

/** Durable result of an atomic bone debit, Prayer progression, and point sync. */
export interface BoneBurialCommitReceipt {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  itemId: string;
  xpAmount: number;
  levelRequired: number;
  awardedXp: number;
  operationCommittedXp: number;
  currentXp: number;
  currentLevel: number;
  committed: InventorySaveItem[];
}

/** Gathering skills whose reward XP is persisted with the harvested item. */
export type GatheringRewardSkill = "woodcutting" | "mining" | "fishing";

/** The item credited by one successful, authoritative gathering roll. */
export interface GatheringRewardItem {
  itemId: string;
  quantity: number;
  stackable: boolean;
}

/**
 * One durable gathering result. The optional secondary item debit, reward
 * credit, skill XP/level update, and idempotency receipt commit together.
 */
export interface GatheringRewardCommitRequest {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  resourceId: string;
  depleteAfterCommit: boolean;
  respawnTicks: number;
  skill: GatheringRewardSkill;
  xpAmount: number;
  reward: GatheringRewardItem;
  secondaryItemId: string | null;
}

export interface GatheringRewardCommitReceipt {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  resourceId: string;
  depleteAfterCommit: boolean;
  respawnTicks: number;
  /** Canonical wall-clock deadline for a depleted node, or null when it remains available. */
  depletedUntil: number | null;
  skill: GatheringRewardSkill;
  xpAmount: number;
  reward: GatheringRewardItem;
  secondaryItemId: string | null;
  awardedXp: number;
  operationCommittedXp: number;
  currentXp: number;
  currentLevel: number;
  committed: InventorySaveItem[];
}

/** Persisted active depletion for one stable world resource identity. */
export interface GatheringResourceState {
  resourceId: string;
  operationId: string;
  depletedAt: number;
  respawnAt: number;
}

/** Processing skills whose recipe XP is persisted with their item transform. */
export type ProcessingActionSkill =
  | "firemaking"
  | "cooking"
  | "smithing"
  | "crafting"
  | "fletching"
  | "runecrafting";

/** One output credited by an authoritative processing action. */
export interface ProcessingActionItem {
  itemId: string;
  quantity: number;
  stackable: boolean;
}

export interface ProcessingActionConsumable {
  itemId: string;
  usesPerItem: number;
}

export interface ProcessingActionConsumableState extends ProcessingActionConsumable {
  remainingUses: number;
  consumedQuantity: 0 | 1;
}

/**
 * Server-authored fire requested as part of a Firemaking custody transition.
 * The database assigns the authoritative lifetime timestamps when it commits
 * the matching inventory debit and skill reward.
 */
export interface ProcessingActionFireEffectRequest {
  kind: "fire";
  fireId: string;
  position: { x: number; y: number; z: number };
  tile: { x: number; z: number };
  durationMs: number;
}

/** A committed fire world effect that can be reconstructed after a restart. */
export interface ProcessingActionFireEffect {
  kind: "fire";
  fireId: string;
  position: { x: number; y: number; z: number };
  tile: { x: number; z: number };
  createdAt: number;
  expiresAt: number;
}

/** A committed active fire with the owning player required for world recovery. */
export interface ActiveProcessingFire extends ProcessingActionFireEffect {
  playerId: string;
}

/**
 * One durable recipe action. Every input debit, output credit, skill XP/level
 * update, and idempotency receipt commits as one custody transition.
 */
export interface ProcessingActionCommitRequest {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  skill: ProcessingActionSkill;
  xpAmount: number;
  inputs: InventoryDebitRequirement[];
  requiredItems: InventoryDebitRequirement[];
  consumables: ProcessingActionConsumable[];
  outputs: ProcessingActionItem[];
  /** Optional protected money-pouch debit committed with the item transform. */
  coinCost?: number;
  /** Optional world effect committed atomically with this action. */
  worldEffect?: ProcessingActionFireEffectRequest;
}

export interface ProcessingActionCommitReceipt {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  skill: ProcessingActionSkill;
  xpAmount: number;
  inputs: InventoryDebitRequirement[];
  requiredItems: InventoryDebitRequirement[];
  consumables: ProcessingActionConsumable[];
  consumableStates: ProcessingActionConsumableState[];
  outputs: ProcessingActionItem[];
  coinCost?: number;
  currentCoins?: number;
  worldEffect?: ProcessingActionFireEffect;
  awardedXp: number;
  operationCommittedXp: number;
  currentXp: number;
  currentLevel: number;
  committed: InventorySaveItem[];
}

/** Idempotent debit of one stack held in an exact equipment slot. */
export interface EquipmentStackDebitCommitRequest {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  slotType: string;
  itemId: string;
  quantity: number;
}

export interface EquipmentStackDebitCommitReceipt {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  slotType: string;
  itemId: string;
  quantity: number;
  committed: EquipmentSaveItem[];
}

/** Fixed-point prayer state persisted at one million units per point. */
export interface PrayerPersistenceSnapshot {
  pointUnits: number;
  maxPoints: number;
  activePrayers: string[];
}

export type PrayerStateTransitionKind =
  "toggle" | "drain" | "deactivate_all" | "restore" | "set_max" | "repair";

/**
 * Idempotent, compare-and-swap prayer transition. The database locks the same
 * character row used by combat inventory/equipment custody so prayer state
 * cannot race another authoritative writer for that contestant.
 */
export interface PrayerStateCommitRequest {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  transition: PrayerStateTransitionKind;
  expected: PrayerPersistenceSnapshot;
  committed: PrayerPersistenceSnapshot;
}

export interface PrayerStateCommitReceipt {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  transition: PrayerStateTransitionKind;
  replayed: boolean;
  committed: PrayerPersistenceSnapshot;
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
  prayerLevel: number;
  prayerXp: number;
  prayerPoints: number;
  prayerPointUnits?: number;
  prayerMaxPoints: number;
  activePrayers: string[] | string; // JSONB array of prayer IDs (legacy string supported)
  health: number;
  maxHealth: number;
  coins: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  attackStyle?: string; // Combat style preference (accurate, aggressive, defensive)
  autoRetaliate?: number; // Auto-retaliate setting: 1=ON (default), 0=OFF
  selectedSpell?: string | null; // Autocast spell ID (null = no autocast)
  magicLevel?: number; // Magic skill level (F2P)
  magicXp?: number; // Magic skill XP (F2P)
  lastLogin: number;
  createdAt: number;
  woodcuttingLevel: number;
  woodcuttingXp: number;
  miningLevel: number;
  miningXp: number;
  fishingLevel: number;
  fishingXp: number;
  firemakingLevel: number;
  firemakingXp: number;
  cookingLevel: number;
  cookingXp: number;
  smithingLevel: number;
  smithingXp: number;
  agilityLevel: number;
  agilityXp: number;
  craftingLevel: number;
  craftingXp: number;
  fletchingLevel: number;
  fletchingXp: number;
  runecraftingLevel: number;
  runecraftingXp: number;
}

/** Generic saves cannot mutate atomic Prayer progression or resource custody. */
export type PlayerPersistenceUpdate = Omit<
  Partial<PlayerRow>,
  | "prayerLevel"
  | "prayerXp"
  | "prayerPoints"
  | "prayerPointUnits"
  | "prayerMaxPoints"
  | "activePrayers"
>;

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
  weaponType: string; // Stored as string in DB; maps to AttackType enum at runtime
  combatStyle: string; // Stored as string in DB; maps to CombatStyle type at runtime
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
  hyperiaUserId: string;
  hyperiaLinked: boolean;
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

// SystemDatabase query builder interface
// Models Knex-like query builder with chainable methods
interface QueryBuilder {
  // Chainable where methods
  where(key: string, value: unknown): QueryBuilder;
  where(key: string, operator: string, value: unknown): QueryBuilder;
  where(callback: (builder: QueryBuilder) => void): QueryBuilder;
  whereNull(key: string): QueryBuilder;
  whereIn(key: string, values: unknown[]): QueryBuilder;
  whereRaw(sql: string, bindings?: unknown[]): QueryBuilder;
  orWhere(key: string, operator: string, value: unknown): QueryBuilder;

  // Terminal methods
  first(): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<number>;
  delete(): Promise<number>;

  // Select with chaining
  select(columns?: string | string[]): QueryBuilder;

  // Promise interface
  then<T>(onfulfilled: (value: unknown[]) => T): Promise<T>;
  catch<T>(onrejected: (reason: unknown) => T): Promise<T>;
}

// SystemDatabase type definition
export type SystemDatabase = (table: string) => QueryBuilder & {
  insert(
    data: Record<string, unknown> | Record<string, unknown>[],
  ): Promise<void>;
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
