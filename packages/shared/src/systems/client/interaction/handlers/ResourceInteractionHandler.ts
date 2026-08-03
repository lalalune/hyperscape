/**
 * ResourceInteractionHandler
 *
 * Handles interactions with gathering resources using rules-accurate context menus.
 *
 * classic MMORPG Context Menu Format: "<Action> <TargetName>" with colored target
 *
 * Resource types and their context menu formats:
 * - Trees → "Chop down Oak" (strips "Tree" suffix, cyan target - object color)
 * - Rocks/Ore → "Mine Copper rocks" (lowercase plural, cyan target - object color)
 * - Fishing spots → Multiple actions: "Net Fishing spot", "Bait Fishing spot"
 *
 * Actions:
 * - Chop down / Mine / Net/Bait/Lure/Cage/Harpoon (left-click primary, context menu)
 * - Walk here
 * - Examine
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, TIMING, MESSAGE_TYPES } from "../constants";
import { getExternalResource } from "../../../../utils/ExternalAssetUtils";
import { CONTEXT_MENU_COLORS } from "../../../../constants/GameConstants";

/**
 * Fishing method definition for multi-action fishing spots.
 */
interface FishingMethod {
  /** Method ID sent to server (e.g., "net", "bait", "lure") */
  id: string;
  /** Display action name (e.g., "Net", "Bait", "Lure") */
  action: string;
}

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
   *
   * rules-accurate context menu format:
   * - Trees: "Chop down <TreeName>" (e.g., "Chop down Oak")
   * - Rocks: "Mine <RockName>" (e.g., "Mine Copper rocks")
   * - Fishing: Multiple actions per spot (e.g., "Net Fishing spot", "Bait Fishing spot")
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const resourceType = this.getResourceType(target);
    const entity = target.entity as unknown as ResourceEntity;

    // Primary gather action based on resource type
    // Note: resourceType can be "tree", "mining_rock", or "fishing_spot" (from ResourceType enum)
    // We check mining rocks FIRST since "mining_rock" should not match "tree"
    if (
      resourceType === "mining_rock" ||
      resourceType.includes("rock") ||
      resourceType.includes("ore") ||
      resourceType.includes("mining")
    ) {
      // classic MMORPG: "Mine Copper rocks" with cyan target name (object color)
      const rockName = this.getRockDisplayName(target);
      actions.push({
        id: "mine",
        label: `Mine ${rockName}`,
        styledLabel: [
          { text: "Mine " },
          { text: rockName, color: CONTEXT_MENU_COLORS.OBJECT },
        ],
        enabled: true,
        priority: 1,
        handler: () => this.gatherResource(target, "mine"),
      });
    } else if (
      resourceType === "fishing_spot" ||
      resourceType.includes("fish")
    ) {
      // classic MMORPG: Multiple actions - "Net Fishing spot", "Bait Fishing spot"
      const methods = this.getFishingMethods(entity);
      for (const method of methods) {
        actions.push({
          id: `fish_${method.id}`,
          label: `${method.action} Fishing spot`,
          styledLabel: [
            { text: `${method.action} ` },
            { text: "Fishing spot", color: CONTEXT_MENU_COLORS.OBJECT },
          ],
          enabled: true,
          priority: 1,
          handler: () => this.gatherResource(target, method.id),
        });
      }
    } else {
      // Default: Trees - classic MMORPG: "Chop down Oak" with cyan target name (object color)
      const treeName = this.getTreeDisplayName(target);
      actions.push({
        id: "chop",
        label: `Chop down ${treeName}`,
        styledLabel: [
          { text: "Chop down " },
          { text: treeName, color: CONTEXT_MENU_COLORS.OBJECT },
        ],
        enabled: true,
        priority: 1,
        handler: () => this.gatherResource(target, "chop"),
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

  /**
   * Gather a resource using SERVER-AUTHORITATIVE pathing.
   *
   * Like combat, we just send the resource ID to the server and let the server:
   * 1. Look up the resource's TRUE position from its authoritative data
   * 2. Calculate the correct cardinal tile
   * 3. Path the player to that tile
   * 4. Start gathering when player arrives
   *
   * This eliminates client-side position calculation issues that caused players
   * to end up standing ON the resource tile.
   *
   * @param target - The raycast target for the resource
   * @param method - The gathering method (e.g., "chop", "mine", "net", "bait", "lure")
   */
  private gatherResource(target: RaycastTarget, method: string): void {
    const player = this.getPlayer();
    if (!player) return;

    // Check debounce
    const debounceKey = `resource:${player.id}:${target.entityId}`;
    if (
      this.actionQueue.isDebounced(debounceKey, TIMING.RESOURCE_DEBOUNCE_MS)
    ) {
      return;
    }

    console.log(
      `[ResourceInteraction] SERVER-AUTHORITATIVE: Sending resourceInteract for ${target.entityId} (method: ${method})`,
    );

    // Get player's run mode preference
    const runMode = (player as { runMode?: boolean }).runMode ?? true;

    // SERVER-AUTHORITATIVE: Send resource ID, run mode, and gathering method
    // Server will calculate the correct cardinal tile using its authoritative position data
    // For fishing, the method indicates which tool to use (net, bait, lure, cage, harpoon)
    this.send(MESSAGE_TYPES.RESOURCE_INTERACT, {
      resourceId: target.entityId,
      runMode,
      method, // Fishing method or gathering action
    });
  }

  /**
   * Get the resource type for a target.
   *
   * Checks entity.config.resourceType first, then falls back to name-based detection.
   * This handles cases where the config might not be properly synced.
   *
   * Resource types (from ResourceType enum):
   * - "tree" - Trees (woodcutting)
   * - "mining_rock" - Ore rocks (mining)
   * - "fishing_spot" - Fishing spots (fishing)
   */
  private getResourceType(target: RaycastTarget): string {
    const entity = target.entity as unknown as ResourceEntity;
    const configType = entity.config?.resourceType;

    // If config has a valid resourceType, use it
    if (configType) {
      return configType;
    }

    // Fallback: detect from target name (handles cases where config isn't set)
    const nameLower = target.name.toLowerCase();

    // Check for mining rocks (ore, rock patterns)
    if (
      nameLower.includes("rock") ||
      nameLower.includes("ore") ||
      nameLower.includes("coal") ||
      nameLower.includes("mithril") ||
      nameLower.includes("adamant") ||
      nameLower.includes("rune")
    ) {
      return "mining_rock";
    }

    // Check for fishing spots
    if (nameLower.includes("fishing") || nameLower.includes("spot")) {
      return "fishing_spot";
    }

    // Default to tree
    return "tree";
  }

  private getActionForResourceType(resourceType: string): string {
    // Check mining rocks first
    if (
      resourceType === "mining_rock" ||
      resourceType.includes("rock") ||
      resourceType.includes("ore") ||
      resourceType.includes("mining")
    ) {
      return "mine";
    } else if (
      resourceType === "fishing_spot" ||
      resourceType.includes("fish")
    ) {
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

  // ==========================================================================
  // RULES-ACCURATE DISPLAY NAME HELPERS
  // ==========================================================================

  /**
   * Get classic MMORPG-style tree display name.
   * Strips "Tree" suffix for named trees (Oak, Willow) but keeps it for basic trees.
   *
   * Reference object names:
   * - "Tree" (basic tree)
   * - "Oak" (not "Oak Tree")
   * - "Yew" (not "Yew Tree")
   * - "Magic tree" (lowercase 't' - special case!)
   */
  private getTreeDisplayName(target: RaycastTarget): string {
    const name = target.name;

    // "Tree" stays as "Tree"
    if (name.toLowerCase() === "tree") {
      return "Tree";
    }

    // "Magic Tree" -> "Magic tree" (classic MMORPG uses lowercase 't')
    if (name.toLowerCase() === "magic tree") {
      return "Magic tree";
    }

    // "Oak Tree" -> "Oak", "Willow Tree" -> "Willow"
    if (name.toLowerCase().endsWith(" tree")) {
      return name.slice(0, -5); // Remove " Tree"
    }

    return name;
  }

  /**
   * Get classic MMORPG-style rock display name.
   * Converts "Copper Rock" -> "Copper rocks" (lowercase, plural).
   *
   * Reference object names:
   * - "Copper rocks" (not "Copper Rock")
   * - "Iron rocks" (not "Iron Rock")
   * - "Coal rocks" (not "Coal Rock")
   */
  private getRockDisplayName(target: RaycastTarget): string {
    const name = target.name;

    // "Copper Rock" -> "Copper rocks"
    // "Iron Rock" -> "Iron rocks"
    if (name.toLowerCase().endsWith(" rock")) {
      const oreName = name.slice(0, -5); // Remove " Rock"
      return `${oreName} rocks`;
    }

    // Already plural or different format - just ensure lowercase "rocks"
    if (name.toLowerCase().endsWith(" rocks")) {
      return name;
    }

    // Fallback: just add "rocks" suffix
    return `${name} rocks`;
  }

  /**
   * Get the fishing method for this spot.
   *
   * Each fishing spot is a distinct resource type in the manifest:
   * - fishing_spot_net → "Net" action (small fishing net)
   * - fishing_spot_bait → "Bait" action (fishing rod + bait)
   * - fishing_spot_fly → "Lure" action (fly fishing rod + feathers)
   * - fishing_spot_cage → "Cage" action (lobster pot)
   * - fishing_spot_harpoon → "Harpoon" action (harpoon)
   *
   * Returns a single method since each spot type only supports one action.
   */
  private getFishingMethods(entity: ResourceEntity): FishingMethod[] {
    const resourceId = entity.config?.resourceId || "";

    // Each spot type has ONE fishing method
    if (resourceId.includes("net")) {
      return [{ id: "net", action: "Net" }];
    } else if (resourceId.includes("fly") || resourceId.includes("lure")) {
      return [{ id: "lure", action: "Lure" }];
    } else if (resourceId.includes("cage")) {
      return [{ id: "cage", action: "Cage" }];
    } else if (resourceId.includes("harpoon")) {
      return [{ id: "harpoon", action: "Harpoon" }];
    } else if (resourceId.includes("bait")) {
      return [{ id: "bait", action: "Bait" }];
    }

    // Fallback for unrecognized fishing spots
    return [{ id: "fish", action: "Fish" }];
  }
}
