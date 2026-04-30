# PLAN_ASSET_PACKS.md

**Status:** scoped, not started
**Owner:** TBD
**Sized:** L (whole-feature) / M (per-slice)

## The gap

Hyperia ships with a curated library of AI-generated 3D assets — mobs,
NPCs, weapons, props — referenced today as loose `modelPath` strings
inside `npcs.json` / `gathering/*.json` / etc. There's no concept of a
"bundle" the way plugins are bundles. Consequences:

1. **No share path for the Hyperia art.** A new project that wants the
   Hyperia *visual* style but its own gameplay can't borrow Hyperia's
   meshes — they're entangled with Hyperia's manifest data.
2. **No share path for community art.** A user (or AI) who generates
   100 assets for a "cyberpunk noir" game can't expose them as a thing
   another project can install.
3. **The agent's `PROPOSE_ASSET` action generates one-offs.** Each bake
   produces a standalone asset record. There's no grouping, no
   versioning, no provenance trail.
4. **Project blank-canvas claim is incomplete.** A blank project with no
   plugins still pulls in Hyperia's mesh references because the assets
   are globally visible in the catalog.

## The shape

Mirror the plugin substrate. Asset packs are first-class, declarative,
versioned bundles a project installs.

### Manifest

```ts
// packages/manifest-schema/src/asset-pack.ts
const AssetPackEntrySchema = z.object({
  id: z.string().min(1),               // pack-scoped id, e.g. "goblin-shaman"
  name: z.string().min(1),
  type: z.enum([
    "character", "creature", "prop", "weapon", "tool",
    "armor", "vehicle", "misc",
  ]),
  subtype: z.string().min(1),
  modelUrl: z.string(),                  // GLB / FBX / asset:// URI
  thumbnailUrl: z.string().optional(),
  characterHeight: z.number().positive().optional(),
  rigged: z.boolean().optional(),
  tags: z.array(z.string()).default([]),
});

const AssetPackManifestSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^@?[a-z0-9][a-z0-9-_./]*$/i),
  name: z.string().min(1),
  description: z.string().default(""),
  author: AuthorSchema,
  license: z.string().min(1),
  /** All entries this pack contributes. */
  assets: z.array(AssetPackEntrySchema),
});
```

### DB

```sql
CREATE TABLE asset_packs (
  id            uuid PRIMARY KEY,
  team_id       uuid REFERENCES teams(id),  -- nullable for built-in packs
  manifest_id   text NOT NULL UNIQUE,        -- e.g. "@hyperforge/asset-pack-hyperia"
  manifest      jsonb NOT NULL,              -- AssetPackManifestSchema
  source        text NOT NULL,               -- "built-in" | "user" | "marketplace"
  version       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Each entry can also live as an `assets` row (existing table) so the
-- per-asset URLs resolve through the existing CDN stack.
ALTER TABLE assets
  ADD COLUMN pack_id uuid REFERENCES asset_packs(id) ON DELETE SET NULL;
```

### Project surface

`world_projects` gains a typed `assetPacks` column analogous to `plugins`:

```sql
ALTER TABLE world_projects
  ADD COLUMN asset_packs text[] NOT NULL DEFAULT ARRAY[]::text[];
```

`Project.assetPacks: ReadonlyArray<string>` — list of `manifest_id`s
the project has installed. The catalog the studio shows is the union
of all installed packs' entries. The agent's `PROPOSE_ASSET` defaults
to writing into a **per-project user pack** (auto-created), so the
agent's outputs accumulate into a coherent bundle the user can later
publish or share.

### Bundling Hyperia's existing assets

Cut a built-in pack `@hyperforge/asset-pack-hyperia-v1`:

1. Walk every `modelPath` and `modelVariants` reference in
   `world/assets/manifests/{npcs.json,gathering/*.json,items/*.json}`
2. Resolve to canonical `asset://...` URIs
3. Materialise as `AssetPackManifest`
4. Seed the `asset_packs` table on first server boot when the manifest
   is missing (idempotent — same pattern as plugin contribution
   registration)

Once seeded, Hyperia's runtime references become `pack:hyperia/<id>`
lookups instead of raw strings. The plugin's `onEnable` declares
`requires: ["@hyperforge/asset-pack-hyperia-v1"]`; if the pack isn't
installed, the plugin refuses to enable (clear diagnostic, no silent
broken references).

### Agent action surface

Three new actions, mirroring the plugin pattern:

| Action | Purpose |
|---|---|
| `LIST_ASSET_PACKS` | Discovery — returns installable packs (built-in + team) |
| `GET_ASSET_PACK` | Inspect one pack — manifest + asset count by type |
| `INSTALL_ASSET_PACK` | Add a pack to the active project (`project.assetPacks` push) |

`PROPOSE_ASSET` extends with `targetPack?: string` — defaults to the
project's auto-created user pack, but the agent can route generations
into any writable pack the team owns.

### Studio UI

A new **Asset Packs** tab in the right-rail (next to Plan / Building
Blocks / History). Shows:

- Currently installed packs with thumbnail strip + asset count
- Available packs from the team's library + marketplace (future)
- Install / uninstall buttons
- A "Generate new asset" CTA that fires the existing AI pipeline,
  routed into the project's user pack
- Per-asset thumbnail grid with "Use this in a placement" affordance

## Architectural clarification — Outliner vs Library

A real subtle point that's been conflated and needs to land cleanly
in this work:

| Concept | What it shows | Source |
|---|---|---|
| **Outliner** (UE5 World Outliner) | Entities currently placed in **this project's scene** | `worldContent` + `extendedLayers` (and our new `agentWorldContent`) |
| **Asset Library / Palette** | Templates available to **drag into the scene** | Union of installed asset packs' catalogs |
| **`DataManager` legacy globals** | Hyperia content loaded engine-wide (regardless of project) | Goes away once B2 finalises (bypass already env-gated) |

Today's outliner shows Hyperia content for blank projects because of
the legacy globals leaking through. With this plan + B2 finalised:

- **Blank project, no packs installed**:
  - Outliner: empty (true blank)
  - Asset Library: empty
- **Blank project + Hyperia asset pack installed**:
  - Outliner: still empty (installing a pack doesn't auto-place)
  - Asset Library: shows Hyperia's mesh catalog as drag sources
- **Hyperia template project** (template clones a curated `worldContent`):
  - Outliner: shows the seeded scene
  - Asset Library: shows installed packs' catalogs
- **Drag a goblin from the library to the world**:
  - Outliner: gains 1 goblin entry
  - Library: catalog unchanged (templates persist)

This separation is what makes asset packs *composable* — install
two packs, get two libraries' worth of meshes available; remove a
pack, library shrinks, but anything ALREADY placed in the scene
stays (with a "missing template" warning if its source pack was
the one removed).

The `EntityPalette` panel in the editor today is the placeholder
for the Asset Library surface — it currently reads from the engine's
global registries, which is why it shows everything regardless of
project. AP6 reworks it to read from installed packs.

## Why this matters for AAA

Solves four named gaps:

1. **Shareable art** — Hyperia's mesh library becomes a reusable asset.
   A new "noir detective" game can install `asset-pack-hyperia-v1`
   for stock characters while shipping its own gameplay plugin.
2. **Curated community art** — users generate packs, share them, the
   marketplace surfaces them. Same flywheel as plugins.
3. **Coherent agent output** — the agent's `PROPOSE_ASSET` calls
   accumulate into a versioned, attributable, reusable bundle.
4. **True blank canvas** — a blank project has zero `assetPacks`. No
   stray Hyperia mesh references. Combined with the
   `HYPERFORGE_DISABLE_ENGINE_DATA_LOAD=1` flag we just shipped, blank
   really is blank.

## Slicing

| Slice | Sized | What |
|---|---|---|
| **AP1** | M | Schema in `manifest-schema`. DB migration. `asset_packs` table + `assets.pack_id` FK. |
| **AP2** | M | Server-side seeder for `@hyperforge/asset-pack-hyperia-v1` from existing Hyperia assets. Boot-time idempotent. |
| **AP3** | M | `project.assetPacks` typed column + patch endpoint. |
| **AP4** | S | Client API helpers: `listAssetPacks`, `installAssetPack`, `getAssetPack`. |
| **AP5** | M | Agent actions: `LIST_ASSET_PACKS`, `GET_ASSET_PACK`, `INSTALL_ASSET_PACK`. `PROPOSE_ASSET` gains `targetPack`. |
| **AP6** | M | Studio UI: Asset Packs tab in right-rail. |
| **AP7** | M | Per-project user pack auto-creation; agent's bakes route there by default. |
| **AP8** | S | Plugin `requires` field — Hyperia plugin declares it needs `asset-pack-hyperia-v1`. Refuses to enable without it. |
| **AP9** | L | Marketplace surface — browse packs across teams, install via id. (Future, after the others ship.) |

AP1–AP4 is the substrate. AP5–AP6 makes the agent + studio first-class
citizens. AP7 closes the "agent's bakes go nowhere" gap. AP8 is the
correctness guarantee. AP9 is the share-with-the-world feature.

## Sequencing rationale

Ship AP1+AP2+AP3 first as a single landed cut: the data layer + the
Hyperia bundle + the project-level surface. Once that's green:
- AP8 can land cheaply (one Zod field on `PluginManifestSchema` + a
  precondition check in `bootServerPlugins`).
- AP4 + AP5 + AP6 together unblock the user-facing flow.
- AP7 closes the agent loop.
- AP9 only matters once there are >3 real packs to browse.

## Cross-cuts

- **Asset bake completion → pack assignment.** The existing AI
  generation pipeline produces individual asset records. AP7 wires
  `pipeline complete` → "insert into project's user pack." Today the
  pipeline emits an `assets` row with no pack association.
- **Auth / ownership.** Built-in packs are read-only. User packs are
  team-owned. The pack manifest's `author` field reflects this; the
  studio surfaces the distinction so users don't try to mutate
  built-ins.
- **Versioning.** Pack manifests are immutable per version. A "new
  cut of Hyperia art" ships as `@hyperforge/asset-pack-hyperia-v2`,
  not as an edit to v1. Projects opt in by re-installing.

## Out of scope (for now)

- Pack inheritance / composition (one pack `extends` another).
- Cross-pack reference resolution (pack A's character holds pack B's
  weapon).
- Diffing pack versions for migration.
- LOD streaming / per-asset CDN edge cache rules.

These can be follow-ups once the basic bundle shape is real.
