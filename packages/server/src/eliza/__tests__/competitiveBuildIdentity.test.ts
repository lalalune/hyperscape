import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  COMPETITIVE_BUILD_MANIFEST_VERSION,
  computeCompetitiveBuildId,
  resolveCompetitiveExecutableBuildId,
} from "../competitiveBuildIdentity.js";

const temporaryDirectories: string[] = [];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildFixture() {
  const repository = mkdtempSync(resolve(tmpdir(), "hyperia-build-identity-"));
  temporaryDirectories.push(repository);
  const dist = resolve(repository, "packages/server/dist");
  mkdirSync(dist, { recursive: true });
  const serverBundle = resolve(dist, "index.js");
  const workerBundle = resolve(dist, "agentBehaviorWorker.js");
  const lockfile = resolve(repository, "bun.lock");
  writeFileSync(serverBundle, "server executable bytes");
  writeFileSync(workerBundle, "worker executable bytes");
  writeFileSync(lockfile, "dependency lock bytes");
  const digests = {
    serverBundleSha256: sha256("server executable bytes"),
    behaviorWorkerSha256: sha256("worker executable bytes"),
    dependencyLockSha256: sha256("dependency lock bytes"),
  };
  const manifest = {
    schemaVersion: COMPETITIVE_BUILD_MANIFEST_VERSION,
    algorithm: "sha256",
    buildId: computeCompetitiveBuildId(digests),
    ...digests,
  };
  writeFileSync(
    resolve(dirname(serverBundle), "competitive-build.json"),
    JSON.stringify(manifest),
  );
  return { serverBundle, workerBundle, manifest };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("competitive executable build identity", () => {
  it("verifies the exact server, worker, and dependency-lock artifacts", () => {
    const fixture = buildFixture();
    expect(
      resolveCompetitiveExecutableBuildId({
        moduleUrl: pathToFileURL(fixture.serverBundle).href,
        nodeEnv: "production",
      }),
    ).toBe(fixture.manifest.buildId);
  });

  it("fails closed when any executable artifact changes", () => {
    const fixture = buildFixture();
    writeFileSync(fixture.workerBundle, "changed worker executable bytes");
    expect(() =>
      resolveCompetitiveExecutableBuildId({
        moduleUrl: pathToFileURL(fixture.serverBundle).href,
        nodeEnv: "production",
      }),
    ).toThrow(/artifact does not match/);
  });

  it("requires the generated manifest for production source execution", () => {
    expect(() =>
      resolveCompetitiveExecutableBuildId({
        moduleUrl: import.meta.url,
        nodeEnv: "production",
        fileExists: () => false,
      }),
    ).toThrow(/required in production/);
  });

  it("uses an explicit non-production identity for source-mode tests", () => {
    const first = resolveCompetitiveExecutableBuildId({
      moduleUrl: import.meta.url,
      nodeEnv: "test",
      fileExists: () => false,
    });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(
      resolveCompetitiveExecutableBuildId({
        moduleUrl: import.meta.url,
        nodeEnv: "test",
        fileExists: () => false,
      }),
    );
  });

  it("rejects extra manifest fields and a forged build ID", () => {
    const fixture = buildFixture();
    const manifestPath = resolve(
      dirname(fixture.serverBundle),
      "competitive-build.json",
    );
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...fixture.manifest, secret: "unexpected" }),
    );
    expect(() =>
      resolveCompetitiveExecutableBuildId({
        moduleUrl: pathToFileURL(fixture.serverBundle).href,
        nodeEnv: "production",
      }),
    ).toThrow(/shape is invalid/);

    writeFileSync(
      manifestPath,
      JSON.stringify({ ...fixture.manifest, buildId: "00".repeat(32) }),
    );
    expect(() =>
      resolveCompetitiveExecutableBuildId({
        moduleUrl: pathToFileURL(fixture.serverBundle).href,
        nodeEnv: "production",
      }),
    ).toThrow(/identity does not match/);
  });
});
