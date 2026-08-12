import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildFittedRigidEquipmentGlb,
  parseGlb,
  stripStaticBowStringGlb,
} from "./build-steve-rigid-duel-equipment.mjs";

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function createGlb(document, binary = Buffer.from([1, 2, 3, 4])) {
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const length = 12 + 8 + padded.length + 8 + binary.length;
  const output = Buffer.alloc(length);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(length, 8);
  output.writeUInt32LE(padded.length, 12);
  output.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  padded.copy(output, 20);
  const binaryOffset = 20 + padded.length;
  output.writeUInt32LE(binary.length, binaryOffset);
  output.writeUInt32LE(BIN_CHUNK_TYPE, binaryOffset + 4);
  binary.copy(output, binaryOffset + 8);
  return output;
}

const definition = {
  itemId: "shortbow",
  slot: "weapon",
  grip: "two-hand",
  weaponType: "bow",
  attachmentBone: "leftHand",
  sourcePath: "models/bows/source.glb",
  sourceSha256: "a".repeat(64),
  outputPath: "models/bows/output.glb",
  targetLengthMetres: 0.9,
  desiredWorldEulerDegrees: [0, 90, 0],
  desiredWorldOffsetMetres: [0, 0, 0],
  referenceMotion: {
    path: "emotes/range.glb",
    sha256: "b".repeat(64),
    sampleRatio: 0.55,
  },
};

const avatar = {
  id: "steve",
  legacyAttachmentId: "/api/assets/steve/model",
  path: "avatars/duel-steve.vrm",
  sha256: "c".repeat(64),
  normalizedHeight: 1.6,
};

const browserFit = {
  itemId: "shortbow",
  attachmentBone: "leftHand",
  relativeMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.1, 0.2, 0.3, 1],
  contentScale: 2,
  sourceLongestDimension: 2,
  targetLengthMetres: 0.9,
};

test("builds deterministic item- and avatar-specific rigid equipment", () => {
  const source = createGlb({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ count: 1, componentType: 5126, type: "VEC3" }],
    buffers: [{ byteLength: 4 }],
  });
  const first = buildFittedRigidEquipmentGlb({
    source,
    definition,
    avatar,
    exportedAt: "2026-08-11T12:00:00.000Z",
    browserFit,
  });
  const second = buildFittedRigidEquipmentGlb({
    source,
    definition,
    avatar,
    exportedAt: "2026-08-11T12:00:00.000Z",
    browserFit,
  });
  assert.ok(first.output.equals(second.output));
  const parsed = parseGlb(first.output);
  const scene = parsed.document.scenes[0];
  const wrapper = parsed.document.nodes[scene.nodes[0]];
  const content = parsed.document.nodes[wrapper.children[0]];
  assert.equal(wrapper.name, "EquipmentWrapper");
  assert.deepEqual(wrapper.matrix, browserFit.relativeMatrix);
  assert.deepEqual(content.scale, [2, 2, 2]);
  assert.deepEqual(wrapper.extras.hyperia.duelFit, {
    schemaVersion: 1,
    itemId: "shortbow",
    slot: "weapon",
    compatibleAvatarIds: ["steve"],
  });
  assert.deepEqual(scene.extras.hyperia, wrapper.extras.hyperia);
  assert.deepEqual(
    parsed.chunks.filter((chunk) => chunk.type !== JSON_CHUNK_TYPE)[0].data,
    Buffer.from([1, 2, 3, 4]),
  );
});

test("rejects non-finite browser transforms", () => {
  const source = createGlb({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
  });
  assert.throws(
    () =>
      buildFittedRigidEquipmentGlb({
        source,
        definition,
        avatar,
        exportedAt: "2026-08-11T12:00:00.000Z",
        browserFit: {
          ...browserFit,
          relativeMatrix: [
            ...browserFit.relativeMatrix.slice(0, 15),
            Number.NaN,
          ],
        },
      }),
    /relativeMatrix/u,
  );
});

test("embeds an immutable avatar-local stabilizer contract for long staff fits", () => {
  const source = createGlb({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
  });
  const output = buildFittedRigidEquipmentGlb({
    source,
    definition: {
      ...definition,
      itemId: "staff_of_air",
      grip: "one-hand",
      weaponType: "staff",
      attachmentBone: "rightHand",
      stableHeldPose: { avatarLocalEulerDegrees: [0, 0, 32] },
    },
    avatar,
    exportedAt: "2026-08-11T12:00:00.000Z",
    browserFit: {
      ...browserFit,
      itemId: "staff_of_air",
      attachmentBone: "rightHand",
    },
  });
  const parsed = parseGlb(output.output);
  const metadata = parsed.document.scenes[0].extras.hyperia;
  assert.deepEqual(metadata.stableHeldPose, {
    schemaVersion: 1,
    wrapperNodeName: "EquipmentWrapper",
    avatarLocalEulerDegrees: [0, 0, 32],
  });
});

test("removes only the frozen source bowstring components deterministically", () => {
  const workspaceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const source = readFileSync(
    path.join(
      workspaceRoot,
      "packages/server/world/assets/models/bows/bow-wood/bow-wood.glb",
    ),
  );
  const first = stripStaticBowStringGlb(source);
  const second = stripStaticBowStringGlb(source);
  assert.ok(first.output.equals(second.output));
  assert.equal(first.report.sourceVertexCount, 3343);
  assert.equal(first.report.sourceTriangleCount, 4890);
  assert.equal(first.report.stringComponentCount, 3);
  assert.equal(first.report.stringVertexCount, 860);
  assert.equal(first.report.removedTriangleCount, 1078);
  assert.equal(first.report.outputTriangleCount, 3812);
  for (const point of [
    first.bowString.upperTip,
    first.bowString.lowerTip,
    first.bowString.restNock,
  ]) {
    assert.equal(point.length, 3);
    assert.ok(point.every(Number.isFinite));
  }
  assert.ok(!first.output.equals(source));
});
