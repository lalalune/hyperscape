/**
 * Goal API Route for Hyperia Plugin
 *
 * Provides endpoint to get the agent's current goal and progress
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";

/**
 * Get current goal route
 */
export const goalRoute: Route = {
  name: "hyperia-goal",
  type: "GET",
  path: "/hyperia/goal",
  public: true, // Allow dashboard to access without auth
  handler: async (req, res, runtime) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");

      if (!service) {
        res.status(503).json({
          success: false,
          error: "Hyperia service not available",
          goal: null,
        });
        return;
      }

      const behaviorManager = service.getBehaviorManager();
      const goal = behaviorManager?.getGoal();

      if (!goal) {
        res.json({
          success: true,
          goal: null,
          message: "No active goal",
        });
        return;
      }

      // Calculate progress percentage
      const progressPercent =
        goal.target > 0 ? Math.round((goal.progress / goal.target) * 100) : 0;

      res.json({
        success: true,
        goal: {
          type: goal.type,
          description: goal.description,
          progress: goal.progress,
          target: goal.target,
          progressPercent,
          location: goal.location,
          targetEntity: goal.targetEntity,
          targetSkill: goal.targetSkill,
          targetSkillLevel: goal.targetSkillLevel,
          startedAt: goal.startedAt,
          elapsedMs: Date.now() - goal.startedAt,
        },
      });
    } catch (error) {
      logger.error(
        "[GoalRoute] Error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        goal: null,
      });
    }
  },
};
