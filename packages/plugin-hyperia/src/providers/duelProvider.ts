import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";

export const duelProvider: Provider = {
  name: "duel",
  description: "Provides context about active duels and the opponent",
  dynamic: true,
  position: 2,

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

    if (!playerEntity || !playerEntity.inCombat) {
      return {
        text: "You are not currently in a duel.",
        values: { inDuel: false },
        data: {},
      };
    }

    // Attempt to find the target's name
    const targetId = playerEntity.combatTarget;
    let targetName = targetId || "Unknown Opponent";

    if (targetId) {
      const nearby = service.getNearbyEntities();
      const targetEntity = nearby.find((e) => e.id === targetId);
      if (targetEntity && targetEntity.name) {
        targetName = targetEntity.name;
      }
    }

    const text = `
## Active Duel Strategy
You are currently engaged in a life-or-death duel!
Your objective: You MUST WIN by defeating ${targetName}!
Focus all your actions on combat strategy, healing, and winning this fight!
`;

    return {
      text,
      values: {
        inDuel: true,
        opponentId: targetId,
        opponentName: targetName,
      },
      data: {
        opponentName: targetName,
      },
    };
  },
};
