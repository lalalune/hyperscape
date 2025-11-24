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
} from "../../../utils/game/CombatCalculations";
import { createEntityID } from "../../../utils/IdentifierUtils";
import { EntityManager } from "..";
import { MobNPCSystem } from "..";
import { SystemBase } from "..";
import { Emotes } from "../../../data/playerEmotes";

export interface CombatData {
  attackerId: EntityID;
  targetId: EntityID;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  weaponType: AttackType;
  inCombat: boolean;
  lastAttackTime: number;
  combatEndTime?: number; // When combat should timeout
}

export class CombatSystem extends SystemBase {
  private combatStates = new Map<EntityID, CombatData>();
  private attackCooldowns = new Map<EntityID, number>();
  private mobSystem?: MobNPCSystem;
  private entityManager?: EntityManager;

  // Equipment stats cache per player for damage calculations
  private playerEquipmentStats = new Map<
    string,
    { attack: number; strength: number; defense: number; ranged: number }
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
    this.subscribe<{
      attackerId: string;
      targetId: string;
      attackerType: "player" | "mob";
      targetType: "player" | "mob";
    }>(EventType.COMBAT_RANGED_ATTACK, (data) => {
      this.handleRangedAttack(data);
    });
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
        console.log(
          `[CombatSystem] 📊 Equipment stats updated for ${data.playerId}:`,
          data.equipmentStats,
        );
        this.playerEquipmentStats.set(data.playerId, data.equipmentStats);
      },
    );
  }

  private handleAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    attackType: AttackType;
  }): void {
    // Delegate to appropriate attack handler
    if (data.attackType === AttackType.RANGED) {
      this.handleRangedAttack(data);
    } else {
      this.handleMeleeAttack(data);
    }
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

    // CRITICAL: Check if target is already dead BEFORE processing attack (Issue #265)
    // This prevents attacks from being processed on dead entities
    if (!this.isEntityAlive(target, targetType)) {
      return;
    }

    // Check if in melee range (use 2D distance to avoid Y terrain height issues)
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();
    const distance2D = calculateDistance2D(attackerPos, targetPos);

    if (distance2D > COMBAT_CONSTANTS.MELEE_RANGE) {
      this.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
        attackerId,
        targetId,
        reason: "out_of_range",
      });
      return;
    }

    // Check attack cooldown with entity's actual attack speed
    const now = Date.now();
    const lastAttack = this.attackCooldowns.get(typedAttackerId) || 0;
    const entityType = attacker.type === "mob" ? "mob" : "player";
    const attackSpeed = this.getAttackSpeed(typedAttackerId, entityType);

    if (isAttackOnCooldown(lastAttack, now, attackSpeed)) {
      return; // Still on cooldown
    }

    // Play attack animation once (will reset to idle after 1000ms)
    this.setCombatEmote(attackerId, attackerType);

    // Reset emote back to idle after animation plays (RuneScape-style one-shot animation)
    setTimeout(() => {
      this.resetEmote(attackerId, attackerType);
    }, 1000); // 1000ms for full combat/sword animation to play

    // Calculate damage
    const damage = this.calculateMeleeDamage(attacker, target);

    // Get target's current health to cap damage display at remaining HP
    const currentHealth = this.getEntityHealth(target);
    const displayDamage = Math.min(damage, currentHealth);

    // Apply damage
    this.applyDamage(targetId, targetType, damage, attackerId);

    // CRITICAL: ALWAYS emit damage splatter event (including for killing blow - RuneScape shows final damage)
    const targetPosition = target.position || target.getPosition();
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage: displayDamage,
      targetType,
      position: targetPosition,
    });

    // CRITICAL: Check if target died from this attack - if so, skip remaining combat logic (Issue #265)
    // We already emitted the damage event above so player sees the killing blow
    const targetStillAlive = this.isEntityAlive(target, targetType);
    if (!targetStillAlive) {
      return; // Target died, don't update cooldowns or combat state
    }

    // Set attack cooldown
    this.attackCooldowns.set(typedAttackerId, now);

    // Enter combat state
    this.enterCombat(typedAttackerId, typedTargetId);
  }

  private handleRangedAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType?: "player" | "mob";
    targetType?: "player" | "mob";
  }): void {
    const {
      attackerId,
      targetId,
      attackerType = "player",
      targetType = "mob",
    } = data;

    // Convert IDs to typed IDs
    const typedAttackerId = createEntityID(attackerId);
    const typedTargetId = createEntityID(targetId);

    // Get attacker and target
    const attacker = this.getEntity(attackerId, attackerType);
    const target = this.getEntity(targetId, targetType);

    // Check entities exist
    if (!attacker || !target) {
      return;
    }

    // CRITICAL: Check if target is already dead BEFORE processing attack (Issue #265)
    // This prevents attacks from being processed on dead entities
    if (!this.isEntityAlive(target, targetType)) {
      return;
    }

    // Check if in ranged range
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();
    const distance = calculateDistance3D(attackerPos, targetPos);
    if (distance > COMBAT_CONSTANTS.RANGED_RANGE) {
      this.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
        attackerId,
        targetId,
        reason: "out_of_range",
      });
      return;
    }

    // Check for arrows (if player)
    if (attackerType === "player") {
      // This would check equipment system for arrows
      // For now, assume arrows are available
    }

    // Check attack cooldown with entity's actual attack speed
    const now = Date.now();
    const lastAttack = this.attackCooldowns.get(typedAttackerId) || 0;
    const entityType = attacker.type === "mob" ? "mob" : "player";
    const attackSpeed = this.getAttackSpeed(typedAttackerId, entityType);

    if (isAttackOnCooldown(lastAttack, now, attackSpeed)) {
      return; // Still on cooldown
    }

    // Play attack animation once (will reset to idle after 1000ms)
    this.setCombatEmote(attackerId, attackerType);

    // Reset emote back to idle after animation plays (RuneScape-style one-shot animation)
    setTimeout(() => {
      this.resetEmote(attackerId, attackerType);
    }, 1000); // 1000ms for full bow/ranged animation to play

    // Calculate damage
    const damage = this.calculateRangedDamage(attacker, target);

    // Get target's current health to cap damage display at remaining HP
    const currentHealth = this.getEntityHealth(target);
    const displayDamage = Math.min(damage, currentHealth);

    // Apply damage
    this.applyDamage(targetId, targetType, damage, attackerId);

    // CRITICAL: ALWAYS emit damage splatter event (including for killing blow - RuneScape shows final damage)
    const targetPosition = target.position || target.getPosition();
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage: displayDamage,
      targetType,
      position: targetPosition,
    });

    // CRITICAL: Check if target died from this attack - if so, skip remaining combat logic (Issue #265)
    // We already emitted the damage event above so player sees the killing blow
    const targetStillAlive = this.isEntityAlive(target, targetType);
    if (!targetStillAlive) {
      return; // Target died, don't update cooldowns or combat state
    }

    // Set attack cooldown
    this.attackCooldowns.set(typedAttackerId, now);

    // Enter combat state
    this.enterCombat(typedAttackerId, typedTargetId);
  }

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
    console.log(
      `[CombatSystem] 🎲 CALCULATING MELEE DAMAGE: ${attacker.id} -> ${target.id}`,
    );

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

    console.log(
      `[CombatSystem] ⚔️ MELEE RESULT: damage=${result.damage}, didHit=${result.didHit}`,
    );

    return result.damage;
  }

  private calculateRangedDamage(
    attacker: Entity | MobEntity | null,
    target: Entity | MobEntity | null,
  ): number {
    if (!attacker || !target) return 1;

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
      AttackType.RANGED,
      equipmentStats,
    );
    return result.damage;
  }

  private applyDamage(
    targetId: string,
    targetType: string,
    damage: number,
    attackerId: string,
  ): void {
    // CRITICAL DEBUG: Log all damage applications
    console.log(
      `[CombatSystem] 🔴 APPLYING DAMAGE: ${damage} to ${targetType} ${targetId} from ${attackerId}`,
    );

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
        console.log(
          `[CombatSystem] 📤 Emitted MOB_NPC_ATTACKED event for ${targetId}`,
        );
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
    // (handleMeleeAttack, handleRangedAttack, processAutoAttack) to ensure
    // they're emitted even for 0 damage hits
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
            console.log(
              `[CombatSystem] ✅ Sent immediate c: true for player ${entityId} entering combat`,
            );
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
            console.log(
              `[CombatSystem] ✅ Sent immediate c: false for player ${entityId}`,
            );
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

        console.log(`[CombatSystem] 🗡️ Checking combat emote for ${entityId}`);

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
          console.log(`[CombatSystem] 🗡️ Equipment from system:`, !!equipment);
          console.log(
            `[CombatSystem] 🗡️ Weapon from system:`,
            !!equipment?.weapon,
          );
          console.log(
            `[CombatSystem] 🗡️ Weapon item from system:`,
            !!equipment?.weapon?.item,
          );

          if (equipment?.weapon?.item) {
            const weaponItem = equipment.weapon.item;
            console.log(
              `[CombatSystem] 🗡️ Weapon item:`,
              JSON.stringify(weaponItem, null, 2),
            );
            console.log(`[CombatSystem] 🗡️ weaponType:`, weaponItem.weaponType);

            // Check if the weapon is a sword
            if (weaponItem.weaponType === "SWORD") {
              combatEmote = "sword_swing";
              console.log(
                `[CombatSystem] ✅ SWORD detected! Using sword_swing emote`,
              );
            } else {
              console.log(
                `[CombatSystem] ❌ Not a sword, weaponType: ${weaponItem.weaponType}`,
              );
            }
          } else {
            console.log(`[CombatSystem] ❌ No weapon equipped, using punch`);
          }
        } else {
          console.warn(
            `[CombatSystem] ⚠️ EquipmentSystem not found or missing getPlayerEquipment`,
          );
        }

        console.log(`[CombatSystem] 🗡️ Final emote: ${combatEmote}`);

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

  private enterCombat(attackerId: EntityID, targetId: EntityID): void {
    const now = Date.now();
    const combatEndTime = now + COMBAT_CONSTANTS.COMBAT_TIMEOUT_MS;

    // Detect entity types (don't assume attacker is always player!)
    const attackerEntity = this.world.entities.get(String(attackerId));
    const targetEntity = this.world.entities.get(String(targetId));

    // Don't enter combat if target is dead
    if (
      targetEntity &&
      "health" in targetEntity &&
      (targetEntity as any).health <= 0
    ) {
      console.log(
        `[CombatSystem] Target ${targetId} is dead (health ${(targetEntity as any).health}), aborting combat`,
      );
      return;
    }

    // Also check if target is a player marked as dead
    const playerSystem = this.world.getSystem?.("player") as any;
    if (playerSystem?.players) {
      const targetPlayer = playerSystem.players.get(String(targetId));
      if (targetPlayer && !targetPlayer.alive) {
        console.log(
          `[CombatSystem] Target player ${targetId} is dead (alive=${targetPlayer.alive}), aborting combat`,
        );
        return;
      }
    }

    const attackerType =
      attackerEntity?.type === "mob" ? ("mob" as const) : ("player" as const);
    const targetType =
      targetEntity?.type === "mob" ? ("mob" as const) : ("player" as const);

    // Set combat state for attacker
    this.combatStates.set(attackerId, {
      attackerId,
      targetId,
      attackerType,
      targetType,
      weaponType: AttackType.MELEE,
      inCombat: true,
      lastAttackTime: now,
      combatEndTime,
    });

    // Set combat state for target (auto-retaliate)
    // ALTERNATING ATTACKS: Offset target's lastAttackTime so attacks alternate
    // Calculate offset based on BOTH combatants' attack speeds for proper alternation
    const attackerSpeed = this.getAttackSpeed(attackerId, attackerType);
    const targetSpeed = this.getAttackSpeed(targetId, targetType);
    const averageSpeed = (attackerSpeed + targetSpeed) / 2;
    const attackOffset = averageSpeed / 2; // Target attacks halfway between attacker's attacks

    this.combatStates.set(targetId, {
      attackerId: targetId,
      targetId: attackerId,
      attackerType: targetType,
      targetType: attackerType,
      weaponType: AttackType.MELEE,
      inCombat: true,
      lastAttackTime: now - attackOffset, // Offset based on actual attack speeds
      combatEndTime,
    });

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

    // Find all attackers targeting this dead entity
    // Their combat will naturally timeout after 4.8 seconds (8 ticks) since they got the last hit
    // This matches RuneScape behavior where health bars stay visible briefly after combat ends
    for (const [attackerId, state] of this.combatStates) {
      if (String(state.targetId) === entityId) {
        // Mark this combat state as having a dead target
        // The update loop will let it timeout naturally after COMBAT_TIMEOUT_MS
        console.log(
          `[CombatSystem] ${attackerId} was attacking dead entity ${entityId}, combat will timeout naturally in ${COMBAT_CONSTANTS.COMBAT_TIMEOUT_MS}ms`,
        );
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

    // Check range
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();
    const distance = calculateDistance3D(attackerPos, targetPos);

    const maxRange =
      opts.weaponType === AttackType.RANGED
        ? COMBAT_CONSTANTS.RANGED_RANGE
        : COMBAT_CONSTANTS.MELEE_RANGE;
    if (distance > maxRange) {
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

  // Combat update loop - handles auto-attack and combat timeouts
  update(_dt: number): void {
    const now = Date.now();

    // CRITICAL: Convert to array first to avoid iterator issues when deleting during iteration
    // When a player dies, handleEntityDied() deletes multiple entries, but the for...of loop
    // has already captured the entries and will continue processing deleted ones
    const statesToProcess = Array.from(this.combatStates.entries());

    // Process all active combat sessions
    for (const [entityId, combatState] of statesToProcess) {
      // CRITICAL: Re-check if this combat state still exists (might have been deleted by previous iteration)
      if (!this.combatStates.has(entityId)) {
        continue;
      }

      // Check for combat timeout first
      if (
        combatState.inCombat &&
        combatState.combatEndTime &&
        now >= combatState.combatEndTime
      ) {
        const entityIdStr = String(entityId);
        this.endCombat({ entityId: entityIdStr });
        continue;
      }

      // Skip if not in combat or doesn't have valid target
      if (!combatState.inCombat || !combatState.targetId) continue;

      // Auto-attack: continuously attack target while in range and combat is active
      this.processAutoAttack(combatState, now);
    }
  }

  /**
   * Process auto-attack for a combatant
   * This creates the continuous attack loop that makes combat feel like RuneScape
   */
  private processAutoAttack(combatState: CombatData, now: number): void {
    const attackerId = String(combatState.attackerId);
    const targetId = String(combatState.targetId);

    // Use combatState.lastAttackTime for cooldown check to respect alternating attack offset
    const lastAttack = combatState.lastAttackTime;

    // CRITICAL: Use entity's ACTUAL attack speed for cooldown check
    const attackSpeed = this.getAttackSpeed(
      combatState.attackerId,
      combatState.attackerType,
    );

    if (isAttackOnCooldown(lastAttack, now, attackSpeed)) {
      return; // Still on cooldown
    }

    // Also update the global cooldown map for consistency
    const typedAttackerId = combatState.attackerId;

    const attacker = this.getEntity(attackerId, combatState.attackerType);
    const target = this.getEntity(targetId, combatState.targetType);

    // CRITICAL FIX FOR ISSUE #269: RuneScape-style combat timer
    // If entity not found (dead mob, disconnected player, etc.), DON'T end combat immediately
    // Let the 4.8 second timeout expire naturally to keep health bars visible
    // This matches OSRS behavior where health bars stay visible for 8 ticks after combat ends
    if (!attacker || !target) {
      // Skip this auto-attack iteration - combat will end naturally when timer expires
      return;
    }

    // Check if attacker is still alive (prevent dead attackers from auto-attacking)
    const attackerAlive = this.isEntityAlive(
      attacker,
      combatState.attackerType,
    );
    if (!attackerAlive) {
      // CRITICAL FIX FOR ISSUE #269: RuneScape-style combat timer
      // Don't end combat immediately when attacker dies - let the 4.8 second timer expire naturally
      // This keeps the health bar visible for 4.8 seconds after the last hit (8 ticks in OSRS)
      // Just skip this auto-attack and let the update loop's timeout mechanism handle ending combat
      return;
    }

    // Check if target is still alive
    const targetAlive = this.isEntityAlive(target, combatState.targetType);
    if (!targetAlive) {
      // CRITICAL FIX FOR ISSUE #269: RuneScape-style combat timer
      // Don't end combat immediately when target dies - let the 4.8 second timer expire naturally
      // This keeps the health bar visible for 4.8 seconds after the last hit (8 ticks in OSRS)
      // Just skip this auto-attack and let the update loop's timeout mechanism handle ending combat
      return;
    }

    // Check range (use 2D distance to avoid Y terrain height issues)
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();
    const distance2D = calculateDistance2D(attackerPos, targetPos);

    const maxRange =
      combatState.weaponType === AttackType.RANGED
        ? COMBAT_CONSTANTS.RANGED_RANGE
        : COMBAT_CONSTANTS.MELEE_RANGE;

    if (distance2D > maxRange) {
      // Out of range - don't end combat, just skip this attack
      // Player might be moving back into range
      return;
    }

    // Note: Rotation handled client-side in PlayerLocal/PlayerRemote/MobEntity clientUpdate
    // They check inCombat/combatTarget and rotate every frame for smooth tracking

    // Play attack animation once (will reset to idle after 1000ms)
    this.setCombatEmote(attackerId, combatState.attackerType);

    // Reset emote back to idle after animation plays (RuneScape-style one-shot animation)
    setTimeout(() => {
      this.resetEmote(attackerId, combatState.attackerType);
    }, 1000); // 1000ms for full combat/sword animation to play

    // Calculate and apply damage
    const damage =
      combatState.weaponType === AttackType.RANGED
        ? this.calculateRangedDamage(attacker, target)
        : this.calculateMeleeDamage(attacker, target);

    // Get target's current health to cap damage display at remaining HP
    const currentHealth = this.getEntityHealth(target);
    const displayDamage = Math.min(damage, currentHealth);

    this.applyDamage(targetId, combatState.targetType, damage, attackerId);

    // CRITICAL: ALWAYS emit damage splatter event (including for killing blow - RuneScape shows final damage)
    const targetPosition = target.position || target.getPosition();
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage: displayDamage, // Capped to remaining HP
      targetType: combatState.targetType,
      position: targetPosition,
    });

    // CRITICAL: Check if target died from this attack - if so, combat state was deleted by handleEntityDied() (Issue #265)
    // We already emitted the damage event above so player sees the killing blow
    // Now we skip updating cooldowns and combat state since combat has ended
    const combatStateStillExists = this.combatStates.has(typedAttackerId);
    if (!combatStateStillExists) {
      return; // Combat ended, don't update cooldowns or combat state
    }

    // Set attack cooldown to prevent bypass
    this.attackCooldowns.set(typedAttackerId, now);

    // Update last attack time
    combatState.lastAttackTime = now;
    combatState.combatEndTime = now + COMBAT_CONSTANTS.COMBAT_TIMEOUT_MS; // Extend combat timeout

    // Emit attack event for visual feedback
    const attackEvent =
      combatState.weaponType === AttackType.RANGED
        ? EventType.COMBAT_RANGED_ATTACK
        : EventType.COMBAT_MELEE_ATTACK;

    this.emitTypedEvent(attackEvent, {
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
   * Get attack speed in milliseconds for an entity
   */
  private getAttackSpeed(entityId: EntityID, entityType: string): number {
    const entity = this.getEntity(String(entityId), entityType);
    if (!entity) return COMBAT_CONSTANTS.ATTACK_COOLDOWN_MS;

    // Check equipment for weapon attack speed
    const equipmentComponent = entity.getComponent("equipment");
    if (equipmentComponent?.data?.weapon) {
      const weapon = equipmentComponent.data.weapon as { attackSpeed?: number };
      if (weapon.attackSpeed) {
        return weapon.attackSpeed;
      }
    }

    // Check mob attack speed
    const mobEntity = entity as MobEntity;
    if (mobEntity.getMobData) {
      const mobData = mobEntity.getMobData();
      const mobAttackSpeed = (mobData as { attackSpeed?: number }).attackSpeed;
      if (mobAttackSpeed) {
        return mobAttackSpeed * 1000; // Convert seconds to ms
      }
    }

    // Default attack speed (RuneScape-style 2.4 seconds for most weapons)
    return COMBAT_CONSTANTS.ATTACK_COOLDOWN_MS;
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

    // Clear all attack cooldowns
    this.attackCooldowns.clear();
    // Call parent cleanup (handles autoCleanup)
    super.destroy();
  }
}
