# Hyperia Decoupling — Plan

**Status:** Draft — 2026-05-01
**Tip commit at planning time:** `5e5aad816` on `feat/world-studio`
**Companion to:** `PLAN_AGENT_STUDIO_PARITY.md`,
`PLAN_PROJECT_AS_DATA.md`, `PLAN_ENGINE_GAME_SEPARATION.md`,
`PLAN_ASSET_PACKS.md`.

---

## North star (synthesis from prior plans)

A **Project** is data — `{ config, plugins, worldContent }`. A
user (or an AI on their behalf) starts a New Project, picks
"Design with AI", chats for a few turns, and the agent
composes the project from building blocks: chooses asset packs,
chooses plugins, shapes terrain, places mobs / NPCs / quests.

**The result is a game that is distinct from Hyperia, even if
it uses Hyperia building blocks.**

The only time you get exactly Hyperia is when you explicitly
load the Hyperia default project. The only time you get a
blank world is when you pick the blank template. Everything in
between is composable.

---

## Problem statement (user-facing, 2026-05-01)

After the recent `5e5aad816` "fix" (BLANK → DEFAULT merge base
to bring back vegetation + towns), every AI-built world looks
exactly like Hyperia. The substrate exists — project-as-data,
plugin registry, asset packs, 15 PROPOSE_* actions, the P0+P1
agent ↔ studio unification — but a small number of pinch points
bake Hyperia in below the substrate. The AI can't compose; it
can only paste Hyperia and edit on top.

---

## What's actually built (substrate that works)

The 2026-05-01 deep audit confirmed the following substrate is
real, generic, and reusable. It is **not** the problem.

### Genuinely game-agnostic packages (audit-verified)

- **`@hyperforge/manifest-schema`** — 160+ Zod schemas with
  `.passthrough()`, no Hyperia hardcoding except in test fixtures
  (acceptable). Schemas are extension-friendly by design.
- **`@hyperforge/agent-runner`** — 297-line generic LLM-loop +
  Anthropic tool adapter. Zero game-domain knowledge.
- **`@hyperforge/gameplay-framework`** — public API facade for
  plugin authors. Lifecycle driver, semver resolver, catalog
  loader, snapshot. Zero `@hyperforge/shared` import. Clean.
- **`@hyperforge/ui-framework`** — fully generic widget /
  layout / theme / data-binding contracts. `DataSourceRegistry`
  + `CommandRegistry` + `WidgetRegistry` + `UIPackManifest` are
  all pluggable. Names like "prayer" are domain hints; schemas
  are generic.
- **`@hyperforge/widget-catalog`** — query service over a
  `WidgetRegistry`. Designed for AI authoring. Clean.
- **`@hyperforge/client`** (mostly) — render + network only.
  Engine-generic except for the 27 hardcoded HUD panels (see #20).

### Project / asset / agent infrastructure (works)

- **Project-as-data**: typed `config` / `plugins` /
  `worldContent` columns. `WorldProjectService`,
  `world-projects.schema.ts`. B0'.A complete.
- **`PluginRegistryService`**: discovers plugins from monorepo
  `packages/` + `node_modules/@hyperforge/`. **Used by editor;
  unused by the agent surface (#21).**
- **Asset pack ecosystem**: schema, DB, marketplace UI, browser,
  WebGPU thumbnails, 10 Hyperia category packs (~142 assets).
- **Agent action surface**: 15 PROPOSE_* actions in
  `eliza-game-builder/src/actions/`.
- **Agent ↔ studio data unification (P0+P1)**: `extendedLayers`
  is the single store; bidirectional mappers; outliner
  color-codes by `source`.
- **Templates**: 2 (`blank` + `hyperia`) via
  `ProjectTemplateService.ts`.
- **`HYPERFORGE_DISABLE_ENGINE_DATA_LOAD` env flag** — lets blank
  projects boot without the engine-side Hyperia manifest load.

This represents 8–10 months of legitimate substrate work.

### What I underweighted in the original sweep

Three findings made me revise upward both the substrate's quality
and the depth of the Hyperia bake:

1. **The substrate is cleaner than I thought** —
   `gameplay-framework`, `ui-framework`, `manifest-schema`,
   `agent-runner`, `widget-catalog` are genuinely framework-grade.
   The composability story works at the contract layer.

2. **The bake is deeper than I thought** — Hyperia is welded into
   `shared`'s engine types (`hyperiaPlayerId`, `BiomeType` enum,
   `HyperiaError` class names), into `procgen` (oak-specific
   `LeafShape`, 3-biome `GrassWorker`, 18 named tree presets),
   into the server tick (`GameTickProcessor`'s NPC-first ordering
   with "OSRS combat feel" comment), and into the client HUD (27
   hardcoded panels). The editor's pinch points (#1–#11) were
   the *visible* layer; the engine, server, and client carry
   their own.

3. **Plugin manifest contributions don't fire at runtime
   (#24)** — `plugin.json` declares `entityTypes`, `widgets`,
   `manifestSchemas`, `paletteCategories`, `toolbarTools`,
   `commands`. The runtime never reads them. They populate a
   debug snapshot. Plugins register via `onLoad`/`onEnable`
   callbacks instead. This is the worst kind of slop because
   the manifest *looks* like substrate but isn't.

---

## The pinch points (where Hyperia is baked in below the substrate)

> The 27 pinch points below are grouped by layer. **Layer A** (#1–#11) was identified
> in the original sweep. **Layer B** (#12–#17) emerged from auditing the engine /
> server / client / procgen packages. **Layer C** (#18–#23) emerged from auditing
> the agent + plugin scaffolding + UI widget packages. **Layer D** (#24–#27) is
> declared-but-unread contribution surface — the most insidious kind, because
> the substrate looks correct on paper but doesn't fire at runtime.

### Layer A — substrate-vs-Hyperia (asset-forge editor side)

| # | Pinch point | File | Effect |
|---|---|---|---|
| 1 | **3-element plugin enum** | `asset-forge/src/components/WorldStudio/toolbar/gamePluginResolver.ts:30` (`type GamePluginSetId = "blank" \| "hyperscape" \| "shooter-demo"`) | `PROPOSE_PLUGIN_SET` writes arbitrary npm ids; PIE only knows how to boot 3. |
| 2 | **`DEFAULT_CREATION_CONFIG` is Hyperia, misnamed "default"** | `asset-forge/src/components/WorldBuilder/types.ts:1442` | `useGamePipeline: true`, `preset: "large-island"`, full Hyperia town/biome/vegetation. The 5e5aad816 fix made AI-built worlds use this as the base. |
| 3 | **`GAME_BIOME_DEFINITIONS` hardcoded (tundra/forest/canyon)** | `GameTerrainAdapter.ts:49`, `GameWorldContext.ts:203` (parallel copies) | Plugins have no path to contribute new biomes. |
| 4 | **`initEntityModels()` Hyperia-coupled, runs always** | `useEditorWorldSync.ts:88` calls it; `GameWorldAssets.ts:543` fetches Hyperia manifests. | Blank projects load Hyperia GLBs regardless of plugins. |
| 5 | **Zero non-Hyperia asset packs or plugins shipped** | All packs are `@hyperforge/asset-pack-hyperia-*-v1` | "Compose from packs" is theoretical until a second author ships content. |
| 6 | **Plugin contributions don't extend procgen** | `manifest-schema/src/plugin.ts` | `entityTypes[]` exists but no `biomes` / `vegetationProfiles` / `terrainPresets`. |
| 7 | **Two parallel asset-loading systems** | `assetRefResolver` + `loadModelForScene` (pack-aware) vs `tryLoadEntityModel` + `initEntityModels` (Hyperia-manifest-aware) — `editorMarkers.ts:265` | Agent placements fall through to the Hyperia path when assetRef is absent. |
| 8 | **Onboarding system prompt teaches Hyperia thinking** | `agent-server/src/handler.ts:138` | "Hyperia ships 3 biome types: ..." baked into a 2000+-line static megaprompt that doesn't branch on `templateId` / `plugins`. |
| 9 | **Static plugin imports in `pluginBoot.ts`** | `asset-forge/src/pie/pluginBoot.ts:34-50` | `combatManifest`, `skillsManifest`, `hyperscapeManifest`, factories — hardcoded `import`s. `pluginBoot.ts:80-100` has a hardcoded `switch(gameId)`. |
| 10 | **Agent vocabulary gaps** | `eliza-game-builder/src/actions/` | `PROPOSE_TOWN`, `PROPOSE_PATH`, `PROPOSE_WATER_BODY`, `PROPOSE_MUSIC_ZONE`, `PROPOSE_AMBIENT_ZONE`, `PROPOSE_MINE`, `PROPOSE_WILDERNESS_BOUNDARY` not implemented. |
| 11 | **Plugin-contributable property panels not implemented** | `PropertiesPanel.tsx` | 16 hardcoded Hyperia editor components. |

### Layer B — engine / server / client / procgen (the deeper bake)

| # | Pinch point | File | Effect |
|---|---|---|---|
| 12 | **Login/auth fields embedded in engine `Player` type** | `shared/src/types/entities/player-types.ts:30-90` (`hyperiaPlayerId`, `hyperiaLinked`, `hyperiaUserName`, `hyperiaUserRoles`, `fromPlayerRow(hyperiaPlayerId)`) | The "engine" is not engine-shaped — auth is welded into core types. A second game inherits Hyperia's auth model whether it wants it or not. |
| 13 | **Database schema columns are Hyperia-specific** | `shared/src/types/network/database.ts` (`hyperiaUserId`, `hyperiaLinked`) | Same as #12 at the persistence layer. |
| 14 | **`BiomeType` enum hardcoded at engine level** | `shared/src/world/world.d.ts:18-20` (`Tundra \| Forest \| Canyon`); `MineBiomePalette` has `readonly forest`, `readonly tundra` | Even if asset-forge fixed its parallel copies (#3), the engine still constrains procgen to 3 biomes. |
| 15 | **`GrassWorker` hardcodes 3-biome blending** | `shared/src/utils/workers/GrassWorker.ts:90-120` (`_TUNDRA_GRASS`, `_FOREST_GRASS`, `_CANYON_SAND` constants; `blendBiome()` takes 3 args) | Adding a desert/swamp biome requires editing the worker — biomes can't be a registry-driven contribution. |
| 16 | **`LeafShape` enum has oak-specific shapes** | `procgen/src/geometry/LeafMaterialTSL.ts:59-66` (`SpikyOak`, `RoundedOak`) | Leaf shaders assume Hyperia's tree species. |
| 17 | **18 tree-species presets are static TypeScript** | `procgen/src/params/presets.ts:158-230` (Black Oak, Cambridge Oak, Weeping Willow, etc.) | Vegetation species can't be plugin-contributed; adding a palm tree requires editing the procgen package. |

### Layer C — server boot, client HUD, agent surface, scaffolding

| # | Pinch point | File | Effect |
|---|---|---|---|
| 18 | **`bootServerPlugins` ignores `project.plugins`** | `server/src/startup/world.ts:149`, `server/src/startup/plugins.ts:216-305` | Server uses a hardcoded gameId switch; project's declared plugins are ignored. Server-side contribution path is broken. |
| 19 | **Server has no plugin tick / packet hooks** | `server/src/systems/GameTickProcessor.ts:6-12` (NPC-first tick order, "OSRS combat feel" comment, hardcoded `processNPCCombatTick()` + `mobMovement: MobTileMovementManager`) | Plugins can declare entity types; they cannot register tick systems or packet handlers. A second game can't add custom server logic without forking. |
| 20 | **Client HUD is 27 hardcoded panels** | `client/src/game/interface/InterfacePanels.tsx` | No registry; plugins cannot contribute panels. Blank projects render all 27 (empty). |
| 21 | **Hardcoded `KNOWN_PLUGINS` list in agent action** | `eliza-game-builder/src/actions/listPlugins.ts:48-68` | The agent's `LIST_PLUGINS` returns 2 entries (Hyperia, shooter-demo) — pulling from a const array, not from `PluginRegistryService`. The registry is window-dressing for the agent surface too, not just for PIE. |
| 22 | **`plugin-scaffolder` defaults are Hyperia-shaped** | `plugin-scaffolder/src/scaffoldWidget.ts:12-13` (`DEFAULT_WIDGETS_DIR = "packages/hyperscape-plugin/src/widgets"`) | Scaffold a widget without overrides → it lands inside the Hyperia plugin. |
| 23 | **`plugin-scaffolder` only supports widget scaffolding** | `plugin-scaffolder/src/index.ts` | No `scaffoldPlugin()`, `scaffoldSystem()`, `scaffoldEntity()`, `scaffoldManifestSchema()`. Cannot scaffold a starter plugin.json or system. |

### Layer D — declared-but-unread contribution surface (the worst kind)

| # | Pinch point | File | Effect |
|---|---|---|---|
| 24 | **Plugin manifest contributions are informational-only** | `manifest-schema/src/plugin.ts`; consumed only by `gameplay-framework/src/snapshot.ts:143-150` (counts) | `plugin.json` declares `entityTypes`, `widgets`, `manifestSchemas`, `paletteCategories`, `toolbarTools`, `commands` — runtime never reads them. They populate a debug snapshot, nothing else. Plugins register via `onLoad`/`onEnable` callbacks, so the manifest is documentation pretending to be substrate. |
| 25 | **`bindAllWidgets` has no plugin hook** | `ui-widgets/src/bindings.ts:54-71` | The 15 builtin widget components are hardcoded; a plugin cannot contribute new widget React components through any registered path. |
| 26 | **`ui-widgets` styling is Hyperia-locked** | `InventoryWidget.tsx:50-63` (hardcoded `PANEL_BG`, `OSRS-yellow quantity badge`); `EquipmentWidget.tsx:14` (`OSRS paperdoll figure`); `PrayerWidget.tsx:50-77` (hardcoded prayer ids `thick_skin`, `burst_of_strength`); `widgetStyles.ts` (Hyperia dark palette baked in) | Migrated widgets are Hyperia-shaped. A second game gets Hyperia's color scheme, slot sizes, OSRS prayer names whether it wants them or not. |
| 27 | **`shared` self-identifies as the Hyperia engine** | `shared/src/index.ts:1-5` ("Hyperia 3D multiplayer game engine"); `shared/src/types/index.ts` (`HyperiaError`, `PlayerError`, `ItemError`); `shared/src/types/rendering/three-extensions.d.ts` (dead `HyperiaObject3D` type) | Branding bake-in. Affects discoverability and signals to newcomers that "shared = the Hyperia engine" instead of "shared = the engine that Hyperia runs on." |

---

## Cleanup phases, priority order

### P1 — **Honest config naming + project-aware merge base** (S, ~1 day)

Smallest-most-leveraged move. Fixes the immediate user complaint
("AI worlds look exactly like Hyperia") with zero substrate
risk.

Three named configs:
- `BLANK_CREATION_CONFIG` — terrain only, no vegetation, no
  towns. (Current shape, kept.)
- `MINIMAL_CREATION_CONFIG` — procgen biomes + vegetation
  enabled with engine-default settings (NOT Hyperia tree
  species, NOT hamlet/village/town presets). `townCount: 0`.
  The new default for AI-built worlds.
- `HYPERIA_CREATION_CONFIG` — current `DEFAULT_CREATION_CONFIG`,
  renamed. Used **only** when `templateId === "hyperia"` or
  `plugins.includes("@hyperforge/hyperscape")`.

`DesignWithAIDialog.buildWorld` and `WorldStudioCompanion`'s
terrain handler choose the merge base based on
`project.plugins`. Hyperia plugin → Hyperia config; else →
MINIMAL.

**Files**: `WorldBuilder/types.ts:1442-1510`,
`DesignWithAIDialog.tsx:1579`, `WorldStudioCompanion.tsx:271`.

**Note**: until P3 ships (plugins contribute biomes), MINIMAL
will still produce tundra/forest/canyon biomes because
`GAME_BIOME_DEFINITIONS` is hardcoded. P1 is honest about this:
the tree species + town styles + island preset stop being
forced; biomes are still Hyperia until P3.

### P2 — **Replace 3-element plugin enum with registry path** (M, ~3 days)

Delete `GamePluginSetId`. Make `getPluginModules` accept
`string[]` and resolve each id through `PluginRegistryService` to
a loadable module. Drop the static imports of `combatManifest` /
`hyperscapeManifest` from `pluginBoot.ts` — replace with dynamic
`import()` of each plugin's entry per the manifest's `main`
field. After this, `PROPOSE_PLUGIN_SET ["@hyperforge/plugin-hello-reference"]`
actually boots that plugin in PIE.

**Files**: `pie/pluginBoot.ts`, `gamePluginResolver.ts`,
`usePIESession.ts:784`.

### P3 — **Plugin-contributable biomes + vegetation** (L, ~1–2 weeks)

Extend `plugin.json` `EntityTypeContributionSchema` with
optional `biomes: BiomeContribution[]` and `vegetationProfiles:
VegetationProfile[]`. `BiomeRegistry` +
`VegetationProfileRegistry` (mirroring asset-pack registry
pattern) populated from active plugins. `GAME_BIOME_DEFINITIONS`
becomes the union of installed plugins' biome contributions,
with a tiny engine-default set (1 generic biome) for blank-no-
plugins projects.

**Files**: `manifest-schema/src/plugin-contribution.ts`,
`procgen/terrain/BiomeSystem`, `GameTerrainAdapter.ts`,
`worldGeneration.ts`, `hyperscape-plugin/plugin.json`.

### P4 — **Make `initEntityModels` plugin-aware (or replace with pack-aware)** (M, ~3–5 days)

Drop the unconditional Hyperia-manifest fetches.
`useEditorWorldSync` reads `project.plugins[]` and
`project.assetPacks[]`; for each plugin, ask the plugin's
contribution manifest which manifests/packs it owns; load only
those. Or unify on the pack path entirely: every entity
placement carries `assetRef`, and `editorMarkers` resolves
exclusively through `assetRefResolver`. The Hyperia
`initStationModels` etc. become an internal detail of the
Hyperscape plugin.

**Files**: `useEditorWorldSync.ts:88`, `GameWorldAssets.ts:540`,
`editorMarkers.ts:265`.

### P5 — **Project-scoped engine data load** (S, ~1 day)

`HYPERFORGE_DISABLE_ENGINE_DATA_LOAD=1` is a per-deploy env
flag today. Make it project-scoped: when the loaded project
doesn't include `@hyperforge/hyperscape` in plugins, the engine
doesn't load Hyperia manifests. Effectively: blank projects get
truly empty registries.

**Files**: `packages/server/src/startup/world.ts`,
`DataManager.ts:850-880`.

### P6 — **Plugin-aware onboarding prompt** (S, ~1 day)

Today: "Hyperia ships 3 biome types." Should be: "the installed
plugins provide these biomes: ... If none meet the user's
request, suggest installing a different plugin or pack." Make
the prompt query `LIST_PLUGINS` + `LIST_ASSET_PACKS` results to
populate its own context dynamically.

**Files**: `agent-server/src/handler.ts:75-200`.

### P7 — **One real second pack and one real second plugin** (M, ~5 days)

Acceptance test for P1–P6. A "tropical-sandbox" content kit:
trees + rocks + fish in pack form
(`@hyperforge/asset-pack-tropical-v1`); a
`@hyperforge/plugin-tropical-sandbox` declaring its own entity
types + biome (one beach + one jungle) + vegetation profile.
Without this acceptance test, P1–P6 are theoretical.

### P8 — **Close the agent action vocabulary gaps** (M each, ~2 weeks total)

`PROPOSE_TOWN`, `PROPOSE_WATER_BODY`, `PROPOSE_MUSIC_ZONE`,
`PROPOSE_AMBIENT_ZONE`, `PROPOSE_MINE`,
`PROPOSE_WILDERNESS_BOUNDARY`. Mechanical now that P0+P1 of
agent-studio-parity shipped. Pure additive to
`eliza-game-builder/src/actions/`.

### P9 — **Plugin-contributable property panels** (L, ~2 weeks)

JSON-Schema-driven panel renderer in `PropertiesPanel.tsx`.
Required so non-Hyperia entity types are editable. Aligns with
`PLAN_AGENT_STUDIO_PARITY.md` Phase P4.

### P10 — **Wire the declared-but-unread plugin contribution surface** (M, ~5 days) — pinch points #24, #25

The substrate's biggest lie. `plugin.json` contributions
(`entityTypes`, `widgets`, `manifestSchemas`, `paletteCategories`,
`toolbarTools`, `commands`) are validated, stored, snapshotted —
and never read at runtime. Plugins register via callbacks
instead. Two effects: (a) the manifest pretends to be the
substrate but isn't, (b) tooling that walks the manifest sees
contributions that don't exist or vice versa.

This phase makes the manifest authoritative:

- A `PluginContributionRegistry` reads `plugin.contributions.*`
  arrays at plugin onLoad and registers each one against the
  appropriate runtime registry (widgets → `WidgetRegistry`,
  entityTypes → entity-type registry, paletteCategories →
  editor palette, toolbarTools → toolbar slot, commands →
  `CommandRegistry`).
- `ui-widgets/bindings.ts` exposes `registerPluginWidgets(registry, widgets[])`
  and the boot path calls it after `bindAllWidgets` for every
  active plugin.
- Tests assert that a plugin declaring a `widgets` contribution
  in plugin.json renders that widget when its UI pack is active,
  without that plugin needing imperative registration code.

**Files**: `gameplay-framework/src/lifecycle.ts`,
`ui-widgets/src/bindings.ts`, `manifest-schema/src/plugin.ts`,
`hyperscape-plugin/src/index.ts` (consumer).

### P11 — **Server- and client-side plugin extension hooks** (L, ~2 weeks) — pinch points #18, #19, #20

Today plugins are an editor-side abstraction. They register
nothing on the server tick and nothing on the client HUD because
no hooks exist.

- **Server**: `bootServerPlugins(world, project)` reads
  `project.plugins[]`, dynamically imports each plugin's server
  entry, and exposes hooks on a `ServerPluginContext`:
  `registerTickSystem(name, system)`, `registerPacketHandler(opcode, fn)`,
  `registerSaveColumn(name, schema)`. `GameTickProcessor` becomes a
  generic dispatcher iterating registered systems instead of
  hardcoding "NPCs first → Players."
- **Client**: `client/src/game/interface/InterfacePanels.tsx`
  becomes a registry walk (`pluginPanelRegistry.list()`) instead
  of 27 hardcoded imports. Plugins register panels via `clientPluginContext.registerPanel(id, component)`.

**Files**: `server/src/startup/plugins.ts`,
`server/src/systems/GameTickProcessor.ts`,
`client/src/game/interface/InterfacePanels.tsx`, plus the plugin
context type in `gameplay-framework`.

### P12 — **Detangle login / auth from engine types** (M, ~5 days) — pinch points #12, #13, #27

`shared/src/types/entities/player-types.ts` has `hyperiaPlayerId`,
`hyperiaLinked`, `hyperiaUserName`, `hyperiaUserRoles`,
`fromPlayerRow(hyperiaPlayerId)`. The DB schema has the matching
columns. These are auth/login fields, not engine primitives.

Move them into `@hyperforge/auth-bridge` (or similar). The engine's
`Player` type carries an opaque `externalAccountId?: string` and
nothing else. Hyperia plugin's onEnable reads/writes its
hyperia-specific fields via that bridge. Drop the
`HyperiaError`/`PlayerError`/`ItemError` class names — they're not
typed errors, just stringly-prefixed marketing. Update
`shared/src/index.ts` header from "Hyperia 3D multiplayer game
engine" to "HyperForge engine substrate."

**Files**: `shared/src/types/entities/player-types.ts`,
`shared/src/types/network/database.ts`, `shared/src/index.ts`,
`shared/src/types/index.ts`, plus a new `auth-bridge` package or
folder.

### P13 — **Style + content-driven `ui-widgets`** (M, ~5 days) — pinch point #26

The 15 migrated widgets bake Hyperia palette/sizing/content into
RGBA constants and JSX. Three changes:

- Replace constants with `theme` token reads (`themeToCssVars()`
  exists; widgets must call it).
- Drop hardcoded fallback content (e.g.,
  `PrayerWidget.tsx:50-77`'s `thick_skin`, `burst_of_strength`
  rows). Empty data → empty widget; a widget without data is a
  bug for the consumer to fix, not for the widget to paper over.
- Strip `OSRS-yellow`, `OSRS paperdoll`, `Matches gameUI.actionBar
  tokens` comments and the values they describe — replace with
  the actual token reads they advertise.

**Files**: `ui-widgets/src/widgets/*.tsx`,
`ui-widgets/src/widgetStyles.ts`.

### P14 — **`plugin-scaffolder` for plugins, systems, entities** (M, ~5 days) — pinch points #22, #23

Today the scaffolder writes widget files only and defaults their
target to `packages/hyperscape-plugin/src/widgets`. Two changes:

- Drop the Hyperia-shaped default. Callers must pass the target
  plugin path; the scaffolder refuses if missing.
- Add `scaffoldPlugin(spec)` (emits a starter `plugin.json` +
  `index.ts` + factory + manifest), `scaffoldSystem(spec)`,
  `scaffoldEntity(spec)`, `scaffoldManifestSchema(spec)`.
  Wire one onboarding action (`PROPOSE_NEW_PLUGIN`) that
  invokes `scaffoldPlugin` so the agent can author plugins
  during a Design with AI session.

**Files**: `plugin-scaffolder/src/scaffoldWidget.ts`,
`plugin-scaffolder/src/scaffoldPlugin.ts` (new), agent action.

### P15 — **`PluginRegistryService` is the single source of truth for the agent** (S, ~1 day) — pinch point #21

Replace `eliza-game-builder/src/actions/listPlugins.ts:48-68`'s
hardcoded `KNOWN_PLUGINS` with a runtime call to
`PluginRegistryService.listPlugins()` (already implemented in
asset-forge per memory 19881). The agent then sees whatever is
on disk, not whatever was hand-curated. This is a 1-day swap once
the service is reachable from the agent process.

**Files**: `eliza-game-builder/src/actions/listPlugins.ts`,
`agent-server/src/handler.ts` (passes registry to action context).

---

## Sequencing principle

**Round 1 — surface fixes (P1, P15, P5)** that cost <2 days each
and make the AI's behavior visibly different. P1 (named configs)
makes the merge base honest; P15 (real plugin list) makes the
agent see all plugins; P5 (project-scoped engine load) stops
Hyperia data from leaking into blank projects.

**Round 2 — substrate plumbing (P2, P10, P12)** turns the
manifest from documentation into substrate. P2 makes the plugin
enum a registry. P10 reads `plugin.contributions.*` at runtime.
P12 detangles auth from engine types. After this round, the
substrate matches the manifest's claims.

**Round 3 — extension surface (P3, P4, P9, P11, P13)** enables
plugins to actually shape the engine. Biomes (P3), assets (P4),
property panels (P9), server/client hooks (P11), styled widgets
(P13). After this, a plugin's contribution surface is real.

**Round 4 — polish + scaffolding (P6, P14, P8)** makes plugins
authorable from the AI surface. Prompt-aware (P6),
scaffoldable (P14), broader agent vocabulary (P8).

**Round 5 — acceptance test (P7)** ships a real second plugin +
second pack and proves the framework promise.

P1 first. It's the smallest move that immediately makes the
user's complaint go away (AI worlds stop looking exactly like
Hyperia). After P1, every other Hyperia leak becomes a concrete
bug to fix rather than "the substrate has Hyperia in it."

P15 + P5 are 1-day independent wins that should ship alongside P1.

---

## Success metric

A user (or AI) starts a New Project, picks Design with AI,
asks for a "tropical pirate sandbox":

- Agent picks `@hyperforge/plugin-tropical-sandbox` (P2).
- Agent installs `@hyperforge/asset-pack-tropical-v1` (existing).
- Agent emits `PROPOSE_TERRAIN_CONFIG` with archipelago preset +
  the tropical plugin's biomes (P3).
- Agent emits PROPOSE_NPC_PLACEMENT, PROPOSE_MOB_SPAWN, etc.
  with assetRefs from the tropical pack.
- World renders with palm trees, beaches, jungle biomes, pirate
  NPCs — visibly distinct from Hyperia.

When that flow works end-to-end, the framework's promise is real.

---

## What this plan does NOT cover

- Live AI testing beyond manual smoke. Each phase ships with
  unit tests of the contracts; a worked-example session log is
  P7's responsibility.
- Federation / cross-team plugin distribution. The local
  monorepo is sufficient until external contributors arrive.
- Multi-agent coordination, version management of plugins,
  marketplace policies.
- Anything in `PLAN_AGENT_STUDIO_PARITY.md` past P0+P1 (towns,
  water bodies, audio zones, etc.) — those are additive and not
  blocking the decoupling.
