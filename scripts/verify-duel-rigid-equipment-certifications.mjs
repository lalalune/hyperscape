#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { certifyRigidDuelEquipmentGlb } from "./certify-rigid-duel-equipment.mjs";

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ASSET_PATH_PREFIX = "packages/server/world/assets/models/";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256`);
  }
}

function assertExactObject(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the frozen certification`);
  }
}

function resolveCertifiedAsset(workspaceRoot, relativePath) {
  if (
    typeof relativePath !== "string" ||
    !relativePath.startsWith(ASSET_PATH_PREFIX) ||
    path.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath
  ) {
    throw new Error(
      `Certified asset path must remain under ${ASSET_PATH_PREFIX}`,
    );
  }
  const resolved = path.resolve(workspaceRoot, relativePath);
  const assetRoot = path.resolve(workspaceRoot, ASSET_PATH_PREFIX);
  if (!resolved.startsWith(`${assetRoot}${path.sep}`)) {
    throw new Error("Certified asset path escapes the duel asset root");
  }
  return resolved;
}

export function verifyDuelRigidEquipmentCertifications({
  workspaceRoot,
  manifest,
}) {
  if (!isRecord(manifest) || manifest.schemaVersion !== 1) {
    throw new Error("Certification manifest must use schemaVersion 1");
  }
  if (
    typeof manifest.avatarId !== "string" ||
    !SAFE_ID_PATTERN.test(manifest.avatarId)
  ) {
    throw new Error("Certification manifest has an invalid avatarId");
  }
  if (
    typeof manifest.legacyAvatarId !== "string" ||
    manifest.legacyAvatarId.length === 0
  ) {
    throw new Error("Certification manifest requires a legacyAvatarId");
  }
  if (
    !Array.isArray(manifest.certifications) ||
    manifest.certifications.length === 0
  ) {
    throw new Error("Certification manifest must contain equipment");
  }

  const itemIds = new Set();
  const assetPaths = new Set();
  const reports = [];
  for (const [index, certification] of manifest.certifications.entries()) {
    const label = `certifications[${index}]`;
    if (!isRecord(certification)) {
      throw new Error(`${label} must be an object`);
    }
    if (
      typeof certification.itemId !== "string" ||
      !SAFE_ID_PATTERN.test(certification.itemId)
    ) {
      throw new Error(`${label}.itemId is invalid`);
    }
    if (itemIds.has(certification.itemId)) {
      throw new Error(`Duplicate certified itemId: ${certification.itemId}`);
    }
    itemIds.add(certification.itemId);
    if (certification.slot !== "weapon" && certification.slot !== "shield") {
      throw new Error(`${label}.slot must be weapon or shield`);
    }
    if (
      certification.grip !== "one-hand" &&
      certification.grip !== "two-hand"
    ) {
      throw new Error(`${label}.grip must be one-hand or two-hand`);
    }
    if (certification.slot === "shield" && certification.grip !== "one-hand") {
      throw new Error(`${label} cannot define a two-hand shield`);
    }
    const assetPath = resolveCertifiedAsset(workspaceRoot, certification.path);
    if (assetPaths.has(assetPath)) {
      throw new Error(`Duplicate certified asset path: ${certification.path}`);
    }
    assetPaths.add(assetPath);
    assertSha256(certification.sha256, `${label}.sha256`);
    assertSha256(
      certification.structuralDocumentSha256,
      `${label}.structuralDocumentSha256`,
    );
    if (
      !Array.isArray(certification.nonJsonChunksSha256) ||
      certification.nonJsonChunksSha256.length === 0
    ) {
      throw new Error(`${label} must freeze at least one non-JSON chunk`);
    }
    for (const [
      chunkIndex,
      chunk,
    ] of certification.nonJsonChunksSha256.entries()) {
      if (!isRecord(chunk) || !Number.isInteger(chunk.type)) {
        throw new Error(
          `${label}.nonJsonChunksSha256[${chunkIndex}] is invalid`,
        );
      }
      assertSha256(
        chunk.sha256,
        `${label}.nonJsonChunksSha256[${chunkIndex}].sha256`,
      );
    }

    const bytes = readFileSync(assetPath);
    if (sha256(bytes) !== certification.sha256) {
      throw new Error(`${certification.itemId} asset SHA-256 drifted`);
    }
    const { report } = certifyRigidDuelEquipmentGlb(bytes, {
      itemId: certification.itemId,
      avatarId: manifest.avatarId,
      legacyAvatarId: manifest.legacyAvatarId,
      slot: certification.slot,
    });
    if (report.changed) {
      throw new Error(`${certification.itemId} certification is stale`);
    }
    if (report.inputSha256 !== certification.sha256) {
      throw new Error(`${certification.itemId} certification digest disagrees`);
    }
    if (
      report.structuralDocumentSha256 !== certification.structuralDocumentSha256
    ) {
      throw new Error(`${certification.itemId} structural GLB data drifted`);
    }
    assertExactObject(
      report.nonJsonChunksSha256,
      certification.nonJsonChunksSha256,
      `${certification.itemId} non-JSON GLB chunks`,
    );
    reports.push({
      itemId: certification.itemId,
      path: certification.path,
      slot: certification.slot,
      grip: certification.grip,
      vrmBoneName: report.vrmBoneName,
      sha256: certification.sha256,
      structuralDocumentSha256: certification.structuralDocumentSha256,
      nonJsonChunkCount: report.nonJsonChunksSha256.length,
    });
  }

  return {
    ok: true,
    schemaVersion: manifest.schemaVersion,
    avatarId: manifest.avatarId,
    legacyAvatarId: manifest.legacyAvatarId,
    certificationCount: reports.length,
    reports,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--manifest") {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value) throw new Error("--manifest requires a value");
    options.manifest = value;
    index += 1;
  }
  return options;
}

function resolveWorkspaceFile(workspaceRoot, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error("Manifest path must be workspace-relative");
  }
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (!resolved.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error("Manifest path must remain inside the workspace");
  }
  return resolved;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const workspaceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const manifestPath = resolveWorkspaceFile(
    workspaceRoot,
    options.manifest ?? "scripts/duel-rigid-equipment-certifications.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const report = verifyDuelRigidEquipmentCertifications({
    workspaceRoot,
    manifest,
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
