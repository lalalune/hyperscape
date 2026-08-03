/**
 * CorpseInteractionHandler
 *
 * Handles interactions with corpses and headstones/gravestones.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Loot Gravestone" (cyan #00ffff for "Gravestone")
 * - "Examine Gravestone" (cyan #00ffff)
 *
 * Used for:
 * - Player death gravestones (reclaim items)
 * - Mob corpses (loot drops)
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

/** Corpse/Headstone entity interface */
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
   *
   * rules-accurate format with cyan target names (scenery):
   * - "Loot Gravestone" (cyan for "Gravestone")
   * - "Examine Gravestone" (cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Gravestone";

    // Loot action - classic MMORPG: "Loot Gravestone"
    actions.push({
      id: "loot",
      label: `Loot ${targetName}`,
      styledLabel: [
        { text: "Loot " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => this.lootCorpse(target),
    });

    // Examine - classic MMORPG: "Examine Gravestone"
    const examineText = `The remains of a ${targetName.toLowerCase()}.`;
    actions.push({
      id: "examine",
      label: `Examine ${targetName}`,
      styledLabel: [
        { text: "Examine " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 100,
      handler: () => {
        this.showExamineMessage(examineText);
      },
    });

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
        const currentPlayer = this.getPlayer();
        if (!currentPlayer) return;

        // Call handleInteraction on the client-side entity directly.
        // The entity has loot items synced via network data (modify).
        // This emits CORPSE_CLICK which opens the loot window.
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
