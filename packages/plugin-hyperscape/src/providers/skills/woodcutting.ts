/**
 * CLAUDE.md Compliance: Strong typing enforced
 * - ✅ No `any` types - uses ResourceSystem and ResourceItem interfaces
 * - ✅ Type-safe resource filtering and distance calculations
 */
import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
} from "@elizaos/core";
import { HyperscapeService } from "../../service";
import type { ResourceSystem, ResourceItem } from "../../types/resource-types";

export const woodcuttingSkillProvider: Provider = {
  name: "WOODCUTTING_INFO",
  description:
    "Provides woodcutting skill level, nearby trees, axe availability, and woodcutting examples",
  dynamic: true, // Only loaded when explicitly requested by woodcutting actions
  position: 2, // Contextual skills come after world state, before actions
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );

    if (!service || !service.isConnected()) {
      return {
        text: "# Woodcutting Skill\nStatus: Not connected to world",
        values: {
          woodcutting_available: false,
        },
        data: {},
      };
    }

    const world = service.getWorld();
    const player = world?.entities?.player;
    const playerData = player?.data as
      | {
          skills?: Record<string, { level: number; xp: number }>;
          inventory?: { items?: Array<{ itemId: string; quantity: number }> };
        }
      | undefined;

    // Get woodcutting skill info
    const woodcuttingSkill = playerData?.skills?.woodcutting;
    const woodcuttingLevel = woodcuttingSkill?.level ?? 1;
    const woodcuttingXP = woodcuttingSkill?.xp ?? 0;

    // Check for axe in inventory
    const inventory = playerData?.inventory?.items || [];
    const hasAxe = inventory.some(
      (item) =>
        item.itemId?.includes("hatchet") || item.itemId?.includes("axe"),
    );
    const axeType =
      inventory.find(
        (item) =>
          item.itemId?.includes("hatchet") || item.itemId?.includes("axe"),
      )?.itemId || "none";

    // Get nearby trees
    const systems = world?.systems as unknown as
      | Record<string, unknown>
      | undefined;
    const resourceSystem = systems?.["resource"] as ResourceSystem | undefined;
    const allResources: ResourceItem[] = resourceSystem?.getAllResources
      ? resourceSystem.getAllResources()
      : [];
    const playerPos = player?.position;

    const nearbyTrees: ResourceItem[] = allResources.filter(
      (resource: ResourceItem) => {
        if (!resource.type?.startsWith("tree_")) return false;
        if (!playerPos || !resource.position) return false;

        const dx = resource.position.x - playerPos.x;
        const dz = resource.position.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance <= 15; // Within 15 units
      },
    );

    const treeList = nearbyTrees
      .map((tree: ResourceItem) => {
        const dx = tree.position.x - playerPos!.x;
        const dz = tree.position.z - playerPos!.z;
        const distance = Math.sqrt(dx * dx + dz * dz).toFixed(1);
        return `- ${tree.type} (${distance}m away)`;
      })
      .join("\n");

    const text = `# Woodcutting Skill

## Current Status
- Level: ${woodcuttingLevel}
- XP: ${woodcuttingXP}
- Has Axe: ${hasAxe ? `Yes (${axeType})` : "No"}

## Nearby Trees (${nearbyTrees.length})
${nearbyTrees.length > 0 ? treeList : "No trees nearby"}

## Woodcutting Tips
- Walk near trees and use CHOP_TREE action
- Higher level trees give more XP
- Axes chop faster than bare hands
- Logs can be used for firemaking`;

    return {
      text,
      values: {
        woodcutting_level: woodcuttingLevel,
        woodcutting_xp: woodcuttingXP,
        has_axe: hasAxe,
        axe_type: axeType,
        nearby_trees_count: nearbyTrees.length,
        woodcutting_available: nearbyTrees.length > 0,
      },
      data: {
        skill: woodcuttingSkill,
        nearbyTrees,
      },
    };
  },
};
