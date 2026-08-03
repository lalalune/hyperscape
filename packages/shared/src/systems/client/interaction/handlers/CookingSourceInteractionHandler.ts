/**
 * CookingSourceInteractionHandler
 *
 * Handles interactions with cooking sources (fires and ranges).
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Cook Fire" / "Cook Range" (cyan #00ffff for target)
 * - "Walk here"
 * - "Examine Fire" / "Examine Range" (cyan #00ffff for target)
 *
 * When player is in targeting mode with raw food, clicking a fire/range
 * will trigger the cooking request.
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";
import { EventType } from "../../../../types/events/event-types";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

/**
 * Cooking source entity interface for type safety
 */
interface CookingSourceEntity {
  entityType?: string;
  displayName?: string;
  burnReduction?: number;
  isActive?: boolean;
}

export class CookingSourceInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Open cooking interface or trigger cooking if in targeting mode
   */
  onLeftClick(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // Check if fire is still active (fires expire)
    // For ProcessingSystem fires, target.entity is null, so use entityType from target
    const isFire = target.entityType === "fire";
    const entity = target.entity as unknown as CookingSourceEntity | null;
    const isActive = entity?.isActive !== false; // Default to true for ProcessingSystem fires

    if (isFire && !isActive) {
      this.showExamineMessage("The fire has gone out.");
      return;
    }

    // Queue the cooking interaction (walk to fire/range then cook)
    this.queueInteraction({
      target,
      actionId: "cook",
      range: this.getActionRange("cook"),
      onExecute: () => this.executeCook(target),
    });
  }

  /**
   * Right-click: Show Cook action and other options
   *
   * rules-accurate format:
   * - "Cook Fire" / "Cook Range" (action white, target cyan)
   * - "Walk here"
   * - "Examine Fire" / "Examine Range" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    // For ProcessingSystem fires, target.entity is null - use target.entityType instead
    const entity = target.entity as unknown as CookingSourceEntity | null;
    const sourceType = target.entityType === "range" ? "range" : "fire";
    const isActive = entity?.isActive !== false; // Default to true for ProcessingSystem fires
    const targetName =
      target.name || (sourceType === "range" ? "Range" : "Fire");

    // Cook action (primary) - classic MMORPG: "Cook Fire" or "Cook Range"
    actions.push({
      id: "cook",
      label: `Cook ${targetName}`,
      styledLabel: [
        { text: "Cook " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: isActive,
      priority: 1,
      handler: () => {
        this.queueInteraction({
          target,
          actionId: "cook",
          range: this.getActionRange("cook"),
          onExecute: () => this.executeCook(target),
        });
      },
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine - classic MMORPG: "Examine Fire" or "Examine Range"
    const examineText = this.getExamineText(entity, sourceType, isActive);
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
    return INTERACTION_RANGE.RESOURCE; // 1 tile, like other interactables
  }

  // === Private Methods ===

  /**
   * Execute the cooking interaction.
   *
   * If player is in targeting mode with raw food, triggers cooking request.
   * Otherwise, opens the cooking interface for the player to select food.
   */
  private executeCook(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // For ProcessingSystem fires, target.entity is null - use target.entityType instead
    const entity = target.entity as unknown as CookingSourceEntity | null;
    const sourceType = target.entityType === "range" ? "range" : "fire";
    const burnReduction = entity?.burnReduction ?? 0;

    console.log(
      `[CookingSourceInteraction] Player clicked ${sourceType} at ${target.position.x}, ${target.position.z}`,
    );

    // Emit COOKING_INTERACT event to open cooking interface
    // The ProcessingSystem or CookingUI will handle this
    this.world.emit(EventType.COOKING_INTERACT, {
      playerId: player.id,
      fireId: sourceType === "fire" ? target.entityId : undefined,
      rangeId: sourceType === "range" ? target.entityId : undefined,
      sourceType,
      position: target.position,
      burnReduction,
    });

    // Also send to server
    this.send("cookingSourceInteract", {
      sourceId: target.entityId,
      sourceType,
      position: [target.position.x, target.position.y, target.position.z],
    });
  }

  /**
   * Get examine text for the cooking source.
   */
  private getExamineText(
    entity: CookingSourceEntity | null,
    sourceType: "fire" | "range",
    isActive: boolean,
  ): string {
    if (sourceType === "fire") {
      if (!isActive) {
        return "The remains of a fire.";
      }
      return "A fire for cooking food.";
    }

    // Range
    const burnReduction = entity?.burnReduction ?? 0;
    if (burnReduction > 0) {
      return `A well-maintained range. Cooking here reduces burn chance by ${(burnReduction * 100).toFixed(0)}%.`;
    }
    return "A range for cooking food.";
  }
}
