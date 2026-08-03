/**
 * MeleeAttackHandler - Handles melee attack validation and execution.
 *
 * Extracted from CombatSystem to reduce class size.
 * Receives a CombatAttackContext to interact with system services.
 */

import type {
  CombatAttackContext,
  MeleeAttackData,
  AttackValidationResult,
} from "./AttackContext";
import type { Entity } from "../../../../entities/Entity";
import type { MobEntity } from "../../../../entities/npc/MobEntity";
import { EntityID } from "../../../../types/core/identifiers";
import { AttackType } from "../../../../types/core/core";
import { EventType } from "../../../../types/events";
import { createEntityID } from "../../../../utils/IdentifierUtils";
import {
  CombatViolationType,
  CombatViolationSeverity,
} from "../CombatAntiCheat";
import { getEntityPosition } from "../../../../utils/game/EntityPositionUtils";
import { tilesWithinMeleeRange } from "../../movement/TileSystem";
import { tilePool } from "../../../../utils/pools/TilePool";
import { isMobEntity } from "../../../../utils/typeGuards";
import type { CombatStyle } from "../../../../utils/game/CombatCalculations";

export class MeleeAttackHandler {
  constructor(private readonly ctx: CombatAttackContext) {}

  /**
   * Main melee attack handler - orchestrates validation and execution
   */
  handle(data: MeleeAttackData): void {
    const { attackerId, targetId, attackerType } = data;
    const currentTick = this.ctx.world.currentTick ?? 0;

    if (!this.ctx.entityIdValidator.isValid(attackerId)) {
      const sanitized =
        this.ctx.entityIdValidator.sanitizeForLogging(attackerId);
      this.ctx.logger.warn("Invalid attacker ID rejected", {
        attackerId: sanitized,
        reason: "invalid_format",
      });
      this.ctx.antiCheat.recordInvalidEntityId(
        String(attackerId).slice(0, 64),
        String(attackerId),
      );
      return;
    }

    if (!this.ctx.entityIdValidator.isValid(targetId)) {
      const sanitized = this.ctx.entityIdValidator.sanitizeForLogging(targetId);
      this.ctx.logger.warn("Invalid target ID rejected", {
        attackerId,
        targetId: sanitized,
        reason: "invalid_format",
      });
      this.ctx.antiCheat.recordInvalidEntityId(attackerId, String(targetId));
      return;
    }

    if (attackerType === "player") {
      const rateResult = this.ctx.rateLimiter.checkLimit(
        attackerId,
        currentTick,
      );
      if (!rateResult.allowed) {
        this.ctx.antiCheat.recordViolation(
          attackerId,
          CombatViolationType.ATTACK_RATE_EXCEEDED,
          CombatViolationSeverity.MINOR,
          `Melee rate limited: ${rateResult.reason}`,
          undefined,
          currentTick,
        );
        return;
      }
      this.ctx.antiCheat.trackAttack(attackerId, currentTick);

      // Validate attacker is on a walkable tile (anti-cheat)
      if (
        !this.ctx.validateAttackerPosition(
          attackerId,
          targetId,
          "Melee",
          currentTick,
        )
      )
        return;
    }

    // Validate the attack (entities exist, alive, in range, etc.)
    const validation = this.validateMeleeAttack(data, currentTick);
    if (!validation.valid) {
      return;
    }

    // Check cooldown before executing
    if (
      !this.ctx.checkAttackCooldown(validation.typedAttackerId!, currentTick)
    ) {
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
    const attacker = this.ctx.entityResolver.resolve(attackerId, attackerType);
    const target = this.ctx.entityResolver.resolve(targetId, targetType);

    // Check entities exist
    if (!attacker || !target) {
      if (attackerType === "player" && !target) {
        this.ctx.antiCheat.recordNonexistentTargetAttack(
          attackerId,
          targetId,
          currentTick,
        );
      }
      return invalidResult;
    }

    // Check attacker is alive
    if (!this.ctx.entityResolver.isAlive(attacker, attackerType)) {
      return invalidResult;
    }

    // Check target is alive
    if (!this.ctx.entityResolver.isAlive(target, targetType)) {
      if (attackerType === "player") {
        this.ctx.antiCheat.recordDeadTargetAttack(
          attackerId,
          targetId,
          currentTick,
        );
      }
      return invalidResult;
    }

    // Check target not in loading protection
    if (targetType === "player" && target.data?.isLoading) {
      if (attackerType === "player") {
        this.ctx.antiCheat.recordViolation(
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
    if (targetType === "mob" && isMobEntity(target)) {
      if (typeof target.isAttackable === "function" && !target.isAttackable()) {
        this.ctx.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
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
        this.ctx.antiCheat.recordSelfAttack(attackerId, currentTick);
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
   * classic MMORPG melee rules (from wiki):
   * - Range 1 (standard melee): Cardinal only (N/S/E/W) - NO diagonal attacks
   * - Range 2+ (halberd): Allows diagonal attacks
   *
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
    tilePool.setFromPosition(this.ctx._attackerTile, attackerPos);
    tilePool.setFromPosition(this.ctx._targetTile, targetPos);
    const combatRangeTiles = this.ctx.entityResolver.getCombatRange(
      attacker,
      attackerType,
    );

    // rules-accurate melee range check:
    // - Range 1: Cardinal only (N/S/E/W)
    // - Range 2+: Allows diagonal (Chebyshev distance)
    if (
      !tilesWithinMeleeRange(
        this.ctx._attackerTile,
        this.ctx._targetTile,
        combatRangeTiles,
      )
    ) {
      if (attackerType === "player") {
        const dx = Math.abs(this.ctx._attackerTile.x - this.ctx._targetTile.x);
        const dz = Math.abs(this.ctx._attackerTile.z - this.ctx._targetTile.z);
        const actualDistance = Math.max(dx, dz);
        this.ctx.antiCheat.recordOutOfRangeAttack(
          data.attackerId,
          data.targetId,
          actualDistance,
          combatRangeTiles,
          currentTick,
        );
      }

      this.ctx.emitTypedEvent(EventType.COMBAT_ATTACK_FAILED, {
        attackerId: data.attackerId,
        targetId: data.targetId,
        reason: "out_of_range",
      });
      return false;
    }
    return true;
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
    const attackSpeedTicks = this.ctx.entityResolver.getAttackSpeed(
      typedAttackerId,
      entityType,
    );

    // Face target
    this.ctx.rotationManager.rotateTowardsTarget(
      attackerId,
      targetId,
      attackerType,
      targetType,
    );

    // Play attack animation with attack speed for proper animation duration
    this.ctx.animationManager.setCombatEmote(
      attackerId,
      attackerType,
      currentTick,
      attackSpeedTicks,
    );

    // Claim cooldown immediately to prevent double-attack (parity with ranged/magic)
    this.ctx.nextAttackTicks.set(
      typedAttackerId,
      currentTick + attackSpeedTicks,
    );

    // Get player's combat style for rules-accurate damage bonuses
    let combatStyle: CombatStyle = "accurate";
    if (attackerType === "player") {
      const styleData =
        this.ctx.playerSystem?.getPlayerAttackStyle?.(attackerId);
      if (styleData?.id) {
        combatStyle = styleData.id as CombatStyle;
      }
    }

    // Calculate and apply damage
    const rawDamage = this.ctx.calculateMeleeDamage(
      attacker,
      target,
      combatStyle,
    );
    const currentHealth = this.ctx.entityResolver.getHealth(target);
    const damage = Math.min(rawDamage, currentHealth);

    this.ctx.applyDamage(targetId, targetType, damage, attackerId);

    // Emit damage event
    const targetPosition = getEntityPosition(target);
    this.ctx.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage,
      targetType,
      position: targetPosition,
    });

    // Enter combat state (skip if target died — death handler cleans up)
    if (this.ctx.entityResolver.isAlive(target, targetType)) {
      this.ctx.enterCombat(
        typedAttackerId,
        typedTargetId,
        attackSpeedTicks,
        AttackType.MELEE,
      );
    }
  }
}
