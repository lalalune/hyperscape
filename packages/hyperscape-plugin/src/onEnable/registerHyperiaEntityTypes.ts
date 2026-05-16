/**
 * `registerHyperiaEntityTypes` — ECS entity type registrations
 * for the Hyperia plugin.
 *
 * Extracted from `index.ts`'s `onEnable` per PLAN_AAA_MASTER_AUDIT
 * debt #3 (the hyperscape-plugin onEnable monolith). Pre-2026-04-26
 * the engine's entity registry hardcoded these in shared
 * `Entities.ts` — decoupled so `@hyperforge/shared` no longer
 * imports game classes.
 *
 * Order doesn't matter; lookup is by string key. Always called
 * unconditionally (entity types aren't gated on the Hyperia
 * content pack — they're available for studio / editor
 * introspection regardless of whether content packs spawn
 * instances).
 */

import { registerEntityType } from "@hyperforge/shared";

import { MobEntity } from "../entities/npc/MobEntity.js";
import { NPCEntity } from "../entities/npc/NPCEntity.js";
import { PlayerEntity } from "../entities/player/PlayerEntity.js";
import { PlayerLocal } from "../entities/player/PlayerLocal.js";
import { PlayerRemote } from "../entities/player/PlayerRemote.js";
import { AltarEntity } from "../entities/world/AltarEntity.js";
import { AnvilEntity } from "../entities/world/AnvilEntity.js";
import { BankEntity } from "../entities/world/BankEntity.js";
import { FurnaceEntity } from "../entities/world/FurnaceEntity.js";
import { HeadstoneEntity } from "../entities/world/HeadstoneEntity.js";
import { ItemEntity } from "../entities/world/ItemEntity.js";
import { RangeEntity } from "../entities/world/RangeEntity.js";
import { ResourceEntity } from "../entities/world/ResourceEntity.js";
import { RunecraftingAltarEntity } from "../entities/world/RunecraftingAltarEntity.js";

/**
 * Register every Hyperia ECS entity type on the engine's entity
 * registry. Order doesn't matter; lookup is by string key. New
 * entity types get added here.
 */
export function registerHyperiaEntityTypes(): void {
  registerEntityType("player", PlayerEntity as never);
  registerEntityType("playerLocal", PlayerLocal as never);
  registerEntityType("playerRemote", PlayerRemote as never);
  registerEntityType("item", ItemEntity as never);
  registerEntityType("mob", MobEntity as never);
  registerEntityType("npc", NPCEntity as never);
  registerEntityType("resource", ResourceEntity as never);
  registerEntityType("headstone", HeadstoneEntity as never);
  registerEntityType("bank", BankEntity as never);
  registerEntityType("furnace", FurnaceEntity as never);
  registerEntityType("anvil", AnvilEntity as never);
  registerEntityType("altar", AltarEntity as never);
  registerEntityType("range", RangeEntity as never);
  registerEntityType("runecrafting_altar", RunecraftingAltarEntity as never);
}
