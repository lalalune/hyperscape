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
import type { ActionContext } from "../types/handler-types";

// Event types for firemaking
const PROCESSING_FIREMAKING_REQUEST = "rpg:processing:firemaking:request";
const FIREMAKING_COMPLETED = "rpg:firemaking:completed";
const INVENTORY_UPDATED = "rpg:inventory:updated";
const SKILLS_XP_GAINED = "rpg:skills:xp_gained";
const SKILLS_LEVEL_UP = "rpg:skills:level_up";

/**
 * LIGHT_FIRE Action
 *
 * Uses tinderbox and logs to light a fire via event system
 */
export const lightFireAction: Action = {
  name: "LIGHT_FIRE",
  similes: ["MAKE_FIRE", "START_FIRE", "LIGHT_LOGS"],
  description: "Use tinderbox on logs to create a fire for cooking",

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
  ): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    const world = service?.getWorld();

    // Basic connection check
    if (!service || !service.isConnected() || !world) {
      return false;
    }

    // Check if player has tinderbox and logs in inventory
    const player = world?.entities?.player;
    const playerData = player?.data as
      | {
          inventory?: { items?: Array<{ itemId: string }> };
        }
      | undefined;

    const inventory = playerData?.inventory?.items || [];
    const hasTinderbox = inventory.some((item) =>
      item.itemId?.includes("tinderbox"),
    );
    const hasLogs = inventory.some((item) => item.itemId?.includes("logs"));

    // Only show action if player has both tinderbox and logs
    return hasTinderbox && hasLogs;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[],
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    const world = service?.getWorld();
    const player = world?.entities?.player;

    if (!service || !world || !player) {
      logger.error(
        "[LIGHT_FIRE] Hyperscape service, world, or player not available",
      );
      if (callback) {
        await callback({
          text: "Error: Cannot light fire. Hyperscape connection unavailable.",
          actions: ["LIGHT_FIRE"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: Cannot light fire. Hyperscape connection unavailable.",
        success: false,
        values: { success: false, error: "service_unavailable" },
        data: { action: "LIGHT_FIRE" },
      };
    }

    // Check if player has a tinderbox in inventory
    const playerData = player.data as {
      inventory?: { items?: Array<{ itemId: string; itemName?: string }> };
      skills?: Record<string, { level: number; xp: number }>;
    };
    const inventoryItems = playerData?.inventory?.items || [];
    const hasTinderbox = inventoryItems.some(
      (item: { itemId: string; itemName?: string }) =>
        item.itemId?.toLowerCase().includes("tinderbox") ||
        item.itemName?.toLowerCase().includes("tinderbox"),
    );

    if (!hasTinderbox) {
      logger.warn("[LIGHT_FIRE] Player does not have a tinderbox in inventory");
      if (callback) {
        await callback({
          text: "Error: You need a tinderbox to light fires.",
          actions: ["LIGHT_FIRE"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: You need a tinderbox to light fires.",
        success: false,
        values: {
          success: false,
          error: "missing_tool",
          requiredTool: "tinderbox",
        },
        data: { action: "LIGHT_FIRE" },
      };
    }

    // Check if player has logs in inventory
    const hasLogs = inventoryItems.some(
      (item: { itemId: string; itemName?: string }) =>
        item.itemId?.toLowerCase().includes("log") ||
        item.itemName?.toLowerCase().includes("log"),
    );

    if (!hasLogs) {
      logger.warn("[LIGHT_FIRE] Player does not have logs in inventory");
      if (callback) {
        await callback({
          text: "Error: You need logs to light a fire.",
          actions: ["LIGHT_FIRE"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: You need logs to light a fire.",
        success: false,
        values: {
          success: false,
          error: "missing_resource",
          requiredResource: "logs",
        },
        data: { action: "LIGHT_FIRE" },
      };
    }

    // Check firemaking skill level
    const playerSkills = playerData?.skills || {};
    const firemakingLevel = playerSkills.firemaking?.level ?? 1;

    logger.info(`[LIGHT_FIRE] Player firemaking level: ${firemakingLevel}`);

    try {
      logger.info("[LIGHT_FIRE] Starting firemaking via event system");

      // Check if we have logs from previous CHOP_TREE action
      const context = _options?.context as ActionContext | undefined;
      const chopResult = context?.getPreviousResult?.("CHOP_TREE");
      const hasLogsFromChop =
        chopResult?.success &&
        chopResult.values?.itemsReceived?.some((item: { itemName: string }) =>
          item.itemName?.toLowerCase().includes("log"),
        );

      if (hasLogsFromChop) {
        logger.info("[LIGHT_FIRE] Using logs from previous CHOP_TREE action");
      }

      await callback?.({
        text: "Using tinderbox on logs... 🔥",
        actions: ["LIGHT_FIRE"],
        source: "hyperscape",
      });

      // Emit firemaking request and listen for separate events
      const firemakingResult = await new Promise<{
        success: boolean;
        error?: string;
        fireEntityId?: string;
        xpGained?: number;
        levelUp?: boolean;
        newLevel?: number;
      }>((resolve) => {
        let firemakingSuccess = false;
        let fireEntityId: string | undefined;
        let totalXp = 0;
        let didLevelUp = false;
        let levelAfter: number | undefined;

        // Listen for firemaking completion
        const completionHandler = (data: {
          playerId: string;
          fireEntityId: string;
          successful: boolean;
        }) => {
          if (data.playerId === player.id) {
            logger.info(
              `[LIGHT_FIRE] Firemaking ${data.successful ? "succeeded" : "failed"}`,
            );
            firemakingSuccess = data.successful;
            fireEntityId = data.fireEntityId;

            if (!data.successful) {
              cleanup();
              resolve({ success: false, error: "Firemaking failed" });
            }
          }
        };

        // Listen for inventory updates (logs consumed)
        const inventoryHandler = (data: {
          playerId: string;
          items: Array<{ slot: number; itemId: string; quantity: number }>;
        }) => {
          if (data.playerId === player.id && firemakingSuccess) {
            logger.info(`[LIGHT_FIRE] Inventory updated - logs consumed`);
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
            data.skill === "firemaking" &&
            firemakingSuccess
          ) {
            logger.info(`[LIGHT_FIRE] Gained ${data.amount} firemaking XP`);
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
            data.skill === "firemaking" &&
            firemakingSuccess
          ) {
            logger.info(
              `[LIGHT_FIRE] Leveled up to ${data.newLevel} firemaking!`,
            );
            didLevelUp = true;
            levelAfter = data.newLevel;
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          world.off(FIREMAKING_COMPLETED, completionHandler);
          world.off(INVENTORY_UPDATED, inventoryHandler);
          world.off(SKILLS_XP_GAINED, xpHandler);
          world.off(SKILLS_LEVEL_UP, levelUpHandler);
        };

        // Timeout after 15 seconds
        const timeout = setTimeout(() => {
          cleanup();
          if (firemakingSuccess) {
            logger.info(`[LIGHT_FIRE] Timeout - resolving with collected data`);
            resolve({
              success: true,
              fireEntityId,
              xpGained: totalXp,
              levelUp: didLevelUp,
              newLevel: levelAfter,
            });
          } else {
            logger.error("[LIGHT_FIRE] Firemaking timeout");
            resolve({ success: false, error: "Firemaking timeout" });
          }
        }, 15000);

        // Register all event listeners
        world.on(FIREMAKING_COMPLETED, completionHandler);
        world.on(INVENTORY_UPDATED, inventoryHandler);
        world.on(SKILLS_XP_GAINED, xpHandler);
        world.on(SKILLS_LEVEL_UP, levelUpHandler);

        // Also resolve after short delay when firemaking succeeds
        const checkCompletion = setInterval(() => {
          if (firemakingSuccess && totalXp > 0) {
            cleanup();
            clearInterval(checkCompletion);
            logger.info(`[LIGHT_FIRE] Firemaking complete with XP received`);
            resolve({
              success: true,
              fireEntityId,
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

        // Emit firemaking request
        world.emit(PROCESSING_FIREMAKING_REQUEST, {
          playerId: player.id,
          position: player.position,
          logType: "logs",
        });

        logger.info(`[LIGHT_FIRE] Emitted PROCESSING_FIREMAKING_REQUEST`);
      });

      if (!firemakingResult.success || firemakingResult.error) {
        logger.error(
          `[LIGHT_FIRE] Failed to light fire: ${firemakingResult.error}`,
        );
        await callback?.({
          text: `Failed to light fire: ${firemakingResult.error || "Unknown error"}`,
          actions: ["LIGHT_FIRE"],
          source: "hyperscape",
        });
        return {
          text: `Failed to light fire: ${firemakingResult.error || "Unknown error"}`,
          success: false,
          values: { success: false, error: firemakingResult.error },
          data: { action: "LIGHT_FIRE" },
        };
      }

      // Report success
      const xpGained = firemakingResult.xpGained || 0;
      const levelUpMsg = firemakingResult.levelUp
        ? ` 🎉 Level up! Now level ${firemakingResult.newLevel} firemaking!`
        : "";

      logger.info(`[LIGHT_FIRE] Fire lit successfully. XP: ${xpGained}`);
      await callback?.({
        text: `Fire lit! +${xpGained} XP${levelUpMsg}`,
        actions: ["LIGHT_FIRE"],
        source: "hyperscape",
      });

      // Return fireId in values for action chaining (COOK_FOOD can read this)
      return {
        text: `Fire lit! +${xpGained} XP${levelUpMsg}`,
        success: true,
        values: {
          success: true,
          fireId: firemakingResult.fireEntityId,
          firePosition: player.position,
          xpGained,
          levelUp: firemakingResult.levelUp || false,
          newLevel: firemakingResult.newLevel,
        },
        data: {
          action: "LIGHT_FIRE",
          fireEntityId: firemakingResult.fireEntityId,
          xpGained,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        "[LIGHT_FIRE] Error:",
        error instanceof Error ? error.message : String(error),
      );

      await callback?.({
        text: `Firemaking error: ${errorMsg}`,
        actions: ["LIGHT_FIRE"],
        source: "hyperscape",
      });

      return {
        text: `Firemaking error: ${errorMsg}`,
        success: false,
        values: { success: false, error: "execution_failed", detail: errorMsg },
        data: { action: "LIGHT_FIRE" },
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Light a fire" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User wants me to light a fire for cooking",
          text: "Using tinderbox on logs... 🔥",
          actions: ["LIGHT_FIRE"],
          source: "hyperscape",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Make a fire so we can cook" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User needs a fire for cooking - I have logs and tinderbox",
          text: "Lighting fire with tinderbox... 🔥",
          actions: ["LIGHT_FIRE"],
          source: "hyperscape",
        },
      },
    ],
  ] as ActionExample[][],
};
