/**
 * MobInteractionHandler
 *
 * Handles interactions with hostile mobs.
 *
 * Actions:
 * - Attack (left-click primary, context menu)
 * - Walk here
 * - Examine
 *
 * OSRS-Style Behavior:
 * - Combat range based on equipped weapon
 * - Must be within range but NOT on same tile
 * - Tracks moving targets (mobs that wander)
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, TIMING, MESSAGE_TYPES } from "../constants";
import { getNPCById } from "../../../../data/npcs";
import { getPlayerWeaponRange } from "../../../../utils/game/CombatUtils";
import type { Player } from "../../../../types/core/core";

/**
 * Mob entity interface for type safety
 */
interface MobEntity {
  getMobData?: () => { health?: number; level?: number; type?: string } | null;
  config?: { mobType?: string };
}

export class MobInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Attack mob (if alive)
   */
  onLeftClick(target: RaycastTarget): void {
    const mobData = this.getMobData(target);
    const isAlive = (mobData?.health || 0) > 0;

    if (!isAlive) {
      return; // Don't attack dead mobs
    }

    this.attackMob(target);
  }

  /**
   * Right-click: Show attack and other options
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const mobData = this.getMobData(target);
    const isAlive = (mobData?.health || 0) > 0;

    // Attack action
    actions.push({
      id: "attack",
      label: `Attack ${target.name} (Lv${mobData?.level || 1})`,
      icon: "⚔️",
      enabled: isAlive,
      priority: 1,
      handler: () => {
        if (isAlive) {
          this.attackMob(target);
        }
      },
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine
    const examineText = this.getExamineText(target, mobData);
    actions.push(this.createExamineAction(target, examineText));

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    const player = this.getPlayer();
    if (player) {
      return this.getPlayerCombatRange(player);
    }
    return INTERACTION_RANGE.MELEE;
  }

  // === Private Methods ===

  private attackMob(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // Check debounce to prevent rapid clicking spam
    const debounceKey = `attack:${player.id}:${target.entityId}`;
    if (this.actionQueue.isDebounced(debounceKey, TIMING.ATTACK_DEBOUNCE_MS)) {
      return;
    }

    // Server-authoritative attack system:
    // Send attack request immediately - server handles OSRS-style pathfinding
    // (cardinal-only melee range, path-to-adjacent tile)
    this.send(MESSAGE_TYPES.ATTACK_MOB, {
      mobId: target.entityId,
      attackType: "melee",
    });
  }

  private getMobData(
    target: RaycastTarget,
  ): { health?: number; level?: number; type?: string } | null {
    const entity = target.entity as unknown as MobEntity;
    return entity.getMobData?.() || null;
  }

  private getPlayerCombatRange(player: { id: string }): number {
    const playerData = player as unknown as Player;
    return getPlayerWeaponRange(playerData);
  }

  private getExamineText(
    target: RaycastTarget,
    mobData: { level?: number; type?: string } | null,
  ): string {
    const entity = target.entity as unknown as MobEntity;
    const mobType = entity.config?.mobType || mobData?.type;

    if (mobType) {
      const npcData = getNPCById(mobType);
      if (npcData?.description) {
        return npcData.description;
      }
    }

    return `A level ${mobData?.level || 1} ${target.name.toLowerCase()}.`;
  }
}
