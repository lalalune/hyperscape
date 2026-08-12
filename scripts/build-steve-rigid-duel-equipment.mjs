#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createServer } from "node:http";
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
import { build } from "esbuild";
import validator from "gltf-validator";
import puppeteer from "puppeteer";

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function parseGlb(input) {
  if (
    !Buffer.isBuffer(input) ||
    input.length < 20 ||
    input.readUInt32LE(0) !== GLB_MAGIC ||
    input.readUInt32LE(4) !== GLB_VERSION ||
    input.readUInt32LE(8) !== input.length
  ) {
    throw new Error("Input is not a complete GLB v2 file");
  }
  const chunks = [];
  let offset = 12;
  while (offset < input.length) {
    if (offset + 8 > input.length)
      throw new Error("Truncated GLB chunk header");
    const length = input.readUInt32LE(offset);
    const type = input.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (length % 4 !== 0 || end > input.length) {
      throw new Error("Malformed GLB chunk");
    }
    chunks.push({ type, data: Buffer.from(input.subarray(offset + 8, end)) });
    offset = end;
  }
  const jsonChunks = chunks.filter((chunk) => chunk.type === JSON_CHUNK_TYPE);
  if (jsonChunks.length !== 1 || chunks[0]?.type !== JSON_CHUNK_TYPE) {
    throw new Error("GLB must have one leading JSON chunk");
  }
  const document = JSON.parse(
    jsonChunks[0].data.toString("utf8").replace(/[\0\x20]+$/u, ""),
  );
  if (!isRecord(document)) throw new Error("GLB JSON root must be an object");
  return { document, chunks };
}

function encodeGlb(document, chunks) {
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(paddedJson);
  const outputChunks = [
    { type: JSON_CHUNK_TYPE, data: paddedJson },
    ...chunks.filter((chunk) => chunk.type !== JSON_CHUNK_TYPE),
  ];
  const length =
    12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = Buffer.alloc(length);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(GLB_VERSION, 4);
  output.writeUInt32LE(length, 8);
  let offset = 12;
  for (const chunk of outputChunks) {
    output.writeUInt32LE(chunk.data.length, offset);
    output.writeUInt32LE(chunk.type, offset + 4);
    chunk.data.copy(output, offset + 8);
    offset += 8 + chunk.data.length;
  }
  return output;
}

function accessorDataView(document, binary, accessorIndex, label) {
  const accessor = document.accessors?.[accessorIndex];
  const bufferView = document.bufferViews?.[accessor?.bufferView];
  if (
    !isRecord(accessor) ||
    !isRecord(bufferView) ||
    bufferView.buffer !== 0 ||
    accessor.sparse !== undefined
  ) {
    throw new Error(`${label} accessor is unsupported`);
  }
  const byteOffset =
    (Number.isInteger(bufferView.byteOffset) ? bufferView.byteOffset : 0) +
    (Number.isInteger(accessor.byteOffset) ? accessor.byteOffset : 0);
  return {
    accessor,
    bufferView,
    view: new DataView(
      binary.buffer,
      binary.byteOffset + byteOffset,
      binary.byteLength - byteOffset,
    ),
    byteStride: Number.isInteger(bufferView.byteStride)
      ? bufferView.byteStride
      : null,
  };
}

function averagePoints(points) {
  if (points.length < 1) throw new Error("Cannot average an empty point set");
  const result = [0, 0, 0];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) result[axis] += point[axis];
  }
  return result.map((value) => value / points.length);
}

/**
 * Remove only the disconnected, thread-thin components that form the source
 * bowstring. The bow body, materials, texture data, and every vertex attribute
 * remain byte-identical; only the primitive's index stream is replaced.
 */
export function stripStaticBowStringGlb(input) {
  const parsed = parseGlb(input);
  const document = cloneJson(parsed.document);
  const binaryChunks = parsed.chunks.filter(
    (chunk) => chunk.type !== JSON_CHUNK_TYPE,
  );
  if (binaryChunks.length !== 1 || !Array.isArray(document.buffers)) {
    throw new Error("Bow source must contain one embedded binary buffer");
  }
  const primitives = (document.meshes ?? []).flatMap((mesh) =>
    Array.isArray(mesh?.primitives) ? mesh.primitives : [],
  );
  if (primitives.length !== 1) {
    throw new Error("Bow source must contain exactly one primitive");
  }
  const primitive = primitives[0];
  if (
    !isRecord(primitive) ||
    (primitive.mode !== undefined && primitive.mode !== 4) ||
    !isRecord(primitive.attributes) ||
    !Number.isInteger(primitive.attributes.POSITION) ||
    !Number.isInteger(primitive.indices)
  ) {
    throw new Error("Bow source primitive must be indexed triangles");
  }
  const binary = binaryChunks[0].data;
  const positions = accessorDataView(
    document,
    binary,
    primitive.attributes.POSITION,
    "POSITION",
  );
  if (
    positions.accessor.componentType !== 5126 ||
    positions.accessor.type !== "VEC3" ||
    !Number.isInteger(positions.accessor.count)
  ) {
    throw new Error("Bow POSITION accessor must be finite VEC3 float data");
  }
  const vertexCount = positions.accessor.count;
  const positionStride = positions.byteStride ?? 12;
  const pointAt = (index) => [
    positions.view.getFloat32(index * positionStride, true),
    positions.view.getFloat32(index * positionStride + 4, true),
    positions.view.getFloat32(index * positionStride + 8, true),
  ];
  const points = Array.from({ length: vertexCount }, (_, index) =>
    pointAt(index),
  );
  if (points.some((point) => point.some((value) => !Number.isFinite(value)))) {
    throw new Error("Bow POSITION accessor contains non-finite data");
  }

  const indices = accessorDataView(
    document,
    binary,
    primitive.indices,
    "indices",
  );
  if (
    indices.accessor.type !== "SCALAR" ||
    !Number.isInteger(indices.accessor.count) ||
    indices.accessor.count % 3 !== 0 ||
    ![5121, 5123, 5125].includes(indices.accessor.componentType)
  ) {
    throw new Error("Bow index accessor must contain triangle indices");
  }
  const indexBytes = { 5121: 1, 5123: 2, 5125: 4 }[
    indices.accessor.componentType
  ];
  const indexStride = indices.byteStride ?? indexBytes;
  const readIndex = (index) => {
    const offset = index * indexStride;
    if (indexBytes === 1) return indices.view.getUint8(offset);
    if (indexBytes === 2) return indices.view.getUint16(offset, true);
    return indices.view.getUint32(offset, true);
  };
  const sourceIndices = Array.from(
    { length: indices.accessor.count },
    (_, index) => readIndex(index),
  );
  if (sourceIndices.some((index) => index >= vertexCount)) {
    throw new Error("Bow index accessor references an invalid vertex");
  }

  const parents = Int32Array.from({ length: vertexCount }, (_, index) => index);
  const find = (inputIndex) => {
    let index = inputIndex;
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const union = (leftInput, rightInput) => {
    const left = find(leftInput);
    const right = find(rightInput);
    if (left !== right) parents[right] = left;
  };
  for (let index = 0; index < sourceIndices.length; index += 3) {
    union(sourceIndices[index], sourceIndices[index + 1]);
    union(sourceIndices[index + 1], sourceIndices[index + 2]);
  }
  const components = new Map();
  for (let index = 0; index < vertexCount; index += 1) {
    const root = find(index);
    const component = components.get(root) ?? {
      vertexIndices: [],
      minimum: [Infinity, Infinity, Infinity],
      maximum: [-Infinity, -Infinity, -Infinity],
    };
    component.vertexIndices.push(index);
    for (let axis = 0; axis < 3; axis += 1) {
      component.minimum[axis] = Math.min(
        component.minimum[axis],
        points[index][axis],
      );
      component.maximum[axis] = Math.max(
        component.maximum[axis],
        points[index][axis],
      );
    }
    components.set(root, component);
  }
  const stringComponents = [...components.values()].filter((component) => {
    const size = component.maximum.map(
      (value, axis) => value - component.minimum[axis],
    );
    return size[1] >= 1.7 && size[0] <= 0.03 && size[2] <= 0.03;
  });
  if (stringComponents.length < 1) {
    throw new Error("No deterministic static bowstring components were found");
  }
  const removedVertices = new Set(
    stringComponents.flatMap((component) => component.vertexIndices),
  );
  const keptIndices = [];
  let removedTriangleCount = 0;
  for (let index = 0; index < sourceIndices.length; index += 3) {
    const triangle = sourceIndices.slice(index, index + 3);
    if (triangle.every((vertex) => removedVertices.has(vertex))) {
      removedTriangleCount += 1;
    } else {
      keptIndices.push(...triangle);
    }
  }
  if (removedTriangleCount < 1 || keptIndices.length < 3) {
    throw new Error("Static bowstring filtering produced an invalid primitive");
  }
  const stringPoints = [...removedVertices].map((index) => points[index]);
  const minimumY = Math.min(...stringPoints.map((point) => point[1]));
  const maximumY = Math.max(...stringPoints.map((point) => point[1]));
  const near = (target, tolerance) =>
    stringPoints.filter((point) => Math.abs(point[1] - target) <= tolerance);
  const middle = [...stringPoints]
    .sort((left, right) => Math.abs(left[1]) - Math.abs(right[1]))
    .slice(0, Math.min(32, stringPoints.length));
  const bowString = {
    schemaVersion: 1,
    contentNodeName: "EquipmentContent",
    upperTip: averagePoints(near(maximumY, 0.02)),
    lowerTip: averagePoints(near(minimumY, 0.02)),
    restNock: averagePoints(middle),
  };

  const outputIndexBytes = Buffer.alloc(keptIndices.length * indexBytes);
  for (const [index, value] of keptIndices.entries()) {
    const offset = index * indexBytes;
    if (indexBytes === 1) outputIndexBytes.writeUInt8(value, offset);
    else if (indexBytes === 2) outputIndexBytes.writeUInt16LE(value, offset);
    else outputIndexBytes.writeUInt32LE(value, offset);
  }
  const paddedIndexBytes = Buffer.alloc(
    Math.ceil(outputIndexBytes.length / 4) * 4,
  );
  outputIndexBytes.copy(paddedIndexBytes);
  const outputBinary = Buffer.concat([binary, paddedIndexBytes]);
  indices.bufferView.byteOffset = binary.length;
  indices.bufferView.byteLength = outputIndexBytes.length;
  delete indices.bufferView.byteStride;
  indices.accessor.byteOffset = 0;
  indices.accessor.count = keptIndices.length;
  indices.accessor.min = [Math.min(...keptIndices)];
  indices.accessor.max = [Math.max(...keptIndices)];
  document.buffers[0].byteLength = outputBinary.length;
  const chunks = parsed.chunks.map((chunk) =>
    chunk.type === JSON_CHUNK_TYPE
      ? chunk
      : { type: chunk.type, data: outputBinary },
  );
  const output = encodeGlb(document, chunks);
  return {
    output,
    bowString,
    report: {
      sourceVertexCount: vertexCount,
      sourceTriangleCount: sourceIndices.length / 3,
      stringComponentCount: stringComponents.length,
      stringVertexCount: removedVertices.size,
      removedTriangleCount,
      outputTriangleCount: keptIndices.length / 3,
      bowString,
    },
  };
}

function assertFiniteTuple(value, length, label) {
  if (
    !Array.isArray(value) ||
    value.length !== length ||
    value.some((component) => !Number.isFinite(component))
  ) {
    throw new Error(`${label} must contain ${length} finite numbers`);
  }
}

function removeDefaultNodeMatrices(nodes) {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const node of nodes) {
    if (
      isRecord(node) &&
      Array.isArray(node.matrix) &&
      node.matrix.length === identity.length &&
      node.matrix.every((value, index) => value === identity[index])
    ) {
      delete node.matrix;
    }
  }
}

export function buildFittedRigidEquipmentGlb({
  source,
  definition,
  avatar,
  exportedAt,
  browserFit,
  bowString = null,
}) {
  const parsed = parseGlb(source);
  const document = cloneJson(parsed.document);
  if (!Array.isArray(document.nodes) || !Array.isArray(document.scenes)) {
    throw new Error(`${definition.itemId} source has no scene graph`);
  }
  // Several source GLBs redundantly encode an identity transform. Removing it
  // is semantics-preserving and keeps every generated competitive asset free
  // of Khronos validator findings.
  removeDefaultNodeMatrices(document.nodes);
  const sceneIndex = Number.isInteger(document.scene) ? document.scene : 0;
  const scene = document.scenes[sceneIndex];
  if (
    !isRecord(scene) ||
    !Array.isArray(scene.nodes) ||
    scene.nodes.length < 1
  ) {
    throw new Error(`${definition.itemId} source scene has no roots`);
  }
  if (
    !SAFE_ID_PATTERN.test(definition.itemId) ||
    definition.slot !== "weapon" ||
    (definition.attachmentBone !== "leftHand" &&
      definition.attachmentBone !== "rightHand")
  ) {
    throw new Error(`${definition.itemId} has an invalid rigid fit identity`);
  }
  assertFiniteTuple(browserFit.relativeMatrix, 16, "relativeMatrix");
  if (
    !Number.isFinite(browserFit.contentScale) ||
    browserFit.contentScale <= 0
  ) {
    throw new Error("contentScale must be positive and finite");
  }
  const fit = {
    schemaVersion: 1,
    itemId: definition.itemId,
    slot: definition.slot,
    compatibleAvatarIds: [avatar.id],
  };
  const metadata = {
    version: 2,
    vrmBoneName: definition.attachmentBone,
    relativeMatrix: [...browserFit.relativeMatrix],
    originalSlot: definition.slot,
    avatarId: avatar.legacyAttachmentId,
    avatarHeight: avatar.normalizedHeight,
    weaponType: definition.weaponType,
    exportedFrom: "asset-forge-equipment-fitting-v2",
    exportedAt,
    usage:
      "Canonical contestant fit derived from the production retargeted reference pose.",
    fitReference: {
      schemaVersion: 1,
      avatarAsset: avatar.path,
      avatarSha256: avatar.sha256,
      motionAsset: definition.referenceMotion.path,
      motionSha256: definition.referenceMotion.sha256,
      motionSampleRatio: definition.referenceMotion.sampleRatio,
      sourceAsset: definition.sourcePath,
      sourceSha256: definition.sourceSha256,
      targetLengthMetres: definition.targetLengthMetres,
      desiredWorldEulerDegrees: [...definition.desiredWorldEulerDegrees],
      desiredWorldOffsetMetres: [...definition.desiredWorldOffsetMetres],
    },
    ...(bowString ? { bowString: cloneJson(bowString) } : {}),
    ...(definition.stableHeldPose
      ? {
          stableHeldPose: {
            schemaVersion: 1,
            wrapperNodeName: "EquipmentWrapper",
            avatarLocalEulerDegrees: [
              ...definition.stableHeldPose.avatarLocalEulerDegrees,
            ],
          },
        }
      : {}),
    duelFit: fit,
  };
  const sourceRoots = [...scene.nodes];
  const contentIndex = document.nodes.length;
  document.nodes.push({
    name: "EquipmentContent",
    children: sourceRoots,
    scale: [
      browserFit.contentScale,
      browserFit.contentScale,
      browserFit.contentScale,
    ],
    extras: {
      isNormalized: false,
      isEquipment: true,
      targetScale:
        browserFit.targetLengthMetres / browserFit.sourceLongestDimension,
    },
  });
  const wrapperIndex = document.nodes.length;
  document.nodes.push({
    name: "EquipmentWrapper",
    children: [contentIndex],
    matrix: [...browserFit.relativeMatrix],
    extras: { hyperia: cloneJson(metadata) },
  });
  scene.name = "AuxScene";
  scene.nodes = [wrapperIndex];
  scene.extras = {
    ...(isRecord(scene.extras) ? scene.extras : {}),
    hyperia: cloneJson(metadata),
  };
  const output = encodeGlb(document, parsed.chunks);
  const outputParsed = parseGlb(output);
  const inputBinary = parsed.chunks.filter(
    (chunk) => chunk.type !== JSON_CHUNK_TYPE,
  );
  const outputBinary = outputParsed.chunks.filter(
    (chunk) => chunk.type !== JSON_CHUNK_TYPE,
  );
  if (
    inputBinary.length !== outputBinary.length ||
    inputBinary.some(
      (chunk, index) =>
        chunk.type !== outputBinary[index].type ||
        !chunk.data.equals(outputBinary[index].data),
    )
  ) {
    throw new Error(`${definition.itemId} fitting changed source binary data`);
  }
  return { output, metadata };
}

function safeAssetPath(assetsRoot, relativePath, label) {
  if (
    typeof relativePath !== "string" ||
    path.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.startsWith("../")
  ) {
    throw new Error(`${label} must be a normalized asset-relative path`);
  }
  const resolved = path.resolve(assetsRoot, relativePath);
  if (!resolved.startsWith(`${path.resolve(assetsRoot)}${path.sep}`)) {
    throw new Error(`${label} escapes the asset root`);
  }
  return resolved;
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

function validateManifest(manifest, assetsRoot) {
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== 1 ||
    typeof manifest.exportedAt !== "string" ||
    !isRecord(manifest.avatar) ||
    !SAFE_ID_PATTERN.test(manifest.avatar.id) ||
    !SHA256_PATTERN.test(manifest.avatar.sha256) ||
    !Number.isFinite(manifest.avatar.normalizedHeight) ||
    manifest.avatar.normalizedHeight <= 0 ||
    !Array.isArray(manifest.fits) ||
    manifest.fits.length < 1
  ) {
    throw new Error("Rigid equipment fit manifest is invalid");
  }
  const avatarPath = safeAssetPath(
    assetsRoot,
    manifest.avatar.path,
    "avatar.path",
  );
  if (sha256(readFileSync(avatarPath)) !== manifest.avatar.sha256) {
    throw new Error("Canonical avatar hash drifted");
  }
  const itemIds = new Set();
  const outputPaths = new Set();
  for (const definition of manifest.fits) {
    if (
      !isRecord(definition) ||
      !SAFE_ID_PATTERN.test(definition.itemId) ||
      definition.slot !== "weapon" ||
      (definition.grip !== "one-hand" && definition.grip !== "two-hand") ||
      (definition.attachmentBone !== "leftHand" &&
        definition.attachmentBone !== "rightHand") ||
      !SHA256_PATTERN.test(definition.sourceSha256) ||
      !isRecord(definition.referenceMotion) ||
      !SHA256_PATTERN.test(definition.referenceMotion.sha256) ||
      !Number.isFinite(definition.referenceMotion.sampleRatio) ||
      definition.referenceMotion.sampleRatio < 0 ||
      definition.referenceMotion.sampleRatio > 1 ||
      !Number.isFinite(definition.targetLengthMetres) ||
      definition.targetLengthMetres <= 0 ||
      (definition.dynamicBowString !== undefined &&
        typeof definition.dynamicBowString !== "boolean") ||
      (definition.dynamicBowString === true &&
        (definition.weaponType !== "bow" ||
          definition.attachmentBone !== "leftHand")) ||
      (definition.weaponType === "staff" &&
        !isRecord(definition.stableHeldPose)) ||
      (definition.stableHeldPose !== undefined &&
        !isRecord(definition.stableHeldPose))
    ) {
      throw new Error("Rigid equipment fit definition is invalid");
    }
    assertFiniteTuple(
      definition.desiredWorldEulerDegrees,
      3,
      `${definition.itemId}.desiredWorldEulerDegrees`,
    );
    assertFiniteTuple(
      definition.desiredWorldOffsetMetres,
      3,
      `${definition.itemId}.desiredWorldOffsetMetres`,
    );
    if (definition.stableHeldPose) {
      assertFiniteTuple(
        definition.stableHeldPose.avatarLocalEulerDegrees,
        3,
        `${definition.itemId}.stableHeldPose.avatarLocalEulerDegrees`,
      );
      if (
        definition.stableHeldPose.avatarLocalEulerDegrees.some(
          (degrees) => Math.abs(degrees) > 180,
        )
      ) {
        throw new Error(
          `${definition.itemId}.stableHeldPose angles must be within [-180, 180]`,
        );
      }
    }
    if (itemIds.has(definition.itemId)) {
      throw new Error(`Duplicate fitted item: ${definition.itemId}`);
    }
    itemIds.add(definition.itemId);
    if (outputPaths.has(definition.outputPath)) {
      throw new Error(`Duplicate fit output: ${definition.outputPath}`);
    }
    outputPaths.add(definition.outputPath);
    const sourcePath = safeAssetPath(
      assetsRoot,
      definition.sourcePath,
      `${definition.itemId}.sourcePath`,
    );
    const outputPath = safeAssetPath(
      assetsRoot,
      definition.outputPath,
      `${definition.itemId}.outputPath`,
    );
    const motionPath = safeAssetPath(
      assetsRoot,
      definition.referenceMotion.path,
      `${definition.itemId}.referenceMotion.path`,
    );
    if (sourcePath === outputPath) {
      throw new Error(`${definition.itemId} output would overwrite its source`);
    }
    if (sha256(readFileSync(sourcePath)) !== definition.sourceSha256) {
      throw new Error(`${definition.itemId} source hash drifted`);
    }
    if (
      sha256(readFileSync(motionPath)) !== definition.referenceMotion.sha256
    ) {
      throw new Error(`${definition.itemId} reference motion hash drifted`);
    }
  }
}

function html(config) {
  const serialized = JSON.stringify(config).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Hyperia canonical rigid fit</title></head>
  <body>
    <main><h1>Hyperia canonical rigid-equipment fitting</h1><p id="status">Deriving fits…</p></main>
    <script type="module">
      import { deriveSteveRigidEquipmentFits } from "/fit.js";
      try {
        window.__fitReport = await deriveSteveRigidEquipmentFits(${serialized});
        document.querySelector("#status").textContent =
          "Derived " + window.__fitReport.length + " canonical fits";
        document.body.dataset.ready = "true";
      } catch (error) {
        document.querySelector("#status").textContent = error?.stack ?? String(error);
        document.body.dataset.error = error?.stack ?? String(error);
      }
    </script>
  </body>
</html>`;
}

async function deriveBrowserFits(workspaceRoot, assetsRoot, manifest) {
  const bundleResult = await build({
    entryPoints: [
      path.join(
        workspaceRoot,
        "scripts/fit-steve-rigid-duel-equipment-browser.ts",
      ),
    ],
    absWorkingDir: workspaceRoot,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    write: false,
    sourcemap: false,
    logLevel: "silent",
  });
  const bundle = bundleResult.outputFiles[0].contents;
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html(manifest));
        return;
      }
      if (url.pathname === "/fit.js") {
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
        });
        response.end(bundle);
        return;
      }
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      if (!url.pathname.startsWith("/asset/")) {
        response.writeHead(404).end();
        return;
      }
      const filePath = safeAssetPath(
        assetsRoot,
        decodeURIComponent(url.pathname.slice("/asset/".length)),
        "browser asset request",
      );
      response.writeHead(200, {
        "content-type": "model/gltf-binary",
        "cache-control": "no-store",
      });
      response.end(readFileSync(filePath));
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Canonical fitting server did not expose a port");
  }
  let browser;
  try {
    const systemChrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ??
        (existsSync(systemChrome) ? systemChrome : undefined),
    });
    const page = await browser.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${address.port}/`, {
      waitUntil: "networkidle0",
      timeout: 120_000,
    });
    await page.waitForFunction(
      () =>
        document.body.dataset.ready === "true" || document.body.dataset.error,
      { timeout: 120_000 },
    );
    const pageEvidence = await page.evaluate(() => ({
      error: document.body.dataset.error ?? null,
      hasContent: document.body.innerText.trim().length > 0,
      heading: document.querySelector("h1")?.textContent ?? null,
      status: document.querySelector("#status")?.textContent ?? null,
      hasErrorOverlay: Boolean(
        document.querySelector(
          "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
        ),
      ),
      fits: window.__fitReport ?? null,
    }));
    if (pageEvidence.error) throw new Error(pageEvidence.error);
    if (
      !pageEvidence.hasContent ||
      pageEvidence.heading !== "Hyperia canonical rigid-equipment fitting" ||
      pageEvidence.hasErrorOverlay ||
      !Array.isArray(pageEvidence.fits)
    ) {
      throw new Error("Canonical fitting browser page failed verification");
    }
    if (browserErrors.length > 0) {
      throw new Error(
        `Canonical fitting browser errors: ${browserErrors.join("; ")}`,
      );
    }
    return {
      fits: pageEvidence.fits,
      page: {
        loaded: true,
        hasContent: pageEvidence.hasContent,
        hasErrorOverlay: pageEvidence.hasErrorOverlay,
        heading: pageEvidence.heading,
        status: pageEvidence.status,
        consoleErrors: [],
      },
    };
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

export async function buildSteveRigidDuelEquipment({
  workspaceRoot,
  manifest,
  check,
}) {
  const assetsRoot = path.join(workspaceRoot, "packages/server/world/assets");
  validateManifest(manifest, assetsRoot);
  const browser = await deriveBrowserFits(workspaceRoot, assetsRoot, manifest);
  if (browser.fits.length !== manifest.fits.length) {
    throw new Error("Browser fitting result count does not match manifest");
  }
  const outputs = [];
  for (const [index, definition] of manifest.fits.entries()) {
    const browserFit = browser.fits[index];
    if (browserFit.itemId !== definition.itemId) {
      throw new Error("Browser fitting order or identity drifted");
    }
    const sourcePath = safeAssetPath(
      assetsRoot,
      definition.sourcePath,
      `${definition.itemId}.sourcePath`,
    );
    const outputPath = safeAssetPath(
      assetsRoot,
      definition.outputPath,
      `${definition.itemId}.outputPath`,
    );
    const source = readFileSync(sourcePath);
    const preparedSource = definition.dynamicBowString
      ? stripStaticBowStringGlb(source)
      : { output: source, bowString: null, report: null };
    const built = buildFittedRigidEquipmentGlb({
      source: preparedSource.output,
      definition,
      avatar: manifest.avatar,
      exportedAt: manifest.exportedAt,
      browserFit,
      bowString: preparedSource.bowString,
    });
    const validation = await validator.validateBytes(
      new Uint8Array(built.output),
      {
        uri: path.basename(outputPath),
        format: "glb",
        writeTimestamp: false,
        maxIssues: 0,
      },
    );
    if (
      validation.issues.numErrors > 0 ||
      validation.issues.numWarnings > 0 ||
      validation.issues.numInfos > 0 ||
      validation.issues.numHints > 0
    ) {
      throw new Error(
        `${definition.itemId} failed glTF validation: ${validation.issues.messages
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    if (check) {
      if (!existsSync(outputPath)) {
        throw new Error(`${definition.itemId} fitted output is missing`);
      }
      if (!readFileSync(outputPath).equals(built.output)) {
        throw new Error(`${definition.itemId} fitted output is stale`);
      }
    } else {
      writeAtomic(outputPath, built.output);
    }
    const parsed = parseGlb(built.output);
    const binaryChunks = parsed.chunks.filter(
      (chunk) => chunk.type !== JSON_CHUNK_TYPE,
    );
    outputs.push({
      itemId: definition.itemId,
      grip: definition.grip,
      sourcePath: definition.sourcePath,
      sourceSha256: definition.sourceSha256,
      sourcePreprocessing: preparedSource.report,
      outputPath: definition.outputPath,
      outputSha256: sha256(built.output),
      outputBytes: built.output.length,
      attachmentBone: browserFit.attachmentBone,
      relativeMatrix: browserFit.relativeMatrix,
      contentScale: browserFit.contentScale,
      targetLengthMetres: browserFit.targetLengthMetres,
      sourceLongestDimension: browserFit.sourceLongestDimension,
      referenceMotionDurationSeconds: browserFit.referenceMotionDurationSeconds,
      referenceMotionSampleSeconds: browserFit.referenceMotionSampleSeconds,
      referenceHandSeparationMetres: browserFit.referenceHandSeparationMetres,
      referenceMotionHandSeparationRangeMetres:
        browserFit.referenceMotionHandSeparationRangeMetres,
      fittedWorldPositionErrorMetres: browserFit.fittedWorldPositionErrorMetres,
      fittedWorldRotationErrorDegrees:
        browserFit.fittedWorldRotationErrorDegrees,
      nonJsonChunksSha256: binaryChunks.map((chunk) => ({
        type: chunk.type,
        sha256: sha256(chunk.data),
      })),
      validator: {
        errors: validation.issues.numErrors,
        warnings: validation.issues.numWarnings,
        infos: validation.issues.numInfos,
        hints: validation.issues.numHints,
      },
    });
  }
  return {
    schemaVersion: 1,
    avatar: cloneJson(manifest.avatar),
    browserVerification: browser.page,
    outputs,
  };
}

function parseArguments(argv) {
  const options = { check: false, write: false };
  for (const argument of argv) {
    if (argument === "--check") options.check = true;
    else if (argument === "--write") options.write = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.check === options.write) {
    throw new Error("Specify exactly one of --write or --check");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const workspaceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const manifest = JSON.parse(
    readFileSync(
      path.join(workspaceRoot, "scripts/steve-rigid-duel-equipment-fits.json"),
      "utf8",
    ),
  );
  const report = await buildSteveRigidDuelEquipment({
    workspaceRoot,
    manifest,
    check: options.check,
  });
  const reportPath = path.join(
    workspaceRoot,
    "artifacts/duel-avatar-candidates/steve-rigid-equipment-fit-report.json",
  );
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.check) {
    if (
      !existsSync(reportPath) ||
      readFileSync(reportPath, "utf8") !== serialized
    ) {
      throw new Error("Canonical rigid-equipment fit report is stale");
    }
  } else {
    writeAtomic(reportPath, serialized);
  }
  process.stdout.write(
    `${options.check ? "Verified" : "Built"} ${report.outputs.length} canonical Steve rigid-equipment fits\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
