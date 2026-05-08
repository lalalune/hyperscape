# PLAN_AAA_MASTER_AUDIT — Honest super-audit + path to AAA quality

**Status:** 2026-05-07 · live execution doc
**Branch:** `feat/world-studio` · tip at audit: `c4536cf3b`
**Predecessor:** `PLAN_MASTER.md` (still authoritative for sequencing prior work)
**Author:** super-audit synthesis from 3 parallel deep-dive code audits

---

## North star (unchanged from PLAN_MASTER)

A **Project** is data — `{ config, plugins, worldContent }`. User describes
a game in chat for ~5 minutes; AI composes from published content packs
+ plugins; the result is **a game distinct from Hyperia, even when it
uses Hyperia building blocks**. Strict catalog discipline (agent only
uses what packs ship). Composable: tropical pack + hyperscape plugin =
arctic survival with combat. Templates are bookmarks, not enforcement.

The promise: **"AI builds games."** Not "AI composes a HUD."

## Where we actually are (post super-audit, brutally honest)

**Realistic AAA %: 62–68%.** PLAN_MASTER said 78–82% on 2026-05-01. Six
days of progress on Phase D + the C4 first cut were necessary but
revealed two layers of debt the prior audit didn't fully grade:

1. **Terrain rendering pipeline is pre-AAA by 2 quality tiers.** The
   white-island bug is fixed but masks deeper issues: the procgen path
   never populates `query.color` (still works via fallback in
   `lookupBiomeColor`, but the architectural shape is wrong).
   `BiomeSystem.getBiomeInfluencesAtPosition` does an O(N) linear scan
   over biome centers per vertex with no spatial index — this is the
   smoking gun for the user's 2 FPS regression that my last 4 commits
   didn't fix. The `useVertexColorBase` flag is set at material-init
   and never recomputed when content packs change mid-session, so a
   user installing a tropical pack after the editor mounts still pays
   for 9 unused texture samples per fragment. `TileBasedTerrain.tsx`
   is a 5,130-line monolith with 154 hooks managing 12+ orthogonal
   concerns.

2. **State and orchestration fragmentation in the editor.**
   `DesignWithAIDialog.tsx` is 4,596 lines owning chat + pack fetch +
   theme resolution + procgen orchestration + project creation, with
   23 useState declarations. `WorldStudioCompanion` duplicates 16+
   PROPOSE_* dispatch branches the dialog also implements. Quests and
   zones still live in a parallel `agentWorldContent` store while
   placements live in `extendedLayers` — dual rehydration on project
   load, dual persistence paths, two sources of truth.

3. **Manifest-as-documentation gap is wider than PLAN_MASTER reported.**
   Of the 7 plugin contribution fields, only `entityTypes` is wired
   end-to-end (R2.P10). The other 6 (`systems`, `entities`, `widgets`,
   `manifestSchemas`, `paletteCategories`, `toolbarTools`, `commands`)
   are validated, snapshotted to debug UI, and never read at runtime.
   The pattern to wire them is proven; the work has not been executed.

4. **Engine still self-identifies as Hyperia.** `Player.hyperiaPlayerId`
   is required (`externalAccountId` was added but the migration is
   incomplete), `BiomeType` enum is hardcoded to 3 values, error
   classes carry the `Hyperia` prefix, the engine's index.ts header
   says "Hyperia 3D multiplayer game engine."

5. **Server-side plugin composition is unimplemented.** `bootServerPlugins`
   accepts a parameter but never threads `project.plugins` through
   server startup. Every server boots an identical plugin set
   regardless of which project is being played. R3.P11's first cut
   (commit `44d2ede2f`) added the resolver but didn't wire the caller.

## Audit scoring (1–10) — three clusters

### Cluster A — Terrain rendering pipeline

| Dimension | Score | Notes |
|---|---|---|
| Production code quality | 6 | Comments are good; 5,130-line file is the structural smell |
| Memory & allocation hygiene | 7 | Pooling pattern in places; per-tile alloc churn for typed arrays during LOD swap |
| TypeScript rigor | 7 | No implicit any; `biomeForestWeight?` optionals leak 3-channel everywhere |
| Rendering & GPU hygiene | 6 | Material shared (good); not reactively recompiled (bad); no explicit dispose on unmount |
| **Performance** | **3** | **2 FPS user-visible. BiomeSystem linear scan is the unfixed killer.** |
| SOLID + GRASP | 5 | Single Responsibility shredded by the monolith |
| Clean code | 6 | Names are decent (`tW/fW/cW` cryptic); functions OK; the file is too long to navigate |
| Game programming patterns | 7 | Object pool present; flyweight absent; spatial partition only at tile granularity |
| Data-oriented design | 5 | Vertex attrs are interleaved correctly; biome centers are AoS not SoA |
| Manifest-driven data architecture | 5 | Registry exists; hardcoded `biomeForestWeight` attr leaks through 73 sites |

**Cluster A overall: 5.5 / 10 (AA-minus).**

### Cluster B — Project lifecycle + AI dialog + content registry

| Dimension | Score | Notes |
|---|---|---|
| Production code quality | 6 | Inconsistent error handling; some async paths swallow failures silently |
| Best practices (DRY/KISS/YAGNI) | 5 | Dialog and Companion mirror 8+ dispatch paths; no shared dispatcher |
| SOLID + GRASP | 5 | DesignWithAIDialog owns chat + pack + procgen + create-project (4 concerns) |
| Clean code | 7 | Names are clear; functions reasonable; structure scales poorly |
| Law of Demeter | 6 | Property panels reach 4 levels deep; companion accesses `state.extendedLayers[key]` repeatedly |
| TypeScript rigor | 7 | No `any`; reducer discriminated unions are clean |
| UI framework integration | 6 | Refs used appropriately for camera; world-gen in setTimeout is a code smell |
| **State management** | **4** | **Quests/zones in agentWorldContent + placements in extendedLayers = two stores** |
| Manifest-driven data architecture | 6 | Registry well-designed; called twice on load (pre-procgen + post-creation); no validation on ingestion |
| Code organization | 5 | DesignWithAIDialog at 4,596 lines is the structural smell |

**Cluster B overall: 5.7 / 10 (AA-minus).**

### Cluster C — Plugin contributions + boot + content packs + server authority

| Dimension | Score | Notes |
|---|---|---|
| SOLID + GRASP | 6 | PluginRegistryService and PluginCatalogService are duplicate state; no SSOT |
| **Plugin contribution architecture** | **4** | **6 of 7 fields snapshot-only; manifest is documentation, not substrate** |
| Manifest-driven data architecture | 7 | Schemas are clean; runtime consumption gap is the issue |
| Server authority | 8 | Strict catalog discipline enforced; placement validators reject fake refs |
| API design | 7 | REST shape consistent; endpoints reasonable; `/api/plugins/contributions` is dead code |
| TypeScript rigor | 7 | Manifest schemas Zod-typed; system prompts are inline strings (no schema) |
| Production code quality | 6 | hyperscape-plugin onEnable is 2,353 lines |
| Data integrity | 7 | FK present in entity tables; `world_projects.asset_packs` is unvalidated string array |
| **Persistence & PostgreSQL** | **7** | **Migrations 0011–0012 thrashed; otherwise clean** |
| Distributed systems | 4 | Tick-based (good); per-project plugin composition unimplemented (bad); rate-limit in-memory |
| Engine genericness | 3 | Player.hyperiaPlayerId required; BiomeType hardcoded; HyperiaError class names |

**Cluster C overall: 6.0 / 10 (AA).**

### Aggregate

**Overall AAA score: 5.7 / 10 (AA-minus).** Up from where we were
~6 months ago, down from PLAN_MASTER's optimistic 78–82%. The drop
isn't regression; it's the deeper audit revealing what wasn't graded
strictly enough before.

## Critical blockers (must fix before AAA)

These are the blocking issues. Each must be closed; no partial credit.

| # | Issue | Cluster | Severity | Estimated Effort |
|---|---|---|---|---|
| 1 | **BiomeSystem O(N) per-vertex scan** — 256B comparisons per regen at 50×50 grid × 100×100 tiles × 32×32 verts. Fixes the 2 FPS regression. | A | CRITICAL | 3–5 days |
| 2 | **`useVertexColorBase` not reactive** — material doesn't recompile when content pack installed mid-session. | A | CRITICAL | 1 day |
| 3 | **TileBasedTerrain.tsx 5,130-line monolith** — blocks every refactor; 154 hooks; 12 concerns. | A | CRITICAL | 3–4 weeks |
| 4 | **DesignWithAIDialog.tsx 4,596-line monolith** — owns chat + pack + procgen + create-project. | B | CRITICAL | 2 weeks |
| 5 | **Quest/zone state fragmentation** — dual store (agentWorldContent vs extendedLayers). | B | HIGH | 1–1.5 weeks |
| 6 | **6 of 7 plugin contribution fields not runtime-read** — manifest-as-documentation gap. | C | HIGH | 5–8 days (apply R2.P10 pattern × 6) |
| 7 | **Engine self-identifies as Hyperia** — Player.hyperiaPlayerId, BiomeType enum, HyperiaError. | C | HIGH | 1 week (R2.P12 completion) |
| 8 | **Server `bootServerPlugins` ignores `project.plugins`** — all servers boot identical plugin set. | C | HIGH | 3 days (R3.P11 completion) |
| 9 | **Tile inspector shows "Biome: unknown"** — hardcoded string fallback in 2 places. | A,B | MEDIUM | 1 day |
| 10 | **Double `setContentPackContent` mutation on load** — pre-procgen in dialog + post-creation in loader. Race condition risk. | B | MEDIUM | 2 days |
| 11 | **3-biome attribute hardcodes leak through 73 sites** — `biomeForestWeight`/`biomeCanyonWeight` in shader, helpers, grass manager, game adapter. | A | HIGH | 1–2 weeks (N-channel rewrite) |
| 12 | **GrassWorker / TerrainWorker / QuadChunkWorker have hardcoded 3-biome blends + bake Hyperia configs** | A | HIGH | 1 week |
| 13 | **In-memory rate limiter** — resets on server restart; anti-cheat bypass window opens. | C | MEDIUM | 3 days (move to DB or Redis) |
| 14 | **Combat damage authority unverified** — server-side calc not confirmed audited. | C | HIGH | 1 week to audit + fix any client-trust |
| 15 | **No spatial index for tile streaming neighbors** — full-radius scan per camera move. | A | MEDIUM | 3 days |

## Progress log (revised through 2026-05-08)

The original audit estimated 12-16 weeks. Substantial progress
has been made; what's actually shipped:

| Phase | Status | Commits |
|---|---|---|
| **0.1** — BiomeSystem perf hot path | ✅ done | `cc74be34c` |
| **0.2** — Reactive material on registry mutation | ✅ done | `b3fd003fa` |
| **0.3** — `query.color` unification | ✅ done | `7fe20caf7` |
| **2.1** CPU — N-channel attribute foundation | ✅ done | `3b1ee7b04` |
| **2.1** Shader — N-channel splatmap consumer | ✅ done | `dfd81c53f` |
| **3.1** — All 7 plugin contribution fields wired | ✅ done | `a3f8355fc` `62efd334e` `9103c9dd7` |
| **3.2** Engine error/Object3D rename | ✅ done | `a9be4fdd4` |
| **3.2** Plugin monolith first cut | ✅ done | `a9f116ae0` |
| **3.3** — Server R3.P11 plumbs content packs | ✅ done | `6640dc17d` |
| **1.1** carve 1 — `useStandaloneSky` | ✅ done | `ffd26ae88` |
| **1.1** carve 2 — `useGameFog` | ✅ done | `4b7bc41eb` |
| **1.1** carve 3 — `useShadowsCSM` | ✅ done | `f3fe7e041` |
| **1.1** carve 4 — `setupTerrainLighting` | ✅ done | `7106b11ad` |
| **1.1** remaining carves — water, brush, foliage state, town/road overlays, tile streamer | ⏸ pending | est. 2-3 weeks |
| **1.2** — DesignWithAIDialog split | ⏸ not started | est. 2 weeks |
| **2.1 follow-up** — GrassWorker / QuadChunkWorker N-channel | ⏸ not started | est. 1 week |
| **3.1 editor consumers** — ContentBrowser/MainToolbar reading registry | ⏸ not started | est. 3 days |
| **3.2 deeper** — Drop `Player.hyperiaPlayerId`, `BiomeType` enum | ⏸ partial | est. 1 week |
| **5** — AAA acceptance demo (second non-Hyperia plugin) | ⏸ not started | est. 2 weeks |

**Effort remaining**: ~6-8 weeks of focused engineering. Down
from the original 12-16-week estimate. Phase 0 / 2.1 / 3.1 /
3.3 are fully closed; Phase 1.1 has 4/12 carves done; Phase 3.2
has the small wins done (renames, plugin monolith first cut).

The biggest remaining unblockers:
- **Tile streamer extraction** (~1000 lines of `TileBasedTerrain.tsx`,
  the heart of the file — needs its own focused multi-day session).
- **DesignWithAIDialog split** (4,596 lines, parallel to 1.1
  pattern but on a different file).
- **AAA acceptance demo** — proves the framework end-to-end with
  a second non-Hyperia plugin.

## Master plan — 6-phase sequencing to AAA

**Total estimated effort (original): 12–16 focused engineering weeks.**
**Effort remaining as of 2026-05-08: ~6-8 weeks.** Ordered by user
impact and unblocks-other-work value.

### Phase 0 — Stop the bleed (1 week, blocking)

The user is currently looking at a 2 FPS viewport and 5-min terrain
load. Until this is fixed, no other work matters because the user
can't validate anything visually.

- **0.1** — `BiomeSystem` spatial index. Add quadtree (or grid hash
  keyed by `floor(x / cellSize), floor(z / cellSize)`) over biome
  centers. Replace `getBiomeInfluencesAtPosition` linear scan with
  O(log N) nearest-K lookup. **Expected:** 2 FPS → 30+ FPS for
  themed projects with many biome centers.
  - File: `packages/procgen/src/terrain/BiomeSystem.ts:38–227`
  - Effort: 3–5 days

- **0.2** — Reactive material recompilation. Add `hyperiaContentEnabledRef.current`
  to the createTerrainMaterial effect's dep chain (or watch via
  subscribeContentRegistry). Recreate material when project's content
  pack composition changes. **Expected:** mid-session pack installation
  no longer pays for unused texture samples.
  - File: `packages/asset-forge/src/components/WorldBuilder/TileBasedTerrain.tsx:2251`
  - Effort: 1 day

- **0.3** — Drop the dead `query.color` codepath in `terrainHelpers.ts`.
  Either populate `color` in `TerrainGenerator.queryPoint()` properly
  (preferred — single source) or remove the `if (query.color)` branch.
  **Expected:** Tile inspector shows real biome ids, not "unknown".
  - Files: `packages/procgen/src/terrain/TerrainGenerator.ts:546–573`,
    `packages/asset-forge/src/components/WorldBuilder/terrainHelpers.ts:697–706`
  - Effort: 1 day

- **0.4** — Add startup beacon + biome-color-cache instrumentation log.
  Diagnostic only — gives the user (and us) a definitive signal that
  the new perf-fixed code is loading.
  - Effort: ½ day; remove after Phase 0 ships

**Phase 0 acceptance test:** load tropical project, see 60+ FPS in
viewport, ~30s first-paint for 10k tiles, biome names render
correctly in outliner + inspector.

### Phase 1 — Decompose monoliths (3–4 weeks, unblocks rest)

The two monoliths (TileBasedTerrain.tsx, DesignWithAIDialog.tsx) are
blocking every refactor. This phase splits them.

- **1.1** — Split `TileBasedTerrain.tsx` into 6 components + custom
  hooks:
  - `<TerrainSceneRoot />` — composes the others
  - `useTileStreamer` — camera-tracked load/unload + LOD queue
  - `useTerrainMeshes` — mesh creation + material lifecycle
  - `<WaterRenderer />` — water material + uniforms + animations
  - `<GrassRenderer />` — delegates to EditorGrassManager (already exists)
  - `<FoliageRenderer />` — delegates to FoliageManager (already exists)
  - `<BrushOverlay />` — selection, outline, query-on-click
  - `<SkyAndShadows />` — sun, sky, fog, shadow camera
  - **Expected:** Each file under 500 lines; concerns testable in
    isolation; future content-pack work is bounded edits.
  - Effort: 3–4 weeks (one focused session)

- **1.2** — Split `DesignWithAIDialog.tsx`:
  - Extract `useDesignAIChat()` — chat loop, plan accumulation,
    SSE streaming
  - Extract `useThemePackResolution(packIds)` — fetch installable
    packs, resolve heightmap preset, vegetation overrides,
    asset-pack deps; return `{ heightmapPresetParams, vegByBiome,
    declaredAssetDeps, registryAccumulator }`
  - Extract `runFirstOpenProcgen(plan, packs)` — assemble config,
    register registry, run procgen, return worldData (no project
    creation side effects)
  - Extract `createWorldStudioProject({ teamId, gameId, plan,
    worldData })` — server orchestration only
  - Dialog becomes ~500 lines: render UI, call hooks, dispatch
  - **Effort:** 2 weeks

- **1.3** — Extract shared `applyAgentProposal(action)` dispatcher
  used by BOTH dialog and companion. Single source of dispatch
  logic; one call site to add a new PROPOSE_* action.
  - **Effort:** 3 days

**Phase 1 acceptance test:** every component < 500 lines, every hook
single-responsibility, dialog and companion share one dispatcher.

### Phase 2 — N-channel terrain proper (2 weeks)

Replace the 3-channel `biomeForestWeight`/`biomeCanyonWeight` hardcode
across the rendering pipeline with N-channel splatmap-style attributes.
This is the proper AAA fix from the prior thread; pre-Phase-1 it
would have been impossible to ship without breaking other concerns
in TileBasedTerrain.

- **2.1** — New per-vertex attribute schema: `biomeIndices: vec4<u8>`
  + `biomeWeights: vec4<f32>` (top-4 biomes per vertex). Update
  `terrainHelpers.generateTileGeometry` to compute top-4 weights from
  `query.biomeInfluences`. Update TSL shader to read attributes and
  blend N biome colors via uniform palette array.
  - **Effort:** 1 week

- **2.2** — Apply same N-channel pattern to `GrassWorker`,
  `QuadChunkWorker`, `TerrainWorker`. Drop the hardcoded
  `BT_TUNDRA / BT_FOREST / BT_CANYON` constants.
  - **Effort:** 4 days

- **2.3** — Re-enable grass for non-Hyperia projects (currently gated
  off in commit `79a5f1a3c`) once N-channel grass works.
  - **Effort:** 1 day

**Phase 2 acceptance test:** add a 7-biome content pack; all 7
biomes render with their authored colors at native FPS, with grass.

### Phase 3 — Substrate completeness (4 weeks)

Close the manifest-as-documentation gap. Wire the remaining 6 plugin
contribution fields. Eliminate engine Hyperia identifiers.

- **3.1** — R2.P10 pattern × 6:
  - `systems` → contribution route → catalog service → server boot
  - `widgets` → bindAllWidgets reads manifest contributions
  - `commands` → command palette reads manifest contributions
  - `paletteCategories` → ContentBrowser reads manifest
  - `toolbarTools` → MainToolbar reads registry
  - `manifestSchemas` → schema registry reads contributions
  - **Effort:** 5–8 days (1–1.5 days per field)

- **3.2** — R2.P12 engine decoupling:
  - `Player.hyperiaPlayerId` → `Player.externalAccountId` (canonical),
    drop deprecated alias after 1-cut migration window
  - `BiomeType` enum → drop entirely; biome ids are strings sourced
    from registry
  - `HyperiaError`, `PlayerError`, `ItemError` → `EngineError`,
    `EntityError` (or kept-but-renamed)
  - Engine `index.ts` header "Hyperia 3D multiplayer game engine" →
    "HyperForge 3D multiplayer game engine"
  - Drop dead `HyperiaObject3D` type
  - **Effort:** 1 week

- **3.3** — R3.P11 completion:
  - Server `bootServerPlugins` reads `project.plugins` from request
    context; boots only the project's declared plugins
  - Per-project tick processor uses project-scoped plugin set
  - **Effort:** 3 days

- **3.4** — Eliminate duplicate `GAME_BIOME_DEFINITIONS` between
  `GameTerrainAdapter.ts` (client) and `GameWorldContext.ts`
  (server). Single source: `getActiveBiomeDefinitions(...)` reads
  from registry; engine constant becomes `{}` (genuinely blank).
  - **Effort:** 2 days

- **3.5** — Procgen 18-tree-preset registry: `procgen/src/params/
  presets.ts` constants move into `@hyperforge/content-pack-hyperia-v1`;
  procgen reads recipes from registry.
  - **Effort:** 4 days

**Phase 3 acceptance test:** drop the `@hyperforge/hyperscape` plugin
from a project, install only `@hyperforge/content-pack-arctic-v1` —
the engine boots, world renders arctic biomes, no Hyperia content
appears anywhere.

### Phase 4 — Production hardening (2 weeks)

Server, security, persistence, anti-cheat hardening. Required before
multi-player public launch but not before Phase 5 acceptance demo.

- **4.1** — Move rate limiter to persistent storage (Postgres or Redis
  if available). Survives server restart.
  - **Effort:** 3 days

- **4.2** — Combat authority audit. Walk every damage / hit
  registration / loot drop path in CombatSystem; confirm server is
  the source of truth for every value. Flag any client-trusted state.
  - **Effort:** 1 week

- **4.3** — Idempotency universal. Every transaction handler
  (store, bank, trade, inventory) calls IdempotencyService before DB
  write. Audit + add where missing.
  - **Effort:** 3 days

- **4.4** — Tick-rate constants. Export `SERVER_TICK_MS = 600` from
  `@hyperforge/shared` and reference from every site that hardcodes
  the value.
  - **Effort:** 1 day

- **4.5** — Connection pool tuning. Configure for expected concurrency,
  add slow-query logging, query timeouts. Document the operational
  parameters.
  - **Effort:** 2 days

- **4.6** — JWT secret rotation procedure. Document in deployment
  runbook. Validate `.env` files in CI to flag weak secrets.
  - **Effort:** 1 day

### Phase 5 — AAA acceptance demo (2 weeks)

The demo that proves the framework promise. PLAN_MASTER's R5.

- **5.1** — Author second non-Hyperia plugin: `@hyperforge/plugin-tropical-sandbox`
  (or `plugin-arctic-survival`). Contributes systems (combat
  variants, survival mechanics), entityTypes, widgets. ~3 days.
  - **Effort:** 3–4 days

- **5.2** — Author second non-Hyperia content pack expansion. The
  current `@hyperforge/content-pack-tropical-v1` ships biomes but
  not vegetation species or terrain shaders. Add them.
  - **Effort:** 2–3 days

- **5.3** — Worked-example demo session. Record a 5-minute video:
  "AI builds a tropical pirate sandbox." User describes, agent
  composes, project ships, user plays. Multi-player test with 4
  concurrent connections.
  - **Effort:** 2 days

- **5.4** — Multi-pack composition test. Single project: tropical
  content pack + hyperscape plugin + arctic content pack. Both
  biome sets registered; renderer shows both; agent can place
  entities from both. Documents the composition rules in practice.
  - **Effort:** 2 days

**Phase 5 acceptance:** demo video shows a non-Hyperia game built
end-to-end through the framework. Two distinct games coexist as
forked projects from the same engine.

## Three architectural debts that warrant special attention

These don't fit cleanly in any single phase but compound across
multiple phases.

### Debt #1 — The `agentWorldContent` / `extendedLayers` split

Quests and zones live in one store, placements in another. Two
rehydration paths on project load. Two persistence functions
(`setAndPersistAgentQuest`, reducer `addNPC` → autosave). This
fragmentation increases the surface area of every state change.

**Fix path:** Phase 1.2 / 1.3. When extracting the unified
dispatcher, route ALL agent placements through the reducer. Add
`PlacedQuest` and `PlacedZone` shapes to `extendedLayers`. Drop
`agentWorldContent` after migration window.

### Debt #2 — The PluginRegistryService / PluginCatalogService duplication

Two services, one for each side (asset-forge editor uses `PluginRegistryService`,
agent uses `PluginCatalogService`). Both maintain plugin state. Drift
risk. Some logic (transitive deps, manifest validation) is duplicated.

**Fix path:** consolidate into a single service in `manifest-schema`
package that both sides import. Move the disk-scan code to a
plugin-discovery utility shared by both. Phase 3.1 (R2.P10 broader
work) folds this naturally.

### Debt #3 — The hyperscape-plugin onEnable monolith (2,353 lines)

A single function registering all Hyperia gameplay systems
imperatively. Hard to read, hard to test, hard to gate. Recent commit
`5226d8ae1` gates 7 systems on the Hyperia content pack — but the
gating logic is buried in the middle of the function. Adding a new
gate requires editing this one giant block.

**Fix path:** modularize into `registerCombatSystems(ctx)`,
`registerSkillsSystems(ctx)`, `registerHyperiaContentSystems(ctx)`,
`registerHyperiaWorldSystems(ctx)`. Each function takes the context
and the gate flag. Top-level onEnable becomes a 30-line orchestrator.
Phase 3.1 (R2.P10) is the natural carrier.

## What's already AAA (don't break these)

These are genuine wins. Don't accidentally regress them in later phases.

1. **Manifest schema package (`@hyperforge/manifest-schema`)** — Zod
   schemas, clean type derivation, comprehensive coverage of pack +
   plugin shapes. 1,861 tests passing. Genuinely framework-grade.

2. **Strict catalog discipline.** Server-side validators reject any
   placement without a real pack-resolved model. Agent gets structured
   error feedback. Catalog enforcement is genuine.

3. **Plugin discovery (R2.P2 + R3.P11 first cuts).** STATIC_PLUGIN_MAP
   keyed by manifest id. Disk scan via `PluginRegistryService`. Both
   client (PIE) and server use the same pattern. Adding a plugin is
   manifest-only.

4. **Content pack auto-bootstrap on server boot.** UE5 Engine/-folder
   pattern. Six themed packs land automatically. Idempotent. Clean.

5. **Reducer + extendedLayers + autosave.** The studio editor's state
   discipline is solid (when you stay in `extendedLayers`). Reducer
   actions are typed, dispatchers are clean, autosave handles
   persistence atomically.

6. **Geometry pooling in TileBasedTerrain.** Despite the monolith
   surrounding it, the per-tile geometry/material reuse pattern is
   AAA-quality memory hygiene.

7. **Heightmap presets + vegetation overrides per content pack.** The
   recent Phase D + commit `132eaa5ca` + `1c79bbcc3` work shipped a
   genuinely composable pattern. Adding a new themed pack with its
   own params requires zero client code changes.

## What this plan does NOT cover

Out of scope for this audit (deferred to later sessions):

- Engine→game rename (`shared` → `engine` package): see
  `PLAN_ENGINE_GAME_SEPARATION.md`. After Phase 5 acceptance.

- D6.c.4 panels migration (~20 remaining HUD panels): see
  `PLAN_PHASE_D.md`. Post-launch polish.

- UI Pack accessibility checklist + perf budget + telemetry: see
  `PLAN_UI_PACK_AAA.md`. Track C, opportunistic.

- Heavy-cluster system migration finishing (Wave 1–6): see
  `PLAN_HEAVY_CLUSTER_MIGRATION.md`. Track B, opportunistic.

These are real work but they don't block the AAA acceptance demo.
They become important after the demo proves the framework.

## Sequencing notes

- **Phase 0 ships THIS WEEK.** Without it, the user can't validate
  anything else.
- **Phases 1 + 2 can overlap partially.** Phase 1.1 (TileBasedTerrain
  split) + Phase 2.1 (N-channel attributes) touch the same files.
  Better to do 1.1 first then 2.1, otherwise merge conflicts.
- **Phases 3.1 and 3.4 are independent of 3.2.** R2.P10 broadening can
  ship parallel to R2.P12 engine decoupling.
- **Phase 4 has no hard dependency on Phase 1–3.** Hardening can start
  any time. Recommend after Phase 0 stabilizes.
- **Phase 5 requires Phase 1+2+3 done.** The demo proves the
  framework works; it can't ship until the framework actually works.

## Source plan reconciliation

| Prior plan | Status after this audit | Owner |
|---|---|---|
| `PLAN_MASTER.md` | Sequencing + R*.P* numbering still authoritative; dimension scoring updated by this audit | this doc supersedes for active execution |
| `PLAN_AAA_CONTENT_SYSTEM.md` | Phase A–D complete; C3 (vegetation registry) + C4 (N-channel shader) live in Phase 2 here | merged into this plan |
| `PLAN_HYPERIA_DECOUPLING.md` | R0+R1+R2+R3 first-cuts shipped; R2.P10 broader + R2.P12 + R3.P11 completion in Phase 3 here | merged into this plan |
| `PLAN_PROJECT_AS_DATA.md` | B0'.A through B0'.G complete; B0'.E (plugin onEnable Hyperia gate) shipped commit `5226d8ae1` | maintained as historical reference |
| `PLAN_AGENT_STUDIO_PARITY.md` | P0.7+ (state unification) is Phase 1.2/1.3 here | merged |
| `PLAN_AAA_QUALITY.md` | Phase B series subsumed into this audit's phases | superseded |
| `PLAN_NEXT_SESSIONS.md` | Sequencing absorbed into Phase 0–5 | superseded |
| `PLAN_ENGINE_GAME_SEPARATION.md` | Track A; post-Phase 5 | maintained |
| `PLAN_HEAVY_CLUSTER_MIGRATION.md` | Track B; opportunistic | maintained |
| `PLAN_UI_PACK_AAA.md` | Track C; post-launch polish | maintained |

## Top 5 priorities (ranked by user-visible impact)

1. **BiomeSystem spatial index (Phase 0.1)** — fixes the 2 FPS
   regression. Unblocks user iteration.

2. **TileBasedTerrain split (Phase 1.1)** — unblocks every future
   terrain change. The most leveraged refactor in the codebase.

3. **N-channel terrain attributes (Phase 2.1)** — eliminates the
   3-biome hardcode that leaks through 73 sites. Makes content packs
   truly composable for visuals.

4. **Plugin contribution wiring (Phase 3.1)** — closes the manifest-as-
   documentation gap. Manifest becomes substrate.

5. **AAA acceptance demo (Phase 5)** — proves the framework promise.
   Without this, the framework is theoretically composable but
   never validated.

---

**Bottom line:** the system is **62–68% AAA**. The remaining 30–40%
is well-scoped, mechanically achievable work — no fundamental
redesign needed. Expected timeline to the AAA acceptance demo:
**12–16 focused engineering weeks**, single-developer pace, with
discipline to avoid scope creep.

The user's frustration is justified. The fixes are known. Phase 0
must ship this week to restore basic working order; everything else
follows.
