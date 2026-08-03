/**
 * AltarInteractionHandler
 *
 * Handles interactions with prayer altars.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Pray Altar" (cyan #00ffff for target)
 * - "Examine Altar" (cyan #00ffff for target)
 *
 * Regular altars only recharge prayer points to full.
 * Gilded altars (not implemented) would also offer bone burning with XP multipliers.
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, MESSAGE_TYPES } from "../constants";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

export class AltarInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Pray at altar (recharge prayer points)
   */
  onLeftClick(target: RaycastTarget): void {
    this.prayAtAltar(target);
  }

  /**
   * Right-click: Show altar options
   *
   * rules-accurate format:
   * - "Pray Altar" (action white, target cyan)
   * - "Examine Altar" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Altar";

    // Pray action (primary) - classic MMORPG: "Pray Altar"
    actions.push({
      id: "pray-altar",
      label: `Pray ${targetName}`,
      styledLabel: [
        { text: "Pray " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => this.prayAtAltar(target),
    });

    // Examine - classic MMORPG: "Examine Altar"
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
        this.showExamineMessage("An altar to the gods.");
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.ADJACENT;
  }

  // === Private Methods ===

  private prayAtAltar(target: RaycastTarget): void {
    // Use hitPoint for potential multi-tile altars
    const interactionPoint = target.hitPoint;

    this.queueInteraction({
      target: {
        ...target,
        position: interactionPoint,
      },
      actionId: "pray-altar",
      range: INTERACTION_RANGE.ADJACENT,
      onExecute: () => {
        this.send(MESSAGE_TYPES.ALTAR_PRAY, { altarId: target.entityId });
      },
    });
  }
}
