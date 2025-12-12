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

export const fishingSkillProvider: Provider = {
  name: "FISHING_INFO",
  description:
    "Provides fishing skill level, nearby fishing spots, fishing tool availability, and fishing examples",
  dynamic: true, // Only loaded when explicitly requested by fishing actions
  position: 2, // Contextual skills come after world state, before actions
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );

    if (!service || !service.isConnected()) {
      return {
        text: "# Fishing Skill\nStatus: Not connected to world",
        values: {
          fishing_available: false,
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

    // Get fishing skill info
    const fishingSkill = playerData?.skills?.fishing;
    const fishingLevel = fishingSkill?.level ?? 1;
    const fishingXP = fishingSkill?.xp ?? 0;

    // Check for fishing tools in inventory
    const inventory = playerData?.inventory?.items || [];
    const hasFishingRod = inventory.some(
      (item) =>
        item.itemId?.includes("fishing_rod") || item.itemId?.includes("rod"),
    );
    const hasNet = inventory.some((item) => item.itemId?.includes("net"));
    const fishingTool =
      inventory.find(
        (item) =>
          item.itemId?.includes("fishing_rod") ||
          item.itemId?.includes("rod") ||
          item.itemId?.includes("net"),
      )?.itemId || "none";

    // Get nearby fishing spots
    const systems = world?.systems as unknown as
      | Record<string, unknown>
      | undefined;
    const resourceSystem = systems?.["resource"] as ResourceSystem | undefined;
    const allResources: ResourceItem[] = resourceSystem?.getAllResources
      ? resourceSystem.getAllResources()
      : [];
    const playerPos = player?.position;

    const nearbyFishingSpots: ResourceItem[] = allResources.filter(
      (resource: ResourceItem) => {
        if (!resource.type?.startsWith("fishing_")) return false;
        if (!playerPos || !resource.position) return false;

        const dx = resource.position.x - playerPos.x;
        const dz = resource.position.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance <= 15; // Within 15 units
      },
    );

    const fishingSpotList = nearbyFishingSpots
      .map((spot: ResourceItem) => {
        const dx = spot.position.x - playerPos!.x;
        const dz = spot.position.z - playerPos!.z;
        const distance = Math.sqrt(dx * dx + dz * dz).toFixed(1);
        return `- ${spot.type} (${distance}m away)`;
      })
      .join("\n");

    const text = `# Fishing Skill

## Current Status
- Level: ${fishingLevel}
- XP: ${fishingXP}
- Has Fishing Tool: ${hasFishingRod || hasNet ? `Yes (${fishingTool})` : "No"}

## Nearby Fishing Spots (${nearbyFishingSpots.length})
${nearbyFishingSpots.length > 0 ? fishingSpotList : "No fishing spots nearby"}

## Fishing Tips
- Walk near fishing spots and use CATCH_FISH action
- Fishing rods work on most water
- Small net for shrimp
- Raw fish can be cooked for food`;

    return {
      text,
      values: {
        fishing_level: fishingLevel,
        fishing_xp: fishingXP,
        has_fishing_tool: hasFishingRod || hasNet,
        fishing_tool: fishingTool,
        nearby_fishing_spots_count: nearbyFishingSpots.length,
        fishing_available: nearbyFishingSpots.length > 0,
      },
      data: {
        skill: fishingSkill,
        nearbyFishingSpots,
      },
    };
  },
};
