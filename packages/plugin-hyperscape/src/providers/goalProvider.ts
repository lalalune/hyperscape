/**
 * goalProvider - Provides current agent goal context
 *
 * Goals are stored in the AutonomousBehaviorManager for reliability.
 * This provider reads the current goal and adds it to state for actions/evaluators.
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

/**
 * Known locations in the game world
 * Currently: goblins and trees at spawn (0,0,0)
 */
export const KNOWN_LOCATIONS: Record<
  string,
  {
    position: [number, number, number];
    description: string;
    entities?: string[];
  }
> = {
  spawn: {
    position: [0, 0, 0],
    description: "Spawn area where goblins roam - good for combat training",
    entities: ["goblin", "tree"],
  },
};

export const goalProvider: Provider = {
  name: "currentGoal",
  description: "Provides current agent goal and progress",
  dynamic: true,
  position: 0, // Run first

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const behaviorManager = service?.getBehaviorManager();
    const goal = behaviorManager?.getGoal();

    if (!goal) {
      return {
        text: `## Goal Status
**No active goal** - Use SET_GOAL to choose an objective!

Suggested goals:
- combat_training: Kill goblins to train combat
- woodcutting: Chop trees to gather wood`,
        values: {
          hasGoal: false,
        },
        data: {
          currentGoal: null,
        },
      };
    }

    const progressPercent =
      goal.target > 0 ? Math.round((goal.progress / goal.target) * 100) : 0;

    return {
      text: `## Goal Status
**Type**: ${goal.type}
**Objective**: ${goal.description}
**Progress**: ${goal.progress}/${goal.target} (${progressPercent}%)
**Location**: ${goal.location || "anywhere"}
**Target**: ${goal.targetEntity || "any"}`,
      values: {
        hasGoal: true,
        goalType: goal.type,
        goalProgress: goal.progress,
        goalTarget: goal.target,
        goalProgressPercent: progressPercent,
        goalLocation: goal.location,
        goalTargetEntity: goal.targetEntity,
      },
      data: {
        currentGoal: goal,
      },
    };
  },
};
