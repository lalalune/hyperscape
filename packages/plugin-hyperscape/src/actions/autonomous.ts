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
import { hasAxe, hasPickaxe } from "../utils/item-detection.js";

/**
 * Helper to get x, z coordinates from a position (handles array or object format)
 */
function getXZ(pos: unknown): { x: number; z: number } | null {
  if (Array.isArray(pos) && pos.length >= 3) {
    return { x: pos[0], z: pos[2] };
  }
  if (pos && typeof pos === "object" && "x" in pos && "z" in pos) {
    const objPos = pos as { x: number; z: number };
    return { x: objPos.x, z: objPos.z };
  }
  return null;
}

/**
 * Helper to get [x, y, z] position array from either array or object format
 */
function getPositionArray(pos: unknown): [number, number, number] | null {
  if (Array.isArray(pos) && pos.length >= 3) {
    return [pos[0], pos[1], pos[2]];
  }
  if (pos && typeof pos === "object" && "x" in pos && "z" in pos) {
    const objPos = pos as { x: number; y?: number; z: number };
    return [objPos.x, objPos.y ?? 0, objPos.z];
  }
  return null;
}

/**
 * Helper to calculate distance between two positions (handles array or object format)
 */
function calculateDistance(pos1: unknown, pos2: unknown): number {
  const p1 = getXZ(pos1);
  const p2 = getXZ(pos2);
  if (!p1 || !p2) return Infinity;
  const dx = p1.x - p2.x;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * EXPLORE - Move to explore a new area
 *
 * Supports:
 * - Directional: "EXPLORE north" moves 50-80 units in that direction
 * - Targeted: "EXPLORE toward Oakvale" moves toward a known town/POI
 * - Random: picks an interesting direction or random 30-60 unit target
 */
export const exploreAction: Action = {
  name: "EXPLORE",
  similes: ["WANDER", "ROAM", "DISCOVER", "TRAVEL", "HEAD"],
  description:
    "Move to explore a new area or travel toward a destination. Can specify a direction (north/south/east/west) or a town/POI name. Examples: 'EXPLORE north', 'EXPLORE toward Oakvale', 'EXPLORE' (random).",

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
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
    message: Memory,
    state?: State,
    options?: unknown,
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

      // Require valid position data (handles both array and object formats)
      const playerPos = getPositionArray(player.position);
      if (!playerPos) {
        return { success: false, error: "Player position not available yet" };
      }

      let target: [number, number, number] = [0, 0, 0];
      let description = "";

      // Parse the message text for direction or destination
      const msgText = (message?.content?.text || "").toLowerCase();

      // Check for cardinal direction keywords
      const directionAngles: Record<string, number> = {
        north: -Math.PI / 2,
        south: Math.PI / 2,
        east: 0,
        west: Math.PI,
        northeast: -Math.PI / 4,
        northwest: (-3 * Math.PI) / 4,
        southeast: Math.PI / 4,
        southwest: (3 * Math.PI) / 4,
      };

      let matched = false;

      // Try direction-based exploration
      for (const [dirName, angle] of Object.entries(directionAngles)) {
        if (msgText.includes(dirName)) {
          const distance = 50 + Math.random() * 30; // 50-80 units
          target = [
            playerPos[0] + Math.cos(angle) * distance,
            playerPos[1],
            playerPos[2] + Math.sin(angle) * distance,
          ];
          description = `Exploring ${dirName} to [${target[0].toFixed(0)}, ${target[2].toFixed(0)}] (${distance.toFixed(0)}m)`;
          matched = true;
          break;
        }
      }

      // Try town/POI-targeted exploration
      if (!matched) {
        const worldMap = service.getWorldMap?.();
        if (worldMap) {
          // Check towns
          const matchedTown = worldMap.towns.find((t) =>
            msgText.includes(t.name.toLowerCase()),
          );
          if (matchedTown) {
            target = [
              matchedTown.position.x,
              matchedTown.position.y,
              matchedTown.position.z,
            ];
            const dist = calculateDistance(playerPos, target);
            // Move toward town - cap at 100 units per step for safety
            if (dist > 100) {
              const ratio = 100 / dist;
              target = [
                playerPos[0] + (target[0] - playerPos[0]) * ratio,
                playerPos[1],
                playerPos[2] + (target[2] - playerPos[2]) * ratio,
              ];
              description = `Heading toward ${matchedTown.name} (${Math.round(dist)}m away, moving 100m closer)`;
            } else {
              description = `Arriving at ${matchedTown.name} (${Math.round(dist)}m away)`;
            }
            matched = true;
          }

          // Check POIs
          if (!matched) {
            const matchedPOI = worldMap.pois.find((p) =>
              msgText.includes(p.name.toLowerCase()),
            );
            if (matchedPOI) {
              target = [
                matchedPOI.position.x,
                matchedPOI.position.y,
                matchedPOI.position.z,
              ];
              const dist = calculateDistance(playerPos, target);
              if (dist > 100) {
                const ratio = 100 / dist;
                target = [
                  playerPos[0] + (target[0] - playerPos[0]) * ratio,
                  playerPos[1],
                  playerPos[2] + (target[2] - playerPos[2]) * ratio,
                ];
                description = `Heading toward ${matchedPOI.name} (${Math.round(dist)}m away, moving 100m closer)`;
              } else {
                description = `Arriving at ${matchedPOI.name} (${Math.round(dist)}m away)`;
              }
              matched = true;
            }
          }
        }
      }

      // Try evaluator suggestion
      if (!matched) {
        const explorationAssessment = state?.explorationAssessment as
          | {
              suggestedTarget?: [number, number, number];
              suggestedDirection?: string;
            }
          | undefined;

        if (explorationAssessment?.suggestedTarget) {
          target = explorationAssessment.suggestedTarget;
          description = `Exploring ${explorationAssessment.suggestedDirection || "suggested area"} to [${target[0].toFixed(0)}, ${target[2].toFixed(0)}]`;
          matched = true;
        }
      }

      // Fallback: random exploration with longer range
      if (!matched) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 30; // 30-60 units (up from 15-30)
        target = [
          playerPos[0] + Math.cos(angle) * distance,
          playerPos[1],
          playerPos[2] + Math.sin(angle) * distance,
        ];
        description = `Exploring toward [${target[0].toFixed(0)}, ${target[2].toFixed(0)}]`;
      }

      if (!target) {
        return {
          success: false,
          error: "Failed to determine exploration target",
        };
      }

      // Execute movement
      await service.executeMove({ target, runMode: false });

      await callback?.({ text: description, action: "EXPLORE" });
      logger.info(`[EXPLORE] ${description}`);

      return {
        success: true,
        text: description,
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

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
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
    message: Memory,
    state?: State,
    options?: unknown,
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

      // Require valid position data (handles both array and object formats)
      const playerPos = getPositionArray(player.position);
      if (!playerPos) {
        return { success: false, error: "Player position not available yet" };
      }

      // Find threats to flee from
      const nearbyEntities = service.getNearbyEntities();
      const threats = nearbyEntities.filter((entity) => {
        if (!("mobType" in entity)) return false;
        const entityPos = getPositionArray(entity.position);
        if (!entityPos) return false;
        const dist = calculateDistance(playerPos, entityPos);
        return dist < 20;
      });

      let fleeDirection: [number, number, number];

      if (threats.length > 0) {
        // Calculate average threat position
        let avgX = 0;
        let avgZ = 0;
        for (const threat of threats) {
          const threatPos = getPositionArray(threat.position);
          if (threatPos) {
            avgX += threatPos[0];
            avgZ += threatPos[2];
          }
        }
        avgX /= threats.length;
        avgZ /= threats.length;

        // Flee in opposite direction
        const dx = playerPos[0] - avgX;
        const dz = playerPos[2] - avgZ;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        const fleeDistance = 30; // Run 30 units away

        fleeDirection = [
          playerPos[0] + (dx / dist) * fleeDistance,
          playerPos[1],
          playerPos[2] + (dz / dist) * fleeDistance,
        ];
      } else {
        // No specific threat, just run in a random direction
        const angle = Math.random() * Math.PI * 2;
        fleeDirection = [
          playerPos[0] + Math.cos(angle) * 30,
          playerPos[1],
          playerPos[2] + Math.sin(angle) * 30,
        ];
      }

      // Clear any combat target lock when fleeing - survival > combat
      const behaviorManager = service.getBehaviorManager?.();
      if (behaviorManager?.hasLockedTarget?.()) {
        logger.info(`[FLEE] 🎯 Clearing target lock to flee`);
        behaviorManager.clearTargetLock?.();
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

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    // Can always idle if connected and alive (alive !== false means alive)
    return !!player && player.alive !== false;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
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

    // Cancel any current movement by sending cancel flag to clear the path
    await service.executeMove({
      target: player.position,
      runMode: false,
      cancel: true,
    });

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

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
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
    message: Memory,
    state?: State,
    options?: unknown,
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

      // Require valid position data (handles both array and object formats)
      const playerPos = getPositionArray(player.position);
      if (!playerPos) {
        return { success: false, error: "Player position not available yet" };
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
          const entityPos = getPositionArray(playerEntity.position);
          if (entityPos) {
            target = entityPos;
            targetName = nearestPlayer.name;
          }
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
      const dx = target[0] - playerPos[0];
      const dz = target[2] - playerPos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const stopDistance = 3; // Stop 3 units away

      const adjustedTarget: [number, number, number] =
        dist > stopDistance
          ? [
              playerPos[0] + (dx / dist) * (dist - stopDistance),
              playerPos[1],
              playerPos[2] + (dz / dist) * (dist - stopDistance),
            ]
          : playerPos;

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

/**
 * ATTACK_ENTITY - Engage in combat with a nearby mob
 *
 * Autonomous-friendly version that finds targets from nearby entities
 * Uses combatEvaluator state or finds nearest attackable mob
 */
export const attackEntityAction: Action = {
  name: "ATTACK_ENTITY",
  similes: ["ATTACK", "FIGHT", "COMBAT", "ENGAGE"],
  description:
    "Attack a nearby NPC/mob. Use when you want to engage in combat for training or loot. Requires good health.",

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      logger.debug("[ATTACK_ENTITY] Validation failed: service not connected");
      return false;
    }

    const player = service.getPlayerEntity();
    if (!player) {
      logger.debug("[ATTACK_ENTITY] Validation failed: no player entity");
      return false;
    }

    // NOTE: We ALLOW attacking while in combat - the player needs to fight back!
    // Being in combat (e.g., being attacked by goblins) should not prevent attacking.

    // Don't attack if dead
    if (player.alive === false) {
      logger.debug("[ATTACK_ENTITY] Validation failed: player is dead");
      return false;
    }

    // Require minimum health to engage (30%)
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;

    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;

    if (healthPercent < 30) {
      logger.debug(
        `[ATTACK_ENTITY] Validation failed: health too low (${healthPercent.toFixed(0)}%)`,
      );
      return false;
    }

    // Check if there are attackable mobs nearby
    const nearbyEntities = service.getNearbyEntities();

    const attackableMobs = nearbyEntities.filter((entity) => {
      const hasMobType = "mobType" in entity;
      const typeIsMob = entity.type === "mob";
      const entityTypeIsMob = entity.entityType === "mob";
      const nameMatchesMob =
        entity.name &&
        /goblin|bandit|skeleton|zombie|rat|spider|wolf/i.test(entity.name);
      const isMob =
        hasMobType || typeIsMob || entityTypeIsMob || nameMatchesMob;

      if (!isMob) return false;

      let hasValidPosition = false;
      if (entity.position) {
        if (Array.isArray(entity.position) && entity.position.length >= 3) {
          hasValidPosition = true;
        } else if (
          typeof entity.position === "object" &&
          "x" in entity.position &&
          "z" in entity.position
        ) {
          hasValidPosition = true;
        }
      }
      if (!hasValidPosition) return false;

      const isAlive = entity.alive !== false;
      if (!isAlive) return false;

      return true;
    });

    if (attackableMobs.length === 0) {
      logger.warn(
        `[ATTACK_ENTITY] Validation failed: no attackable mobs nearby (${nearbyEntities.length} total entities)`,
      );
      return false;
    }

    logger.info(
      `[ATTACK_ENTITY] Validation passed - ${attackableMobs.length} targets available`,
    );
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
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

      // Require valid position for distance calculations (handle both array and object formats)
      const playerPos = getXZ(player.position);
      if (!playerPos) {
        return { success: false, error: "Player position not available yet" };
      }

      // Find attackable mobs
      const nearbyEntities = service.getNearbyEntities();

      // Debug: Log all nearby entities and their positions after respawn
      logger.info(
        `[ATTACK_ENTITY] 🔍 Scanning ${nearbyEntities.length} nearby entities...`,
      );
      for (const ent of nearbyEntities) {
        const isMobLike =
          "mobType" in ent ||
          ent.type === "mob" ||
          /goblin/i.test(ent.name || "");
        if (isMobLike) {
          logger.info(
            `[ATTACK_ENTITY] 🦎 MOB: "${ent.name}" id=${ent.id} position=${JSON.stringify(ent.position)} (type: ${typeof ent.position})`,
          );
        }
      }

      const attackableMobs = nearbyEntities.filter((entity) => {
        // Check if this is a mob - try multiple detection methods
        const isMob =
          "mobType" in entity ||
          entity.type === "mob" ||
          entity.entityType === "mob" ||
          (entity.name &&
            /goblin|bandit|skeleton|zombie|rat|spider|wolf/i.test(entity.name));

        if (!isMob) return false;

        // Check position - handle both array and object formats
        if (!entity.position) return false;
        const isArrayPos =
          Array.isArray(entity.position) && entity.position.length >= 3;
        const isObjectPos =
          typeof entity.position === "object" &&
          "x" in entity.position &&
          "z" in entity.position;
        if (!isArrayPos && !isObjectPos) return false;

        if (entity.alive === false) return false;
        return true;
      });

      if (attackableMobs.length === 0) {
        return { success: false, error: "No attackable mobs nearby" };
      }

      // TARGET LOCKING: Prioritize locked target to finish kills
      const behaviorManager = service.getBehaviorManager?.();
      const lockedTargetId = behaviorManager?.getLockedTarget?.();

      let targetMob: (typeof attackableMobs)[0] | null = null;

      // Check if locked target is still valid and nearby
      if (lockedTargetId) {
        targetMob =
          attackableMobs.find((mob) => mob.id === lockedTargetId) || null;
        if (targetMob) {
          logger.info(
            `[ATTACK_ENTITY] 🎯 Using locked target: ${targetMob.name} (${lockedTargetId})`,
          );
        } else {
          // Locked target no longer valid, clear it
          logger.info(
            `[ATTACK_ENTITY] 🎯 Locked target ${lockedTargetId} no longer available, finding new target`,
          );
          behaviorManager?.clearTargetLock?.();
        }
      }

      // If no locked target, find nearest mob and lock onto it
      if (!targetMob) {
        let nearestMob = attackableMobs[0];
        let nearestDist = calculateDistance(
          player.position,
          nearestMob.position,
        );

        for (const mob of attackableMobs) {
          const dist = calculateDistance(player.position, mob.position);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestMob = mob;
          }
        }

        targetMob = nearestMob;

        // Lock onto this new target
        if (behaviorManager?.lockTarget) {
          behaviorManager.lockTarget(targetMob.id);
          logger.info(
            `[ATTACK_ENTITY] 🎯 Locked onto new target: ${targetMob.name} (${targetMob.id})`,
          );
        }
      }

      const nearestDist = calculateDistance(
        player.position,
        targetMob.position,
      );
      const nearestMob = targetMob;

      // Get mob position for movement
      // Debug: log the raw position data to diagnose (0,0) issue after respawn
      logger.info(
        `[ATTACK_ENTITY] nearestMob.position raw: ${JSON.stringify(nearestMob.position)} (type: ${typeof nearestMob.position}, isArray: ${Array.isArray(nearestMob.position)})`,
      );
      const mobPos = getXZ(nearestMob.position);
      logger.info(
        `[ATTACK_ENTITY] mobPos after getXZ: ${JSON.stringify(mobPos)}`,
      );
      if (!mobPos) {
        return { success: false, error: "Cannot determine mob position" };
      }

      const MELEE_RANGE = 3; // Melee attack range in units

      // If not in melee range, move towards the mob first and return
      // DO NOT send attack command yet - it would replace the movement action!
      // Combat action has higher priority than movement, so we must only move first.
      // On the next tick, we'll check again and attack when in range.
      if (nearestDist > MELEE_RANGE) {
        // Calculate position to move to (stop just before the mob)
        const dx = mobPos.x - playerPos.x;
        const dz = mobPos.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const stopDist = 2; // Stop 2 units away from mob

        const targetX = playerPos.x + (dx / dist) * (dist - stopDist);
        const targetZ = playerPos.z + (dz / dist) * (dist - stopDist);

        logger.info(
          `[ATTACK_ENTITY] Moving towards ${nearestMob.name} at [${targetX.toFixed(1)}, ${targetZ.toFixed(1)}] (distance: ${nearestDist.toFixed(1)})`,
        );

        // Move towards mob - MUST use array format [x, y, z]
        await service.executeMove({
          target: [targetX, 0, targetZ],
          runMode: true, // Run to engage faster
        });

        const responseText = `Moving to attack ${nearestMob.name}!`;
        await callback?.({ text: responseText, action: "ATTACK_ENTITY" });

        logger.info(
          `[ATTACK_ENTITY] ${responseText} (distance: ${nearestDist.toFixed(1)})`,
        );

        return {
          success: true,
          text: responseText,
          values: { target: nearestMob.name, distance: nearestDist },
          data: {
            action: "ATTACK_ENTITY",
            targetId: nearestMob.id,
            targetName: nearestMob.name,
            moving: true, // Flag that we're still moving
          },
        };
      }

      // In melee range - send attack command
      await service.executeAttack({ targetEntityId: nearestMob.id });

      const responseText = `Attacking ${nearestMob.name}!`;
      await callback?.({ text: responseText, action: "ATTACK_ENTITY" });

      logger.info(
        `[ATTACK_ENTITY] ${responseText} (distance: ${nearestDist.toFixed(1)})`,
      );

      return {
        success: true,
        text: responseText,
        values: { target: nearestMob.name, distance: nearestDist },
        data: {
          action: "ATTACK_ENTITY",
          targetId: nearestMob.id,
          targetName: nearestMob.name,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ATTACK_ENTITY] Failed: ${errorMsg}`);
      await callback?.({ text: `Failed to attack: ${errorMsg}`, error: true });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      {
        name: "system",
        content: { text: "Goblin nearby, agent is healthy" },
      },
      {
        name: "agent",
        content: { text: "Attacking Goblin!", action: "ATTACK_ENTITY" },
      },
    ],
  ],
};

/**
 * Known starter chest location (spawned by EntityManager near bank)
 */
const STARTER_CHEST_LOCATION: [number, number, number] = [5, 0, -20];

/**
 * LOOT_STARTER_CHEST - Interact with the starter chest to get starter equipment
 *
 * New players/agents should use this to acquire basic tools and food.
 * Only works once per character. Will navigate to the chest if not nearby.
 */
export const lootStarterChestAction: Action = {
  name: "LOOT_STARTER_CHEST",
  similes: ["SEARCH_CHEST", "GET_STARTER_ITEMS", "OPEN_STARTER_CHEST"],
  description:
    "Search the starter chest to get starter equipment (bronze tools, tinderbox, net, food). Only works once per character. Use when you have no basic tools.",

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      logger.debug(
        "[LOOT_STARTER_CHEST] Validation failed: service not connected",
      );
      return false;
    }

    const player = service.getPlayerEntity();
    if (!player) {
      logger.debug("[LOOT_STARTER_CHEST] Validation failed: no player entity");
      return false;
    }

    // Only treat as dead if explicitly false
    if (player.alive === false) {
      logger.debug("[LOOT_STARTER_CHEST] Validation failed: player is dead");
      return false;
    }

    // Don't loot if in combat
    if (player.inCombat) {
      logger.debug("[LOOT_STARTER_CHEST] Validation failed: player in combat");
      return false;
    }

    // Check if player has basic tools (if they do, no need to loot chest)
    // Use centralized item detection utility for consistent detection
    const playerHasAxe = hasAxe(player);
    const playerHasPickaxe = hasPickaxe(player);

    // Only validate if player needs tools (doesn't have axe or pickaxe)
    if (playerHasAxe && playerHasPickaxe) {
      logger.info(
        "[LOOT_STARTER_CHEST] Validation failed: player already has basic tools (axe and pickaxe)",
      );
      return false;
    }

    logger.info(
      `[LOOT_STARTER_CHEST] Validation passed: player needs tools (hasAxe=${playerHasAxe}, hasPickaxe=${playerHasPickaxe})`,
    );
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
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

      // Find starter chest in nearby entities
      const nearbyEntities = service.getNearbyEntities();
      const starterChest = nearbyEntities.find(
        (e) =>
          e.type === "starter_chest" ||
          e.name?.toLowerCase().includes("starter chest"),
      );

      const playerPos = getXZ(player.position);
      if (!playerPos) {
        return { success: false, error: "Cannot determine player position" };
      }

      // Calculate distance to known chest location
      const distanceToKnownLocation = calculateDistance(
        player.position,
        STARTER_CHEST_LOCATION,
      );

      const INTERACTION_RANGE = 3; // Interaction range in units
      const NEARBY_RANGE = 10; // Range where we can see the entity

      // If starter chest not nearby and we're far from known location, navigate there first
      if (!starterChest && distanceToKnownLocation > NEARBY_RANGE) {
        logger.info(
          `[LOOT_STARTER_CHEST] Navigating to starter chest at known location [${STARTER_CHEST_LOCATION[0]}, ${STARTER_CHEST_LOCATION[2]}] (distance: ${distanceToKnownLocation.toFixed(1)})`,
        );

        // Move towards known chest location
        await service.executeMove({
          target: STARTER_CHEST_LOCATION,
          runMode: true,
        });

        const responseText = `Heading to starter chest near spawn...`;
        await callback?.({ text: responseText, action: "LOOT_STARTER_CHEST" });

        return {
          success: true,
          text: responseText,
          data: {
            action: "LOOT_STARTER_CHEST",
            navigating: true,
            targetLocation: STARTER_CHEST_LOCATION,
          },
        };
      }

      // If we still can't see the chest but we're close to the location, keep moving closer
      if (!starterChest) {
        logger.info(
          `[LOOT_STARTER_CHEST] Close to chest location but not visible yet, moving closer (distance: ${distanceToKnownLocation.toFixed(1)})`,
        );

        await service.executeMove({
          target: STARTER_CHEST_LOCATION,
          runMode: true,
        });

        const responseText = `Approaching starter chest...`;
        await callback?.({ text: responseText, action: "LOOT_STARTER_CHEST" });

        return {
          success: true,
          text: responseText,
          data: {
            action: "LOOT_STARTER_CHEST",
            moving: true,
          },
        };
      }

      // Chest found! Check distance
      const chestPos = getXZ(starterChest.position);
      if (!chestPos) {
        return { success: false, error: "Cannot determine chest position" };
      }

      const distance = calculateDistance(
        player.position,
        starterChest.position,
      );

      // If not in interaction range, move towards the chest
      if (distance > INTERACTION_RANGE) {
        logger.info(
          `[LOOT_STARTER_CHEST] Moving towards starter chest at [${chestPos.x.toFixed(1)}, ${chestPos.z.toFixed(1)}] (distance: ${distance.toFixed(1)})`,
        );

        // Move towards chest
        await service.executeMove({
          target: [chestPos.x, 0, chestPos.z],
          runMode: true,
        });

        const responseText = `Moving to starter chest...`;
        await callback?.({ text: responseText, action: "LOOT_STARTER_CHEST" });

        return {
          success: true,
          text: responseText,
          data: {
            action: "LOOT_STARTER_CHEST",
            chestId: starterChest.id,
            moving: true,
          },
        };
      }

      // In range - interact with the chest
      logger.info(
        `[LOOT_STARTER_CHEST] Interacting with starter chest (${starterChest.id})`,
      );

      service.interactWithEntity(starterChest.id, "loot");

      const responseText = `Searching starter chest for equipment...`;
      await callback?.({ text: responseText, action: "LOOT_STARTER_CHEST" });

      logger.info(`[LOOT_STARTER_CHEST] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: {
          action: "LOOT_STARTER_CHEST",
          chestId: starterChest.id,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[LOOT_STARTER_CHEST] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to loot starter chest: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      {
        name: "system",
        content: { text: "New player with no tools, starter chest nearby" },
      },
      {
        name: "agent",
        content: {
          text: "Searching starter chest for equipment...",
          action: "LOOT_STARTER_CHEST",
        },
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
  attackEntityAction,
  lootStarterChestAction,
];
