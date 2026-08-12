/**
 * DatabaseSystem - Server-side database operations for persistent game state
 *
 * This system provides a comprehensive interface for all database operations in Hyperia.
 * It uses PostgreSQL with Drizzle ORM for type-safe queries and migrations.
 *
 * Architecture (Refactored):
 * - DatabaseSystem acts as a facade/coordinator
 * - Domain-specific operations delegated to repositories
 * - Each repository handles one area (players, inventory, equipment, etc.)
 * - Maintains backward compatibility with all existing methods
 *
 * Key responsibilities:
 * - Character management (create, load, save character data)
 * - Player persistence (stats, position, levels, XP)
 * - Inventory and equipment storage
 * - Session tracking (login/logout times, playtime)
 * - World chunk persistence (terrain modifications, entities)
 *
 * Usage:
 * ```typescript
 * const dbSystem = world.getSystem('database') as DatabaseSystem;
 * const player = await dbSystem.getPlayerAsync(playerId);
 * await dbSystem.savePlayerAsync(playerId, { health: 100 });
 * ```
 */

import {
  BANKING_CONSTANTS,
  getItem,
  getProcessingRequestOperationId,
  normalizeProcessingRequestEnvelope,
  normalizeProcessingRequestId,
  PROCESSING_CONSTANTS,
  SystemBase,
  TICK_DURATION_MS,
  worldToTile,
} from "@hyperforge/shared";
import type {
  ProcessingRequestEnvelope,
  ProcessingSkill,
  RecoverableProcessingRequest,
  World,
} from "@hyperforge/shared";
import { createHash, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import type pg from "pg";
import * as schema from "../../database/schema";
import {
  runInPostgresTransaction,
  type PostgresIsolationLevel,
} from "../../database/postgres-transaction";
import type {
  EquipmentRow,
  EquipmentSaveItem,
  EquipmentStackDebitCommitReceipt,
  EquipmentStackDebitCommitRequest,
  CombatLoadoutCommitReceipt,
  CombatLoadoutCommitRequest,
  CombatLoadoutPersistenceSnapshot,
  DuelPreparationPlanCommitReceipt,
  DuelPreparationPlanCommitRequest,
  DuelPreparationPlanPersistenceSnapshot,
  DuelPreparationPlanRecoveryEvidence,
  DuelPreparationPlanRecoveryRequest,
  InventoryDebitCommitReceipt,
  InventoryDebitCommitRequest,
  InventoryDebitRequirement,
  BoneBurialCommitReceipt,
  BoneBurialCommitRequest,
  GatheringRewardCommitReceipt,
  GatheringRewardCommitRequest,
  GatheringRewardItem,
  GatheringResourceState,
  GatheringRewardSkill,
  ProcessingActionCommitReceipt,
  ProcessingActionCommitRequest,
  ProcessingActionConsumable,
  ProcessingActionConsumableState,
  ProcessingActionFireEffect,
  ProcessingActionFireEffectRequest,
  ActiveProcessingFire,
  ProcessingActionItem,
  ProcessingActionSkill,
  InventoryRow,
  InventorySaveItem,
  PrayerPersistenceSnapshot,
  PrayerStateCommitReceipt,
  PrayerStateCommitRequest,
  PrayerStateTransitionKind,
  ItemRow,
  PlayerPersistenceUpdate,
  PlayerRow,
  PlayerSessionRow,
  WorldChunkRow,
  ActivityLogEntry,
  ActivityLogRow,
  ActivityLogQueryOptions,
  TradeEntry,
  TradeRow,
  TradeQueryOptions,
} from "../../shared/types";
import {
  CharacterRepository,
  PlayerRepository,
  InventoryRepository,
  EquipmentRepository,
  SessionRepository,
  WorldChunkRepository,
  NPCKillRepository,
  DeathRepository,
  TemplateRepository,
  QuestRepository,
  ActivityLogRepository,
  BankRepository,
} from "../../database/repositories";
import type { DeathLockData } from "../../database/repositories/DeathRepository";
import { assertGenericPlayerUpdateExcludesPrayerAuthority } from "../../database/prayer-custody-policy";

const IS_PLAYWRIGHT_TEST = process.env.PLAYWRIGHT_TEST === "true";
const isTruthyEnv = (value: string | undefined): boolean =>
  value != null && /^(1|true|yes|on)$/i.test(value.trim());
const DISABLE_WORLD_CHUNK_PERSISTENCE =
  IS_PLAYWRIGHT_TEST ||
  isTruthyEnv(process.env.DISABLE_WORLD_CHUNK_PERSISTENCE);
const DB_WRITE_ERRORS_NON_FATAL =
  IS_PLAYWRIGHT_TEST ||
  isTruthyEnv(process.env.DB_WRITE_ERRORS_NON_FATAL) ||
  isTruthyEnv(process.env.DUEL_DB_WRITE_BEST_EFFORT);

function isTransientDbConnectivityError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);

  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "Connection terminated",
    "connection timeout",
    "failed to connect",
    "Connection terminated unexpectedly",
  ].some((pattern) => message.includes(pattern));
}

function hasPostgresConstraint(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current; depth++) {
    if (typeof current !== "object") return false;
    const candidate = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (candidate.code === "23505" && candidate.constraint === constraint) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

type StoredCombatLoadoutOperation = {
  version: 1;
  requestFingerprint: string;
  committed: CombatLoadoutPersistenceSnapshot;
};

type StoredDuelPreparationPlanOperation = {
  version: 2;
  preparationId: string;
  requestFingerprint: string;
  committed: DuelPreparationPlanPersistenceSnapshot;
  recoveryEvidence: DuelPreparationPlanRecoveryEvidence;
};

type StoredInventoryDebitOperation = {
  version: 1;
  requestFingerprint: string;
  requirements: InventoryDebitRequirement[];
  committed: CommittedInventoryItem[];
};

type StoredGatheringRewardOperation = {
  version: 2;
  requestFingerprint: string;
  resourceId: string;
  depleteAfterCommit: boolean;
  respawnTicks: number;
  depletedUntil: number | null;
  skill: GatheringRewardSkill;
  xpAmount: number;
  reward: GatheringRewardItem;
  secondaryItemId: string | null;
  awardedXp: number;
  operationCommittedXp: number;
};

type StoredProcessingActionOperation = {
  version: 1;
  requestFingerprint: string;
  skill: ProcessingActionSkill;
  xpAmount: number;
  inputs: InventoryDebitRequirement[];
  requiredItems?: InventoryDebitRequirement[];
  consumables?: ProcessingActionConsumable[];
  consumableStates?: ProcessingActionConsumableState[];
  outputs: ProcessingActionItem[];
  coinCost?: number;
  worldEffect?: ProcessingActionFireEffect;
  awardedXp: number;
  operationCommittedXp: number;
};

type StoredPendingProcessingRequest = {
  version: 1;
  requestId: string;
  skill: ProcessingSkill;
  ownerId: string;
  acceptedAt: number;
  heartbeatAt: number;
  envelope?: ProcessingRequestEnvelope;
};

type StoredRejectedProcessingRequest = StoredPendingProcessingRequest & {
  reason: string;
  retryable: boolean;
  rejectedAt: number;
};

type StoredProcessingWaiter = {
  version: 1;
  requestId: string;
  skill: ProcessingSkill;
  envelope: ProcessingRequestEnvelope;
  ownerId: string;
  acceptedAt: number;
  heartbeatAt: number;
  status: "pending" | "committed" | "rejected";
  terminalAt: number | null;
  acknowledgedAt: number | null;
};

type StoredProcessingConsumableUses = Record<
  string,
  { usesPerItem: number; remainingUses: number }
>;

type StoredEquipmentStackDebitOperation = {
  version: 1;
  requestFingerprint: string;
  slotType: string;
  itemId: string;
  quantity: number;
  committed: CommittedEquipmentItem[];
};

type StoredPrayerStateOperation = {
  version: 1;
  requestFingerprint: string;
  transition: PrayerStateTransitionKind;
  expected: PrayerPersistenceSnapshot;
  committed: PrayerPersistenceSnapshot;
};

type DeathCustodyItem = {
  itemId: string;
  quantity: number;
};

type StoredSafeDeathCaptureOperation = {
  version: 1;
  requestFingerprint: string;
  deathTimestamp: number;
  position: { x: number; y: number; z: number };
  killedBy: string;
  dropped: DeathCustodyItem[];
  kept: DeathCustodyItem[];
};

type StoredSafeDeathKeptReturnOperation = {
  version: 1;
  deathOperationId: string;
  returned: DeathCustodyItem[];
};

type StoredSafeDeathGravestoneLootOperation = {
  version: 1;
  deathOperationId: string;
  gravestoneId: string;
  requested: DeathCustodyItem[] | null;
  transferred: DeathCustodyItem[];
  remaining: DeathCustodyItem[];
};

export type SafeDeathCaptureCommitRequest = {
  operationId: string;
  playerId: string;
  deathTimestamp: number;
  position: { x: number; y: number; z: number };
  killedBy: string;
};

export type SafeDeathCaptureCommitReceipt = {
  operationId: string;
  playerId: string;
  requestFingerprint: string;
  replayed: boolean;
  deathTimestamp: number;
  dropped: DeathCustodyItem[];
  kept: DeathCustodyItem[];
};

export type SafeDeathKeptReturnReceipt = {
  operationId: string;
  playerId: string;
  deathOperationId: string;
  replayed: boolean;
  returned: DeathCustodyItem[];
  committed: CommittedInventoryItem[];
};

export type SafeDeathGravestoneLootCommitRequest = {
  operationId: string;
  playerId: string;
  deathOperationId: string;
  gravestoneId: string;
  items?: DeathCustodyItem[];
};

export type SafeDeathGravestoneLootCommitReceipt = {
  operationId: string;
  playerId: string;
  deathOperationId: string;
  gravestoneId: string;
  replayed: boolean;
  transferred: DeathCustodyItem[];
  remaining: DeathCustodyItem[];
  committed: CommittedInventoryItem[];
};

type CommittedEquipmentItem = {
  slotType: string;
  itemId: string;
  quantity: number;
};

type CommittedInventoryItem = {
  itemId: string;
  quantity: number;
  slotIndex: number;
  metadata: Record<string, string | number | boolean> | null;
};

type InventorySnapshotInput = Array<{
  itemId: string;
  quantity: number;
  slotIndex: number | null;
  metadata: Record<string, unknown> | null;
}>;

const MAX_PERSISTED_ITEM_QUANTITY = 2_147_483_647;
const MAX_SKILL_XP = 200_000_000;
const MAX_GATHERING_REWARD_XP = 1_000_000;
const MAX_PROCESSING_ACTION_XP = 1_000_000;
const MAX_PROCESSING_CONSUMABLE_USES = 1_000_000;
const MAX_ACTIVE_PROCESSING_FIRES_PER_PLAYER =
  PROCESSING_CONSTANTS.FIRE.maxFiresPerPlayer;
const MAX_INVENTORY_SLOTS = 28;
const BONE_BURIAL_OPERATION_ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|bone-burial:[A-Za-z0-9_-]{20})$/;
const GATHERING_REWARD_SKILLS = new Set<GatheringRewardSkill>([
  "woodcutting",
  "mining",
  "fishing",
]);
const PROCESSING_ACTION_SKILLS = new Set<ProcessingActionSkill>([
  "firemaking",
  "cooking",
  "smithing",
  "crafting",
  "fletching",
  "runecrafting",
]);
const PROCESSING_REQUEST_SKILLS = new Set<ProcessingSkill>([
  "firemaking",
  "cooking",
  "smelting",
  "smithing",
  "crafting",
  "fletching",
  "runecrafting",
  "tanning",
]);

function normalizeDeathOperationId(value: unknown): string {
  const operationId = String(value ?? "").trim();
  if (!operationId || operationId.length > 256) {
    throw new Error("safe_death_operation_id_invalid");
  }
  return operationId;
}

function normalizeDeathPlayerId(value: unknown): string {
  const playerId = String(value ?? "").trim();
  if (!playerId || playerId.length > 256) {
    throw new Error("safe_death_player_id_invalid");
  }
  return playerId;
}

function normalizeDeathCustodyItems(
  value: unknown,
  errorPrefix = "safe_death",
): DeathCustodyItem[] {
  if (!Array.isArray(value) || value.length > 64) {
    throw new Error(`${errorPrefix}_items_invalid`);
  }
  const totals = new Map<string, number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") {
      throw new Error(`${errorPrefix}_items_invalid`);
    }
    const itemId = String((raw as { itemId?: unknown }).itemId ?? "").trim();
    const quantity = Number((raw as { quantity?: unknown }).quantity);
    if (
      !itemId ||
      itemId.length > 256 ||
      !getItem(itemId) ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error(`${errorPrefix}_items_invalid`);
    }
    const combined = (totals.get(itemId) ?? 0) + quantity;
    if (
      !Number.isSafeInteger(combined) ||
      combined > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error(`${errorPrefix}_items_invalid`);
    }
    totals.set(itemId, combined);
  }
  return [...totals.entries()]
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function splitSafeDeathCustody(
  value: DeathCustodyItem[],
  keepCount: number,
): { dropped: DeathCustodyItem[]; kept: DeathCustodyItem[] } {
  const ranked = value
    .map((item, index) => ({
      item,
      index,
      value: Number(getItem(item.itemId)?.value ?? 0),
    }))
    .sort(
      (left, right) => right.value - left.value || left.index - right.index,
    );
  const keptByItem = new Map<string, number>();
  let remaining = keepCount;
  for (const entry of ranked) {
    if (remaining <= 0) break;
    const quantity = Math.min(entry.item.quantity, remaining);
    keptByItem.set(entry.item.itemId, quantity);
    remaining -= quantity;
  }
  const kept: DeathCustodyItem[] = [];
  const dropped: DeathCustodyItem[] = [];
  for (const item of value) {
    const keptQuantity = keptByItem.get(item.itemId) ?? 0;
    if (keptQuantity > 0) {
      kept.push({ itemId: item.itemId, quantity: keptQuantity });
    }
    if (item.quantity > keptQuantity) {
      dropped.push({
        itemId: item.itemId,
        quantity: item.quantity - keptQuantity,
      });
    }
  }
  return {
    dropped: normalizeDeathCustodyItems(dropped),
    kept: normalizeDeathCustodyItems(kept),
  };
}

function safeDeathCaptureFingerprint(
  playerId: string,
  deathTimestamp: number,
  position: { x: number; y: number; z: number },
  killedBy: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        playerId,
        deathTimestamp,
        position,
        killedBy,
      }),
      "utf8",
    )
    .digest("hex");
}

function deathKeptReturnOperationId(deathOperationId: string): string {
  return `death-kept:${createHash("sha256").update(deathOperationId).digest("hex")}`;
}

function creditDeathCustodyItem(
  inventory: CommittedInventoryItem[],
  item: DeathCustodyItem,
): CommittedInventoryItem[] {
  const definition = getItem(item.itemId);
  if (!definition) throw new Error("safe_death_item_unknown");
  return creditGatheringReward(
    inventory,
    {
      itemId: item.itemId,
      quantity: item.quantity,
      stackable: definition.stackable === true,
    },
    "safe_death",
  );
}

function processingWaiterOperationId(playerId: string): string {
  return `processing-waiter:${playerId}`;
}

function normalizeStoredProcessingWaiter(
  value: unknown,
): StoredProcessingWaiter | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<StoredProcessingWaiter>;
  const requestId = normalizeProcessingRequestId(state.requestId);
  const skill = state.skill as ProcessingSkill;
  const envelope = PROCESSING_REQUEST_SKILLS.has(skill)
    ? normalizeProcessingRequestEnvelope(skill, state.envelope)
    : null;
  const acceptedAt = Number(state.acceptedAt);
  const heartbeatAt = Number(state.heartbeatAt);
  const terminalAt =
    state.terminalAt === null ? null : Number(state.terminalAt);
  const acknowledgedAt =
    state.acknowledgedAt === null ? null : Number(state.acknowledgedAt);
  if (
    state.version !== 1 ||
    !requestId ||
    !envelope ||
    typeof state.ownerId !== "string" ||
    !state.ownerId ||
    !Number.isSafeInteger(acceptedAt) ||
    acceptedAt <= 0 ||
    !Number.isSafeInteger(heartbeatAt) ||
    heartbeatAt < acceptedAt ||
    (state.status !== "pending" &&
      state.status !== "committed" &&
      state.status !== "rejected") ||
    (state.status === "pending" && terminalAt !== null) ||
    (state.status !== "pending" &&
      (terminalAt === null ||
        !Number.isSafeInteger(terminalAt) ||
        terminalAt < acceptedAt)) ||
    (acknowledgedAt !== null &&
      (!Number.isSafeInteger(acknowledgedAt) ||
        terminalAt === null ||
        acknowledgedAt < terminalAt))
  ) {
    return null;
  }
  return {
    version: 1,
    requestId,
    skill,
    envelope,
    ownerId: state.ownerId,
    acceptedAt,
    heartbeatAt,
    status: state.status,
    terminalAt,
    acknowledgedAt,
  };
}
const PRAYER_POINT_UNITS_PER_POINT = 1_000_000;
const MAX_PRAYER_POINTS = 99;
const MAX_ACTIVE_PRAYERS = 5;
const PRAYER_TRANSITIONS = new Set<PrayerStateTransitionKind>([
  "toggle",
  "drain",
  "deactivate_all",
  "restore",
  "set_max",
  "repair",
]);

function normalizePrayerSnapshot(
  value: PrayerPersistenceSnapshot,
  errorPrefix: string,
): PrayerPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error(`${errorPrefix}_state_invalid`);
  }
  const pointUnits = Number(value.pointUnits);
  const maxPoints = Number(value.maxPoints);
  if (
    !Number.isSafeInteger(maxPoints) ||
    maxPoints < 1 ||
    maxPoints > MAX_PRAYER_POINTS ||
    !Number.isSafeInteger(pointUnits) ||
    pointUnits < 0 ||
    pointUnits > maxPoints * PRAYER_POINT_UNITS_PER_POINT ||
    !Array.isArray(value.activePrayers) ||
    value.activePrayers.length > MAX_ACTIVE_PRAYERS
  ) {
    throw new Error(`${errorPrefix}_state_invalid`);
  }
  const activePrayers = value.activePrayers.map((raw) => {
    const prayerId = String(raw ?? "").trim();
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(prayerId)) {
      throw new Error(`${errorPrefix}_state_invalid`);
    }
    return prayerId;
  });
  if (new Set(activePrayers).size !== activePrayers.length) {
    throw new Error(`${errorPrefix}_state_invalid`);
  }
  activePrayers.sort((left, right) => left.localeCompare(right));
  if (pointUnits === 0 && activePrayers.length > 0) {
    throw new Error(`${errorPrefix}_state_invalid`);
  }
  return { pointUnits, maxPoints, activePrayers };
}

function prayerSnapshotsEqual(
  left: PrayerPersistenceSnapshot,
  right: PrayerPersistenceSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function prayerStateFingerprint(
  playerId: string,
  transition: PrayerStateTransitionKind,
  expected: PrayerPersistenceSnapshot,
  committed: PrayerPersistenceSnapshot,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        playerId,
        transition,
        expected,
        committed,
      }),
      "utf8",
    )
    .digest("hex");
}

function validatePrayerTransition(
  transition: PrayerStateTransitionKind,
  expected: PrayerPersistenceSnapshot,
  committed: PrayerPersistenceSnapshot,
): void {
  const sameMax = committed.maxPoints === expected.maxPoints;
  const sameUnits = committed.pointUnits === expected.pointUnits;
  const sameActive =
    JSON.stringify(committed.activePrayers) ===
    JSON.stringify(expected.activePrayers);
  let valid = false;
  switch (transition) {
    case "toggle":
      valid = sameMax && sameUnits && !sameActive;
      break;
    case "drain":
      valid =
        sameMax &&
        expected.activePrayers.length > 0 &&
        committed.pointUnits < expected.pointUnits &&
        (sameActive ||
          (committed.pointUnits === 0 && committed.activePrayers.length === 0));
      break;
    case "deactivate_all":
      valid =
        sameMax &&
        sameUnits &&
        expected.activePrayers.length > 0 &&
        committed.activePrayers.length === 0;
      break;
    case "restore":
      valid =
        sameMax && sameActive && committed.pointUnits > expected.pointUnits;
      break;
    case "set_max":
      valid =
        committed.maxPoints !== expected.maxPoints &&
        sameActive &&
        committed.pointUnits ===
          Math.min(
            expected.pointUnits,
            committed.maxPoints * PRAYER_POINT_UNITS_PER_POINT,
          );
      break;
    case "repair":
      valid =
        sameMax &&
        committed.pointUnits <= expected.pointUnits &&
        (!sameUnits || !sameActive) &&
        committed.activePrayers.every((id) =>
          expected.activePrayers.includes(id),
        );
      break;
  }
  if (!valid) throw new Error("prayer_state_transition_invalid");
}

function normalizeEquipmentSnapshot(
  value: Array<{
    slotType: string;
    itemId: string;
    quantity: number;
  }>,
  errorPrefix: string,
): CommittedEquipmentItem[] {
  if (!Array.isArray(value) || value.length > 32) {
    throw new Error(`${errorPrefix}_equipment_invalid`);
  }

  const equipmentSlots = new Set<string>();
  const equipment = value.map((raw) => {
    const slotType = String(raw?.slotType ?? "").trim();
    const itemId = String(raw?.itemId ?? "").trim();
    const quantity = Number(raw?.quantity);
    if (
      !slotType ||
      slotType.length > 64 ||
      equipmentSlots.has(slotType) ||
      !itemId ||
      itemId.length > 256 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error(`${errorPrefix}_equipment_invalid`);
    }
    equipmentSlots.add(slotType);
    return { slotType, itemId, quantity };
  });
  equipment.sort((left, right) => left.slotType.localeCompare(right.slotType));
  return equipment;
}

function equipmentStackDebitFingerprint(
  playerId: string,
  slotType: string,
  itemId: string,
  quantity: number,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({ version: 1, playerId, slotType, itemId, quantity }),
      "utf8",
    )
    .digest("hex");
}

function debitEquipmentStackSnapshot(
  equipment: CommittedEquipmentItem[],
  slotType: string,
  itemId: string,
  quantity: number,
): CommittedEquipmentItem[] {
  const equipped = equipment.find((item) => item.slotType === slotType);
  if (!equipped || equipped.itemId !== itemId || equipped.quantity < quantity) {
    throw new Error("equipment_stack_debit_insufficient_items");
  }

  return equipment.flatMap((item) => {
    if (item.slotType !== slotType) return [item];
    const remaining = item.quantity - quantity;
    return remaining > 0 ? [{ ...item, quantity: remaining }] : [];
  });
}

function normalizeInventorySnapshot(
  value: InventorySnapshotInput,
  errorPrefix: string,
): CommittedInventoryItem[] {
  if (!Array.isArray(value)) {
    throw new Error(`${errorPrefix}_inventory_invalid`);
  }

  const inventorySlots = new Set<number>();
  const inventory = value.map((raw) => {
    const slotIndex = Number(raw?.slotIndex);
    const quantity = Number(raw?.quantity);
    const itemId = String(raw?.itemId ?? "").trim();
    if (
      !Number.isSafeInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= 28 ||
      inventorySlots.has(slotIndex) ||
      !itemId ||
      itemId.length > 256 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error(`${errorPrefix}_inventory_invalid`);
    }
    inventorySlots.add(slotIndex);

    let metadata: Record<string, string | number | boolean> | null = null;
    if (raw.metadata != null) {
      if (typeof raw.metadata !== "object" || Array.isArray(raw.metadata)) {
        throw new Error(`${errorPrefix}_inventory_metadata_invalid`);
      }
      metadata = {};
      for (const key of Object.keys(raw.metadata).sort()) {
        const metadataValue = raw.metadata[key];
        if (
          typeof metadataValue !== "string" &&
          typeof metadataValue !== "boolean" &&
          (typeof metadataValue !== "number" || !Number.isFinite(metadataValue))
        ) {
          throw new Error(`${errorPrefix}_inventory_metadata_invalid`);
        }
        metadata[key] = metadataValue;
      }
    }

    return { itemId, quantity, slotIndex, metadata };
  });
  inventory.sort((a, b) => a.slotIndex - b.slotIndex);
  return inventory;
}

function normalizePersistedInventoryRows(
  rows: Array<{
    itemId: string;
    quantity: number | null;
    slotIndex: number | null;
    metadata: string | null;
  }>,
  errorPrefix: string,
): CommittedInventoryItem[] {
  return normalizeInventorySnapshot(
    rows.map((row) => {
      let metadata: Record<string, string | number | boolean> | null = null;
      if (row.metadata) {
        try {
          const parsed = JSON.parse(row.metadata) as unknown;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("metadata is not an object");
          }
          metadata = parsed as Record<string, string | number | boolean>;
        } catch {
          throw new Error(`${errorPrefix}_inventory_metadata_invalid`);
        }
      }
      return {
        itemId: row.itemId,
        quantity: row.quantity ?? 1,
        slotIndex: row.slotIndex ?? -1,
        metadata,
      };
    }),
    errorPrefix,
  );
}

function normalizeInventoryDebitRequirements(
  value: InventoryDebitRequirement[],
): InventoryDebitRequirement[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 28) {
    throw new Error("inventory_debit_requirements_invalid");
  }

  const totals = new Map<string, number>();
  for (const raw of value) {
    const itemId = String(raw?.itemId ?? "").trim();
    const quantity = Number(raw?.quantity);
    if (
      !itemId ||
      itemId.length > 256 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error("inventory_debit_requirements_invalid");
    }
    const combined = (totals.get(itemId) ?? 0) + quantity;
    if (
      !Number.isSafeInteger(combined) ||
      combined > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error("inventory_debit_requirements_invalid");
    }
    totals.set(itemId, combined);
  }

  return [...totals.entries()]
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function inventoryDebitFingerprint(
  playerId: string,
  requirements: InventoryDebitRequirement[],
): string {
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, playerId, requirements }), "utf8")
    .digest("hex");
}

function boneBurialFingerprint(
  playerId: string,
  itemId: string,
  xpAmount: number,
  levelRequired: number,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        playerId,
        itemId,
        xpAmount,
        levelRequired,
      }),
      "utf8",
    )
    .digest("hex");
}

function debitInventorySnapshot(
  inventory: CommittedInventoryItem[],
  requirements: InventoryDebitRequirement[],
): CommittedInventoryItem[] {
  const available = new Map<string, number>();
  for (const item of inventory) {
    available.set(
      item.itemId,
      (available.get(item.itemId) ?? 0) + item.quantity,
    );
  }
  for (const requirement of requirements) {
    if ((available.get(requirement.itemId) ?? 0) < requirement.quantity) {
      throw new Error("inventory_debit_insufficient_items");
    }
  }

  const remaining = new Map(
    requirements.map((requirement) => [
      requirement.itemId,
      requirement.quantity,
    ]),
  );
  const committed: CommittedInventoryItem[] = [];
  for (const item of inventory) {
    const quantityToDebit = remaining.get(item.itemId) ?? 0;
    if (quantityToDebit <= 0) {
      committed.push(item);
      continue;
    }
    const removed = Math.min(item.quantity, quantityToDebit);
    const quantity = item.quantity - removed;
    remaining.set(item.itemId, quantityToDebit - removed);
    if (quantity > 0) committed.push({ ...item, quantity });
  }
  return committed;
}

function normalizeGatheringReward(
  input: GatheringRewardItem,
): GatheringRewardItem {
  const itemId = String(input?.itemId ?? "").trim();
  const quantity = Number(input?.quantity);
  if (
    !itemId ||
    itemId.length > 256 ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    quantity > MAX_PERSISTED_ITEM_QUANTITY ||
    typeof input?.stackable !== "boolean"
  ) {
    throw new Error("gathering_reward_request_invalid");
  }
  return { itemId, quantity, stackable: input.stackable };
}

function normalizeGatheringSecondaryItemId(
  value: string | null,
): string | null {
  if (value === null) return null;
  const itemId = String(value ?? "").trim();
  if (!itemId || itemId.length > 256) {
    throw new Error("gathering_reward_request_invalid");
  }
  return itemId;
}

function gatheringRewardFingerprint(
  playerId: string,
  resourceId: string,
  depleteAfterCommit: boolean,
  respawnTicks: number,
  skill: GatheringRewardSkill,
  xpAmount: number,
  reward: GatheringRewardItem,
  secondaryItemId: string | null,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 2,
        playerId,
        resourceId,
        depleteAfterCommit,
        respawnTicks,
        skill,
        xpAmount,
        reward,
        secondaryItemId,
      }),
      "utf8",
    )
    .digest("hex");
}

function creditGatheringReward(
  inventory: CommittedInventoryItem[],
  reward: GatheringRewardItem,
  errorPrefix = "gathering_reward",
): CommittedInventoryItem[] {
  const committed = inventory.map((item) => ({ ...item }));
  if (reward.stackable) {
    const existing = committed.find((item) => item.itemId === reward.itemId);
    if (existing) {
      const quantity = existing.quantity + reward.quantity;
      if (
        !Number.isSafeInteger(quantity) ||
        quantity > MAX_PERSISTED_ITEM_QUANTITY
      ) {
        throw new Error(`${errorPrefix}_quantity_overflow`);
      }
      existing.quantity = quantity;
      return committed;
    }
  }

  const occupied = new Set(committed.map((item) => item.slotIndex));
  const slotsNeeded = reward.stackable ? 1 : reward.quantity;
  const freeSlots: number[] = [];
  for (let slot = 0; slot < MAX_INVENTORY_SLOTS; slot++) {
    if (!occupied.has(slot)) freeSlots.push(slot);
  }
  if (freeSlots.length < slotsNeeded) {
    throw new Error(`${errorPrefix}_inventory_full`);
  }

  if (reward.stackable) {
    committed.push({
      itemId: reward.itemId,
      quantity: reward.quantity,
      slotIndex: freeSlots[0],
      metadata: null,
    });
  } else {
    for (let index = 0; index < reward.quantity; index++) {
      committed.push({
        itemId: reward.itemId,
        quantity: 1,
        slotIndex: freeSlots[index],
        metadata: null,
      });
    }
  }
  committed.sort((left, right) => left.slotIndex - right.slotIndex);
  return committed;
}

function skillLevelForXp(xp: number): number {
  let cumulative = 0;
  for (let level = 2; level <= 99; level++) {
    const increment =
      Math.floor(level - 1 + 300 * Math.pow(2, (level - 1) / 7)) / 4;
    cumulative = Math.floor(cumulative + increment);
    if (xp < cumulative) return level - 1;
  }
  return 99;
}

function normalizeProcessingInputs(
  value: InventoryDebitRequirement[],
): InventoryDebitRequirement[] {
  try {
    return normalizeInventoryDebitRequirements(value);
  } catch {
    throw new Error("processing_action_request_invalid");
  }
}

function normalizeProcessingRequiredItems(
  value: InventoryDebitRequirement[],
): InventoryDebitRequirement[] {
  if (!Array.isArray(value)) {
    throw new Error("processing_action_request_invalid");
  }
  if (value.length === 0) return [];
  return normalizeProcessingInputs(value);
}

function normalizeProcessingConsumables(
  value: ProcessingActionConsumable[],
): ProcessingActionConsumable[] {
  if (!Array.isArray(value) || value.length > 28) {
    throw new Error("processing_action_request_invalid");
  }
  const itemIds = new Set<string>();
  const consumables = value.map((raw) => {
    const itemId = String(raw?.itemId ?? "").trim();
    const usesPerItem = Number(raw?.usesPerItem);
    if (
      !itemId ||
      itemId.length > 256 ||
      itemIds.has(itemId) ||
      !Number.isSafeInteger(usesPerItem) ||
      usesPerItem <= 0 ||
      usesPerItem > MAX_PROCESSING_CONSUMABLE_USES
    ) {
      throw new Error("processing_action_request_invalid");
    }
    itemIds.add(itemId);
    return { itemId, usesPerItem };
  });
  consumables.sort((left, right) => left.itemId.localeCompare(right.itemId));
  return consumables;
}

function normalizeProcessingConsumableStates(
  value: ProcessingActionConsumableState[],
): ProcessingActionConsumableState[] {
  const consumables = normalizeProcessingConsumables(value);
  const rawByItem = new Map(
    value.map((entry) => [String(entry?.itemId ?? "").trim(), entry]),
  );
  return consumables.map((consumable) => {
    const raw = rawByItem.get(consumable.itemId);
    const remainingUses = Number(raw?.remainingUses);
    const consumedQuantity = Number(raw?.consumedQuantity);
    if (
      !Number.isSafeInteger(remainingUses) ||
      remainingUses < 0 ||
      remainingUses >= consumable.usesPerItem ||
      (consumedQuantity !== 0 && consumedQuantity !== 1) ||
      (consumedQuantity === 1 && remainingUses !== 0) ||
      (consumedQuantity === 0 && remainingUses === 0)
    ) {
      throw new Error("processing_action_operation_id_conflict");
    }
    return {
      ...consumable,
      remainingUses,
      consumedQuantity: consumedQuantity as 0 | 1,
    };
  });
}

function normalizeProcessingFireEffectRequest(
  value: ProcessingActionFireEffectRequest | undefined,
  skill: ProcessingActionSkill,
): ProcessingActionFireEffectRequest | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || skill !== "firemaking") {
    throw new Error("processing_action_request_invalid");
  }
  const fireId = String(value.fireId ?? "").trim();
  const position = value.position;
  const tile = value.tile;
  const durationMs = Number(value.durationMs);
  if (
    value.kind !== "fire" ||
    fireId !== value.fireId ||
    !/^fire_[A-Za-z0-9_-]+$/.test(fireId) ||
    fireId.length > 256 ||
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z) ||
    !tile ||
    !Number.isSafeInteger(tile.x) ||
    !Number.isSafeInteger(tile.z) ||
    !Number.isSafeInteger(durationMs) ||
    durationMs <
      PROCESSING_CONSTANTS.FIRE.minDurationTicks * TICK_DURATION_MS ||
    durationMs > PROCESSING_CONSTANTS.FIRE.maxDurationTicks * TICK_DURATION_MS
  ) {
    throw new Error("processing_action_request_invalid");
  }
  const expectedTile = worldToTile(position.x, position.z);
  if (expectedTile.x !== tile.x || expectedTile.z !== tile.z) {
    throw new Error("processing_action_request_invalid");
  }
  return {
    kind: "fire",
    fireId,
    position: { x: position.x, y: position.y, z: position.z },
    tile: { x: tile.x, z: tile.z },
    durationMs,
  };
}

function normalizeStoredProcessingFireEffect(
  value: ProcessingActionFireEffect | undefined,
  expected?: ProcessingActionFireEffectRequest,
): ProcessingActionFireEffect | undefined {
  if (value === undefined && expected === undefined) return undefined;
  if (!value || value.kind !== "fire") {
    throw new Error("processing_action_world_effect_state_invalid");
  }
  const createdAt = Number(value.createdAt);
  const expiresAt = Number(value.expiresAt);
  const request = normalizeProcessingFireEffectRequest(
    {
      kind: "fire",
      fireId: value.fireId,
      position: value.position,
      tile: value.tile,
      durationMs: expiresAt - createdAt,
    },
    "firemaking",
  );
  if (
    !request ||
    !Number.isSafeInteger(createdAt) ||
    createdAt <= 0 ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= createdAt ||
    (expected && JSON.stringify(request) !== JSON.stringify(expected))
  ) {
    throw new Error("processing_action_world_effect_state_invalid");
  }
  return {
    kind: "fire",
    fireId: request.fireId,
    position: request.position,
    tile: request.tile,
    createdAt,
    expiresAt,
  };
}

function normalizeStoredProcessingConsumableUses(
  value: unknown,
): StoredProcessingConsumableUses {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("processing_action_consumable_state_invalid");
  }
  const normalized: StoredProcessingConsumableUses = {};
  for (const itemId of Object.keys(value as Record<string, unknown>).sort()) {
    const raw = (value as Record<string, unknown>)[itemId];
    if (!itemId || itemId.length > 256 || !raw || typeof raw !== "object") {
      throw new Error("processing_action_consumable_state_invalid");
    }
    const usesPerItem = Number((raw as { usesPerItem?: unknown }).usesPerItem);
    const remainingUses = Number(
      (raw as { remainingUses?: unknown }).remainingUses,
    );
    if (
      !Number.isSafeInteger(usesPerItem) ||
      usesPerItem <= 0 ||
      usesPerItem > MAX_PROCESSING_CONSUMABLE_USES ||
      !Number.isSafeInteger(remainingUses) ||
      remainingUses <= 0 ||
      remainingUses >= usesPerItem
    ) {
      throw new Error("processing_action_consumable_state_invalid");
    }
    normalized[itemId] = { usesPerItem, remainingUses };
  }
  return normalized;
}

function normalizeProcessingOutputs(
  value: ProcessingActionItem[],
): ProcessingActionItem[] {
  if (!Array.isArray(value) || value.length > 28) {
    throw new Error("processing_action_request_invalid");
  }
  const outputs = new Map<string, ProcessingActionItem>();
  for (const raw of value) {
    const itemId = String(raw?.itemId ?? "").trim();
    const quantity = Number(raw?.quantity);
    if (
      !itemId ||
      itemId.length > 256 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_PERSISTED_ITEM_QUANTITY ||
      typeof raw?.stackable !== "boolean"
    ) {
      throw new Error("processing_action_request_invalid");
    }
    const existing = outputs.get(itemId);
    if (existing && existing.stackable !== raw.stackable) {
      throw new Error("processing_action_request_invalid");
    }
    const combined = (existing?.quantity ?? 0) + quantity;
    if (
      !Number.isSafeInteger(combined) ||
      combined > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error("processing_action_request_invalid");
    }
    outputs.set(itemId, {
      itemId,
      quantity: combined,
      stackable: raw.stackable,
    });
  }
  return [...outputs.values()].sort((left, right) =>
    left.itemId.localeCompare(right.itemId),
  );
}

function processingActionFingerprint(
  playerId: string,
  skill: ProcessingActionSkill,
  xpAmount: number,
  inputs: InventoryDebitRequirement[],
  requiredItems: InventoryDebitRequirement[],
  consumables: ProcessingActionConsumable[],
  outputs: ProcessingActionItem[],
  coinCost: number,
  worldEffect?: ProcessingActionFireEffectRequest,
): string {
  const payload: Record<string, unknown> = {
    version: 1,
    playerId,
    skill,
    xpAmount,
    inputs,
    outputs,
  };
  // Preserve fingerprints for already committed non-consumable actions.
  if (requiredItems.length > 0) payload.requiredItems = requiredItems;
  if (consumables.length > 0) payload.consumables = consumables;
  if (coinCost > 0) payload.coinCost = coinCost;
  if (worldEffect) payload.worldEffect = worldEffect;
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

function normalizeCombatLoadoutSnapshot(
  value: CombatLoadoutPersistenceSnapshot,
): CombatLoadoutPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("combat_loadout_snapshot_invalid");
  }

  const inventory = normalizeInventorySnapshot(
    value.inventory,
    "combat_loadout",
  );

  const equipmentSlots = new Set<string>();
  const equipment = value.equipment.map((raw) => {
    const slotType = String(raw.slotType ?? "").trim();
    const itemId = String(raw.itemId ?? "").trim();
    const quantity = Number(raw.quantity);
    if (
      !slotType ||
      equipmentSlots.has(slotType) ||
      !itemId ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error("combat_loadout_equipment_invalid");
    }
    equipmentSlots.add(slotType);
    return { slotType, itemId, quantity };
  });
  equipment.sort((a, b) => a.slotType.localeCompare(b.slotType));

  const selectedSpell = value.selectedSpell;
  if (
    selectedSpell !== null &&
    (typeof selectedSpell !== "string" || !selectedSpell.trim())
  ) {
    throw new Error("combat_loadout_selected_spell_invalid");
  }

  return {
    inventory,
    equipment,
    selectedSpell: selectedSpell?.trim() ?? null,
  };
}

function combatLoadoutSnapshotsEqual(
  left: CombatLoadoutPersistenceSnapshot,
  right: CombatLoadoutPersistenceSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeDuelPreparationPlanSnapshot(
  value: DuelPreparationPlanPersistenceSnapshot,
): DuelPreparationPlanPersistenceSnapshot {
  if (!value || typeof value !== "object" || !Array.isArray(value.bank)) {
    throw new Error("duel_preparation_plan_snapshot_invalid");
  }
  const combat = normalizeCombatLoadoutSnapshot(value);
  const occupied = new Set<string>();
  const bank = value.bank.map((raw) => {
    const itemId = String(raw.itemId ?? "").trim();
    const quantity = Number(raw.quantity);
    const slot = Number(raw.slot);
    const tabIndex = Number(raw.tabIndex);
    const position = `${tabIndex}:${slot}`;
    if (
      !itemId ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > BANKING_CONSTANTS.MAX_ITEM_STACK ||
      !Number.isSafeInteger(slot) ||
      slot < 0 ||
      slot >= BANKING_CONSTANTS.MAX_BANK_SLOTS ||
      !Number.isSafeInteger(tabIndex) ||
      tabIndex < 0 ||
      tabIndex >= BANKING_CONSTANTS.MAX_TABS ||
      occupied.has(position)
    ) {
      throw new Error("duel_preparation_plan_bank_invalid");
    }
    occupied.add(position);
    return { itemId, quantity, slot, tabIndex };
  });
  if (bank.length > BANKING_CONSTANTS.MAX_BANK_SLOTS) {
    throw new Error("duel_preparation_plan_bank_invalid");
  }
  bank.sort(
    (a, b) =>
      a.tabIndex - b.tabIndex ||
      a.slot - b.slot ||
      a.itemId.localeCompare(b.itemId),
  );
  return { ...combat, bank };
}

function duelPreparationPlanSnapshotsEqual(
  left: DuelPreparationPlanPersistenceSnapshot,
  right: DuelPreparationPlanPersistenceSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function duelPreparationPlanSnapshotMismatchKinds(
  persisted: DuelPreparationPlanPersistenceSnapshot,
  expected: DuelPreparationPlanPersistenceSnapshot,
): string[] {
  const mismatches: string[] = [];
  if (
    JSON.stringify(persisted.inventory) !== JSON.stringify(expected.inventory)
  ) {
    mismatches.push("inventory");
  }
  if (
    JSON.stringify(persisted.equipment) !== JSON.stringify(expected.equipment)
  ) {
    mismatches.push("equipment");
  }
  if (persisted.selectedSpell !== expected.selectedSpell) {
    mismatches.push("selected_spell");
  }
  if (JSON.stringify(persisted.bank) !== JSON.stringify(expected.bank)) {
    mismatches.push("bank");
  }
  return mismatches;
}

function duelPreparationPlanCustodyTotals(
  snapshot: DuelPreparationPlanPersistenceSnapshot,
): Array<[string, number]> {
  const totals = new Map<string, number>();
  for (const item of [
    ...snapshot.bank,
    ...snapshot.inventory,
    ...snapshot.equipment,
  ]) {
    totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantity);
  }
  return [...totals.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function duelPreparationPlanCustodyIsConserved(
  before: DuelPreparationPlanPersistenceSnapshot,
  after: DuelPreparationPlanPersistenceSnapshot,
): boolean {
  return (
    JSON.stringify(duelPreparationPlanCustodyTotals(before)) ===
    JSON.stringify(duelPreparationPlanCustodyTotals(after))
  );
}

function normalizeDuelPreparationPlanRecoveryEvidence(
  value: unknown,
): DuelPreparationPlanRecoveryEvidence {
  const seen = new Set<object>();
  const canonicalize = (entry: unknown, depth: number): string | null => {
    if (depth > 12) return null;
    if (entry === null || typeof entry === "boolean") {
      return JSON.stringify(entry);
    }
    if (typeof entry === "string") {
      return entry.length <= 4_096 ? JSON.stringify(entry) : null;
    }
    if (typeof entry === "number") {
      return Number.isFinite(entry) ? JSON.stringify(entry) : null;
    }
    if (typeof entry !== "object" || seen.has(entry)) return null;
    seen.add(entry);
    let result: string | null;
    if (Array.isArray(entry)) {
      if (entry.length > 128) result = null;
      else {
        const values = entry.map((item) => canonicalize(item, depth + 1));
        result = values.some((item) => item === null)
          ? null
          : `[${values.join(",")}]`;
      }
    } else {
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null) result = null;
      else {
        const record = entry as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        if (keys.length > 128) result = null;
        else {
          const fields: string[] = [];
          result = "";
          for (const key of keys) {
            const child = canonicalize(record[key], depth + 1);
            if (child === null) {
              result = null;
              break;
            }
            fields.push(`${JSON.stringify(key)}:${child}`);
          }
          if (result !== null) result = `{${fields.join(",")}}`;
        }
      }
    }
    seen.delete(entry);
    return result;
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("duel_preparation_plan_recovery_evidence_invalid");
  }
  const canonical = canonicalize(value, 0);
  if (!canonical || canonical.length > 32_768) {
    throw new Error("duel_preparation_plan_recovery_evidence_invalid");
  }
  return JSON.parse(canonical) as DuelPreparationPlanRecoveryEvidence;
}

/**
 * Transaction isolation levels for database operations
 *
 * - 'read committed' (default): Prevents dirty reads
 * - 'repeatable read': Prevents dirty reads and non-repeatable reads
 * - 'serializable': Prevents all concurrency anomalies (strictest)
 *
 * Use 'serializable' for critical financial/inventory operations where
 * race conditions could cause item duplication or loss.
 */
export type IsolationLevel = PostgresIsolationLevel;

/**
 * DatabaseSystem class
 *
 * Extends SystemBase to integrate with HyperForge's ECS architecture.
 * Acts as a facade that delegates to domain-specific repositories.
 */
export class DatabaseSystem extends SystemBase {
  /** Drizzle database instance for type-safe queries */
  private db: NodePgDatabase<typeof schema> | null = null;

  /** Unique authority epoch; a new process can identify abandoned requests. */
  private readonly processingRequestOwnerId = randomUUID();

  /** PostgreSQL connection pool for low-level operations if needed */
  private pool: pg.Pool | null = null;

  /**
   * Tracks all pending database operations to ensure graceful shutdown.
   * Operations are added when sync methods fire-and-forget async work.
   */
  private pendingOperations: Set<Promise<unknown>> = new Set();

  /** Flag to indicate the system is being destroyed - prevents new operations */
  private isDestroying: boolean = false;

  // Repository instances
  private characterRepository!: CharacterRepository;
  private playerRepository!: PlayerRepository;
  private inventoryRepository!: InventoryRepository;
  private equipmentRepository!: EquipmentRepository;
  private sessionRepository!: SessionRepository;
  private worldChunkRepository!: WorldChunkRepository;
  private npcKillRepository!: NPCKillRepository;
  private deathRepository!: DeathRepository;
  private templateRepository!: TemplateRepository;
  private questRepository!: QuestRepository;
  private activityLogRepository!: ActivityLogRepository;
  private bankRepository!: BankRepository;

  /**
   * Constructor
   *
   * Sets up the database system with no dependencies since it provides
   * foundational services to other systems.
   *
   * @param world - The game world instance this system belongs to
   */
  constructor(world: World) {
    super(world, {
      name: "database",
      dependencies: {
        required: [], // No dependencies - this is a foundational system
        optional: [],
      },
      autoCleanup: true, // Automatically clean up resources on destroy
    });
  }

  /**
   * Initialize the database system
   *
   * Retrieves the Drizzle database instance and PostgreSQL pool from the World object.
   * Instantiates all repositories with the database connections.
   *
   * @throws Error if database instances are not available on the world object
   */
  async init(): Promise<void> {
    // Cast world to access server-specific properties
    const serverWorld = this.world as {
      pgPool?: pg.Pool;
      drizzleDb?: NodePgDatabase<typeof schema>;
    };

    if (serverWorld.drizzleDb && serverWorld.pgPool) {
      this.db = serverWorld.drizzleDb;
      this.pool = serverWorld.pgPool;

      // Initialize all repositories
      this.characterRepository = new CharacterRepository(this.db, this.pool);
      this.playerRepository = new PlayerRepository(this.db, this.pool);
      this.inventoryRepository = new InventoryRepository(this.db, this.pool);
      this.equipmentRepository = new EquipmentRepository(this.db, this.pool);
      this.sessionRepository = new SessionRepository(this.db, this.pool);
      this.worldChunkRepository = new WorldChunkRepository(this.db, this.pool);
      this.npcKillRepository = new NPCKillRepository(this.db, this.pool);
      this.deathRepository = new DeathRepository(this.db, this.pool);
      this.templateRepository = new TemplateRepository(this.db, this.pool);
      this.questRepository = new QuestRepository(this.db, this.pool);
      this.activityLogRepository = new ActivityLogRepository(
        this.db,
        this.pool,
      );
      this.bankRepository = new BankRepository(this.db, this.pool);
    } else {
      throw new Error(
        "[DatabaseSystem] Drizzle database not provided on world object",
      );
    }
  }

  /**
   * Start the database system
   *
   * Currently a no-op since all initialization is done in init().
   * The database is ready to use immediately after initialization.
   */
  start(): void {}

  /**
   * Wait for all pending database operations to complete
   *
   * This is critical for graceful shutdown to ensure no data loss.
   * Sync methods (like savePlayer) fire-and-forget async operations which
   * are tracked here. Before shutting down, we wait for all of them to complete.
   *
   * Called by server shutdown handler in index.ts.
   */
  async waitForPendingOperations(): Promise<void> {
    // A zero-delay generic save may still be buffered and therefore absent
    // from pendingOperations. Flush and drain the ordered player-write tail
    // before repositories begin rejecting new shutdown-time work.
    this.flushSaveBuffer();
    await this.playerSaveWriteTail.catch(() => undefined);

    // Set flag to prevent new operations during shutdown
    this.isDestroying = true;

    // Mark all repositories as destroying
    this.characterRepository.markDestroying();
    this.playerRepository.markDestroying();
    this.inventoryRepository.markDestroying();
    this.equipmentRepository.markDestroying();
    this.sessionRepository.markDestroying();
    this.worldChunkRepository.markDestroying();
    this.npcKillRepository.markDestroying();
    this.deathRepository.markDestroying();
    this.templateRepository.markDestroying();
    this.questRepository.markDestroying();
    this.activityLogRepository.markDestroying();
    this.bankRepository.markDestroying();

    if (this.pendingOperations.size === 0) {
      return;
    }

    // Create a copy of the pending operations to avoid issues with modifications during iteration
    const operations = Array.from(this.pendingOperations);

    // Wait for all operations to complete
    await Promise.allSettled(operations);
  }

  /**
   * Helper method to track fire-and-forget async operations
   *
   * Used by sync wrapper methods to ensure operations complete before shutdown.
   * Prevents new operations during shutdown and handles errors gracefully.
   *
   * @param operation - The async operation to track
   * @private
   */
  /** Threshold for warning about pending operation buildup */
  private readonly PENDING_OPS_WARN_THRESHOLD = 50000;
  private lastPendingWarnTime = 0;

  /**
   * Debounce buffer for savePlayer calls.
   * Coalesces multiple field updates per player into a single DB write.
   * Flushed after a short delay (one microtask batch) so rapid XP drops,
   * skill updates, and position saves merge into one UPDATE per player.
   */
  private pendingSaveBuffer = new Map<string, PlayerPersistenceUpdate>();
  private saveFlushScheduled = false;

  /**
   * Serialize generic and awaited player-row writes. Concurrent UPDATE
   * transactions can otherwise commit out of invocation order and let an older
   * health/position snapshot overwrite a newer shutdown or reconnect snapshot.
   */
  private playerSaveWriteTail: Promise<void> = Promise.resolve();

  /**
   * Debounce buffer for savePlayerInventory calls.
   * Keeps only the latest snapshot per player — later calls overwrite earlier ones.
   * Prevents concurrent UPSERTs on the same inventory rows (PostgreSQL deadlock).
   */
  private pendingInventoryBuffer = new Map<string, InventorySaveItem[]>();
  private inventoryFlushScheduled = false;

  /**
   * Write coalescing for inventory persistence.
   * When multiple savePlayerInventoryAsync calls arrive for the same player,
   * only the LATEST snapshot is written. At most 2 DB transactions run per
   * player: one active + one queued batch with the newest data.
   * Prevents both PostgreSQL deadlocks and connection pool starvation.
   */
  private inventoryWriteActive = new Map<string, Promise<void>>();
  private inventoryWriteQueued = new Map<
    string,
    {
      items: InventorySaveItem[];
      waiters: Array<{
        resolve: () => void;
        reject: (err: unknown) => void;
      }>;
    }
  >();

  private trackAsyncOperation<T>(operation: Promise<T>): void {
    if (this.isDestroying) return; // Skip during shutdown

    // Warn (but don't drop) if pending operations are accumulating
    if (this.pendingOperations.size >= this.PENDING_OPS_WARN_THRESHOLD) {
      const now = Date.now();
      if (now - this.lastPendingWarnTime > 5000) {
        console.warn(
          `[DatabaseSystem] ${this.pendingOperations.size} pending operations — possible DB slowdown`,
        );
        this.lastPendingWarnTime = now;
      }
    }

    const tracked = operation
      .catch((err) => {
        console.error("[DatabaseSystem] Error in tracked operation:", err);
      })
      .finally(() => {
        this.pendingOperations.delete(tracked);
      });

    this.pendingOperations.add(tracked);
  }

  /** Track an awaited custody operation so graceful shutdown waits for it too. */
  private trackAwaitedOperation<T>(operation: Promise<T>): Promise<T> {
    const tracked = operation.finally(() => {
      this.pendingOperations.delete(tracked);
    });
    this.pendingOperations.add(tracked);
    return tracked;
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  /**
   * Execute a callback within a database transaction
   *
   * Provides all-or-nothing execution semantics:
   * - If callback completes successfully → automatic COMMIT
   * - If callback throws error → automatic ROLLBACK
   *
   * CRITICAL FOR SECURITY: Prevents partial database states that can lead to
   * item duplication or item loss (e.g., inventory cleared but gravestone not spawned).
   *
   * Added isolationLevel option for stricter transaction guarantees.
   * Use 'serializable' for death processing to prevent race conditions.
   *
   * @param callback - Async function that receives transaction context
   * @param options - Optional transaction configuration
   * @param options.isolationLevel - Transaction isolation level (default: 'read committed')
   * @returns The result of the callback
   *
   * @example
   * ```typescript
   * // Standard transaction
   * await dbSystem.executeInTransaction(async (tx) => {
   *   await tx.insert(table1).values({...});
   *   await tx.insert(table2).values({...});
   *   // If either fails, both are rolled back
   * });
   *
   * // Serializable transaction for critical operations
   * await dbSystem.executeInTransaction(async (tx) => {
   *   // Fully serialized - prevents all race conditions
   *   await tx.insert(inventory).values({...});
   * }, { isolationLevel: 'serializable' });
   * ```
   */
  async executeInTransaction<T>(
    callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
    options?: {
      isolationLevel?: IsolationLevel;
      maxConflictRetries?: number;
      conflictRetryBaseDelayMs?: number;
    },
  ): Promise<T> {
    if (!this.db || !this.pool) {
      throw new Error(
        "[DatabaseSystem] Database not initialized - cannot start transaction",
      );
    }

    return runInPostgresTransaction(this.pool, callback, {
      isolationLevel: options?.isolationLevel ?? "read committed",
      maxConflictRetries: options?.maxConflictRetries,
      conflictRetryBaseDelayMs: options?.conflictRetryBaseDelayMs,
    });
  }

  // ============================================================================
  // CHARACTER MANAGEMENT
  // ============================================================================

  /**
   * Get all characters for an account
   * Delegates to CharacterRepository
   */
  async getCharactersAsync(accountId: string): Promise<
    Array<{
      id: string;
      name: string;
      avatar?: string | null;
      wallet?: string | null;
      isAgent?: boolean;
    }>
  > {
    return this.characterRepository.getCharactersAsync(accountId);
  }

  /**
   * Create a new character
   * Delegates to CharacterRepository
   */
  async createCharacter(
    accountId: string,
    id: string,
    name: string,
    avatar?: string,
    wallet?: string,
    isAgent?: boolean,
  ): Promise<boolean> {
    return this.characterRepository.createCharacter(
      accountId,
      id,
      name,
      avatar,
      wallet,
      isAgent,
    );
  }

  /**
   * Delete a character by ID
   * Delegates to CharacterRepository
   *
   * Used when users cancel agent creation or explicitly delete unwanted characters.
   *
   * @param characterId - The character ID to delete
   * @returns true if character was deleted, false if not found
   */
  async deleteCharacter(characterId: string): Promise<boolean> {
    return this.characterRepository.deleteCharacter(characterId);
  }

  /**
   * Update character's isAgent flag
   * Delegates to CharacterRepository
   *
   * Converts a character between agent and human types. Used when users
   * decide to convert an abandoned agent character to play themselves.
   *
   * @param characterId - The character ID to update
   * @param isAgent - New value for isAgent flag
   * @returns true if character was updated, false if not found
   */
  async updateCharacterIsAgent(
    characterId: string,
    isAgent: boolean,
  ): Promise<boolean> {
    return this.characterRepository.updateCharacterIsAgent(
      characterId,
      isAgent,
    );
  }

  /**
   * Get character skills
   * Delegates to CharacterRepository
   *
   * Retrieves skill levels and XP for a character. Used by the dashboard
   * to display agent skill progress in real-time.
   *
   * @param characterId - The character ID to fetch skills for
   * @returns Skills object with level and xp for each skill, or null if not found
   */
  async getCharacterSkills(characterId: string): Promise<{
    attack: { level: number; xp: number };
    strength: { level: number; xp: number };
    defense: { level: number; xp: number };
    constitution: { level: number; xp: number };
    ranged: { level: number; xp: number };
    prayer: { level: number; xp: number };
    woodcutting: { level: number; xp: number };
    mining: { level: number; xp: number };
    fishing: { level: number; xp: number };
    firemaking: { level: number; xp: number };
    cooking: { level: number; xp: number };
    smithing: { level: number; xp: number };
    agility: { level: number; xp: number };
    crafting: { level: number; xp: number };
  } | null> {
    return this.characterRepository.getCharacterSkills(characterId);
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Get all character templates
   * Delegates to TemplateRepository
   *
   * Retrieves all available character templates (archetypes) that players
   * can choose from when creating new characters.
   *
   * @returns Array of all character templates
   */
  async getTemplatesAsync(): Promise<
    Array<{
      id: number;
      name: string;
      description: string;
      emoji: string;
      templateUrl: string;
      templateConfig: string | null;
      createdAt: number;
    }>
  > {
    return this.templateRepository.getAllTemplates();
  }

  /**
   * Get template by ID
   * Delegates to TemplateRepository
   *
   * Retrieves a specific character template by its database ID.
   *
   * @param templateId - The template ID to fetch
   * @returns Template data or null if not found
   */
  async getTemplateByIdAsync(templateId: number): Promise<{
    id: number;
    name: string;
    description: string;
    emoji: string;
    templateUrl: string;
    templateConfig: string | null;
    createdAt: number;
  } | null> {
    return this.templateRepository.getTemplateById(templateId);
  }

  /**
   * Get template by name
   * Delegates to TemplateRepository
   *
   * Retrieves a character template by its name (e.g., "The Skiller").
   * Used for legacy filename-based lookups.
   *
   * @param templateName - The template name to search for
   * @returns Template data or null if not found
   */
  async getTemplateByNameAsync(templateName: string): Promise<{
    id: number;
    name: string;
    description: string;
    emoji: string;
    templateUrl: string;
    templateConfig: string | null;
    createdAt: number;
  } | null> {
    return this.templateRepository.getTemplateByName(templateName);
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Update a user's wallet address
   * This assigns the user's main Privy embedded wallet (HD index 0) to their user record
   *
   * @param accountId - The user's Privy account ID
   * @param wallet - The wallet address to assign
   */
  async updateUserWallet(accountId: string, wallet: string): Promise<void> {
    if (!this.db) {
      throw new Error(
        "[DatabaseSystem] Database not initialized - cannot update user wallet",
      );
    }

    await this.db
      .update(schema.users)
      .set({ wallet })
      .where(eq(schema.users.id, accountId));
  }

  /**
   * Get the raw Drizzle database instance
   * This allows other systems to perform custom queries
   *
   * @returns The Drizzle database instance or null if not initialized
   */
  getDb(): NodePgDatabase<typeof schema> | null {
    return this.db;
  }

  // ============================================================================
  // PLAYER DATA PERSISTENCE
  // ============================================================================

  /**
   * Load player data from database
   * Delegates to PlayerRepository
   */
  async getPlayerAsync(playerId: string): Promise<PlayerRow | null> {
    return this.playerRepository.getPlayerAsync(playerId);
  }

  /**
   * Save player data to database
   * Delegates to PlayerRepository
   */
  async savePlayerAsync(
    playerId: string,
    data: PlayerPersistenceUpdate,
  ): Promise<void> {
    // Preserve invocation order with any same-tick generic snapshots. In
    // particular, graceful shutdown's direct snapshot must not be followed by
    // an older zero-delay buffer that commits later.
    this.flushSaveBuffer();
    try {
      return await this.enqueuePlayerSave(() =>
        this.playerRepository.savePlayerAsync(playerId, data),
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] savePlayerAsync(${playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Save complete player state atomically (stats + inventory + equipment)
   *
   * Use this for critical save points where all data must be consistent:
   * - Player logout/disconnect
   * - Trading completion
   * - Death processing
   *
   * Wraps all operations in a single transaction with ROLLBACK on any failure.
   * Prevents partial saves that could lead to item loss or duplication.
   *
   * @param playerId - Player ID to save
   * @param data - Character stats to save (partial update)
   * @param inventory - Complete inventory state
   * @param equipment - Complete equipment state
   * @param options - Transaction options
   */
  async savePlayerCompleteAsync(
    playerId: string,
    data: PlayerPersistenceUpdate,
    inventory?: InventorySaveItem[],
    equipment?: EquipmentSaveItem[],
    options?: { isolationLevel?: IsolationLevel },
  ): Promise<void> {
    assertGenericPlayerUpdateExcludesPrayerAuthority(
      data,
      "DatabaseSystem.savePlayerCompleteAsync",
    );
    if (!this.db) {
      throw new Error("[DatabaseSystem] Database not initialized");
    }

    return this.executeInTransaction(
      async (tx) => {
        // Save character stats
        if (Object.keys(data).length > 0) {
          const updateData: Partial<
            Omit<typeof schema.characters.$inferInsert, "id" | "accountId">
          > = {};

          // Map all PlayerRow fields (same logic as PlayerRepository.savePlayerAsync)
          if (data.name && data.name.trim().length > 0)
            updateData.name = data.name;
          if (data.combatLevel !== undefined)
            updateData.combatLevel = data.combatLevel;
          if (data.attackLevel !== undefined)
            updateData.attackLevel = data.attackLevel;
          if (data.strengthLevel !== undefined)
            updateData.strengthLevel = data.strengthLevel;
          if (data.defenseLevel !== undefined)
            updateData.defenseLevel = data.defenseLevel;
          if (data.constitutionLevel !== undefined)
            updateData.constitutionLevel = data.constitutionLevel;
          if (data.rangedLevel !== undefined)
            updateData.rangedLevel = data.rangedLevel;
          if (data.magicLevel !== undefined)
            updateData.magicLevel = data.magicLevel;
          if (data.woodcuttingLevel !== undefined)
            updateData.woodcuttingLevel = data.woodcuttingLevel;
          if (data.miningLevel !== undefined)
            updateData.miningLevel = data.miningLevel;
          if (data.fishingLevel !== undefined)
            updateData.fishingLevel = data.fishingLevel;
          if (data.firemakingLevel !== undefined)
            updateData.firemakingLevel = data.firemakingLevel;
          if (data.cookingLevel !== undefined)
            updateData.cookingLevel = data.cookingLevel;
          if (data.smithingLevel !== undefined)
            updateData.smithingLevel = data.smithingLevel;
          if (data.agilityLevel !== undefined)
            updateData.agilityLevel = data.agilityLevel;
          if (data.craftingLevel !== undefined)
            updateData.craftingLevel = data.craftingLevel;
          if (data.fletchingLevel !== undefined)
            updateData.fletchingLevel = data.fletchingLevel;
          if (data.runecraftingLevel !== undefined)
            updateData.runecraftingLevel = data.runecraftingLevel;
          // XP fields
          if (data.attackXp !== undefined) updateData.attackXp = data.attackXp;
          if (data.strengthXp !== undefined)
            updateData.strengthXp = data.strengthXp;
          if (data.defenseXp !== undefined)
            updateData.defenseXp = data.defenseXp;
          if (data.constitutionXp !== undefined)
            updateData.constitutionXp = data.constitutionXp;
          if (data.rangedXp !== undefined) updateData.rangedXp = data.rangedXp;
          if (data.magicXp !== undefined) updateData.magicXp = data.magicXp;
          if (data.woodcuttingXp !== undefined)
            updateData.woodcuttingXp = data.woodcuttingXp;
          if (data.miningXp !== undefined) updateData.miningXp = data.miningXp;
          if (data.fishingXp !== undefined)
            updateData.fishingXp = data.fishingXp;
          if (data.firemakingXp !== undefined)
            updateData.firemakingXp = data.firemakingXp;
          if (data.cookingXp !== undefined)
            updateData.cookingXp = data.cookingXp;
          if (data.smithingXp !== undefined)
            updateData.smithingXp = data.smithingXp;
          if (data.agilityXp !== undefined)
            updateData.agilityXp = data.agilityXp;
          if (data.craftingXp !== undefined)
            updateData.craftingXp = data.craftingXp;
          if (data.fletchingXp !== undefined)
            updateData.fletchingXp = data.fletchingXp;
          if (data.runecraftingXp !== undefined)
            updateData.runecraftingXp = data.runecraftingXp;
          // Core fields
          if (data.health !== undefined) updateData.health = data.health;
          if (data.maxHealth !== undefined)
            updateData.maxHealth = data.maxHealth;
          if (data.coins !== undefined) updateData.coins = data.coins;
          if (data.positionX !== undefined)
            updateData.positionX = data.positionX;
          if (data.positionY !== undefined)
            updateData.positionY = data.positionY;
          if (data.positionZ !== undefined)
            updateData.positionZ = data.positionZ;
          // Combat preferences
          if (data.autoRetaliate !== undefined)
            updateData.autoRetaliate = data.autoRetaliate;
          if (data.attackStyle !== undefined)
            updateData.attackStyle = data.attackStyle;
          if (data.selectedSpell !== undefined)
            updateData.selectedSpell = data.selectedSpell;
          if (Object.keys(updateData).length > 0) {
            await tx
              .update(schema.characters)
              .set(updateData)
              .where(eq(schema.characters.id, playerId));
          }
        }

        // Save inventory if provided
        if (inventory) {
          const validItems = inventory.filter(
            (item) => (item.slotIndex ?? -1) >= 0,
          );
          const occupiedSlots = validItems.map((item) => item.slotIndex!);

          // Delete items not in occupied slots
          if (occupiedSlots.length > 0) {
            await tx.execute(
              sql`DELETE FROM inventory
                  WHERE "playerId" = ${playerId}
                  AND "slotIndex" >= 0
                  AND "slotIndex" NOT IN (${sql.join(
                    occupiedSlots.map((s) => sql`${s}`),
                    sql`, `,
                  )})`,
            );
          } else {
            await tx
              .delete(schema.inventory)
              .where(eq(schema.inventory.playerId, playerId));
          }

          // Persist current items with per-slot replacement.
          // Some local/dev databases can miss the partial unique index used by
          // ON CONFLICT, which would raise 42P10 and abort startup.
          for (const item of validItems) {
            const slotIndex = item.slotIndex!;
            const metadata = item.metadata
              ? JSON.stringify(item.metadata)
              : null;

            await tx.execute(
              sql`DELETE FROM inventory
                  WHERE "playerId" = ${playerId}
                  AND "slotIndex" = ${slotIndex}`,
            );
            await tx.execute(
              sql`INSERT INTO inventory ("playerId", "itemId", "quantity", "slotIndex", "metadata")
                  VALUES (${playerId}, ${item.itemId}, ${item.quantity}, ${slotIndex}, ${metadata})`,
            );
          }
        }

        // Save equipment if provided
        if (equipment) {
          const validEquipment = equipment.filter(
            (item) => item.slotType !== undefined,
          );
          const occupiedSlots = validEquipment.map((item) => item.slotType);

          // Delete equipment not in occupied slots
          if (occupiedSlots.length > 0) {
            await tx.execute(
              sql`DELETE FROM equipment
                  WHERE "playerId" = ${playerId}
                  AND "slot" NOT IN (${sql.join(
                    occupiedSlots.map((s) => sql`${s}`),
                    sql`, `,
                  )})`,
            );
          } else {
            await tx
              .delete(schema.equipment)
              .where(eq(schema.equipment.playerId, playerId));
          }

          // Upsert current equipment
          for (const item of validEquipment) {
            const slot = item.slotType;
            await tx.execute(
              sql`INSERT INTO equipment ("playerId", "slot", "itemId")
                  VALUES (${playerId}, ${slot}, ${item.itemId})
                  ON CONFLICT ("playerId", "slot")
                  DO UPDATE SET "itemId" = EXCLUDED."itemId"`,
            );
          }
        }
      },
      { isolationLevel: options?.isolationLevel ?? "read committed" },
    );
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Load player inventory from database
   * Delegates to InventoryRepository
   */
  async getPlayerInventoryAsync(playerId: string): Promise<InventoryRow[]> {
    return this.inventoryRepository.getPlayerInventoryAsync(playerId);
  }

  /**
   * Save player inventory to database with write coalescing.
   * If a write is already active for this player, the latest items snapshot
   * is queued and all waiting callers resolve when that batch completes.
   * This collapses N concurrent calls into at most 2 DB transactions.
   */
  async savePlayerInventoryAsync(
    playerId: string,
    items: InventorySaveItem[],
  ): Promise<void> {
    // If a write is already running for this player, coalesce into the queued batch
    if (this.inventoryWriteActive.has(playerId)) {
      return new Promise<void>((resolve, reject) => {
        const queued = this.inventoryWriteQueued.get(playerId);
        if (queued) {
          // Replace items with the latest snapshot — only the newest matters
          queued.items = items;
          queued.waiters.push({ resolve, reject });
        } else {
          this.inventoryWriteQueued.set(playerId, {
            items,
            waiters: [{ resolve, reject }],
          });
        }
      });
    }

    // No active write — execute immediately
    await this.executeInventoryWrite(playerId, items);
  }

  /**
   * Execute a single inventory write and drain any queued batch afterward.
   */
  private async executeInventoryWrite(
    playerId: string,
    items: InventorySaveItem[],
  ): Promise<void> {
    const writePromise = this.inventoryRepository.savePlayerInventoryAsync(
      playerId,
      items,
    );
    this.inventoryWriteActive.set(playerId, writePromise);

    try {
      await writePromise;
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] savePlayerInventoryAsync(${playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
      } else {
        throw error;
      }
    } finally {
      this.inventoryWriteActive.delete(playerId);

      // Drain the queued batch if any calls arrived while we were writing
      const queued = this.inventoryWriteQueued.get(playerId);
      if (queued) {
        this.inventoryWriteQueued.delete(playerId);
        try {
          await this.executeInventoryWrite(playerId, queued.items);
          for (const w of queued.waiters) w.resolve();
        } catch (err) {
          for (const w of queued.waiters) w.reject(err);
        }
      }
    }
  }

  // ============================================================================
  // EQUIPMENT MANAGEMENT
  // ============================================================================

  /**
   * Load player equipment from database
   * Delegates to EquipmentRepository
   */
  async getPlayerEquipmentAsync(playerId: string): Promise<EquipmentRow[]> {
    return this.equipmentRepository.getPlayerEquipmentAsync(playerId);
  }

  /**
   * Save player equipment to database
   * Delegates to EquipmentRepository
   */
  async savePlayerEquipmentAsync(
    playerId: string,
    items: EquipmentSaveItem[],
  ): Promise<void> {
    try {
      return await this.equipmentRepository.savePlayerEquipmentAsync(
        playerId,
        items,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] savePlayerEquipmentAsync(${playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Commit one complete combat-loadout transition and its durable receipt in a
   * single transaction. A character-row lock serializes all switch writers for
   * that player across scheduler processes. The expected snapshot prevents a
   * stale process from overwriting more recent custody state.
   */
  async commitCombatLoadoutOperationAsync(
    request: CombatLoadoutCommitRequest,
  ): Promise<CombatLoadoutCommitReceipt> {
    if (!this.db) {
      throw new Error("combat_loadout_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    if (
      !operationId ||
      operationId.length > 256 ||
      !playerId ||
      !requestFingerprint ||
      requestFingerprint.length > 512
    ) {
      throw new Error("combat_loadout_request_invalid");
    }
    const expected = normalizeCombatLoadoutSnapshot(request.expected);
    const committed = normalizeCombatLoadoutSnapshot(request.committed);

    return this.executeInTransaction(
      async (tx) => {
        // This lock is the cluster-wide per-character serialization boundary.
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({
            id: schema.characters.id,
            selectedSpell: schema.characters.selectedSpell,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        const character = characterRows[0];
        if (!character) {
          throw new Error("combat_loadout_player_missing");
        }

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredCombatLoadoutOperation | undefined;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "combat_loadout_switch" ||
            existing.completed !== true ||
            state?.version !== 1 ||
            state.requestFingerprint !== requestFingerprint
          ) {
            throw new Error("combat_loadout_operation_id_conflict");
          }
          const replayedCommitted = normalizeCombatLoadoutSnapshot(
            state.committed,
          );
          if (!combatLoadoutSnapshotsEqual(replayedCommitted, committed)) {
            throw new Error("combat_loadout_operation_id_conflict");
          }
          return {
            operationId,
            playerId,
            requestFingerprint,
            replayed: true,
            committed: replayedCommitted,
          };
        }

        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        const equipmentRows = await tx
          .select({
            slotType: schema.equipment.slotType,
            itemId: schema.equipment.itemId,
            quantity: schema.equipment.quantity,
          })
          .from(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));
        const persisted = normalizeCombatLoadoutSnapshot({
          inventory: inventoryRows.map((row) => {
            let metadata: Record<string, string | number | boolean> | null =
              null;
            if (row.metadata) {
              try {
                const parsed = JSON.parse(row.metadata) as unknown;
                if (parsed && typeof parsed === "object") {
                  metadata = parsed as Record<
                    string,
                    string | number | boolean
                  >;
                }
              } catch {
                throw new Error("combat_loadout_inventory_metadata_invalid");
              }
            }
            return {
              itemId: row.itemId,
              quantity: row.quantity ?? 1,
              slotIndex: row.slotIndex ?? -1,
              metadata,
            };
          }),
          equipment: equipmentRows
            .filter((row) => Boolean(row.itemId))
            .map((row) => ({
              slotType: row.slotType,
              itemId: row.itemId!,
              quantity: row.quantity ?? 1,
            })),
          selectedSpell: character.selectedSpell ?? null,
        });
        if (!combatLoadoutSnapshotsEqual(persisted, expected)) {
          throw new Error("combat_loadout_state_conflict");
        }

        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        if (committed.inventory.length > 0) {
          await tx.insert(schema.inventory).values(
            committed.inventory.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }

        await tx
          .delete(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));
        if (committed.equipment.length > 0) {
          await tx.insert(schema.equipment).values(
            committed.equipment.map((item) => ({
              playerId,
              slotType: item.slotType,
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          );
        }

        await tx
          .update(schema.characters)
          .set({ selectedSpell: committed.selectedSpell })
          .where(eq(schema.characters.id, playerId));

        const operationState: StoredCombatLoadoutOperation = {
          version: 1,
          requestFingerprint,
          committed,
        };
        const now = Date.now();
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "combat_loadout_switch",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });

        return {
          operationId,
          playerId,
          requestFingerprint,
          replayed: false,
          committed,
        };
      },
      { isolationLevel: "serializable" },
    );
  }

  /**
   * Commit one selected contestant's complete bank, inventory, equipment, and
   * autocast preparation as a single durable transition. Exact replays remain
   * readable after readiness, while every new mutation requires the active
   * database-clock preparation capability and conserves all item custody.
   */
  async commitDuelPreparationPlanOperationAsync(
    request: DuelPreparationPlanCommitRequest,
  ): Promise<DuelPreparationPlanCommitReceipt> {
    if (!this.db || !this.pool) {
      throw new Error("duel_preparation_plan_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const preparationId = String(request.preparationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    if (
      !operationId ||
      operationId.length > 256 ||
      !preparationId ||
      preparationId.length > 256 ||
      !playerId ||
      !requestFingerprint ||
      requestFingerprint.length > 512
    ) {
      throw new Error("duel_preparation_plan_request_invalid");
    }
    const expected = normalizeDuelPreparationPlanSnapshot(request.expected);
    const committed = normalizeDuelPreparationPlanSnapshot(request.committed);
    const recoveryEvidence = normalizeDuelPreparationPlanRecoveryEvidence(
      request.recoveryEvidence,
    );
    if (!duelPreparationPlanCustodyIsConserved(expected, committed)) {
      throw new Error("duel_preparation_plan_custody_violation");
    }

    return runInPostgresTransaction(
      this.pool,
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({
            id: schema.characters.id,
            selectedSpell: schema.characters.selectedSpell,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        const character = characterRows[0];
        if (!character) {
          throw new Error("duel_preparation_plan_player_missing");
        }

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredDuelPreparationPlanOperation | undefined;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "duel_preparation_plan" ||
            existing.completed !== true ||
            state?.version !== 2 ||
            state.preparationId !== preparationId ||
            state.requestFingerprint !== requestFingerprint ||
            JSON.stringify(
              normalizeDuelPreparationPlanRecoveryEvidence(
                state.recoveryEvidence,
              ),
            ) !== JSON.stringify(recoveryEvidence)
          ) {
            throw new Error("duel_preparation_plan_operation_id_conflict");
          }
          const replayedCommitted = normalizeDuelPreparationPlanSnapshot(
            state.committed,
          );
          if (
            !duelPreparationPlanSnapshotsEqual(replayedCommitted, committed)
          ) {
            throw new Error("duel_preparation_plan_operation_id_conflict");
          }
          return {
            operationId,
            preparationId,
            playerId,
            requestFingerprint,
            replayed: true,
            committed: replayedCommitted,
            recoveryEvidence,
          };
        }

        await tx.execute(
          sql`SELECT "preparationId" FROM "streaming_duel_preparations" WHERE "preparationId" = ${preparationId} FOR UPDATE`,
        );
        const preparationRows = await tx
          .select({
            agent1Id: schema.streamingDuelPreparations.agent1Id,
            agent2Id: schema.streamingDuelPreparations.agent2Id,
            allowedBankActions:
              schema.streamingDuelPreparations.allowedBankActions,
            status: schema.streamingDuelPreparations.status,
            expiresAt: schema.streamingDuelPreparations.expiresAt,
            agent1ReadyAt: schema.streamingDuelPreparations.agent1ReadyAt,
            agent2ReadyAt: schema.streamingDuelPreparations.agent2ReadyAt,
          })
          .from(schema.streamingDuelPreparations)
          .where(
            eq(schema.streamingDuelPreparations.preparationId, preparationId),
          );
        const preparation = preparationRows[0];
        if (!preparation) {
          throw new Error("duel_preparation_plan_preparation_not_found");
        }
        const clockResult = await tx.execute(
          sql`SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint AS "databaseNow"`,
        );
        const databaseNow = Number(
          (
            clockResult as unknown as {
              rows?: Array<{ databaseNow?: number | string }>;
            }
          ).rows?.[0]?.databaseNow,
        );
        if (!Number.isFinite(databaseNow)) {
          throw new Error("duel_preparation_plan_database_clock_invalid");
        }
        if (Number(preparation.expiresAt) <= databaseNow) {
          throw new Error("duel_preparation_plan_preparation_expired");
        }
        if (preparation.status !== "preparing") {
          throw new Error("duel_preparation_plan_preparation_not_active");
        }
        const isAgent1 = preparation.agent1Id === playerId;
        const isAgent2 = preparation.agent2Id === playerId;
        if (!isAgent1 && !isAgent2) {
          throw new Error("duel_preparation_plan_agent_mismatch");
        }
        if (
          (isAgent1 && preparation.agent1ReadyAt !== null) ||
          (isAgent2 && preparation.agent2ReadyAt !== null)
        ) {
          throw new Error("duel_preparation_plan_agent_ready");
        }

        const expectedBankByItem = new Map<string, number>();
        const committedBankByItem = new Map<string, number>();
        for (const row of expected.bank) {
          expectedBankByItem.set(
            row.itemId,
            (expectedBankByItem.get(row.itemId) ?? 0) + row.quantity,
          );
        }
        for (const row of committed.bank) {
          committedBankByItem.set(
            row.itemId,
            (committedBankByItem.get(row.itemId) ?? 0) + row.quantity,
          );
        }
        let requiresDeposit = false;
        let requiresWithdraw = false;
        for (const itemId of new Set([
          ...expectedBankByItem.keys(),
          ...committedBankByItem.keys(),
        ])) {
          const before = expectedBankByItem.get(itemId) ?? 0;
          const after = committedBankByItem.get(itemId) ?? 0;
          if (after > before) requiresDeposit = true;
          if (after < before) requiresWithdraw = true;
        }
        const allowedActions = new Set(preparation.allowedBankActions);
        if (
          (requiresDeposit && !allowedActions.has("deposit")) ||
          (requiresWithdraw && !allowedActions.has("withdraw"))
        ) {
          throw new Error("duel_preparation_plan_action_not_allowed");
        }

        // A pg PoolClient permits only one active query. Keep every read on the
        // same explicit transaction client and await them in order.
        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        const equipmentRows = await tx
          .select({
            slotType: schema.equipment.slotType,
            itemId: schema.equipment.itemId,
            quantity: schema.equipment.quantity,
          })
          .from(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));
        const bankRows = await tx
          .select({
            itemId: schema.bankStorage.itemId,
            quantity: schema.bankStorage.quantity,
            slot: schema.bankStorage.slot,
            tabIndex: schema.bankStorage.tabIndex,
          })
          .from(schema.bankStorage)
          .where(eq(schema.bankStorage.playerId, playerId));
        const persisted = normalizeDuelPreparationPlanSnapshot({
          inventory: inventoryRows.map((row) => {
            let metadata: Record<string, string | number | boolean> | null =
              null;
            if (row.metadata) {
              try {
                const parsed = JSON.parse(row.metadata) as unknown;
                if (parsed && typeof parsed === "object") {
                  metadata = parsed as Record<
                    string,
                    string | number | boolean
                  >;
                }
              } catch {
                throw new Error("duel_preparation_plan_metadata_invalid");
              }
            }
            return {
              itemId: row.itemId,
              quantity: row.quantity ?? 1,
              slotIndex: row.slotIndex ?? -1,
              metadata,
            };
          }),
          equipment: equipmentRows
            .filter((row) => Boolean(row.itemId))
            .map((row) => ({
              slotType: row.slotType,
              itemId: row.itemId!,
              quantity: row.quantity ?? 1,
            })),
          selectedSpell: character.selectedSpell ?? null,
          bank: bankRows,
        });
        if (!duelPreparationPlanSnapshotsEqual(persisted, expected)) {
          const mismatchKinds = duelPreparationPlanSnapshotMismatchKinds(
            persisted,
            expected,
          );
          throw new Error(
            `duel_preparation_plan_state_conflict:${mismatchKinds.join(",") || "unknown"}`,
          );
        }

        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        if (committed.inventory.length > 0) {
          await tx.insert(schema.inventory).values(
            committed.inventory.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }
        await tx
          .delete(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));
        if (committed.equipment.length > 0) {
          await tx.insert(schema.equipment).values(
            committed.equipment.map((item) => ({
              playerId,
              slotType: item.slotType,
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          );
        }
        await tx
          .delete(schema.bankStorage)
          .where(eq(schema.bankStorage.playerId, playerId));
        if (committed.bank.length > 0) {
          await tx.insert(schema.bankStorage).values(
            committed.bank.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slot: item.slot,
              tabIndex: item.tabIndex,
            })),
          );
        }
        await tx
          .update(schema.characters)
          .set({ selectedSpell: committed.selectedSpell })
          .where(eq(schema.characters.id, playerId));

        const operationState: StoredDuelPreparationPlanOperation = {
          version: 2,
          preparationId,
          requestFingerprint,
          committed,
          recoveryEvidence,
        };
        const now = databaseNow;
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "duel_preparation_plan",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });

        return {
          operationId,
          preparationId,
          playerId,
          requestFingerprint,
          replayed: false,
          committed,
          recoveryEvidence,
        };
      },
      {
        isolationLevel: "serializable",
        // Both contestants prepare concurrently and serialize on their shared
        // preparation row. PostgreSQL intentionally aborts one SSI snapshot;
        // retry the complete rolled-back transaction on a fresh connection.
        maxConflictRetries: 4,
      },
    );
  }

  /**
   * Resolve an immutable selected-contestant plan after process loss. The
   * active preparation row is checked under the same transaction so a stale or
   * terminal session cannot reopen private custody or readiness evidence.
   */
  async getDuelPreparationPlanOperationAsync(
    request: DuelPreparationPlanRecoveryRequest,
  ): Promise<DuelPreparationPlanCommitReceipt | null> {
    if (!this.db || !this.pool) {
      throw new Error("duel_preparation_plan_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const preparationId = String(request.preparationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    if (
      !operationId ||
      operationId.length > 256 ||
      !preparationId ||
      preparationId.length > 256 ||
      !playerId
    ) {
      throw new Error("duel_preparation_plan_request_invalid");
    }

    return runInPostgresTransaction(
      this.pool,
      async (tx) => {
        await tx.execute(
          sql`SELECT "preparationId" FROM "streaming_duel_preparations" WHERE "preparationId" = ${preparationId} FOR SHARE`,
        );
        const preparationRows = await tx
          .select({
            agent1Id: schema.streamingDuelPreparations.agent1Id,
            agent2Id: schema.streamingDuelPreparations.agent2Id,
            status: schema.streamingDuelPreparations.status,
            expiresAt: schema.streamingDuelPreparations.expiresAt,
          })
          .from(schema.streamingDuelPreparations)
          .where(
            eq(schema.streamingDuelPreparations.preparationId, preparationId),
          );
        const preparation = preparationRows[0];
        if (
          !preparation ||
          (preparation.agent1Id !== playerId &&
            preparation.agent2Id !== playerId) ||
          !["preparing", "ready"].includes(preparation.status)
        ) {
          return null;
        }
        const clockResult = await tx.execute(
          sql`SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint AS "databaseNow"`,
        );
        const databaseNow = Number(
          (
            clockResult as unknown as {
              rows?: Array<{ databaseNow?: number | string }>;
            }
          ).rows?.[0]?.databaseNow,
        );
        if (
          !Number.isFinite(databaseNow) ||
          Number(preparation.expiresAt) <= databaseNow
        ) {
          return null;
        }

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (!existing) return null;
        const state = existing.operationState as
          StoredDuelPreparationPlanOperation | undefined;
        if (
          existing.playerId !== playerId ||
          existing.operationType !== "duel_preparation_plan" ||
          existing.completed !== true ||
          state?.version !== 2 ||
          state.preparationId !== preparationId ||
          !state.requestFingerprint
        ) {
          throw new Error("duel_preparation_plan_operation_id_conflict");
        }
        return {
          operationId,
          preparationId,
          playerId,
          requestFingerprint: state.requestFingerprint,
          replayed: true,
          committed: normalizeDuelPreparationPlanSnapshot(state.committed),
          recoveryEvidence: normalizeDuelPreparationPlanRecoveryEvidence(
            state.recoveryEvidence,
          ),
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }

  /**
   * Debit several inventory item types as one durable operation. The database
   * computes the new snapshot while holding the same character-row lock used by
   * combat-loadout switches, so a spell can never consume only some of its
   * required runes or race a frozen loadout transition.
   */
  async commitInventoryDebitOperationAsync(
    request: InventoryDebitCommitRequest,
  ): Promise<InventoryDebitCommitReceipt> {
    if (!this.db) {
      throw new Error("inventory_debit_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    if (
      !operationId ||
      operationId.length > 256 ||
      !playerId ||
      !/^[a-f0-9]{64}$/.test(requestFingerprint)
    ) {
      throw new Error("inventory_debit_request_invalid");
    }
    const requirements = normalizeInventoryDebitRequirements(
      request.requirements,
    );
    if (
      requestFingerprint !== inventoryDebitFingerprint(playerId, requirements)
    ) {
      throw new Error("inventory_debit_request_invalid");
    }

    return this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({ id: schema.characters.id })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        if (!characterRows[0]) {
          throw new Error("inventory_debit_player_missing");
        }

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredInventoryDebitOperation | undefined;
          const replayedRequirements = state?.requirements
            ? normalizeInventoryDebitRequirements(state.requirements)
            : null;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "inventory_debit" ||
            existing.completed !== true ||
            state?.version !== 1 ||
            state.requestFingerprint !== requestFingerprint ||
            !replayedRequirements ||
            JSON.stringify(replayedRequirements) !==
              JSON.stringify(requirements)
          ) {
            throw new Error("inventory_debit_operation_id_conflict");
          }
          // Return the current locked database snapshot, not the historical
          // post-state. Replaying an older operation after newer debits must
          // never roll live memory backward.
          const currentRows = await tx
            .select({
              itemId: schema.inventory.itemId,
              quantity: schema.inventory.quantity,
              slotIndex: schema.inventory.slotIndex,
              metadata: schema.inventory.metadata,
            })
            .from(schema.inventory)
            .where(eq(schema.inventory.playerId, playerId));
          const replayedCommitted = normalizePersistedInventoryRows(
            currentRows,
            "inventory_debit",
          );
          return {
            operationId,
            playerId,
            requestFingerprint,
            replayed: true,
            requirements: replayedRequirements,
            committed: replayedCommitted,
          };
        }

        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        const persisted = normalizePersistedInventoryRows(
          inventoryRows,
          "inventory_debit",
        );
        const committed = debitInventorySnapshot(persisted, requirements);

        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        if (committed.length > 0) {
          await tx.insert(schema.inventory).values(
            committed.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }

        const operationState: StoredInventoryDebitOperation = {
          version: 1,
          requestFingerprint,
          requirements,
          committed,
        };
        const now = Date.now();
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "inventory_debit",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });

        return {
          operationId,
          playerId,
          requestFingerprint,
          replayed: false,
          requirements,
          committed,
        };
      },
      { isolationLevel: "serializable" },
    );
  }

  /**
   * Consume one exact bone and award its Prayer progression as one immutable,
   * idempotent custody transition. The same character-row lock also serializes
   * prayer drains/toggles, inventory actions, and loadout transitions.
   */
  async commitBoneBurialOperationAsync(
    request: BoneBurialCommitRequest,
  ): Promise<BoneBurialCommitReceipt> {
    if (!this.db || this.isDestroying) {
      throw new Error("bone_burial_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    const itemId = String(request.itemId ?? "").trim();
    const xpAmount = Number(request.xpAmount);
    const levelRequired = Number(request.levelRequired);
    if (
      !BONE_BURIAL_OPERATION_ID_PATTERN.test(operationId) ||
      !playerId ||
      playerId.length > 128 ||
      !itemId ||
      itemId.length > 256 ||
      !/^[a-f0-9]{64}$/.test(requestFingerprint) ||
      !Number.isSafeInteger(xpAmount) ||
      xpAmount <= 0 ||
      xpAmount > 1_000_000 ||
      !Number.isSafeInteger(levelRequired) ||
      levelRequired < 1 ||
      levelRequired > 99 ||
      requestFingerprint !==
        boneBurialFingerprint(playerId, itemId, xpAmount, levelRequired)
    ) {
      throw new Error("bone_burial_request_invalid");
    }

    const operation = this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({
            id: schema.characters.id,
            prayerXp: schema.characters.prayerXp,
            prayerLevel: schema.characters.prayerLevel,
            prayerPoints: schema.characters.prayerPoints,
            prayerPointUnits: schema.characters.prayerPointUnits,
            prayerMaxPoints: schema.characters.prayerMaxPoints,
            activePrayers: schema.characters.activePrayers,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        const character = characterRows[0];
        if (!character) throw new Error("bone_burial_player_missing");

        const persistedXp = Number(character.prayerXp ?? 0);
        const persistedLevel = Number(character.prayerLevel ?? 1);
        if (
          !Number.isSafeInteger(persistedXp) ||
          persistedXp < 0 ||
          persistedXp > MAX_SKILL_XP ||
          !Number.isSafeInteger(persistedLevel) ||
          persistedLevel < 1 ||
          persistedLevel > 99 ||
          skillLevelForXp(persistedXp) !== persistedLevel
        ) {
          throw new Error("bone_burial_skill_state_invalid");
        }
        const persistedPrayer = normalizePrayerSnapshot(
          {
            pointUnits:
              character.prayerPointUnits ??
              (character.prayerPoints ?? persistedLevel) *
                PRAYER_POINT_UNITS_PER_POINT,
            maxPoints: character.prayerMaxPoints ?? persistedLevel,
            activePrayers: character.activePrayers ?? [],
          },
          "bone_burial",
        );
        if (persistedPrayer.maxPoints !== persistedLevel) {
          throw new Error("bone_burial_prayer_state_invalid");
        }

        const existingRows = await tx
          .select({
            playerId: schema.boneBurialOperations.playerId,
            itemId: schema.boneBurialOperations.itemId,
            xpAmount: schema.boneBurialOperations.xpAmount,
            levelRequired: schema.boneBurialOperations.levelRequired,
            awardedXp: schema.boneBurialOperations.awardedXp,
            operationCommittedXp:
              schema.boneBurialOperations.operationCommittedXp,
            committedLevel: schema.boneBurialOperations.committedLevel,
            requestFingerprint: schema.boneBurialOperations.requestFingerprint,
          })
          .from(schema.boneBurialOperations)
          .where(eq(schema.boneBurialOperations.operationId, operationId));
        const existing = existingRows[0];
        if (existing) {
          if (
            existing.playerId !== playerId ||
            existing.itemId !== itemId ||
            existing.xpAmount !== xpAmount ||
            existing.levelRequired !== levelRequired ||
            existing.requestFingerprint !== requestFingerprint ||
            !Number.isSafeInteger(existing.awardedXp) ||
            existing.awardedXp < 0 ||
            existing.awardedXp > xpAmount ||
            !Number.isSafeInteger(existing.operationCommittedXp) ||
            existing.operationCommittedXp < 0 ||
            existing.operationCommittedXp > MAX_SKILL_XP ||
            existing.committedLevel !==
              skillLevelForXp(existing.operationCommittedXp)
          ) {
            throw new Error("bone_burial_operation_id_conflict");
          }
          const currentRows = await tx
            .select({
              itemId: schema.inventory.itemId,
              quantity: schema.inventory.quantity,
              slotIndex: schema.inventory.slotIndex,
              metadata: schema.inventory.metadata,
            })
            .from(schema.inventory)
            .where(eq(schema.inventory.playerId, playerId));
          return {
            operationId,
            playerId,
            requestFingerprint,
            replayed: true,
            itemId,
            xpAmount,
            levelRequired,
            awardedXp: existing.awardedXp,
            operationCommittedXp: existing.operationCommittedXp,
            currentXp: persistedXp,
            currentLevel: persistedLevel,
            committed: normalizePersistedInventoryRows(
              currentRows,
              "bone_burial",
            ),
          };
        }

        if (persistedLevel < levelRequired) {
          throw new Error("bone_burial_level_required");
        }
        if (persistedXp >= MAX_SKILL_XP) {
          throw new Error("bone_burial_xp_cap");
        }

        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        let committed: CommittedInventoryItem[];
        try {
          committed = debitInventorySnapshot(
            normalizePersistedInventoryRows(inventoryRows, "bone_burial"),
            [{ itemId, quantity: 1 }],
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("inventory_debit_insufficient_items")
          ) {
            throw new Error("bone_burial_insufficient_items");
          }
          throw error;
        }

        const operationCommittedXp = Math.min(
          persistedXp + xpAmount,
          MAX_SKILL_XP,
        );
        const awardedXp = operationCommittedXp - persistedXp;
        const currentLevel = skillLevelForXp(operationCommittedXp);
        const levelIncreased = currentLevel > persistedLevel;
        const committedPrayer = {
          pointUnits: levelIncreased
            ? currentLevel * PRAYER_POINT_UNITS_PER_POINT
            : persistedPrayer.pointUnits,
          maxPoints: levelIncreased ? currentLevel : persistedPrayer.maxPoints,
          activePrayers: persistedPrayer.activePrayers,
        };

        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        if (committed.length > 0) {
          await tx.insert(schema.inventory).values(
            committed.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }
        await tx
          .update(schema.characters)
          .set({
            prayerXp: operationCommittedXp,
            prayerLevel: currentLevel,
            prayerPointUnits: committedPrayer.pointUnits,
            prayerPoints:
              committedPrayer.pointUnits <= 0
                ? 0
                : Math.ceil(
                    committedPrayer.pointUnits / PRAYER_POINT_UNITS_PER_POINT,
                  ),
            prayerMaxPoints: committedPrayer.maxPoints,
          })
          .where(eq(schema.characters.id, playerId));
        await tx.insert(schema.boneBurialOperations).values({
          operationId,
          playerId,
          itemId,
          xpAmount,
          levelRequired,
          awardedXp,
          operationCommittedXp,
          committedLevel: currentLevel,
          requestFingerprint,
        });

        return {
          operationId,
          playerId,
          requestFingerprint,
          replayed: false,
          itemId,
          xpAmount,
          levelRequired,
          awardedXp,
          operationCommittedXp,
          currentXp: operationCommittedXp,
          currentLevel,
          committed,
        };
      },
      { isolationLevel: "serializable" },
    );
    return this.trackAwaitedOperation(operation);
  }

  /**
   * Commit one successful gathering roll as a single custody transition. A
   * secondary input, the harvested item, the matching XP/level, and the
   * operation receipt either all commit or all roll back.
   */
  async commitGatheringRewardOperationAsync(
    request: GatheringRewardCommitRequest,
  ): Promise<GatheringRewardCommitReceipt> {
    if (!this.db || this.isDestroying) {
      throw new Error("gathering_reward_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    const resourceId = String(request.resourceId ?? "").trim();
    const depleteAfterCommit = request.depleteAfterCommit === true;
    const respawnTicks = Number(request.respawnTicks);
    const skill = String(request.skill ?? "").trim() as GatheringRewardSkill;
    const xpAmount = Number(request.xpAmount);
    if (
      !operationId ||
      operationId.length > 256 ||
      !playerId ||
      !resourceId ||
      resourceId.length > 256 ||
      !/^[a-f0-9]{64}$/.test(requestFingerprint) ||
      typeof request.depleteAfterCommit !== "boolean" ||
      !Number.isSafeInteger(respawnTicks) ||
      respawnTicks < 0 ||
      respawnTicks > 10_000_000 ||
      (depleteAfterCommit && respawnTicks <= 0) ||
      !GATHERING_REWARD_SKILLS.has(skill) ||
      !Number.isFinite(xpAmount) ||
      xpAmount <= 0 ||
      xpAmount > MAX_GATHERING_REWARD_XP
    ) {
      throw new Error("gathering_reward_request_invalid");
    }
    const reward = normalizeGatheringReward(request.reward);
    const secondaryItemId = normalizeGatheringSecondaryItemId(
      request.secondaryItemId,
    );
    if (
      requestFingerprint !==
      gatheringRewardFingerprint(
        playerId,
        resourceId,
        depleteAfterCommit,
        respawnTicks,
        skill,
        xpAmount,
        reward,
        secondaryItemId,
      )
    ) {
      throw new Error("gathering_reward_request_invalid");
    }

    const operation = this.executeInTransaction(
      async (tx) => {
        // Stable resource identity serializes independent player authorities
        // before either inventory custody or node availability is inspected.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${resourceId}, 0))`,
        );
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({
            id: schema.characters.id,
            woodcuttingXp: schema.characters.woodcuttingXp,
            miningXp: schema.characters.miningXp,
            fishingXp: schema.characters.fishingXp,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        const character = characterRows[0];
        if (!character) throw new Error("gathering_reward_player_missing");

        const persistedXp = Number(
          skill === "woodcutting"
            ? character.woodcuttingXp
            : skill === "mining"
              ? character.miningXp
              : character.fishingXp,
        );
        if (
          !Number.isFinite(persistedXp) ||
          persistedXp < 0 ||
          persistedXp > MAX_SKILL_XP
        ) {
          throw new Error("gathering_reward_skill_state_invalid");
        }

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredGatheringRewardOperation | undefined;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "gathering_reward" ||
            existing.completed !== true ||
            state?.version !== 2 ||
            state.requestFingerprint !== requestFingerprint ||
            state.resourceId !== resourceId ||
            state.depleteAfterCommit !== depleteAfterCommit ||
            state.respawnTicks !== respawnTicks ||
            (state.depletedUntil !== null &&
              (!Number.isSafeInteger(state.depletedUntil) ||
                state.depletedUntil <= 0)) ||
            depleteAfterCommit !== (state.depletedUntil !== null) ||
            state.skill !== skill ||
            state.xpAmount !== xpAmount ||
            JSON.stringify(state.reward) !== JSON.stringify(reward) ||
            state.secondaryItemId !== secondaryItemId ||
            !Number.isFinite(state.awardedXp) ||
            state.awardedXp < 0 ||
            state.awardedXp > xpAmount ||
            !Number.isFinite(state.operationCommittedXp)
          ) {
            throw new Error("gathering_reward_operation_id_conflict");
          }
          const currentRows = await tx
            .select({
              itemId: schema.inventory.itemId,
              quantity: schema.inventory.quantity,
              slotIndex: schema.inventory.slotIndex,
              metadata: schema.inventory.metadata,
            })
            .from(schema.inventory)
            .where(eq(schema.inventory.playerId, playerId));
          return {
            operationId,
            playerId,
            requestFingerprint,
            replayed: true,
            resourceId,
            depleteAfterCommit,
            respawnTicks,
            depletedUntil: state.depletedUntil,
            skill,
            xpAmount,
            reward,
            secondaryItemId,
            awardedXp: state.awardedXp,
            operationCommittedXp: state.operationCommittedXp,
            currentXp: persistedXp,
            currentLevel: skillLevelForXp(persistedXp),
            committed: normalizePersistedInventoryRows(
              currentRows,
              "gathering_reward",
            ),
          };
        }

        const activeResourceRows = await tx
          .select({ respawnAt: schema.gatheringResourceStates.respawnAt })
          .from(schema.gatheringResourceStates)
          .where(eq(schema.gatheringResourceStates.resourceId, resourceId));
        const activeRespawnAt = Number(activeResourceRows[0]?.respawnAt ?? 0);
        if (Number.isFinite(activeRespawnAt) && activeRespawnAt > Date.now()) {
          throw new Error("gathering_reward_resource_unavailable");
        }

        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        let committed = normalizePersistedInventoryRows(
          inventoryRows,
          "gathering_reward",
        );
        if (secondaryItemId) {
          try {
            committed = debitInventorySnapshot(committed, [
              { itemId: secondaryItemId, quantity: 1 },
            ]);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes("inventory_debit_insufficient_items")
            ) {
              throw new Error("gathering_reward_secondary_missing");
            }
            throw error;
          }
        }
        committed = creditGatheringReward(committed, reward);

        const operationCommittedXp = Math.min(
          persistedXp + xpAmount,
          MAX_SKILL_XP,
        );
        const awardedXp = operationCommittedXp - persistedXp;
        const currentLevel = skillLevelForXp(operationCommittedXp);
        const skillUpdate =
          skill === "woodcutting"
            ? {
                woodcuttingXp: operationCommittedXp,
                woodcuttingLevel: currentLevel,
              }
            : skill === "mining"
              ? {
                  miningXp: operationCommittedXp,
                  miningLevel: currentLevel,
                }
              : {
                  fishingXp: operationCommittedXp,
                  fishingLevel: currentLevel,
                };

        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        if (committed.length > 0) {
          await tx.insert(schema.inventory).values(
            committed.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }
        await tx
          .update(schema.characters)
          .set(skillUpdate)
          .where(eq(schema.characters.id, playerId));

        const now = Date.now();
        const depletedUntil = depleteAfterCommit
          ? now + respawnTicks * TICK_DURATION_MS
          : null;
        if (
          depletedUntil !== null &&
          (!Number.isSafeInteger(depletedUntil) || depletedUntil <= now)
        ) {
          throw new Error("gathering_reward_request_invalid");
        }
        const operationState: StoredGatheringRewardOperation = {
          version: 2,
          requestFingerprint,
          resourceId,
          depleteAfterCommit,
          respawnTicks,
          depletedUntil,
          skill,
          xpAmount,
          reward,
          secondaryItemId,
          awardedXp,
          operationCommittedXp,
        };
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "gathering_reward",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });

        const activeQuestRows = await tx
          .select({
            questId: schema.questProgress.questId,
            currentStage: schema.questProgress.currentStage,
            startedAt: schema.questProgress.startedAt,
          })
          .from(schema.questProgress)
          .where(
            and(
              eq(schema.questProgress.playerId, playerId),
              eq(schema.questProgress.status, "in_progress"),
            ),
          );
        const questContexts = activeQuestRows.map((row) => ({
          questId: String(row.questId ?? "").trim(),
          currentStage: String(row.currentStage ?? "").trim(),
          startedAt: Number(row.startedAt),
        }));
        if (
          questContexts.some(
            (context) =>
              !context.questId ||
              context.questId.length > 256 ||
              !context.currentStage ||
              context.currentStage.length > 256 ||
              !Number.isSafeInteger(context.startedAt) ||
              context.startedAt < 0,
          )
        ) {
          throw new Error("gathering_reward_quest_state_invalid");
        }
        if (questContexts.length > 0) {
          await tx.insert(schema.questGatheringProgressReceipts).values(
            questContexts.map((context) => ({
              operationId,
              playerId,
              questId: context.questId,
              questStartedAt: context.startedAt,
              capturedStage: context.currentStage,
              rewardItemId: reward.itemId,
              rewardQuantity: reward.quantity,
              createdAt: now,
            })),
          );
        }
        if (depletedUntil !== null) {
          await tx
            .insert(schema.gatheringResourceStates)
            .values({
              resourceId,
              operationId,
              depletedAt: now,
              respawnAt: depletedUntil,
            })
            .onConflictDoUpdate({
              target: schema.gatheringResourceStates.resourceId,
              set: {
                operationId,
                depletedAt: now,
                respawnAt: depletedUntil,
              },
            });
        }

        return {
          operationId,
          playerId,
          requestFingerprint,
          replayed: false,
          resourceId,
          depleteAfterCommit,
          respawnTicks,
          depletedUntil,
          skill,
          xpAmount,
          reward,
          secondaryItemId,
          awardedXp,
          operationCommittedXp,
          currentXp: operationCommittedXp,
          currentLevel,
          committed,
        };
      },
      // The advisory resource lock and character row lock explicitly serialize
      // every state this transition reads. READ COMMITTED lets advisory-lock
      // waiters observe the winner's newly committed depletion row.
      { isolationLevel: "read committed" },
    );
    return this.trackAwaitedOperation(operation);
  }

  /** Load active depletion state in one query for a terrain spawn batch. */
  async getGatheringResourceStatesAsync(
    resourceIds: string[],
  ): Promise<GatheringResourceState[]> {
    if (!this.db || this.isDestroying) {
      throw new Error("gathering_reward_database_unavailable");
    }
    const normalized = [
      ...new Set(
        resourceIds.map((resourceId) => String(resourceId ?? "").trim()),
      ),
    ];
    if (
      normalized.length > 10_000 ||
      normalized.some((resourceId) => !resourceId || resourceId.length > 256)
    ) {
      throw new Error("gathering_reward_request_invalid");
    }
    if (normalized.length === 0) return [];

    const rows = await this.db
      .select({
        resourceId: schema.gatheringResourceStates.resourceId,
        operationId: schema.gatheringResourceStates.operationId,
        depletedAt: schema.gatheringResourceStates.depletedAt,
        respawnAt: schema.gatheringResourceStates.respawnAt,
      })
      .from(schema.gatheringResourceStates)
      .where(
        and(
          inArray(schema.gatheringResourceStates.resourceId, normalized),
          gt(schema.gatheringResourceStates.respawnAt, Date.now()),
        ),
      );
    return rows.map((row) => ({
      resourceId: row.resourceId,
      operationId: row.operationId,
      depletedAt: Number(row.depletedAt),
      respawnAt: Number(row.respawnAt),
    }));
  }

  /**
   * Persist one correlated processing request before its timed action starts.
   * The character-row lock makes this the cross-process single-action boundary
   * for every processing family. A new server authority may take over the same
   * exact request, but a second request for that player remains busy.
   */
  async beginProcessingRequestAsync(
    playerId: string,
    operationId: string,
    requestId: string,
    skill: ProcessingSkill,
    envelope: ProcessingRequestEnvelope,
  ): Promise<"accepted" | "pending" | "committed" | "busy" | "rejected"> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const normalizedPlayerId = String(playerId ?? "").trim();
    const normalizedRequestId = normalizeProcessingRequestId(requestId);
    const normalizedOperationId = String(operationId ?? "").trim();
    const normalizedEnvelope = normalizeProcessingRequestEnvelope(
      skill,
      envelope,
    );
    if (
      !normalizedPlayerId ||
      !normalizedRequestId ||
      !normalizedEnvelope ||
      !PROCESSING_REQUEST_SKILLS.has(skill) ||
      normalizedOperationId !==
        getProcessingRequestOperationId(skill, normalizedRequestId)
    ) {
      throw new Error("processing_action_request_invalid");
    }

    return this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${normalizedPlayerId} FOR UPDATE`,
        );
        const waiterId = processingWaiterOperationId(normalizedPlayerId);
        const waiterRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, waiterId));
        const waiterRow = waiterRows[0];
        const waiterState = waiterRow
          ? normalizeStoredProcessingWaiter(waiterRow.operationState)
          : null;
        if (
          waiterRow &&
          (waiterRow.playerId !== normalizedPlayerId ||
            waiterRow.operationType !== "processing_waiter" ||
            !waiterState ||
            (waiterRow.completed === false &&
              waiterState.acknowledgedAt !== null) ||
            (waiterRow.completed === true &&
              waiterState.acknowledgedAt === null))
        ) {
          throw new Error("processing_action_waiter_state_invalid");
        }
        const activeWaiter =
          waiterRow?.completed === false ? waiterState : null;
        if (activeWaiter) {
          if (activeWaiter.requestId !== normalizedRequestId) {
            return "busy" as const;
          }
          if (
            activeWaiter.skill !== skill ||
            JSON.stringify(activeWaiter.envelope) !==
              JSON.stringify(normalizedEnvelope)
          ) {
            throw new Error("processing_action_operation_id_conflict");
          }
        }

        const writePendingWaiter = async (
          pending: StoredPendingProcessingRequest,
        ): Promise<void> => {
          const nextWaiter: StoredProcessingWaiter = {
            version: 1,
            requestId: pending.requestId,
            skill: pending.skill,
            envelope: normalizedEnvelope,
            ownerId: pending.ownerId,
            acceptedAt: pending.acceptedAt,
            heartbeatAt: pending.heartbeatAt,
            status: "pending",
            terminalAt: null,
            acknowledgedAt: null,
          };
          if (waiterRow) {
            await tx
              .update(schema.operationsLog)
              .set({
                playerId: normalizedPlayerId,
                operationType: "processing_waiter",
                operationState: nextWaiter,
                completed: false,
                timestamp: pending.heartbeatAt,
                completedAt: null,
              })
              .where(eq(schema.operationsLog.id, waiterId));
          } else {
            await tx.insert(schema.operationsLog).values({
              id: waiterId,
              playerId: normalizedPlayerId,
              operationType: "processing_waiter",
              operationState: nextWaiter,
              completed: false,
              timestamp: pending.heartbeatAt,
              completedAt: null,
            });
          }
        };

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, normalizedOperationId));
        const existing = existingRows[0];
        if (existing) {
          if (
            existing.playerId === normalizedPlayerId &&
            existing.operationType === "processing_action" &&
            existing.completed === true
          ) {
            if (activeWaiter && activeWaiter.status !== "committed") {
              throw new Error("processing_action_waiter_state_invalid");
            }
            return "committed" as const;
          }
          if (
            existing.playerId === normalizedPlayerId &&
            existing.operationType === "processing_request_rejected" &&
            existing.completed === true
          ) {
            if (activeWaiter && activeWaiter.status !== "rejected") {
              throw new Error("processing_action_waiter_state_invalid");
            }
            return "rejected" as const;
          }
          const state = existing.operationState as
            StoredPendingProcessingRequest | undefined;
          const storedEnvelope =
            state?.envelope === undefined
              ? undefined
              : normalizeProcessingRequestEnvelope(skill, state.envelope);
          if (
            existing.playerId !== normalizedPlayerId ||
            existing.operationType !== "processing_request" ||
            existing.completed !== false ||
            state?.version !== 1 ||
            state.requestId !== normalizedRequestId ||
            state.skill !== skill ||
            (state.envelope !== undefined &&
              (!storedEnvelope ||
                JSON.stringify(storedEnvelope) !==
                  JSON.stringify(normalizedEnvelope))) ||
            typeof state.ownerId !== "string" ||
            !state.ownerId
          ) {
            throw new Error("processing_action_operation_id_conflict");
          }
          if (state.ownerId === this.processingRequestOwnerId) {
            // An at-least-once transport may repeat the exact packet. Report
            // idempotent ownership without starting a second in-memory action
            // or falsely rejecting the caller's still-running first action.
            if (!activeWaiter) await writePendingWaiter(state);
            return "pending" as const;
          }
          const now = Date.now();
          const acceptedAt =
            Number.isSafeInteger(state.acceptedAt) && state.acceptedAt > 0
              ? state.acceptedAt
              : now;
          const resumed: StoredPendingProcessingRequest = {
            version: 1,
            requestId: normalizedRequestId,
            skill,
            ownerId: this.processingRequestOwnerId,
            acceptedAt,
            heartbeatAt: now,
            envelope: normalizedEnvelope,
          };
          await tx
            .update(schema.operationsLog)
            .set({ operationState: resumed, timestamp: now })
            .where(eq(schema.operationsLog.id, normalizedOperationId));
          await writePendingWaiter(resumed);
          return "accepted" as const;
        }

        if (activeWaiter) {
          throw new Error("processing_action_waiter_state_invalid");
        }

        const competingRows = await tx
          .select({ id: schema.operationsLog.id })
          .from(schema.operationsLog)
          .where(
            and(
              eq(schema.operationsLog.playerId, normalizedPlayerId),
              eq(schema.operationsLog.operationType, "processing_request"),
              eq(schema.operationsLog.completed, false),
            ),
          );
        if (competingRows.length > 0) return "busy" as const;

        const now = Date.now();
        const state: StoredPendingProcessingRequest = {
          version: 1,
          requestId: normalizedRequestId,
          skill,
          ownerId: this.processingRequestOwnerId,
          acceptedAt: now,
          heartbeatAt: now,
          envelope: normalizedEnvelope,
        };
        await tx.insert(schema.operationsLog).values({
          id: normalizedOperationId,
          playerId: normalizedPlayerId,
          operationType: "processing_request",
          operationState: state,
          completed: false,
          timestamp: now,
          completedAt: null,
        });
        await writePendingWaiter(state);
        return "accepted" as const;
      },
      { isolationLevel: "read committed" },
    );
  }

  /** Keep one accepted request bound to this exact server authority epoch. */
  async heartbeatProcessingRequestAsync(
    playerId: string,
    operationId: string,
    requestId: string,
    skill: ProcessingSkill,
  ): Promise<boolean> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const normalizedPlayerId = String(playerId ?? "").trim();
    const normalizedRequestId = normalizeProcessingRequestId(requestId);
    const normalizedOperationId = String(operationId ?? "").trim();
    if (
      !normalizedPlayerId ||
      !normalizedRequestId ||
      !PROCESSING_REQUEST_SKILLS.has(skill) ||
      normalizedOperationId !==
        getProcessingRequestOperationId(skill, normalizedRequestId)
    ) {
      throw new Error("processing_action_request_invalid");
    }
    return this.executeInTransaction(async (tx) => {
      // Use the same lock order as admission and commit. If another authority
      // has already taken over, the re-read below observes its owner and this
      // stale heartbeat becomes a no-op instead of stealing ownership back.
      await tx.execute(
        sql`SELECT "id" FROM "characters" WHERE "id" = ${normalizedPlayerId} FOR UPDATE`,
      );
      const rows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          operationState: schema.operationsLog.operationState,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, normalizedOperationId));
      const row = rows[0];
      const state = row?.operationState as
        StoredPendingProcessingRequest | undefined;
      if (
        row?.playerId !== normalizedPlayerId ||
        row.operationType !== "processing_request" ||
        row.completed !== false ||
        state?.version !== 1 ||
        state.requestId !== normalizedRequestId ||
        state.skill !== skill ||
        state.ownerId !== this.processingRequestOwnerId
      ) {
        return false;
      }
      const envelope =
        state.envelope === undefined
          ? null
          : normalizeProcessingRequestEnvelope(skill, state.envelope);
      if (state.envelope !== undefined && !envelope) return false;
      const waiterId = processingWaiterOperationId(normalizedPlayerId);
      const waiterRows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          operationState: schema.operationsLog.operationState,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, waiterId));
      const waiterRow = waiterRows[0];
      const waiterState = waiterRow
        ? normalizeStoredProcessingWaiter(waiterRow.operationState)
        : null;
      if (
        waiterRow &&
        (waiterRow.playerId !== normalizedPlayerId ||
          waiterRow.operationType !== "processing_waiter" ||
          waiterRow.completed !== false ||
          !waiterState ||
          waiterState.requestId !== normalizedRequestId ||
          waiterState.skill !== skill ||
          waiterState.status !== "pending" ||
          waiterState.ownerId !== this.processingRequestOwnerId ||
          (envelope &&
            JSON.stringify(waiterState.envelope) !== JSON.stringify(envelope)))
      ) {
        return false;
      }
      const now = Date.now();
      await tx
        .update(schema.operationsLog)
        .set({
          operationState: { ...state, heartbeatAt: now },
          timestamp: now,
        })
        .where(eq(schema.operationsLog.id, normalizedOperationId));
      if (envelope) {
        const nextWaiter: StoredProcessingWaiter = waiterState
          ? { ...waiterState, heartbeatAt: now }
          : {
              version: 1,
              requestId: normalizedRequestId,
              skill,
              envelope,
              ownerId: this.processingRequestOwnerId,
              acceptedAt: state.acceptedAt,
              heartbeatAt: now,
              status: "pending",
              terminalAt: null,
              acknowledgedAt: null,
            };
        if (waiterRow) {
          await tx
            .update(schema.operationsLog)
            .set({ operationState: nextWaiter, timestamp: now })
            .where(eq(schema.operationsLog.id, waiterId));
        } else {
          await tx.insert(schema.operationsLog).values({
            id: waiterId,
            playerId: normalizedPlayerId,
            operationType: "processing_waiter",
            operationState: nextWaiter,
            completed: false,
            timestamp: now,
            completedAt: null,
          });
        }
      }
      return true;
    });
  }

  /** Record a definitive safe rejection without overwriting committed truth. */
  async rejectProcessingRequestAsync(
    playerId: string,
    operationId: string,
    requestId: string,
    skill: ProcessingSkill,
    reason: string,
    retryable: boolean,
  ): Promise<boolean> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const normalizedPlayerId = String(playerId ?? "").trim();
    const normalizedRequestId = normalizeProcessingRequestId(requestId);
    const normalizedOperationId = String(operationId ?? "").trim();
    const normalizedReason = String(reason ?? "").trim();
    if (
      !normalizedPlayerId ||
      !normalizedRequestId ||
      !normalizedReason ||
      normalizedReason.length > 64 ||
      !PROCESSING_REQUEST_SKILLS.has(skill) ||
      normalizedOperationId !==
        getProcessingRequestOperationId(skill, normalizedRequestId)
    ) {
      return false;
    }
    return this.executeInTransaction(async (tx) => {
      // Serialize against admission/takeover before deciding whether this
      // authority still owns the request. A stale process must never reject a
      // request that a replacement process has resumed.
      await tx.execute(
        sql`SELECT "id" FROM "characters" WHERE "id" = ${normalizedPlayerId} FOR UPDATE`,
      );
      const rows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          operationState: schema.operationsLog.operationState,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, normalizedOperationId));
      const row = rows[0];
      const state = row?.operationState as
        StoredPendingProcessingRequest | undefined;
      if (
        row?.playerId !== normalizedPlayerId ||
        row.operationType !== "processing_request" ||
        row.completed !== false ||
        state?.version !== 1 ||
        state.requestId !== normalizedRequestId ||
        state.skill !== skill ||
        state.ownerId !== this.processingRequestOwnerId
      ) {
        return false;
      }
      const envelope =
        state.envelope === undefined
          ? null
          : normalizeProcessingRequestEnvelope(skill, state.envelope);
      if (state.envelope !== undefined && !envelope) return false;
      const waiterId = processingWaiterOperationId(normalizedPlayerId);
      const waiterRows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          operationState: schema.operationsLog.operationState,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, waiterId));
      const waiterRow = waiterRows[0];
      const waiterState = waiterRow
        ? normalizeStoredProcessingWaiter(waiterRow.operationState)
        : null;
      if (
        waiterRow &&
        (waiterRow.playerId !== normalizedPlayerId ||
          waiterRow.operationType !== "processing_waiter" ||
          waiterRow.completed !== false ||
          !waiterState ||
          waiterState.requestId !== normalizedRequestId ||
          waiterState.skill !== skill ||
          waiterState.status !== "pending" ||
          waiterState.ownerId !== this.processingRequestOwnerId ||
          (envelope &&
            JSON.stringify(waiterState.envelope) !== JSON.stringify(envelope)))
      ) {
        return false;
      }
      const now = Date.now();
      const rejected: StoredRejectedProcessingRequest = {
        ...state,
        reason: normalizedReason,
        retryable,
        rejectedAt: now,
      };
      await tx
        .update(schema.operationsLog)
        .set({
          operationType: "processing_request_rejected",
          operationState: rejected,
          completed: true,
          completedAt: now,
        })
        .where(eq(schema.operationsLog.id, normalizedOperationId));
      if (envelope) {
        const terminalWaiter: StoredProcessingWaiter = {
          version: 1,
          requestId: normalizedRequestId,
          skill,
          envelope,
          ownerId: this.processingRequestOwnerId,
          acceptedAt: waiterState?.acceptedAt ?? state.acceptedAt,
          heartbeatAt: now,
          status: "rejected",
          terminalAt: now,
          acknowledgedAt: null,
        };
        if (waiterRow) {
          await tx
            .update(schema.operationsLog)
            .set({ operationState: terminalWaiter, timestamp: now })
            .where(eq(schema.operationsLog.id, waiterId));
        } else {
          await tx.insert(schema.operationsLog).values({
            id: waiterId,
            playerId: normalizedPlayerId,
            operationType: "processing_waiter",
            operationState: terminalWaiter,
            completed: false,
            timestamp: now,
            completedAt: null,
          });
        }
      }
      return true;
    });
  }

  /**
   * Commit one recipe action as a single custody transition. All material
   * debits, optional product credits, matching optional XP/level, and the
   * semantic receipt are protected by the same serialized character-row lock.
   * Input-only zero-XP outcomes are valid for deterministic failed recipe
   * rolls and still receive exactly-once custody.
   */
  async commitProcessingActionOperationAsync(
    request: ProcessingActionCommitRequest,
  ): Promise<ProcessingActionCommitReceipt> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    const skill = String(request.skill ?? "").trim() as ProcessingActionSkill;
    const xpAmount = Number(request.xpAmount);
    const coinCost = Number(request.coinCost ?? 0);
    if (
      !operationId ||
      operationId.length > 256 ||
      !playerId ||
      !/^[a-f0-9]{64}$/.test(requestFingerprint) ||
      !PROCESSING_ACTION_SKILLS.has(skill) ||
      !Number.isFinite(xpAmount) ||
      xpAmount < 0 ||
      xpAmount > MAX_PROCESSING_ACTION_XP ||
      !Number.isSafeInteger(coinCost) ||
      coinCost < 0 ||
      coinCost > MAX_PERSISTED_ITEM_QUANTITY
    ) {
      throw new Error("processing_action_request_invalid");
    }
    const inputs = normalizeProcessingInputs(request.inputs);
    const requiredItems = normalizeProcessingRequiredItems(
      request.requiredItems,
    );
    const consumables = normalizeProcessingConsumables(request.consumables);
    const outputs = normalizeProcessingOutputs(request.outputs);
    const worldEffect = normalizeProcessingFireEffectRequest(
      request.worldEffect,
      skill,
    );
    if (
      requestFingerprint !==
      processingActionFingerprint(
        playerId,
        skill,
        xpAmount,
        inputs,
        requiredItems,
        consumables,
        outputs,
        coinCost,
        worldEffect,
      )
    ) {
      throw new Error("processing_action_request_invalid");
    }

    const operation = this.executeInTransaction(
      async (tx) => {
        // Acquire the cross-process tile lock before reading active effects.
        if (worldEffect) {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${`processing-fire:${worldEffect.tile.x}:${worldEffect.tile.z}`}, 0))`,
          );
        }
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({
            id: schema.characters.id,
            coins: schema.characters.coins,
            firemakingXp: schema.characters.firemakingXp,
            cookingXp: schema.characters.cookingXp,
            smithingXp: schema.characters.smithingXp,
            craftingXp: schema.characters.craftingXp,
            fletchingXp: schema.characters.fletchingXp,
            runecraftingXp: schema.characters.runecraftingXp,
            processingConsumableUses:
              schema.characters.processingConsumableUses,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        const character = characterRows[0];
        if (!character) throw new Error("processing_action_player_missing");

        const persistedCoins = Number(character.coins);
        if (
          !Number.isSafeInteger(persistedCoins) ||
          persistedCoins < 0 ||
          persistedCoins > MAX_PERSISTED_ITEM_QUANTITY
        ) {
          throw new Error("processing_action_coin_state_invalid");
        }

        const persistedXp = Number(
          skill === "firemaking"
            ? character.firemakingXp
            : skill === "cooking"
              ? character.cookingXp
              : skill === "smithing"
                ? character.smithingXp
                : skill === "crafting"
                  ? character.craftingXp
                  : skill === "fletching"
                    ? character.fletchingXp
                    : character.runecraftingXp,
        );
        if (
          !Number.isFinite(persistedXp) ||
          persistedXp < 0 ||
          persistedXp > MAX_SKILL_XP
        ) {
          throw new Error("processing_action_skill_state_invalid");
        }
        const persistedConsumableUses = normalizeStoredProcessingConsumableUses(
          character.processingConsumableUses,
        );

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        let acceptedRequest: StoredPendingProcessingRequest | null = null;
        if (
          existing?.operationType === "processing_request" &&
          existing.completed === false
        ) {
          const state = existing.operationState as
            StoredPendingProcessingRequest | undefined;
          const expectedRequestId = operationId.slice(
            operationId.lastIndexOf(":") + 1,
          );
          const expectedRequestSkill = operationId.split(":")[1] as
            ProcessingSkill | undefined;
          const expectedCustodySkill =
            expectedRequestSkill === "smelting"
              ? "smithing"
              : expectedRequestSkill === "tanning"
                ? "crafting"
                : expectedRequestSkill;
          if (
            existing.playerId !== playerId ||
            state?.version !== 1 ||
            !expectedRequestSkill ||
            !PROCESSING_REQUEST_SKILLS.has(expectedRequestSkill) ||
            expectedCustodySkill !== skill ||
            state.skill !== expectedRequestSkill ||
            state.requestId !== expectedRequestId ||
            state.ownerId !== this.processingRequestOwnerId ||
            getProcessingRequestOperationId(
              expectedRequestSkill,
              state.requestId,
            ) !== operationId
          ) {
            throw new Error("processing_action_operation_id_conflict");
          }
          acceptedRequest = state;
        } else if (existing) {
          const state = existing.operationState as
            StoredProcessingActionOperation | undefined;
          const replayedInputs = state?.inputs
            ? normalizeProcessingInputs(state.inputs)
            : null;
          const replayedRequiredItems = normalizeProcessingRequiredItems(
            state?.requiredItems ?? [],
          );
          const replayedConsumables = normalizeProcessingConsumables(
            state?.consumables ?? [],
          );
          const replayedConsumableStates = normalizeProcessingConsumableStates(
            state?.consumableStates ?? [],
          );
          const replayedOutputs = state?.outputs
            ? normalizeProcessingOutputs(state.outputs)
            : null;
          const replayedCoinCost = Number(state?.coinCost ?? 0);
          let replayedWorldEffect: ProcessingActionFireEffect | undefined;
          try {
            if (Boolean(state?.worldEffect) !== Boolean(worldEffect)) {
              throw new Error("processing_action_world_effect_state_invalid");
            }
            replayedWorldEffect = normalizeStoredProcessingFireEffect(
              state?.worldEffect,
              worldEffect,
            );
          } catch {
            throw new Error("processing_action_operation_id_conflict");
          }
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "processing_action" ||
            existing.completed !== true ||
            state?.version !== 1 ||
            state.requestFingerprint !== requestFingerprint ||
            state.skill !== skill ||
            state.xpAmount !== xpAmount ||
            !replayedInputs ||
            !replayedOutputs ||
            JSON.stringify(replayedInputs) !== JSON.stringify(inputs) ||
            JSON.stringify(replayedRequiredItems) !==
              JSON.stringify(requiredItems) ||
            JSON.stringify(replayedConsumables) !==
              JSON.stringify(consumables) ||
            replayedConsumableStates.length !== replayedConsumables.length ||
            JSON.stringify(replayedOutputs) !== JSON.stringify(outputs) ||
            !Number.isSafeInteger(replayedCoinCost) ||
            replayedCoinCost !== coinCost ||
            !Number.isFinite(state.awardedXp) ||
            state.awardedXp < 0 ||
            state.awardedXp > xpAmount ||
            !Number.isFinite(state.operationCommittedXp)
          ) {
            throw new Error("processing_action_operation_id_conflict");
          }
          if (replayedWorldEffect) {
            const fireRows = await tx
              .select({
                fireId: schema.processingActiveFires.fireId,
                playerId: schema.processingActiveFires.playerId,
                positionX: schema.processingActiveFires.positionX,
                positionY: schema.processingActiveFires.positionY,
                positionZ: schema.processingActiveFires.positionZ,
                tileX: schema.processingActiveFires.tileX,
                tileZ: schema.processingActiveFires.tileZ,
                createdAt: schema.processingActiveFires.createdAt,
                expiresAt: schema.processingActiveFires.expiresAt,
              })
              .from(schema.processingActiveFires)
              .where(eq(schema.processingActiveFires.operationId, operationId));
            const row = fireRows[0];
            if (
              fireRows.length !== 1 ||
              !row ||
              row.playerId !== playerId ||
              JSON.stringify({
                kind: "fire",
                fireId: row.fireId,
                position: {
                  x: Number(row.positionX),
                  y: Number(row.positionY),
                  z: Number(row.positionZ),
                },
                tile: { x: Number(row.tileX), z: Number(row.tileZ) },
                createdAt: Number(row.createdAt),
                expiresAt: Number(row.expiresAt),
              }) !== JSON.stringify(replayedWorldEffect)
            ) {
              throw new Error("processing_action_operation_id_conflict");
            }
          }
          const currentRows = await tx
            .select({
              itemId: schema.inventory.itemId,
              quantity: schema.inventory.quantity,
              slotIndex: schema.inventory.slotIndex,
              metadata: schema.inventory.metadata,
            })
            .from(schema.inventory)
            .where(eq(schema.inventory.playerId, playerId));
          return {
            operationId,
            playerId,
            requestFingerprint,
            replayed: true,
            skill,
            xpAmount,
            inputs: replayedInputs,
            requiredItems: replayedRequiredItems,
            consumables: replayedConsumables,
            consumableStates: replayedConsumableStates,
            outputs: replayedOutputs,
            ...(coinCost > 0 ? { coinCost, currentCoins: persistedCoins } : {}),
            ...(replayedWorldEffect
              ? { worldEffect: replayedWorldEffect }
              : {}),
            awardedXp: state.awardedXp,
            operationCommittedXp: state.operationCommittedXp,
            currentXp: persistedXp,
            currentLevel: skillLevelForXp(persistedXp),
            committed: normalizePersistedInventoryRows(
              currentRows,
              "processing_action",
            ),
          };
        }

        if (worldEffect) {
          const arbitrationNow = Date.now();
          await tx
            .update(schema.processingActiveFires)
            .set({ extinguishedAt: arbitrationNow })
            .where(
              and(
                eq(schema.processingActiveFires.tileX, worldEffect.tile.x),
                eq(schema.processingActiveFires.tileZ, worldEffect.tile.z),
                isNull(schema.processingActiveFires.extinguishedAt),
                lte(schema.processingActiveFires.expiresAt, arbitrationNow),
              ),
            );
          const activeAtTile = await tx
            .select({ fireId: schema.processingActiveFires.fireId })
            .from(schema.processingActiveFires)
            .where(
              and(
                eq(schema.processingActiveFires.tileX, worldEffect.tile.x),
                eq(schema.processingActiveFires.tileZ, worldEffect.tile.z),
                isNull(schema.processingActiveFires.extinguishedAt),
                gt(schema.processingActiveFires.expiresAt, Date.now()),
              ),
            );
          if (activeAtTile.length > 0) {
            throw new Error("processing_action_fire_tile_occupied");
          }
          const activeForPlayer = await tx
            .select({ fireId: schema.processingActiveFires.fireId })
            .from(schema.processingActiveFires)
            .where(
              and(
                eq(schema.processingActiveFires.playerId, playerId),
                isNull(schema.processingActiveFires.extinguishedAt),
                gt(schema.processingActiveFires.expiresAt, Date.now()),
              ),
            );
          if (
            activeForPlayer.length >= MAX_ACTIVE_PROCESSING_FIRES_PER_PLAYER
          ) {
            throw new Error("processing_action_fire_capacity_reached");
          }
        }

        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        let committed = normalizePersistedInventoryRows(
          inventoryRows,
          "processing_action",
        );
        if (persistedCoins < coinCost) {
          throw new Error("processing_action_insufficient_coins");
        }
        const nextCoins = persistedCoins - coinCost;
        const availabilityByItem = new Map(
          requiredItems.map((entry) => [entry.itemId, entry.quantity]),
        );
        for (const consumable of consumables) {
          availabilityByItem.set(
            consumable.itemId,
            Math.max(availabilityByItem.get(consumable.itemId) ?? 0, 1),
          );
        }
        const availabilityRequirements = normalizeProcessingRequiredItems(
          [...availabilityByItem.entries()].map(([itemId, quantity]) => ({
            itemId,
            quantity,
          })),
        );
        if (availabilityRequirements.length > 0) {
          try {
            debitInventorySnapshot(committed, availabilityRequirements);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes("inventory_debit_insufficient_items")
            ) {
              throw new Error("processing_action_insufficient_items");
            }
            throw error;
          }
        }

        const nextConsumableUses: StoredProcessingConsumableUses =
          Object.fromEntries(
            Object.entries(persistedConsumableUses).map(([itemId, state]) => [
              itemId,
              { ...state },
            ]),
          );
        const consumableStates: ProcessingActionConsumableState[] = [];
        const consumableDebits: InventoryDebitRequirement[] = [];
        for (const consumable of consumables) {
          const current = nextConsumableUses[consumable.itemId];
          if (current && current.usesPerItem !== consumable.usesPerItem) {
            throw new Error("processing_action_consumable_config_conflict");
          }
          const remainingUses =
            (current?.remainingUses ?? consumable.usesPerItem) - 1;
          if (remainingUses === 0) {
            delete nextConsumableUses[consumable.itemId];
            consumableDebits.push({
              itemId: consumable.itemId,
              quantity: 1,
            });
            consumableStates.push({
              ...consumable,
              remainingUses: 0,
              consumedQuantity: 1,
            });
          } else {
            nextConsumableUses[consumable.itemId] = {
              usesPerItem: consumable.usesPerItem,
              remainingUses,
            };
            consumableStates.push({
              ...consumable,
              remainingUses,
              consumedQuantity: 0,
            });
          }
        }
        const committedInputs =
          consumableDebits.length > 0
            ? normalizeProcessingInputs([...inputs, ...consumableDebits])
            : inputs;
        try {
          committed = debitInventorySnapshot(committed, committedInputs);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("inventory_debit_insufficient_items")
          ) {
            throw new Error("processing_action_insufficient_items");
          }
          throw error;
        }
        for (const output of outputs) {
          committed = creditGatheringReward(
            committed,
            output,
            "processing_action",
          );
        }

        const operationCommittedXp = Math.min(
          persistedXp + xpAmount,
          MAX_SKILL_XP,
        );
        const awardedXp = operationCommittedXp - persistedXp;
        const currentLevel = skillLevelForXp(operationCommittedXp);
        const skillUpdate =
          skill === "firemaking"
            ? {
                firemakingXp: operationCommittedXp,
                firemakingLevel: currentLevel,
              }
            : skill === "cooking"
              ? {
                  cookingXp: operationCommittedXp,
                  cookingLevel: currentLevel,
                }
              : skill === "smithing"
                ? {
                    smithingXp: operationCommittedXp,
                    smithingLevel: currentLevel,
                  }
                : skill === "crafting"
                  ? {
                      craftingXp: operationCommittedXp,
                      craftingLevel: currentLevel,
                    }
                  : skill === "fletching"
                    ? {
                        fletchingXp: operationCommittedXp,
                        fletchingLevel: currentLevel,
                      }
                    : {
                        runecraftingXp: operationCommittedXp,
                        runecraftingLevel: currentLevel,
                      };

        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        if (committed.length > 0) {
          await tx.insert(schema.inventory).values(
            committed.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }
        await tx
          .update(schema.characters)
          .set({
            ...skillUpdate,
            coins: nextCoins,
            processingConsumableUses: nextConsumableUses,
          })
          .where(eq(schema.characters.id, playerId));

        const now = Date.now();
        const operationState: StoredProcessingActionOperation = {
          version: 1,
          requestFingerprint,
          skill,
          xpAmount,
          inputs,
          requiredItems,
          consumables,
          consumableStates,
          outputs,
          ...(coinCost > 0 ? { coinCost } : {}),
          ...(worldEffect
            ? {
                worldEffect: {
                  kind: "fire",
                  fireId: worldEffect.fireId,
                  position: worldEffect.position,
                  tile: worldEffect.tile,
                  createdAt: now,
                  expiresAt: now + worldEffect.durationMs,
                },
              }
            : {}),
          awardedXp,
          operationCommittedXp,
        };
        if (acceptedRequest) {
          await tx
            .update(schema.operationsLog)
            .set({
              operationType: "processing_action",
              operationState,
              completed: true,
              completedAt: now,
            })
            .where(eq(schema.operationsLog.id, operationId));
          const envelope =
            acceptedRequest.envelope === undefined
              ? null
              : normalizeProcessingRequestEnvelope(
                  acceptedRequest.skill,
                  acceptedRequest.envelope,
                );
          if (acceptedRequest.envelope !== undefined && !envelope) {
            throw new Error("processing_action_waiter_state_invalid");
          }
          if (envelope) {
            const waiterId = processingWaiterOperationId(playerId);
            const waiterRows = await tx
              .select({
                playerId: schema.operationsLog.playerId,
                operationType: schema.operationsLog.operationType,
                operationState: schema.operationsLog.operationState,
                completed: schema.operationsLog.completed,
              })
              .from(schema.operationsLog)
              .where(eq(schema.operationsLog.id, waiterId));
            const waiterRow = waiterRows[0];
            const waiterState = waiterRow
              ? normalizeStoredProcessingWaiter(waiterRow.operationState)
              : null;
            if (
              waiterRow &&
              (waiterRow.playerId !== playerId ||
                waiterRow.operationType !== "processing_waiter" ||
                waiterRow.completed !== false ||
                !waiterState ||
                waiterState.requestId !== acceptedRequest.requestId ||
                waiterState.skill !== acceptedRequest.skill ||
                waiterState.status !== "pending" ||
                waiterState.ownerId !== this.processingRequestOwnerId ||
                JSON.stringify(waiterState.envelope) !==
                  JSON.stringify(envelope))
            ) {
              throw new Error("processing_action_waiter_state_invalid");
            }
            const terminalWaiter: StoredProcessingWaiter = {
              version: 1,
              requestId: acceptedRequest.requestId,
              skill: acceptedRequest.skill,
              envelope,
              ownerId: this.processingRequestOwnerId,
              acceptedAt: waiterState?.acceptedAt ?? acceptedRequest.acceptedAt,
              heartbeatAt: now,
              status: "committed",
              terminalAt: now,
              acknowledgedAt: null,
            };
            if (waiterRow) {
              await tx
                .update(schema.operationsLog)
                .set({ operationState: terminalWaiter, timestamp: now })
                .where(eq(schema.operationsLog.id, waiterId));
            } else {
              await tx.insert(schema.operationsLog).values({
                id: waiterId,
                playerId,
                operationType: "processing_waiter",
                operationState: terminalWaiter,
                completed: false,
                timestamp: now,
                completedAt: null,
              });
            }
          }
        } else {
          await tx.insert(schema.operationsLog).values({
            id: operationId,
            playerId,
            operationType: "processing_action",
            operationState,
            completed: true,
            timestamp: now,
            completedAt: now,
          });
        }

        const activeQuestRows = await tx
          .select({
            questId: schema.questProgress.questId,
            currentStage: schema.questProgress.currentStage,
            startedAt: schema.questProgress.startedAt,
          })
          .from(schema.questProgress)
          .where(
            and(
              eq(schema.questProgress.playerId, playerId),
              eq(schema.questProgress.status, "in_progress"),
            ),
          );
        const questContexts = activeQuestRows.map((row) => ({
          questId: String(row.questId ?? "").trim(),
          currentStage: String(row.currentStage ?? "").trim(),
          startedAt: Number(row.startedAt),
        }));
        if (
          questContexts.some(
            (context) =>
              !context.questId ||
              context.questId.length > 256 ||
              !context.currentStage ||
              context.currentStage.length > 256 ||
              !Number.isSafeInteger(context.startedAt) ||
              context.startedAt < 0,
          )
        ) {
          throw new Error("processing_action_quest_state_invalid");
        }
        const targetQuantities = new Map<string, number>();
        for (const output of outputs) {
          targetQuantities.set(
            output.itemId,
            (targetQuantities.get(output.itemId) ?? 0) + output.quantity,
          );
        }
        if (worldEffect) {
          targetQuantities.set("fire", (targetQuantities.get("fire") ?? 0) + 1);
        }
        const questTargets = [...targetQuantities].map(
          ([targetId, quantity]) => ({ targetId, quantity }),
        );
        if (
          questTargets.some(
            (target) =>
              !target.targetId ||
              target.targetId.length > 256 ||
              !Number.isSafeInteger(target.quantity) ||
              target.quantity <= 0 ||
              target.quantity > MAX_PERSISTED_ITEM_QUANTITY,
          )
        ) {
          throw new Error("processing_action_quest_target_invalid");
        }
        if (questContexts.length > 0 && questTargets.length > 0) {
          await tx.insert(schema.questProcessingProgressReceipts).values(
            questContexts.flatMap((context) =>
              questTargets.map((target) => ({
                operationId,
                playerId,
                questId: context.questId,
                questStartedAt: context.startedAt,
                capturedStage: context.currentStage,
                targetId: target.targetId,
                quantity: target.quantity,
                createdAt: now,
              })),
            ),
          );
        }
        if (operationState.worldEffect) {
          await tx.insert(schema.processingActiveFires).values({
            fireId: operationState.worldEffect.fireId,
            operationId,
            playerId,
            positionX: operationState.worldEffect.position.x,
            positionY: operationState.worldEffect.position.y,
            positionZ: operationState.worldEffect.position.z,
            tileX: operationState.worldEffect.tile.x,
            tileZ: operationState.worldEffect.tile.z,
            createdAt: operationState.worldEffect.createdAt,
            expiresAt: operationState.worldEffect.expiresAt,
            extinguishedAt: null,
          });
        }

        return {
          operationId,
          playerId,
          requestFingerprint,
          replayed: false,
          skill,
          xpAmount,
          inputs,
          requiredItems,
          consumables,
          consumableStates,
          outputs,
          ...(coinCost > 0 ? { coinCost, currentCoins: nextCoins } : {}),
          ...(operationState.worldEffect
            ? { worldEffect: operationState.worldEffect }
            : {}),
          awardedXp,
          operationCommittedXp,
          currentXp: operationCommittedXp,
          currentLevel,
          committed,
        };
      },
      // Explicit character-row and fire-tile locks define the complete write
      // set. READ COMMITTED lets a tile-lock waiter observe the prior commit;
      // SERIALIZABLE would retain the pre-wait snapshot and abort at COMMIT.
      { isolationLevel: "read committed" },
    );
    try {
      return await this.trackAwaitedOperation(operation);
    } catch (error) {
      if (
        worldEffect &&
        hasPostgresConstraint(
          error,
          "processing_active_fires_active_tile_unique",
        )
      ) {
        throw new Error("processing_action_fire_tile_occupied");
      }
      throw error;
    }
  }

  /**
   * Resolve one player-owned deterministic processing receipt. This deliberately
   * returns no custody details and treats ownership/type mismatches as absent.
   */
  async getProcessingActionCommitStatusAsync(
    playerId: string,
    operationId: string,
  ): Promise<
    "committed" | "pending" | "interrupted" | "rejected" | "not_found"
  > {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const normalizedPlayerId = String(playerId ?? "").trim();
    const normalizedOperationId = String(operationId ?? "").trim();
    if (
      !normalizedPlayerId ||
      !normalizedOperationId ||
      normalizedOperationId.length > 256
    ) {
      throw new Error("processing_action_request_invalid");
    }

    const rows = await this.db
      .select({
        playerId: schema.operationsLog.playerId,
        operationType: schema.operationsLog.operationType,
        operationState: schema.operationsLog.operationState,
        completed: schema.operationsLog.completed,
      })
      .from(schema.operationsLog)
      .where(eq(schema.operationsLog.id, normalizedOperationId));
    const receipt = rows[0];
    if (receipt?.playerId !== normalizedPlayerId) return "not_found";
    if (
      receipt.operationType === "processing_action" &&
      receipt.completed === true
    ) {
      return "committed";
    }
    if (
      receipt.operationType === "processing_request_rejected" &&
      receipt.completed === true
    ) {
      return "rejected";
    }
    if (
      receipt.operationType === "processing_request" &&
      receipt.completed === false
    ) {
      const state = receipt.operationState as
        StoredPendingProcessingRequest | undefined;
      if (
        state?.version !== 1 ||
        getProcessingRequestOperationId(state.skill, state.requestId) !==
          normalizedOperationId ||
        !state.ownerId
      ) {
        return "not_found";
      }
      return state.ownerId === this.processingRequestOwnerId
        ? "pending"
        : "interrupted";
    }
    return "not_found";
  }

  /** Return the authenticated player's one durable, unacknowledged command. */
  async getRecoverableProcessingRequestAsync(
    playerId: string,
  ): Promise<RecoverableProcessingRequest | null> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const normalizedPlayerId = String(playerId ?? "").trim();
    if (!normalizedPlayerId) {
      throw new Error("processing_action_request_invalid");
    }
    return this.executeInTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT "id" FROM "characters" WHERE "id" = ${normalizedPlayerId} FOR UPDATE`,
      );
      const waiterId = processingWaiterOperationId(normalizedPlayerId);
      const waiterRows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          operationState: schema.operationsLog.operationState,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, waiterId));
      const waiterRow = waiterRows[0];
      if (!waiterRow) return null;
      const waiter = normalizeStoredProcessingWaiter(waiterRow.operationState);
      if (
        waiterRow.playerId !== normalizedPlayerId ||
        waiterRow.operationType !== "processing_waiter" ||
        !waiter
      ) {
        throw new Error("processing_action_waiter_state_invalid");
      }
      if (waiterRow.completed === true) {
        if (waiter.acknowledgedAt === null) {
          throw new Error("processing_action_waiter_state_invalid");
        }
        return null;
      }
      if (waiterRow.completed !== false || waiter.acknowledgedAt !== null) {
        throw new Error("processing_action_waiter_state_invalid");
      }

      const operationId = getProcessingRequestOperationId(
        waiter.skill,
        waiter.requestId,
      );
      if (!operationId) {
        throw new Error("processing_action_waiter_state_invalid");
      }
      const receiptRows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          operationState: schema.operationsLog.operationState,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, operationId));
      const receipt = receiptRows[0];
      if (receipt?.playerId !== normalizedPlayerId) {
        throw new Error("processing_action_waiter_state_invalid");
      }

      let status: RecoverableProcessingRequest["status"];
      if (
        receipt.operationType === "processing_action" &&
        receipt.completed === true
      ) {
        status = "committed";
      } else if (
        receipt.operationType === "processing_request_rejected" &&
        receipt.completed === true
      ) {
        status = "rejected";
      } else if (
        receipt.operationType === "processing_request" &&
        receipt.completed === false
      ) {
        const pending = receipt.operationState as
          StoredPendingProcessingRequest | undefined;
        const pendingEnvelope = normalizeProcessingRequestEnvelope(
          waiter.skill,
          pending?.envelope,
        );
        if (
          pending?.version !== 1 ||
          pending.requestId !== waiter.requestId ||
          pending.skill !== waiter.skill ||
          !pending.ownerId ||
          !pendingEnvelope ||
          JSON.stringify(pendingEnvelope) !== JSON.stringify(waiter.envelope)
        ) {
          throw new Error("processing_action_waiter_state_invalid");
        }
        status =
          pending.ownerId === this.processingRequestOwnerId
            ? "pending"
            : "interrupted";
      } else {
        throw new Error("processing_action_waiter_state_invalid");
      }

      if (
        (status === "committed" && waiter.status !== "committed") ||
        (status === "rejected" && waiter.status !== "rejected") ||
        ((status === "pending" || status === "interrupted") &&
          waiter.status !== "pending")
      ) {
        throw new Error("processing_action_waiter_state_invalid");
      }
      return {
        requestId: waiter.requestId,
        skill: waiter.skill,
        status,
        envelope: waiter.envelope,
        acceptedAt: waiter.acceptedAt,
        heartbeatAt: waiter.heartbeatAt,
        terminalAt: waiter.terminalAt,
      };
    });
  }

  /** Mark one exact terminal command consumed; duplicate acknowledgements succeed. */
  async acknowledgeProcessingRequestAsync(
    playerId: string,
    requestId: string,
  ): Promise<boolean> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const normalizedPlayerId = String(playerId ?? "").trim();
    const normalizedRequestId = normalizeProcessingRequestId(requestId);
    if (!normalizedPlayerId || !normalizedRequestId) return false;
    return this.executeInTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT "id" FROM "characters" WHERE "id" = ${normalizedPlayerId} FOR UPDATE`,
      );
      const waiterId = processingWaiterOperationId(normalizedPlayerId);
      const waiterRows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          operationState: schema.operationsLog.operationState,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, waiterId));
      const waiterRow = waiterRows[0];
      const waiter = waiterRow
        ? normalizeStoredProcessingWaiter(waiterRow.operationState)
        : null;
      if (
        waiterRow?.playerId !== normalizedPlayerId ||
        waiterRow.operationType !== "processing_waiter" ||
        !waiter ||
        waiter.requestId !== normalizedRequestId ||
        waiter.status === "pending"
      ) {
        return false;
      }
      if (waiterRow.completed === true) {
        return waiter.acknowledgedAt !== null;
      }
      if (waiterRow.completed !== false || waiter.acknowledgedAt !== null) {
        return false;
      }

      const operationId = getProcessingRequestOperationId(
        waiter.skill,
        waiter.requestId,
      );
      if (!operationId) return false;
      const receiptRows = await tx
        .select({
          playerId: schema.operationsLog.playerId,
          operationType: schema.operationsLog.operationType,
          completed: schema.operationsLog.completed,
        })
        .from(schema.operationsLog)
        .where(eq(schema.operationsLog.id, operationId));
      const receipt = receiptRows[0];
      const terminalMatches =
        receipt?.playerId === normalizedPlayerId &&
        receipt.completed === true &&
        ((waiter.status === "committed" &&
          receipt.operationType === "processing_action") ||
          (waiter.status === "rejected" &&
            receipt.operationType === "processing_request_rejected"));
      if (!terminalMatches) return false;

      const now = Date.now();
      await tx
        .update(schema.operationsLog)
        .set({
          operationState: { ...waiter, acknowledgedAt: now },
          completed: true,
          timestamp: now,
          completedAt: now,
        })
        .where(eq(schema.operationsLog.id, waiterId));
      return true;
    });
  }

  /** Load every committed Firemaking effect whose authoritative lifetime is active. */
  async getActiveProcessingFiresAsync(): Promise<ActiveProcessingFire[]> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const now = Date.now();
    const rows = await this.db
      .select({
        fireId: schema.processingActiveFires.fireId,
        playerId: schema.processingActiveFires.playerId,
        positionX: schema.processingActiveFires.positionX,
        positionY: schema.processingActiveFires.positionY,
        positionZ: schema.processingActiveFires.positionZ,
        tileX: schema.processingActiveFires.tileX,
        tileZ: schema.processingActiveFires.tileZ,
        createdAt: schema.processingActiveFires.createdAt,
        expiresAt: schema.processingActiveFires.expiresAt,
      })
      .from(schema.processingActiveFires)
      .where(
        and(
          isNull(schema.processingActiveFires.extinguishedAt),
          gt(schema.processingActiveFires.expiresAt, now),
        ),
      );
    return rows
      .map((row) => {
        const effect = normalizeStoredProcessingFireEffect({
          kind: "fire",
          fireId: row.fireId,
          position: {
            x: Number(row.positionX),
            y: Number(row.positionY),
            z: Number(row.positionZ),
          },
          tile: { x: Number(row.tileX), z: Number(row.tileZ) },
          createdAt: Number(row.createdAt),
          expiresAt: Number(row.expiresAt),
        });
        if (!effect) {
          throw new Error("processing_action_world_effect_state_invalid");
        }
        return { ...effect, playerId: row.playerId };
      })
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt ||
          left.fireId.localeCompare(right.fireId),
      );
  }

  /**
   * Idempotently close one fire. The boolean identifies the process that won
   * the transition and therefore owns one-time expiry side effects such as ashes.
   */
  async markProcessingFireExtinguishedAsync(fireId: string): Promise<boolean> {
    if (!this.db || this.isDestroying) {
      throw new Error("processing_action_database_unavailable");
    }
    const normalizedFireId = String(fireId ?? "").trim();
    if (
      normalizedFireId !== fireId ||
      !/^fire_[A-Za-z0-9_-]+$/.test(normalizedFireId) ||
      normalizedFireId.length > 256
    ) {
      throw new Error("processing_action_request_invalid");
    }
    const updated = await this.db
      .update(schema.processingActiveFires)
      .set({ extinguishedAt: Date.now() })
      .where(
        and(
          eq(schema.processingActiveFires.fireId, normalizedFireId),
          isNull(schema.processingActiveFires.extinguishedAt),
        ),
      )
      .returning({ fireId: schema.processingActiveFires.fireId });
    return updated.length === 1;
  }

  /**
   * Debit one exact equipped stack and its durable receipt in the same
   * serializable transaction. The shared character-row lock prevents this
   * custody transition from racing loadout switches or inventory debits.
   */
  async commitEquipmentStackDebitOperationAsync(
    request: EquipmentStackDebitCommitRequest,
  ): Promise<EquipmentStackDebitCommitReceipt> {
    if (!this.db) {
      throw new Error("equipment_stack_debit_database_unavailable");
    }
    const operationId = String(request.operationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    const slotType = String(request.slotType ?? "").trim();
    const itemId = String(request.itemId ?? "").trim();
    const quantity = Number(request.quantity);
    if (
      !operationId ||
      operationId.length > 256 ||
      !playerId ||
      !/^[a-f0-9]{64}$/.test(requestFingerprint) ||
      !slotType ||
      slotType.length > 64 ||
      !itemId ||
      itemId.length > 256 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_PERSISTED_ITEM_QUANTITY ||
      requestFingerprint !==
        equipmentStackDebitFingerprint(playerId, slotType, itemId, quantity)
    ) {
      throw new Error("equipment_stack_debit_request_invalid");
    }

    return this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({ id: schema.characters.id })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        if (!characterRows[0]) {
          throw new Error("equipment_stack_debit_player_missing");
        }

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredEquipmentStackDebitOperation | undefined;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "equipment_stack_debit" ||
            existing.completed !== true ||
            state?.version !== 1 ||
            state.requestFingerprint !== requestFingerprint ||
            state.slotType !== slotType ||
            state.itemId !== itemId ||
            state.quantity !== quantity
          ) {
            throw new Error("equipment_stack_debit_operation_id_conflict");
          }

          const currentRows = await tx
            .select({
              slotType: schema.equipment.slotType,
              itemId: schema.equipment.itemId,
              quantity: schema.equipment.quantity,
            })
            .from(schema.equipment)
            .where(eq(schema.equipment.playerId, playerId));
          const committed = normalizeEquipmentSnapshot(
            currentRows
              .filter((row) => Boolean(row.itemId))
              .map((row) => ({
                slotType: row.slotType,
                itemId: row.itemId!,
                quantity: row.quantity ?? 1,
              })),
            "equipment_stack_debit",
          );
          return {
            operationId,
            playerId,
            requestFingerprint,
            replayed: true,
            slotType,
            itemId,
            quantity,
            committed,
          };
        }

        const equipmentRows = await tx
          .select({
            slotType: schema.equipment.slotType,
            itemId: schema.equipment.itemId,
            quantity: schema.equipment.quantity,
          })
          .from(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));
        const persisted = normalizeEquipmentSnapshot(
          equipmentRows
            .filter((row) => Boolean(row.itemId))
            .map((row) => ({
              slotType: row.slotType,
              itemId: row.itemId!,
              quantity: row.quantity ?? 1,
            })),
          "equipment_stack_debit",
        );
        const committed = debitEquipmentStackSnapshot(
          persisted,
          slotType,
          itemId,
          quantity,
        );

        await tx
          .delete(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));
        if (committed.length > 0) {
          await tx.insert(schema.equipment).values(
            committed.map((item) => ({
              playerId,
              slotType: item.slotType,
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          );
        }

        const operationState: StoredEquipmentStackDebitOperation = {
          version: 1,
          requestFingerprint,
          slotType,
          itemId,
          quantity,
          committed,
        };
        const now = Date.now();
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "equipment_stack_debit",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });

        return {
          operationId,
          playerId,
          requestFingerprint,
          replayed: false,
          slotType,
          itemId,
          quantity,
          committed,
        };
      },
      { isolationLevel: "serializable" },
    );
  }

  /**
   * Commit one exact fixed-point prayer transition and its replay receipt.
   * Every transition shares the per-character row lock used by combat custody.
   */
  async commitPrayerStateOperationAsync(
    request: PrayerStateCommitRequest,
  ): Promise<PrayerStateCommitReceipt> {
    if (!this.db) throw new Error("prayer_state_database_unavailable");

    const operationId = String(request.operationId ?? "").trim();
    const playerId = String(request.playerId ?? "").trim();
    const requestFingerprint = String(request.requestFingerprint ?? "").trim();
    const transition = request.transition;
    if (
      !operationId ||
      operationId.length > 256 ||
      !playerId ||
      !PRAYER_TRANSITIONS.has(transition) ||
      !/^[a-f0-9]{64}$/.test(requestFingerprint)
    ) {
      throw new Error("prayer_state_request_invalid");
    }
    const expected = normalizePrayerSnapshot(request.expected, "prayer_state");
    const committed = normalizePrayerSnapshot(
      request.committed,
      "prayer_state",
    );
    validatePrayerTransition(transition, expected, committed);
    if (
      requestFingerprint !==
      prayerStateFingerprint(playerId, transition, expected, committed)
    ) {
      throw new Error("prayer_state_request_invalid");
    }

    return this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const characterRows = await tx
          .select({
            id: schema.characters.id,
            prayerPoints: schema.characters.prayerPoints,
            prayerPointUnits: schema.characters.prayerPointUnits,
            prayerMaxPoints: schema.characters.prayerMaxPoints,
            activePrayers: schema.characters.activePrayers,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        const character = characterRows[0];
        if (!character) throw new Error("prayer_state_player_missing");

        const persisted = normalizePrayerSnapshot(
          {
            pointUnits:
              character.prayerPointUnits ??
              (character.prayerPoints ?? 1) * PRAYER_POINT_UNITS_PER_POINT,
            maxPoints: character.prayerMaxPoints ?? 1,
            activePrayers: character.activePrayers ?? [],
          },
          "prayer_state",
        );

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredPrayerStateOperation | undefined;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "prayer_state_transition" ||
            existing.completed !== true ||
            state?.version !== 1 ||
            state.requestFingerprint !== requestFingerprint ||
            state.transition !== transition ||
            !prayerSnapshotsEqual(
              normalizePrayerSnapshot(state.expected, "prayer_state"),
              expected,
            ) ||
            !prayerSnapshotsEqual(
              normalizePrayerSnapshot(state.committed, "prayer_state"),
              committed,
            )
          ) {
            throw new Error("prayer_state_operation_id_conflict");
          }
          // Converge on current locked custody. An old replay after a newer
          // drain/toggle must never restore its historical post-state.
          return {
            operationId,
            playerId,
            requestFingerprint,
            transition,
            replayed: true,
            committed: persisted,
          };
        }

        if (!prayerSnapshotsEqual(persisted, expected)) {
          throw new Error("prayer_state_conflict");
        }

        await tx
          .update(schema.characters)
          .set({
            prayerPointUnits: committed.pointUnits,
            prayerPoints:
              committed.pointUnits <= 0
                ? 0
                : Math.ceil(
                    committed.pointUnits / PRAYER_POINT_UNITS_PER_POINT,
                  ),
            prayerMaxPoints: committed.maxPoints,
            activePrayers: committed.activePrayers,
          })
          .where(eq(schema.characters.id, playerId));

        const operationState: StoredPrayerStateOperation = {
          version: 1,
          requestFingerprint,
          transition,
          expected,
          committed,
        };
        const now = Date.now();
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "prayer_state_transition",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });

        return {
          operationId,
          playerId,
          requestFingerprint,
          transition,
          replayed: false,
          committed,
        };
      },
      {
        isolationLevel: "serializable",
        // Every fighter drains concurrently and each transaction appends an
        // idempotency receipt to the shared operations log. PostgreSQL SSI can
        // abort a valid snapshot even though the character rows are distinct;
        // retry the complete rolled-back transition on a fresh connection.
        maxConflictRetries: 4,
      },
    );
  }

  // ============================================================================
  // SESSION TRACKING
  // ============================================================================

  /**
   * Create a new player session
   * Delegates to SessionRepository
   */
  async createPlayerSessionAsync(
    sessionData: Omit<PlayerSessionRow, "id" | "sessionId">,
    sessionId?: string,
  ): Promise<string> {
    try {
      return await this.sessionRepository.createPlayerSessionAsync(
        sessionData,
        sessionId,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] createPlayerSessionAsync(${sessionData.playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return (
          sessionId ||
          `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
        );
      }
      throw error;
    }
  }

  /**
   * Update an existing player session
   * Delegates to SessionRepository
   */
  async updatePlayerSessionAsync(
    sessionId: string,
    updates: Partial<PlayerSessionRow>,
  ): Promise<void> {
    try {
      return await this.sessionRepository.updatePlayerSessionAsync(
        sessionId,
        updates,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] updatePlayerSessionAsync(${sessionId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Batch update lastActivity for multiple sessions in a single query
   *
   * Delegates to SessionRepository.batchUpdateLastActivityAsync
   * Uses a single SQL query instead of N separate queries.
   */
  async batchUpdateSessionLastActivityAsync(
    sessionIds: string[],
    timestamp: number,
  ): Promise<void> {
    try {
      return await this.sessionRepository.batchUpdateLastActivityAsync(
        sessionIds,
        timestamp,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] batchUpdateSessionLastActivityAsync(${sessionIds.length}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Get all active player sessions
   * Delegates to SessionRepository
   */
  async getActivePlayerSessionsAsync(): Promise<PlayerSessionRow[]> {
    try {
      return await this.sessionRepository.getActivePlayerSessionsAsync();
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          "[DatabaseSystem] getActivePlayerSessionsAsync failed due to database connectivity; continuing in best-effort mode",
          error,
        );
        return [];
      }
      throw error;
    }
  }

  /**
   * End a player session
   * Delegates to SessionRepository
   */
  async endPlayerSessionAsync(
    sessionId: string,
    reason?: string,
  ): Promise<void> {
    try {
      return await this.sessionRepository.endPlayerSessionAsync(
        sessionId,
        reason,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] endPlayerSessionAsync(${sessionId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  // ============================================================================
  // WORLD CHUNK PERSISTENCE
  // ============================================================================

  /**
   * Load world chunk data from database
   * Delegates to WorldChunkRepository
   */
  async getWorldChunkAsync(
    chunkX: number,
    chunkZ: number,
  ): Promise<WorldChunkRow | null> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return null;
    return this.worldChunkRepository.getWorldChunkAsync(chunkX, chunkZ);
  }

  /**
   * Save world chunk data to database
   * Delegates to WorldChunkRepository
   */
  async saveWorldChunkAsync(chunkData: {
    chunkX: number;
    chunkZ: number;
    data: string;
  }): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.saveWorldChunkAsync(chunkData);
  }

  /**
   * Get world items for a chunk
   * Delegates to WorldChunkRepository
   */
  async getWorldItemsAsync(
    _chunkX: number,
    _chunkZ: number,
  ): Promise<ItemRow[]> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return [];
    return this.worldChunkRepository.getWorldItemsAsync(_chunkX, _chunkZ);
  }

  /**
   * Save world items for a chunk
   * Delegates to WorldChunkRepository
   */
  async saveWorldItemsAsync(
    _chunkX: number,
    _chunkZ: number,
    _items: ItemRow[],
  ): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.saveWorldItemsAsync(
      _chunkX,
      _chunkZ,
      _items,
    );
  }

  /**
   * Get inactive chunks
   * Delegates to WorldChunkRepository
   */
  async getInactiveChunksAsync(minutes: number): Promise<WorldChunkRow[]> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return [];
    return this.worldChunkRepository.getInactiveChunksAsync(minutes);
  }

  /**
   * Update chunk player count
   * Delegates to WorldChunkRepository
   */
  async updateChunkPlayerCountAsync(
    chunkX: number,
    chunkZ: number,
    playerCount: number,
  ): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.updateChunkPlayerCountAsync(
      chunkX,
      chunkZ,
      playerCount,
    );
  }

  /**
   * Mark chunk for reset
   * Delegates to WorldChunkRepository
   */
  async markChunkForResetAsync(chunkX: number, chunkZ: number): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.markChunkForResetAsync(chunkX, chunkZ);
  }

  /**
   * Reset chunk
   * Delegates to WorldChunkRepository
   */
  async resetChunkAsync(chunkX: number, chunkZ: number): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.resetChunkAsync(chunkX, chunkZ);
  }

  // ============================================================================
  // NPC KILL TRACKING
  // ============================================================================

  /**
   * Increment NPC kill count for a player
   * Delegates to NPCKillRepository
   */
  async incrementNPCKillAsync(playerId: string, npcId: string): Promise<void> {
    return this.npcKillRepository.incrementNPCKillAsync(playerId, npcId);
  }

  /**
   * Get all NPC kill statistics for a player
   * Delegates to NPCKillRepository
   */
  async getPlayerNPCKillsAsync(
    playerId: string,
  ): Promise<Array<{ npcId: string; killCount: number }>> {
    return this.npcKillRepository.getPlayerNPCKillsAsync(playerId);
  }

  /**
   * Get kill count for a specific NPC type
   * Delegates to NPCKillRepository
   */
  async getNPCKillCountAsync(playerId: string, npcId: string): Promise<number> {
    return this.npcKillRepository.getNPCKillCountAsync(playerId, npcId);
  }

  // ============================================================================
  // QUEST MANAGEMENT
  // ============================================================================

  /**
   * Get the quest repository for quest persistence operations
   *
   * Used by QuestSystem to persist quest progress, completion status,
   * and quest points to the database.
   *
   * @returns The QuestRepository instance
   */
  getQuestRepository(): QuestRepository {
    return this.questRepository;
  }

  // ============================================================================
  // ACTIVITY LOG MANAGEMENT (Admin Panel)
  // ============================================================================

  /**
   * Insert a single activity log entry
   * Delegates to ActivityLogRepository
   */
  async insertActivityAsync(entry: ActivityLogEntry): Promise<number> {
    return this.activityLogRepository.insertActivityAsync(entry);
  }

  /**
   * Insert multiple activity log entries in a batch
   * Delegates to ActivityLogRepository
   */
  async insertActivitiesBatchAsync(
    entries: ActivityLogEntry[],
  ): Promise<number> {
    return this.activityLogRepository.insertActivitiesBatchAsync(entries);
  }

  /**
   * Query activity logs with filtering
   * Delegates to ActivityLogRepository
   */
  async queryActivitiesAsync(
    options: ActivityLogQueryOptions,
  ): Promise<ActivityLogRow[]> {
    return this.activityLogRepository.queryActivitiesAsync(options);
  }

  /**
   * Get count of activity logs matching criteria
   * Delegates to ActivityLogRepository
   */
  async countActivitiesAsync(
    options: ActivityLogQueryOptions,
  ): Promise<number> {
    return this.activityLogRepository.countActivitiesAsync(options);
  }

  /**
   * Get distinct event types in the activity log
   * Delegates to ActivityLogRepository
   */
  async getActivityEventTypesAsync(): Promise<string[]> {
    return this.activityLogRepository.getEventTypesAsync();
  }

  /**
   * Insert a trade record
   * Delegates to ActivityLogRepository
   */
  async insertTradeAsync(entry: TradeEntry): Promise<number> {
    return this.activityLogRepository.insertTradeAsync(entry);
  }

  /**
   * Query trade history with filtering
   * Delegates to ActivityLogRepository
   */
  async queryTradesAsync(options: TradeQueryOptions): Promise<TradeRow[]> {
    return this.activityLogRepository.queryTradesAsync(options);
  }

  /**
   * Get count of trades matching criteria
   * Delegates to ActivityLogRepository
   */
  async countTradesAsync(options: TradeQueryOptions): Promise<number> {
    return this.activityLogRepository.countTradesAsync(options);
  }

  /**
   * Cleanup old activity logs (retention policy)
   * Delegates to ActivityLogRepository
   */
  async cleanupOldActivitiesAsync(daysOld: number = 90): Promise<number> {
    return this.activityLogRepository.cleanupOldActivitiesAsync(daysOld);
  }

  /**
   * Cleanup old trade records (retention policy)
   * Delegates to ActivityLogRepository
   */
  async cleanupOldTradesAsync(daysOld: number = 90): Promise<number> {
    return this.activityLogRepository.cleanupOldTradesAsync(daysOld);
  }

  /**
   * Get activity summary for a player
   * Delegates to ActivityLogRepository
   */
  async getPlayerActivitySummaryAsync(
    playerId: string,
  ): Promise<Record<string, number>> {
    return this.activityLogRepository.getPlayerActivitySummaryAsync(playerId);
  }

  /**
   * Get the ActivityLogRepository for direct access
   * Used by ActivityLoggerSystem for batch operations
   */
  getActivityLogRepository(): ActivityLogRepository {
    return this.activityLogRepository;
  }

  /**
   * Get the BankRepository for direct access
   * Used by admin routes for bank queries
   */
  getBankRepository(): BankRepository {
    return this.bankRepository;
  }

  // ============================================================================
  // DEATH LOCK MANAGEMENT
  // ============================================================================

  /**
   * Save or update a death lock for a player
   * Delegates to DeathRepository
   *
   * CRITICAL FOR SECURITY: Prevents item duplication on server restart!
   *
   * Now includes items array for crash recovery.
   *
   * @param data - Death lock data including items for recovery
   * @param tx - Optional transaction context for atomic operations
   */
  async commitSafeAreaDeathOperationAsync(
    request: SafeDeathCaptureCommitRequest,
  ): Promise<SafeDeathCaptureCommitReceipt> {
    if (!this.db) throw new Error("safe_death_database_unavailable");
    const operationId = normalizeDeathOperationId(request.operationId);
    const playerId = normalizeDeathPlayerId(request.playerId);
    const deathTimestamp = Number(request.deathTimestamp);
    const position = {
      x: Number(request.position?.x),
      y: Number(request.position?.y),
      z: Number(request.position?.z),
    };
    const killedBy = String(request.killedBy ?? "").trim();
    if (
      !Number.isSafeInteger(deathTimestamp) ||
      deathTimestamp <= 0 ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z) ||
      Math.abs(position.x) > 10_000 ||
      Math.abs(position.z) > 10_000 ||
      position.y < -500 ||
      position.y > 500 ||
      !killedBy ||
      killedBy.length > 64 ||
      /[\u0000-\u001f\u007f]/u.test(killedBy)
    ) {
      throw new Error("safe_death_request_invalid");
    }
    const requestFingerprint = safeDeathCaptureFingerprint(
      playerId,
      deathTimestamp,
      position,
      killedBy,
    );

    return this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const character = await tx
          .select({ id: schema.characters.id })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        if (!character[0]) throw new Error("safe_death_player_missing");

        const operationRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existingOperation = operationRows[0];
        if (existingOperation) {
          const state = existingOperation.operationState as
            StoredSafeDeathCaptureOperation | undefined;
          if (
            existingOperation.playerId !== playerId ||
            existingOperation.operationType !== "safe_death_capture" ||
            existingOperation.completed !== true ||
            state?.version !== 1 ||
            state.requestFingerprint !== requestFingerprint ||
            state.deathTimestamp !== deathTimestamp ||
            JSON.stringify(state.position) !== JSON.stringify(position) ||
            state.killedBy !== killedBy
          ) {
            throw new Error("safe_death_operation_id_conflict");
          }
          return {
            operationId,
            playerId,
            requestFingerprint,
            replayed: true,
            deathTimestamp,
            dropped: normalizeDeathCustodyItems(state.dropped),
            kept: normalizeDeathCustodyItems(state.kept),
          };
        }

        const activeDeath = await tx
          .select({ playerId: schema.playerDeaths.playerId })
          .from(schema.playerDeaths)
          .where(eq(schema.playerDeaths.playerId, playerId));
        if (activeDeath[0]) throw new Error("safe_death_active_lock_exists");

        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        const equipmentRows = await tx
          .select({
            itemId: schema.equipment.itemId,
            quantity: schema.equipment.quantity,
          })
          .from(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));
        const persistedInventory = normalizePersistedInventoryRows(
          inventoryRows,
          "safe_death",
        );
        const allItems = normalizeDeathCustodyItems([
          ...persistedInventory.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
          ...equipmentRows
            .filter((item) => Boolean(item.itemId))
            .map((item) => ({
              itemId: item.itemId!,
              quantity: item.quantity ?? 1,
            })),
        ]);
        const { dropped, kept } = splitSafeDeathCustody(allItems, 3);

        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        await tx
          .delete(schema.equipment)
          .where(eq(schema.equipment.playerId, playerId));

        const operationState: StoredSafeDeathCaptureOperation = {
          version: 1,
          requestFingerprint,
          deathTimestamp,
          position,
          killedBy,
          dropped,
          kept,
        };
        const now = Date.now();
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "safe_death_capture",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });
        if (dropped.length > 0 || kept.length > 0) {
          await tx.insert(schema.playerDeaths).values({
            playerId,
            gravestoneId: null,
            groundItemIds: "[]",
            position: JSON.stringify(position),
            timestamp: deathTimestamp,
            zoneType: "safe_area",
            itemCount: dropped.length,
            items: dropped,
            keptItems: kept,
            deathOperationId: operationId,
            killedBy,
            recovered: false,
            createdAt: now,
            updatedAt: now,
          });
        }

        return {
          operationId,
          playerId,
          requestFingerprint,
          replayed: false,
          deathTimestamp,
          dropped,
          kept,
        };
      },
      { isolationLevel: "serializable" },
    );
  }

  async commitSafeAreaDeathKeptReturnAsync(input: {
    playerId: string;
    deathOperationId: string;
  }): Promise<SafeDeathKeptReturnReceipt> {
    if (!this.db) throw new Error("safe_death_database_unavailable");
    const playerId = normalizeDeathPlayerId(input.playerId);
    const deathOperationId = normalizeDeathOperationId(input.deathOperationId);
    const operationId = deathKeptReturnOperationId(deathOperationId);

    return this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const character = await tx
          .select({ id: schema.characters.id })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        if (!character[0]) throw new Error("safe_death_player_missing");

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredSafeDeathKeptReturnOperation | undefined;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "safe_death_kept_return" ||
            existing.completed !== true ||
            state?.version !== 1 ||
            state.deathOperationId !== deathOperationId
          ) {
            throw new Error("safe_death_operation_id_conflict");
          }
          const currentRows = await tx
            .select({
              itemId: schema.inventory.itemId,
              quantity: schema.inventory.quantity,
              slotIndex: schema.inventory.slotIndex,
              metadata: schema.inventory.metadata,
            })
            .from(schema.inventory)
            .where(eq(schema.inventory.playerId, playerId));
          return {
            operationId,
            playerId,
            deathOperationId,
            replayed: true,
            returned: normalizeDeathCustodyItems(state.returned),
            committed: normalizePersistedInventoryRows(
              currentRows,
              "safe_death",
            ),
          };
        }

        const deathRows = await tx
          .select({
            deathOperationId: schema.playerDeaths.deathOperationId,
            items: schema.playerDeaths.items,
            keptItems: schema.playerDeaths.keptItems,
          })
          .from(schema.playerDeaths)
          .where(eq(schema.playerDeaths.playerId, playerId));
        const death = deathRows[0];
        if (!death || death.deathOperationId !== deathOperationId) {
          throw new Error("safe_death_lock_mismatch");
        }
        const returned = normalizeDeathCustodyItems(death.keptItems);
        const remaining = normalizeDeathCustodyItems(death.items);
        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        let committed = normalizePersistedInventoryRows(
          inventoryRows,
          "safe_death",
        );
        for (const item of returned) {
          committed = creditDeathCustodyItem(committed, item);
        }
        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        if (committed.length > 0) {
          await tx.insert(schema.inventory).values(
            committed.map((item) => ({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }
        if (remaining.length === 0) {
          await tx
            .delete(schema.playerDeaths)
            .where(eq(schema.playerDeaths.playerId, playerId));
        } else {
          await tx
            .update(schema.playerDeaths)
            .set({ keptItems: [], updatedAt: Date.now() })
            .where(eq(schema.playerDeaths.playerId, playerId));
        }
        const operationState: StoredSafeDeathKeptReturnOperation = {
          version: 1,
          deathOperationId,
          returned,
        };
        const now = Date.now();
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "safe_death_kept_return",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });
        return {
          operationId,
          playerId,
          deathOperationId,
          replayed: false,
          returned,
          committed,
        };
      },
      { isolationLevel: "serializable" },
    );
  }

  async commitSafeAreaDeathGravestoneLootAsync(
    request: SafeDeathGravestoneLootCommitRequest,
  ): Promise<SafeDeathGravestoneLootCommitReceipt> {
    if (!this.db) throw new Error("safe_death_database_unavailable");
    const operationId = normalizeDeathOperationId(request.operationId);
    const playerId = normalizeDeathPlayerId(request.playerId);
    const deathOperationId = normalizeDeathOperationId(
      request.deathOperationId,
    );
    const gravestoneId = String(request.gravestoneId ?? "").trim();
    if (!gravestoneId || gravestoneId.length > 256) {
      throw new Error("safe_death_gravestone_id_invalid");
    }
    const requested = request.items
      ? normalizeDeathCustodyItems(request.items, "safe_death_gravestone")
      : null;
    if (requested && requested.length === 0) {
      throw new Error("safe_death_gravestone_items_invalid");
    }

    return this.executeInTransaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT "id" FROM "characters" WHERE "id" = ${playerId} FOR UPDATE`,
        );
        const character = await tx
          .select({ id: schema.characters.id })
          .from(schema.characters)
          .where(eq(schema.characters.id, playerId));
        if (!character[0]) throw new Error("safe_death_player_missing");

        const existingRows = await tx
          .select({
            playerId: schema.operationsLog.playerId,
            operationType: schema.operationsLog.operationType,
            operationState: schema.operationsLog.operationState,
            completed: schema.operationsLog.completed,
          })
          .from(schema.operationsLog)
          .where(eq(schema.operationsLog.id, operationId));
        const existing = existingRows[0];
        if (existing) {
          const state = existing.operationState as
            StoredSafeDeathGravestoneLootOperation | undefined;
          if (
            existing.playerId !== playerId ||
            existing.operationType !== "safe_death_gravestone_loot" ||
            existing.completed !== true ||
            state?.version !== 1 ||
            state.deathOperationId !== deathOperationId ||
            state.gravestoneId !== gravestoneId ||
            JSON.stringify(state.requested) !== JSON.stringify(requested)
          ) {
            throw new Error("safe_death_operation_id_conflict");
          }
          const currentRows = await tx
            .select({
              itemId: schema.inventory.itemId,
              quantity: schema.inventory.quantity,
              slotIndex: schema.inventory.slotIndex,
              metadata: schema.inventory.metadata,
            })
            .from(schema.inventory)
            .where(eq(schema.inventory.playerId, playerId));
          return {
            operationId,
            playerId,
            deathOperationId,
            gravestoneId,
            replayed: true,
            transferred: normalizeDeathCustodyItems(state.transferred),
            remaining: normalizeDeathCustodyItems(state.remaining),
            committed: normalizePersistedInventoryRows(
              currentRows,
              "safe_death",
            ),
          };
        }

        const deathRows = await tx
          .select({
            deathOperationId: schema.playerDeaths.deathOperationId,
            gravestoneId: schema.playerDeaths.gravestoneId,
            items: schema.playerDeaths.items,
            keptItems: schema.playerDeaths.keptItems,
          })
          .from(schema.playerDeaths)
          .where(eq(schema.playerDeaths.playerId, playerId));
        const death = deathRows[0];
        if (
          !death ||
          death.deathOperationId !== deathOperationId ||
          death.gravestoneId !== gravestoneId
        ) {
          throw new Error("safe_death_lock_mismatch");
        }
        const persistedItems = normalizeDeathCustodyItems(death.items);
        const keptItems = normalizeDeathCustodyItems(death.keptItems);
        const availableByItem = new Map(
          persistedItems.map((item) => [item.itemId, item.quantity]),
        );
        const candidates = requested ?? persistedItems;
        for (const item of candidates) {
          if ((availableByItem.get(item.itemId) ?? 0) < item.quantity) {
            throw new Error("safe_death_gravestone_item_mismatch");
          }
        }
        const inventoryRows = await tx
          .select({
            itemId: schema.inventory.itemId,
            quantity: schema.inventory.quantity,
            slotIndex: schema.inventory.slotIndex,
            metadata: schema.inventory.metadata,
          })
          .from(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        let committed = normalizePersistedInventoryRows(
          inventoryRows,
          "safe_death",
        );
        const transferred: DeathCustodyItem[] = [];
        const remainingByItem = new Map(availableByItem);
        for (const item of candidates) {
          const definition = getItem(item.itemId);
          if (!definition) throw new Error("safe_death_item_unknown");
          if (definition.stackable === true) {
            try {
              committed = creditDeathCustodyItem(committed, item);
              transferred.push(item);
              remainingByItem.set(
                item.itemId,
                (remainingByItem.get(item.itemId) ?? 0) - item.quantity,
              );
            } catch (error) {
              if (
                error instanceof Error &&
                error.message === "safe_death_inventory_full"
              ) {
                continue;
              }
              throw error;
            }
            continue;
          }
          const availableSlots = Math.max(
            0,
            MAX_INVENTORY_SLOTS - committed.length,
          );
          const quantity = Math.min(item.quantity, availableSlots);
          if (quantity > 0) {
            committed = creditDeathCustodyItem(committed, {
              itemId: item.itemId,
              quantity,
            });
            transferred.push({ itemId: item.itemId, quantity });
            remainingByItem.set(
              item.itemId,
              (remainingByItem.get(item.itemId) ?? 0) - quantity,
            );
          }
        }
        if (transferred.length === 0) {
          throw new Error("safe_death_inventory_full");
        }
        const normalizedTransferred = normalizeDeathCustodyItems(transferred);
        const normalizedRemaining = normalizeDeathCustodyItems(
          [...remainingByItem.entries()]
            .filter(([, quantity]) => quantity > 0)
            .map(([itemId, quantity]) => ({ itemId, quantity })),
        );
        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
        await tx.insert(schema.inventory).values(
          committed.map((item) => ({
            playerId,
            itemId: item.itemId,
            quantity: item.quantity,
            slotIndex: item.slotIndex,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          })),
        );
        if (normalizedRemaining.length === 0 && keptItems.length === 0) {
          await tx
            .delete(schema.playerDeaths)
            .where(eq(schema.playerDeaths.playerId, playerId));
        } else {
          await tx
            .update(schema.playerDeaths)
            .set({
              items: normalizedRemaining,
              itemCount: normalizedRemaining.length,
              updatedAt: Date.now(),
            })
            .where(eq(schema.playerDeaths.playerId, playerId));
        }
        const operationState: StoredSafeDeathGravestoneLootOperation = {
          version: 1,
          deathOperationId,
          gravestoneId,
          requested,
          transferred: normalizedTransferred,
          remaining: normalizedRemaining,
        };
        const now = Date.now();
        await tx.insert(schema.operationsLog).values({
          id: operationId,
          playerId,
          operationType: "safe_death_gravestone_loot",
          operationState,
          completed: true,
          timestamp: now,
          completedAt: now,
        });
        return {
          operationId,
          playerId,
          deathOperationId,
          gravestoneId,
          replayed: false,
          transferred: normalizedTransferred,
          remaining: normalizedRemaining,
          committed,
        };
      },
      { isolationLevel: "serializable" },
    );
  }

  async saveDeathLockAsync(
    data: DeathLockData,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.saveDeathLockAsync(data, tx);
  }

  /**
   * Get active death lock for a player
   * Delegates to DeathRepository
   *
   * Returns null if no active death lock exists (player is alive).
   * Now includes items, killedBy, recovered fields.
   */
  async getDeathLockAsync(playerId: string): Promise<DeathLockData | null> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return null;
    }
    return this.deathRepository.getDeathLockAsync(playerId);
  }

  /**
   * Delete a death lock for a player
   * Delegates to DeathRepository
   *
   * Called when player respawns or death is fully resolved.
   */
  async deleteDeathLockAsync(playerId: string): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.deleteDeathLockAsync(playerId);
  }

  /**
   * Get all active death locks
   * Delegates to DeathRepository
   *
   * Used for server restart recovery to restore gravestones/ground items.
   * Now includes items, killedBy, recovered fields.
   */
  async getAllActiveDeathsAsync(): Promise<DeathLockData[]> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return [];
    }
    return this.deathRepository.getAllActiveDeathsAsync();
  }

  /**
   * Update ground item IDs when gravestone expires
   * Delegates to DeathRepository
   *
   * Called when gravestone transitions to ground items.
   */
  async updateGroundItemsAsync(
    playerId: string,
    groundItemIds: string[],
  ): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.updateGroundItemsAsync(playerId, groundItemIds);
  }

  /**
   * Get all unrecovered deaths for crash recovery
   * Delegates to DeathRepository
   *
   * Called during server startup to find deaths that need their
   * gravestones/ground items recreated.
   *
   * @returns Array of death locks that need recovery
   */
  async getUnrecoveredDeathsAsync(): Promise<DeathLockData[]> {
    if (!this.deathRepository) {
      console.error(
        "[DatabaseSystem] deathRepository not initialized - ensure DatabaseSystem.init() was called",
      );
      return [];
    }
    return this.deathRepository.getUnrecoveredDeathsAsync();
  }

  /**
   * Mark a death as recovered after crash recovery processing
   * Delegates to DeathRepository
   *
   * Called after successfully recreating gravestones/ground items.
   *
   * @param playerId - The player ID whose death was recovered
   */
  async markDeathRecoveredAsync(playerId: string): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.markDeathRecoveredAsync(playerId);
  }

  /**
   * Atomically acquire a death lock (check-and-create)
   * Delegates to DeathRepository
   *
   * Prevents race conditions where a player could die multiple times.
   * Uses INSERT ... ON CONFLICT DO NOTHING for atomic semantics.
   *
   * @param data - Death lock data to create
   * @param tx - Optional transaction context
   * @returns true if death lock was created, false if player already has one
   */
  async acquireDeathLockAsync(
    data: DeathLockData,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<boolean> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return false;
    }
    return this.deathRepository.acquireDeathLockAsync(data, tx);
  }

  // ============================================================================
  // SYNCHRONOUS WRAPPER METHODS (LEGACY)
  // ============================================================================
  // These methods provide synchronous interfaces for backward compatibility.
  // They fire-and-forget async operations and track them for graceful shutdown.
  //
  // WARNING: These will eventually be removed. Use async methods instead.
  // The sync methods log warnings and don't return results from the database.

  /**
   * @deprecated Use getCharactersAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getCharacters(_accountId: string): Array<{ id: string; name: string }> {
    console.warn(
      "[DatabaseSystem] getCharacters called synchronously - use getCharactersAsync instead",
    );
    return [];
  }

  /**
   * @deprecated Use getPlayerAsync instead
   * @returns null (use async method to get real data)
   */
  getPlayer(_playerId: string): PlayerRow | null {
    console.warn(
      "[DatabaseSystem] getPlayer called synchronously - use getPlayerAsync instead",
    );
    return null;
  }

  /**
   * Save player data (debounced fire-and-forget)
   *
   * Buffers field updates per player and flushes after a short delay.
   * Rapid calls (e.g., multiple XP drops in the same tick) merge into
   * a single DB write per player instead of N separate UPDATEs.
   */
  savePlayer(playerId: string, data: PlayerPersistenceUpdate): void {
    if (this.isDestroying) return;
    assertGenericPlayerUpdateExcludesPrayerAuthority(
      data,
      "DatabaseSystem.savePlayer",
    );
    const existing = this.pendingSaveBuffer.get(playerId);
    if (existing) {
      Object.assign(existing, data);
    } else {
      this.pendingSaveBuffer.set(playerId, { ...data });
    }

    if (!this.saveFlushScheduled) {
      this.saveFlushScheduled = true;
      // Use setTimeout(0) to batch all sync calls within the current tick
      setTimeout(() => this.flushSaveBuffer(), 0);
    }
  }

  /**
   * Flush the debounce buffer — one batched DB transaction for all players.
   */
  private flushSaveBuffer(): void {
    this.saveFlushScheduled = false;
    const buffer = this.pendingSaveBuffer;
    this.pendingSaveBuffer = new Map();

    if (buffer.size === 0) return;

    // Single transaction for all player saves (1 connection instead of N)
    this.trackAsyncOperation(
      this.enqueuePlayerSave(() =>
        this.playerRepository.batchSavePlayersAsync(buffer),
      ),
    );
  }

  private enqueuePlayerSave(operation: () => Promise<void>): Promise<void> {
    const queued = this.playerSaveWriteTail.then(operation, operation);
    // Keep the queue usable after a failed caller-visible write while leaving
    // the original promise rejected for the caller/tracker to observe.
    this.playerSaveWriteTail = queued.catch(() => undefined);
    return queued;
  }

  /**
   * Batch save multiple players in a single transaction
   * Delegates to PlayerRepository.batchSavePlayersAsync
   */
  async batchSavePlayersAsync(
    players: Map<string, PlayerPersistenceUpdate>,
  ): Promise<void> {
    return this.enqueuePlayerSave(() =>
      this.playerRepository.batchSavePlayersAsync(players),
    );
  }

  /**
   * @deprecated Use getPlayerInventoryAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getPlayerInventory(_playerId: string): InventoryRow[] {
    console.warn(
      "[DatabaseSystem] getPlayerInventory called synchronously - use getPlayerInventoryAsync instead",
    );
    return [];
  }

  /**
   * Save player inventory (debounced fire-and-forget)
   *
   * Keeps only the latest inventory snapshot per player. Rapid saves
   * (mine ore → smelt → smith) merge into one DB write, preventing
   * concurrent UPSERTs that deadlock on the same rows.
   */
  savePlayerInventory(playerId: string, items: InventorySaveItem[]): void {
    this.pendingInventoryBuffer.set(playerId, items);

    if (!this.inventoryFlushScheduled) {
      this.inventoryFlushScheduled = true;
      setTimeout(() => this.flushInventoryBuffer(), 0);
    }
  }

  /**
   * Flush the inventory debounce buffer — one DB write per player.
   */
  private flushInventoryBuffer(): void {
    this.inventoryFlushScheduled = false;
    const buffer = this.pendingInventoryBuffer;
    this.pendingInventoryBuffer = new Map();

    for (const [playerId, items] of buffer) {
      this.trackAsyncOperation(this.savePlayerInventoryAsync(playerId, items));
    }
  }

  /**
   * Create player session (fire-and-forget)
   * Returns a session ID synchronously, tracks the operation for graceful shutdown
   */
  createPlayerSession(
    sessionData: Omit<PlayerSessionRow, "id" | "sessionId">,
  ): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    this.trackAsyncOperation(
      this.createPlayerSessionAsync(sessionData, sessionId),
    );
    return sessionId;
  }

  /**
   * Update player session (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  updatePlayerSession(
    sessionId: string,
    updates: Partial<PlayerSessionRow>,
  ): void {
    this.trackAsyncOperation(this.updatePlayerSessionAsync(sessionId, updates));
  }

  /**
   * @deprecated Use getActivePlayerSessionsAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getActivePlayerSessions(): PlayerSessionRow[] {
    console.warn(
      "[DatabaseSystem] getActivePlayerSessions called synchronously - use getActivePlayerSessionsAsync instead",
    );
    return [];
  }

  /**
   * End player session (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  endPlayerSession(sessionId: string, reason?: string): void {
    this.trackAsyncOperation(this.endPlayerSessionAsync(sessionId, reason));
  }

  /**
   * Save world chunk (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  saveWorldChunk(chunkData: {
    chunkX: number;
    chunkZ: number;
    data: string;
  }): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.saveWorldChunkAsync(chunkData));
  }

  /**
   * @deprecated Use getWorldItemsAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getWorldItems(_chunkX: number, _chunkZ: number): ItemRow[] {
    console.warn(
      "[DatabaseSystem] getWorldItems called synchronously - use getWorldItemsAsync instead",
    );
    return [];
  }

  /**
   * Save world items (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  saveWorldItems(chunkX: number, chunkZ: number, items: ItemRow[]): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.saveWorldItemsAsync(chunkX, chunkZ, items));
  }

  /**
   * @deprecated Use getInactiveChunksAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getInactiveChunks(_minutes: number): WorldChunkRow[] {
    return [];
  }

  /**
   * Update chunk player count (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  updateChunkPlayerCount(
    chunkX: number,
    chunkZ: number,
    playerCount: number,
  ): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(
      this.updateChunkPlayerCountAsync(chunkX, chunkZ, playerCount),
    );
  }

  /**
   * Mark chunk for reset (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  markChunkForReset(chunkX: number, chunkZ: number): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.markChunkForResetAsync(chunkX, chunkZ));
  }

  /**
   * Reset chunk (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  resetChunk(chunkX: number, chunkZ: number): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.resetChunkAsync(chunkX, chunkZ));
  }

  /**
   * @deprecated Use getWorldChunkAsync instead
   * @returns null (use async method to get real data)
   */
  getWorldChunk(_x: number, _z: number): WorldChunkRow | null {
    console.warn(
      "[DatabaseSystem] getWorldChunk called synchronously - use getWorldChunkAsync instead",
    );
    return null;
  }

  /**
   * Increment NPC kill (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  incrementNPCKill(playerId: string, npcId: string): void {
    this.trackAsyncOperation(this.incrementNPCKillAsync(playerId, npcId));
  }

  // ============================================================================
  // MAINTENANCE METHODS
  // ============================================================================

  /**
   * Clean up old sessions asynchronously
   *
   * Deletes sessions older than the specified number of days.
   * Used for maintenance to keep the database clean.
   *
   * @param daysOld - Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessionsAsync(daysOld: number): Promise<number> {
    return this.sessionRepository.cleanupOldSessionsAsync(daysOld);
  }

  /**
   * Clean up old sessions (synchronous wrapper)
   *
   * @param daysOld - Delete sessions older than this many days
   * @returns 0 (actual count available via async method)
   */
  cleanupOldSessions(daysOld: number): number {
    this.trackAsyncOperation(this.cleanupOldSessionsAsync(daysOld));
    return 0; // Sync version can't return actual count
  }

  /**
   * Clean up old chunk activity records asynchronously
   *
   * Deletes chunk activity records older than the specified number of days.
   * Used for maintenance to keep the database clean.
   *
   * @param daysOld - Delete records older than this many days
   * @returns Number of records deleted
   */
  async cleanupOldChunkActivityAsync(daysOld: number): Promise<number> {
    return this.worldChunkRepository.cleanupOldChunkActivityAsync(daysOld);
  }

  /**
   * Clean up old chunk activity records (synchronous wrapper)
   *
   * @param daysOld - Delete records older than this many days
   * @returns 0 (actual count available via async method)
   */
  cleanupOldChunkActivity(daysOld: number): number {
    this.trackAsyncOperation(this.cleanupOldChunkActivityAsync(daysOld));
    return 0; // Sync version can't return actual count
  }

  /**
   * Get database statistics asynchronously
   *
   * Returns counts of various database entities for monitoring.
   *
   * @returns Database statistics
   */
  async getDatabaseStatsAsync(): Promise<{
    playerCount: number;
    activeSessionCount: number;
    chunkCount: number;
    activeChunkCount: number;
    totalActivityRecords: number;
  }> {
    try {
      const [
        playerCount,
        activeSessionCount,
        chunkCount,
        activeChunkCount,
        totalActivityRecords,
      ] = await Promise.all([
        this.playerRepository.getPlayerCountAsync(),
        this.sessionRepository.getActiveSessionCountAsync(),
        this.worldChunkRepository.getChunkCountAsync(),
        this.worldChunkRepository.getActiveChunkCountAsync(),
        this.worldChunkRepository.getTotalActivityRecordsAsync(),
      ]);

      return {
        playerCount,
        activeSessionCount,
        chunkCount,
        activeChunkCount,
        totalActivityRecords,
      };
    } catch (err) {
      this.logger.error(
        "Failed to fetch database stats",
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err;
    }
  }

  /**
   * Get database statistics (synchronous wrapper)
   *
   * @returns Default statistics (use async method for real data)
   */
  getDatabaseStats(): {
    playerCount: number;
    activeSessionCount: number;
    chunkCount: number;
    activeChunkCount: number;
    totalActivityRecords: number;
  } {
    // Sync version can't return actual data, return defaults
    return {
      playerCount: 0,
      activeSessionCount: 0,
      chunkCount: 0,
      activeChunkCount: 0,
      totalActivityRecords: 0,
    };
  }

  /**
   * Check database connection health
   *
   * Performs a lightweight health check by executing a simple query.
   * Returns connection status information useful for monitoring.
   *
   * @returns Health check result with status and pool info
   */
  async checkHealthAsync(): Promise<{
    healthy: boolean;
    latencyMs: number;
    poolInfo?: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
    error?: string;
  }> {
    if (!this.db || !this.pool) {
      return {
        healthy: false,
        latencyMs: 0,
        error: "Database not initialized",
      };
    }

    const startTime = performance.now();

    try {
      // Simple query to verify connection (SELECT 1)
      await this.pool.query("SELECT 1");

      const latencyMs = Math.round(performance.now() - startTime);

      return {
        healthy: true,
        latencyMs,
        poolInfo: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
        },
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error("[DatabaseSystem] Health check failed:", errorMessage);

      return {
        healthy: false,
        latencyMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the PostgreSQL connection pool
   *
   * Provides access to the underlying pool for monitoring or direct operations.
   *
   * @returns The pg.Pool instance or null if not initialized
   */
  getPool(): pg.Pool | null {
    return this.pool;
  }

  /**
   * Clean up database system resources
   *
   * Nullifies references to database instances but does NOT close the connection pool.
   * The pool is managed externally by the server and closed during graceful shutdown.
   * Called automatically when the world is destroyed.
   */
  destroy(): void {
    this.inventoryWriteActive.clear();
    // Reject any orphaned waiters so their promises don't hang forever
    for (const [, queued] of this.inventoryWriteQueued) {
      for (const w of queued.waiters) {
        w.reject(new Error("DatabaseSystem destroyed"));
      }
    }
    this.inventoryWriteQueued.clear();
    // Pool is managed externally in index.ts, don't close it here
    this.db = null;
    this.pool = null;
  }
}
