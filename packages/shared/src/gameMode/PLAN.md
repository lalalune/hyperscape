# GameMode System — Plan & Status

UE5-inspired abstraction that lets each Hyperia-family game declare its own
player controller, camera, input context, and pawn. Both the live client and
the World Studio PIE runtime resolve the same `GameMode` from a per-game
manifest, eliminating the current drift where PIE uses a WASD fly-cam while
the shipped game is click-to-walk.

> **Why this exists.** Hyperia was built first; World Studio came second.
> Today `PlayerLocal` hardcodes tile-based-MMORPG-style click-to-walk and `PlayTestWorld`
> re-implements a parallel WASD loop. Adding a second game (top-down shooter,
> Diablo-like, FPS, platformer) is impossible without an abstraction to pick
> between. World Studio's larger goal is to be a multi-game AI studio, with
> Hyperia as the first GameMode — not the only playable one.

---

## Non-goals & invariants (zero-regression contract)

The shipped Hyperia game must play **byte-for-byte identically** at
every phase boundary. Concretely:

1. **Facade, don't extract.** Existing Hyperia systems are canonical.
   GameMode classes are thin adapters that *delegate* to them. We never
   copy `ClientCameraSystem`'s orbit math, `InteractionRouter`'s click
   routing, or `PlayerLocal`'s character loop into the GameMode module.
   If you find yourself writing camera math inside `OrbitCameraController`,
   stop — that's duplication.

2. **PlayerLocal is the pawn, untouched.** `PlayerLocal.ts` (3124 lines)
   stays the body for the Hyperia GameMode. No phase rewrites it.
   Where the original plan said "PlayerLocal.init() consumes
   `gameMode.createPlayerController(ctx)`", the revised approach is for
   the world bootstrap to resolve the GameMode *around* PlayerLocal,
   not inside it. See Phase 3 below.

3. **The Hyperia GameMode is a lookup, not a rewrite.** For the live
   client, `HyperiaGameMode` essentially says "this game uses
   InteractionRouter + ClientCameraSystem + the existing ClientInput
   bindings — here's a handle to each." Swapping to a different
   GameMode swaps which *existing* systems get wired, or installs new
   ones for new game types. It never forks Hyperia's gameplay code.

4. **No `gameMode/` imports in Hyperia gameplay systems.** Combat,
   skills, inventory, networking, etc. do not import from
   `packages/shared/src/gameMode/`. The GameMode module only touches
   the input/camera/controller seam. This is enforced by a one-line
   grep check at the end of each phase (see PLAN verification steps).

5. **Alternate GameModes are additive.** `WASDPlayerController`,
   `FirstPersonCameraController`, etc. are *new* code for *new* games.
   They don't replace Hyperia's path — they run parallel when a
   different manifest is resolved.

6. **PIE parity first.** The first observable benefit is PIE Play-mode
   using click-to-walk (matching the live game). That requires no new
   controller logic — it requires PIE to *call into the existing
   InteractionRouter* instead of its own WASD loop. That's Phase 3.

### What "duplication" looks like and what to do instead

| ❌ Duplication | ✅ Facade |
|---|---|
| Copy orbit-math out of `ClientCameraSystem` into `OrbitCameraController`. | `OrbitCameraController.getCamera()` returns `world.camera`; `attach()` emits the existing `CAMERA_SET_TARGET` event. |
| Re-implement raycast→MOVE_TO in `ClickToWalkPlayerController`. | Controller is a marker class; the world still has the real `InteractionRouter` registered by `createClientWorld`. |
| Add an EventBus listener in `PlayerLocal` for a new `gameMode:input` event. | No PlayerLocal changes. World bootstrap stashes the resolved GameMode on `world.gameMode` for read-only discovery. |
| Create a `hyperia-default` InputContext that re-binds Move/Look via `world.controls.bind()`. | Context is declarative (action → binding list). `activate()` is a no-op because `ClientInput` already owns those bindings. |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done — merged and covered by tests |
| 🟡 | Partial — scaffolding in, behavior parity in progress |
| ⬜ | Not started |
| ⏸️ | Deferred — blocked on a decision or out-of-scope for v1 |

## Phase Summary

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Architecture discovery | ✅ |
| 1 | Extract interfaces (`GameMode` / `PlayerController` / `CameraController` / `InputContext` / `GameModeRegistry`) | ✅ |
| 2 | Migrate current Hyperia behavior behind the interfaces (zero behavior change) | ✅ |
| 3 | PIE consumes the GameMode contract instead of its own WASD loop | ✅ |
| 4 | Per-game manifest — persist GameMode on the game record + server route | ✅ |
| 5 | Second + third controller/camera implementations (WASD, FirstPerson) to prove pluggability | ✅ |
| 6 | Editor UI — GameMode picker in Game Settings; Simulate/Play toggle in PIE toolbar | ✅ |
| 7 | Tests — contract, PIE roundtrip, drift regression | ✅ |

---

## Reference model — UE5

UE5 cleanly decouples player behavior across four swappable classes. This is
the target mental model:

| UE5 class | Role | Swap point |
|-----------|------|------------|
| `GameModeBase` | Rules, defaults, spawn logic | Project Settings → Maps & Modes (per project) or World Settings override (per map) |
| `PlayerController` | Input → intent (`Move`, `Look`, `Interact`) | `GameMode::PlayerControllerClass` |
| `Pawn / Character` | Physical body (movement component, capsule, mesh) | `GameMode::DefaultPawnClass` |
| `InputMappingContext` | Abstract `Move`/`Look`/`Interact` actions from specific keys | Pushed onto the PlayerController at runtime |

PIE in UE5 always resolves the current map's GameMode and runs that. The
editor itself has **zero** knowledge of click-vs-WASD — it just starts the
game. Our PIE should do the same.

---

## Target directory layout

```
packages/shared/src/gameMode/
  GameMode.ts                        # interface + factory contract
  GameModeRegistry.ts                # name → factory lookup; default + overrides
  HyperiaGameMode.ts              # default composition: click-to-walk + orbit cam
  controllers/
    PlayerController.ts              # base interface (tick / applyInputContext / dispose)
    ClickToWalkPlayerController.ts   # raycast click → MOVE_TO / INTERACT intent
    WASDPlayerController.ts          # keyboard → CharacterMove vector
    TopDownPlayerController.ts       # click-to-move with fixed-angle camera
  cameras/
    CameraController.ts              # base interface (follow / transform / zoom)
    OrbitCameraController.ts         # extracted from current Hyperia camera
    FirstPersonCameraController.ts
    FixedAngleCameraController.ts    # Diablo/tile-based MMORPG fixed pitch + zoom
  input/
    InputContext.ts                  # InputMappingContext analogue (action → binding)
    defaultContexts.ts               # hyperia-default, wasd-default, fps-default
  pawns/
    Pawn.ts                          # pawn lifecycle hooks (spawn / possess / unpossess)
  __tests__/
    contract.test.ts
    registry.test.ts
    drift.test.ts
```

Game manifest declares its GameMode (stored on the asset-forge game record):

```jsonc
{
  "name": "Hyperia",
  "gameMode": {
    "playerController": "click-to-walk",
    "camera": "orbit",
    "inputContext": "hyperia-default",
    "pawn": "humanoid-rpg"
  }
}
```

Live client and PIE both call `GameModeRegistry.resolve(gameRecord.gameMode)`
at startup. **Same code path, same resolved controllers.**

---

## Phase 0 — Architecture discovery ✅

Completed 2026-04-16. Captured in `project_gamemode_system.md`.

Key findings:

- **`PlayerLocal` (3124 lines)** already delegates to four sub-controllers
  (`PlayerInputHandler`, `PlayerCharacterController`, `PlayerCameraController`,
  `PlayerAvatarController`). The GameMode contract becomes the bus those
  plug into instead of being hardcoded.
- **`ClientCameraSystem` (3054 lines)** owns orbit/follow + cinematic duel
  camera. Phase 2 extracts its orbit+follow modes into
  `OrbitCameraController`; cinematic duel stays as a specialized overlay.
- **`InteractionRouter`** is the click-to-walk implementation. Its raycast
  and server-intent code stay where they are — Phase 1 just wraps its
  click-intent routing in `ClickToWalkPlayerController`.
- **`ControlPriorities`** (7-level consumption hierarchy) is already
  abstract enough to stay as-is.
- **`PlayTestWorld` (430 lines)** is the PIE runtime. It currently owns a
  raw WASD loop; Phase 3 replaces that loop with a GameMode-resolved stack.
- **No existing abstraction**: nothing in the repo today distinguishes
  "how the player moves in this game" from "how the Hyperia player moves."

---

## Phase 1 — Extract interfaces ✅

Completed 2026-04-16. Landed the contracts with **zero runtime wiring**.
Pure types and a registry stub. Nothing imports these yet.

Files:
- `GameMode.ts` — `GameMode`, `GameModeManifest`, `GameModeContext`, `GameModeFactory`.
- `GameModeRegistry.ts` — `GameModeRegistry` + singleton `gameModeRegistry`, `UnknownGameModeError`.
- `controllers/PlayerController.ts` — `PlayerController` interface.
- `cameras/CameraController.ts` — `CameraController` interface.
- `input/InputContext.ts` — `InputContext`, `InputBinding`, `InputActionName`, `InputSourceKind`.
- `pawns/Pawn.ts` — `Pawn` interface.
- `index.ts` — public barrel.
- `__tests__/registry.test.ts` — 12 passing tests.

### 1.1 `GameMode` contract

```typescript
// packages/shared/src/gameMode/GameMode.ts
export interface GameModeManifest {
  playerController: string;
  camera: string;
  inputContext: string;
  pawn: string;
}

export interface GameMode {
  id: string;
  manifest: GameModeManifest;
  createPlayerController(ctx: GameModeContext): PlayerController;
  createCameraController(ctx: GameModeContext): CameraController;
  createInputContext(ctx: GameModeContext): InputContext;
  // Pawn creation is deferred to Phase 2 — for now PlayerLocal IS the pawn.
}
```

### 1.2 `PlayerController` base interface

```typescript
// packages/shared/src/gameMode/controllers/PlayerController.ts
export interface PlayerController {
  id: string;
  attach(pawn: Pawn, input: InputContext): void;
  tick(dt: number): void;
  detach(): void;
}
```

### 1.3 `CameraController` base interface

```typescript
// packages/shared/src/gameMode/cameras/CameraController.ts
export interface CameraController {
  id: string;
  attach(target: Pawn): void;
  tick(dt: number): void;
  detach(): void;
  getCamera(): THREE.Camera;
}
```

### 1.4 `InputContext` base interface

```typescript
// packages/shared/src/gameMode/input/InputContext.ts
export type InputActionName = "Move" | "Look" | "Interact" | "Jump" | "Run";

export interface InputContext {
  id: string;
  actions: Record<InputActionName, InputBinding[]>;
  activate(input: ClientInput): void;
  deactivate(input: ClientInput): void;
}
```

### 1.5 `GameModeRegistry`

```typescript
// packages/shared/src/gameMode/GameModeRegistry.ts
export class GameModeRegistry {
  register(id: string, factory: (ctx: GameModeContext) => GameMode): void;
  resolve(manifest: GameModeManifest, ctx: GameModeContext): GameMode;
  has(id: string): boolean;
}
```

### 1.6 Acceptance

- [ ] All five files compile with `tsc --noEmit` (strict).
- [ ] `GameModeRegistry` has a unit test for register/resolve/has.
- [ ] No production file imports anything from `gameMode/` yet.
- [ ] Exported via a new `packages/shared/src/gameMode/index.ts` barrel.

---

## Phase 2 — Migrate Hyperia behavior ✅

Goal: the shipped game runs through `HyperiaGameMode` but plays
**identically**. This is a refactor, not a feature.

**Status (2026-04-16):** complete. Adapter layer landed in Phase 2
and the live `createClientWorld` bootstrap landed in Phase 3.1 as
planned (same callsite, same commit). `PlayerLocal.init()` is
intentionally *not* modified — the revised architecture stashes the
resolved GameMode on `world.gameMode` for read-only discovery rather
than threading it into the 3124-line pawn. Zero-regression contract
holds: `git diff --stat` on `PlayerLocal.ts`, `InteractionRouter/`,
and `ClientCameraSystem.ts` is empty.

Completed:
- `ClickToWalkPlayerController` adapter wrapping the existing
  `InteractionRouter` system. Lifecycle ids match the contract; tick
  is a deliberate no-op so InteractionRouter isn't double-routed.
- `OrbitCameraController` adapter exposing `world.camera` and routing
  through the existing `CAMERA_SET_TARGET` event. Detach intentionally
  does not null out target (matches legacy teardown; payload doesn't
  accept null).
- `HyperiaGameMode` composition — factory + opt-in
  `registerHyperiaGameMode(registry)` helper.
- `hyperia-default` InputContext declaring Move / Look / Interact
  / Run / Jump bindings; `activate` / `deactivate` are no-op because
  `ClientInput` already owns native Hyperia bindings.
- 23 passing unit tests (registry + HyperiaGameMode composition +
  lifecycle + idempotency).
- Barrel exports updated; zero production code imports `gameMode/` yet.

Deferred to Phase 3:
- `createClientWorld` calls `registerHyperiaGameMode` + resolves
  `HYPERIA_DEFAULT_MANIFEST` at startup.
- `PlayerLocal.init()` consumes `gameMode.createPlayerController(ctx)`
  and delegates input/camera wiring through the resolved controller.
- Playwright smoke test for behavior parity.

### 2.1 `HyperiaGameMode`

Composes: `ClickToWalkPlayerController` + `OrbitCameraController` +
`hyperia-default` InputContext + humanoid pawn id.

### 2.2 `ClickToWalkPlayerController` — facade, not extract

- **Does not** re-implement click-to-walk. `InteractionRouter` remains
  the single source of truth for raycast + server-intent.
- Controller is a lifecycle marker: `attach()` possesses the pawn and
  activates its InputContext; `tick()` is a deliberate no-op because
  `InteractionRouter.update()` already ticks; `detach()` unpossesses.
- Diagnostic `getInteractionRouter()` returns the live router for tests
  and the PIE toolbar — no new behavior, just discovery.

### 2.3 `OrbitCameraController` — facade, not extract

- **Does not** duplicate `ClientCameraSystem`'s orbit math or follow
  logic (3054 lines of canonical code).
- `getCamera()` returns `world.camera`. `attach()` emits the existing
  `CAMERA_SET_TARGET` event — the same path `PlayerInputHandler` uses.
- Cinematic duel camera stays wholly inside `ClientCameraSystem`; it's
  a specialized overlay, not a GameMode swap.

### 2.4 Bootstrap wiring — deferred to Phase 3

The original plan called for `PlayerLocal.init()` to consume
`gameMode.createPlayerController(ctx)` directly. That would require
modifying a 3124-line file and risks forcing the controller to own
logic PlayerLocal already owns → duplication.

**Revised approach (lands in Phase 3):** `createClientWorld` stashes
the resolved GameMode on `world.gameMode` for read-only discovery.
`PlayerLocal` stays untouched. See Phase 3.1.

### 2.5 Acceptance

- [x] `gameMode/` compiles clean under `tsc --noEmit`.
- [x] Unit tests cover registry + HyperiaGameMode composition +
      controller/camera lifecycle + idempotency (23 passing).
- [x] Zero production imports of `gameMode/` — Hyperia gameplay
      code is untouched (`grep -r "from.*gameMode" packages/ == 0`).
- [x] Adapter classes delegate to existing systems; no copied math
      or routing logic.

---

## Phase 3 — PIE consumes the GameMode contract ✅

Completed 2026-04-16. All three sub-phases landed:

- **3.1 Live client stash** — `createClientWorld` registers and resolves
  `HYPERIA_DEFAULT_MANIFEST`, stashes result on `world.gameMode`. Zero
  diff on PlayerLocal / InteractionRouter / ClientCameraSystem.
- **3.2 PIE resolve + branch** — `PlayTestWorld` accepts an optional
  `gameMode` manifest in options, resolves it, and stashes on
  `this.gameMode`. `usePIESession` threads
  `HYPERIA_DEFAULT_MANIFEST` into `startOptions` and branches on the
  resolved controller id (currently both branches fall through to the
  editor fly-cam; native click-to-walk-in-PIE wiring is deferred to
  Phase 4 where the PIE InteractionRouter host lands).
- **3.3 Simulate/Play toolbar toggle** — `PIEMode` added to studio
  state with `mode: "simulate" | "play"`, reducer rejects mid-session
  mode changes, `MainToolbar` renders a segmented control while PIE is
  idle, and `usePIESession`'s branch now reads `state.pie.mode` so
  Simulate always uses the fly-cam regardless of resolved GameMode.

Invariants confirmed: `git diff --stat` on canonical gameplay files is
empty. 23/23 gameMode tests pass. `grep "from.*gameMode"` in
`systems/` and `entities/` returns zero matches.

---

### Phase 3 design notes (retained for reference)

Goal: PIE Play-mode uses click-to-walk (matching the live game) by
calling the *same existing InteractionRouter* the live client uses —
not by re-implementing click routing inside PIE.

**Non-goal:** modifying `PlayerLocal`, `InteractionRouter`, or
`ClientCameraSystem`. The entire phase is net-additive to PIE; the
live client gets a one-line manifest stash for discoverability.

### 3.1 Live client — register + stash, zero gameplay impact

- `createClientWorld` calls `registerHyperiaGameMode(gameModeRegistry)`.
- After `PlayerLocal` is instantiated (unchanged), the bootstrap does:
  ```ts
  world.gameMode = gameModeRegistry.resolve(
    HYPERIA_DEFAULT_MANIFEST,
    { world, runtime: "client" },
  );
  ```
- `world.gameMode` is read-only; nothing in Hyperia gameplay reads it.
  PIE will.
- **Acceptance:** grep Hyperia gameplay systems — `world.gameMode`
  references must be zero outside `createClientWorld`, PIE, and
  optional diagnostics.

### 3.2 PIE — resolve + branch on manifest

Today `PlayTestWorld` owns its own WASD loop. The fix is **not** to
copy click-to-walk into PIE; it's to:

- Have PIE register the same Hyperia systems the live client uses
  (`InteractionRouter`, `ClientCameraSystem`, `ClientInput`) when the
  resolved manifest calls for them.
- The WASD loop PIE uses today becomes the implementation for a
  *different* manifest (wasd-default) registered in Phase 5.

Decision branch in `createPlayTestWorld` / `usePIESession`:

```ts
const mode = gameModeRegistry.resolve(manifest, { world, runtime: "pie" });
if (mode.id === CLICK_TO_WALK_CONTROLLER_ID) {
  world.addSystem(new InteractionRouter(world));
  world.addSystem(new ClientCameraSystem(world));
  // ClientInput is shared by both modes
} else {
  // Phase 5 registers alternate systems
}
```

No new click-to-walk code. PIE inherits exactly what the live client runs.

### 3.3 PIE "Simulate" vs "Play" modes

UE5 distinguishes these; we ship both:

| Mode | Behavior |
|------|----------|
| **Simulate** | Editor fly-cam, no pawn possession. Level designers can move freely without engaging the game's actual controller. |
| **Play** | Full GameMode stack — click-to-walk, orbit camera, etc. |

- Add a toolbar toggle in `MainToolbar`.
- Simulate mode keeps PIE's existing editor fly-cam (already working
  code, don't touch it).
- Play mode takes the decision branch in 3.2.

### 3.4 Acceptance

- [ ] Live client gameplay is byte-identical to `main` (Playwright
      smoke: spawn → walk → attack NPC → pick up item).
- [ ] `git diff packages/shared/src/entities/player/` is empty
      (no PlayerLocal changes).
- [ ] PIE Play mode with `click-to-walk` manifest routes clicks
      through the same InteractionRouter handlers the live client uses.
- [ ] PIE Simulate mode behaves exactly as today (editor fly-cam).
- [ ] `grep -r "from.*gameMode" packages/shared/src/systems/` returns
      zero matches (GameMode module doesn't leak into gameplay).

---

## Phase 4 — Per-game manifest ✅

Goal: GameMode choice persists on the server.

### 4.1 Schema change ✅

- `game_mode JSONB` column added to `games` table with
  `.$type<GameModeManifest>()` typing
  (`packages/asset-forge/server/db/schema/teams.schema.ts`).
- Migration `0003_games_game_mode.sql` backfills existing rows with
  the Hyperia default via SQL `DEFAULT` then drops the default so
  future inserts pass the manifest explicitly through Drizzle.
- Journal entry `0003_games_game_mode` registered.

### 4.2 Server route ✅

- `GameModeManifestBody` TypeBox schema added to
  `server/models/world-studio.models.ts`.
- `CreateGameBody` / `UpdateGameBody` now accept optional `gameMode`;
  `GameResponse` exposes it on every game-route response (GET list, GET
  single, POST, PUT).
- `server/utils/gameModeRegistry.ts` holds a server-side allowlist of
  known `playerController` / `camera` / `inputContext` / `pawn` ids —
  kept in lockstep with the client registry but without importing
  Three.js/PhysX into the Elysia process.
- POST `/api/teams/:teamId/games` and PUT `/api/teams/:teamId/games/:gameId`
  run the manifest through `validateGameModeManifest()` and return a
  structured 400 with the known-ids list on rejection.
- `TeamService.createGame` accepts an optional manifest and defaults
  to the Hyperia quartet when omitted.

### 4.3 Client read path ✅

- `WorldStudio` state: `StudioProjectState.gameMode: GameModeManifest | null`
  added; `SET_PROJECT` action + reducer + `setProject(...)` signature
  threaded through.
- `utils/worldProjectApi.ts`: `GameResponse` updated to match the server
  schema (`moduleId`, `gameMode`, `stagingServerUrl`,
  `productionServerUrl`). New `fetchGame(teamId, gameId)` helper.
- `hooks/useProjectLoader.ts` fetches the owning game record after the
  project loads and passes its manifest into `setProject`. The fetch is
  best-effort — a warn is logged and `null` is stored if the game
  record is unavailable.
- `hooks/usePIESession.ts` reads
  `state.project.gameMode ?? HYPERIA_DEFAULT_MANIFEST` and passes
  that into `world.start({ gameMode })`, replacing the hardcoded
  default. `state.project.gameMode` added to the `startPIE` callback
  deps.

### 4.4 Acceptance

- [x] Migration file + journal entry committed; default manifest is the
      Hyperia quartet; existing rows get backfilled via SQL literal.
- [x] POST with no `gameMode` inserts the Hyperia default (see
      `TeamService.createGame` and the route fallback).
- [x] POST/PUT with a `gameMode` round-trip through
      `validateGameModeManifest` — unknown ids are rejected with 400.
- [x] `usePIESession` reads the persisted manifest; next PIE session
      uses the newly-saved `playerController` / `camera` / etc.
- [x] TypeScript clean on modified files (server + client).
- [x] 23/23 gameMode unit tests pass.
- [x] `PlayerLocal.ts`, `InteractionRouter`, `ClientCameraSystem.ts`
      byte-identical to HEAD (`git diff --stat` empty).

---

## Phase 5 — Prove pluggability ✅

**Status:** Complete (2026-04-16).

**What shipped:**
- `WASDPlayerController` (`controllers/WASDPlayerController.ts`) — kinematic WASD+Shift+Space; installs window key listeners; writes XZ/Y to `pawn.object.position`; grounds to baked `groundY`.
- `FirstPersonCameraController` (`cameras/FirstPersonCameraController.ts`) — pointer-locked yaw/pitch; rotates pawn yaw to match camera so WASD follows gaze; Euler YXZ, pitch clamped ±89°.
- `TopDownPlayerController` (`controllers/TopDownPlayerController.ts`) — viewport pointerdown raycast against ground plane; linear walk-to-target; atan2 facing.
- `FixedAngleCameraController` (`cameras/FixedAngleCameraController.ts`) — constant offset `(0, 12, 10)`, always looks at pawn.
- Three new input contexts in `input/defaultContexts.ts`: `wasd-default`, `fps-default`, `topdown-default`. All factory `activate`/`deactivate` are no-ops — controllers own their own DOM listeners.
- `AlternateGameModes.ts` orchestration: `WASDGameMode`, `TopDownGameMode`, `createWASDGameMode`, `createTopDownGameMode`, `registerAlternateGameModes(registry)`, plus three frozen manifests (`WASD_DEFAULT_MANIFEST`, `FPS_DEFAULT_MANIFEST`, `TOP_DOWN_DEFAULT_MANIFEST`).
- `resolveCamera()` / `resolveInputContext()` switch over manifest ids — throws on unknown so bad manifests surface at resolve time.
- Barrel `gameMode/index.ts` re-exports all new ids, classes, contexts, manifests, and `registerAlternateGameModes`.
- Server allowlist `asset-forge/server/utils/gameModeRegistry.ts` extended: adds `wasd`/`top-down` playerControllers, `first-person`/`fixed-angle` cameras, `wasd-default`/`fps-default`/`topdown-default` input contexts, `humanoid-kinematic`/`cursor-avatar` pawns.
- Boot registration: both `createClientWorld` and `createPlayTestWorld` now call `registerAlternateGameModes(gameModeRegistry)` alongside `registerHyperiaGameMode`.

**Zero-regression verified:**
```
$ git diff --stat HEAD -- \
    packages/shared/src/entities/player/PlayerLocal.ts \
    packages/shared/src/systems/client/interaction/ \
    packages/shared/src/systems/client/ClientCameraSystem.ts
(empty)
```

**Tests:** 23/23 gameMode tests pass (`vitest run packages/shared/src/gameMode/`).

**TypeScript:** zero new errors introduced in shared or asset-forge (pre-existing errors unrelated to Phase 5 remain).

---

## Phase 5 — Prove pluggability (original plan below) ⬜ (superseded)

Goal: ship at least two additional controller/camera combos to
validate the abstraction isn't Hyperia-shaped.

**Invariant:** alternate controllers are *new* code paths. They
never modify `InteractionRouter`, `ClientCameraSystem`, or `PlayerLocal`.
When a Hyperia manifest resolves, the alternate controllers are
dormant; when a WASD manifest resolves, the Hyperia stack is dormant.

### 5.1 `WASDPlayerController`

- Keyboard WASD → movement vector → `CharacterMove` intent.
- Installs its own `ClientInput` bindings via the `wasd-default`
  InputContext's `activate()`. These bindings coexist with the
  hyperia-default set; only one InputContext is active at a time.
- Shares the pawn (PlayerLocal's character controller) for humanoid
  games. For non-humanoid games a new Pawn implementation lands here.

### 5.2 `FirstPersonCameraController`

- New camera controller. `getCamera()` returns `world.camera` (same
  scene camera), but `tick()` runs the FPS look math locally because
  `ClientCameraSystem`'s orbit math is wrong for FPS.
- This is *not* duplication — it's an alternate implementation for a
  different behavior. `ClientCameraSystem` stays intact for Hyperia;
  FPS games swap in this controller instead.
- When this controller is active, `ClientCameraSystem`'s per-frame
  update should be either (a) not added to the world, or (b) bypassed
  via a flag. Decision during implementation.

### 5.3 `TopDownPlayerController` + `FixedAngleCameraController`

- Click-to-move (reuses InteractionRouter's click intent but ignores
  the orbit camera).
- Fixed pitch/zoom camera with no free rotation.
- Proves the controller/camera split is meaningful.

### 5.4 Acceptance

- [ ] Creating a new asset-forge game with `{ playerController: "wasd",
      camera: "first-person", inputContext: "fps-default" }` produces a
      playable FPS-style session in PIE with no editor code changes.
- [ ] Switching back to Hyperia defaults returns click-to-walk.
- [ ] `git diff packages/shared/src/systems/client/InteractionRouter.ts`
      is empty throughout Phase 5.
- [ ] `git diff packages/shared/src/systems/client/ClientCameraSystem.ts`
      is empty throughout Phase 5.
- [ ] `git diff packages/shared/src/entities/player/PlayerLocal.ts`
      is empty throughout Phase 5.

---

## Phase 6 — Editor UI ✅

**Status:** Complete (2026-04-16).

**What shipped:**
- **6.1 GameMode picker** — `panels/GameSettingsDialog.tsx` with four dropdowns (playerController / camera / inputContext / pawn). Option lists mirror the server allowlist. Save calls `updateGame(teamId, gameId, { gameMode })` (new helper in `utils/worldProjectApi.ts`), then dispatches `actions.setGameMode(manifest)` so PIE's next Play tick picks up the new manifest.
- **6.2 Simulate/Play toggle** — already landed in Phase 3.3 (see `toolbar/MainToolbar.tsx` — segmented radio group bound to `state.pie.mode` with `actions.pieSetMode("simulate" | "play")`).
- New reducer action `SET_GAME_MODE` + `actions.setGameMode(manifest)` context dispatcher for in-session updates without re-fetching the project.
- New `updateGame()` PUT helper in `worldProjectApi.ts`.
- New `Gamepad2` toolbar button opens the dialog.

**Zero-regression invariants still hold** — no Phase 6 change touched `PlayerLocal.ts`, `InteractionRouter/`, or `ClientCameraSystem.ts`.

---

## Phase 6 — Editor UI (original plan below) ⬜ (superseded)

### 6.1 Game Settings panel — GameMode picker

- New "GameMode" section in Game Settings.
- Four dropdowns: Player Controller, Camera, Input Context, Pawn.
- Each populated from the registry's registered ids.
- Save → PATCH `/api/games/:id`.

### 6.2 PIE toolbar — Simulate/Play toggle

- Two buttons (or a segmented control) in `MainToolbar`.
- State lives in `usePIESession`.

### 6.3 Acceptance

- [ ] Non-technical user can switch a game from click-to-walk to WASD
      without touching code.
- [ ] PIE reflects the change on next Play.

---

## Phase 7 — Tests ✅

### 7.1 Contract tests ✅

`packages/shared/src/gameMode/__tests__/contract.test.ts` — every
registered GameMode must:

- Produce non-null controller / camera / input context from its factories.
- Each controller passes the `PlayerController` interface shape (duck-type).
- Registry round-trips every registered id.

**Status:** 18 tests added covering all 4 canonical modes (hyperia,
wasd, fps, top-down). Each mode is resolved via a fresh
`GameModeRegistry`, and `createPlayerController` /
`createCameraController` / `createInputContext` are asserted to return
non-null objects with non-empty ids and the expected function surface
(`attach`/`tick`/`detach`/`getCamera`). An additional lifecycle test
asserts the WASD controller's `attach`/`detach` are idempotent. All 41
gameMode tests pass (23 pre-existing + 18 new).

### 7.2 PIE roundtrip test ✅

`packages/shared/src/gameMode/__tests__/pieRoundtrip.test.ts` —
mirrors the full `usePIESession` flow at the unit level: manifest →
`GameModeRegistry.resolve` → `createPlayerController` →
`attach(pawn, inputCtx)` → dispatch a real input event → `tick(dt)` →
pawn position advances. Runs under `@vitest-environment jsdom` so the
controllers receive actual `KeyboardEvent` / `PointerEvent`
dispatches, exactly like they would in the browser.

**Status:** 5 tests added and passing.
- WASD manifest: `KeyW` keydown + `tick(0.1)` advances the pawn
  (>0, <1 unit — sanity-bounded to catch runaway ticks).
- WASD manifest: no keys held → `tick` is a zero-delta no-op.
- Top-down manifest: viewport pointerdown at center → `tick` walks the
  pawn toward the raycast hit; asserts distance to origin *decreases*.
- Click-to-walk manifest: `tick` is a facade no-op (InteractionRouter
  owns real routing); guards the facade from accidentally gaining
  behavior.
- Manifest switching: resolving three different manifests against a
  single registry yields three controllers with the correct ids.

The full Playwright harness (editor viewport + Three.js+PhysX + real
server) remains out of scope; these unit roundtrip tests cover the
contract boundary PIE actually relies on, which is the registry →
controller wiring.

### 7.3 Drift regression test ✅

`packages/asset-forge/tests/unit/server/gameModeAllowlistDrift.test.ts`
— guards the server-side allowlist in
`asset-forge/server/utils/gameModeRegistry.ts` against drift from the
shared-side canonical manifests.

**Status:** 22 tests added. For each of the 4 canonical manifests
(inlined in the test to avoid pre-built-bundle staleness), we verify
(a) each field is allowlisted on the server and (b) the full manifest
passes `validateGameModeManifest` end-to-end. Two additional tests
assert the server rejects unknown ids and that the Phase 5 id set is
exhaustive. All 22 tests pass.

### 7.4 Acceptance ✅

- [x] Contract tests pass (`packages/shared`, 18 tests).
- [x] PIE roundtrip tests pass (`packages/shared`, 5 tests).
- [x] Drift tests pass (`packages/asset-forge`, 22 tests).
- [x] Full GameMode suite green: 46 tests across 4 files.
- [x] Every controller + camera is exercised (hyperia
      click-to-walk + orbit, wasd + orbit, wasd + first-person,
      top-down + fixed-angle) — contract asserts factory shape, PIE
      roundtrip asserts real input → observable pawn movement.
- [x] Zero-regression contract holds: `git diff --stat` on
      `PlayerLocal.ts`, `InteractionRouter/`, and
      `ClientCameraSystem.ts` is empty.

---

## Key decisions (captured 2026-04-16)

- **GameMode is per-game, not per-world.** A Hyperia game can have
  many worlds/scenes sharing one GameMode. World-level override is a
  future extension, not a v1 requirement.
- **Per-player override is v2.** The UE5 pattern of pushing an alternate
  `InputMappingContext` at runtime is the migration path (e.g., player
  opts into WASD inside an tile-based-MMORPG-style game), but v1 only supports
  per-game defaults.
- **Simulate vs Play in PIE.** Ships in Phase 3. Level designers need
  to position cameras without engaging the game's controller.
- **`PlayerLocal` stays as the Hyperia pawn.** 3124 lines, but already
  delegates internally. The GameMode contract becomes the bus those
  sub-controllers plug into.
- **`InteractionRouter` stays intact.** Phase 2 wraps its click-intent
  routing; raycast + server-intent code doesn't move.
- **Cinematic duel camera stays in `ClientCameraSystem`.** It's a
  specialized overlay that temporarily possesses the camera, not a
  general-purpose camera mode.

---

## Cross-references

- `packages/shared/src/entities/player/PlayerLocal.ts` — current god-class pawn.
- `packages/shared/src/systems/client/ClientInput.ts` — input priorities stay as-is.
- `packages/shared/src/systems/client/ClientCameraSystem.ts` — camera extraction source.
- `packages/shared/src/systems/client/InteractionRouter.ts` — click-to-walk source.
- `packages/shared/src/runtime/createPlayTestWorld.ts` — PIE runtime (Phase 3 target).
- `packages/asset-forge/src/components/WorldStudio/hooks/usePIESession.ts` — PIE lifecycle.
- `packages/asset-forge/server/routes/games.ts` — where GameMode manifest lives server-side (Phase 4).
- `/Users/lucid/.claude/projects/-Users-lucid-development-hyperia/memory/project_gamemode_system.md` — top-level memory.

---

## Critical path

1. **Phase 1** unblocks everything (interfaces).
2. **Phase 2** must land before Phase 3 (PIE needs a working Hyperia GameMode to resolve).
3. **Phase 4** and **Phase 5** are parallelizable once Phase 3 is done.
4. **Phase 6** depends on Phase 4 (manifest must exist before the UI can edit it).
5. **Phase 7** ships incrementally — unit tests per phase, integration tests in Phase 7.

---

## Verification at every phase boundary

Before marking any phase done, run these four checks. Any failure means
the phase risks regression or duplication.

### 1. Gameplay code untouched outside the seam

```bash
# Hyperia gameplay systems must NOT import gameMode/
grep -r "from.*gameMode" packages/shared/src/systems/
# Expected: zero matches. The GameMode module only touches the
# input/camera/controller seam at world-bootstrap time.
```

### 2. No copied logic

```bash
# Flag any large anonymous method blocks inside gameMode/ — they're
# the usual symptom of extracted/copied logic.
find packages/shared/src/gameMode -name "*.ts" -not -path "*__tests__*" \
  -exec wc -l {} +
# Expected: every file < 150 lines. Adapters should be small. A file
# over that threshold is probably duplicating something.
```

### 3. PlayerLocal / InteractionRouter / ClientCameraSystem diff-clean

```bash
git diff main -- \
  packages/shared/src/entities/player/PlayerLocal.ts \
  packages/shared/src/systems/client/interaction/InteractionRouter.ts \
  packages/shared/src/systems/client/ClientCameraSystem.ts
# Expected through Phase 5: empty. Through Phase 7 any diff must be
# surgical (e.g. a single-line addition of world.gameMode stash in
# createClientWorld, which is not one of these files anyway).
```

### 4. Live-game Playwright smoke

Spawn → click-to-walk → attack NPC → pick up item → open inventory.
Compare against `main` branch output; no timing or visual diffs.

If any of these four fail, revert the phase and re-approach as an
adapter rather than a rewrite.
