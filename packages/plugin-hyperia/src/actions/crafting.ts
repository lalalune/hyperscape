/**
 * Crafting actions for ElizaOS agents
 *
 * SMELT_ORE - Smelt ore into bars at a furnace
 * SMITH_ITEM - Smith bars into weapons/armor at an anvil
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";
import type { Entity } from "../types.js";
import {
  hasOre,
  hasBars,
  hasLogs,
  hasKnife,
  hasHides,
  hasEssence,
} from "../utils/item-detection.js";
import { getRuneTypes } from "../utils/world-data.js";

function getDistance2D(
  posA: [number, number, number] | null | undefined,
  posB: [number, number, number] | null | undefined,
): number | null {
  if (!posA || !posB) return null;
  const dx = posA[0] - posB[0];
  const dz = posA[2] - posB[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function isFurnace(entity: Entity): boolean {
  const type = (entity.type || "").toLowerCase();
  const entityType = (entity.entityType || "").toLowerCase();
  const name = (entity.name || "").toLowerCase();
  return (
    type === "furnace" || entityType === "furnace" || name.includes("furnace")
  );
}

function isAnvil(entity: Entity): boolean {
  const type = (entity.type || "").toLowerCase();
  const entityType = (entity.entityType || "").toLowerCase();
  const name = (entity.name || "").toLowerCase();
  return type === "anvil" || entityType === "anvil" || name.includes("anvil");
}

function findNearestEntity(
  entities: Entity[],
  playerPos: [number, number, number],
  filter: (e: Entity) => boolean,
): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (const entity of entities) {
    if (!filter(entity)) continue;
    const dist = getDistance2D(playerPos, entity.position);
    if (dist !== null && dist < nearestDist) {
      nearest = entity;
      nearestDist = dist;
    }
  }

  return nearest;
}

function getSmeltableBar(
  items: Array<{ name?: string; itemId?: string }>,
): string | null {
  const itemNames = items.map((i) => (i.name || i.itemId || "").toLowerCase());
  const hasCopper = itemNames.some((n) => n.includes("copper"));
  const hasTin = itemNames.some((n) => n.includes("tin"));
  const hasIronOre = itemNames.some(
    (n) => n.includes("iron") && n.includes("ore"),
  );

  if (hasCopper && hasTin) return "bronze_bar";
  if (hasIronOre) return "iron_bar";
  return null;
}

function detectBarType(
  items: Array<{ name?: string; itemId?: string }>,
): string | null {
  for (const item of items) {
    const name = (item.name || item.itemId || "").toLowerCase();
    if (name.includes("bronze") && name.includes("bar")) return "bronze_bar";
    if (name.includes("iron") && name.includes("bar")) return "iron_bar";
    if (name.includes("steel") && name.includes("bar")) return "steel_bar";
    if (name.includes("mithril") && name.includes("bar")) return "mithril_bar";
  }
  return null;
}

function isTanner(entity: Entity): boolean {
  const n = (entity.name || "").toLowerCase();
  const t = (entity.entityType || "").toLowerCase();
  return n.includes("tanner") || t === "tanner";
}

function isRuneAltar(entity: Entity): boolean {
  const n = (entity.name || "").toLowerCase();
  return n.includes("altar") && n.includes("rune");
}

function detectFletchProduct(
  text: string,
  items: Array<{ name?: string; itemId?: string }>,
): string {
  if (text.includes("arrow")) return "arrow shafts";
  if (text.includes("longbow")) return "longbow";
  if (text.includes("shortbow")) return "shortbow";
  if (text.includes("crossbow")) return "crossbow";

  const logType = detectLogType(items);
  return logType ? `${logType} shortbow` : "shortbow";
}

function detectLogType(
  items: Array<{ name?: string; itemId?: string }>,
): string | null {
  for (const item of items) {
    const name = (item.name || item.itemId || "").toLowerCase();
    if (!name.includes("log")) continue;
    if (name.includes("yew")) return "yew";
    if (name.includes("maple")) return "maple";
    if (name.includes("willow")) return "willow";
    if (name.includes("oak")) return "oak";
    return "normal";
  }
  return null;
}

function detectHideType(
  items: Array<{ name?: string; itemId?: string }>,
): string {
  for (const item of items) {
    const name = (item.name || item.itemId || "").toLowerCase();
    if (name.includes("dragonhide") || name.includes("dragon hide"))
      return "dragonhide";
    if (name.includes("cowhide") || name.includes("cow hide"))
      return "cowhides";
    if (name.includes("hide")) return "hides";
  }
  return "hides";
}

function detectRuneType(text: string, altarName: string): string {
  // Use manifest-driven rune types with hardcoded fallback
  const manifestTypes = getRuneTypes();
  const runeTypes =
    manifestTypes.length > 0
      ? manifestTypes
      : ["air", "water", "earth", "fire", "mind", "body"];
  for (const rune of runeTypes) {
    if (text.includes(rune)) return rune;
  }
  const altarLower = altarName.toLowerCase();
  for (const rune of runeTypes) {
    if (altarLower.includes(rune)) return rune;
  }
  return "air";
}

export const smeltOreAction: Action = {
  name: "SMELT_ORE",
  similes: ["SMELT", "USE_FURNACE", "MAKE_BARS"],
  description:
    "Smelt ore into metal bars at a furnace. Requires ore in inventory and a nearby furnace.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position) return false;
    if (!hasOre(player)) return false;

    const nearbyEntities = service.getNearbyEntities();
    const furnace = findNearestEntity(
      nearbyEntities,
      player.position,
      isFurnace,
    );
    return furnace !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) return { success: false, error: "Service not available" };

      const player = service.getPlayerEntity();
      if (!player?.position)
        return { success: false, error: "No player position" };

      const nearbyEntities = service.getNearbyEntities();
      const furnace = findNearestEntity(
        nearbyEntities,
        player.position,
        isFurnace,
      );
      if (!furnace) {
        await callback?.({ text: "No furnace nearby.", action: "SMELT_ORE" });
        return { success: false, error: "No furnace nearby" };
      }

      const distance = getDistance2D(player.position, furnace.position);
      if (distance !== null && distance > 5) {
        await service.executeMove({ target: furnace.position, runMode: false });
        await new Promise((r) => setTimeout(r, 2000));
      }

      const barType = getSmeltableBar(player.items);
      if (!barType) {
        await callback?.({
          text: "I don't have the right combination of ores to smelt anything.",
          action: "SMELT_ORE",
        });
        return { success: false, error: "No valid ore combination" };
      }

      service.interactWithEntity(furnace.id, "smelt");

      const responseText = `Smelting ${barType.replace("_", " ")} at the furnace`;
      await callback?.({ text: responseText, action: "SMELT_ORE" });

      return {
        success: true,
        text: responseText,
        data: { action: "SMELT_ORE", barType, furnaceId: furnace.id },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[SMELT_ORE] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Smelt my ore into bars" } },
      {
        name: "agent",
        content: {
          text: "Smelting bronze bar at the furnace",
          action: "SMELT_ORE",
        },
      },
    ],
  ],
};

export const smithItemAction: Action = {
  name: "SMITH_ITEM",
  similes: ["SMITH", "USE_ANVIL", "FORGE_ITEM", "MAKE_WEAPON"],
  description:
    "Smith metal bars into weapons, armor, or tools at an anvil. Requires bars in inventory and a nearby anvil.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position) return false;
    if (!hasBars(player)) return false;

    const nearbyEntities = service.getNearbyEntities();
    const anvil = findNearestEntity(nearbyEntities, player.position, isAnvil);
    return anvil !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) return { success: false, error: "Service not available" };

      const player = service.getPlayerEntity();
      if (!player?.position)
        return { success: false, error: "No player position" };

      const nearbyEntities = service.getNearbyEntities();
      const anvil = findNearestEntity(nearbyEntities, player.position, isAnvil);
      if (!anvil) {
        await callback?.({ text: "No anvil nearby.", action: "SMITH_ITEM" });
        return { success: false, error: "No anvil nearby" };
      }

      const distance = getDistance2D(player.position, anvil.position);
      if (distance !== null && distance > 5) {
        await service.executeMove({ target: anvil.position, runMode: false });
        await new Promise((r) => setTimeout(r, 2000));
      }

      const barType = detectBarType(player.items);
      if (!barType) {
        await callback?.({
          text: "I don't have any metal bars to smith with.",
          action: "SMITH_ITEM",
        });
        return { success: false, error: "No bars in inventory" };
      }

      service.interactWithEntity(anvil.id, "smith");

      const metalName = barType.replace("_bar", "");
      const responseText = `Smithing ${metalName} equipment at the anvil`;
      await callback?.({ text: responseText, action: "SMITH_ITEM" });

      return {
        success: true,
        text: responseText,
        data: { action: "SMITH_ITEM", barType, anvilId: anvil.id },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[SMITH_ITEM] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Smith a bronze sword" } },
      {
        name: "agent",
        content: {
          text: "Smithing bronze equipment at the anvil",
          action: "SMITH_ITEM",
        },
      },
    ],
  ],
};

export const fletchItemAction: Action = {
  name: "FLETCH_ITEM",
  similes: ["FLETCH", "MAKE_BOW", "MAKE_ARROWS", "FLETCHING"],
  description:
    "Fletch logs into bows or arrow shafts, or string bows. Requires a knife and logs in inventory.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position) return false;
    if (!hasKnife(player)) return false;
    if (!hasLogs(player)) return false;

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) return { success: false, error: "Service not available" };

      const player = service.getPlayerEntity();
      if (!player?.position)
        return { success: false, error: "No player position" };

      if (!hasKnife(player)) {
        await callback?.({
          text: "I need a knife to fletch.",
          action: "FLETCH_ITEM",
        });
        return { success: false, error: "No knife in inventory" };
      }

      if (!hasLogs(player)) {
        await callback?.({
          text: "I don't have any logs to fletch.",
          action: "FLETCH_ITEM",
        });
        return { success: false, error: "No logs in inventory" };
      }

      const nearbyEntities = service.getNearbyEntities();
      const fletchingStation = findNearestEntity(
        nearbyEntities,
        player.position,
        (e) => {
          const n = (e.name || "").toLowerCase();
          return n.includes("fletch") || n.includes("workbench");
        },
      );

      if (fletchingStation) {
        const distance = getDistance2D(
          player.position,
          fletchingStation.position,
        );
        if (distance !== null && distance > 5) {
          await service.executeMove({
            target: fletchingStation.position,
            runMode: false,
          });
          await new Promise((r) => setTimeout(r, 2000));
        }
        service.interactWithEntity(fletchingStation.id, "fletch");
      }

      const text = (message.content.text || "").toLowerCase();
      const fletchProduct = detectFletchProduct(text, player.items);
      const responseText = `Fletching ${fletchProduct}`;
      await callback?.({ text: responseText, action: "FLETCH_ITEM" });

      return {
        success: true,
        text: responseText,
        data: {
          action: "FLETCH_ITEM",
          product: fletchProduct,
          stationId: fletchingStation?.id ?? null,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[FLETCH_ITEM] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Fletch some arrows" } },
      {
        name: "agent",
        content: { text: "Fletching arrow shafts", action: "FLETCH_ITEM" },
      },
    ],
    [
      { name: "user", content: { text: "Make a shortbow" } },
      {
        name: "agent",
        content: { text: "Fletching shortbow", action: "FLETCH_ITEM" },
      },
    ],
  ],
};

export const tanHideAction: Action = {
  name: "TAN_HIDE",
  similes: ["TAN", "TAN_LEATHER", "TANNING"],
  description:
    "Tan hides into leather at a tanner NPC. Requires coins and hides in inventory.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position) return false;
    if (!hasHides(player)) return false;

    const nearbyEntities = service.getNearbyEntities();
    const tanner = findNearestEntity(nearbyEntities, player.position, isTanner);
    return tanner !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) return { success: false, error: "Service not available" };

      const player = service.getPlayerEntity();
      if (!player?.position)
        return { success: false, error: "No player position" };

      if (!hasHides(player)) {
        await callback?.({
          text: "I don't have any hides to tan.",
          action: "TAN_HIDE",
        });
        return { success: false, error: "No hides in inventory" };
      }

      const nearbyEntities = service.getNearbyEntities();
      const tanner = findNearestEntity(
        nearbyEntities,
        player.position,
        isTanner,
      );
      if (!tanner) {
        await callback?.({
          text: "No tanner nearby.",
          action: "TAN_HIDE",
        });
        return { success: false, error: "No tanner nearby" };
      }

      const distance = getDistance2D(player.position, tanner.position);
      if (distance !== null && distance > 5) {
        await service.executeMove({ target: tanner.position, runMode: false });
        await new Promise((r) => setTimeout(r, 2000));
      }

      service.interactWithEntity(tanner.id, "tan");

      const hideType = detectHideType(player.items);
      const responseText = `Tanning ${hideType} into leather at the tanner`;
      await callback?.({ text: responseText, action: "TAN_HIDE" });

      return {
        success: true,
        text: responseText,
        data: { action: "TAN_HIDE", hideType, tannerId: tanner.id },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[TAN_HIDE] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Tan my cowhides" } },
      {
        name: "agent",
        content: {
          text: "Tanning cowhides into leather at the tanner",
          action: "TAN_HIDE",
        },
      },
    ],
  ],
};

export const runecraftAction: Action = {
  name: "RUNECRAFT",
  similes: ["CRAFT_RUNES", "MAKE_RUNES", "RUNECRAFTING"],
  description:
    "Convert essence into runes at a runecrafting altar. Requires rune or pure essence in inventory and a nearby altar.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position) return false;
    if (!hasEssence(player)) return false;

    const nearbyEntities = service.getNearbyEntities();
    const altar = findNearestEntity(
      nearbyEntities,
      player.position,
      isRuneAltar,
    );
    return altar !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) return { success: false, error: "Service not available" };

      const player = service.getPlayerEntity();
      if (!player?.position)
        return { success: false, error: "No player position" };

      if (!hasEssence(player)) {
        await callback?.({
          text: "I don't have any rune essence to craft with.",
          action: "RUNECRAFT",
        });
        return { success: false, error: "No essence in inventory" };
      }

      const nearbyEntities = service.getNearbyEntities();
      const altar = findNearestEntity(
        nearbyEntities,
        player.position,
        isRuneAltar,
      );
      if (!altar) {
        await callback?.({
          text: "No runecrafting altar nearby.",
          action: "RUNECRAFT",
        });
        return { success: false, error: "No altar nearby" };
      }

      const distance = getDistance2D(player.position, altar.position);
      if (distance !== null && distance > 5) {
        await service.executeMove({ target: altar.position, runMode: false });
        await new Promise((r) => setTimeout(r, 2000));
      }

      service.interactWithEntity(altar.id, "runecraft");

      const runeType = detectRuneType(
        (message.content.text || "").toLowerCase(),
        altar.name,
      );
      const responseText = `Crafting ${runeType} runes at the altar`;
      await callback?.({ text: responseText, action: "RUNECRAFT" });

      return {
        success: true,
        text: responseText,
        data: { action: "RUNECRAFT", runeType, altarId: altar.id },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[RUNECRAFT] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Craft some air runes" } },
      {
        name: "agent",
        content: {
          text: "Crafting air runes at the altar",
          action: "RUNECRAFT",
        },
      },
    ],
  ],
};

export const craftingActions = [
  smeltOreAction,
  smithItemAction,
  fletchItemAction,
  tanHideAction,
  runecraftAction,
];
