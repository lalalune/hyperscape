/**
 * Goal-related actions for ElizaOS
 *
 * SET_GOAL - Choose a new objective to work towards
 * NAVIGATE_TO - Travel to a known location
 *
 * Goals are stored directly in the AutonomousBehaviorManager for reliability.
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
import { KNOWN_LOCATIONS } from "../providers/goalProvider.js";

/**
 * SET_GOAL - Choose a new objective
 *
 * The agent should set a goal when it has none, giving it purpose.
 * Goals are stored in the behavior manager and persist between ticks.
 */
export const setGoalAction: Action = {
  name: "SET_GOAL",
  similes: ["CHOOSE_GOAL", "NEW_GOAL", "START_TASK"],
  description:
    "Set a new goal to work towards. Use when you have no current objective. Goals give you purpose and direction.",

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      logger.debug("[SET_GOAL] Validation failed: not connected");
      return false;
    }

    // Check behavior manager directly for existing goal
    const behaviorManager = service.getBehaviorManager();
    if (behaviorManager?.hasGoal()) {
      logger.debug("[SET_GOAL] Validation failed: already has a goal");
      return false;
    }

    logger.info("[SET_GOAL] Validation passed - agent needs a goal");
    return true;
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
        return { success: false, error: "Service not available" };
      }

      const behaviorManager = service.getBehaviorManager();
      if (!behaviorManager) {
        return { success: false, error: "Behavior manager not available" };
      }

      const player = service.getPlayerEntity();

      // Choose goal based on health
      const healthPercent = player?.health
        ? (player.health.current / player.health.max) * 100
        : 100;

      // Default: combat training at spawn (where goblins are)
      let goalType: "combat_training" | "woodcutting" | "exploration" | "idle" =
        "combat_training";
      let description = "Train combat by killing goblins at spawn";
      let target = 5; // Kill 5 goblins
      let location = "spawn";
      let targetEntity = "goblin";

      // If health is low, explore instead
      if (healthPercent < 50) {
        goalType = "exploration";
        description = "Explore the world while recovering health";
        target = 3;
        location = "spawn";
        targetEntity = "";
      }

      // Set the goal in the behavior manager
      behaviorManager.setGoal({
        type: goalType,
        description,
        target,
        progress: 0,
        location,
        targetEntity,
        startedAt: Date.now(),
      });

      const responseText = `Goal set: ${description} (target: ${target})`;
      await callback?.({ text: responseText, action: "SET_GOAL" });

      logger.info(`[SET_GOAL] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: { action: "SET_GOAL", goalType, target },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[SET_GOAL] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to set goal: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "system", content: { text: "Agent has no current goal" } },
      {
        name: "agent",
        content: {
          text: "Goal set: Train combat by killing goblins at spawn",
          action: "SET_GOAL",
        },
      },
    ],
  ],
};

/**
 * NAVIGATE_TO - Travel to a known location
 *
 * Used when the agent needs to go somewhere to accomplish their goal.
 */
export const navigateToAction: Action = {
  name: "NAVIGATE_TO",
  similes: ["GO_TO", "TRAVEL_TO", "WALK_TO"],
  description:
    "Navigate to a known location. Use when you need to travel somewhere for your goal.",

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      return false;
    }

    const player = service.getPlayerEntity();
    if (!player?.position || player.position.length < 3) {
      return false;
    }

    // Check if we need to navigate (not at goal location)
    const behaviorManager = service.getBehaviorManager();
    const goal = behaviorManager?.getGoal();

    if (!goal?.location) {
      logger.debug("[NAVIGATE_TO] Validation failed: no goal location");
      return false;
    }

    const targetLoc = KNOWN_LOCATIONS[goal.location];
    if (!targetLoc) {
      logger.debug("[NAVIGATE_TO] Validation failed: unknown location");
      return false;
    }

    // Check distance
    const dx = player.position[0] - targetLoc.position[0];
    const dz = player.position[2] - targetLoc.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 30) {
      logger.debug("[NAVIGATE_TO] Validation failed: already at location");
      return false;
    }

    logger.info(
      `[NAVIGATE_TO] Validation passed - need to travel ${distance.toFixed(0)} units`,
    );
    return true;
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
        return { success: false, error: "Service not available" };
      }

      const behaviorManager = service.getBehaviorManager();
      const goal = behaviorManager?.getGoal();
      const destinationKey = goal?.location || "spawn";
      const destination = KNOWN_LOCATIONS[destinationKey];

      if (!destination) {
        return { success: false, error: `Unknown location: ${destinationKey}` };
      }

      // Move towards destination
      await service.executeMove({
        target: destination.position,
        runMode: false,
      });

      const responseText = `Navigating to ${destinationKey}`;
      await callback?.({ text: responseText, action: "NAVIGATE_TO" });

      logger.info(`[NAVIGATE_TO] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: { action: "NAVIGATE_TO", destination: destinationKey },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[NAVIGATE_TO] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      {
        name: "system",
        content: { text: "Goal requires traveling to spawn" },
      },
      {
        name: "agent",
        content: { text: "Navigating to spawn", action: "NAVIGATE_TO" },
      },
    ],
  ],
};

// Export all goal actions
export const goalActions = [setGoalAction, navigateToAction];
