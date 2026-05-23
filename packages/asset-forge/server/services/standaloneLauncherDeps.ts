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

import fs from "fs-extra";
import os from "os";
import path from "path";

import { validateProject } from "@hyperforge/manifest-schema";

import type { WorldProjectService } from "./WorldProjectService";
import { exportProjectManifest } from "./ProjectManifestExporter";

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
