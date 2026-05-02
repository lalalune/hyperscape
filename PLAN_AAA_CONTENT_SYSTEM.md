# AAA Content System — single delivery unit, zero engine opinions

**Status:** 2026-05-02 · supersedes `PLAN_PACK_TYPES.md`
**Branch:** `feat/world-studio`

## Why this supersedes PLAN_PACK_TYPES

`PLAN_PACK_TYPES.md` introduced 5 atomic pack types (`AssetPack`,
`BiomePack`, `TerrainPack`, `WaterPack`, `VegetationPack`) plus a
rich `ProjectPack`. We shipped Phase 1 (schemas), Phase 2 (DB
tables + columns), and most of Phase 3 (registries + biome pack
end-to-end pipeline) — six commits, ~1,800 LOC.

Then we asked the right question: **"how would UE5 / Unity do
this?"**

Both engines converge on a different shape:

- **One delivery unit** (UE5 Plugin / Unity Package) ships any
  combination of content categories. There's no "biome plugin"
  vs "terrain plugin" — a plugin can carry materials, foliage
  types, landscape layers, scripts, all in one package.
- **The engine itself ships zero opinionated content.** UE5
  has no built-in "Forest" biome. Unity has no built-in tree
  species. Blank project = blank world. Templates are
  pre-populated starting points, not enforced.
- **Asset-type pluralism, not pack-type pluralism.** The leverage
  comes from having 100+ first-class asset types (`UMaterial`,
  `UFoliageType`, `ULandscapeLayerInfoObject`, …) that any
  plugin can contribute. The PACK is a delivery channel; the
  ASSET TYPES are where composability lives.

Our 5-pack-type scheme is more granular than UE5/Unity. That
granularity has real costs (5 services, 5 routes, 5 tables,
5 registry modules, authors learning 5 schemas) and the
benefits (independent install, independent versioning) come
back for free in the unified shape — an author can ship a
"biomes-only" content pack at the authoring level, without us
needing 5 distinct schema types to support it.

The most AAA thing here is to align with the converged
industry pattern. This plan does that.

## Decision: one `ContentPack`, zero engine content

### The unified schema

```ts
ContentPack {
  // Identity
  id: PackId            // npm-style; globally unique
  name: string
  description: string
  packVersion: string   // semver
  author: PluginAuthor
  license: string
  tags: string[]        // free-form, marketplace filters by these
  version: 1            // schema version

  // Typed content sections — all optional; any combination
  assets?:                  AssetEntry[]
  biomes?:                  BiomeContribution[]
  terrainShaders?:          TerrainShaderRecipe[]
  terrainHeightmapPresets?: TerrainHeightmapPreset[]
  terrainNoiseFunctions?:   TerrainNoiseFunction[]
  waterShaders?:            WaterShaderRecipe[]
  waterAnimations?:         WaterAnimationProfile[]
  vegetationSpecies?:       VegetationSpecies[]
  vegetationDensityRules?:  VegetationDensityRule[]
  procgenTreeRecipes?:      ProcgenTreeRecipe[]   // 18 procgen presets
  // Future sections: materials[], particles[], lightingProfiles[],
  //                  uiPacks[], dialogueScripts[], …
}
```

The constituent section schemas (`BiomeContribution`,
`TerrainShaderRecipe`, `VegetationSpecies`, …) are exactly
what we shipped in `PLAN_PACK_TYPES` Phase 1 — we keep them
unchanged. Only the outer wrapper changes: instead of 5 wrapper
schemas, one `ContentPackManifestSchema` with 11 optional
section fields.

### What the engine ships

**Nothing opinionated.** Specifically:

- No `GAME_BIOME_DEFINITIONS` — drop the constant from
  `GameTerrainAdapter.ts` (client) and `GameWorldContext.ts`
  (server). Replace with `{}`.
- No hardcoded tree species in `procgen/src/params/presets.ts`
  — drop the 18 named exports; procgen reads from a registry
  populated by installed content packs.
- No hardcoded 3-channel `TerrainShaderTSL` — engine ships a
  generic N-channel shader recipe ("default-flat-color") that
  composites whatever biome colors the active biomes register.
  Stylized shaders ship in content packs.
- No hardcoded water shader — engine ships a neutral default
  ("default-water-flat") that returns a blue plane.
- No hardcoded `HYPERIA_GAME_WORLD_CONFIG` fallback in
  `useProjectLoader` — projects that load with no plugins/packs
  get an empty world config (procgen defaults).

A blank project boots, terrain is gray, no foliage, no biome
zones. The biome painter shows zero biomes ("install a content
pack to add biomes"). This is identical to creating a blank
UE5 or Unity project — the user is expected to install/import
content to populate the world.

### Hyperia as a content pack

Hyperia ships as `@hyperforge/content-pack-hyperia-v1` carrying:

- 3 biomes (tundra/forest/canyon)
- 1 terrain shader recipe (`recipeId: "tsl-three-biome"` —
  basically the current TSL shader rewrapped)
- 1 water shader recipe (current water shader rewrapped)
- 18 procgen tree recipes (extracted from
  `procgen/src/params/presets.ts`)
- N vegetation density rules (per-biome scatter rules)
- The 10 split asset packs (already exist as separate
  `asset_packs` rows; can either roll them in here or keep
  them as separate `ContentPack`s referenced by a
  `ProjectPack`)

A "Hyperia template" project is just a new project with
`contentPacks: ["@hyperforge/content-pack-hyperia-v1"]`
pre-installed. The user can uninstall it; the project becomes
blank (engine has no Hyperia code to fall back to).

### Templates are starting points

Mirror UE5/Unity:

- **Blank** → `contentPacks: []`
- **Hyperia** → `contentPacks: ["@hyperforge/content-pack-hyperia-v1"]`
- **Shooter Demo** → `contentPacks: ["@hyperforge/content-pack-shooter-demo-v1"]`
- **Tropical Sandbox** → `contentPacks: ["@hyperforge/content-pack-tropical-v1"]`

Switching templates is just installing/uninstalling packs.
Templates collapse from "a special project type" to "a
bookmarked set of pack ids."

### ProjectPack — still useful, just leaner

A `ProjectPack` remains the "fork an entire game" surface:

```ts
ProjectPack {
  // Identity (same header)
  id, name, description, version, author, license, tags

  pluginIds:      string[]   // gameplay plugins
  contentPackIds: string[]   // ← single ref array, was 5
  initialConfig?:        ProjectConfig
  initialWorldContent?:  ProjectWorldContent
}
```

`@hyperforge/project-pack-hyperia-v1` references the Hyperia
gameplay plugin + the Hyperia content pack(s) + an initial
config snapshot. Forking calls `ProjectPackService.fork(packId)`
which installs the refs + applies snapshots.

## Composability rules

- **Multiple content packs of the same section compose by
  id-merge.** Two packs both contributing a `forest` biome:
  last-installed-wins on collision (mirrors today's plugin biome
  registry semantics). The marketplace UI can warn on conflict.
- **Cross-section compose freely.** A pack contributing only
  biomes, a pack contributing only terrain shaders, a pack
  contributing both — all coexist. The registry merges per
  section independently.
- **Plugin contributions stay.** A gameplay plugin's
  `plugin.json` `contributions.biomes` continues to feed the
  same registry. Plugin contributions still win on id collision
  (gameplay-driving biomes feed mob-spawn rules; visual content
  packs lose to plugins on the same id).
- **ProjectPack overrides defaults but doesn't lock them.**
  Installing `@hyperforge/project-pack-hyperia-v1` brings
  Hyperia's content packs + plugins. The user can then install
  an additional content pack (e.g. `@hyperforge/content-pack-tropical-v1`)
  and the tropical biomes layer on top.

## Migration from current state

Six commits to walk back partially. None of it is throwaway —
the section schemas we wrote in `PLAN_PACK_TYPES` Phase 1 are
exactly what we keep; only the outer wrappers change.

### Step A — schema unification (manifest-schema package)

| File | Action |
|---|---|
| `pack-header.ts` | Keep as-is. Reused by `ContentPackManifestSchema` and `ProjectPackManifestSchema`. |
| `asset-pack.ts` | Refactor `AssetPackManifestSchema` → `ContentPackManifestSchema` with all 11 optional sections. Keep `AssetPackEntrySchema` and `AssetTypeSchema` as section types. Add deprecated `AssetPackManifestSchema` alias for one cut to ease migration. |
| `biome-pack.ts` | Drop. Section schemas (`BiomePackEntrySchema`) move into the unified `ContentPack`. |
| `terrain-pack.ts` | Drop. Section schemas (`TerrainShaderRecipeSchema`, `TerrainHeightmapPresetSchema`, `TerrainNoiseFunctionSchema`) keep their identity, become sections. |
| `water-pack.ts` | Drop. Section schemas keep identity. |
| `vegetation-pack.ts` | Drop. Section schemas keep identity. Add `ProcgenTreeRecipeSchema` for the 18 hardcoded presets. |
| `project-pack.ts` | Replace 5 separate `*PackIds[]` arrays with single `contentPackIds[]`. |
| `index.ts` | Adjust barrel exports. |

### Step B — DB collapse (asset-forge package)

Migration `0012_content_packs_collapse.sql`:

```sql
-- Drop the 4 tables we created in 0011 (no rows yet).
DROP TABLE IF EXISTS biome_packs;
DROP TABLE IF EXISTS terrain_packs;
DROP TABLE IF EXISTS water_packs;
DROP TABLE IF EXISTS vegetation_packs;

-- Drop the 4 columns we added to world_projects in 0011 (still empty arrays).
ALTER TABLE world_projects DROP COLUMN IF EXISTS biome_packs;
ALTER TABLE world_projects DROP COLUMN IF EXISTS terrain_packs;
ALTER TABLE world_projects DROP COLUMN IF EXISTS water_packs;
ALTER TABLE world_projects DROP COLUMN IF EXISTS vegetation_packs;

-- Rename asset_packs → content_packs (semantic alignment with
-- what the table actually stores).
ALTER TABLE asset_packs RENAME TO content_packs;
ALTER TABLE world_projects RENAME COLUMN asset_packs TO content_packs;

-- Existing indexes auto-rename via PostgreSQL's IF NOT EXISTS
-- + idempotent rename-on-conflict semantics. Verify
-- idx_asset_packs_* indexes follow the rename — re-create if
-- they don't.
ALTER INDEX IF EXISTS idx_asset_packs_team RENAME TO idx_content_packs_team;
ALTER INDEX IF EXISTS idx_asset_packs_source RENAME TO idx_content_packs_source;
ALTER INDEX IF EXISTS idx_asset_packs_public_published RENAME TO idx_content_packs_public_published;
```

Drizzle schema files:

- Drop `pack-types.schema.ts` (the 4 tables we just created).
- Rename `asset-packs.schema.ts` → `content-packs.schema.ts`,
  rename exports `assetPacks` → `contentPacks`. Update barrel.
- Update `world-projects.schema.ts` — drop the 4 new columns,
  rename `assetPacks` → `contentPacks`.

### Step C — runtime: registries collapse

Replace 2 separate registries (`pluginBiomeRegistry`,
`vegetationPackRegistry`) with **one** module:

`packages/asset-forge/src/components/WorldStudio/utils/contentRegistry.ts`

```ts
// One registry holding all content-pack-contributable types.
// Plugins still feed the biomes section via the existing
// plugin-contribution path. Content pack sections feed via
// new setters.

setPluginBiomes(c: PluginBiomeContribution[]): void
setContentPackBiomes(c: BiomeContribution[]): void
getActiveBiomes(): Map<id, BiomeDefinition>

setContentPackTerrainShaders(r: TerrainShaderRecipe[]): void
getActiveTerrainShaders(): Map<id, TerrainShaderRecipe>

setContentPackVegetationSpecies(s: VegetationSpecies[]): void
setContentPackVegetationDensityRules(r: VegetationDensityRule[]): void
getActiveVegetationSpecies(): Map<id, VegetationSpecies>
getActiveVegetationDensityRules(): Map<id, VegetationDensityRule>
getDensityRulesForBiome(biomeId): VegetationDensityRule[]

setContentPackWaterShaders(r: WaterShaderRecipe[]): void
getActiveWaterShaders(): Map<id, WaterShaderRecipe>

setContentPackProcgenTreeRecipes(r: ProcgenTreeRecipe[]): void
getActiveProcgenTreeRecipes(): Map<id, ProcgenTreeRecipe>
```

(Or, equivalently, one `setContentPackContent(unifiedSections)`
call that takes the whole pack's section bundle. Two flavors
acceptable; pick one in implementation.)

### Step D — service + route collapse

| Current | Target |
|---|---|
| `AssetPackService` | Rename `ContentPackService`. Surface is the same — list / getByManifestId / resolveByManifestIds — but consumers now read all sections, not just `.assets`. |
| `BiomePackService` | Drop. Folded into `ContentPackService`. |
| `/api/asset-packs` routes | Rename `/api/content-packs`. |
| `/api/biome-packs/installed` | Drop. The single `/api/content-packs/installed` returns full content pack manifests; the loader extracts whatever sections are present. |

The loader's `fetchBiomePacksAndRegister` becomes
`fetchContentPacksAndRegister` — one round-trip, dispatches
sections to the unified registry's setters.

### Step E — engine de-opinion

Drop these constants:

- `packages/asset-forge/src/components/WorldBuilder/GameTerrainAdapter.ts:GAME_BIOME_DEFINITIONS`
- `packages/asset-forge/server/services/GameWorldContext.ts:GAME_BIOME_DEFINITIONS`
- The `["tundra", "forest", "canyon"]` hardcoded array at `GameTerrainAdapter.ts:117`
- `biomeForestWeight` / `biomeCanyonWeight` named-field references in `terrainHelpers.ts:635-636` (genericize to indexed weights)
- `MINIMAL_CREATION_CONFIG` becomes the only default; `HYPERIA_CREATION_CONFIG` moves into the Hyperia content pack as `initialConfig` (or stays as a Hyperia-template's bookmark)
- The `HYPERIA_GAME_WORLD_CONFIG` fallback in `useProjectLoader.ts:534` — projects with no plugins/packs get empty defaults, not Hyperia ones
- The 18 named tree species exports in `procgen/src/params/presets.ts` — file shrinks to type definitions + `createTreeParams` helper. Procgen reads from registry.
- `TerrainShaderTSL`'s 3-channel hardcoding — generalize to N-channel; engine default is "neutral gray N-channel passthrough"

For each drop, the corresponding content moves into the
Hyperia content pack so Hyperia projects retain identical
behavior when the pack is installed.

### Step F — seeder

Replace `seed-hyperia-biome-pack.ts` (just shipped) with
`seed-hyperia-content-pack.ts` that produces a single
`@hyperforge/content-pack-hyperia-v1` carrying all sections:
3 biomes + 1 terrain shader + 1 water shader + 18 procgen
tree recipes + N density rules + the existing 10 asset pack
splits (or roll them in — author's call).

The existing `seed-hyperia-asset-pack.ts` either gets folded
into this or stays separate (asset entries continue to live
in `content_packs` rows; a content pack with only an `assets`
section is identical to today's asset pack).

## Phasing

### Phase A — schema + DB collapse (1 commit)

- Unify schemas in `manifest-schema` (Step A)
- Migration `0012` collapses the DB (Step B)
- Tests updated; baseline still green

This is mechanical refactoring of what we just shipped. No
runtime behavior change.

### Phase B — registry collapse (1-2 commits)

- One `contentRegistry` module (Step C)
- One `ContentPackService` + `/api/content-packs` route (Step D)
- Loader integration: one fetch, dispatches sections
- `useProjectLoader` reads `project.contentPacks[]`

Tests for the merged registry; loader integration test.

### Phase C — engine de-opinion (3-5 commits)

This is the substantive Hyperia decoupling work. Per drop:

- C1: Drop `GAME_BIOME_DEFINITIONS` (client + server). Rely on
  registry. Verify Hyperia projects still render via plugin
  contributions or Hyperia content pack.
- C2: Drop the hardcoded biome arrays in `GameTerrainAdapter`
  and `terrainHelpers`. Generalize to indexed.
- C3: Drop the 18 hardcoded tree species. Procgen reads from
  registry (cross-thread data handoff design lands here).
- C4: Generalize `TerrainShaderTSL` from 3-channel to N-channel.
  The hardest single piece — the current shader composes 3
  named biomes (forest/canyon weights). Replace with N
  indexed slots driven by the active biome registry.
- C5: Drop `HYPERIA_GAME_WORLD_CONFIG` fallback in loader.
  Blank means blank.

### Phase D — Hyperia content pack seeder (1 commit)

- `seed-hyperia-content-pack.ts` produces the unified Hyperia
  content pack with all sections.

### Phase E — `ProjectPack` rework (1 commit)

- Replace 5 `*PackIds[]` with `contentPackIds[]`.
- `ProjectPackService.fork()` first cut.

### Phase F — studio UI marketplace + install flows (4-6 commits)

- Browse content packs by tag (marketplace UI handles
  categorization — schema doesn't).
- Install / uninstall content packs from a project.
- Surface installed packs in the project's properties panel.
- Show empty-state ("install a content pack to add biomes")
  in the biome painter when no biomes are registered.

## Composability rules summary

| Source | Section | Wins on collision |
|---|---|---|
| Engine | (none) | n/a |
| Plugin contributions | biomes, entityTypes (today: also widgets, etc.) | beats content packs on biome id collision (gameplay rules win) |
| Content pack sections | biomes, terrainShaders, waterShaders, vegetationSpecies, vegetationDensityRules, procgenTreeRecipes, assets | last-installed-wins on intra-section id collision; loses to plugin contributions on the same biome id |

## Out of scope for this plan

- Marketplace billing, version pinning, semver resolution
  between content packs, sandboxed shader execution.
- TSL serialization (so authors can ship full custom shaders
  as authored assets, UE5-Material-style). The recipe DSL is
  the interim; full shader-as-asset is a future phase.
- Cross-thread procgen registry handoff — Phase C3 needs a
  data plan (procgen runs in workers; the registry currently
  lives in the main thread). Reasonable approach: pass the
  registry snapshot to workers at procgen-start time. Detailed
  design happens during C3 implementation.
- Pack signing / supply chain. Future phase.
- "Migrate Assets" UE5-style asset graph copy between
  projects. Future phase if needed.

## Acceptance test for "engine has zero opinions"

After Phase C lands, this should be true:

1. Create a blank project (no plugins, no content packs).
2. Open it in World Studio.
3. Procgen produces a generic gray island. No biome painting
   is visible. Foliage scatterer places nothing. Water is the
   neutral default. Roads/towns aren't generated unless a
   plugin contributes them.
4. Install `@hyperforge/content-pack-hyperia-v1`.
5. Re-open / re-procgen the project. Tundra / forest / canyon
   biomes appear. Terrain shader uses the Hyperia recipe.
   Water uses the Hyperia recipe. Foliage scatters Hyperia
   trees per density rules.
6. Uninstall the pack. World reverts to blank.

That's the AAA promise: blank is blank, themed worlds come
from installed content. The engine itself isn't biased toward
any specific game.

## Source plan reconciliation

| Prior plan / phase | Status under this plan |
|---|---|
| `PLAN_PACK_TYPES` Phase 1 (5 schemas) | Section schemas kept; outer wrappers replaced by unified `ContentPackManifestSchema`. |
| `PLAN_PACK_TYPES` Phase 2 (DB tables + columns) | The 4 new tables + 4 new columns dropped in migration 0012. `asset_packs` renamed to `content_packs`. |
| `PLAN_PACK_TYPES` Phase 3 first cut (biome registry, seeder, route, loader) | Replaced by `contentRegistry`, `ContentPackService`, `/api/content-packs/installed`. The biome-only path becomes a sub-case of the unified path. |
| `PLAN_PACK_TYPES` Phase 3 vegetation registry | Folded into `contentRegistry` as `getActiveVegetationSpecies` / etc. |
| `PLAN_HYPERIA_DECOUPLING` Phase 1 (DEFAULT→HYPERIA + MINIMAL config) | `MINIMAL_CREATION_CONFIG` becomes the only default. `HYPERIA_CREATION_CONFIG` moves into the Hyperia content pack's `initialConfig` (or template bookmark). |
| `PLAN_HYPERIA_DECOUPLING` Phase 4 (initEntityModels gate) | Already shipped (commit `4af002f49`). Continues to work. |
| `PLAN_MASTER` Round 5 acceptance demo | Becomes the "engine has zero opinions" acceptance test in this plan. |
