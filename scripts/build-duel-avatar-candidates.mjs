#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import validator from "gltf-validator";

import { parseGlbJson, summarizeVrmDocument } from "./audit-avatar-lods.mjs";
import { optimizeVrmLod } from "./optimize-vrm-lod.mjs";

const LOD_SUFFIX = Object.freeze({ lod0: "", lod1: "_lod1", lod2: "_lod2" });

export const DUEL_AVATAR_CANDIDATES = Object.freeze([
  {
    id: "steve",
    name: "Steve",
    archetype: "canonical duel-rig baseline",
    source: "avatars/steve.vrm",
    lods: {
      lod0: { maxTriangles: 3_000, maxTextureSize: 1_024 },
      lod1: { maxTriangles: 2_400, maxTextureSize: 512 },
      lod2: { maxTriangles: 1_800, maxTextureSize: 256 },
    },
  },
  {
    id: "bandit",
    name: "Bandit",
    archetype: "agile skirmisher",
    source: "models/mobs/bandit/bandit.vrm",
    lods: {
      lod0: { maxTriangles: 3_000, maxTextureSize: 1_024 },
      lod1: { maxTriangles: 2_400, maxTextureSize: 512 },
      lod2: { maxTriangles: 1_800, maxTextureSize: 256 },
    },
  },
  {
    id: "barbarian",
    name: "Barbarian",
    archetype: "armored power fighter",
    source: "models/mobs/barbarian/barbarian.vrm",
    lods: {
      lod0: { maxTriangles: 3_000, maxTextureSize: 1_024 },
      lod1: { maxTriangles: 2_400, maxTextureSize: 512 },
      lod2: { maxTriangles: 1_800, maxTextureSize: 256 },
    },
  },
  {
    id: "dark-ranger",
    name: "Dark Ranger",
    archetype: "ranged specialist",
    source: "models/mobs/dark-ranger/dark-ranger.vrm",
    lods: {
      lod0: { maxTriangles: 3_000, maxTextureSize: 1_024 },
      lod1: { maxTriangles: 2_400, maxTextureSize: 512 },
      lod2: { maxTriangles: 1_800, maxTextureSize: 256 },
    },
  },
  {
    id: "dark-wizard",
    name: "Dark Wizard",
    archetype: "magic specialist",
    source: "models/mobs/dark-wizard/dark-wizard.vrm",
    lods: {
      lod0: { maxTriangles: 10_000, maxTextureSize: 1_024 },
      lod1: { maxTriangles: 5_000, maxTextureSize: 512 },
      lod2: { maxTriangles: 1_800, maxTextureSize: 256 },
    },
  },
]);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function writeAtomic(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, contents, { flag: "wx" });
    renameSync(temporary, filePath);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function assertGeneratedFile(filePath, expected) {
  if (!existsSync(filePath)) {
    throw new Error(`Generated avatar is missing: ${filePath}`);
  }
  const actual = readFileSync(filePath);
  if (!actual.equals(expected)) {
    throw new Error(`Generated avatar is stale: ${filePath}`);
  }
}

function embeddedRightsCompatible(license) {
  return (
    license.commercialUsage === "corporation" &&
    (license.modification === "allowModification" ||
      license.modification === "allowModificationRedistribution") &&
    license.allowRedistribution === true
  );
}

export async function buildDuelAvatarCandidates({
  assetsRoot,
  outputRoot,
  manifestPath,
  candidates = DUEL_AVATAR_CANDIDATES,
  check = false,
}) {
  const manifest = {
    schemaVersion: 1,
    purpose:
      "Technical duel-avatar candidates; not a commercial-rights clearance",
    optimizer: {
      maxError: 0.02,
      textureFormat: "png",
      sourceMastersOverwritten: false,
    },
    candidates: [],
  };

  for (const candidate of candidates) {
    const sourcePath = path.resolve(assetsRoot, candidate.source);
    if (!sourcePath.startsWith(`${path.resolve(assetsRoot)}${path.sep}`)) {
      throw new Error(`${candidate.id} source escapes the asset root`);
    }
    if (!existsSync(sourcePath)) {
      throw new Error(`${candidate.id} source is missing: ${sourcePath}`);
    }
    const sourceBuffer = readFileSync(sourcePath);
    const sourceDocument = parseGlbJson(sourceBuffer, candidate.source);
    const sourceSummary = summarizeVrmDocument(sourceDocument, sourceBuffer);
    const candidateManifest = {
      id: candidate.id,
      name: candidate.name,
      archetype: candidate.archetype,
      source: candidate.source,
      sourceSha256: sha256(sourceBuffer),
      sourceBytes: sourceBuffer.length,
      sourceTriangles: sourceSummary.triangles,
      sourceRigFingerprint: sourceSummary.rigFingerprint,
      embeddedRightsCompatible: embeddedRightsCompatible(sourceSummary.license),
      embeddedRights: sourceSummary.license,
      lods: [],
    };

    for (const lod of ["lod0", "lod1", "lod2"]) {
      const configuration = candidate.lods[lod];
      if (!configuration) throw new Error(`${candidate.id}.${lod} is missing`);
      const result = await optimizeVrmLod(sourceBuffer, {
        ...configuration,
        maxError: 0.02,
        source: candidate.source,
      });
      const validation = await validator.validateBytes(
        new Uint8Array(result.output),
        {
          uri: `duel-${candidate.id}${LOD_SUFFIX[lod]}.vrm`,
          format: "glb",
          writeTimestamp: false,
          maxIssues: 0,
        },
      );
      if (validation.issues.numErrors > 0) {
        const errors = validation.issues.messages
          .filter((issue) => issue.severity === 0)
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join("; ");
        throw new Error(
          `${candidate.id}.${lod} failed glTF validation: ${errors}`,
        );
      }

      const fileName = `duel-${candidate.id}${LOD_SUFFIX[lod]}.vrm`;
      const outputPath = path.resolve(outputRoot, fileName);
      if (!outputPath.startsWith(`${path.resolve(outputRoot)}${path.sep}`)) {
        throw new Error(`${candidate.id}.${lod} output escapes its root`);
      }
      if (check) assertGeneratedFile(outputPath, result.output);
      else writeAtomic(outputPath, result.output);

      candidateManifest.lods.push({
        lod,
        asset: path.relative(assetsRoot, outputPath).split(path.sep).join("/"),
        bytes: result.output.length,
        sha256: result.report.outputSha256,
        triangles: result.report.outputTriangles,
        vertices: result.report.outputVertices,
        rigFingerprint: result.report.outputRigFingerprint,
        textureSize: configuration.maxTextureSize,
        maximumTriangles: configuration.maxTriangles,
        simplificationErrors: result.report.simplificationErrors,
        validator: {
          errors: validation.issues.numErrors,
          warnings: validation.issues.numWarnings,
          infos: validation.issues.numInfos,
          messages: validation.issues.messages.map((issue) => ({
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            pointer: issue.pointer,
          })),
        },
      });
    }
    manifest.candidates.push(candidateManifest);
  }

  manifest.totals = {
    candidates: manifest.candidates.length,
    generatedModels: manifest.candidates.reduce(
      (sum, candidate) => sum + candidate.lods.length,
      0,
    ),
    sourceBytes: manifest.candidates.reduce(
      (sum, candidate) => sum + candidate.sourceBytes,
      0,
    ),
    generatedBytes: manifest.candidates.reduce(
      (sum, candidate) =>
        sum + candidate.lods.reduce((lodSum, lod) => lodSum + lod.bytes, 0),
      0,
    ),
  };

  const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
  if (check) {
    if (!existsSync(manifestPath)) {
      throw new Error(`Candidate manifest is missing: ${manifestPath}`);
    }
    if (readFileSync(manifestPath, "utf8") !== serializedManifest) {
      throw new Error(`Candidate manifest is stale: ${manifestPath}`);
    }
  } else {
    writeAtomic(manifestPath, serializedManifest);
  }
  return manifest;
}

function parseCliArgs(argv) {
  const options = { check: false, json: false };
  for (const argument of argv) {
    if (argument === "--check") options.check = true;
    else if (argument === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const assetsRoot = path.join(workspaceRoot, "packages/server/world/assets");
  const outputRoot = path.join(assetsRoot, "avatars/duel-candidates");
  const manifestPath = path.join(
    workspaceRoot,
    "artifacts/duel-avatar-candidates/manifest.json",
  );
  const manifest = await buildDuelAvatarCandidates({
    assetsRoot,
    outputRoot,
    manifestPath,
    check: options.check,
  });
  if (options.json) console.log(JSON.stringify(manifest, null, 2));
  else {
    const verb = options.check ? "Verified" : "Built";
    console.log(
      `${verb} ${manifest.totals.generatedModels} duel-avatar LODs (${(manifest.totals.sourceBytes / 1_048_576).toFixed(1)} MiB source -> ${(manifest.totals.generatedBytes / 1_048_576).toFixed(1)} MiB generated).`,
    );
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
