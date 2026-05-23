/**
 * Project manifest loader — reads a `FullProjectManifest` from disk when
 * the server is launched with `--projectManifest <path>`.
 *
 * The runtime side of the editor → runtime handoff. The editor exports
 * manifests via `ProjectManifestExporter` (asset-forge), writes them to
 * disk, then spawns the game server with this flag. This module:
 *   1. Pulls the path from `process.argv`
 *   2. Reads the file
 *   3. Validates via `@hyperforge/manifest-schema`
 *   4. Returns a tagged ok/fail result so the boot path can fail fast
 *      with an actionable error message
 *
 * Decoupling rule (PLAN_AAA_UE5_PARITY Phase 0):
 *   - The runtime reads only from disk; the editor never pushes live
 *     state to the running server.
 *   - When no manifest is supplied, the server boots empty-shell mode
 *     (Phase 0.2b extends loadConfig to wire this through).
 *
 * Phase 0.2 of PLAN_AAA_UE5_PARITY.
 */

import fs from "fs-extra";

import {
  validateFullProjectManifest,
  type FullProjectManifest,
} from "@hyperforge/manifest-schema";

/**
 * CLI flag the launcher passes when running the server against a
 * specific project manifest. Centralized so both the launcher
 * (asset-forge's `StandaloneLauncher`, Phase 2) and the parser
 * reference the same string.
 */
export const PROJECT_MANIFEST_FLAG = "--projectManifest";

export interface LoadProjectManifestOk {
  ok: true;
  manifest: FullProjectManifest;
  /** Path the manifest was read from. Useful for logs + diagnostics. */
  source: string;
}

export interface LoadProjectManifestErr {
  ok: false;
  source: string;
  reason: "not-found" | "parse-error" | "validation-error";
  message: string;
  /** Populated only when `reason === "validation-error"`. */
  issues?: Array<{ path: string; message: string }>;
}

export type LoadProjectManifestResult =
  | LoadProjectManifestOk
  | LoadProjectManifestErr;

/**
 * Parse `--projectManifest <path>` from a process.argv-shaped array.
 * Returns `undefined` if the flag is absent. Accepts both
 * `--projectManifest /path/to.json` and `--projectManifest=/path/to.json`
 * (the `=` form matches how `bun` forwards CLI args in shell scripts).
 *
 * Exported so tests can drive it with synthetic argv without touching
 * `process.argv`.
 */
export function parseProjectManifestFlag(
  argv: readonly string[],
): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === PROJECT_MANIFEST_FLAG) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) return next;
      // Flag present but no value — treat as absent rather than
      // silently consuming a sibling flag.
      return undefined;
    }
    if (arg.startsWith(`${PROJECT_MANIFEST_FLAG}=`)) {
      const value = arg.slice(PROJECT_MANIFEST_FLAG.length + 1);
      return value || undefined;
    }
  }
  return undefined;
}

/**
 * Read a `FullProjectManifest` from disk and validate. Tagged result
 * lets the boot path fail fast with an actionable error (and a usable
 * exit code) instead of crashing mid-init.
 *
 * Best-effort about IO errors: a missing file or unreadable JSON
 * surfaces as a typed failure, not a thrown exception. Validation
 * failures carry the issue list so the operator can fix the offending
 * field without grepping the source.
 */
export async function loadProjectManifestFromDisk(
  path: string,
): Promise<LoadProjectManifestResult> {
  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch (err) {
    return {
      ok: false,
      source: path,
      reason: "not-found",
      message: `Could not read project manifest at ${path}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      source: path,
      reason: "parse-error",
      message: `Project manifest at ${path} is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const result = validateFullProjectManifest(parsed);
  if (!result.ok) {
    return {
      ok: false,
      source: path,
      reason: "validation-error",
      message: `Project manifest at ${path} failed validation`,
      issues: result.issues,
    };
  }

  return { ok: true, manifest: result.manifest, source: path };
}
