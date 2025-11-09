import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
} from "@elizaos/core";
import { HyperscapeService } from "../../service";

export const cookingSkillProvider: Provider = {
  name: "COOKING_INFO",
  description:
    "Provides cooking skill level, nearby fires, and raw food availability",
  dynamic: true, // Only loaded when explicitly requested by cooking actions
  position: 2, // Contextual skills come after world state, before actions
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );

    if (!service || !service.isConnected()) {
      return {
        text: "# Cooking Skill\nStatus: Not connected to world",
        values: {
          cooking_available: false,
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

    // Get cooking skill info
    const cookingSkill = playerData?.skills?.cooking;
    const cookingLevel = cookingSkill?.level ?? 1;
    const cookingXP = cookingSkill?.xp ?? 0;

    // Check for raw food in inventory
    const inventory = playerData?.inventory?.items || [];
    const rawFood = inventory.filter((item) => item.itemId?.includes("raw_"));
    const hasRawFood = rawFood.length > 0;
    const rawFoodList = rawFood
      .map((item) => `${item.itemId} (${item.quantity})`)
      .join(", ");

    // Find nearby fires
    const entities = world?.entities?.items;
    const playerPos = player?.position;
    const nearbyFires: Array<{ id: string; name: string; distance: number }> =
      [];

    if (entities && playerPos) {
      for (const [id, entity] of entities.entries()) {
        const entityType = entity?.type as string;
        const entityName = entity?.name || "Unnamed";

        if (
          entityType?.includes("fire") ||
          entityName?.toLowerCase().includes("fire")
        ) {
          const entityPos = entity?.position;
          if (entityPos) {
            const dx = entityPos.x - playerPos.x;
            const dz = entityPos.z - playerPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance <= 15) {
              nearbyFires.push({ id, name: entityName, distance });
            }
          }
        }
      }
    }

    const fireList = nearbyFires
      .map((fire) => `- ${fire.name} (${fire.distance.toFixed(1)}m away)`)
      .join("\n");

    const text = `# Cooking Skill

## Current Status
- Level: ${cookingLevel}
- XP: ${cookingXP}
- Has Raw Food: ${hasRawFood ? `Yes (${rawFoodList})` : "No"}

## Nearby Fires (${nearbyFires.length})
${nearbyFires.length > 0 ? fireList : "No fires nearby"}

## Cooking Tips
- Use COOK_FOOD action when near a fire with raw food
- Cooked food heals more than raw food
- Higher level cooking reduces burn chance
- Fish from fishing or meat from combat`;

    return {
      text,
      values: {
        cooking_level: cookingLevel,
        cooking_xp: cookingXP,
        has_raw_food: hasRawFood,
        raw_food_types: rawFood.length,
        nearby_fires_count: nearbyFires.length,
        cooking_available: hasRawFood && nearbyFires.length > 0,
      },
      data: {
        skill: cookingSkill,
        rawFood,
        nearbyFires,
      },
    };
  },
};
