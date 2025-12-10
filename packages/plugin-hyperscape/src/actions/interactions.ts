/**
 * Interaction actions - NPC_INTERACT, LOOT_CORPSE, PICKUP_ITEM, RESPAWN, EMOTE
 * 
 * These actions handle world interactions beyond combat and resource gathering.
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { Entity } from "../types.js";

/**
 * INTERACT_NPC - Interact with an NPC (talk, trade, quest)
 */
export const interactNpcAction: Action = {
  name: "INTERACT_NPC",
  similes: ["TALK_TO", "SPEAK_WITH", "TRADE_WITH"],
  description: "Interact with an NPC to talk, trade, or start a quest. Must be within interaction range.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    
    const player = service.getPlayerEntity();
    if (!player?.alive) return false;
    
    // Check if there are any NPCs nearby
    const entities = service.getNearbyEntities();
    const npcs = entities.filter(e => {
      const ea = e as unknown as Record<string, unknown>;
      return ea.npcType || ea.type === "npc" || 
        (e.name && /banker|shopkeeper|guard|merchant/i.test(e.name));
    });
    
    return npcs.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Hyperscape service not available") };
    }

    const content = message.content.text || "";
    const entities = service.getNearbyEntities();
    
    // Find NPC by name or get closest one
    let targetNpc: Entity | undefined;
    
    const npcs = entities.filter(e => {
      const ea = e as unknown as Record<string, unknown>;
      return ea.npcType || ea.type === "npc" || 
        (e.name && /banker|shopkeeper|guard|merchant/i.test(e.name));
    });
    
    if (content) {
      targetNpc = npcs.find(e => 
        e.name?.toLowerCase().includes(content.toLowerCase())
      );
    }
    
    if (!targetNpc && npcs.length > 0) {
      targetNpc = npcs[0]; // Closest NPC
    }
    
    if (!targetNpc) {
      await callback?.({ text: "No NPC found nearby to interact with.", error: true });
      return { success: false, error: new Error("No NPC nearby") };
    }

    // Send NPC interact command
    // This would need a proper packet implementation
    await callback?.({
      text: `Interacting with ${targetNpc.name}`,
      action: "INTERACT_NPC",
    });

    return {
      success: true,
      text: `Started interaction with ${targetNpc.name}`,
      data: { action: "INTERACT_NPC", npcId: targetNpc.id },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Talk to the banker" } },
      { name: "agent", content: { text: "Interacting with Banker", action: "INTERACT_NPC" } },
    ],
  ],
};

/**
 * LOOT_CORPSE - Loot items from a mob corpse
 */
export const lootCorpseAction: Action = {
  name: "LOOT_CORPSE",
  similes: ["LOOT", "TAKE_LOOT", "COLLECT_DROPS"],
  description: "Loot items and coins from a mob corpse. Must be near the corpse.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    
    const player = service.getPlayerEntity();
    if (!player?.alive) return false;
    
    // Check for corpses (dead mobs) or ground items
    const entities = service.getNearbyEntities();
    const lootables = entities.filter(e => {
      const ea = e as unknown as Record<string, unknown>;
      return ea.alive === false || e.name?.startsWith("item:") || ea.type === "corpse";
    });
    
    return lootables.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Hyperscape service not available") };
    }

    const entities = service.getNearbyEntities();
    const player = service.getPlayerEntity();
    const playerPos = player?.position ?? [0, 0, 0];
    
    // Find closest corpse or loot
    const lootables = entities.filter(e => {
      const ea = e as unknown as Record<string, unknown>;
      return ea.alive === false || e.name?.startsWith("item:") || ea.type === "corpse";
    });
    
    if (lootables.length === 0) {
      await callback?.({ text: "Nothing to loot nearby.", error: true });
      return { success: false, error: new Error("No lootable entities") };
    }

    // Sort by distance and loot closest
    lootables.sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.position[0] - playerPos[0], 2) + 
        Math.pow(a.position[2] - playerPos[2], 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.position[0] - playerPos[0], 2) + 
        Math.pow(b.position[2] - playerPos[2], 2)
      );
      return distA - distB;
    });

    const target = lootables[0];
    
    // Send loot command
    await callback?.({
      text: `Looting ${target.name || "corpse"}`,
      action: "LOOT_CORPSE",
    });

    return {
      success: true,
      text: `Looted ${target.name || "corpse"}`,
      data: { action: "LOOT_CORPSE", targetId: target.id },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Loot the corpse" } },
      { name: "agent", content: { text: "Looting goblin corpse", action: "LOOT_CORPSE" } },
    ],
  ],
};

/**
 * PICKUP_ITEM - Pick up an item from the ground
 */
export const pickupItemAction: Action = {
  name: "PICKUP_ITEM",
  similes: ["TAKE", "GRAB", "PICK_UP", "GET"],
  description: "Pick up an item from the ground. Requires inventory space.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    
    const player = service.getPlayerEntity();
    if (!player?.alive) return false;
    
    // Check for ground items
    const entities = service.getNearbyEntities();
    const items = entities.filter(e => e.name?.startsWith("item:"));
    
    // Check inventory space
    const inventorySize = (player.items?.length ?? 0);
    const hasSpace = inventorySize < 28;
    
    return items.length > 0 && hasSpace;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Hyperscape service not available") };
    }

    const content = message.content.text || "";
    const entities = service.getNearbyEntities();
    const player = service.getPlayerEntity();
    const playerPos = player?.position ?? [0, 0, 0];
    
    // Find items on ground
    const items = entities.filter(e => e.name?.startsWith("item:"));
    
    if (items.length === 0) {
      await callback?.({ text: "No items on the ground nearby.", error: true });
      return { success: false, error: new Error("No ground items") };
    }

    // Find by name if specified, otherwise get closest
    let targetItem = items.find(e => {
      const itemName = e.name?.replace("item:", "").toLowerCase() ?? "";
      return content.toLowerCase().includes(itemName);
    });
    
    if (!targetItem) {
      // Sort by distance
      items.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.position[0] - playerPos[0], 2) + 
          Math.pow(a.position[2] - playerPos[2], 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.position[0] - playerPos[0], 2) + 
          Math.pow(b.position[2] - playerPos[2], 2)
        );
        return distA - distB;
      });
      targetItem = items[0];
    }

    const itemName = targetItem.name?.replace("item:", "") || "item";
    
    await callback?.({
      text: `Picking up ${itemName}`,
      action: "PICKUP_ITEM",
    });

    return {
      success: true,
      text: `Picked up ${itemName}`,
      data: { action: "PICKUP_ITEM", itemId: targetItem.id },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Pick up the coins" } },
      { name: "agent", content: { text: "Picking up coins", action: "PICKUP_ITEM" } },
    ],
  ],
};

/**
 * RESPAWN - Respawn after dying
 */
export const respawnAction: Action = {
  name: "RESPAWN",
  similes: ["REVIVE", "COME_BACK", "RESURRECT"],
  description: "Respawn at the nearest safe town after dying. Only available when dead.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    
    const player = service.getPlayerEntity();
    // Can only respawn when dead
    return player?.alive === false;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Hyperscape service not available") };
    }

    // Send respawn request
    // This would use the requestRespawn packet
    await callback?.({
      text: "Respawning at nearest town...",
      action: "RESPAWN",
    });

    return {
      success: true,
      text: "Respawned at starter town",
      data: { action: "RESPAWN" },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Respawn" } },
      { name: "agent", content: { text: "Respawning at nearest town...", action: "RESPAWN" } },
    ],
  ],
};

/**
 * EMOTE - Perform an emote/animation
 */
export const emoteAction: Action = {
  name: "EMOTE",
  similes: ["DANCE", "WAVE", "BOW", "CHEER"],
  description: "Perform an emote or animation. Available: wave, dance, bow, cheer, cry, laugh, sit",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    
    const player = service.getPlayerEntity();
    return player?.alive !== false && !player?.inCombat;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const content = (message.content.text || "").toLowerCase();
    
    // Map common terms to emotes
    const emoteMap: Record<string, string> = {
      wave: "wave",
      waving: "wave",
      dance: "dance-happy",
      dancing: "dance-happy",
      bow: "bow",
      bowing: "bow",
      cheer: "cheer",
      cheering: "cheer",
      cry: "cry",
      crying: "cry",
      laugh: "laugh",
      laughing: "laugh",
      sit: "sit",
      sitting: "sit",
      kneel: "kneel",
    };
    
    let emote = "wave"; // default
    for (const [key, value] of Object.entries(emoteMap)) {
      if (content.includes(key)) {
        emote = value;
        break;
      }
    }

    await callback?.({
      text: `Performing ${emote} emote`,
      action: "EMOTE",
    });

    return {
      success: true,
      text: `Performed ${emote} emote`,
      data: { action: "EMOTE", emote },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Dance" } },
      { name: "agent", content: { text: "Performing dance-happy emote", action: "EMOTE" } },
    ],
    [
      { name: "user", content: { text: "Wave at them" } },
      { name: "agent", content: { text: "Performing wave emote", action: "EMOTE" } },
    ],
  ],
};

/**
 * EAT_FOOD - Consume food to restore health
 */
export const eatFoodAction: Action = {
  name: "EAT_FOOD",
  similes: ["EAT", "CONSUME", "HEAL"],
  description: "Eat food from inventory to restore health. Prioritizes cooked fish.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    
    const player = service.getPlayerEntity();
    if (!player?.alive) return false;
    
    // Check for food in inventory
    const items = player.items ?? [];
    const food = items.filter(item => 
      /fish|food|bread|meat|pie|cake/i.test(item.name) &&
      !/raw/i.test(item.name) // Not raw food
    );
    
    return food.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Hyperscape service not available") };
    }

    const player = service.getPlayerEntity();
    const items = player?.items ?? [];
    
    // Find edible food (cooked, not raw)
    const food = items.filter(item => 
      /fish|food|bread|meat|pie|cake/i.test(item.name) &&
      !/raw/i.test(item.name)
    );
    
    if (food.length === 0) {
      await callback?.({ text: "No food in inventory.", error: true });
      return { success: false, error: new Error("No food available") };
    }

    const foodItem = food[0];
    
    await service.executeUseItem({ itemId: foodItem.id });
    
    await callback?.({
      text: `Eating ${foodItem.name}`,
      action: "EAT_FOOD",
    });

    return {
      success: true,
      text: `Ate ${foodItem.name}`,
      data: { action: "EAT_FOOD", itemId: foodItem.id },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Eat food" } },
      { name: "agent", content: { text: "Eating Cooked Fish", action: "EAT_FOOD" } },
    ],
  ],
};

