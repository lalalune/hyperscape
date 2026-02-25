/**
 * DuelOrchestrator - Combat preparation, execution, and cleanup for streaming duels.
 *
 * Extracted from StreamingDuelScheduler to isolate all combat-related concerns:
 * contestant creation, weapon/food provisioning, arena teleportation, combat AI
 * management, HP tracking, fight resolution, and post-duel cleanup.
 */

import type { World } from "@hyperscape/shared";
import {
  DeathState,
  EventType,
  ITEMS,
  PlayerEntity,
  getDuelArenaConfig,
  isPositionInsideCombatArena,
} from "@hyperscape/shared";
import { DuelCombatAI } from "../../../arena/DuelCombatAI.js";
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
} | null;

/** Type for network with send method */
interface NetworkWithSend {
  send: <T>(name: string, data: T, ignoreSocketId?: string) => void;
}

type AgentCombatData = {
  inCombat?: boolean;
  combatTarget?: string | null;
  ct?: string | null;
  attackTarget?: string | null;
};

// ============================================================================
// Constants
// ============================================================================

/** Reserved regular duel arena for streaming agents (always use a single arena). */
const STREAMING_AGENT_ARENA_ID = 1;
const DEFAULT_BRONZE_WEAPON_IDS = ["bronze_sword"] as const;
const STREAMING_COMBAT_STALL_NUDGE_MS = Math.max(
  5_000,
  Number.parseInt(process.env.STREAMING_COMBAT_STALL_NUDGE_MS || "15000", 10),
);

// ============================================================================
// DuelOrchestrator Class
// ============================================================================

export class DuelOrchestrator {
  // -- Owned state --
  private combatAIs: Map<string, DuelCombatAI> = new Map();
  private combatLoopInterval: ReturnType<typeof setInterval> | null = null;
  private combatLoopTickCount: number = 0;
  private combatRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private duelFoodSlotsByAgent: Map<string, DuelFoodProvisionedSlot[]> =
    new Map();
  private lastCombatStallNudgeCycleId: string | null = null;

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

  createContestant(
    agentId: string,
    opponentId?: string,
  ): AgentContestant | null {
    const entity = this.world.entities.get(agentId);
    if (!entity) return null;

    const data = entity.data as {
      name?: string;
      health?: number;
      maxHealth?: number;
      position?: [number, number, number] | { x: number; y: number; z: number };
      skills?: Record<string, { level: number }>;
      equipment?: unknown;
      inventory?: unknown;
    };

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

    return {
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
      // Keep a lightweight, serialization-safe snapshot for streaming payloads.
      equipment: this.snapshotAgentEquipment(data.equipment),
      inventory: this.snapshotAgentInventory(data.inventory),
      rank,
      headToHeadWins,
      headToHeadLosses,
    };
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

  // ============================================================================
  // Duel Preparation
  // ============================================================================

  async prepareContestantsForDuel(): Promise<void> {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const { agent1, agent2 } = cycle;
    const duelFoodItemId = getDuelFoodItemForLevels(
      agent1.combatLevel,
      agent2.combatLevel,
    );
    const levelDiff = Math.abs(agent1.combatLevel - agent2.combatLevel);

    // CRITICAL: Stop any active combat and movement BEFORE the async food
    // operations below. During the awaits in fillInventoryWithFood(), the event
    // loop is free and combat system ticks can fire — if agents are still in
    // combat, attack/damage events would be broadcast to clients at the agents'
    // pre-arena positions, causing the "fight outside arena" visual glitch.
    this.forceStopAgentCombat(agent1.characterId);
    this.forceStopAgentCombat(agent2.characterId);
    this.world.emit("player:movement:cancel", { playerId: agent1.characterId });
    this.world.emit("player:movement:cancel", { playerId: agent2.characterId });

    // Ensure both contestants have a weapon equipped before the duel starts.
    await Promise.all([
      this.ensureAgentHasWeapon(agent1.characterId),
      this.ensureAgentHasWeapon(agent2.characterId),
    ]);

    // Fill inventory with food (Fix H — parallel to cut prep latency)
    const [agent1FoodSlots, agent2FoodSlots] = await Promise.all([
      this.fillInventoryWithFood(agent1.characterId, duelFoodItemId),
      this.fillInventoryWithFood(agent2.characterId, duelFoodItemId),
    ]);
    this.duelFoodSlotsByAgent.set(agent1.characterId, agent1FoodSlots);
    this.duelFoodSlotsByAgent.set(agent2.characterId, agent2FoodSlots);

    // Restore full health
    this.restoreHealth(agent1.characterId);
    this.restoreHealth(agent2.characterId);

    // NOTE: Teleport is handled separately in startCountdown() so agents
    // appear in the arena at the exact moment the countdown begins on screen.

    Logger.info(
      "StreamingDuelScheduler",
      `Contestants prepared: ${agent1.name} vs ${agent2.name} (food=${duelFoodItemId}, levelDiff=${levelDiff})`,
    );
  }

  getBronzeWeaponPool(): string[] {
    const manifestWeapons = Array.from(ITEMS.values())
      .filter((item) => {
        if (item.type !== "weapon") return false;
        if ((item.tier ?? "").toLowerCase() !== "bronze") return false;
        if (item.equipable === false) return false;
        return item.equipSlot === "weapon" || item.equipSlot === "2h";
      })
      .map((item) => item.id);

    if (manifestWeapons.length > 0) {
      return manifestWeapons;
    }

    return [...DEFAULT_BRONZE_WEAPON_IDS];
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

  async ensureAgentHasWeapon(playerId: string): Promise<void> {
    const equipmentSystem = this.getEquipmentSystem();
    if (
      !equipmentSystem?.getPlayerEquipment ||
      !equipmentSystem.equipItemDirect
    ) {
      return;
    }

    if (this.getEquippedWeaponId(playerId)) {
      return;
    }

    const weaponPool = [...this.getBronzeWeaponPool()];
    for (let i = weaponPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weaponPool[i], weaponPool[j]] = [weaponPool[j], weaponPool[i]];
    }

    let attempted = 0;
    for (const weaponId of weaponPool) {
      if (
        equipmentSystem.canPlayerEquipItem &&
        !equipmentSystem.canPlayerEquipItem(playerId, weaponId)
      ) {
        continue;
      }

      attempted++;
      try {
        const equipResult = await equipmentSystem.equipItemDirect(
          playerId,
          weaponId,
        );
        if (!equipResult.success) {
          Logger.warn(
            "StreamingDuelScheduler",
            `Failed to auto-equip ${weaponId} for ${playerId}: ${equipResult.error ?? "unknown error"}`,
          );
          continue;
        }

        Logger.info(
          "StreamingDuelScheduler",
          `Auto-equipped ${weaponId} for unarmed contestant ${playerId}`,
        );
        return;
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Error auto-equipping ${weaponId} for ${playerId}: ${errMsg(err)}`,
        );
      }
    }

    Logger.warn(
      "StreamingDuelScheduler",
      attempted > 0
        ? `Cannot auto-equip a bronze weapon for ${playerId}: all ${attempted} attempt(s) failed`
        : `Cannot auto-equip a bronze weapon for ${playerId}: no equipable option found`,
    );
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
    const arenaId = Math.max(
      1,
      Math.min(STREAMING_AGENT_ARENA_ID, arenaConfig.arenaCount),
    );
    const row = Math.floor((arenaId - 1) / arenaConfig.columns);
    const col = (arenaId - 1) % arenaConfig.columns;
    const arenaCenterX =
      arenaConfig.baseX +
      col * (arenaConfig.arenaWidth + arenaConfig.arenaGap) +
      arenaConfig.arenaWidth / 2;
    const arenaCenterZ =
      arenaConfig.baseZ +
      row * (arenaConfig.arenaLength + arenaConfig.arenaGap) +
      arenaConfig.arenaLength / 2;
    const centerTileX = Math.floor(arenaCenterX);
    const centerTileZ = Math.floor(arenaCenterZ);

    const agent1X = centerTileX + 0.5;
    const agent1Z = centerTileZ - 0.5;
    const agent2X = centerTileX + 0.5;
    const agent2Z = centerTileZ + 0.5;

    // Agent 1 spawns north (negative Z)
    const agent1Pos: [number, number, number] = [
      agent1X,
      this.getGroundedY(agent1X, agent1Z, arenaConfig.baseY),
      agent1Z,
    ];

    // Agent 2 spawns south (positive Z)
    const agent2Pos: [number, number, number] = [
      agent2X,
      this.getGroundedY(agent2X, agent2Z, arenaConfig.baseY),
      agent2Z,
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

    // Keep post-duel restores near the duel lobby area to avoid origin/out-of-map
    // drift from stale respawn state or invalid legacy coordinates.
    const lobby = getDuelArenaConfig().lobbySpawnPoint;
    const distanceFromLobby = Math.hypot(x - lobby.x, z - lobby.z);
    if (distanceFromLobby > 120) {
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

    // Emit fight start
    this.world.emit("streaming:fight:start", {
      cycleId: cycle.cycleId,
      agent1Id: agent1?.characterId,
      agent2Id: agent2?.characterId,
      duration:
        STREAMING_TIMING.FIGHTING_DURATION +
        STREAMING_TIMING.END_WARNING_DURATION,
    });

    // Make agents attack each other
    this.initiateAgentCombat();

    // Start DuelCombatAI for each agent (tick-based heal/buff/attack decisions)
    this.startCombatAIs().catch((err) => {
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to start combat AIs: ${errMsg(err)}`,
      );
    });
  }

  /**
   * Start DuelCombatAI instances for both agents.
   * These run alongside the re-engagement loop and handle food eating,
   * potion usage, and combat phase awareness (opening, trading, finishing).
   */
  async startCombatAIs(): Promise<void> {
    this.stopCombatAIs();

    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const combatAiEnabled =
      (process.env.STREAMING_DUEL_COMBAT_AI_ENABLED || "true")
        .toLowerCase()
        .trim() !== "false";
    if (!combatAiEnabled) {
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

    const service1 = manager?.getAgentService(agent1.characterId) ?? null;
    const service2 = manager?.getAgentService(agent2.characterId) ?? null;
    const runtime1 = getAgentRuntimeByCharacterId(agent1.characterId);
    const runtime2 = getAgentRuntimeByCharacterId(agent2.characterId);

    if (service1) {
      const ai1 = new DuelCombatAI(
        service1,
        agent2.characterId,
        { useLlmTactics: llmTacticsEnabled && !!runtime1 },
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
        `Combat AI started for ${agent1.name} (${llmTacticsEnabled && !!runtime1 ? "LLM strategy enabled" : "scripted strategy"})`,
      );
    }

    if (service2) {
      const ai2 = new DuelCombatAI(
        service2,
        agent1.characterId,
        { useLlmTactics: llmTacticsEnabled && !!runtime2 },
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
        `Combat AI started for ${agent2.name} (${llmTacticsEnabled && !!runtime2 ? "LLM strategy enabled" : "scripted strategy"})`,
      );
    }
  }

  /** Stop all DuelCombatAI instances and log their stats */
  stopCombatAIs(): void {
    for (const [characterId, ai] of this.combatAIs) {
      const stats = ai.getStats();
      Logger.info(
        "StreamingDuelScheduler",
        `Combat AI stats for ${characterId}: ${stats.attacksLanded} attacks, ${stats.healsUsed} heals, ${stats.totalDamageDealt} dmg dealt`,
      );
      ai.stop();
    }
    this.combatAIs.clear();
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

    // Set combat targets on entities directly as backup
    this.setAgentCombatTarget(agent1.characterId, agent2.characterId);
    this.setAgentCombatTarget(agent2.characterId, agent1.characterId);

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

  scheduleCombatRetryIfNeeded(agent1Id: string, agent2Id: string): void {
    this.clearCombatRetryTimeout();
    this.combatRetryTimeout = setTimeout(() => {
      this.combatRetryTimeout = null;
      const cycle = this.getCurrentCycle();
      if (!cycle || cycle.phase !== "FIGHTING") return;

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

      const inCombat1 =
        combatSystem?.isInCombat?.(agent1Id) ||
        (entity1 && (entity1.data as AgentCombatData).inCombat === true);
      const inCombat2 =
        combatSystem?.isInCombat?.(agent2Id) ||
        (entity2 && (entity2.data as AgentCombatData).inCombat === true);

      if (inCombat1 || inCombat2) return; // At least one agent engaged, OK.

      Logger.warn(
        "StreamingDuelScheduler",
        "Combat retry: neither agent in combat after 1.5s, re-teleporting and retrying",
      );

      // Re-teleport to fix spacing, then retry combat
      this.ensureDuelProximity(agent1Id, agent2Id);

      if (combatSystem?.startCombat) {
        combatSystem.startCombat(agent1Id, agent2Id, {
          attackerType: "player",
          targetType: "player",
        });
        const cycleAfterRetry = this.getCurrentCycle();
        if (cycleAfterRetry?.phase === "FIGHTING") {
          combatSystem.startCombat(agent2Id, agent1Id, {
            attackerType: "player",
            targetType: "player",
          });
        }
      }

      this.setAgentCombatTarget(agent1Id, agent2Id);
      this.setAgentCombatTarget(agent2Id, agent1Id);
    }, 1500);
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

    const tileAx = Math.floor(ax);
    const tileAz = Math.floor(az);
    const tileBx = Math.floor(bx);
    const tileBz = Math.floor(bz);
    return Math.max(Math.abs(tileAx - tileBx), Math.abs(tileAz - tileBz));
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
        options?: { attackerType?: string; targetType?: string },
      ) => boolean;
    } | null;

    if (!combatSystem?.startCombat) {
      Logger.warn(
        "StreamingDuelScheduler",
        "Combat system not available or missing startCombat method",
      );
      return;
    }

    this.ensureDuelProximity(agent1Id, agent2Id);

    const started1 = combatSystem.startCombat(agent1Id, agent2Id, {
      attackerType: "player",
      targetType: "player",
    });
    if (!started1) {
      this.logCombatStartFailure(agent1Id, agent2Id, "a1");
    }

    // First attack may have ended the duel; do not allow stale follow-up hit.
    const cycle = this.getCurrentCycle();
    if (!cycle || cycle.phase !== "FIGHTING") {
      return;
    }

    const started2 = combatSystem.startCombat(agent2Id, agent1Id, {
      attackerType: "player",
      targetType: "player",
    });
    if (!started2) {
      this.logCombatStartFailure(agent2Id, agent1Id, "a2");
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

  updateContestantHp(): void {
    const cycle = this.getCurrentCycle();
    if (!cycle?.agent1 || !cycle?.agent2) return;

    const entity1 = this.world.entities.get(cycle.agent1.characterId);
    const entity2 = this.world.entities.get(cycle.agent2.characterId);

    if (entity1) {
      const data = entity1.data as { health?: number; maxHealth?: number };
      cycle.agent1.currentHp = data.health || 0;
      cycle.agent1.maxHp = data.maxHealth || 10;
    }

    if (entity2) {
      const data = entity2.data as { health?: number; maxHealth?: number };
      cycle.agent2.currentHp = data.health || 0;
      cycle.agent2.maxHp = data.maxHealth || 10;
    }
  }

  applyCombatStallNudge(now: number): void {
    const cycle = this.getCurrentCycle();
    if (!cycle || cycle.phase !== "FIGHTING") return;
    if (this.lastCombatStallNudgeCycleId === cycle.cycleId) return;

    const { agent1, agent2 } = cycle;
    if (!agent1 || !agent2) return;

    const hasCombatEvidence =
      agent1.currentHp < agent1.maxHp ||
      agent2.currentHp < agent2.maxHp ||
      agent1.damageDealtThisFight > 0 ||
      agent2.damageDealtThisFight > 0;
    if (hasCombatEvidence) return;

    const attackerId = agent1.characterId;
    const targetId = agent2.characterId;
    const targetEntity = this.world.entities.get(targetId);
    if (!targetEntity) return;

    const currentHp = Number((targetEntity.data as { health?: number }).health);
    const safeCurrentHp = Number.isFinite(currentHp)
      ? currentHp
      : agent2.currentHp;
    const nextHp = Math.max(1, safeCurrentHp - 1);
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

    this.lastCombatStallNudgeCycleId = cycle.cycleId;
    Logger.warn(
      "StreamingDuelScheduler",
      `Applied fallback combat nudge (${attackerId} -> ${targetId}, damage=${damage})`,
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
        // True draw - agent1 wins by coin flip
        winnerId =
          Math.random() > 0.5 ? agent1.characterId : agent2.characterId;
        loserId =
          winnerId === agent1.characterId
            ? agent2.characterId
            : agent1.characterId;
        winReason = "draw";
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

    // Trigger victory emote on winner (waving both hands celebration)
    this.triggerVictoryEmote(winnerId);

    // Fire a victory trash talk message from the winner
    this.fireVictoryTrashTalk(winnerId);

    // Notify the facade to handle resolution (phase transition, stats, recording, camera)
    this.onResolution(winnerId, loserId, winReason);
  }

  /**
   * Trigger victory emote on the winning agent.
   * Broadcasts entityModified with "victory" emote so clients play the celebration animation.
   */
  triggerVictoryEmote(winnerId: string): void {
    const network = this.world.network as NetworkWithSend | undefined;
    if (!network?.send) return;

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

    // Remove duel food from inventory (Fix O — parallel removal)
    await Promise.all([
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
    this.teleportPlayer(
      agent1.characterId,
      agent1RestorePosition,
      undefined,
      true,
    );
    this.stopCombat(agent1.characterId);

    const agent2RestorePosition = this.sanitizeRestorePosition(
      agent2.originalPosition,
      agent2.characterId,
    );
    this.teleportPlayer(
      agent2.characterId,
      agent2RestorePosition,
      undefined,
      true,
    );
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
    const entity = this.world.entities.get(playerId);
    if (!entity) return;

    entity.data.combatTarget = null;
    entity.data.inCombat = false;
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
    this.stopCombatAIs();
    this.duelFoodSlotsByAgent.clear();
    this.lastCombatStallNudgeCycleId = null;
    this.combatLoopTickCount = 0;
  }
}
