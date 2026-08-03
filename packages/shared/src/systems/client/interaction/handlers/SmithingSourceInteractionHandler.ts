/**
 * SmithingSourceInteractionHandler
 *
 * Handles interactions with anvils for smithing bars into items.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Smith Anvil" (cyan #00ffff for "Anvil")
 * - "Walk here"
 * - "Examine Anvil" (cyan #00ffff for "Anvil")
 *
 * Note: Player needs a hammer in inventory to smith.
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";
import { EventType } from "../../../../types/events/event-types";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

/**
 * Anvil entity interface for type safety
 */
interface _AnvilEntity {
  entityType?: string;
  displayName?: string;
}

export class SmithingSourceInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Open smithing interface
   */
  onLeftClick(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // Queue the smithing interaction (walk to anvil then smith)
    this.queueInteraction({
      target,
      actionId: "smith",
      range: this.getActionRange("smith"),
      onExecute: () => this.executeSmith(target),
    });
  }

  /**
   * Right-click: Show Smith action and other options
   *
   * rules-accurate format:
   * - "Smith Anvil" (action white, target cyan)
   * - "Walk here"
   * - "Examine Anvil" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Anvil";

    // Smith action (primary) - classic MMORPG: "Smith Anvil"
    actions.push({
      id: "smith",
      label: `Smith ${targetName}`,
      styledLabel: [
        { text: "Smith " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => {
        this.queueInteraction({
          target,
          actionId: "smith",
          range: this.getActionRange("smith"),
          onExecute: () => this.executeSmith(target),
        });
      },
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine - classic MMORPG: "Examine Anvil"
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
        this.showExamineMessage("An anvil. Used to make things out of metal.");
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.RESOURCE; // 1 tile, like other interactables
  }

  // === Private Methods ===

  /**
   * Execute the smithing interaction.
   * Emits SMITHING_INTERACT event to open smithing interface.
   */
  private executeSmith(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    console.log(
      `[SmithingSourceInteraction] Player clicked anvil at ${target.position.x}, ${target.position.z}`,
    );

    // Emit SMITHING_INTERACT event to open smithing interface
    this.world.emit(EventType.SMITHING_INTERACT, {
      playerId: player.id,
      anvilId: target.entityId,
      position: target.position,
    });

    // Also send to server
    this.send("smithingSourceInteract", {
      anvilId: target.entityId,
      position: [target.position.x, target.position.y, target.position.z],
    });
  }
}
