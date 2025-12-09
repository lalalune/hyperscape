/**
 * Goal Evaluator - Provides clear action recommendations based on current goal
 *
 * Reads goal from AutonomousBehaviorManager and gives guidance on next action.
 */

import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

export const goalEvaluator: Evaluator = {
  name: "GOAL_EVALUATOR",
  description: "Evaluates goal progress and provides action recommendations",
  alwaysRun: true,

  examples: [
    {
      prompt: "Agent has combat goal and goblin nearby",
      messages: [
        {
          name: "system",
          content: { text: "Goal: Kill 5 goblins (2/5), goblin nearby" },
        },
      ],
      outcome: "ATTACK_ENTITY",
    },
  ],

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    return !!service?.isConnected();
  },

  handler: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return { success: true };

    const behaviorManager = service.getBehaviorManager();
    const goal = behaviorManager?.getGoal();
    const facts: string[] = [];
    const recommendations: string[] = [];

    // No goal - highest priority is to set one
    if (!goal) {
      facts.push("** NO ACTIVE GOAL **");
      recommendations.push("PRIORITY: SET_GOAL");

      if (state) {
        (state as Record<string, unknown>).goalFacts = facts;
        (state as Record<string, unknown>).goalRecommendations =
          recommendations;
        (state as Record<string, unknown>).priorityAction = "SET_GOAL";
      }

      return {
        success: true,
        text: "No goal set",
        values: { hasGoal: false },
        data: { priorityAction: "SET_GOAL" },
      };
    }

    // Has goal - check what action to take
    facts.push(`Goal: ${goal.description}`);
    facts.push(`Progress: ${goal.progress}/${goal.target}`);

    // Check if goal is complete
    if (goal.progress >= goal.target) {
      facts.push("** GOAL COMPLETE! **");
      recommendations.push("Goal finished! SET_GOAL for new objective");
      behaviorManager?.clearGoal();

      if (state) {
        (state as Record<string, unknown>).goalFacts = facts;
        (state as Record<string, unknown>).goalRecommendations =
          recommendations;
        (state as Record<string, unknown>).priorityAction = "SET_GOAL";
      }

      return {
        success: true,
        text: "Goal complete!",
        values: { goalComplete: true },
        data: { priorityAction: "SET_GOAL" },
      };
    }

    // Goal in progress - recommend action based on type
    let priorityAction = "IDLE";

    if (goal.type === "combat_training") {
      // Check for nearby mobs
      const nearbyEntities = service.getNearbyEntities();
      const mobs = nearbyEntities.filter(
        (e) =>
          "mobType" in e &&
          (e as { alive?: boolean }).alive !== false &&
          e.position &&
          Array.isArray(e.position) &&
          e.position.length >= 3,
      );

      if (mobs.length > 0) {
        const targetMob = goal.targetEntity
          ? mobs.find((m) =>
              m.name?.toLowerCase().includes(goal.targetEntity!.toLowerCase()),
            )
          : mobs[0];

        if (targetMob) {
          facts.push(`Target found: ${targetMob.name}`);
          recommendations.push(`ATTACK_ENTITY to fight ${targetMob.name}`);
          priorityAction = "ATTACK_ENTITY";
        } else {
          facts.push(`${mobs.length} mobs nearby but no ${goal.targetEntity}`);
          recommendations.push("IDLE and wait for goblin");
          priorityAction = "IDLE";
        }
      } else {
        facts.push("No mobs nearby");
        recommendations.push("EXPLORE to find mobs");
        priorityAction = "EXPLORE";
      }
    } else if (goal.type === "woodcutting") {
      const nearbyEntities = service.getNearbyEntities();
      const trees = nearbyEntities.filter((e) =>
        e.name?.toLowerCase().includes("tree"),
      );

      if (trees.length > 0) {
        facts.push(`${trees.length} trees nearby`);
        recommendations.push("CHOP_TREE");
        priorityAction = "CHOP_TREE";
      } else {
        facts.push("No trees nearby");
        recommendations.push("EXPLORE to find trees");
        priorityAction = "EXPLORE";
      }
    } else if (goal.type === "exploration") {
      recommendations.push("EXPLORE to discover new areas");
      priorityAction = "EXPLORE";
    }

    // Store in state
    if (state) {
      (state as Record<string, unknown>).goalFacts = facts;
      (state as Record<string, unknown>).goalRecommendations = recommendations;
      (state as Record<string, unknown>).priorityAction = priorityAction;
      (state as Record<string, unknown>).hasGoal = true;
      (state as Record<string, unknown>).goalType = goal.type;
    }

    logger.debug(`[GoalEvaluator] Priority: ${priorityAction}`);

    return {
      success: true,
      text: facts.join(", "),
      values: { hasGoal: true, goalType: goal.type },
      data: { priorityAction, facts, recommendations },
    };
  },
};
