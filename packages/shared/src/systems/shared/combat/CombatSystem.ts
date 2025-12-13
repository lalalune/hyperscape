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
import { worldToTile, tilesWithinRange } from "../movement/TileSystem";

export interface CombatData {
  attackerId: EntityID;
  targetId: EntityID;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  weaponType: AttackType;
  inCombat: boolean;

  // TICK-BASED timing (OSRS-accurate)
  lastAttackTick: number; // Tick when last attack occurred
  nextAttackTick: number; // Tick when next attack is allowed
  combatEndTick: number; // Tick when combat times out (8 ticks after last hit)
  attackSpeedTicks: number; // Weapon attack speed in ticks
}

export class CombatSystem extends SystemBase {
  private combatStates = new Map<EntityID, CombatData>();
  private nextAttackTicks = new Map<EntityID, number>(); // Tick when entity can next attack
  private mobSystem?: MobNPCSystem;
  private entityManager?: EntityManager;

  // Equipment stats cache per player for damage calculations
  private playerEquipmentStats = new Map<
    string,
    { attack: number; strength: number; defense: number; ranged: number }
  >();

  // Tick-based animation reset scheduling (instead of setTimeout)
  // Maps entity ID to the tick when their emote should reset to idle
  private emoteResetTicks = new Map<
    string,
    { tick: number; entityType: "player" | "mob" }
  >();

  // Combat constants

  constructor(world: World) {
    super(world, {
      name: "combat",
      dependencies: {
        required: ["entity-manager"], // Combat needs entity manager
        optional: ["mob-npc"], // Combat can work without mob NPCs but better with them
      },
      autoCleanup: true,
    });
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

  private handleMeleeAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
  }): void {
    const { attackerId, targetId, attackerType, targetType } = data;

    // Convert IDs to typed IDs
    const typedAttackerId = createEntityID(attackerId);
    const typedTargetId = createEntityID(targetId);

    // Get attacker and target positions for range check
    const attacker = this.getEntity(attackerId, attackerType);
    const target = this.getEntity(targetId, targetType);

    // Check entities exist
    if (!attacker || !target) {
      return;
    }

    // CRITICAL: Check if ATTACKER is alive (dead entities can't attack)
    if (!this.isEntityAlive(attacker, attackerType)) {
      return;
    }

    // CRITICAL: Check if target is already dead BEFORE processing attack (Issue #265)
    // This prevents attacks from being processed on dead entities
    if (!this.isEntityAlive(target, targetType)) {
      return;
    }

    // CRITICAL: Check if target player is still loading (Issue #356)
    // Players are immune to combat until their client finishes loading assets
    if (targetType === "player" && target.data?.isLoading) {
      return;
    }

    // Check if target is attackable (for mobs that have attackable: false in manifest)
    if (targetType === "mob") {
      const mobEntity = target as MobEntity;
      if (mobEntity.isAttackable && !mobEntity.isAttackable()) {
        this.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
          attackerId,
          targetId,
          reason: "target_not_attackable",
        });
        return;
      }
    }

    // CRITICAL: Can't attack yourself
    if (attackerId === targetId) {
      return;
    }

    // OSRS-STYLE: Check if attacker is within combat range of target
    // Uses combatRange from mob manifest (default 1 tile for players)
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();
    const attackerTile = worldToTile(attackerPos.x, attackerPos.z);
    const targetTile = worldToTile(targetPos.x, targetPos.z);
    const combatRangeTiles = this.getEntityCombatRange(attacker, attackerType);

    if (!tilesWithinRange(attackerTile, targetTile, combatRangeTiles)) {
      this.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
        attackerId,
        targetId,
        reason: "out_of_range",
      });
      return;
    }

    // Check attack cooldown (TICK-BASED, OSRS-accurate)
    const currentTick = this.world.currentTick;
    const nextAllowedTick = this.nextAttackTicks.get(typedAttackerId) ?? 0;

    if (isAttackOnCooldownTicks(currentTick, nextAllowedTick)) {
      return; // Still on cooldown
    }

    // Get attack speed in ticks for later use
    const entityType = attacker.type === "mob" ? "mob" : "player";
    const attackSpeedTicks = this.getAttackSpeedTicks(
      typedAttackerId,
      entityType,
    );

    // OSRS-STYLE: Face target before attacking
    this.rotateTowardsTarget(attackerId, targetId, attackerType, targetType);

    // Play attack animation once (will reset to idle after 2 ticks = 1.2 seconds)
    this.setCombatEmote(attackerId, attackerType);

    // Schedule tick-based emote reset (2 ticks for animation to complete)
    // OSRS-style: animations are synchronized to game ticks
    const resetTick = currentTick + 2; // 2 ticks = 1200ms for animation
    this.emoteResetTicks.set(attackerId, {
      tick: resetTick,
      entityType: attackerType,
    });

    // Calculate damage
    const rawDamage = this.calculateMeleeDamage(attacker, target);

    // OSRS-STYLE: Cap damage at target's current health (no overkill)
    // This ensures health never goes negative and damage display matches actual damage
    const currentHealth = this.getEntityHealth(target);
    const damage = Math.min(rawDamage, currentHealth);

    // Apply capped damage
    this.applyDamage(targetId, targetType, damage, attackerId);

    // CRITICAL: ALWAYS emit damage splatter event (including for killing blow - RuneScape shows final damage)
    const targetPosition = target.position || target.getPosition();
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage, // Capped damage - matches actual damage applied
      targetType,
      position: targetPosition,
    });

    // CRITICAL: Check if target died from this attack - if so, skip remaining combat logic (Issue #265)
    // We already emitted the damage event above so player sees the killing blow
    const targetStillAlive = this.isEntityAlive(target, targetType);
    if (!targetStillAlive) {
      return; // Target died, don't update cooldowns or combat state
    }

    // Set attack cooldown (TICK-BASED)
    this.nextAttackTicks.set(typedAttackerId, currentTick + attackSpeedTicks);

    // Enter combat state
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
        console.error("[CombatSystem] PlayerSystem not found!");
        return;
      }

      const entity = this.getEntity(targetId, "player");
      if (!entity) {
        console.error(`[CombatSystem] Player entity not found for ${targetId}`);
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
        console.error(`[CombatSystem] Failed to damage player ${targetId}`);
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
        console.warn(
          `[CombatSystem] Mob entity not found for ${targetId} - may have been destroyed`,
        );
        return;
      }

      // Check if mob is already dead
      if (mobEntity.isDead()) {
        console.warn(`[CombatSystem] Cannot damage dead mob ${targetId}`);
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

  /**
   * Sync combat state to player entity for client-side awareness
   */
  private syncCombatStateToEntity(
    entityId: string,
    targetId: string,
    entityType: "player" | "mob",
  ): void {
    if (entityType === "player") {
      const playerEntity = this.world.getPlayer?.(entityId);
      if (playerEntity) {
        // Set combat property if it exists (legacy support)
        if ((playerEntity as any).combat) {
          (playerEntity as any).combat.inCombat = true;
          (playerEntity as any).combat.combatTarget = targetId;
        }

        // ALWAYS set in data for network sync (using abbreviated keys for efficiency)
        if ((playerEntity as any).data) {
          (playerEntity as any).data.c = true; // c = inCombat
          (playerEntity as any).data.ct = targetId; // ct = combatTarget

          // CRITICAL FIX FOR ISSUE #269: Send immediate network update when combat starts
          // This ensures health bar appears immediately, not just when emote changes
          if (this.world.isServer && this.world.network?.send) {
            this.world.network.send("entityModified", {
              id: entityId,
              c: true, // Combat started
              ct: targetId, // Combat target
            });
          }
        }

        (playerEntity as any).markNetworkDirty?.();
      }
    }
  }

  /**
   * Clear combat state from player entity when combat ends
   */
  private clearCombatStateFromEntity(
    entityId: string,
    entityType: "player" | "mob",
  ): void {
    if (entityType === "player") {
      const playerEntity = this.world.getPlayer?.(entityId);
      if (playerEntity) {
        // Clear combat property if it exists (legacy support)
        if ((playerEntity as any).combat) {
          (playerEntity as any).combat.inCombat = false;
          (playerEntity as any).combat.combatTarget = null;
        }

        // ALWAYS clear in data for network sync (using abbreviated keys)
        if ((playerEntity as any).data) {
          (playerEntity as any).data.c = false; // c = inCombat
          (playerEntity as any).data.ct = null; // ct = combatTarget

          // CRITICAL FIX FOR ISSUE #269: Send immediate network update when combat ends
          // This ensures health bar disappears 4.8 seconds after last hit (RuneScape pattern)
          if (this.world.isServer && this.world.network?.send) {
            this.world.network.send("entityModified", {
              id: entityId,
              c: false, // Clear inCombat state when combat truly ends
              ct: null, // Clear combat target
            });
          }
        }

        (playerEntity as any).markNetworkDirty?.();
      } else {
        console.warn(
          `[CombatSystem] Cannot clear combat state - player entity not found`,
        );
      }
    }
  }

  /**
   * Set combat emote for an entity
   */
  private setCombatEmote(entityId: string, entityType: "player" | "mob"): void {
    if (entityType === "player") {
      // For players, use the player entity from PlayerSystem
      const playerEntity = this.world.getPlayer?.(entityId);
      if (playerEntity) {
        // Check if player has a sword equipped - get from EquipmentSystem (source of truth)
        let combatEmote = "combat"; // Default to punching

        // Get equipment from EquipmentSystem (source of truth)
        const equipmentSystem = this.world.getSystem("equipment") as
          | {
              getPlayerEquipment?: (playerId: string) => {
                weapon?: { item?: { weaponType?: string; id?: string } };
              };
            }
          | undefined;

        if (equipmentSystem?.getPlayerEquipment) {
          const equipment = equipmentSystem.getPlayerEquipment(entityId);

          if (equipment?.weapon?.item) {
            const weaponItem = equipment.weapon.item;

            // Check if the weapon is a sword
            if (weaponItem.weaponType === "SWORD") {
              combatEmote = "sword_swing";
            }
          }
        }

        // Set emote STRING KEY (players use 'combat' or 'sword_swing' string which gets mapped to URL)
        if ((playerEntity as any).emote !== undefined) {
          (playerEntity as any).emote = combatEmote;
        }
        if ((playerEntity as any).data) {
          (playerEntity as any).data.e = combatEmote;
        }
        // Don't set avatar directly - let PlayerLocal's modify() handle the mapping

        // CRITICAL FIX FOR ISSUE #275: Send immediate network update BEFORE damage is applied
        // This ensures the emote update arrives at clients BEFORE any death events
        // Without this, the batched network update arrives too late (after death event)
        if (this.world.isServer && this.world.network?.send) {
          this.world.network.send("entityModified", {
            id: entityId,
            e: combatEmote,
            c: true, // Send inCombat state immediately (for health bar display)
            ct: (playerEntity as any).combat?.combatTarget || null, // Send combat target
          });
        }

        (playerEntity as any).markNetworkDirty?.();
      }
    } else if (entityType === "mob") {
      // For mobs, send one-shot combat animation via setServerEmote()
      // This will be broadcast once, then client returns to AI-state-based animation
      const mobEntity = this.world.entities.get(entityId);
      if (
        mobEntity &&
        typeof (mobEntity as any).setServerEmote === "function"
      ) {
        (mobEntity as any).setServerEmote(Emotes.COMBAT);
      }
    }
  }

  /**
   * Reset entity emote to idle
   */
  private resetEmote(entityId: string, entityType: "player" | "mob"): void {
    if (entityType === "player") {
      const playerEntity = this.world.getPlayer?.(entityId);
      if (playerEntity) {
        // Reset to idle STRING KEY (players use 'idle' string which gets mapped to URL)
        if ((playerEntity as any).emote !== undefined) {
          (playerEntity as any).emote = "idle";
        }
        if ((playerEntity as any).data) {
          (playerEntity as any).data.e = "idle";
        }
        // Don't set avatar directly - let PlayerLocal's modify() handle the mapping

        // Send immediate network update for emote reset (same as setCombatEmote)
        // NOTE: Don't send c: false here - combat may still be active, just resetting animation
        if (this.world.isServer && this.world.network?.send) {
          this.world.network.send("entityModified", {
            id: entityId,
            e: "idle",
          });
        }

        (playerEntity as any).markNetworkDirty?.();
      }
    }
    // DON'T reset mob emotes - let client's AI-state-based animation handle it
    // Mobs use AI state (IDLE, WANDER, CHASE, ATTACK) to determine animations
  }

  /**
   * Rotate an entity to face a target (RuneScape-style instant rotation)
   */
  private rotateTowardsTarget(
    entityId: string,
    targetId: string,
    entityType: "player" | "mob",
    targetType: "player" | "mob",
  ): void {
    // Get entities properly based on type
    const entity =
      entityType === "player"
        ? this.world.getPlayer?.(entityId)
        : this.world.entities.get(entityId);
    const target =
      targetType === "player"
        ? this.world.getPlayer?.(targetId)
        : this.world.entities.get(targetId);

    if (!entity || !target) {
      return;
    }

    const entityPos =
      entity.position || (entity as any).getPosition?.() || entity;
    const targetPos =
      target.position || (target as any).getPosition?.() || target;

    // Calculate angle to target (XZ plane only)
    const dx = targetPos.x - entityPos.x;
    const dz = targetPos.z - entityPos.z;
    let angle = Math.atan2(dx, dz);

    // VRM 1.0+ models have 180° base rotation, so we need to compensate
    // Otherwise entities face AWAY from each other instead of towards
    angle += Math.PI;

    // Set rotation differently based on entity type
    if (entityType === "player" && (entity as any).base?.quaternion) {
      // For players, set on base and node
      const tempQuat = {
        x: 0,
        y: Math.sin(angle / 2),
        z: 0,
        w: Math.cos(angle / 2),
      };
      (entity as any).base.quaternion.set(
        tempQuat.x,
        tempQuat.y,
        tempQuat.z,
        tempQuat.w,
      );
      if ((entity as any).node?.quaternion) {
        (entity as any).node.quaternion.copy((entity as any).base.quaternion);
      }
    } else if (entity && (entity as any).node?.quaternion) {
      // For mobs and other entities, set on node
      const tempQuat = {
        x: 0,
        y: Math.sin(angle / 2),
        z: 0,
        w: Math.cos(angle / 2),
      };
      (entity as any).node.quaternion.set(
        tempQuat.x,
        tempQuat.y,
        tempQuat.z,
        tempQuat.w,
      );
    }

    // Mark network dirty
    (entity as any).markNetworkDirty?.();
  }

  private enterCombat(
    attackerId: EntityID,
    targetId: EntityID,
    attackerSpeedTicks?: number,
  ): void {
    const currentTick = this.world.currentTick;
    const combatEndTick = currentTick + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;

    // Detect entity types (don't assume attacker is always player!)
    const attackerEntity = this.world.entities.get(String(attackerId));
    const targetEntity = this.world.entities.get(String(targetId));

    // Don't enter combat if target is dead
    if (
      targetEntity &&
      "health" in targetEntity &&
      (targetEntity as any).health <= 0
    ) {
      return;
    }

    // Also check if target is a player marked as dead
    const playerSystem = this.world.getSystem?.("player") as any;
    if (playerSystem?.players) {
      const targetPlayer = playerSystem.players.get(String(targetId));
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
    this.combatStates.set(attackerId, {
      attackerId,
      targetId,
      attackerType,
      targetType,
      weaponType: AttackType.MELEE,
      inCombat: true,
      lastAttackTick: currentTick,
      nextAttackTick: currentTick + attackerAttackSpeedTicks,
      combatEndTick,
      attackSpeedTicks: attackerAttackSpeedTicks,
    });

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

      this.combatStates.set(targetId, {
        attackerId: targetId,
        targetId: attackerId,
        attackerType: targetType,
        targetType: attackerType,
        weaponType: AttackType.MELEE,
        inCombat: true,
        lastAttackTick: currentTick,
        nextAttackTick: currentTick + retaliationDelay,
        combatEndTick,
        attackSpeedTicks: targetAttackSpeedTicks,
      });
    }

    // Rotate both entities to face each other (RuneScape-style)
    this.rotateTowardsTarget(
      String(attackerId),
      String(targetId),
      attackerType,
      targetType,
    );
    this.rotateTowardsTarget(
      String(targetId),
      String(attackerId),
      targetType,
      attackerType,
    );

    // Sync combat state to player entities for client-side combat awareness
    this.syncCombatStateToEntity(
      String(attackerId),
      String(targetId),
      attackerType,
    );
    this.syncCombatStateToEntity(
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
    const combatState = this.combatStates.get(typedEntityId);
    if (!combatState) return;

    // Reset emotes for both entities
    // Skip attacker emote reset if requested (e.g., when target died during attack animation)
    if (!data.skipAttackerEmoteReset) {
      this.resetEmote(data.entityId, combatState.attackerType);
    }
    // Skip target emote reset if requested (e.g., when dead entity ends combat, don't reset their attacker)
    if (!data.skipTargetEmoteReset) {
      this.resetEmote(String(combatState.targetId), combatState.targetType);
    }

    // Clear combat state from player entities
    this.clearCombatStateFromEntity(data.entityId, combatState.attackerType);
    this.clearCombatStateFromEntity(
      String(combatState.targetId),
      combatState.targetType,
    );

    // Remove combat states
    this.combatStates.delete(typedEntityId);
    this.combatStates.delete(combatState.targetId);

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
    this.combatStates.delete(typedEntityId);

    // Also clear the dead entity's attack cooldown so they can attack immediately after respawn
    this.nextAttackTicks.delete(typedEntityId);

    // Clear any scheduled emote resets for the dead entity
    this.emoteResetTicks.delete(entityId);

    // Find all attackers targeting this dead entity
    // Their combat will naturally timeout after 4.8 seconds (8 ticks) since they got the last hit
    // This matches RuneScape behavior where health bars stay visible briefly after combat ends
    for (const [attackerId, state] of this.combatStates) {
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
    this.resetEmote(entityId, entityType as "player" | "mob");
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
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();

    const attackerTile = worldToTile(attackerPos.x, attackerPos.z);
    const targetTile = worldToTile(targetPos.x, targetPos.z);
    const combatRangeTiles = this.getEntityCombatRange(
      attacker,
      opts.attackerType,
    );
    if (!tilesWithinRange(attackerTile, targetTile, combatRangeTiles)) {
      return false;
    }

    // Start combat
    this.enterCombat(createEntityID(attackerId), createEntityID(targetId));
    return true;
  }

  public isInCombat(entityId: string): boolean {
    return this.combatStates.has(createEntityID(entityId));
  }

  public getCombatData(entityId: string): CombatData | null {
    return this.combatStates.get(createEntityID(entityId)) || null;
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
    this.combatStates.delete(typedPlayerId);

    // Clear player's attack cooldowns
    this.nextAttackTicks.delete(typedPlayerId);

    // Clear any scheduled emote resets
    this.emoteResetTicks.delete(playerId);

    // Clear player's equipment stats cache
    this.playerEquipmentStats.delete(playerId);

    // Find all entities that were targeting this disconnected player
    for (const [attackerId, state] of this.combatStates) {
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
        this.combatStates.delete(attackerId);

        // Clear combat state from entity if it's a player
        if (state.attackerType === "player") {
          this.clearCombatStateFromEntity(String(attackerId), "player");
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
        console.warn(
          `[CombatSystem] Player entity not found: ${entityId} (probably disconnected)`,
        );
        return null;
      }
      return player;
    }

    if (!this.entityManager) {
      console.warn("[CombatSystem] Entity manager not available");
      return null;
    }
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) {
      console.warn(`[CombatSystem] Entity not found: ${entityId}`);
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
    // This replaces setTimeout for more accurate OSRS-style animation synchronization
    for (const [entityId, resetData] of this.emoteResetTicks.entries()) {
      if (tickNumber >= resetData.tick) {
        this.resetEmote(entityId, resetData.entityType);
        this.emoteResetTicks.delete(entityId);
      }
    }

    // CRITICAL: Convert to array first to avoid iterator issues when deleting during iteration
    const statesToProcess = Array.from(this.combatStates.entries());

    // Process all active combat sessions
    for (const [entityId, combatState] of statesToProcess) {
      // CRITICAL: Re-check if this combat state still exists
      if (!this.combatStates.has(entityId)) {
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

      // Check if this entity can attack on this tick
      if (tickNumber >= combatState.nextAttackTick) {
        this.processAutoAttackOnTick(combatState, tickNumber);
      }
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
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();

    // MELEE: Must be within attacker's combat range (configurable per mob, minimum 1 tile)
    // OSRS-style: most mobs have 1 tile range, halberds have 2 tiles
    const attackerTile = worldToTile(attackerPos.x, attackerPos.z);
    const targetTile = worldToTile(targetPos.x, targetPos.z);
    const combatRangeTiles = this.getEntityCombatRange(
      attacker,
      combatState.attackerType,
    );
    if (!tilesWithinRange(attackerTile, targetTile, combatRangeTiles)) {
      // Out of melee range - don't end combat, just skip this attack
      return;
    }

    // OSRS-STYLE: Update entity facing to face target (RuneScape entities always face combat target)
    this.rotateTowardsTarget(
      attackerId,
      targetId,
      combatState.attackerType,
      combatState.targetType,
    );

    // Play attack animation once (will reset to idle after 2 ticks = 1.2 seconds)
    this.setCombatEmote(attackerId, combatState.attackerType);

    // Schedule tick-based emote reset (2 ticks for animation to complete)
    // OSRS-style: animations are synchronized to game ticks
    const resetTick = tickNumber + 2; // 2 ticks = 1200ms for animation
    this.emoteResetTicks.set(attackerId, {
      tick: resetTick,
      entityType: combatState.attackerType,
    });

    // MVP: Melee-only damage calculation
    const rawDamage = this.calculateMeleeDamage(attacker, target);

    // OSRS-STYLE: Cap damage at target's current health (no overkill)
    const currentHealth = this.getEntityHealth(target);
    const damage = Math.min(rawDamage, currentHealth);

    // Apply capped damage
    this.applyDamage(targetId, combatState.targetType, damage, attackerId);

    // Emit damage splatter event
    const targetPosition = target.position || target.getPosition();
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage, // Capped damage - matches actual damage applied
      targetType: combatState.targetType,
      position: targetPosition,
    });

    // Check if combat state still exists (target may have died)
    if (!this.combatStates.has(typedAttackerId)) {
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
            console.log(
              `[CombatSystem] Player ${entityId} weapon attackSpeed: ${weaponItem.attackSpeed} ticks`,
            );
            return weaponItem.attackSpeed;
          }

          // Fallback: look up from ITEMS map
          if (weaponItem.id) {
            const itemData = getItem(weaponItem.id);
            if (itemData?.attackSpeed) {
              console.log(
                `[CombatSystem] Player ${entityId} ITEMS lookup "${weaponItem.id}": ${itemData.attackSpeed} ticks`,
              );
              return itemData.attackSpeed;
            }
          }
        }
      }

      // Player with no weapon - use default
      console.log(
        `[CombatSystem] Player ${entityId} - no weapon or attackSpeed, using default`,
      );
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
          console.log(
            `[CombatSystem] Mob ${entityId} attackSpeedTicks: ${mobAttackSpeedTicks}`,
          );
          return mobAttackSpeedTicks;
        }
      }
    }

    // Default attack speed (4 ticks = 2.4 seconds)
    console.log(
      `[CombatSystem] ${entityType} ${entityId} using DEFAULT: ${COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS} ticks`,
    );
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
    // Clear all combat states
    this.combatStates.clear();

    // Clear all attack cooldowns (tick-based)
    this.nextAttackTicks.clear();

    // Clear scheduled emote resets
    this.emoteResetTicks.clear();

    // Call parent cleanup (handles autoCleanup)
    super.destroy();
  }
}
