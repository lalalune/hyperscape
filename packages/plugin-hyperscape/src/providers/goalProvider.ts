/**
 * goalProvider - Provides current agent goal context and available goals
 *
 * Goals are stored in the AutonomousBehaviorManager for reliability.
 * This provider reads the current goal and available goal options
 * based on the agent's current state (skills, health, nearby entities).
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
 * - spawn: Central area where goblins roam (0,0,0)
 * - forest: Western forest with trees for woodcutting (-130, 0, 400)
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
    entities: ["goblin"],
  },
  forest: {
    position: [-130, 30, 400],
    description: "Western forest with plenty of trees for woodcutting",
    entities: ["tree"],
  },
};

/**
 * Goal option that can be selected by the LLM
 */
export interface GoalOption {
  id: string;
  type: "combat_training" | "woodcutting" | "exploration" | "idle";
  description: string;
  targetSkill?: string;
  targetSkillLevel?: number;
  targetEntity?: string;
  location?: string;
  priority: number; // Higher = more recommended
  reason: string; // Why this goal is available/recommended
}

/**
 * Generate available goal options based on current state
 */
export function getAvailableGoals(service: HyperscapeService): GoalOption[] {
  const goals: GoalOption[] = [];
  const player = service.getPlayerEntity();

  // Get current skill levels
  const skills = player?.skills as
    | Record<string, { level: number; xp: number }>
    | undefined;
  const attackLevel = skills?.attack?.level ?? 1;
  const strengthLevel = skills?.strength?.level ?? 1;
  const defenseLevel = skills?.defence?.level ?? 1;
  const woodcuttingLevel = skills?.woodcutting?.level ?? 1;

  // Get health status
  const healthPercent = player?.health
    ? (player.health.current / player.health.max) * 100
    : 100;

  // Get nearby entities
  const nearbyEntities = service.getNearbyEntities();
  const hasGoblins = nearbyEntities.some((e) =>
    e.name?.toLowerCase().includes("goblin"),
  );
  const hasTrees = nearbyEntities.some((e) =>
    e.name?.toLowerCase().includes("tree"),
  );

  // Combat training goals (only if health is decent)
  if (healthPercent >= 30) {
    // Attack training
    goals.push({
      id: "train_attack",
      type: "combat_training",
      description: `Train attack from ${attackLevel} to ${attackLevel + 2} by killing goblins`,
      targetSkill: "attack",
      targetSkillLevel: attackLevel + 2,
      targetEntity: "goblin",
      location: "spawn",
      priority: hasGoblins ? 80 : 60,
      reason: hasGoblins
        ? "Goblins nearby - great for attack training!"
        : "Goblins at spawn area for attack training",
    });

    // Strength training
    goals.push({
      id: "train_strength",
      type: "combat_training",
      description: `Train strength from ${strengthLevel} to ${strengthLevel + 2} by killing goblins`,
      targetSkill: "strength",
      targetSkillLevel: strengthLevel + 2,
      targetEntity: "goblin",
      location: "spawn",
      priority: hasGoblins ? 75 : 55,
      reason: hasGoblins
        ? "Goblins nearby - good for strength training"
        : "Train strength on goblins at spawn",
    });

    // Defense training
    goals.push({
      id: "train_defence",
      type: "combat_training",
      description: `Train defence from ${defenseLevel} to ${defenseLevel + 2} by killing goblins`,
      targetSkill: "defence",
      targetSkillLevel: defenseLevel + 2,
      targetEntity: "goblin",
      location: "spawn",
      priority: hasGoblins ? 70 : 50,
      reason: "Train defence by taking hits from goblins",
    });
  }

  // Woodcutting goal
  goals.push({
    id: "train_woodcutting",
    type: "woodcutting",
    description: `Train woodcutting from ${woodcuttingLevel} to ${woodcuttingLevel + 2} by chopping trees in the forest`,
    targetSkill: "woodcutting",
    targetSkillLevel: woodcuttingLevel + 2,
    targetEntity: "tree",
    location: "forest",
    priority: hasTrees ? 65 : 40,
    reason: hasTrees
      ? "Trees nearby - safe way to train"
      : "Head to the western forest for woodcutting",
  });

  // Exploration goal (good when health is low)
  goals.push({
    id: "explore",
    type: "exploration",
    description: "Explore the world and discover new areas",
    location: "spawn",
    priority: healthPercent < 50 ? 90 : 30, // High priority when hurt
    reason:
      healthPercent < 50
        ? "Health is low - explore safely while recovering"
        : "Discover new areas and resources",
  });

  // Idle/rest goal (when health is very low)
  if (healthPercent < 30) {
    goals.push({
      id: "rest",
      type: "idle",
      description: "Rest and recover health before continuing",
      priority: 95,
      reason: "Health critically low - rest to recover",
    });
  }

  // Sort by priority (highest first)
  return goals.sort((a, b) => b.priority - a.priority);
}

export const goalProvider: Provider = {
  name: "currentGoal",
  description:
    "Provides current agent goal, progress, and available goal options",
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

    // Get available goals based on current state
    const availableGoals = service ? getAvailableGoals(service) : [];
    const goalsText = availableGoals
      .slice(0, 5) // Show top 5 options
      .map(
        (g, i) =>
          `${i + 1}. **${g.id}** (priority ${g.priority}): ${g.description}\n   _${g.reason}_`,
      )
      .join("\n");

    if (!goal) {
      return {
        text: `## Goal Status
**No active goal** - You need to choose a goal!

## Available Goals (choose one):
${goalsText}

Use SET_GOAL to select one of these objectives based on your situation.`,
        values: {
          hasGoal: false,
          availableGoalCount: availableGoals.length,
          topGoalId: availableGoals[0]?.id || null,
        },
        data: {
          currentGoal: null,
          availableGoals,
        },
      };
    }

    const progressPercent =
      goal.target > 0 ? Math.round((goal.progress / goal.target) * 100) : 0;

    return {
      text: `## Current Goal
**Type**: ${goal.type}
**Objective**: ${goal.description}
**Progress**: ${goal.progress}/${goal.target} (${progressPercent}%)
**Location**: ${goal.location || "anywhere"}
**Target**: ${goal.targetEntity || "any"}
${goal.targetSkill ? `**Training**: ${goal.targetSkill} to level ${goal.targetSkillLevel}` : ""}`,
      values: {
        hasGoal: true,
        goalType: goal.type,
        goalProgress: goal.progress,
        goalTarget: goal.target,
        goalProgressPercent: progressPercent,
        goalLocation: goal.location,
        goalTargetEntity: goal.targetEntity,
        goalTargetSkill: goal.targetSkill,
        goalTargetSkillLevel: goal.targetSkillLevel,
      },
      data: {
        currentGoal: goal,
        availableGoals, // Still include for reference
      },
    };
  },
};
