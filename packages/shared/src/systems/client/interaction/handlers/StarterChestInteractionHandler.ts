/**
 * StarterChestInteractionHandler
 *
 * Handles interactions with the starter chest that provides new players
 * with basic equipment (bronze tools, tinderbox, net, food).
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Search Starter Chest" (cyan #00ffff for target)
 * - "Examine Starter Chest" (cyan #00ffff for target)
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

export class StarterChestInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Search chest for starter items
   */
  onLeftClick(target: RaycastTarget): void {
    this.searchChest(target);
  }

  /**
   * Right-click: Show chest options
   *
   * rules-accurate format:
   * - "Search Starter Chest" (action white, target cyan)
   * - "Examine Starter Chest" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Starter Chest";

    // Search action (primary) - classic MMORPG: "Search Starter Chest"
    actions.push({
      id: "search-chest",
      label: `Search ${targetName}`,
      styledLabel: [
        { text: "Search " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => this.searchChest(target),
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine - classic MMORPG: "Examine Starter Chest"
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
        this.showExamineMessage(
          "A chest containing starter equipment for new adventurers.",
        );
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    // Use bank range (1 tile adjacent)
    return INTERACTION_RANGE.BANK;
  }

  // === Private Methods ===

  private searchChest(target: RaycastTarget): void {
    // Use hitPoint for interaction position
    const interactionPoint = target.hitPoint;

    this.queueInteraction({
      target: {
        ...target,
        position: interactionPoint, // Override position with hitPoint
      },
      actionId: "search-chest",
      range: INTERACTION_RANGE.BANK,
      onExecute: () => {
        // Send entityInteract to server - server handles giving items
        this.send("entityInteract", {
          entityId: target.entityId,
          interactionType: "loot",
        });
      },
    });
  }
}
