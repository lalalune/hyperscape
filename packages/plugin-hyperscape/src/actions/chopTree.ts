import {
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type HandlerOptions,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";
import { HyperscapeService } from "../service";
import type { ResourceSystem, ResourceItem } from "../types/resource-types";

const RESOURCE_GATHERING_COMPLETED = "rpg:resource:gathering:completed";
const INVENTORY_UPDATED = "rpg:inventory:updated";
const SKILLS_XP_GAINED = "rpg:skills:xp_gained";
const SKILLS_LEVEL_UP = "rpg:skills:level_up";

/**
 * CHOP_TREE Action
 *
 * Finds nearby trees and chops them using WebSocket packets
 *
 * Flow:
 * 1. Get player position and nearby trees
 * 2. Find available tree
 * 3. Send 'gatherResource' packet via WebSocket
 * 4. Wait for 'gatheringComplete' response
 * 5. Report results via callback
 */
export const chopTreeAction: Action = {
  name: "CHOP_TREE",
  similes: ["WOODCUT", "CHOP_WOOD", "CUT_TREE", "GATHER_LOGS"],
  description:
    "Find and chop down nearby trees to gather logs and gain woodcutting XP",

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
  ): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    const world = service?.getWorld();

    // Basic connection check
    if (!service || !service.isConnected() || !world?.network) {
      return false;
    }

    // Check for nearby trees
    const resourceSystem = world?.getSystem?.("resource") as
      | ResourceSystem
      | undefined;
    const allResources = resourceSystem?.getAllResources?.() || [];
    const player = world?.entities?.player;
    const playerPos = player?.position;

    if (!playerPos || !allResources) {
      return false;
    }

    const nearbyTrees = allResources.filter(
      (resource: {
        type?: string;
        position?: { x: number; y: number; z: number };
        level?: number;
      }) => {
        if (!resource.type?.startsWith("tree_")) return false;
        if (!resource.position) return false;

        const dx = resource.position.x - playerPos.x;
        const dz = resource.position.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance <= 15;
      },
    );

    // Only show action if there are trees nearby
    return nearbyTrees.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    __options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[],
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    const world = service?.getWorld();
    const player = world?.entities?.player;

    if (!service || !world || !world.network || !player) {
      logger.error(
        "[CHOP_TREE] Hyperscape service, world, or network not available",
      );
      if (callback) {
        await callback({
          text: "Error: Cannot chop tree. Hyperscape connection unavailable.",
          actions: ["CHOP_TREE"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: Cannot chop tree. Hyperscape connection unavailable.",
        success: false,
        values: { success: false, error: "service_unavailable" },
        data: { action: "CHOP_TREE" },
      };
    }

    // Check if player has an axe/hatchet in inventory
    const playerData = player.data as {
      inventory?: { items?: Array<{ itemId: string; itemName?: string }> };
      skills?: Record<string, { level: number; xp: number }>;
    };
    const inventoryItems = playerData?.inventory?.items || [];
    const hasAxe = inventoryItems.some(
      (item: { itemId: string; itemName?: string }) =>
        item.itemId?.toLowerCase().includes("hatchet") ||
        item.itemId?.toLowerCase().includes("axe") ||
        item.itemName?.toLowerCase().includes("hatchet") ||
        item.itemName?.toLowerCase().includes("axe"),
    );

    if (!hasAxe) {
      logger.warn(
        "[CHOP_TREE] Player does not have an axe/hatchet in inventory",
      );
      if (callback) {
        await callback({
          text: "Error: You need an axe or hatchet to chop trees.",
          actions: ["CHOP_TREE"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: You need an axe or hatchet to chop trees.",
        success: false,
        values: {
          success: false,
          error: "missing_tool",
          requiredTool: "axe/hatchet",
        },
        data: { action: "CHOP_TREE" },
      };
    }

    // Check woodcutting skill level
    const playerSkills = playerData?.skills || {};
    const woodcuttingLevel = playerSkills.woodcutting?.level ?? 1;

    logger.info(`[CHOP_TREE] Player woodcutting level: ${woodcuttingLevel}`);

    try {
      logger.info("[CHOP_TREE] Starting woodcutting via WebSocket");

      await callback?.({
        text: "Looking for nearby trees... 🌲",
        actions: ["CHOP_TREE"],
        source: "hyperscape",
      });

      // Find nearby tree resources using ResourceSystem
      const resourceSystem = world.getSystem?.("resource") as
        | {
            getResourcesByType?: (type: string) => Array<{
              id: string;
              type: string;
              position: { x: number; y: number; z: number };
              isAvailable: boolean;
              levelRequired?: number;
              skillRequired: string;
            }>;
          }
        | undefined;

      if (!resourceSystem?.getResourcesByType) {
        throw new Error("Resource system not available");
      }

      // Get all trees and filter by distance manually
      const allTrees = resourceSystem.getResourcesByType("tree_normal");

      const trees = allTrees
        .filter((tree) => {
          const dx = tree.position.x - player.position.x;
          const dz = tree.position.z - player.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          return distance <= 200; // 200 unit radius
        })
        .sort((a, b) => {
          const distA = Math.sqrt(
            Math.pow(a.position.x - player.position.x, 2) +
              Math.pow(a.position.z - player.position.z, 2),
          );
          const distB = Math.sqrt(
            Math.pow(b.position.x - player.position.x, 2) +
              Math.pow(b.position.z - player.position.z, 2),
          );
          return distA - distB;
        });

      if (trees.length === 0) {
        logger.warn("[CHOP_TREE] No trees found nearby");
        await callback?.({
          text: "I don't see any trees nearby.",
          actions: ["CHOP_TREE"],
          source: "hyperscape",
        });

        return {
          text: "I don't see any trees nearby.",
          success: false,
          values: { success: false, error: "no_trees_found" },
          data: { action: "CHOP_TREE" },
        };
      }

      // Find closest available tree that meets level requirements
      const suitableTree = trees.find((tree) => {
        if (!tree.isAvailable) return false;

        // Check if player meets level requirement
        if (tree.levelRequired && woodcuttingLevel < tree.levelRequired) {
          logger.info(
            `[CHOP_TREE] Tree ${tree.id} requires level ${tree.levelRequired}, player has ${woodcuttingLevel}`,
          );
          return false;
        }

        return true;
      });

      if (!suitableTree) {
        // Check if all trees are depleted or if player doesn't meet requirements
        const availableButTooHighLevel = trees.find(
          (tree) =>
            tree.isAvailable &&
            tree.levelRequired &&
            woodcuttingLevel < tree.levelRequired,
        );

        if (availableButTooHighLevel) {
          logger.warn(
            `[CHOP_TREE] Found trees but player level ${woodcuttingLevel} is too low (requires ${availableButTooHighLevel.levelRequired})`,
          );
          await callback?.({
            text: `Found trees but you need level ${availableButTooHighLevel.levelRequired} woodcutting. You have level ${woodcuttingLevel}.`,
            actions: ["CHOP_TREE"],
            source: "hyperscape",
          });

          return {
            text: `Found trees but you need level ${availableButTooHighLevel.levelRequired} woodcutting. You have level ${woodcuttingLevel}.`,
            success: false,
            values: {
              success: false,
              error: "level_too_low",
              requiredLevel: availableButTooHighLevel.levelRequired,
              currentLevel: woodcuttingLevel,
            },
            data: { action: "CHOP_TREE" },
          };
        }

        logger.warn(`[CHOP_TREE] All ${trees.length} trees depleted`);
        await callback?.({
          text: `Found ${trees.length} tree(s) but they're all depleted.`,
          actions: ["CHOP_TREE"],
          source: "hyperscape",
        });

        return {
          text: `Found ${trees.length} tree(s) but they're all depleted.`,
          success: false,
          values: {
            success: false,
            error: "all_trees_depleted",
            treesFound: trees.length,
          },
          data: { action: "CHOP_TREE", treesFound: trees.length },
        };
      }

      await callback?.({
        text: `Found a tree! Chopping... 🪓`,
        actions: ["CHOP_TREE"],
        source: "hyperscape",
      });

      // Send gatherResource packet and listen for separate events
      const gatherResult = await new Promise<{
        success: boolean;
        error?: string;
        items?: Array<{ itemId: string; quantity: number; itemName?: string }>;
        xpGained?: number;
        levelUp?: boolean;
        newLevel?: number;
      }>((resolve) => {
        let gatheringSuccess = false;
        let itemsReceived: Array<{
          itemId: string;
          quantity: number;
          itemName?: string;
        }> = [];
        let totalXp = 0;
        let didLevelUp = false;
        let levelAfter: number | undefined;

        // Listen for gathering completion
        const completionHandler = (data: {
          playerId: string;
          resourceId: string;
          successful: boolean;
        }) => {
          const completionData = data;
          if (completionData.playerId === player.id) {
            logger.info(
              `[CHOP_TREE] Gathering ${completionData.successful ? "succeeded" : "failed"}`,
            );
            gatheringSuccess = completionData.successful;

            // If failed, resolve immediately
            if (!completionData.successful) {
              cleanup();
              resolve({ success: false, error: "Gathering failed" });
            }
            // If successful, wait a bit for inventory/XP events
          }
        };

        // Listen for inventory updates
        const inventoryHandler = (data: {
          playerId: string;
          items: Array<{ slot: number; itemId?: string; quantity: number }>;
        }) => {
          const inventoryData = data;
          if (inventoryData.playerId === player.id && gatheringSuccess) {
            logger.info(
              `[CHOP_TREE] Inventory updated with ${inventoryData.items.length} item stacks`,
            );
            // Extract new logs from inventory (simple heuristic: items with 'log' in name)
            for (const item of inventoryData.items) {
              if (item.itemId?.toLowerCase().includes("log")) {
                itemsReceived.push({
                  itemId: item.itemId,
                  quantity: item.quantity,
                  itemName: item.itemId,
                });
              }
            }
          }
        };

        // Listen for XP gains
        const xpHandler = (data: {
          playerId: string;
          skill: string;
          amount: number;
        }) => {
          const xpData = data;
          if (
            xpData.playerId === player.id &&
            xpData.skill === "woodcutting" &&
            gatheringSuccess
          ) {
            logger.info(`[CHOP_TREE] Gained ${xpData.amount} woodcutting XP`);
            totalXp += xpData.amount;
          }
        };

        // Listen for level ups
        const levelUpHandler = (data: {
          playerId: string;
          skill: string;
          newLevel: number;
        }) => {
          const levelUpData = data;
          if (
            levelUpData.playerId === player.id &&
            levelUpData.skill === "woodcutting" &&
            gatheringSuccess
          ) {
            logger.info(
              `[CHOP_TREE] Leveled up to ${levelUpData.newLevel} woodcutting!`,
            );
            didLevelUp = true;
            levelAfter = levelUpData.newLevel;
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          world.off(RESOURCE_GATHERING_COMPLETED, completionHandler);
          world.off(INVENTORY_UPDATED, inventoryHandler);
          world.off(SKILLS_XP_GAINED, xpHandler);
          world.off(SKILLS_LEVEL_UP, levelUpHandler);
        };

        // Timeout after 15 seconds - resolve with whatever we collected
        const timeout = setTimeout(() => {
          cleanup();
          if (gatheringSuccess) {
            logger.info(`[CHOP_TREE] Timeout - resolving with collected data`);
            resolve({
              success: true,
              items: itemsReceived,
              xpGained: totalXp,
              levelUp: didLevelUp,
              newLevel: levelAfter,
            });
          } else {
            logger.error("[CHOP_TREE] Gathering timeout");
            resolve({ success: false, error: "Gathering timeout" });
          }
        }, 15000);

        // Register all event listeners
        world.on(RESOURCE_GATHERING_COMPLETED, completionHandler);
        world.on(INVENTORY_UPDATED, inventoryHandler);
        world.on(SKILLS_XP_GAINED, xpHandler);
        world.on(SKILLS_LEVEL_UP, levelUpHandler);

        // Also resolve after a short delay when gathering succeeds (don't wait full timeout)
        const checkCompletion = setInterval(() => {
          if (gatheringSuccess && (itemsReceived.length > 0 || totalXp > 0)) {
            cleanup();
            clearInterval(checkCompletion);
            logger.info(
              `[CHOP_TREE] Gathering complete with items/XP received`,
            );
            resolve({
              success: true,
              items: itemsReceived,
              xpGained: totalXp,
              levelUp: didLevelUp,
              newLevel: levelAfter,
            });
          }
        }, 500);

        // Send gather packet via WebSocket
        world.network.send("gatherResource", {
          resourceId: suitableTree.id,
          playerPosition: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
          },
        });

        logger.info(
          `[CHOP_TREE] Sent gatherResource packet for tree ${suitableTree.id}`,
        );
      });

      if (!gatherResult.success || gatherResult.error) {
        logger.error(`[CHOP_TREE] Gathering failed: ${gatherResult.error}`);
        await callback?.({
          text: `Failed to chop tree: ${gatherResult.error || "Unknown error"}`,
          actions: ["CHOP_TREE"],
          source: "hyperscape",
        });
        return {
          text: `Failed to chop tree: ${gatherResult.error || "Unknown error"}`,
          success: false,
          values: { success: false, error: gatherResult.error },
          data: { action: "CHOP_TREE" },
        };
      }

      // Report success
      const items = gatherResult.items || [];
      const xpGained = gatherResult.xpGained || 0;
      const logsReceived = items.find((item) =>
        item.itemId?.toLowerCase().includes("log"),
      );
      const levelUpMsg = gatherResult.levelUp
        ? ` 🎉 Level up! Now level ${gatherResult.newLevel} woodcutting!`
        : "";

      const itemsText = logsReceived
        ? `${logsReceived.quantity}x ${logsReceived.itemName || "logs"}`
        : `${items.length} items`;

      logger.info(
        `[CHOP_TREE] Successfully chopped tree. XP: ${xpGained}, Items: ${items.length}`,
      );
      await callback?.({
        text: `Chopped tree! Received ${itemsText}. +${xpGained} XP${levelUpMsg}`,
        actions: ["CHOP_TREE"],
        source: "hyperscape",
      });

      return {
        text: `Chopped tree! Received ${itemsText}. +${xpGained} XP${levelUpMsg}`,
        success: true,
        values: {
          success: true,
          xpGained,
          levelUp: gatherResult.levelUp || false,
          newLevel: gatherResult.newLevel,
          itemsReceived: items,
        },
        data: { action: "CHOP_TREE", items, xpGained },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        "[CHOP_TREE] Error:",
        error instanceof Error ? error.message : String(error),
      );

      await callback?.({
        text: `Woodcutting error: ${errorMsg}`,
        actions: ["CHOP_TREE"],
        source: "hyperscape",
      });

      return {
        text: `Woodcutting error: ${errorMsg}`,
        success: false,
        values: { success: false, error: "execution_failed", detail: errorMsg },
        data: { action: "CHOP_TREE" },
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Chop down a tree" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User wants me to chop a tree for wood",
          text: "Looking for nearby trees... 🌲",
          actions: ["CHOP_TREE"],
          source: "hyperscape",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Get some wood" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User needs wood - I should find and chop a tree",
          text: "Looking for nearby trees... 🌲",
          actions: ["CHOP_TREE"],
          source: "hyperscape",
        },
      },
    ],
  ] as ActionExample[][],
};
