# State of the Project

**Date:** 2026-04-29 (revised after B0 reopen)
**Tip commit:** working-tree changes pending on `feat/world-studio`
**Purpose:** Single composite picture of HyperForge / Hyperia work-to-date,
the active plan ecosystem, and the path to AAA. Update at each major
phase boundary; reference at session start.

> **2026-04-29 architectural correction.** The original B0 ("Hyperia
> ↔ PIE parity") was framed as glue. Live testing exposed that the
> actual unification is **Project-as-Data** — every project declares
> its terrain config, plugins, and content; PIE plays a project;
> Hyperia is one project among many. Old B0's four sub-slices shipped
> this session and are preserved as building blocks; the new plan
> (`PLAN_PROJECT_AS_DATA.md`) takes 10 slices to reach the real
> goal. Sections below reflect the new framing.

---

## The vision

**HyperForge** is a game-construction platform whose primary user is
an AI agent. A **Project** is the unit of customization — a typed
record `{ config, plugins, worldContent }` describing terrain,
gameplay surface, and authored data. World Studio's PIE plays a
project. `localhost:3333` is the published deploy of one specific
project (Hyperia). Agents author into a project across all three
layers via typed actions. Hyperia is the reference project that
proves the substrate works — but the engine has no special-case for
Hyperia; it just installs whatever plugins the active project
declares.

**Three operational claims that define "done":**

1. **Reconstruction**: PIE Play of the Hyperia project plays
   bit-for-bit identical to `localhost:3333`. (Without this, the
   platform claim collapses — Hyperia couldn't be rebuilt from its
   own blocks.)
2. **Blank-by-default**: PIE Play of a Blank project = engine boots,
   terrain renders, viewport empty (no avatar, no HUD, no mobs). The
   AI's first job is to fill it.
3. **Composition**: a designer sits in front of the editor for 10
   minutes, chats with an AI agent, declares plugins, has the agent
   author terrain/NPCs/quests/HUD into the project, and ends up with
   a small playable scene that survives Publish.

(1) is the substrate validation; (2) proves the model is real (no
hidden globals); (3) is the demo. All three required for AAA.

Long-term: a plugin marketplace where humans + AIs both contribute
building blocks; projects are portable across deployments; each new
plugin contribution makes the next agent-built game easier.

---

## Plan ecosystem (11 active plans)

### Complete plans

| Plan | What | Closing commits |
|---|---|---|
| `PLAN_AI_AUTHORING_FOUNDATIONS.md` | Phase A: catalog → action surface → agent runner → server → chat panel | A1 `f3845ac36` → A5 `48b664c23` |
| `PLAN_SERVERNETWORK_MIGRATION.md` | Move ServerNetwork to shared, real loopback in PIE | Steps 1–9 done, capstone `054588a48` |
| `PLAN_ENGINE_API_EXTRACTION.md` | Substrate interfaces (ISpatialIndex etc.) pinned to world.X | Phases A–F + G-1 done at `b7fd7318a` |
| `PLAN_UI_PACK_AAA.md` | UI pack runtime + authoring substrate (themes, variants, presets, rebinding) | U0–U11 all shipped 2026-04-19 |

### In-flight plans

| Plan | What | Status |
|---|---|---|
| `PLAN_PROJECT_AS_DATA.md` | **B0' — supersedes old B0. 10 slices A–J. Project = data; PIE plays a project; Hyperia is one project among many.** | **Just drafted (2026-04-29). Replaces the closed-too-narrowly old B0. Critical path ~6 weeks.** |
| `PLAN_AAA_QUALITY.md` | Phase B (B0–B10) — close 10 quality gaps | Old B0 reopened + replaced by `PLAN_PROJECT_AS_DATA.md`. B1–B10 unchanged in intent but reframed against project mutable. |
| `PLAN_NEXT_SESSIONS.md` | Top-10 decomposition queue | Sessions 1, 3, 5–8 still pending; Session 2 voided |
| `PLAN_ENGINE_GAME_SEPARATION.md` | Master engine/game split, 8 phases | Phase 2 ~70%, Phase 3 done, Phases 4–8 queued |
| `PLAN_WORLD_STUDIO_AAA_COMPLETION.md` | World Studio editor parity | Phases A/B/C ~30%, Phase D ~50%, E–K queued |
| `PLAN_PHASE_D.md` | UI/HUD framework D1–D10 | D1–D6 partial; D7–D10 queued |
| `PLAN_HEAVY_CLUSTER_MIGRATION.md` | Move 13 coupled gameplay systems out of shared | Wave 1 attempted, reverted on tsconfig strictness |
| `PLAN_ASSET_PACKS.md` | **Asset packs — bundle Hyperia's AI-generated 3D library so other projects can install it; agent's `PROPOSE_ASSET` outputs accumulate into reusable per-project packs.** | **Just drafted (2026-04-30). 9 slices AP1–AP9. Closes the "shareable art" gap.** |

---

## Decomposition status (per domain)

| Domain | Status | New home | Remaining in shared |
|---|---|---|---|
| Combat | ~95% | `@hyperforge/hyperscape` | Substrate interfaces only |
| Skills / gathering / crafting | ~70% | `@hyperforge/hyperscape` | Constants façades |
| Player / character | ~70% | Plugin (queued, Wave 5) | Player ECS, spawn service |
| Inventory / equipment / bank | ~70% | Plugin (queued, Wave 5) | Type defs, interfaces |
| Loot / economy | ~80% | Plugin | Economy constants |
| Quests / dialogue | ~50% | Plugin (partial) | Quest system core |
| NPCs / mobs / spawning | ~70% | Plugin (queued, Wave 3) | Mob behavior, spawn logic |
| Networking / ServerNetwork | 100% | `@hyperforge/shared` (engine) | — |
| UI / HUD / panels | ~40% | Widget registry + plugin | 70+ panels still hardcoded |
| World content / terrain / vegetation | ~70% | Plugin (TownSystem queued, Wave 2) | Terrain, spatial grid |
| Rendering / graphics / particles | 100% | `@hyperforge/shared` (engine) | — |

**Critical remaining mass in `packages/shared/src/`:**
- `systems/server/network/` — engine substrate (stay)
- `systems/shared/combat/` — ~2.5K LOC, Wave 6 target
- `systems/shared/character/` — Player + Skills + Equipment, ~3K LOC, Wave 5
- `systems/shared/economy/` — Inventory + GroundItem, Waves 3 + 5
- `systems/shared/entities/` — EntityManager + MobNPC, Wave 3
- `types/game/*.ts` — 3.3K LOC, substrate-promote or move (Session 7)

---

## Project-as-Data (B0' — current priority, replaces old B0)

**Plan:** `PLAN_PROJECT_AS_DATA.md`. 10 slices A–J. ~6 focused weeks.

The original B0 ("Hyperia-PIE parity glue") was framed as: PIE
always loads Hyperia, the work is wiring controller / HUD / avatar.
That framing produced four sub-slices (B0.1–B0.4) — all shipped on
this branch. They're not wasted — they survive as building blocks
inside B0'.F (avatar/HUD/click-to-walk as plugin contributions) and
B0'.J (parity smoke). But the framing was incomplete.

The actual mismatch: **plugin contributions are engine-scoped, not
project-scoped.** A "blank" project still loads Hyperia globally
because `bootServerPlugins(world)` runs unconditionally at server
boot. Different terrain per project is the only thing the project
shape actually controls; everything else is engine-global.

The new B0' fixes that at the substrate. Slices, in dependency
order:

| Slice | Scope | Size |
|---|---|---|
| B0'.A | Project schema + DB migration | 3d |
| B0'.B | Template picker (Blank / Hyperia) | 2d |
| B0'.C | PIE accepts a Project | 5d |
| B0'.D | Plugin contribution registry + agent actions to query it | 5d |
| B0'.E | Hyperia content moves into plugin onEnable | 5d |
| B0'.F | Avatar + controller + HUD as plugin contributions | 5d |
| B0'.G | Agent actions write to `Project.worldContent` | 3d |
| B0'.H | `PROPOSE_TERRAIN_CONFIG` action | 3d |
| B0'.I | `PROPOSE_PLUGIN_SET` action | 2d |
| B0'.J | Real state-equivalence parity smoke (Hyperia project ↔ localhost:3333) | 3d |

**Critical path: A → B → C → D → E → F → J (~4 weeks).**
Agent-authoring tier G → H → I (~1.5 weeks) slots in once C ships.

**B0' total: ~6 weeks. Blocks every B1+ capability.** B1–B3 collapse
to ~1 week of follow-on once the substrate is correct.

---

## What's left to reach AAA

### Hard blockers — B0' (must complete in order; see `PLAN_PROJECT_AS_DATA.md`)

**Survives from old B0 (still applicable; folds into B0'):**
- ✅ Plugin loader in prod startup (`PLAN_NEXT_SESSIONS` Session 1 closed earlier this branch). Server `startup/world.ts:149` calls `bootServerPlugins(world)`. Survives unchanged in B0'; the work in B0'.C is making PIE call a *project-scoped* equivalent.
- ✅ Real `InteractionRouter` wired in PIE (`d1f25db74`). Survives. Becomes the consumer of `PlayerLocal` entity once B0'.F spawns one.
- ✅ Live `DataContext` bridge (`7e2fa0b18`). Survives. Now reads from project-scoped player entity.
- ✅ Renderer/scene/camera bridged onto `_clientWorld` (`08de653ed`, `27ecf26d2`). Survives.
- ✅ Parity smoke test scaffold (`5bcd6ea17`). Replaced by B0'.J (real state-equivalence smoke); the file structure stays.

**Outstanding B0' slices (in order):**

1. ⚪ **B0'.A — Project schema + DB migration** (~3d). Define `Project` type. Migrate `world-projects` to typed `config / plugins / worldContent` columns. Backwards-compat existing rows.
2. ⚪ **B0'.B — Template picker** (~2d). Blank / Hyperia. New project list shows templates. Existing placeholder rows migrated.
3. ⚪ **B0'.C — PIE accepts a Project** (~5d). `PIEEditorSession.start({ project })` resolves and installs plugins per `project.plugins`. Empty plugin list = no Hyperia.
4. ⚪ **B0'.D — Plugin contribution registry** (~5d). Discoverable plugin list with typed manifests. `LIST_PLUGINS` / `GET_PLUGIN` actions for the agent.
5. ⚪ **B0'.E — Hyperia content into plugin `onEnable`** (~5d). DataManager loads engine-level only; Hyperia plugin loads its own world-areas / npcs / items / etc.
6. ⚪ **B0'.F — Avatar + controller + HUD as plugin contributions** (~5d). `PIEInteractionRouterShim` deletes; real `PlayerLocal` spawns from plugin; HUD layout comes from plugin's `defaultUILayout` contribution.
7. ⚪ **B0'.G — Agent actions write to project mutable** (~3d). `proposeNpcPlacement` (already shipped) and friends route into `project.worldContent`. Editor-local stores go away.
8. ⚪ **B0'.H — `PROPOSE_TERRAIN_CONFIG` action** (~3d). Agent reshapes terrain.
9. ⚪ **B0'.I — `PROPOSE_PLUGIN_SET` action** (~2d). Agent picks plugins.
10. ⚪ **B0'.J — Real parity smoke** (~3d). State-equivalence test against `localhost:3333`.

**B0' total: ~6 focused weeks (~36 working days).** Critical path
A→B→C→D→E→F→J ≈ 4 weeks; agent-authoring tier G→H→I ≈ 1.5 weeks
parallelizable after C.

**Next priority: confirm B0' framing, kick off B0'.A.**

### Then AAA capability tier (collapses substantially under B0')

5. **B1 — Agent authors world content** (~3–5 days under new substrate; was ~2.5 weeks). `proposeNpcPlacement` already shipped. Remaining 3 actions (zone, spawn, quest) follow the same pattern. Under B0' they all write to `project.worldContent` — no extra editor-local state to wire.
6. **B2 — Persistence** (~0; free under B0'.A). Project IS the persisted shape; nothing extra to ship.
7. **B3 — State-aware agent** (~3–5 days; was ~1 week). Agent reads the active project; pure prompt-plumbing.

### Then quality + sustainability

8. B4 — Iteration loop (refine/variants/undo) (~1 week)
9. B6 — Streaming UX (no 60s blank wait) (~3–5 days)
10. B7 — Closed code-write loop (test gating) (~3–5 days)
11. B9 — Asset gen wired into agent (~1 week)
12. B8 — Multi-agent orchestration (~1–2 weeks)
13. B10 — Live-LLM CI coverage (~3–5 days)

### Parallel tracks (independent of B sequence)

- **D6.c long-tail**: 70+ widgets still hardcoded; ~2–3 weeks at 6–8/week
- **Heavy-cluster Wave 1+**: 13 systems coupled; needs tsconfig strictness fix first; ~2 weeks total
- **D7–D10**: plugin contribution surface, DataSourceRegistry, ui-pack.json, legacy delete; ~4 sessions
- **`PLAN_ENGINE_GAME_SEPARATION` Phases 4–8**: scaffold `hyperia` package, file moves, engine rename, second game, npm publish; ~10–15 weeks
- **`PLAN_ASSET_PACKS.md` AP1–AP8**: Hyperia's AI-generated 3D assets bundled as `@hyperforge/asset-pack-hyperia-v1`, project-level `assetPacks` column, agent's `PROPOSE_ASSET` accumulates into per-project user packs, asset-pack-aware UI. Substrate (AP1–AP3) ~1 session; full feature ~3–4 sessions.

### Total to AAA

- **MVP demo path (B0' + B1 + B3)**: ~7 focused weeks (B0' ~6w + B1+B3 ~1w; B2 free)
- **Realistic with D6.c long-tail + cluster migrations parallel**: 4–6 calendar months
- **v1.0 published platform with `demo-arena` second game**: ~9–12 months

**MVP demo definition:** designer creates new project (template
picker shows Blank / Hyperia), picks Blank, chats with agent for 10
minutes — agent reshapes terrain, declares plugins, places NPCs,
authors a HUD — designer presses Play, world is real, gameplay
loop works, content survives reload and ships on Publish.

---

## Architectural commitments (constraints on future work)

1. **Manifest-first.** If it's data, it's a Zod-schema'd JSON manifest with an editor panel. Estimate editor work as ~40% of every data migration.
2. **Plugin-as-game.** Hyperia must load as a plugin to prove the split works. No special-cased Hyperia code paths.
3. **UILayoutManifest sole source.** Editor is system-of-record for layout/theme/bindings. Hand-edited JSON must safe-load with fallback.
4. **Substrate interfaces.** Cross-package coupling goes through `world.X` interfaces, not direct imports.
5. **Every migration lands in two commits.** Extract (zero behavior change) + expose (editor surface).
6. **No regression.** Each phase lands with vitest + Playwright smoke green. Live game never breaks. CI enforces engine purity.
7. **No OSRS/RuneScape/Jagex references** in code or tracked files. Project = HyperForge, game = Hyperia (not Hyperscape).
8. **Boot-order asymmetry**: server is `register → onEnable → init`; PIE is `register → init → onEnable`. New systems must work in both.

---

## Open risks / known issues

| Risk | Detail | Mitigation |
|---|---|---|
| **Cross-package type errors** | Heavy-cluster Wave 1 reverted on ~80 type errors at d.ts re-export boundary | tsconfig strictness diagnosis (1 day); fix before Wave 2 |
| **Renderer plumbing** | B0.2 needs renderer exposed through 3 levels of editor refs | Refactor `TerrainSceneRefs` to expose renderer (~1 day) |
| **Asset-forge yoga-layout build** | Pre-existing, not root-caused | Diagnose if it surfaces during cluster migration |
| **70+ widget long-tail** | D6.c.5 mechanical but time-consuming | Parallel execution or AI-assisted scaffolding |
| **IP audit cleanup** | 2379 OSRS/RuneScape/Jagex hits, mostly comments/docs | One large pre-v1.0 sweep PR; don't mix with feature work |
| **Plugin context versioning** | No version negotiation between plugin + host | Defer; raise pre-marketplace |
| **localStorage migration cross-deploy** | Old client + new server schema mismatch | safeLoadLayoutManifest covers most; revisit pre-v1.0 |

---

## Recommended immediate sequence

**Next 1–2 working days:**
- Confirm B0' framing with the team / decision-maker
- Decide plugin-registry policy (walk node_modules vs curated list — see open question 1 in `PLAN_PROJECT_AS_DATA.md`)
- Start B0'.A (Project schema + DB migration) — no risk, foundational

**Next 1–2 weeks:**
- B0'.A through B0'.C ship (3+2+5 = ~10 working days)
- New project flow already shows "Blank" template; PIE plays whatever the project declares
- D6.c widgets in parallel (6–8 widgets/week)

**Next 1–2 months:**
- B0' complete (state-equivalence parity validated; agent can author all three layers)
- B1 collapses to ~1 week (3 remaining actions)
- D6.c long-tail substantially closed

**Next 4–6 months:**
- B0' + B1 + B3 + B4 done
- D6.c long-tail done
- Heavy-cluster migrated
- Demo: designer creates blank project, chats with agent, plays a tiny new game in 10 minutes

**Next 9–12 months:**
- `PLAN_ENGINE_GAME_SEPARATION` Phases 4–8 done
- v1.0 with `demo-arena` (or other second game) shipped as a project template
- Plugin marketplace MVP

---

## Sources

This document synthesizes content from:
- All 10 `PLAN_*.md` files at the repo root
- `MEMORY.md` index + recent session entries
- 502 commits on `feat/world-studio` (last 30 days)
- Substrate audit (file paths cited in plans)

Update this document when:
- A plan completes (move to "Complete" section)
- A new plan is drafted
- Major architectural commitment changes
- Decomposition status materially advances per domain
- Major risks identified or mitigated
