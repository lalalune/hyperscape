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
import type { SpawnedChild } from "./StandaloneLauncher";

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
    const candidate = {
      id: row.id,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      schemaVersion: 1 as const,
      ...(row.templateId ? { templateId: row.templateId } : {}),
      config: (row.config ?? {}) as Record<string, unknown>,
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
