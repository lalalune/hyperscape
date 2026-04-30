# Project-as-Data — The Unification Plan

**Status:** Draft — 2026-04-29
**Supersedes:** `PLAN_AAA_QUALITY.md` Phase B0 (which was framed too narrowly)
**Branch:** `feat/world-studio`

---

## North star

A **Project** is data. A project declares its terrain, its plugins,
and its content. World Studio's PIE boots a project. `localhost:3333`
is a published deploy of one specific project (Hyperia). AI agents
author into a project across all three layers. There is no
special-cased "Hyperia mode" anywhere in the engine — Hyperia is just
the project that happens to declare the `@hyperforge/hyperscape`
plugin and ships Hyperia's authored content.

```
Project = {
  id:            ProjectId,
  name:          string,
  config:        WorldCreationConfig,   ← AI-authorable; defines geography + climate
  plugins:       PluginId[],            ← AI-selectable; defines gameplay surface
  worldContent:  {                       ← AI-authorable; defines entities/quests/UI
    npcs?:       WorldAreaNPC[],
    zones?:      WorldArea[],
    spawns?:     WorldAreaMobSpawn[],
    quests?:     Quest[],
    uiPack?:     UIPackManifest,
  },
}
```

A **blank project** = `{ config: DEFAULT_CREATION_CONFIG, plugins: [], worldContent: {} }`.
Pressing Play on a blank project = engine boots, terrain renders, viewport is empty.
No avatar, no HUD, no mobs. The AI's first job is to fill it.

A **Hyperia project** = `{ config: HYPERIA_GAME_WORLD_CONFIG, plugins: ["@hyperforge/hyperscape"], worldContent: <Hyperia's authored data> }`.
Pressing Play = full Hyperia gameplay, identical to `localhost:3333`.

---

## Why the old B0 was wrong

The previous B0 ("Hyperia ↔ PIE parity") assumed PIE always loads
Hyperia and the work was wiring up the missing controller/HUD/avatar
glue. That framing produced the four sub-slices B0.1-B0.4 we shipped
this session. They were technically correct under that framing.

But the user's real complaint — *"a new world still loads the
Hyperia world"* — exposed the deeper mismatch. **Plugin
contributions are currently engine-scoped, not project-scoped.**
`packages/server/src/startup/world.ts:149` calls `bootServerPlugins(world)`
unconditionally; PIE does the same. Every project gets Hyperia.
"Different terrain per project" is the only thing the project shape
actually controls today; everything else (mobs, NPCs, stations, HUD)
is engine-global.

Closing the old B0 didn't close the actual goal. The actual goal is:
**Project drives the runtime.** Until that's true, B1 (agent authors
world content) writes into editor-local state that doesn't survive,
B2 (persistence) has nothing structured to persist into, and the
"AI builds a game" demo means "AI decorates Hyperia."

---

## The 10 slices

Each slice has: scope, files touched, exit criterion, size estimate.
Slices are in dependency order — earlier slices unblock later ones.
**Total: ~6 focused weeks** to reach the AAA threshold; everything
beyond that is content for the marketplace and matters less in the
short term.

### B0'.A — Project schema + DB migration (~3 days)

**Scope:** Define the `Project` type. Migrate the `world-projects`
table to store the three layers as separate columns instead of an
opaque `worldData` blob. Update create/load APIs. Backwards-compat
existing rows.

| File | Change |
|---|---|
| `packages/manifest-schema/src/project.ts` *(new)* | Zod schema for `Project`. Re-export `WorldCreationConfig` (procgen) + `PluginId` + `worldContent` slice schemas. |
| `packages/asset-forge/server/db/schema/world-projects.schema.ts` | Add `config: jsonb`, `plugins: text[]`, `worldContent: jsonb` columns. Keep `worldData` as deprecated. |
| `packages/asset-forge/server/db/migrations/000XX_project_layers.sql` *(new)* | Forward migration; backfill `config` from old `worldData.config`, `plugins: []` (will be populated in B0'.B), `worldContent: {}`. |
| `packages/asset-forge/server/services/WorldProjectService.ts` | Read/write the new shape. Old `worldData` reads continue to work via a fallback decoder. |
| `packages/asset-forge/src/components/WorldStudio/hooks/useProjectLoader.ts` | Load new shape. Drop the `_placeholder` → Hyperia generation branch (replaced by templates in B0'.B). |

**Exit:** A project loaded from disk surfaces typed `config`,
`plugins`, `worldContent` — not opaque `worldData`. Existing rows
continue to load (read-fallback). Tests in `WorldProjectService` and
`useProjectLoader` covering the new shape.

---

### B0'.B — Project templates (~2 days)

**Scope:** `NewWorldDialog` gets a template picker. "Blank" = empty
project. "Hyperia" = a saved snapshot. Existing auto-Hyperia
placeholder projects get migrated to the explicit Hyperia template.

| File | Change |
|---|---|
| `packages/asset-forge/server/services/ProjectTemplateService.ts` *(new)* | In-memory registry of templates. Each template is a `Project` value. Two seeds: `blank-template` and `hyperia-template`. |
| `packages/asset-forge/server/routes/world-project-templates.ts` *(new)* | `GET /api/world/project-templates` returns the registry list. |
| `packages/asset-forge/src/components/WorldStudio/NewWorldDialog.tsx` | Adds template picker. Default selection: blank. Picker shows template name + description + thumbnail. |
| `packages/asset-forge/src/components/WorldStudio/api/worldProjectApi.ts` | `createWorldProject` accepts `templateId` and the server clones the template. |
| `packages/asset-forge/server/middleware/auth.ts` | Already removed `ensureDefaultWorldProject`. Confirm. Existing rows with `worldData._placeholder = true` get migrated to `templateId: "hyperia-template"` on read. |

**Exit:** Sign in as fresh user → project list empty. Create new
project → picker shows two templates. Pick "Blank" → new project
with terrain only, no plugins, no content. Pick "Hyperia" →
new project with `plugins: ["@hyperforge/hyperscape"]` and
Hyperia's authored content.

---

### B0'.C — PIE accepts a Project (~5 days)

**Scope:** `PIEEditorSession` becomes the project player. Takes a
`Project`, applies its config (procgen → terrain), installs its
plugins, renders its content. No more hardcoded `options.plugins`
field. Empty plugin list = no Hyperia.

| File | Change |
|---|---|
| `packages/shared/src/runtime/pie/PIEEditorSession.ts` | New `start({ project, sceneRefs, ... })` signature. Replace `options.plugins.bootClientPlugins(...)` with `pluginLoader.installPluginsForProject(project)`. Pass `project.config` through to procgen entry. Mount `project.worldContent` after plugins install. |
| `packages/asset-forge/src/components/WorldStudio/hooks/usePIESession.ts` | Caller forwards the active project. Removes the always-on Hyperia plugin import. |
| `packages/shared/src/runtime/pie/projectPluginLoader.ts` *(new)* | Resolves a `PluginId[]` to plugin instances and runs their `onEnable` against the PIE world. Mirrors what `bootServerPlugins` does for production but project-scoped. |
| `packages/shared/src/runtime/pie/__tests__/projectScopedPlugins.test.ts` *(new)* | Test: empty plugin list → no Hyperia systems registered on `_serverWorld`. Test: `["@hyperforge/hyperscape"]` → Hyperia systems registered. Test: switching project mid-session unloads + re-installs. |

**Exit:** PIE Play of a blank project = engine boots, terrain
renders, no Hyperia systems registered (`world.getSystem("combat")`
returns null). PIE Play of a Hyperia project = full plugin
contributions installed.

---

### B0'.D — Plugin contribution registry (~5 days)

**Scope:** A discoverable list of available plugins, with each
plugin declaring its contributions in a typed manifest. The agent
queries this registry to know what plugins exist and what they
provide.

| File | Change |
|---|---|
| `packages/manifest-schema/src/plugin-contribution.ts` *(new)* | Schema for `PluginContributionManifest`: id, name, description, contributes: { systems, entityTypes, widgets, defaultWorldContent, defaultUILayout }. |
| `packages/hyperscape-plugin/plugin.json` | Already exists (single-line). Extend to include the contribution manifest fields. |
| `packages/plugin-shooter-demo/plugin.json` | Same — declare contributions for the demo plugin. |
| `packages/asset-forge/server/services/PluginRegistryService.ts` *(new)* | Discovers plugins by walking `node_modules/@hyperforge/*` for `plugin.json` files. Caches the registry. |
| `packages/asset-forge/server/routes/plugins.ts` *(new)* | `GET /api/plugins` returns the registry. |
| `packages/eliza-game-builder/src/actions/listPlugins.ts` *(new)* | `LIST_PLUGINS` action. Returns the registry to the agent. |
| `packages/eliza-game-builder/src/actions/getPlugin.ts` *(new)* | `GET_PLUGIN` action. Full contribution manifest for one plugin. |

**Exit:** `GET /api/plugins` returns Hyperia + shooter-demo. Agent
can call `LIST_PLUGINS` and reason about what's available. Plugin
manifests are loadable and validate against the schema.

---

### B0'.E — Hyperia content moves into plugin `onEnable` (~5 days)

**Scope:** Today `DataManager` (engine-global) loads
`world-areas.json`, `npcs.json`, etc., regardless of which plugins
are active. Move that loading into the Hyperia plugin's `onEnable`.
A project without the Hyperia plugin doesn't load Hyperia data.

| File | Change |
|---|---|
| `packages/hyperscape-plugin/src/index.ts` | `onEnable`: load Hyperia's manifest files (world-areas, npcs, items, biomes, etc.) and populate the relevant registries (`worldAreasRegistry`, `npcDefinitionsRegistry`, etc.). Today this happens in `DataManager.loadManifestsFromFilesystem`. |
| `packages/shared/src/data/DataManager.ts` | Remove plugin-specific manifest loading. Engine-level only loads engine-level manifests (e.g. damage-types, biomes — engine substrate). Hyperia's authored data moves out. |
| `packages/hyperscape-plugin/world/assets/manifests/` *(new)* | Hyperia's manifest files relocate from `packages/server/world/assets/manifests/` to the plugin package. Plugin's `onEnable` resolves them via `import.meta.url` or a known plugin-asset path. |
| `packages/hyperscape-plugin/src/__tests__/onEnableContent.test.ts` *(new)* | Test: plugin onEnable populates the registries. Without plugin install, registries empty. |

**Exit:** A blank PIE project shows: terrain, no NPCs, no mobs, no
stations, no resources. A Hyperia PIE project shows everything.
`localhost:3333` (which boots Hyperia) shows everything (regression
test).

---

### B0'.F — Avatar + controller + HUD layout move into plugin (~5 days)

**Scope:** Player spawn, click-to-walk binding, and the default HUD
layout become Hyperia plugin contributions surfaced through the PIE
render path. Replaces the current PIE stubs (façade player,
`PIEInteractionRouterShim`, `EMPTY_PIE_LAYOUT`).

| File | Change |
|---|---|
| `packages/hyperscape-plugin/src/contributions/playerSpawn.ts` *(new)* | Plugin contribution: when the plugin is installed and the world is in PIE Play mode, spawn a real `PlayerEntity` against the in-process `ServerNetwork`. Mirrors `handleCharacterSelect` at `character-selection.ts:1011` minus DB load. |
| `packages/hyperscape-plugin/src/contributions/clickToWalk.ts` *(new)* | Plugin contribution: register `ClickToWalkPlayerController` against the spawned `PlayerLocal`. Replaces `PIEInteractionRouterShim` for click-to-walk path. |
| `packages/hyperscape-plugin/src/contributions/defaultHud.ts` *(new)* | Plugin contribution: a `UILayoutManifest` describing Hyperia's default HUD (status bars, action bar, inventory, minimap, chat). This becomes the source for both production and PIE. |
| `packages/asset-forge/src/components/WorldStudio/viewport/PIEHudOverlay.tsx` | Replace `EMPTY_PIE_LAYOUT` switch with: read `project.worldContent.uiPack ?? plugin.contributes.defaultUILayout`. Threading the live `getDataContext()` from B0.3 (already shipped). |
| `packages/shared/src/runtime/pieShims/PIEInteractionRouterShim.ts` | DELETE. The real `InteractionRouter` (already wired in `B0.2d`) handles click-to-walk against the real `PlayerLocal`. |

**Exit:** PIE Play of Hyperia project: avatar visible, click-to-walk
works, real HUD with HP/inventory/minimap, mobs patrol. Bit-for-bit
matches `localhost:3333` (verified by the parity smoke in B0'.J).
PIE Play of blank project: still terrain only.

---

### B0'.G — Agent actions write to Project mutable (~3 days)

**Scope:** The actions shipped this session (`proposeNpcPlacement`)
and the editor-local stores (`agentPack`, `agentWorldContent`) get
unified: actions emit changes that get persisted into the active
project's `worldContent`. PIE re-renders from project state.

| File | Change |
|---|---|
| `packages/asset-forge/server/routes/world-projects.ts` | Add `POST /api/world/projects/:id/world-content` endpoint that accepts a `Partial<WorldContent>` patch and merges it into the project. Versioned writes for undo. |
| `packages/asset-forge/src/components/WorldStudio/state/agentWorldContent.ts` | Replace local store with: writes go to the API; reads come from the loaded project's `worldContent`. Subscribers re-render when project changes. |
| `packages/asset-forge/src/components/WorldStudio/state/agentPack.ts` | Same: writes go into `project.worldContent.uiPack` via the API. |
| `packages/eliza-game-builder/src/actions/proposeNpcPlacement.ts` | Update result shape: `data.entity` is the validated NPC; the host is responsible for calling the world-content API. Action remains pure (no side effects). |
| `packages/asset-forge/src/components/WorldStudio/panels/AutomationPanel.tsx` | `onPackReceived` and `onEntityReceived` route into the project API instead of the editor-local store. |

**Exit:** Place an NPC via chat → refresh page → NPC still in the
project. Hot-reload in PIE picks up the change. The "Place demo NPC"
debug button writes to the active project, not to memory.

---

### B0'.H — Agent terrain config action (~3 days)

**Scope:** Agent can reshape the terrain by emitting a
`WorldCreationConfig`. Procgen reruns; viewport updates; project
saves the new config.

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/actions/proposeTerrainConfig.ts` *(new)* | `PROPOSE_TERRAIN_CONFIG` action. Accepts a `WorldCreationConfig` (or partial diff). Validates against the procgen schema. Returns validated config on `data.config`. |
| `packages/asset-forge/src/components/WorldStudio/state/projectMutator.ts` *(new)* | Helper: merge a config patch, invalidate downstream layers per the existing `WorldLayer` graph, rerun procgen, write back to project. |
| `packages/asset-forge/src/components/WorldStudio/panels/AutomationPanel.tsx` | When the agent emits a terrain config, call the mutator. |
| `packages/eliza-game-builder/src/__tests__/terrainConfigAction.test.ts` *(new)* | Schema validation tests. |

**Exit:** Prompt *"Make this a desert region with cliffs"* → agent
proposes a config with arid biomes and high-noise terrain → editor
reruns procgen → viewport updates. Save survives reload.

---

### B0'.I — Agent plugin selector (~2 days)

**Scope:** Agent can declare which plugins the project uses.
Selecting `["@hyperforge/hyperscape"]` activates Hyperia gameplay.
Selecting `[]` keeps the project as a pure-procgen world.

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/actions/proposePluginSet.ts` *(new)* | `PROPOSE_PLUGIN_SET` action. Accepts `pluginIds: string[]`. Validates each against the plugin registry (B0'.D). Returns the validated set. |
| `packages/asset-forge/src/components/WorldStudio/state/projectMutator.ts` | Extends to handle plugin-set changes — restart PIE session with new plugins. |
| `packages/eliza-game-builder/src/__tests__/pluginSetAction.test.ts` *(new)* | Validation tests. |

**Exit:** Prompt *"Turn this into a shooter"* → agent calls
`PROPOSE_PLUGIN_SET ["@hyperforge/plugin-shooter-demo"]` → editor
restarts PIE with shooter plugin → game changes.

---

### B0'.J — Real parity smoke test (~3 days)

**Scope:** Replace the current "did PIE boot" smoke (which we
shipped in `5bcd6ea17` and called B0.4) with a real
state-equivalence smoke. Run the same scripted scenario against the
Hyperia project in PIE and against `localhost:3333`. Assert state
matches at every tick.

| File | Change |
|---|---|
| `packages/shared/src/runtime/pie/__tests__/pieParity.smoke.test.ts` | Replace existing smoke with state-comparison harness. |
| `packages/shared/src/runtime/pie/__tests__/parityScenario.ts` *(new)* | Scripted scenario: spawn at known position, walk to NPC, talk, walk to mob, attack, take damage, die, respawn. Each step records expected state. |
| `packages/shared/src/runtime/pie/__tests__/runScenarioInLocalhostHyperia.ts` *(new)* | Headless harness that runs the scenario against `localhost:3333` (over real WebSocket). |
| `.github/workflows/parity-smoke.yml` *(new)* | CI job runs both harnesses, diffs the recordings, fails on any mismatch. |

**Exit:** CI fails if PIE diverges from production by even one tick.
Catches regressions automatically. The platform claim
"Hyperia rebuilt regression-free from its own building blocks" is
mechanically defensible.

---

## Sequencing

```
B0'.A (schema)  ──┬→  B0'.B (templates)  ──┬→  B0'.C (PIE accepts project)
                   │                          │
                   │                          ↓
                   │                       B0'.D (plugin registry)
                   │                          │
                   │                          ↓
                   │                       B0'.E (Hyperia content moves to plugin)
                   │                          │
                   │                          ↓
                   │                       B0'.F (avatar + HUD as plugin contrib)
                   │                          │
                   │                          ↓
                   ↓                       B0'.J (parity smoke)
                B0'.G (agent → project)   ──┘
                   │
                   ↓
                B0'.H (terrain config action)
                   │
                   ↓
                B0'.I (plugin selector action)
```

A→B→C→D→E→F→J is the critical path for "Hyperia parity restored
under the new model" (~4 weeks).
G→H→I is the agent-authoring tier (~1.5 weeks) and slots in once
the project mutable exists (after C).

**Parallelizable:** D and E can run alongside C if you have two
focused tracks. F depends on E. G depends on A.

---

## What stays from prior work

The session's grass / gizmo / project-flow / dual-singleton fixes
keep applying under the new model:

| Prior fix | Status under B0' |
|---|---|
| Grass kept (`GrassVisualManager` + procedural disabled) | Stays. Engine-level decision; orthogonal to projects. |
| Gizmo gated on PIE Play mode | Stays. Editor mode-toggle remains valid; just now `pie.mode === "play"` means "render the project as if it were a deploy." |
| `ManifestRenderer` `zIndex: 9999` | Stays. Layering rule for any manifest-driven HUD. |
| Auto-Hyperia placeholder removed | Stays. Replaced by explicit Hyperia template (B0'.B). |
| `gatheringResources` / `worldAreasRegistry` / `npcDefinitionsRegistry` globalThis pins | Become moot once relative-path reach-ins from server/src to shared/src are cleaned up (separate cleanup track). Until then, the pins are correct. |
| `proposeNpcPlacement` action | Reshape under B0'.G to write to project mutable. The action's body and validation stay; only the callback path changes. |

Nothing shipped this session is wasted. All of it slots into the
new model with at most a one-line consumer change.

---

## Relationship to `PLAN_AAA_QUALITY.md`

This plan replaces the original B0. The rest of `PLAN_AAA_QUALITY.md`
B1–B10 still applies but reframed:

| Old framing | New framing |
|---|---|
| **B0** = Hyperia-PIE parity glue | Same, but rooted in project-as-data (this plan). |
| **B1** = agent authors world content (NPC/zone/spawn/quest actions) | Same actions, now write to `project.worldContent`. B0'.G is the wiring. |
| **B2** = persistence | Mostly free under B0'.A (Project IS the persisted shape). |
| **B3** = state-aware agent | Agent reads from the active project. Trivial under B0'.A. |
| **B5** = live data binding in PIE | Already shipped (`B0.3`); same wiring continues to apply. |
| **B4 / B6 / B7 / B8 / B9 / B10** | Unchanged. |

After B0' lands, **B1–B3 collapse to roughly 2 weeks of follow-on
work** instead of the originally-estimated 4–5 weeks, because the
substrate they build on is now correct.

---

## Phase B1' — Conversational Onboarding (the hero UX)

**Status:** Drafted 2026-04-29. Substrate (B0'.A–B0'.J) is done; this
slice is the user-facing flagship that captures the platform's
identity in the new-project flow.

### Why this slice exists

The platform's pitch is *"AI builds games."* Today's New-Project
dialog is a template picker (Blank / Hyperia) — same thing every
game engine has. The flagship experience — *chat with an AI, end
up with a world* — is buried inside the post-creation AI panel.
B1' lifts it to the front.

### Three paths, one is the hero

```
┌── New Project ─────────────────────────────────────┐
│  ◆ Design with AI  ◀── HERO                        │
│    "What kind of world do you want to build?"      │
│                                                    │
│  · Start blank  (escape hatch / power user)        │
│  · Start from template  ▸ Hyperia (study/fork)     │
└────────────────────────────────────────────────────┘
```

Picking **Design with AI** opens a conversational dialog inline
(not a side panel — full focus). The agent asks 2–4 clarifying
questions about the world, proposes a plan, and on confirmation
fires the relevant `PROPOSE_*` actions in sequence. The project is
created with terrain + plugins + initial content already populated.

Picking **Blank** or **Template** keeps today's flow.

### The conversation

```
Agent: "What kind of world or game do you want to build?"
User:  "A snowy mountain RPG with magic"

Agent: "A few questions to get this right:
        1. Open world or instanced areas?
        2. Combat-heavy or exploration-focused?
        3. Solo or multiplayer in mind?"
User:  "Open world, light combat, solo"

Agent: "Got it. Here's my plan:
        • Snowy + mountain terrain
        • Hyperia plugin (combat, skills, NPCs)
        • A starter village with shopkeeper + quest giver
        • Light HUD: HP, minimap, action bar
        Generate?"
User:  "Yes"

  [agent fires:]
    PROPOSE_TERRAIN_CONFIG { biomes: snow+mountain, ... }
    PROPOSE_PLUGIN_SET ["@hyperforge/hyperscape"]
    PROPOSE_NPC_PLACEMENT (shopkeeper)
    PROPOSE_NPC_PLACEMENT (quest giver)
    PROPOSE_UI_PACK (HP + minimap + action bar)

  [host:]
    creates project, applies all four layers
    opens project in editor with state already populated

Agent: "Here's your world. Want me to add quests, more areas, or
        tune the look?"
```

Every action that fires already exists (B0'.G + B0'.H + B0'.I +
B1.2). The missing piece is the **onboarding conversation
surface** — a UI that gates project creation on a multi-turn
dialog.

### Slices

#### B1'.1 — New-Project picker redesign (~½ day)

**Scope:** Replace the radio-list template picker in
`NewWorldDialog.tsx` with a 3-card layout. "Design with AI" is the
largest, most prominent card. "Blank" and "Template" are smaller
secondary cards.

| File | Change |
|---|---|
| `packages/asset-forge/src/components/WorldStudio/NewWorldDialog.tsx` | Rewrite the dialog body. 3-card layout, AI card hero-sized. Selecting AI opens `DesignWithAIDialog` (B1'.2). Selecting Blank/Template uses today's path. |

**Exit:** Visual UX matches the vision; AI path routes to the
new dialog (which can stub for B1'.2's first cut).

#### B1'.2 — DesignWithAIDialog component (~2–3 days)

**Scope:** Full-screen overlay dialog with conversational chat.
Wraps the existing `AgentBuilderForm` chat behavior but with an
opinionated system prompt that drives the multi-turn questioning
flow. After the agent emits its `PROPOSE_*` actions, the host
creates the project with all layers populated and opens it.

| File | Change |
|---|---|
| `packages/asset-forge/src/components/WorldStudio/DesignWithAIDialog.tsx` *(new)* | Full-screen overlay. Chat history + input. Submit triggers agent loop with onboarding system prompt. After actions fire, calls `createWorldProject({ templateId: 'blank', plugins: ..., worldContent: ... })` then opens the project. |
| `packages/eliza-game-builder/src/onboarding/systemPrompt.ts` *(new)* | Opinionated prompt that drives the question-then-propose flow. Tells the agent: "Ask 2–4 questions about world type, then summarize a plan, then on user confirmation fire PROPOSE_TERRAIN_CONFIG + PROPOSE_PLUGIN_SET + initial content actions in sequence." |
| `packages/agent-server/src/handler.ts` | New `/onboarding/design` endpoint that uses the onboarding system prompt. Returns SSE stream of agent turns. |

**Exit:** User picks "Design with AI" → conversational flow works
end-to-end → project opens with agent-shaped state.

#### B1'.3 — Persistent companion mode (~1–2 days)

**Scope:** After the project opens, the AI panel stays expanded
(not hidden behind a tab). Agent volunteers next-step suggestions
based on what's been built so far.

| File | Change |
|---|---|
| `packages/asset-forge/src/components/WorldStudio/panels/AutomationPanel.tsx` | Open-by-default state when project opened via Design-with-AI flow. |
| `packages/eliza-game-builder/src/onboarding/companionPrompt.ts` *(new)* | Different prompt: "User just finished onboarding. Volunteer 2–3 follow-up suggestions based on `worldContent` state." |

**Exit:** Designer never has to "find" the AI panel — it's the
center of the post-onboarding experience.

### Dependencies

- **B0'.G** ✅ (agent → project mutable) — required so the agent's
  PROPOSE_* actions actually persist
- **B0'.H** ✅ (`PROPOSE_TERRAIN_CONFIG`) — required for terrain
  shaping
- **B0'.I** ✅ (`PROPOSE_PLUGIN_SET`) — required for plugin
  selection
- **B1.2** ✅ (`PROPOSE_NPC_PLACEMENT`) — required for content
  authoring
- Agent server with multi-action emission — needs a small extension
  to handle multiple sequential `PROPOSE_*` calls in one user turn

### What this delivers

After B1' ships, the platform's 3-minute demo becomes:

> *"Sign in → click New Project → click Design with AI → chat for
> 2 minutes → see your game."*

That's the platform's identity captured in a single observable
flow.

### Sizing

- B1'.1 (picker redesign): ~½ day
- B1'.2 (conversational dialog): ~2–3 days
- B1'.3 (persistent companion): ~1–2 days

**Total: ~4–6 focused days.**

### B1'.4 — Choice chips + idle suggestions (~3–4 days)

Pure conversational chat is too friction-heavy for users who don't
know what to ask for, and gives the AI too much room to hallucinate
options that don't exist. The fix: agent's responses can include
**clickable choice chips** that map to pre-filled prompts, so users
can either type freely OR pick from suggested options. Both
modalities productive.

| File | Change |
|---|---|
| `packages/eliza-game-builder/src/actions/offerChoices.ts` *(new)* | `OFFER_CHOICES` action. Accepts `{ question?: string, choices: Array<{label, prompt}> }`. Returns the choices on `data.choices` for the host to render as chips. Click → chip's `prompt` becomes the next user message. |
| `packages/agent-server/src/handler.ts` | Aggregate the most recent `OFFER_CHOICES` emission into the response. Add `choices` field to `DesignSuccessResponse`. Onboarding system prompt updated to "use OFFER_CHOICES when 3–6 options would be faster than free text." |
| `packages/asset-forge/src/components/WorldStudio/DesignWithAIDialog.tsx` | Render choice chips below agent messages. Click → fire as user message. Add idle-state "suggested prompts" (static list of 3–4 starter prompts shown when no user messages yet). |

**Exit:** Agent's questions surface as `[chip] [chip] [chip]`
buttons under text. Empty conversation shows a curated set of
starter prompts. Both clicks and free text drive the loop forward.

### B1'.5 — Live plan preview panel (~3 days)

Side panel next to the chat shows the project plan as it builds.
Removes the "final cliff" of clicking Build without knowing what's
been accumulated.

| File | Change |
|---|---|
| `packages/asset-forge/src/components/WorldStudio/DesignWithAIDialog.tsx` | Three-column collapsible layout: chat (left), plan preview (center), building blocks (right — B1'.6). Plan preview lists each slot with a check or dot indicating set/unset. |
| Plan store | Reactive state holding the in-flight plan. Updates as agent emits. |

**Exit:** User sees what they have so far without clicking Build.
Each slot is independently editable/removable.

### B1'.6 — Building blocks browser (~4 days)

Right panel surfaces the project's available registries — plugins
(from B0'.D), widgets (from widget-catalog), NPC archetypes
(seeded). Each item has `⊕ Add` to put it into the plan directly.

**Exit:** Power-user can build a project entirely by browsing the
right panel, no chat. Mid-skill user mixes chat + browse fluidly.

### B1'.7 — Suggested prompts + polish (~2 days)

Quick wins on the idle state, error UX, undo/redo of choices.

**Exit:** First-time experience is welcoming. Mistakes are
recoverable.

### B1' total (revised after UX redesign)

**~3 weeks** for the full hybrid UX (B1'.1 → B1'.7). After it
ships, the platform's hero claim — *"chat with AI for 2 minutes,
see your game"* — is real, AND the user retains control through
visible building blocks at every step.

---

## Total to MVP demo

> *"Designer sits in front of the editor for 10 minutes, chats with
> an AI agent, ends up with a small playable scene that survives
> Publish."*

- **B0'.A through B0'.J + B1 + B2 + B3 = ~7 focused weeks**

After that, B4–B10 are quality polish that compounds over time.

## Total to v1.0 platform

- B0' + B1–B10 + the existing parallel tracks (D6.c long-tail,
  cluster migrations, `PLAN_ENGINE_GAME_SEPARATION` 4–8) = **9–12
  calendar months** at typical pace.

## Open questions

1. **Plugin registry source of truth.** Walk `node_modules/` at
   boot, or maintain a curated list? Walk is more flexible; curated
   is more secure for the eventual marketplace. Decision needed
   before B0'.D.

2. **Project schema versioning.** Once `Project` is on disk,
   migrations matter. Need a `schemaVersion` field and a migration
   service. Defer to B0'.A's migration design.

3. **Multi-project session.** Can a designer have two projects
   open simultaneously? Today PIE is single-project. Probably yes
   for v1.0 but not in scope for B0'.

4. **Production deploy = Hyperia today.** When/if HyperForge hosts
   multiple games, "production" stops being singular. Out of scope
   here; relevant for the marketplace plan.
