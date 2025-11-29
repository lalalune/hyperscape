/**
 * Combat Utilities
 *
 * Helper functions for combat operations including stats retrieval,
 * range checking, damage application, and entity validation.
 */

import type { World } from "../../types";
import { EventType } from "../../types/events";
import { calculateDistance, getEntityWithComponent } from "../game/EntityUtils";
import {
  worldToTile,
  tilesAdjacent,
} from "../../systems/shared/movement/TileSystem";

// Import proper health and skill structures
import type {
  CanAttackResult,
  CombatAttackResult,
} from "../../types/game/combat-types";
import type { Player } from "../../types/core/core";
import { StatsComponent } from "../../components/StatsComponent";

/**
 * Safe stats component access
 */
export function getEntityStats(
  world: World,
  entityId: string,
): StatsComponent | null {
  const result = getEntityWithComponent<StatsComponent>(
    world,
    entityId,
    "stats",
  );
  return result?.component || null;
}

/**
 * Check if entity is alive
 */
export function isEntityAlive(world: World, entityId: string): boolean {
  const stats = getEntityStats(world, entityId);
  return stats && stats.health ? stats.health.current > 0 : false;
}

/**
 * Check if entity is in combat range
 *
 * OSRS-STYLE MELEE: Must be on adjacent tile (Chebyshev distance = 1)
 * RANGED: Uses world unit distance (10 units)
 */
export function isInCombatRange(
  world: World,
  attackerId: string,
  targetId: string,
  combatType: "melee" | "ranged" = "melee",
): boolean {
  const attackerResult = getEntityWithComponent(world, attackerId, "stats");
  const targetResult = getEntityWithComponent(world, targetId, "stats");

  if (!attackerResult || !targetResult) return false;

  // Validate positions before calculating distance
  if (!attackerResult.entity.position || !targetResult.entity.position) {
    console.warn(
      `[CombatUtils] isInCombatRange called with null/undefined positions`,
    );
    return false;
  }

  if (combatType === "melee") {
    // OSRS-STYLE: Melee requires adjacent tile (Chebyshev distance = 1)
    const attackerTile = worldToTile(
      attackerResult.entity.position.x,
      attackerResult.entity.position.z,
    );
    const targetTile = worldToTile(
      targetResult.entity.position.x,
      targetResult.entity.position.z,
    );
    return tilesAdjacent(attackerTile, targetTile);
  } else {
    // Ranged uses world distance
    const distance = calculateDistance(
      attackerResult.entity.position,
      targetResult.entity.position,
    );
    const rangedRange = 10.0;
    return distance <= rangedRange;
  }
}

/**
 * Calculate damage dealt in combat using StatsComponent
 * Note: This is a simplified version. For full damage calculation, use calculateDamage from CombatCalculations.ts
 */
export function calculateComponentDamage(
  attackerStats: StatsComponent,
  defenderStats: StatsComponent,
  weaponDamage: number = 0,
): number {
  if (!attackerStats || !defenderStats) return 0;

  // Base damage calculation
  const baseDamage = (attackerStats.strength?.level || 1) + weaponDamage;
  const defense = defenderStats.defense?.level || 1;

  // Simple damage reduction formula
  const damageReduction = defense / (defense + 100);
  const finalDamage = Math.max(
    1,
    Math.floor(baseDamage * (1 - damageReduction)),
  );

  return finalDamage;
}

/**
 * Apply damage to entity with validation
 */
export function applyDamage(
  world: World,
  targetId: string,
  damage: number,
  source?: string,
): boolean {
  const stats = getEntityStats(world, targetId);
  if (!stats || damage <= 0) return false;

  if (stats.health) {
    // Floor to ensure health is always an integer
    stats.health.current = Math.floor(
      Math.max(0, stats.health.current - damage),
    );
  }

  // Emit damage event for systems to handle
  if (world.events) {
    world.emit(EventType.ENTITY_DAMAGED, {
      entityId: targetId,
      damage,
      sourceId: source,
      remainingHealth: stats.health?.current || 0,
      isDead: stats.health?.current === 0,
    });
  }

  return true;
}

/**
 * Heal entity with validation
 */
export function healEntity(
  world: World,
  targetId: string,
  healAmount: number,
): boolean {
  const stats = getEntityStats(world, targetId);
  if (!stats || healAmount <= 0) return false;

  const oldHealth = stats.health?.current || 0;
  if (stats.health) {
    // Floor to ensure health is always an integer
    stats.health.current = Math.floor(
      Math.min(stats.health.max, stats.health.current + healAmount),
    );
  }
  const actualHeal = (stats.health?.current || 0) - oldHealth;

  if (actualHeal > 0 && world.events) {
    world.emit(EventType.ENTITY_HEALED, {
      entityId: targetId,
      healAmount: actualHeal,
      newHealth: stats.health?.current || 0,
    });
  }

  return actualHeal > 0;
}

/**
 * Check if entity can attack (cooldown, alive, etc.)
 */
export function canEntityAttack(
  world: World,
  entityId: string,
  targetId: string,
): CanAttackResult {
  const attacker = getEntityWithComponent<StatsComponent>(
    world,
    entityId,
    "stats",
  );
  const target = getEntityWithComponent<StatsComponent>(
    world,
    targetId,
    "stats",
  );

  if (!attacker) {
    return { canAttack: false, reason: "Attacker not found" };
  }

  if (!target) {
    return { canAttack: false, reason: "Target not found" };
  }

  if (!attacker.component.health || attacker.component.health.current <= 0) {
    return { canAttack: false, reason: "Attacker is dead" };
  }

  if (!target.component.health || target.component.health.current <= 0) {
    return { canAttack: false, reason: "Target is dead" };
  }

  if (!isInCombatRange(world, entityId, targetId)) {
    return { canAttack: false, reason: "Target out of range" };
  }

  return { canAttack: true };
}

/**
 * Get combat-relevant entities in range
 */
export function getCombatTargetsInRange(
  world: World,
  entityId: string,
  range: number = 10.0,
  _includeAllies: boolean = false,
): string[] {
  const sourceEntity = getEntityWithComponent(world, entityId, "stats");
  if (!sourceEntity) return [];

  const targets: string[] = [];

  if (!world.entities || !world.entities.values) return targets;

  for (const entity of world.entities.values()) {
    if (entity.id === entityId) continue; // Skip self

    const stats = Object.prototype.hasOwnProperty.call(entity, "getComponent")
      ? (
          entity as { getComponent: (type: string) => StatsComponent | null }
        ).getComponent("stats")
      : null;
    if (!stats || !stats.health || stats.health.current <= 0) continue; // Skip dead entities

    // Validate positions before calculating distance
    if (!sourceEntity.entity.position || !entity.position) {
      console.warn(
        `[CombatUtils] Skipping entity ${entity.id} - invalid position data`,
      );
      continue;
    }

    // Check if positions have valid coordinates
    const sourcePos = sourceEntity.entity.position;
    const targetPos = entity.position;
    if (
      typeof sourcePos.x !== "number" ||
      typeof sourcePos.y !== "number" ||
      typeof sourcePos.z !== "number" ||
      typeof targetPos.x !== "number" ||
      typeof targetPos.y !== "number" ||
      typeof targetPos.z !== "number"
    ) {
      console.warn(
        `[CombatUtils] Skipping entity ${entity.id} - malformed position coordinates`,
        {
          sourcePos: { x: sourcePos?.x, y: sourcePos?.y, z: sourcePos?.z },
          targetPos: { x: targetPos?.x, y: targetPos?.y, z: targetPos?.z },
        },
      );
      continue;
    }

    const distance = calculateDistance(sourcePos, targetPos);
    if (distance <= range) {
      // Currently all players are hostile to mobs (no faction system in current GDD)
      targets.push(entity.id);
    }
  }

  return targets;
}

/**
 * Execute combat attack between entities
 */
export function executeCombatAttack(
  world: World,
  attackerId: string,
  targetId: string,
  weaponDamage: number = 0,
): CombatAttackResult {
  const canAttackResult = canEntityAttack(world, attackerId, targetId);
  if (!canAttackResult.canAttack) {
    return { success: false, reason: canAttackResult.reason };
  }

  const attackerStats = getEntityStats(world, attackerId);
  const targetStats = getEntityStats(world, targetId);

  if (!attackerStats || !targetStats) {
    return { success: false, reason: "Invalid combat entities" };
  }

  const damage = calculateComponentDamage(
    attackerStats,
    targetStats,
    weaponDamage,
  );
  const damageApplied = applyDamage(world, targetId, damage, attackerId);

  if (damageApplied && world.events) {
    world.emit(EventType.COMBAT_ATTACK, {
      attackerId,
      targetId,
      damage,
      targetHealth: targetStats.health?.current || 0,
      targetDied: targetStats.health?.current === 0,
    });
  }

  return { success: damageApplied, damage };
}

export function hasEquippedWeapon(player: Player): boolean {
  return !!player.equipment?.weapon;
}

export function canUseRanged(player: Player): boolean {
  return (
    hasEquippedWeapon(player) &&
    (player.equipment?.weapon?.name?.includes("bow") || false) &&
    !!player.equipment?.arrows
    // Note: Arrow count should be checked in inventory, not on the item itself
  );
}

// Helper functions for common operations
export function getHealthPercentage(player: Player): number {
  return (player.health.current / player.health.max) * 100;
}

export function getStaminaPercentage(player: Player): number {
  return (player.stamina.current / player.stamina.max) * 100;
}

export function isAlive(player: Player): boolean {
  return player.alive && player.health.current > 0;
}

export function isDead(player: Player): boolean {
  return !player.alive || player.health.current <= 0;
}
