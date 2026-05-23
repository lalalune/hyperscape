/**
 * Project manifest loader tests — Phase 0.2 of PLAN_AAA_UE5_PARITY.
 *
 * Two surfaces:
 *   1. `parseProjectManifestFlag` — CLI arg parser, pure
 *   2. `loadProjectManifestFromDisk` — IO + validation, fs-backed
 *
 * The IO tests use a temp dir so they don't depend on real fixtures
 * landing at a known path. Each test cleans up after itself.
 */

import { afterEach, describe, expect, it } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";

import {
  EPHEMERAL_FLAG,
  loadProjectManifestFromDisk,
  parseEphemeralFlag,
  parseProjectManifestFlag,
  PROJECT_MANIFEST_FLAG,
} from "../projectManifest.js";

describe("parseProjectManifestFlag", () => {
  it("returns undefined when the flag is absent", () => {
    expect(parseProjectManifestFlag([])).toBeUndefined();
    expect(
      parseProjectManifestFlag(["node", "server.js", "--port=5555"]),
    ).toBeUndefined();
  });

  it("parses the space-separated form: --projectManifest /path", () => {
    const result = parseProjectManifestFlag([
      "node",
      "server.js",
      PROJECT_MANIFEST_FLAG,
      "/tmp/manifest.json",
      "--port",
      "5555",
    ]);
    expect(result).toBe("/tmp/manifest.json");
  });

  it("parses the equals form: --projectManifest=/path", () => {
    const result = parseProjectManifestFlag([
      "node",
      "server.js",
      `${PROJECT_MANIFEST_FLAG}=/tmp/manifest.json`,
    ]);
    expect(result).toBe("/tmp/manifest.json");
  });

  it("treats --projectManifest with no value as absent", () => {
    // Without a value, we MUST NOT consume the next flag's name as
    // the path — would silently swallow --port etc.
    const result = parseProjectManifestFlag([
      "node",
      "server.js",
      PROJECT_MANIFEST_FLAG,
      "--port",
      "5555",
    ]);
    expect(result).toBeUndefined();
  });

  it("treats --projectManifest= as absent (empty value)", () => {
    const result = parseProjectManifestFlag([
      "node",
      "server.js",
      `${PROJECT_MANIFEST_FLAG}=`,
    ]);
    expect(result).toBeUndefined();
  });
});

describe("parseEphemeralFlag", () => {
  it("returns false when the flag is absent", () => {
    expect(parseEphemeralFlag([])).toBe(false);
    expect(parseEphemeralFlag(["node", "server.js", "--port=5555"])).toBe(
      false,
    );
  });

  it("returns true when bare --ephemeral is present", () => {
    expect(parseEphemeralFlag(["node", "server.js", EPHEMERAL_FLAG])).toBe(
      true,
    );
  });

  it("returns true for --ephemeral=true", () => {
    expect(
      parseEphemeralFlag(["node", "server.js", `${EPHEMERAL_FLAG}=true`]),
    ).toBe(true);
  });

  it("returns false for --ephemeral=false (explicit opt-out)", () => {
    expect(
      parseEphemeralFlag(["node", "server.js", `${EPHEMERAL_FLAG}=false`]),
    ).toBe(false);
  });

  it("position-independent in the argv list", () => {
    expect(
      parseEphemeralFlag([
        EPHEMERAL_FLAG,
        "node",
        "server.js",
        `${PROJECT_MANIFEST_FLAG}=/tmp/m.json`,
      ]),
    ).toBe(true);
  });
});

describe("loadProjectManifestFromDisk", () => {
  const tmpDir = path.join(os.tmpdir(), `hf-pm-test-${Date.now()}`);

  afterEach(async () => {
    await fs.remove(tmpDir).catch(() => undefined);
  });

  function validManifest(): unknown {
    return {
      meta: {
        projectId: "project-test",
        projectName: "Test",
        schemaVersion: 1,
        exportedAt: 1_716_500_000_000,
      },
      boot: {
        plugins: [],
        contentPacks: [],
        assetPacks: [],
      },
      worldConfig: {},
      content: {},
      registries: {},
    };
  }

  it("loads + validates a well-formed manifest", async () => {
    await fs.ensureDir(tmpDir);
    const target = path.join(tmpDir, "manifest.json");
    await fs.writeJson(target, validManifest());

    const result = await loadProjectManifestFromDisk(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.meta.projectId).toBe("project-test");
      expect(result.source).toBe(target);
    }
  });

  it("returns not-found when the file does not exist", async () => {
    const result = await loadProjectManifestFromDisk(
      "/definitely/not/a/real/path.json",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not-found");
      expect(result.source).toBe("/definitely/not/a/real/path.json");
      expect(result.message).toContain("Could not read");
    }
  });

  it("returns parse-error for malformed JSON", async () => {
    await fs.ensureDir(tmpDir);
    const target = path.join(tmpDir, "broken.json");
    await fs.writeFile(target, "{not valid json", "utf8");

    const result = await loadProjectManifestFromDisk(target);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("parse-error");
      expect(result.message).toContain("not valid JSON");
    }
  });

  it("returns validation-error with issues for a wrong shape", async () => {
    await fs.ensureDir(tmpDir);
    const target = path.join(tmpDir, "wrong-shape.json");
    const bad = validManifest() as Record<string, unknown>;
    // Drop a required field. Validator should localize the failure.
    delete (bad.meta as { projectId?: string }).projectId;
    await fs.writeJson(target, bad);

    const result = await loadProjectManifestFromDisk(target);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("validation-error");
      expect(result.issues).toBeDefined();
      const paths = (result.issues ?? []).map((i) => i.path);
      expect(paths).toContain("meta.projectId");
    }
  });
});
