/**
 * CombatAnimationManager - Combat emotes and animations
 *
 * Single Responsibility: Manage combat animations and emote timing
 * Handles setting attack emotes and scheduling tick-aligned resets.
 */

import type { World } from "../../../core/World";
import { Emotes } from "../../../data/playerEmotes";

/**
 * Interface for player entity properties accessed for emote management
 */
interface AnimatablePlayerEntity {
  emote?: string;
  data?: {
    e?: string; // emote (abbreviated for network)
  };
  combat?: {
    combatTarget: string | null;
  };
  markNetworkDirty?: () => void;
}

/**
 * Interface for mob entity with optional setServerEmote method
 */
interface AnimatableMobEntity {
  setServerEmote?: (emote: string) => void;
}

/**
 * Data for scheduled emote reset
 */
interface EmoteResetData {
  tick: number;
  entityType: "player" | "mob";
}

/**
 * Equipment system interface for weapon checks
 */
interface EquipmentSystemLike {
  getPlayerEquipment?: (playerId: string) => {
    weapon?: { item?: { weaponType?: string; id?: string } };
  };
}

export class CombatAnimationManager {
  private world: World;
  private emoteResetTicks = new Map<string, EmoteResetData>();

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Set combat emote for an entity and schedule reset
   * @param entityId - Entity to animate
   * @param entityType - Whether entity is player or mob
   * @param currentTick - Current game tick for scheduling reset
   * @param attackSpeedTicks - Attack speed in ticks (default 4 = 2.4s)
   */
  setCombatEmote(
    entityId: string,
    entityType: "player" | "mob",
    currentTick: number,
    attackSpeedTicks: number = 4,
  ): void {
    if (entityType === "player") {
      this.setPlayerCombatEmote(entityId);
    } else {
      this.setMobCombatEmote(entityId);
    }

    // Issue #340: Hold combat pose until 1 tick before next attack
    // Minimum 2 ticks to ensure animation plays, but scale with attack speed
    const resetTick = currentTick + Math.max(2, attackSpeedTicks - 1);
    this.emoteResetTicks.set(entityId, {
      tick: resetTick,
      entityType,
    });
  }

  /**
   * Process scheduled emote resets for this tick
   * Called by CombatSystem.processCombatTick()
   */
  processEmoteResets(currentTick: number): void {
    for (const [entityId, resetData] of this.emoteResetTicks.entries()) {
      if (currentTick >= resetData.tick) {
        this.resetEmote(entityId, resetData.entityType);
        this.emoteResetTicks.delete(entityId);
      }
    }
  }

  /**
   * Cancel any pending emote reset for an entity
   * Used when entity dies or disconnects
   */
  cancelEmoteReset(entityId: string): void {
    this.emoteResetTicks.delete(entityId);
  }

  /**
   * Get pending emote reset data (for migration from CombatSystem)
   */
  getEmoteResetTicks(): Map<string, EmoteResetData> {
    return this.emoteResetTicks;
  }

  /**
   * Set emote reset data (for migration from CombatSystem)
   */
  setEmoteResetData(entityId: string, data: EmoteResetData): void {
    this.emoteResetTicks.set(entityId, data);
  }

  /**
   * Set combat emote for a player entity
   */
  private setPlayerCombatEmote(entityId: string): void {
    const playerEntity = this.world.getPlayer?.(
      entityId,
    ) as AnimatablePlayerEntity | null;

    if (!playerEntity) return;

    // Determine emote based on equipped weapon
    let combatEmote = "combat"; // Default to punching

    // Get equipment from EquipmentSystem (source of truth)
    const equipmentSystem = this.world.getSystem("equipment") as
      | EquipmentSystemLike
      | undefined;

    if (equipmentSystem?.getPlayerEquipment) {
      const equipment = equipmentSystem.getPlayerEquipment(entityId);

      if (equipment?.weapon?.item) {
        const weaponItem = equipment.weapon.item;
        if (weaponItem.weaponType === "SWORD") {
          combatEmote = "sword_swing";
        }
      }
    }

    // Set emote string key
    if (playerEntity.emote !== undefined) {
      playerEntity.emote = combatEmote;
    }
    if (playerEntity.data) {
      playerEntity.data.e = combatEmote;
    }

    // Send immediate network update BEFORE damage is applied
    // This ensures emote update arrives at clients BEFORE any death events
    if (this.world.isServer && this.world.network?.send) {
      this.world.network.send("entityModified", {
        id: entityId,
        e: combatEmote,
        c: true, // Send inCombat state immediately
        ct: playerEntity.combat?.combatTarget || null,
      });
    }

    playerEntity.markNetworkDirty?.();
  }

  /**
   * Set combat emote for a mob entity
   */
  private setMobCombatEmote(entityId: string): void {
    // For mobs, send one-shot combat animation via setServerEmote()
    // Client returns to AI-state-based animation after
    const mobEntity = this.world.entities.get(entityId) as
      | AnimatableMobEntity
      | undefined;

    if (mobEntity?.setServerEmote) {
      mobEntity.setServerEmote(Emotes.COMBAT);
    }
  }

  /**
   * Reset entity emote to idle
   * Called internally by processEmoteResets and externally by CombatSystem
   * when combat ends or entity dies
   */
  resetEmote(entityId: string, entityType: "player" | "mob"): void {
    if (entityType === "player") {
      const playerEntity = this.world.getPlayer?.(
        entityId,
      ) as AnimatablePlayerEntity | null;

      if (playerEntity) {
        // Reset to idle string key
        if (playerEntity.emote !== undefined) {
          playerEntity.emote = "idle";
        }
        if (playerEntity.data) {
          playerEntity.data.e = "idle";
        }

        // Send immediate network update
        // NOTE: Don't send c: false - combat may still be active
        if (this.world.isServer && this.world.network?.send) {
          this.world.network.send("entityModified", {
            id: entityId,
            e: "idle",
          });
        }

        playerEntity.markNetworkDirty?.();
      }
    }
    // DON'T reset mob emotes - let client's AI-state-based animation handle it
  }

  /**
   * Clear all pending resets
   */
  destroy(): void {
    this.emoteResetTicks.clear();
  }
}
