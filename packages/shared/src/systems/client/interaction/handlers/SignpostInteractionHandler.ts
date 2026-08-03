/**
 * SignpostInteractionHandler
 *
 * Handles interactions with town signposts that show directions to nearby towns.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with cyan target (scenery color)
 * - "Read Signpost" (cyan #00ffff for target)
 * - "Examine Signpost" (cyan #00ffff for target)
 *
 * Signposts are placed at town entrances and point to connected towns via roads.
 * Reading a signpost shows a toast/chat message with the destination town name.
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE } from "../constants";
import { EventType } from "../../../../types/events/event-types";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

export class SignpostInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Read signpost (show destination)
   */
  onLeftClick(target: RaycastTarget): void {
    this.readSignpost(target);
  }

  /**
   * Right-click: Show signpost options
   *
   * rules-accurate format:
   * - "Read Signpost" (action white, target cyan)
   * - "Examine Signpost" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Signpost";

    // Read action (primary) - "Read Signpost"
    actions.push({
      id: "read-signpost",
      label: `Read ${targetName}`,
      styledLabel: [
        { text: "Read " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 1,
      handler: () => this.readSignpost(target),
    });

    // Examine - "Examine Signpost"
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
        this.showExamineMessage("A signpost pointing to a nearby town.");
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.ADJACENT;
  }

  // === Private Methods ===

  private readSignpost(target: RaycastTarget): void {
    const interactionPoint = target.hitPoint;

    this.queueInteraction({
      target: {
        ...target,
        position: interactionPoint,
      },
      actionId: "read-signpost",
      range: INTERACTION_RANGE.ADJACENT,
      onExecute: () => {
        // Get destination from entity metadata
        // The mesh userData contains the signpost metadata from ProceduralTownLandmarks
        const metadata =
          target.entity?.metadata ||
          (target as unknown as { metadata?: { destination?: string } })
            .metadata ||
          {};
        const destination = (metadata as { destination?: string }).destination;

        // Construct message based on whether destination is known
        const message = destination
          ? `The signpost points to: ${destination}`
          : "The signpost's writing has faded beyond recognition.";

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
