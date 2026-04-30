import { NpcDefinitionsRegistry } from "./NpcDefinitionsRegistry.js";

export {
  NpcDefinitionsNotLoadedError,
  NpcDefinitionsRegistry,
  UnknownNpcDefinitionError,
} from "./NpcDefinitionsRegistry.js";

/**
 * Module-level singleton. Mirrors the `damageTypeRegistry`,
 * `worldAreasRegistry`, `npcSizesRegistry`, `runesRegistry`,
 * `storesRegistry`, `skillIconsRegistry` patterns so
 * `PIEEditorSession.updateManifests({ npcDefinitions })` can
 * live-dispatch authored NPC catalog edits to the rich runtime
 * shape (combat stats, drops, services, dialogue, appearance).
 *
 * Used by `getNPCById(id)` in `data/npcs.ts` via the registry-
 * prefer-fallback pattern: when loaded, the registry wins; when
 * not, the legacy `ALL_NPCS` Map remains the source.
 *
 * Pinned to `globalThis` for the same reason `gatheringResources`
 * and `worldAreasRegistry` are — the server's esbuild bundle
 * inlines parts of `@hyperforge/shared` via relative-path reach-ins
 * from server/src, producing a duplicate registry instance separate
 * from the `@hyperforge/hyperscape` plugin's import. `DataManager`
 * writes NPCs into one instance and `MobNPCSpawnerSystem` reads
 * from the empty one, leading to "NPC X not found in npcs.json
 * manifest" warnings for every static NPC and zero spawn.
 */
const NPC_DEFINITIONS_REGISTRY_GLOBAL_KEY = Symbol.for(
  "@hyperforge/shared/npcDefinitionsRegistry",
);
type NpcDefinitionsRegistryGlobal = typeof globalThis & {
  [NPC_DEFINITIONS_REGISTRY_GLOBAL_KEY]?: NpcDefinitionsRegistry;
};
const _npcDefinitionsGlobal = globalThis as NpcDefinitionsRegistryGlobal;
if (!_npcDefinitionsGlobal[NPC_DEFINITIONS_REGISTRY_GLOBAL_KEY]) {
  _npcDefinitionsGlobal[NPC_DEFINITIONS_REGISTRY_GLOBAL_KEY] =
    new NpcDefinitionsRegistry();
}
export const npcDefinitionsRegistry: NpcDefinitionsRegistry =
  _npcDefinitionsGlobal[NPC_DEFINITIONS_REGISTRY_GLOBAL_KEY]!;
