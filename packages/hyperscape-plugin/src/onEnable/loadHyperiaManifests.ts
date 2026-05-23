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
 * Module-private holders for the Node-only deps. Populated lazily on
 * first server call via `loadNodeDeps()` so static imports of
 * `node:fs` / `node:path` / `node:url` never appear at parse time —
 * critical because this file is also imported by the asset-forge
 * frontend bundle (Vite), which externalizes any `node:*` static
 * import and crashes the browser entry.
 */
type NodeDeps = {
  fs: typeof import("node:fs");
  path: typeof import("node:path");
  moduleDir: string;
};
let _nodeDeps: NodeDeps | null = null;

/**
 * Pull `node:fs` / `node:path` / `node:url.fileURLToPath` at runtime
 * via a Function-constructor-built dynamic require. The Function
 * constructor body is opaque to Vite's static analyzer, so the
 * externalization step doesn't trip on the literal `"node:*"`
 * strings; the browser never executes the body because the typeof
 * `process` guard short-circuits first.
 *
 * Phase 2.2 Standalone Launch (in pure Node ESM) needs this to work;
 * the asset-forge frontend (Vite browser bundle) needs it to never
 * be executed. Lazy + opaque solves both.
 */
function loadNodeDeps(): NodeDeps | null {
  if (_nodeDeps) return _nodeDeps;
  if (typeof process === "undefined" || !process.versions?.node) return null;
  try {
    // Function constructor — bundlers can't statically analyze the
    // body. Uses globalThis.require (CJS) or
    // node:module.createRequire (ESM) to manufacture a runtime
    // `require` that works in either world.
    const getRequire = new Function(`
      if (typeof require === "function") return require;
      // ESM path — createRequire from node:module. node:module is a
      // builtin and resolvable via createRequire's bootstrap.
      // eslint-disable-next-line global-require
      const { createRequire: cr } = globalThis.process.getBuiltinModule
        ? globalThis.process.getBuiltinModule("node:module")
        : globalThis.process.binding
          ? null
          : null;
      if (cr) {
        // Use any local file URL — createRequire just needs a base
        // for relative resolution, and we always pass absolute
        // "node:*" specifiers.
        return cr("file://" + globalThis.process.cwd() + "/__loader__.js");
      }
      return null;
    `) as () => ((id: string) => unknown) | null;
    const req = getRequire();
    if (!req) return null;

    const fs = req("node:fs") as typeof import("node:fs");
    const path = req("node:path") as typeof import("node:path");
    const url = req("node:url") as typeof import("node:url");

    // Module dir works in both worlds: CJS has __dirname; ESM gets it
    // via fileURLToPath(import.meta.url). When import.meta isn't
    // available (CJS interop), fall back to process.cwd().
    let moduleDir = "";
    try {
      // import.meta.url is syntactically only valid in ESM modules,
      // but this file IS ESM-compiled, so this is fine at the source
      // level. Vite still leaves it alone because we're in a regular
      // function body.
      moduleDir = url.fileURLToPath(new URL(".", import.meta.url));
    } catch {
      moduleDir = process.cwd();
    }

    _nodeDeps = { fs, path, moduleDir };
    return _nodeDeps;
  } catch (err) {
    console.warn("[hyperscape-plugin] loadNodeDeps failed:", err);
    return null;
  }
}

/**
 * Walk up from this module's directory looking for the workspace's
 * manifests directory. Mirrors the candidate-walk pattern in
 * `DataManager.loadManifestsFromFilesystem` so both paths agree on
 * where the files live.
 *
 * Returns the resolved manifests directory or null when not found.
 */
function findManifestsDir(): string | null {
  const deps = loadNodeDeps();
  if (!deps) return null;
  const { fs, path, moduleDir } = deps;
  const startDir = moduleDir;

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
  const deps = loadNodeDeps();
  if (!deps) return;
  const { fs, path } = deps;

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
