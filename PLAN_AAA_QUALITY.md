# AAA Quality — Plan

**Status:** Updated 2026-04-29 — B0 reopened + replaced by `PLAN_PROJECT_AS_DATA.md`
**Predecessor:** `PLAN_AI_AUTHORING_FOUNDATIONS.md` (Phase A complete — `48b664c23`)
**Tip commit at planning time:** `48b664c23` on `feat/world-studio`

> **2026-04-29 architectural correction:** the original B0 ("Hyperia
> ↔ PIE parity") was framed as "make PIE behave like Hyperia." Live
> testing exposed a deeper mismatch — *plugin contributions are
> currently engine-scoped, not project-scoped*. Hyperia is loaded
> globally regardless of which project is open, so a "blank" project
> still gets Hyperia's mobs, NPCs, stations, HUD. The actual
> unification is **Project-as-Data**: a project declares its
> terrain config, plugins, and content, and PIE plays a project.
> Hyperia is one project among many. See
> **`PLAN_PROJECT_AS_DATA.md`** — that plan supersedes B0 here. The
> rest of B1–B10 is unchanged in intent but reframed to operate
> against `Project.worldContent` instead of editor-local state.

## North star

Phase A proved the AI-authoring chain works end-to-end:
chat → catalog → action → validated pack → editor state → live PIE
render. The agent designs a HUD, the user sees it appear over their
world. **That's a PoC, not AAA.**

AAA means closing the long tail of quality gaps so the platform can
credibly claim *"AI builds games"* — not just *"AI composes a HUD."*
This plan defines those gaps and the sequence to close them.

## What's working today (Phase A complete)

- 52-widget typed-queryable catalog (`@hyperforge/widget-catalog`)
- 6 ElizaOS actions (`@hyperforge/eliza-game-builder`)
- Live Anthropic tool-use loop (`@hyperforge/agent-runner`)
- HTTP server (`@hyperforge/agent-server`) on port 5180
- Chat panel inside World Studio's AI tab (`AgentBuilderForm`)
- Pack flows through `agentPack` store into PIE
- Hyperscape plugin widgets register in PIE's session registry
- Round-trip proven with both hardcoded demo packs and real Claude
  output

**~209 tests across 8 packages.** The substrate is solid.

## The AAA gap (10 dimensions)

| # | Dimension | PoC state | AAA state |
|---|---|---|---|
| 1 | Authoring surface | UI only | UI + world content + mechanics |
| 2 | Persistence | In-memory; refresh kills it | Saved to game data file; ships on Publish |
| 3 | State awareness | Agent designs in isolation | Agent reads world state, references real entities |
| 4 | Iteration | One-shot only | Multi-turn refine + variant compare |
| 5 | Data binding | HUD shows placeholders | Live HP / position / inventory bound through PIE |
| 6 | UX | 30–60s blank wait | Streaming turn-by-turn updates |
| 7 | Code-write loop | Scaffolder produces files; nothing tests them | Closed loop — write → test → fix on failure |
| 8 | Orchestration | Single agent, single prompt | Designer + critic + validator |
| 9 | Asset generation | asset-forge has AI 3D gen; not wired in | `PROPOSE_ASSET` action; agents request models |
| 10 | CI coverage | Mocked LLM in unit tests only | Real-API smoke gated on secrets, recorded mock in PR |

Closing all 10 is the AAA bar. You can only ship one slice at a time,
so the priority order matters.

---

## Phase B — AAA quality, in priority order

> **Audit-driven correction (2026-04-29):** the original Phase B
> was structured around new authoring capabilities. After auditing
> the broader plan ecosystem (`PLAN_NEXT_SESSIONS`,
> `PLAN_SERVERNETWORK_MIGRATION`, `PLAN_ENGINE_GAME_SEPARATION`,
> `PLAN_WORLD_STUDIO_AAA_COMPLETION`) it's clear that AAA depends
> on closing existing in-flight migrations FIRST. Phase B0 (below)
> captures that work. B1+ are unchanged from the prior version of
> this plan but only meaningful once B0 lands.

### Phase B0 — REPLACED BY `PLAN_PROJECT_AS_DATA.md`

**Status:** Reopened 2026-04-29 after the original B0 was declared
closed too narrowly.

The original B0 (sub-slices B0.1–B0.4 — plugin loader in prod, real
InteractionRouter in PIE, live DataContext, smoke test) shipped on
this branch and is preserved as **B0' segments F and J** in the new
plan. But the broader unification — *project drives the runtime* —
was missing. PIE always loaded Hyperia regardless of which project
was open, so a blank project still got Hyperia's gameplay surface.

**Replacement plan:** `PLAN_PROJECT_AS_DATA.md`. The new B0' is 10
slices (A–J), ~6 focused weeks total. Hyperia ends up as a
template among many, and pressing Play renders whatever the active
project declares. Slices A–F + J reproduce the parity goal under the
new substrate; slices G–I (agent writes to project) collapse what
were originally B1's actions into the same architecture.

The cumulative effect after B0' is:

- New project = blank (terrain only)
- Hyperia template = explicit, reproducible
- PIE Play = whatever the project declares
- Agent actions write to a typed `Project.worldContent`
- Production `localhost:3333` = a deployed `Project`
- Parity smoke = state-equivalence between Hyperia project in PIE
  and `localhost:3333`

**B1 (below) collapses substantially under the new substrate** —
the actions still need to ship, but the editor-local stores they
were going to wire into don't exist; they write directly to the
active project.

---

### Phase B1 — Agent authors world content (was "next")

**Goal:** Expand the agent from "UI composer" to "world co-author."
The platform-defining offensive move. Once an agent can place NPCs
and define zones from chat, the platform is no longer just a
themeable UI builder.

**Why first:** every subsequent quality slice (persistence,
iteration, state-awareness) extends across whatever the agent
authors. Adding more authoring types now means those slices reach
further later. Adding them to UI-only first then redoing for world
content is wasted work.

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/actions/proposeNpcPlacement.ts` *(new)* | `PROPOSE_NPC_PLACEMENT` action. Accepts a `CompiledEntityNPC`-shaped object. Validates against the existing schema in `manifest-schema`. Returns validated entity on `data.entity` for the host to apply |
| `packages/eliza-game-builder/src/actions/proposeZoneDefinition.ts` *(new)* | `PROPOSE_ZONE_DEFINITION` — emits `CompiledRegion` (biome, difficulty, music, ambient) |
| `packages/eliza-game-builder/src/actions/proposeSpawnTable.ts` *(new)* | `PROPOSE_SPAWN_TABLE` — mob spawns per zone |
| `packages/eliza-game-builder/src/actions/proposeQuestGraph.ts` *(new)* | `PROPOSE_QUEST_GRAPH` — branching dialogue + objectives |
| `packages/asset-forge/src/components/WorldStudio/state/agentWorldContent.ts` *(new)* | Editor-local store for agent-emitted world content. Same pattern as `agentPack.ts` (module-level state + listeners + `useSyncExternalStore`). Holds NPC placements, zones, spawn tables, quests in separate keyed maps |
| `packages/asset-forge/src/components/WorldStudio/viewport/ViewportContainer.tsx` | When agent NPCs / zones are present in the store, merge them into the rendering pipeline alongside designer-placed content |
| `packages/asset-forge/src/components/WorldStudio/panels/AutomationPanel.tsx` | Form `onPackReceived` extends to accept world-content payloads in addition to UI packs |
| `packages/eliza-game-builder/src/__tests__/worldContentActions.test.ts` *(new)* | Unit tests per new action — schema validation, missing-field rejection, success path |

**Exit criteria:**
- Prompt *"Place a shopkeeper NPC named Eldric at the town center"*
  in the AI panel produces an NPC that appears in the PIE viewport
- Prompt *"Add a high-difficulty zone in the north with goblin
  spawns"* produces a zone + spawn table both visible in PIE
- Schema validation: every action's `data.*` payload validates
  against the existing `manifest-schema` Zod schemas — no agent
  output is accepted that the editor's own validator wouldn't accept

**Slice breakdown:**
- B1.1 — Audit + spec (1 day) — read every `CompiledEntity*` /
  `CompiledRegion` schema in `manifest-schema`, document the minimal
  required fields, identify integration points in `ViewportContainer`
- B1.2 — `PROPOSE_NPC_PLACEMENT` end-to-end (2–3 days) — single
  action, single rendering wire, demo working
- B1.3 — `PROPOSE_ZONE_DEFINITION` (1–2 days)
- B1.4 — `PROPOSE_SPAWN_TABLE` (1–2 days)
- B1.5 — `PROPOSE_QUEST_GRAPH` (2–3 days, larger because dialogue is
  graph-shaped)
- B1.6 — Live-LLM demo session + capture + commit-with-readme

**Leverage:** highest. Unblocks Tier 2 of the original PoC roadmap.
After B1, "AI builds a game" is a defensible claim, not a stretch.

---

### Phase B2 — Persistence into the game data file

**Goal:** The agent's output survives reload and ships on Publish.
Today the pack lives in editor memory and is lost on F5. Defensive
but foundational — every subsequent slice that produces an artifact
needs to land somewhere durable.

| File | Change |
|---|---|
| `packages/asset-forge/server/routes/manifests.ts` | Add `POST /api/manifests/agent-pack` and `POST /api/manifests/agent-world-content` endpoints. Accept the validated payload, write to the same on-disk manifest store the rest of WS uses |
| `packages/asset-forge/server/services/AgentArtifactStore.ts` *(new)* | Persistence service. One file per artifact type per project. Versioned. Append-only history so designers can revert to a prior agent output |
| `packages/asset-forge/src/components/WorldStudio/state/agentPack.ts` | `setAgentPack` extended to fire-and-forget POST to the new endpoint. Local state still drives PIE; server write happens in parallel |
| `packages/asset-forge/src/components/WorldStudio/state/agentWorldContent.ts` | Same as agentPack — server write on every change |
| `packages/asset-forge/src/components/WorldStudio/hooks/useManifestLoader.ts` | On project load, also fetch the persisted agent artifacts and prime the local stores |
| `packages/asset-forge/src/components/WorldStudio/utils/manifestCompiler.ts` | The compile step that produces the shippable game data file includes agent-emitted artifacts |

**Exit criteria:**
- Design HUD via chat → refresh page → HUD pack still in store, PIE
  renders it on next Play
- Place NPC via chat → refresh → NPC still in PIE viewport
- Open the project's compiled output (the data file shipped on
  Publish) — agent contributions are present and indistinguishable
  from designer-placed ones

**Leverage:** high. Without this, every demo is ephemeral and the
"chat → ship a game" claim is impossible to substantiate.

---

### Phase B5 — Live data binding in PIE

**Goal:** The HUD that renders over PIE shows real player state, not
mock placeholder values. Closes the gap between "agent designed an
HP bar" and "an HP bar that *means* anything."

(Numbered B5 because phase order is by leverage, not alphabetical.)

| File | Change |
|---|---|
| `packages/asset-forge/src/components/WorldStudio/hooks/usePIESession.ts` | Expose live player state from the in-memory `ServerNetwork` loopback as a `DataContext` provider. Player HP, position, inventory, etc., updated tick-by-tick |
| `packages/asset-forge/src/components/WorldStudio/viewport/PIEHudOverlay.tsx` | Pass the live `DataContext` into `ManifestRenderer` instead of the empty object |
| `packages/ui-framework/src/dataContext.ts` | Verify the existing schema supports the data the agent's widgets expect (HP, max HP, inventory slots, etc.). Extend if gaps exist |
| `packages/asset-forge/src/components/WorldStudio/__tests__/pieDataContext.test.tsx` *(new)* | Test agent's HP-bar widget shows live values when player takes damage in PIE |

**Exit criteria:**
- Agent designs a HUD with HP bar + chat
- Take damage in PIE → HP bar visibly decreases
- Send chat message → message appears in chat widget

**Leverage:** medium-high. UX-defining. Without it the demo looks
broken to anyone outside the team.

---

### Phase B3 — State-aware agent

**Goal:** Agent's output references real entities. *"Place a banker
NPC at the existing town center"* requires knowing where the town
center is. Closes the gap between "designer working in isolation"
and "designer who understands the project."

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/actions/getWorldState.ts` *(new)* | `GET_WORLD_STATE` action. Returns a token-budget-friendly summary of the compiled world (NPCs, zones, biomes, key landmarks) |
| `packages/eliza-game-builder/src/actions/listPlacedNpcs.ts` *(new)* | Lookup actions for specific entity types — agent can drill in when needed |
| `packages/agent-server/src/handler.ts` | System prompt extension: include a one-paragraph world summary if a world is loaded. Builds prompt context from the compiled world JSON |
| `packages/agent-server/src/worldStateBridge.ts` *(new)* | Bridge between asset-forge's compiled world and the agent server. Pulls current state at design time |

**Exit criteria:**
- Generate a world with a town named "Riverhold"
- Prompt *"Add a tavern in Riverhold"* — agent emits an NPC at the
  town's actual coordinates, not a hallucinated location
- Prompt *"What NPCs are in Riverhold?"* — agent returns the real
  list

**Leverage:** medium-high. Compounding with B1 — the more
authoring surface the agent has, the more this matters.

---

### Phase B4 — Iteration loop

**Goal:** Agent refines its own output across turns. *"Make the HP
bar red instead of green"* without re-doing the whole catalog walk.

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/actions/refineUIPack.ts` *(new)* | `REFINE_UI_PACK` action — accepts a critique string + the prior pack id, returns an updated pack |
| `packages/eliza-game-builder/src/actions/listAgentArtifacts.ts` *(new)* | Agent-side actions for self-introspection — list what's been emitted in this session |
| `packages/asset-forge/src/components/WorldStudio/panels/AgentBuilderForm.tsx` | Multi-turn UI: chat thread of prompts + agent responses, "refine" button, undo/redo of artifact applications |
| `packages/asset-forge/src/components/WorldStudio/state/agentSession.ts` *(new)* | Session log — every prompt + agent output. Persists alongside artifacts (B2 dependency) |

**Exit criteria:**
- Design HUD → ask *"make the HP bar red"* → updated pack swaps in
  without re-running the catalog discovery phase
- Compare two variants side-by-side
- Undo last agent action

**Leverage:** medium. Quality / UX. Important for designer
adoption; not gating other phases.

---

### Phase B6 — Streaming UX

**Goal:** The 30–60s blank wait while Claude designs is the worst
part of the current demo. Stream tool calls + final response
turn-by-turn so designers see the agent thinking.

| File | Change |
|---|---|
| `packages/agent-server/src/server.ts` | Add `POST /design/stream` route returning Server-Sent Events. Each tool call + intermediate text becomes one event |
| `packages/agent-runner/src/streamingLoop.ts` *(new)* | Streaming variant of `runAgentLoop`. `onTurn` becomes an async iterable yielding turn records |
| `packages/asset-forge/src/components/WorldStudio/panels/AgentBuilderForm.tsx` | Consume SSE; render each turn as it arrives — *"calling LIST_GAME_WIDGETS…"*, *"inspecting progress-bar…"*, etc. Cancellation mid-stream |

**Exit criteria:**
- Click Design HUD → see *"calling GET_CATALOG_STATS"* within 1
  second
- Each subsequent tool call appears as it happens
- Cancel button works mid-stream

**Leverage:** medium. Pure UX. Doesn't change capability but
dramatically changes how the demo feels.

---

### Phase B7 — Closed code-write loop

**Goal:** When the agent scaffolds a new widget, run its tests
automatically and feed failures back. Today the scaffolder produces
files but if the agent emits a bad spec, nothing catches it until a
human notices.

| File | Change |
|---|---|
| `packages/agent-server/src/codeTestRunner.ts` *(new)* | Spawns vitest on a single test file, captures output. Returns `{ passed, failures, output }` |
| `packages/eliza-game-builder/src/actions/runWidgetTests.ts` *(new)* | `RUN_WIDGET_TESTS` action — agent calls after `SCAFFOLD_WIDGET` to verify its output |
| `packages/eliza-game-builder/src/actions/scaffoldWidget.ts` | Updated system-prompt guidance: "after scaffolding, immediately call RUN_WIDGET_TESTS. If tests fail, read the output and call SCAFFOLD_WIDGET again with corrections" |

**Exit criteria:**
- Agent scaffolds a widget with a bug (deliberately injected)
- Agent runs the tests, sees the failure, regenerates with the fix
- All without human intervention

**Leverage:** medium. Foundation for B8 (multi-agent — critic agent
needs to run tests on the designer agent's output).

---

### Phase B8 — Multi-agent orchestration

**Goal:** Designer + critic + validator. Designer agent emits a
proposal; critic agent reviews it for issues; validator agent runs
schema + test gates. Each role specializes; together they produce
higher quality than a single one-shot agent.

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/orchestration/designerAgent.ts` *(new)* | Specialized prompt + action set for design |
| `packages/eliza-game-builder/src/orchestration/criticAgent.ts` *(new)* | Specialized for review — takes a designer's proposal + world context, emits issues + suggestions |
| `packages/eliza-game-builder/src/orchestration/validatorAgent.ts` *(new)* | Schema + test gates. Mostly mechanical; uses existing actions |
| `packages/eliza-game-builder/src/orchestration/conductor.ts` *(new)* | Coordinates the three agents per design task |

**Exit criteria:**
- Single user prompt produces designer→critic→validator chain
- Critic actually catches issues (provable via test cases where
  designer alone makes obvious mistakes)
- Validator never lets bad output through

**Leverage:** medium-low. Step-change in quality but expensive in
tokens. Only valuable once B7 (test gating) is solid.

---

### Phase B9 — Asset generation in agent loop

**Goal:** When the agent places an NPC and the catalog doesn't have
the right model, the agent calls asset-forge's existing AI 3D
generation pipeline as one of its actions. Closes the loop between
*"design something"* and *"that thing has a 3D model."*

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/actions/proposeAsset.ts` *(new)* | `PROPOSE_ASSET` action wrapping asset-forge's `/api/assets/generate` |
| `packages/eliza-game-builder/src/actions/listAvailableAssets.ts` *(new)* | Catalog of existing assets (so the agent uses existing models when applicable) |
| `packages/asset-forge/server/routes/assets.ts` | Expose the asset gen pipeline through the agent-server's CORS-enabled path |
| `packages/agent-server/src/handler.ts` | New action wired into the loop |

**Exit criteria:**
- Prompt *"Place a spear-wielding skeleton at the cave entrance"* —
  agent calls asset gen for the model, then `PROPOSE_NPC_PLACEMENT`
  with that model id
- Generated model appears in PIE on next Play

**Leverage:** medium. Glamorous demo feature but expensive (Meshy
calls) and B1 + B3 must land first to make it useful.

---

### Phase B10 — Live-LLM CI coverage

**Goal:** The agent integration is tested with a real LLM (or
recorded one) in CI, not just mocked. Today's tests use FakeLLM —
they validate the dispatcher, not the LLM's actual ability to use
our action surface.

| File | Change |
|---|---|
| `packages/agent-runner/src/recordReplayLLM.ts` *(new)* | Recorded LLM responses replayed deterministically. Lets PR CI run the loop without API cost |
| `packages/agent-runner/__tests__/replayedScenarios.test.ts` *(new)* | Recorded scenarios — minimal HUD, NPC placement, refine — replayed against the live action handlers |
| `.github/workflows/agent-smoke.yml` *(new)* | Daily/weekly job calling the real Anthropic API (gated on a secret) for a small smoke test. Fails the workflow if catalog discovery → propose → render breaks |
| `packages/agent-runner/src/__tests__/scenarioRecorder.ts` *(new)* | Helper that records a real session for replay |

**Exit criteria:**
- CI runs a recorded scenario end-to-end on every PR
- Daily real-API smoke catches regressions in the action surface
  before they hit users
- New scenarios can be recorded with one command

**Leverage:** low for product, high for sustainability. Without
this every refactor of the action surface or system prompt risks
silently breaking the live-LLM path.

---

## Sequencing principle

```
B1  ──┬→  B3  (state-awareness needs B1's content surface)
       └→  B9  (asset gen ties to B1's NPC placement)
B2  ──→  B4  (iteration needs persistence to survive across turns)
B5  (independent — PIE quality)
B6  (independent — UX)
B7  ──→  B8  (multi-agent needs test gating)
B10 (orthogonal — sustainability layer; ship anytime after B1)
```

**Recommended order (revised 2026-04-29 after B0 reopen):**

1. **B0' — Project-as-data substrate** *(blocking; supersedes old B0; see `PLAN_PROJECT_AS_DATA.md`)*
2. B1 — world content actions wire into `project.worldContent` (much smaller now; agent action surface mostly already exists)
3. B2 — persistence (free under B0'.A — Project IS the persisted shape)
4. B3 — state awareness (free under B0' — agent reads the active project)
5. B6 — streaming UX (demo polish)
6. B4 — iteration (variants/refine/undo; now valuable since project is durable)
7. B7 — closed code loop
8. B9 — asset gen
9. B8 — multi-agent orchestration
10. B10 — CI coverage (can slot in earlier opportunistically)

(Phase B5 from the prior version is now folded into B0.3 — live
`DataContext` bridge in PIE — since it's a parity concern, not a
new-capability concern.)

## Sizing

Rough working-week estimates per phase, assuming focused single-track work:

| Phase | Estimate | Notes |
|---|---|---|
| **B0'** | **~6 weeks** | **10 slices A–J. Replaces old B0. See `PLAN_PROJECT_AS_DATA.md` for slice-by-slice scope.** |
| B1 | 3–5 days | Agent actions reshaped to write to `project.worldContent`. `proposeNpcPlacement` already shipped this session; remaining 3 actions follow same pattern. |
| B2 | 0 (free) | Project IS the persisted shape; persistence comes with B0'.A. |
| B3 | 3–5 days | Agent reads the active project; prompt-plumbing only. |
| B4 | 1 week | Multi-turn UI + refine action |
| B6 | 3–5 days | SSE plumbing + UI |
| B7 | 3–5 days | Test runner + agent feedback path |
| B8 | 1–2 weeks | Orchestration is genuinely tricky |
| B9 | 1 week | Asset gen integration |
| B10 | 3–5 days | Mostly CI work |

**Total to AAA: ~10–14 focused weeks of single-track work**
(B0' adds ~6 weeks but B1–B3 collapse to ~1 week of follow-on work
because the substrate is now correct — net: similar total but
better architectural rest-state). Realistically with
context-switching, holds, and unknown unknowns: ~4–6 calendar
months.

After B0' + B1 + B3 ship (~7 focused weeks), the demo-quality jump
is real. Phases B4–B10 are quality polish that compound over time.

## What this plan does NOT cover

- **Production deployment.** The agent server is dev-local; serving
  it to real users needs auth, rate limiting, monitoring, multi-
  tenant isolation. Separate concern, separate plan.
- **Plugin marketplace.** The library-grows-as-AI-contributes
  flywheel needs a place for those contributions to live + a way to
  discover them. Big topic, separate plan.
- **Game launching / publishing.** Asset-forge has a "publish"
  pipeline but it's not yet wired to the agent's outputs in any
  detail. Needs design once B2 lands.
- **Sandboxing.** Anything an external user's agent emits eventually
  needs to be sandboxed before it runs in someone else's session.
  Real concern, much later.

## Success metric

When B1, B2, B3, B5 are shipped:

> A designer sits in front of the editor for 10 minutes, chats with
> the agent, and ends up with a small playable scene — at minimum a
> world with one NPC, one zone, one quest, and a HUD that shows
> live values — that survives Publish.

That's the AAA threshold. After that, B4 / B6 / B7 / B8 / B9 / B10
make the platform pleasant + sustainable, but the core claim is
defensible.
