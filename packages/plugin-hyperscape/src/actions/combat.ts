/**
 * Combat actions - ATTACK_ENTITY, CHANGE_COMBAT_STYLE, EAT_FOOD
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type {
  AttackEntityCommand,
  UseItemCommand,
  CombatStyle,
} from "../types.js";

export const attackEntityAction: Action = {
  name: "ATTACK_ENTITY",
  similes: ["ATTACK", "FIGHT", "COMBAT"],
  description: "Attack a mob or NPC. Must have attackable targets nearby.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    if (
      !service.isConnected() ||
      !playerEntity?.alive ||
      playerEntity.inCombat
    ) {
      return false;
    }

    // Check for attackable mobs nearby
    const entities = service.getNearbyEntities();
    const attackableMobs = entities.filter((e) => {
      const ea = e as unknown as Record<string, unknown>;
      return "mobType" in e && ea.alive !== false;
    });

    return attackableMobs.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const entities = service.getNearbyEntities();
      const content = message.content.text || "";

      const targetEntity = entities.find(
        (e) =>
          e.name?.toLowerCase().includes(content.toLowerCase()) &&
          "mobType" in e,
      );

      if (!targetEntity) {
        await callback?.({
          text: "Could not find that NPC nearby.",
          error: true,
        });
        return {
          success: false,
          error: new Error(
            "return { success: false, error: 'Target not found' };",
          ),
        };
      }

      const command: AttackEntityCommand = { targetEntityId: targetEntity.id };
      await service.executeAttack(command);

      await callback?.({
        text: `Attacking ${targetEntity.name}`,
        action: "ATTACK_ENTITY",
      });

      return {
        success: true,
        text: `Started attacking ${targetEntity.name}`,
        data: { action: "ATTACK_ENTITY" },
      };
    } catch (error) {
      await callback?.({
        text: `Failed to attack: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Attack the goblin" } },
      {
        name: "agent",
        content: { text: "Attacking Goblin", action: "ATTACK_ENTITY" },
      },
    ],
  ],
};

export const changeCombatStyleAction: Action = {
  name: "CHANGE_COMBAT_STYLE",
  similes: ["COMBAT_STYLE", "ATTACK_STYLE"],
  description: "Change combat style: attack, strength, defense, or ranged.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    return service.isConnected();
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const content = (message.content.text || "").toLowerCase();
      let style: CombatStyle = "attack";

      if (content.includes("strength")) style = "strength";
      else if (content.includes("defense")) style = "defense";
      else if (content.includes("ranged")) style = "ranged";

      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      await service.executeAttack({ targetEntityId: "", combatStyle: style });

      await callback?.({
        text: `Changed combat style to ${style}`,
        action: "CHANGE_COMBAT_STYLE",
      });

      return { success: true, text: `Combat style set to ${style}` };
    } catch (error) {
      await callback?.({
        text: `Failed to change style: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Use strength style" } },
      {
        name: "agent",
        content: {
          text: "Changed combat style to strength",
          action: "CHANGE_COMBAT_STYLE",
        },
      },
    ],
  ],
};
