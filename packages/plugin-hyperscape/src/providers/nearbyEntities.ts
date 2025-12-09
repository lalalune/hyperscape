/**
 * nearbyEntitiesProvider - Supplies information about nearby players, NPCs, and resources
 *
 * Provides:
 * - Nearby players with names and positions
 * - Nearby NPCs (mobs) with names and positions
 * - Nearby resources (trees, rocks, fishing spots) with types and positions
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type {
  NearbyEntitiesData,
  PlayerEntity,
  MobEntity,
  ResourceEntity,
} from "../types.js";

export const nearbyEntitiesProvider: Provider = {
  name: "nearbyEntities",
  description: "Provides information about nearby players, NPCs, and resources",
  dynamic: true,
  position: 3,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const entities = service?.getNearbyEntities() || [];

    const players: NearbyEntitiesData["players"] = [];
    const npcs: NearbyEntitiesData["npcs"] = [];
    const resources: NearbyEntitiesData["resources"] = [];

    // Categorize entities by type
    entities.forEach((entity) => {
      const entityData = {
        name: entity.name || "Unknown",
        entityId: entity.id,
        position: entity.position as [number, number, number],
      };

      if ("playerName" in entity) {
        // PlayerEntity
        players.push(entityData);
      } else if ("mobType" in entity) {
        // MobEntity
        npcs.push(entityData);
      } else if ("resourceType" in entity) {
        // ResourceEntity
        resources.push({
          ...entityData,
          type: (entity as ResourceEntity).resourceType,
        });
      }
    });

    const nearbyEntitiesData: NearbyEntitiesData = { players, npcs, resources };

    const playersList =
      players.length > 0
        ? players
            .map(
              (p) =>
                `  - ${p.name} at [${p.position.map((n) => n.toFixed(1)).join(", ")}]`,
            )
            .join("\n")
        : "  (none nearby)";

    const npcsList =
      npcs.length > 0
        ? npcs
            .map(
              (n) =>
                `  - ${n.name} at [${n.position.map((n) => n.toFixed(1)).join(", ")}]`,
            )
            .join("\n")
        : "  (none nearby)";

    const resourcesList =
      resources.length > 0
        ? resources
            .map(
              (r) =>
                `  - ${r.name} (${r.type}) at [${r.position.map((n) => n.toFixed(1)).join(", ")}]`,
            )
            .join("\n")
        : "  (none nearby)";

    const text = `## Nearby Entities

**Players** (${players.length}):
${playersList}

**NPCs** (${npcs.length}):
${npcsList}

**Resources** (${resources.length}):
${resourcesList}`;

    return {
      text,
      values: {
        playerCount: players.length,
        npcCount: npcs.length,
        resourceCount: resources.length,
      },
      data: nearbyEntitiesData,
    };
  },
};
