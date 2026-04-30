export {
  GatheringResourcesRegistry,
  type HarvestSkill,
  UnknownResourceError,
} from "./GatheringResourcesRegistry.js";

import { GatheringResourcesRegistry } from "./GatheringResourcesRegistry.js";

/**
 * Process-wide singleton. `DataManager` writes to it at load time;
 * other systems read from it. Exists alongside the legacy
 * `globalThis.EXTERNAL_RESOURCES` map during the wiring migration.
 *
 * Pinned to `globalThis` via `Symbol.for(...)` so all module
 * instances see the same registry. Without this pin, the server's
 * esbuild bundle (which inlines parts of `@hyperforge/shared` via
 * relative-path reach-ins from server/src) ends up with a separate
 * `GatheringResourcesRegistry` from the `@hyperforge/hyperscape`
 * plugin's import — `DataManager` writes trees into one instance
 * and `ResourceSystem` reads from the empty one, causing every tree
 * spawn to log "No manifest entry for tree_*" and skip placement.
 * Same dual-singleton bug that was fixed for `EntityTypes` in commit
 * `f436a9175`.
 */
const GATHERING_RESOURCES_GLOBAL_KEY = Symbol.for(
  "@hyperforge/shared/gatheringResources",
);
type GatheringResourcesGlobal = typeof globalThis & {
  [GATHERING_RESOURCES_GLOBAL_KEY]?: GatheringResourcesRegistry;
};
const _gatheringGlobal = globalThis as GatheringResourcesGlobal;
if (!_gatheringGlobal[GATHERING_RESOURCES_GLOBAL_KEY]) {
  _gatheringGlobal[GATHERING_RESOURCES_GLOBAL_KEY] =
    new GatheringResourcesRegistry();
}
export const gatheringResources: GatheringResourcesRegistry =
  _gatheringGlobal[GATHERING_RESOURCES_GLOBAL_KEY]!;
