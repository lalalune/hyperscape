/**
 * DuelOrchestrator - Combat preparation, execution, and cleanup for streaming duels.
 *
 * Extracted from StreamingDuelScheduler to isolate all combat-related concerns:
 * contestant creation, weapon/food provisioning, arena teleportation, combat AI
 * management, HP tracking, fight resolution, and post-duel cleanup.
 */

import type { DuelArenaConfig, World } from "@hyperscape/shared";
import {
  AttackType,
  COMBAT_SPELLS,
  DeathState,
  DEFAULT_DUEL_RULES,
  ELEMENTAL_STAVES,
  EventType,
  ITEMS,
  PlayerEntity,
  SPELL_ORDER,
  getDuelArenaConfig,
  getItem,
  isPositionInsideCombatArena,
  tileChebyshevDistance,
  worldToTile,
} from "@hyperscape/shared";
import { DuelCombatAI } from "../../../duel/DuelCombatAI.js";
import {
  type StreamingDuelCycle,
  type AgentContestant,
  type LeaderboardEntry,
  type RecentDuelEntry,
  STREAMING_TIMING,
} from "../types.js";
import { getDuelFoodItemForLevels, isDuelFoodItemId } from "../../duelFood.js";
import { Logger } from "../../ServerNetwork/services";
import { errMsg } from "../../../shared/errMsg.js";

// ============================================================================
// Types
// ============================================================================

type DuelFoodProvisionedSlot = {
  slot: number;
  itemId: string;
};

/** Inventory system shape used by the orchestrator. */
type InventorySystem = {
  getInventory?: (playerId: string) =>
    | {
        playerId: string;
        items: Array<{ slot: number; itemId: string; quantity: number }>;
        coins: number;
      }
    | undefined;
  /** Authoritative inventory for UI / streaming (entity.data is often stale). */
  getInventoryData?: (playerId: string) => {
    items: Array<{
      slot?: number;
      itemId?: string;
      quantity?: number;
    }>;
  };
  addItemDirect?: (
    playerId: string,
    item: { itemId: string; quantity: number; slot?: number },
  ) => Promise<boolean>;
  removeItem?: (data: {
    playerId: string;
    itemId: string;
    quantity: number;
    slot?: number;
  }) => Promise<boolean>;
  isInventoryReady?: (playerId: string) => boolean;
} | null;

/** Equipment system shape used by the orchestrator. */
type EquipmentSystem = {
  getPlayerEquipment?: (playerId: string) =>
    | {
        weapon?: {
          itemId?: string | number | null;
          item?: { id?: string | null } | null;
        } | null;
      }
    | undefined;
  canPlayerEquipItem?: (playerId: string, itemId: string | number) => boolean;
  equipItemDirect?: (
    playerId: string,
    itemId: string | number,
  ) => Promise<{
    success: boolean;
    error?: string;
    equippedSlot?: string;
    displacedItems: Array<{ itemId: string; slot: string; quantity: number }>;
  }>;
  unequipItemDirect?: (
    playerId: string,
    slotName: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    itemId?: string;
    quantity: number;
  }>;
  /** Slot name → Item or null; same source the game client uses. */
  getEquipmentData?: (playerId: string) => Record<string, unknown>;
} | null;

/** Type for network with send method */
interface NetworkWithSend {
  send: <T>(name: string, data: T, ignoreSocketId?: string) => void;
}

type AgentCombatData = {
  inCombat?: boolean;
  combatTarget?: string | null;
  ct?: string | null;
  c?: boolean;
  attackTarget?: string | null;
};

// ============================================================================
// Constants
// ============================================================================

/** Reserved regular duel arena for streaming agents (always use a single arena). */
const STREAMING_AGENT_ARENA_ID = 1;
/** Streaming agents enter combat immediately, so they must spawn in melee range. */
const STREAMING_AGENT_ENGAGEMENT_TILE_DISTANCE = 1;
/** Duel-eligible bronze weapons — only types with new models in swords/ directory. */
const DUEL_BRONZE_WEAPON_IDS = [
  "bronze_longsword",
  "bronze_scimitar",
  "bronze_2h_sword",
] as const;

/** Weapon types eligible for duel arenas (must have models in swords/ directory). */
const DUEL_WEAPON_TYPES = new Set(["LONGSWORD", "SCIMITAR", "TWO_HAND_SWORD"]);
const STREAMING_COMBAT_STALL_NUDGE_MS = Math.max(
  5_000,
  Number.parseInt(process.env.STREAMING_COMBAT_STALL_NUDGE_MS || "15000", 10),
);
/** Interval between escalating stall nudges after the first (#20) */
const STALL_NUDGE_ESCALATION_INTERVAL_MS = 10_000;
/** Maximum damage per escalating nudge (#20) */
const STALL_NUDGE_MAX_DAMAGE = 5;

/** Combat role types for duel arena agents. */
type DuelCombatRole = "melee" | "ranged" | "mage" | "prayer";

export function computeStreamingArenaEngagementSpawnPoints(
  arenaConfig: DuelArenaConfig,
  requestedArenaId = STREAMING_AGENT_ARENA_ID,
): {
  arenaId: number;
  agent1: { x: number; z: number };
  agent2: { x: number; z: number };
} {
  const arenaId = Math.max(
    1,
    Math.min(requestedArenaId, arenaConfig.arenaCount),
  );
  const row = Math.floor((arenaId - 1) / arenaConfig.columns);
  const col = (arenaId - 1) % arenaConfig.columns;
  const centerX =
    arenaConfig.baseX +
    col * (arenaConfig.arenaWidth + arenaConfig.arenaGap) +
    arenaConfig.arenaWidth / 2;
  const centerZ =
    arenaConfig.baseZ +
    row * (arenaConfig.arenaLength + arenaConfig.arenaGap) +
    arenaConfig.arenaLength / 2;
  const centerTileX = Math.floor(centerX);
  const centerTileZ = Math.floor(centerZ);
  const tileCenter = (tile: number) => tile + 0.5;

  // Regular player duels use opposite spawn points. Streaming agents skip the
  // human chase phase and call CombatSystem.startCombat immediately, so they
  // must begin on adjacent tiles or melee combat deterministically fails.
  if (arenaConfig.spawnLayout === "alongWidth") {
    return {
      arenaId,
      agent1: {
        x: tileCenter(centerTileX - STREAMING_AGENT_ENGAGEMENT_TILE_DISTANCE),
        z: tileCenter(centerTileZ),
      },
      agent2: {
        x: tileCenter(centerTileX),
        z: tileCenter(centerTileZ),
      },
    };
  }

  return {
    arenaId,
    agent1: {
      x: tileCenter(centerTileX),
      z: tileCenter(centerTileZ - STREAMING_AGENT_ENGAGEMENT_TILE_DISTANCE),
    },
    agent2: {
      x: tileCenter(centerTileX),
      z: tileCenter(centerTileZ),
    },
  };
}

/**
 * When skill scores tie, prefer ranged/mage over melee so streaming duels
 * actually exercise bow and magic (default stats are often all equal).
 */
const ROLE_SCORE_TIE_ORDER: readonly DuelCombatRole[] = [
  "ranged",
  "mage",
  "prayer",
  "melee",
];

/** Fallback gear when skill-based selection fails or entity is missing. */
const MELEE_FALLBACK_WEAPON = "bronze_shortsword";
const RANGED_FALLBACK_BOW = "shortbow";
const RANGED_FALLBACK_ARROW = "bronze_arrow";
const MAGE_FALLBACK_STAFF = "staff_of_air";
const MAGE_FALLBACK_SPELL = "wind_strike";
const RUNE_PROVISION_QTY = 500;

// ============================================================================
// DuelOrchestrator Class
// ============================================================================

export class DuelOrchestrator {
  // -- Owned state --
  private combatAIs: Map<string, DuelCombatAI> = new Map();
  /** Services locked into arena mode — bounds cleared and autonomy restored in stopCombatAIs. */
  private _arenaModeServices: Array<{
    clearArenaBounds(): void;
    setAutonomousBehaviorEnabled(enabled: boolean): void;
  }> = [];
  private _lastFightStats: Map<
    string,
    { attacksLanded: number; healsUsed: number }
  > = new Map();
  private combatLoopInterval: ReturnType<typeof setInterval> | null = null;
  private combatLoopTickCount: number = 0;
  private combatRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private victoryPresentationTimeout: ReturnType<typeof setTimeout> | null =
    null;
  private combatRetryCount: number = 0;
  private static readonly MAX_COMBAT_RETRIES = 5;
  private duelFoodSlotsByAgent: Map<string, DuelFoodProvisionedSlot[]> =
    new Map();
  private combatRolesByAgent: Map<string, DuelCombatRole> = new Map();
  /** Debug director: force a contestant's combat style for the next prep only. */
  private debugCombatRoleOverrideByCharacterId = new Map<
    string,
    DuelCombatRole
  >();
  /** Escalating stall nudge state (#20) */
  private combatStallNudgeCount = 0;
  private lastCombatStallNudgeTime = 0;

  // ---- Contestant Cache (Memory Optimization) ----
  /** Cached contestant objects keyed by "agentId:opponentId" */
  private _contestantCache: Map<string, AgentContestant> = new Map();
  /** Cache expiry timestamp for contestant cache */
  private _contestantCacheExpiry = 0;
  /** Cache duration in ms (invalidate every 250ms to allow HP updates) */
  private static readonly CONTESTANT_CACHE_TTL_MS = 250;

  constructor(
    private readonly world: World,
    private readonly getCurrentCycle: () => StreamingDuelCycle | null,
    private readonly setCurrentCycleFields: (
      fields: Partial<StreamingDuelCycle>,
    ) => void,
    private readonly getAgentStats: () => Map<
      string,
      {
        characterId: string;
        name: string;
        provider: string;
        model: string;
        wins: number;
        losses: number;
        combatLevel: number;
        currentStreak: number;
      }
    >,
    private readonly onResolution: (
      winnerId: string,
      loserId: string,
      winReason: "kill" | "hp_advantage" | "damage_advantage" | "draw",
    ) => void,
    private readonly getLeaderboard: () => LeaderboardEntry[],
    private readonly getRecentDuels: () => RecentDuelEntry[],
  ) {}

  // ============================================================================
  // Public accessors for state owned by this orchestrator
  // ============================================================================

  /** Get the duel food slots tracked by this orchestrator for a given agent. */
  getDuelFoodSlotsByAgent(): Map<string, DuelFoodProvisionedSlot[]> {
    return this.duelFoodSlotsByAgent;
  }

  // ============================================================================
  // Contestant Creation
  // ============================================================================

  /**
   * Create or update a cached AgentContestant for streaming state.
   * MEMORY OPTIMIZATION: Caches and updates contestants in place to avoid
   * creating new objects every 500ms broadcast.
   */
  createContestant(
    agentId: string,
    opponentId?: string,
  ): AgentContestant | null {
    const now = Date.now();
    const cacheKey = `${agentId}:${opponentId ?? ""}`;

    // Check cache expiry
    if (now > this._contestantCacheExpiry) {
      this._contestantCache.clear();
      this._contestantCacheExpiry =
        now + DuelOrchestrator.CONTESTANT_CACHE_TTL_MS;
    }

    // Check for cached contestant
    const cached = this._contestantCache.get(cacheKey);

    const entity = this.world.entities.get(agentId);
    if (!entity) {
      // Remove from cache if entity no longer exists
      if (cached) this._contestantCache.delete(cacheKey);
      return null;
    }

    const data = entity.data as {
      name?: string;
      health?: number;
      maxHealth?: number;
      position?: [number, number, number] | { x: number; y: number; z: number };
      skills?: Record<string, { level: number }>;
      equipment?: unknown;
      inventory?: unknown;
    };

    // If cached, just update mutable fields (HP, stats) and return
    if (cached) {
      const stats = this.getAgentStats().get(agentId);
      const skills = data.skills || {};
      const constitution = skills.constitution?.level || 10;

      cached.currentHp = data.health ?? constitution;
      cached.maxHp = data.maxHealth ?? constitution;
      cached.wins = stats?.wins || 0;
      cached.losses = stats?.losses || 0;
      const loadout = this.snapshotLoadoutFromWorld(agentId, data);
      cached.equipment = loadout.equipment;
      cached.inventory = loadout.inventory;
      cached.itemIconPaths = this.buildItemIconPathsForLoadout(
        cached.equipment,
        cached.inventory,
      );
      return cached;
    }

    // Create new contestant (first time only)
    const stats = this.getAgentStats().get(agentId);
    const parts = agentId.split("-");
    const provider = parts[1] || "unknown";
    const model = parts.slice(2).join("-") || "unknown";

    const entityPosition = (entity as { position?: unknown }).position;
    const normalizedPosition =
      this.normalizePosition(data.position) ??
      this.normalizePosition(entityPosition);
    const originalPosition = this.sanitizeRestorePosition(
      normalizedPosition,
      agentId,
    );

    // Calculate combat level
    const skills = data.skills || {};
    const attack = skills.attack?.level || 1;
    const strength = skills.strength?.level || 1;
    const defense = skills.defense?.level || 1;
    const constitution = skills.constitution?.level || 10;
    const combatLevel = Math.floor(
      (attack + strength + defense + constitution) / 4,
    );

    let rank = 0;
    const leaderboard = this.getLeaderboard();
    for (let i = 0; i < leaderboard.length; i++) {
      if (leaderboard[i].characterId === agentId) {
        rank = leaderboard[i].rank;
        break;
      }
    }

    let headToHeadWins = 0;
    let headToHeadLosses = 0;
    if (opponentId) {
      for (const duel of this.getRecentDuels()) {
        if (duel.winnerId === agentId && duel.loserId === opponentId) {
          headToHeadWins++;
        } else if (duel.winnerId === opponentId && duel.loserId === agentId) {
          headToHeadLosses++;
        }
      }
    }

    const loadout = this.snapshotLoadoutFromWorld(agentId, data);
    const itemIconPaths = this.buildItemIconPathsForLoadout(
      loadout.equipment,
      loadout.inventory,
    );
    const contestant: AgentContestant = {
      characterId: agentId,
      name: data.name || agentId,
      provider,
      model,
      combatLevel,
      wins: stats?.wins || 0,
      losses: stats?.losses || 0,
      currentHp: data.health ?? constitution,
      maxHp: data.maxHealth ?? constitution,
      originalPosition,
      damageDealtThisFight: 0,
      highestHit: 0,
      attacksLanded: 0,
      healsUsed: 0,
      equipment: loadout.equipment,
      inventory: loadout.inventory,
      itemIconPaths,
      rank,
      headToHeadWins,
      headToHeadLosses,
    };

    // Cache for future calls
    this._contestantCache.set(cacheKey, contestant);
    return contestant;
  }

  /** Clear the contestant cache (call when cycle ends) */
  clearContestantCache(): void {
    this._contestantCache.clear();
    this._contestantCacheExpiry = 0;
  }

  snapshotAgentEquipment(equipment: unknown): Record<string, string> {
    if (!equipment || typeof equipment !== "object") {
      return {};
    }

    const snapshot: Record<string, string> = {};
    for (const [slot, rawValue] of Object.entries(
      equipment as Record<string, unknown>,
    )) {
      const itemId = this.extractItemId(rawValue);
      if (itemId) {
        snapshot[slot] = itemId;
      }
    }
    return snapshot;
  }

  snapshotAgentInventory(
    inventory: unknown,
  ): Array<{ itemId: string; quantity: number } | null> {
    const slots: Array<{ itemId: string; quantity: number } | null> =
      Array.from({ length: 28 }, () => null);

    const sourceItems = Array.isArray(inventory)
      ? inventory
      : inventory &&
          typeof inventory === "object" &&
          Array.isArray((inventory as { items?: unknown[] }).items)
        ? ((inventory as { items: unknown[] }).items ?? [])
        : [];

    for (const [index, rawItem] of sourceItems.entries()) {
      if (!rawItem || typeof rawItem !== "object") {
        continue;
      }

      const item = rawItem as Record<string, unknown>;
      const itemId = this.extractItemId(item);
      if (!itemId) {
        continue;
      }

      const rawSlot = Number(item.slot);
      const slot = Number.isFinite(rawSlot) ? rawSlot : index;
      if (slot < 0 || slot >= slots.length) {
        continue;
      }

      const rawQuantity = Number(item.quantity ?? item.qty ?? 1);
      const quantity =
        Number.isFinite(rawQuantity) && rawQuantity > 0
          ? Math.floor(rawQuantity)
          : 1;

      slots[slot] = { itemId, quantity };
    }

    return slots;
  }

  extractItemId(value: unknown): string | null {
    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }

    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const direct = record.itemId ?? record.id;
    if (typeof direct === "string") {
      const normalized = direct.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }

    const nested = record.item;
    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      const nestedId = nestedRecord.itemId ?? nestedRecord.id;
      if (typeof nestedId === "string") {
        const normalized = nestedId.trim();
        return normalized.length > 0 ? normalized : null;
      }
    }

    return null;
  }

  /**
   * Read inventory/equipment from character systems when available.
   * Streaming overlay icons were empty because entity.data.* is not kept in sync
   * with InventorySystem / EquipmentSystem.
   */
  private snapshotLoadoutFromWorld(
    playerId: string,
    entityData: { equipment?: unknown; inventory?: unknown },
  ): {
    equipment: Record<string, string>;
    inventory: Array<{ itemId: string; quantity: number } | null>;
  } {
    const invSys = this.world.getSystem("inventory") as InventorySystem | null;
    const inventory = invSys?.getInventoryData
      ? this.snapshotAgentInventory(
          invSys.getInventoryData(playerId).items ?? [],
        )
      : this.snapshotAgentInventory(entityData.inventory);

    const eqSys = this.world.getSystem("equipment") as EquipmentSystem | null;
    const equipment = eqSys?.getEquipmentData
      ? this.snapshotAgentEquipment(eqSys.getEquipmentData(playerId))
      : this.snapshotAgentEquipment(entityData.equipment);

    return { equipment, inventory };
  }

  /**
   * Map each item id in the loadout to manifest iconPath so the streaming client
   * can show PNGs without relying on browser-side ITEMS or cross-host manifest fetch.
   */
  buildItemIconPathsForLoadout(
    equipment: Record<string, string>,
    inventory: Array<{ itemId: string; quantity: number } | null>,
  ): Record<string, string> {
    const paths: Record<string, string> = {};
    const ids = new Set<string>();
    for (const v of Object.values(equipment)) {
      if (typeof v === "string" && v.trim()) {
        ids.add(v.trim());
      }
    }
    for (const cell of inventory) {
      if (cell?.itemId?.trim()) {
        ids.add(cell.itemId.trim());
      }
    }
    for (const rawId of ids) {
      const normalized = rawId.endsWith("_noted")
        ? rawId.replace(/_noted$/, "")
        : rawId;
      const def = getItem(normalized) ?? getItem(rawId);
      const p = def?.iconPath?.trim();
      if (!p) {
        continue;
      }
      paths[rawId] = p;
      if (normalized !== rawId && paths[normalized] === undefined) {
        paths[normalized] = p;
      }
    }
    return paths;
  }

  /** Re-sync contestant loadout from world systems (call during fight broadcasts). */
  refreshContestantLoadout(contestant: AgentContestant): void {
    const entity = this.world.entities.get(contestant.characterId);
    const data = (entity?.data ?? {}) as {
      equipment?: unknown;
      inventory?: unknown;
    };
    const next = this.snapshotLoadoutFromWorld(contestant.characterId, data);
    contestant.equipment = next.equipment;
    contestant.inventory = next.inventory;
    contestant.itemIconPaths = this.buildItemIconPathsForLoadout(
      contestant.equipment,
      contestant.inventory,
    );
  }

  // ============================================================================
  // Duel Preparation
  // ============================================================================

  async prepareContestantsForDuel(): Promise<void> {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const { agent1, agent2 } = cycle;
    const levelDiff = Math.abs(agent1.combatLevel - agent2.combatLevel);

    // CRITICAL: Stop any active combat and movement BEFORE any async
    // operations below. During awaits, the event loop is free and combat
    // system ticks can fire — if agents are still in combat, attack/damage
    // events would be broadcast at pre-arena positions.
    this.forceStopAgentCombat(agent1.characterId);
    this.forceStopAgentCombat(agent2.characterId);
    this.world.emit("player:movement:cancel", { playerId: agent1.characterId });
    this.world.emit("player:movement:cancel", { playerId: agent2.characterId });

    // Pick complementary combat roles (avoid dual-melee when skills are equal).
    const [base1, base2] = this.assignCombatRolesForDuelPair(
      agent1.characterId,
      agent2.characterId,
    );
    const [role1, role2] = this.applyDebugCombatRoleOverrides(
      agent1.characterId,
      agent2.characterId,
      base1,
      base2,
    );
    this.combatRolesByAgent.set(agent1.characterId, role1);
    this.combatRolesByAgent.set(agent2.characterId, role2);

    const [weapon1, weapon2] = await Promise.all([
      this.ensureAgentCombatSetup(agent1.characterId, role1),
      this.ensureAgentCombatSetup(agent2.characterId, role2),
    ]);

    // NOTE: Food provisioning removed — agents must self-provision food
    // through fishing/cooking between duels. They fight with whatever
    // food/gear they've gathered autonomously.

    // Restore full health and prayer points (prayers fail silently at 0 PP)
    this.restoreHealth(agent1.characterId);
    this.restoreHealth(agent2.characterId);
    this.restorePrayerPointsForDuel(agent1.characterId);
    this.restorePrayerPointsForDuel(agent2.characterId);

    // NOTE: Teleport is handled separately in startCountdown() so agents
    // appear in the arena at the exact moment the countdown begins on screen.

    Logger.info(
      "StreamingDuelScheduler",
      `Contestants prepared: ${agent1.name} (${role1}, ${weapon1}) vs ${agent2.name} (${role2}, ${weapon2}) (levelDiff=${levelDiff})`,
    );
  }

  getBronzeWeaponPool(): string[] {
    const manifestWeapons = Array.from(ITEMS.values())
      .filter((item) => {
        if (item.type !== "weapon") return false;
        if ((item.tier ?? "").toLowerCase() !== "bronze") return false;
        if (item.equipable === false) return false;
        if (item.equipSlot !== "weapon" && item.equipSlot !== "2h")
          return false;
        // Only include weapon types with new models in swords/ directory
        const wt = (item.weaponType ?? "").toUpperCase();
        return DUEL_WEAPON_TYPES.has(wt);
      })
      .map((item) => item.id);

    if (manifestWeapons.length > 0) {
      return manifestWeapons;
    }

    return [...DUEL_BRONZE_WEAPON_IDS];
  }

  getEquippedWeaponId(playerId: string): string | null {
    const equipmentSystem = this.getEquipmentSystem();
    if (!equipmentSystem?.getPlayerEquipment) {
      return null;
    }

    const equipment = equipmentSystem.getPlayerEquipment(playerId);
    const weaponSlot = equipment?.weapon;
    const rawWeaponId = weaponSlot?.itemId ?? weaponSlot?.item?.id ?? null;
    if (rawWeaponId === null || rawWeaponId === undefined) {
      return null;
    }

    const normalizedWeaponId = String(rawWeaponId).trim();
    return normalizedWeaponId.length > 0 ? normalizedWeaponId : null;
  }

  /** Get flat skill level map for an agent. Returns `{}` if entity/skills missing. */
  private getAgentSkillLevels(characterId: string): Record<string, number> {
    const entity = this.world.entities.get(characterId);
    if (!entity?.data) return {};
    const skills = (
      entity.data as { skills?: Record<string, { level: number }> }
    ).skills;
    if (!skills) return {};
    const result: Record<string, number> = {};
    for (const [name, data] of Object.entries(skills)) {
      result[name] = data?.level ?? 1;
    }
    return result;
  }

  /** Per-role skill score (higher = better fit). Used for role ordering. */
  private roleSkillScore(
    skills: Record<string, number>,
    role: DuelCombatRole,
  ): number {
    switch (role) {
      case "melee":
        return (skills.attack ?? 1) + (skills.strength ?? 1);
      case "ranged":
        return (skills.ranged ?? 1) * 2;
      case "mage":
        return (skills.magic ?? 1) * 2;
      case "prayer":
        return (skills.prayer ?? 1) * 2 + (skills.strength ?? 1);
    }
  }

  /**
   * Best → worst roles for this skill set. Equal scores use ROLE_SCORE_TIE_ORDER
   * (ranged before mage before melee) so default equal stats yield ranged/mage use.
   */
  private sortedCombatRolesBySkills(
    skills: Record<string, number>,
  ): DuelCombatRole[] {
    const roles: DuelCombatRole[] = ["melee", "ranged", "mage", "prayer"];
    return [...roles].sort((a, b) => {
      const sa = this.roleSkillScore(skills, a);
      const sb = this.roleSkillScore(skills, b);
      if (sb !== sa) return sb - sa;
      return ROLE_SCORE_TIE_ORDER.indexOf(a) - ROLE_SCORE_TIE_ORDER.indexOf(b);
    });
  }

  /**
   * Assign roles so the two agents usually differ in style (spectacle + weapon variety).
   * Agent1 gets their top pick; agent2 gets their strongest choice that differs from agent1.
   */
  private assignCombatRolesForDuelPair(
    characterId1: string,
    characterId2: string,
  ): [DuelCombatRole, DuelCombatRole] {
    const s1 = this.getAgentSkillLevels(characterId1);
    const s2 = this.getAgentSkillLevels(characterId2);
    const order1 = this.sortedCombatRolesBySkills(s1);
    const order2 = this.sortedCombatRolesBySkills(s2);
    let role1 = order1[0];
    const preferred2 =
      order2.find((r) => r !== role1) ?? order2[1] ?? order2[0];
    let role2: DuelCombatRole = preferred2;
    if (role2 === role1) {
      // Fully symmetric builds — rotate by stable hash so cycles vary (melee/ranged/mage).
      const h =
        (characterId1.codePointAt(0) ?? 0) ^
        (characterId2.codePointAt(0) ?? 0) ^
        (characterId1.length ^ characterId2.length);
      const pool: DuelCombatRole[] = ["melee", "ranged", "mage", "prayer"];
      role1 = pool[Math.abs(h) % 4];
      role2 = pool[(Math.abs(h) + 1) % 4];
    }
    return [role1, role2];
  }

  /** Pick combat role based on agent's actual skill levels (single-agent / tests). */
  pickCombatRoleBySkills(characterId: string): DuelCombatRole {
    return this.sortedCombatRolesBySkills(
      this.getAgentSkillLevels(characterId),
    )[0];
  }

  /**
   * Permanently bind a character to a specific combat role.  Unlike the old
   * one-shot override, this persists across all future duels so agents whose
   * name advertises a style ("Keldrath Mage") always fight with the matching
   * weapon and AI config.
   */
  setDebugCombatRoleOverride(characterId: string, role: DuelCombatRole): void {
    this.debugCombatRoleOverrideByCharacterId.set(characterId, role);
  }

  /** Remove a persistent role override (e.g. when a sparbot is unregistered). */
  clearDebugCombatRoleOverride(characterId: string): void {
    this.debugCombatRoleOverrideByCharacterId.delete(characterId);
  }

  private applyDebugCombatRoleOverrides(
    id1: string,
    id2: string,
    base1: DuelCombatRole,
    base2: DuelCombatRole,
  ): [DuelCombatRole, DuelCombatRole] {
    const o1 = this.debugCombatRoleOverrideByCharacterId.get(id1);
    const o2 = this.debugCombatRoleOverrideByCharacterId.get(id2);
    // Do NOT clear — overrides are persistent for sparbot agents whose names
    // advertise a specific style. They are removed when the agent is unregistered.

    let r1 = o1 !== undefined ? o1 : base1;
    let r2 = o2 !== undefined ? o2 : base2;
    if (r1 !== r2) {
      return [r1, r2];
    }
    if (o1 !== undefined && o2 === undefined) {
      const alt = this.sortedCombatRolesBySkills(
        this.getAgentSkillLevels(id2),
      ).find((x) => x !== r1);
      return [r1, alt ?? "mage"];
    }
    if (o1 === undefined && o2 !== undefined) {
      const alt = this.sortedCombatRolesBySkills(
        this.getAgentSkillLevels(id1),
      ).find((x) => x !== r2);
      return [alt ?? "mage", r2];
    }
    if (o1 !== undefined && o2 !== undefined) {
      const bump: DuelCombatRole =
        r1 === "ranged" ? "mage" : r1 === "mage" ? "melee" : "ranged";
      return [r1, bump];
    }
    return [base1, base2];
  }

  // --------------------------------------------------------------------------
  // Weapon scoring helpers
  // --------------------------------------------------------------------------

  /** Score a melee weapon by its offensive bonuses. */
  private scoreMeleeWeapon(itemId: string): number {
    const item = ITEMS.get(itemId);
    if (!item) return -1;
    const b = item.bonuses;
    return (
      (b?.attack ?? 0) +
      (b?.attackStab ?? 0) +
      (b?.attackSlash ?? 0) +
      (b?.attackCrush ?? 0) +
      (b?.strength ?? 0) +
      (b?.meleeStrength ?? 0)
    );
  }

  /** Score a ranged bow by its offensive bonuses. */
  private scoreRangedBow(itemId: string): number {
    const item = ITEMS.get(itemId);
    if (!item) return -1;
    const b = item.bonuses;
    return (b?.attackRanged ?? 0) + (b?.ranged ?? 0);
  }

  /** Score arrows by ranged strength. */
  private scoreArrows(itemId: string): number {
    const item = ITEMS.get(itemId);
    if (!item) return -1;
    const b = item.bonuses;
    return (b?.rangedStrength ?? 0) + (b?.ranged ?? 0);
  }

  /** Score a magic staff by its offensive bonuses. */
  private scoreMageStaff(itemId: string): number {
    const item = ITEMS.get(itemId);
    if (!item) return -1;
    const b = item.bonuses;
    return (b?.attackMagic ?? 0) + (b?.magicDamage ?? 0);
  }

  /** Get item IDs from the agent's inventory that match a filter. */
  private getInventoryItemIds(
    characterId: string,
    filter: (itemId: string) => boolean,
  ): string[] {
    const inventorySystem = this.getInventorySystem();
    if (!inventorySystem?.getInventory) return [];
    const inv = inventorySystem.getInventory(characterId);
    if (!inv?.items) return [];
    return inv.items
      .map((slot) => slot.itemId)
      .filter((id) => id && filter(id));
  }

  /** Check if an item is a melee weapon. */
  private isMeleeWeapon(itemId: string): boolean {
    const item = ITEMS.get(itemId);
    if (!item || item.type !== "weapon") return false;
    if (item.attackType !== AttackType.MELEE) return false;
    if (item.equipSlot !== "weapon" && item.equipSlot !== "2h") return false;
    return item.equipable !== false;
  }

  /** Check if an item is a ranged bow. */
  private isRangedBow(itemId: string): boolean {
    const item = ITEMS.get(itemId);
    if (!item || item.type !== "weapon") return false;
    if (item.attackType !== AttackType.RANGED) return false;
    const wt = (item.weaponType ?? "").toString().toUpperCase();
    return wt === "BOW" && item.equipable !== false;
  }

  /** Check if an item is a magic staff/wand. */
  private isMageStaff(itemId: string): boolean {
    const item = ITEMS.get(itemId);
    if (!item || item.type !== "weapon") return false;
    if (item.attackType !== AttackType.MAGIC) return false;
    const wt = (item.weaponType ?? "").toString().toUpperCase();
    return (wt === "STAFF" || wt === "WAND") && item.equipable !== false;
  }

  // --------------------------------------------------------------------------
  // Best-gear selection helpers
  // --------------------------------------------------------------------------

  /**
   * Pick the best melee weapon considering: manifest weapons the agent qualifies
   * for, their currently equipped weapon, and weapons in their inventory.
   * Returns `{ weaponId, alreadyEquipped }` so the equip step can be skipped.
   */
  private pickBestMeleeWeapon(characterId: string): {
    weaponId: string;
    alreadyEquipped: boolean;
  } {
    const equipmentSystem = this.getEquipmentSystem();

    // --- Best from manifest (what we'd conjure) ---
    let manifestBestId: string | null = null;
    let manifestBestScore = -1;

    for (const item of ITEMS.values()) {
      if (item.type !== "weapon") continue;
      if (item.attackType !== AttackType.MELEE) continue;
      if (item.equipSlot !== "weapon" && item.equipSlot !== "2h") continue;
      if (item.equipable === false) continue;
      // Limit to bronze tier so mage/ranged matchups stay fair
      if ((item.tier ?? "").toLowerCase() !== "bronze") continue;

      if (
        equipmentSystem?.canPlayerEquipItem &&
        !equipmentSystem.canPlayerEquipItem(characterId, item.id)
      ) {
        continue;
      }

      const score = this.scoreMeleeWeapon(item.id);
      if (score > manifestBestScore) {
        manifestBestScore = score;
        manifestBestId = item.id;
      }
    }

    // --- Currently equipped weapon ---
    const equippedId = this.getEquippedWeaponId(characterId);
    const equippedScore =
      equippedId && this.isMeleeWeapon(equippedId)
        ? this.scoreMeleeWeapon(equippedId)
        : -1;

    // --- Best melee weapon in inventory ---
    const invMeleeIds = this.getInventoryItemIds(characterId, (id) =>
      this.isMeleeWeapon(id),
    );
    let invBestId: string | null = null;
    let invBestScore = -1;
    for (const id of invMeleeIds) {
      // Must also pass equip requirements
      if (
        equipmentSystem?.canPlayerEquipItem &&
        !equipmentSystem.canPlayerEquipItem(characterId, id)
      ) {
        continue;
      }
      const score = this.scoreMeleeWeapon(id);
      if (score > invBestScore) {
        invBestScore = score;
        invBestId = id;
      }
    }

    // --- Pick the overall best ---
    // Prefer agent's own gear (equipped > inventory) over conjured manifest weapons
    if (
      equippedScore >= manifestBestScore &&
      equippedScore >= invBestScore &&
      equippedId
    ) {
      Logger.info(
        "StreamingDuelScheduler",
        `Agent ${characterId} keeping equipped melee weapon ${equippedId} (score=${equippedScore})`,
      );
      return { weaponId: equippedId, alreadyEquipped: true };
    }

    if (invBestScore > manifestBestScore && invBestId) {
      Logger.info(
        "StreamingDuelScheduler",
        `Agent ${characterId} equipping inventory melee weapon ${invBestId} (score=${invBestScore} > manifest=${manifestBestScore})`,
      );
      return { weaponId: invBestId, alreadyEquipped: false };
    }

    if (manifestBestId) {
      return { weaponId: manifestBestId, alreadyEquipped: false };
    }

    // Fallback
    const pool = this.getBronzeWeaponPool();
    return {
      weaponId: pool[0] ?? MELEE_FALLBACK_WEAPON,
      alreadyEquipped: false,
    };
  }

  /**
   * Pick the best ranged bow + arrows, considering equipped gear and inventory.
   */
  private pickBestRangedWeapon(characterId: string): {
    bowId: string;
    arrowId: string;
    bowAlreadyEquipped: boolean;
  } {
    const equipmentSystem = this.getEquipmentSystem();
    const skills = this.getAgentSkillLevels(characterId);
    const rangedLevel = skills.ranged ?? 1;

    // --- Best bow from manifest ---
    let manifestBowId: string | null = null;
    let manifestBowScore = -1;
    for (const item of ITEMS.values()) {
      if (item.type !== "weapon") continue;
      if (item.attackType !== AttackType.RANGED) continue;
      const wt = (item.weaponType ?? "").toString().toUpperCase();
      if (wt !== "BOW") continue;
      if (item.equipable === false) continue;

      if (
        equipmentSystem?.canPlayerEquipItem &&
        !equipmentSystem.canPlayerEquipItem(characterId, item.id)
      ) {
        continue;
      }

      const score = this.scoreRangedBow(item.id);
      if (score > manifestBowScore) {
        manifestBowScore = score;
        manifestBowId = item.id;
      }
    }

    // --- Currently equipped bow ---
    const equippedId = this.getEquippedWeaponId(characterId);
    const equippedBowScore =
      equippedId && this.isRangedBow(equippedId)
        ? this.scoreRangedBow(equippedId)
        : -1;

    // --- Best bow in inventory ---
    const invBowIds = this.getInventoryItemIds(characterId, (id) =>
      this.isRangedBow(id),
    );
    let invBowId: string | null = null;
    let invBowScore = -1;
    for (const id of invBowIds) {
      if (
        equipmentSystem?.canPlayerEquipItem &&
        !equipmentSystem.canPlayerEquipItem(characterId, id)
      ) {
        continue;
      }
      const score = this.scoreRangedBow(id);
      if (score > invBowScore) {
        invBowScore = score;
        invBowId = id;
      }
    }

    // Pick best bow
    let finalBowId: string;
    let bowAlreadyEquipped = false;
    if (
      equippedBowScore >= manifestBowScore &&
      equippedBowScore >= invBowScore &&
      equippedId
    ) {
      finalBowId = equippedId;
      bowAlreadyEquipped = true;
      Logger.info(
        "StreamingDuelScheduler",
        `Agent ${characterId} keeping equipped bow ${equippedId} (score=${equippedBowScore})`,
      );
    } else if (invBowScore > manifestBowScore && invBowId) {
      finalBowId = invBowId;
      Logger.info(
        "StreamingDuelScheduler",
        `Agent ${characterId} equipping inventory bow ${invBowId} (score=${invBowScore} > manifest=${manifestBowScore})`,
      );
    } else {
      finalBowId = manifestBowId ?? RANGED_FALLBACK_BOW;
    }

    // --- Best arrows from manifest ---
    let bestArrowId: string | null = null;
    let bestArrowScore = -1;
    for (const item of ITEMS.values()) {
      if (item.type !== "ammunition") continue;
      if (item.equipSlot !== "arrows") continue;
      const reqLevel =
        item.requirements?.skills?.ranged ?? item.requirements?.level ?? 1;
      if (rangedLevel < reqLevel) continue;

      const score = this.scoreArrows(item.id);
      if (score > bestArrowScore) {
        bestArrowScore = score;
        bestArrowId = item.id;
      }
    }

    // Check inventory for arrows too
    const invArrowIds = this.getInventoryItemIds(characterId, (id) => {
      const item = ITEMS.get(id);
      return item?.type === "ammunition" && item?.equipSlot === "arrows";
    });
    for (const id of invArrowIds) {
      const item = ITEMS.get(id);
      const reqLevel =
        item?.requirements?.skills?.ranged ?? item?.requirements?.level ?? 1;
      if (rangedLevel < reqLevel) continue;
      const score = this.scoreArrows(id);
      if (score > bestArrowScore) {
        bestArrowScore = score;
        bestArrowId = id;
      }
    }

    return {
      bowId: finalBowId,
      arrowId: bestArrowId ?? RANGED_FALLBACK_ARROW,
      bowAlreadyEquipped,
    };
  }

  /**
   * Pick the best mage setup, considering equipped staff and inventory.
   */
  private pickBestMageSetup(characterId: string): {
    staffId: string;
    spellId: string;
    runes: Array<{ runeId: string; quantity: number }>;
    staffAlreadyEquipped: boolean;
  } {
    const equipmentSystem = this.getEquipmentSystem();
    const skills = this.getAgentSkillLevels(characterId);
    const magicLevel = skills.magic ?? 1;

    // --- Best spell (highest-level spell the agent qualifies for) ---
    let bestSpellId = MAGE_FALLBACK_SPELL;
    for (const id of SPELL_ORDER) {
      const spell = COMBAT_SPELLS[id];
      if (spell && magicLevel >= spell.level) {
        bestSpellId = id;
      }
    }
    const chosenSpell = COMBAT_SPELLS[bestSpellId];
    const spellElement = chosenSpell?.element ?? "air";

    // --- Best staff from manifest ---
    let manifestStaffId: string | null = null;
    let manifestStaffScore = -1;
    let manifestMatchesElement = false;

    for (const item of ITEMS.values()) {
      if (item.type !== "weapon") continue;
      if (item.attackType !== AttackType.MAGIC) continue;
      const wt = (item.weaponType ?? "").toString().toUpperCase();
      if (wt !== "STAFF" && wt !== "WAND") continue;
      if (item.equipable === false) continue;

      if (
        equipmentSystem?.canPlayerEquipItem &&
        !equipmentSystem.canPlayerEquipItem(characterId, item.id)
      ) {
        continue;
      }

      const score = this.scoreMageStaff(item.id);
      const infiniteRunes = ELEMENTAL_STAVES[item.id] ?? [];
      const matchesElement = infiniteRunes.includes(`${spellElement}_rune`);

      if (
        score > manifestStaffScore ||
        (score === manifestStaffScore &&
          matchesElement &&
          !manifestMatchesElement)
      ) {
        manifestStaffScore = score;
        manifestStaffId = item.id;
        manifestMatchesElement = matchesElement;
      }
    }

    // --- Currently equipped staff ---
    const equippedId = this.getEquippedWeaponId(characterId);
    const equippedStaffScore =
      equippedId && this.isMageStaff(equippedId)
        ? this.scoreMageStaff(equippedId)
        : -1;

    // --- Best staff in inventory ---
    const invStaffIds = this.getInventoryItemIds(characterId, (id) =>
      this.isMageStaff(id),
    );
    let invStaffId: string | null = null;
    let invStaffScore = -1;
    for (const id of invStaffIds) {
      if (
        equipmentSystem?.canPlayerEquipItem &&
        !equipmentSystem.canPlayerEquipItem(characterId, id)
      ) {
        continue;
      }
      const score = this.scoreMageStaff(id);
      if (score > invStaffScore) {
        invStaffScore = score;
        invStaffId = id;
      }
    }

    // Pick best staff
    let staffId: string;
    let staffAlreadyEquipped = false;
    if (
      equippedStaffScore >= manifestStaffScore &&
      equippedStaffScore >= invStaffScore &&
      equippedId
    ) {
      staffId = equippedId;
      staffAlreadyEquipped = true;
      Logger.info(
        "StreamingDuelScheduler",
        `Agent ${characterId} keeping equipped staff ${equippedId} (score=${equippedStaffScore})`,
      );
    } else if (invStaffScore > manifestStaffScore && invStaffId) {
      staffId = invStaffId;
      Logger.info(
        "StreamingDuelScheduler",
        `Agent ${characterId} equipping inventory staff ${invStaffId} (score=${invStaffScore} > manifest=${manifestStaffScore})`,
      );
    } else {
      staffId = manifestStaffId ?? MAGE_FALLBACK_STAFF;
    }

    // --- Runes needed (exclude runes provided by the chosen staff) ---
    const infiniteFromStaff = ELEMENTAL_STAVES[staffId] ?? [];
    const runes: Array<{ runeId: string; quantity: number }> = [];
    if (chosenSpell?.runes) {
      for (const req of chosenSpell.runes) {
        if (!infiniteFromStaff.includes(req.runeId)) {
          runes.push({ runeId: req.runeId, quantity: RUNE_PROVISION_QTY });
        }
      }
    }

    return { staffId, spellId: bestSpellId, runes, staffAlreadyEquipped };
  }

  /**
   * Stackable duel prep (arrows, runes) uses InventorySystem.addItemDirect.
   * Fresh embedded sparbots may still be loading inventory from DB — wait so
   * provisions are not dropped on a throwaway placeholder inventory.
   */
  private async waitForInventoryReadyPlayer(playerId: string): Promise<void> {
    const inventorySystem = this.getInventorySystem();
    if (!inventorySystem?.isInventoryReady) {
      return;
    }
    if (inventorySystem.isInventoryReady(playerId)) {
      return;
    }
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (inventorySystem.isInventoryReady(playerId)) {
        return;
      }
    }
  }

  /**
   * Equip agent for their duel role (melee / ranged / mage).
   * Weapons and ammo go through EquipmentSystem.equipItemDirect (no prior
   * inventory needed). Arrows and runes are also written to inventory for
   * combat paths that read stacks from the bag.
   */
  async ensureAgentCombatSetup(
    playerId: string,
    role: DuelCombatRole,
  ): Promise<string> {
    if (role === "ranged" || role === "mage") {
      await this.waitForInventoryReadyPlayer(playerId);
    }
    switch (role) {
      case "melee":
      case "prayer": {
        const { weaponId, alreadyEquipped } =
          this.pickBestMeleeWeapon(playerId);
        if (!alreadyEquipped) {
          await this.equipMeleeWeapon(playerId, weaponId);
        }
        return weaponId;
      }
      case "ranged": {
        const { bowId, arrowId, bowAlreadyEquipped } =
          this.pickBestRangedWeapon(playerId);
        await this.equipRangedGear(
          playerId,
          bowId,
          arrowId,
          bowAlreadyEquipped,
        );
        return bowId;
      }
      case "mage": {
        const { staffId, spellId, runes, staffAlreadyEquipped } =
          this.pickBestMageSetup(playerId);
        await this.equipMageGear(
          playerId,
          staffId,
          spellId,
          runes,
          staffAlreadyEquipped,
        );
        return staffId;
      }
    }
  }

  /** Equip a specific melee weapon, falling back to bronze if it fails. */
  private async equipMeleeWeapon(
    playerId: string,
    weaponId: string,
  ): Promise<void> {
    const equipmentSystem = this.getEquipmentSystem();
    if (
      !equipmentSystem?.getPlayerEquipment ||
      !equipmentSystem.equipItemDirect
    ) {
      return;
    }

    // Try the chosen weapon first
    try {
      const equipResult = await equipmentSystem.equipItemDirect(
        playerId,
        weaponId,
      );
      if (equipResult.success) {
        Logger.info(
          "StreamingDuelScheduler",
          `Auto-equipped melee ${weaponId} for ${playerId}`,
        );
        return;
      }
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to auto-equip ${weaponId} for ${playerId}: ${equipResult.error ?? "unknown error"}`,
      );
    } catch (err) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Error auto-equipping ${weaponId} for ${playerId}: ${errMsg(err)}`,
      );
    }

    // Fallback: try bronze weapons from the pool
    if (weaponId !== MELEE_FALLBACK_WEAPON) {
      const fallbacks = this.getBronzeWeaponPool();
      for (const fallbackId of fallbacks) {
        if (
          equipmentSystem.canPlayerEquipItem &&
          !equipmentSystem.canPlayerEquipItem(playerId, fallbackId)
        ) {
          continue;
        }
        try {
          const result = await equipmentSystem.equipItemDirect(
            playerId,
            fallbackId,
          );
          if (result.success) {
            Logger.info(
              "StreamingDuelScheduler",
              `Fallback-equipped melee ${fallbackId} for ${playerId} (wanted ${weaponId})`,
            );
            return;
          }
        } catch {
          // Try next fallback
        }
      }
    }

    Logger.warn(
      "StreamingDuelScheduler",
      `Cannot auto-equip any melee weapon for ${playerId} (tried ${weaponId} + fallbacks)`,
    );
  }

  /** Equip bow + arrows for ranged agents. */
  private async equipRangedGear(
    playerId: string,
    bowId: string,
    arrowId: string,
    bowAlreadyEquipped = false,
  ): Promise<void> {
    const equipmentSystem = this.getEquipmentSystem();
    if (!equipmentSystem?.equipItemDirect) return;

    // Skip bow equip if agent already has this bow equipped
    let bowEquipped = bowAlreadyEquipped;
    if (!bowAlreadyEquipped) {
      try {
        const bowResult = await equipmentSystem.equipItemDirect(
          playerId,
          bowId,
        );
        if (bowResult.success) {
          bowEquipped = true;
          Logger.info(
            "StreamingDuelScheduler",
            `Equipped ${bowId} for ranged agent ${playerId}`,
          );
        } else {
          Logger.warn(
            "StreamingDuelScheduler",
            `Failed to equip ${bowId} for ${playerId}: ${bowResult.error ?? "unknown"}`,
          );
        }
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Error equipping ${bowId} for ${playerId}: ${errMsg(err)}`,
        );
      }

      // Fallback bow if chosen one failed
      if (!bowEquipped && bowId !== RANGED_FALLBACK_BOW) {
        try {
          const fallbackResult = await equipmentSystem.equipItemDirect(
            playerId,
            RANGED_FALLBACK_BOW,
          );
          if (fallbackResult.success) {
            Logger.info(
              "StreamingDuelScheduler",
              `Fallback-equipped ${RANGED_FALLBACK_BOW} for ranged agent ${playerId} (wanted ${bowId})`,
            );
          }
        } catch {
          // Best effort
        }
      }
    }

    // Equip arrows (auto-routes to arrows slot via equipSlot="arrows")
    try {
      const arrowResult = await equipmentSystem.equipItemDirect(
        playerId,
        arrowId,
      );
      if (arrowResult.success) {
        // equipItemDirect doesn't set quantity for stackable items.
        // Set quantity on the live equipment reference AND provision via
        // inventory so the combat system sees the full stack.
        const equipment = equipmentSystem.getPlayerEquipment?.(playerId) as
          | Record<
              string,
              { quantity?: number; itemId?: string | number | null }
            >
          | undefined;
        if (equipment?.arrows) {
          equipment.arrows.quantity = RUNE_PROVISION_QTY;
        }

        // Also add arrows to inventory as a backup — some combat paths
        // read arrow count from inventory rather than equipment slot.
        const inventorySystem = this.getInventorySystem();
        if (inventorySystem?.addItemDirect) {
          try {
            await inventorySystem.addItemDirect(playerId, {
              itemId: arrowId,
              quantity: RUNE_PROVISION_QTY,
            });
          } catch {
            // Best effort — equipment slot quantity is the primary source
          }
        }

        Logger.info(
          "StreamingDuelScheduler",
          `Equipped ${arrowId} (qty=${RUNE_PROVISION_QTY}) for ranged agent ${playerId}`,
        );
      } else {
        Logger.warn(
          "StreamingDuelScheduler",
          `Failed to equip ${arrowId} for ${playerId}: ${arrowResult.error ?? "unknown"}`,
        );
      }
    } catch (err) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Error equipping ${arrowId} arrows for ${playerId}: ${errMsg(err)}`,
      );
    }
  }

  /** Equip staff, set autocast spell, and add required runes for mage agents. */
  private async equipMageGear(
    playerId: string,
    staffId: string,
    spellId: string,
    runes: Array<{ runeId: string; quantity: number }>,
    staffAlreadyEquipped = false,
  ): Promise<void> {
    const equipmentSystem = this.getEquipmentSystem();
    if (!equipmentSystem?.equipItemDirect) return;

    // Skip staff equip if agent already has this staff equipped
    if (!staffAlreadyEquipped) {
      let staffEquipped = false;
      try {
        const staffResult = await equipmentSystem.equipItemDirect(
          playerId,
          staffId,
        );
        if (staffResult.success) {
          staffEquipped = true;
          Logger.info(
            "StreamingDuelScheduler",
            `Equipped ${staffId} for mage agent ${playerId}`,
          );
        } else {
          Logger.warn(
            "StreamingDuelScheduler",
            `Failed to equip ${staffId} for ${playerId}: ${staffResult.error ?? "unknown"}`,
          );
        }
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Error equipping ${staffId} for ${playerId}: ${errMsg(err)}`,
        );
      }

      // Fallback staff if chosen one failed
      if (!staffEquipped && staffId !== MAGE_FALLBACK_STAFF) {
        try {
          const fallbackResult = await equipmentSystem.equipItemDirect(
            playerId,
            MAGE_FALLBACK_STAFF,
          );
          if (fallbackResult.success) {
            Logger.info(
              "StreamingDuelScheduler",
              `Fallback-equipped ${MAGE_FALLBACK_STAFF} for mage agent ${playerId} (wanted ${staffId})`,
            );
            // Recalculate runes for fallback staff (it provides different infinite runes)
            const fallbackInfinite =
              ELEMENTAL_STAVES[MAGE_FALLBACK_STAFF] ?? [];
            const spell = COMBAT_SPELLS[spellId];
            if (spell?.runes) {
              runes = [];
              for (const req of spell.runes) {
                if (!fallbackInfinite.includes(req.runeId)) {
                  runes.push({
                    runeId: req.runeId,
                    quantity: RUNE_PROVISION_QTY,
                  });
                }
              }
            }
          }
        } catch {
          // Best effort
        }
      }
    }

    // (#19) Validate spell element matches staff element after any fallback.
    // If mismatched, find the best spell matching the staff's infinite runes.
    const actualStaffId = staffAlreadyEquipped
      ? staffId
      : (this.getEquippedWeaponId(playerId) ?? staffId);
    const staffInfinite = ELEMENTAL_STAVES[actualStaffId] ?? [];
    const currentSpell = COMBAT_SPELLS[spellId];
    if (currentSpell) {
      const spellElement = currentSpell.element ?? "air";
      const staffProvidesSpellElement = staffInfinite.includes(
        `${spellElement}_rune`,
      );
      if (!staffProvidesSpellElement && staffInfinite.length > 0) {
        // Staff doesn't match spell element — find best spell that matches
        const staffElements = staffInfinite
          .filter((r: string) => r.endsWith("_rune"))
          .map((r: string) => r.replace("_rune", ""));
        const skills = this.getAgentSkillLevels(playerId);
        const magicLevel = skills.magic ?? 1;
        let bestMatchSpellId = spellId; // keep current as fallback
        for (const sid of SPELL_ORDER) {
          const sp = COMBAT_SPELLS[sid];
          if (
            sp &&
            magicLevel >= sp.level &&
            staffElements.includes(sp.element ?? "")
          ) {
            bestMatchSpellId = sid;
          }
        }
        if (bestMatchSpellId !== spellId) {
          spellId = bestMatchSpellId;
          // Recalculate runes for the new spell
          const newSpell = COMBAT_SPELLS[spellId];
          if (newSpell?.runes) {
            runes = [];
            for (const req of newSpell.runes) {
              if (!staffInfinite.includes(req.runeId)) {
                runes.push({
                  runeId: req.runeId,
                  quantity: RUNE_PROVISION_QTY,
                });
              }
            }
          }
          Logger.info(
            "StreamingDuelScheduler",
            `Spell validation: switched ${playerId} to ${spellId} (matches staff ${actualStaffId})`,
          );
        }
      }
    }

    // Set autocast spell.
    // Belt-and-suspenders: set selectedSpell directly on entity data AND via
    // world.getPlayer() (which the CombatSystem reads), then emit the event.
    // The event handler in PlayerSystem early-returns if the agent isn't in its
    // internal players map, so direct assignment ensures the combat system sees
    // the spell regardless.
    const entity = this.world.entities.get(playerId);
    if (entity?.data) {
      (entity.data as { selectedSpell?: string | null }).selectedSpell =
        spellId;
    }
    const playerEntity = (
      this.world as {
        getPlayer?: (id: string) => { data?: Record<string, unknown> } | null;
      }
    ).getPlayer?.(playerId);
    if (playerEntity?.data) {
      playerEntity.data.selectedSpell = spellId;
    }
    this.world.emit(EventType.PLAYER_SET_AUTOCAST, {
      playerId,
      spellId,
    });

    // Add required runes to inventory
    if (runes.length === 0) {
      Logger.info(
        "StreamingDuelScheduler",
        `No runes needed for mage agent ${playerId} (staff covers all spell runes)`,
      );
      return;
    }

    const inventorySystem = this.getInventorySystem();
    if (inventorySystem?.addItemDirect) {
      await this.waitForInventoryReadyPlayer(playerId);

      const results: string[] = [];
      try {
        for (const rune of runes) {
          const added = await inventorySystem.addItemDirect(playerId, {
            itemId: rune.runeId,
            quantity: rune.quantity,
          });
          results.push(`${rune.runeId}=${added}`);
        }
        const allOk = results.every((r) => r.endsWith("=true"));
        if (!allOk) {
          Logger.warn(
            "StreamingDuelScheduler",
            `Partial rune add for mage agent ${playerId}: ${results.join(", ")}`,
          );
        } else {
          Logger.info(
            "StreamingDuelScheduler",
            `Added runes for mage agent ${playerId}: ${runes.map((r) => `${r.quantity} ${r.runeId}`).join(", ")}`,
          );
        }
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Error adding runes for ${playerId}: ${errMsg(err)}`,
        );
      }
    }
  }

  /**
   * Full combat cleanup after duel: unequip all combat gear, clear autocast,
   * and remove leftover runes. Safe to call regardless of combat role.
   */
  async cleanupAgentCombatSetup(playerId: string): Promise<void> {
    const equipmentSystem = this.getEquipmentSystem();
    if (!equipmentSystem?.unequipItemDirect) return;

    // Unequip weapon slot (melee weapons, one-handed staffs)
    try {
      await equipmentSystem.unequipItemDirect(playerId, "weapon");
    } catch (err) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to unequip weapon for ${playerId}: ${errMsg(err)}`,
      );
    }

    // Unequip arrows slot (ranged ammunition)
    try {
      await equipmentSystem.unequipItemDirect(playerId, "arrows");
    } catch {
      // May not have arrows equipped — safe to ignore
    }

    // Clear autocast spell directly on entity data (mirrors equipMageGear pattern)
    const entity = this.world.entities.get(playerId);
    if (entity?.data) {
      (entity.data as { selectedSpell?: string | null }).selectedSpell = null;
    }
    const playerEntity = (
      this.world as {
        getPlayer?: (id: string) => { data?: Record<string, unknown> } | null;
      }
    ).getPlayer?.(playerId);
    if (playerEntity?.data) {
      playerEntity.data.selectedSpell = null;
    }
    this.world.emit(EventType.PLAYER_SET_AUTOCAST, {
      playerId,
      spellId: null,
    });

    // Remove leftover runes from inventory
    await this.removeLeftoverRunes(playerId);

    // Clear stored combat role
    this.combatRolesByAgent.delete(playerId);
  }

  /** Remove any rune items from agent inventory after duel. */
  private async removeLeftoverRunes(playerId: string): Promise<void> {
    const inventorySystem = this.getInventorySystem();
    if (!inventorySystem?.getInventory || !inventorySystem?.removeItem) return;

    try {
      const inventory = inventorySystem.getInventory(playerId);
      if (!inventory) return;

      let removed = 0;
      for (const item of inventory.items) {
        if (item.itemId.endsWith("_rune")) {
          try {
            await inventorySystem.removeItem({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slot: item.slot,
            });
            removed++;
          } catch {
            // Continue on individual slot errors
          }
        }
      }

      if (removed > 0) {
        Logger.info(
          "StreamingDuelScheduler",
          `Removed ${removed} rune stack(s) from ${playerId}`,
        );
      }
    } catch (err) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to remove leftover runes for ${playerId}: ${errMsg(err)}`,
      );
    }
  }

  async fillInventoryWithFood(
    playerId: string,
    foodItemId: string,
  ): Promise<DuelFoodProvisionedSlot[]> {
    const inventorySystem = this.getInventorySystem();

    if (!inventorySystem?.getInventory || !inventorySystem?.addItemDirect) {
      Logger.warn("StreamingDuelScheduler", "Inventory system not available");
      return [];
    }

    try {
      // Wait for inventory to be ready
      if (
        inventorySystem.isInventoryReady &&
        !inventorySystem.isInventoryReady(playerId)
      ) {
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (inventorySystem.isInventoryReady(playerId)) break;
        }
      }

      const inventory = inventorySystem.getInventory(playerId);
      if (!inventory) {
        Logger.warn(
          "StreamingDuelScheduler",
          `No inventory found for ${playerId}`,
        );
        return [];
      }

      // Get occupied slots
      const occupiedSlots = new Set(inventory.items.map((item) => item.slot));

      // Fill empty slots with food (assume 28 slots max)
      const maxSlots = 28;
      let foodAdded = 0;
      const addedSlots: DuelFoodProvisionedSlot[] = [];

      for (let slot = 0; slot < maxSlots; slot++) {
        if (!occupiedSlots.has(slot)) {
          try {
            await inventorySystem.addItemDirect(playerId, {
              itemId: foodItemId,
              quantity: 1,
              slot,
            });
            foodAdded++;
            addedSlots.push({ slot, itemId: foodItemId });
          } catch (slotErr) {
            // Slot might be invalid, continue
          }
        }
      }

      Logger.info(
        "StreamingDuelScheduler",
        `Filled ${foodAdded} slots with ${foodItemId} for ${playerId}`,
      );
      return addedSlots;
    } catch (err) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to fill inventory: ${errMsg(err)}`,
      );
      return [];
    }
  }

  // ============================================================================
  // Health Restoration
  // ============================================================================

  /**
   * Top up prayer points before a duel so DuelCombatAI offensive/defensive prayers
   * are not rejected with "No prayer points remaining".
   */
  private restorePrayerPointsForDuel(playerId: string): void {
    const prayer = this.world.getSystem("prayer") as {
      getMaxPrayerPoints?: (id: string) => number;
      getPrayerPoints?: (id: string) => number;
      restorePrayerPoints?: (id: string, amount: number) => void;
    } | null;
    if (!prayer?.restorePrayerPoints) return;

    const max = prayer.getMaxPrayerPoints?.(playerId) ?? 99;
    const cur = prayer.getPrayerPoints?.(playerId) ?? 0;
    const need = Math.max(0, max - cur);
    if (need <= 0) return;
    // restorePrayerPoints validates amount ≤ 99 per call
    prayer.restorePrayerPoints(playerId, Math.min(need, 99));
  }

  restoreHealth(playerId: string, quiet = false): void {
    const entity = this.world.entities.get(playerId);
    if (!entity) return;

    const data = entity.data as {
      health?: number;
      maxHealth?: number;
      alive?: boolean;
      position?:
        | [number, number, number]
        | { x?: number; y?: number; z?: number };
      skills?: Record<string, { level: number }>;
      deathState?: DeathState;
    };

    // Calculate max health from constitution
    const constitution = data.skills?.constitution?.level || 10;
    const maxHealth = constitution;

    // Restore to full and clear stale death state so startCombat() can engage.
    if (entity instanceof PlayerEntity) {
      entity.resetDeathState();
      entity.setHealth(maxHealth);
      entity.markNetworkDirty();
    } else {
      data.health = maxHealth;
      data.maxHealth = maxHealth;
      data.deathState = DeathState.ALIVE;

      const healthComponent = (
        entity as {
          getComponent?: (name: string) => {
            data?: { current?: number; max?: number; isDead?: boolean };
          } | null;
        }
      ).getComponent?.("health");

      if (healthComponent?.data) {
        healthComponent.data.current = maxHealth;
        healthComponent.data.max = maxHealth;
        healthComponent.data.isDead = false;
      }
    }

    // Keep raw entity data in sync for network serialization.
    data.health = maxHealth;
    data.maxHealth = maxHealth;
    data.alive = true;
    data.deathState = DeathState.ALIVE;

    // In quiet mode (used during fight-start HP top-up), skip respawn/death
    // events that cause visible teleport snaps on clients. The entity health
    // values and ENTITY_MODIFIED emission below are sufficient for HP sync.
    if (!quiet) {
      const respawnPosition =
        this.normalizePosition(data.position) ??
        this.normalizePosition((entity as { position?: unknown }).position) ??
        this.getFallbackLobbyPosition(playerId);

      // Synchronize PlayerSystem alive/death flags after duel-owned deaths.
      this.world.emit(EventType.PLAYER_RESPAWNED, {
        playerId,
        spawnPosition: {
          x: respawnPosition[0],
          y: respawnPosition[1],
          z: respawnPosition[2],
        },
        townName: "Streaming Duel Arena",
      });

      // Ensure client and server systems clear any lingering dead flags.
      this.world.emit(EventType.PLAYER_SET_DEAD, {
        playerId,
        isDead: false,
      });
    }

    // Update contestant data
    const cycle = this.getCurrentCycle();
    if (cycle?.agent1?.characterId === playerId) {
      cycle.agent1.currentHp = maxHealth;
      cycle.agent1.maxHp = maxHealth;
    } else if (cycle?.agent2?.characterId === playerId) {
      cycle.agent2.currentHp = maxHealth;
      cycle.agent2.maxHp = maxHealth;
    }

    // Emit health update
    this.world.emit(EventType.ENTITY_MODIFIED, {
      id: playerId,
      changes: { health: maxHealth, maxHealth },
    });
  }

  // ============================================================================
  // Arena Teleportation
  // ============================================================================

  async teleportToArena(
    agent1Id: string,
    agent2Id: string,
    suppressEffect = false,
  ): Promise<void> {
    // Use a single reserved regular duel arena so all agent duels happen in
    // the same standard arena as player duels (no custom arena coordinates).
    const arenaConfig = getDuelArenaConfig();
    const { arenaId, agent1, agent2 } =
      computeStreamingArenaEngagementSpawnPoints(
        arenaConfig,
        STREAMING_AGENT_ARENA_ID,
      );

    const agent1Pos: [number, number, number] = [
      agent1.x,
      this.getGroundedY(agent1.x, agent1.z, arenaConfig.baseY),
      agent1.z,
    ];

    const agent2Pos: [number, number, number] = [
      agent2.x,
      this.getGroundedY(agent2.x, agent2.z, arenaConfig.baseY),
      agent2.z,
    ];

    // Teleport both agents, facing each other
    this.teleportPlayer(agent1Id, agent1Pos, agent2Pos, suppressEffect);
    this.teleportPlayer(agent2Id, agent2Pos, agent1Pos, suppressEffect);

    const cycle = this.getCurrentCycle();
    if (cycle) {
      cycle.arenaId = arenaId;
      cycle.arenaPositions = {
        agent1: agent1Pos,
        agent2: agent2Pos,
      };
    }

    Logger.info(
      "StreamingDuelScheduler",
      "Contestants teleported to arena, facing each other",
    );
  }

  /** Arena AABB for clamping agent combat AI strafe / chase targets */
  /**
   * Enforce a minimum physical separation between the two fighting agents.
   * The tile movement system has no player-player collision, so agents can
   * occupy the same position. When they get within MIN_SEP units, push them
   * apart symmetrically by teleport. Called every combat loop tick (600ms).
   */
  private enforceAgentSeparation(id1: string, id2: string): void {
    const MIN_SEP = 0.6;
    const e1 = this.world.entities.get(id1);
    const e2 = this.world.entities.get(id2);
    if (!e1?.position || !e2?.position) return;
    const p1 = e1.position as { x: number; y: number; z: number };
    const p2 = e2.position as { x: number; y: number; z: number };
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= MIN_SEP) return;
    const push = (MIN_SEP - dist) / 2 + 0.3;
    if (dist > 0.05) {
      const nx = dx / dist;
      const nz = dz / dist;
      this.world.emit("player:teleport", {
        playerId: id1,
        position: { x: p1.x + nx * push, y: p1.y, z: p1.z + nz * push },
        suppressEffect: true,
      });
      this.world.emit("player:teleport", {
        playerId: id2,
        position: { x: p2.x - nx * push, y: p2.y, z: p2.z - nz * push },
        suppressEffect: true,
      });
    } else {
      // Co-located: push along X axis
      this.world.emit("player:teleport", {
        playerId: id1,
        position: { x: p1.x + push, y: p1.y, z: p1.z },
        suppressEffect: true,
      });
      this.world.emit("player:teleport", {
        playerId: id2,
        position: { x: p2.x - push, y: p2.y, z: p2.z },
        suppressEffect: true,
      });
    }
  }

  /**
   * Teleport any contestant that has drifted outside the arena back inside.
   * Called every combat loop tick (600ms) as a hard safety net for physics overshoot.
   */
  private enforceStreamingArenaBounds(
    characterIds: string[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ): void {
    const INSET = 1.5;
    for (const id of characterIds) {
      const entity = this.world.entities.get(id);
      if (!entity?.position) continue;
      const { x, y, z } = entity.position as {
        x: number;
        y: number;
        z: number;
      };
      const cx = Math.min(
        bounds.maxX - INSET,
        Math.max(bounds.minX + INSET, x),
      );
      const cz = Math.min(
        bounds.maxZ - INSET,
        Math.max(bounds.minZ + INSET, z),
      );
      if (Math.abs(cx - x) > 0.1 || Math.abs(cz - z) > 0.1) {
        this.world.emit("player:teleport", {
          playerId: id,
          position: { x: cx, y, z: cz },
          suppressEffect: true,
        });
      }
    }
  }

  getStreamingArenaMovementBounds(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    const arenaConfig = getDuelArenaConfig();
    const arenaId = Math.max(
      1,
      Math.min(STREAMING_AGENT_ARENA_ID, arenaConfig.arenaCount),
    );
    const row = Math.floor((arenaId - 1) / arenaConfig.columns);
    const col = (arenaId - 1) % arenaConfig.columns;
    const centerX =
      arenaConfig.baseX +
      col * (arenaConfig.arenaWidth + arenaConfig.arenaGap) +
      arenaConfig.arenaWidth / 2;
    const centerZ =
      arenaConfig.baseZ +
      row * (arenaConfig.arenaLength + arenaConfig.arenaGap) +
      arenaConfig.arenaLength / 2;
    return {
      minX: centerX - arenaConfig.arenaWidth / 2,
      maxX: centerX + arenaConfig.arenaWidth / 2,
      minZ: centerZ - arenaConfig.arenaLength / 2,
      maxZ: centerZ + arenaConfig.arenaLength / 2,
    };
  }

  /**
   * Get grounded Y using terrain height when available.
   */
  getGroundedY(x: number, z: number, fallbackY: number): number {
    const terrain = this.world.getSystem("terrain") as {
      getHeightAt?: (x: number, z: number) => number;
    } | null;

    const sampledY = terrain?.getHeightAt?.(x, z);
    return typeof sampledY === "number" && Number.isFinite(sampledY)
      ? sampledY
      : fallbackY;
  }

  normalizePosition(position: unknown): [number, number, number] | null {
    if (Array.isArray(position) && position.length >= 3) {
      const x = Number(position[0]);
      const y = Number(position[1]);
      const z = Number(position[2]);
      if (Number.isFinite(x) && Number.isFinite(z)) {
        return [x, Number.isFinite(y) ? y : 0, z];
      }
      return null;
    }

    if (position && typeof position === "object") {
      const pos = position as { x?: number; y?: number; z?: number };
      if (Number.isFinite(pos.x) && Number.isFinite(pos.z)) {
        return [pos.x as number, Number(pos.y ?? 0), pos.z as number];
      }
    }

    return null;
  }

  /**
   * Deterministic fallback near duel lobby to avoid overlapping resets.
   */
  getFallbackLobbyPosition(agentId: string): [number, number, number] {
    const lobby = getDuelArenaConfig().lobbySpawnPoint;

    let hash = 0;
    for (let i = 0; i < agentId.length; i++) {
      hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
    }

    const angle = ((hash % 360) * Math.PI) / 180;
    const radius = 6 + (hash % 4);
    const x = lobby.x + Math.cos(angle) * radius;
    const z = lobby.z + Math.sin(angle) * radius;
    const y = this.getGroundedY(x, z, lobby.y);

    return [x, y, z];
  }

  /**
   * Keep restore positions safe for spectator camera and terrain grounding.
   */
  sanitizeRestorePosition(
    position: [number, number, number] | null,
    agentId: string,
  ): [number, number, number] {
    const fallback = this.getFallbackLobbyPosition(agentId);
    if (!position) {
      return fallback;
    }

    const [x, y, z] = position;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return fallback;
    }

    // Never restore non-dueling agents back into combat arena tiles.
    if (isPositionInsideCombatArena(x, z)) {
      return fallback;
    }

    // Only reject positions that are clearly out-of-world (very far from origin).
    // Agents should be free to roam the world between duels.
    const distFromOrigin = Math.hypot(x, z);
    if (distFromOrigin > 2000) {
      return fallback;
    }

    const terrainY = this.getGroundedY(x, z, fallback[1]);
    const yTooLow = !Number.isFinite(y) || y < terrainY - 15;
    const yTooHigh = Number.isFinite(y) && y > terrainY + 80;
    const safeY = yTooLow || yTooHigh ? terrainY : y;

    return [x, safeY, z];
  }

  teleportPlayer(
    playerId: string,
    position: [number, number, number],
    faceToward?: [number, number, number],
    suppressEffect = false,
  ): void {
    const entity = this.world.entities.get(playerId);
    if (!entity) return;

    // Position as object for events
    const posObj = { x: position[0], y: position[1], z: position[2] };

    // Calculate rotation to face opponent if specified
    let rotation = 0;
    if (faceToward) {
      const dx = faceToward[0] - position[0];
      const dz = faceToward[2] - position[2];
      rotation = Math.atan2(dx, dz);
    }

    // Update entity data - keep as tuple format for type compatibility
    entity.data.position = position;
    entity.data.rotation = rotation;

    // Mark as teleport for network sync (tells client to snap, not lerp)
    entity.data._teleport = true;

    // Emit teleport event for network system to handle properly.
    // suppressEffect tells the client to skip the visual beam/glow effect
    // (used during FIGHTING-phase proximity corrections).
    this.world.emit("player:teleport", {
      playerId,
      position: posObj,
      rotation,
      suppressEffect,
    });

    // Emit entity modified for immediate sync
    this.world.emit(EventType.ENTITY_MODIFIED, {
      id: playerId,
      changes: {
        position,
        rotation,
        _teleport: true,
      },
    });

    Logger.debug(
      "StreamingDuelScheduler",
      `Teleported ${playerId} to [${position.join(", ")}]`,
    );
  }

  // ============================================================================
  // Fight Execution
  // ============================================================================

  startFight(): void {
    const cycle = this.getCurrentCycle();
    if (!cycle) return;

    // Phase guard — only transition from COUNTDOWN (Fix B).
    if (cycle.phase !== "COUNTDOWN") return;

    // Reset escalating stall nudge state for new fight (#20)
    this.combatStallNudgeCount = 0;
    this.lastCombatStallNudgeTime = 0;

    const { agent1, agent2 } = cycle;

    // Validate both agents exist and are alive (Fix B).
    const entity1 = agent1 ? this.world.entities.get(agent1.characterId) : null;
    const entity2 = agent2 ? this.world.entities.get(agent2.characterId) : null;
    const alive1 =
      entity1 && ((entity1.data as { health?: number }).health ?? 0) > 0;
    const alive2 =
      entity2 && ((entity2.data as { health?: number }).health ?? 0) > 0;

    if (!alive1 && !alive2) {
      // Both agents missing — caller should handle abort
      return;
    }
    if (!alive1 && agent2) {
      this.onResolution(agent2.characterId, agent1?.characterId ?? "", "kill");
      return;
    }
    if (!alive2 && agent1) {
      this.onResolution(agent1.characterId, agent2?.characterId ?? "", "kill");
      return;
    }

    const now = Date.now();
    this.setCurrentCycleFields({
      phase: "FIGHTING",
      phaseStartTime: now,
      countdownValue: null,
    });

    Logger.info("StreamingDuelScheduler", "Fight started!");

    // Mark agents as in duel (prevents normal respawn mechanics)
    this.setDuelFlags(true);

    // Guarantee full HP at fight start. Health was restored during prep, but
    // agents may have taken incidental damage during the countdown (lingering
    // combat ticks, environmental damage, etc.).
    // quiet=true: skip PLAYER_RESPAWNED/PLAYER_SET_DEAD events that cause
    // visible teleport snaps on clients during the FIGHTING phase.
    if (agent1) this.restoreHealth(agent1.characterId, true);
    if (agent2) this.restoreHealth(agent2.characterId, true);

    // Emit fight start (streaming-specific event for spectator UI)
    this.world.emit("streaming:fight:start", {
      cycleId: cycle.cycleId,
      duelId: cycle.duelId ?? `streaming-${cycle.cycleId}`,
      duelKeyHex: cycle.duelKeyHex,
      betCloseTime: cycle.betCloseTime ?? now,
      fightStartTime: now,
      agent1Id: agent1?.characterId,
      agent2Id: agent2?.characterId,
      duration:
        STREAMING_TIMING.FIGHTING_DURATION +
        STREAMING_TIMING.END_WARNING_DURATION,
    });

    // Emit standard duel fight start so agent plugins enter combat mode.
    // The duel-events listener sends duelFightStart to both agent sockets.
    if (agent1 && agent2) {
      const duelId = cycle.duelId ?? `streaming-${cycle.cycleId}`;
      this.world.emit(EventType.DUEL_FIGHT_START, {
        duelId,
        challengerId: agent1.characterId,
        targetId: agent2.characterId,
        arenaId: cycle.arenaId ?? 0,
      });
    }

    // Make agents attack each other
    this.initiateAgentCombat();

    // Start DuelCombatAI for each agent (tick-based heal/buff/attack decisions)
    this.startCombatAIs().catch((err) => {
      Logger.error(
        "StreamingDuelScheduler",
        `Failed to start combat AIs: ${errMsg(err)}`,
        err instanceof Error ? err : null,
      );
    });
  }

  /**
   * Start DuelCombatAI instances for both agents.
   * These run alongside the re-engagement loop and handle food eating,
   * potion usage, and combat phase awareness (opening, trading, finishing).
   */
  async startCombatAIs(): Promise<void> {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const combatAiEnabled =
      (process.env.STREAMING_DUEL_COMBAT_AI_ENABLED || "true")
        .toLowerCase()
        .trim() !== "false";
    if (!combatAiEnabled) {
      this.stopCombatAIs();
      this.combatRetryCount = 0;
      Logger.info(
        "StreamingDuelScheduler",
        "Combat AI disabled via STREAMING_DUEL_COMBAT_AI_ENABLED=false; relying on combat system re-engagement loop",
      );
      return;
    }

    const { agent1, agent2 } = cycle;
    const llmTacticsEnabled =
      (process.env.STREAMING_DUEL_LLM_TACTICS_ENABLED || "true")
        .toLowerCase()
        .trim() !== "false";

    const { getAgentManager } = await import("../../../eliza/AgentManager.js");
    const { getAgentRuntimeByCharacterId } =
      await import("../../../eliza/ModelAgentSpawner.js");
    const manager = getAgentManager();

    // Stop/relock after async imports so autonomy is not briefly restored while
    // the module loader yields.
    this.stopCombatAIs();
    this.combatRetryCount = 0;

    const service1 = manager?.getAgentService(agent1.characterId) ?? null;
    const service2 = manager?.getAgentService(agent2.characterId) ?? null;
    const runtime1 = getAgentRuntimeByCharacterId(agent1.characterId);
    const runtime2 = getAgentRuntimeByCharacterId(agent2.characterId);

    const role1 = this.combatRolesByAgent.get(agent1.characterId) ?? "melee";
    const role2 = this.combatRolesByAgent.get(agent2.characterId) ?? "melee";
    const movementClampBounds = this.getStreamingArenaMovementBounds();
    const baseAiConfig = {
      noFood: DEFAULT_DUEL_RULES.noFood,
      movementClampBounds,
    };

    // Lock both services into arena mode:
    // 1. Clamp all movement to arena bounds (no reactive correction teleports).
    // 2. Disable autonomous behavior loop so agents don't wander off to quest
    //    or explore between DuelCombatAI ticks.
    this._arenaModeServices = [];
    for (const svc of [service1, service2]) {
      if (!svc) continue;
      svc.setArenaBounds(movementClampBounds);
      svc.setAutonomousBehaviorEnabled(false);
      this._arenaModeServices.push(svc);
    }

    if (service1) {
      const ai1 = new DuelCombatAI(
        service1,
        agent2.characterId,
        {
          ...baseAiConfig,
          useLlmTactics: llmTacticsEnabled && !!runtime1,
          combatRole: role1,
          initialStrafeSign: 1,
        },
        runtime1 ?? undefined,
        // Trash talk callback — sends chat as overhead bubble via the agent's service
        (text) => {
          service1.sendChatMessage(text).catch(() => {});
        },
      );
      ai1.setContext(agent1.name, agent2.combatLevel, agent2.name);
      ai1.start();
      this.combatAIs.set(agent1.characterId, ai1);
      Logger.info(
        "StreamingDuelScheduler",
        `Combat AI started for ${agent1.name} (role=${role1}, ${llmTacticsEnabled && !!runtime1 ? "LLM strategy" : "scripted"})`,
      );
    }

    if (service2) {
      const ai2 = new DuelCombatAI(
        service2,
        agent1.characterId,
        {
          ...baseAiConfig,
          useLlmTactics: llmTacticsEnabled && !!runtime2,
          combatRole: role2,
          initialStrafeSign: -1,
        },
        runtime2 ?? undefined,
        // Trash talk callback — sends chat as overhead bubble via the agent's service
        (text) => {
          service2.sendChatMessage(text).catch(() => {});
        },
      );
      ai2.setContext(agent2.name, agent1.combatLevel, agent1.name);
      ai2.start();
      this.combatAIs.set(agent2.characterId, ai2);
      Logger.info(
        "StreamingDuelScheduler",
        `Combat AI started for ${agent2.name} (role=${role2}, ${llmTacticsEnabled && !!runtime2 ? "LLM strategy" : "scripted"})`,
      );
    }

    if (this.combatAIs.size === 0) {
      Logger.error(
        "StreamingDuelScheduler",
        "No combat AIs started; fight will rely only on combat re-engagement loop",
        null,
        {
          agent1Id: agent1.characterId,
          agent2Id: agent2.characterId,
          service1Available: !!service1,
          service2Available: !!service2,
        },
      );
    }
  }

  /** Stop all DuelCombatAI instances, log and store their final stats */
  stopCombatAIs(): void {
    for (const [characterId, ai] of this.combatAIs) {
      const stats = ai.getStats();
      Logger.info(
        "StreamingDuelScheduler",
        `Combat AI stats for ${characterId}: ${stats.attacksLanded} attacks, ${stats.healsUsed} heals, ${stats.totalDamageDealt} dmg dealt`,
      );
      this._lastFightStats.set(characterId, {
        attacksLanded: stats.attacksLanded,
        healsUsed: stats.healsUsed,
      });
      ai.stop();
    }
    this.combatAIs.clear();
    // Release arena mode: restore movement freedom and autonomous behavior.
    for (const svc of this._arenaModeServices) {
      svc.clearArenaBounds();
      svc.setAutonomousBehaviorEnabled(true);
    }
    this._arenaModeServices = [];
  }

  /** Returns AI stats captured at the end of the last fight, keyed by characterId */
  getLastFightStats(): ReadonlyMap<
    string,
    { attacksLanded: number; healsUsed: number }
  > {
    return this._lastFightStats;
  }

  // ============================================================================
  // Duel Flags
  // ============================================================================

  /** Set or clear duel flags on agents to prevent normal respawn */
  setDuelFlags(inDuel: boolean): void {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const { agent1, agent2 } = cycle;

    const entity1 = this.world.entities.get(agent1.characterId);
    const entity2 = this.world.entities.get(agent2.characterId);

    if (entity1) {
      entity1.data.inStreamingDuel = inDuel;
      entity1.data.preventRespawn = inDuel;
    }
    if (entity2) {
      entity2.data.inStreamingDuel = inDuel;
      entity2.data.preventRespawn = inDuel;
    }
  }

  /**
   * Clear streaming duel flags for contestants in a cycle.
   */
  clearDuelFlagsForCycle(cycle: StreamingDuelCycle | null): void {
    if (!cycle?.agent1 || !cycle.agent2) {
      return;
    }

    const ids = [cycle.agent1.characterId, cycle.agent2.characterId];
    for (const playerId of ids) {
      const entity = this.world.entities.get(playerId);
      if (!entity) {
        continue;
      }
      entity.data.inStreamingDuel = false;
      entity.data.preventRespawn = false;
      (entity.data as Record<string, unknown>).arenaBounds = null;
    }
  }

  /**
   * Clear flags from a completed cycle without clobbering agents that are
   * already contestants in a newly-started cycle.
   */
  clearDuelFlagsForCycleIfInactive(cycle: StreamingDuelCycle | null): void {
    if (!cycle?.agent1 || !cycle.agent2) {
      return;
    }

    const currentCycle = this.getCurrentCycle();
    const currentAgent1Id = currentCycle?.agent1?.characterId ?? null;
    const currentAgent2Id = currentCycle?.agent2?.characterId ?? null;
    const ids = [cycle.agent1.characterId, cycle.agent2.characterId];

    for (const playerId of ids) {
      if (playerId === currentAgent1Id || playerId === currentAgent2Id) {
        continue;
      }

      const entity = this.world.entities.get(playerId);
      if (!entity) {
        continue;
      }
      entity.data.inStreamingDuel = false;
      entity.data.preventRespawn = false;
      (entity.data as Record<string, unknown>).arenaBounds = null;
    }
  }

  /**
   * Clear stale duel flags from idle agents when no duel owns them.
   */
  clearStaleDuelFlagsForIdleAgents(availableAgents: Set<string>): void {
    const cycle = this.getCurrentCycle();
    if (cycle) {
      return;
    }

    for (const agentId of availableAgents) {
      const entity = this.world.entities.get(agentId);
      if (!entity) {
        continue;
      }

      if (
        entity.data.inStreamingDuel === true ||
        entity.data.preventRespawn === true
      ) {
        entity.data.inStreamingDuel = false;
        entity.data.preventRespawn = false;
        (entity.data as Record<string, unknown>).arenaBounds = null;
      }
    }
  }

  // ============================================================================
  // Combat Engagement
  // ============================================================================

  initiateAgentCombat(): void {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const { agent1, agent2 } = cycle;

    this.tryMutualCombat(agent1.characterId, agent2.characterId);

    const cycleAfter = this.getCurrentCycle();
    if (!cycleAfter || cycleAfter.phase !== "FIGHTING") {
      return;
    }

    Logger.info(
      "StreamingDuelScheduler",
      `Combat initiated between ${agent1.name} and ${agent2.name}`,
    );

    // Set entity-level combat flags only when CombatSystem didn't establish
    // state (e.g., startCombat failed due to range/validation). This prevents
    // masking engagement failures — DuelCombatAI checks these flags to decide
    // whether to call executeAttack(), so false positives cause agents to idle.
    const combatSystem = this.world.getSystem("combat") as {
      isInCombat?: (entityId: string) => boolean;
    } | null;
    if (!combatSystem?.isInCombat?.(agent1.characterId)) {
      this.setAgentCombatTarget(agent1.characterId, agent2.characterId);
    }
    if (!combatSystem?.isInCombat?.(agent2.characterId)) {
      this.setAgentCombatTarget(agent2.characterId, agent1.characterId);
    }

    // Fix L — Verify combat actually engaged; schedule one retry if not.
    this.scheduleCombatRetryIfNeeded(agent1.characterId, agent2.characterId);

    // Start combat re-engagement loop to keep agents fighting
    this.startCombatLoop();
  }

  /** Set combat target on an agent entity */
  setAgentCombatTarget(agentId: string, targetId: string): void {
    const entity = this.world.entities.get(agentId);
    if (!entity) return;

    entity.data.combatTarget = targetId;
    entity.data.inCombat = true;
    entity.data.attackTarget = targetId;
  }

  /**
   * Force-stop any active combat on an agent via the CombatSystem.
   *
   * This is essential before teleporting agents to the arena. Without it, the
   * CombatSystem's internal state (attack cooldowns, target tracking, chase
   * movement) continues independently of entity.data flags — combat ticks can
   * fire during async operations and broadcast attack events at pre-arena
   * positions.
   *
   * Also clears entity-level combat flags and emits a COMBAT_STOP_ATTACK event
   * so all listeners (animation, face direction, UI) properly reset.
   */
  forceStopAgentCombat(agentId: string): void {
    const combatSystem = this.world.getSystem("combat") as {
      forceEndCombat?: (entityId: string) => void;
      isInCombat?: (entityId: string) => boolean;
    } | null;

    // Use the CombatSystem's forceEndCombat to properly tear down internal
    // combat state (StateService entries, attack cooldowns, animation resets).
    if (combatSystem?.forceEndCombat) {
      try {
        combatSystem.forceEndCombat(agentId);
      } catch {
        // Agent may not have active combat state; safe to ignore.
      }
    }

    // Clear entity-level combat flags as a belt-and-suspenders measure.
    const entity = this.world.entities.get(agentId);
    if (entity) {
      (entity.data as AgentCombatData).inCombat = false;
      (entity.data as AgentCombatData).combatTarget = null;
      (entity.data as AgentCombatData).ct = null;
      (entity.data as AgentCombatData).c = false;
      (entity.data as AgentCombatData).attackTarget = null;
    }

    // Notify other systems (animation, face direction) to stop combat visuals.
    this.world.emit(EventType.COMBAT_STOP_ATTACK, { attackerId: agentId });
  }

  /**
   * Keep duel contestants within melee range to guarantee engagement.
   */
  ensureDuelProximity(agent1Id: string, agent2Id: string): void {
    const distance = this.getTileChebyshevDistance(agent1Id, agent2Id);
    if (distance !== null && distance !== 1) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Contestants not in valid melee spacing (tileDistance=${distance}), re-teleporting`,
      );
      // suppressEffect=true: skip the visual beam/glow during FIGHTING corrections
      void this.teleportToArena(agent1Id, agent2Id, true);
    }
  }

  logCombatStartFailure(
    attackerId: string,
    targetId: string,
    side: "a1" | "a2",
  ): void {
    const distance = this.getTileChebyshevDistance(attackerId, targetId);
    Logger.warn(
      "StreamingDuelScheduler",
      `startCombat failed (${side}) attacker=${attackerId} target=${targetId} tileDistance=${distance ?? "unknown"}`,
    );
  }

  /**
   * Fix L — After initiating combat, verify agents are actually engaged.
   * If neither is in combat after 1.5s, re-teleport to fix spacing and retry.
   */
  clearCombatRetryTimeout(): void {
    if (this.combatRetryTimeout) {
      clearTimeout(this.combatRetryTimeout);
      this.combatRetryTimeout = null;
    }
  }

  clearVictoryPresentationTimeout(): void {
    if (this.victoryPresentationTimeout) {
      clearTimeout(this.victoryPresentationTimeout);
      this.victoryPresentationTimeout = null;
    }
  }

  scheduleCombatRetryIfNeeded(agent1Id: string, agent2Id: string): void {
    this.clearCombatRetryTimeout();
    this.combatRetryTimeout = setTimeout(() => {
      this.combatRetryTimeout = null;
      const cycle = this.getCurrentCycle();
      if (!cycle || cycle.phase !== "FIGHTING") return;

      this.combatRetryCount++;
      if (this.combatRetryCount > DuelOrchestrator.MAX_COMBAT_RETRIES) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Combat retry limit reached (${this.combatRetryCount}/${DuelOrchestrator.MAX_COMBAT_RETRIES}) — aborting duel as draw`,
        );
        this.combatRetryCount = 0;
        // Abort the duel — use startResolution with draw to properly clean up
        const abortCycle = this.getCurrentCycle();
        if (abortCycle?.agent1 && abortCycle?.agent2) {
          this.startResolution(
            abortCycle.agent1.characterId,
            abortCycle.agent2.characterId,
            "draw",
          );
        }
        return;
      }

      const combatSystem = this.world.getSystem("combat") as {
        startCombat?: (
          attackerId: string,
          targetId: string,
          options?: { attackerType?: string; targetType?: string },
        ) => boolean;
        isInCombat?: (entityId: string) => boolean;
      } | null;

      const entity1 = this.world.entities.get(agent1Id);
      const entity2 = this.world.entities.get(agent2Id);

      // Check CombatSystem state only — entity.data flags can be stale from
      // setAgentCombatTarget() and mask engagement failures.
      const inCombat1 = combatSystem?.isInCombat?.(agent1Id) ?? false;
      const inCombat2 = combatSystem?.isInCombat?.(agent2Id) ?? false;

      if (inCombat1 && inCombat2) {
        this.combatRetryCount = 0; // Reset on success
        return;
      }

      Logger.warn(
        "StreamingDuelScheduler",
        `Combat retry ${this.combatRetryCount}/${DuelOrchestrator.MAX_COMBAT_RETRIES}: neither agent in combat, re-teleporting`,
      );

      // Re-teleport to fix spacing, then retry combat
      this.ensureDuelProximity(agent1Id, agent2Id);

      this.tryMutualCombat(agent1Id, agent2Id);

      this.setAgentCombatTarget(agent1Id, agent2Id);
      this.setAgentCombatTarget(agent2Id, agent1Id);

      // Schedule another retry check — if combat still hasn't started, the
      // counter will increment and eventually trigger the abort.
      this.scheduleCombatRetryIfNeeded(agent1Id, agent2Id);
    }, 3000); // 5 ticks at 600ms - aligned with combat loop re-engagement interval
  }

  getTileChebyshevDistance(
    entityAId: string,
    entityBId: string,
  ): number | null {
    const entityA = this.world.entities.get(entityAId);
    const entityB = this.world.entities.get(entityBId);
    if (!entityA || !entityB) return null;

    const posA = entityA.data.position as
      | [number, number, number]
      | { x: number; y?: number; z: number }
      | undefined;
    const posB = entityB.data.position as
      | [number, number, number]
      | { x: number; y?: number; z: number }
      | undefined;
    if (!posA || !posB) return null;

    const ax = Array.isArray(posA) ? posA[0] : posA.x;
    const az = Array.isArray(posA) ? posA[2] : posA.z;
    const bx = Array.isArray(posB) ? posB[0] : posB.x;
    const bz = Array.isArray(posB) ? posB[2] : posB.z;

    return tileChebyshevDistance(worldToTile(ax, az), worldToTile(bx, bz));
  }

  // ============================================================================
  // Combat Loop
  // ============================================================================

  /**
   * Start a loop that drives DuelCombatAI ticks and re-engages agents.
   *
   * Runs every 600ms (TICK_DURATION_MS) so AI decisions are aligned with
   * the game tick cadence instead of drifting on an independent setInterval.
   * Re-engagement for agents WITHOUT an active AI runs every 5th tick (~3s).
   */
  startCombatLoop(): void {
    // Clear any existing loop
    if (this.combatLoopInterval) {
      clearInterval(this.combatLoopInterval);
    }
    this.combatLoopTickCount = 0;

    const TICK_MS = 600; // Match game tick duration

    this.combatLoopInterval = setInterval(() => {
      const cycle = this.getCurrentCycle();
      if (!cycle || cycle.phase !== "FIGHTING") {
        if (this.combatLoopInterval) {
          clearInterval(this.combatLoopInterval);
          this.combatLoopInterval = null;
        }
        return;
      }

      this.combatLoopTickCount++;

      const { agent1, agent2 } = cycle;
      if (!agent1 || !agent2) return;

      // Drive DuelCombatAI ticks synchronously with this loop
      for (const [characterId, ai] of this.combatAIs) {
        ai.externalTick().catch((err) => {
          Logger.warn(
            "StreamingDuelScheduler",
            `Combat AI tick error for ${characterId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }

      // Hard-enforce minimum separation — the tile movement system has no
      // player-player collision, so we must prevent stacking directly.
      this.enforceAgentSeparation(agent1.characterId, agent2.characterId);

      // Re-engage agents that DON'T have an active AI every ~3 seconds (5 ticks)
      if (this.combatLoopTickCount % 5 !== 0) return;

      const agent1HasAI = this.combatAIs.has(agent1.characterId);
      const agent2HasAI = this.combatAIs.has(agent2.characterId);

      // If both agents have AI, skip re-engagement entirely
      if (agent1HasAI && agent2HasAI) return;

      const entity1 = this.world.entities.get(agent1.characterId);
      const entity2 = this.world.entities.get(agent2.characterId);

      // Only re-engage agents without an active AI
      if (!agent1HasAI && entity1 && !entity1.data.combatTarget) {
        this.setAgentCombatTarget(agent1.characterId, agent2.characterId);
      }
      if (!agent2HasAI && entity2 && !entity2.data.combatTarget) {
        this.setAgentCombatTarget(agent2.characterId, agent1.characterId);
      }

      // Re-initiate combat via system
      this.tryMutualCombat(agent1.characterId, agent2.characterId);
    }, TICK_MS);
  }

  /**
   * Attempt to start mutual combat between two agents via the combat system.
   * Handles proximity checks, failure logging, and mid-resolution bail.
   */
  tryMutualCombat(agent1Id: string, agent2Id: string): void {
    const combatSystem = this.world.getSystem("combat") as {
      startCombat?: (
        attackerId: string,
        targetId: string,
        options?: {
          attackerType?: string;
          targetType?: string;
          weaponType?: AttackType;
        },
      ) => boolean;
      isInCombat?: (entityId: string) => boolean;
      getCombatData?: (
        entityId: string,
      ) => { targetId?: unknown; inCombat?: boolean } | null;
    } | null;

    if (!combatSystem?.startCombat) {
      Logger.warn(
        "StreamingDuelScheduler",
        "Combat system not available or missing startCombat method",
      );
      return;
    }

    this.ensureDuelProximity(agent1Id, agent2Id);

    // Resolve weapon type from each agent's combat role so the combat system
    // creates the correct state (melee / ranged / magic). Without this, all
    // agents default to MELEE, which means magic and ranged agents never fire
    // their projectile-based attacks.
    const roleToWeaponType = (role: DuelCombatRole): AttackType => {
      switch (role) {
        case "mage":
          return AttackType.MAGIC;
        case "ranged":
          return AttackType.RANGED;
        default:
          return AttackType.MELEE;
      }
    };
    const role1 = this.combatRolesByAgent.get(agent1Id) ?? "melee";
    const role2 = this.combatRolesByAgent.get(agent2Id) ?? "melee";
    const weaponType1 = roleToWeaponType(role1);
    const weaponType2 = roleToWeaponType(role2);

    // Guard: Don't replace existing combat state if agent already has a valid
    // state targeting the correct opponent. createAttackerState replaces the
    // state Map entry which resets nextAttackTick — for slow weapons (2H swords,
    // attackSpeed 7) the auto-attack loop never reaches nextAttackTick because
    // repeated re-engagement keeps pushing it forward (starvation pattern).
    const hasValidState = (attackerId: string, targetId: string): boolean => {
      if (!combatSystem.getCombatData || !combatSystem.isInCombat) return false;
      if (!combatSystem.isInCombat(attackerId)) return false;
      const state = combatSystem.getCombatData(attackerId);
      return !!(state?.inCombat && String(state.targetId) === targetId);
    };

    if (!hasValidState(agent1Id, agent2Id)) {
      const started1 = combatSystem.startCombat(agent1Id, agent2Id, {
        attackerType: "player",
        targetType: "player",
        weaponType: weaponType1,
      });
      if (!started1) {
        this.logCombatStartFailure(agent1Id, agent2Id, "a1");
      }
    }

    // First attack may have ended the duel; do not allow stale follow-up hit.
    const cycle = this.getCurrentCycle();
    if (!cycle || cycle.phase !== "FIGHTING") {
      return;
    }

    if (!hasValidState(agent2Id, agent1Id)) {
      const started2 = combatSystem.startCombat(agent2Id, agent1Id, {
        attackerType: "player",
        targetType: "player",
        weaponType: weaponType2,
      });
      if (!started2) {
        this.logCombatStartFailure(agent2Id, agent1Id, "a2");
      }
    }
  }

  /** Stop the combat loop */
  stopCombatLoop(): void {
    if (this.combatLoopInterval) {
      clearInterval(this.combatLoopInterval);
      this.combatLoopInterval = null;
    }
  }

  // ============================================================================
  // HP Tracking & Combat Stall Nudge
  // ============================================================================

  updateContestantHp():
    | { hpLost1: number; hpLost2: number; maxHp1: number; maxHp2: number }
    | undefined {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const entity1 = this.world.entities.get(cycle.agent1.characterId);
    const entity2 = this.world.entities.get(cycle.agent2.characterId);
    const previousHp1 = cycle.agent1.currentHp;
    const previousHp2 = cycle.agent2.currentHp;

    let nextHp1 = previousHp1;
    let nextHp2 = previousHp2;

    if (entity1) {
      const data = entity1.data as { health?: number; maxHealth?: number };
      nextHp1 = data.health || 0;
      cycle.agent1.currentHp = nextHp1;
      cycle.agent1.maxHp = data.maxHealth || 10;
    }

    if (entity2) {
      const data = entity2.data as { health?: number; maxHealth?: number };
      nextHp2 = data.health || 0;
      cycle.agent2.currentHp = nextHp2;
      cycle.agent2.maxHp = data.maxHealth || 10;
    }

    if (cycle.phase !== "FIGHTING") {
      return;
    }

    // Fallback for combat paths that mutate HP without emitting
    // COMBAT_DAMAGE_DEALT. If the damage event already fired, currentHp was
    // synchronized immediately and these deltas stay at zero.
    const hpLost1 = Math.max(0, previousHp1 - nextHp1);
    const hpLost2 = Math.max(0, previousHp2 - nextHp2);

    if (hpLost1 > 0) {
      cycle.agent2.damageDealtThisFight += hpLost1;
    }

    if (hpLost2 > 0) {
      cycle.agent1.damageDealtThisFight += hpLost2;
    }

    // Return HP deltas so the scheduler can feed combat hits to the camera director
    return {
      hpLost1,
      hpLost2,
      maxHp1: cycle.agent1.maxHp,
      maxHp2: cycle.agent2.maxHp,
    };
  }

  /**
   * Escalating combat stall nudge (#20).
   * First nudge at STREAMING_COMBAT_STALL_NUDGE_MS, subsequent every 10s.
   * Damage escalates: min(count+1, 5). Alternates targets. Resets on combat evidence.
   * Floors HP at 1 to avoid accidental kills.
   */
  applyCombatStallNudge(now: number): void {
    const cycle = this.getCurrentCycle();
    if (!cycle || cycle.phase !== "FIGHTING") return;

    const { agent1, agent2 } = cycle;
    if (!agent1 || !agent2) return;

    // Reset nudge state if there's combat evidence
    const hasCombatEvidence =
      agent1.currentHp < agent1.maxHp ||
      agent2.currentHp < agent2.maxHp ||
      agent1.damageDealtThisFight > 0 ||
      agent2.damageDealtThisFight > 0;
    if (hasCombatEvidence) {
      this.combatStallNudgeCount = 0;
      this.lastCombatStallNudgeTime = 0;
      return;
    }

    // Check cooldown: first nudge uses the initial stall threshold,
    // subsequent nudges use the escalation interval
    if (this.combatStallNudgeCount > 0) {
      if (
        now - this.lastCombatStallNudgeTime <
        STALL_NUDGE_ESCALATION_INTERVAL_MS
      )
        return;
    }

    // Alternate targets based on nudge count
    const isEven = this.combatStallNudgeCount % 2 === 0;
    const attackerId = isEven ? agent1.characterId : agent2.characterId;
    const targetId = isEven ? agent2.characterId : agent1.characterId;
    const targetAgent = isEven ? agent2 : agent1;
    const targetEntity = this.world.entities.get(targetId);
    if (!targetEntity) return;

    const currentHp = Number((targetEntity.data as { health?: number }).health);
    const safeCurrentHp = Number.isFinite(currentHp)
      ? currentHp
      : targetAgent.currentHp;
    const nudgeDamage = Math.min(
      this.combatStallNudgeCount + 1,
      STALL_NUDGE_MAX_DAMAGE,
    );
    const nextHp = Math.max(1, safeCurrentHp - nudgeDamage);
    const damage = safeCurrentHp - nextHp;
    if (damage <= 0) return;

    if (targetEntity instanceof PlayerEntity) {
      targetEntity.setHealth(nextHp);
      targetEntity.markNetworkDirty();
    }

    (targetEntity.data as { health?: number; alive?: boolean }).health = nextHp;
    this.world.emit(EventType.ENTITY_MODIFIED, {
      id: targetId,
      changes: { health: nextHp },
    });
    this.world.emit(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage,
    });

    this.combatStallNudgeCount++;
    this.lastCombatStallNudgeTime = now;
    Logger.warn(
      "StreamingDuelScheduler",
      `Applied escalating combat nudge #${this.combatStallNudgeCount} (${attackerId} -> ${targetId}, damage=${damage})`,
    );
  }

  // ============================================================================
  // Fight Resolution
  // ============================================================================

  endFightByTimeout(): void {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    // Defense-in-depth: only run during FIGHTING phase (Fix G).
    if (cycle.phase !== "FIGHTING") return;

    const { agent1, agent2 } = cycle;

    // Determine winner by HP percentage
    const hp1Percent = agent1.currentHp / agent1.maxHp;
    const hp2Percent = agent2.currentHp / agent2.maxHp;

    let winnerId: string;
    let loserId: string;
    let winReason: "hp_advantage" | "damage_advantage" | "draw";

    if (hp1Percent > hp2Percent) {
      winnerId = agent1.characterId;
      loserId = agent2.characterId;
      winReason = "hp_advantage";
    } else if (hp2Percent > hp1Percent) {
      winnerId = agent2.characterId;
      loserId = agent1.characterId;
      winReason = "hp_advantage";
    } else {
      // Tied HP - check damage dealt
      if (agent1.damageDealtThisFight > agent2.damageDealtThisFight) {
        winnerId = agent1.characterId;
        loserId = agent2.characterId;
        winReason = "damage_advantage";
      } else if (agent2.damageDealtThisFight > agent1.damageDealtThisFight) {
        winnerId = agent2.characterId;
        loserId = agent1.characterId;
        winReason = "damage_advantage";
      } else {
        // True draw — both HP and damage equal (#24)
        // Resolve as a proper draw: no winner/loser, just record it
        this.onResolution(agent1.characterId, agent2.characterId, "draw");
        return;
      }
    }

    this.startResolution(winnerId, loserId, winReason);
  }

  startResolution(
    winnerId: string,
    loserId: string,
    winReason: "kill" | "hp_advantage" | "damage_advantage" | "draw",
  ): void {
    const cycle = this.getCurrentCycle();
    if (!cycle) return;

    // Idempotency guard — only transition from FIGHTING or COUNTDOWN (Fix C).
    if (cycle.phase !== "FIGHTING" && cycle.phase !== "COUNTDOWN") {
      return;
    }

    // Stop the combat loop, retry timeout, and AIs
    this.stopCombatLoop();
    this.clearCombatRetryTimeout();
    this.stopCombatAIs();

    // Notify the facade to handle resolution (phase transition, stats, recording, camera)
    this.onResolution(winnerId, loserId, winReason);

    // Delay the victory emote so all death/combat cleanup (emote resets,
    // combat state teardown, scheduled animation resets) finishes first.
    // Without this, the "victory" emote gets immediately overwritten by
    // stale "idle" resets from the combat animation system.
    this.clearVictoryPresentationTimeout();
    this.victoryPresentationTimeout = setTimeout(() => {
      this.victoryPresentationTimeout = null;
      this.triggerVictoryEmote(winnerId);
      this.fireVictoryTrashTalk(winnerId);
    }, 600);
  }

  /**
   * Trigger victory emote on the winning agent.
   * Called after a short delay so all death/combat cleanup has finished
   * and won't overwrite the emote.
   */
  triggerVictoryEmote(winnerId: string): void {
    const network = this.world.network as NetworkWithSend | undefined;
    if (!network?.send) return;

    // Set emote on the server entity so any future entity sync includes it
    const entity = this.world.entities.get(winnerId);
    if (entity?.data) {
      entity.data.emote = "victory";
    }

    // Broadcast victory emote to all clients
    network.send("entityModified", {
      id: winnerId,
      changes: {
        e: "victory",
      },
    });

    Logger.info(
      "StreamingDuelScheduler",
      `Triggered victory emote for winner ${winnerId}`,
    );
  }

  /**
   * Fire a victory trash talk message from the winning agent.
   * Uses the agent's chat service to display a closing taunt overhead.
   */
  private fireVictoryTrashTalk(winnerId: string): void {
    const VICTORY_TAUNTS = [
      "GG EZ",
      "Too easy",
      "Get good",
      "Was that it?",
      "Next!",
      "Sit down kid",
      "Another one bites the dust",
      "Unmatched",
    ];

    // Fire-and-forget: try to send a victory taunt via agent service
    void (async () => {
      try {
        const { getAgentManager } =
          await import("../../../eliza/AgentManager.js");
        const manager = getAgentManager();
        const service = manager?.getAgentService(winnerId);
        if (service) {
          const msg =
            VICTORY_TAUNTS[Math.floor(Math.random() * VICTORY_TAUNTS.length)];
          await service.sendChatMessage(msg);
        }
      } catch {
        // Swallow — chat failure must not break resolution
      }
    })();
  }

  // ============================================================================
  // Post-Duel Cleanup
  // ============================================================================

  async cleanupAfterDuel(
    cycleSnapshot: StreamingDuelCycle,
    duelFoodSlotsSnapshotByAgent: Map<string, DuelFoodProvisionedSlot[]>,
  ): Promise<void> {
    if (!cycleSnapshot.agent1 || !cycleSnapshot.agent2) return;

    const { agent1, agent2 } = cycleSnapshot;
    const agent1TrackedFoodSlots =
      duelFoodSlotsSnapshotByAgent.get(agent1.characterId) ?? [];
    const agent2TrackedFoodSlots =
      duelFoodSlotsSnapshotByAgent.get(agent2.characterId) ?? [];

    // Restore health
    this.restoreHealth(agent1.characterId);
    this.restoreHealth(agent2.characterId);

    // Remove duel combat gear and food (Fix: weapons only exist during duel period)
    await Promise.all([
      this.cleanupAgentCombatSetup(agent1.characterId),
      this.cleanupAgentCombatSetup(agent2.characterId),
      this.removeDuelFood(agent1.characterId, agent1TrackedFoodSlots),
      this.removeDuelFood(agent2.characterId, agent2TrackedFoodSlots),
    ]);

    // Always teleport both agents to lobby and stop combat. The inter-cycle
    // delay in endCycle() ensures cleanup completes before the next cycle
    // re-selects and re-teleports agents, preventing stale avatar artifacts.
    const agent1RestorePosition = this.sanitizeRestorePosition(
      agent1.originalPosition,
      agent1.characterId,
    );
    this.teleportPlayer(agent1.characterId, agent1RestorePosition);
    this.stopCombat(agent1.characterId);

    const agent2RestorePosition = this.sanitizeRestorePosition(
      agent2.originalPosition,
      agent2.characterId,
    );
    this.teleportPlayer(agent2.characterId, agent2RestorePosition);
    this.stopCombat(agent2.characterId);

    // Defer flag clear until current death-event dispatch unwinds. If we clear
    // synchronously here, PlayerDeathSystem may treat duel deaths as normal deaths
    // and force a Central Haven respawn before cleanup completes.
    // Use the captured cycle snapshot so async completion cannot clear flags
    // for a newly-started cycle.
    globalThis.queueMicrotask(() => {
      this.clearDuelFlagsForCycleIfInactive(cycleSnapshot);
    });
  }

  isAgentInCurrentCycle(playerId: string): boolean {
    const cycle = this.getCurrentCycle();
    return (
      cycle?.agent1?.characterId === playerId ||
      cycle?.agent2?.characterId === playerId
    );
  }

  async removeDuelFood(
    playerId: string,
    duelFoodSlots: DuelFoodProvisionedSlot[],
  ): Promise<void> {
    if (duelFoodSlots.length === 0) {
      return;
    }

    const inventorySystem = this.getInventorySystem();

    if (!inventorySystem?.getInventory || !inventorySystem?.removeItem) {
      return;
    }

    try {
      const inventory = inventorySystem.getInventory(playerId);
      if (!inventory) return;

      const itemsBySlot = new Map(
        inventory.items.map((item) => [item.slot, item] as const),
      );
      const trackedFoodItemIds = new Set(
        duelFoodSlots.map((entry) => entry.itemId),
      );
      let removed = 0;

      for (const entry of duelFoodSlots) {
        const item = itemsBySlot.get(entry.slot);
        if (!item) continue;

        if (!isDuelFoodItemId(item.itemId, entry.itemId)) {
          continue;
        }

        try {
          await inventorySystem.removeItem({
            playerId,
            itemId: item.itemId,
            quantity: item.quantity,
            slot: item.slot,
          });
          removed++;
        } catch (slotErr) {
          // Continue on error
        }
      }

      // Best effort sweep for any leftovers of this cycle's duel-food item(s).
      const refreshedInventory = inventorySystem.getInventory(playerId);
      if (refreshedInventory) {
        for (const item of refreshedInventory.items) {
          let shouldRemove = false;
          for (const duelFoodItemId of trackedFoodItemIds) {
            if (isDuelFoodItemId(item.itemId, duelFoodItemId)) {
              shouldRemove = true;
              break;
            }
          }
          if (!shouldRemove) continue;

          try {
            await inventorySystem.removeItem({
              playerId,
              itemId: item.itemId,
              quantity: item.quantity,
              slot: item.slot,
            });
            removed++;
          } catch (slotErr) {
            // Continue on error
          }
        }
      }

      if (removed > 0) {
        Logger.info(
          "StreamingDuelScheduler",
          `Removed ${removed} food items from ${playerId}`,
        );
      }
    } catch (err) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to remove duel food: ${errMsg(err)}`,
      );
    }
  }

  stopCombat(playerId: string): void {
    // Tear down CombatSystem internal state (StateService entries, attack
    // cooldowns, animation resets) so the combat tick doesn't re-set entity
    // flags after we clear them below.
    const combatSystem = this.world.getSystem("combat") as {
      forceEndCombat?: (entityId: string) => void;
    } | null;
    if (combatSystem?.forceEndCombat) {
      try {
        combatSystem.forceEndCombat(playerId);
      } catch {
        // Agent may not have active combat state; safe to ignore.
      }
    }

    const entity = this.world.entities.get(playerId);
    if (!entity) return;

    // Clear ALL combat-related entity data fields. The `ct` (serialized
    // combatTarget) and `attackTarget` fields are checked by
    // EmbeddedHyperscapeService.getGameState() — leaving them stale causes
    // agents to think they're still in combat and return "idle" from every
    // behavior tick instead of moving or attacking.
    (entity.data as AgentCombatData).combatTarget = null;
    (entity.data as AgentCombatData).inCombat = false;
    (entity.data as AgentCombatData).ct = null;
    (entity.data as AgentCombatData).c = false;
    (entity.data as AgentCombatData).attackTarget = null;

    // Reset emote to idle so victory wave stops when agent teleports out
    entity.data.emote = "idle";
    const network = this.world.network as NetworkWithSend | undefined;
    network?.send?.("entityModified", {
      id: playerId,
      changes: { e: "idle" },
    });

    // Notify other systems (animation, face direction) to stop combat visuals.
    this.world.emit(EventType.COMBAT_STOP_ATTACK, { attackerId: playerId });
  }

  // ============================================================================
  // System Accessors (private helpers)
  // ============================================================================

  /** Get the inventory system with its expected shape. */
  private getInventorySystem(): InventorySystem {
    return this.world.getSystem("inventory") as InventorySystem;
  }

  /** Get the equipment system with its expected shape. */
  private getEquipmentSystem(): EquipmentSystem {
    return this.world.getSystem("equipment") as EquipmentSystem;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /** Reset all owned state for destroy cleanup */
  reset(): void {
    this.stopCombatLoop();
    this.clearCombatRetryTimeout();
    this.clearVictoryPresentationTimeout();
    this.stopCombatAIs();
    this._lastFightStats.clear();
    this.duelFoodSlotsByAgent.clear();
    this.combatRolesByAgent.clear();
    this.debugCombatRoleOverrideByCharacterId.clear();
    this.combatStallNudgeCount = 0;
    this.lastCombatStallNudgeTime = 0;
    this._contestantCache.clear();
    this._contestantCacheExpiry = 0;
    this.combatLoopTickCount = 0;
  }
}
