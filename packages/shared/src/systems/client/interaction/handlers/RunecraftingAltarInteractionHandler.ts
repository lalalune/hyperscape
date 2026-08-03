/**
 * RunecraftingAltarInteractionHandler
 *
 * Handles interactions with runecrafting altars.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Craft-rune Runecrafting Altar" (cyan #00ffff for target)
 * - "Walk here"
 * - "Examine Runecrafting Altar" (cyan #00ffff for target)
 *
 * Left-click: Instantly send all essence for rune crafting.
 * Right-click: Context menu with Craft-rune and Examine.
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

export class RunecraftingAltarInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Craft runes at altar
   */
  onLeftClick(target: RaycastTarget): void {
    this.queueInteraction({
      target,
      actionId: "craft-rune",
      range: this.getActionRange("craft-rune"),
      onExecute: () => this.executeCraftRune(target),
    });
  }

  /**
   * Right-click: Show altar options
   *
   * rules-accurate format:
   * - "Craft-rune Runecrafting Altar" (action white, target cyan)
   * - "Walk here"
   * - "Examine Runecrafting Altar" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Runecrafting Altar";

    // Craft-rune action (primary)
    actions.push({
      id: "craft-rune",
      label: `Craft-rune ${targetName}`,
      styledLabel: [
        { text: "Craft-rune " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => {
        this.queueInteraction({
          target,
          actionId: "craft-rune",
          range: this.getActionRange("craft-rune"),
          onExecute: () => this.executeCraftRune(target),
        });
      },
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine
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
          "A mysterious altar pulsing with runic energy.",
        );
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.RESOURCE;
  }

  // === Private Methods ===

  /**
   * Execute runecrafting at the altar.
   * Sends network packet to server for authoritative processing.
   */
  private executeCraftRune(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // Send altar ID to server — server determines runeType from the altar entity
    // This is more secure (client can't fake runeType) and avoids client-side lookup issues
    this.send("runecraftingAltarInteract", {
      altarId: target.entityId,
    });
  }
}
