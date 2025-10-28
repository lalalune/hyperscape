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

// Event types for resource gathering
const RESOURCE_GATHERING_COMPLETED = "rpg:resource:gathering:completed";
const INVENTORY_UPDATED = "rpg:inventory:updated";
const SKILLS_XP_GAINED = "rpg:skills:xp_gained";
const SKILLS_LEVEL_UP = "rpg:skills:level_up";

/**
 * CATCH_FISH Action
 *
 * Finds nearby fishing spots and catches fish using WebSocket packets
 */
export const catchFishAction: Action = {
  name: "CATCH_FISH",
  similes: ["FISH", "GO_FISHING", "CATCH_FISH_AT_SPOT"],
  description: "Find nearby fishing spots and catch fish to gain fishing XP",

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

    // Check for nearby fishing spots
    const resourceSystem = world?.getSystem?.("resource") as unknown as
      | ResourceSystem
      | undefined;
    const allResources: ResourceItem[] =
      resourceSystem?.getAllResources?.() || [];
    const player = world?.entities?.player;
    const playerPos = player?.position;

    if (!playerPos || !allResources) {
      return false;
    }

    const nearbyFishingSpots: ResourceItem[] = allResources.filter(
      (resource: ResourceItem) => {
        if (!resource.type?.startsWith("fishing_")) return false;
        if (!resource.position) return false;

        const dx = resource.position.x - playerPos.x;
        const dz = resource.position.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance <= 15;
      },
    );

    // Only show action if there are fishing spots nearby
    return nearbyFishingSpots.length > 0;
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
        "[CATCH_FISH] Hyperscape service, world, or network not available",
      );
      if (callback) {
        await callback({
          text: "Error: Cannot fish. Hyperscape connection unavailable.",
          actions: ["CATCH_FISH"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: Cannot fish. Hyperscape connection unavailable.",
        success: false,
        values: { success: false, error: "service_unavailable" },
        data: { action: "CATCH_FISH" },
      };
    }

    // Check if player has a fishing rod or net in inventory
    const playerData = player.data as {
      inventory?: { items?: Array<{ itemId: string; itemName?: string }> };
      skills?: Record<string, { level: number; xp: number }>;
    };
    const inventoryItems = playerData?.inventory?.items || [];
    const hasFishingTool = inventoryItems.some(
      (item: { itemId: string; itemName?: string }) => {
        const itemId = String(item.itemId || "").toLowerCase();
        const itemName = String(item.itemName || "").toLowerCase();
        return (
          itemId.includes("fishing_rod") ||
          itemId.includes("fishing_net") ||
          itemId.includes("net") ||
          itemName.includes("fishing rod") ||
          itemName.includes("fishing net") ||
          itemName.includes("net")
        );
      },
    );

    if (!hasFishingTool) {
      logger.warn(
        "[CATCH_FISH] Player does not have a fishing rod or net in inventory",
      );
      if (callback) {
        await callback({
          text: "Error: You need a fishing rod or net to catch fish.",
          actions: ["CATCH_FISH"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: You need a fishing rod or net to catch fish.",
        success: false,
        values: {
          success: false,
          error: "missing_tool",
          requiredTool: "fishing_rod/net",
        },
        data: { action: "CATCH_FISH" },
      };
    }

    // Check fishing skill level
    const playerSkills = playerData?.skills || {};
    const fishingLevel = playerSkills.fishing?.level ?? 1;

    logger.info(`[CATCH_FISH] Player fishing level: ${fishingLevel}`);

    try {
      logger.info("[CATCH_FISH] Starting fishing via WebSocket");

      await callback?.({
        text: "Looking for fishing spots... 🎣",
        actions: ["CATCH_FISH"],
        source: "hyperscape",
      });

      // Find nearby fishing spots using ResourceSystem
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

      // Get all fishing spots and filter by distance manually
      const allSpots =
        resourceSystem?.getResourcesByType?.("fishing_spot_normal") || [];

      const fishingSpots = allSpots
        .filter((spot) => {
          const dx = spot.position.x - player.position.x;
          const dz = spot.position.z - player.position.z;
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

      if (fishingSpots.length === 0) {
        logger.warn("[CATCH_FISH] No fishing spots found");
        await callback?.({
          text: "I don't see any fishing spots nearby.",
          actions: ["CATCH_FISH"],
          source: "hyperscape",
        });

        return {
          text: "I don't see any fishing spots nearby.",
          success: false,
          values: { success: false, error: "no_fishing_spots" },
          data: { action: "CATCH_FISH" },
        };
      }

      // Find available spot that meets level requirements
      const suitableSpot = fishingSpots.find((spot) => {
        if (!spot.isAvailable) return false;

        // Check if player meets level requirement
        if (spot.levelRequired && fishingLevel < spot.levelRequired) {
          logger.info(
            `[CATCH_FISH] Fishing spot ${spot.id} requires level ${spot.levelRequired}, player has ${fishingLevel}`,
          );
          return false;
        }

        return true;
      });

      if (!suitableSpot) {
        // Check if all spots are depleted or if player doesn't meet requirements
        const availableButTooHighLevel = fishingSpots.find(
          (spot) =>
            spot.isAvailable &&
            spot.levelRequired &&
            fishingLevel < spot.levelRequired,
        );

        if (availableButTooHighLevel) {
          logger.warn(
            `[CATCH_FISH] Found fishing spots but player level ${fishingLevel} is too low (requires ${availableButTooHighLevel.levelRequired})`,
          );
          await callback?.({
            text: `Found fishing spots but you need level ${availableButTooHighLevel.levelRequired} fishing. You have level ${fishingLevel}.`,
            actions: ["CATCH_FISH"],
            source: "hyperscape",
          });

          return {
            text: `Found fishing spots but you need level ${availableButTooHighLevel.levelRequired} fishing. You have level ${fishingLevel}.`,
            success: false,
            values: {
              success: false,
              error: "level_too_low",
              requiredLevel: availableButTooHighLevel.levelRequired,
              currentLevel: fishingLevel,
            },
            data: { action: "CATCH_FISH" },
          };
        }

        logger.warn(
          `[CATCH_FISH] All ${fishingSpots.length} fishing spots depleted`,
        );
        await callback?.({
          text: `Found ${fishingSpots.length} fishing spot(s) but they're all depleted.`,
          actions: ["CATCH_FISH"],
          source: "hyperscape",
        });

        return {
          text: `Found ${fishingSpots.length} fishing spot(s) but they're all depleted.`,
          success: false,
          values: {
            success: false,
            error: "all_spots_depleted",
            spotsFound: fishingSpots.length,
          },
          data: { action: "CATCH_FISH", spotsFound: fishingSpots.length },
        };
      }

      await callback?.({
        text: `Found fishing spot! Casting line... 🎣`,
        actions: ["CATCH_FISH"],
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
          if (data.playerId === player.id) {
            logger.info(
              `[CATCH_FISH] Gathering ${data.successful ? "succeeded" : "failed"}`,
            );
            gatheringSuccess = data.successful;

            if (!data.successful) {
              cleanup();
              resolve({ success: false, error: "Fishing failed" });
            }
          }
        };

        // Listen for inventory updates
        const inventoryHandler = (data: {
          playerId: string;
          items: Array<{ slot: number; itemId: string; quantity: number }>;
        }) => {
          if (data.playerId === player.id && gatheringSuccess) {
            logger.info(
              `[CATCH_FISH] Inventory updated with ${data.items.length} item stacks`,
            );
            // Extract new fish from inventory
            for (const item of data.items) {
              const itemId = String(item.itemId || "").toLowerCase();
              if (
                itemId.includes("fish") ||
                itemId.includes("shrimp") ||
                itemId.includes("sardine") ||
                itemId.includes("trout") ||
                itemId.includes("salmon")
              ) {
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
          if (
            data.playerId === player.id &&
            data.skill === "fishing" &&
            gatheringSuccess
          ) {
            logger.info(`[CATCH_FISH] Gained ${data.amount} fishing XP`);
            totalXp += data.amount;
          }
        };

        // Listen for level ups
        const levelUpHandler = (data: {
          playerId: string;
          skill: string;
          newLevel: number;
        }) => {
          if (
            data.playerId === player.id &&
            data.skill === "fishing" &&
            gatheringSuccess
          ) {
            logger.info(`[CATCH_FISH] Leveled up to ${data.newLevel} fishing!`);
            didLevelUp = true;
            levelAfter = data.newLevel;
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          world.off(RESOURCE_GATHERING_COMPLETED, completionHandler);
          world.off(INVENTORY_UPDATED, inventoryHandler);
          world.off(SKILLS_XP_GAINED, xpHandler);
          world.off(SKILLS_LEVEL_UP, levelUpHandler);
        };

        // Timeout after 15 seconds
        const timeout = setTimeout(() => {
          cleanup();
          if (gatheringSuccess) {
            logger.info(`[CATCH_FISH] Timeout - resolving with collected data`);
            resolve({
              success: true,
              items: itemsReceived,
              xpGained: totalXp,
              levelUp: didLevelUp,
              newLevel: levelAfter,
            });
          } else {
            logger.error("[CATCH_FISH] Fishing timeout");
            resolve({ success: false, error: "Fishing timeout" });
          }
        }, 15000);

        // Register all event listeners
        world.on(RESOURCE_GATHERING_COMPLETED, completionHandler);
        world.on(INVENTORY_UPDATED, inventoryHandler);
        world.on(SKILLS_XP_GAINED, xpHandler);
        world.on(SKILLS_LEVEL_UP, levelUpHandler);

        // Also resolve after short delay when gathering succeeds
        const checkCompletion = setInterval(() => {
          if (gatheringSuccess && (itemsReceived.length > 0 || totalXp > 0)) {
            cleanup();
            clearInterval(checkCompletion);
            logger.info(`[CATCH_FISH] Fishing complete with items/XP received`);
            resolve({
              success: true,
              items: itemsReceived,
              xpGained: totalXp,
              levelUp: didLevelUp,
              newLevel: levelAfter,
            });
          }
        }, 500);

        // Clean up interval on timeout
        setTimeout(() => {
          clearInterval(checkCompletion);
        }, 15000);

        // Send gather packet via WebSocket
        world.network.send("gatherResource", {
          resourceId: suitableSpot.id,
          playerPosition: player.position,
        });

        logger.info(
          `[CATCH_FISH] Sent gatherResource packet for fishing spot ${suitableSpot.id}`,
        );
      });

      if (!gatherResult.success || gatherResult.error) {
        logger.error(`[CATCH_FISH] Fishing failed: ${gatherResult.error}`);
        await callback?.({
          text: `Failed to catch fish: ${gatherResult.error || "Unknown error"}`,
          actions: ["CATCH_FISH"],
          source: "hyperscape",
        });
        return {
          text: `Failed to catch fish: ${gatherResult.error || "Unknown error"}`,
          success: false,
          values: { success: false, error: gatherResult.error },
          data: { action: "CATCH_FISH" },
        };
      }

      // Report success
      const items = gatherResult.items || [];
      const xpGained = gatherResult.xpGained || 0;
      const fishReceived = items[0];
      const levelUpMsg = gatherResult.levelUp
        ? ` 🎉 Level up! Now level ${gatherResult.newLevel} fishing!`
        : "";

      const itemsText = fishReceived
        ? `${fishReceived.quantity}x ${fishReceived.itemName || "fish"}`
        : `${items.length} items`;

      logger.info(
        `[CATCH_FISH] Successfully caught fish. XP: ${xpGained}, Items: ${items.length}`,
      );
      await callback?.({
        text: `Caught ${itemsText}! +${xpGained} XP${levelUpMsg}`,
        actions: ["CATCH_FISH"],
        source: "hyperscape",
      });

      return {
        text: `Caught ${itemsText}! +${xpGained} XP${levelUpMsg}`,
        success: true,
        values: {
          success: true,
          xpGained,
          levelUp: gatherResult.levelUp || false,
          newLevel: gatherResult.newLevel,
          itemsReceived: items,
        },
        data: { action: "CATCH_FISH", items, xpGained },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        "[CATCH_FISH] Error:",
        error instanceof Error ? error.message : String(error),
      );

      await callback?.({
        text: `Fishing error: ${errorMsg}`,
        actions: ["CATCH_FISH"],
        source: "hyperscape",
      });

      return {
        text: `Fishing error: ${errorMsg}`,
        success: false,
        values: { success: false, error: "execution_failed", detail: errorMsg },
        data: { action: "CATCH_FISH" },
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Go fishing" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User wants to fish - I should find a fishing spot",
          text: "Looking for fishing spots... 🎣",
          actions: ["CATCH_FISH"],
          source: "hyperscape",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Catch some fish for dinner" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User needs fish for food - let me find a good fishing spot",
          text: "Heading to the nearest fishing spot... 🎣",
          actions: ["CATCH_FISH"],
          source: "hyperscape",
        },
      },
    ],
  ] as ActionExample[][],
};
