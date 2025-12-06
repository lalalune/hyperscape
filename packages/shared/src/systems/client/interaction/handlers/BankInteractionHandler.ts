/**
 * BankInteractionHandler
 *
 * Handles interactions with bank objects (booths, chests, etc.).
 *
 * Actions:
 * - Use Bank (left-click primary, context menu)
 * - Examine
 *
 * Note: Bank NPCs (clerks) are handled by NPCInteractionHandler.
 * This handler is for bank objects/furniture only.
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";

export class BankInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Open bank
   */
  onLeftClick(target: RaycastTarget): void {
    this.openBank(target);
  }

  /**
   * Right-click: Show bank options
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];

    // Use Bank
    actions.push({
      id: "use-bank",
      label: "Use Bank",
      icon: "🏦",
      enabled: true,
      priority: 1,
      handler: () => this.openBank(target),
    });

    // Examine
    actions.push(
      this.createExamineAction(target, "A secure place to store your items."),
    );

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
        this.send("bankOpen", { bankId: target.entityId });
      },
    });
  }
}
