/**
 * Skill actions - CHOP_TREE, MINE_ROCK, CATCH_FISH, LIGHT_FIRE, COOK_FOOD
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  HandlerOptions,
  JsonValue,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { GatherResourceCommand, Entity, InventoryItem } from "../types.js";
import {
  hasAxe as detectHasAxe,
  hasPickaxe as detectHasPickaxe,
  hasTinderbox as detectHasTinderbox,
  hasLogs as detectHasLogs,
  getItemName,
} from "../utils/item-detection.js";

// Max distance to attempt gathering (server update loop requires <= 4m)
const MAX_GATHER_DISTANCE = 4;
type HandlerOptionsParam =
  | HandlerOptions
  | Record<string, JsonValue | undefined>;

type Position3 = [number, number, number];
type PositionLike = Position3 | { x: number; y?: number; z: number };

function getPositionXZ(pos: PositionLike | null | undefined): {
  x: number;
  z: number;
} | null {
  if (!pos) return null;
  if (Array.isArray(pos) && pos.length >= 3) {
    return { x: pos[0], z: pos[2] };
  }
  const obj = pos as { x: number; z: number };
  return { x: obj.x, z: obj.z };
}

function getPositionArray(
  pos: PositionLike | null | undefined,
): Position3 | null {
  if (!pos) return null;
  if (Array.isArray(pos) && pos.length >= 3) {
    return [pos[0], pos[1], pos[2]];
  }
  const obj = pos as { x: number; y?: number; z: number };
  return [obj.x, obj.y ?? 0, obj.z];
}

/**
 * Calculate 3D distance between player position and entity position
 */
function getEntityDistance(
  playerPos: PositionLike | null | undefined,
  entityPos: PositionLike | null | undefined,
): number | null {
  const player = getPositionXZ(playerPos);
  const entity = getPositionXZ(entityPos);
  if (!player || !entity) return null;
  const dx = player.x - entity.x;
  const dz = player.z - entity.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function getInventoryItemName(item: InventoryItem): string {
  return (item.name || item.item?.name || item.itemId || "")
    .toString()
    .toLowerCase();
}

/**
 * Check if an entity is a tree (strict detection)
 * Also checks that the tree is not depleted
 */
function isTree(e: Entity): boolean {
  const name = e.name?.toLowerCase() || "";
  const id = (e.id || "").toLowerCase();

  // Exclude depleted resources - they can't be gathered
  if (e.depleted === true) {
    return false;
  }

  // Exclude ground items (by type or ID patterns)
  const entityType = (e.type || "").toLowerCase();
  if (entityType === "item" || /bow|sword|shield|axe|armor|helm/i.test(id)) {
    return false;
  }

  // Check for explicit tree types
  if (e.resourceType === "tree" || e.type === "tree") {
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

/**
 * Check if an entity is a tree but depleted (for logging purposes)
 */
function isDepletedTree(e: Entity): boolean {
  const name = e.name?.toLowerCase() || "";

  // Must be depleted
  if (e.depleted !== true) {
    return false;
  }

  // Check if it's a tree type
  if (e.resourceType === "tree" || e.type === "tree") {
    return true;
  }

  // Check for tree-like names
  if (name.includes("tree")) {
    return true;
  }

  return false;
}

/**
 * Check if an entity is a fishing spot
 */
function isFishingSpot(e: Entity): boolean {
  const resourceType = (e.resourceType || "").toLowerCase();
  const type = (e.type || "").toLowerCase();
  const name = e.name?.toLowerCase() || "";

  if (resourceType === "fishing_spot" || resourceType === "fish") return true;
  if (type === "fishing_spot") return true;
  if (name.includes("fishing spot")) return true;

  return false;
}

/**
 * Fishing tool keywords and the spot resourceIds they can be used at.
 * The server uses EXACT tool matching per spot, so agents must only
 * approach spots that match the tool they have in their inventory.
 */
const FISHING_TOOL_KEYWORDS: Array<{
  keywords: string[];
  spotResourceIds: string[];
}> = [
  {
    keywords: [
      "small_fishing_net",
      "small fishing net",
      "fishing net",
      "fishing_net",
      "net",
    ],
    spotResourceIds: ["fishing_spot_net", "fishing_spot_monkfish"],
  },
  {
    keywords: ["fly_fishing_rod", "fly fishing rod", "fly_rod"],
    spotResourceIds: ["fishing_spot_fly"],
  },
  {
    keywords: ["fishing_rod", "fishing rod"],
    spotResourceIds: ["fishing_spot_bait"],
  },
  {
    keywords: ["harpoon"],
    spotResourceIds: ["fishing_spot_harpoon", "fishing_spot_shark"],
  },
  {
    keywords: ["lobster_pot", "lobster pot", "lobster_cage"],
    spotResourceIds: ["fishing_spot_cage"],
  },
];

/**
 * Normalize a name for fuzzy matching: lowercase, replace underscores with spaces.
 */
function normalizeFishingName(name: string): string {
  return name.toLowerCase().replace(/_/g, " ");
}

/**
 * Check if the player has ANY fishing tool and return matching spot resource IDs.
 */
function getMatchingFishingSpotIds(items: InventoryItem[]): string[] {
  const matchedSpotIds: string[] = [];
  for (const toolDef of FISHING_TOOL_KEYWORDS) {
    const hasTool = items.some((item) => {
      const rawName = getInventoryItemName(item);
      const name = normalizeFishingName(rawName);
      // Also check original name and underscore variant
      return toolDef.keywords.some((kw) => {
        const normalizedKw = normalizeFishingName(kw);
        return name.includes(normalizedKw) || name.includes(kw);
      });
    });
    if (hasTool) {
      matchedSpotIds.push(...toolDef.spotResourceIds);
    }
  }
  return matchedSpotIds;
}

function hasFishingTool(items: InventoryItem[]): boolean {
  return items.some((item) => {
    const rawName = getInventoryItemName(item);
    const name = normalizeFishingName(rawName);
    return (
      name.includes("fishing net") ||
      name.includes("fishing rod") ||
      name.includes("fly fishing rod") ||
      name.includes("harpoon") ||
      name.includes("lobster pot") ||
      name.includes("lobster cage") ||
      rawName.includes("small_fishing_net") ||
      rawName.includes("fly_fishing_rod") ||
      rawName.includes("fishing_rod") ||
      rawName.includes("lobster_pot") ||
      rawName.includes("fishing_net")
    );
  });
}

/**
 * Check if an entity is a mining rock
 */
function isMiningRock(e: Entity): boolean {
  const resourceType = (e.resourceType || "").toLowerCase();
  const type = (e.type || "").toLowerCase();
  const name = e.name?.toLowerCase() || "";

  if (resourceType === "mining_rock") return true;
  if (resourceType === "ore" || resourceType === "rock") return true;
  if (type === "mining_rock" || type === "rock") return true;
  if (name.includes("rock") || name.includes("ore")) return true;

  return false;
}

/**
 * Check if a player has the required woodcutting level to chop a tree
 * @param tree - The tree entity
 * @param playerWoodcuttingLevel - Player's current woodcutting level
 * @returns true if the player can chop this tree
 */
function canChopTree(tree: Entity, playerWoodcuttingLevel: number): boolean {
  const requiredLevel = tree.requiredLevel ?? 1;
  return playerWoodcuttingLevel >= requiredLevel;
}

/**
 * Get the required level for a tree
 */
function getTreeRequiredLevel(tree: Entity): number {
  return tree.requiredLevel ?? 1;
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
    if (!service.isConnected() || !isAlive || playerEntity.inCombat) {
      logger.info(
        `[CHOP_TREE] Validation failed: connected=${service.isConnected()}, alive=${playerEntity.alive}, inCombat=${playerEntity.inCombat}`,
      );
      return false;
    }

    // Check for axe or hatchet in inventory using centralized item detection
    const hasAxe = detectHasAxe(playerEntity);

    // Get player's woodcutting level
    const skills = playerEntity.skills;
    const woodcuttingLevel = skills?.woodcutting?.level ?? 1;

    // Check for trees WITHIN approach range (40m)
    // Handler will walk to tree if needed, then chop when within 4m
    const playerPos = playerEntity.position;
    const allTrees = entities.filter(isTree);
    const approachableTrees = allTrees.filter((e) => {
      const entityPos = e.position;
      if (!entityPos) return false;
      const dist = getEntityDistance(playerPos, entityPos);
      return dist !== null && dist <= 40; // 40m approach range
    });

    // Filter by level requirement
    const choppableTrees = approachableTrees.filter((tree) =>
      canChopTree(tree, woodcuttingLevel),
    );
    const tooHighLevel = approachableTrees.filter(
      (tree) => !canChopTree(tree, woodcuttingLevel),
    );

    logger.info(
      `[CHOP_TREE] Validation: hasAxe=${hasAxe}, choppableTrees=${choppableTrees.length}, ` +
        `tooHighLevel=${tooHighLevel.length}, woodcuttingLevel=${woodcuttingLevel}, totalEntities=${entities.length}`,
    );

    if (!hasAxe) {
      logger.info("[CHOP_TREE] Validation failed: no axe/hatchet in inventory");
      // Log inventory for debugging - handle both formats
      const items = playerEntity.items || [];
      const itemCount = items.length;
      if (itemCount === 0) {
        logger.info(`[CHOP_TREE] Inventory is empty (${itemCount} items)`);
      } else {
        // Use centralized getItemName for consistent item name extraction
        const itemDetails = items
          .map((i) => getItemName(i) || "unknown")
          .join(", ");
        logger.info(
          `[CHOP_TREE] Inventory items (${itemCount}): ${itemDetails}`,
        );
      }
    }

    if (choppableTrees.length === 0 && tooHighLevel.length > 0) {
      logger.info(
        `[CHOP_TREE] Validation failed: ${tooHighLevel.length} trees nearby but all require higher Woodcutting level (player: ${woodcuttingLevel})`,
      );
    } else if (approachableTrees.length === 0) {
      logger.info("[CHOP_TREE] Validation failed: no trees nearby");
      // Log first few entities for debugging
      const entityInfo = entities
        .slice(0, 5)
        .map((e) => {
          const type = e.type || e.entityType || "unknown";
          const resourceType = e.resourceType || "unknown";
          return `${e.name || e.id}(type=${type},rt=${resourceType})`;
        })
        .join(", ");
      logger.info(`[CHOP_TREE] Nearby entities sample: ${entityInfo}`);
    }

    return hasAxe && choppableTrees.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: HandlerOptionsParam,
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
      const depletedTrees = entities.filter(isDepletedTree);

      // Get player's woodcutting level for level requirement filtering
      const skills = player?.skills;
      const woodcuttingLevel = skills?.woodcutting?.level ?? 1;

      // Log depleted trees if any found (helps debug why agent might be waiting)
      if (depletedTrees.length > 0) {
        logger.info(
          `[CHOP_TREE] Handler: ${depletedTrees.length} depleted tree(s) nearby (waiting to respawn): ` +
            depletedTrees
              .slice(0, 3)
              .map((t) => t.id)
              .join(", "),
        );
      }

      // Get all trees with distance, sorted by nearest
      // CRITICAL: Filter by level requirement first so we don't walk to trees we can't chop
      const treesWithDistance = allTrees
        .filter((tree) => canChopTree(tree, woodcuttingLevel)) // Only trees we can chop
        .map((e) => {
          const entityPos = e.position;
          const dist = entityPos
            ? getEntityDistance(playerPos, entityPos)
            : null;
          return { entity: e, distance: dist, position: entityPos };
        })
        .filter((t) => t.distance !== null)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

      // Log trees that are too high level
      const tooHighLevelTrees = allTrees.filter(
        (tree) => !canChopTree(tree, woodcuttingLevel),
      );
      if (tooHighLevelTrees.length > 0) {
        const examples = tooHighLevelTrees
          .slice(0, 3)
          .map((t) => `${t.name} (requires ${getTreeRequiredLevel(t)})`)
          .join(", ");
        logger.info(
          `[CHOP_TREE] Handler: Skipping ${tooHighLevelTrees.length} tree(s) requiring higher level than ${woodcuttingLevel}: ${examples}`,
        );
      }

      // Trees within gathering range (4m)
      const nearbyTrees = treesWithDistance.filter(
        (t) => t.distance !== null && t.distance <= MAX_GATHER_DISTANCE,
      );

      // Trees within approach range (40m) - close enough to walk to
      const approachableTrees = treesWithDistance.filter(
        (t) => t.distance !== null && t.distance <= 40,
      );

      logger.info(
        `[CHOP_TREE] Handler: Found ${nearbyTrees.length} choppable trees within ${MAX_GATHER_DISTANCE}m, ` +
          `${approachableTrees.length} within 40m (woodcutting level: ${woodcuttingLevel})`,
      );

      // If no trees within gathering range but some within approach range, walk to nearest first
      if (nearbyTrees.length === 0 && approachableTrees.length > 0) {
        const nearest = approachableTrees[0];
        const treePos = getPositionArray(
          nearest.position as PositionLike | null,
        );
        if (!treePos) {
          logger.info("[CHOP_TREE] Handler: Could not get tree position");
          await callback?.({ text: "Could not locate tree.", error: true });
          return { success: false };
        }
        const [treeX, treeY, treeZ] = treePos;

        // Get player position to find nearest cardinal adjacent tile
        const playerXZ = getPositionXZ(playerPos as PositionLike | null);
        if (!playerXZ) {
          logger.info("[CHOP_TREE] Handler: Could not get player position");
          await callback?.({ text: "Could not locate player.", error: true });
          return { success: false };
        }
        const { x: px, z: pz } = playerXZ;

        // Server requires player to be on a CARDINAL adjacent tile (N/S/E/W, not diagonal)
        // Calculate the 4 cardinal adjacent positions and pick the nearest one to player
        const treeTileX = Math.floor(treeX);
        const treeTileZ = Math.floor(treeZ);
        const cardinalPositions = [
          { x: treeTileX, z: treeTileZ - 1, dir: "South" }, // South (Z-)
          { x: treeTileX, z: treeTileZ + 1, dir: "North" }, // North (Z+)
          { x: treeTileX - 1, z: treeTileZ, dir: "West" }, // West (X-)
          { x: treeTileX + 1, z: treeTileZ, dir: "East" }, // East (X+)
        ];

        // Find the cardinal position nearest to player
        let nearestCardinal = cardinalPositions[0];
        let minDist = Infinity;
        for (const pos of cardinalPositions) {
          const dist = Math.sqrt(
            Math.pow(px - pos.x, 2) + Math.pow(pz - pos.z, 2),
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCardinal = pos;
          }
        }

        // Target the center of the cardinal adjacent tile
        const targetPos: [number, number, number] = [
          nearestCardinal.x + 0.5,
          treeY,
          nearestCardinal.z + 0.5,
        ];

        logger.info(
          `[CHOP_TREE] Handler: Walking to tree ${nearest.entity.name} - ` +
            `stopping at cardinal tile [${nearestCardinal.x}, ${nearestCardinal.z}] (${nearestCardinal.dir}) ` +
            `(tree at tile [${treeTileX}, ${treeTileZ}], ${nearest.distance?.toFixed(1)}m away)`,
        );

        // Walk to cardinal adjacent position
        await service.executeMove({ target: targetPos, runMode: false });
        await callback?.({
          text: `Walking to ${nearest.entity.name}...`,
          action: "CHOP_TREE",
        });
        return {
          success: true,
          text: `Walking to ${nearest.entity.name}`,
          data: { moving: true },
        };
      }

      const tree = nearbyTrees[0]?.entity; // Pick nearest tree within range

      if (!tree) {
        // Check if there are trees but all too high level
        const allNearbyTrees = allTrees.filter((t) => {
          const entityPos = t.position;
          if (!entityPos) return false;
          const dist = getEntityDistance(playerPos, entityPos);
          return dist !== null && dist <= 40;
        });

        if (allNearbyTrees.length > 0) {
          const example = allNearbyTrees[0];
          const requiredLvl = getTreeRequiredLevel(example);
          logger.info(
            `[CHOP_TREE] Handler: All nearby trees require higher level (need ${requiredLvl}, have ${woodcuttingLevel})`,
          );
          await callback?.({
            text: `All nearby trees require higher Woodcutting level (need ${requiredLvl}, have ${woodcuttingLevel}). Look for regular trees for lower levels.`,
            error: true,
          });
        } else {
          logger.info(
            "[CHOP_TREE] Handler: No tree found within approach range",
          );
          await callback?.({ text: "No tree found nearby.", error: true });
        }
        return { success: false };
      }

      // Log positions for debugging
      const treePos = tree.position;
      const treeDist = nearbyTrees[0]?.distance;

      // Get tree position for cardinal check
      const treePosArray = getPositionArray(treePos as PositionLike | null);
      if (!treePosArray) {
        logger.info("[CHOP_TREE] Handler: Could not get tree position");
        await callback?.({ text: "Could not locate tree.", error: true });
        return { success: false };
      }
      const [treeX, treeY, treeZ] = treePosArray;

      // Get player position
      const playerXZ = getPositionXZ(playerPos as PositionLike | null);
      if (!playerXZ) {
        logger.info("[CHOP_TREE] Handler: Could not get player position");
        await callback?.({ text: "Could not locate player.", error: true });
        return { success: false };
      }
      const { x: px, z: pz } = playerXZ;

      // Check if player is on a cardinal adjacent tile
      const treeTileX = Math.floor(treeX);
      const treeTileZ = Math.floor(treeZ);
      const playerTileX = Math.floor(px);
      const playerTileZ = Math.floor(pz);

      const isCardinalAdjacent =
        (playerTileX === treeTileX &&
          Math.abs(playerTileZ - treeTileZ) === 1) ||
        (playerTileZ === treeTileZ && Math.abs(playerTileX - treeTileX) === 1);

      logger.info(
        `[CHOP_TREE] Handler: Tree ${tree.id} (${tree.name}) ` +
          `at tile [${treeTileX}, ${treeTileZ}], player at tile [${playerTileX}, ${playerTileZ}], ` +
          `dist=${treeDist?.toFixed(1)}m, cardinalAdjacent=${isCardinalAdjacent}`,
      );

      // If not on cardinal adjacent tile, walk to one
      if (!isCardinalAdjacent) {
        const cardinalPositions = [
          { x: treeTileX, z: treeTileZ - 1, dir: "South" },
          { x: treeTileX, z: treeTileZ + 1, dir: "North" },
          { x: treeTileX - 1, z: treeTileZ, dir: "West" },
          { x: treeTileX + 1, z: treeTileZ, dir: "East" },
        ];

        let nearestCardinal = cardinalPositions[0];
        let minDist = Infinity;
        for (const pos of cardinalPositions) {
          const dist = Math.sqrt(
            Math.pow(px - pos.x, 2) + Math.pow(pz - pos.z, 2),
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCardinal = pos;
          }
        }

        const targetPos: [number, number, number] = [
          nearestCardinal.x + 0.5,
          treeY,
          nearestCardinal.z + 0.5,
        ];

        logger.info(
          `[CHOP_TREE] Handler: Not on cardinal tile, moving to [${nearestCardinal.x}, ${nearestCardinal.z}] (${nearestCardinal.dir})`,
        );

        await service.executeMove({ target: targetPos, runMode: false });
        await callback?.({
          text: `Positioning to chop ${tree.name}...`,
          action: "CHOP_TREE",
        });
        return {
          success: true,
          text: `Positioning to chop ${tree.name}`,
          data: { moving: true },
        };
      }

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

/**
 * Check if an entity is a rock/ore node (for mining)
 * Also checks that the rock is not depleted
 */
function isRock(e: Entity): boolean {
  const name = e.name?.toLowerCase() || "";

  // Exclude depleted resources - they can't be gathered
  if (e.depleted === true) {
    return false;
  }

  // Exclude ground items
  const entityType = (e.type || "").toLowerCase();
  if (entityType === "item" || name.startsWith("item:")) {
    return false;
  }

  // Check for explicit rock/ore types
  if (e.resourceType === "rock" || e.resourceType === "ore") {
    return true;
  }

  // Check for rock-like names
  if (name.includes("rock") || name.includes("ore") || name.includes("vein")) {
    return true;
  }

  // Check for specific ore types
  if (/copper|tin|iron|coal|mithril|adamant|rune|gold|silver/i.test(name)) {
    return true;
  }

  return false;
}

/**
 * Check if a player has the required mining level to mine a rock
 * @param rock - The rock entity
 * @param playerMiningLevel - Player's current mining level
 * @returns true if the player can mine this rock
 */
function canMineRock(rock: Entity, playerMiningLevel: number): boolean {
  const requiredLevel = rock.requiredLevel ?? 1;
  return playerMiningLevel >= requiredLevel;
}

/**
 * Get the required level for a rock
 */
function getRockRequiredLevel(rock: Entity): number {
  return rock.requiredLevel ?? 1;
}

/**
 * Check if an entity is a rock but depleted (for logging purposes)
 */
function isDepletedRock(e: Entity): boolean {
  const name = e.name?.toLowerCase() || "";

  // Must be depleted
  if (e.depleted !== true) {
    return false;
  }

  // Check if it's a rock type
  if (e.resourceType === "rock" || e.resourceType === "ore") {
    return true;
  }

  // Check for rock-like names
  if (name.includes("rock") || name.includes("ore") || name.includes("vein")) {
    return true;
  }

  return false;
}

export const mineRockAction: Action = {
  name: "MINE_ROCK",
  similes: ["MINE", "MINING", "MINE_ORE"],
  description: "Mine a rock to gather ore. Requires a pickaxe.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      logger.info("[MINE_ROCK] Validation failed: no service");
      return false;
    }
    const playerEntity = service.getPlayerEntity();
    const entities = service.getNearbyEntities() || [];

    // Check player entity exists and is alive
    if (!playerEntity) {
      logger.info("[MINE_ROCK] Validation failed: no player entity");
      return false;
    }

    const isAlive = playerEntity.alive !== false;
    if (!service.isConnected() || !isAlive || playerEntity.inCombat) {
      logger.info(
        `[MINE_ROCK] Validation failed: connected=${service.isConnected()}, alive=${playerEntity.alive}, inCombat=${playerEntity.inCombat}`,
      );
      return false;
    }

    // Check for pickaxe in inventory using centralized item detection
    const hasPickaxe = detectHasPickaxe(playerEntity);

    // Get player's mining level
    const skills = playerEntity.skills;
    const miningLevel = skills?.mining?.level ?? 1;

    // Check for rocks within approach range (40m) that player can mine
    const playerPos = playerEntity.position;
    const allRocks = entities.filter(isRock);
    const approachableRocks = allRocks.filter((e) => {
      const entityPos = e.position;
      if (!entityPos) return false;
      const dist = getEntityDistance(playerPos, entityPos);
      return dist !== null && dist <= 40;
    });

    // Filter by level requirement
    const mineableRocks = approachableRocks.filter((rock) =>
      canMineRock(rock, miningLevel),
    );
    const tooHighLevel = approachableRocks.filter(
      (rock) => !canMineRock(rock, miningLevel),
    );

    logger.info(
      `[MINE_ROCK] Validation: hasPickaxe=${hasPickaxe}, mineableRocks=${mineableRocks.length}, ` +
        `tooHighLevel=${tooHighLevel.length}, miningLevel=${miningLevel}, totalEntities=${entities.length}`,
    );

    if (!hasPickaxe) {
      logger.info("[MINE_ROCK] Validation failed: no pickaxe in inventory");
    }

    if (mineableRocks.length === 0 && tooHighLevel.length > 0) {
      logger.info(
        `[MINE_ROCK] Validation failed: ${tooHighLevel.length} rocks nearby but all require higher mining level (player: ${miningLevel})`,
      );
    } else if (approachableRocks.length === 0) {
      logger.info("[MINE_ROCK] Validation failed: no rocks nearby");
    }

    return hasPickaxe && mineableRocks.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
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

      // Find rocks and sort by distance
      const player = service.getPlayerEntity();
      const playerPos = player?.position;
      const allRocks = entities.filter(isRock);
      const depletedRocks = entities.filter(isDepletedRock);

      // Get player's mining level for level requirement filtering
      const skills = player?.skills;
      const miningLevel = skills?.mining?.level ?? 1;

      // Log depleted rocks if any found
      if (depletedRocks.length > 0) {
        logger.info(
          `[MINE_ROCK] Handler: ${depletedRocks.length} depleted rock(s) nearby (waiting to respawn): ` +
            depletedRocks
              .slice(0, 3)
              .map((r) => r.id)
              .join(", "),
        );
      }

      // Get all rocks with distance, sorted by nearest
      // CRITICAL: Filter by level requirement first so we don't walk to rocks we can't mine
      const rocksWithDistance = allRocks
        .filter((rock) => canMineRock(rock, miningLevel)) // Only rocks we can mine
        .map((e) => {
          const entityPos = e.position;
          const dist = entityPos
            ? getEntityDistance(playerPos, entityPos)
            : null;
          return { entity: e, distance: dist, position: entityPos };
        })
        .filter((r) => r.distance !== null)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

      // Log rocks that are too high level
      const tooHighLevelRocks = allRocks.filter(
        (rock) => !canMineRock(rock, miningLevel),
      );
      if (tooHighLevelRocks.length > 0) {
        const examples = tooHighLevelRocks
          .slice(0, 3)
          .map((r) => `${r.name} (requires ${getRockRequiredLevel(r)})`)
          .join(", ");
        logger.info(
          `[MINE_ROCK] Handler: Skipping ${tooHighLevelRocks.length} rock(s) requiring higher level than ${miningLevel}: ${examples}`,
        );
      }

      // Rocks within gathering range (4m)
      const nearbyRocks = rocksWithDistance.filter(
        (r) => r.distance !== null && r.distance <= MAX_GATHER_DISTANCE,
      );

      // Rocks within approach range (40m)
      const approachableRocks = rocksWithDistance.filter(
        (r) => r.distance !== null && r.distance <= 40,
      );

      logger.info(
        `[MINE_ROCK] Handler: Found ${nearbyRocks.length} mineable rocks within ${MAX_GATHER_DISTANCE}m, ` +
          `${approachableRocks.length} within 40m (mining level: ${miningLevel})`,
      );

      // If no rocks within gathering range but some within approach range, walk to nearest
      if (nearbyRocks.length === 0 && approachableRocks.length > 0) {
        const nearest = approachableRocks[0];
        const rockPos = nearest.position as
          | [number, number, number]
          | { x: number; y: number; z: number };

        let rockX: number, rockY: number, rockZ: number;
        if (Array.isArray(rockPos)) {
          [rockX, rockY, rockZ] = rockPos;
        } else if (rockPos && typeof rockPos === "object" && "x" in rockPos) {
          rockX = rockPos.x;
          rockY = rockPos.y;
          rockZ = rockPos.z;
        } else {
          logger.info("[MINE_ROCK] Handler: Could not get rock position");
          await callback?.({ text: "Could not locate rock.", error: true });
          return { success: false };
        }

        // Get player position to find nearest cardinal adjacent tile
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

        // Calculate cardinal adjacent positions
        const rockTileX = Math.floor(rockX);
        const rockTileZ = Math.floor(rockZ);
        const cardinalPositions = [
          { x: rockTileX, z: rockTileZ - 1, dir: "South" },
          { x: rockTileX, z: rockTileZ + 1, dir: "North" },
          { x: rockTileX - 1, z: rockTileZ, dir: "West" },
          { x: rockTileX + 1, z: rockTileZ, dir: "East" },
        ];

        // Find the cardinal position nearest to player
        let nearestCardinal = cardinalPositions[0];
        let minDist = Infinity;
        for (const pos of cardinalPositions) {
          const dist = Math.sqrt(
            Math.pow(px - pos.x, 2) + Math.pow(pz - pos.z, 2),
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCardinal = pos;
          }
        }

        const targetPos: [number, number, number] = [
          nearestCardinal.x + 0.5,
          rockY,
          nearestCardinal.z + 0.5,
        ];

        logger.info(
          `[MINE_ROCK] Handler: Walking to rock ${nearest.entity.name} - ` +
            `stopping at cardinal tile [${nearestCardinal.x}, ${nearestCardinal.z}] (${nearestCardinal.dir}) ` +
            `(rock at tile [${rockTileX}, ${rockTileZ}], ${nearest.distance?.toFixed(1)}m away)`,
        );

        await service.executeMove({ target: targetPos, runMode: false });
        await callback?.({
          text: `Walking to ${nearest.entity.name}...`,
          action: "MINE_ROCK",
        });
        return {
          success: true,
          text: `Walking to ${nearest.entity.name}`,
          data: { moving: true },
        };
      }

      // Find the nearest rock we can mine
      const rock = nearbyRocks[0]?.entity || approachableRocks[0]?.entity;
      if (!rock) {
        // Check if there are rocks but all too high level
        const allNearbyRocks = allRocks.filter((r) => {
          const entityPos = r.position;
          if (!entityPos) return false;
          const dist = getEntityDistance(playerPos, entityPos);
          return dist !== null && dist <= 40;
        });

        if (allNearbyRocks.length > 0) {
          const example = allNearbyRocks[0];
          const requiredLvl = getRockRequiredLevel(example);
          await callback?.({
            text: `All nearby rocks require higher Mining level (need ${requiredLvl}, have ${miningLevel}). Look for copper/tin rocks for lower levels.`,
            error: true,
          });
        } else {
          await callback?.({
            text: "No mineable rocks found nearby.",
            error: true,
          });
        }
        return { success: false };
      }

      // Check if we're on a cardinal adjacent tile
      const rockPosition = rock.position as
        | [number, number, number]
        | { x: number; y: number; z: number };

      let rockX: number, rockY: number, rockZ: number;
      if (Array.isArray(rockPosition)) {
        [rockX, rockY, rockZ] = rockPosition;
      } else if (
        rockPosition &&
        typeof rockPosition === "object" &&
        "x" in rockPosition
      ) {
        rockX = rockPosition.x;
        rockY = rockPosition.y;
        rockZ = rockPosition.z;
      } else {
        await callback?.({
          text: "Could not determine rock position.",
          error: true,
        });
        return { success: false };
      }

      // Get player tile position
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
        px = (playerPos as { x: number; z: number }).x;
        pz = (playerPos as { x: number; z: number }).z;
      }

      const rockTileX = Math.floor(rockX);
      const rockTileZ = Math.floor(rockZ);
      const playerTileX = Math.floor(px);
      const playerTileZ = Math.floor(pz);

      const isCardinalAdjacent =
        (playerTileX === rockTileX &&
          Math.abs(playerTileZ - rockTileZ) === 1) ||
        (playerTileZ === rockTileZ && Math.abs(playerTileX - rockTileX) === 1);

      logger.info(
        `[MINE_ROCK] Handler: Rock ${rock.id} (${rock.name}) ` +
          `at tile [${rockTileX}, ${rockTileZ}], player at tile [${playerTileX}, ${playerTileZ}], ` +
          `cardinalAdjacent=${isCardinalAdjacent}`,
      );

      // If not on cardinal adjacent tile, walk to one
      if (!isCardinalAdjacent) {
        const cardinalPositions = [
          { x: rockTileX, z: rockTileZ - 1, dir: "South" },
          { x: rockTileX, z: rockTileZ + 1, dir: "North" },
          { x: rockTileX - 1, z: rockTileZ, dir: "West" },
          { x: rockTileX + 1, z: rockTileZ, dir: "East" },
        ];

        let nearestCardinal = cardinalPositions[0];
        let minDist = Infinity;
        for (const pos of cardinalPositions) {
          const dist = Math.sqrt(
            Math.pow(px - pos.x, 2) + Math.pow(pz - pos.z, 2),
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCardinal = pos;
          }
        }

        const targetPos: [number, number, number] = [
          nearestCardinal.x + 0.5,
          rockY,
          nearestCardinal.z + 0.5,
        ];

        logger.info(
          `[MINE_ROCK] Handler: Not on cardinal tile, moving to [${nearestCardinal.x}, ${nearestCardinal.z}] (${nearestCardinal.dir})`,
        );

        await service.executeMove({ target: targetPos, runMode: false });
        await callback?.({
          text: `Positioning to mine ${rock.name}...`,
          action: "MINE_ROCK",
        });
        return {
          success: true,
          text: `Positioning to mine ${rock.name}`,
          data: { moving: true },
        };
      }

      const command: GatherResourceCommand = {
        resourceEntityId: rock.id,
        skill: "mining",
      };
      await service.executeGatherResource(command);

      await callback?.({ text: `Mining ${rock.name}`, action: "MINE_ROCK" });

      return { success: true, text: `Started mining ${rock.name}` };
    } catch (error) {
      logger.error(
        `[MINE_ROCK] Handler error: ${error instanceof Error ? error.message : error}`,
      );
      await callback?.({
        text: `Failed to mine: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Mine that copper rock" } },
      {
        name: "agent",
        content: { text: "Mining Copper Rock", action: "MINE_ROCK" },
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

    if (
      !service.isConnected() ||
      !playerEntity ||
      playerEntity.alive === false ||
      playerEntity.inCombat
    )
      return false;

    const items = playerEntity.items ?? [];
    if (!hasFishingTool(items)) {
      logger.info(
        `[CATCH_FISH] Validate: no fishing tool found in ${items.length} items`,
      );
      return false;
    }

    const matchingSpotIds = getMatchingFishingSpotIds(items);
    const fishingLevel = playerEntity.skills?.fishing?.level ?? 1;
    const playerPos = playerEntity.position;
    const spots = entities.filter(isFishingSpot);

    // Log tool-to-spot matching for diagnostics
    const toolNames = items
      .map((i) => getInventoryItemName(i))
      .filter((n) => n.length > 0);
    logger.info(
      `[CATCH_FISH] Validate: tools=[${toolNames.join(", ")}] matchingSpotIds=[${matchingSpotIds.join(", ")}] nearbySpots=${spots.length}`,
    );

    const approachableSpots = spots.filter((spot) => {
      if (spot.depleted) return false;
      const requiredLevel = spot.requiredLevel ?? 1;
      if (requiredLevel > fishingLevel) return false;
      // Only consider spots that match an available fishing tool
      const spotResId = (spot.resourceId || "").toLowerCase();
      if (
        matchingSpotIds.length > 0 &&
        spotResId &&
        !matchingSpotIds.includes(spotResId)
      )
        return false;
      const dist = getEntityDistance(playerPos, spot.position);
      return dist !== null && dist <= 40;
    });

    if (approachableSpots.length === 0 && spots.length > 0) {
      // Log why spots were rejected
      for (const spot of spots) {
        const spotResId = (spot.resourceId || "").toLowerCase();
        const dist = getEntityDistance(playerPos, spot.position);
        logger.info(
          `[CATCH_FISH] Rejected spot: name=${spot.name} resourceId=${spotResId} depleted=${spot.depleted} dist=${dist?.toFixed(1) ?? "?"} reqLvl=${spot.requiredLevel ?? 1}/${fishingLevel} toolMatch=${matchingSpotIds.includes(spotResId)}`,
        );
      }
    }

    return approachableSpots.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: HandlerOptionsParam,
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
      const player = service.getPlayerEntity();
      const playerPos = player?.position;
      const fishingLevel = player?.skills?.fishing?.level ?? 1;
      const matchingSpotIds = getMatchingFishingSpotIds(player?.items ?? []);

      // Find fishing spots that match the agent's tool and sort by distance
      const rawSpots = entities.filter(isFishingSpot);
      const allSpots = rawSpots.filter((spot) => {
        if (spot.depleted) return false;
        const requiredLevel = spot.requiredLevel ?? 1;
        if (requiredLevel > fishingLevel) return false;
        // Only go to spots that match a tool we have
        const spotResId = (spot.resourceId || "").toLowerCase();
        if (
          matchingSpotIds.length > 0 &&
          spotResId &&
          !matchingSpotIds.includes(spotResId)
        )
          return false;
        return true;
      });

      if (allSpots.length === 0 && rawSpots.length > 0) {
        logger.info(
          `[CATCH_FISH] Handler: ${rawSpots.length} fishing spots found but none match tools. ` +
            `matchingSpotIds=[${matchingSpotIds.join(",")}] spotResourceIds=[${rawSpots.map((s) => s.resourceId || "?").join(",")}]`,
        );
      }

      const spotsWithDistance = allSpots
        .map((e) => {
          const dist = getEntityDistance(playerPos, e.position);
          return { entity: e, distance: dist, position: e.position };
        })
        .filter((t) => t.distance !== null)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

      const nearbySpots = spotsWithDistance.filter(
        (t) => t.distance !== null && t.distance <= MAX_GATHER_DISTANCE,
      );
      const approachableSpots = spotsWithDistance.filter(
        (t) => t.distance !== null && t.distance <= 40,
      );

      if (nearbySpots.length === 0 && approachableSpots.length > 0) {
        const nearest = approachableSpots[0];
        const spotPos = nearest.position as
          | [number, number, number]
          | { x: number; y?: number; z: number };

        let spotX: number, spotY: number, spotZ: number;
        if (Array.isArray(spotPos)) {
          [spotX, spotY, spotZ] = spotPos;
        } else {
          spotX = spotPos.x;
          spotY = spotPos.y ?? 0;
          spotZ = spotPos.z;
        }

        let px = 0,
          pz = 0;
        if (Array.isArray(playerPos)) {
          px = playerPos[0];
          pz = playerPos[2];
        } else if (playerPos && typeof playerPos === "object") {
          const pos = playerPos as { x?: number; z?: number };
          px = pos.x ?? 0;
          pz = pos.z ?? 0;
        }

        const spotTileX = Math.floor(spotX);
        const spotTileZ = Math.floor(spotZ);
        const cardinalPositions = [
          { x: spotTileX, z: spotTileZ - 1, dir: "South" },
          { x: spotTileX, z: spotTileZ + 1, dir: "North" },
          { x: spotTileX - 1, z: spotTileZ, dir: "West" },
          { x: spotTileX + 1, z: spotTileZ, dir: "East" },
        ];

        let nearestCardinal = cardinalPositions[0];
        let minDist = Infinity;
        for (const pos of cardinalPositions) {
          const dist = Math.sqrt(
            Math.pow(px - pos.x, 2) + Math.pow(pz - pos.z, 2),
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCardinal = pos;
          }
        }

        const targetPos: [number, number, number] = [
          nearestCardinal.x + 0.5,
          spotY,
          nearestCardinal.z + 0.5,
        ];

        logger.info(
          `[CATCH_FISH] Walking to fishing spot ${nearest.entity.name} - ` +
            `stopping at cardinal tile [${nearestCardinal.x}, ${nearestCardinal.z}] (${nearestCardinal.dir})`,
        );

        await service.executeMove({ target: targetPos, runMode: false });
        await callback?.({
          text: `Walking to ${nearest.entity.name}...`,
          action: "CATCH_FISH",
        });
        return {
          success: true,
          text: `Walking to ${nearest.entity.name}`,
          data: { moving: true },
        };
      }

      const spot = nearbySpots[0]?.entity;
      if (!spot) {
        await callback?.({
          text: "No fishing spot found nearby.",
          error: true,
        });
        return { success: false };
      }

      const spotPos = spot.position as
        | [number, number, number]
        | { x: number; y?: number; z: number };

      let spotX = 0,
        spotZ = 0;
      if (Array.isArray(spotPos)) {
        spotX = spotPos[0];
        spotZ = spotPos[2];
      } else {
        spotX = spotPos.x;
        spotZ = spotPos.z;
      }

      let px = 0,
        pz = 0;
      if (Array.isArray(playerPos)) {
        px = playerPos[0];
        pz = playerPos[2];
      } else if (playerPos && typeof playerPos === "object") {
        const pos = playerPos as { x?: number; z?: number };
        px = pos.x ?? 0;
        pz = pos.z ?? 0;
      }

      const spotTileX = Math.floor(spotX);
      const spotTileZ = Math.floor(spotZ);
      const playerTileX = Math.floor(px);
      const playerTileZ = Math.floor(pz);

      const isCardinalAdjacent =
        (playerTileX === spotTileX &&
          Math.abs(playerTileZ - spotTileZ) === 1) ||
        (playerTileZ === spotTileZ && Math.abs(playerTileX - spotTileX) === 1);

      if (!isCardinalAdjacent) {
        const cardinalPositions = [
          { x: spotTileX, z: spotTileZ - 1, dir: "South" },
          { x: spotTileX, z: spotTileZ + 1, dir: "North" },
          { x: spotTileX - 1, z: spotTileZ, dir: "West" },
          { x: spotTileX + 1, z: spotTileZ, dir: "East" },
        ];

        let nearestCardinal = cardinalPositions[0];
        let minDist = Infinity;
        for (const pos of cardinalPositions) {
          const dist = Math.sqrt(
            Math.pow(px - pos.x, 2) + Math.pow(pz - pos.z, 2),
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCardinal = pos;
          }
        }

        const targetPos: [number, number, number] = [
          nearestCardinal.x + 0.5,
          Array.isArray(spotPos) ? spotPos[1] : (spotPos.y ?? 0),
          nearestCardinal.z + 0.5,
        ];

        await service.executeMove({ target: targetPos, runMode: false });
        await callback?.({
          text: `Positioning to fish at ${spot.name}...`,
          action: "CATCH_FISH",
        });
        return {
          success: true,
          text: `Positioning to fish at ${spot.name}`,
          data: { moving: true },
        };
      }

      const command: GatherResourceCommand = {
        resourceEntityId: spot.id,
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

    if (!service.isConnected() || !playerEntity) return false;

    if (playerEntity.alive === false || playerEntity.inCombat) return false;

    // Use centralized item detection utility
    const hasTinderbox = detectHasTinderbox(playerEntity);
    const hasLogs = detectHasLogs(playerEntity);

    return hasTinderbox && hasLogs;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: HandlerOptionsParam,
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

    if (!service.isConnected() || !playerEntity) return false;

    if (playerEntity.alive === false || playerEntity.inCombat) return false;

    const inventoryItems = Array.isArray(playerEntity.items)
      ? playerEntity.items
      : [];
    const hasRawFood = inventoryItems.some((i) =>
      i.name?.toLowerCase().includes("raw"),
    );

    return hasRawFood;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: HandlerOptionsParam,
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
          i.name?.toLowerCase().includes("raw") &&
          i.name?.toLowerCase().includes(content.toLowerCase()),
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
