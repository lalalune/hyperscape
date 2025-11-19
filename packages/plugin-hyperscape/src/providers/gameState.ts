/**
 * gameStateProvider - Supplies current player state context to the agent
 *
 * Provides:
 * - Health and stamina levels
 * - Current position in the world
 * - Combat status
 * - Alive/dead status
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { GameStateData } from "../types.js";

export const gameStateProvider: Provider = {
  name: "gameState",
  description:
    "Provides current player health, stamina, position, and combat status",
  dynamic: true,
  position: 1,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");

    if (!service) {
      return {
        text: "Game state unavailable (not connected to server)",
        values: {},
        data: {},
      };
    }

    const playerEntity = service.getPlayerEntity();

    if (!playerEntity) {
      return {
        text: "Player entity not loaded yet",
        values: {},
        data: {},
      };
    }

    const gameStateData: GameStateData = {
      health: playerEntity.health,
      stamina: playerEntity.stamina,
      position: playerEntity.position,
      inCombat: playerEntity.inCombat,
      combatTarget: playerEntity.combatTarget,
      alive: playerEntity.alive,
    };

    const healthPercent = Math.round(
      (playerEntity.health.current / playerEntity.health.max) * 100,
    );
    const staminaPercent = Math.round(
      (playerEntity.stamina.current / playerEntity.stamina.max) * 100,
    );

    const text = `## Your Current State
- **Health**: ${playerEntity.health.current}/${playerEntity.health.max} HP (${healthPercent}%)
- **Stamina**: ${playerEntity.stamina.current}/${playerEntity.stamina.max} (${staminaPercent}%)
- **Position**: [${playerEntity.position[0].toFixed(1)}, ${playerEntity.position[1].toFixed(1)}, ${playerEntity.position[2].toFixed(1)}]
- **Status**: ${playerEntity.alive ? "Alive" : "Dead"}${playerEntity.inCombat ? `, In Combat with ${playerEntity.combatTarget}` : ""}`;

    return {
      text,
      values: {
        health: playerEntity.health.current,
        maxHealth: playerEntity.health.max,
        healthPercent,
        stamina: playerEntity.stamina.current,
        staminaPercent,
        inCombat: playerEntity.inCombat,
        alive: playerEntity.alive,
      },
      data: gameStateData,
    };
  },
};
