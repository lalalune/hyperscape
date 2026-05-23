/**
 * Production dependencies for `StandaloneLauncher` — Phase 2.2.b of
 * PLAN_AAA_UE5_PARITY.
 *
 * Phase 2.2.a shipped the launcher's state machine with deps injected
 * (`exportManifestToDisk`, `spawnGameServer`, `waitForReady`). This
 * file ships the real implementations. The launcher is unchanged;
 * tests keep using their fakes.
 *
 * 2.2.b lands in three sub-steps to keep diffs reviewable:
 *   - 2.2.b.1 (this commit): `createExportManifestToDisk`
 *   - 2.2.b.2: `createSpawnGameServer` + `createWaitForReady`
 *   - 2.2.b.3: `createProductionLauncher` factory composing all three
 */

import { spawn as spawnProcess, type ChildProcess } from "child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";

import { validateProject } from "@hyperforge/manifest-schema";

import type { WorldProjectService } from "./WorldProjectService";
import { exportProjectManifest } from "./ProjectManifestExporter";
import {
  StandaloneLauncher,
  type LauncherOptions,
  type SpawnedChild,
} from "./StandaloneLauncher";

/**
 * Factory: build a real `exportManifestToDisk` function that reads a
 * project from the DB, validates it, runs the manifest exporter, and
 * writes the result to a per-launch JSON file under `os.tmpdir()`.
 *
 * Throws with actionable messages on failure (project not found,
 * validation issues, fs errors). The caller (StandaloneLauncher's
 * `start`) catches and transitions to the `error` state with the
 * message surfaced.
 *
 * @param service WorldProjectService instance bound to the DB.
 * @param options `tmpDir` lets tests redirect output without touching
 *   the real `os.tmpdir()`. `now` is a deterministic timestamp seam.
 */
export function createExportManifestToDisk(
  service: Pick<WorldProjectService, "getById">,
  options: {
    tmpDir?: string;
    now?: () => number;
  } = {},
): (projectId: string) => Promise<string> {
  const tmpDirBase =
    options.tmpDir ?? path.join(os.tmpdir(), "hyperforge-standalone");
  const now = options.now ?? Date.now;

  return async function exportManifestToDisk(
    projectId: string,
  ): Promise<string> {
    const row = await service.getById(projectId);
    if (!row) {
      throw new Error(`Project ${projectId} not found`);
    }

    // The DB row is wider than the validated `Project` shape — extract
    // the subset the schema knows about. Description is optional in
    // both; copy through. Schema version pinned to 1 (Project schema
    // is `z.literal(1)` today). manifestSnapshot is opaque registry
    // overrides, separate from the validated project body.
    //
    // Seed coercion: ProjectConfigSchema strictly requires
    // `config.seed: number` at the top level, but real project rows
    // in the wild can have:
    //   - seed at top level (canonical shape — newer projects)
    //   - seed nested under `config.terrain` (legacy pre-D1 procgen)
    //   - no seed at all (blank-canvas projects)
    // Pull from the first available location; otherwise derive a
    // deterministic 32-bit seed from the project id so repeated
    // launches of the same project produce identical terrain even
    // when the row itself never persisted one.
    const rawConfig = (row.config ?? {}) as Record<string, unknown>;
    const terrainBlock = rawConfig.terrain as { seed?: unknown } | undefined;
    const seed =
      typeof rawConfig.seed === "number" && Number.isFinite(rawConfig.seed)
        ? rawConfig.seed
        : typeof terrainBlock?.seed === "number" &&
            Number.isFinite(terrainBlock.seed)
          ? terrainBlock.seed
          : seedFromProjectId(row.id);
    const coercedConfig = { ...rawConfig, seed };

    const candidate = {
      id: row.id,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      schemaVersion: 1 as const,
      ...(row.templateId ? { templateId: row.templateId } : {}),
      config: coercedConfig,
      plugins: row.plugins ?? [],
      assetPacks: row.assetPacks ?? [],
      worldContent: (row.worldContent ?? {}) as Record<string, unknown>,
    };

    const validation = validateProject(candidate);
    if (!validation.ok) {
      const detail = validation.issues
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ");
      throw new Error(`Project ${projectId} failed validation: ${detail}`);
    }

    const manifestSnapshot =
      (row.manifestSnapshot as Record<string, unknown> | null | undefined) ??
      undefined;
    const manifest = exportProjectManifest(
      validation.project,
      manifestSnapshot,
      { now },
    );

    // Per-launch file name so concurrent attempts can't clobber each
    // other if the single-instance invariant ever loosens. Today the
    // launcher rejects concurrent starts, but the path is harmless
    // either way.
    await fs.ensureDir(tmpDirBase);
    const fileName = `${projectId}-${now()}.json`;
    const fullPath = path.join(tmpDirBase, fileName);
    await fs.writeJson(fullPath, manifest, { spaces: 2 });

    return fullPath;
  };
}

/**
 * Factory: build a real `spawnGameServer` function that launches the
 * game server as a detached child process pointed at the project
 * manifest on disk.
 *
 * Command shape:
 *   bun <serverEntry> --projectManifest <path> [--ephemeral]
 *
 * The child is detached + unref'd so an editor crash doesn't take the
 * Standalone process down. stdout/stderr are piped so the launcher can
 * surface logs in its status UI (Phase 2.3). PID is captured for
 * SIGTERM / SIGKILL on stop().
 *
 * Requires the server's built `dist/index.js` to exist by default;
 * dev mode can override `serverEntry` to point at `src/index.ts`
 * (bun runs TS natively).
 */
export interface SpawnGameServerOptions {
  /** Absolute path to the server entry. Default: `packages/server/dist/index.js`. */
  serverEntry?: string;
  /** Runtime to invoke. Default: `bun` (must be on PATH). */
  runtime?: string;
  /** Working directory for the child. Default: process.cwd(). */
  cwd?: string;
  /** Extra env vars merged into the child's process.env. */
  env?: NodeJS.ProcessEnv;
  /** Optional stdout/stderr line sink (newline-delimited). */
  onLog?: (level: "stdout" | "stderr", line: string) => void;
}

export function createSpawnGameServer(
  options: SpawnGameServerOptions = {},
): (args: {
  manifestPath: string;
  ephemeral: boolean;
}) => Promise<SpawnedChild> {
  // Default server entry resolves relative to this file's location at
  // runtime: `<repo>/packages/asset-forge/server/services/…` →
  // `<repo>/packages/server/dist/index.js`. Overridable for tests
  // (which point at a tiny stand-in script) and for dev workflows
  // that want to run TS source directly.
  const serverEntry =
    options.serverEntry ??
    path.resolve(__dirname, "../../../server/dist/index.js");
  const runtime = options.runtime ?? "bun";
  const cwd = options.cwd ?? process.cwd();

  return async function spawnGameServer(args): Promise<SpawnedChild> {
    if (!(await fs.pathExists(serverEntry))) {
      throw new Error(
        `Server entry not found at ${serverEntry}. ` +
          `Build it first with: bun run build:server`,
      );
    }

    const childArgs = [
      serverEntry,
      "--projectManifest",
      args.manifestPath,
      ...(args.ephemeral ? ["--ephemeral"] : []),
    ];

    const child: ChildProcess = spawnProcess(runtime, childArgs, {
      cwd,
      env: { ...process.env, ...options.env },
      // detached + unref so an editor crash doesn't propagate to the
      // game server. The launcher still has the PID for explicit
      // SIGTERM on stop().
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.unref();

    if (!child.pid) {
      throw new Error(
        `Failed to spawn ${runtime} ${serverEntry}: process has no PID (spawn likely failed synchronously)`,
      );
    }

    if (options.onLog) {
      const onLog = options.onLog;
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      bindLineStream(child.stdout, (line) => onLog("stdout", line));
      bindLineStream(child.stderr, (line) => onLog("stderr", line));
    } else {
      // Drain anyway — leaving pipes unread can backpressure the child.
      child.stdout?.on("data", () => undefined);
      child.stderr?.on("data", () => undefined);
    }

    const exited = new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });

    return {
      pid: child.pid,
      exited,
      kill(signal) {
        try {
          return child.kill(signal);
        } catch {
          return false;
        }
      },
    };
  };
}

/**
 * Factory: build a real `waitForReady` function that polls the game
 * server's `/health` endpoint until it returns 200 or the timeout
 * elapses. Uses native `fetch`.
 *
 * `intervalMs` is the gap between attempts; the polling loop respects
 * the abort budget so a successful resolve doesn't keep polling past
 * the timeout in flaky-network conditions.
 */
export interface WaitForReadyOptions {
  intervalMs?: number;
  /** Override the URL builder for tests / custom paths. */
  buildUrl?: (port: number) => string;
}

export function createWaitForReady(
  options: WaitForReadyOptions = {},
): (port: number, timeoutMs: number) => Promise<boolean> {
  const intervalMs = options.intervalMs ?? 250;
  const buildUrl =
    options.buildUrl ?? ((port: number) => `http://127.0.0.1:${port}/health`);

  return async function waitForReady(port, timeoutMs) {
    const url = buildUrl(port);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { method: "GET" });
        if (res.ok) return true;
      } catch {
        // Connection refused / hostname unresolved / etc. — server
        // not up yet. Swallow and retry until deadline.
      }
      await sleep(intervalMs);
    }
    return false;
  };
}

function bindLineStream(
  stream: NodeJS.ReadableStream | null | undefined,
  onLine: (line: string) => void,
): void {
  if (!stream) return;
  let buffer = "";
  stream.on("data", (chunk: string | Buffer) => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.length > 0) onLine(line);
    }
  });
  stream.on("end", () => {
    if (buffer.length > 0) onLine(buffer);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deterministic 32-bit seed from a project id (UUID string). Same id
 * → same seed across launches, so a project's terrain is reproducible
 * even when the row never persisted a `seed` field. Uses a simple
 * FNV-1a hash — good enough for procgen seeding (we only need
 * uniformity across project ids, not cryptographic strength).
 */
function seedFromProjectId(projectId: string): number {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < projectId.length; i++) {
    hash ^= projectId.charCodeAt(i);
    // FNV prime (32-bit), squeezed into JS double via Math.imul to
    // keep the result a stable signed 32-bit value.
    hash = Math.imul(hash, 0x01000193);
  }
  // Return as a non-negative number — procgen seeds typically expect
  // a positive int but accept any finite number.
  return Math.abs(hash | 0);
}

/**
 * Compose the three real deps into a configured StandaloneLauncher
 * pointed at the production game server. The route layer's job is to
 * call this once at boot and share the instance across all
 * `/api/projects/:id/launch-standalone` requests — single-instance
 * for MVP (D1=A in the plan).
 *
 * Pass-through hooks (`onLog`, `tmpDir`, `serverEntry`, …) let
 * deployment-specific concerns (Docker volume for tmp, custom log
 * sinks) be plumbed without surgery on this file.
 */
export interface ProductionLauncherOptions {
  /** Where to write per-launch manifests. Default: os.tmpdir()/hyperforge-standalone. */
  manifestTmpDir?: string;
  /** Server entry override (default: packages/server/dist/index.js). */
  serverEntry?: string;
  /** Runtime override (default: "bun"). */
  runtime?: string;
  /** stdout/stderr line sink for the child. */
  onLog?: (level: "stdout" | "stderr", line: string) => void;
  /** Launcher-level options (port, ready timeout, shutdown grace). */
  launcher?: LauncherOptions;
}

export function createProductionLauncher(
  service: Pick<WorldProjectService, "getById">,
  options: ProductionLauncherOptions = {},
): StandaloneLauncher {
  const exportManifestToDisk = createExportManifestToDisk(service, {
    tmpDir: options.manifestTmpDir,
  });
  const spawnGameServer = createSpawnGameServer({
    serverEntry: options.serverEntry,
    runtime: options.runtime,
    onLog: options.onLog,
  });
  const waitForReady = createWaitForReady();
  return new StandaloneLauncher(
    {
      exportManifestToDisk,
      spawnGameServer,
      waitForReady,
    },
    options.launcher,
  );
}

// ---------------------------------------------------------------------------
// Module-level singleton
//
// Asset-forge boots once per process; the launcher is created lazily on
// first access and reused across every route handler. Tests reset via
// `_resetStandaloneLauncherSingletonForTests()`.
// ---------------------------------------------------------------------------

let _singletonInstance: StandaloneLauncher | null = null;
let _singletonFactory:
  | ((service: Pick<WorldProjectService, "getById">) => StandaloneLauncher)
  | null = null;

/**
 * Configure how the singleton is built. The Elysia plugin (Phase 2.2.c)
 * calls this once at boot with the service + any deployment-specific
 * options. Subsequent `getStandaloneLauncher(service)` calls return
 * the lazily-built instance.
 */
export function configureStandaloneLauncher(
  options: ProductionLauncherOptions = {},
): void {
  _singletonFactory = (service) => createProductionLauncher(service, options);
  _singletonInstance = null; // force rebuild on next access
}

/**
 * Resolve the process-wide launcher singleton. Builds it lazily from
 * whatever `configureStandaloneLauncher` last set (defaults to an
 * empty-options production launcher).
 */
export function getStandaloneLauncher(
  service: Pick<WorldProjectService, "getById">,
): StandaloneLauncher {
  if (!_singletonInstance) {
    const factory = _singletonFactory ?? ((s) => createProductionLauncher(s));
    _singletonInstance = factory(service);
  }
  return _singletonInstance;
}

/** Test seam — discards the singleton so the next access rebuilds. */
export function _resetStandaloneLauncherSingletonForTests(): void {
  _singletonInstance = null;
  _singletonFactory = null;
}
