/**
 * availableActionsProvider - Supplies context-aware available actions
 *
 * Provides:
 * - Actions the agent can perform based on current state
 * - Context about why certain actions are/aren't available
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

export const availableActionsProvider: Provider = {
  name: "availableActions",
  description:
    "Provides context-aware available actions based on current game state",
  dynamic: true,
  position: 6,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const playerEntity = service?.getPlayerEntity();
    const entities = service?.getNearbyEntities() || [];

    if (!playerEntity) {
      return {
        text: "Actions unavailable",
        values: {},
        data: {},
      };
    }

    const actions: string[] = [];

    // Movement is always available
    actions.push("MOVE_TO (move to a location)");

    // Combat actions
    if (!playerEntity.inCombat) {
      const npcs = entities.filter((e) => "mobType" in e);
      if (npcs.length > 0) {
        actions.push("ATTACK (start combat with an NPC)");
      }
    } else {
      actions.push("STOP_COMBAT (stop attacking current target)");
    }

    // Gathering actions based on nearby resources
    const resources = entities.filter((e) => "resourceType" in e);
    resources.forEach((resource) => {
      const resourceType = (resource as { resourceType: string }).resourceType;
      if (resourceType === "tree") {
        actions.push("CHOP_TREE (woodcutting)");
      } else if (resourceType === "fishing_spot") {
        actions.push("CATCH_FISH (fishing)");
      }
    });

    // Inventory actions
    if (playerEntity.items.length > 0) {
      actions.push("USE_ITEM (eat food, drink potion, etc.)");
      actions.push("EQUIP_ITEM (equip weapon or armor)");
      actions.push("DROP_ITEM (drop item from inventory)");
    }

    // Cooking/firemaking
    const hasTinderbox = playerEntity.items.some((item) =>
      item.name.toLowerCase().includes("tinderbox"),
    );
    const hasLogs = playerEntity.items.some((item) =>
      item.name.toLowerCase().includes("logs"),
    );
    if (hasTinderbox && hasLogs) {
      actions.push("LIGHT_FIRE (firemaking)");
    }

    const hasRawFood = playerEntity.items.some((item) =>
      item.name.toLowerCase().includes("raw"),
    );
    if (hasRawFood) {
      actions.push("COOK_FOOD (cooking)");
    }

    // Social actions
    const nearbyPlayers = entities.filter((e) => "playerName" in e);
    if (nearbyPlayers.length > 0) {
      actions.push("CHAT (send message to nearby players)");
    }

    const actionsList = actions.map((a) => `  - ${a}`).join("\n");

    const text = `## Available Actions

${actionsList}`;

    return {
      text,
      values: {
        actionCount: actions.length,
        canAttack:
          !playerEntity.inCombat && entities.some((e) => "mobType" in e),
        canGather: resources.length > 0,
        canCook: hasRawFood,
      },
      data: { actions },
    };
  },
};
