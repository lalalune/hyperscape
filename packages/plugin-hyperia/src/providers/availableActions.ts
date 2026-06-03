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
import type { HyperiaService } from "../services/HyperiaService.js";
import type { Entity, InventoryItem } from "../types.js";

function addAction(actions: string[], action: string): void {
  if (!actions.includes(action)) {
    actions.push(action);
  }
}

function isMobEntity(entity: Entity): boolean {
  if (entity.mobType) return true;
  const type = (entity.type || entity.entityType || "").toLowerCase();
  if (type === "mob") return true;
  const name = entity.name?.toLowerCase() || "";
  return /goblin|bandit|skeleton|zombie|rat|spider|wolf/i.test(name);
}

function isResourceEntity(entity: Entity): boolean {
  if (entity.resourceType) return true;
  const type = (entity.type || entity.entityType || "").toLowerCase();
  return type === "resource";
}

function getInventoryItemName(item: InventoryItem): string {
  return (item.name || item.item?.name || item.itemId || item.id || "")
    .toString()
    .toLowerCase();
}

export const availableActionsProvider: Provider = {
  name: "availableActions",
  description:
    "Provides context-aware available actions based on current game state",
  dynamic: true,
  position: 6,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    const playerEntity = service?.getPlayerEntity();
    const entities = service?.getNearbyEntities() || [];

    if (!playerEntity) {
      return {
        text: "Actions unavailable",
        values: {},
        data: {},
      };
    }
    const inventoryItems = Array.isArray(playerEntity.items)
      ? playerEntity.items
      : [];

    const actions: string[] = [];
    const nearbyMobs = entities.filter(isMobEntity);
    const resources = entities.filter(isResourceEntity);

    // Movement is always available
    addAction(actions, "MOVE_TO (move to a location)");

    // Combat actions
    if (!playerEntity.inCombat) {
      if (nearbyMobs.length > 0) {
        addAction(actions, "ATTACK_ENTITY (start combat with a nearby mob)");
      }
    } else {
      addAction(actions, "ATTACK_ENTITY (continue or re-target during combat)");
      addAction(actions, "FLEE (disengage when combat is unsafe)");
    }

    // Gathering actions based on nearby resources
    const hasTrees = resources.some((resource) => {
      const resourceType = (resource.resourceType || "").toLowerCase();
      const name = (resource.name || "").toLowerCase();
      return resourceType === "tree" || name.includes("tree");
    });
    const hasFishingSpots = resources.some((resource) => {
      const resourceType = (resource.resourceType || "").toLowerCase();
      const name = (resource.name || "").toLowerCase();
      return resourceType === "fishing_spot" || name.includes("fishing spot");
    });
    const hasMiningRocks = resources.some((resource) => {
      const resourceType = (resource.resourceType || "").toLowerCase();
      const name = (resource.name || "").toLowerCase();
      return (
        resourceType === "mining_rock" ||
        resourceType === "ore" ||
        name.includes("rock") ||
        name.includes("ore")
      );
    });
    if (hasTrees) addAction(actions, "CHOP_TREE (woodcutting)");
    if (hasFishingSpots) addAction(actions, "CATCH_FISH (fishing)");
    if (hasMiningRocks) addAction(actions, "MINE_ROCK (mining)");

    // Inventory actions
    if (inventoryItems.length > 0) {
      addAction(actions, "USE_ITEM (eat food, drink potion, etc.)");
      addAction(actions, "EQUIP_ITEM (equip weapon or armor)");
      addAction(actions, "DROP_ITEM (drop item from inventory)");
    }

    // Cooking/firemaking
    const hasTinderbox = inventoryItems.some((item) =>
      getInventoryItemName(item).includes("tinderbox"),
    );
    const hasLogs = inventoryItems.some((item) =>
      getInventoryItemName(item).includes("log"),
    );
    if (hasTinderbox && hasLogs) {
      addAction(actions, "LIGHT_FIRE (firemaking)");
    }

    const hasRawFood = inventoryItems.some((item) => {
      const name = getInventoryItemName(item);
      return name.includes("raw");
    });
    if (hasRawFood) {
      addAction(actions, "COOK_FOOD (cooking)");
    }

    // Social actions
    const nearbyPlayers = entities.filter((entity) => {
      const type = (entity.type || entity.entityType || "").toLowerCase();
      return type === "player" || !!entity.playerName;
    });
    if (nearbyPlayers.length > 0) {
      addAction(actions, "CHAT_MESSAGE (send message to nearby players)");
    }

    const actionsList = actions.map((a) => `  - ${a}`).join("\n");

    const text = `## Available Actions

${actionsList}`;

    return {
      text,
      values: {
        actionCount: actions.length,
        canAttack: !playerEntity.inCombat && nearbyMobs.length > 0,
        canGather: resources.length > 0,
        canCook: hasRawFood,
      },
      data: { actions },
    };
  },
};
