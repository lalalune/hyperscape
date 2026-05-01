# Agent ↔ Studio Parity — Plan

**Status:** Draft — 2026-04-30
**Tip commit at planning time:** `76529c67f` on `feat/world-studio`
**Successor to (in spirit):** `PLAN_AI_AUTHORING_FOUNDATIONS.md`
which closed the read-only HUD authoring loop. This plan addresses
the world-content authoring loop.

---

## North star

A user authoring a world via the in-studio AI chat should get
**the same final result** as a user authoring it manually with
the entity palette + brushes + property panels. Today they get
two visibly different worlds — manual placements have full
property panels, transforms, gizmo support, and integrate with
the studio's procgen + brush systems; agent placements appear
as a separate "AI Generated" subtree with a smaller schema, no
transforms, no property panels, no source tagging.

**This plan unifies the two paths and fills the genre-agnostic
gaps that emerge from the unification.**

Hyperia is the flagship game type, but the system must support
shooters, sandboxes, racing, party, horror, tower defense, and
survival. The plugin contribution model in `plugin.json`
(`entityTypes: [...]`) is the right architectural answer; this
plan also fills the gap between "plugins can declare entity
types" and "plugins can contribute property panels for them."

---

## Findings — 2026-04-30

### The two-store problem

The studio has two parallel entity stores:

| Store | Used by | Properties | Transform-editable | Property panels | Outliner section |
|---|---|---|---|---|---|
| `extendedLayers` | Manual palette + procgen + brushes | id, position, **rotation, scale, properties bag, source, sourceRegionId, type-specific fields** | ✅ via gizmo | ✅ 16 panels | "Game Entities" |
| `agentWorldContent` | AI agent (`PROPOSE_*`) | id, position, type, assetRef | ❌ | ❌ | "AI Generated" |

`agentWorldContent` was added in commit `8679afa1d` as a
deliberately separate store so agent emissions could land in the
viewport before the project-creation flow finished and persistence
could catch up. That tradeoff has now run its course — what was
"keep agent state isolated" reads to a user as "agent output is a
second-class layer pasted on top of the real editor."

### Schema-field comparison

Looking at the actual `Placed*` interfaces (in
`packages/asset-forge/src/components/WorldStudio/types.ts`) vs the
agent's `WorldArea*` schemas (in
`packages/manifest-schema/src/world-areas.ts`):

| Field | PlacedNPC | WorldAreaNPC (agent) |
|---|---|---|
| id, name, position | ✅ | ✅ |
| **rotation** (number) | ✅ | ❌ |
| **scale** (number) | ✅ | ❌ |
| **properties** (Record<string, unknown>) | ✅ | ❌ (passthrough but no consumer reads) |
| **source** ("designer" / "procgen" / "agent") | ✅ | ❌ |
| **sourceRegionId** | ✅ | ❌ |

| Field | PlacedMobSpawn | WorldAreaMobSpawn (agent) |
|---|---|---|
| spawnRadius, maxCount | ✅ | ✅ |
| **respawnTicks** | ✅ | ❌ |
| **name** | ✅ | ❌ (uses mobId only) |
| properties bag, source | ✅ | ❌ |

| Field | PlacedStation | WorldAreaStation (agent) |
|---|---|---|
| **rotation** | ✅ | ❌ |
| **bankId, runeType** (station-specific) | ✅ | ❌ |
| properties bag | ✅ | ❌ |

| Field | PlacedResource | WorldAreaResource (agent) |
|---|---|---|
| **rotation, modelVariant** | ✅ | ❌ |
| properties bag | ✅ | ❌ |

### Studio capabilities the agent has zero access to

These have full UI + persistence + rendering today, but no
`PROPOSE_*` action exists:

| # | Capability | Studio panel | Notes |
|---|---|---|---|
| 1 | **Towns** | TownProperties | named villages, safe zones, entry points |
| 2 | **Roads** | RoadProperties + PathToolPanel | path-spline authoring connecting POIs |
| 3 | **POIs** (dungeons, shrines, ruins, camps, crossings, waystations, fishing spots) | PropertiesPanel | with `importance` weight + `connectedRoads` |
| 4 | **Mines** | (procgen-generated) | clustered ore with radial shape, entry angle, tier |
| 5 | **Water bodies** (rivers/lakes/ponds) | useWaterBodyEditor | river waypoints, lake polygons, surfaceY |
| 6 | **Music zones** | ZonePaintPanel (audio) | track + combat override + blend distance |
| 7 | **Ambient zones** | ZonePaintPanel (audio) | forest/cave/ocean ambient layers |
| 8 | **SFX triggers** | (point sources) | looping ambient sounds at world points |
| 9 | **Danger sources** | (gradient intensity) | wilderness danger fields |
| 10 | **Wilderness boundary** | (single per project) | high-risk PvP region demarcation |
| 11 | **Custom asset placement** with rotation + scale | PlacedCustomAsset | imported GLBs in the world |
| 12 | **Behavior scripts** | BehaviorScriptSection | per-entity script attachment |
| 13 | **Brush ops** (terrain sculpt, biome paint, vegetation paint) | useBrushInteraction | freehand world shaping |
| 14 | **Generator wizards** (GenerateGame / GenerateTown / GenerationWizard) | wizard/ panels | pre-canned high-level generators |
| 15 | **Stores** (NPC inventory) | StoreEditor + GameStoreEditor | what items + prices + restock |
| 16 | **Quest graph** (visual quest editing) | QuestGraphPanel | branching stages |
| 17 | **PIE session** (Play-In-Editor) | usePIESession | spin up a runtime instance to test |
| 18 | **History** (undo/redo) | HistoryPanel | agent emissions don't integrate |
| 19 | **Camera bookmarks** | useCameraBookmarks | named viewpoints |
| 20 | **Asset bake → studio palette** | partial via PROPOSE_ASSET | no auto-add-to-palette flow |

### Genre support — Hyperia is the flagship, not the only target

Studio entity vocabulary is currently RPG-shaped. The architecture
is genre-extensible (plugin contributions), but the entity
schemas + property panels are hardcoded to Hyperia's 16 types.

| Genre | Needs the studio doesn't have |
|---|---|
| **Shooter (FPS/TPS)** | Cover meshes, weapon spawns, capture points, flag bases, killboxes, navmesh hints, killfeed/scoreboard config |
| **Racing** | Track splines, checkpoints, finish line, lap leaderboards, pit zones |
| **Sandbox/builder** | Voxel/block primitives, build templates, prefab kits, blueprint mode |
| **Party/social** | Photo booths, dance floor zones, mini-game spawners, emote triggers |
| **Horror** | Jump-scare triggers, lighting cues, fog volumes (light/zone overlap), AI-vision blockers |
| **Tower defense** | Wave spawners, lane paths, build sockets, enemy targeting rules |
| **Survival** | Resource regrowth tuning, hunger/thirst configs, base-claim zones, weather damage |

Plugins should contribute genre-specific entity types **AND** their
property panels. Today plugin contributions stop at type
discovery; property panels are hardcoded.

---

## Phases, in priority order

Each phase produces a typed deliverable that can be tested
independently. Phases sequenced by **player-visible impact per
unit of effort.**

### Phase P0 — Unify agent placements with `extendedLayers`

**Goal:** agent emissions become indistinguishable from manual
placements. Gizmo, properties panel, transforms, source tagging,
undo/redo, outliner consistency — all start working.

**Effort:** M-L (1-2 sessions).

**Two implementation options:**

#### Option A — Agent writes to `extendedLayers` (recommended)

Each `PROPOSE_*` action's handler in `eliza-game-builder` produces
a `Placed*` shape (with rotation/scale/properties/source). The
studio merges directly into `extendedLayers` via existing reducer
actions. Agent placements become indistinguishable from manual
placements at the data layer.

**Pros:** fully unified data model. Single source of truth.
Existing gizmo / property / outliner / brush / undo machinery
"just works" because there's nothing new to wire.

**Cons:** more invasive — every PROPOSE_* action handler needs to
produce the richer shape. The companion's persistence path
(currently `setAndPersistAgentX`) needs to delegate to the studio
reducer instead of the parallel store.

#### Option B — Migrate `agentWorldContent` schema to match `Placed*`

Extend `WorldArea*` schemas in `manifest-schema` to include
rotation/scale/properties/source. Update the renderer + property
panels to read from both stores.

**Pros:** smaller blast radius. No reducer changes.

**Cons:** leaves the dual-store problem in place. Property panels
become dual-source-aware (more complexity). The unification is
architecturally shallow.

**Recommendation:** Option A. The work is bigger but matches the
existing engineering substrate-promote pattern (see PROGRESS_AUDIT
REFRESH 11/12 — every recent unification used "merge into the
existing primitive, not parallel"). Option B preserves a dual
that will keep biting forever.

**Exit criteria:**
- `useAgentEntityMarkers` deleted (markers come from the same
  rendering path as manual placements).
- `agentWorldContent` store deleted; agent emissions land in
  `extendedLayers` via reducer.
- Outliner shows agent + designer + procgen entities in one tree,
  color-coded by `source` field.
- Selecting an agent-placed NPC opens the same property panel as
  a manually-placed NPC.
- Gizmo translate/rotate/scale works on agent placements.
- Undo/redo cycles include agent emissions.

### Phase P1 — Extend agent placement schemas

**Goal:** add rotation, scale, properties bag, source, name to
the agent's WorldArea schemas so they CAN match Placed* shapes.

**Effort:** S (single session).

P0 depends on this. Schema-only change; no behavior change yet.

**Touchpoints:**
- `packages/manifest-schema/src/world-areas.ts` — extend NPC,
  Resource, Station, MobSpawn, Teleport schemas.
- `packages/eliza-game-builder/src/actions/propose*.ts` — surface
  the new optional fields in action descriptions so the agent
  knows about them.

### Phase P2 — `PROPOSE_TOWN` + `PROPOSE_ROAD`

**Goal:** the single largest visible "this looks like a real game
world" win. Towns are how players orient themselves; roads tie
content together.

**Effort:** M (single session).

**Deliverables:**
- `WorldAreaTownSchema` + `WorldAreaRoadSchema` in manifest-schema.
- `proposeTownAction` + `proposeRoadAction` in eliza-game-builder.
- `PlacedTown` already exists in studio types — wire as P0
  precedent (but towns aren't in `extendedLayers` today; check
  whether to add them or attach to `world.foundation.towns`).
- Studio renderer for agent towns matches manual.

### Phase P3 — `PROPOSE_PATH` (genre-agnostic primitive)

**Goal:** generic "named connection between two points" suitable
for racing track splines, FPS lane paths, RPG roads, navigation
hints.

**Effort:** S.

Stripped-down version of `PROPOSE_ROAD` for non-Hyperia genres.

### Phase P4 — Plugin-contributable property panels

**Goal:** make the studio render a property panel for ANY entity
type a plugin contributes, not just the 16 Hyperia hardcoded ones.

**Effort:** L (multi-session).

A shooter plugin should be able to declare `cover-mesh` as an
entity type AND ship the property panel for editing one (cover
height, peek-angle, etc.) without studio changes.

**Approach:** JSON-Schema-driven panel renderer. Plugin's
`entityTypes[]` entries gain an `editorSchema: JSONSchema7`
field. A generic `PluginPropertyPanel` component renders form
controls from the schema (string → text input, number → number
input, enum → select, etc.).

**Touchpoints:**
- `manifest-schema`: extend `EntityTypeContributionSchema` with
  optional `editorSchema`.
- `asset-forge` PropertiesPanel: add a fallback path that, for
  any entity whose type is plugin-contributed, renders via the
  generic schema panel.
- `eliza-game-builder` LIST_ENTITY_TYPES exposes editorSchema so
  the agent can author editor-shape-aware proposals.

### Phase P5 — Coverage parity for existing studio types

**Goal:** every entity kind the studio supports is also
agent-emittable.

**Effort:** M each, ~5 sessions.

- `PROPOSE_WATER_BODY` (river/lake/pond)
- `PROPOSE_MINE` (clustered ore deposit)
- `PROPOSE_POI` (dungeon / shrine / ruin / camp / etc.)
- `PROPOSE_DANGER_SOURCE`
- `PROPOSE_WILDERNESS_BOUNDARY`

### Phase P6 — Audio zones

**Goal:** music + ambient + SFX triggers from chat.

**Effort:** M.

High-perceived-value polish. Music zones especially make worlds
feel alive.

- `PROPOSE_MUSIC_ZONE`
- `PROPOSE_AMBIENT_ZONE`
- `PROPOSE_SFX_TRIGGER`

### Phase P7 — Make NPCs functionally complete

**Goal:** agent-placed NPCs aren't just visual — clicking them
does something.

**Effort:** M.

- `PROPOSE_SHOP_INVENTORY` — agent authors store contents
  (items + prices + restock).
- `PROPOSE_DIALOGUE_TREE` — branching dialogue, conditions,
  quest gates.
- Validator: `E1 — every shopkeeper has a store`,
  `E2 — every quest references real NPCs`.

### Phase P8 — Combat content authoring

**Goal:** agent can define new mobs + items, not just place
existing ones.

**Effort:** L (multi-session).

- `PROPOSE_MOB_DEFINITION` — HP, attack power, defense, weakness,
  AI behavior tag.
- `PROPOSE_ITEM` — weapons, armor, consumables, tools.
- `PROPOSE_LOOT_TABLE` — drop chances per mob.
- `PROPOSE_BOSS` — special encounter with phases.

### Phase P9 — "Place at terrain feature" semantics

**Goal:** remove the random-coordinate problem. Agent says
"place village in the most fertile valley" instead of picking
arbitrary `(x, y, z)`.

**Effort:** M.

Studio exposes `TerrainQueryService` to the agent: "find me a
flat area at least 100m across in a forest biome with water
within 50m." Agent's PROPOSE_* actions can take symbolic
positions like `{ near: "water", on: "flat", in_biome: "forest" }`
and the action handler resolves to concrete coords.

### Phase P10 — Brush ops via agent

**Goal:** procedurally hand-tune a region from chat.

**Effort:** L.

- `PROPOSE_TERRAIN_SCULPT` — raise/lower a region.
- `PROPOSE_BIOME_PAINT` — repaint a region's biome.
- `PROPOSE_VEGETATION_PAINT` — adjust vegetation density in a
  region.

### Phase P11 — Plugin-contributed wizard flows

**Goal:** "Generate a town" / "Generate a dungeon" callable from
chat. Today these are panel buttons.

**Effort:** M.

Wizards expose a typed `runWizard(name, params)` API; agent's
`PROPOSE_RUN_WIZARD` action calls into them.

### Phase P12 — Genre-agnostic primitives

**Goal:** common shapes that all genres share land in the shared
schema, plugins contribute the genre-specific bits.

**Effort:** L.

- Cover meshes, capture points, checkpoints, finish lines,
  build sockets, wave spawners, lane paths.
- Each one is a primitive shape (point with bounds + properties)
  that plugins specialize.

### Phase P13 — Source tagging across the pipeline

**Goal:** outliner shows all entities in one tree, color-coded by
`source` field ("designer" green, "procgen" amber, "agent"
purple).

**Effort:** S.

P0 introduces the field; this phase wires it into the outliner
rendering + filtering.

---

## What this plan does NOT cover

**Explicitly deferred:**

- **Live game runtime spawning of agent-authored content.** A
  separate plan covers `worldContent.npcs/spawns/etc` →
  in-engine entities at runtime. This plan stops at the studio
  authoring loop.
- **Multi-agent collaboration.** One agent at a time per project.
  Conflict resolution is out of scope.
- **Agent-driven asset generation beyond `PROPOSE_ASSET`.** The
  bake pipeline is mature (Phase A5 of
  PLAN_AI_AUTHORING_FOUNDATIONS); this plan doesn't extend it.
- **Live LLM benchmarking.** Each phase ships testable without
  a real LLM in the loop (synthetic test fixtures).

---

## Sequencing principle

**P0 + P1 first.** They're load-bearing for everything else
and they fix the most visible user-facing complaint.

After that, prioritize by player-visible impact: P2 (towns +
roads) and P5 (coverage parity) before P8 (mob/item authoring)
and P10 (brush ops). Polish (P6 audio) in between.

P4 (plugin-contributable panels) and P12 (genre primitives) are
the two architectural unlocks for non-Hyperia games. Without
them, the framework only really supports building Hyperia-shaped
games.

---

## Success metric

The framework's success is measured by **how indistinguishable an
agent-built world is from a hand-built world** in the same
studio. After P0+P1: structurally identical. After P5: same
entity vocabulary. After P4+P12: extends to non-RPG genres. After
P9+P10: agent doesn't just place things at random coords — it
shapes the world coherently.

That is the test. Every phase in this plan is in service of it.
