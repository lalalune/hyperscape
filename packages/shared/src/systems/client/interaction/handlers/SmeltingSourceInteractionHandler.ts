/**
 * SmeltingSourceInteractionHandler
 *
 * Handles interactions with furnaces for smelting ores into bars.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Smelt Furnace" (cyan #00ffff for "Furnace")
 * - "Walk here"
 * - "Examine Furnace" (cyan #00ffff for "Furnace")
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";
import { EventType } from "../../../../types/events/event-types";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

/**
 * Furnace entity interface for type safety
 */
interface _FurnaceEntity {
  entityType?: string;
  displayName?: string;
}

export class SmeltingSourceInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Open smelting interface
   */
  onLeftClick(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // Queue the smelting interaction (walk to furnace then smelt)
    this.queueInteraction({
      target,
      actionId: "smelt",
      range: this.getActionRange("smelt"),
      onExecute: () => this.executeSmelt(target),
    });
  }

  /**
   * Right-click: Show Smelt action and other options
   *
   * rules-accurate format:
   * - "Smelt Furnace" (action white, target cyan)
   * - "Walk here"
   * - "Examine Furnace" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Furnace";

    // Smelt action (primary) - classic MMORPG: "Smelt Furnace"
    actions.push({
      id: "smelt",
      label: `Smelt ${targetName}`,
      styledLabel: [
        { text: "Smelt " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => {
        this.queueInteraction({
          target,
          actionId: "smelt",
          range: this.getActionRange("smelt"),
          onExecute: () => this.executeSmelt(target),
        });
      },
    });

    // Craft action (jewelry at furnace)
    actions.push({
      id: "craft",
      label: `Craft ${targetName}`,
      styledLabel: [
        { text: "Craft " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 2,
      handler: () => {
        this.queueInteraction({
          target,
          actionId: "craft",
          range: this.getActionRange("craft"),
          onExecute: () => this.executeCraft(target),
        });
      },
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine - classic MMORPG: "Examine Furnace"
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
        this.showExamineMessage("A very hot furnace.");
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.RESOURCE; // 1 tile, like other interactables
  }

  // === Private Methods ===

  /**
   * Execute the crafting interaction at furnace (jewelry).
   * Emits CRAFTING_INTERACT event + sends packet to server.
   */
  private executeCraft(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    console.log(
      `[SmeltingSourceInteraction] Player clicked furnace for crafting at ${target.position.x}, ${target.position.z}`,
    );

    // Send to server — server CraftingSystem will process and send back craftingInterfaceOpen
    this.send("craftingSourceInteract", {
      triggerType: "furnace",
      stationId: target.entityId,
    });
  }

  /**
   * Execute the smelting interaction.
   * Emits SMELTING_INTERACT event to open smelting interface.
   */
  private executeSmelt(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    console.log(
      `[SmeltingSourceInteraction] Player clicked furnace at ${target.position.x}, ${target.position.z}`,
    );

    // Emit SMELTING_INTERACT event to open smelting interface
    this.world.emit(EventType.SMELTING_INTERACT, {
      playerId: player.id,
      furnaceId: target.entityId,
      position: target.position,
    });

    // Also send to server
    this.send("smeltingSourceInteract", {
      furnaceId: target.entityId,
      position: [target.position.x, target.position.y, target.position.z],
    });
  }
}
