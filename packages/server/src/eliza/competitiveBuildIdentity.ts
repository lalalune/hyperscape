import { createHash } from "node:crypto";
import { existsSync, readFileSync, type PathOrFileDescriptor } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const COMPETITIVE_BUILD_MANIFEST_VERSION = 1 as const;

export type CompetitiveBuildManifest = {
  schemaVersion: typeof COMPETITIVE_BUILD_MANIFEST_VERSION;
  algorithm: "sha256";
  buildId: string;
  serverBundleSha256: string;
  behaviorWorkerSha256: string;
  dependencyLockSha256: string;
};

const SHA256_HEX = /^[0-9a-f]{64}$/;
const MANIFEST_KEYS = [
  "algorithm",
  "behaviorWorkerSha256",
  "buildId",
  "dependencyLockSha256",
  "schemaVersion",
  "serverBundleSha256",
] as const;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeCompetitiveBuildId(input: {
  serverBundleSha256: string;
  behaviorWorkerSha256: string;
  dependencyLockSha256: string;
}): string {
  for (const digest of [
    input.serverBundleSha256,
    input.behaviorWorkerSha256,
    input.dependencyLockSha256,
  ]) {
    if (!SHA256_HEX.test(digest)) {
      throw new Error("competitive build artifact digest is invalid");
    }
  }
  return sha256(
    [
      "hyperia-competitive-build-v1",
      input.serverBundleSha256,
      input.behaviorWorkerSha256,
      input.dependencyLockSha256,
    ].join("\n"),
  );
}

function parseManifest(raw: string): CompetitiveBuildManifest {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("competitive build manifest is not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("competitive build manifest is not an object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== MANIFEST_KEYS.length ||
    keys.some((key, index) => key !== MANIFEST_KEYS[index]) ||
    record.schemaVersion !== COMPETITIVE_BUILD_MANIFEST_VERSION ||
    record.algorithm !== "sha256" ||
    typeof record.buildId !== "string" ||
    typeof record.serverBundleSha256 !== "string" ||
    typeof record.behaviorWorkerSha256 !== "string" ||
    typeof record.dependencyLockSha256 !== "string"
  ) {
    throw new Error("competitive build manifest shape is invalid");
  }
  const manifest = record as CompetitiveBuildManifest;
  if (
    !SHA256_HEX.test(manifest.buildId) ||
    !SHA256_HEX.test(manifest.serverBundleSha256) ||
    !SHA256_HEX.test(manifest.behaviorWorkerSha256) ||
    !SHA256_HEX.test(manifest.dependencyLockSha256)
  ) {
    throw new Error("competitive build manifest digest is invalid");
  }
  return manifest;
}

type ReadFile = {
  (path: PathOrFileDescriptor): Buffer;
  (path: PathOrFileDescriptor, encoding: "utf8"): string;
};

export function resolveCompetitiveExecutableBuildId(input: {
  moduleUrl: string;
  nodeEnv: string | undefined;
  fileExists?: (path: string) => boolean;
  readFile?: ReadFile;
}): string {
  const modulePath = fileURLToPath(input.moduleUrl);
  const buildDirectory = dirname(modulePath);
  const manifestPath = resolve(buildDirectory, "competitive-build.json");
  const fileExists = input.fileExists ?? existsSync;
  const readFile = input.readFile ?? (readFileSync as ReadFile);

  if (!fileExists(manifestPath)) {
    if (input.nodeEnv === "production") {
      throw new Error("competitive build manifest is required in production");
    }
    return sha256(
      `hyperia-unattested-source-build-v1:${input.nodeEnv || "development"}`,
    );
  }

  const manifest = parseManifest(readFile(manifestPath, "utf8"));
  const serverBundlePath = resolve(buildDirectory, "index.js");
  const behaviorWorkerPath = resolve(buildDirectory, "agentBehaviorWorker.js");
  const dependencyLockPath = resolve(buildDirectory, "../../../bun.lock");
  if (resolve(modulePath) !== serverBundlePath) {
    throw new Error(
      "competitive build manifest is not beside the running bundle",
    );
  }

  const actual = {
    serverBundleSha256: sha256(readFile(serverBundlePath)),
    behaviorWorkerSha256: sha256(readFile(behaviorWorkerPath)),
    dependencyLockSha256: sha256(readFile(dependencyLockPath)),
  };
  if (
    actual.serverBundleSha256 !== manifest.serverBundleSha256 ||
    actual.behaviorWorkerSha256 !== manifest.behaviorWorkerSha256 ||
    actual.dependencyLockSha256 !== manifest.dependencyLockSha256
  ) {
    throw new Error("competitive build artifact does not match its manifest");
  }
  const actualBuildId = computeCompetitiveBuildId(actual);
  if (actualBuildId !== manifest.buildId) {
    throw new Error("competitive build identity does not match its manifest");
  }
  return actualBuildId;
}

let cachedBuildId: string | null = null;

export function getCompetitiveExecutableBuildId(): string {
  if (cachedBuildId) return cachedBuildId;
  cachedBuildId = resolveCompetitiveExecutableBuildId({
    moduleUrl: import.meta.url,
    nodeEnv: process.env.NODE_ENV,
  });
  return cachedBuildId;
}
