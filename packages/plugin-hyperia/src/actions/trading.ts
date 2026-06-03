/**
 * Trading actions for ElizaOS agents
 *
 * REQUEST_TRADE - Request a trade with a nearby player
 * ACCEPT_TRADE - Accept an incoming trade request
 *
 * Note: Full trade protocol (add/remove items, accept/cancel) requires
 * additional HyperiaService methods for the multi-step trade UI.
 * These actions handle trade initiation only.
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";
import type { Entity } from "../types.js";

function getDistance2D(
  posA: [number, number, number] | null | undefined,
  posB: [number, number, number] | null | undefined,
): number | null {
  if (!posA || !posB) return null;
  const dx = posA[0] - posB[0];
  const dz = posA[2] - posB[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function isPlayerEntity(entity: Entity): boolean {
  const t = (entity.entityType || entity.type || "").toLowerCase();
  return t === "player" || !!entity.playerId;
}

function findPlayerByName(
  entities: Entity[],
  searchName: string,
): Entity | null {
  const term = searchName.toLowerCase().trim();
  if (!term) return null;
  return (
    entities.find(
      (e) => isPlayerEntity(e) && e.name?.toLowerCase().includes(term),
    ) ?? null
  );
}

function findNearestPlayer(
  entities: Entity[],
  playerPos: [number, number, number],
): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (const entity of entities) {
    if (!isPlayerEntity(entity)) continue;
    const dist = getDistance2D(playerPos, entity.position);
    if (dist !== null && dist < nearestDist) {
      nearest = entity;
      nearestDist = dist;
    }
  }

  return nearest;
}

export const requestTradeAction: Action = {
  name: "REQUEST_TRADE",
  similes: ["TRADE_WITH", "OFFER_TRADE", "START_TRADE"],
  description:
    "Request a trade with a nearby player. Approaches them and initiates a trade request.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position) return false;
    if (player.inCombat) return false;

    const nearbyEntities = service.getNearbyEntities();
    return nearbyEntities.some(isPlayerEntity);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperia service not available"),
        };
      }

      const player = service.getPlayerEntity();
      if (!player?.position) {
        return { success: false, error: new Error("No player position") };
      }

      if (player.inCombat) {
        await callback?.({
          text: "Cannot trade while in combat.",
          action: "REQUEST_TRADE",
        });
        return { success: false, error: new Error("Player is in combat") };
      }

      const entities = service.getNearbyEntities();
      const content = (message.content.text || "").toLowerCase();

      const nameTokens = content
        .replace(/trade\s*(with)?/i, "")
        .replace(/that\s*player/i, "")
        .trim();

      const target =
        (nameTokens.length > 0
          ? findPlayerByName(entities, nameTokens)
          : null) ?? findNearestPlayer(entities, player.position);

      if (!target) {
        await callback?.({
          text: "No players nearby to trade with.",
          action: "REQUEST_TRADE",
        });
        return {
          success: false,
          error: new Error("No players nearby to trade with"),
        };
      }

      const dist = getDistance2D(player.position, target.position);
      if (dist !== null && dist > 5) {
        await service.executeMove({ target: target.position, runMode: false });
        await new Promise((r) => setTimeout(r, 2000));
      }

      service.interactWithEntity(target.id, "trade");

      const targetName = target.name || target.playerName || "player";
      const responseText = `Requesting trade with ${targetName}`;
      logger.info(`[REQUEST_TRADE] ${responseText}`);
      await callback?.({ text: responseText, action: "REQUEST_TRADE" });

      return {
        success: true,
        text: responseText,
        data: {
          action: "REQUEST_TRADE",
          targetId: target.id,
          targetName,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[REQUEST_TRADE] Failed: ${errorMsg}`);
      await callback?.({
        text: `Failed to request trade: ${errorMsg}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Trade with that player" } },
      {
        name: "agent",
        content: {
          text: "Requesting trade with nearby player",
          action: "REQUEST_TRADE",
        },
      },
    ],
    [
      { name: "user", content: { text: "Trade with Bob" } },
      {
        name: "agent",
        content: {
          text: "Requesting trade with Bob",
          action: "REQUEST_TRADE",
        },
      },
    ],
  ],
};

export const tradingActions = [requestTradeAction];
