/**
 * CombatSystem - Handles all combat mechanics
 */

import { EventType } from "../types/events";
import type { World } from "../World";
import { COMBAT_CONSTANTS } from "../constants/CombatConstants";
import { AttackType, MobInstance } from "../types/core";
import { EntityID } from "../types/identifiers";
import { MobEntity } from "../entities/MobEntity";
import { MobAIState } from "../types/entities";
import { Entity } from "../entities/Entity";
import { PlayerSystem } from "./PlayerSystem";
import {
  calculateDamage,
  calculateDistance2D,
  calculateDistance3D,
  CombatStats,
  isAttackOnCooldown,
} from "../utils/CombatCalculations";
import { createEntityID } from "../utils/IdentifierUtils";
import { EntityManager } from "./EntityManager";
import { MobNPCSystem } from "./MobNPCSystem";
import { SystemBase } from "./SystemBase";
import { Emotes } from "../extras/playerEmotes";

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
        "[CombatSystem] EntityManager not found - required dependency"
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
      }
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
      }
    );

    // Listen for death events to end combat
    this.subscribe(EventType.NPC_DIED, (data: { mobId: string }) => {
      this.handleEntityDied(data.mobId, "mob");
    });
    this.subscribe(EventType.PLAYER_DIED, (data: { playerId: string }) => {
      this.handleEntityDied(data.playerId, "player");
    });
    // Also listen for ENTITY_DEATH to catch all entity destructions
    this.subscribe(EventType.ENTITY_DEATH, (data: { entityId: string; entityType: string }) => {
      this.handleEntityDied(data.entityId, data.entityType);
    });
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
      console.warn(
        `[CombatSystem] Cannot start melee attack - entity not found`
      );
      return;
    }

    // Check if target is already dead (for mobs)
    if (targetType === "mob") {
      const mobEntity = target as MobEntity;
      if (mobEntity.isDead()) {
        console.warn(`[CombatSystem] Cannot attack dead mob ${targetId}`);
        return;
      }
    }

    // Check if in melee range (use 2D distance to avoid Y terrain height issues)
    const attackerPos = attacker.position || attacker.getPosition();
    const targetPos = target.position || target.getPosition();
    const distance2D = calculateDistance2D(attackerPos, targetPos);
    const distance3D = calculateDistance3D(attackerPos, targetPos);

    console.log(`[CombatSystem] Melee attack range check: 2D=${distance2D.toFixed(2)}, 3D=${distance3D.toFixed(2)}, limit=${COMBAT_CONSTANTS.MELEE_RANGE}`);

    if (distance2D > COMBAT_CONSTANTS.MELEE_RANGE) {
      console.warn(`[CombatSystem] Attack out of range (${distance2D.toFixed(2)} > ${COMBAT_CONSTANTS.MELEE_RANGE})`);
      this.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
        attackerId,
        targetId,
        reason: "out_of_range",
      });
      return;
    }

    // Check attack cooldown
    const now = Date.now();
    const lastAttack = this.attackCooldowns.get(typedAttackerId) || 0;
    if (isAttackOnCooldown(lastAttack, now)) {
      return; // Still on cooldown
    }

    // Calculate damage
    const damage = this.calculateMeleeDamage(attacker, target);

    // Apply damage
    this.applyDamage(targetId, targetType, damage, attackerId);

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
      console.warn(
        `[CombatSystem] Cannot start ranged attack - entity not found`
      );
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

    // Check attack cooldown
    const now = Date.now();
    const lastAttack = this.attackCooldowns.get(typedAttackerId) || 0;
    if (isAttackOnCooldown(lastAttack, now)) {
      return; // Still on cooldown
    }

    // Calculate damage
    const damage = this.calculateRangedDamage(attacker, target);

    // Apply damage
    this.applyDamage(targetId, targetType, damage, attackerId);

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
    target: Entity | MobEntity
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
        config: { attackPower: mobData.attackPower },
      };
    } else {
      // Handle player or other Entity - get stats from components
      const statsComponent = attacker.getComponent("stats");
      if (statsComponent?.data) {
        attackerData = { stats: statsComponent.data };
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
        targetData = { stats: statsComponent.data };
      }
    }

    const result = calculateDamage(attackerData, targetData, AttackType.MELEE);
    return result.damage;
  }

  private calculateRangedDamage(
    attacker: Entity | MobEntity | null,
    target: Entity | MobEntity | null
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
        attackerData = { stats: statsComponent.data };
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
        targetData = { stats: statsComponent.data };
      }
    }

    const result = calculateDamage(attackerData, targetData, AttackType.RANGED);
    return result.damage;
  }

  private applyDamage(
    targetId: string,
    targetType: string,
    damage: number,
    attackerId: string
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
      if (!damaged) {
        console.error(`[CombatSystem] Failed to damage player ${targetId}`);
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
        console.warn(`[CombatSystem] Mob entity not found for ${targetId} - may have been destroyed`);
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
          attackerId: attackerId
        });
        console.log(`[CombatSystem] 📤 Emitted MOB_NPC_ATTACKED event for ${targetId}`);
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

    // Emit combat damage event for visual effects (damage numbers)
    this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage,
      targetType,
    });
  }

  /**
   * Sync combat state to player entity for client-side awareness
   */
  private syncCombatStateToEntity(entityId: string, targetId: string, entityType: "player" | "mob"): void {
    if (entityType === "player") {
      const playerEntity = this.world.getPlayer?.(entityId);
      if (playerEntity && (playerEntity as any).combat) {
        // Set combat state so client knows we're in combat
        (playerEntity as any).combat.inCombat = true;
        (playerEntity as any).combat.combatTarget = targetId;

        // Also set in data for network sync
        if ((playerEntity as any).data) {
          (playerEntity as any).data.inCombat = true;
          (playerEntity as any).data.combatTarget = targetId;
        }

        (playerEntity as any).markNetworkDirty?.();
        console.log(`[CombatSystem] Synced combat state to player ${entityId}: inCombat=true, target=${targetId}`);
      }
    }
  }

  /**
   * Clear combat state from player entity when combat ends
   */
  private clearCombatStateFromEntity(entityId: string, entityType: "player" | "mob"): void {
    if (entityType === "player") {
      const playerEntity = this.world.getPlayer?.(entityId);
      if (playerEntity && (playerEntity as any).combat) {
        (playerEntity as any).combat.inCombat = false;
        (playerEntity as any).combat.combatTarget = null;

        // Also clear in data for network sync
        if ((playerEntity as any).data) {
          (playerEntity as any).data.inCombat = false;
          (playerEntity as any).data.combatTarget = null;
        }

        (playerEntity as any).markNetworkDirty?.();
        console.log(`[CombatSystem] Cleared combat state from player ${entityId}`);
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
        console.log(`[CombatSystem] Player entity structure:`, {
          hasEmoteProperty: 'emote' in playerEntity,
          hasDataProperty: 'data' in playerEntity,
          dataEBefore: (playerEntity as any).data?.e,
          hasMarkNetworkDirty: 'markNetworkDirty' in playerEntity,
        });

        // Set emote STRING KEY (players use 'combat' string which gets mapped to URL)
        if ((playerEntity as any).emote !== undefined) {
          (playerEntity as any).emote = 'combat';
        }
        if ((playerEntity as any).data) {
          (playerEntity as any).data.e = 'combat';
        }
        // Don't set avatar directly - let PlayerLocal's modify() handle the mapping

        console.log(`[CombatSystem] After setting:`, {
          emote: (playerEntity as any).emote,
          dataE: (playerEntity as any).data?.e,
        });

        // Check if player is in world.entities
        const inEntities = this.world.entities.has(entityId);
        console.log(`[CombatSystem] Player ${entityId} in world.entities:`, inEntities);
        if (!inEntities) {
          console.log(`[CombatSystem] ❌ Player ${entityId} NOT in world.entities! Network sync will fail.`);
        }

        (playerEntity as any).markNetworkDirty?.();
        console.log(`[CombatSystem] Set COMBAT emote for player ${entityId}`);
      }
    } else if (entityType === "mob") {
      // For mobs, override the AI state emote temporarily for one-shot attack animation
      const mobEntity = this.world.entities.get(entityId);
      if (mobEntity) {
        // Set combat emote URL (not just string 'combat')
        if ((mobEntity as any).emote !== undefined) {
          (mobEntity as any).emote = Emotes.COMBAT;
        }
        if ((mobEntity as any).data) {
          (mobEntity as any).data.e = Emotes.COMBAT;
        }
        if ((mobEntity as any).avatar?.setEmote) {
          (mobEntity as any).avatar.setEmote(Emotes.COMBAT);
        }
        (mobEntity as any).markNetworkDirty?.();
        console.log(`[CombatSystem] Set COMBAT emote for mob ${entityId}`);
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
          (playerEntity as any).emote = 'idle';
        }
        if ((playerEntity as any).data) {
          (playerEntity as any).data.e = 'idle';
        }
        // Don't set avatar directly - let PlayerLocal's modify() handle the mapping
        (playerEntity as any).markNetworkDirty?.();
        console.log(`[CombatSystem] Reset to IDLE emote for player ${entityId}`);
      }
    } else if (entityType === "mob") {
      const mobEntity = this.world.entities.get(entityId);
      if (mobEntity) {
        // Reset to idle URL (not just string 'idle')
        if ((mobEntity as any).emote !== undefined) {
          (mobEntity as any).emote = Emotes.IDLE;
        }
        if ((mobEntity as any).data) {
          (mobEntity as any).data.e = Emotes.IDLE;
        }
        if ((mobEntity as any).avatar?.setEmote) {
          (mobEntity as any).avatar.setEmote(Emotes.IDLE);
        }
        (mobEntity as any).markNetworkDirty?.();
        console.log(`[CombatSystem] Reset to IDLE emote for mob ${entityId}`);
      }
    }
  }

  /**
   * Rotate an entity to face a target (RuneScape-style instant rotation)
   */
  private rotateTowardsTarget(entityId: string, targetId: string, entityType: "player" | "mob", targetType: "player" | "mob"): void {
    console.log(`[CombatSystem] rotateTowardsTarget called: ${entityType} ${entityId} → ${targetType} ${targetId}`);

    // Get entities properly based on type
    const entity = entityType === "player" ? this.world.getPlayer?.(entityId) : this.world.entities.get(entityId);
    const target = targetType === "player" ? this.world.getPlayer?.(targetId) : this.world.entities.get(targetId);

    console.log(`[CombatSystem] Entity found:`, !!entity, entity ? `at (${(entity as any).position?.x}, ${(entity as any).position?.z})` : 'null');
    console.log(`[CombatSystem] Target found:`, !!target, target ? `at (${(target as any).position?.x}, ${(target as any).position?.z})` : 'null');

    if (!entity || !target) {
      console.warn(`[CombatSystem] ❌ Cannot rotate: entity or target not found`);
      return;
    }

    const entityPos = entity.position || ((entity as any).getPosition?.() || entity);
    const targetPos = target.position || ((target as any).getPosition?.() || target);

    // Calculate angle to target (XZ plane only)
    const dx = targetPos.x - entityPos.x;
    const dz = targetPos.z - entityPos.z;
    const angle = Math.atan2(dx, dz);

    // Set rotation differently based on entity type
    if (entityType === "player" && (entity as any).base?.quaternion) {
      // For players, set on base and node
      const tempQuat = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
      (entity as any).base.quaternion.set(tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w);
      if ((entity as any).node?.quaternion) {
        (entity as any).node.quaternion.copy((entity as any).base.quaternion);
      }
      console.log(`[CombatSystem] Rotated player ${entityId} to face target (angle: ${(angle * 180 / Math.PI).toFixed(1)}°)`);
    } else if (entity && (entity as any).node?.quaternion) {
      // For mobs and other entities, set on node
      const tempQuat = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
      (entity as any).node.quaternion.set(tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w);
      console.log(`[CombatSystem] Rotated mob ${entityId} to face target (angle: ${(angle * 180 / Math.PI).toFixed(1)}°)`);
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

    const attackerType =
      attackerEntity?.type === "mob" ? ("mob" as const) : ("player" as const);
    const targetType =
      targetEntity?.type === "mob" ? ("mob" as const) : ("player" as const);

    console.log(`[CombatSystem] ============ ENTER COMBAT ============`);
    console.log(`[CombatSystem] Attacker: ${attackerType} ${attackerId}`);
    console.log(`[CombatSystem] Target: ${targetType} ${targetId}`);
    console.log(`[CombatSystem] AttackerEntity exists:`, !!attackerEntity);
    console.log(`[CombatSystem] TargetEntity exists:`, !!targetEntity);

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

    console.log(`[CombatSystem] ✓ Created combat state for attacker ${attackerId}`);

    // Set combat state for target (auto-retaliate)
    // ALTERNATING ATTACKS: Offset target's lastAttackTime by half cooldown so attacks alternate
    // This creates RuneScape-style back-and-forth combat (goblin -> player -> goblin -> etc.)
    this.combatStates.set(targetId, {
      attackerId: targetId,
      targetId: attackerId,
      attackerType: targetType,
      targetType: attackerType,
      weaponType: AttackType.MELEE,
      inCombat: true,
      lastAttackTime: now - (COMBAT_CONSTANTS.ATTACK_COOLDOWN_MS / 2), // Wait half cooldown before retaliating
      combatEndTime,
    });

    console.log(`[CombatSystem] ✓ Created auto-retaliate combat state for target ${targetId}`);

    // Rotate both entities to face each other (RuneScape-style)
    this.rotateTowardsTarget(String(attackerId), String(targetId), attackerType, targetType);
    this.rotateTowardsTarget(String(targetId), String(attackerId), targetType, attackerType);

    // Sync combat state to player entities for client-side combat awareness
    this.syncCombatStateToEntity(String(attackerId), String(targetId), attackerType);
    this.syncCombatStateToEntity(String(targetId), String(attackerId), targetType);

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

  private endCombat(data: { entityId: string }): void {
    // Validate entity ID before processing
    if (!data.entityId) {
      return;
    }

    const typedEntityId = createEntityID(data.entityId);
    const combatState = this.combatStates.get(typedEntityId);
    if (!combatState) return;

    console.log(`[CombatSystem] endCombat: ${combatState.attackerType} ${data.entityId}`);

    // Reset emotes for both entities
    this.resetEmote(data.entityId, combatState.attackerType);
    this.resetEmote(String(combatState.targetId), combatState.targetType);

    // Clear combat state from player entities
    this.clearCombatStateFromEntity(data.entityId, combatState.attackerType);
    this.clearCombatStateFromEntity(String(combatState.targetId), combatState.targetType);

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
   * Handle entity death - end all combat involving this entity
   */
  private handleEntityDied(entityId: string, entityType: string): void {
    console.log(`[CombatSystem] Entity ${entityId} (${entityType}) died, ending combat`);
    const typedEntityId = createEntityID(entityId);

    // End combat for this entity
    const combatState = this.combatStates.get(typedEntityId);
    if (combatState) {
      this.endCombat({ entityId });
    }

    // Also end combat for anyone attacking this entity
    for (const [attackerId, state] of this.combatStates) {
      if (String(state.targetId) === entityId) {
        this.endCombat({ entityId: String(attackerId) });
      }
    }
  }

  // Public API methods
  public startCombat(
    attackerId: string,
    targetId: string,
    options?: {
      attackerType?: "player" | "mob";
      targetType?: "player" | "mob";
      weaponType?: AttackType;
    }
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

  public forceEndCombat(entityId: string): void {
    this.endCombat({ entityId });
  }

  private getEntity(
    entityId: string,
    entityType: string
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
          `[CombatSystem] Player entity not found: ${entityId} (probably disconnected)`
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

    // Process all active combat sessions
    for (const [entityId, combatState] of this.combatStates) {
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
    // Use combatState.lastAttackTime for cooldown check to respect alternating attack offset
    const lastAttack = combatState.lastAttackTime;

    if (isAttackOnCooldown(lastAttack, now)) {
      return; // Still on cooldown
    }

    // Also update the global cooldown map for consistency
    const typedAttackerId = combatState.attackerId;

    console.log(`[CombatSystem] processAutoAttack: ${combatState.attackerType} ${combatState.attackerId} → ${combatState.targetType} ${combatState.targetId}`);

    // Get attacker and target entities
    const attackerId = String(combatState.attackerId);
    const targetId = String(combatState.targetId);

    const attacker = this.getEntity(attackerId, combatState.attackerType);
    const target = this.getEntity(targetId, combatState.targetType);

    // Entity not found (disconnected player, despawned mob, etc.) - end combat
    if (!attacker || !target) {
      this.endCombat({ entityId: attackerId });
      return;
    }

    // Check if attacker is still alive (prevent dead attackers from auto-attacking)
    if (!this.isEntityAlive(attacker, combatState.attackerType)) {
      console.log(`[CombatSystem] Attacker ${attackerId} is dead, ending combat`);
      this.endCombat({ entityId: attackerId });
      return;
    }

    // Check if target is still alive
    if (!this.isEntityAlive(target, combatState.targetType)) {
      this.endCombat({ entityId: attackerId });
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
      console.log(`[CombatSystem] Auto-attack out of range (${distance2D.toFixed(2)} > ${maxRange})`);
      // Out of range - don't end combat, just skip this attack
      // Player might be moving back into range
      return;
    }

    // All checks passed - execute auto-attack
    console.log(`[CombatSystem] ⚔️ Executing auto-attack: ${combatState.attackerType} ${attackerId} → ${combatState.targetType} ${targetId}`);

    // Play attack animation once (will reset to idle after 600ms)
    this.setCombatEmote(attackerId, combatState.attackerType);

    // Reset emote back to idle after animation plays (RuneScape-style one-shot animation)
    setTimeout(() => {
      this.resetEmote(attackerId, combatState.attackerType);
    }, 600); // 600ms is enough for the punch animation to play once

    // Calculate and apply damage
    const damage =
      combatState.weaponType === AttackType.RANGED
        ? this.calculateRangedDamage(attacker, target)
        : this.calculateMeleeDamage(attacker, target);

    console.log(`[CombatSystem] Calculated damage: ${damage}`);

    this.applyDamage(targetId, combatState.targetType, damage, attackerId);

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
    entityType: string
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
      // Check mob health - but don't log death messages here
      // Death detection and cleanup is handled by EntityManager
      const mob = entity as MobEntity;
      
      // Check if mob is marked as dead
      if (mob.isDead()) {
        console.log(`[CombatSystem] Mob ${mob.id} is dead (isDead() check)`);
        return false;
      }
      
      // Check mob data if available
      if (mob.getMobData) {
        const mobData = mob.getMobData();
        const isAlive = mobData.health > 0;
        console.log(`[CombatSystem] Mob ${mob.id} health check: ${mobData.health} (alive: ${isAlive})`);
        return isAlive;
      }
      
      // Fallback to health check
      const mobHealth = mob.getHealth();
      console.log(`[CombatSystem] Mob ${mob.id} fallback health check: ${mobHealth}`);
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
