// @vitest-environment node
/**
 * Tests for the real StandaloneLauncher dependencies — Phase 2.2.b of
 * PLAN_AAA_UE5_PARITY.
 *
 * Phase 2.2.b.1 ships `createExportManifestToDisk`. The helper composes
 * three pieces (DB read via WorldProjectService.getById, validation via
 * @hyperforge/manifest-schema, exporter via Phase 0.1.2) into a single
 * IO operation. These tests pin each composition point.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";

import { createExportManifestToDisk } from "../standaloneLauncherDeps";

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
});
