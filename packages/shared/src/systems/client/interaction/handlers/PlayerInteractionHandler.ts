/**
 * PlayerInteractionHandler
 *
 * Handles interactions with other players.
 *
 * Actions:
 * - Follow (context menu)
 * - Trade (context menu) - future feature
 * - Examine
 *
 * Note: Left-click on players does nothing by default (OSRS behavior).
 * All player interactions require right-click context menu.
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";

export class PlayerInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: No action (OSRS behavior)
   *
   * Players require right-click to interact.
   */
  onLeftClick(_target: RaycastTarget): void {
    // No-op - players need right-click menu
  }

  /**
   * Right-click: Show player interaction options
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];

    // Follow player
    actions.push({
      id: "follow",
      label: `Follow ${target.name}`,
      icon: "👣",
      enabled: true,
      priority: 1,
      handler: () => this.followPlayer(target),
    });

    // Trade (placeholder for future feature)
    actions.push({
      id: "trade",
      label: `Trade with ${target.name}`,
      icon: "🤝",
      enabled: false, // Disabled until trading is implemented
      priority: 2,
      handler: () => {
        this.showExamineMessage("Trading is not yet available.");
      },
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine
    const examineText = `${target.name}, a fellow adventurer.`;
    actions.push(this.createExamineAction(target, examineText));

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.ADJACENT;
  }

  // === Private Methods ===

  private followPlayer(target: RaycastTarget): void {
    // Send follow request to server
    this.send("followPlayer", {
      targetPlayerId: target.entityId,
    });

    this.addChatMessage(`Following ${target.name}.`);
  }
}
