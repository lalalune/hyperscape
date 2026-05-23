# PLAN_AAA_UE5_PARITY — UE5-Quality PIE + Standalone + True AI Studio Engine

**Status:** Drafted 2026-05-23 from 6 parallel deep audits + the existing PLAN_AAA_MASTER_AUDIT.md tip.
**Owner:** TBD
**Scope:** End-to-end path from current half-built PIE → UE5-parity Play-In-Editor, Launch-In-Standalone, and a true AI-driven engine where users / AI build *any* game from building blocks (not just tweaked Hyperia).

---

## 0. North Star

> "A user opens World Studio. AI Companion proposes a game (any genre). User clicks **PIE** — controllable character in editor viewport in 2 seconds, full HUD, real combat. User clicks **Launch** — separate game window opens in 10 seconds running the same game end-to-end. Both modes prove the project plays. Both modes treat Hyperia as one of many forkable starters, not the default."

The two play modes mirror UE5:
- **PIE (Play-In-Editor)** = in-process editor-coupled rapid iteration loop
- **Standalone Launch** = separate child process running the unmodified game runtime, decoupled truth-test for the shipped game

And the engine underneath proves it works for *any* game by hosting at least 3 independent gameplay plugins (Hyperia, Arctic Survival, Shooter Demo) and N independent themed content packs, with the AI agent fluent in the vocabulary needed to compose them.

---

## 1. Honest state — what the audits found

### 1.1 PIE (Audit 1)

✅ **Foundation in place:** PIEEditorSession boots real ServerNetwork + ClientNetwork via in-memory loopback. Real PlayerLocal entity now spawns server-side and replicates client-side via the loopback (`003d3d666`, `b2b76bea5`).

❌ **Controls broken because of a synthetic-pawn shim layer.** PIE attaches `PlayerController` + `CameraController` to a `createPIEPawn` Object3D wrapper, not the real `PlayerLocal` entity. WASD is bound but `ClickToWalkPlayerController.tick()` is an empty no-op. Click-to-walk routes through `PIEInteractionRouterShim` which mutates the synthetic pawn directly, bypassing the real `InteractionRouter`. The real player has PhysX but the camera follows the cosmetic capsule.

**The fix has a clear file-level shape:**
- `PIEEditorSession.ts` lines 1080-1095 — replace `createPIEPawn` with `clientWorld.getPlayer()` (real entity)
- Same file lines 1093-1117 — delete `PIEOrbitCameraShim` bus wiring; use real `OrbitCameraController`
- Same file lines 1130-1177 — delete `PIEInteractionRouterShim` fallback; rely on the already-instantiated real `InteractionRouter`
- `InteractionRouter._doSendMove` — verify `MOVE_REQUEST` packet handler exists on server side of loopback
- `pieShims.ts` — delete (`createPIEPawn` + shims no longer needed)

### 1.2 Building-blocks (Audit 2) — *better than I assumed: ~75%*

| Subsystem | State |
|-----------|-------|
| R2.P10 contribution wiring × 6 fields | 5 of 6 done (`commands`, `systems`, `entities`, `manifestSchemas`, `paletteCategories`, `toolbarTools`). `widgets` is registered via runtime `registerHyperiaWidgets()` not the manifest field — deferred refactor, not blocking. |
| Engine decoupling | DONE. `HyperiaError`/`HyperiaObject3D` aliased. `BiomeType` enum replaced with `BiomeId` string registry. No `hyperiaPlayerId` residue. No hardcoded tree/mob/item IDs in shared. |
| Asset pack fork chain | DONE. Dialog walks union of `assetPackDeps` across declared content packs and auto-installs. |
| `hyperscape` theme-awareness | DONE. Towns, POIs, mob/item spawners all gated on `projectContentPackIds.includes(HYPERIA_CONTENT_PACK_ID)`. |
| N-channel terrain shader | 95% — `GrassWorker` on N-channel, `TerrainShader` accepts both. `QuadChunkWorker.ts` lines 85-86, 209-235 dual-writes 3-channel as legacy fallback. |
| Multi-plugin demos | 3 real plugin packages exist: `hyperscape`, `plugin-arctic-survival`, `plugin-shooter-demo`. |
| AAA acceptance tests (Phase 5) | 3/4 done. Missing: arctic + shooter composition test. |

### 1.3 Project manifest pipeline (Audit 3) — *the biggest hidden gap*

The asset-forge → game-server handoff is **structurally incomplete**:

- `exportToGameManifest()` outputs `buildingsManifest + worldConfig + npcManifest + mobManifest`
- The game server REQUIRES additionally: `world-areas.json`, `biomes.json`, `stores.json`, `items.json` (or split), `gathering/{woodcutting,mining,fishing}.json`, `quests.json`, `dialogue.json`
- **No `--projectManifest <path>` CLI flag exists on the server** — manifests are loaded from static disk at `packages/server/world/assets/manifests/`
- **No `--assetPacks [...]` flag** — server has no way to load asset pack manifest contributions
- **No `TERRAIN_SEED` injection** from project config
- `manifestSnapshot` (38-manifest snapshot) and `worldContent` (authored delta) are different things, not a duplicate

This is the blocker for both Standalone Launch AND PIE-honest content. Currently both modes can only play Hyperia defaults; the user's authored project content is invisible to the runtime.

### 1.4 AI vocabulary (Audit 4) — *richer than I thought, but missing the load-bearing pieces*

✅ **19 PROPOSE_* actions** in the registry covering placement + configuration (NPCs, mobs, quests-as-name, assets, zones, resources, stations, teleports, roads, POIs, danger zones, water, music/ambient zones, SFX, mines, wilderness boundary, terrain config, plugin set).

✅ **Discovery / inspection API exists:** `LIST_PLUGINS`, `GET_PLUGIN`, `LIST_GAME_WIDGETS`, `LIST_ENTITY_TYPES`, `LIST_ASSET_PACKS`, `GET_PROJECT_STATE`, `GET_CATALOG_STATS`. The agent can see what's installed.

❌ **What's missing — the gap between "level geometry" and "playable game":**

| Rank | Gap | Why it blocks |
|------|-----|----------------|
| 1 | Game rules / win conditions / progression | `PROPOSE_QUEST` exists but payload is name only — no objectives, conditions, rewards. No `PROPOSE_GAME_RULE`, no `PROPOSE_WIN_CONDITION`. Agent can build a maze but cannot define "first to exit wins." |
| 1 | Behavior / scripting vocabulary | `behaviorGraph` field exists on entities but agent has zero emit schema. Can't articulate "if player within 10m, attack" or "if player has item X, show dialogue Y." |
| 2 | Materials / shaders / VFX | No `PROPOSE_MATERIAL`, `PROPOSE_VFX`, `PROPOSE_LIGHTING`. Worlds default to placeholder colors. |
| 3 | Hot-install / live iteration | `PROPOSE_PLUGIN_SET` + `PROPOSE_ASSET_PACK_INSTALL` declare-only; require project re-create to take effect. No mid-conversation iteration. |
| 4 | Conditional / parametric placement | Can place fixed instances; can't say "place 5 campfires in Forest zones." |

**Verdict:** today's agent builds *decorated worlds*, not games.

### 1.5 Multi-plugin support (Audit 5) — *6.5/10*

✅ **Real plugins exist:** `hyperscape`, `plugin-arctic-survival`, `plugin-shooter-demo`, `plugin-hello-reference` (template), `plugin-scaffolder` (tooling).
✅ **2 builtin project packs:** Hyperia, Arctic Survival.
✅ **Coexistence proven** in `plugin-arctic-survival/src/__tests__/plugin.test.ts` ("coexistence with shooter-demo").
✅ **First-seen-wins conflict resolution** in `gameplay-framework/src/snapshot.ts:aggregateContributions()`.

❌ **Content packs declared but not packaged:** `@hyperforge/content-pack-arctic-v1` is referenced in `project-packs.ts` but no separate package exists — its content lives inside `plugin-arctic-survival`.
❌ **Asset packs declared but not implemented:** `@hyperforge/asset-pack-hyperia-trees-v1` — no package.
❌ **Browser visible-payoff verification missing:** no smoke test confirms a forked Arctic Survival project, opened in the dev client, plays differently from Hyperia.
⚠️ **Duplicate-id conflicts logged but not enforced:** two plugins declaring the same widget id → first-seen wins silently.

### 1.6 Server boot + HUD (Audit 6)

**Server:**
- Boot is hardcoded plugin list (`STATIC_PLUGIN_MAP` in `packages/server/src/startup/plugins.ts`), not config-driven.
- Database required (Postgres via Drizzle, optional Docker-managed). No SQLite fallback.
- uWS (UWS_PORT=5556) is canonical transport; Fastify `/ws` is fallback.
- Plugin `onEnable()` runs after world systems registered, before `world.init()`.

**HUD:**
- 17 widgets in builtin registry + 50+ plugin widgets = ~70 total
- `HYPERSCAPE_DEFAULT_HUD_LAYOUT` mounts **only 3** (hp-bar, action-bar, tooltip)
- **Real client has a separate `DEFAULT_UI_LAYOUT`** (`packages/client/src/ui-framework/defaultLayout.ts`) that mounts the 14+ panels (inventory, chat, skills, equipment, prayer, etc.). PIE does **not** mount this.
- Non-Hyperia plugins each contribute one widget (Arctic: TemperatureGauge, Shooter: Crosshair).
- Widget data context (`buildPlayerDataContext`) binds `$player.hp` / `$inventory.items` / `$equipment.slot` / `$skills.level` via `DataSourceRegistry`. Plugins extend by registering sources.

---

## 2. Architecture — the two-mode model

### 2.1 Shared primitives (the foundation)

- **`ProjectManifestExporter`** (`packages/asset-forge/server/services/`) — single source of truth that converts a project row (`config + worldContent + plugins + assetPacks + manifestSnapshot`) into the **complete JSON shape** the game runtime can boot from, including: buildings, world-areas, biomes, NPCs, mobs, items, gathering, quests, dialogue, stores, terrain-seed.
- **`ProjectBoot`** (`packages/server/src/startup/projectManifest.ts`) — server-side hook accepting a project manifest path and merging into world boot. Plugin list, content packs, and asset packs are all driven from the manifest. **No "Hyperia default" fallback** — if no manifest is passed, server boots an empty-shell world (terrain only).
- **`PlayMode` enum** — `pie | simulate | standalone` (UE5 parity).
- **AI vocabulary registry** — keep extending `proposeActionRegistry.ts` with new action kinds; the agent always reads its capability surface from this single registry.

### 2.2 PIE mode (in-process)

- Editor + game in one Node process.
- Server + client worlds bridged by `InMemorySocketPair`.
- Editor's viewport renderer/scene/camera mounted onto `_clientWorld.graphics/stage.scene/camera`.
- Controllers attached to **the real PlayerLocal entity** (post controller migration).
- Lifecycle: `PIEEditorSession.start() / stop() / pause() / resume() / eject()`.

### 2.3 Standalone mode (separate process)

- Editor `spawn()`s `packages/server/dist/index.js --projectManifest <path>`.
- Game client at `localhost:3333` connects to game server at `localhost:5555/5556`.
- Editor manages spawn + window open + cleanup; **no runtime communication** beyond launch.
- Lifecycle: `StandaloneLauncher.start() / stop() / status()` (asset-forge server-side service).

### 2.4 Decoupling rules (UE5-aligned, non-negotiable)

1. **Disk handoff only.** Editor writes project manifest to disk; runtime reads it. No live state push.
2. **Game runtime is editor-unaware.** No `if (isEditorLaunched)` branches in `packages/server` or `packages/client`. The `--projectManifest` flag is just config.
3. **Save-before-play gate.** Both modes refuse to launch if project has unsaved changes.
4. **PIE ≠ Standalone transport.** PIE uses `InMemorySocketPair`; Standalone uses real WS. Different transports, same packet protocol, same game runtime.
5. **Plugins drive everything.** No hardcoded Hyperia paths in core. Server's `STATIC_PLUGIN_MAP` becomes a project-manifest-driven registry.

---

## 3. Phased plan

Each phase has hard deliverables, exit criteria, and effort estimates. **Effort is best-case** — double for shipped dates.

### Phase 0 — Foundations (1-2 weeks)

**Goal:** Project manifest becomes the truth-source for both modes. Server boots from a manifest instead of disk defaults.

#### 0.1 Project Manifest Exporter (3-5 days)
- `packages/asset-forge/server/services/ProjectManifestExporter.ts` consolidates:
  - `config` → terrain config (seed, biomes, towns, roads, vegetation)
  - `worldContent` → npcs, zones, spawns, quests
  - `plugins` → plugin id list
  - `assetPacks` → asset pack id list + resolved manifests
  - `manifestSnapshot` → registry overrides (items, dialogue, stores, gathering, etc.)
- Output single JSON shape: `FullProjectManifest`
- Extend `exportToGameManifest()` (currently outputs only buildings + npcs + mobs) to include quests, dialogue, stores, custom items, terrain seed.
- Round-trip tests pin the shape

#### 0.2 Server Boot Hook (2-3 days)
- `packages/server/src/startup/projectManifest.ts` — new CLI flag `--projectManifest <path>`:
  - When present: validate JSON, populate registries from the manifest
  - When absent: empty-shell mode (terrain only, no plugins beyond core)
- Refactor `STATIC_PLUGIN_MAP` to project-manifest-driven plugin loader (still has the existing plugins available, just selects by manifest)
- Refactor `loadHyperiaManifestsSync()` to `loadProjectManifests(manifest)` — no Hyperia-as-default

#### 0.3 Dev workflow preservation (1 day)
- `bun run dev` continues to work — wires a "default Hyperia project pack" manifest to the local server so existing dev flow is unbroken
- Document the new CLI flag in CLAUDE.md / docs

**Exit:** `bun packages/server/dist/index.js --projectManifest /tmp/test.json` boots with arbitrary project data. Server logs `[Boot] Loaded project X with N plugins, M content packs, K NPCs, L mob spawns`. Same boot path serves PIE plugin context and Standalone CLI.

---

### Phase 1 — PIE controller migration (2-3 weeks, highest-risk)

**Goal:** PIE controls feel identical to localhost:3333.

#### 1.1 Controller target migration (1-1.5 weeks) — *the big one*
- `PlayerController` resolves target via `clientWorld.getPlayer()` instead of synthetic pawn
- `CameraController` follows the real entity's transform
- Real `InteractionRouter.start()` runs against `_clientWorld` (already does in B0.2d); verify its `network.send(MOVE_REQUEST)` reaches the loopback server with a registered handler
- `PlayerLocal.initControl()` extended to honor keyboard InputContext (currently mobile-joystick only)
- **Delete:** `pieShims.ts` (`createPIEPawn`, `PIEOrbitCameraShim`, `PIEInteractionRouterShim`) — all redundant once controllers drive real entity

**Exit criteria:**
- WASD moves the PhysX-driven PlayerLocal
- Mouse-look rotates camera around it
- Click-to-walk routes through real `InteractionRouter` → server `MOVE_REQUEST` → `PlayerLocal.moveTo()`
- No visible delta from localhost:3333

**Risk:** This is engine-critical. Sub-divide into per-controller commits; smoke-test each before moving on.

#### 1.2 Full HUD layout (3-5 days)
- Adopt the real client's `DEFAULT_UI_LAYOUT` (14+ panels: inventory, chat, skills, equipment, prayer, etc.) in PIE
- `usePIESession` mounts both the manifest HUD (`HYPERSCAPE_DEFAULT_HUD_LAYOUT`) and the panel layout
- Gate by content pack: only Hyperia projects get Hyperia panels; non-Hyperia projects get their pack's contribution

#### 1.3 PIE controls — Stop / Pause / Eject (2-3 days)
- **Stop** — clean teardown (already exists; wire UI)
- **Pause** — `world.tick()` doesn't advance; input captured for inspection
- **Eject** — UE5's free-fly mode: PIE keeps running, viewport switches to editor camera. UI shows "PIE running (ejected)"

**Exit:** PIE feels indistinguishable from localhost:3333 for single-player play.

---

### Phase 2 — Standalone Launch (1-1.5 weeks, parallel with Phase 1)

**Goal:** Click Launch, get a real Hyperia window in <10s, fully isolated child process.

#### 2.1 Server CLI flags (1-2 days)
- `--projectManifest <path>` (from Phase 0.2 — already done; re-use)
- `--ephemeral` (uses fresh DB schema or in-memory mode)
- `--port` / `--uwsPort` (overrides defaults)
- `--noClient` (headless mode for future automated playtest)

#### 2.2 StandaloneLauncher service (3-5 days)
- `packages/asset-forge/server/services/StandaloneLauncher.ts`:
  - `start(projectId)` → export manifest via Phase 0.1, write to disk, spawn `bun run packages/server/dist/index.js --projectManifest ... --ephemeral`, capture PID, poll `/api/health` until ready (30s timeout)
  - `stop()` → SIGTERM → wait → SIGKILL fallback
  - `status()` → `{ state: idle | starting | ready | error, pid?, port?, error?, logs? }`
- Routes: `POST /api/projects/:id/launch-standalone`, `GET .../standalone-status`, `POST .../stop-standalone`
- Cleanup on asset-forge process exit (PID file, SIGCHLD handler)

#### 2.3 WorldStudio Launch UI (2-3 days)
- **Launch** button in top bar next to Save — 3 states: idle / "Booting…" (spinner + status text from polling) / "Standalone running" (green dot + Stop)
- On click: `POST /launch-standalone` → poll every 500ms → when `ready`, `window.open("http://localhost:3333", "_blank")`
- Save-before-Launch toast prompt if `project.isDirty`
- Server logs streamed into collapsible drawer

**Exit:** Launch button → new window with project's terrain / NPCs / mobs visible in <10s. 10-iteration smoke test passes. Both Hyperia and Arctic Survival project packs launch.

---

### Phase 3 — Building-blocks residual cleanup (1 week, parallel with Phase 2)

**Goal:** Close the remaining 25% of the building-blocks audit.

#### 3.1 Widget contribution field consumption (2-3 days)
- Replace `registerHyperiaWidgets(ctx.widgets)` runtime call with manifest-driven registration via `manifest.contributions.widgets` field
- Same pattern other 5 R2.P10 fields already use

#### 3.2 N-channel shader cutover finalization (1 day)
- `QuadChunkWorker.ts` lines 85-86, 209-235: drop 3-channel legacy dual-write. N-channel becomes the only path.
- Remove the 73 legacy `biomeForestWeight`/`biomeCanyonWeight` references (already inventoried in `PLAN_AAA_MASTER_AUDIT.md`)

#### 3.3 Real content packs as separate packages (2-3 days)
- `@hyperforge/content-pack-arctic-v1` — extract from `plugin-arctic-survival` into its own package
- `@hyperforge/asset-pack-hyperia-trees-v1` — actually implement (currently declared but missing)
- Project pack fork resolves to real packages, not in-plugin references

#### 3.4 AAA acceptance test (Phase 5 of master audit) (1 day)
- Write `pluginBoot.arcticShooterComposition.test.ts` — verify arctic + shooter boot together with no ability / entity / widget ID collisions

#### 3.5 Browser visible-payoff verification (1 day)
- Smoke script: fork Arctic Survival → open in dev client → assert biome textures / mob types / HUD widgets visibly differ from Hyperia fork
- Codified as Playwright test in `packages/asset-forge/src/__tests__/e2e/`

**Exit:** Building-blocks audit reads 100% complete. Three plugins coexist in browser, visually different.

---

### Phase 4 — AI vocabulary expansion (2-4 weeks)

**Goal:** Agent can compose *games*, not just *level geometry*.

#### 4.1 Game rules + win conditions (1 week)
- New PROPOSE_* actions:
  - `PROPOSE_GAME_RULE` — PvP on/off, respawn timer, day/night cycle, resource respawn rate
  - `PROPOSE_WIN_CONDITION` — DSL: `defeat_count(boss_id, 1)` / `collect_count(item_id, 10)` / `survive_time(seconds)`
  - `PROPOSE_LOSS_CONDITION` — same DSL inverted
- Schema in `manifest-schema` package; runtime evaluator in `gameplay-framework`
- Editor UI to inspect / edit rules
- Agent prompt context expanded with rule vocabulary

#### 4.2 Quest / behavior DSL (1-1.5 weeks)
- Extend `PROPOSE_QUEST` payload from `name` only to:
  - `objectives[]` (typed: kill-N, collect-N, reach-location, talk-to-NPC, with prerequisite chains)
  - `rewards` (XP, items, unlock chains)
  - `failure_branches`, `timeouts`
- New `PROPOSE_BEHAVIOR_TREE` — typed AST for NPC AI behavior (patrol, aggro, dialogue, attack patterns)
- New `PROPOSE_DIALOGUE_TREE` — branching dialogue with conditions
- Runtime interpreter in `hyperscape-plugin` (or `gameplay-framework`)

#### 4.3 Materials / shaders / VFX (3-5 days)
- `PROPOSE_MATERIAL` — material override (roughness, metallic, base-color, optional shader preset id)
- `PROPOSE_VFX` — particle / effect chain
- `PROPOSE_LIGHTING` — global lights, spotlights, post-processing
- Constrained vocabulary referencing pre-authored shader / particle assets from asset packs (no free-form shader synthesis in Phase 4)

#### 4.4 Hot-install + live iteration (3-5 days)
- `PROPOSE_INSTALL_PLUGIN` / `PROPOSE_INSTALL_CONTENT_PACK` actually install + register live (no project re-create needed)
- Agent can iterate: "try plugin X → see its contributions via LIST_PLUGINS → propose entities using its types"

**Exit:** Agent demos building a complete tower-defense game from scratch (game rules + waves via PROPOSE_BEHAVIOR_TREE + win condition).

---

### Phase 5 — Inspection + Multiplayer (1-3 weeks, optional)

#### 5.1 Editor Outliner + log streaming (1-2 weeks)
- `packages/shared/src/runtime/inspect/InspectChannel.ts` — WS endpoint on game server exposing read-only state (entity list, tick rate, log stream)
- `SessionInspector` panel in editor — shows entities + logs + perf for running PIE / Standalone session
- AI-accessible: `LIST_ENTITIES_AT_POSITION`, `INSPECT_ENTITY`, `OBSERVE_TICK_STATE` — agent can see the running game state

#### 5.2 Multiplayer modes (2-3 weeks, optional)
- Refactor `packages/client` to read `PUBLIC_API_URL` / `PUBLIC_WS_URL` at runtime (URL params or `window.__HF_CONFIG__`)
- Per-project port allocation in StandaloneLauncher
- "Net Mode" dropdown: Listen Server / Dedicated Server / Standalone
- "Number of Players: N" — multi-window orchestration

**Exit:** Two clients connect to one Standalone server and interact. Editor Outliner inspects either session.

---

### Phase 6 — Polish (1 week)

- Crash recovery: server crash → editor shows "Server crashed (log: ...)" + one-click relaunch
- Port collision detection with clean error message
- Settings: "Default launch mode" (PIE / Standalone), "Always save before play" (default ON)
- Documentation: "How to play your project" docs page
- Smoke tests: 100-iteration headless launch test in CI

---

## 4. Risks

| Risk | Mitigation |
|------|------------|
| **PIE controller migration breaks the whole engine** | Sub-divide Phase 1.1 into per-controller commits; smoke-test PIE after each |
| **Postgres requirement blocks Standalone for users without Docker** | Phase 0.2 `--ephemeral` flag should support an in-memory mode (best-effort; existing PIE stub DB shows it's feasible) |
| **Client build-time env vars block multi-instance** | Phase 5.2 explicitly does the runtime config refactor; not blocking MVP |
| **AI rule/behavior DSL design is open-ended and slips** | Phase 4 sub-divided; ship 4.1 (rules) first as a forcing function before 4.2 (quest DSL). Constrain scope hard. |
| **manifestSnapshot vs worldContent confusion at export time** | Phase 0.1 explicitly maps both into the single `FullProjectManifest` shape; round-trip tests pin the projection |
| **Cross-plugin id collisions surface only at runtime** | Phase 3.4 acceptance test enforces; framework's `first-seen-wins` becomes `fail-on-collision` in dev mode |

---

## 5. Effort estimates (best-case → realistic)

| Phase | Best | Realistic |
|-------|------|-----------|
| 0: Foundations | 1-2 weeks | 2-3 weeks |
| 1: PIE controllers | 2-3 weeks | 3-5 weeks |
| 2: Standalone Launch | 1-1.5 weeks | 1.5-2.5 weeks |
| 3: Building-blocks residual | 1 week | 1-2 weeks |
| 4: AI vocabulary | 2-4 weeks | 4-7 weeks |
| 5: Inspection + Multi | 1-3 weeks | 2-5 weeks |
| 6: Polish | 1 week | 1-2 weeks |
| **MVP (0 + 1 + 2 + 6)** | **5-7.5 weeks** | **7.5-12.5 weeks** |
| **Engine-flex MVP (+ 3 + 4)** | **8-12.5 weeks** | **12.5-21.5 weeks** |
| **Full (all)** | **9-15.5 weeks** | **15.5-26.5 weeks** |

---

## 6. Sequence + recommended order

```
Phase 0 (foundations) ───────────┐
                                 │
                                 ├──► Phase 1 (PIE) ──┐
                                 │                     │
                                 ├──► Phase 2 (Standalone) ──┐
                                 │                            │
                                 └──► Phase 3 (building-blocks)
                                      (parallel with 1+2)
                                                              │
                                          ────────────────────┘
                                          │
                                          ├──► Phase 4 (AI vocab — ships independently)
                                          │
                                          └──► Phase 5 (inspection + multi)
                                                              │
                                                              └──► Phase 6 (polish)
```

**Recommended order:**

1. **Phase 0 first.** Single biggest unlock. Without `ProjectBoot` neither PIE nor Standalone plays the user's project. Everything downstream depends on this.

2. **Phase 2 (Standalone) before Phase 1 (PIE).** Standalone ships faster (1-2 weeks) and gives users immediate "play my real project" value. PIE's controller migration (3-5 weeks realistic) progresses in parallel.

3. **Phase 1 in 1.2 → 1.3 → 1.1 order.** Cheap wins first (HUD layout, Stop/Pause/Eject). Controller migration last, when you have the most context and Standalone validates the underlying engine paths.

4. **Phase 3 in parallel with 1+2.** Building-blocks cleanup is mostly independent of PIE/Standalone work; can run as background sweep.

5. **Phase 4 (AI vocab) after Phase 2 ships.** Once users can verify games end-to-end via Standalone, AI vocabulary expansion has a clean test target.

6. **Phase 5 if needed.** Multiplayer is optional; Inspection (5.1) is valuable for DevX but not blocking shipped value.

7. **Phase 6 always last.** Polish what's stable.

---

## 7. Open decisions

1. **Phase 4 (AI vocabulary) — in scope or defer?** Without it, "build any game" is marketing not truth. With it, MVP slips by 4-7 weeks.

2. **Postgres requirement for Standalone** — keep Docker dependency, or refactor for SQLite fallback in editor-launched sessions?

3. **Save state between Standalone launches** — ephemeral (MVP) or per-project persistence (Phase 6)?

4. **Embedded client** (iframe inside editor) vs **separate window** (popup) — preference?

5. **Cook step** like UE5's "Launch" (cooks content first, slower but matches shipped pipeline) — needed, or always run uncooked dev path?

6. **Headless server mode** for automated playtest scripts — Phase 5 or Phase 2 addon?

7. **Multiplayer — defer indefinitely or include?** Each project today is single-session. Multiplayer is a real refactor (Phase 5.2, 2-3 weeks); if "any game" doesn't need multiplayer for the MVP demos, defer.

---

## 8. Connection to existing plans

This plan supersedes and integrates:

- **PLAN_AAA_MASTER_AUDIT.md** — phases 0-5 of the audit map to this plan's Phase 3 (residual building-blocks cleanup); Phase 5 (acceptance demo) maps to Phase 3.4-3.5 here
- **PLAN_AGENT_STUDIO_PARITY.md** — agent vocabulary work folds into Phase 4
- **PLAN_AI_AUTHORING_FOUNDATIONS.md** — game rules / behavior DSL aligns with Phase 4
- **PLAN_PROJECT_AS_DATA.md** — manifest pipeline aligns with Phase 0
- **PLAN_SERVERNETWORK_MIGRATION.md** — Step 9 (PIE loopback) is foundation for Phase 1
- **PLAN_ENGINE_GAME_SEPARATION.md** — engine decoupling is *done per Audit 2*; can be archived
- **PLAN_HYPERIA_DECOUPLING.md** — same, archive
- **PLAN_WORLD_STUDIO_AAA_COMPLETION.md** — Standalone UI work belongs here in Phase 2

**Recommendation:** keep this plan + PLAN_AAA_MASTER_AUDIT.md as the two live docs; mark others as superseded.

---

## 9. The honest read

After 6 deep audits, the **building-blocks architecture is closer to done than it felt** (~75%). The **playable engine is closer to broken than it looked** — PIE's foundation is correct but its controllers are still hooked to a synthetic shim. The **AI vocabulary builds level geometry but not games** — that's the load-bearing gap for "true AI studio."

Three independent gameplay plugins exist and coexist in tests. The asset-forge → game-server pipe is the missing connector that blocks both PIE-honesty and Standalone.

**The fastest path to "click play and it plays like a real game" is:**

1. **Phase 0 + Phase 2** (~3-4 weeks realistic): Project manifest pipeline + Standalone Launch. Users get a real, fully-working game session out of the editor.
2. **Phase 3 in parallel** (~1-2 weeks): Building-blocks residual close-out. Cleaner foundation for everything downstream.
3. **Phase 1** (~3-5 weeks realistic): PIE controller migration. Now PIE is honest too — same engine, just in-process.
4. **Phase 4** (~4-7 weeks realistic): AI vocabulary expansion. Now the agent builds *games*, not just decorated worlds.

Critical-path minimum to ship "AAA-quality PIE + Standalone for any game built by AI": **~12-18 weeks realistic.**

Hyperia-only Standalone shipping is achievable in **4-6 weeks**.

---

*Last updated: 2026-05-23. Living doc — update as phases ship.*
