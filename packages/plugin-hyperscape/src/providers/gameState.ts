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

    // Defensive check for position data
    const hasValidPosition =
      playerEntity.position &&
      Array.isArray(playerEntity.position) &&
      playerEntity.position.length >= 3;

    const gameStateData: GameStateData = {
      health: playerEntity.health,
      stamina: playerEntity.stamina,
      position: playerEntity.position,
      inCombat: playerEntity.inCombat,
      combatTarget: playerEntity.combatTarget,
      alive: playerEntity.alive,
    };

    // Defensive calculations with fallbacks
    const currentHealth = playerEntity.health?.current ?? 100;
    const maxHealth = playerEntity.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? Math.round((currentHealth / maxHealth) * 100) : 100;

    const currentStamina = playerEntity.stamina?.current ?? 100;
    const maxStamina = playerEntity.stamina?.max ?? 100;
    const staminaPercent =
      maxStamina > 0 ? Math.round((currentStamina / maxStamina) * 100) : 100;

    // Safe position string
    const positionStr = hasValidPosition
      ? `[${playerEntity.position[0].toFixed(1)}, ${playerEntity.position[1].toFixed(1)}, ${playerEntity.position[2].toFixed(1)}]`
      : "[loading...]";

    const text = `## Your Current State
- **Health**: ${currentHealth}/${maxHealth} HP (${healthPercent}%)
- **Stamina**: ${currentStamina}/${maxStamina} (${staminaPercent}%)
- **Position**: ${positionStr}
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
