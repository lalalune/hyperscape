# Pack Types — orthogonal track architecture

**Status:** 2026-05-02 · design + first cut shipped
**Branch:** `feat/world-studio`

## Why

Today's state collapses too many concerns into too few pack types:

| Concern | Today's home | Problem |
|---|---|---|
| 3D models (NPCs, props, weapons) | `AssetPack` | works |
| Biomes (id, color, terrain knobs) | Plugin contributions only (R3.P3) | requires installing a *gameplay plugin* to get biomes; can't install just the visual theme |
| Vegetation species (oak, pine, palm) | TS code in `procgen/src/params/presets.ts` | author-time data baked into engine, not installable |
| Terrain shader look | One TSL shader in `procgen/src/terrain/TerrainShaderTSL.ts` | engine-fixed; no path to swap for stylized / voxel / photoreal |
| Water shader look | One hardcoded TSL water shader | same |
| Grass blending | `GrassWorker` 3-biome hardcoded | same |

Two projects with different **asset packs** but the same terrain shader, same water shader, same grass shader **still look like the same engine wearing different hats**. The framework promise — "different game = visibly different game" — needs more granular pack types.

## Decision: orthogonal track types + one rich ProjectPack

**Atomic pack types** — install independently, one concern each:

| Pack type | Contributes |
|---|---|
| `AssetPack` | 3D models, textures, audio (current) |
| `BiomePack` | Biome definitions (id, name, color, height range, difficulty, resource density) |
| `TerrainPack` | Terrain shader recipe + heightmap presets + noise function variants |
| `WaterPack` | Water shader recipe + animation behavior |
| `VegetationPack` | Tree species, plant types, density rules, leaf shape recipes |

These compose freely. A user can install:
- `@hyperforge/asset-pack-hyperia-trees-v1` (Hyperia tree GLB models)
- `@hyperforge/biome-pack-tropical-v1` (beach, jungle, mangrove biomes)
- `@hyperforge/terrain-pack-stylized-v1` (cell-shaded terrain)
- `@hyperforge/water-pack-cartoon-v1` (cartoon water)
- `@hyperforge/vegetation-pack-tropical-v1` (palm + banana species)

…and get a tropical world with stylized rendering, even if no Hyperia plugin is installed.

**Rich ProjectPack** — the "fork an entire game" surface:

```
ProjectPack {
  // Identifiers
  id, name, description, version, author, license, tags

  // What this pack bundles (ids — pack registry resolves them)
  pluginIds:        string[]    // gameplay plugins (combat, skills, …)
  assetPackIds:     string[]    // 3D models
  biomePackIds:     string[]    // biomes
  terrainPackIds:   string[]    // terrain look
  waterPackIds:     string[]    // water look
  vegetationPackIds: string[]  // vegetation

  // Optional: snapshot of WorldCreationConfig + worldContent
  initialConfig?:    WorldCreationConfig
  initialWorldContent?: WorldContent
}
```

Forking Hyperia = installing `@hyperforge/project-pack-hyperia-v1`, which transitively installs the Hyperia plugin set + its asset packs + biome pack (tundra/forest/canyon) + Hyperia terrain pack (the current shader) + Hyperia water/vegetation. One install, gets the whole game theme. The current `Hyperia` template becomes the canonical ProjectPack.

## Phasing

### Phase 1 — schemas (this cut)

Add the 5 new pack schemas to `manifest-schema`. Plan-doc + barrel exports + zero runtime consumer changes. Schemas are validated when authors ship packs but nothing reads them yet at runtime.

Rationale: schemas land first so authors can start shipping packs in parallel with consumer work.

### Phase 2 — service layer

Extend `AssetPackService` (or sibling `BiomePackService` / `TerrainPackService` / etc.) for each new pack type:
- `list()` — discover installed packs of this type
- `install(packId)` — add to project's typed-column array
- `manifest(packId)` — fetch the resolved manifest

DB schema: extend `world_projects` with `biomePacks: string[]`, `terrainPacks: string[]`, `waterPacks: string[]`, `vegetationPacks: string[]` columns (or one `packs: { type, id }[]` polymorphic column — the schema choice is part of phase 2).

### Phase 3 — runtime consumers

Each pack type wires into the appropriate runtime registry:

- `BiomePack` → `pluginBiomeRegistry` becomes `biomeRegistry` (drops the "plugin" prefix; merges contributions from BOTH plugins AND biome packs).
- `TerrainPack` → new `terrainShaderRegistry` selects which shader recipe `TerrainShaderTSL` builds from. Default: a generic N-biome shader (replaces today's 3-channel hardcoded shader).
- `WaterPack` → new `waterShaderRegistry` selects water rendering.
- `VegetationPack` → replaces the 18 hardcoded tree species in `procgen/src/params/presets.ts` with a registry-walked species list.

This phase is the **substantive** Hyperia decoupling work — moving Hyperia-specific code OUT of engine packages and INTO Hyperia-named packs. The engine ends up with NO Hyperia-specific code; Hyperia projects work because `@hyperforge/project-pack-hyperia-v1` installs the right packs.

### Phase 4 — studio UI

Marketplace categories per pack type. Install / uninstall flows. Browse-and-pick UX in the New Project dialog (instead of just "Hyperia template" / "Blank").

### Phase 5 — ProjectPack

Rich pack type that bundles refs to all the above. Implement `ProjectPackService.fork(packId)` which:
1. Creates a new project
2. Installs every plugin / asset pack / biome pack / etc. the ProjectPack references
3. Applies `initialConfig` if present
4. Applies `initialWorldContent` if present (NPCs, mob spawns, quests, etc.)

Hyperia's existing `ProjectTemplateService` becomes a thin wrapper around `ProjectPackService.fork("@hyperforge/project-pack-hyperia-v1")`.

## Composability rules

- **Multiple packs of the same type compose by id-merge.** Two biome packs with different biome ids both contribute. Two with overlapping ids: last-installed-wins on the conflict (mirrors today's `pluginBiomeRegistry` merge semantics).
- **Cross-type compose freely.** No coupling between BiomePack and TerrainPack — the user can mix any biome pack with any terrain pack. The terrain shader recipe references biome-color slots by index, not by hardcoded biome ids.
- **Plugin contributions stay** — a gameplay plugin can still contribute biomes (Hyperscape plugin contributes tundra/forest/canyon today). The biome registry merges contributions from BOTH plugins AND standalone biome packs. ProjectPack referencing the Hyperscape plugin gets those biomes for free; users wanting biomes WITHOUT gameplay install a standalone BiomePack.
- **ProjectPack overrides defaults but doesn't lock them.** Installing `@hyperforge/project-pack-hyperia-v1` brings tundra/forest/canyon — the user can then install an additional `@hyperforge/biome-pack-desert-v1` and the desert biome layers on top.

## Out of scope for this plan

- Marketplace billing, version pinning, semver resolution between packs, sandboxed shader execution. All future work; the schemas just need to leave room for them.
- Forking-with-migration semantics (what happens when a ProjectPack's pinned plugin version doesn't satisfy the project's other plugins' constraints). Phase 5+ concern.
- Pack signing / supply chain. Future phase.
