# Hyperscape Progress Audit — 2026-05-01 (REFRESH 16)

## REFRESH 16 — Plan-portfolio audit + AAA % reconciliation post-deep-decoupling-audit (2026-05-01 afternoon)

**Branch tip at refresh time:** `30cc871cc` (`docs(plan): expand
decoupling plan with deep-audit findings`).

**Trigger:** After 5e5aad816 made every AI-built world look like
Hyperia, two rounds of deep audit ran. Round 1 found 11 pinch
points in the asset-forge editor layer; Round 2 audited the full
package portfolio and surfaced 16 more pinch points across
engine, server, client, procgen, and the declared-but-unread
plugin contribution surface. PLAN_HYPERIA_DECOUPLING.md was
created and expanded from 9 → 15 phases (commits `bb7b281a3`
and `30cc871cc`). This refresh reconciles the prior estimates
against what the audit found.

### Plan portfolio inventory (15 docs, 6,801 lines total)

**ENGINE DECOUPLING (4 docs)**

| Doc | Lines | Status | Note |
|---|---|---|---|
| PLAN_SERVERNETWORK_MIGRATION.md | 772 | **substantively COMPLETE** | Steps 1-9 shipped. PIE real loopback works (`054588a48`). 41 PIE roundtrip tests green. Step 8 sibling-shim cleanup is the only loose end (low-priority). |
| PLAN_ENGINE_API_EXTRACTION.md | 294 | **substantively COMPLETE** | Phases A-G1 shipped. Substrate interfaces (`ISpatialIndex`, `IBroadcastService`, `IRegionSubscriptionService`, `ITileMovementService`, `IConnectionRegistry`) live; 14/14 handler families migrated. G remainder reclassified as engine-safe infrastructure. |
| PLAN_ENGINE_GAME_SEPARATION.md | 170 | **WIP — Phase 2 next** | Phase 1 deferred (cycle is runtime, not types). Phase 2 = GameMode wiring (1-2 days). Phase 3 partial (real loopback exists). Phase 4 = heart of the project (2-3 weeks). 9-11 weeks total to publishable engine. |
| PLAN_HEAVY_CLUSTER_MIGRATION.md | 180 | **WIP — blocked on diagnostics** | Wave 1 attempted + reverted at `fb8a01b62` (cross-package d.ts inference issue with numeric enum `ResourceSubType`). 5-6 waves remain. Tighten shared's tsconfig before retry. |

**PROJECT / ASSET / UI (4 docs)**

| Doc | Lines | Status | Note |
|---|---|---|---|
| PLAN_PROJECT_AS_DATA.md | 604 | **WIP — ~30% done** | B0' replaces older B0 framing. B0'.A (typed Project schema) shipped. B0'.E (Hyperia content into plugin) + B0'.F (parity smoke) + B0'.G-J pending. B1' (Design with AI hero UX) scoped, 0% shipped. |
| PLAN_ASSET_PACKS.md | 246 | **scoped, 0% on system** | 10 Hyperia category packs (~142 assets) seeded as content; no install plumbing landed. AP1-AP4 substrate is the missing piece. `HYPERFORGE_DISABLE_ENGINE_DATA_LOAD` flag is the only mitigation today. |
| PLAN_UI_PACK_AAA.md | 261 | **~95% done** | U0-U11 fully shipped (239 ui-framework + 79 client tests green). Only accessibility checklist + perf budget + telemetry + docs + flag flip remain. Closest to ready-to-ship of the four. |
| PLAN_PHASE_D.md | 655 | **substantively COMPLETE** | D1-D7 shipped; D6.c long-tail closed via D8/D9/D10 wire-through (REFRESH 8). 28 widgets shipped. D6.c.4 panels (20+ remaining) is the open tail; gated on windowStore A/B/C decision. |

**AI / AGENT (3 docs)**

| Doc | Lines | Status | Note |
|---|---|---|---|
| PLAN_AI_AUTHORING_FOUNDATIONS.md | 320 | **A1-A4 shipped, only A5 remains** | Catalog + bindings + scaffolder + Eliza shells all complete. A5 (worked-example demo of AI building a tiny game end-to-end) is the only open phase. The framework is foundation-complete. |
| PLAN_AGENT_STUDIO_PARITY.md | 423 | **WIP — P0+P1 + 3 actions shipped** | P0+P1 (data-layer unification, extendedLayers single store, source color-coding) shipped. P2.a (PROPOSE_ROAD), P5.a (PROPOSE_POI), P5.b (PROPOSE_DANGER_SOURCE) shipped. P2.b/P3/P4/P5-P13 pending. P4 (plugin-contributable property panels) overlaps with HYPERIA_DECOUPLING.P9. |
| PLAN_HYPERIA_DECOUPLING.md | 481 | **DRAFT — created today, P1 not started** | 27 pinch points across 4 layers. 15 phases in 5 rounds. P1 (rename `DEFAULT_CREATION_CONFIG` → `HYPERIA_CREATION_CONFIG` + new `MINIMAL_CREATION_CONFIG`) is the smallest highest-leverage starting point. |

**STATUS / QUALITY (4 docs)**

| Doc | Lines | Status | Note |
|---|---|---|---|
| PROGRESS_AUDIT.md | 1146 | **live tracker** | This doc. REFRESH 15 → REFRESH 16 today. |
| PLAN_AAA_QUALITY.md | 469 | **partly stale** | Phase A done. Phase B0 superseded by PLAN_PROJECT_AS_DATA. B1-B10 deferred until B0' lands. |
| PLAN_NEXT_SESSIONS.md | 416 | **partly stale** | Sessions 2, 7, 8, 9, 10 closed. Session 1 ("Wire plugin into prod") was DONE before the doc was written per REFRESH 14 audit re-verification. Session 5 (D6.c) is the live work referenced. |
| PLAN_WORLD_STUDIO_AAA_COMPLETION.md | 364 | **design spec, not yet executed** | 15-dimension Gap Matrix + 11-phase plan (A-K). Phase A (extract constants) is unstarted but is what HYPERIA_DECOUPLING pinch points #14-#17 expose at the engine layer. |

### Reconciliation: AAA % estimate

REFRESH 15 estimated **~91-92% AAA**. That estimate was based on
the editor-side completion (Phases I, D, the 11 closed top-10
items) and didn't fully weight the engine/server/client/procgen
bake. Today's deep audit forces a downward revision.

**Revised estimate: ~78-82% AAA**, decomposed:

- **Editor surface + agent placement vocabulary**: ~92%
  (REFRESH 15's number, still accurate for what it measures).
- **Substrate plumbing (manifest authoritative, plugin
  contributions actually fire at runtime)**: **~50%** —
  HYPERIA_DECOUPLING.P10 finding that `plugin.json`
  contributions are validated, snapshotted, and never read at
  runtime drops this. Plugins register via callbacks; the
  manifest is documentation pretending to be substrate.
- **Engine genericness (zero Hyperia identifiers in
  shared/server/client/procgen)**: **~60%** — `hyperiaPlayerId`
  + `hyperiaLinked` in `Player` type, `BiomeType` enum at
  engine level, `GrassWorker` 3-biome blending, `LeafShape`
  oak hardcoding, 18 named tree presets in procgen, server
  `bootServerPlugins` ignoring `project.plugins`, client's 27
  hardcoded HUD panels, `KNOWN_PLUGINS` const in agent's
  `LIST_PLUGINS` action.
- **Acceptance test (second plugin + second pack proving
  composability)**: **0%** — no non-Hyperia plugin or pack
  exists.

The headline % moves down because of three findings the prior
refreshes underweighted:
1. The substrate is cleaner than thought in 5 packages
   (`manifest-schema`, `agent-runner`, `gameplay-framework`,
   `ui-framework`, `widget-catalog`) — but the bake at engine
   types is **deeper** than thought.
2. Plugin manifest contributions don't fire at runtime —
   the worst kind of slop because the manifest looks like
   substrate but isn't.
3. No second plugin or second pack exists, so "compose from
   building blocks" is a theoretical claim.

### Live priority queue (post-audit)

Round 1 (S, ship-fast — together ~3 days):
- **HYPERIA_DECOUPLING.P1** (rename `DEFAULT_CREATION_CONFIG`
  → `HYPERIA_CREATION_CONFIG`, introduce
  `MINIMAL_CREATION_CONFIG`, project-aware merge base)
- **HYPERIA_DECOUPLING.P15** (replace `KNOWN_PLUGINS` const with
  `PluginRegistryService.listPlugins()`)
- **HYPERIA_DECOUPLING.P5** (project-scoped engine data load:
  flip `HYPERFORGE_DISABLE_ENGINE_DATA_LOAD` from per-deploy
  to per-project)

Round 2 (M, substrate plumbing — ~2 weeks):
- **HYPERIA_DECOUPLING.P2** (plugin enum → registry path)
- **HYPERIA_DECOUPLING.P10** (read plugin contributions at
  runtime — fixes the manifest-as-documentation problem)
- **HYPERIA_DECOUPLING.P12** (detangle login/auth from engine
  types; move `hyperiaPlayerId` etc. into auth-bridge package)

Round 3 (L, extension surface — ~3-4 weeks):
- **HYPERIA_DECOUPLING.P3** (plugin-contributable biomes)
- **HYPERIA_DECOUPLING.P4** (plugin-aware `initEntityModels` /
  unify on pack path)
- **HYPERIA_DECOUPLING.P9** ≈ **AGENT_STUDIO_PARITY.P4**
  (plugin-contributable property panels — same architectural
  unlock; schedule once)
- **HYPERIA_DECOUPLING.P11** (server + client plugin extension
  hooks — registers tick systems, packet handlers, panels)
- **HYPERIA_DECOUPLING.P13** (strip Hyperia styling from
  ui-widgets — token reads instead of RGBA constants)

Round 4 (M, polish — ~2 weeks):
- **HYPERIA_DECOUPLING.P6** (plugin-aware onboarding prompt)
- **HYPERIA_DECOUPLING.P14** (broaden plugin-scaffolder beyond
  widgets)
- **HYPERIA_DECOUPLING.P8** ≈ **AGENT_STUDIO_PARITY.P2/P5/P6**
  (close agent action vocabulary gaps: PROPOSE_TOWN,
  PROPOSE_WATER_BODY, PROPOSE_MUSIC_ZONE, PROPOSE_AMBIENT_ZONE,
  PROPOSE_MINE, PROPOSE_WILDERNESS_BOUNDARY)

Round 5 (M, acceptance test):
- **HYPERIA_DECOUPLING.P7** (real second plugin + second pack —
  tropical pirate sandbox)
- **AI_AUTHORING_FOUNDATIONS.A5** (worked-example demo of
  AI building a tiny game end-to-end — uses the second plugin
  as the test case)

Parallel tracks (not gated by HYPERIA_DECOUPLING):
- **ENGINE_GAME_SEPARATION Phase 2** (GameMode wiring, 1-2
  days) — independent unlock for engine publishability.
- **HEAVY_CLUSTER_MIGRATION Wave 1 retry** — diagnose the
  cross-package d.ts inference issue, then 5-6 waves over
  ~3 weeks.
- **PROJECT_AS_DATA B0'.E + B0'.F** — Hyperia content into
  plugin onEnable, parity smoke test.

### Cross-doc overlaps to consolidate

The audit found these redundant work items across plans —
schedule once, attribute to the plan that owns the surface:

| Item | Plans that mention it | Owner |
|---|---|---|
| Plugin-contributable property panels | AGENT_STUDIO_PARITY.P4, HYPERIA_DECOUPLING.P9 | HYPERIA_DECOUPLING.P9 (broader scope) |
| Agent vocabulary gaps (TOWN, WATER, MUSIC, AMBIENT, MINE, WILDERNESS) | AGENT_STUDIO_PARITY.P2/P5/P6, HYPERIA_DECOUPLING.P8 | AGENT_STUDIO_PARITY (closer to extendedLayers store) |
| Plugin-scaffolder for plugins (not just widgets) | AI_AUTHORING_FOUNDATIONS.A3 (widget only), HYPERIA_DECOUPLING.P14 | HYPERIA_DECOUPLING.P14 (extends A3) |
| Hyperia content into plugin onEnable | PROJECT_AS_DATA.B0'.E, HYPERIA_DECOUPLING.P5 | HYPERIA_DECOUPLING.P5 (project-scoped, broader) |
| Plugin registry as source of truth | PROJECT_AS_DATA.B0'.D, HYPERIA_DECOUPLING.P2 + P15 | HYPERIA_DECOUPLING.P2 (loader) + P15 (agent surface) |

### What's actually next

The smallest leveraged starting move is **HYPERIA_DECOUPLING.P1**
(<1 day). It rename-consolidates `DEFAULT_CREATION_CONFIG` →
`HYPERIA_CREATION_CONFIG`, introduces a real `MINIMAL_CREATION_CONFIG`
(generic terrain, no Hyperia tree species or town presets), and
makes `DesignWithAIDialog.buildWorld` + `WorldStudioCompanion`'s
terrain handler choose the merge base based on `project.plugins`.
The visible effect: AI-built blank-template worlds stop looking
exactly like Hyperia. Until P3 ships (plugins contribute biomes),
biomes will still be tundra/forest/canyon — but tree species,
town styles, and the island preset stop being forced.

P15 + P5 can ship alongside P1 as 1-day independent quick wins.

After Round 1, every Hyperia leak becomes a concrete bug to fix
rather than "the substrate has Hyperia in it." That changes the
conversation about the framework's promise from theoretical to
fixable.

---



**This doc supersedes the 2026-04-24 cut.** That audit accurately
described state at 50–60% AAA, with the engine/game separation
sitting at ~5% as the biggest unknown. Two intense days of work
have closed most of that unknown — the engine substrate is now
zero-Hyperscape-imports for the network layer, ~7,464 more LOC
have moved from `@hyperforge/shared` to
`@hyperforge/hyperscape-plugin`, and 5 new substrate types have
been proven as the unblock pattern.

Produced from: branch diff vs main + direct file inventory + this
session's commit trail (`63ab4b2d6` → `c103e5e7e`, 59 commits).

---

## Headline correction

**~91–92% of the way to "truly AAA, truly done"**. **REFRESH 14 (2026-04-30 evening): asset-pack ecosystem + AI-↔-assets-↔-plugins integration shipped end-to-end as a single milestone commit (`8679afa1d`, ~150 files), plus 3 teleport-vertical slices today closing the last placement-vocabulary gap.** **Big shifts vs REFRESH 13**: (1) The "AI authoring foundations" plan (PLAN_AI_AUTHORING_FOUNDATIONS) shipped phases A1-A4 between sessions; A5 worked-example is the only open phase. (2) An entirely new arc — the Asset Pack ecosystem (PLAN_ASSET_PACKS AP1-AP9) — went from non-existent to fully shipped: schema + DB migrations + AssetPackService (CRUD/marketplace/publish/unpublish) + Hyperia seeder producing 10 category packs (~142 assets) + AssetPacksPage with marketplace tabs + WebGPU thumbnail renderer + ModelThumbnail React component + AssetPackBrowserPanel with full UX polish. (3) AI ↔ assets ↔ plugins integration (Layer A + Layer B) is end-to-end live: assetRef field on every placement schema; entityType contributions in plugin.json; LIST_ENTITY_TYPES + LIST_ASSET_PACKS + PROPOSE_ASSET_PACK_INSTALL + PROPOSE_STATION + PROPOSE_TELEPORT actions; placement validators (validatePlacementType + validateAssetRef + autoFillAssetRef); useAgentEntityMarkers renders agent placements as 3D markers with assetRef → GLB load. (4) System prompts (ONBOARDING + COMPANION) refreshed for parity with the new actions and auto-fill behavior. (5) e2e integration smoke test pins all 5 placement actions at the integration boundary. **Net plugin tests**: 712/712 unchanged (widget catalog stable since REFRESH 13). **Net eliza-game-builder tests**: 169/169 (was ~60 before this work). REFRESH 13 captured the AI authoring pivot. REFRESH 12 (2026-04-28 mid-day): D6.c long-tail continues — 13 more widgets shipped over slices 46-58. Total session arc widget count: 28 widgets / ~8,400 LOC of widget code / +240 plugin tests (slices 31-58, 198 → 438). All 6 manifest categories now seeded — overlay (5), HUD (7), modal (4), panel (8), menu (1), debug (1). New primitives this refresh: QuantityPrompt, IncomingRequestModal, EquipmentSlotIcon, DialoguePanel, ArrayInput, CurvePreview, ContextMenu, KeyValueList, CursorTooltip, NotificationToastList, BuffBar, VictoryOverlay, AlignmentGuides. Plugin 321/321 → 438/438 (+117 new this refresh). Recipe is fully mechanical across every shape (presentational, RAF tickers, callbacks, packet sends, canvas rendering, SVG-radial-progress, animation-token-driven re-mounts, generic primitives, abstract patterns).** REFRESH 11 (slices 37-45): 9 widgets, panel/modal categories seeded. REFRESH 10 closed D6.c.2 overlay set + 3 HUDs (slices 31-36). REFRESH 9 substantively closed #8. REFRESH 8 closed #7 end-to-end. REFRESH 7 #7 substrate. REFRESH 6 partial #8. REFRESH 5 closed #9 (CombatSystem). REFRESH 4 closed #10 (registry hot-reload). REFRESH 3 closed AI test-coverage gap.
two days ago. The single biggest blocker on the prior top-10 list
("#2 Hyperscape→plugin extraction, XL effort, biggest unknown") is
mostly resolved.

Branch composition by additions (vs `main`):

| Area | LOC additions | Share |
|---|---:|---:|
| `packages/asset-forge/` (editor) | 241,094 | ~44% |
| `packages/hyperscape-plugin/` (game-as-plugin) | ~80,000+ | ~15% |
| `packages/shared/` (runtime engine) | 202,374 (-30,000+ this week) | ~33% net |
| `packages/manifest-schema/` | 49,614 | ~9% |
| `packages/gameplay-framework/` | 12,169 | 2% |
| `packages/ui-framework/` | 6,969 | 1% |
| `packages/client/` | 6,650 | 1% |
| `packages/server/` | 4,065 (-25,709) | net negative — code moved through shared into plugin |
| `packages/ui-widgets/` | 3,005 | <1% |
| Other (procgen, contracts, oracles, gold-betting-demo, sim-engine, decimation, impostors, web3, website, app, vast-keeper, rtmp-muxer, plugin-*) | ~12,500 | 2% |

The branch is **~44% editor, 33% runtime engine, 15% game-plugin, 8% framework + everything else**.
The shift from "shared has everything" to "plugin owns game logic"
is the single biggest visible change in the past 48 hours.

---

## REFRESH 15 — Agent ↔ studio data-layer unification (P0+P1 of PLAN_AGENT_STUDIO_PARITY shipped end-to-end) (2026-05-01 early morning)

**The single biggest user-visible architectural fix shipped tonight.** Before
tonight, agent-emitted placements (NPCs/spawns/resources/stations/teleports)
lived in a parallel `agentWorldContent` store. They rendered in the viewport
via `useAgentEntityMarkers` but had:
  - No transforms (gizmo wouldn't act on them)
  - No property panels (couldn't edit fields)
  - No `rotation` / `scale` / `properties bag` / `source` / `sourceRegionId`
  - Separate "AI Generated" outliner subtree (not in the main hierarchy)
  - Dual persistence path (worldContent JSON instead of via studio autosave)

**After tonight's session, agent placements are structurally indistinguishable
from designer/procgen placements** — same data store (`extendedLayers`),
same render path (`useEditorWorldSync`), same edit path (gizmo + properties),
same persistence (autosave), same load path. The dual-store ghost is gone.

### Phase commits (in order shipped)

- **P1 — Schema extension** `4bc4b6ac3`. `PlacementCommonSchema` Zod fragment
  merged into all five `WorldArea*` schemas. Adds rotation, scale, properties
  bag, source enum (designer/procgen/agent), sourceRegionId. All optional —
  100% backward compat. +12 schema tests, total manifest-schema 1831 → 1842.
- **P0.1 — Bidirectional mappers** `f58ed7de7`. Pure-function
  `worldArea*ToPlaced` + `placed*ToWorldArea` for all 5 placement kinds.
  Game-space (centered, agent's convention) ↔ scene-space (corner, studio's
  convention) coordinate translation. Field-shape translation (NPC dialogue
  Record → dialogId, Resource type free-form → restricted enum with
  `originalType` round-trip, Station bankId/runeType, Teleport
  type-enum-via-properties). +34 round-trip tests; lossless for every field
  the forward mapper preserves.
- **P0.2 — Dispatcher hook** `1b6bc2af8`. `useAgentPlacementDispatcher` hook
  composes (state-derived `worldCenterOffset`) + (P0.1 mappers) + (existing
  `actions.addNPC`/etc.) into 5 single-call dispatch functions. Pure-function
  `computeWorldCenterOffset(world)` extracted for unit testing. +8 tests.
- **P0.3 — Companion uses dispatcher** `83229c45e`. `WorldStudioCompanion`
  swaps `setAndPersistAgentX` → `placementDispatcher.placeX`. Removals route
  through `actions.removeX`. Composite-key kinds (mobSpawn / resource) match
  by the synthesized `<key>@x,y,z` scene-space id format. Quests + zones stay
  on the legacy path until P0.7+.
- **P0.4 — Outliner color-codes by source** `80d7e7061`. `SourceIndicator`
  component renders a 1.5×1.5px color dot per leaf node when
  `metadata.source` is non-default: agent → primary purple
  (#a855f7), procgen → amber (#f59e0b). Designer/hand-placed → no
  indicator (default state).
- **P0.6 — Project load rehydrates worldContent → extendedLayers**
  `41b90fca6`. New `rehydrateExtendedLayersFromWorldContent` helper called
  from `useProjectLoader` after world loads. Walks each placement kind in
  the persisted JSON, maps via P0.1, dispatches via the actions surface.
  Legacy `rehydrateAgentWorldContentFromProject` reduced to quests + zones
  only (prevents double-render). +9 tests.
- **P0.5.a — Delete useAgentEntityMarkers + AutomationPanel migration**
  `97ea94158`. The 419-LOC parallel-store renderer is now dead code (no
  writes go to its data source). File deleted, ViewportContainer call
  removed. AutomationPanel demo button migrated to dispatcher (single line
  of code instead of validate → store → manual persist).
- **P0.5.b — Strip placement-side machinery from agentWorldContent**
  `e7aca07cc`. `agentWorldContent.ts` 754 → ~330 LOC. Placement setters,
  setAndPersist wrappers, composite-key helpers all deleted. Interface now
  carries only `zones` + `quests`. `OutlinerPanel.buildAgentContentNode`
  drops placement folders (agent placements show in main "Game Entities"
  subtree color-coded by source). `WorldStudioCompanion`'s projectContext
  builder reads ALL placement kinds from extendedLayers (drops dual-store
  merge). `usePIESession` adds `extendedLayers.npcs` to PIE NPC list (covers
  agent + designer-palette NPCs — pre-existing gap closed as a side benefit).

### Net diff for the architectural unification

| Metric | Value |
|---|---:|
| New code (mappers + dispatcher + rehydrator + tests) | ~+1,700 LOC |
| Legacy code deleted (useAgentEntityMarkers + agentWorldContent placement side) | ~-1,021 LOC |
| **Net** | **simpler post-unification** |
| New tests | +63 (mappers 34, dispatcher 8, rehydrator 9, schema 12) |
| Total tests across packages | 2,180 (was ~2,107) |

### What this unlocks

Agent emissions now get for free (no new code needed — they were already
wired to extendedLayers, just hadn't been getting agent data):

- Gizmo translate / rotate / scale (single + multi-select)
- 16 PropertyPanel renderers (NPC, MobSpawn, Resource, Station, etc.)
- Outliner integration with source-color tagging
- Selection outline + multi-select
- Undo / redo
- Auto-save (extendedLayers persists through useAutoSave)
- Brush systems can interact with agent placements
- PIE (Play-In-Editor) sees agent NPCs as live game entities

### What remains in PLAN_AGENT_STUDIO_PARITY

P0+P1 done. Remaining 11 phases are additive (not blocking):

| Phase | Effort | What |
|---|---|---|
| P2 | M | PROPOSE_TOWN + PROPOSE_ROAD (towns require new "customTowns" state slice; roads use existing CustomRoad path) |
| P3 | S | PROPOSE_PATH (genre-agnostic primitive — racing checkpoints, FPS lanes, etc.) |
| P4 | L | Plugin-contributable property panels (JSON-Schema-driven generic renderer for plugin-declared entity types) |
| P5 | M each | Coverage parity — PROPOSE_WATER_BODY / MINE / POI / DANGER_SOURCE / WILDERNESS_BOUNDARY |
| P6 | M | Audio zones (PROPOSE_MUSIC_ZONE / AMBIENT_ZONE / SFX_TRIGGER) |
| P7 | M | Functional NPCs (PROPOSE_SHOP_INVENTORY + DIALOGUE_TREE + validators) |
| P8 | L | Combat content authoring (mob defs, items, loot tables, bosses) |
| P9 | M | Place-at-terrain-feature semantics ("near water", "on peak") |
| P10 | L | Brush ops via agent (terrain sculpt, biome paint, vegetation) |
| P11 | M | Plugin-contributed wizard flows |
| P12 | L | Genre-agnostic primitives (cover meshes, capture points, checkpoints) |

P2 is the highest-leverage next slice (largest visible "this is a real game
world" win). P4 is the architectural unlock for non-RPG genres.

### Pre-tonight context (also shipped earlier in the same calendar day)

| Commit | What |
|---|---|
| `8679afa1d` | Asset pack ecosystem + AI ↔ assets ↔ plugins integration milestone (~150 files) |
| `47e904b9c` → `2937da50d` | Teleport-vertical 3-slice (PROPOSE_TELEPORT action + studio wiring + e2e smoke) |
| `e7eadba32` | Outliner shows agent resources/stations/teleports |
| `d14a2ce3d` | DesignWithAIDialog wires all new agent actions |
| `21f6905a2` | Plugin install endpoint + agent wiring |
| `f9067f182` → `4f6822193` | Marker-visibility debugging odyssey (terrain-snap, MeshBasicNodeMaterial, scene-graph attachment, worldCenterOffset) |
| `76529c67f` | Cap terrain.worldSize at 200 (262k-tile world bug) |
| `bbaff64d0` | Onboarding sends projectContext + auto-installs ref'd packs |
| `76bd272d4` | PLAN_AGENT_STUDIO_PARITY.md doc (423 lines, 14-phase plan) |

---

## REFRESH 14 — Asset pack ecosystem + AI ↔ assets ↔ plugins integration shipped end-to-end (2026-04-30 evening)

Two days after REFRESH 13's pivot to "AI authoring foundations,"
the work shifted onto a different but complementary arc — the
**asset pack ecosystem** plus the **agent vocabulary for placing
gameplay entities into a world** (PROPOSE_NPC_PLACEMENT,
PROPOSE_MOB_SPAWN, PROPOSE_RESOURCE, PROPOSE_STATION,
PROPOSE_TELEPORT). This is the world-content side of what
PLAN_AI_AUTHORING_FOUNDATIONS does for HUDs.

### What shipped

**Headline commit `8679afa1d` (~150 files)** — the asset-pack
ecosystem + AI integration milestone, accumulated over the
preceding session arc and committed as one feat:

- **Asset packs (PLAN_ASSET_PACKS AP1-AP9)**: schema + DB
  migrations (0009 asset_packs, 0010 visibility tier),
  `AssetPackService` (CRUD + marketplace browse + publish/unpublish
  + entries), Hyperia seeder produces 10 category-specific built-in
  packs (~142 assets across trees, rocks, npcs, mobs, weapons,
  armor, tools, stations, consumables, resources). Top-level
  `AssetPacksPage` in nav with team picker, `AssetPackBrowserPanel`
  with Marketplace + My Team tabs, Create Pack modal, Add Asset
  modal (Library / Generate / URL), pack detail popup with asset
  grid + hero, hover lifts, stats summary, real-time toast feedback.
- **Real GLB previews in pack browser**: built a singleton WebGPU
  thumbnail renderer with LRU cache + serial queue + IntersectionObserver
  lazy-load. `ModelThumbnail` React component + `loadModelForScene`
  + `assetRefResolver` (cached pack manifest fetch). Solved the
  "still no asset preview image in the packs" gap.
- **AI ↔ assets ↔ plugins (Layer A + Layer B)**: Layer A added
  the `assetRef` field on every placement schema (NPC, MobSpawn,
  Resource, Station, Teleport). Layer B made plugins self-describe
  their entity types via `EntityTypeContribution` in `plugin.json`;
  the Hyperscape plugin declares 15 native types. New agent actions:
  `LIST_ENTITY_TYPES`, `LIST_ASSET_PACKS`, `PROPOSE_ASSET_PACK_INSTALL`,
  `PROPOSE_STATION`, `PROPOSE_RESOURCE`, `PROPOSE_NPC_PLACEMENT`
  (all the placements). Placement validators (`validatePlacementType`,
  `validateAssetRef`, `autoFillAssetRef`) reject bad type/asset
  combos with structured errors that name valid choices.
- **Renderer integration**: `useAgentEntityMarkers` renders agent
  placements as 3D markers in the studio viewport; resolves
  `assetRef` → GLB → swaps in real model when ready, placeholder
  cube/cone/torus while loading or when no ref provided.
- **Auto-fill assetRef**: agent can omit `assetRef` and the host
  picks a sensible default (id-pref pass: `mobId="goblin"` →
  `goblin` entry; type pass: matches by `acceptedAssetTypes`).
  Saves prompt tokens AND keeps the schema's optional ref optional.
- **System prompts** (ONBOARDING + COMPANION) refreshed for
  parity with the new actions and auto-fill behavior. Hard rule
  #4 explicitly tells the agent it usually doesn't need to set
  assetRef.
- **Plugin Browser UI**: surfaces entity types per plugin
  (PluginBrowserPanel detail view).
- **Removal coverage**: REMOVE_FROM_PROJECT accepts `station` +
  `resource` (and now `teleport`) kinds.
- **e2e integration smoke test**: 11 cases pinning the
  integration boundary — LIST_ENTITY_TYPES catalog, LIST_ASSET_PACKS,
  GET_PROJECT_STATE availableAssets, all four propose actions
  with auto-fill + bad-type rejection + bad-ref rejection,
  cross-action data shape consistency.

**Today's 3 teleport-vertical slices** close the last
placement-vocabulary gap:

- `47e904b9c` `feat(eliza-game-builder): PROPOSE_TELEPORT action`
  — agent action for lodestones / portals / shortcuts. Modeled
  on PROPOSE_STATION but skips plugin-type validation (the
  schema's `type` field is a fixed enum, not plugin-extensible).
  Auto-fill via the preferred-id pass (passing `type` as the
  preferred id, so `lodestone` teleport pairs with a `lodestone`
  entry in any installed portals pack). 4 new tests.
- `7057f6ac0` `feat(world-studio): teleport end-to-end wiring` —
  studio side: `agentWorldContent` gains a `teleports` slice with
  `setAgentTeleport` / `setAndPersistAgentTeleport`; rehydrate +
  remove + clear all extended; `useAgentEntityMarkers` renders
  teleports as a violet torus (distinct from station cylinder);
  `WorldStudioCompanion` handles `PROPOSE_TELEPORT`; REMOVE_FROM_PROJECT
  schema accepts `kind: 'teleport'` + new test.
- `2937da50d` `test(eliza-game-builder): add PROPOSE_TELEPORT
  case to e2e smoke` — pins the teleport flow at the integration
  boundary alongside the other placement actions. 169/169 in the
  suite.

### Test counts

| Package | Before REFRESH 14 | After |
|---|---:|---:|
| `eliza-game-builder` | ~60 | **169** |
| `manifest-schema` | ~30 | unchanged |
| `hyperscape-plugin` | 712 | 712 |
| `agent-server` | clean tsc | clean tsc |
| `asset-forge` | 891 pre-existing | 891 pre-existing (zero new) |

### What's still open

After REFRESH 14, the only top-10 item still genuinely open is
**#5** (D6.c per-widget migration). The widget catalog at 50/52
items was sufficient for REFRESH 13's diagnostic phase; further
catalog growth is paused until the AI authoring loop demonstrably
needs more inventory.

PLAN_AI_AUTHORING_FOUNDATIONS phases A1-A4 shipped between
REFRESH 13 and 14 (catalog discovery, action bindings, plugin
scaffolder, agent shells — full chat-to-HUD loop in browser).
**A5 (worked example: AI builds a tiny game) is the only open
phase**. Recording / scripted Eliza session log proving the
end-to-end loop is the final marker.

PLAN_ASSET_PACKS shipped end-to-end. PLAN_PROJECT_AS_DATA shipped
in earlier sessions and is fully integrated. The Project-as-Data
+ Project Templates + Plugin Registry triumvirate now backs the
entire studio.

### What this means for the headline number

REFRESH 13 said ~89-90% AAA. REFRESH 14 closes:
- entire asset pack ecosystem (was non-existent)
- AI placement vocabulary (was partial — only NPCs + mobs)
- AI auto-fill (saves prompt tokens, makes the loop ergonomic)
- studio renderer integration (was placeholder-only)
- plugin self-description for entity types (was hand-coded)

Net: **~91-92% of the way to "truly AAA, truly done"**. Remaining
work is the long-tail D6.c per-widget migration (mechanical,
~7 sessions), A5 worked-example (1 session, demonstrates the
authoring loop), and non-plan items (cross-chain hardening,
streaming pipeline, mobile polish).

---

## REFRESH 13 — Pivot: diagnostic finds the framework works for read-only, not interactive; new plan for AI authoring foundations (2026-04-28 afternoon)

The widget-stockpiling phase (slices 31-80, 50 widgets, +514 plugin
tests) hit a natural pause point. Two strategic reframes happened
in conversation that this refresh captures:

**1. The vision is AI-buildable plugin marketplace, not just
clean engine/game separation.** HyperForge's primary user is an AI
agent that composes games from a growing plugin library, with both
humans and AIs as contributors. The 50-widget catalog isn't
"speculative primitives" — it's inventory for that flywheel.

**2. AI runtime split.** ElizaOS (already used by
`EmbeddedHyperiaService` for in-game agents) is the right
orchestration runtime for game-design and in-game-NPC agents.
**Code-writing agents** (filling in custom widget render logic,
running tests, fixing types) belong on specialized infrastructure
like Claude Code dispatched as a subprocess. Eliza coordinates;
code-agents execute. Same shape as how the duel AI delegates
pathfinding to engine systems.

### Diagnostic experiment shipped (`cedf92723` → `5ab4af98b`)

Instead of more consumer-swaps, ran a focused E2E experiment:
**can a third party with no Hyperia knowledge ship a UI from JSON
today?**

Test: `packages/client/tests/unit/ui-framework/tinyThirdPartyPack.test.tsx`
authors the smallest plausible third-party pack pinned to
`BUILTIN_WIDGETS` (no plugin dep) and runs it through the
production pipeline.

| Step | Claim | Status |
|---|---|---|
| 1 | `UIPackManifestSchema` accepts hand-written pack | ✅ |
| 2 | `loadUIPackOnClient` validates + registers + activates | ✅ |
| 3 | `uiRegistry` binds every layout `widgetId` to a component | ✅ |
| 4 | `ManifestRenderer` produces DOM | ✅ |
| 5 | `bindings` resolve from `DataContext` (data flow IN) | ✅ |
| 6 | No JSON path for action / command bindings (data flow OUT) | ❌ |

**Findings:**
- The framework works end-to-end for **read-only** UI authoring.
  Health bars, chat logs, leaderboards, themed reskins — shippable
  from JSON today.
- **Interactive UI requires host code today.** No `actions` /
  `commands` / `callbacks` field on `WidgetInstanceSchema`. None
  of the 15 builtin widgets has any onClick handler.
- 50 widgets shipped, **but the catalog is invisible to AI** — no
  machine-readable index, no MCP server, no CLI. An LLM has to
  grep through 52 widget files to discover what exists.

### New plan: `PLAN_AI_AUTHORING_FOUNDATIONS.md`

Five-phase plan for the foundations the AI authoring loop needs
**before** any LLM is wired in:

- **A1 — Catalog discovery service** (next up). Make the
  50-widget library AI-queryable. Cheapest with highest leverage.
- **A2 — Action / command bindings.** Close the JSON-authoring
  gap so interactive UIs can ship from manifests, not host code.
- **A3 — Plugin scaffolder service.** Make widget creation a
  programmatic call so the library scales with agent-hours, not
  engineer-hours.
- **A4 — Agent shells (Eliza + MCP + CLI).** Wrap A1/A2/A3 with
  the consumer-facing surfaces an AI runtime needs. First phase
  that touches an AI runtime.
- **A5 — Worked example: AI builds a tiny game.** Live-LLM
  validation. Recording + script. Acts as marketing demo,
  regression test, onboarding doc.

Each phase ships a typed TypeScript service first; agent shells
come after.

**This pivot deprioritizes:**
- Continuing the widget stockpile beyond slice 80 (52 widgets is
  enough inventory for the diagnostic phase).
- Continuing consumer-swap of legacy components (3 of 22 done in
  slices 81-83 — pattern proven; remainder is mechanical, can
  resume any time).

**This pivot prioritizes:**
- Making the existing inventory discoverable.
- Closing the action-binding capability gap.
- Proving the contributor flywheel with a real authoring loop.

---

## REFRESH 12 — Top-10 #5 D6.c long-tail: 13 more widgets, all 6 categories seeded (2026-04-28 mid-day)

Per-widget migration cycle on top-10 #5 continued. 13 more widgets
shipped over slices 46-58. **All 6 manifest categories now have
at least one widget.**

| Slice | What | LOC | Tests |
|---|---|---:|---:|
| 46 `c88e710af` | QuantityPromptWidget — K/M-aware quantity input modal | 310 | 12 |
| 47 `26d20872a` | IncomingRequestModalWidget — generic accept/decline modal (generalized from TradeRequestModal) | 325 | 6 |
| 48 `a3c526acb` | EquipmentSlotIconWidget — 13 slot icons collapsed to one widget keyed by slot enum | 225 | 9 |
| 49 `111643220` | DialoguePanelWidget — NPC dialogue interface; drops the 437-LOC Three.js portrait dep | 280 | 7 |
| 50 `7fa7c7e57` | ArrayInputWidget — list-of-strings editor with text/textarea modes | 330 | 10 |
| 51 `47f5dcf34` | CurvePreviewWidget — first canvas-rendering widget; drops `Curve` import via pre-evaluated samples | 210 | 9 |
| 52 `fc204c12d` | ContextMenuWidget — first menu-category widget; click-outside + Escape + viewport clamp | 280 | 8 |
| 53 `65592d21d` | KeyValueListWidget — first abstract pattern widget (no single legacy callsite) | 225 | 8 |
| 54 `c2a4b034a` | CursorTooltipWidget — mouse-following tooltip with `calculateCursorTooltipPosition` helper + 4 unit tests | 250 | 10 |
| 55 `1b945bf0a` | NotificationToastListWidget — 4-anchor toast stack with severity theming + slide-in keyframes | 360 | 11 |
| 56 `301453b86` | BuffBarWidget — buff/debuff timer rings (SVG-radial-progress, reduced-motion pass-through) | 430 | 11 |
| 57 `986bfc402` | VictoryOverlayWidget — celebratory headline with `key={animationToken}` re-mount pattern | 225 | 6 |
| 58 `be4e1f3ab` | AlignmentGuidesWidget — first debug-category widget; drag guide overlay | 170 | 10 |

Plugin tests: 321/321 → 438/438 (+117 new). Plugin type-check clean.
~3,620 LOC of widget code shipped over this refresh window.

**Cumulative session arc (slices 31-58)**: 28 widgets shipped end-
to-end across ~32 hours. ~8,400 LOC of widget code. Plugin tests
198/198 → 438/438 (+240). Recipe is fully mechanical across every
manifest category.

**All 6 manifest categories now seeded:**
- **overlay (5)**: KickedOverlay, DisconnectedOverlay, DeathScreen,
  CursorTooltip, NotificationToastList, VictoryOverlay
- **HUD (7)**: ConnectionIndicator, MinimapStaminaOrb, MinimapCompass,
  ActionProgressBar, HomeTeleportButton, MinimapHomeTeleportOrb,
  FloatingXPDrops, BuffBar
- **modal (4)**: SkillSelectModal, ConfirmDialog, QuantityPrompt,
  IncomingRequestModal
- **panel (8)**: UnlocksSection, CoinPouch, SelectOption,
  EquipmentSlotIcon, DialoguePanel, ArrayInput, CurvePreview,
  KeyValueList
- **menu (1)**: ContextMenu
- **debug (1)**: AlignmentGuides

**New patterns proven this refresh:**
- Canvas rendering with imperative `useEffect` + `getContext("2d")`
  composing cleanly with Zod-validated props (CurvePreview).
- SVG-radial-progress timer rings with reduced-motion pass-through
  (BuffBar).
- `key={animationToken}` re-mount as a clean alternative to manual
  `classList.remove + offsetWidth + classList.add` reflow tricks
  (VictoryOverlay).
- Pure helpers exported alongside widgets for hosts to compose
  (`calculateCursorTooltipPosition`, `parseQuantityInput`).
- Abstract pattern widgets with no single legacy callsite —
  derived from observed repetition (KeyValueList).
- Click-outside + Escape-to-close behavior owned by the widget,
  triggered through a single `onClose` callback (ContextMenu,
  CursorTooltip).

**Doesn't swap consumers yet** — the live client still mounts the
hand-coded versions. Registration-path-first; consumer-swap is a
separate consolidation cycle.

**Top-10 #5 progression**: Long-tail still long (~50 panels remain
mostly untouched, several HUD components untouched), but the recipe
is at full velocity — each S-cut widget takes ~5-10 minutes from
scratch to commit. Recommended next-cycle targets: legacy
EscapeMenu (358 LOC) + StatusBars (725 LOC) HUD remainder; the
remaining trade/duel/bank panel components; ProgressBar primitive
(currently inlined in many places).

---

## REFRESH 11 — Top-10 #5 D6.c long-tail: 9 more widgets, panels seeded (2026-04-27 evening / 2026-04-28)

Per-widget migration cycle on top-10 #5 (D6.c per-widget migration)
continued. Closed 3 more HUDs and seeded panel + modal categories
with 6 distinct shapes over 9 slices (37-45).

| Slice | What | LOC | Tests |
|---|---|---:|---:|
| 37 `92908594f` | ActionProgressBarWidget — progress (0-1) + action labels via props, inlined pulse keyframe | 250 | 7 |
| 38 `08725bc4c` | HomeTeleportButtonWidget — 3-state machine (ready/casting/cooldown), HOME_TELEPORT_STATUSES enum | 340 | 8 |
| 39 `17052a36f` | MinimapHomeTeleportOrbWidget — companion to #38, SVG orb variant of same state machine | 370 | 8 |
| 40 `3a7169a88` | SkillSelectModalWidget — first panel migration, DEFAULT_SKILL_CATALOG, onConfirm(skillKey) | 430 | 10 |
| 41 `a1b740916` | FloatingXPDropsWidget — pre-resolved icons in drop data, inlined keyframes via `<style>` | 190 | 8 |
| 42 `c4dce665c` | UnlocksSectionWidget — UNLOCK_TYPES tuple, overridable iconByType map | 210 | 10 |
| 43 `c646ad777` | CoinPouchWidget — pure presentational button, drops CursorTooltip dep | 225 | 9 |
| 44 `8fe443342` | SelectOptionWidget — themed `<select>` dropdown, generic `string` value type | 150 | 9 |
| 45 `0bc2ca82b` | ConfirmDialogWidget — generic yes/no modal with danger/primary variants, drops ModalWindow | 285 | 9 |

Plugin tests: 218/218 → 321/321 (+103 new). Plugin type-check clean.
~2,450 LOC of widget code shipped over this refresh window.

**Cumulative session arc (slices 31-45)**: 15 widgets shipped end-to-end
in ~24 hours of focused work. ~3,900 LOC of widget code. Plugin
tests 198/198 → 321/321 (+123). Recipe is fully mechanical and
proven across all four widget categories: overlay (3), HUD (6),
modal (2), panel (4).

**Per-widget recipe is now battle-tested** across:
- Pure presentational (KickedOverlay, ActionProgressBar)
- Internal state machines (Disconnected, DeathScreen,
  HomeTeleportButton, MinimapHomeTeleportOrb, ConnectionIndicator)
- RAF tickers (MinimapCompass, ConnectionIndicator)
- Event subscriptions transformed to props (NETWORK_*, NETWORK_KICK)
- Packet sends transformed to callbacks (Respawn, Reconnect,
  Withdraw, Confirm, SkillSelect)
- Pre-resolved derived data (FloatingXPDrops icons,
  UnlocksSection unlocks list)
- Inlined modal frames (SkillSelectModal, ConfirmDialog) — drops
  `ModalWindow`, `AchievementPopup`, etc. completely.
- Inlined keyframes via `<style>` tag with unique animation names
  (ActionProgressBar, FloatingXPDrops) — removes module-load
  `document.head.appendChild` side-effects.
- Generic primitives (SelectOption, ConfirmDialog) — usable beyond
  their original callsite.

**Render-variant pattern** confirmed: HomeTeleportButton (slice 38)
and MinimapHomeTeleportOrb (slice 39) share an identical 3-state
machine but render entirely different visuals (corner button vs SVG
orb). The state shape is reused; the renderer differs.

**Doesn't swap consumers yet** — the live client still mounts the
hand-coded versions. Registration-path-first; consumer-swap is a
separate consolidation cycle.

**Top-10 #5 progression**: 9 of ~19 HUDs done; 6 of ~50 panels.
Long-tail still long but the cost-per-widget is decreasing as the
recipe becomes mechanical. Recommended next-cycle targets:
EntityContextMenu, EscapeMenu, MinimapStaminaBar (HUD remainder);
DialoguePanel, PrayerPanel, StatsPanel (panel remainder, M/L cuts
each due to richer data shapes).

---

## REFRESH 10 — Top-10 #5 D6.c overlay set + first 3 HUDs shipped (2026-04-27 afternoon)

First per-widget migration cycle on top-10 #5 (D6.c per-widget
migration). Closed the D6.c.2 overlay sub-phase end-to-end + 3
non-overlay HUDs over 6 slices.

| Slice | What | LOC | Tests |
|---|---|---:|---:|
| 31 `bfd77e55b` | KickedOverlayWidget — single primitive prop, pure presentational | 140 | 7 |
| 32 `c0ad5ad67` | DisconnectedOverlayWidget — internal countdown, onReconnect callback | 225 | 6 |
| 33 `e0dcb34ff` | DeathScreenWidget — 2 internal state machines, onRespawn callback | 290 | 7 |
| 34 `511b66884` | ConnectionIndicatorWidget — 4-status state machine via props (host adapter owns NETWORK_* events) | 245 | 8 |
| 35 `3aaf0101c` | MinimapStaminaOrbWidget — SVG circular orb, runMode toggle via callback | 340 | 7 |
| 36 `470eca2cb` | MinimapCompassWidget — camera yaw display via prop, 3 size presets | 225 | 8 |

Plugin tests: 198/198 → 241/241 (43 new). Plugin type-check clean.
~1,320 LOC of widget code shipped today.

**Per-widget recipe established** for the long-tail:
1. Substrate-promote theme tokens to explicit Zod-validated color
   props with defaults matching legacy.
2. Side effects (network.send, location.reload, etc.) become
   optional callback props with parity fallbacks.
3. Internal state stays inside the widget.
4. Inline all styling — no `useThemeStore`, no client theme
   utilities, no client UI constants.
5. Drop external icon libraries in favor of plain text or inline SVG.

**Doesn't swap consumers yet** — the live client still mounts the
hand-coded overlays. Registration-path-first; consumer-swap is a
separate consolidation cycle.

**Top-10 #5 progression**: 3 of ~19 HUDs done; 0 of ~50 panels —
long-tail. Each remaining widget is its own focused S-M cut following
the now-established recipe. Recommended next-cycle targets (still
HUD set, mostly self-contained): ConnectionIndicator, HomeTeleportButton,
MinimapStaminaBar, ActionProgressBar.

---

## REFRESH 9 — Top-10 #8 substantively complete (2026-04-27 afternoon)

Top-10 leverage item #8 (final shared cleanup) advanced from "partial"
to **substantively complete** over 2 more slices on top of the 4-slice
REFRESH 6 work.

| Slice | What | Files |
|---|---|---|
| 29 `69df20933` | Relocate DuelSystem + DuelOperationResult + DuelSessionInfo interfaces from shared/system-interfaces.ts to plugin/types/duel-system-interface.ts | 5 |
| 30 `830745ca4` | Split resource-processing-types: footprint primitives (ResourceFootprint, FootprintDimensions, FootprintSpec, FOOTPRINT_SIZES, resolveFootprint) stay shared; game-specific types (Resource, ResourceDrop, Fire, ProcessingAction, DeathData) move to plugin/types/resource-game-types.ts | 10 |

Combined with REFRESH 6's 4 slices (quest-types, interaction-types,
social-types, trade-types), top-10 #8 totals **6 slices** end-to-end.

**State of `packages/shared/src/types/game/` after REFRESH 9:**
- `combat-types.ts` (105 LOC) — engine substrate (CombatStyle,
  CombatStateData, CombatTarget consumed by `utils/CombatUtils.ts`,
  `components/CombatComponent.ts`, `constants/WeaponStyleConfig.ts`)
- `duel-types.ts` (583 LOC) — bidirectional contract (24 references
  in `event-payloads.ts` + 5 in shared/system-interfaces.ts via
  remaining DuelRules/DuelState/etc. types)
- `inventory-types.ts` (285 LOC) — Bank/Store/Loot types deeply
  integrated (~80 internal consumers across shared)
- `item-types.ts` (508 LOC) — engine substrate (Item, Equipment, etc.)
- `prayer-types.ts` (343 LOC) — blocked by PrayerDataProvider (537 LOC,
  engine-side editor + DataManager + PIEEditorSession dep)
- `resource-processing-types.ts` (76 LOC, trimmed in slice 30) —
  footprint primitives only
- `index.ts` (17 LOC, mostly migration markers)

**The 5 remaining game-data files are all bidirectional engine
substrate.** Each remaining migration would require duplicating
duck-types in shared faster than removing them — net negative on
substrate health. Cleanup is functionally complete; what's left
isn't realistically migratable without restructuring the
event-bus contract or the data-provider singletons.

Substrate-promote hygiene: shared/server/network/index.ts no longer
imports `DuelSystem` from anywhere — it duck-types the 3 lifecycle
methods (processTick, onPlayerDisconnect, onPlayerReconnect) it
actually calls.

---

## REFRESH 8 — Top-10 #7 closed end-to-end (2026-04-27 mid-day)

Top-10 leverage item #7 (DataSourceRegistry + ui-pack.json) advanced
from "substrate-complete" to **closed** over 2 more slices on top of
the REFRESH 7 substrate work. Loading a different pack now actually
swaps the rendered HUD.

| Slice | What | Tests |
|---|---|---:|
| 27 `fa474a4f7` | client `uiPackRegistry` (in-memory pack store + active-pack pointer with useSyncExternalStore-friendly listeners) + `useActiveUIPack` React hook | 14 |
| 28 `c2a560b5e` | `ManifestHud` reads from active pack (precedence: pack > studio fetch > built-in default) | (covered by existing 117) |

Combined with the 5 substrate slices from REFRESH 7 (`71fe4f0ac` →
`b5fd1e6b0`), top-10 #7 totals **7 slices, 55 new tests**, all
shipped on `feat/world-studio`.

**Final public-API surface for D8/D9/D10:**
- `@hyperforge/ui-framework`: `DataSourceRegistry`, `DataSource`,
  `UIPackManifestSchema`, `UIPackManifest`, `UIPackLayoutsSchema`,
  `UIPackWidgetCatalogEntrySchema`, `UIPackCustomizationDefaultsSchema`,
  `validateUIPackManifest`, `loadUIPack`, `LoadedUIPack`,
  `LoadUIPackOptions`, `LoadUIPackResult`, `RegisterThemeFn`
- `@hyperforge/client`: `playerDataSourceRegistry`,
  `HYPERSCAPE_UI_PACK`, `HYPERSCAPE_UI_PACK_ID`, `loadUIPackOnClient`,
  `loadHyperscapeUIPack`, `LoadUIPackOnClientOptions`, plus
  `getActiveUIPack` / `getActiveUIPackId` / `setActiveUIPack` /
  `registerUIPack` / `unregisterUIPack` / `resolveUIPackById` /
  `listRegisteredUIPacks` / `uiPackRegistrySize` /
  `subscribeUIPackRegistry` and the `useActiveUIPack` React hook.

**ManifestHud layout precedence (D10 wire-through):**
  1. `activePack.defaultLayout` — when a pack has been
     `loadUIPackOnClient`-ed and marked active
  2. `activeLayout` from `useActiveUILayout` — studio team's
     server-fetched layout
  3. `getDefaultUILayoutForGame(gameId)` — built-in fallback

Pack supersedes studio fetch because pack authors expect their pack
to win (the studio fetch is a per-team override; packaged content is
the publisher default).

**Remaining D10 polish (deferrable, won't block AAA close)**:
  - Persist `HYPERSCAPE_UI_PACK` to disk as `hyperscape.ui-pack.json`
    + file-loader that consumes the JSON instead of the in-memory const
  - Plugin Browser integration (Phase I5 dep)
  - Verifying every Hyperscape HUD panel reads via
    `DataSourceRegistry` (gated by top-10 #5 — D6.c per-widget
    migration)

---

## REFRESH 7 — D8/D9 contract substrate shipped (2026-04-27 mid-day)

Top-10 leverage item #7 (DataSourceRegistry + ui-pack.json) advanced
from "open" to **substrate-complete** over 5 slices. The contract
layer for "ship a different ui-pack.json and get a different game's
UI" is now fully in place, with a working reference pack that
round-trips through JSON serialization.

| Slice | What | Tests |
|---|---|---:|
| 22 `71fe4f0ac` | `DataSourceRegistry` — pluggable bindings namespace provider; client refactored to register 4 built-in player namespaces through it | 10 |
| 23 `ad69d635f` | `UIPackManifestSchema` — wrapper schema bundling widget catalog + layouts + theme + customization | 13 |
| 24 `90c3e8266` | `HYPERSCAPE_UI_PACK` — concrete reference pack composing DEFAULT_UI_LAYOUT + HYPERSCAPE_DARK_THEME | 6 |
| 25 `5bbefdc44` | `loadUIPack` — engine-pure validate-and-project loader with optional theme-registration callback | 7 |
| 26 `b5fd1e6b0` | client `uiPackLoader` — bridges `loadUIPack` to local `themeRegistry` | 5 |

41 new tests across 5 slices; ui-framework 274/274 (was 244 pre-cycle);
plugin 198/198 throughout; shared build clean.

**Public API surface added:**
- `@hyperforge/ui-framework`: `DataSourceRegistry`, `DataSource`,
  `UIPackManifestSchema`, `UIPackManifest`, `UIPackLayoutsSchema`,
  `UIPackWidgetCatalogEntrySchema`, `UIPackCustomizationDefaultsSchema`,
  `validateUIPackManifest`, `loadUIPack`, `LoadedUIPack`,
  `LoadUIPackOptions`, `LoadUIPackResult`, `RegisterThemeFn`
- `@hyperforge/client`: `playerDataSourceRegistry`,
  `HYPERSCAPE_UI_PACK`, `HYPERSCAPE_UI_PACK_ID`, `loadUIPackOnClient`,
  `loadHyperscapeUIPack`, plus the preserved `buildPlayerDataContext`
  (now a thin delegate over the registry).

**What's not shipped yet (D10 exit gate):**
- Surface `LoadedUIPack.layouts` + customization to
  `useActiveUILayout` / `useUserLayout` so a different `ui-pack.json`
  actually swaps the rendered HUD. Today the pack pipeline is a
  contract — `ManifestHud` still reads from `DEFAULT_UI_LAYOUT`
  directly via the existing pipelines.
- Persisting `HYPERSCAPE_UI_PACK` to disk as
  `hyperscape.ui-pack.json` + a file-loader that consumes it instead
  of the in-memory constant.
- Plugin Browser integration (Phase I5 dep, can be deferred).
- Verifying every Hyperscape HUD panel reads via
  `DataSourceRegistry` — that's tied to top-10 #5 (D6.c per-widget
  migration).

The substrate-vs-wire-through split is the main scope decision: the
contract is done in this refresh; surfacing the contract through the
active-layout pipeline is a separate cycle (active-layout currently
reads from a server fetch, so the swap is non-trivial).

---

## REFRESH 6 — types/game/ migration partial (2026-04-27 mid-morning)

Top-10 leverage item #8 (final shared cleanup) advanced from "open"
to **partial** over 4 slices. `packages/shared/src/types/game/` shrank
from 11 files to 7; 1,124 LOC migrated to
`@hyperforge/hyperscape-plugin/src/types/` + 150 LOC of dead code
purged.

| Slice | File | LOC | Substrate-promote |
|---|---|---:|---|
| 18 | `quest-types.ts` → plugin | 383 | WorldDialogueConditionEvaluators QuestProgress → inline `QuestProgressLike` duck-type |
| 19 | `interaction-types.ts` deleted | 150 (dead) | none — file was unused, only barrel re-exports |
| 20 | `social-types.ts` → plugin | 219 | SOCIAL_CONSTANTS inlined into `social-live.ts`; ClientNetwork's typed payload imports → opaque pass-through types |
| 21 | `trade-types.ts` → plugin | 372 | TRADE_CONSTANTS inlined into `trading-live.ts`; TradingSystem + TradeOperationResult interfaces moved out of `system-interfaces.ts` to live with the implementation; dead TradeCancelledPayload import dropped |

Plugin barrel now re-exports all migrated public types so cross-package
consumers (server integration tests, client FriendsPanel, server
swap.ts) keep their imports stable on `@hyperforge/hyperscape`.

**Recipe-exhaustion confirmed** for the 6 remaining files in
`types/game/`. Each has real engine-tied internal consumers:

- `combat-types` (105 LOC): CombatStyle, CombatStateData, CombatTarget
  flow through `entities/`, `components/`, `utils/CombatUtils.ts`,
  `constants/WeaponStyleConfig.ts` — engine substrate.
- `duel-types` (583 LOC): 24 references in `event-payloads.ts` plus
  5 in the `DuelSystem` interface in `system-interfaces.ts`. Migration
  needs DuelSystem interface relocation + event-payload duck-typing.
- `inventory-types` (285 LOC): `Bank` (56 hits), `BankEntityData` (7),
  `StoreData` (10), `LootEntry` (8), `LootTable` (5) deeply integrated
  with shared internals.
- `item-types` (508 LOC, 8 shared consumers): heaviest. Item substrate
  for the engine; probably stays in shared permanently.
- `prayer-types` (343 LOC): blocked by `PrayerDataProvider` (537 LOC,
  engine-side editor + DataManager + PIEEditorSession dep).
- `resource-processing-types` (169 LOC): footprint primitives
  (ResourceFootprint, FootprintSpec, FOOTPRINT_SIZES, resolveFootprint)
  bidirectionally consumed by `entities.ts` AND plugin entities.
  Splitting yields only ~80 LOC of net migration.

**Each remaining file is a focused M-L cut** requiring substrate
refactors, not S-sized cleanup. Today's 4 slices represent the bulk
of low-hanging fruit; remaining work is heavier.

---

## REFRESH 5 — CombatSystem decomposition shipped (2026-04-27 late-morning)

**Top-10 leverage item #9 (CombatSystem decomposition, original target
4,019 → <2,000) hit and exceeded.** Final state: `CombatSystem.ts`
**1,359 LOC**, ~30% below the original target.

17 slices on `feat/world-studio` (commits `780ad016e` → `5f7fda8a9`,
all pushed). 198/198 plugin tests green throughout; shared build
clean at every slice boundary.

**16 cohesive helpers extracted** (in
`packages/hyperscape-plugin/src/systems/combat/`):

| Slice | Helper | Purpose |
|---|---|---|
| 1 | CombatEventEmitter | zero-alloc event-payload helpers |
| 2 | CombatPlayerQueries | skill-level, selected-spell, inventory queries |
| 3 | CombatEventRecorder | event-store record + state-snapshot builders |
| 4 | CombatDamageOrchestrator | melee/ranged/magic damage dispatch + equipment cache |
| 5 | CombatDeathHandler | handleEntityDied + handlePlayerRespawned |
| 6 | CombatLifecycleHandler | endCombat (timeout + manual force-end cleanup) |
| 7 | CombatAttackValidator | 5 pre-attack predicates + range checks |
| 8 | CombatFollowController | per-tick range + follow + getAttackTypeFromWeapon |
| 9 | CombatDamageApplicator | trunk damage path (polymorphic via damageHandlers Map) |
| 10 | CombatTickAttackWorker | per-tick auto-attack worker cluster (4 methods) |
| 11 | CombatProjectileHitProcessor | deferred-damage projectile-hit loop |
| 12 | CombatTickOrchestrator | processCombatTick + NPC/Player phase + autoAttackOnTick |
| 13 | CombatEnterLifecycleHandler | enterCombat (287-LOC method) |
| 14 | CombatMeleeAttackHandler | handleMeleeAttack + executeMeleeAttack |
| 15 | CombatRangedAttackHandler | handleRangedAttack mob + player branches |
| 16 | CombatMagicAttackHandler | handleMagicAttack mob + player branches |

**Slice 17 — dead-code purge**: 6 orphan files totaling ~3,142 LOC
deleted from the combat directory. Confirmed unused via mono-repo
grep — they were parallel implementations from a prior extraction
attempt that never got wired up:
- `handlers/MeleeAttackHandler.ts` (367)
- `handlers/RangedAttackHandler.ts` (532)
- `handlers/MagicAttackHandler.ts` (614)
- `handlers/AttackContext.ts` (342)
- `CombatTickProcessor.ts` (763)
- `CombatAnimationSync.ts` (511)

**Final CombatSystem.ts at 1,359 LOC** is mostly thin-proxy +
boilerplate (~340 LOC of constructor wiring for 16 helpers, ~211
LOC of small public accessors, ~163 LOC of remaining handler
methods, ~80 LOC of init() world-lookups, plus 6 thin-proxy methods
3-15 LOC each). The pattern is exhausted at this scale; the helpers
ARE the system now.

**Recipe artifacts from the 17-slice arc** (memory:
`session_2026_04_27_combat_complete.md`): closure-injection for
late-bound deps; map-reference sharing for ownership boundaries;
pooled-tile buffer sharing; public-method proxying preserves outside
callers; perl bulk-rewrite for callsite delegation; substrate-promote
for orphan code orphaned by parallel extractions.

---

## What this session shipped (2026-04-25 → 2026-04-26)

### Engine API extraction — Phases F3 + G-1

**5 new substrate interfaces** in
`packages/shared/src/systems/server/network/substrate/` that let
ServerNetwork dispatch into game-specific code without importing it:

- `IConnectionRegistry` (Phase F1, prior session)
- `ProcessingHandlerContext` (F3-3)
- `IHomeTeleportManager` + `HomeTeleportFactory` (F3-7)
- `IFriendsService` (F3-8)
- `ICombatAttackService` (F3-9)
- `IPlayerSpawnService` (G-1)

These join the earlier substrates (`ISpatialIndex`,
`IBroadcastService`, `IRegionSubscriptionService`,
`ITileMovementService`) for a total of **9 substrate types** that
form the engine→game contract surface.

**14/14 handler families migrated to plugin** (all of `network/handlers/`):

| Batch | Handler family | LOC | Pattern |
|---|---|---:|---|
| F3-1 (prior session) | chat, resources, magic, dialogue, entities | ~571 | direct migration via IConnectionRegistry |
| F3-2 | player, prayer, quest | 822 | direct migration |
| F3-3 | processing | 652 | substrate-promote (ProcessingHandlerContext) |
| F3-4 | duel/* (5 files) | 1,303 | direct migration |
| F3-5 | trade/* (2 files) | 707 | direct migration |
| F3-6 | combat split (style + retaliate) | 84 | direct migration |
| F3-7 | home-teleport | 287 | substrate-promote (IHomeTeleportManager + factory) |
| F3-8 | friends | 946 | substrate-promote (IFriendsService) |
| F3-9 | combat (handleAttackPlayer + Mob) | 280 | substrate-promote (ICombatAttackService) |
| G-1 | character-selection.ts | 1,383 | substrate-promote (IPlayerSpawnService) |

**Result:** `packages/shared/src/systems/server/network/handlers/`
is empty except for the `common/` subdirectory (engine-level
helpers used by plugin-side handlers via the shared barrel).
`character-selection.ts` is gone from shared.
**No Hyperscape-specific handler code remains in shared's network/
subdirectory.**

### Server post-migration cleanup

13 commits repairing stale paths and type alignments downstream of
the migrations:

- duelFood shim, DuelSystem submodule shims (7 files),
  GameTickProcessor type imports, DuelScheduler PlayerEntity import,
  store StoreSystem import, EmbeddedHyperiaService PlayerLocal,
  connection-handler PlayerLocal namespace lookup
- Test mocks: PendingGatherManager constructor signature,
  TileMovementManager EntityID brand cast
- Schema fixes: `streamingDuelEligible` → `streamingDuelEnabled`
  typo, `lore` field added to `AgentCharacterConfig`,
  `EmbeddedTickerGoalSnapshot.type` union widened to match
  `AgentGoal.type`, `resourceId` added to `NearbyEntityData`,
  `recipe`/`slot`/`questId` added to `CommandData`
- Duck-cast cleanup: `dashboardInterop.ts` `WorldEntity` cast
  fixed (was no-op due to redundant getWorld? extension);
  duplicate `getWorld()` in EmbeddedHyperiaService removed

**Server typecheck: 107 → 34 errors (73 cleared, 68% reduction).**
Server build now passes; the duplicate-getWorld warning is gone.

### Stability

Plugin tests: **187/187 throughout all 27 commits**. Server build,
plugin build, shared build all pass. Branch pushed to
`origin/feat/world-studio` at tip `c103e5e7e`.

---

## Phase-by-phase REVISED status

| Phase | Plan name | 2026-04-24 | **2026-04-26** | Why the change |
|---|---|---:|---:|---|
| 0 | Foundation | 100 | **100** | unchanged |
| A | Constants → manifests | 40 | **85** | re-audit revealed all 12 `data/*.ts` + all 11 `constants/*.ts` files are already manifest façades; only editor-side coverage (Phase B) and minor type-relocation work remains |
| B | Manifest editors | 20 | **20** | not touched |
| C | Property panel schema refactor | 65 | **65** | not touched |
| D | UI/HUD framework | 78 | **80** | Sessions 4 + 5A (XP orb + LevelUp toast) shipped; per-widget plugin contribution recipe proven with 2 worked examples + multi-widget contribution test |
| E | Audio/VFX/Anim/Input | 45 | **45** | not touched |
| F | Progression/Economy/Loc/Render | 45 | **45** | not touched |
| G | Missing systems | 35 | **35** | not touched |
| H | AI behavior as data | 35 | **50** | Session 6 shipped 136 unit tests across 9 AI services (was 0 before today). Each service has happy path + error path + parameter-shape assertions under mocked SDKs. Production-shipped AI integrations no longer have zero-coverage risk. |
| I | Plugin architecture | 88 | **98** | Session 3 — Plugin Browser UI install + uninstall shipped; only runtime hot-mount remains |
| J | Editor UX (UE5 parity) | 30 | **30** | not touched |
| K | Hygiene | 15 | **30** | 38 type errors cleared this weekend + 691 OSRS/RuneScape/Jagex naming-rule violations scrubbed (185 files, 0 remaining) |
| **Engine/game separation** (master criterion #2) | — | **5** | **75** | F3 + G1 closed handler/character-selection migration; lexical IP scrubbing complements structural separation |

**Plus: substantial work outside the master plan** (unchanged
this session)

| Area | Status |
|---|---|
| Cross-chain duel oracle (EVM + Solana) | ~80% (deployed mainnet+devnet) |
| Streaming pipeline (vast-keeper + rtmp-muxer) | ~50% |
| Mobile (Tauri + Capacitor) | ~40% |
| Marketing website | 100% |
| ElizaOS agent integration | ~70% |
| Sim-engine | ~80% |
| Gold-betting demo (Solana) | ~80% |

---

## The big honest picture

### What's actually shipped (substrate + tooling + GAME-AS-PLUGIN)

(Items added this session marked **NEW**)

- 129 manifest schemas with full Zod validation
- 128 providers boot-loaded through DataManager
- 104 module-level registries (**100 with `onReloaded` listener — long-tail exhausted, REFRESH 4**); 4 non-manifest registries (factory/runtime/ECS) permanently skipped with documented rationale
- **NEW: 9 engine substrate types** in `network/substrate/` covering
  every cross-package boundary in the runtime
- **NEW: 14/14 network handler families migrated to
  `@hyperforge/hyperscape-plugin`**
- **NEW: character-selection (1,383 LOC) migrated to plugin via
  `IPlayerSpawnService`**
- **NEW: `shared/handlers/` is empty (only `common/` engine helpers
  remain)**
- Full plugin framework: `gameplay-framework` + 4 reference
  plugins + 13-subcommand CLI + content store + community registry
- Full UI framework: `ui-framework` + `ui-widgets` (15 widgets) +
  UILayoutEditor + ManifestHud + theme system + input rebinding +
  per-player overrides + viewport variants
- Full World Studio editor: 21 panels, 18 property editors, 6
  procgen pipeline algorithms, deployment workflow
- Full WorldBuilder editor: terrain painter, foliage, water shader,
  procedural assets
- Asset pipeline: GLB decimation, LOD baking, impostor baking,
  VAT baking, vertex color baking
- AI generation pipeline: 6 Claude/OpenAI services, 3 ElevenLabs
  services, GPT-5 Vision, PlaytesterSwarm
- Runtime: gameMode + ScriptingSystem + ScriptGraphInterpreter
  (with PIE) + BehaviorTreeInterpreter
- PIE editor session with ServerNetwork loopback, hot-reload,
  `updateManifests()` covering 87+ manifest kinds
- Cross-chain on-chain layer: MUD contracts on Base mainnet/BSC/
  Avax + Solana Anchor program (devnet)
- Streaming GPU infra: Vast.ai keeper + RTMP muxer
- Marketing site + mobile app shells + ElizaOS plugin

### What's actually NOT done (real gaps, refreshed)

Two old gaps moved heavily this session, several remain unchanged:

1. ~~**Engine/game separation** — 1,044 Hyperscape identifiers + 343
   game-system files still in `packages/shared/`.~~ **PARTIALLY
   RESOLVED.** All network handlers + character-selection now
   plugin-side. Remaining shared-side game code is in
   `packages/shared/src/data/*.ts` (Phase A territory) and
   `packages/shared/src/types/game/*.ts` (game-specific types
   that engine substrate references via duck-typing).

2. **Plugin system not wired into prod startup** — gameplay-framework
   exists, plugin-hyperscape exists with 14 handler families and 4
   substrate-promoted services, but neither server nor client
   *boots through* the plugin loader. (#1 on prior top-10 — still
   #1.)

3. **Per-widget HUD migration** — only 5 of ~24 HUD elements
   migrated to widgets; ~50 panels have no widget. (No change.)

4. **Plugin Browser UI** — 107 TypeScript types shipped, zero React
   components rendering them. (No change.)

5. ~~**Consumer wiring of registries** — 10 of 104 registries have
   `onReloaded`; ~3 React UI consumers actually subscribe.~~
   **MOSTLY RESOLVED** (REFRESH 4, 2026-04-27 evening):
   **100/104 manifest registries now have `onReloaded`** (cuts #10–#28
   shipped 90 instrumentations across one session). Reusable
   `useRegistryReload` hook published in `@hyperforge/ui-widgets`
   wraps the subscription pattern over `useSyncExternalStore` —
   `const rev = useRegistryReload(registry)` replaces the hand-rolled
   `useState + useEffect` boilerplate. Two existing client consumers
   (XPOrb HUD + SpellsPanel) migrated. The remaining gap is
   **breadth of consumers**, not the wiring contract: PIE editor
   panels still consume manifests through their own context-based
   pipeline rather than shared registries — that's a larger refactor
   for a future session.

6. ~~**Game data extraction (Phase A)** — NPCs, items, world
   structure, duel rules, banks, spells, runes still hardcoded in
   `packages/shared/src/data/*.ts`.~~ **RESOLVED** (re-audit
   2026-04-26 evening): every `shared/data/*.ts` file is already a
   manifest façade — they load JSON, validate against a Zod schema,
   and expose the legacy export shape for backward compat. Same
   for all `shared/constants/*.ts`. Phase A is at ~85%. The
   remaining 15% is editor-side coverage (Phase B territory) and
   minor type relocation (Session 7).

7. **ManifestEditors UI breadth** — only 8 of 129 manifest schemas
   have dedicated editor UIs. (No change.)

8. **Hygiene** — ~~4,019-line CombatSystem (now plugin-side, target
   <2,000)~~ **RESOLVED REFRESH 5 — 1,359 LOC (-66.6%)**;
   3,208-line Entity.ts (target <1,500), ~2,267 console.* calls,
   4,309 skipped tests. (Marginal improvement: 73 typecheck errors
   cleared.)

9. **DataSourceRegistry (D8)** + **ui-pack.json (D9)** + **D10
   exit gate** in Phase D. (No change.)

10. **AI services have zero test coverage** — 10 AI integrations
    operational but untested. (No change.)

### What's NOT in the master plan but exists (unchanged)

- Cross-chain duel oracle (EVM + Solana) — ~80%
- Streaming GPU pipeline (Vast.ai)
- Mobile app (Tauri + Capacitor)
- Marketing website (live)
- Sim-engine
- Gold-betting demo

---

## Top 10 highest-leverage REMAINING work (refreshed)

The prior list's #2 was the XL "biggest unknown" that's mostly
resolved. The new list reorders:

| # | Item | Phase | Effort | Why now |
|---|---|---|---|---|
| ~~1~~ | ~~**Wire plugin system into server/client startup**~~ | ~~post-I~~ | ~~S~~ | **DONE (audit re-verification 2026-04-27 evening)** — server `bootServerPlugins` + client `bootClientPlugins` both invoke `startPluginSessionFromModules` in production boot. Hyperscape meta-plugin's `onEnable` registers entity types + widgets + systems on the host world. 8/8 server plugin-boot tests green. |
| ~~2~~ | ~~**Game-data JSON extraction**~~ | ~~A~~ | ~~M~~ | **RESOLVED 2026-04-26 evening** — re-audit found all data/*.ts and constants/*.ts files already façaded |
| ~~3~~ | ~~**Plugin Browser UI**~~ | ~~I5~~ | ~~M~~ | **DONE** — `PluginBrowserPanel.tsx` (666 lines) ships Browse + Installed tabs with `useSyncExternalStore` over the installed-plugins store, install button, sha-verified content download. |
| ~~4~~ | ~~**D7 plugin widget contribution + D6.c.1 (XP orb)**~~ | ~~D~~ | ~~S~~ | **DONE** — `XPOrbWidget.tsx` + `LevelUpToastWidget.tsx` ship from `@hyperforge/hyperscape-plugin/src/widgets/`, registered via `ctx.widgets?.register(...)` in plugin onEnable. Both widgets unit-tested. Pattern established. |
| 5 | **D6.c per-widget migration (19 HUDs + 50 panels)** | D | L | Closes the HUD framework. **IN PROGRESS 2026-04-28 — REFRESH 12**: 28 widgets shipped end-to-end on `feat/world-studio` (`bfd77e55b` → `be4e1f3ab`). **All 6 manifest categories now seeded**: overlay (5), HUD (7), modal (4), panel (8), menu (1), debug (1). Plugin tests 198/198 → 438/438 (+240 new). ~8,400 LOC of widget code. Per-widget recipe is fully mechanical and proven across every category. **New patterns proven**: canvas rendering, SVG-radial-progress, animation-token re-mount, exported pure helpers, abstract pattern widgets, click-outside owned by widget. ~9 of ~19 HUDs done; ~12 of ~50 panels (counting modals + menu + debug as panel-adjacent). Long-tail still long but cost-per-widget is at full velocity (S-cut ~5-10 min). Each remaining widget is its own focused cut. Consumer-swap (deleting hand-coded files) is a separate consolidation cycle. |
| ~~6~~ | ~~**AI service test coverage**~~ | ~~H~~ | ~~M~~ | **RESOLVED 2026-04-26 evening — Session 6 shipped 136 unit tests across 9 services. All AI integrations now have happy/error/parameter coverage under mocked SDKs.** |
| ~~7~~ | ~~**DataSourceRegistry (D8) + ui-pack.json (D9)**~~ | ~~D~~ | ~~M~~ | **RESOLVED 2026-04-27 — REFRESH 8**: D8 + D9 + D10 wire-through complete across 7 slices on `feat/world-studio` (commits `71fe4f0ac` → `c2a560b5e`). Shipped: `DataSourceRegistry` (pluggable bindings namespaces, 10 tests) + `UIPackManifestSchema` (wraps widget catalog + layouts + theme + customization, 13 tests) + `HYPERSCAPE_UI_PACK` (reference pack composing DEFAULT_UI_LAYOUT + HYPERSCAPE_DARK_THEME, 6 tests) + `loadUIPack` (pure engine runtime, 7 tests) + `uiPackLoader` (client bridge to themeRegistry, 5 tests) + `uiPackRegistry` + `useActiveUIPack` (D10 host-side state + React hook, 14 tests) + `ManifestHud` reads from active pack (D10 wire-through). 55 new tests across 7 slices; ui-framework 274/274 + plugin 198/198 + client ui-framework 117/117 throughout. Loading a pack now actually swaps the rendered HUD end-to-end. **Remaining polish (deferrable)**: persist HYPERSCAPE_UI_PACK to disk as `hyperscape.ui-pack.json` + file-loader; verify every Hyperscape HUD panel reads via DataSourceRegistry (gated by top-10 #5). |
| 8 | **Final shared cleanup** (`data/duel-manifest.ts` substrate, `types/game/*` extraction) | A/I | M-L | **SUBSTANTIVELY COMPLETE 2026-04-27 — REFRESH 6 + 9**: 6 slices total. REFRESH 6: 4 type files migrated (quest-types/social-types/trade-types to plugin; interaction-types deleted as dead code). REFRESH 9: DuelSystem interface relocated to plugin (slice 29) + resource-processing-types split (slice 30 — footprint primitives stay shared, game types move to plugin). `packages/shared/src/types/game/` 11 → 7 files. The 5 remaining files (combat-types, duel-types, inventory-types, item-types, prayer-types) are all bidirectional engine substrate consumed by event-payloads/system-interfaces/components/utils/PrayerDataProvider — each remaining migration would duplicate duck-types in shared faster than removing them. Cleanup is functionally complete; remaining items are blocked by legitimate engine substrate needs. |
| ~~9~~ | ~~**CombatSystem decomposition (4,019 → <2,000)**~~ | ~~K4~~ | ~~L~~ | **RESOLVED 2026-04-27 — REFRESH 5: 17-slice decomposition shipped on `feat/world-studio` (commits `780ad016e` → `5f7fda8a9`). `CombatSystem.ts` 4,065 → 1,359 LOC (-66.6%, ~30% below the <2,000 target). 16 cohesive helper files extracted: AttackValidator, FollowController, DamageApplicator, TickAttackWorker, ProjectileHitProcessor, TickOrchestrator, EnterLifecycleHandler, MeleeAttackHandler, RangedAttackHandler, MagicAttackHandler, EventEmitter, PlayerQueries, EventRecorder, DamageOrchestrator, DeathHandler, LifecycleHandler. Plus 3,142 LOC of orphan dead code (handlers/{Melee,Ranged,Magic}AttackHandler + handlers/AttackContext + CombatTickProcessor + CombatAnimationSync) purged in slice 17 — confirmed unused via mono-repo grep. 198/198 plugin tests green throughout; shared build clean.** |
| ~~10~~ | ~~**Long-tail registry consumer-wiring (~90 still unwired)**~~ | ~~F/G~~ | ~~M each~~ | **RESOLVED 2026-04-27 — 100/104 instrumented across cuts #10–#28; `useRegistryReload` hook in ui-widgets makes adding any new consumer a 1-liner. Remaining gap is consumer breadth (PIE editor panels), not contract wiring.** |

---

## Realistic remaining effort (refreshed)

If "done" = master plan's 7 success criteria all green:

**2–3 focused 2-hour sessions** for the remaining open top-10 items
— down from 2–4 before REFRESH 9 because item #8 is now
substantively complete. Only #5 (D6.c per-widget migration, L)
remains as a top-10 open item.

- ~~1 session: wire plugin system into prod (item 1)~~ **DONE**
- ~~1–2 sessions: game-data JSON extraction (item 2)~~ **DONE**
- ~~1–2 sessions: Plugin Browser UI (item 3)~~ **DONE**
- ~~1 session: D7 + D6.c.1 (item 4)~~ **DONE**
- 2–3 sessions: D6.c per-widget migrations (item 5)
- ~~1 session: AI test coverage (item 6)~~ **DONE**
- ~~D8/D9/D10 close-out (item 7)~~ **DONE — REFRESH 8 (7 slices)**
- ~~1 session: final shared cleanup (item 8)~~ **SUBSTANTIVELY DONE — REFRESH 6 + 9 (6 slices)**
- ~~ongoing: CombatSystem decomposition (item 9)~~ **DONE — REFRESH 5**
- ~~ongoing: long-tail registry consumer-wiring (item 10)~~ **DONE — REFRESH 4**

If "done" = also includes the non-plan work that's been started:
- Cross-chain mainnet hardening: 1–2 sessions
- Streaming pipeline integration: 2–3 sessions
- Mobile app polish: 2–3 sessions
- AI service hardening: 1–2 sessions

So **realistically 10–14 sessions** total to ship a complete
package — saved sessions across REFRESH 4 (item #10) and REFRESH 5
(item #9) bring the headline estimate down by 2–4 sessions vs the
pre-REFRESH-4 cut.

---

## Confidence in this refreshed audit

| Claim | Confidence | Evidence |
|---|---|---|
| Engine/game separation: 5 → 70% | **high** | Direct file inventory: `shared/handlers/` empty except common/, character-selection.ts gone, 9 substrate types proven, 14/14 handler families plugin-side |
| Phase I now ~92% | high | Plugin barrel re-exports cover the shipped surfaces; Plugin Browser UI is the only remaining I5 piece |
| Server typecheck 107 → 34 | **high** | Direct `tsc --noEmit` count, fully reproducible |
| Plugin tests 187/187 throughout 27 commits | **high** | Logged on every commit |
| Phase A still ~40% | high | `packages/shared/src/data/*.ts` and `types/game/*.ts` unchanged this session |
| Phase D still ~78% | high | UI framework files unchanged this session |
| Phases B, C, E, F, G, H, J unchanged | high | These weren't touched |
| Overall ~75% | medium | Phase weighting is somewhat subjective; criterion #2 weight is significant. Updated post-Session 6.9 (final AI service test). |

---

## Final TL;DR

**Two days of focused work converted the engine/game separation
from a 5%-complete biggest-unknown into a 70%-complete near-done.**
The substrate-promote pattern (interface in shared substrate, plugin
installs concrete implementation, shared internals lazy-resolve)
proved 5× this session and is the unblock-tool for any remaining
engine-coupled game code.

**Status: asset pack + AI ↔ assets ↔ plugins integration shipped end-to-end (REFRESH 14, 2026-04-30).** Headline commit `8679afa1d` shipped the full asset-pack ecosystem (10 built-in Hyperia category packs, marketplace UI, WebGPU thumbnail renderer) plus the agent placement vocabulary (LIST_ENTITY_TYPES + LIST_ASSET_PACKS + PROPOSE_NPC/MOB/RESOURCE/STATION + auto-fill assetRef + studio renderer integration). Today's 3 teleport slices (`47e904b9c`, `7057f6ac0`, `2937da50d`) closed the last placement-vocabulary gap. Plugin tests stable at 712/712; eliza-game-builder 60 → 169. **PLAN_AI_AUTHORING_FOUNDATIONS A1-A4 shipped between sessions; only A5 (worked-example) remains open. REFRESH 13 (2026-04-28 afternoon): diagnostic experiment proved framework supports read-only authoring end-to-end (5 of 6 checkpoints ✅) but interactive authoring requires host code (1 ❌ — no `actions` field on `WidgetInstanceSchema`). New plan `PLAN_AI_AUTHORING_FOUNDATIONS.md` defines 5-phase foundation work to close the gap (catalog discovery → action bindings → scaffolder → agent shells → worked example). Eliza orchestrates, Claude Code edits.** Slice 81-83 shipped 3 consumer-swaps (Kicked + Disconnected + DeathScreen + ConnectionIndicator + MinimapCompass) before the strategic pivot; pattern proven. Top-10 #5 widget stockpile is sufficient inventory for the diagnostic phase; further additions paused until the catalog is queryable. REFRESH 12 (slices 46-58): 13 widgets, 6 categories seeded. REFRESH 11 (slices 37-45): 9 widgets, panels/modals seeded. REFRESH 10 closed D6.c.2 overlay set + 3 HUDs (slices 31-36). REFRESH 9 substantively closed #8. REFRESH 8 closed #7 (DataSourceRegistry + ui-pack.json) end-to-end (7 slices). REFRESH 5 closed #9 (CombatSystem decomposition, 4,065 → 1,359 LOC). REFRESH 4 closed #10 (registry hot-reload long-tail). REFRESH 3 closed AI test-coverage gap. Branch pushed and ready for review.

The work pattern has shifted from "find structural blockers" to
"finish enumerable items":

| Old top-10 entry | Status |
|---|---|
| Wire plugin into prod | unchanged (S) |
| **Hyperscape→plugin extraction (XL biggest unknown)** | **mostly done** ✅ |
| D7 plugin widget + XP orb | unchanged (S) |
| Plugin Browser UI | unchanged (M) |
| D6.c per-widget migration | unchanged (L) |
| Game-data JSON extraction | unchanged (M) |
| ~~AI service test coverage~~ | **DONE — Session 6 closed (M)** |
| ~~DataSourceRegistry / ui-pack~~ | **DONE — REFRESH 8 closed end-to-end (D8 + D9 + D10 wire-through; 7 slices, 55 tests)** |
| ~~CombatSystem decomposition~~ | **DONE — REFRESH 5 closed (4,065 → 1,359 LOC, -66.6%; 16 helpers + 3,142 LOC dead-code purge)** |
| ~~Long-tail registry wiring~~ | **DONE — REFRESH 4 closed (M each → 100/104 instrumented)** |

With #1, #2, #3, #4, #6, #7, #8 (substantively), #9, #10 closed,
the only remaining top-10 item is:
- **#5** (D6.c per-widget migration, L) — long-tail UI migration
  that gates Phase D's exit (19 HUDs + 50 panels to be migrated to
  the widget contract). The contracts are all in place after
  REFRESH 8 (UI Pack pipeline + DataSourceRegistry); remaining work
  is per-widget conversion, which is intentional unit-of-work
  (one widget at a time) rather than architectural design.

9 of 10 top-10 items closed (8 fully + 1 substantively). Remaining
work is the long-tail UI migration that the prior phases unblocked —
not architectural design but mechanical conversion.
