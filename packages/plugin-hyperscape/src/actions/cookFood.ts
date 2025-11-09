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
import { CookingCompleteData } from "../types/rpg-events";
import type { ActionContext } from "../types/handler-types";

// Event types for cooking
const PROCESSING_COOKING_REQUEST = "rpg:processing:cooking:request";
const COOKING_COMPLETED = "rpg:cooking:completed";

/**
 * COOK_FOOD Action
 *
 * Cooks raw food on a fire via event system
 */
export const cookFoodAction: Action = {
  name: "COOK_FOOD",
  similes: ["COOK", "COOK_FISH", "COOK_SHRIMPS"],
  description: "Cook raw food on a fire to make it edible",

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

    // Check if player has raw food in inventory
    const player = world?.entities?.player;
    const playerData = player?.data as
      | {
          inventory?: { items?: Array<{ itemId: string }> };
        }
      | undefined;

    const inventory = playerData?.inventory?.items || [];
    const hasRawFood = inventory.some((item) => item.itemId?.includes("raw_"));

    if (!hasRawFood) {
      return false;
    }

    // Check for nearby fires
    const entities = world?.entities?.items;
    const playerPos = player?.position;

    if (!entities || !playerPos) {
      return false;
    }

    let hasNearbyFire = false;
    for (const [_id, entity] of entities.entries()) {
      const entityType = entity?.type as string;
      const entityName = entity?.name || "";

      if (
        entityType?.includes("fire") ||
        entityName.toLowerCase().includes("fire")
      ) {
        const entityPos = entity?.position;
        if (entityPos) {
          const dx = entityPos.x - playerPos.x;
          const dz = entityPos.z - playerPos.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance <= 15) {
            hasNearbyFire = true;
            break;
          }
        }
      }
    }

    // Only show action if player has raw food AND is near a fire
    return hasNearbyFire;
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
        "[COOK_FOOD] Hyperscape service, world, or player not available",
      );
      if (callback) {
        await callback({
          text: "Error: Cannot cook. Hyperscape connection unavailable.",
          actions: ["COOK_FOOD"],
          source: "hyperscape",
        });
      }
      return {
        text: "Error: Cannot cook. Hyperscape connection unavailable.",
        success: false,
        values: { success: false, error: "service_unavailable" },
        data: { action: "COOK_FOOD" },
      };
    }

    try {
      logger.info("[COOK_FOOD] Starting cooking via event system");

      // Check if we have a fire ID from previous LIGHT_FIRE action
      const context = _options?.context as ActionContext | undefined;
      const fireId = context?.getPreviousResult?.("LIGHT_FIRE")?.values?.fireId;

      if (!fireId) {
        logger.warn(
          "[COOK_FOOD] No active fire found from previous LIGHT_FIRE action",
        );
        await callback?.({
          text: "I need to light a fire first before I can cook.",
          actions: ["COOK_FOOD"],
          source: "hyperscape",
        });
        return {
          text: "I need to light a fire first before I can cook.",
          success: false,
          values: { success: false, error: "no_fire" },
          data: { action: "COOK_FOOD" },
        };
      }

      // Check if we have fish from previous CATCH_FISH action
      const fishResult = context?.getPreviousResult?.("CATCH_FISH");
      let itemToCook = "raw_shrimps"; // Default

      if (fishResult?.success && fishResult.values?.itemsReceived) {
        const fishItems = fishResult.values.itemsReceived as Array<{
          itemName: string;
          itemId?: string;
        }>;
        const rawFish = fishItems.find((item) =>
          item.itemName?.toLowerCase().includes("raw"),
        );
        if (rawFish) {
          itemToCook =
            rawFish.itemId ||
            rawFish.itemName?.toLowerCase().replace(/\s+/g, "_") ||
            "raw_shrimps";
          logger.info(
            `[COOK_FOOD] Using ${itemToCook} from previous CATCH_FISH action`,
          );
        }
      }

      await callback?.({
        text: "Cooking on the fire...",
        actions: ["COOK_FOOD"],
        source: "hyperscape",
      });

      // Emit cooking request and wait for completion
      const cookingResult = await new Promise<
        CookingCompleteData | { success: boolean; error: string }
      >((resolve) => {
        const completionHandler = (data: CookingCompleteData) => {
          if (data.playerId === player.id) {
            clearTimeout(timeout);
            world.off(COOKING_COMPLETED, completionHandler);

            logger.info(
              `[COOK_FOOD] Received cooking completion for player ${data.playerId}`,
            );
            resolve(data);
          }
        };

        const timeout = setTimeout(() => {
          world.off(COOKING_COMPLETED, completionHandler);
          logger.error("[COOK_FOOD] Cooking timeout");
          resolve({ success: false, error: "Cooking timeout" });
        }, 15000);

        world.on(COOKING_COMPLETED, completionHandler);

        // Emit cooking request
        world.emit(PROCESSING_COOKING_REQUEST, {
          playerId: player.id,
          itemId: itemToCook,
          fireEntityId: fireId,
        });

        logger.info(
          `[COOK_FOOD] Emitted PROCESSING_COOKING_REQUEST for fire ${fireId} with item ${itemToCook}`,
        );
      });

      if ("error" in cookingResult) {
        logger.error(`[COOK_FOOD] Cooking failed: ${cookingResult.error}`);
        await callback?.({
          text: `Failed to cook: ${cookingResult.error}`,
          actions: ["COOK_FOOD"],
          source: "hyperscape",
        });
        return {
          text: `Failed to cook: ${cookingResult.error}`,
          success: false,
          values: { success: false, error: cookingResult.error },
          data: { action: "COOK_FOOD" },
        };
      }

      const outcome = cookingResult.burnt
        ? "Oops, I burned it!"
        : "Perfectly cooked!";
      const levelUpMsg = cookingResult.levelUp
        ? ` 🎉 Level up! Now level ${cookingResult.newLevel} cooking!`
        : "";

      logger.info(`[COOK_FOOD] ${outcome} XP: ${cookingResult.xpGained}`);
      await callback?.({
        text: `${outcome} +${cookingResult.xpGained} XP${levelUpMsg}`,
        actions: ["COOK_FOOD"],
        source: "hyperscape",
      });

      return {
        text: `${outcome} +${cookingResult.xpGained} XP${levelUpMsg}`,
        success: true,
        values: {
          success: true,
          burnt: cookingResult.burnt,
          xpGained: cookingResult.xpGained,
          levelUp: cookingResult.levelUp,
        },
        data: { action: "COOK_FOOD", ...cookingResult },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        "[COOK_FOOD] Error:",
        error instanceof Error ? error.message : String(error),
      );

      await callback?.({
        text: `Cooking error: ${errorMsg}`,
        actions: ["COOK_FOOD"],
        source: "hyperscape",
      });

      return {
        text: `Cooking error: ${errorMsg}`,
        success: false,
        values: { success: false, error: "execution_failed", detail: errorMsg },
        data: { action: "COOK_FOOD" },
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Cook the fish" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User wants me to cook the raw fish",
          text: "Cooking on the fire...",
          actions: ["COOK_FOOD"],
          source: "hyperscape",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Cook the shrimp" },
      },
      {
        name: "{{agent}}",
        content: {
          thought: "User wants me to cook the raw shrimp on the fire",
          text: "Cooking shrimp on the fire...",
          actions: ["COOK_FOOD"],
          source: "hyperscape",
        },
      },
    ],
  ] as ActionExample[][],
};
