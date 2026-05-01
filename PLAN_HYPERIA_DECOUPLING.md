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

- **Project-as-data**: typed `config` / `plugins` /
  `worldContent` columns. `WorldProjectService`,
  `world-projects.schema.ts`. B0'.A complete.
- **Plugin registry**: 5 plugins discoverable from monorepo +
  `node_modules/@hyperforge/`. `PluginRegistryService.ts`.
- **Asset pack ecosystem**: schema, DB, marketplace UI, browser,
  WebGPU thumbnails, 10 Hyperia category packs (~142 assets).
  `AssetPackService.ts`, `seed-hyperia-asset-pack.ts`.
- **Agent action surface**: 15 PROPOSE_* actions (terrain,
  plugin set, asset pack install, NPC, mob spawn, resource,
  station, teleport, road, POI, danger source, zone, quest,
  asset, UI pack). `eliza-game-builder/src/actions/`.
- **Agent ↔ studio data unification (P0+P1)**: `extendedLayers`
  is the single store; bidirectional WorldArea↔Placed mappers;
  `useAgentPlacementDispatcher`; outliner color-codes by
  `source`. PROGRESS_AUDIT REFRESH 15.
- **Templates: 2 (`blank` + `hyperia`)** —
  `ProjectTemplateService.ts`.
- **Agent terrain regen**: `PROPOSE_TERRAIN_CONFIG` triggers
  `generateWorldFromConfig` + `actions.loadWorld`. Deep-merge
  via `mergeProcgenConfig`.
- **HYPERFORGE_DISABLE_ENGINE_DATA_LOAD env flag** — lets blank
  projects boot without the engine-side Hyperia manifest load.
  `DataManager.ts:850-880`.

This represents 8–10 months of legitimate substrate work. It is
not the problem.

---

## The pinch points (where Hyperia is baked in below the substrate)

| # | Pinch point | File | Effect |
|---|---|---|---|
| 1 | **3-element plugin enum** | `gamePluginResolver.ts:30` (`type GamePluginSetId = "blank" \| "hyperscape" \| "shooter-demo"`) | `PROPOSE_PLUGIN_SET` writes arbitrary npm ids; PIE only knows how to boot 3. The plugin registry is window-dressing for a hardcoded switch. |
| 2 | **`DEFAULT_CREATION_CONFIG` is Hyperia, misnamed "default"** | `WorldBuilder/types.ts:1442` | Sets `useGamePipeline: true`, `preset: "large-island"`, full Hyperia town + biome + vegetation configs. Every "new world" gets pasted under this. The 5e5aad816 fix made AI-built worlds use this as the base. |
| 3 | **`GAME_BIOME_DEFINITIONS` hardcoded (tundra/forest/canyon)** | `GameTerrainAdapter.ts:49`, `GameWorldContext.ts:203` (parallel copies) | Plugins have no path to contribute new biomes. Agent prompt literally says "Hyperia ships 3 biome types: tundra, forest, canyon." |
| 4 | **`initEntityModels()` Hyperia-coupled, runs always** | `useEditorWorldSync.ts:88` calls it; `GameWorldAssets.ts:543` fetches Hyperia-specific manifests. | Blank projects load Hyperia GLBs into the entity model cache regardless of plugins installed. The 5e5aad816 fix made this run unconditionally. |
| 5 | **Zero non-Hyperia asset packs or plugins** | All packs are `@hyperforge/asset-pack-hyperia-*-v1` | "Compose from packs" is theoretical until a second author ships content. |
| 6 | **Plugin contributions don't extend procgen** | `plugin.json` schema | `entityTypes[]` exists but no `BiomeContribution` / `VegetationContribution` / `TerrainPresetContribution`. Plugins can't contribute biomes, vegetation profiles, or terrain shapes. |
| 7 | **Two parallel asset-loading systems** | `assetRefResolver` + `loadModelForScene` (pack-aware) vs `tryLoadEntityModel` + `initEntityModels` (Hyperia-manifest-aware) — `editorMarkers.ts:265` | Don't share state. Agent placement falls through to Hyperia path when assetRef is absent. |
| 8 | **Onboarding system prompt teaches Hyperia thinking** | `agent-server/src/handler.ts:147` | "Hyperia ships 3 biome types: ..." Prompt is honest about the substrate constraint, but the constraint shouldn't exist. |
| 9 | **Static plugin imports in `pluginBoot.ts`** | `packages/asset-forge/src/pie/pluginBoot.ts:1-30` | `combatManifest`, `skillsManifest`, `hyperscapeManifest`, `combatPluginFactory`, etc. are hardcoded `import`s. Dynamic federation hasn't started. |
| 10 | **Agent vocabulary gaps** | `eliza-game-builder/src/actions/` | `PROPOSE_TOWN`, `PROPOSE_PATH`, `PROPOSE_WATER_BODY`, `PROPOSE_MUSIC_ZONE`, `PROPOSE_AMBIENT_ZONE`, `PROPOSE_MINE`, `PROPOSE_WILDERNESS_BOUNDARY` not implemented. `PLAN_AGENT_STUDIO_PARITY.md` P2/P3/P5/P6. |
| 11 | **Plugin-contributable property panels (P4) not implemented** | `PropertiesPanel.tsx` | Plugins can declare `entityTypes[]` but not the editor for them. 16 hardcoded Hyperia editor components. |

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

---

## Sequencing principle

P1 first. It's the smallest move that immediately makes the
user's complaint go away (AI worlds stop looking exactly like
Hyperia). It also makes the next moves more visible: once
MINIMAL is the AI default, every Hyperia leak (hardcoded biomes,
hardcoded entity models) becomes a concrete bug to fix rather
than "the substrate has Hyperia in it."

P2 + P5 are independent quick wins.

P3 + P4 are the architectural unlock — after these, plugins
genuinely extend the engine's capabilities, and "compose a game
from building blocks" becomes mechanically possible instead of
vocabulary.

P7 is the acceptance test. Until a second pack + second plugin
exist, P1–P6 are theoretical claims.

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
