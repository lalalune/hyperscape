/**
 * Inject Model Collision - Post-processor for GLB assets
 *
 * This script adds collision data directly INTO GLB model files using
 * the glTF extras field. This is the AAA approach - collision travels
 * with the asset, no separate manifests to keep in sync.
 *
 * After Meshy.ai generates a model, run this to add collision:
 *   bun run packages/server/scripts/inject-model-collision.ts
 *
 * The collision data is stored in the GLB's JSON chunk:
 *   {
 *     "asset": { ... },
 *     "extras": {
 *       "hyperia": {
 *         "collision": {
 *           "footprint": { "width": 2, "depth": 2 },
 *           "bounds": { "min": {...}, "max": {...} }
 *         }
 *       }
 *     }
 *   }
 *
 * Runtime reads this when loading the model - no separate config needed.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "fs";
import { join, relative, basename, dirname } from "path";

// ============================================================================
// TYPES
// ============================================================================

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface CollisionData {
  /** Footprint in tiles at scale 1.0 */
  footprint: { width: number; depth: number };
  /** Bounding box in model space */
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  /** Model dimensions (max - min) */
  dimensions: { x: number; y: number; z: number };
  /** When collision was computed */
  generatedAt: string;
}

interface HyperiaExtras {
  hyperia: {
    collision: CollisionData;
  };
}

// glTF types
interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
}

interface GltfMeshPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

interface GltfMesh {
  name?: string;
  primitives: GltfMeshPrimitive[];
}

interface GltfJson {
  asset: { version: string; generator?: string };
  extras?: HyperiaExtras;
  accessors?: GltfAccessor[];
  meshes?: GltfMesh[];
  scenes?: { nodes?: number[] }[];
  nodes?: {
    mesh?: number;
    children?: number[];
    translation?: number[];
    scale?: number[];
  }[];
  [key: string]: unknown;
}

// ============================================================================
// GLB PARSER / WRITER
// ============================================================================

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_VERSION = 2;
const CHUNK_TYPE_JSON = 0x4e4f534a; // "JSON"
const CHUNK_TYPE_BIN = 0x004e4942; // "BIN\0"

interface GlbChunks {
  json: GltfJson;
  binary: Buffer | null;
}

/**
 * Parse GLB file into JSON and binary chunks
 */
function parseGlb(buffer: Buffer): GlbChunks | null {
  if (buffer.length < 12) return null;

  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);

  if (magic !== GLB_MAGIC || version !== GLB_VERSION) return null;

  let json: GltfJson | null = null;
  let binary: Buffer | null = null;

  let offset = 12;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;

    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;

    if (chunkType === CHUNK_TYPE_JSON) {
      const jsonString = buffer.toString("utf8", offset, offset + chunkLength);
      json = JSON.parse(jsonString);
    } else if (chunkType === CHUNK_TYPE_BIN) {
      binary = buffer.slice(offset, offset + chunkLength);
    }

    offset += chunkLength;
  }

  if (!json) return null;
  return { json, binary };
}

/**
 * Write GLB file from JSON and binary chunks
 */
function writeGlb(chunks: GlbChunks): Buffer {
  // Serialize JSON with minimal whitespace
  const jsonString = JSON.stringify(chunks.json);

  // JSON chunk must be padded to 4-byte alignment with spaces (0x20)
  const jsonPadding = (4 - (jsonString.length % 4)) % 4;
  const jsonBuffer = Buffer.from(jsonString + " ".repeat(jsonPadding), "utf8");

  // Binary chunk must be padded to 4-byte alignment with zeros
  let binaryBuffer = chunks.binary || Buffer.alloc(0);
  const binaryPadding = (4 - (binaryBuffer.length % 4)) % 4;
  if (binaryPadding > 0) {
    binaryBuffer = Buffer.concat([binaryBuffer, Buffer.alloc(binaryPadding)]);
  }

  // Calculate total size
  const headerSize = 12;
  const jsonChunkSize = 8 + jsonBuffer.length;
  const binaryChunkSize = binaryBuffer.length > 0 ? 8 + binaryBuffer.length : 0;
  const totalSize = headerSize + jsonChunkSize + binaryChunkSize;

  // Build GLB
  const glb = Buffer.alloc(totalSize);
  let offset = 0;

  // Header
  glb.writeUInt32LE(GLB_MAGIC, offset);
  offset += 4;
  glb.writeUInt32LE(GLB_VERSION, offset);
  offset += 4;
  glb.writeUInt32LE(totalSize, offset);
  offset += 4;

  // JSON chunk
  glb.writeUInt32LE(jsonBuffer.length, offset);
  offset += 4;
  glb.writeUInt32LE(CHUNK_TYPE_JSON, offset);
  offset += 4;
  jsonBuffer.copy(glb, offset);
  offset += jsonBuffer.length;

  // Binary chunk (if present)
  if (binaryBuffer.length > 0) {
    glb.writeUInt32LE(binaryBuffer.length, offset);
    offset += 4;
    glb.writeUInt32LE(CHUNK_TYPE_BIN, offset);
    offset += 4;
    binaryBuffer.copy(glb, offset);
  }

  return glb;
}

// ============================================================================
// COLLISION COMPUTATION
// ============================================================================

/**
 * Extract bounding box from glTF position accessors
 */
function computeBounds(gltf: GltfJson): { min: Vec3; max: Vec3 } | null {
  if (!gltf.accessors || !gltf.meshes) return null;

  const globalMin: Vec3 = { x: Infinity, y: Infinity, z: Infinity };
  const globalMax: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  let found = false;

  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const posIdx = primitive.attributes?.POSITION;
      if (posIdx === undefined) continue;

      const accessor = gltf.accessors[posIdx];
      if (!accessor || accessor.type !== "VEC3") continue;

      if (
        accessor.min &&
        accessor.max &&
        accessor.min.length >= 3 &&
        accessor.max.length >= 3
      ) {
        found = true;
        globalMin.x = Math.min(globalMin.x, accessor.min[0]);
        globalMin.y = Math.min(globalMin.y, accessor.min[1]);
        globalMin.z = Math.min(globalMin.z, accessor.min[2]);
        globalMax.x = Math.max(globalMax.x, accessor.max[0]);
        globalMax.y = Math.max(globalMax.y, accessor.max[1]);
        globalMax.z = Math.max(globalMax.z, accessor.max[2]);
      }
    }
  }

  return found ? { min: globalMin, max: globalMax } : null;
}

/**
 * Calculate footprint from bounds (at scale 1.0)
 */
function computeFootprint(bounds: { min: Vec3; max: Vec3 }): {
  width: number;
  depth: number;
} {
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;

  return {
    width: Math.max(1, Math.ceil(width)),
    depth: Math.max(1, Math.ceil(depth)),
  };
}

// ============================================================================
// FILE PROCESSING
// ============================================================================

/**
 * Inject collision data into a GLB file
 */
function injectCollision(glbPath: string, force: boolean = false): boolean {
  const buffer = readFileSync(glbPath);
  const chunks = parseGlb(buffer);

  if (!chunks) {
    console.log("  ✗ Failed to parse GLB");
    return false;
  }

  // Check if collision already exists
  if (chunks.json.extras?.hyperia?.collision && !force) {
    console.log("  ⊘ Already has collision (use --force to overwrite)");
    return true;
  }

  // Compute bounds
  const bounds = computeBounds(chunks.json);
  if (!bounds) {
    console.log("  ✗ Could not compute bounds (no position data)");
    return false;
  }

  const dimensions: Vec3 = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  };

  const footprint = computeFootprint(bounds);

  // Create collision data
  const collision: CollisionData = {
    footprint,
    bounds: {
      min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
      max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
    },
    dimensions,
    generatedAt: new Date().toISOString(),
  };

  // Inject into extras
  if (!chunks.json.extras) {
    chunks.json.extras = { hyperia: { collision } };
  } else if (!chunks.json.extras.hyperia) {
    chunks.json.extras.hyperia = { collision };
  } else {
    chunks.json.extras.hyperia.collision = collision;
  }

  // Write back
  const newGlb = writeGlb(chunks);
  writeFileSync(glbPath, newGlb);

  console.log(`  ✓ Injected: ${footprint.width}x${footprint.depth} tiles`);
  console.log(
    `    Dimensions: ${dimensions.x.toFixed(2)} x ${dimensions.y.toFixed(2)} x ${dimensions.z.toFixed(2)}`,
  );

  return true;
}

/**
 * Find all GLB files in directory
 */
function findGlbFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry === "backups" || entry === ".git" || entry === "animations")
        continue;
      files.push(...findGlbFiles(fullPath));
    } else if (entry.endsWith(".glb") && !entry.includes("_raw")) {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const specificFile = args.find((a) => a.endsWith(".glb"));

  const assetsDir = join(__dirname, "../world/assets/models");

  console.log("═".repeat(60));
  console.log("GLB Collision Injector");
  console.log("═".repeat(60));

  if (specificFile) {
    // Process single file
    console.log(`\nProcessing: ${specificFile}`);
    injectCollision(specificFile, force);
  } else {
    // Process all models
    console.log(`\nScanning: ${assetsDir}`);
    console.log(`Force overwrite: ${force}\n`);

    const glbFiles = findGlbFiles(assetsDir);
    console.log(`Found ${glbFiles.length} GLB files\n`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const glbPath of glbFiles) {
      const rel = relative(assetsDir, glbPath);
      console.log(`[${rel}]`);

      const result = injectCollision(glbPath, force);
      if (result) {
        // Check if it was skipped (already had collision)
        const buffer = readFileSync(glbPath);
        const chunks = parseGlb(buffer);
        if (chunks?.json.extras?.hyperia?.collision) {
          processed++;
        }
      } else {
        failed++;
      }
    }

    console.log("\n" + "═".repeat(60));
    console.log(`Processed: ${processed} | Failed: ${failed}`);
    console.log("═".repeat(60));
  }
}

main();
