/**
 * StandaloneLauncher state-machine tests — Phase 2.2.a of
 * PLAN_AAA_UE5_PARITY.
 *
 * Drives the launcher through every state transition using fake
 * dependencies. The fakes let us trigger child exit, health timeout,
 * and manifest export failure deterministically. Phase 2.2.b layers
 * real child_process / fetch on top.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  StandaloneLauncher,
  type LauncherDeps,
  type SpawnedChild,
} from "../StandaloneLauncher";

/**
 * Hand-driven fake child — callers resolve `exited` manually to trigger
 * the launcher's exit watcher.
 */
function makeChild(pid: number): {
  child: SpawnedChild;
  exit: (code: number | null, signal: NodeJS.Signals | null) => void;
  killed: Array<"SIGTERM" | "SIGKILL">;
} {
  let resolveExit:
    | ((r: { code: number | null; signal: NodeJS.Signals | null }) => void)
    | null = null;
  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    resolveExit = resolve;
  });
  const killed: Array<"SIGTERM" | "SIGKILL"> = [];
  const child: SpawnedChild = {
    pid,
    exited,
    kill(signal) {
      killed.push(signal);
      return true;
    },
  };
  return {
    child,
    exit(code, signal) {
      resolveExit?.({ code, signal });
    },
    killed,
  };
}

interface FakeDeps extends LauncherDeps {
  exportCalls: string[];
  spawnCalls: Array<{ manifestPath: string; ephemeral: boolean }>;
  // Inject behavior per-test by overwriting these from the test body.
  exportImpl: (projectId: string) => Promise<string>;
  spawnImpl: (args: {
    manifestPath: string;
    ephemeral: boolean;
  }) => Promise<SpawnedChild>;
  readyImpl: (port: number, timeoutMs: number) => Promise<boolean>;
}

/**
 * Wire a default-happy-path deps object the tests can mutate.
 */
function makeDeps(child: SpawnedChild): FakeDeps {
  const deps: FakeDeps = {
    exportCalls: [],
    spawnCalls: [],
    exportImpl: async (projectId) => `/tmp/manifest-${projectId}.json`,
    spawnImpl: async () => child,
    readyImpl: async () => true,
    now: () => 1_000,
    logger: () => undefined, // silence in tests
    async exportManifestToDisk(projectId) {
      deps.exportCalls.push(projectId);
      return deps.exportImpl(projectId);
    },
    async spawnGameServer(args) {
      deps.spawnCalls.push(args);
      return deps.spawnImpl(args);
    },
    async waitForReady(port, timeoutMs) {
      return deps.readyImpl(port, timeoutMs);
    },
  };
  return deps;
}

describe("StandaloneLauncher — state machine", () => {
  let launcher: StandaloneLauncher;
  let active: ReturnType<typeof makeChild>;
  let deps: FakeDeps;

  beforeEach(() => {
    active = makeChild(12_345);
    deps = makeDeps(active.child);
    launcher = new StandaloneLauncher(deps, { shutdownGraceMs: 50 });
  });

  afterEach(async () => {
    // Best-effort cleanup so a leaked child watcher doesn't unsettle
    // later tests.
    if (launcher.status().kind !== "idle") {
      active.exit(0, null);
      await launcher.stop().catch(() => undefined);
    }
  });

  /**
   * Flush microtasks so the background `waitForReady().then(...)`
   * callback runs. Phase 2 redesign: start() returns "starting"
   * immediately and the ready/error transition happens on the next
   * tick so the HTTP route can respond fast.
   */
  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("starts in idle state", () => {
    expect(launcher.status()).toEqual({ kind: "idle" });
  });

  it("happy path: idle → starting → ready (async transition)", async () => {
    // start() now returns "starting" immediately — waitForReady runs
    // in background so HTTP routes can respond fast.
    const initial = await launcher.start("project-a");
    expect(initial.kind).toBe("starting");
    expect(deps.exportCalls).toEqual(["project-a"]);
    expect(deps.spawnCalls).toEqual([
      { manifestPath: "/tmp/manifest-project-a.json", ephemeral: true },
    ]);

    // Wait one microtask cycle for the background promise to resolve.
    await flushMicrotasks();
    const ready = launcher.status();
    expect(ready.kind).toBe("ready");
    if (ready.kind === "ready") {
      expect(ready.projectId).toBe("project-a");
      expect(ready.pid).toBe(12_345);
      expect(ready.port).toBe(5555);
      expect(ready.url).toBe("http://localhost:3333");
    }
  });

  it("manifest export failure → error state, no spawn attempted", async () => {
    deps.exportImpl = async () => {
      throw new Error("project not found");
    };
    const result = await launcher.start("missing-project");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("project not found");
    }
    expect(deps.spawnCalls).toEqual([]);
  });

  it("spawn failure → error state", async () => {
    deps.spawnImpl = async () => {
      throw new Error("bun binary not found");
    };
    const result = await launcher.start("project-a");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("bun binary not found");
    }
  });

  it("health timeout → SIGTERM + error state", async () => {
    deps.readyImpl = async () => false; // health never returns OK
    const initial = await launcher.start("project-a");
    expect(initial.kind).toBe("starting");
    await flushMicrotasks();
    const final = launcher.status();
    expect(final.kind).toBe("error");
    if (final.kind === "error") {
      expect(final.message).toContain("did not become healthy");
    }
    expect(active.killed).toContain("SIGTERM");
  });

  it("unexpected child exit during starting → error", async () => {
    deps.readyImpl = async () => {
      active.exit(1, null);
      await Promise.resolve();
      return false;
    };
    await launcher.start("project-a");
    await flushMicrotasks();
    expect(launcher.status().kind).toBe("error");
  });

  it("unexpected child exit after ready → flips ready → error", async () => {
    await launcher.start("project-a");
    await flushMicrotasks();
    expect(launcher.status().kind).toBe("ready");
    active.exit(137, "SIGKILL"); // crash post-boot
    await new Promise((r) => setTimeout(r, 5));
    expect(launcher.status().kind).toBe("error");
    const state = launcher.status();
    if (state.kind === "error") {
      expect(state.message).toContain("exited unexpectedly");
    }
  });

  it("idempotent start for same projectId returns existing ready state", async () => {
    await launcher.start("project-a");
    await flushMicrotasks();
    const ready = launcher.status();
    expect(ready.kind).toBe("ready");

    const second = await launcher.start("project-a");
    expect(second).toEqual(ready);
    // No second export / spawn.
    expect(deps.exportCalls).toEqual(["project-a"]);
    expect(deps.spawnCalls).toHaveLength(1);
  });

  it("start with a different project while ready → error (must stop first)", async () => {
    await launcher.start("project-a");
    await flushMicrotasks();
    expect(launcher.status().kind).toBe("ready");

    const result = await launcher.start("project-b");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("busy");
    }
    // Original session unaffected.
    expect(deps.spawnCalls).toHaveLength(1);
  });

  it("stop() → SIGTERM child, transition to idle", async () => {
    await launcher.start("project-a");
    await flushMicrotasks();
    // Resolve child exit so stop's await doesn't hang on shutdown grace.
    const stopPromise = launcher.stop();
    active.exit(0, "SIGTERM");
    const result = await stopPromise;
    expect(result.kind).toBe("idle");
    expect(active.killed[0]).toBe("SIGTERM");
  });

  it("stop() escalates to SIGKILL when child ignores SIGTERM", async () => {
    await launcher.start("project-a");
    await flushMicrotasks();
    // Don't resolve active.exit — simulate hung child. shutdownGraceMs=50
    // in beforeEach so we don't wait long.
    const stopPromise = launcher.stop();
    await new Promise((r) => setTimeout(r, 100));
    active.exit(137, "SIGKILL");
    const result = await stopPromise;
    expect(result.kind).toBe("idle");
    expect(active.killed).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("stop() from idle is a safe no-op", async () => {
    const result = await launcher.stop();
    expect(result.kind).toBe("idle");
  });

  it("can start a new session after error → stop → start", async () => {
    deps.spawnImpl = async () => {
      throw new Error("first spawn fails");
    };
    let result = await launcher.start("project-a");
    expect(result.kind).toBe("error");

    // Recover: switch fake to succeed, start again.
    const second = makeChild(99);
    deps.spawnImpl = async () => second.child;
    result = await launcher.start("project-b");
    expect(result.kind).toBe("starting");
    await flushMicrotasks();
    const ready = launcher.status();
    expect(ready.kind).toBe("ready");
    if (ready.kind === "ready") {
      expect(ready.projectId).toBe("project-b");
      expect(ready.pid).toBe(99);
    }

    // Clean up the recovered session before afterEach.
    const stopPromise = launcher.stop();
    second.exit(0, "SIGTERM");
    await stopPromise;
  });
});
