/**
 * World Context Provider
 *
 * Provides rich semantic descriptions of the game world to the agent,
 * enabling intelligent decision-making based on environmental context.
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import {
  determineArea,
  getPlayerStatus,
  categorizeEntities,
  generateSceneDescription,
} from "../shared/game-helpers.js";

export const worldContextProvider: Provider = {
  name: "worldContext",
  description:
    "Provides semantic world context including location, threats, and opportunities",
  dynamic: true,
  position: 0,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");

    if (!service?.isConnected()) {
      return {
        text: "World Context: Not connected to game server.",
        values: {},
        data: {},
      };
    }

    const player = service.getPlayerEntity();
    if (!player) {
      return {
        text: "World Context: Waiting to spawn in world...",
        values: {},
        data: {},
      };
    }

    const entities = service.getNearbyEntities();
    const status = getPlayerStatus(player);
    const location = determineArea(player.position ?? [0, 0, 0]);
    const categorized = categorizeEntities(
      entities,
      player.position ?? [0, 0, 0],
      player.id,
      status.combatLevel,
    );

    // Generate scene description using shared helper
    const contextText = generateSceneDescription(player, entities, {
      includeStatus: true,
      includeSuggestions: true,
    });

    return {
      text: contextText,
      values: {
        location: location.name,
        healthPercent: status.health.percent,
        staminaPercent: status.stamina.percent,
        inCombat: status.inCombat,
        nearbyMobs: categorized.mobs.length,
        nearbyResources: categorized.resources.length,
        nearbyItems: categorized.items.length,
      },
      data: {
        location,
        player: {
          health: status.health,
          stamina: status.stamina,
          position: status.position,
          inCombat: status.inCombat,
          alive: status.alive,
          combatLevel: status.combatLevel,
        },
        entityCounts: {
          mobs: categorized.mobs.length,
          resources: categorized.resources.length,
          items: categorized.items.length,
          players: categorized.players.length,
        },
      },
    };
  },
};
