/**
 * Goal-related actions for ElizaOS
 *
 * SET_GOAL - Choose a new objective to work towards (LLM-driven selection)
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
import { logger, ModelType } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import {
  KNOWN_LOCATIONS,
  getAvailableGoals,
} from "../providers/goalProvider.js";

/**
 * SET_GOAL - Choose a new objective using LLM
 *
 * The agent uses LLM to select from available goals based on current state.
 * Goals are stored in the behavior manager and persist between ticks.
 */
export const setGoalAction: Action = {
  name: "SET_GOAL",
  similes: ["CHOOSE_GOAL", "NEW_GOAL", "START_TASK"],
  description:
    "Set a new goal to work towards. Use when you have no current objective. The LLM will choose the best goal based on your current situation.",

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

      // Get available goals based on current state
      const availableGoals = getAvailableGoals(service);
      if (availableGoals.length === 0) {
        return { success: false, error: "No goals available" };
      }

      // Get player state for context
      const player = service.getPlayerEntity();
      const healthPercent = player?.health
        ? Math.round((player.health.current / player.health.max) * 100)
        : 100;
      const skills = player?.skills as
        | Record<string, { level: number; xp: number }>
        | undefined;

      // Format goals for LLM selection
      const goalsText = availableGoals
        .map(
          (g, i) =>
            `${i + 1}. ${g.id}: ${g.description} (priority: ${g.priority}, reason: ${g.reason})`,
        )
        .join("\n");

      // Use LLM to select the best goal
      const selectionPrompt = `You are an AI agent playing a RuneScape-style MMORPG. You need to choose your next goal.

Current Status:
- Health: ${healthPercent}%
- Attack Level: ${skills?.attack?.level ?? 1}
- Strength Level: ${skills?.strength?.level ?? 1}
- Defence Level: ${skills?.defence?.level ?? 1}
- Woodcutting Level: ${skills?.woodcutting?.level ?? 1}

Available Goals:
${goalsText}

Choose the goal ID that makes the most sense for your current situation. Consider:
- If health is low, prioritize safety (exploration or rest)
- If health is good, train combat skills
- Balance your skill training (don't always train the same skill)

Respond with ONLY the goal ID (e.g., "train_attack" or "explore"). Nothing else.`;

      let selectedGoalId: string;

      try {
        const response = await runtime.useModel(ModelType.TEXT_SMALL, {
          prompt: selectionPrompt,
          maxTokens: 50,
          temperature: 0.7,
        });

        // Extract goal ID from response (clean up any extra text)
        selectedGoalId = response
          .trim()
          .toLowerCase()
          .replace(/[^a-z_]/g, "");
        logger.info(`[SET_GOAL] LLM selected goal: ${selectedGoalId}`);
      } catch (llmError) {
        // Fallback to highest priority goal if LLM fails
        logger.warn(
          `[SET_GOAL] LLM selection failed, using highest priority: ${llmError}`,
        );
        selectedGoalId = availableGoals[0].id;
      }

      // Find the selected goal
      let selectedGoal = availableGoals.find((g) => g.id === selectedGoalId);
      if (!selectedGoal) {
        // Fallback to highest priority if invalid selection
        logger.warn(
          `[SET_GOAL] Invalid goal ID "${selectedGoalId}", using highest priority`,
        );
        selectedGoal = availableGoals[0];
      }

      // Calculate progress and target for skill-based goals
      let progress = 0;
      let target = 10;

      if (selectedGoal.targetSkill && selectedGoal.targetSkillLevel) {
        // For skill goals: progress = current level, target = target level
        const currentLevel = skills?.[selectedGoal.targetSkill]?.level ?? 1;
        progress = currentLevel;
        target = selectedGoal.targetSkillLevel;
      } else if (selectedGoal.type === "exploration") {
        progress = 0;
        target = 3; // 3 exploration steps
      } else if (selectedGoal.type === "idle") {
        progress = 0;
        target = 1; // Just rest once
      }

      // Set the goal in the behavior manager
      behaviorManager.setGoal({
        type: selectedGoal.type,
        description: selectedGoal.description,
        target,
        progress,
        location: selectedGoal.location,
        targetEntity: selectedGoal.targetEntity,
        targetSkill: selectedGoal.targetSkill,
        targetSkillLevel: selectedGoal.targetSkillLevel,
        startedAt: Date.now(),
      });

      const responseText = `Goal selected: ${selectedGoal.description} (${selectedGoal.reason})`;
      await callback?.({ text: responseText, action: "SET_GOAL" });

      logger.info(`[SET_GOAL] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: {
          action: "SET_GOAL",
          goalId: selectedGoal.id,
          goalType: selectedGoal.type,
          target,
          targetSkill: selectedGoal.targetSkill,
          targetSkillLevel: selectedGoal.targetSkillLevel,
        },
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
      {
        name: "system",
        content: { text: "Agent has no current goal, health is 100%" },
      },
      {
        name: "agent",
        content: {
          text: "Goal selected: Train attack from 25 to 27 by killing goblins (Goblins nearby - great for attack training!)",
          action: "SET_GOAL",
        },
      },
    ],
    [
      {
        name: "system",
        content: { text: "Agent has no current goal, health is 25%" },
      },
      {
        name: "agent",
        content: {
          text: "Goal selected: Explore the world and discover new areas (Health is low - explore safely while recovering)",
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
      logger.info("[NAVIGATE_TO] Validation failed: not connected");
      return false;
    }

    const player = service.getPlayerEntity();
    if (!player?.position) {
      logger.info("[NAVIGATE_TO] Validation failed: no player position");
      return false;
    }

    // Handle both array [x, y, z] and object {x, y, z} position formats
    const rawPos = player.position as unknown;
    let playerX: number, playerZ: number;
    if (Array.isArray(rawPos) && rawPos.length >= 3) {
      playerX = rawPos[0];
      playerZ = rawPos[2];
    } else if (
      rawPos &&
      typeof rawPos === "object" &&
      "x" in rawPos &&
      "z" in rawPos
    ) {
      const posObj = rawPos as { x: number; z: number };
      playerX = posObj.x;
      playerZ = posObj.z;
    } else {
      logger.info(
        `[NAVIGATE_TO] Validation failed: invalid position format: ${JSON.stringify(rawPos)}`,
      );
      return false;
    }

    // Check if we need to navigate (not at goal location)
    const behaviorManager = service.getBehaviorManager();
    const goal = behaviorManager?.getGoal();

    logger.info(`[NAVIGATE_TO] Checking goal location: ${goal?.location}`);

    if (!goal?.location) {
      logger.info("[NAVIGATE_TO] Validation failed: no goal location set");
      return false;
    }

    const targetLoc = KNOWN_LOCATIONS[goal.location];
    if (!targetLoc) {
      logger.info(
        `[NAVIGATE_TO] Validation failed: unknown location "${goal.location}"`,
      );
      return false;
    }

    // Check distance
    const dx = playerX - targetLoc.position[0];
    const dz = playerZ - targetLoc.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);

    logger.info(
      `[NAVIGATE_TO] Player at (${playerX.toFixed(0)}, ${playerZ.toFixed(0)}), ` +
        `target "${goal.location}" at (${targetLoc.position[0]}, ${targetLoc.position[2]}), ` +
        `distance: ${distance.toFixed(0)}`,
    );

    if (distance < 30) {
      logger.info(
        "[NAVIGATE_TO] Validation failed: already at location (< 30 units)",
      );
      return false;
    }

    logger.info(
      `[NAVIGATE_TO] Validation passed - need to travel ${distance.toFixed(0)} units to ${goal.location}`,
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
