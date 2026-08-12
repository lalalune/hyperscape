import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { certifyRigidDuelEquipmentGlb } from "./certify-rigid-duel-equipment.mjs";
import { verifyDuelRigidEquipmentCertifications } from "./verify-duel-rigid-equipment-certifications.mjs";

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function createGlb() {
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        name: "EquipmentWrapper",
        extras: {
          hyperia: {
            version: 2,
            vrmBoneName: "rightHand",
            relativeMatrix: MATRIX,
            avatarId: "/api/assets/steve/model",
          },
        },
      },
    ],
    buffers: [{ byteLength: 8 }],
  };
  const encoded = Buffer.from(JSON.stringify(document));
  const json = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20);
  encoded.copy(json);
  const binary = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const output = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  json.copy(output, 20);
  const binaryOffset = 20 + json.length;
  output.writeUInt32LE(binary.length, binaryOffset);
  output.writeUInt32LE(BIN_CHUNK_TYPE, binaryOffset + 4);
  binary.copy(output, binaryOffset + 8);
  return output;
}

function createFixture() {
  const workspaceRoot = mkdtempSync(
    path.join(tmpdir(), "hyperia-equipment-certifications-"),
  );
  const relativePath = "packages/server/world/assets/models/swords/fixture.glb";
  const assetPath = path.join(workspaceRoot, relativePath);
  mkdirSync(path.dirname(assetPath), { recursive: true });
  const { output, report } = certifyRigidDuelEquipmentGlb(createGlb(), {
    itemId: "bronze_shortsword",
    avatarId: "steve",
    legacyAvatarId: "/api/assets/steve/model",
    slot: "weapon",
  });
  writeFileSync(assetPath, output);
  const certification = {
    itemId: "bronze_shortsword",
    slot: "weapon",
    grip: "one-hand",
    path: relativePath,
    sha256: report.outputSha256,
    structuralDocumentSha256: report.structuralDocumentSha256,
    nonJsonChunksSha256: report.nonJsonChunksSha256,
  };
  return {
    workspaceRoot,
    manifest: {
      schemaVersion: 1,
      avatarId: "steve",
      legacyAvatarId: "/api/assets/steve/model",
      certifications: [certification],
    },
  };
}

test("verifies immutable item, avatar, structure, and binary authority", () => {
  const fixture = createFixture();
  try {
    const report = verifyDuelRigidEquipmentCertifications(fixture);
    assert.equal(report.ok, true);
    assert.equal(report.certificationCount, 1);
    assert.deepEqual(report.reports[0], {
      itemId: "bronze_shortsword",
      path: "packages/server/world/assets/models/swords/fixture.glb",
      slot: "weapon",
      grip: "one-hand",
      vrmBoneName: "rightHand",
      sha256: fixture.manifest.certifications[0].sha256,
      structuralDocumentSha256:
        fixture.manifest.certifications[0].structuralDocumentSha256,
      nonJsonChunkCount: 1,
    });
  } finally {
    rmSync(fixture.workspaceRoot, { recursive: true, force: true });
  }
});

test("fails closed on digest drift and duplicate competitive identity", () => {
  const fixture = createFixture();
  try {
    const driftedManifest = structuredClone(fixture.manifest);
    driftedManifest.certifications[0].sha256 = "0".repeat(64);
    assert.throws(
      () =>
        verifyDuelRigidEquipmentCertifications({
          workspaceRoot: fixture.workspaceRoot,
          manifest: driftedManifest,
        }),
      /asset SHA-256 drifted/u,
    );

    const duplicateManifest = structuredClone(fixture.manifest);
    duplicateManifest.certifications.push(
      structuredClone(duplicateManifest.certifications[0]),
    );
    assert.throws(
      () =>
        verifyDuelRigidEquipmentCertifications({
          workspaceRoot: fixture.workspaceRoot,
          manifest: duplicateManifest,
        }),
      /Duplicate certified itemId/u,
    );
  } finally {
    rmSync(fixture.workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects traversal and invalid grip declarations before reading files", () => {
  const fixture = createFixture();
  try {
    const traversalManifest = structuredClone(fixture.manifest);
    traversalManifest.certifications[0].path =
      "packages/server/world/assets/models/../outside.glb";
    assert.throws(
      () =>
        verifyDuelRigidEquipmentCertifications({
          workspaceRoot: fixture.workspaceRoot,
          manifest: traversalManifest,
        }),
      /must remain under/u,
    );

    const invalidGripManifest = structuredClone(fixture.manifest);
    invalidGripManifest.certifications[0].grip = "either";
    assert.throws(
      () =>
        verifyDuelRigidEquipmentCertifications({
          workspaceRoot: fixture.workspaceRoot,
          manifest: invalidGripManifest,
        }),
      /grip must be/u,
    );
  } finally {
    rmSync(fixture.workspaceRoot, { recursive: true, force: true });
  }
});
