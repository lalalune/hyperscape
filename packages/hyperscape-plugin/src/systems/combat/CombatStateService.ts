/**
 * CombatStateService - Combat state management
 *
 * Single Responsibility: Manage combat state data and entity sync
 * Handles the combatStates Map, entity sync, and state queries.
 */

import type { World } from "@hyperforge/shared";
import { AttackType } from "@hyperforge/shared";
import { EntityID } from "@hyperforge/shared";
import { createEntityID } from "@hyperforge/shared";
import { getCombatTimeoutTicks } from "@hyperforge/shared";
import { Logger } from "@hyperforge/shared";

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

  // TICK-BASED timing (tile-based-MMORPG-accurate)
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
    pendingAttacker?: string | null; // Stores attacker ID when auto-retaliate is OFF
  };
  data?: {
    c?: boolean;
    ct?: string | null;
    pa?: string | null; // Pending attacker (abbreviated for network efficiency)
  };
  markNetworkDirty?: () => void;
}

export class CombatStateService {
  private world: World;
  private combatStates = new Map<EntityID, CombatData>();

  /**
   * Pre-allocated buffer for getAllCombatStates()
   *
   * ALLOCATION-FREE DESIGN:
   * - Buffer array grows to accommodate peak concurrent combatants
   * - Tuple objects [EntityID, CombatData] are pre-allocated and reused
   * - forEach() avoids Map.entries() tuple allocation overhead
   * - In steady state: ZERO allocations per tick
   *
   * Memory behavior:
   * - Initial: Empty array
   * - Growth: Allocates new tuples only when more combatants than ever before
   * - Shrink: Array length shrinks but V8 preserves internal capacity
   * - Steady state: All allocations amortized, zero per-tick GC pressure
   */
  private combatStateBuffer: Array<[EntityID, CombatData]> = [];

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Check if entity is in combat
   * @param entityId - Entity ID (accepts both EntityID and string for backwards compatibility)
   */
  isInCombat(entityId: EntityID | string): boolean {
    const typedId =
      typeof entityId === "string" ? createEntityID(entityId) : entityId;
    return this.combatStates.has(typedId);
  }

  /**
   * Get combat data for an entity
   * @param entityId - Entity ID (accepts both EntityID and string for backwards compatibility)
   */
  getCombatData(entityId: EntityID | string): CombatData | null {
    const typedId =
      typeof entityId === "string" ? createEntityID(entityId) : entityId;
    return this.combatStates.get(typedId) || null;
  }

  /**
   * Get all combat states for iteration (ALLOCATION-FREE in steady state)
   *
   * Returns a reusable buffer of pre-allocated tuples. The buffer and its
   * tuple objects are reused across calls to eliminate per-tick GC pressure.
   *
   * IMPORTANT: The returned array is mutated on each call. Do not store
   * references to it or its contents across tick boundaries.
   *
   * @returns Reusable buffer - valid only until next call
   */
  getAllCombatStates(): Array<[EntityID, CombatData]> {
    const size = this.combatStates.size;

    // Grow buffer capacity if needed (allocations amortized over time)
    // Pre-allocate tuple objects so we can reuse them
    while (this.combatStateBuffer.length < size) {
      // These tuples are allocated once and reused forever
      this.combatStateBuffer.push([
        "" as EntityID,
        null as unknown as CombatData,
      ]);
    }

    // Populate existing tuples in-place using forEach (avoids entries() tuple allocation)
    let i = 0;
    this.combatStates.forEach((value, key) => {
      const tuple = this.combatStateBuffer[i];
      tuple[0] = key;
      tuple[1] = value;
      i++;
    });

    // Truncate to active count (V8 preserves internal capacity)
    this.combatStateBuffer.length = i;

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
    weaponType: AttackType = AttackType.MELEE,
  ): CombatData {
    const combatEndTick = currentTick + getCombatTimeoutTicks();

    const state: CombatData = {
      attackerId,
      targetId,
      attackerType,
      targetType,
      weaponType,
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
    weaponType: AttackType = AttackType.MELEE,
  ): CombatData {
    const combatEndTick = currentTick + getCombatTimeoutTicks();

    const state: CombatData = {
      attackerId: targetId,
      targetId: attackerId,
      attackerType: targetType,
      targetType: attackerType,
      weaponType,
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
      state.combatEndTick = currentTick + getCombatTimeoutTicks();
    }
  }

  /**
   * Sync combat state to player entity for client-side awareness
   * @param entityId - Entity ID (accepts both EntityID and string for backwards compatibility)
   * @param targetId - Target ID (accepts both EntityID and string for backwards compatibility)
   */
  syncCombatStateToEntity(
    entityId: EntityID | string,
    targetId: EntityID | string,
    entityType: "player" | "mob",
  ): void {
    if (entityType !== "player") return;

    const entityIdStr = String(entityId);
    const targetIdStr = String(targetId);

    const playerEntity = this.world.getPlayer?.(
      entityIdStr,
    ) as CombatPlayerEntity | null;

    if (!playerEntity) return;

    // Set combat property if it exists (legacy support)
    if (playerEntity.combat) {
      playerEntity.combat.inCombat = true;
      playerEntity.combat.combatTarget = targetIdStr;
    }

    // ALWAYS set in data for network sync (abbreviated keys for efficiency)
    if (playerEntity.data) {
      playerEntity.data.c = true;
      playerEntity.data.ct = targetIdStr;

      // Send immediate network update when combat starts
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: entityIdStr,
          c: true,
          ct: targetIdStr,
        });
      }
    }

    playerEntity.markNetworkDirty?.();
  }

  /**
   * Mark player as in combat but without a target (tile-based MMORPG auto-retaliate OFF behavior)
   * Player is being attacked but won't fight back - still triggers combat timer
   * Stores attackerId so we can start combat if auto-retaliate is toggled ON
   * @param entityId - Entity ID (accepts both EntityID and string for backwards compatibility)
   * @param attackerId - Attacker ID (accepts both EntityID and string for backwards compatibility)
   */
  markInCombatWithoutTarget(
    entityId: EntityID | string,
    attackerId?: EntityID | string,
  ): void {
    const entityIdStr = String(entityId);
    const attackerIdStr = attackerId ? String(attackerId) : null;

    const playerEntity = this.world.getPlayer?.(
      entityIdStr,
    ) as CombatPlayerEntity | null;

    if (!playerEntity) return;

    // Set combat property if it exists (legacy support)
    if (playerEntity.combat) {
      playerEntity.combat.inCombat = true;
      playerEntity.combat.combatTarget = null;
      // Store attacker for potential retaliation if auto-retaliate is toggled ON
      playerEntity.combat.pendingAttacker = attackerIdStr;
    }

    // ALWAYS set in data for network sync (abbreviated keys for efficiency)
    if (playerEntity.data) {
      playerEntity.data.c = true;
      playerEntity.data.ct = null;
      // Store pending attacker (pa) for auto-retaliate toggle
      playerEntity.data.pa = attackerIdStr;

      // Send immediate network update
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: entityIdStr,
          c: true,
          ct: null,
        });
      }
    }

    playerEntity.markNetworkDirty?.();
  }

  /**
   * Clear combat state from player entity when combat ends
   * @param entityId - Entity ID (accepts both EntityID and string for backwards compatibility)
   */
  clearCombatStateFromEntity(
    entityId: EntityID | string,
    entityType: "player" | "mob",
  ): void {
    if (entityType !== "player") return;

    const entityIdStr = String(entityId);

    const playerEntity = this.world.getPlayer?.(
      entityIdStr,
    ) as CombatPlayerEntity | null;

    if (!playerEntity) {
      // Log warning - client won't receive c:false and health bar may persist
      // Client-side fallback timer will handle this case
      Logger.systemWarn(
        "CombatStateService",
        `clearCombatStateFromEntity: player ${entityIdStr} not found, c:false will not be sent`,
      );
      return;
    }

    // Clear combat property if it exists (legacy support)
    if (playerEntity.combat) {
      playerEntity.combat.inCombat = false;
      playerEntity.combat.combatTarget = null;
      playerEntity.combat.pendingAttacker = null;
    }

    // ALWAYS clear in data for network sync (abbreviated keys)
    if (playerEntity.data) {
      playerEntity.data.c = false;
      playerEntity.data.ct = null;
      playerEntity.data.pa = null;

      // Send immediate network update when combat ends
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: entityIdStr,
          c: false,
          ct: null,
        });
      }
    }

    playerEntity.markNetworkDirty?.();
  }

  /**
   * Get all attackers targeting a specific entity
   * @param entityId - Entity ID (accepts both EntityID and string for backwards compatibility)
   */
  getAttackersTargeting(entityId: EntityID | string): EntityID[] {
    const entityIdStr = String(entityId);
    const attackers: EntityID[] = [];
    for (const [attackerId, state] of this.combatStates) {
      if (String(state.targetId) === entityIdStr) {
        attackers.push(attackerId);
      }
    }
    return attackers;
  }

  /**
   * Clear all combat states where the target is the specified entity.
   * Used when an entity dies or respawns to ensure no attackers retain stale targeting.
   *
   * This is critical for death/respawn behavior:
   * - When a player dies, all attackers targeting them must have their combat states cleared
   * - When a player respawns, any lingering states from before death must be purged
   * - Without this, attackers would continue chasing dead/respawned entities
   *
   * @param targetEntityId - The entity ID that was being targeted
   * @returns Array of attacker IDs whose states were cleared (for logging/debugging)
   */
  clearStatesTargeting(targetEntityId: EntityID | string): EntityID[] {
    const targetIdStr = String(targetEntityId);
    const clearedAttackers: EntityID[] = [];

    // Collect IDs first to avoid mutating Map during iteration
    for (const [attackerId, state] of this.combatStates) {
      if (String(state.targetId) === targetIdStr) {
        clearedAttackers.push(attackerId);
      }
    }

    for (const attackerId of clearedAttackers) {
      const state = this.combatStates.get(attackerId);
      if (state) {
        this.combatStates.delete(attackerId);
        this.clearCombatStateFromEntity(attackerId, state.attackerType);
      }
    }

    return clearedAttackers;
  }

  /**
   * Clear all combat state for cleanup
   */
  destroy(): void {
    this.combatStates.clear();
    this.combatStateBuffer.length = 0;
  }
}
