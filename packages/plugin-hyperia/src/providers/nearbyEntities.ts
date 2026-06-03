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
import type { HyperiaService } from "../services/HyperiaService.js";
import type {
  NearbyEntitiesData,
  PlayerEntity,
  MobEntity,
  ResourceEntity,
} from "../types.js";

/**
 * Calculate 2D distance between player and entity
 */
function getEntityDistance(
  playerPos: unknown,
  entityPos: unknown,
): number | null {
  let px: number, pz: number;
  if (Array.isArray(playerPos) && playerPos.length >= 3) {
    px = playerPos[0];
    pz = playerPos[2];
  } else if (playerPos && typeof playerPos === "object" && "x" in playerPos) {
    const pos = playerPos as { x: number; z: number };
    px = pos.x;
    pz = pos.z;
  } else {
    return null;
  }

  let ex: number, ez: number;
  if (Array.isArray(entityPos) && entityPos.length >= 3) {
    ex = entityPos[0];
    ez = entityPos[2];
  } else if (entityPos && typeof entityPos === "object" && "x" in entityPos) {
    const pos = entityPos as { x: number; z: number };
    ex = pos.x;
    ez = pos.z;
  } else {
    return null;
  }

  const dx = px - ex;
  const dz = pz - ez;
  return Math.sqrt(dx * dx + dz * dz);
}

export const nearbyEntitiesProvider: Provider = {
  name: "nearbyEntities",
  description: "Provides information about nearby players, NPCs, and resources",
  dynamic: true,
  position: 3,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
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

    const playerEntity = service?.getPlayerEntity();
    const playerPos = playerEntity?.position;

    const formatDistance = (pos: [number, number, number]) => {
      if (!playerPos) return "";
      const dist = getEntityDistance(playerPos, pos);
      if (dist === null) return "";
      if (dist <= 5) return ` (${dist.toFixed(1)}m away, NEAR YOU!)`;
      if (dist <= 20) return ` (${dist.toFixed(1)}m away, CLOSE)`;
      return ` (${dist.toFixed(1)}m away)`;
    };

    const playersList =
      players.length > 0
        ? players
            .map(
              (p) =>
                `  - ${p.name} at [${p.position.map((n) => n.toFixed(1)).join(", ")}]${formatDistance(p.position)}`,
            )
            .join("\n")
        : "  (none nearby)";

    const npcsList =
      npcs.length > 0
        ? npcs
            .map(
              (n) =>
                `  - ${n.name} at [${n.position.map((n) => n.toFixed(1)).join(", ")}]${formatDistance(n.position)}`,
            )
            .join("\n")
        : "  (none nearby)";

    const resourcesList =
      resources.length > 0
        ? resources
            .map(
              (r) =>
                `  - ${r.name} (${r.type}) at [${r.position.map((n) => n.toFixed(1)).join(", ")}]${formatDistance(r.position)}`,
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
      data: {},
    };
  },
};
