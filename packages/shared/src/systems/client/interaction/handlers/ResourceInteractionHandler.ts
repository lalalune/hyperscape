/**
 * ResourceInteractionHandler
 *
 * Handles interactions with gathering resources.
 *
 * Resource types:
 * - Trees → Chop (Woodcutting)
 * - Rocks/Ore → Mine (Mining)
 * - Fishing spots → Fish (Fishing)
 *
 * Actions:
 * - Chop/Mine/Fish (left-click primary, context menu)
 * - Walk here
 * - Examine
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, TIMING } from "../constants";
import { getExternalResource } from "../../../../utils/ExternalAssetUtils";

/**
 * Resource entity interface for type safety
 */
interface ResourceEntity {
  config?: {
    resourceType?: string;
    resourceId?: string;
  };
}

export class ResourceInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Perform primary action based on resource type
   */
  onLeftClick(target: RaycastTarget): void {
    const resourceType = this.getResourceType(target);
    const action = this.getActionForResourceType(resourceType);
    this.gatherResource(target, action);
  }

  /**
   * Right-click: Show gather action and other options
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const resourceType = this.getResourceType(target);

    // Primary gather action based on resource type
    if (resourceType.includes("tree")) {
      actions.push({
        id: "chop",
        label: "Chop",
        icon: "🪓",
        enabled: true,
        priority: 1,
        handler: () => this.gatherResource(target, "chop"),
      });
    } else if (resourceType.includes("rock") || resourceType.includes("ore")) {
      actions.push({
        id: "mine",
        label: "Mine",
        icon: "⛏️",
        enabled: true,
        priority: 1,
        handler: () => this.gatherResource(target, "mine"),
      });
    } else if (resourceType.includes("fish")) {
      actions.push({
        id: "fish",
        label: "Fish",
        icon: "🎣",
        enabled: true,
        priority: 1,
        handler: () => this.gatherResource(target, "fish"),
      });
    }

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine
    const examineText = this.getExamineText(target, resourceType);
    actions.push(this.createExamineAction(target, examineText));

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.RESOURCE;
  }

  // === Private Methods ===

  private gatherResource(target: RaycastTarget, action: string): void {
    const player = this.getPlayer();
    if (!player) return;

    // Check debounce
    const debounceKey = `resource:${player.id}:${target.entityId}`;
    if (
      this.actionQueue.isDebounced(debounceKey, TIMING.RESOURCE_DEBOUNCE_MS)
    ) {
      return;
    }

    this.queueInteraction({
      target,
      actionId: action,
      range: INTERACTION_RANGE.RESOURCE,
      onExecute: () => {
        // Get CURRENT player position at execute time, not queue time
        const currentPlayer = this.getPlayer();
        if (!currentPlayer) return;

        this.send("resourceGather", {
          resourceId: target.entityId,
          playerPosition: {
            x: currentPlayer.position.x,
            y: currentPlayer.position.y,
            z: currentPlayer.position.z,
          },
        });
      },
    });
  }

  private getResourceType(target: RaycastTarget): string {
    const entity = target.entity as unknown as ResourceEntity;
    return entity.config?.resourceType || "tree";
  }

  private getActionForResourceType(resourceType: string): string {
    if (resourceType.includes("rock") || resourceType.includes("ore")) {
      return "mine";
    } else if (resourceType.includes("fish")) {
      return "fish";
    }
    return "chop"; // Default for trees
  }

  private getExamineText(target: RaycastTarget, resourceType: string): string {
    const entity = target.entity as unknown as ResourceEntity;
    const resourceId = entity.config?.resourceId;

    // Try to get examine text from resource data
    if (resourceId) {
      const resourceData = getExternalResource(resourceId);
      if (resourceData?.examine) {
        return resourceData.examine;
      }
    }

    // Fallback to type-based messages
    if (resourceType.includes("tree")) {
      return `A ${target.name.toLowerCase()}. I can chop it down with a hatchet.`;
    } else if (resourceType.includes("rock") || resourceType.includes("ore")) {
      return `${target.name}. I could mine it with a pickaxe.`;
    } else if (resourceType.includes("fish")) {
      return "There are fish swimming in the water here.";
    }

    return `It's ${target.name.toLowerCase()}.`;
  }
}
