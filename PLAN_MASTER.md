# HyperForge Master Plan — AI Game Studio End-to-End

**Status:** 2026-05-01 · live execution doc
**Branch:** `feat/world-studio` · tip at planning: `9f1e1f716`
**Supersedes (as the single live work tracker):** the
sequencing in `PLAN_NEXT_SESSIONS.md` and the open phases of
`PLAN_AAA_QUALITY.md`. The 14 prior plan docs remain as
domain-specific deep-dives; this doc is what we execute.

---

## North star

A **Project** is data — `{ config, plugins, worldContent }`.
A user (or AI on their behalf) starts a New Project, picks
"Design with AI," chats for a few minutes, and the agent
composes the project from building blocks: chooses asset
packs, chooses plugins, shapes terrain, places NPCs / mobs
/ resources / quests / HUD.

**The result is a game that is distinct from Hyperia, even
when it uses Hyperia building blocks.**

The only time you get exactly Hyperia is loading the Hyperia
template. The only time you get a blank world is loading the
blank template. Everything in between is composable.

Success is measured by one demo: a user asks the AI for a
"tropical pirate sandbox," and after a 5-minute conversation
they have a working game that is visibly distinct from
Hyperia — published, multiplayer, playable.

---

## Where we actually are (post 17-refresh audit)

Substrate that genuinely works (5 framework-grade packages):
`@hyperforge/manifest-schema`, `@hyperforge/agent-runner`,
`@hyperforge/gameplay-framework`, `@hyperforge/ui-framework`,
`@hyperforge/widget-catalog`.

Studio editor end-to-end solid: outliner + properties +
viewport + AI chat + drag-drop + undo/redo + save/load. No
slop, no half-wired components. 16 dispatch branches in the
companion all wired to real handlers.

AI surface ~90% wired: 15 PROPOSE_* actions, 11 LIST_/GET_
actions, real artifact pipeline. 6 actions have an
information-asymmetry gap to fix. System prompts are 173
lines total (not 2000+ as feared).

Core problem: every AI-built world looks like Hyperia
because **27 pinch points across 4 layers** bake Hyperia
in below the substrate. Three of those pinch points have
the fix already implemented as unconsumed code
(`assetRefResolver`, the `/api/plugins/contributions`
endpoint, `aggregateContributions`) — wiring is what's
missing, not implementation.

The most insidious pinch point: plugin manifest
contributions (`entityTypes`, `widgets`, `manifestSchemas`,
`paletteCategories`, `toolbarTools`, `commands`,
`systems`) are validated, snapshotted for debug UI, and
**never read at runtime**. The manifest is documentation
pretending to be substrate.

Realistic AAA % today: **78–82%**.
- Editor surface: ~92%
- Substrate plumbing: ~50% (manifest unread at runtime)
- Engine genericness: ~60% (auth fields in engine types,
  hardcoded biomes, hardcoded tree presets, etc.)
- Acceptance test (real second plugin + pack): 0%

---

## Gap inventory, organized by area

Every gap below has a file:line reference (or grep target),
an owning round, and a rough effort estimate. Items
duplicated across prior plans are listed once with their
canonical owner.

### Area 1 — Engine genericness (engine = `@hyperforge/shared`)

| Gap | Where | Owner | Effort |
|---|---|---|---|
| Login/auth fields in engine `Player` type (`hyperiaPlayerId`, `hyperiaLinked`, `hyperiaUserName`, `hyperiaUserRoles`) | `shared/src/types/entities/player-types.ts:30-90` | R2.P12 | M (5d) |
| DB schema columns Hyperia-specific (`hyperiaUserId`, `hyperiaLinked`) | `shared/src/types/network/database.ts` | R2.P12 | included above |
| Engine self-identifies as Hyperia | `shared/src/index.ts:1-5` ("Hyperia 3D multiplayer game engine") | R2.P12 | trivial within P12 |
| `HyperiaError`, `PlayerError`, `ItemError` class names | `shared/src/types/index.ts` | R2.P12 | trivial within P12 |
| Dead `HyperiaObject3D` type | `shared/src/types/rendering/three-extensions.d.ts` | R2.P12 | trivial within P12 |
| `BiomeType` enum hardcoded at engine level | `shared/src/world/world.d.ts:18-20`, `:160-165` | R3.P3 | M (1w within P3) |
| `GrassWorker` 3-biome blending | `shared/src/utils/workers/GrassWorker.ts:90-120` | R3.P3 | included within P3 |
| `LeafShape` enum has oak-specific shapes | `procgen/src/geometry/LeafMaterialTSL.ts:59-66` | R3.P3 | included within P3 |
| 18 named tree-species presets as static TS | `procgen/src/params/presets.ts:158-230` | R3.P3 | included within P3 |
| Engine→game rename when ready | `shared/` → `engine/` | Track A.5 | S (1-2d) |

### Area 2 — Plugin contribution runtime (the central unlock)

| Gap | Where | Owner | Effort |
|---|---|---|---|
| All 7 contribution fields snapshot-only, never read at runtime | `manifest-schema/src/plugin.ts:146-152` | R2.P10 | M (5d) |
| `bindAllWidgets` has no plugin extension hook | `ui-widgets/src/bindings.ts:54-71` | R2.P10 | included in P10 |
| 3-element plugin enum gates which plugins boot | `asset-forge/src/components/WorldStudio/toolbar/gamePluginResolver.ts:30` | R2.P2 | M (3d) |
| Static plugin imports + hardcoded gameId switch in PIE | `asset-forge/src/pie/pluginBoot.ts:34-50,80-100` | R2.P2 | included in P2 |
| Server `bootServerPlugins` ignores `project.plugins` | `server/src/startup/world.ts:149`, `plugins.ts:216-305` | R2.P2 | included in P2 |
| `KNOWN_PLUGINS` const in agent's `LIST_PLUGINS` | `eliza-game-builder/src/actions/listPlugins.ts:48-68` | R1.P15 | S (1d) |
| `aggregateContributions` / `computeContributionOrigins` orphan code | `gameplay-framework/src/snapshot.ts:745-820` | R2.P10 | wire as part of P10 |
| `/api/plugins/contributions` endpoint dead code | `asset-forge/server/routes/plugins.ts:84-120` | R2.P10 | wire as part of P10 |

### Area 3 — Asset pack + asset loading pipeline

| Gap | Where | Owner | Effort |
|---|---|---|---|
| `assetRefResolver.ts:73` orphan code (zero callers) | `asset-forge/src/components/WorldStudio/utils/assetRefResolver.ts` | R0.QW2 | XS (1-2h) |
| `initEntityModels` Hyperia-coupled, runs unconditionally | `asset-forge/src/components/WorldStudio/hooks/useEditorWorldSync.ts:88`, `WorldBuilder/GameWorldAssets.ts:543` | R3.P4 | S (2d) |
| Marker rendering doesn't consult installed pack registry | `editorMarkers.ts:540-620` | R3.P4 | included in P4 |
| Asset pack install is DB-only (no runtime registry) | `world-projects.ts:653-687` write, no runtime read | R3.P4 | included in P4 |
| `DataManager.loadManifestsFromFilesystem` global, env-flag gated, default ON | `shared/src/data/DataManager.ts:847-880` | R1.P5 | S (1d) |
| Zero non-Hyperia asset packs shipped | `seed-hyperia-asset-pack.ts` is the only seeder | R5.P7 | M (5d) |

### Area 4 — Agent action surface

| Gap | Where | Owner | Effort |
|---|---|---|---|
| 6 PROPOSE_* actions don't reach plan aggregator | `agent-server/src/handler.ts:789-870` | R0.QW1 | XS (30min) |
| Agent vocabulary missing: PROPOSE_TOWN | not implemented | R4.P8 | S (2d) |
| Agent vocabulary missing: PROPOSE_PATH (vs road) | not implemented | R4.P8 | S (1d) |
| Agent vocabulary missing: PROPOSE_WATER_BODY | not implemented | R4.P8 | S (2d) |
| Agent vocabulary missing: PROPOSE_MUSIC_ZONE | not implemented | R4.P8 | S (1d) |
| Agent vocabulary missing: PROPOSE_AMBIENT_ZONE | not implemented | R4.P8 | S (1d) |
| Agent vocabulary missing: PROPOSE_MINE | not implemented | R4.P8 | S (2d) |
| Agent vocabulary missing: PROPOSE_WILDERNESS_BOUNDARY | not implemented | R4.P8 | S (1d) |
| Agent vocabulary missing: PROPOSE_SFX_TRIGGER | not implemented | R4.P8 | S (1d) |
| Companion mode under-tested (1 acceptance test, no functional tests) | `agent-server/src/__tests__/handler.test.ts` | R4 | S (1d) |
| No constraint propagation in prompt (agent can place NPC before plugin set installed) | system prompt | R4.P6 | trivial |
| No smart error feedback on rejected placements | placementValidators.ts | R4.P6 | S (1d) |

### Area 5 — Studio editor extensibility (mostly already solid)

| Gap | Where | Owner | Effort |
|---|---|---|---|
| Plugin-contributable property panels (extension point exists, contributions don't populate it) | `PropertiesPanel.tsx:251-310` default case routes via `EntityTypeRegistry.getBySelectionType` | R3.P9 | M (5d) |
| `MainToolbar` is hardcoded 6-mode palette, no `ToolbarTool` registry | `WorldStudio/toolbar/MainToolbar.tsx:64-70` | R3.P11 | included in P11 |
| `ContentBrowser` 9 categories hardcoded, no `paletteCategories` registry | `WorldStudio/panels/ContentBrowser.tsx` | R3.P11 | S (1d) |
| Multi-store fragmentation: quests/zones in `agentWorldContent`, placements in `extendedLayers` | various — documented tech debt | post-launch | S (2d) |

### Area 6 — UI / HUD

| Gap | Where | Owner | Effort |
|---|---|---|---|
| 27 hardcoded HUD panels in client, no panel registry | `client/src/game/interface/InterfacePanels.tsx` | R3.P11 | included in P11 |
| `ui-widgets` styling Hyperia-locked (RGBA constants, OSRS-yellow comment, OSRS paperdoll layout) | `ui-widgets/src/widgets/*.tsx`, `widgetStyles.ts` | R3.P13 | M (5d) |
| Hardcoded fallback content (e.g. `thick_skin`, `burst_of_strength` prayer ids) | `PrayerWidget.tsx:50-77` | R3.P13 | included in P13 |
| Grid/flex positions stubbed, only `anchored` renders | `ui-widgets/src/ManifestRenderer.tsx` | post-launch | S (2d) |
| Theme inheritance schema exists but no runtime resolution | `ui-framework/src/theme.ts:59` | post-launch | S (2d) |
| Per-widget customization defaults not enforced | `ui-framework/src/uiPack.ts:48-71`, `resolve.ts:77-86` | post-launch | S (1d) |
| UI Pack accessibility checklist | `PLAN_UI_PACK_AAA.md` final | Track C.3 | M (3d) |
| UI Pack perf budget + telemetry + e2e + flag flip | `PLAN_UI_PACK_AAA.md` final | Track C.4 | M (5d) |
| D6.c.4 panels migration (~20 remaining) | `PLAN_PHASE_D.md` long-tail | post-launch | L (~3w) |

### Area 7 — Server + client plugin extension hooks

| Gap | Where | Owner | Effort |
|---|---|---|---|
| Server has no plugin tick hook | `server/src/systems/GameTickProcessor.ts` (NPC-first hardcoded) | R3.P11 | M (5d) |
| Server has no packet handler registry for plugins | `server/src/startup/plugins.ts` | R3.P11 | included in P11 |
| Client has no panel/HUD registry for plugins | `client/src/game/interface/InterfacePanels.tsx` | R3.P11 | included in P11 |
| No client render-frame plugin hook | game loop | post-launch | M |

### Area 8 — Onboarding prompt

| Gap | Where | Owner | Effort |
|---|---|---|---|
| Static prompt teaches Hyperia (3 biome types, "Hyperia-class RPGs") | `agent-server/src/handler.ts:75-187` | R4.P6 | S (½d) |
| No mode-specific prompt branching (onboarding vs companion) | same | R4.P6 | included in P6 |
| `HUD_SYSTEM_PROMPT` says "design UI packs for Hyperia worlds" | `handler.ts:51-66` | R4.P6 | trivial |
| No constraint propagation (causality hazards) | same | R4.P6 | included in P6 |

### Area 9 — Procgen extensibility

| Gap | Where | Owner | Effort |
|---|---|---|---|
| `DEFAULT_CREATION_CONFIG` is Hyperia, misnamed | `WorldBuilder/types.ts:1442-1510` | R1.P1 | S (1d) |
| `GAME_BIOME_DEFINITIONS` hardcoded twice | `GameTerrainAdapter.ts:49`, `GameWorldContext.ts:203` | R3.P3 | included in P3 |
| Plugins can't contribute biomes / vegetation / terrain presets | `manifest-schema/src/plugin.ts` schema | R3.P3 | L (1-2w) |
| No `BiomeRegistry` or `VegetationProfileRegistry` | doesn't exist | R3.P3 | included in P3 |

### Area 10 — Project scoping

| Gap | Where | Owner | Effort |
|---|---|---|---|
| `HYPERFORGE_DISABLE_ENGINE_DATA_LOAD` is per-deploy env, not per-project | `DataManager.ts:847-880` | R1.P5 | S (1d) |
| Hyperia content baked into engine (worldAreas, npcDefinitions, biomes) | `DataManager.ts:1016-1026` | R3 (post-P10) | included in P10/P11 work |
| `PROJECT_AS_DATA.B0'.E` — Hyperia content into plugin onEnable | new work | R3 (≡P5+P11) | folded into P11 |
| `PROJECT_AS_DATA.B0'.F` — parity smoke test | new work | Track C.1 | M (3d) |

### Area 11 — Acceptance content (proves the framework promise)

| Gap | Where | Owner | Effort |
|---|---|---|---|
| `@hyperforge/asset-pack-tropical-v1` — second pack | doesn't exist | R5.P7 | M (3d) |
| `@hyperforge/plugin-tropical-sandbox` — second plugin | doesn't exist | R5.P7 | M (3d) |
| Worked-example demo session (`AI_AUTHORING_FOUNDATIONS.A5`) | `PLAN_AI_AUTHORING_FOUNDATIONS.md` | R5 | S (2d) |

### Area 12 — Engine publishability (Track A — parallel)

| Gap | Where | Owner | Effort |
|---|---|---|---|
| `GameMode` contract + wiring | `PLAN_ENGINE_GAME_SEPARATION.md` Phase 2 | A.1 | S (1-2d) |
| Real loopback PIE instrumentation | `PLAN_ENGINE_GAME_SEPARATION.md` Phase 3 | A.2 | S (mostly done) |
| Hyperia shell + GameMode contract expansion | `PLAN_ENGINE_GAME_SEPARATION.md` Phase 4 | A.3 | L (2-3w) |
| File moves + `tsc --emitDeclarationOnly` | `PLAN_ENGINE_GAME_SEPARATION.md` Phase 5 | A.4 | M (1w) |
| Rename `shared` → `engine` | `PLAN_ENGINE_GAME_SEPARATION.md` Phase 6 | A.5 | S (1-2d) |
| Studio rename + demo-arena game + publish 1.0.0 | `PLAN_ENGINE_GAME_SEPARATION.md` Phases 7-8 | post-R5 | L (3-4w) |

### Area 13 — System migration finishing (Track B — opportunistic)

| Gap | Where | Owner | Effort |
|---|---|---|---|
| Diagnose cross-package d.ts inference bug blocking Wave 1 | `PLAN_HEAVY_CLUSTER_MIGRATION.md` | B.1 | S (½d) |
| Wave 1: ResourceSystem leaves to plugin | same | B.2 | S (1d) |
| Wave 2: TownSystem + ZoneDetectionSystem | same | B.3 | M (3d) |
| Wave 3: EntityManager + Entities + MobNPCSystem | same | B.4 | M (5d) |
| Wave 4: PlayerDeathSystem cluster | same | B.5 | S (2d) |
| Wave 5: Player + Skills + Equipment + Inventory | same | B.6 | L (1w) |
| Wave 6: Combat + handlers | same | B.7 | L (1w) |

### Area 14 — Project-as-data + UI polish (Track C — opportunistic)

| Gap | Where | Owner | Effort |
|---|---|---|---|
| `B0'.E` — Hyperia content into plugin onEnable | `PLAN_PROJECT_AS_DATA.md` | folded into R3.P11 | — |
| `B0'.F` — parity smoke test | same | C.1 | M (3d) |
| `B1'` — Design with AI hero UX (full conversational onboarding) | same | C.2 | L (2-3w) |
| UI Pack accessibility checklist | `PLAN_UI_PACK_AAA.md` | C.3 | M (3d) |
| UI Pack perf + telemetry + e2e + flag flip | same | C.4 | M (5d) |

---

## Sequenced execution

### Round 0 — Quick wins (today, total ~2 hours)

These are mechanical fixes that don't require design.

**0.QW1 — Plan-aggregator gap (≈30 min)**
Add 6 case branches to `aggregatePlanFromTurns` in
`agent-server/src/handler.ts:789-870` for STATION, TELEPORT,
ROAD, POI, DANGER_SOURCE, ASSET_PACK_INSTALL. Restores
information parity between onboarding and companion modes.

**0.QW2 — Wire `assetRefResolver` (≈1-2 h)**
The function exists at
`asset-forge/src/components/WorldStudio/utils/assetRefResolver.ts:73`
and has zero callers. Import it in `editorMarkers.ts` at
the marker-rendering paths (lines 337, 368, 579) so that
when an entity has an `assetRef` field, we resolve through
the pack-aware path before falling back to
`tryLoadEntityModel`. This makes the asset-pack ecosystem
do something at runtime for the first time.

### Round 1 — Honest naming + project scoping (2–3 days)

Three independent fixes that immediately make AI-built
worlds look different from Hyperia.

**1.P1 — Honest config naming + project-aware merge base (1d)**
- Rename `DEFAULT_CREATION_CONFIG` → `HYPERIA_CREATION_CONFIG`
- Introduce `MINIMAL_CREATION_CONFIG` (procgen biomes +
  vegetation enabled, NO Hyperia tree species, NO town
  presets, `townCount: 0`)
- `DesignWithAIDialog.buildWorld` and `WorldStudioCompanion`
  choose merge base based on `project.plugins`:
  Hyperia plugin → Hyperia config; else → MINIMAL.

**1.P15 — Agent uses real plugin list (1d)**
Replace `KNOWN_PLUGINS` const at
`eliza-game-builder/src/actions/listPlugins.ts:48-68` with
a runtime call to `PluginRegistryService.listPlugins()`.
Pass the registry through agent action context.

**1.P5 — Project-scoped engine data load (1d)**
Make `HYPERFORGE_DISABLE_ENGINE_DATA_LOAD` per-project.
When the loaded project doesn't include
`@hyperforge/hyperscape` in `plugins`, the engine doesn't
load Hyperia manifests. Blank projects get truly empty
registries.

**Exit criteria for Round 1:** New project with blank
template produces a vegetation-but-not-Hyperia world. New
project with the agent picking a non-Hyperia plugin set
produces an empty-Hyperia-content world (biomes still
tundra/forest/canyon — that's Round 3).

### Round 2 — Substrate plumbing (~2 weeks)

The architecture round. After this, the substrate matches
the manifest's claims.

**2.P2 — Plugin enum → registry path (3d)**
- Delete `GamePluginSetId` 3-element type
- Make `getPluginModules` accept `string[]` and resolve
  each id through `PluginRegistryService` to a loadable
  module
- Drop static imports of `combatManifest` /
  `hyperscapeManifest` from `pluginBoot.ts`
- Replace with dynamic `import()` of each plugin's entry
  per the manifest's `main` field
- After P2: `PROPOSE_PLUGIN_SET ["@hyperforge/plugin-anything"]`
  actually boots that plugin in PIE

**2.P10 — Read plugin contributions at runtime (5d) — THE central unlock**
- Build `PluginContributionRegistry` that reads
  `plugin.contributions.*` arrays at plugin onLoad and
  registers each one against the appropriate runtime
  registry:
  - `widgets[]` → `WidgetRegistry` (also unblocks
    `bindAllWidgets` plugin extension hook)
  - `entityTypes[]` → entity-type registry (consumed by
    `PropertiesPanel.tsx` default case via
    `EntityTypeRegistry.getBySelectionType`)
  - `paletteCategories[]` → editor palette
  - `toolbarTools[]` → toolbar slot
  - `commands[]` → `CommandRegistry`
  - `manifestSchemas[]` → ContentBrowser categories
- Wire the orphan
  `aggregateContributions` / `computeContributionOrigins`
  helpers (already exist in `gameplay-framework/src/snapshot.ts`)
- Wire the orphan `/api/plugins/contributions` HTTP endpoint
- After P10: a plugin declaring `widgets` in `plugin.json`
  renders that widget when its UI pack is active, with no
  imperative registration code

**2.P12 — Detangle login/auth from engine types (5d)**
- Move `hyperiaPlayerId` / `hyperiaLinked` / `hyperiaUserName`
  / `hyperiaUserRoles` out of `shared/src/types/entities/player-types.ts`
- Drop matching DB columns from
  `shared/src/types/network/database.ts`
- Engine `Player` carries opaque `externalAccountId?: string`
- Hyperia plugin reads/writes its hyperia-specific fields via
  an `auth-bridge`
- Drop `HyperiaError`/`PlayerError`/`ItemError` class names
- Update `shared/src/index.ts` header to "HyperForge engine
  substrate"

**Exit criteria for Round 2:** A plugin declaring
contributions in `plugin.json` actually contributes them at
runtime. The engine's public types contain zero "hyperia"
identifiers. The plugin enum is gone; any installed plugin
boots.

### Round 3 — Extension surface (~2-3 weeks)

After this round, plugins genuinely extend the engine's
capabilities, and "compose a game from building blocks"
becomes mechanically possible.

**3.P3 — Plugin-contributable biomes + vegetation (1-2w)**
- Extend `manifest-schema/src/plugin.ts`
  `EntityTypeContributionSchema` with optional
  `biomes: BiomeContribution[]` and
  `vegetationProfiles: VegetationProfile[]` and
  `terrainPresets: TerrainPreset[]`
- `BiomeRegistry` + `VegetationProfileRegistry` mirror
  asset-pack registry pattern, populated from active
  plugins' contributions via Round-2 P10
- Replace `BiomeType` enum at `shared/src/world/world.d.ts`
  with `BiomeId = string`
- `GAME_BIOME_DEFINITIONS` becomes union of installed
  plugins' contributions + tiny engine-default set (1
  generic biome) for blank-no-plugins projects
- `GrassWorker` consumes registry instead of 3-arg blend
- `LeafShape` enum becomes contribution-driven

**3.P4 — Pack-aware initEntityModels (2d, smaller than expected)**
- `useEditorWorldSync` reads `project.plugins[]` and
  `project.assetPacks[]`
- For each plugin/pack, ask the contribution manifest which
  manifests/packs it owns; load only those
- Hyperia `initStationModels`/`initOreModels`/`initNpcModels`
  become internal details of the Hyperscape plugin
- Marker rendering (`editorMarkers.ts:540-620`) routes
  through `assetRefResolver` first (already wired in 0.QW2)
- Leverages existing `assetRefResolver` orphan code

**3.P9 — Plugin-contributable property panels (5d, smaller than expected)**
- `EntityTypeRegistry.getBySelectionType` already exists
  at `PropertiesPanel.tsx:251-310` default case
- `SchemaPropertyEditor` already exists
- Gap: plugin contributions need to populate the registry
  (which Round-2 P10 enables)
- Wire the contribution → registry path
- Add JSON-Schema → form generator for any non-Hyperia
  entity types

**3.P11 — Server + client plugin extension hooks (5d)**
- **Server**: `bootServerPlugins(world, project)` reads
  `project.plugins[]`, dynamically imports each plugin's
  server entry, exposes hooks on a `ServerPluginContext`:
  - `registerTickSystem(name, system)` — `GameTickProcessor`
    becomes generic dispatcher iterating registered systems
  - `registerPacketHandler(opcode, fn)` — server packet
    routing extensible
  - `registerSaveColumn(name, schema)` — plugin-owned
    save data
- **Client**: `client/src/game/interface/InterfacePanels.tsx`
  becomes a registry walk
  (`pluginPanelRegistry.list()`) instead of 27 hardcoded
  imports. Plugins register via
  `clientPluginContext.registerPanel(id, component)`
- **Client toolbar / content browser** also consume
  contribution registries from R2.P10

**3.P13 — Strip Hyperia styling from `ui-widgets` (5d)**
- Replace RGBA constants in `widgets/*.tsx` with
  `theme` token reads (`themeToCssVars()` exists; widgets
  must call it)
- Drop hardcoded fallback content
  (`PrayerWidget.tsx:50-77` `thick_skin` etc.)
- Strip `OSRS-yellow`, `OSRS paperdoll`,
  `Matches gameUI.actionBar tokens` comments and the
  values they describe — replace with the actual token
  reads they advertise

**Exit criteria for Round 3:** A plugin can declare a
desert biome and tropical vegetation in its `plugin.json`,
and the procgen pipeline generates that biome with that
vegetation. A plugin can declare a custom HUD panel and the
client renders it. A plugin can declare a custom NPC type
and the editor's properties panel renders an editor for it.
The renderer reads `assetRef` and resolves through the
pack-aware path. `ui-widgets` is theme-driven, no
Hyperia colors baked in.

### Round 4 — Polish + agent vocabulary (~1-2 weeks)

After this round, the AI's conversational surface is
plugin-aware and closes its current vocabulary gaps.

**4.P6 — Plugin-aware onboarding prompt (½d)**
- 113-line ONBOARDING_SYSTEM_PROMPT becomes templated
- Static sections → instructional scaffolding
- Dynamic sections inject `LIST_PLUGINS` +
  `LIST_ASSET_PACKS` + `LIST_ENTITY_TYPES` results
- Drop "Hyperia ships 3 biome types" — replace with
  "the installed plugins provide these biomes: …"
- Drop "Hyperia-class RPGs" framing
- Add constraint-propagation hints (suggest plugin install
  before proposing entities)

**4.P14 — Broader plugin-scaffolder (5d)**
- Drop Hyperia-shaped default in
  `plugin-scaffolder/src/scaffoldWidget.ts:12-13`
- Add `scaffoldPlugin(spec)` (emits `plugin.json` +
  `index.ts` + factory + manifest)
- Add `scaffoldSystem(spec)`, `scaffoldEntity(spec)`,
  `scaffoldManifestSchema(spec)`
- Wire onboarding action `PROPOSE_NEW_PLUGIN` so the agent
  can author plugins during a Design with AI session

**4.P8 — Close agent vocabulary gaps (1w)**
8 new PROPOSE_* actions, all mechanical now that R0 + R1 +
R2 wired the substrate:
- `PROPOSE_TOWN`
- `PROPOSE_PATH`
- `PROPOSE_WATER_BODY`
- `PROPOSE_MUSIC_ZONE`
- `PROPOSE_AMBIENT_ZONE`
- `PROPOSE_MINE`
- `PROPOSE_WILDERNESS_BOUNDARY`
- `PROPOSE_SFX_TRIGGER`

Each follows the proven recipe: schema in
`manifest-schema/src/world-areas.ts` + action in
`eliza-game-builder/src/actions/` + dispatcher in
`useAgentPlacementDispatcher.ts` + outliner+marker
rendering+property panel.

**Exit criteria for Round 4:** Onboarding prompt teaches
the agent only what's true for the active plugin set. The
agent can scaffold new plugins. The 8 missing PROPOSE_*
actions are wired end-to-end.

### Round 5 — Acceptance test (~1 week)

This round proves the framework promise. Without it, R1-R4
are theoretical claims.

**5.P7 — Real second plugin + second pack (5d)**
- `@hyperforge/asset-pack-tropical-v1` — palms, beaches,
  jungle plants, tropical mob art, pirates, dhow boats
- `@hyperforge/plugin-tropical-sandbox` — declares its
  own entity types, biomes (beach + jungle), vegetation
  profile

**5.A5 — Worked-example demo (2d, AI_AUTHORING_FOUNDATIONS.A5)**
Recorded/scripted Eliza session log where:
1. AI lists installed plugins (sees Hyperia + tropical)
2. User asks for "tropical pirate sandbox"
3. AI picks `@hyperforge/plugin-tropical-sandbox`
4. AI installs `@hyperforge/asset-pack-tropical-v1`
5. AI emits `PROPOSE_TERRAIN_CONFIG` with archipelago
   preset + tropical plugin's biomes
6. AI emits `PROPOSE_NPC_PLACEMENT`,
   `PROPOSE_MOB_SPAWN` with assetRefs from the tropical
   pack
7. AI emits `PROPOSE_QUEST` for "find the captain"
8. World renders with palm trees, beaches, jungle biomes,
   pirate NPCs — visibly distinct from Hyperia
9. User clicks Play in Editor, walks around the world

**Exit criteria for Round 5:** the demo works end-to-end.
Recorded session published with the codebase. **Framework
promise is real.**

---

## Parallel tracks (run alongside main rounds)

### Track A — Engine publishability (~3-4 weeks)

Independent of HYPERIA_DECOUPLING. Can start immediately.

- **A.1** — `ENGINE_GAME_SEPARATION` Phase 2: GameMode
  wiring. 1-2 days. Unblocks Phase 4.
- **A.2** — `ENGINE_GAME_SEPARATION` Phase 3: real loopback
  PIE instrumentation. Mostly done; finishing.
- **A.3** — `ENGINE_GAME_SEPARATION` Phase 4: Hyperia shell
  + GameMode contract expansion (PlayerState, GameState,
  HUD, GameRules). 2-3 weeks. Heart of engine separation.
- **A.4** — `ENGINE_GAME_SEPARATION` Phase 5: file moves +
  `tsc --emitDeclarationOnly`. 1 week.
- **A.5** — `ENGINE_GAME_SEPARATION` Phase 6: rename `shared`
  → `engine`. 1-2 days.

### Track B — System migration cleanup (~3 weeks, opportunistic)

`PLAN_HEAVY_CLUSTER_MIGRATION` Waves 1-6. Blocked on a
cross-package d.ts inference bug from Wave 1's revert at
`fb8a01b62`. Diagnose first, then ~1 wave per session.

### Track C — Project-as-data + UI polish (~1-2 weeks, opportunistic)

- **C.1** — `B0'.F` parity smoke test. 3 days.
- **C.2** — `B1'` Design with AI hero UX (full
  conversational onboarding with choice chips + live plan
  preview + building blocks browser). 2-3 weeks.
- **C.3** — UI Pack accessibility. 3 days.
- **C.4** — UI Pack perf + telemetry + e2e + flag flip. 5
  days.

---

## Post-launch backlog (after Round 5 + acceptance)

These ship after the framework promise is real, in priority
order:

**Genre primitives (deepen agent capabilities)**
- `AGENT_STUDIO_PARITY.P3` — genre-agnostic path primitive
- `AGENT_STUDIO_PARITY.P12` — genre primitives (FPS, RTS,
  card-game first-class entity types)
- `AGENT_STUDIO_PARITY.P13` — source tagging / proper
  attribution

**Authoring depth**
- `AGENT_STUDIO_PARITY.P10` — brush operations
- `AGENT_STUDIO_PARITY.P11` — wizard flows for complex
  tasks
- Multi-store unification (quests/zones into
  `extendedLayers`)

**Asset pack marketplace**
- `ASSET_PACKS.AP5-AP9` — marketplace UI, user pack
  auto-creation, plugin `requires` field validation

**UI polish (long-tail)**
- `PHASE_D.D6.c.4` — last 20+ panel migrations
- `ui-widgets` grid/flex rendering
- Theme inheritance runtime resolution
- Per-widget customization defaults enforcement

**Engine 1.0**
- `ENGINE_GAME_SEPARATION` Phases 7-8 — studio rename,
  demo-arena game, federated loading, sandbox, publish
  `@hyperforge/engine` 1.0.0

---

## Source plan reconciliation

Each prior plan doc remains as a domain-specific deep-dive
but stops being its own work tracker. This master plan owns
sequencing.

| Prior plan | Status | Where in this master plan |
|---|---|---|
| `PLAN_HYPERIA_DECOUPLING.md` | live | Rounds 0-5 (P1-P15 mapped) |
| `PLAN_AGENT_STUDIO_PARITY.md` | live | P0+P1 shipped; P2/P5/P6 → R4.P8; P4 → R3.P9; P3+P10-P13 → post-launch |
| `PLAN_AI_AUTHORING_FOUNDATIONS.md` | live | A1-A4 shipped; A5 → R5 |
| `PLAN_PROJECT_AS_DATA.md` | live | B0'.A done; B0'.E → R3.P11; B0'.F → Track C.1; B1' → Track C.2 |
| `PLAN_ASSET_PACKS.md` | live | AP1-AP3 partially shipped; AP4 → R3.P4; AP5-AP9 → post-launch |
| `PLAN_UI_PACK_AAA.md` | live | U0-U11 shipped; polish → Track C.3+C.4 |
| `PLAN_PHASE_D.md` | live | D1-D7 shipped; D8/D9/D10 closed; D6.c.4 → post-launch |
| `PLAN_ENGINE_GAME_SEPARATION.md` | live | Phases 0-1 deferred; 2-6 → Track A; 7-8 → post-launch |
| `PLAN_ENGINE_API_EXTRACTION.md` | substantively complete | reference only |
| `PLAN_HEAVY_CLUSTER_MIGRATION.md` | live | Waves 1-6 → Track B |
| `PLAN_SERVERNETWORK_MIGRATION.md` | substantively complete | reference only |
| `PLAN_AAA_QUALITY.md` | partly stale | superseded by this doc + PROJECT_AS_DATA |
| `PLAN_NEXT_SESSIONS.md` | partly stale | superseded by this doc |
| `PLAN_WORLD_STUDIO_AAA_COMPLETION.md` | design spec | acceptance criteria; Phase A folded into R3.P3 |
| `PROGRESS_AUDIT.md` | live tracker | ongoing REFRESH N updates |

---

## Effort summary

| Round / track | Effort | Calendar |
|---|---|---|
| Round 0 (quick wins) | ~2 hours | today |
| Round 1 (honest naming) | 2-3 days | week 1 |
| Round 2 (substrate plumbing) | ~2 weeks | weeks 1-3 |
| Round 3 (extension surface) | ~2-3 weeks | weeks 3-5 |
| Round 4 (polish + vocabulary) | ~1-2 weeks | weeks 5-6 |
| Round 5 (acceptance test) | ~1 week | week 7 |
| **Critical path subtotal** | **~7-9 weeks** | **end-to-end framework promise** |
| Track A (engine publishability) | ~3-4 weeks | parallel; finishes alongside R5 |
| Track B (system migration) | ~3 weeks | opportunistic; one wave per session |
| Track C (project-as-data + UI polish) | ~1-2 weeks | opportunistic |
| Post-launch backlog | ongoing | after R5 |

At one full-time engineer: **~7-9 weeks to "framework
promise is real" demo.** Engine 1.0 publishable: **+3-4
weeks after R5** (Track A finishing).

---

## What this plan does NOT cover

- **Production deployment hardening**: auth rate limits,
  monitoring, observability, error reporting, abuse
  prevention. Already in scope of separate ops work.
- **Plugin marketplace billing / payments / DRM**.
  Out-of-scope for framework promise.
- **Live-service game content**: quests, item economies,
  PvP balance, anti-cheat. Each game's responsibility.
- **Multi-agent coordination**: agents that collaborate on
  authoring (one terrain agent + one quest agent). Future
  research.
- **Federation across teams**: third-party plugin
  distribution beyond the local monorepo. Future research.
- **Mobile-first authoring UX**. Mobile *play* works;
  authoring is desktop-first.

---

## Success metric (from `PLAN_HYPERIA_DECOUPLING.md`)

A user starts a New Project, picks Design with AI, asks for
a "tropical pirate sandbox":

1. Agent picks `@hyperforge/plugin-tropical-sandbox` (R2.P2 + R5.P7)
2. Agent installs `@hyperforge/asset-pack-tropical-v1` (R5.P7)
3. Agent emits `PROPOSE_TERRAIN_CONFIG` with archipelago
   preset + the tropical plugin's biomes (R3.P3)
4. Agent emits `PROPOSE_NPC_PLACEMENT`,
   `PROPOSE_MOB_SPAWN`, etc. with assetRefs from the
   tropical pack (R3.P4)
5. World renders with palm trees, beaches, jungle biomes,
   pirate NPCs — **visibly distinct from Hyperia**
6. User clicks Play in Editor and walks around the world
7. User clicks Publish; another browser at the published
   URL plays the same world

When that flow works end-to-end, **the framework promise is
real**.

---

## How we use this doc

- `PROGRESS_AUDIT.md` REFRESH N updates after each round
  shipped.
- Each round's exit criteria is the gate to the next round
  starting.
- If a phase reveals new gaps, add to this doc's gap
  inventory; don't open a new plan doc.
- Parallel tracks A/B/C run when blocking work on the
  critical path is short or stalled.
- Memory entries reference this doc as the live work
  tracker.
