/**
 * CombatStateService - Combat state management
 *
 * Single Responsibility: Manage combat state data and entity sync
 * Handles the combatStates Map, entity sync, and state queries.
 */

import type { World } from "../../../core/World";
import { AttackType } from "../../../types/core/core";
import { EntityID } from "../../../types/core/identifiers";
import { createEntityID } from "../../../utils/IdentifierUtils";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";

/**
 * Combat data for a single combatant
 */
export interface CombatData {
  attackerId: EntityID;
  targetId: EntityID;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  weaponType: AttackType;
  inCombat: boolean;

  // TICK-BASED timing (OSRS-accurate)
  lastAttackTick: number;
  nextAttackTick: number;
  combatEndTick: number;
  attackSpeedTicks: number;
}

/**
 * Interface for player entity combat state
 */
interface CombatPlayerEntity {
  id: string;
  combat?: {
    inCombat: boolean;
    combatTarget: string | null;
  };
  data?: {
    c?: boolean;
    ct?: string | null;
  };
  markNetworkDirty?: () => void;
}

export class CombatStateService {
  private world: World;
  private combatStates = new Map<EntityID, CombatData>();

  // Reusable buffer to avoid allocation during iteration
  private combatStateBuffer: Array<[EntityID, CombatData]> = [];

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Check if entity is in combat
   */
  isInCombat(entityId: string): boolean {
    return this.combatStates.has(createEntityID(entityId));
  }

  /**
   * Get combat data for an entity
   */
  getCombatData(entityId: string): CombatData | null {
    return this.combatStates.get(createEntityID(entityId)) || null;
  }

  /**
   * Get all combat states (for iteration)
   * Returns reusable buffer to avoid allocations
   */
  getAllCombatStates(): Array<[EntityID, CombatData]> {
    this.combatStateBuffer.length = 0;
    for (const entry of this.combatStates.entries()) {
      this.combatStateBuffer.push(entry);
    }
    return this.combatStateBuffer;
  }

  /**
   * Get the underlying Map (for direct iteration when needed)
   */
  getCombatStatesMap(): Map<EntityID, CombatData> {
    return this.combatStates;
  }

  /**
   * Set combat state for an entity
   */
  setCombatState(entityId: EntityID, data: CombatData): void {
    this.combatStates.set(entityId, data);
  }

  /**
   * Remove combat state for an entity
   */
  removeCombatState(entityId: EntityID): void {
    this.combatStates.delete(entityId);
  }

  /**
   * Create combat state for attacker
   */
  createAttackerState(
    attackerId: EntityID,
    targetId: EntityID,
    attackerType: "player" | "mob",
    targetType: "player" | "mob",
    currentTick: number,
    attackSpeedTicks: number,
  ): CombatData {
    const combatEndTick = currentTick + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;

    const state: CombatData = {
      attackerId,
      targetId,
      attackerType,
      targetType,
      weaponType: AttackType.MELEE,
      inCombat: true,
      lastAttackTick: currentTick,
      nextAttackTick: currentTick + attackSpeedTicks,
      combatEndTick,
      attackSpeedTicks,
    };

    this.combatStates.set(attackerId, state);
    return state;
  }

  /**
   * Create combat state for retaliating target
   */
  createRetaliatorState(
    targetId: EntityID,
    attackerId: EntityID,
    targetType: "player" | "mob",
    attackerType: "player" | "mob",
    currentTick: number,
    retaliationDelay: number,
    attackSpeedTicks: number,
  ): CombatData {
    const combatEndTick = currentTick + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;

    const state: CombatData = {
      attackerId: targetId,
      targetId: attackerId,
      attackerType: targetType,
      targetType: attackerType,
      weaponType: AttackType.MELEE,
      inCombat: true,
      lastAttackTick: currentTick,
      nextAttackTick: currentTick + retaliationDelay,
      combatEndTick,
      attackSpeedTicks,
    };

    this.combatStates.set(targetId, state);
    return state;
  }

  /**
   * Update combat end tick (for extending combat timer on hit)
   */
  extendCombatTimer(entityId: EntityID, currentTick: number): void {
    const state = this.combatStates.get(entityId);
    if (state) {
      state.combatEndTick = currentTick + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;
    }
  }

  /**
   * Sync combat state to player entity for client-side awareness
   */
  syncCombatStateToEntity(
    entityId: string,
    targetId: string,
    entityType: "player" | "mob",
  ): void {
    if (entityType !== "player") return;

    const playerEntity = this.world.getPlayer?.(
      entityId,
    ) as CombatPlayerEntity | null;

    if (!playerEntity) return;

    // Set combat property if it exists (legacy support)
    if (playerEntity.combat) {
      playerEntity.combat.inCombat = true;
      playerEntity.combat.combatTarget = targetId;
    }

    // ALWAYS set in data for network sync (abbreviated keys for efficiency)
    if (playerEntity.data) {
      playerEntity.data.c = true;
      playerEntity.data.ct = targetId;

      // Send immediate network update when combat starts
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: entityId,
          c: true,
          ct: targetId,
        });
      }
    }

    playerEntity.markNetworkDirty?.();
  }

  /**
   * Clear combat state from player entity when combat ends
   */
  clearCombatStateFromEntity(
    entityId: string,
    entityType: "player" | "mob",
  ): void {
    if (entityType !== "player") return;

    const playerEntity = this.world.getPlayer?.(
      entityId,
    ) as CombatPlayerEntity | null;

    if (!playerEntity) return;

    // Clear combat property if it exists (legacy support)
    if (playerEntity.combat) {
      playerEntity.combat.inCombat = false;
      playerEntity.combat.combatTarget = null;
    }

    // ALWAYS clear in data for network sync (abbreviated keys)
    if (playerEntity.data) {
      playerEntity.data.c = false;
      playerEntity.data.ct = null;

      // Send immediate network update when combat ends
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: entityId,
          c: false,
          ct: null,
        });
      }
    }

    playerEntity.markNetworkDirty?.();
  }

  /**
   * Get all attackers targeting a specific entity
   */
  getAttackersTargeting(entityId: string): EntityID[] {
    const attackers: EntityID[] = [];
    for (const [attackerId, state] of this.combatStates) {
      if (String(state.targetId) === entityId) {
        attackers.push(attackerId);
      }
    }
    return attackers;
  }

  /**
   * Clear all combat state for cleanup
   */
  destroy(): void {
    this.combatStates.clear();
    this.combatStateBuffer.length = 0;
  }
}
