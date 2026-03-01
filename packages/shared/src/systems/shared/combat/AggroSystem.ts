/**
 * Aggression System
 * Handles mob AI, aggression detection, and chase mechanics per GDD specifications
 * - Mob aggression based on player level and mob type
 * - Detection ranges and line-of-sight
 * - Chase mechanics with leashing
 * - Different mob behaviors (passive, aggressive, special cases)
 */

import { World } from "../../../core/World";
import { EventType } from "../../../types/events";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { AggroTarget, Position3D, MobAIStateData } from "../../../types";
import { calculateDistance } from "../../../utils/game/EntityUtils";
import {
  calculateCombatLevel,
  normalizeCombatSkills,
  shouldMobIgnorePlayer,
} from "../../../utils/game/CombatLevelCalculator";
import { SystemBase } from "../infrastructure/SystemBase";
import {
  TICK_DURATION_MS,
  worldToTile,
  type TileCoord,
} from "../movement/TileSystem";
import type { Entity } from "../../../entities/Entity";
import {
  NetworkingComputeContext,
  isNetworkingComputeAvailable,
  type GPUMobData,
  type GPUPlayerPosition,
} from "../../../utils/compute";
import type { ZoneDetectionSystem } from "../death/ZoneDetectionSystem";

/**
 * Tolerance state for a player in a region
 * In OSRS, aggressive mobs stop attacking after player has been in a 21x21 region for 10 minutes
 *
 * @see https://oldschool.runescape.wiki/w/Aggression#Tolerance
 */
interface ToleranceState {
  /** Region identifier (21x21 tile zone) */
  regionId: string;
  /** Tick when player entered this region */
  enteredTick: number;
  /** Tick when tolerance expires (player becomes immune to aggression) */
  toleranceExpiredTick: number;
}

/** Tolerance timer duration: 1000 ticks = 10 minutes at 600ms/tick */
const TOLERANCE_TICKS = 1000;

/** Tolerance region size in tiles (OSRS uses 21x21 regions) */
const TOLERANCE_REGION_SIZE = 21;

/**
 * Aggression System - GDD Compliant
 * Implements mob AI and aggression mechanics per GDD specifications:
 * - Level-based aggression (low-level aggressive mobs ignore high-level players)
 * - Special cases (Dark Warriors always aggressive regardless of level)
 * - Detection ranges and chase mechanics
 * - Leashing to prevent mobs from going too far from spawn
 * - Multiple target management
 */
export class AggroSystem extends SystemBase {
  private mobStates = new Map<string, MobAIStateData>();
  private playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();

  /**
   * Tolerance tracking for players per region
   * Key: playerId, Value: tolerance state
   */
  private playerTolerance = new Map<string, ToleranceState>();

  /**
   * Reverse index: regionId -> Set of playerIds in that region
   * Used for O(1) spatial lookups instead of O(P) iteration over all players
   * Updated alongside playerTolerance for consistency
   */
  private playersByRegion = new Map<string, Set<string>>();

  /**
   * Current server tick (updated on each AI tick)
   */
  private currentTick = 0;

  /** Cached combat levels (invalidated on skill change) */
  private combatLevelCache = new Map<string, number>();

  /** EntityManager for spatial queries */
  private entityManager?: import("../entities/EntityManager").EntityManager;

  /** GPU compute context for batch aggro checks (server-side) */
  private networkingCompute: NetworkingComputeContext | null = null;
  private gpuComputeAvailable = false;

  /**
   * Pre-allocated arrays for spatial queries (avoid GC pressure)
   * Max expected players in a 2x2 region grid is bounded by server capacity
   */
  private readonly _nearbyPlayerIdsBuffer: string[] = [];
  private readonly _nearbyPlayersBuffer: Entity[] = [];

  /** Zone detection system for safe zone checks */
  private zoneDetectionSystem?: ZoneDetectionSystem;

  constructor(world: World) {
    super(world, {
      name: "aggro",
      dependencies: {
        required: [], // Aggro system can work independently
        optional: [
          "mob-npc",
          "player",
          "combat",
          "entity-manager",
          "zone-detection",
        ],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Cache EntityManager for spatial queries (avoid getSystem() in hot paths)
    this.entityManager =
      this.world.getSystem<import("../entities/EntityManager").EntityManager>(
        "entity-manager",
      );

    // Cache ZoneDetectionSystem for safe zone checks
    this.zoneDetectionSystem =
      this.world.getSystem<ZoneDetectionSystem>("zone-detection");

    // Set up type-safe event subscriptions for aggro mechanics
    this.subscribe(
      EventType.MOB_NPC_SPAWNED,
      (data: {
        mobId: string;
        mobType: string;
        position: { x: number; y: number; z: number };
      }) => {
        this.registerMob({
          id: data.mobId,
          type: data.mobType,
          level: 1,
          position: data.position,
        });
      },
    );
    this.subscribe(EventType.MOB_NPC_DESPAWN, (data: { mobId: string }) => {
      this.unregisterMob(data.mobId);
    });
    this.subscribe(
      EventType.PLAYER_POSITION_UPDATED,
      (data: { playerId: string; position: Position3D }) => {
        this.updatePlayerPosition({
          entityId: data.playerId,
          position: data.position,
        });
      },
    );
    this.subscribe(
      EventType.COMBAT_STARTED,
      (data: { attackerId: string; targetId: string }) => {
        this.onCombatStarted({
          attackerId: data.attackerId,
          targetId: data.targetId,
        });
      },
    );
    this.subscribe(
      EventType.MOB_NPC_POSITION_UPDATED,
      (data: { mobId: string; position: Position3D }) => {
        this.updateMobPosition({
          entityId: data.mobId,
          position: data.position,
        });
      },
    );
    this.subscribe(
      EventType.PLAYER_LEVEL_CHANGED,
      (data: {
        playerId: string;
        skill:
          | "attack"
          | "strength"
          | "defense"
          | "constitution"
          | "ranged"
          | "woodcutting"
          | "fishing"
          | "firemaking"
          | "cooking";
        newLevel: number;
        oldLevel: number;
      }) => {
        this.checkAggroUpdates({
          playerId: data.playerId,
          oldLevel: data.oldLevel,
          newLevel: data.newLevel,
          skill: data.skill,
        });
      },
    );

    // Listen to skills updates for reactive patterns
    this.subscribe(
      EventType.SKILLS_UPDATED,
      (data: {
        playerId: string;
        skills: Record<
          | "attack"
          | "strength"
          | "defense"
          | "constitution"
          | "ranged"
          | "woodcutting"
          | "fishing"
          | "firemaking"
          | "cooking",
          { level: number; xp: number }
        >;
      }) => {
        this.playerSkills.set(data.playerId, data.skills);
        // Invalidate combat level cache when skills change
        this.combatLevelCache.delete(data.playerId);
      },
    );

    // CRITICAL: Listen for player death to immediately stop all mobs chasing them
    // This prevents mobs from following dead players to spawn point
    this.subscribe(
      EventType.PLAYER_SET_DEAD,
      (data: { playerId: string; isDead: boolean }) => {
        if (data.isDead) {
          this.handlePlayerDied(data.playerId);
        }
      },
    );

    // Clean up all player data when player disconnects
    this.subscribe(EventType.PLAYER_LEFT, (data: { playerId: string }) => {
      this.removePlayerTolerance(data.playerId);
      this.removePlayerData(data.playerId);
    });

    // Listen for player respawn to clear any lingering aggro state
    this.subscribe(
      EventType.PLAYER_RESPAWNED,
      (data: {
        playerId: string;
        spawnPosition: { x: number; y: number; z: number };
      }) => {
        this.handlePlayerRespawned(data.playerId);
      },
    );
  }

  async start(): Promise<void> {
    // Initialize GPU compute for batch aggro checks (server-side only)
    if (this.world.isServer && isNetworkingComputeAvailable()) {
      this.networkingCompute = new NetworkingComputeContext({
        minAggroPairsForGPU: 500, // 50 mobs × 10 players
      });
      try {
        this.gpuComputeAvailable =
          await this.networkingCompute.initializeStandalone();
        if (this.gpuComputeAvailable) {
          console.log(
            "[AggroSystem] GPU compute initialized for batch aggro checks",
          );
        }
      } catch (error) {
        console.warn("[AggroSystem] GPU compute initialization failed:", error);
        this.gpuComputeAvailable = false;
      }
    }

    // Start AI update loop aligned to server tick (OSRS-accurate)
    this.createInterval(() => {
      this.updateMobAI();
    }, TICK_DURATION_MS); // 600ms - aligned to server tick
  }

  private registerMob(mobData: {
    id: string;
    type: string;
    level: number;
    position: { x: number; y: number; z: number };
    /** Optional combat config from manifest (aggroRange, leashRange, etc.) */
    combat?: {
      aggressive?: boolean;
      aggroRange?: number;
      leashRange?: number;
      levelIgnoreThreshold?: number;
    };
  }): void {
    // Strong type assumption - mobData.position is typed and valid from caller
    // If position is missing, that's a bug in the spawning system
    if (!mobData.position) {
      throw new Error(`[AggroSystem] Missing position for mob ${mobData.id}`);
    }

    const mobType = mobData.type.toLowerCase();

    // Use manifest values with OSRS-accurate DEFAULTS as fallback
    // This replaces the legacy MOB_BEHAVIORS lookup pattern
    const detectionRange =
      mobData.combat?.aggroRange ?? COMBAT_CONSTANTS.DEFAULTS.NPC.AGGRO_RANGE;
    const leashRange =
      mobData.combat?.leashRange ?? COMBAT_CONSTANTS.DEFAULTS.NPC.LEASH_RANGE;
    const isAggressive = mobData.combat?.aggressive ?? false;
    const levelIgnoreThreshold = mobData.combat?.levelIgnoreThreshold ?? 10;

    const aiState: MobAIStateData = {
      mobId: mobData.id,
      type: mobType,
      state: "idle",
      behavior: isAggressive ? "aggressive" : "passive",
      lastStateChange: Date.now(),
      lastAction: Date.now(),
      isPatrolling: false,
      isChasing: false,
      isInCombat: false,
      currentTarget: null,
      homePosition: {
        x: mobData.position.x || 0,
        y: mobData.position.y || 0,
        z: mobData.position.z || 0,
      },
      currentPosition: {
        x: mobData.position.x || 0,
        y: mobData.position.y || 0,
        z: mobData.position.z || 0,
      },
      detectionRange,
      leashRange,
      chaseSpeed: 3.0, // Default chase speed
      patrolRadius: 5.0, // Default patrol radius
      aggroTargets: new Map(),
      combatCooldown: 0,
      lastAttack: 0,
      levelIgnore: levelIgnoreThreshold,
      targetId: null,
      patrolPath: [],
      patrolIndex: 0,
      patrolTarget: null,
      combatTarget: null,
    };

    this.mobStates.set(mobData.id, aiState);
    this._mobStatesArrayDirty = true; // Mark array for rebuild
  }

  private unregisterMob(mobId: string): void {
    this.mobStates.delete(mobId);
    this._mobStatesArrayDirty = true; // Mark array for rebuild
  }

  private updatePlayerPosition(data: {
    entityId: string;
    position: Position3D;
  }): void {
    // OPTIMIZED: Use spatial query to find only nearby mobs instead of checking all
    // Max aggro range is typically 10-15 tiles, we search a bit wider to be safe
    const MAX_AGGRO_CHECK_RADIUS = 20; // tiles converted to world units

    if (this.entityManager) {
      // Use spatial registry to find mobs near this player
      const nearbyEntities = this.entityManager
        .getSpatialRegistry()
        .getEntitiesInRange(
          data.position.x,
          data.position.z,
          MAX_AGGRO_CHECK_RADIUS,
          "mob",
        );

      for (const result of nearbyEntities) {
        const mobState = this.mobStates.get(result.entityId);
        if (!mobState || mobState.behavior === "passive") continue;

        this.checkPlayerAggro(mobState, data.entityId, data.position);
      }
    } else {
      // Fallback: Check all mobs (legacy behavior)
      for (const [_mobId, mobState] of this.mobStates) {
        if (mobState.behavior === "passive") continue;

        this.checkPlayerAggro(mobState, data.entityId, data.position);
      }
    }
  }

  private updateMobPosition(data: {
    entityId: string;
    position: Position3D;
  }): void {
    const mobState = this.mobStates.get(data.entityId);
    if (mobState && data.position) {
      // Strong type assumption - Position3D is always valid with x, y, z numbers
      mobState.currentPosition = {
        x: data.position.x,
        y: data.position.y,
        z: data.position.z,
      };
    }
  }

  private checkPlayerAggro(
    mobState: MobAIStateData,
    playerId: string,
    playerPosition: Position3D,
  ): void {
    // Skip players still loading - they're immune to aggro until clientReady
    const playerEntity = this.world.entities.get(playerId);
    if (playerEntity?.data?.isLoading) {
      return;
    }

    // Update player's tolerance state based on their position
    // This tracks how long they've been in the current 21x21 region
    this.updatePlayerTolerance(playerId, playerPosition);

    const distance = calculateDistance(
      mobState.currentPosition,
      playerPosition,
    );

    // Check if player is within detection range
    if (distance > mobState.detectionRange) {
      // Remove from aggro if too far
      if (mobState.aggroTargets.has(playerId)) {
        mobState.aggroTargets.delete(playerId);
      }
      return;
    }

    // Check level-based aggression per GDD
    if (!this.shouldMobAggroPlayer(mobState, playerId)) {
      return;
    }

    // Update or create aggro target
    let aggroTarget = mobState.aggroTargets.get(playerId);
    if (!aggroTarget) {
      aggroTarget = {
        playerId: playerId,
        aggroLevel: 10, // Initial aggro
        lastDamageTime: Date.now(),
        lastSeen: Date.now(),
        distance: distance,
        inRange: true,
      };

      mobState.aggroTargets.set(playerId, aggroTarget);

      // Start chasing if not already in combat
      if (!mobState.isInCombat && !mobState.currentTarget) {
        this.startChasing(mobState, playerId);
      }
    } else {
      // Update existing aggro
      aggroTarget.lastSeen = Date.now();
      aggroTarget.distance = distance;
      aggroTarget.inRange = distance <= mobState.detectionRange;
    }
  }

  /**
   * Batch compute aggro targets for all aggressive mobs using GPU.
   * Returns a map of mobId -> best target playerId (or null if no valid target).
   *
   * @param mobs - Array of mob states to check
   * @param players - Array of player positions
   * @returns Map of mobId to best target player ID
   */
  private async computeBatchAggroTargetsGPU(
    mobs: MobAIStateData[],
    players: Array<{ entityId: string; x: number; z: number }>,
  ): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();

    // Check if GPU should be used
    if (
      this.gpuComputeAvailable &&
      this.networkingCompute &&
      this.networkingCompute.shouldUseGPUForAggroChecks(
        mobs.length,
        players.length,
      )
    ) {
      try {
        // Prepare GPU data
        const gpuMobs: GPUMobData[] = mobs.map((m) => ({
          x: m.currentPosition.x,
          z: m.currentPosition.z,
          aggroRangeSq: m.detectionRange * m.detectionRange,
          behavior: m.behavior === "aggressive" ? 1 : 0,
        }));

        const gpuPlayers: GPUPlayerPosition[] = players.map((p) => ({
          x: p.x,
          z: p.z,
        }));

        // GPU compute
        const aggroResults = await this.networkingCompute.computeAggroTargets(
          gpuMobs,
          gpuPlayers,
        );

        // Convert to map
        for (let i = 0; i < mobs.length; i++) {
          const mobId = mobs[i].mobId;
          const targetIdx = aggroResults[i].targetPlayerIdx;
          if (targetIdx >= 0 && targetIdx < players.length) {
            result.set(mobId, players[targetIdx].entityId);
          } else {
            result.set(mobId, null);
          }
        }

        return result;
      } catch (error) {
        console.warn(
          "[AggroSystem] GPU aggro check failed, falling back to CPU:",
          error,
        );
        // Fall through to CPU
      }
    }

    // CPU fallback - compute per-mob
    for (const mob of mobs) {
      if (mob.behavior === "passive") {
        result.set(mob.mobId, null);
        continue;
      }

      let bestTarget: string | null = null;
      let bestDistSq = Infinity;
      const rangeSq = mob.detectionRange * mob.detectionRange;

      for (const player of players) {
        const dx = player.x - mob.currentPosition.x;
        const dz = player.z - mob.currentPosition.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= rangeSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestTarget = player.entityId;
        }
      }

      result.set(mob.mobId, bestTarget);
    }

    return result;
  }

  /**
   * Check if mob should aggro a player based on level and behavior
   *
   * OSRS Rule: Mobs ignore players whose combat level is MORE THAN DOUBLE the mob's level.
   *
   * Examples:
   * - Level 2 goblin ignores level 5+ players (5 > 2*2 = 4)
   * - Level 10 guard ignores level 21+ players (21 > 10*2 = 20)
   * - Bosses (toleranceImmune) never ignore based on level
   *
   * @see https://oldschool.runescape.wiki/w/Aggression
   */
  private shouldMobAggroPlayer(
    mobState: MobAIStateData,
    playerId: string,
  ): boolean {
    // Non-aggressive mobs never aggro
    if (mobState.behavior !== "aggressive") {
      return false;
    }

    // Block aggro in safe zones - hostile mobs won't auto-aggro players there
    if (this.zoneDetectionSystem) {
      const playerEntity = this.world.entities.get(playerId);
      if (playerEntity?.node?.position) {
        const pos = playerEntity.node.position;
        if (this.zoneDetectionSystem.isSafeZone({ x: pos.x, z: pos.z })) {
          return false;
        }
      }
    }

    // Get player combat level using OSRS formula
    const playerCombatLevel = this.getPlayerCombatLevel(playerId);

    // Get mob's combat level from the entity
    const mobLevel = this.getMobCombatLevel(mobState.mobId);

    // Check if mob is tolerance-immune (bosses, special mobs)
    // Use levelIgnore from mobState (set from manifest during registration)
    // Special mobs with levelIgnoreThreshold of 999 are "toleranceImmune"
    // They always aggro regardless of player level
    const toleranceImmune = mobState.levelIgnore >= 999;

    // OSRS double-level aggro rule
    // Player level > (mob level * 2) = mob ignores player
    if (shouldMobIgnorePlayer(playerCombatLevel, mobLevel, toleranceImmune)) {
      return false;
    }

    // Check tolerance timer - after 10 minutes in region, mobs ignore player
    // Tolerance-immune mobs (bosses) skip this check
    if (!toleranceImmune && this.hasToleranceExpired(playerId)) {
      return false;
    }

    return true;
  }

  /**
   * Get mob's combat level from the entity
   * Falls back to levelIgnore from state or default of 1
   */
  private getMobCombatLevel(mobId: string): number {
    const mobEntity = this.world.entities.get(mobId) as Entity | undefined;
    if (mobEntity) {
      // Try to get level from entity property (set by MobEntity)
      const level = mobEntity.getProperty<number>("level");
      if (level !== undefined && level > 0) {
        return level;
      }
    }

    // Fallback: use the levelIgnore stored in mob state (if available)
    const mobState = this.mobStates.get(mobId);
    if (mobState && mobState.levelIgnore > 0 && mobState.levelIgnore < 999) {
      return mobState.levelIgnore;
    }

    // Default to level 1
    return 1;
  }

  /** Get player combat level (cached, invalidated on skill change) */
  private getPlayerCombatLevel(playerId: string): number {
    const cached = this.combatLevelCache.get(playerId);
    if (cached !== undefined) return cached;

    const skills = this.getPlayerSkills(playerId);
    const combatLevel = calculateCombatLevel(
      normalizeCombatSkills({
        attack: skills.attack,
        strength: skills.strength,
        defense: skills.defense,
        constitution: skills.constitution,
        ranged: skills.ranged,
        magic: skills.magic,
        prayer: skills.prayer,
      }),
    );

    this.combatLevelCache.set(playerId, combatLevel);
    return combatLevel;
  }

  /** Default skills for fresh character (OSRS level 3) */
  private static readonly DEFAULT_SKILLS = {
    attack: 1,
    strength: 1,
    defense: 1,
    constitution: 10, // Hitpoints starts at 10 in OSRS
    ranged: 1,
    magic: 1,
    prayer: 1,
  } as const;

  private getPlayerSkills(playerId: string): {
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
    ranged: number;
    magic: number;
    prayer: number;
  } {
    const skills = this.playerSkills.get(playerId);
    if (!skills) return { ...AggroSystem.DEFAULT_SKILLS };

    // Cast once for extended skill access
    const extended = skills as Record<string, { level: number } | undefined>;
    return {
      attack: skills.attack?.level ?? 1,
      strength: skills.strength?.level ?? 1,
      defense: skills.defense?.level ?? 1,
      constitution: skills.constitution?.level ?? 10,
      ranged: skills.ranged?.level ?? 1,
      magic: extended.magic?.level ?? 1,
      prayer: extended.prayer?.level ?? 1,
    };
  }

  /**
   * Update tolerance state - after 10 min in a 21x21 region, mobs stop aggro
   * @see https://oldschool.runescape.wiki/w/Aggression#Tolerance
   */
  private updatePlayerTolerance(
    playerId: string,
    playerPosition: Position3D,
  ): void {
    const tile = worldToTile(playerPosition.x, playerPosition.z);
    const regionId = this.getToleranceRegionId(tile);
    const existing = this.playerTolerance.get(playerId);

    if (!existing || existing.regionId !== regionId) {
      // Remove from old region's player set (if any)
      if (existing) {
        const oldRegionPlayers = this.playersByRegion.get(existing.regionId);
        if (oldRegionPlayers) {
          oldRegionPlayers.delete(playerId);
          // Clean up empty sets to prevent memory leaks
          if (oldRegionPlayers.size === 0) {
            this.playersByRegion.delete(existing.regionId);
          }
        }
      }

      // Add to new region's player set
      let regionPlayers = this.playersByRegion.get(regionId);
      if (!regionPlayers) {
        regionPlayers = new Set<string>();
        this.playersByRegion.set(regionId, regionPlayers);
      }
      regionPlayers.add(playerId);

      // Update tolerance state
      this.playerTolerance.set(playerId, {
        regionId,
        enteredTick: this.currentTick,
        toleranceExpiredTick: this.currentTick + TOLERANCE_TICKS,
      });
    }
  }

  /**
   * Check if player has tolerance expired in their current region
   * If expired, aggressive mobs will no longer attack them
   *
   * @param playerId - Player to check
   * @returns true if player's tolerance has expired (mobs should ignore them)
   */
  private hasToleranceExpired(playerId: string): boolean {
    const state = this.playerTolerance.get(playerId);
    if (!state) return false;

    return this.currentTick >= state.toleranceExpiredTick;
  }

  /**
   * Get tolerance region ID for a tile position
   * OSRS divides the world into 21x21 tile regions for tolerance purposes
   *
   * @param tile - Tile coordinates
   * @returns Region identifier string "x:z"
   */
  private getToleranceRegionId(tile: TileCoord): string {
    const regionX = Math.floor(tile.x / TOLERANCE_REGION_SIZE);
    const regionZ = Math.floor(tile.z / TOLERANCE_REGION_SIZE);
    return `${regionX}:${regionZ}`;
  }

  /**
   * Clean up tolerance data for a player (on disconnect)
   */
  private removePlayerTolerance(playerId: string): void {
    // Remove from region index first
    const existing = this.playerTolerance.get(playerId);
    if (existing) {
      const regionPlayers = this.playersByRegion.get(existing.regionId);
      if (regionPlayers) {
        regionPlayers.delete(playerId);
        if (regionPlayers.size === 0) {
          this.playersByRegion.delete(existing.regionId);
        }
      }
    }
    this.playerTolerance.delete(playerId);
  }

  /**
   * Clean up player-specific data (skills, combat level cache) on disconnect
   * Prevents memory leaks from accumulated player data
   */
  private removePlayerData(playerId: string): void {
    this.playerSkills.delete(playerId);
    this.combatLevelCache.delete(playerId);

    // Also clear any aggro targeting this player across all mobs
    for (const [, mobState] of this.mobStates) {
      if (mobState.currentTarget === playerId) {
        mobState.currentTarget = null;
        mobState.isChasing = false;
        mobState.isInCombat = false;
      }
      mobState.aggroTargets.delete(playerId);
    }
  }

  /**
   * Get remaining tolerance time in ticks for a player
   * Useful for debugging and UI display
   *
   * @param playerId - Player to check
   * @returns Remaining ticks until tolerance expires, or 0 if already expired
   */
  getRemainingToleranceTicks(playerId: string): number {
    const state = this.playerTolerance.get(playerId);
    if (!state) return 0;

    const remaining = state.toleranceExpiredTick - this.currentTick;
    return Math.max(0, remaining);
  }

  /**
   * Get the tolerance region ID for a world position
   * Regions are 21x21 tiles (OSRS-accurate)
   *
   * @param position - World position (x, z coordinates)
   * @returns Region identifier string "x:z"
   */
  getRegionIdForPosition(position: Position3D): string {
    const tile = worldToTile(position.x, position.z);
    return this.getToleranceRegionId(tile);
  }

  /**
   * Get all players in a 2x2 grid of regions around the given position
   * Used for O(k) spatial player lookups instead of O(P) iteration
   *
   * Queries 4 regions (2x2 grid = 42x42 tiles) for good coverage.
   * The quadrant is selected based on position within the center region.
   *
   * @param position - Center position to search around
   * @returns Array of player entities in nearby regions
   */
  getPlayersInNearbyRegions(position: Position3D): Entity[] {
    const tile = worldToTile(position.x, position.z);
    const centerRegionX = Math.floor(tile.x / TOLERANCE_REGION_SIZE);
    const centerRegionZ = Math.floor(tile.z / TOLERANCE_REGION_SIZE);

    // Determine which quadrant of the region we're in to pick the best 2x2
    // Use positive modulo to handle negative tile coordinates correctly
    // In JS, -5 % 21 = -5, but we need 16 for correct quadrant selection
    const tileInRegionX =
      ((tile.x % TOLERANCE_REGION_SIZE) + TOLERANCE_REGION_SIZE) %
      TOLERANCE_REGION_SIZE;
    const tileInRegionZ =
      ((tile.z % TOLERANCE_REGION_SIZE) + TOLERANCE_REGION_SIZE) %
      TOLERANCE_REGION_SIZE;
    const halfRegion = TOLERANCE_REGION_SIZE / 2;

    // Pick direction to extend: if in upper half, extend +1; if in lower half, extend -1
    const extendX = tileInRegionX >= halfRegion ? 1 : -1;
    const extendZ = tileInRegionZ >= halfRegion ? 1 : -1;

    // Reuse pre-allocated buffers (clear by setting length)
    const nearbyPlayerIds = this._nearbyPlayerIdsBuffer;
    nearbyPlayerIds.length = 0;

    // Query 2x2 grid of regions
    for (let dx = 0; dx !== extendX + extendX; dx += extendX) {
      for (let dz = 0; dz !== extendZ + extendZ; dz += extendZ) {
        const regionId = `${centerRegionX + dx}:${centerRegionZ + dz}`;
        const playersInRegion = this.playersByRegion.get(regionId);
        if (playersInRegion) {
          for (const playerId of playersInRegion) {
            nearbyPlayerIds.push(playerId);
          }
        }
      }
    }

    // Convert player IDs to entities (reuse buffer)
    const players = this._nearbyPlayersBuffer;
    players.length = 0;
    for (const playerId of nearbyPlayerIds) {
      const player = this.world.entities.items.get(playerId);
      if (player) {
        players.push(player);
      }
    }

    return players;
  }

  /**
   * Get count of players in nearby 2x2 region grid (for debugging/metrics)
   *
   * @param position - Center position
   * @returns Number of players in the 2x2 region grid (42x42 tiles)
   */
  getNearbyPlayerCount(position: Position3D): number {
    const tile = worldToTile(position.x, position.z);
    const centerRegionX = Math.floor(tile.x / TOLERANCE_REGION_SIZE);
    const centerRegionZ = Math.floor(tile.z / TOLERANCE_REGION_SIZE);

    // Use positive modulo for negative coordinate support
    const tileInRegionX =
      ((tile.x % TOLERANCE_REGION_SIZE) + TOLERANCE_REGION_SIZE) %
      TOLERANCE_REGION_SIZE;
    const tileInRegionZ =
      ((tile.z % TOLERANCE_REGION_SIZE) + TOLERANCE_REGION_SIZE) %
      TOLERANCE_REGION_SIZE;
    const halfRegion = TOLERANCE_REGION_SIZE / 2;

    const extendX = tileInRegionX >= halfRegion ? 1 : -1;
    const extendZ = tileInRegionZ >= halfRegion ? 1 : -1;

    let count = 0;
    for (let dx = 0; dx !== extendX + extendX; dx += extendX) {
      for (let dz = 0; dz !== extendZ + extendZ; dz += extendZ) {
        const regionId = `${centerRegionX + dx}:${centerRegionZ + dz}`;
        const playersInRegion = this.playersByRegion.get(regionId);
        if (playersInRegion) {
          count += playersInRegion.size;
        }
      }
    }

    return count;
  }

  private startChasing(mobState: MobAIStateData, playerId: string): void {
    mobState.isChasing = true;
    mobState.currentTarget = playerId;
    mobState.isPatrolling = false;

    // Emit chase event for other systems
    this.emitTypedEvent(EventType.MOB_NPC_CHASE_STARTED, {
      mobId: mobState.mobId,
      targetPlayerId: playerId,
      mobPosition: {
        x: mobState.currentPosition.x,
        y: mobState.currentPosition.y,
        z: mobState.currentPosition.z,
      },
    });

    // Start combat if close enough
    const aggroTarget = mobState.aggroTargets.get(playerId);
    if (aggroTarget && aggroTarget.distance <= 2.0) {
      // Melee range
      this.startCombatWithPlayer(mobState, playerId);
    }
  }

  private startCombatWithPlayer(
    mobState: MobAIStateData,
    playerId: string,
  ): void {
    mobState.isInCombat = true;

    // Trigger combat system
    this.emitTypedEvent(EventType.COMBAT_START_ATTACK, {
      attackerId: mobState.mobId,
      targetId: playerId,
    });
  }

  private stopChasing(mobState: MobAIStateData): void {
    if (!mobState.isChasing) return;

    const previousTarget = mobState.currentTarget;

    mobState.isChasing = false;
    mobState.currentTarget = null;
    mobState.isPatrolling = true; // Resume patrolling

    // Emit chase end event - MobEntity handles actual return-to-spawn movement
    this.emitTypedEvent(EventType.MOB_NPC_CHASE_ENDED, {
      mobId: mobState.mobId,
      targetPlayerId: previousTarget || "",
    });
  }

  // PERFORMANCE: Track rotation index for progressive mob AI updates
  private _mobAIRotationIndex = 0;
  private readonly MAX_MOB_AI_UPDATES_PER_TICK = 50;

  // OPTIMIZATION: Cached array for mob states (avoids Array.from() allocation each tick)
  private _mobStatesArray: Array<[string, MobAIStateData]> = [];
  private _mobStatesArrayDirty = true;

  private updateMobAI(): void {
    // Increment tick counter for tolerance system
    this.currentTick++;

    // OPTIMIZATION: Use cached array, only rebuild when mob states change
    if (this._mobStatesArrayDirty) {
      this._mobStatesArray.length = 0;
      for (const entry of this.mobStates.entries()) {
        this._mobStatesArray.push(entry);
      }
      this._mobStatesArrayDirty = false;
      this._mobAIRotationIndex = 0; // Reset rotation on change
    }
    const mobStatesArray = this._mobStatesArray;
    const totalMobs = mobStatesArray.length;
    if (totalMobs === 0) return;

    const frameBudget = this.world.frameBudget;
    let processed = 0;
    const maxUpdates = Math.min(this.MAX_MOB_AI_UPDATES_PER_TICK, totalMobs);

    // Start from rotation index
    const startIndex = this._mobAIRotationIndex % totalMobs;
    let i = startIndex;

    do {
      // Check frame budget periodically
      if (processed > 0 && processed % 10 === 0) {
        if (frameBudget && !frameBudget.hasTimeRemaining(1)) {
          break; // Over budget
        }
      }

      if (processed >= maxUpdates) break;

      const [_mobId, mobState] = mobStatesArray[i];

      if (!mobState.isInCombat) {
        // Strong type assumption - positions are always valid Position3D objects
        if (!mobState.currentPosition || !mobState.homePosition) {
          console.warn(
            `[AggroSystem] Missing positions for mob ${mobState.mobId}`,
          );
        } else {
          // Check leashing - if too far from home, stop chasing and return
          const homeDistance = calculateDistance(
            mobState.currentPosition,
            mobState.homePosition,
          );
          if (homeDistance > mobState.leashRange && mobState.isChasing) {
            this.stopChasing(mobState);
          } else {
            // Clean up old aggro targets
            this.cleanupAggroTargets(mobState);

            // If chasing, update chase behavior
            if (mobState.isChasing && mobState.currentTarget) {
              this.updateChasing(mobState);
            } else if (
              mobState.behavior === "aggressive" &&
              mobState.aggroTargets.size > 0
            ) {
              // Check if we should start chasing someone
              const bestTarget = this.getBestAggroTarget(mobState);
              this.startChasing(mobState, bestTarget.playerId);
            }
            // NOTE: Patrol behavior handled by MobEntity.serverUpdate()
          }
        }
      }

      processed++;
      i = (i + 1) % totalMobs;
    } while (i !== startIndex);

    // Save rotation index for next tick
    this._mobAIRotationIndex = i;
  }

  private cleanupAggroTargets(mobState: MobAIStateData): void {
    const now = Date.now();

    for (const [playerId, aggroTarget] of mobState.aggroTargets) {
      // Remove aggro if not seen for 10 seconds
      if (now - aggroTarget.lastSeen > 10000) {
        mobState.aggroTargets.delete(playerId);
      }
    }
  }

  private getBestAggroTarget(mobState: MobAIStateData): AggroTarget {
    let bestTarget!: AggroTarget;
    let highestAggro = 0;

    for (const [_playerId, aggroTarget] of mobState.aggroTargets) {
      if (aggroTarget.aggroLevel > highestAggro) {
        highestAggro = aggroTarget.aggroLevel;
        bestTarget = aggroTarget;
      }
    }

    return bestTarget;
  }

  private updateChasing(mobState: MobAIStateData): void {
    // Ensure we have a valid target
    if (!mobState.currentTarget) {
      this.stopChasing(mobState);
      return;
    }

    const player = this.world.getPlayer(mobState.currentTarget);

    // CRITICAL: Check if player exists AND is alive before chasing
    // This prevents mobs from following dead players to spawn point
    if (!player) {
      this.stopChasing(mobState);
      return;
    }

    // Check if player is dead - stop chasing dead players immediately
    // Use health check as primary death indicator (most reliable)
    const playerHealth = (player as { health?: { current?: number } }).health;
    if (
      playerHealth &&
      playerHealth.current !== undefined &&
      playerHealth.current <= 0
    ) {
      this.stopChasing(mobState);
      mobState.currentTarget = null;
      mobState.aggroTargets.delete(player.id);
      return;
    }

    // Strong type assumption - player.node.position is always Vector3
    if (!player.node?.position) {
      console.warn(`[AggroSystem] Player ${player.id} has no node`);
      this.stopChasing(mobState);
      return;
    }

    // Stop chasing if player entered a safe zone
    if (this.zoneDetectionSystem) {
      const pos = player.node.position;
      if (this.zoneDetectionSystem.isSafeZone({ x: pos.x, z: pos.z })) {
        this.stopChasing(mobState);
        mobState.aggroTargets.delete(mobState.currentTarget!);
        return;
      }
    }

    const distance = calculateDistance(
      mobState.currentPosition,
      player.node.position,
    );
    const aggroTarget = mobState.aggroTargets.get(mobState.currentTarget);

    if (!aggroTarget || distance > mobState.detectionRange * 1.5) {
      // Lost target or too far
      this.stopChasing(mobState);
      return;
    }

    // Update aggro target distance
    aggroTarget.distance = distance;
    aggroTarget.lastSeen = Date.now();

    // If close enough, start combat
    if (distance <= 2.0 && !mobState.isInCombat) {
      this.startCombatWithPlayer(mobState, mobState.currentTarget);
    }
    // NOTE: Movement handled by MobEntity.serverUpdate() which detects target and moves
  }

  private onCombatStarted(data: {
    attackerId: string;
    targetId: string;
    entityType?: string;
  }): void {
    // Handle combat session started - update mob AI state
    const mobState =
      this.mobStates.get(data.attackerId) || this.mobStates.get(data.targetId);
    if (mobState) {
      mobState.isInCombat = true;
      mobState.isChasing = false; // Stop chasing when in combat

      // If mob is the attacker, set target
      if (mobState.mobId === data.attackerId) {
        mobState.currentTarget = data.targetId;
      }
    }
  }

  private onCombatEnded(data: {
    attackerId: string;
    targetId: string;
    reason?: string;
  }): void {
    // Handle combat session ended - update mob AI state
    const mobState =
      this.mobStates.get(data.attackerId) || this.mobStates.get(data.targetId);
    if (mobState) {
      mobState.isInCombat = false;

      // Clear target if combat ended
      if (data.reason === "death" || data.reason === "flee") {
        mobState.currentTarget = null;
        mobState.aggroTargets.clear();
      }
    }
  }

  /**
   * Handle player death - immediately stop all mobs from chasing/targeting them
   *
   * This is critical for death/respawn behavior:
   * - Mobs should stop chasing the moment a player dies
   * - Mobs should return to patrol/spawn rather than following to respawn point
   * - All aggro towards the dead player should be cleared
   */
  private handlePlayerDied(playerId: string): void {
    for (const [_mobId, mobState] of this.mobStates) {
      // Check if this mob was targeting the dead player
      if (mobState.currentTarget === playerId) {
        // Stop chasing
        mobState.isChasing = false;
        mobState.currentTarget = null;
        mobState.isInCombat = false;
      }

      // Remove from aggro targets
      if (mobState.aggroTargets.has(playerId)) {
        mobState.aggroTargets.delete(playerId);
      }
    }
  }

  /**
   * Handle player respawn - clear any lingering aggro state
   *
   * Safety net to ensure respawned players start fresh:
   * - No mobs should be targeting them from before death
   * - They should be able to move freely at spawn point
   */
  private handlePlayerRespawned(playerId: string): void {
    let staleAggro = 0;

    for (const [_mobId, mobState] of this.mobStates) {
      // Clear any stale targeting (shouldn't exist, but safety net)
      if (mobState.currentTarget === playerId) {
        mobState.currentTarget = null;
        mobState.isChasing = false;
        mobState.isInCombat = false;
        staleAggro++;
      }

      // Clear from aggro targets
      if (mobState.aggroTargets.has(playerId)) {
        mobState.aggroTargets.delete(playerId);
        staleAggro++;
      }
    }

    if (staleAggro > 0) {
      this.logger.warn(
        `[AggroSystem] Cleared ${staleAggro} stale aggro entries for respawned player ${playerId}`,
      );
    }
  }

  private shouldIgnorePlayer(
    mobState: MobAIStateData,
    playerCombatLevel: number,
  ): boolean {
    // Check if mob should ignore player based on level (GDD requirement)
    // Use levelIgnore from mobState (set from manifest during registration)
    const levelIgnoreThreshold = mobState.levelIgnore;

    // Check level-based aggression per GDD
    if (playerCombatLevel > levelIgnoreThreshold) {
      // Player is too high level, mob ignores them (except special cases)
      if (levelIgnoreThreshold < 999) {
        // Special cases like Dark Warriors have levelIgnoreThreshold: 999
        return true; // Should ignore this player
      }
    }

    return false; // Should not ignore this player
  }

  private checkAggroUpdates(data: {
    playerId: string;
    oldLevel: number;
    newLevel: number;
    skill?: string;
  }): void {
    // Handle player level changes - update aggro status for all mobs
    // Per GDD: low-level aggressive mobs should ignore high-level players
    const playerId = data.playerId;
    const newLevel = data.newLevel;

    // Check all mobs for aggro changes
    for (const [_mobId, mobState] of this.mobStates) {
      if (mobState.behavior === "passive") continue;

      const aggroTarget = mobState.aggroTargets.get(playerId);
      if (aggroTarget) {
        // Re-evaluate aggro based on new level
        const shouldIgnore = this.shouldIgnorePlayer(mobState, newLevel);
        if (shouldIgnore && mobState.currentTarget === playerId) {
          // Stop targeting this player
          this.stopChasing(mobState);
          mobState.aggroTargets.delete(playerId);
        }
      }
    }
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all mob states and aggro data
    this.mobStates.clear();
    this._mobStatesArray.length = 0;
    this._mobStatesArrayDirty = true;

    // Clear combat level cache
    this.combatLevelCache.clear();

    // Clear player tolerance data
    this.playerTolerance.clear();
    this.playersByRegion.clear();

    // Clear cached skills
    this.playerSkills.clear();

    // Cleanup GPU compute context
    if (this.networkingCompute) {
      this.networkingCompute.destroy();
      this.networkingCompute = null;
      this.gpuComputeAvailable = false;
    }

    // Call parent cleanup (automatically handles interval cleanup)
    super.destroy();
  }
}
