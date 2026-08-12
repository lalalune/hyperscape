import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildDuelAvatarCandidates,
  DUEL_AVATAR_CANDIDATES,
} from "./build-duel-avatar-candidates.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const assetsRoot = path.join(workspaceRoot, "packages/server/world/assets");

test("keeps the recommended Steve baseline in the reproducible candidate set", () => {
  const candidate = DUEL_AVATAR_CANDIDATES.find(({ id }) => id === "steve");
  assert.deepEqual(candidate, {
    id: "steve",
    name: "Steve",
    archetype: "canonical duel-rig baseline",
    source: "avatars/steve.vrm",
    lods: {
      lod0: { maxTriangles: 3_000, maxTextureSize: 1_024 },
      lod1: { maxTriangles: 2_400, maxTextureSize: 512 },
      lod2: { maxTriangles: 1_800, maxTextureSize: 256 },
    },
  });
});

test("builds deterministic, validator-clean LODs without overwriting the source", async () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "hyperia-duel-vrm-"));
  const outputRoot = path.join(temporaryRoot, "avatars");
  const manifestPath = path.join(temporaryRoot, "manifest.json");
  const sourcePath = path.join(assetsRoot, "avatars/steve.vrm");
  const sourceBefore = readFileSync(sourcePath);
  const candidates = [
    {
      id: "fixture",
      name: "Fixture",
      archetype: "test fighter",
      source: "avatars/steve.vrm",
      lods: {
        lod0: { maxTriangles: 3_000, maxTextureSize: 512 },
        lod1: { maxTriangles: 2_400, maxTextureSize: 256 },
        lod2: { maxTriangles: 1_800, maxTextureSize: 128 },
      },
    },
  ];

  try {
    const manifest = await buildDuelAvatarCandidates({
      assetsRoot,
      outputRoot,
      manifestPath,
      candidates,
    });
    assert.equal(manifest.totals.generatedModels, 3);
    assert.ok(manifest.totals.generatedBytes < manifest.totals.sourceBytes);
    for (const lod of manifest.candidates[0].lods) {
      assert.equal(lod.validator.errors, 0);
    }
    assert.deepEqual(readFileSync(sourcePath), sourceBefore);

    await buildDuelAvatarCandidates({
      assetsRoot,
      outputRoot,
      manifestPath,
      candidates,
      check: true,
    });

    const stalePath = path.join(outputRoot, "duel-fixture_lod2.vrm");
    writeFileSync(stalePath, Buffer.from("stale"));
    await assert.rejects(
      buildDuelAvatarCandidates({
        assetsRoot,
        outputRoot,
        manifestPath,
        candidates,
        check: true,
      }),
      /Generated avatar is stale/,
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
