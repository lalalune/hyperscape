/**
 * Autonomous Behavior Actions for ElizaOS
 *
 * These actions are designed for autonomous agent behavior.
 * The LLM selects from these actions based on evaluator assessments.
 *
 * Actions:
 * - EXPLORE: Move to a new location to explore the world
 * - FLEE: Run away from danger when health is low
 * - IDLE: Do nothing and observe (conserve energy)
 * - WANDER: Random short-distance movement
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

/**
 * Helper to calculate distance between two positions
 */
function calculateDistance(
  pos1: [number, number, number],
  pos2: [number, number, number],
): number {
  const dx = pos1[0] - pos2[0];
  const dz = pos1[2] - pos2[2];
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * EXPLORE - Move to explore a new area
 *
 * Uses evaluator suggestions or picks a random direction
 */
export const exploreAction: Action = {
  name: "EXPLORE",
  similes: ["WANDER", "ROAM", "DISCOVER"],
  description:
    "Move to explore a new area. Use when idle and safe. The agent will walk to a nearby unexplored location.",

  validate: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      logger.debug("[EXPLORE] Validation failed: service not connected");
      return false;
    }

    const player = service.getPlayerEntity();
    if (!player) {
      logger.debug("[EXPLORE] Validation failed: no player entity");
      return false;
    }

    // Only treat as dead if explicitly false
    if (player.alive === false) {
      logger.debug("[EXPLORE] Validation failed: player is dead");
      return false;
    }

    // Don't explore if in combat
    if (player.inCombat) {
      logger.debug("[EXPLORE] Validation failed: player in combat");
      return false;
    }

    // Don't explore if health is too low - defensive calculation
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;
    if (healthPercent < 30) {
      logger.debug("[EXPLORE] Validation failed: health too low");
      return false;
    }

    // Check survival assessment from evaluator
    const survivalAssessment = state?.survivalAssessment as
      | {
          urgency?: string;
        }
      | undefined;
    if (survivalAssessment?.urgency === "critical") {
      logger.debug("[EXPLORE] Validation failed: survival urgency is critical");
      return false;
    }

    logger.info("[EXPLORE] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return { success: false, error: "Hyperscape service not available" };
      }

      const player = service.getPlayerEntity();
      if (!player) {
        return { success: false, error: "Player entity not available" };
      }

      // Get exploration target from state (set by explorationEvaluator)
      // or generate a random one
      let target: [number, number, number];

      const explorationAssessment = state?.explorationAssessment as
        | {
            suggestedTarget?: [number, number, number];
            suggestedDirection?: string;
          }
        | undefined;

      if (explorationAssessment?.suggestedTarget) {
        target = explorationAssessment.suggestedTarget;
        logger.info(
          `[EXPLORE] Using evaluator suggestion: ${explorationAssessment.suggestedDirection} to [${target[0].toFixed(1)}, ${target[2].toFixed(1)}]`,
        );
      } else {
        // Generate random exploration target
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 15; // 15-30 units
        target = [
          player.position[0] + Math.cos(angle) * distance,
          player.position[1],
          player.position[2] + Math.sin(angle) * distance,
        ];
        logger.info(
          `[EXPLORE] Generated random target: [${target[0].toFixed(1)}, ${target[2].toFixed(1)}]`,
        );
      }

      // Execute movement
      await service.executeMove({ target, runMode: false });

      const responseText = `Exploring towards [${target[0].toFixed(1)}, ${target[2].toFixed(1)}]`;
      await callback?.({ text: responseText, action: "EXPLORE" });

      logger.info(`[EXPLORE] ${responseText}`);

      return {
        success: true,
        text: responseText,
        values: { target },
        data: { action: "EXPLORE", target },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[EXPLORE] Failed: ${errorMsg}`);
      await callback?.({ text: `Failed to explore: ${errorMsg}`, error: true });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      {
        name: "system",
        content: { text: "Agent is idle with no threats nearby" },
      },
      {
        name: "agent",
        content: { text: "Exploring towards [-450, 80]", action: "EXPLORE" },
      },
    ],
  ],
};

/**
 * FLEE - Run away from danger
 *
 * Used when health is critical or overwhelming threats nearby
 */
export const fleeAction: Action = {
  name: "FLEE",
  similes: ["RUN_AWAY", "ESCAPE", "RETREAT"],
  description:
    "Run away from danger. Use when health is critical or overwhelmed by enemies. Moves quickly away from threats.",

  validate: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;

    // Only dead if explicitly false
    if (player.alive === false) return false;

    // Validate that fleeing makes sense - defensive health calculation
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;

    const survivalAssessment = state?.survivalAssessment as
      | {
          urgency?: string;
          threats?: string[];
        }
      | undefined;

    // Should flee if:
    // 1. Health is critical (<30%) and in combat or threats nearby
    // 2. Survival evaluator says urgency is critical
    const shouldFlee =
      (healthPercent < 30 &&
        (player.inCombat || (survivalAssessment?.threats?.length ?? 0) > 0)) ||
      survivalAssessment?.urgency === "critical";

    if (shouldFlee) {
      logger.info("[FLEE] Validation passed - danger detected");
      return true;
    }

    return false;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return { success: false, error: "Hyperscape service not available" };
      }

      const player = service.getPlayerEntity();
      if (!player) {
        return { success: false, error: "Player entity not available" };
      }

      // Find threats to flee from
      const nearbyEntities = service.getNearbyEntities();
      const threats = nearbyEntities.filter((entity) => {
        if (!("mobType" in entity)) return false;
        const dist = calculateDistance(
          player.position,
          entity.position as [number, number, number],
        );
        return dist < 20;
      });

      let fleeDirection: [number, number, number];

      if (threats.length > 0) {
        // Calculate average threat position
        let avgX = 0;
        let avgZ = 0;
        for (const threat of threats) {
          avgX += threat.position[0];
          avgZ += threat.position[2];
        }
        avgX /= threats.length;
        avgZ /= threats.length;

        // Flee in opposite direction
        const dx = player.position[0] - avgX;
        const dz = player.position[2] - avgZ;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        const fleeDistance = 30; // Run 30 units away

        fleeDirection = [
          player.position[0] + (dx / dist) * fleeDistance,
          player.position[1],
          player.position[2] + (dz / dist) * fleeDistance,
        ];
      } else {
        // No specific threat, just run in a random direction
        const angle = Math.random() * Math.PI * 2;
        fleeDirection = [
          player.position[0] + Math.cos(angle) * 30,
          player.position[1],
          player.position[2] + Math.sin(angle) * 30,
        ];
      }

      // Execute flee movement (running)
      await service.executeMove({ target: fleeDirection, runMode: true });

      const responseText = `Fleeing to [${fleeDirection[0].toFixed(1)}, ${fleeDirection[2].toFixed(1)}]!`;
      await callback?.({ text: responseText, action: "FLEE" });

      logger.info(`[FLEE] ${responseText}`);

      return {
        success: true,
        text: responseText,
        values: { target: fleeDirection, threats: threats.length },
        data: { action: "FLEE", target: fleeDirection },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[FLEE] Failed: ${errorMsg}`);
      await callback?.({ text: `Failed to flee: ${errorMsg}`, error: true });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "system", content: { text: "Health is 15%, goblin attacking" } },
      {
        name: "agent",
        content: { text: "Fleeing to [-400, 50]!", action: "FLEE" },
      },
    ],
  ],
};

/**
 * IDLE - Do nothing and observe
 *
 * Used when no action is needed or to conserve energy
 */
export const idleAction: Action = {
  name: "IDLE",
  similes: ["WAIT", "REST", "OBSERVE"],
  description:
    "Stand still and observe surroundings. Use when waiting, resting, or when no action is needed.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    // Can always idle if connected and alive (alive !== false means alive)
    return !!player && player.alive !== false;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: "Hyperscape service not available" };
    }

    const player = service.getPlayerEntity();
    if (!player) {
      return { success: false, error: "Player entity not available" };
    }

    // Stop any current movement by moving to current position
    await service.executeMove({ target: player.position, runMode: false });

    const responseText = "Standing still and observing...";
    await callback?.({ text: responseText, action: "IDLE" });

    logger.info(`[IDLE] ${responseText}`);

    return {
      success: true,
      text: responseText,
      data: { action: "IDLE" },
    };
  },

  examples: [
    [
      { name: "system", content: { text: "No immediate tasks or threats" } },
      {
        name: "agent",
        content: { text: "Standing still and observing...", action: "IDLE" },
      },
    ],
  ],
};

/**
 * APPROACH_ENTITY - Move towards a specific entity (player, resource, etc.)
 *
 * Used for social interaction or resource gathering preparation
 */
export const approachEntityAction: Action = {
  name: "APPROACH_ENTITY",
  similes: ["GO_TO_ENTITY", "WALK_TO"],
  description:
    "Move towards a nearby entity such as another player or resource. Use for social interaction or gathering.",

  validate: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;

    // Only dead if explicitly false
    if (player.alive === false || player.inCombat) return false;

    // Check if there are entities to approach
    const explorationAssessment = state?.explorationAssessment as
      | {
          pointsOfInterest?: Array<{ type: string; name: string }>;
        }
      | undefined;
    const socialAssessment = state?.socialAssessment as
      | {
          nearbyPlayers?: Array<{ name: string }>;
        }
      | undefined;

    const hasPOIs = (explorationAssessment?.pointsOfInterest?.length ?? 0) > 0;
    const hasPlayers = (socialAssessment?.nearbyPlayers?.length ?? 0) > 0;

    return hasPOIs || hasPlayers;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return { success: false, error: "Hyperscape service not available" };
      }

      const player = service.getPlayerEntity();
      if (!player) {
        return { success: false, error: "Player entity not available" };
      }

      // Get target from state assessments
      const explorationAssessment = state?.explorationAssessment as
        | {
            pointsOfInterest?: Array<{
              type: string;
              name: string;
              position: [number, number, number];
              distance: number;
            }>;
          }
        | undefined;

      const socialAssessment = state?.socialAssessment as
        | {
            nearbyPlayers?: Array<{
              name: string;
              id: string;
              distance: number;
            }>;
          }
        | undefined;

      // Prioritize players for social interaction, then resources
      let target: [number, number, number] | null = null;
      let targetName = "";

      if (socialAssessment?.nearbyPlayers?.length) {
        // Find nearest player
        const nearbyEntities = service.getNearbyEntities();
        const nearestPlayer = socialAssessment.nearbyPlayers[0];
        const playerEntity = nearbyEntities.find(
          (e) => e.id === nearestPlayer.id,
        );
        if (playerEntity) {
          target = playerEntity.position as [number, number, number];
          targetName = nearestPlayer.name;
        }
      }

      if (!target && explorationAssessment?.pointsOfInterest?.length) {
        const poi = explorationAssessment.pointsOfInterest[0];
        target = poi.position;
        targetName = poi.name;
      }

      if (!target) {
        return { success: false, error: "No entity to approach" };
      }

      // Move towards target (stop a bit short to not collide)
      const dx = target[0] - player.position[0];
      const dz = target[2] - player.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const stopDistance = 3; // Stop 3 units away

      const adjustedTarget: [number, number, number] =
        dist > stopDistance
          ? [
              player.position[0] + (dx / dist) * (dist - stopDistance),
              player.position[1],
              player.position[2] + (dz / dist) * (dist - stopDistance),
            ]
          : player.position;

      await service.executeMove({ target: adjustedTarget, runMode: false });

      const responseText = `Approaching ${targetName}`;
      await callback?.({ text: responseText, action: "APPROACH_ENTITY" });

      logger.info(`[APPROACH_ENTITY] ${responseText}`);

      return {
        success: true,
        text: responseText,
        values: { target: adjustedTarget, targetName },
        data: { action: "APPROACH_ENTITY", target: adjustedTarget, targetName },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[APPROACH_ENTITY] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to approach: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "system", content: { text: "Player 'Bob' is nearby" } },
      {
        name: "agent",
        content: { text: "Approaching Bob", action: "APPROACH_ENTITY" },
      },
    ],
  ],
};

// Export all autonomous actions
export const autonomousActions = [
  exploreAction,
  fleeAction,
  idleAction,
  approachEntityAction,
];
