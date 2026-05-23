/**
 * Server-only loader for Hyperia's authored manifest files.
 *
 * Phase B0'.E of `PLAN_PROJECT_AS_DATA.md`. The Hyperia plugin's
 * `onEnable` calls this helper to populate the registries that
 * Hyperia gameplay systems read from. Today the engine's
 * `DataManager` ALSO loads these manifests at boot (legacy path),
 * so this loader runs idempotently on top — both paths populate
 * the same `globalThis`-pinned registries; the second `load(...)`
 * call wins.
 *
 * The follow-up cut removes `DataManager`'s Hyperia-specific loads
 * entirely so a project that doesn't install `@hyperforge/hyperscape`
 * sees an empty `worldAreasRegistry` (and friends), making blank
 * projects truly blank in PIE.
 *
 * First cut surface (this slice): just `world-areas.json`. NPCs,
 * quests, items, gathering catalogs, etc. follow the same pattern
 * in subsequent cuts.
 *
 * Sync filesystem reads are intentional — `onEnable` is sync today
 * and we don't want to make it async just to load a few JSON
 * files at boot.
 */

import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import { fileURLToPath } from "node:url";

import {
  biomesProvider,
  biomesRegistry,
  gatheringResources,
  npcDefinitionsRegistry,
  worldAreasProvider,
  worldAreasRegistry,
} from "@hyperforge/shared";
import {
  FishingManifestSchema,
  MiningManifestSchema,
  WoodcuttingManifestSchema,
} from "@hyperforge/manifest-schema";

/**
 * Module directory — works in both CJS (`__dirname`) and ESM
 * (`fileURLToPath(import.meta.url)`) contexts. Phase 2.2 Standalone
 * Launch surfaced the ESM gap: the asset-forge launcher spawns the
 * server with pure Node ESM, where `__dirname` and bare `require()`
 * are both undefined. `fileURLToPath` gives us the same answer in
 * both worlds.
 */
const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));

/**
 * Walk up from this module's directory looking for the workspace's
 * manifests directory. Mirrors the candidate-walk pattern in
 * `DataManager.loadManifestsFromFilesystem` so both paths agree on
 * where the files live.
 *
 * Returns the resolved manifests directory or null when not found.
 */
function findManifestsDir(): string | null {
  // Server-only guard — node fs APIs aren't available in the browser.
  if (typeof process === "undefined" || !process.versions?.node) {
    return null;
  }

  const path = nodePath;
  const fs = nodeFs;
  const startDir = MODULE_DIR;

  const candidates: string[] = [];
  // Walk up to 8 levels looking for `packages/server/world/assets/manifests`.
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    candidates.push(
      path.resolve(dir, "packages/server/world/assets/manifests"),
    );
    candidates.push(path.resolve(dir, "server/world/assets/manifests"));
    candidates.push(path.resolve(dir, "world/assets/manifests"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Also try cwd as a final fallback.
  candidates.push(
    path.resolve(process.cwd(), "packages/server/world/assets/manifests"),
  );

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Permission error or similar — try next candidate.
    }
  }
  return null;
}

/**
 * Load Hyperia's authored manifest files into their respective
 * registries. Called from `hyperscape-plugin`'s `onEnable` server
 * branch. Sync (uses `fs.readFileSync`).
 *
 * Best-effort: each per-manifest read is wrapped in try/catch so
 * a missing or malformed file doesn't kill the whole load. The
 * runtime side-effect is "registry stays empty" which is the same
 * shape DataManager produces on the same failure.
 */
export function loadHyperiaManifestsSync(): void {
  if (typeof process === "undefined" || !process.versions?.node) return;

  const path = nodePath;
  const fs = nodeFs;

  const manifestsDir = findManifestsDir();
  if (!manifestsDir) {
    console.warn(
      "[hyperscape-plugin] manifests dir not found; Hyperia onEnable load skipped",
    );
    return;
  }

  // Helper — read + parse + load. Best-effort: each per-manifest
  // failure is contained.
  const loadOne = (filename: string, apply: (raw: unknown) => void): void => {
    try {
      const filePath = path.join(manifestsDir, filename);
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
      apply(raw);
      // eslint-disable-next-line no-console
      console.log(`[hyperscape-plugin] loaded ${filename}`);
    } catch (err) {
      console.warn(
        `[hyperscape-plugin] ${filename} load failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  // world-areas.json — bounded regions Hyperia gameplay reads.
  loadOne("world-areas.json", (raw) => {
    const parsed = worldAreasProvider.loadRaw(raw);
    worldAreasRegistry.load(parsed);
  });

  // npcs.json — Hyperia's NPC catalog. The file is the canonical
  // NPC array; DataManager reads it as `Array<NPCDataInput>` and
  // normalizes in place. The registry's `load()` accepts the same
  // array shape, so we pass it through directly.
  //
  // (`npcsProvider` exists for the parallel `npc-spawn-constants`
  // manifest — different concern, not the NPC list.)
  loadOne("npcs.json", (raw) => {
    if (!Array.isArray(raw)) {
      throw new Error(`npcs.json: expected top-level array, got ${typeof raw}`);
    }
    npcDefinitionsRegistry.load(
      raw as unknown as Parameters<typeof npcDefinitionsRegistry.load>[0],
    );
  });

  // biomes.json — biome catalog (terrain difficulty + height tags).
  loadOne("biomes.json", (raw) => {
    const parsed = biomesProvider.loadRaw(raw);
    biomesRegistry.load(parsed);
  });

  // Gathering — per-skill manifests, each with its own schema.
  // The shared `gatheringResources` registry has dedicated load
  // methods per skill; mirror DataManager's path.
  loadOne("gathering/woodcutting.json", (raw) => {
    const parsed = WoodcuttingManifestSchema.parse(raw);
    gatheringResources.loadWoodcutting(parsed);
  });
  loadOne("gathering/mining.json", (raw) => {
    const parsed = MiningManifestSchema.parse(raw);
    gatheringResources.loadMining(parsed);
  });
  loadOne("gathering/fishing.json", (raw) => {
    const parsed = FishingManifestSchema.parse(raw);
    gatheringResources.loadFishing(parsed);
  });
}
