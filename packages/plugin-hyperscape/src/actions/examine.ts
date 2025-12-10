/**
 * Examine actions - EXAMINE_ENTITY, EXAMINE_INVENTORY_ITEM
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
 * EXAMINE_ENTITY - Examine an entity to get more information
 */
export const examineEntityAction: Action = {
  name: "EXAMINE_ENTITY",
  similes: ["EXAMINE", "INSPECT", "LOOK_AT", "CHECK"],
  description: "Examine an entity (item, NPC, resource) to get more information about it.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    return player?.alive !== false;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { entityId?: string; entityName?: string },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const content = message.content.text || "";
    const entities = service.getNearbyEntities();

    // Find entity by ID, name from options, or from message content
    let target: Entity | undefined;

    if (options?.entityId) {
      target = entities.find((e) => e.id === options.entityId);
    } else if (options?.entityName) {
      target = entities.find((e) =>
        e.name?.toLowerCase().includes(options.entityName?.toLowerCase() || ""),
      );
    } else {
      target = entities.find((e) =>
        e.name?.toLowerCase().includes(content.toLowerCase()),
      );
    }

    if (!target) {
      await callback?.({ text: "Entity not found nearby.", error: true });
      return { success: false, error: new Error("Entity not found") };
    }

    // Build examination result
    const entityAny = target as unknown as Record<string, unknown>;
    const examineLines: string[] = [`=== ${target.name} ===`];

    if ("mobType" in target) {
      examineLines.push(`Type: ${entityAny.mobType}`);
      if (entityAny.level) examineLines.push(`Level: ${entityAny.level}`);
      examineLines.push(`Status: ${entityAny.alive !== false ? "Alive" : "Dead"}`);
    } else if ("resourceType" in target) {
      examineLines.push(`Resource: ${entityAny.resourceType}`);
    } else if (target.name?.startsWith("item:")) {
      examineLines.push(`Ground item: ${target.name.replace("item:", "")}`);
    } else if ("npcType" in target || entityAny.type === "npc") {
      examineLines.push(`NPC`);
      if (entityAny.examine) examineLines.push(`${entityAny.examine}`);
    }

    if (target.position) {
      const [x, , z] = target.position;
      examineLines.push(`Position: [${x.toFixed(0)}, ${z.toFixed(0)}]`);
    }

    const examineText = examineLines.join("\n");
    logger.info(`[EXAMINE_ENTITY] ${examineText}`);

    await callback?.({
      text: examineText,
      action: "EXAMINE_ENTITY",
    });

    return {
      success: true,
      text: examineText,
      data: { action: "EXAMINE_ENTITY", entityId: target.id, entityName: target.name },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Examine the goblin" } },
      {
        name: "agent",
        content: {
          text: "=== Goblin ===\nType: goblin\nLevel: 5\nStatus: Alive",
          action: "EXAMINE_ENTITY",
        },
      },
    ],
    [
      { name: "user", content: { text: "Inspect the oak tree" } },
      {
        name: "agent",
        content: {
          text: "=== Oak Tree ===\nResource: tree",
          action: "EXAMINE_ENTITY",
        },
      },
    ],
  ],
};

/**
 * EXAMINE_INVENTORY_ITEM - Examine an item in inventory
 */
export const examineInventoryItemAction: Action = {
  name: "EXAMINE_INVENTORY_ITEM",
  similes: ["EXAMINE_ITEM", "INSPECT_ITEM", "CHECK_ITEM"],
  description: "Examine an item in your inventory to get more information.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    return player?.alive !== false && (player?.items?.length ?? 0) > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { itemId?: string; itemName?: string },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const player = service.getPlayerEntity();
    const content = message.content.text || "";

    // Find item in inventory
    let item = player?.items.find((i) => i.id === options?.itemId);
    if (!item && options?.itemName) {
      item = player?.items.find((i) =>
        i.name.toLowerCase().includes(options.itemName?.toLowerCase() || ""),
      );
    }
    if (!item) {
      item = player?.items.find((i) =>
        i.name.toLowerCase().includes(content.toLowerCase()),
      );
    }

    if (!item) {
      await callback?.({ text: "Item not found in inventory.", error: true });
      return { success: false, error: new Error("Item not found") };
    }

    const examineText = item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name;
    logger.info(`[EXAMINE_INVENTORY_ITEM] ${examineText}`);

    await callback?.({
      text: examineText,
      action: "EXAMINE_INVENTORY_ITEM",
    });

    return {
      success: true,
      text: examineText,
      data: { action: "EXAMINE_INVENTORY_ITEM", itemId: item.id, itemName: item.name },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Examine my sword" } },
      {
        name: "agent",
        content: {
          text: "Bronze Sword",
          action: "EXAMINE_INVENTORY_ITEM",
        },
      },
    ],
  ],
};

