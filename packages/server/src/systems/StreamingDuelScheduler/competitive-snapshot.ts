import { createHash } from "node:crypto";

import type {
  FrozenStreamingCombatLoadouts,
  SwitchableStreamingCombatRole,
} from "./types.js";
import { FROZEN_STREAMING_ARMOR_SLOTS } from "./types.js";
import {
  normalizeCompetitiveTacticalStrategy,
  type CompetitiveTacticalStrategy,
} from "./competitive-tactical-strategy.js";

export const COMPETITIVE_SNAPSHOT_VERSION = 3 as const;
export type CompetitiveSnapshotVersion =
  1 | 2 | typeof COMPETITIVE_SNAPSHOT_VERSION;
export const DUEL_COMBAT_POLICY_VERSION = "duel-combat-policy-v2" as const;
export type CompetitiveCombatPolicyVersion =
  "duel-combat-policy-v1" | typeof DUEL_COMBAT_POLICY_VERSION;

export type CompetitiveCombatStyle = SwitchableStreamingCombatRole | "prayer";

export type CompetitivePreparationEvidence = {
  primaryStyle: CompetitiveCombatStyle;
  availableStyles: CompetitiveCombatStyle[];
  planningSource: "model" | "deterministic" | "diagnostic";
  planningPolicyVersion: string;
  agentPolicyFingerprint: string | null;
  modelProvider: string;
  model: string;
  tacticalStrategy?: CompetitiveTacticalStrategy;
};

export type CompetitiveSnapshotEquipmentItem = {
  slot: string;
  itemId: string;
  quantity: number;
};

export type CompetitiveSnapshotInventoryItem = {
  slot: number;
  itemId: string;
  quantity: number;
};

export type CompetitiveSnapshotSkillLevel = {
  skill: string;
  level: number;
};

export type CompetitiveSnapshotContestant = {
  side: "agent1" | "agent2";
  agentId: string;
  name: string;
  provider: string;
  model: string;
  combatLevel: number;
  startingHp: number;
  maxHp: number;
  wins: number;
  losses: number;
  rank: number;
  headToHeadWins: number;
  headToHeadLosses: number;
  loadoutFingerprint: string | null;
  equipment: CompetitiveSnapshotEquipmentItem[];
  inventory: CompetitiveSnapshotInventoryItem[];
  selectedSpell: string | null;
  skillLevels: CompetitiveSnapshotSkillLevel[];
  prayer: {
    pointUnits: number;
    points: number;
    maxPoints: number;
    activePrayers: string[];
  };
  initialCombatStyle: CompetitiveCombatStyle;
  availableCombatStyles: CompetitiveCombatStyle[];
  combatLoadouts: FrozenStreamingCombatLoadouts;
  preparation: CompetitivePreparationEvidence;
};

export type CompetitiveSnapshot = {
  snapshotVersion: CompetitiveSnapshotVersion;
  persisted: boolean;
  diagnostic: boolean;
  preparationId: string | null;
  cycleId: string;
  duelId: string;
  duelKey: string;
  frozenAt: number;
  betOpenTime: number;
  betCloseTime: number;
  combatPolicyVersion: CompetitiveCombatPolicyVersion;
  contestants: [CompetitiveSnapshotContestant, CompetitiveSnapshotContestant];
};

export type CompetitiveSnapshotDraft = Omit<
  CompetitiveSnapshot,
  | "snapshotVersion"
  | "persisted"
  | "frozenAt"
  | "betOpenTime"
  | "betCloseTime"
  | "combatPolicyVersion"
>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const COMBAT_STYLES = new Set<CompetitiveCombatStyle>([
  "melee",
  "ranged",
  "mage",
  "prayer",
]);
const SWITCHABLE_COMBAT_STYLES = new Set<SwitchableStreamingCombatRole>([
  "melee",
  "ranged",
  "mage",
]);
const SNAPSHOT_KEYS = [
  "snapshotVersion",
  "persisted",
  "diagnostic",
  "preparationId",
  "cycleId",
  "duelId",
  "duelKey",
  "frozenAt",
  "betOpenTime",
  "betCloseTime",
  "combatPolicyVersion",
  "contestants",
] as const;
const CONTESTANT_KEYS = [
  "side",
  "agentId",
  "name",
  "provider",
  "model",
  "combatLevel",
  "startingHp",
  "maxHp",
  "wins",
  "losses",
  "rank",
  "headToHeadWins",
  "headToHeadLosses",
  "loadoutFingerprint",
  "equipment",
  "inventory",
  "selectedSpell",
  "skillLevels",
  "prayer",
  "initialCombatStyle",
  "availableCombatStyles",
  "combatLoadouts",
  "preparation",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort(compareText);
  const canonical = [...expected].sort(compareText);
  return (
    actual.length === canonical.length &&
    actual.every((key, index) => key === canonical[index])
  );
}

function isNonemptyText(value: unknown, maxLength = 256): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isNullableText(value: unknown, maxLength = 256): boolean {
  return value === null || isNonemptyText(value, maxLength);
}

function isCompetitiveSnapshotVersion(
  value: unknown,
): value is CompetitiveSnapshotVersion {
  return value === 1 || value === 2 || value === COMPETITIVE_SNAPSHOT_VERSION;
}

function isFrozenArmorIds(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, FROZEN_STREAMING_ARMOR_SLOTS) &&
    FROZEN_STREAMING_ARMOR_SLOTS.every((slot) =>
      isNullableText(value[slot], 128),
    )
  );
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isCombatStyle(value: unknown): value is CompetitiveCombatStyle {
  return (
    typeof value === "string" &&
    COMBAT_STYLES.has(value as CompetitiveCombatStyle)
  );
}

function isUniqueCombatStyles(
  value: unknown,
): value is CompetitiveCombatStyle[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= COMBAT_STYLES.size &&
    value.every(isCombatStyle) &&
    new Set(value).size === value.length
  );
}

function isSwitchableCombatStyle(
  value: CompetitiveCombatStyle,
): value is SwitchableStreamingCombatRole {
  return SWITCHABLE_COMBAT_STYLES.has(value as SwitchableStreamingCombatRole);
}

function sameTextSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    [...left]
      .sort(compareText)
      .every((value, index) => value === [...right].sort(compareText)[index])
  );
}

function assertCompetitiveContestant(
  value: unknown,
  side: "agent1" | "agent2",
  diagnostic: boolean,
  snapshotVersion: CompetitiveSnapshotVersion,
): asserts value is CompetitiveSnapshotContestant {
  if (!isRecord(value) || !hasExactKeys(value, CONTESTANT_KEYS)) {
    throw new Error(`invalid competitive snapshot ${side} shape`);
  }
  if (
    value.side !== side ||
    !isNonemptyText(value.agentId, 256) ||
    !isNonemptyText(value.name, 256) ||
    !isNonemptyText(value.provider, 128) ||
    !isNonemptyText(value.model, 128) ||
    !Number.isSafeInteger(value.combatLevel) ||
    Number(value.combatLevel) < 1 ||
    !Number.isSafeInteger(value.startingHp) ||
    Number(value.startingHp) < 1 ||
    !Number.isSafeInteger(value.maxHp) ||
    Number(value.maxHp) < Number(value.startingHp) ||
    !isSafeNonnegativeInteger(value.wins) ||
    !isSafeNonnegativeInteger(value.losses) ||
    !isSafeNonnegativeInteger(value.rank) ||
    !isSafeNonnegativeInteger(value.headToHeadWins) ||
    !isSafeNonnegativeInteger(value.headToHeadLosses) ||
    (value.loadoutFingerprint !== null &&
      (typeof value.loadoutFingerprint !== "string" ||
        !SHA256_HEX.test(value.loadoutFingerprint))) ||
    (!diagnostic &&
      (typeof value.loadoutFingerprint !== "string" ||
        !SHA256_HEX.test(value.loadoutFingerprint))) ||
    !isNullableText(value.selectedSpell, 128) ||
    !isCombatStyle(value.initialCombatStyle) ||
    !isUniqueCombatStyles(value.availableCombatStyles) ||
    !value.availableCombatStyles.includes(value.initialCombatStyle)
  ) {
    throw new Error(`invalid competitive snapshot ${side} identity or stats`);
  }

  if (!Array.isArray(value.equipment) || value.equipment.length > 16) {
    throw new Error(`invalid competitive snapshot ${side} equipment`);
  }
  const equipmentSlots = new Set<string>();
  for (const item of value.equipment) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["slot", "itemId", "quantity"]) ||
      !isNonemptyText(item.slot, 64) ||
      !isNonemptyText(item.itemId, 128) ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) <= 0 ||
      equipmentSlots.has(item.slot)
    ) {
      throw new Error(`invalid competitive snapshot ${side} equipment`);
    }
    equipmentSlots.add(item.slot);
  }

  if (!Array.isArray(value.inventory) || value.inventory.length > 28) {
    throw new Error(`invalid competitive snapshot ${side} inventory`);
  }
  const inventorySlots = new Set<number>();
  for (const item of value.inventory) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["slot", "itemId", "quantity"]) ||
      !Number.isSafeInteger(item.slot) ||
      Number(item.slot) < 0 ||
      Number(item.slot) >= 28 ||
      !isNonemptyText(item.itemId, 128) ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) <= 0 ||
      inventorySlots.has(Number(item.slot))
    ) {
      throw new Error(`invalid competitive snapshot ${side} inventory`);
    }
    inventorySlots.add(Number(item.slot));
  }

  if (
    !Array.isArray(value.skillLevels) ||
    value.skillLevels.length === 0 ||
    value.skillLevels.length > 64
  ) {
    throw new Error(`invalid competitive snapshot ${side} skills`);
  }
  const skills = new Set<string>();
  for (const [index, skill] of value.skillLevels.entries()) {
    const failure = !isRecord(skill)
      ? "entry"
      : !hasExactKeys(skill, ["skill", "level"])
        ? "shape"
        : !isNonemptyText(skill.skill, 64)
          ? "name"
          : !Number.isSafeInteger(skill.level) || Number(skill.level) < 1
            ? "level"
            : skills.has(skill.skill)
              ? "duplicate"
              : null;
    if (failure) {
      throw new Error(
        `invalid competitive snapshot ${side} skills (${failure} at ${index})`,
      );
    }
    skills.add(skill.skill);
  }

  if (
    !isRecord(value.prayer) ||
    !hasExactKeys(value.prayer, [
      "pointUnits",
      "points",
      "maxPoints",
      "activePrayers",
    ]) ||
    !isSafeNonnegativeInteger(value.prayer.pointUnits) ||
    typeof value.prayer.points !== "number" ||
    !Number.isFinite(value.prayer.points) ||
    value.prayer.points < 0 ||
    !Number.isSafeInteger(value.prayer.maxPoints) ||
    Number(value.prayer.maxPoints) < 1 ||
    value.prayer.points > Number(value.prayer.maxPoints) ||
    !Array.isArray(value.prayer.activePrayers) ||
    value.prayer.activePrayers.length > 64 ||
    value.prayer.activePrayers.some((prayer) => !isNonemptyText(prayer, 128)) ||
    new Set(value.prayer.activePrayers).size !==
      value.prayer.activePrayers.length
  ) {
    throw new Error(`invalid competitive snapshot ${side} prayer`);
  }

  if (!isRecord(value.combatLoadouts)) {
    throw new Error(`invalid competitive snapshot ${side} combat loadouts`);
  }
  const loadoutRoles = Object.keys(value.combatLoadouts);
  const expectedLoadoutRoles = value.availableCombatStyles.filter(
    isSwitchableCombatStyle,
  );
  if (
    (!diagnostic && !sameTextSet(loadoutRoles, expectedLoadoutRoles)) ||
    loadoutRoles.some(
      (role) =>
        !expectedLoadoutRoles.includes(role as SwitchableStreamingCombatRole),
    )
  ) {
    throw new Error(`invalid competitive snapshot ${side} combat loadouts`);
  }
  for (const roleName of loadoutRoles) {
    const role = roleName as SwitchableStreamingCombatRole;
    const loadout = value.combatLoadouts[role];
    const loadoutKeys = [
      "role",
      "weaponId",
      "arrowsId",
      "shieldId",
      "spellId",
      ...(snapshotVersion === COMPETITIVE_SNAPSHOT_VERSION
        ? (["armorIds"] as const)
        : []),
    ];
    if (
      !isRecord(loadout) ||
      !hasExactKeys(loadout, loadoutKeys) ||
      loadout.role !== role ||
      !isNonemptyText(loadout.weaponId, 128) ||
      !isNullableText(loadout.arrowsId, 128) ||
      !isNullableText(loadout.shieldId, 128) ||
      !isNullableText(loadout.spellId, 128) ||
      (snapshotVersion === COMPETITIVE_SNAPSHOT_VERSION &&
        !isFrozenArmorIds(loadout.armorIds))
    ) {
      throw new Error(`invalid competitive snapshot ${side} combat loadouts`);
    }
  }

  const preparationKeys = [
    "primaryStyle",
    "availableStyles",
    "planningSource",
    "planningPolicyVersion",
    "agentPolicyFingerprint",
    "modelProvider",
    "model",
    ...(snapshotVersion >= 2 ? (["tacticalStrategy"] as const) : []),
  ];
  if (
    !isRecord(value.preparation) ||
    !hasExactKeys(value.preparation, preparationKeys) ||
    value.preparation.primaryStyle !== value.initialCombatStyle ||
    !isUniqueCombatStyles(value.preparation.availableStyles) ||
    !sameTextSet(
      value.preparation.availableStyles,
      value.availableCombatStyles,
    ) ||
    !["model", "deterministic", "diagnostic"].includes(
      String(value.preparation.planningSource),
    ) ||
    (!diagnostic && value.preparation.planningSource === "diagnostic") ||
    !isNonemptyText(value.preparation.planningPolicyVersion, 128) ||
    (value.preparation.agentPolicyFingerprint !== null &&
      (typeof value.preparation.agentPolicyFingerprint !== "string" ||
        !SHA256_HEX.test(value.preparation.agentPolicyFingerprint))) ||
    (value.preparation.planningSource !== "diagnostic" &&
      (typeof value.preparation.agentPolicyFingerprint !== "string" ||
        !SHA256_HEX.test(value.preparation.agentPolicyFingerprint))) ||
    !isNonemptyText(value.preparation.modelProvider, 128) ||
    !isNonemptyText(value.preparation.model, 128) ||
    value.preparation.modelProvider !== value.provider ||
    value.preparation.model !== value.model ||
    (snapshotVersion >= 2 &&
      !normalizeCompetitiveTacticalStrategy(
        value.preparation.tacticalStrategy,
        value.availableCombatStyles.filter(
          isSwitchableCombatStyle,
        ) as SwitchableStreamingCombatRole[],
      ))
  ) {
    throw new Error(`invalid competitive snapshot ${side} preparation`);
  }
}

/**
 * Strictly validate the public, persisted market input. This is deliberately
 * independent of TypeScript types because JSONB rows and transport payloads
 * are untrusted runtime data after a restart.
 */
export function assertValidCompetitiveSnapshot(
  value: unknown,
): asserts value is CompetitiveSnapshot {
  if (!isRecord(value) || !hasExactKeys(value, SNAPSHOT_KEYS)) {
    throw new Error("invalid competitive snapshot shape");
  }
  if (
    !isCompetitiveSnapshotVersion(value.snapshotVersion) ||
    typeof value.persisted !== "boolean" ||
    typeof value.diagnostic !== "boolean" ||
    (value.persisted
      ? typeof value.preparationId !== "string" ||
        !UUID_PATTERN.test(value.preparationId)
      : value.preparationId !== null) ||
    !isNonemptyText(value.cycleId, 128) ||
    !isNonemptyText(value.duelId, 256) ||
    typeof value.duelKey !== "string" ||
    !SHA256_HEX.test(value.duelKey) ||
    !Number.isSafeInteger(value.frozenAt) ||
    Number(value.frozenAt) <= 0 ||
    value.betOpenTime !== value.frozenAt ||
    !Number.isSafeInteger(value.betCloseTime) ||
    Number(value.betCloseTime) <= Number(value.betOpenTime) ||
    value.combatPolicyVersion !==
      (value.snapshotVersion === COMPETITIVE_SNAPSHOT_VERSION
        ? DUEL_COMBAT_POLICY_VERSION
        : "duel-combat-policy-v1") ||
    !Array.isArray(value.contestants) ||
    value.contestants.length !== 2
  ) {
    throw new Error("invalid competitive snapshot identity or timing");
  }
  assertCompetitiveContestant(
    value.contestants[0],
    "agent1",
    value.diagnostic,
    value.snapshotVersion,
  );
  assertCompetitiveContestant(
    value.contestants[1],
    "agent2",
    value.diagnostic,
    value.snapshotVersion,
  );
  if (value.contestants[0].agentId === value.contestants[1].agentId) {
    throw new Error("invalid competitive snapshot contestants");
  }
}

function cloneCombatLoadouts(
  loadouts: FrozenStreamingCombatLoadouts,
): FrozenStreamingCombatLoadouts {
  const result: FrozenStreamingCombatLoadouts = {};
  for (const role of ["melee", "ranged", "mage"] as const) {
    const loadout = loadouts[role];
    if (loadout) {
      result[role] = {
        role: loadout.role,
        weaponId: loadout.weaponId,
        arrowsId: loadout.arrowsId,
        shieldId: loadout.shieldId,
        spellId: loadout.spellId,
        ...(loadout.armorIds ? { armorIds: { ...loadout.armorIds } } : {}),
      };
    }
  }
  return result;
}

function normalizeContestant(
  contestant: CompetitiveSnapshotContestant,
): CompetitiveSnapshotContestant {
  const tacticalStrategy = normalizeCompetitiveTacticalStrategy(
    contestant.preparation.tacticalStrategy,
    contestant.availableCombatStyles.filter(
      isSwitchableCombatStyle,
    ) as SwitchableStreamingCombatRole[],
  );
  return {
    side: contestant.side,
    agentId: contestant.agentId,
    name: contestant.name,
    provider: contestant.provider,
    model: contestant.model,
    combatLevel: contestant.combatLevel,
    startingHp: contestant.startingHp,
    maxHp: contestant.maxHp,
    wins: contestant.wins,
    losses: contestant.losses,
    rank: contestant.rank,
    headToHeadWins: contestant.headToHeadWins,
    headToHeadLosses: contestant.headToHeadLosses,
    loadoutFingerprint: contestant.loadoutFingerprint,
    equipment: contestant.equipment
      .map((item) => ({
        slot: item.slot,
        itemId: item.itemId,
        quantity: item.quantity,
      }))
      .sort(
        (left, right) =>
          compareText(left.slot, right.slot) ||
          compareText(left.itemId, right.itemId),
      ),
    inventory: contestant.inventory
      .map((item) => ({
        slot: item.slot,
        itemId: item.itemId,
        quantity: item.quantity,
      }))
      .sort(
        (left, right) =>
          left.slot - right.slot || compareText(left.itemId, right.itemId),
      ),
    selectedSpell: contestant.selectedSpell,
    skillLevels: contestant.skillLevels
      .map((skill) => ({ skill: skill.skill, level: skill.level }))
      .sort((left, right) => compareText(left.skill, right.skill)),
    prayer: {
      pointUnits: contestant.prayer.pointUnits,
      points: contestant.prayer.points,
      maxPoints: contestant.prayer.maxPoints,
      activePrayers: [...contestant.prayer.activePrayers].sort(compareText),
    },
    initialCombatStyle: contestant.initialCombatStyle,
    availableCombatStyles: [...contestant.availableCombatStyles].sort(
      compareText,
    ),
    combatLoadouts: cloneCombatLoadouts(contestant.combatLoadouts),
    preparation: {
      primaryStyle: contestant.preparation.primaryStyle,
      availableStyles: [...contestant.preparation.availableStyles].sort(
        compareText,
      ),
      planningSource: contestant.preparation.planningSource,
      planningPolicyVersion: contestant.preparation.planningPolicyVersion,
      agentPolicyFingerprint: contestant.preparation.agentPolicyFingerprint,
      modelProvider: contestant.preparation.modelProvider,
      model: contestant.preparation.model,
      ...(tacticalStrategy
        ? {
            tacticalStrategy,
          }
        : {}),
    },
  };
}

/**
 * Recursively key-sort JSON objects. PostgreSQL JSONB and transport parsers do
 * not preserve insertion order, so the digest must be semantic rather than
 * dependent on one process's object layout.
 */
export function canonicalCompetitiveSnapshotJson(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (!candidate || typeof candidate !== "object") return candidate;
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, nested]) => [key, normalize(nested)]),
    );
  };
  return JSON.stringify(normalize(value));
}

export function digestCompetitiveSnapshot(
  snapshot: CompetitiveSnapshot,
): string {
  return createHash("sha256")
    .update(canonicalCompetitiveSnapshotJson(snapshot))
    .digest("hex");
}

export function finalizeCompetitiveSnapshot(input: {
  draft: CompetitiveSnapshotDraft;
  persisted: boolean;
  frozenAt: number;
  betWindowDurationMs: number;
}): { snapshot: CompetitiveSnapshot; digest: string } {
  if (
    !Number.isSafeInteger(input.frozenAt) ||
    input.frozenAt <= 0 ||
    !Number.isSafeInteger(input.betWindowDurationMs) ||
    input.betWindowDurationMs <= 0
  ) {
    throw new Error("invalid competitive snapshot timing");
  }
  const betCloseTime = input.frozenAt + input.betWindowDurationMs;
  if (!Number.isSafeInteger(betCloseTime)) {
    throw new Error("invalid competitive snapshot timing");
  }
  if (
    input.draft.contestants[0].side !== "agent1" ||
    input.draft.contestants[1].side !== "agent2" ||
    input.draft.contestants[0].agentId === input.draft.contestants[1].agentId
  ) {
    throw new Error("invalid competitive snapshot contestants");
  }
  if (input.persisted && !input.draft.preparationId) {
    throw new Error("persisted competitive snapshot requires preparationId");
  }
  const snapshot: CompetitiveSnapshot = {
    snapshotVersion: COMPETITIVE_SNAPSHOT_VERSION,
    persisted: input.persisted,
    diagnostic: input.draft.diagnostic,
    preparationId: input.draft.preparationId,
    cycleId: input.draft.cycleId,
    duelId: input.draft.duelId,
    duelKey: input.draft.duelKey,
    frozenAt: input.frozenAt,
    betOpenTime: input.frozenAt,
    betCloseTime,
    combatPolicyVersion: DUEL_COMBAT_POLICY_VERSION,
    contestants: [
      normalizeContestant(input.draft.contestants[0]),
      normalizeContestant(input.draft.contestants[1]),
    ],
  };
  assertValidCompetitiveSnapshot(snapshot);
  return { snapshot, digest: digestCompetitiveSnapshot(snapshot) };
}
