/**
 * Goal Evaluator - Provides clear action recommendations based on current goal
 *
 * Reads goal from AutonomousBehaviorManager and gives guidance on next action.
 */

import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

type Position3 = [number, number, number];
type PositionLike = Position3 | { x: number; y?: number; z: number };

type GoalEvaluatorState = State & {
  goalFacts?: string[];
  goalRecommendations?: string[];
  priorityAction?: string;
  hasGoal?: boolean;
  goalType?: string;
};

function getPositionArray(
  pos: PositionLike | null | undefined,
): Position3 | null {
  if (!pos) return null;
  if (Array.isArray(pos) && pos.length >= 3) {
    return [pos[0], pos[1], pos[2]];
  }
  const obj = pos as { x: number; y?: number; z: number };
  return [obj.x, obj.y ?? 0, obj.z];
}

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

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    return !!service?.isConnected();
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
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
        const mutableState = state as GoalEvaluatorState;
        mutableState.goalFacts = facts;
        mutableState.goalRecommendations = recommendations;
        mutableState.priorityAction = "SET_GOAL";
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
        const mutableState = state as GoalEvaluatorState;
        mutableState.goalFacts = facts;
        mutableState.goalRecommendations = recommendations;
        mutableState.priorityAction = "SET_GOAL";
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
      const mobs = nearbyEntities.filter((e) => {
        const name = e.name?.toLowerCase() || "";
        const isMob =
          !!e.mobType ||
          e.type === "mob" ||
          e.entityType === "mob" ||
          /goblin|bandit|skeleton|zombie|rat|spider|wolf/i.test(name);
        return (
          isMob &&
          e.alive !== false &&
          !!getPositionArray(e.position as PositionLike)
        );
      });

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
      const trees = nearbyEntities.filter((e) => {
        const resourceType = (e.resourceType || "").toLowerCase();
        const name = e.name?.toLowerCase() || "";
        return resourceType === "tree" || name.includes("tree");
      });

      if (trees.length > 0) {
        facts.push(`${trees.length} trees nearby`);
        recommendations.push("CHOP_TREE");
        priorityAction = "CHOP_TREE";
      } else {
        facts.push("No trees nearby");
        recommendations.push("EXPLORE to find trees");
        priorityAction = "EXPLORE";
      }
    } else if (goal.type === "fishing") {
      const nearbyEntities = service.getNearbyEntities();
      const spots = nearbyEntities.filter((e) => {
        const resourceType = (e.resourceType || "").toLowerCase();
        const name = e.name?.toLowerCase() || "";
        return resourceType === "fishing_spot" || name.includes("fishing spot");
      });

      if (spots.length > 0) {
        facts.push(`${spots.length} fishing spot(s) nearby`);
        recommendations.push("CATCH_FISH");
        priorityAction = "CATCH_FISH";
      } else {
        facts.push("No fishing spots nearby");
        recommendations.push("EXPLORE to find fishing spots");
        priorityAction = "EXPLORE";
      }
    } else if (goal.type === "mining") {
      const nearbyEntities = service.getNearbyEntities();
      const rocks = nearbyEntities.filter((e) => {
        const resourceType = (e.resourceType || "").toLowerCase();
        const name = e.name?.toLowerCase() || "";
        return (
          resourceType === "mining_rock" ||
          resourceType === "ore" ||
          name.includes("rock") ||
          name.includes("ore")
        );
      });

      if (rocks.length > 0) {
        facts.push(`${rocks.length} rock(s) nearby`);
        recommendations.push("MINE_ROCK");
        priorityAction = "MINE_ROCK";
      } else {
        facts.push("No rocks nearby");
        recommendations.push("EXPLORE to find rocks");
        priorityAction = "EXPLORE";
      }
    } else if (goal.type === "user_command") {
      facts.push("User command in progress");
      recommendations.push("IDLE while command completes");
      priorityAction = "IDLE";
    } else if (goal.type === "exploration") {
      recommendations.push("EXPLORE to discover new areas");
      priorityAction = "EXPLORE";
    } else if (goal.type === "questing") {
      facts.push("Need to accept quests from NPCs to get tools and rewards");
      recommendations.push(
        "TALK_TO_NPC or ACCEPT_QUEST to get starter tools from quest NPCs",
      );
      priorityAction = "ACCEPT_QUEST";
    } else if (goal.type === "banking") {
      facts.push("Inventory is full — need to bank items");
      recommendations.push(
        "BANK_DEPOSIT_ALL to free inventory space (keeps essential tools)",
      );
      priorityAction = "BANK_DEPOSIT_ALL";
    }

    // Store in state
    if (state) {
      const mutableState = state as GoalEvaluatorState;
      mutableState.goalFacts = facts;
      mutableState.goalRecommendations = recommendations;
      mutableState.priorityAction = priorityAction;
      mutableState.hasGoal = true;
      mutableState.goalType = goal.type;
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
