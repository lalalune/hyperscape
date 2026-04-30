/**
 * Static entity-type contributions per known plugin — Layer B
 * source-of-truth read by `LIST_ENTITY_TYPES`.
 *
 * **Authoritative declaration**: each plugin's `plugin.json`
 * `contributions.entityTypes` array. The Hyperscape plugin
 * declares its 15 types there; this module mirrors that data so
 * the agent server (which doesn't import the plugin's runtime
 * package) can resolve types without a network round-trip.
 *
 * Two-way sync is enforced by the test
 * `entityTypeContributions.sync.test.ts` — when `plugin.json`
 * gains/loses an entity type, the test fails until this map is
 * updated. When a runtime plugin-registry endpoint exists this
 * module is the natural place to swap to a fetch-and-cache
 * implementation.
 *
 * Mirrors the pattern in `listPlugins.ts` where `_BUILTIN_PLUGIN_LIST`
 * is the static catalog of known plugin metadata.
 */

import type { EntityTypeContribution } from "@hyperforge/manifest-schema";

/**
 * Map of plugin manifest id → entity types its runtime systems
 * handle. Plugin ids are the manifest ids (`com.hyperforge.x`)
 * not npm names.
 */
export const _PLUGIN_ENTITY_TYPES: Record<
  string,
  ReadonlyArray<EntityTypeContribution>
> = {
  // ─── Hyperia (RPG / tile-based MMORPG) ─────────────────────────
  "com.hyperforge.hyperscape": [
    // ── NPCs ──
    {
      kind: "npc",
      type: "shopkeeper",
      description:
        "Opens a store UI on click. Reads `storeId` to look up the store catalog.",
      requiredFields: ["storeId"],
      acceptedAssetTypes: ["character"],
    },
    {
      kind: "npc",
      type: "questgiver",
      description:
        "Offers quests on dialogue. Quest mappings are authored separately via PROPOSE_QUEST.",
      requiredFields: [],
      acceptedAssetTypes: ["character"],
    },
    {
      kind: "npc",
      type: "banker",
      description: "Opens the bank UI on click. Stores items per-account.",
      requiredFields: [],
      acceptedAssetTypes: ["character"],
    },
    {
      kind: "npc",
      type: "guard",
      description:
        "Neutral or hostile patrolling NPC. Does not interact unless attacked.",
      requiredFields: [],
      acceptedAssetTypes: ["character"],
    },
    {
      kind: "npc",
      type: "trainer",
      description:
        "Skill trainer dialogue NPC — speaks about a specific skill.",
      requiredFields: [],
      acceptedAssetTypes: ["character"],
    },

    // ── Mob Spawns (combat creatures) ──
    {
      kind: "mobSpawn",
      type: "mob",
      description:
        "Generic combat creature spawn. Engaged by player attacks; respawns on the manifest's `respawnTicks` cadence.",
      requiredFields: [],
      acceptedAssetTypes: ["creature"],
    },
    {
      kind: "mobSpawn",
      type: "aggressive",
      description:
        "Hostile mob that attacks the player on sight within aggro range.",
      requiredFields: [],
      acceptedAssetTypes: ["creature"],
    },
    {
      kind: "mobSpawn",
      type: "passive",
      description:
        "Mob that only retaliates if attacked first. Useful for ambient flavor.",
      requiredFields: [],
      acceptedAssetTypes: ["creature"],
    },

    // ── Resources (gathering) ──
    {
      kind: "resource",
      type: "tree",
      description:
        "Woodcutting target. Yields logs based on the woodcutting skill manifest.",
      requiredFields: [],
      acceptedAssetTypes: ["prop"],
    },
    {
      kind: "resource",
      type: "rock",
      description:
        "Mining target. Yields ores based on the mining skill manifest.",
      requiredFields: [],
      acceptedAssetTypes: ["prop"],
    },
    {
      kind: "resource",
      type: "fishing_spot",
      description:
        "Fishing target. Yields fish based on the fishing skill manifest.",
      requiredFields: [],
      acceptedAssetTypes: ["prop"],
    },

    // ── Stations (interactable workstations) ──
    {
      kind: "station",
      type: "anvil",
      description:
        "Smithing station. Player uses metal bars + a hammer to forge weapons/armor.",
      requiredFields: [],
      acceptedAssetTypes: ["prop"],
    },
    {
      kind: "station",
      type: "furnace",
      description: "Smelting station. Converts ore + coal into metal bars.",
      requiredFields: [],
      acceptedAssetTypes: ["prop"],
    },
    {
      kind: "station",
      type: "range",
      description:
        "Cooking station. Converts raw food into edible food (heals when consumed).",
      requiredFields: [],
      acceptedAssetTypes: ["prop"],
    },
    {
      kind: "station",
      type: "bank",
      description:
        "Banking deposit/withdraw station. Same UI as the banker NPC but a static prop.",
      requiredFields: [],
      acceptedAssetTypes: ["prop"],
    },
  ],

  // ─── Shooter Demo ──────────────────────────────────────────────
  "com.hyperforge.plugin-shooter-demo": [
    {
      kind: "mobSpawn",
      type: "target_dummy",
      description:
        "Static enemy that absorbs hits and returns damage numbers. No movement or counterattack.",
      requiredFields: [],
      acceptedAssetTypes: ["creature", "prop"],
    },
  ],
};

/**
 * Return the union of entity-type contributions across the
 * installed plugin id list. Unknown plugin ids are silently
 * dropped — keeps the catalog forward-compat with new plugins
 * that haven't yet registered their entity types here.
 */
export function getEntityTypesForPlugins(
  installedPluginIds: ReadonlyArray<string>,
): ReadonlyArray<{
  pluginId: string;
  contribution: EntityTypeContribution;
}> {
  const out: Array<{
    pluginId: string;
    contribution: EntityTypeContribution;
  }> = [];
  for (const id of installedPluginIds) {
    const list = _PLUGIN_ENTITY_TYPES[id];
    if (!list) continue;
    for (const contribution of list) {
      out.push({ pluginId: id, contribution });
    }
  }
  return out;
}
