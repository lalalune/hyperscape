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
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { GatherResourceCommand } from "../types.js";

export const chopTreeAction: Action = {
  name: "CHOP_TREE",
  similes: ["CHOP", "WOODCUT", "CUT_TREE"],
  description: "Chop down a tree to gather logs. Requires an axe.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();
    const entities = service.getNearbyEntities() || [];

    if (!service.isConnected() || !playerEntity?.alive) return false;

    const hasAxe = playerEntity.items.some((i) =>
      i.name.toLowerCase().includes("axe"),
    );
    const hasTree = entities.some(
      (e) =>
        "resourceType" in e &&
        (e as { resourceType: string }).resourceType === "tree",
    );

    return hasAxe && hasTree;
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
      const content = message.content.text || "";

      const tree = entities.find(
        (e) =>
          "resourceType" in e &&
          (e as { resourceType: string }).resourceType === "tree" &&
          (!content || e.name?.toLowerCase().includes(content.toLowerCase())),
      );

      if (!tree) {
        await callback?.({ text: "No tree found nearby.", error: true });
        return { success: false };
      }

      const command: GatherResourceCommand = {
        resourceEntityId: tree.id,
        skill: "woodcutting",
      };
      await service.executeGatherResource(command);

      await callback?.({ text: `Chopping ${tree.name}`, action: "CHOP_TREE" });

      return { success: true, text: `Started chopping ${tree.name}` };
    } catch (error) {
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
