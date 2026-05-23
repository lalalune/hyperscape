// @vitest-environment node
/**
 * Tests for the real StandaloneLauncher dependencies — Phase 2.2.b of
 * PLAN_AAA_UE5_PARITY.
 *
 * Phase 2.2.b.1 ships `createExportManifestToDisk`.
 * Phase 2.2.b.2 (this commit) ships `createSpawnGameServer` +
 * `createWaitForReady`.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs-extra";
import http from "http";
import os from "os";
import path from "path";

import {
  _resetStandaloneLauncherSingletonForTests,
  configureStandaloneLauncher,
  createExportManifestToDisk,
  createProductionLauncher,
  createSpawnGameServer,
  createWaitForReady,
  getStandaloneLauncher,
} from "../standaloneLauncherDeps";
import { StandaloneLauncher } from "../StandaloneLauncher";

const FIXED_NOW = 1_716_500_000_000;
const fixedNow = () => FIXED_NOW;

/**
 * Minimal WorldProject row that satisfies `validateProject`. Fields
 * absent from the validated schema (createdAt, updatedAt, lockedBy,
 * etc.) are omitted intentionally — the exporter does not read them.
 */
function validRow(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: "project-test",
    name: "Test Project",
    schemaVersion: 1,
    config: { seed: 42 },
    plugins: ["@hyperforge/hyperscape"],
    assetPacks: ["@hyperforge/content-pack-hyperia-v1"],
    worldContent: {},
    manifestSnapshot: null,
    ...overrides,
  };
}

/** Tiny WorldProjectService stand-in. */
function makeService(rows: Record<string, unknown>): {
  getById: (id: string) => Promise<unknown>;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    getById: async (id) => {
      calls.push(id);
      return (rows[id] as unknown) ?? null;
    },
  };
}

describe("createExportManifestToDisk", () => {
  const tmpDir = path.join(
    os.tmpdir(),
    `hf-launcher-deps-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  let exportFn: ReturnType<typeof createExportManifestToDisk>;

  beforeEach(() => {
    // Each test gets a clean tmp dir so writes don't collide.
  });

  afterEach(async () => {
    await fs.remove(tmpDir).catch(() => undefined);
  });

  it("happy path: writes valid manifest JSON to tmpDir", async () => {
    const service = makeService({
      "project-test": validRow(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportFn = createExportManifestToDisk(service as any, {
      tmpDir,
      now: fixedNow,
    });

    const filePath = await exportFn("project-test");
    expect(filePath).toBe(path.join(tmpDir, `project-test-${FIXED_NOW}.json`));

    // File exists and parses as a FullProjectManifest.
    const raw = await fs.readJson(filePath);
    expect(raw.meta.projectId).toBe("project-test");
    expect(raw.meta.exportedAt).toBe(FIXED_NOW);
    expect(raw.boot.plugins).toEqual(["@hyperforge/hyperscape"]);
    expect(raw.boot.contentPacks).toEqual([
      "@hyperforge/content-pack-hyperia-v1",
    ]);
    expect(raw.worldConfig.terrainSeed).toBe(42);
  });

  it("manifestSnapshot from DB row passes through to registries", async () => {
    const snapshot = {
      items: { version: 1, items: [] },
      dialogue: { version: 1, trees: [] },
    };
    const service = makeService({
      "project-test": validRow({ manifestSnapshot: snapshot }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportFn = createExportManifestToDisk(service as any, {
      tmpDir,
      now: fixedNow,
    });

    const filePath = await exportFn("project-test");
    const raw = await fs.readJson(filePath);
    expect(raw.registries.items).toEqual(snapshot.items);
    expect(raw.registries.dialogue).toEqual(snapshot.dialogue);
  });

  it("missing project → throws with actionable error", async () => {
    const service = makeService({}); // no rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportFn = createExportManifestToDisk(service as any, {
      tmpDir,
      now: fixedNow,
    });

    await expect(exportFn("does-not-exist")).rejects.toThrow(/not found/i);
  });

  it("invalid project shape → throws with localized issue paths", async () => {
    const service = makeService({
      "project-test": validRow({
        name: "", // Project schema requires min(1)
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportFn = createExportManifestToDisk(service as any, {
      tmpDir,
      now: fixedNow,
    });

    await expect(exportFn("project-test")).rejects.toThrow(
      /failed validation.*name/i,
    );
  });

  it("creates the tmpDir if it does not already exist", async () => {
    const subDir = path.join(tmpDir, "deeply", "nested");
    const service = makeService({ "project-test": validRow() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportFn = createExportManifestToDisk(service as any, {
      tmpDir: subDir,
      now: fixedNow,
    });

    const filePath = await exportFn("project-test");
    expect(await fs.pathExists(filePath)).toBe(true);
  });

  it("each call produces a unique filename when now advances", async () => {
    const service = makeService({ "project-test": validRow() });
    let counter = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportFn = createExportManifestToDisk(service as any, {
      tmpDir,
      now: () => 100 + counter++,
    });

    const first = await exportFn("project-test");
    const second = await exportFn("project-test");
    expect(first).not.toBe(second);
    expect(await fs.pathExists(first)).toBe(true);
    expect(await fs.pathExists(second)).toBe(true);
  });

  it("queries the DB once per call", async () => {
    const service = makeService({ "project-test": validRow() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportFn = createExportManifestToDisk(service as any, {
      tmpDir,
      now: fixedNow,
    });

    await exportFn("project-test");
    expect(service.calls).toEqual(["project-test"]);
  });

  describe("seed coercion (real project row shapes)", () => {
    it("uses top-level config.seed when present (canonical shape)", async () => {
      const service = makeService({
        "project-test": validRow({ config: { seed: 42 } }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportFn = createExportManifestToDisk(service as any, {
        tmpDir,
        now: fixedNow,
      });

      const filePath = await exportFn("project-test");
      const raw = await fs.readJson(filePath);
      expect(raw.worldConfig.terrainSeed).toBe(42);
    });

    it("falls back to config.terrain.seed (legacy pre-D1 nesting)", async () => {
      const service = makeService({
        "project-test": validRow({
          config: { terrain: { seed: 7 } } as Record<string, unknown>,
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportFn = createExportManifestToDisk(service as any, {
        tmpDir,
        now: fixedNow,
      });

      const filePath = await exportFn("project-test");
      const raw = await fs.readJson(filePath);
      expect(raw.worldConfig.terrainSeed).toBe(7);
    });

    it("derives a deterministic seed from project id when missing entirely", async () => {
      // Real-world failure mode that originally surfaced this fix: the
      // project row has no `seed` anywhere in config. Strict
      // ProjectConfigSchema would reject; the exporter now derives one.
      const service = makeService({
        "project-test": validRow({ config: {} }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportFn = createExportManifestToDisk(service as any, {
        tmpDir,
        now: fixedNow,
      });

      const filePath = await exportFn("project-test");
      const raw = await fs.readJson(filePath);
      expect(typeof raw.worldConfig.terrainSeed).toBe("number");
      expect(raw.worldConfig.terrainSeed).toBeGreaterThanOrEqual(0);
    });

    it("derived seed is stable across calls for the same project id", async () => {
      const service = makeService({
        "project-test": validRow({ config: {} }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportFn = createExportManifestToDisk(service as any, {
        tmpDir,
        now: () => 1,
      });
      const firstPath = await exportFn("project-test");
      const first = (await fs.readJson(firstPath)).worldConfig.terrainSeed;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportFn = createExportManifestToDisk(service as any, {
        tmpDir,
        now: () => 2,
      });
      const secondPath = await exportFn("project-test");
      const second = (await fs.readJson(secondPath)).worldConfig.terrainSeed;

      expect(first).toBe(second);
    });

    it("derived seeds differ across different project ids", async () => {
      const service = makeService({
        "project-a": validRow({ id: "project-a", config: {} }),
        "project-b": validRow({ id: "project-b", config: {} }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportFn = createExportManifestToDisk(service as any, {
        tmpDir,
        now: fixedNow,
      });

      const aPath = await exportFn("project-a");
      const bPath = await exportFn("project-b");
      const a = (await fs.readJson(aPath)).worldConfig.terrainSeed;
      const b = (await fs.readJson(bPath)).worldConfig.terrainSeed;
      expect(a).not.toBe(b);
    });
  });
});

describe("createSpawnGameServer", () => {
  const tmpDir = path.join(
    os.tmpdir(),
    `hf-spawn-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  afterEach(async () => {
    await fs.remove(tmpDir).catch(() => undefined);
  });

  it("throws actionable error when server entry does not exist", async () => {
    const spawn = createSpawnGameServer({
      serverEntry: path.join(tmpDir, "missing/dist/index.js"),
    });
    await expect(
      spawn({ manifestPath: "/tmp/x.json", ephemeral: true }),
    ).rejects.toThrow(/not found.*build:server/i);
  });

  it("spawns a real child process and resolves SpawnedChild with PID", async () => {
    // Build a tiny stand-in for the server entry — it just keeps the
    // process alive briefly. Bun runs JS directly so no transpile step
    // is needed. The launcher only cares about: PID is set, exited
    // promise resolves on exit, kill() works.
    await fs.ensureDir(tmpDir);
    const stubEntry = path.join(tmpDir, "stub-server.js");
    await fs.writeFile(
      stubEntry,
      // Stay alive for up to 10s; exit early on SIGTERM. argv check
      // mirrors what the real server does so we can prove flags
      // arrive correctly.
      `const args = process.argv.slice(2);
       console.log(JSON.stringify({ args }));
       process.on("SIGTERM", () => process.exit(0));
       setTimeout(() => process.exit(0), 10000);
      `,
      "utf8",
    );

    const stdoutLines: string[] = [];
    const spawn = createSpawnGameServer({
      serverEntry: stubEntry,
      onLog: (level, line) => {
        if (level === "stdout") stdoutLines.push(line);
      },
    });

    const child = await spawn({
      manifestPath: "/tmp/manifest.json",
      ephemeral: true,
    });

    expect(child.pid).toBeGreaterThan(0);

    // Wait briefly for the stub to print its argv, then kill.
    await new Promise((r) => setTimeout(r, 200));
    child.kill("SIGTERM");
    await child.exited;

    // Stub logged its argv — proves --projectManifest + --ephemeral
    // reached the child.
    const argvLine = stdoutLines.find((l) => l.includes("args"));
    expect(argvLine).toBeDefined();
    if (argvLine) {
      const parsed = JSON.parse(argvLine);
      expect(parsed.args).toContain("--projectManifest");
      expect(parsed.args).toContain("/tmp/manifest.json");
      expect(parsed.args).toContain("--ephemeral");
    }
  }, 15_000);

  it("omits --ephemeral when ephemeral=false", async () => {
    await fs.ensureDir(tmpDir);
    const stubEntry = path.join(tmpDir, "stub-server-2.js");
    await fs.writeFile(
      stubEntry,
      `console.log(JSON.stringify({ args: process.argv.slice(2) }));
       process.exit(0);
      `,
      "utf8",
    );

    const stdoutLines: string[] = [];
    const spawn = createSpawnGameServer({
      serverEntry: stubEntry,
      onLog: (level, line) => {
        if (level === "stdout") stdoutLines.push(line);
      },
    });
    const child = await spawn({
      manifestPath: "/tmp/m.json",
      ephemeral: false,
    });
    await child.exited;

    const argvLine = stdoutLines.find((l) => l.includes("args"));
    if (argvLine) {
      const parsed = JSON.parse(argvLine);
      expect(parsed.args).not.toContain("--ephemeral");
    }
  }, 15_000);
});

describe("createWaitForReady", () => {
  let server: http.Server | null = null;
  let port = 0;

  beforeEach(() => {
    server = null;
    port = 0;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  /**
   * Spin up a tiny HTTP server on an ephemeral port. `responder` decides
   * the status code (and may be flipped mid-test to simulate "not ready
   * → ready" transitions).
   */
  function startServer(responder: () => number): Promise<void> {
    server = http.createServer((_req, res) => {
      res.writeHead(responder());
      res.end();
    });
    return new Promise((resolve) => {
      server!.listen(0, "127.0.0.1", () => {
        const addr = server!.address();
        if (addr && typeof addr === "object") {
          port = addr.port;
        }
        resolve();
      });
    });
  }

  it("returns true when /health responds 200", async () => {
    await startServer(() => 200);
    const waitForReady = createWaitForReady({ intervalMs: 25 });
    const ready = await waitForReady(port, 2_000);
    expect(ready).toBe(true);
  });

  it("returns false on timeout when port is closed", async () => {
    const waitForReady = createWaitForReady({ intervalMs: 25 });
    // Pick an unused port — connect should refuse.
    const ready = await waitForReady(1, 250);
    expect(ready).toBe(false);
  });

  it("flips to true once the server starts responding", async () => {
    let healthy = false;
    await startServer(() => (healthy ? 200 : 503));
    const waitForReady = createWaitForReady({ intervalMs: 25 });
    // Flip healthy after a short delay so the first few polls return 503.
    setTimeout(() => {
      healthy = true;
    }, 75);
    const ready = await waitForReady(port, 2_000);
    expect(ready).toBe(true);
  });

  it("returns false when server keeps returning 5xx past the deadline", async () => {
    await startServer(() => 503);
    const waitForReady = createWaitForReady({ intervalMs: 25 });
    const ready = await waitForReady(port, 200);
    expect(ready).toBe(false);
  });
});

describe("createProductionLauncher + singleton", () => {
  const tmpDir = path.join(
    os.tmpdir(),
    `hf-prod-launcher-test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
  );

  beforeEach(() => {
    _resetStandaloneLauncherSingletonForTests();
  });

  afterEach(async () => {
    _resetStandaloneLauncherSingletonForTests();
    await fs.remove(tmpDir).catch(() => undefined);
  });

  it("createProductionLauncher returns a StandaloneLauncher in idle state", () => {
    const service = { getById: async () => null };
    const launcher = createProductionLauncher(service, {
      manifestTmpDir: tmpDir,
    });
    expect(launcher).toBeInstanceOf(StandaloneLauncher);
    expect(launcher.status()).toEqual({ kind: "idle" });
  });

  it("getStandaloneLauncher returns the same instance across calls", () => {
    const service = { getById: async () => null };
    configureStandaloneLauncher({ manifestTmpDir: tmpDir });
    const a = getStandaloneLauncher(service);
    const b = getStandaloneLauncher(service);
    expect(a).toBe(b);
  });

  it("configureStandaloneLauncher discards the prior singleton", () => {
    const service = { getById: async () => null };
    const a = getStandaloneLauncher(service);
    configureStandaloneLauncher({ manifestTmpDir: tmpDir });
    const b = getStandaloneLauncher(service);
    expect(a).not.toBe(b);
  });

  it("_resetStandaloneLauncherSingletonForTests forces a rebuild", () => {
    const service = { getById: async () => null };
    const a = getStandaloneLauncher(service);
    _resetStandaloneLauncherSingletonForTests();
    const b = getStandaloneLauncher(service);
    expect(a).not.toBe(b);
  });

  it("launcher built end-to-end can return its idle state without throwing", async () => {
    // Smoke: every dep wires up without crashing on a "no-op" usage.
    // start() is NOT called here — that requires a real bun + dist
    // path, which isn't this test's concern (handled by 2.2.b.1+2's
    // unit tests).
    const service = { getById: async () => null };
    const launcher = createProductionLauncher(service, {
      manifestTmpDir: tmpDir,
    });
    expect(launcher.status()).toEqual({ kind: "idle" });
  });
});
