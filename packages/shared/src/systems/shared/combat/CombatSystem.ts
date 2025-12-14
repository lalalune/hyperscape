/**
 * CombatSystem - Handles all combat mechanics
 */

import { EventType } from "../../../types/events";
import type { World } from "../../../core/World";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { AttackType, MobInstance } from "../../../types/core/core";
import { EntityID } from "../../../types/core/identifiers";
import { MobEntity } from "../../../entities/npc/MobEntity";
import { MobAIState } from "../../../types/entities";
import { Entity } from "../../../entities/Entity";
import { PlayerSystem } from "..";
import {
  calculateDamage,
  calculateDistance2D,
  calculateDistance3D,
  CombatStats,
  isAttackOnCooldown,
  isAttackOnCooldownTicks,
  calculateRetaliationDelay,
  attackSpeedSecondsToTicks,
  attackSpeedMsToTicks,
} from "../../../utils/game/CombatCalculations";
import { createEntityID } from "../../../utils/IdentifierUtils";
import { EntityManager } from "..";
import { MobNPCSystem } from "..";
import { SystemBase } from "..";
import { Emotes } from "../../../data/playerEmotes";
import { getItem } from "../../../data/items";
import { tilesWithinMeleeRange } from "../movement/TileSystem";
import { tilePool, PooledTile } from "../../../utils/pools/TilePool";
import { CombatAnimationManager } from "./CombatAnimationManager";
import { CombatRotationManager } from "./CombatRotationManager";
import { CombatStateService, CombatData } from "./CombatStateService";
import {
  CombatAntiCheat,
  CombatViolationType,
  CombatViolationSeverity,
} from "./CombatAntiCheat";
import { getEntityPosition } from "../../../utils/game/EntityPositionUtils";
import { quaternionPool } from "../../../utils/pools/QuaternionPool";
import { EntityIdValidator } from "./EntityIdValidator";
import { CombatRateLimiter } from "./CombatRateLimiter";

// Re-export CombatData from CombatStateService for backwards compatibility
export type { CombatData } from "./CombatStateService";

/**
 * Interface for player entity properties accessed by CombatSystem
 * Uses abbreviated keys for network bandwidth efficiency:
 * - c = inCombat, ct = combatTarget, e = emote
 */
interface CombatPlayerEntity {
  id: string;
  combat?: {
    inCombat: boolean;
    combatTarget: string | null;
  };
  data?: {
    c?: boolean; // inCombat (abbreviated)
    ct?: string | null; // combatTarget (abbreviated)
    e?: string; // emote (abbreviated)
    isLoading?: boolean;
  };
  emote?: string;
  base?: {
    quaternion: { set(x: number, y: number, z: number, w: number): void };
  };
  node?: {
    quaternion: {
      set(x: number, y: number, z: number, w: number): void;
      copy(q: { x: number; y: number; z: number; w: number }): void;
    };
  };
  position?: { x: number; y: number; z: number };
  getPosition?: () => { x: number; y: number; z: number };
  markNetworkDirty?: () => void;
  health?: number;
  name?: string;
}

/**
 * Interface for mob entity with optional setServerEmote method
 * Used for type-safe emote setting in combat
 */
interface MobWithServerEmote {
  setServerEmote?: (emote: string) => void;
}

/**
 * Attack data structure for validation and execution
 */
interface MeleeAttackData {
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
}

/**
 * Result of attack validation
 * Contains validated entities if successful, or null if validation failed
 */
interface AttackValidationResult {
  valid: boolean;
  attacker: Entity | MobEntity | null;
  target: Entity | MobEntity | null;
  typedAttackerId: EntityID | null;
  typedTargetId: EntityID | null;
}

export class CombatSystem extends SystemBase {
  private nextAttackTicks = new Map<EntityID, number>(); // Tick when entity can next attack
  private mobSystem?: MobNPCSystem;
  private entityManager?: EntityManager;

  // Modular services (Phase 5 extraction)
  private stateService: CombatStateService;
  private animationManager: CombatAnimationManager;
  private rotationManager: CombatRotationManager;

  // Anti-cheat monitoring (Phase 6 - Game Studio Hardening)
  private antiCheat: CombatAntiCheat;

  // Input validation and rate limiting (Phase 6.5 - Security Hardening)
  private entityIdValidator: EntityIdValidator;
  private rateLimiter: CombatRateLimiter;

  // Equipment stats cache per player for damage calculations
  private playerEquipmentStats = new Map<
    string,
    { attack: number; strength: number; defense: number; ranged: number }
  >();

  // Pre-allocated pooled tiles for hot path calculations (zero GC)
  private readonly _attackerTile: PooledTile = tilePool.acquire();
  private readonly _targetTile: PooledTile = tilePool.acquire();

  constructor(world: World) {
    super(world, {
      name: "combat",
      dependencies: {
        required: ["entity-manager"], // Combat needs entity manager
        optional: ["mob-npc"], // Combat can work without mob NPCs but better with them
      },
      autoCleanup: true,
    });

    // Initialize modular services
    this.stateService = new CombatStateService(world);
    this.animationManager = new CombatAnimationManager(world);
    this.rotationManager = new CombatRotationManager(world);

    // Initialize anti-cheat monitoring (Phase 6 - Game Studio Hardening)
    this.antiCheat = new CombatAntiCheat();

    // Initialize input validation and rate limiting (Phase 6.5 - Security Hardening)
    this.entityIdValidator = new EntityIdValidator();
    this.rateLimiter = new CombatRateLimiter();
  }

  async init(): Promise<void> {
    // Get entity manager - required dependency
    this.entityManager = this.world.getSystem<EntityManager>("entity-manager");
    if (!this.entityManager) {
      throw new Error(
        "[CombatSystem] EntityManager not found - required dependency",
      );
    }

    // Get mob NPC system - optional but recommended
    this.mobSystem = this.world.getSystem<MobNPCSystem>("mob-npc");

    // Set up event listeners - required for combat to function
    this.subscribe(
      EventType.COMBAT_ATTACK_REQUEST,
      (data: {
        playerId: string;
        targetId: string;
        attackType?: AttackType;
      }) => {
        this.handleAttack({
          attackerId: data.playerId,
          targetId: data.targetId,
          attackerType: "player",
          targetType: "mob",
          attackType: data.attackType || AttackType.MELEE,
        });
      },
    );
    this.subscribe<{
      attackerId: string;
      targetId: string;
      attackerType: "player" | "mob";
      targetType: "player" | "mob";
    }>(EventType.COMBAT_MELEE_ATTACK, (data) => {
      this.handleMeleeAttack(data);
    });
    // MVP: Ranged combat subscription removed - melee only
    this.subscribe(
      EventType.COMBAT_MOB_NPC_ATTACK,
      (data: { mobId: string; targetId: string }) => {
        this.handleMobAttack(data);
      },
    );

    // Listen for death events to end combat
    this.subscribe(EventType.NPC_DIED, (data: { mobId: string }) => {
      this.handleEntityDied(data.mobId, "mob");
    });
    this.subscribe(EventType.PLAYER_DIED, (data: { playerId: string }) => {
      this.handleEntityDied(data.playerId, "player");
    });
    // Also listen for ENTITY_DEATH to catch all entity destructions
    this.subscribe(
      EventType.ENTITY_DEATH,
      (data: { entityId: string; entityType: string }) => {
        this.handleEntityDied(data.entityId, data.entityType);
      },
    );

    // Listen for player disconnect to clean up combat state
    // This prevents orphaned combat states when players disconnect mid-combat
    this.subscribe(EventType.PLAYER_LEFT, (data: { playerId: string }) => {
      this.cleanupPlayerDisconnect(data.playerId);
    });

    // Listen for explicit combat stop requests (e.g., player clicking new target)
    this.subscribe(
      EventType.COMBAT_STOP_ATTACK,
      (data: { attackerId: string }) => {
        if (this.stateService.isInCombat(data.attackerId)) {
          this.logger.info("Stopping combat for target switch", {
            attackerId: data.attackerId,
          });
          this.forceEndCombat(data.attackerId);
        }
      },
    );

    // Issue #342: Listen for combat follow events to initiate player movement toward target
    this.subscribe(
      EventType.COMBAT_FOLLOW_TARGET,
      (data: {
        playerId: string;
        targetId: string;
        targetPosition: { x: number; y: number; z: number };
      }) => {
        this.handleCombatFollow(data);
      },
    );

    // Listen for equipment stats updates to use bonuses in damage calculation
    this.subscribe(
      EventType.PLAYER_STATS_EQUIPMENT_UPDATED,
      (data: {
        playerId: string;
        equipmentStats: {
          attack: number;
          strength: number;
          defense: number;
          ranged: number;
        };
      }) => {
        this.playerEquipmentStats.set(data.playerId, data.equipmentStats);
      },
    );
  }

  private handleAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    attackType?: AttackType;
  }): void {
    // MVP: All attacks are melee
    this.handleMeleeAttack(data);
  }

  /**
   * Main melee attack handler - orchestrates validation and execution
   * Refactored for clarity: validation logic extracted to validateMeleeAttack(),
   * execution logic extracted to executeMeleeAttack()
   */
  private handleMeleeAttack(data: MeleeAttackData): void {
    const { attackerId, targetId, attackerType } = data;
    const currentTick = this.world.currentTick;

    // Phase 6.5: Input validation - reject malformed entity IDs
    if (!this.entityIdValidator.isValid(attackerId)) {
      const sanitized = this.entityIdValidator.sanitizeForLogging(attackerId);
      this.logger.warn("Invalid attacker ID rejected", {
        attackerId: sanitized,
        reason: "invalid_format",
      });
      this.antiCheat.recordInvalidEntityId(
        String(attackerId).slice(0, 64),
        String(attackerId),
      );
      return;
    }

    if (!this.entityIdValidator.isValid(targetId)) {
      const sanitized = this.entityIdValidator.sanitizeForLogging(targetId);
      this.logger.warn("Invalid target ID rejected", {
        attackerId,
        targetId: sanitized,
        reason: "invalid_format",
      });
      this.antiCheat.recordInvalidEntityId(attackerId, String(targetId));
      return;
    }

    // Phase 6.5: Rate limiting - prevent request flooding
    if (attackerType === "player") {
      const rateResult = this.rateLimiter.checkLimit(attackerId, currentTick);
      if (!rateResult.allowed) {
        this.logger.warn("Attack rate limited", {
          attackerId,
          reason: rateResult.reason,
          cooldownUntil: rateResult.cooldownUntil,
        });
        return;
      }
    }

    // Anti-cheat: Track attack rate for players (Phase 6)
    if (attackerType === "player") {
      this.antiCheat.trackAttack(attackerId, currentTick);
    }

    // Validate the attack (entities exist, alive, in range, etc.)
    const validation = this.validateMeleeAttack(data, currentTick);
    if (!validation.valid) {
      return;
    }

    // Check cooldown before executing
    if (!this.checkAttackCooldown(validation.typedAttackerId!, currentTick)) {
      return;
    }

    // Execute the attack
    this.executeMeleeAttack(data, validation, currentTick);
  }

  /**
   * Validate all preconditions for a melee attack
   * Returns validation result with entities if valid
   */
  private validateMeleeAttack(
    data: MeleeAttackData,
    currentTick: number,
  ): AttackValidationResult {
    const { attackerId, targetId, attackerType, targetType } = data;
    const invalidResult: AttackValidationResult = {
      valid: false,
      attacker: null,
      target: null,
      typedAttackerId: null,
      typedTargetId: null,
    };

    // Convert IDs to typed IDs
    const typedAttackerId = createEntityID(attackerId);
    const typedTargetId = createEntityID(targetId);

    // Get attacker and target entities
    const attacker = this.getEntity(attackerId, attackerType);
    const target = this.getEntity(targetId, targetType);

    // Check entities exist
    if (!attacker || !target) {
      if (attackerType === "player" && !target) {
        this.antiCheat.recordNonexistentTargetAttack(
          attackerId,
          targetId,
          currentTick,
        );
      }
      return invalidResult;
    }

    // Check attacker is alive
    if (!this.isEntityAlive(attacker, attackerType)) {
      return invalidResult;
    }

    // Check target is alive (Issue #265)
    if (!this.isEntityAlive(target, targetType)) {
      if (attackerType === "player") {
        this.antiCheat.recordDeadTargetAttack(
          attackerId,
          targetId,
          currentTick,
        );
      }
      return invalidResult;
    }

    // Check target not in loading protection (Issue #356)
    if (targetType === "player" && target.data?.isLoading) {
      if (attackerType === "player") {
        this.antiCheat.recordViolation(
          attackerId,
          CombatViolationType.ATTACK_DURING_PROTECTION,
          CombatViolationSeverity.MODERATE,
          `Attacked player ${targetId} during loading protection`,
          targetId,
          currentTick,
        );
      }
      return invalidResult;
    }

    // Check target is attackable (for mobs)
    if (targetType === "mob") {
      const mobEntity = target as MobEntity;
      if (mobEntity.isAttackable && !mobEntity.isAttackable()) {
        this.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
          attackerId,
          targetId,
          reason: "target_not_attackable",
        });
        return invalidResult;
      }
    }

    // Check not self-attack
    if (attackerId === targetId) {
      if (attackerType === "player") {
        this.antiCheat.recordSelfAttack(attackerId, currentTick);
      }
      return invalidResult;
    }

    // Check range
    if (
      !this.isWithinCombatRange(
        attacker,
        target,
        attackerType,
        data,
        currentTick,
      )
    ) {
      return invalidResult;
    }

    return {
      valid: true,
      attacker,
      target,
      typedAttackerId,
      typedTargetId,
    };
  }

  /**
   * Check if attacker is within combat range of target
   *
   * OSRS melee rules (from wiki):
   * - Range 1 (standard melee): Cardinal only (N/S/E/W) - NO diagonal attacks
   * - Range 2+ (halberd): Allows diagonal attacks
   *
   * @see https://oldschool.runescape.wiki/w/Attack_range
   */
  private isWithinCombatRange(
    attacker: Entity | MobEntity,
    target: Entity | MobEntity,
    attackerType: "player" | "mob",
    data: MeleeAttackData,
    currentTick: number,
  ): boolean {
    const attackerPos = getEntityPosition(attacker);
    const targetPos = getEntityPosition(target);
    if (!attackerPos || !targetPos) return false;

    // Use pre-allocated pooled tiles (zero GC)
    tilePool.setFromPosition(this._attackerTile, attackerPos);
    tilePool.setFromPosition(this._targetTile, targetPos);
    const combatRangeTiles = this.getEntityCombatRange(attacker, attackerType);

    // OSRS-accurate melee range check:
    // - Range 1: Cardinal only (N/S/E/W)
    // - Range 2+: Allows diagonal (Chebyshev distance)
    if (
      !tilesWithinMeleeRange(
        this._attackerTile,
        this._targetTile,
        combatRangeTiles,
      )
    ) {
      if (attackerType === "player") {
        const dx = Math.abs(this._attackerTile.x - this._targetTile.x);
        const dz = Math.abs(this._attackerTile.z - this._targetTile.z);
        const actualDistance = Math.max(dx, dz);
        this.antiCheat.recordOutOfRangeAttack(
          data.attackerId,
          data.targetId,
          actualDistance,
          combatRangeTiles,
          currentTick,
        );
      }
      this.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
        attackerId: data.attackerId,
        targetId: data.targetId,
        reason: "out_of_range",
      });
      return false;
    }
    return true;
  }

  /**
   * Check if attack is on cooldown
   */
  private checkAttackCooldown(
    typedAttackerId: EntityID,
    currentTick: number,
  ): boolean {
    const nextAllowedTick = this.nextAttackTicks.get(typedAttackerId) ?? 0;
    return !isAttackOnCooldownTicks(currentTick, nextAllowedTick);
  }

  /**
   * Execute a validated melee attack
   * Handles rotation, animation, damage, and combat state
   */
  private executeMeleeAttack(
    data: MeleeAttackData,
    validation: AttackValidationResult,
    currentTick: number,
  ): void {
    const { attackerId, targetId, attackerType, targetType } = data;
    const { attacker, target, typedAttackerId, typedTargetId } = validation;

    if (!attacker || !target || !typedAttackerId || !typedTargetId) return;

    // Get attack speed
    const entityType = attacker.type === "mob" ? "mob" : "player";
    const attackSpeedTicks = this.getAttackSpeedTicks(
      typedAttackerId,
      entityType,
    );

    // Face target
    this.rotationManager.rotateTowardsTarget(
      attackerId,
      targetId,
      attackerType,
      targetType,
    );

    // Play attack animation (Issue #340: pass attack speed for proper animation duration)
    this.animationManager.setCombatEmote(
      attackerId,
      attackerType,
      currentTick,
      attackSpeedTicks,
    );

    // Calculate and apply damage
    const rawDamage = this.calculateMeleeDamage(attacker, target);
    const currentHealth = this.getEntityHealth(target);
    const damage = Math.min(rawDamage, currentHealth);

    this.applyDamage(targetId, targetType, damage, attackerId);

    // Emit damage event
    const targetPosition = getEntityPosition(target);
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage,
      targetType,
      position: targetPosition,
    });

    // Check if target died - skip remaining logic if so (Issue #265)
    if (!this.isEntityAlive(target, targetType)) {
      return;
    }

    // Set cooldown and enter combat state
    this.nextAttackTicks.set(typedAttackerId, currentTick + attackSpeedTicks);
    this.enterCombat(typedAttackerId, typedTargetId, attackSpeedTicks);
  }

  // MVP: handleRangedAttack removed - melee only

  private handleMobAttack(data: { mobId: string; targetId: string }): void {
    // Handle mob attacking player
    this.handleMeleeAttack({
      attackerId: data.mobId,
      targetId: data.targetId,
      attackerType: "mob",
      targetType: "player",
    });
  }

  /**
   * Issue #342: Handle combat follow - move player toward target when out of melee range
   * This allows combat to continue when the target moves instead of timing out
   *
   * NOTE: Actual movement is handled by ServerNetwork listening for COMBAT_FOLLOW_TARGET event.
   * This handler validates that combat is still active before the server initiates movement.
   */
  private handleCombatFollow(data: {
    playerId: string;
    targetId: string;
    targetPosition: { x: number; y: number; z: number };
  }): void {
    // Verify player is still in combat with this target
    const combatState = this.stateService
      .getCombatStatesMap()
      .get(data.playerId as EntityID);
    if (!combatState || combatState.targetId !== data.targetId) {
      return; // Combat ended or target changed, don't follow
    }
    // Movement is handled by ServerNetwork's COMBAT_FOLLOW_TARGET listener
    // which calls TileMovementManager.movePlayerToward()
  }

  private calculateMeleeDamage(
    attacker: Entity | MobEntity,
    target: Entity | MobEntity,
  ): number {
    // Extract required properties for damage calculation
    let attackerData: {
      stats?: CombatStats;
      config?: { attackPower?: number };
    } = {};
    let targetData: { stats?: CombatStats; config?: { defense?: number } } = {};

    // Strong type assumption - check if attacker has getMobData method (MobEntity)
    const attackerMob = attacker as MobEntity;
    if (attackerMob.getMobData) {
      const mobData = attackerMob.getMobData();
      attackerData = {
        stats: { attack: mobData.attack }, // Pass attack stat for accuracy calculation
        config: { attackPower: mobData.attackPower },
      };
    } else {
      // Handle player or other Entity - get stats from components
      const statsComponent = attacker.getComponent("stats");
      if (statsComponent?.data) {
        // Extract .level from SkillData objects for combat calculations
        const stats = statsComponent.data as {
          attack?: { level: number } | number;
          strength?: { level: number } | number;
          defense?: { level: number } | number;
          ranged?: { level: number } | number;
        };
        attackerData = {
          stats: {
            attack:
              typeof stats.attack === "object"
                ? stats.attack.level
                : (stats.attack ?? 1),
            strength:
              typeof stats.strength === "object"
                ? stats.strength.level
                : (stats.strength ?? 1),
            defense:
              typeof stats.defense === "object"
                ? stats.defense.level
                : (stats.defense ?? 1),
            ranged:
              typeof stats.ranged === "object"
                ? stats.ranged.level
                : (stats.ranged ?? 1),
          },
        };
      }
    }

    // Strong type assumption - check if target has getMobData method (MobEntity)
    const targetMob = target as MobEntity;
    if (targetMob.getMobData) {
      const mobData = targetMob.getMobData();
      targetData = {
        stats: { defense: mobData.defense }, // Pass defense stat for accuracy calculation
        config: { defense: mobData.defense },
      };
    } else {
      // Handle player or other Entity
      const statsComponent = target.getComponent("stats");
      if (statsComponent?.data) {
        // Extract .level from SkillData objects for combat calculations
        const stats = statsComponent.data as {
          attack?: { level: number } | number;
          strength?: { level: number } | number;
          defense?: { level: number } | number;
          ranged?: { level: number } | number;
        };
        targetData = {
          stats: {
            attack:
              typeof stats.attack === "object"
                ? stats.attack.level
                : (stats.attack ?? 1),
            strength:
              typeof stats.strength === "object"
                ? stats.strength.level
                : (stats.strength ?? 1),
            defense:
              typeof stats.defense === "object"
                ? stats.defense.level
                : (stats.defense ?? 1),
            ranged:
              typeof stats.ranged === "object"
                ? stats.ranged.level
                : (stats.ranged ?? 1),
          },
        };
      }
    }

    // Get equipment stats for player attacker
    let equipmentStats:
      | { attack: number; strength: number; defense: number; ranged: number }
      | undefined = undefined;
    if (!attackerMob.getMobData) {
      // Attacker is a player - get equipment stats
      equipmentStats = this.playerEquipmentStats.get(attacker.id);
    }

    const result = calculateDamage(
      attackerData,
      targetData,
      AttackType.MELEE,
      equipmentStats,
    );

    return result.damage;
  }

  // MVP: calculateRangedDamage removed - melee only

  private applyDamage(
    targetId: string,
    targetType: string,
    damage: number,
    attackerId: string,
  ): void {
    // Handle damage based on target type
    if (targetType === "player") {
      // Get player system and use its damage method
      const playerSystem = this.world.getSystem<PlayerSystem>("player");
      if (!playerSystem) {
        this.logger.error("PlayerSystem not found");
        return;
      }

      const entity = this.getEntity(targetId, "player");
      if (!entity) {
        this.logger.error("Player entity not found for damage", undefined, {
          targetId,
        });
        return;
      }

      const damaged = playerSystem.damagePlayer(targetId, damage, attackerId);

      // CRITICAL: If damage failed, check if player is dead and end combat
      // damagePlayer() returns false when player.alive = false (line 1097)
      if (!damaged) {
        const targetEntity = this.getEntity(targetId, "player");
        const isAlive = this.isEntityAlive(targetEntity, "player");
        if (!isAlive) {
          // Player is dead - end ALL combat with this player immediately
          this.handleEntityDied(targetId, "player");
          return;
        }
        // Player not dead but damage still failed - log and continue
        this.logger.error("Failed to damage player", undefined, { targetId });
        return;
      }

      // CRITICAL: Check if player died from THIS attack - end ALL combat with this player
      // This prevents additional auto-attacks from ANY mob in the same frame
      const targetEntity = this.getEntity(targetId, "player");
      const isAlive = this.isEntityAlive(targetEntity, "player");
      if (!isAlive) {
        this.handleEntityDied(targetId, "player");
        return;
      }

      const attacker = this.getEntity(attackerId, "mob");
      const attackerName = this.getTargetName(attacker);
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: targetId,
        message: `The ${attackerName} hits you for ${damage} damage!`,
        type: "damage",
      });
    } else if (targetType === "mob") {
      // For mobs, get the entity from EntityManager and use its takeDamage method
      const mobEntity = this.world.entities.get(targetId) as MobEntity;
      if (!mobEntity) {
        this.logger.warn("Mob entity not found - may have been destroyed", {
          targetId,
        });
        return;
      }

      // Check if mob is already dead
      if (mobEntity.isDead()) {
        this.logger.warn("Cannot damage dead mob", { targetId });
        return;
      }

      // Check if the mob has a takeDamage method (MobEntity)
      if (typeof mobEntity.takeDamage === "function") {
        mobEntity.takeDamage(damage, attackerId);

        // Emit MOB_NPC_ATTACKED event so EntityManager can handle death
        this.emitTypedEvent(EventType.MOB_NPC_ATTACKED, {
          mobId: targetId,
          damage: damage,
          attackerId: attackerId,
        });
      } else {
        // Fallback for entities without takeDamage method
        const currentHealth = mobEntity.getProperty("health") as
          | { current: number; max: number }
          | number;
        const healthValue =
          typeof currentHealth === "number"
            ? currentHealth
            : currentHealth.current;
        const maxHealth =
          typeof currentHealth === "number" ? 100 : currentHealth.max;

        const newHealth = Math.max(0, healthValue - damage);

        if (typeof currentHealth === "number") {
          mobEntity.setProperty("health", newHealth);
        } else {
          mobEntity.setProperty("health", {
            current: newHealth,
            max: maxHealth,
          });
        }

        // Check if mob died
        if (newHealth <= 0) {
          // Don't emit NPC_DIED here - let MobEntity.die() handle it
          // Don't emit COMBAT_KILL here either - let MobEntity.die() handle it

          this.emitTypedEvent(EventType.UI_MESSAGE, {
            playerId: attackerId,
            message: `You have defeated the ${mobEntity.getProperty("name") || mobEntity.getProperty("mobType") || "unknown"}!`,
            type: "success",
          });
        }
      }
    } else {
      return;
    }

    // Note: Damage splatter events are now emitted at the call sites
    // (handleMeleeAttack, processAutoAttack) to ensure they're emitted even for 0 damage hits
  }

  // Note: syncCombatStateToEntity, clearCombatStateFromEntity moved to CombatStateService
  // Note: setCombatEmote, resetEmote moved to CombatAnimationManager
  // Note: rotateTowardsTarget moved to CombatRotationManager

  private enterCombat(
    attackerId: EntityID,
    targetId: EntityID,
    attackerSpeedTicks?: number,
  ): void {
    const currentTick = this.world.currentTick;

    // Detect entity types (don't assume attacker is always player!)
    const attackerEntity = this.world.entities.get(String(attackerId));
    const targetEntity = this.world.entities.get(String(targetId));

    // Don't enter combat if target is dead
    if (targetEntity && "health" in targetEntity) {
      const targetWithHealth = targetEntity as unknown as CombatPlayerEntity;
      if (
        targetWithHealth.health !== undefined &&
        targetWithHealth.health <= 0
      ) {
        return;
      }
    }

    // Also check if target is a player marked as dead
    const playerSystem = this.world.getSystem<PlayerSystem>("player");
    if (playerSystem?.getPlayer) {
      const targetPlayer = playerSystem.getPlayer(String(targetId));
      if (targetPlayer && !targetPlayer.alive) {
        return;
      }
    }

    const attackerType =
      attackerEntity?.type === "mob" ? ("mob" as const) : ("player" as const);
    const targetType =
      targetEntity?.type === "mob" ? ("mob" as const) : ("player" as const);

    // Get attack speeds in ticks (use provided or calculate)
    const attackerAttackSpeedTicks =
      attackerSpeedTicks ?? this.getAttackSpeedTicks(attackerId, attackerType);
    const targetAttackSpeedTicks = this.getAttackSpeedTicks(
      targetId,
      targetType,
    );

    // Set combat state for attacker (just attacked, so next attack is after cooldown)
    this.stateService.createAttackerState(
      attackerId,
      targetId,
      attackerType,
      targetType,
      currentTick,
      attackerAttackSpeedTicks,
    );

    // OSRS Retaliation: Target retaliates after ceil(speed/2) + 1 ticks
    // @see https://oldschool.runescape.wiki/w/Auto_Retaliate
    // Check if target can retaliate (mobs have retaliates flag, players always can)
    let canRetaliate = true;
    if (targetType === "mob" && targetEntity) {
      // Check mob's retaliates config - if false, mob won't fight back
      const mobConfig = (
        targetEntity as unknown as { config?: { retaliates?: boolean } }
      ).config;
      if (mobConfig && mobConfig.retaliates === false) {
        canRetaliate = false;
      }
    }

    if (canRetaliate) {
      const retaliationDelay = calculateRetaliationDelay(
        targetAttackSpeedTicks,
      );

      this.stateService.createRetaliatorState(
        targetId,
        attackerId,
        targetType,
        attackerType,
        currentTick,
        retaliationDelay,
        targetAttackSpeedTicks,
      );
    }

    // Rotate both entities to face each other (RuneScape-style)
    this.rotationManager.rotateTowardsTarget(
      String(attackerId),
      String(targetId),
      attackerType,
      targetType,
    );
    this.rotationManager.rotateTowardsTarget(
      String(targetId),
      String(attackerId),
      targetType,
      attackerType,
    );

    // Sync combat state to player entities for client-side combat awareness
    this.stateService.syncCombatStateToEntity(
      String(attackerId),
      String(targetId),
      attackerType,
    );
    this.stateService.syncCombatStateToEntity(
      String(targetId),
      String(attackerId),
      targetType,
    );

    // DON'T set combat emotes here - we set them when attacks happen instead
    // This prevents the animation from looping continuously

    // Emit combat started event
    this.emitTypedEvent(EventType.COMBAT_STARTED, {
      attackerId: String(attackerId),
      targetId: String(targetId),
    });

    // Show combat UI indicator for the local player (whoever that is)
    const localPlayer = this.world.getPlayer();
    if (
      localPlayer &&
      (String(attackerId) === localPlayer.id ||
        String(targetId) === localPlayer.id)
    ) {
      const opponent =
        String(attackerId) === localPlayer.id ? targetEntity : attackerEntity;
      const opponentName = opponent!.name;

      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: localPlayer.id,
        message: `⚔️ Combat started with ${opponentName}!`,
        type: "combat",
        duration: 3000,
      });
    }
  }

  private endCombat(data: {
    entityId: string;
    skipAttackerEmoteReset?: boolean;
    skipTargetEmoteReset?: boolean;
  }): void {
    // Validate entity ID before processing
    if (!data.entityId) {
      return;
    }

    const typedEntityId = createEntityID(data.entityId);
    const combatState = this.stateService.getCombatData(data.entityId);
    if (!combatState) return;

    // Reset emotes for both entities via AnimationManager
    // Skip attacker emote reset if requested (e.g., when target died during attack animation)
    if (!data.skipAttackerEmoteReset) {
      this.animationManager.resetEmote(data.entityId, combatState.attackerType);
    }
    // Skip target emote reset if requested (e.g., when dead entity ends combat, don't reset their attacker)
    if (!data.skipTargetEmoteReset) {
      this.animationManager.resetEmote(
        String(combatState.targetId),
        combatState.targetType,
      );
    }

    // Clear combat state from player entities via StateService
    this.stateService.clearCombatStateFromEntity(
      data.entityId,
      combatState.attackerType,
    );
    this.stateService.clearCombatStateFromEntity(
      String(combatState.targetId),
      combatState.targetType,
    );

    // Remove combat states via StateService
    this.stateService.removeCombatState(typedEntityId);
    this.stateService.removeCombatState(combatState.targetId);

    // Emit combat ended event
    this.emitTypedEvent(EventType.COMBAT_ENDED, {
      attackerId: data.entityId,
      targetId: String(combatState.targetId),
    });

    // Show combat end message for player
    if (combatState.attackerType === "player") {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.entityId,
        message: `Combat ended.`,
        type: "info",
      });
    }
  }

  /**
   * Handle entity death - mark dead entity as non-targetable, let combat timeout naturally
   * CRITICAL FIX FOR ISSUE #269: RuneScape-style combat timer
   * In OSRS, combat lasts for 8 ticks (4.8 seconds) after the LAST hit
   * Don't end combat immediately - let the timer expire naturally so health bars stay visible
   */
  private handleEntityDied(entityId: string, entityType: string): void {
    const typedEntityId = createEntityID(entityId);

    // Simply remove the dead entity's combat state - they're no longer in combat
    // But DON'T call endCombat() for attackers - let their combat timer expire naturally
    this.stateService.removeCombatState(typedEntityId);

    // Also clear the dead entity's attack cooldown so they can attack immediately after respawn
    this.nextAttackTicks.delete(typedEntityId);

    // Clear any scheduled emote resets for the dead entity
    this.animationManager.cancelEmoteReset(entityId);

    // Find all attackers targeting this dead entity
    // Their combat will naturally timeout after 4.8 seconds (8 ticks) since they got the last hit
    // This matches RuneScape behavior where health bars stay visible briefly after combat ends
    const combatStatesMap = this.stateService.getCombatStatesMap();
    for (const [attackerId, state] of combatStatesMap) {
      if (String(state.targetId) === entityId) {
        // CRITICAL: Clear the attacker's attack cooldown so they can attack new targets immediately
        // Without this, mobs would be stuck waiting for cooldown after their target dies and respawns
        this.nextAttackTicks.delete(attackerId);

        // CRITICAL: If the attacker is a mob, reset its internal CombatStateManager
        // This clears the mob's own nextAttackTick so it can attack immediately when target respawns
        if (state.attackerType === "mob") {
          const mobEntity = this.world.entities.get(
            String(attackerId),
          ) as MobEntity;
          if (mobEntity && typeof mobEntity.onTargetDied === "function") {
            mobEntity.onTargetDied(entityId);
          }
        }
      }
    }

    // Reset dead entity's emote if they were mid-animation
    this.animationManager.resetEmote(entityId, entityType as "player" | "mob");
  }

  // Public API methods
  public startCombat(
    attackerId: string,
    targetId: string,
    options?: {
      attackerType?: "player" | "mob";
      targetType?: "player" | "mob";
      weaponType?: AttackType;
    },
  ): boolean {
    const opts = {
      attackerType: "player",
      targetType: "mob",
      weaponType: AttackType.MELEE,
      ...options,
    };

    // Check if entities exist
    const attacker = this.getEntity(attackerId, opts.attackerType);
    const target = this.getEntity(targetId, opts.targetType);

    if (!attacker || !target) {
      return false;
    }

    // CRITICAL: Cannot start combat with dead entities (RuneScape-style validation)
    // This prevents mobs from starting combat with dead players (Issue #265)
    const attackerAlive = this.isEntityAlive(attacker, opts.attackerType);
    const targetAlive = this.isEntityAlive(target, opts.targetType);

    if (!attackerAlive) {
      return false;
    }
    if (!targetAlive) {
      return false;
    }

    // MVP: Melee-only range check (tile-based)
    const attackerPos = getEntityPosition(attacker);
    const targetPos = getEntityPosition(target);
    if (!attackerPos || !targetPos) return false; // Missing position

    // Use pre-allocated pooled tiles (zero GC)
    tilePool.setFromPosition(this._attackerTile, attackerPos);
    tilePool.setFromPosition(this._targetTile, targetPos);
    const combatRangeTiles = this.getEntityCombatRange(
      attacker,
      opts.attackerType,
    );
    // OSRS-accurate melee range check (cardinal-only for range 1)
    if (
      !tilesWithinMeleeRange(
        this._attackerTile,
        this._targetTile,
        combatRangeTiles,
      )
    ) {
      return false;
    }

    // Start combat
    this.enterCombat(createEntityID(attackerId), createEntityID(targetId));
    return true;
  }

  public isInCombat(entityId: string): boolean {
    return this.stateService.isInCombat(entityId);
  }

  public getCombatData(entityId: string): CombatData | null {
    return this.stateService.getCombatData(entityId);
  }

  public forceEndCombat(
    entityId: string,
    options?: {
      skipAttackerEmoteReset?: boolean;
      skipTargetEmoteReset?: boolean;
    },
  ): void {
    this.endCombat({
      entityId,
      skipAttackerEmoteReset: options?.skipAttackerEmoteReset,
      skipTargetEmoteReset: options?.skipTargetEmoteReset,
    });
  }

  /**
   * Clean up all combat state for a disconnecting player
   * Called when a player disconnects to prevent orphaned combat states
   * and allow mobs to immediately retarget other players
   */
  public cleanupPlayerDisconnect(playerId: string): void {
    const typedPlayerId = createEntityID(playerId);

    // Remove player's own combat state
    this.stateService.removeCombatState(typedPlayerId);

    // Clear player's attack cooldowns
    this.nextAttackTicks.delete(typedPlayerId);

    // Clear any scheduled emote resets
    this.animationManager.cancelEmoteReset(playerId);

    // Clear player's equipment stats cache
    this.playerEquipmentStats.delete(playerId);

    // Clean up anti-cheat tracking for disconnected player (Phase 6)
    this.antiCheat.cleanup(playerId);

    // Clean up rate limiter state (Phase 6.5)
    this.rateLimiter.cleanup(playerId);

    // Find all entities that were targeting this disconnected player
    const combatStatesMap = this.stateService.getCombatStatesMap();
    for (const [attackerId, state] of combatStatesMap) {
      if (String(state.targetId) === playerId) {
        // Clear the attacker's cooldown so they can immediately retarget
        this.nextAttackTicks.delete(attackerId);

        // If attacker is a mob, reset its internal combat state
        if (state.attackerType === "mob") {
          const mobEntity = this.world.entities.get(
            String(attackerId),
          ) as MobEntity;
          if (mobEntity && typeof mobEntity.onTargetDied === "function") {
            // Reuse the same method - disconnect is similar to death
            mobEntity.onTargetDied(playerId);
          }
        }

        // Remove the attacker's combat state (don't let them keep attacking empty air)
        this.stateService.removeCombatState(attackerId);

        // Clear combat state from entity if it's a player
        if (state.attackerType === "player") {
          this.stateService.clearCombatStateFromEntity(
            String(attackerId),
            "player",
          );
        }
      }
    }
  }

  private getEntity(
    entityId: string,
    entityType: string,
  ): Entity | MobEntity | null {
    if (entityType === "mob") {
      const entity = this.world.entities.get(entityId);
      if (!entity) {
        // Don't spam logs for entities that are being destroyed
        // Only log if this is a new entity that should exist
        return null;
      }
      return entity as MobEntity;
    }

    if (entityType === "player") {
      // Look up players from world.entities.players (includes fake test players)
      const player = this.world.entities.players.get(entityId);
      if (!player) {
        // Debug level - player disconnects are common and expected
        this.logger.debug("Player entity not found (probably disconnected)", {
          entityId,
        });
        return null;
      }
      return player;
    }

    if (!this.entityManager) {
      this.logger.warn("Entity manager not available");
      return null;
    }
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) {
      this.logger.debug("Entity not found", { entityId });
      return null;
    }
    return entity;
  }

  // Combat update loop - DEPRECATED: Combat logic now handled by processCombatTick() via TickSystem
  // This method is kept for compatibility but does nothing - all combat runs through tick system
  update(_dt: number): void {
    // Combat logic moved to processCombatTick() for OSRS-accurate tick-based timing
    // This is called by TickSystem at TickPriority.COMBAT
  }

  /**
   * Process combat on each server tick (OSRS-accurate)
   * Called by TickSystem at COMBAT priority (after movement, before AI)
   */
  public processCombatTick(tickNumber: number): void {
    // Process scheduled emote resets (tick-aligned animation timing)
    // Delegated to AnimationManager for better separation of concerns
    this.animationManager.processEmoteResets(tickNumber);

    // Get all combat states via StateService (returns reusable buffer to avoid allocations)
    const combatStates = this.stateService.getAllCombatStates();
    const combatStatesMap = this.stateService.getCombatStatesMap();

    // Process all active combat sessions
    for (const [entityId, combatState] of combatStates) {
      // CRITICAL: Re-check if this combat state still exists
      if (!combatStatesMap.has(entityId)) {
        continue;
      }

      // Check for combat timeout (8 ticks after last hit)
      if (combatState.inCombat && tickNumber >= combatState.combatEndTick) {
        const entityIdStr = String(entityId);
        this.endCombat({ entityId: entityIdStr });
        continue;
      }

      // Skip if not in combat or doesn't have valid target
      if (!combatState.inCombat || !combatState.targetId) continue;

      // OSRS-style: Check range EVERY tick and follow if needed (not just on attack ticks)
      // In OSRS, you continuously pursue your target while in combat
      if (combatState.attackerType === "player") {
        this.checkRangeAndFollow(combatState, tickNumber);
      }

      // Check if this entity can attack on this tick
      if (tickNumber >= combatState.nextAttackTick) {
        this.processAutoAttackOnTick(combatState, tickNumber);
      }
    }
  }

  /**
   * OSRS-style: Check if player is in range of target, emit follow event if not
   * Called EVERY tick to ensure continuous pursuit of moving targets
   */
  private checkRangeAndFollow(
    combatState: CombatData,
    tickNumber: number,
  ): void {
    const attackerId = String(combatState.attackerId);
    const targetId = String(combatState.targetId);

    const attacker = this.getEntity(attackerId, combatState.attackerType);
    const target = this.getEntity(targetId, combatState.targetType);

    if (!attacker || !target) return;

    // Don't follow dead targets - let combat timeout naturally
    // This prevents player getting stuck after killing a mob
    if (!this.isEntityAlive(target, combatState.targetType)) {
      return;
    }

    const attackerPos = getEntityPosition(attacker);
    const targetPos = getEntityPosition(target);
    if (!attackerPos || !targetPos) return;

    // Use pre-allocated pooled tiles (zero GC)
    tilePool.setFromPosition(this._attackerTile, attackerPos);
    tilePool.setFromPosition(this._targetTile, targetPos);
    const combatRangeTiles = this.getEntityCombatRange(
      attacker,
      combatState.attackerType,
    );

    // OSRS-accurate melee range check (cardinal-only for range 1)
    if (
      !tilesWithinMeleeRange(
        this._attackerTile,
        this._targetTile,
        combatRangeTiles,
      )
    ) {
      // Out of range - emit follow event to move player toward target
      // Extend combat timeout while pursuing
      combatState.combatEndTick =
        tickNumber + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;

      this.emitTypedEvent(EventType.COMBAT_FOLLOW_TARGET, {
        playerId: attackerId,
        targetId: targetId,
        targetPosition: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
        meleeRange: combatRangeTiles, // Pass range for OSRS-accurate pathfinding
      });
    }
  }

  /**
   * Process auto-attack for a combatant on a specific tick (OSRS-accurate)
   * This creates the continuous attack loop that makes combat feel like RuneScape
   */
  private processAutoAttackOnTick(
    combatState: CombatData,
    tickNumber: number,
  ): void {
    const attackerId = String(combatState.attackerId);
    const targetId = String(combatState.targetId);
    const typedAttackerId = combatState.attackerId;

    const attacker = this.getEntity(attackerId, combatState.attackerType);
    const target = this.getEntity(targetId, combatState.targetType);

    // CRITICAL FIX FOR ISSUE #269: RuneScape-style combat timer
    // If entity not found (dead mob, disconnected player, etc.), DON'T end combat immediately
    // Let the 8-tick timeout expire naturally to keep health bars visible
    if (!attacker || !target) {
      return;
    }

    // Check if attacker is still alive (prevent dead attackers from auto-attacking)
    if (!this.isEntityAlive(attacker, combatState.attackerType)) {
      return;
    }

    // Check if target is still alive
    if (!this.isEntityAlive(target, combatState.targetType)) {
      return;
    }

    // MVP: Melee-only range check (tile-based, OSRS-style)
    const attackerPos = getEntityPosition(attacker);
    const targetPos = getEntityPosition(target);
    if (!attackerPos || !targetPos) return; // Missing position

    // MELEE: Must be within attacker's combat range (configurable per mob, minimum 1 tile)
    // OSRS-style: range 1 = cardinal only (N/S/E/W), range 2+ = diagonal allowed
    // Use pre-allocated pooled tiles (zero GC)
    tilePool.setFromPosition(this._attackerTile, attackerPos);
    tilePool.setFromPosition(this._targetTile, targetPos);
    const combatRangeTiles = this.getEntityCombatRange(
      attacker,
      combatState.attackerType,
    );
    // OSRS-accurate melee range check (cardinal-only for range 1)
    if (
      !tilesWithinMeleeRange(
        this._attackerTile,
        this._targetTile,
        combatRangeTiles,
      )
    ) {
      // Out of melee range - skip this attack (follow is handled by checkRangeAndFollow every tick)
      return;
    }

    // OSRS-STYLE: Update entity facing to face target (RuneScape entities always face combat target)
    this.rotationManager.rotateTowardsTarget(
      attackerId,
      targetId,
      combatState.attackerType,
      combatState.targetType,
    );

    // Play attack animation (Issue #340: pass attack speed for proper animation duration)
    this.animationManager.setCombatEmote(
      attackerId,
      combatState.attackerType,
      tickNumber,
      combatState.attackSpeedTicks,
    );

    // MVP: Melee-only damage calculation
    const rawDamage = this.calculateMeleeDamage(attacker, target);

    // OSRS-STYLE: Cap damage at target's current health (no overkill)
    const currentHealth = this.getEntityHealth(target);
    const damage = Math.min(rawDamage, currentHealth);

    // Apply capped damage
    this.applyDamage(targetId, combatState.targetType, damage, attackerId);

    // Emit damage splatter event
    const targetPosition = getEntityPosition(target);
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage, // Capped damage - matches actual damage applied
      targetType: combatState.targetType,
      position: targetPosition,
    });

    // Check if combat state still exists (target may have died)
    if (!this.stateService.getCombatStatesMap().has(typedAttackerId)) {
      return;
    }

    // Update tick-based tracking (OSRS-accurate)
    combatState.lastAttackTick = tickNumber;
    combatState.nextAttackTick = tickNumber + combatState.attackSpeedTicks;
    combatState.combatEndTick =
      tickNumber + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;
    this.nextAttackTicks.set(typedAttackerId, combatState.nextAttackTick);

    // MVP: Emit melee attack event for visual feedback
    this.emitTypedEvent(EventType.COMBAT_MELEE_ATTACK, {
      attackerId,
      targetId,
      attackerType: combatState.attackerType,
      targetType: combatState.targetType,
    });

    // Emit UI message for player attacks
    if (combatState.attackerType === "player") {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: attackerId,
        message: `You hit the ${this.getTargetName(target)} for ${damage} damage!`,
        type: "combat",
      });
    }
  }

  /**
   * Get display name for a target entity
   */
  private getTargetName(entity: Entity | MobEntity | null): string {
    if (!entity) return "Unknown";
    const mobEntity = entity as MobEntity;
    if (mobEntity.getMobData) {
      return mobEntity.getMobData().name;
    }
    return entity.name || "Enemy";
  }

  /**
   * Get current health of an entity
   * Returns the current HP value to prevent damage overkill display
   */
  private getEntityHealth(entity: Entity | MobEntity | null): number {
    if (!entity) {
      return 0;
    }

    // All entities inherit getHealth() from Entity base class
    try {
      const health = entity.getHealth();
      return Math.max(0, health);
    } catch (err) {
      return 0;
    }
  }

  /**
   * Get attack speed in TICKS for an entity (OSRS-accurate)
   * @returns Attack speed in game ticks (default: 4 ticks = 2.4 seconds)
   */
  private getAttackSpeedTicks(entityId: EntityID, entityType: string): number {
    // For players, get equipment via EquipmentSystem
    if (entityType === "player") {
      const equipmentSystem = this.world.getSystem?.("equipment") as
        | {
            getPlayerEquipment?: (id: string) => {
              weapon?: { item?: { attackSpeed?: number; id?: string } };
            } | null;
          }
        | undefined;

      if (equipmentSystem?.getPlayerEquipment) {
        const equipment = equipmentSystem.getPlayerEquipment(String(entityId));

        if (equipment?.weapon?.item) {
          const weaponItem = equipment.weapon.item;

          // First check if Item has attackSpeed directly
          if (weaponItem.attackSpeed) {
            return weaponItem.attackSpeed;
          }

          // Fallback: look up from ITEMS map
          if (weaponItem.id) {
            const itemData = getItem(weaponItem.id);
            if (itemData?.attackSpeed) {
              return itemData.attackSpeed;
            }
          }
        }
      }

      // Player with no weapon - use default
      return COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS;
    }

    // For mobs, check mob attack speed (stored in ticks in npcs.json)
    const entity = this.getEntity(String(entityId), entityType);
    if (entity) {
      const mobEntity = entity as MobEntity;
      if (mobEntity.getMobData) {
        const mobData = mobEntity.getMobData();
        const mobAttackSpeedTicks = (mobData as { attackSpeedTicks?: number })
          .attackSpeedTicks;
        if (mobAttackSpeedTicks) {
          return mobAttackSpeedTicks;
        }
      }
    }

    // Default attack speed (4 ticks = 2.4 seconds)
    return COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS;
  }

  /**
   * Get combat range for an entity in tiles
   * Mobs use combatRange from manifest, players use equipped weapon's attackRange
   */
  private getEntityCombatRange(
    entity: Entity | MobEntity,
    entityType: string,
  ): number {
    if (entityType === "mob") {
      const mobEntity = entity as MobEntity;
      if (typeof mobEntity.getCombatRange === "function") {
        return mobEntity.getCombatRange();
      }
    }

    // Players: get weapon attackRange from equipped weapon via EquipmentSystem
    if (entityType === "player") {
      const equipmentSystem = this.world.getSystem?.("equipment") as
        | {
            getPlayerEquipment?: (id: string) => {
              weapon?: { item?: { attackRange?: number; id?: string } };
            } | null;
          }
        | undefined;

      if (equipmentSystem?.getPlayerEquipment) {
        const equipment = equipmentSystem.getPlayerEquipment(entity.id);

        if (equipment?.weapon?.item) {
          const weaponItem = equipment.weapon.item;

          // First check if Item has attackRange directly
          if (weaponItem.attackRange) {
            return weaponItem.attackRange;
          }

          // Fallback: look up from ITEMS map
          if (weaponItem.id) {
            const itemData = getItem(weaponItem.id);
            if (itemData?.attackRange) {
              return itemData.attackRange;
            }
          }
        }
      }
    }

    // Default to 1 tile (punching/unarmed)
    return 1;
  }

  /**
   * Check if entity is alive
   */
  private isEntityAlive(
    entity: Entity | MobEntity | null,
    entityType: string,
  ): boolean {
    if (!entity) return false;
    if (entityType === "player") {
      // Check player health
      const player = entity as Entity;
      const healthComponent = player.getComponent("health");
      if (healthComponent?.data) {
        const health = healthComponent.data as {
          current: number;
          isDead?: boolean;
        };
        return health.current > 0 && !health.isDead;
      }
      const playerHealth = player.getHealth();
      return playerHealth > 0;
    }

    if (entityType === "mob") {
      // Check mob health
      const mob = entity as MobEntity;

      // Check if mob is marked as dead
      if (mob.isDead()) {
        return false;
      }

      // Check mob data if available
      if (mob.getMobData) {
        const mobData = mob.getMobData();
        return mobData.health > 0;
      }

      // Fallback to health check
      const mobHealth = mob.getHealth();
      return mobHealth > 0;
    }

    return false;
  }

  destroy(): void {
    // Clean up modular services
    this.stateService.destroy();
    this.animationManager.destroy();

    // Clean up anti-cheat monitoring (Phase 6)
    this.antiCheat.destroy();

    // Clean up rate limiter (Phase 6.5)
    this.rateLimiter.destroy();

    // Release pooled tiles back to pool
    tilePool.release(this._attackerTile);
    tilePool.release(this._targetTile);

    // Clear all attack cooldowns (tick-based)
    this.nextAttackTicks.clear();

    // Call parent cleanup (handles autoCleanup)
    super.destroy();
  }

  /**
   * Get anti-cheat stats for monitoring dashboard (Phase 6)
   */
  public getAntiCheatStats(): {
    trackedPlayers: number;
    playersAboveWarning: number;
    playersAboveAlert: number;
    totalViolationsLast5Min: number;
  } {
    return this.antiCheat.getStats();
  }

  /**
   * Get anti-cheat report for a specific player (Phase 6)
   */
  public getAntiCheatPlayerReport(playerId: string): {
    score: number;
    recentViolations: Array<{
      playerId: string;
      type: string;
      severity: number;
      details: string;
      timestamp: number;
    }>;
    attacksThisTick: number;
  } {
    return this.antiCheat.getPlayerReport(playerId);
  }

  /**
   * Get players requiring admin attention (Phase 6)
   */
  public getPlayersRequiringReview(): string[] {
    return this.antiCheat.getPlayersRequiringReview();
  }

  /**
   * Decay anti-cheat scores (call periodically, e.g., every minute)
   */
  public decayAntiCheatScores(): void {
    this.antiCheat.decayScores();
  }

  /**
   * Get pool statistics for monitoring dashboard
   * Useful for detecting memory leaks or pool exhaustion
   *
   * @see COMBAT_SYSTEM_IMPROVEMENTS.md Section 3.2
   */
  public getPoolStats(): {
    quaternions: { total: number; available: number; inUse: number };
  } {
    return {
      quaternions: quaternionPool.getStats(),
    };
  }

  /**
   * Get anti-cheat configuration (for admin tools)
   */
  public getAntiCheatConfig(): {
    warningThreshold: number;
    alertThreshold: number;
    scoreDecayPerMinute: number;
    maxAttacksPerTick: number;
    maxViolationsPerPlayer: number;
    warningCooldownMs: number;
  } {
    return this.antiCheat.getConfig();
  }
}
