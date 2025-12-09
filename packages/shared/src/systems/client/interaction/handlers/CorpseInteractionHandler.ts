/**
 * CorpseInteractionHandler
 *
 * Handles interactions with corpses and headstones/gravestones.
 *
 * Actions:
 * - Loot (left-click primary, context menu)
 * - Examine
 *
 * Used for:
 * - Player death gravestones (reclaim items)
 * - Mob corpses (loot drops)
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";

/**
 * Corpse/Headstone entity interface
 */
interface CorpseEntity {
  handleInteraction?: (data: unknown) => Promise<void>;
}

export class CorpseInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Loot corpse/gravestone
   */
  onLeftClick(target: RaycastTarget): void {
    this.lootCorpse(target);
  }

  /**
   * Right-click: Show loot and examine options
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];

    // Loot action
    actions.push({
      id: "loot",
      label: `Loot ${target.name}`,
      icon: "💀",
      enabled: true,
      priority: 1,
      handler: () => this.lootCorpse(target),
    });

    // Examine
    const examineText = `The corpse of a ${target.name.toLowerCase()}.`;
    actions.push(this.createExamineAction(target, examineText));

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.LOOT;
  }

  // === Private Methods ===

  private lootCorpse(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    this.queueInteraction({
      target,
      actionId: "loot",
      range: INTERACTION_RANGE.LOOT,
      onExecute: () => {
        // Get CURRENT player at execute time, not queue time
        const currentPlayer = this.getPlayer();
        if (!currentPlayer) return;

        // Try entity's handleInteraction method (for headstones)
        const entity = target.entity as CorpseEntity;
        if (entity?.handleInteraction) {
          entity.handleInteraction({
            entityId: target.entityId,
            playerId: currentPlayer.id,
            playerPosition: currentPlayer.position,
          });
        }
      },
    });
  }
}
