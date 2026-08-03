/**
 * BankInteractionHandler
 *
 * Handles interactions with bank objects (booths, chests, etc.).
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Bank Bank booth" / "Bank Bank chest" (cyan #00ffff for target)
 * - "Examine Bank booth" (cyan #00ffff for target)
 *
 * Note: Bank NPCs (clerks) are handled by NPCInteractionHandler.
 * This handler is for bank objects/furniture only.
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, MESSAGE_TYPES } from "../constants";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

export class BankInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Open bank
   */
  onLeftClick(target: RaycastTarget): void {
    this.openBank(target);
  }

  /**
   * Right-click: Show bank options
   *
   * rules-accurate format:
   * - "Bank Bank booth" (action white, target cyan)
   * - "Examine Bank booth" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Bank booth";

    // Bank action (primary) - classic MMORPG: "Bank Bank booth"
    actions.push({
      id: "use-bank",
      label: `Bank ${targetName}`,
      styledLabel: [
        { text: "Bank " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => this.openBank(target),
    });

    // Examine - classic MMORPG: "Examine Bank booth"
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
        this.showExamineMessage("A secure place to store your items.");
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.BANK;
  }

  // === Private Methods ===

  private openBank(target: RaycastTarget): void {
    // Use hitPoint for large bank objects where center may be far from click
    const interactionPoint = target.hitPoint;

    this.queueInteraction({
      target: {
        ...target,
        position: interactionPoint, // Override position with hitPoint
      },
      actionId: "use-bank",
      range: INTERACTION_RANGE.BANK,
      onExecute: () => {
        this.send(MESSAGE_TYPES.BANK_OPEN, { bankId: target.entityId });
      },
    });
  }
}
