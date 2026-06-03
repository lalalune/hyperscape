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
import type { HyperiaService } from "../services/HyperiaService.js";
import type { GameStateData } from "../types.js";

function normalizePosition(position: unknown): [number, number, number] | null {
  if (Array.isArray(position) && position.length >= 3) {
    return [position[0], position[1], position[2]];
  }
  if (
    position &&
    typeof position === "object" &&
    "x" in position &&
    "z" in position
  ) {
    const pos = position as { x: number; y?: number; z: number };
    return [pos.x, pos.y ?? 0, pos.z];
  }
  return null;
}

export const gameStateProvider: Provider = {
  name: "gameState",
  description:
    "Provides current player health, stamina, position, and combat status",
  dynamic: true,
  position: 1,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");

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

    const normalizedPosition = normalizePosition(playerEntity.position);
    const hasValidPosition = normalizedPosition !== null;

    const gameStateData: GameStateData = {
      health: playerEntity.health,
      stamina: playerEntity.stamina,
      position: normalizedPosition ?? [0, 0, 0],
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
    const isAlive = playerEntity.alive !== false && currentHealth > 0;

    let hpAlertLevel: "dead" | "critical" | "low" | "stable" = "stable";
    let hpAlert = "HP stable.";
    let hpAction = "Continue current objective.";

    if (!isAlive) {
      hpAlertLevel = "dead";
      hpAlert = "You are dead (HP is 0).";
      hpAction = "Respawn before attempting any other action.";
    } else if (healthPercent <= 25) {
      hpAlertLevel = "critical";
      hpAlert = `CRITICAL HP (${healthPercent}%).`;
      hpAction = "Emergency: eat immediately or flee immediately.";
    } else if (healthPercent <= 50) {
      hpAlertLevel = "low";
      hpAlert = `Low HP (${healthPercent}%).`;
      hpAction = "Eat now; if pressure continues, flee to survive.";
    }

    // Safe position string
    const positionStr = hasValidPosition
      ? `[${normalizedPosition[0].toFixed(1)}, ${normalizedPosition[1].toFixed(1)}, ${normalizedPosition[2].toFixed(1)}]`
      : "[loading...]";

    const text = `## Your Current State
- **Health**: ${currentHealth}/${maxHealth} HP (${healthPercent}%)
- **Stamina**: ${currentStamina}/${maxStamina} (${staminaPercent}%)
- **Position**: ${positionStr}
- **Status**: ${isAlive ? "Alive" : "Dead"}${playerEntity.inCombat ? `, In Combat with ${playerEntity.combatTarget}` : ""}
- **HP Alert**: ${hpAlert}
- **Immediate Action**: ${hpAction}`;

    return {
      text,
      values: {
        health: currentHealth,
        maxHealth,
        healthPercent,
        hpAlertLevel,
        hpAlert,
        hpImmediateAction: hpAction,
        needsImmediateSurvivalAction: hpAlertLevel === "critical",
        stamina: currentStamina,
        staminaPercent,
        inCombat: playerEntity.inCombat,
        alive: isAlive,
      },
      data: {
        hpAlertLevel,
        hpAlert,
        hpImmediateAction: hpAction,
        alive: isAlive,
      },
    };
  },
};
