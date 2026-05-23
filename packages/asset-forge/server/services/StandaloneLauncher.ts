/**
 * StandaloneLauncher — manages an editor-launched Standalone game session.
 *
 * UE5-aligned: spawns the real game server as a SEPARATE process, hands
 * off the project manifest via disk, polls the server's health endpoint
 * until ready, then returns a URL the editor opens in a new window.
 * Cleanup on stop SIGTERMs the child (SIGKILL fallback after timeout).
 *
 * Phase 2.2.a of PLAN_AAA_UE5_PARITY ships the state machine + status
 * lifecycle. Phase 2.2.b wires the actual `child_process.spawn` + real
 * health polling + real manifest export. Phase 2.2.c adds the API
 * routes the editor consumes.
 *
 * Single-instance for MVP (D1=A in the plan): only one Standalone
 * session at a time, fixed ports 5555/5556. Multi-session lands in
 * Phase 4 once the client supports runtime config.
 *
 * Decoupling rules (PLAN_AAA_UE5_PARITY):
 *   - Disk handoff only — the launcher writes a manifest to disk and
 *     points the child at it; no live state push.
 *   - Game runtime is editor-unaware — the child is just a normal
 *     server process with extra CLI flags.
 *   - Process isolation — editor crash doesn't kill the Standalone
 *     (no parent-child kill propagation; the child gets a clean stdio
 *     and runs independently).
 */

/**
 * Tagged state union. Each state carries only the data relevant to it.
 * Pattern matches the FullProjectManifest validator result shape so
 * consumers can discriminate exhaustively.
 */
export type LauncherState =
  | { kind: "idle" }
  | { kind: "starting"; projectId: string; startedAt: number }
  | {
      kind: "ready";
      projectId: string;
      pid: number;
      port: number;
      url: string;
      startedAt: number;
      readyAt: number;
    }
  | { kind: "stopping"; projectId: string; pid: number; stoppedAt: number }
  | {
      kind: "error";
      projectId?: string;
      message: string;
      at: number;
    };

/**
 * Spawned child handle the launcher manages. Test fakes implement this
 * interface to drive the state machine without an actual subprocess.
 */
export interface SpawnedChild {
  readonly pid: number;
  /** Resolves when the child process exits. */
  readonly exited: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;
  /** Send a signal to the child. Returns true if the signal was sent. */
  kill(signal: "SIGTERM" | "SIGKILL"): boolean;
}

/**
 * Injectable dependencies — the bits that touch IO / processes / time.
 * Phase 2.2.b ships the real implementations of these; tests pass fakes.
 */
export interface LauncherDeps {
  /**
   * Export the project's manifest to disk and return the absolute path
   * the spawned child should read it from. Phase 2.2.b wires this to
   * ProjectManifestExporter (Phase 0.1.2) + fs.writeJson. Throws if
   * the project doesn't exist or fails validation.
   */
  exportManifestToDisk(projectId: string): Promise<string>;

  /**
   * Spawn the game server child process pointed at the manifest file.
   * Phase 2.2.b wires this to `child_process.spawn` against
   * `packages/server/dist/index.js --projectManifest <path> --ephemeral`.
   */
  spawnGameServer(args: {
    manifestPath: string;
    ephemeral: boolean;
  }): Promise<SpawnedChild>;

  /**
   * Poll the server's health endpoint until it returns 200 or the
   * timeout elapses. Returns true on success, false on timeout.
   */
  waitForReady(port: number, timeoutMs: number): Promise<boolean>;

  /**
   * Phase 2.3.1 — Ensure the Vite client dev server is up before Launch
   * transitions to "ready" (without it, clicking Open opens a dead tab).
   * Probes the client port; if already responding, returns null (don't
   * touch a server the user started). If not responding, spawns
   * `bun run dev` in packages/client/, waits for the port to respond,
   * and returns the SpawnedChild handle so stop() can kill it.
   *
   * Optional — when undefined, the launcher skips this step (tests +
   * environments where the client is externally managed).
   */
  ensureClientRunning?(timeoutMs: number): Promise<SpawnedChild | null>;

  /** Logger seam — defaults to console.* */
  logger?: (level: "info" | "warn" | "error", msg: string) => void;

  /** Time seam for deterministic tests. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Configuration knobs. Sensible defaults so the typical
 * `new StandaloneLauncher(deps)` works without options.
 */
export interface LauncherOptions {
  /**
   * Game server HTTP port. Fixed at 5555 in MVP — matches what the
   * real client at `localhost:3333` expects via `PUBLIC_API_URL`.
   * Phase 4 (multi-session) introduces dynamic port allocation.
   */
  port?: number;
  /** Open-in-browser URL. Matches the dev client at localhost:3333. */
  clientUrl?: string;
  /** Health-poll timeout. Default 30s — typical cold-boot fits inside. */
  readyTimeoutMs?: number;
  /** SIGTERM grace period before SIGKILL on stop(). Default 5s. */
  shutdownGraceMs?: number;
}

const DEFAULT_PORT = 5555;
const DEFAULT_CLIENT_URL = "http://localhost:3333";
// 90s ready timeout — empirically the Hyperia server's cold boot
// stalls the event loop for ~22s during plugin onEnable + world
// init (mob spawners, town generation, etc.) before the HTTP
// listener binds. 30s was too tight even on a fast machine.
const DEFAULT_READY_TIMEOUT_MS = 90_000;
const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;

export class StandaloneLauncher {
  private _state: LauncherState = { kind: "idle" };
  private _child: SpawnedChild | null = null;
  /**
   * Phase 2.3.1 — Vite client dev server we spawned (null if the user
   * had it running already, or if ensureClientRunning isn't wired).
   * Killed in stop().
   */
  private _clientChild: SpawnedChild | null = null;
  private _watchAbort: AbortController | null = null;
  private readonly _deps: Required<Pick<LauncherDeps, "logger" | "now">> &
    LauncherDeps;
  private readonly _opts: Required<LauncherOptions>;

  constructor(deps: LauncherDeps, opts: LauncherOptions = {}) {
    this._deps = {
      logger: deps.logger ?? defaultLogger,
      now: deps.now ?? Date.now,
      exportManifestToDisk: deps.exportManifestToDisk,
      spawnGameServer: deps.spawnGameServer,
      waitForReady: deps.waitForReady,
    };
    this._opts = {
      port: opts.port ?? DEFAULT_PORT,
      clientUrl: opts.clientUrl ?? DEFAULT_CLIENT_URL,
      readyTimeoutMs: opts.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS,
      shutdownGraceMs: opts.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS,
    };
  }

  /** Snapshot of the current state. Safe to call from any state. */
  status(): LauncherState {
    return this._state;
  }

  /**
   * Boot a Standalone session for the given project.
   *
   * Idempotent in the "already running for this project" sense — if a
   * session is already ready for the same projectId, returns the
   * existing state. If a different project is running, returns an
   * error state without restarting; the caller must `stop()` first.
   */
  async start(projectId: string): Promise<LauncherState> {
    if (this._state.kind === "ready" && this._state.projectId === projectId) {
      return this._state;
    }
    if (this._state.kind !== "idle" && this._state.kind !== "error") {
      return this._setState({
        kind: "error",
        projectId,
        message:
          `Cannot start: launcher is busy (current state: ${this._state.kind}). ` +
          `Call stop() first.`,
        at: this._deps.now(),
      });
    }

    const startedAt = this._deps.now();
    this._setState({ kind: "starting", projectId, startedAt });

    let manifestPath: string;
    try {
      manifestPath = await this._deps.exportManifestToDisk(projectId);
    } catch (err) {
      return this._setState({
        kind: "error",
        projectId,
        message: `Manifest export failed: ${errMsg(err)}`,
        at: this._deps.now(),
      });
    }

    let child: SpawnedChild;
    try {
      child = await this._deps.spawnGameServer({
        manifestPath,
        ephemeral: true,
      });
    } catch (err) {
      return this._setState({
        kind: "error",
        projectId,
        message: `Spawn failed: ${errMsg(err)}`,
        at: this._deps.now(),
      });
    }
    this._child = child;

    // Watch for unexpected child exit. If the child dies before
    // waitForReady resolves, we transition to error. After ready, the
    // same handler downgrades to "exited" state.
    this._watchAbort = new AbortController();
    this._watchChildExit(projectId, child, this._watchAbort.signal);

    // Kick off readiness checks in the background and return "starting"
    // immediately. The HTTP route can respond in <1s instead of
    // blocking the connection for up to readyTimeoutMs — the client
    // polls /status to pick up the eventual ready/error transition.
    // Mirrors UE5's launch UX: button flips to "Booting…" right away,
    // not after the server is fully up.
    //
    // Phase 2.3.1 — also ensure the Vite client dev server is up in
    // parallel with the game server, so clicking Open lands on a live
    // tab without the user manually starting a second terminal.
    void this._readyChain(projectId, child, startedAt).catch((err) => {
      this._deps.logger(
        "error",
        `[StandaloneLauncher] ready chain threw: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    return this._state;
  }

  /**
   * Background chain that resolves both the Vite client server's
   * readiness and the game server's `/health` check, then transitions
   * the state machine to `ready` (or `error` on either failure).
   * Runs in parallel so the two boots overlap.
   */
  private async _readyChain(
    projectId: string,
    gameChild: SpawnedChild,
    startedAt: number,
  ): Promise<void> {
    const clientPromise = this._deps.ensureClientRunning
      ? this._deps
          .ensureClientRunning(this._opts.readyTimeoutMs)
          .then((child) => ({ ok: true as const, child }))
          .catch((err) => ({ ok: false as const, err }))
      : Promise.resolve({ ok: true as const, child: null });

    const gamePromise = this._deps.waitForReady(
      this._opts.port,
      this._opts.readyTimeoutMs,
    );

    const [clientResult, gameReady] = await Promise.all([
      clientPromise,
      gamePromise,
    ]);

    // Bail if a stop() or unexpected child exit already moved us out
    // of "starting" while we were waiting.
    if (this._state.kind !== "starting") return;

    if (!clientResult.ok) {
      gameChild.kill("SIGTERM");
      this._child = null;
      this._setState({
        kind: "error",
        projectId,
        message: `Client dev server failed to start: ${
          clientResult.err instanceof Error
            ? clientResult.err.message
            : String(clientResult.err)
        }`,
        at: this._deps.now(),
      });
      return;
    }
    this._clientChild = clientResult.child;

    if (!gameReady) {
      // Health-check timeout — kill the child so we don't leak
      // processes, then flip to error.
      gameChild.kill("SIGTERM");
      this._clientChild?.kill("SIGTERM");
      this._child = null;
      this._clientChild = null;
      this._setState({
        kind: "error",
        projectId,
        message: `Server did not become healthy within ${this._opts.readyTimeoutMs}ms`,
        at: this._deps.now(),
      });
      return;
    }

    this._setState({
      kind: "ready",
      projectId,
      pid: gameChild.pid,
      port: this._opts.port,
      url: this._opts.clientUrl,
      startedAt,
      readyAt: this._deps.now(),
    });
  }

  /**
   * Tear down the running Standalone session. SIGTERMs the child, waits
   * up to `shutdownGraceMs`, then SIGKILLs if still alive. Always ends
   * in `idle` regardless of which state we started from.
   */
  async stop(): Promise<LauncherState> {
    const child = this._child;
    if (!child || this._state.kind === "idle") {
      this._child = null;
      this._watchAbort?.abort();
      this._watchAbort = null;
      return this._setState({ kind: "idle" });
    }

    const projectId =
      "projectId" in this._state && typeof this._state.projectId === "string"
        ? this._state.projectId
        : "(unknown)";
    this._setState({
      kind: "stopping",
      projectId,
      pid: child.pid,
      stoppedAt: this._deps.now(),
    });

    // Stop watching first so the SIGTERM-driven exit doesn't flip us
    // to error — this is an intentional shutdown.
    this._watchAbort?.abort();
    this._watchAbort = null;

    child.kill("SIGTERM");
    // Phase 2.3.1 — also tear down the client dev server child if the
    // launcher spawned it. Null when the user had Vite running
    // externally; in that case we leave it alone.
    const clientChild = this._clientChild;
    clientChild?.kill("SIGTERM");

    const exited = await Promise.race([
      child.exited,
      sleep(this._opts.shutdownGraceMs).then(() => null),
    ]);
    if (exited === null) {
      // Grace expired — force kill.
      this._deps.logger(
        "warn",
        `[StandaloneLauncher] Child PID ${child.pid} did not exit within ${this._opts.shutdownGraceMs}ms; SIGKILL`,
      );
      child.kill("SIGKILL");
      await child.exited.catch(() => undefined);
    }

    if (clientChild) {
      // Best-effort — don't block stop on the Vite child since it
      // sometimes lingers on uncaught file watcher events. SIGKILL
      // after grace as well.
      const clientExited = await Promise.race([
        clientChild.exited,
        sleep(this._opts.shutdownGraceMs).then(() => null),
      ]);
      if (clientExited === null) {
        clientChild.kill("SIGKILL");
        await clientChild.exited.catch(() => undefined);
      }
    }

    this._child = null;
    this._clientChild = null;
    return this._setState({ kind: "idle" });
  }

  private _setState(next: LauncherState): LauncherState {
    this._state = next;
    return next;
  }

  private _watchChildExit(
    projectId: string,
    child: SpawnedChild,
    signal: AbortSignal,
  ): void {
    child.exited
      .then((result) => {
        if (signal.aborted) return;
        // Unexpected exit (not from stop()).
        const code = result.code;
        const sig = result.signal;
        this._child = null;
        this._setState({
          kind: "error",
          projectId,
          message: `Standalone server exited unexpectedly (code=${code}, signal=${sig})`,
          at: this._deps.now(),
        });
      })
      .catch(() => undefined);
  }
}

function defaultLogger(level: "info" | "warn" | "error", msg: string): void {
  switch (level) {
    case "error":
      console.error(msg);
      break;
    case "warn":
      console.warn(msg);
      break;
    default:
      console.log(msg);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
