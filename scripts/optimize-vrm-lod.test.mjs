import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseGlbJson, summarizeVrmDocument } from "./audit-avatar-lods.mjs";
import { optimizeVrmLod } from "./optimize-vrm-lod.mjs";
import validator from "gltf-validator";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixturePath = path.join(
  workspaceRoot,
  "packages/server/world/assets/avatars/steve.vrm",
);

test("preserves VRM rig and rights metadata while optimizing an immutable source", async () => {
  const source = readFileSync(fixturePath);
  const sourceDocument = parseGlbJson(source, fixturePath);
  const sourceSummary = summarizeVrmDocument(sourceDocument, source);
  const result = await optimizeVrmLod(source, {
    maxTriangles: 1_800,
    maxTextureSize: 256,
    source: fixturePath,
  });
  const outputDocument = parseGlbJson(result.output, "optimized fixture");
  const outputSummary = summarizeVrmDocument(outputDocument, result.output);
  const validation = await validator.validateBytes(
    new Uint8Array(result.output),
    {
      uri: "optimized-fixture.vrm",
      format: "glb",
      writeTimestamp: false,
      maxIssues: 0,
    },
  );

  assert.ok(result.output.length < source.length / 4);
  assert.ok(outputSummary.triangles <= 1_800);
  assert.equal(outputSummary.vrmSpecVersion, sourceSummary.vrmSpecVersion);
  assert.deepEqual(outputSummary.humanBoneNames, sourceSummary.humanBoneNames);
  assert.deepEqual(outputSummary.jointCounts, sourceSummary.jointCounts);
  assert.equal(outputSummary.rigFingerprint, sourceSummary.rigFingerprint);
  assert.equal(
    result.report.outputRigFingerprint,
    result.report.sourceRigFingerprint,
  );
  assert.deepEqual(outputSummary.license, sourceSummary.license);
  assert.equal(outputDocument.images.length, 1);
  assert.equal(outputDocument.images[0].uri, undefined);
  assert.ok(Number.isInteger(outputDocument.images[0].bufferView));
  assert.equal(outputDocument.images[0].mimeType, "image/png");
  assert.deepEqual(outputSummary.textureDimensions, [
    { width: 256, height: 256 },
  ]);
  assert.equal(result.report.sourceSha256.length, 64);
  assert.equal(result.report.outputSha256.length, 64);
  assert.equal(validation.issues.numErrors, 0);
});

test("fails closed on unsafe output parameters", async () => {
  const source = readFileSync(fixturePath);
  await assert.rejects(
    optimizeVrmLod(source, {
      maxTriangles: 1_800,
      maxTextureSize: 300,
      source: fixturePath,
    }),
    /power of two/,
  );
  await assert.rejects(
    optimizeVrmLod(source, {
      maxTriangles: 1_800,
      maxTextureSize: 256,
      maxError: 0.5,
      source: fixturePath,
    }),
    /no larger than 0.1/,
  );
});
