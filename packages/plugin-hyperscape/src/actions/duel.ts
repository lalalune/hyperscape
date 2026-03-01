/**
 * Duel Actions for ElizaOS Autonomous Agents
 *
 * These actions enable AI agents to challenge and accept duels with other players
 * in the Hyperscape game world. Used for continuous agent-vs-agent combat.
 *
 * Actions:
 * - CHALLENGE_DUEL: Challenge a nearby player to a duel
 * - ACCEPT_DUEL: Accept an incoming duel challenge
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
import type { Entity } from "../types.js";

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
 * Helper to calculate distance between two positions
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
 * CHALLENGE_DUEL - Challenge a nearby player to a duel
 *
 * Used to initiate PvP combat in a controlled duel setting.
 * The agent will find the nearest player and send a duel challenge.
 */
export const challengeDuelAction: Action = {
  name: "CHALLENGE_DUEL",
  similes: ["DUEL", "FIGHT_PLAYER", "PVP"],
  description:
    "Challenge a nearby player to a duel. Use when you want to engage in PvP combat for training or entertainment.",

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      logger.debug("[CHALLENGE_DUEL] Validation failed: service not connected");
      return false;
    }

    const player = service.getPlayerEntity();
    if (!player) {
      logger.debug("[CHALLENGE_DUEL] Validation failed: no player entity");
      return false;
    }

    // Don't challenge if dead
    if (player.alive === false) {
      logger.debug("[CHALLENGE_DUEL] Validation failed: player is dead");
      return false;
    }

    // Don't challenge if already in combat
    if (player.inCombat) {
      logger.debug("[CHALLENGE_DUEL] Validation failed: player in combat");
      return false;
    }

    // Check health - should have decent health to duel
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;

    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;
    if (healthPercent < 50) {
      logger.debug(
        `[CHALLENGE_DUEL] Validation failed: health too low (${healthPercent.toFixed(0)}%)`,
      );
      return false;
    }

    // Check if there are any visible players to challenge (any distance)
    const nearbyEntities = service.getNearbyEntities();
    const visiblePlayers = nearbyEntities.filter((entity) => {
      const isPlayer =
        entity.type === "player" ||
        entity.entityType === "player" ||
        entity.playerId !== undefined;

      if (entity.id === player.id) return false;

      const entityPos = getXZ(entity.position);
      if (!entityPos) return false;

      return isPlayer;
    });

    if (visiblePlayers.length === 0) {
      logger.debug(
        "[CHALLENGE_DUEL] Validation failed: no visible players to challenge",
      );
      return false;
    }

    const nearestDist = Math.min(
      ...visiblePlayers.map((p) =>
        calculateDistance(player.position, p.position),
      ),
    );
    logger.info(
      `[CHALLENGE_DUEL] Validation passed - ${visiblePlayers.length} players visible (nearest: ${nearestDist.toFixed(0)} tiles)`,
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

      // Find nearest visible player to challenge
      const nearbyEntities = service.getNearbyEntities();
      const visiblePlayers = nearbyEntities.filter((entity) => {
        const isPlayer =
          entity.type === "player" ||
          entity.entityType === "player" ||
          entity.playerId !== undefined;
        if (entity.id === player.id) return false;
        const entityPos = getXZ(entity.position);
        if (!entityPos) return false;
        return isPlayer;
      });

      if (visiblePlayers.length === 0) {
        return { success: false, error: "No visible players to challenge" };
      }

      // Find nearest player
      let nearestPlayer = visiblePlayers[0];
      let nearestDist = calculateDistance(
        player.position,
        nearestPlayer.position,
      );

      for (const p of visiblePlayers) {
        const dist = calculateDistance(player.position, p.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPlayer = p;
        }
      }

      // If too far to challenge, walk to the player first
      if (nearestDist > 15) {
        const targetPos = getXZ(nearestPlayer.position);
        if (targetPos) {
          logger.info(
            `[CHALLENGE_DUEL] Player ${nearestPlayer.name || nearestPlayer.id} is ${nearestDist.toFixed(0)} tiles away — walking to them`,
          );
          await service.executeMove({
            target: [targetPos.x, 0, targetPos.z],
            runMode: true,
          });
          const responseText = `Walking to ${nearestPlayer.name || nearestPlayer.id} to challenge them to a duel (${nearestDist.toFixed(0)} tiles away)`;
          await callback?.({ text: responseText, action: "CHALLENGE_DUEL" });
          return {
            success: true,
            text: responseText,
            data: {
              action: "CHALLENGE_DUEL",
              moving: true,
              targetId: nearestPlayer.id,
              targetName: nearestPlayer.name,
            },
          };
        }
      }

      // Close enough — send duel challenge
      await service.executeDuelChallenge({
        targetPlayerId: nearestPlayer.id,
      });

      const responseText = `Challenging ${nearestPlayer.name || nearestPlayer.id} to a duel!`;
      await callback?.({ text: responseText, action: "CHALLENGE_DUEL" });

      logger.info(
        `[CHALLENGE_DUEL] ${responseText} (distance: ${nearestDist.toFixed(1)})`,
      );

      return {
        success: true,
        text: responseText,
        values: {
          targetId: nearestPlayer.id,
          targetName: nearestPlayer.name,
          distance: nearestDist,
        },
        data: {
          action: "CHALLENGE_DUEL",
          targetId: nearestPlayer.id,
          targetName: nearestPlayer.name,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[CHALLENGE_DUEL] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to challenge: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      {
        name: "system",
        content: { text: "Another player is nearby, agent is healthy" },
      },
      {
        name: "agent",
        content: {
          text: "Challenging Player123 to a duel!",
          action: "CHALLENGE_DUEL",
        },
      },
    ],
  ],
};

/**
 * ACCEPT_DUEL - Accept an incoming duel challenge
 *
 * Used to accept a duel challenge from another player.
 * The agent will automatically accept if it has a pending challenge.
 */
export const acceptDuelAction: Action = {
  name: "ACCEPT_DUEL",
  similes: ["ACCEPT_CHALLENGE", "FIGHT"],
  description:
    "Accept an incoming duel challenge from another player. Use when you have a pending duel challenge and want to fight.",

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      logger.debug("[ACCEPT_DUEL] Validation failed: service not connected");
      return false;
    }

    const player = service.getPlayerEntity();
    if (!player) {
      logger.debug("[ACCEPT_DUEL] Validation failed: no player entity");
      return false;
    }

    // Don't accept if dead
    if (player.alive === false) {
      logger.debug("[ACCEPT_DUEL] Validation failed: player is dead");
      return false;
    }

    // Don't accept if already in combat
    if (player.inCombat) {
      logger.debug("[ACCEPT_DUEL] Validation failed: player in combat");
      return false;
    }

    // Check if we have a pending duel challenge
    const pendingChallenge = service.getPendingDuelChallenge();
    if (!pendingChallenge) {
      logger.debug("[ACCEPT_DUEL] Validation failed: no pending challenge");
      return false;
    }

    // Check health - should have decent health to duel
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;

    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;
    if (healthPercent < 50) {
      logger.debug(
        `[ACCEPT_DUEL] Validation failed: health too low (${healthPercent.toFixed(0)}%)`,
      );
      return false;
    }

    logger.info(
      `[ACCEPT_DUEL] Validation passed - pending challenge from ${pendingChallenge.challengerName}`,
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

      const pendingChallenge = service.getPendingDuelChallenge();
      if (!pendingChallenge) {
        return { success: false, error: "No pending duel challenge" };
      }

      // Accept the challenge
      await service.executeDuelChallengeResponse({
        challengeId: pendingChallenge.challengeId,
        accept: true,
      });

      const responseText = `Accepting duel challenge from ${pendingChallenge.challengerName}!`;
      await callback?.({ text: responseText, action: "ACCEPT_DUEL" });

      logger.info(`[ACCEPT_DUEL] ${responseText}`);

      return {
        success: true,
        text: responseText,
        values: {
          challengeId: pendingChallenge.challengeId,
          challengerName: pendingChallenge.challengerName,
        },
        data: {
          action: "ACCEPT_DUEL",
          challengeId: pendingChallenge.challengeId,
          challengerId: pendingChallenge.challengerId,
          challengerName: pendingChallenge.challengerName,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ACCEPT_DUEL] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to accept duel: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      {
        name: "system",
        content: { text: "Incoming duel challenge from Player456" },
      },
      {
        name: "agent",
        content: {
          text: "Accepting duel challenge from Player456!",
          action: "ACCEPT_DUEL",
        },
      },
    ],
  ],
};

// Export all duel actions
export const duelActions = [challengeDuelAction, acceptDuelAction];
