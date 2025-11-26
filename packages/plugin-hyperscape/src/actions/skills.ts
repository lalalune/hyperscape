/**
 * Skill actions - CHOP_TREE, CATCH_FISH, LIGHT_FIRE, COOK_FOOD
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { GatherResourceCommand, Entity } from "../types.js";

// Max distance to attempt gathering (server update loop requires <= 4m)
const MAX_GATHER_DISTANCE = 4;

/**
 * Calculate 3D distance between player position and entity position
 */
function getEntityDistance(
  playerPos: unknown,
  entityPos: unknown,
): number | null {
  // Parse player position (array or object format)
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

  // Parse entity position (array or object format)
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

/**
 * Check if an entity is a tree (strict detection)
 */
function isTree(e: Entity): boolean {
  const entityAny = e as unknown as Record<string, unknown>;
  const name = e.name?.toLowerCase() || "";
  const id = (e.id || "").toLowerCase();

  // Exclude ground items (names starting with "Item:" or IDs containing item names)
  if (name.startsWith("item:") || /bow|sword|shield|axe|armor|helm/i.test(id)) {
    return false;
  }

  // Check for explicit tree types
  if (entityAny.resourceType === "tree" || entityAny.type === "tree") {
    return true;
  }

  // Check for tree-like names (must contain "tree" in name)
  if (name.includes("tree") && /oak|willow|maple|yew|normal/i.test(name)) {
    return true;
  }

  // Generic "tree" match
  if (name.includes("tree") && !name.includes("item")) {
    return true;
  }

  return false;
}

export const chopTreeAction: Action = {
  name: "CHOP_TREE",
  similes: ["CHOP", "WOODCUT", "CUT_TREE"],
  description: "Chop down a tree to gather logs. Requires an axe.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      logger.info("[CHOP_TREE] Validation failed: no service");
      return false;
    }
    const playerEntity = service.getPlayerEntity();
    const entities = service.getNearbyEntities() || [];

    // Check player entity exists and is alive
    if (!playerEntity) {
      logger.info("[CHOP_TREE] Validation failed: no player entity");
      return false;
    }

    // Check alive - treat undefined as alive (some entity formats don't set this explicitly)
    const isAlive = playerEntity.alive !== false;
    if (!service.isConnected() || !isAlive) {
      logger.info(
        `[CHOP_TREE] Validation failed: connected=${service.isConnected()}, alive=${playerEntity.alive}`,
      );
      return false;
    }

    // Check for axe or hatchet in inventory (hatchets are woodcutting tools)
    // Handle both flat (i.name) and nested (i.item.name) inventory formats
    const hasAxe =
      playerEntity.items?.some((i) => {
        const itemAny = i as unknown as Record<string, unknown>;
        const name = (
          i.name ||
          (itemAny.item as { name?: string } | undefined)?.name ||
          itemAny.itemId ||
          ""
        )
          .toString()
          .toLowerCase();
        return name.includes("axe") || name.includes("hatchet");
      }) ?? false;

    // Check for trees WITHIN approach range (20m)
    // Handler will walk to tree if needed, then chop when within 4m
    const playerPos = playerEntity.position;
    const allTrees = entities.filter(isTree);
    const approachableTrees = allTrees.filter((e) => {
      const entityAny = e as unknown as Record<string, unknown>;
      const entityPos = entityAny.position;
      if (!entityPos) return false;
      const dist = getEntityDistance(playerPos, entityPos);
      return dist !== null && dist <= 20; // 20m approach range
    });

    // Use approachable trees for validation
    const trees = approachableTrees;

    logger.info(
      `[CHOP_TREE] Validation: hasAxe=${hasAxe}, trees=${trees.length}, ` +
        `totalEntities=${entities.length}, items=${playerEntity.items?.length || 0}`,
    );

    if (!hasAxe) {
      logger.info("[CHOP_TREE] Validation failed: no axe/hatchet in inventory");
      // Log inventory for debugging - handle both formats
      const items = playerEntity.items || [];
      const itemCount = items.length;
      if (itemCount === 0) {
        logger.info(`[CHOP_TREE] Inventory is empty (${itemCount} items)`);
      } else {
        const itemDetails = items
          .map((i) => {
            const itemAny = i as unknown as Record<string, unknown>;
            const name =
              i.name ||
              (itemAny.item as { name?: string } | undefined)?.name ||
              itemAny.itemId ||
              "unknown";
            return `${name}`;
          })
          .join(", ");
        logger.info(
          `[CHOP_TREE] Inventory items (${itemCount}): ${itemDetails}`,
        );
      }
    }

    if (trees.length === 0) {
      logger.info("[CHOP_TREE] Validation failed: no trees nearby");
      // Log first few entities for debugging
      const entityInfo = entities
        .slice(0, 5)
        .map((e) => {
          const ea = e as unknown as Record<string, unknown>;
          return `${e.name || e.id}(type=${ea.type},rt=${ea.resourceType})`;
        })
        .join(", ");
      logger.info(`[CHOP_TREE] Nearby entities sample: ${entityInfo}`);
    }

    return hasAxe && trees.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const entities = service.getNearbyEntities();

      // Find trees and sort by distance
      const player = service.getPlayerEntity();
      const playerPos = player?.position;
      const allTrees = entities.filter(isTree);

      // Get all trees with distance, sorted by nearest
      const treesWithDistance = allTrees
        .map((e) => {
          const entityAny = e as unknown as Record<string, unknown>;
          const entityPos = entityAny.position;
          const dist = entityPos
            ? getEntityDistance(playerPos, entityPos)
            : null;
          return { entity: e, distance: dist, position: entityPos };
        })
        .filter((t) => t.distance !== null)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

      // Trees within gathering range (4m)
      const nearbyTrees = treesWithDistance.filter(
        (t) => t.distance !== null && t.distance <= MAX_GATHER_DISTANCE,
      );

      // Trees within approach range (20m) - close enough to walk to
      const approachableTrees = treesWithDistance.filter(
        (t) => t.distance !== null && t.distance <= 20,
      );

      logger.info(
        `[CHOP_TREE] Handler: Found ${nearbyTrees.length} trees within ${MAX_GATHER_DISTANCE}m, ` +
          `${approachableTrees.length} within 20m (${allTrees.length} total)`,
      );

      // If no trees within gathering range but some within approach range, walk to nearest first
      if (nearbyTrees.length === 0 && approachableTrees.length > 0) {
        const nearest = approachableTrees[0];
        const treePos = nearest.position as
          | [number, number, number]
          | { x: number; y: number; z: number };

        // Convert tree position to array format
        let treeX: number, treeY: number, treeZ: number;
        if (Array.isArray(treePos)) {
          [treeX, treeY, treeZ] = treePos;
        } else if (treePos && typeof treePos === "object" && "x" in treePos) {
          treeX = treePos.x;
          treeY = treePos.y;
          treeZ = treePos.z;
        } else {
          logger.info("[CHOP_TREE] Handler: Could not get tree position");
          await callback?.({ text: "Could not locate tree.", error: true });
          return { success: false };
        }

        // Get player position to calculate approach direction
        let px = 0,
          pz = 0;
        if (Array.isArray(playerPos)) {
          px = playerPos[0];
          pz = playerPos[2];
        } else if (
          playerPos &&
          typeof playerPos === "object" &&
          "x" in playerPos
        ) {
          const pos = playerPos as { x: number; z: number };
          px = pos.x;
          pz = pos.z;
        }

        // Calculate direction from tree to player (to stop 2m BEFORE the tree)
        const dx = px - treeX;
        const dz = pz - treeZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const STOP_DISTANCE = 2.5; // Stop 2.5m from tree center

        // Target position is 2.5m from tree towards where player is coming from
        let targetPos: [number, number, number];
        if (dist > 0.1) {
          // Normalize direction and offset from tree
          const nx = dx / dist;
          const nz = dz / dist;
          targetPos = [
            treeX + nx * STOP_DISTANCE,
            treeY,
            treeZ + nz * STOP_DISTANCE,
          ];
        } else {
          // Player is very close to tree center, just offset in X
          targetPos = [treeX + STOP_DISTANCE, treeY, treeZ];
        }

        logger.info(
          `[CHOP_TREE] Handler: Walking to tree ${nearest.entity.name} - ` +
            `stopping at ${JSON.stringify(targetPos.map((n) => Math.round(n)))} ` +
            `(tree at [${Math.round(treeX)}, ${Math.round(treeZ)}], ${nearest.distance?.toFixed(1)}m away)`,
        );

        // Walk to position near the tree
        await service.executeMove({ target: targetPos, runMode: false });
        await callback?.({
          text: `Walking to ${nearest.entity.name}...`,
          action: "CHOP_TREE",
        });
        return { success: true, text: `Walking to ${nearest.entity.name}` };
      }

      const tree = nearbyTrees[0]?.entity; // Pick nearest tree within range

      if (!tree) {
        logger.info("[CHOP_TREE] Handler: No tree found within approach range");
        await callback?.({ text: "No tree found nearby.", error: true });
        return { success: false };
      }

      // Log positions for debugging
      const treeAny = tree as unknown as Record<string, unknown>;
      const treePos = treeAny.position;
      const treeDist = nearbyTrees[0]?.distance;
      logger.info(
        `[CHOP_TREE] Handler: Chopping tree ${tree.id} (${tree.name}) ` +
          `at pos=${JSON.stringify(treePos)}, dist=${treeDist?.toFixed(1)}m, ` +
          `playerPos=${JSON.stringify(playerPos)}`,
      );

      const command: GatherResourceCommand = {
        resourceEntityId: tree.id,
        skill: "woodcutting",
      };
      await service.executeGatherResource(command);

      await callback?.({ text: `Chopping ${tree.name}`, action: "CHOP_TREE" });

      return { success: true, text: `Started chopping ${tree.name}` };
    } catch (error) {
      logger.error(
        `[CHOP_TREE] Handler error: ${error instanceof Error ? error.message : error}`,
      );
      await callback?.({
        text: `Failed to chop: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Chop down that oak tree" } },
      {
        name: "agent",
        content: { text: "Chopping Oak Tree", action: "CHOP_TREE" },
      },
    ],
  ],
};

export const catchFishAction: Action = {
  name: "CATCH_FISH",
  similes: ["FISH", "FISHING"],
  description: "Catch fish at a fishing spot. Requires a fishing rod.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();
    const entities = service.getNearbyEntities() || [];

    if (!service.isConnected() || !playerEntity?.alive) return false;

    const hasRod = playerEntity.items.some((i) =>
      i.name.toLowerCase().includes("fishing rod"),
    );
    const hasSpot = entities.some(
      (e) =>
        "resourceType" in e &&
        (e as { resourceType: string }).resourceType === "fishing_spot",
    );

    return hasRod && hasSpot;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const entities = service.getNearbyEntities();

      const fishingSpot = entities.find(
        (e) =>
          "resourceType" in e &&
          (e as { resourceType: string }).resourceType === "fishing_spot",
      );

      if (!fishingSpot) {
        await callback?.({
          text: "No fishing spot found nearby.",
          error: true,
        });
        return { success: false };
      }

      const command: GatherResourceCommand = {
        resourceEntityId: fishingSpot.id,
        skill: "fishing",
      };
      await service.executeGatherResource(command);

      await callback?.({ text: "Fishing...", action: "CATCH_FISH" });

      return { success: true, text: "Started fishing" };
    } catch (error) {
      await callback?.({
        text: `Failed to fish: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Catch some fish" } },
      { name: "agent", content: { text: "Fishing...", action: "CATCH_FISH" } },
    ],
  ],
};

export const lightFireAction: Action = {
  name: "LIGHT_FIRE",
  similes: ["FIREMAKING", "MAKE_FIRE", "BURN_LOGS"],
  description: "Light a fire. Requires tinderbox and logs.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    if (!service.isConnected() || !playerEntity?.alive) return false;

    const hasTinderbox = playerEntity.items.some((i) =>
      i.name.toLowerCase().includes("tinderbox"),
    );
    const hasLogs = playerEntity.items.some((i) =>
      i.name.toLowerCase().includes("logs"),
    );

    return hasTinderbox && hasLogs;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const command: GatherResourceCommand = {
        resourceEntityId: "",
        skill: "firemaking",
      };
      await service.executeGatherResource(command);

      await callback?.({ text: "Lighting a fire...", action: "LIGHT_FIRE" });

      return { success: true, text: "Started lighting fire" };
    } catch (error) {
      await callback?.({
        text: `Failed to light fire: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Light a fire" } },
      {
        name: "agent",
        content: { text: "Lighting a fire...", action: "LIGHT_FIRE" },
      },
    ],
  ],
};

export const cookFoodAction: Action = {
  name: "COOK_FOOD",
  similes: ["COOK", "COOKING"],
  description: "Cook raw food. Requires raw food and a fire.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    if (!service.isConnected() || !playerEntity?.alive) return false;

    const hasRawFood = playerEntity.items.some((i) =>
      i.name.toLowerCase().includes("raw"),
    );

    return hasRawFood;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const playerEntity = service.getPlayerEntity();
      const content = message.content.text || "";

      const rawFood = playerEntity?.items.find(
        (i) =>
          i.name.toLowerCase().includes("raw") &&
          i.name.toLowerCase().includes(content.toLowerCase()),
      );

      if (!rawFood) {
        await callback?.({
          text: "No raw food found in inventory.",
          error: true,
        });
        return { success: false };
      }

      const command: GatherResourceCommand = {
        resourceEntityId: rawFood.id,
        skill: "cooking",
      };
      await service.executeGatherResource(command);

      await callback?.({
        text: `Cooking ${rawFood.name}...`,
        action: "COOK_FOOD",
      });

      return { success: true, text: `Cooking ${rawFood.name}` };
    } catch (error) {
      await callback?.({
        text: `Failed to cook: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Cook the raw fish" } },
      {
        name: "agent",
        content: { text: "Cooking Raw Fish...", action: "COOK_FOOD" },
      },
    ],
  ],
};
