/**
 * BuildingSignInteractionHandler
 *
 * Handles interactions with hanging signs on building facades.
 * Players can read the sign to see the building name and type.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Read Sign" (cyan #00ffff for target)
 * - "Examine Sign" (cyan #00ffff for target)
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";
import { EventType } from "../../../../types/events/event-types";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

/** Human-readable building type names */
const BUILDING_TYPE_LABELS: Record<string, string> = {
  bank: "Bank",
  store: "General Store",
  inn: "Inn & Tavern",
  smithy: "Smithy",
  church: "Church",
  cathedral: "Cathedral",
  chapel: "Chapel",
  keep: "Keep",
  fortress: "Fortress",
  castle: "Castle",
  "guild-hall": "Guild Hall",
  "town-hall": "Town Hall",
  mansion: "Mansion",
  manor: "Manor House",
  "simple-house": "House",
  "long-house": "Longhouse",
};

export class BuildingSignInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Read sign (show building name)
   */
  onLeftClick(target: RaycastTarget): void {
    this.readSign(target);
  }

  /**
   * Right-click: Show sign options
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Sign";

    // Read action (primary) - "Read Sign"
    actions.push({
      id: "read-building-sign",
      label: `Read ${targetName}`,
      styledLabel: [
        { text: "Read " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => this.readSign(target),
    });

    // Examine - "Examine Sign"
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
        const metadata = this.getMetadata(target);
        const buildingType = metadata.buildingType || "building";
        const typeLabel = BUILDING_TYPE_LABELS[buildingType] || buildingType;
        this.showExamineMessage(
          `A wooden sign hanging from an iron bracket. It reads: "${typeLabel}".`,
        );
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.ADJACENT;
  }

  // === Private Methods ===

  private getMetadata(target: RaycastTarget): Record<string, string> {
    // Metadata comes from mesh userData (set during landmark rendering)
    const entityMeta = target.entity?.metadata;
    if (entityMeta && typeof entityMeta === "object") {
      return entityMeta as Record<string, string>;
    }
    const targetMeta = (
      target as unknown as { metadata?: Record<string, string> }
    ).metadata;
    return targetMeta || {};
  }

  private readSign(target: RaycastTarget): void {
    const interactionPoint = target.hitPoint;

    this.queueInteraction({
      target: {
        ...target,
        position: interactionPoint,
      },
      actionId: "read-building-sign",
      range: INTERACTION_RANGE.ADJACENT,
      onExecute: () => {
        const metadata = this.getMetadata(target);
        const buildingName = metadata.buildingName;
        const buildingType = metadata.buildingType || "building";
        const typeLabel = BUILDING_TYPE_LABELS[buildingType] || buildingType;

        const message = buildingName
          ? `The sign reads: "${buildingName}" — ${typeLabel}`
          : `The sign reads: "${typeLabel}"`;

        // Show toast notification
        this.world.emit(EventType.UI_TOAST, {
          message,
          type: "info",
        });

        // Also add to chat log
        this.addChatMessage(message);
      },
    });
  }
}
