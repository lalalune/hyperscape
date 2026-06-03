#!/usr/bin/env bun
/**
 * Vegetation Generation and LOD Baking Pipeline
 *
 * Generates procedural vegetation (trees, rocks, plants), creates multiple LOD levels,
 * and updates the vegetation manifest.
 *
 * Usage:
 *   bun run scripts/generate-vegetation-lods.mjs --type tree --count 5 --output assets/vegetation
 *   bun run scripts/generate-vegetation-lods.mjs --all --output packages/server/world/assets/vegetation
 *
 * Note: This script must be run from the workspace root with 'bun run' to resolve workspace dependencies.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Dynamically import Three.js to allow for workspace resolution
let THREE, GLTFExporter, GLTFLoader;

async function initThree() {
  if (THREE) return;
  
  try {
    THREE = await import("three");
    const exporterModule = await import("three/examples/jsm/exporters/GLTFExporter.js");
    const loaderModule = await import("three/examples/jsm/loaders/GLTFLoader.js");
    GLTFExporter = exporterModule.GLTFExporter;
    GLTFLoader = loaderModule.GLTFLoader;
  } catch (error) {
    console.error("Failed to load Three.js. Make sure to run 'bun install' first.");
    console.error("Error:", error.message);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../.."); // asset-forge/scripts -> root

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: null, // tree, rock, plant, or null for all
    all: false,
    count: 3, // variations per type
    output: "packages/server/world/assets/vegetation",
    seed: Date.now(),
    skipLOD: false,
    skipManifest: false,
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--type":
      case "-t":
        options.type = args[++i];
        break;
      case "--all":
      case "-a":
        options.all = true;
        break;
      case "--count":
      case "-c":
        options.count = parseInt(args[++i], 10);
        break;
      case "--output":
      case "-o":
        options.output = args[++i];
        break;
      case "--seed":
      case "-s":
        options.seed = parseInt(args[++i], 10);
        break;
      case "--skip-lod":
        options.skipLOD = true;
        break;
      case "--skip-manifest":
        options.skipManifest = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  // Default to all if no type specified
  if (!options.type && !options.all) {
    options.all = true;
  }

  return options;
}

function printHelp() {
  console.log(`
Vegetation Generation and LOD Baking Pipeline

Usage:
  bun run scripts/generate-vegetation-lods.mjs [options]

Options:
  --type, -t <type>     Generate only this type (tree, rock, plant)
  --all, -a             Generate all types (default)
  --count, -c <n>       Number of variations per type (default: 3)
  --output, -o <path>   Output directory (default: packages/server/world/assets/vegetation)
  --seed, -s <n>        Random seed (default: current timestamp)
  --skip-lod            Skip LOD generation
  --skip-manifest       Skip manifest update
  --dry-run             Print what would be done without doing it
  --verbose, -v         Verbose output
  --help, -h            Show this help

Examples:
  # Generate 5 tree variations with LODs
  bun run scripts/generate-vegetation-lods.mjs --type tree --count 5

  # Generate all vegetation types
  bun run scripts/generate-vegetation-lods.mjs --all

  # Dry run to see what would be generated
  bun run scripts/generate-vegetation-lods.mjs --all --dry-run
`);
}

// =============================================================================
// LOGGING
// =============================================================================

let verbose = false;

function log(message) {
  console.log(`[VegGen] ${message}`);
}

function logVerbose(message) {
  if (verbose) {
    console.log(`[VegGen] ${message}`);
  }
}

function logError(message) {
  console.error(`[VegGen] ERROR: ${message}`);
}

function logSuccess(message) {
  console.log(`[VegGen] ✓ ${message}`);
}

// =============================================================================
// TREE PRESETS
// =============================================================================

const TREE_PRESETS = [
  "QUAKING_ASPEN",
  "BLACK_OAK",
  "SILVER_BIRCH",
  "SMALL_PINE",
  "DOUGLAS_FIR",
  "APPLE",
  "WEEPING_WILLOW",
  "PALM",
];

// =============================================================================
// ROCK PRESETS
// =============================================================================

const ROCK_SHAPE_PRESETS = ["boulder", "pebble", "cliff", "lowpoly"];
const ROCK_TYPE_PRESETS = ["sandstone", "limestone", "granite", "basalt"];

// =============================================================================
// PLANT PRESETS (if available)
// =============================================================================

const PLANT_PRESETS = ["monstera", "fern", "palm", "philodendron", "oak"];

// =============================================================================
// GLB EXPORT UTILITY (Headless-compatible)
// =============================================================================

/**
 * Export a Three.js object to GLB format (works in Node.js/Bun without DOM)
 */
async function exportToGLB(object, filename) {
  const exporter = new GLTFExporter();

  // Clone to avoid modifying original
  const exportObject = object.clone(true);
  exportObject.position.set(0, 0, 0);
  exportObject.updateMatrixWorld(true);

  return new Promise((resolve, reject) => {
    exporter.parse(
      exportObject,
      (result) => {
        resolve(result);
      },
      (error) => {
        reject(error);
      },
      { binary: true }
    );
  });
}

/**
 * Export a mesh to GLB using manual buffer construction (headless-compatible)
 * This bypasses the GLTFExporter which may have DOM dependencies
 */
async function exportMeshToGLB(mesh, filename) {
  // Use @gltf-transform for headless GLB export
  const { Document, NodeIO } = await import("@gltf-transform/core");

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const node = doc.createNode(filename);
  scene.addChild(node);

  // Get geometry data
  const geometry = mesh.geometry;
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const uvs = geometry.attributes.uv;
  const colors = geometry.attributes.color;
  const indices = geometry.index;

  // Create primitive
  const primitive = doc.createPrimitive();

  // Positions
  const positionAccessor = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType("VEC3")
    .setArray(new Float32Array(positions.array));
  primitive.setAttribute("POSITION", positionAccessor);

  // Normals
  if (normals) {
    const normalAccessor = doc
      .createAccessor()
      .setBuffer(buffer)
      .setType("VEC3")
      .setArray(new Float32Array(normals.array));
    primitive.setAttribute("NORMAL", normalAccessor);
  }

  // UVs
  if (uvs) {
    const uvAccessor = doc
      .createAccessor()
      .setBuffer(buffer)
      .setType("VEC2")
      .setArray(new Float32Array(uvs.array));
    primitive.setAttribute("TEXCOORD_0", uvAccessor);
  }

  // Vertex colors
  if (colors) {
    const colorAccessor = doc
      .createAccessor()
      .setBuffer(buffer)
      .setType(colors.itemSize === 4 ? "VEC4" : "VEC3")
      .setArray(new Float32Array(colors.array));
    primitive.setAttribute("COLOR_0", colorAccessor);
  }

  // Indices
  if (indices) {
    const indexAccessor = doc
      .createAccessor()
      .setBuffer(buffer)
      .setType("SCALAR")
      .setArray(
        indices.array instanceof Uint32Array
          ? new Uint32Array(indices.array)
          : new Uint16Array(indices.array)
      );
    primitive.setIndices(indexAccessor);
  }

  // Create mesh and material
  const gltfMesh = doc.createMesh(filename).addPrimitive(primitive);

  // Create basic material
  const material = doc.createMaterial();
  if (mesh.material) {
    const threeMat = mesh.material;
    if (threeMat.color) {
      material.setBaseColorFactor([
        threeMat.color.r,
        threeMat.color.g,
        threeMat.color.b,
        1.0,
      ]);
    }
    if (threeMat.roughness !== undefined) {
      material.setRoughnessFactor(threeMat.roughness);
    }
    if (threeMat.metalness !== undefined) {
      material.setMetallicFactor(threeMat.metalness);
    }
  }
  primitive.setMaterial(material);

  node.setMesh(gltfMesh);

  // Apply mesh transform
  const position = mesh.position;
  const rotation = mesh.quaternion;
  const scale = mesh.scale;
  node.setTranslation([position.x, position.y, position.z]);
  node.setRotation([rotation.x, rotation.y, rotation.z, rotation.w]);
  node.setScale([scale.x, scale.y, scale.z]);

  // Export to GLB
  const io = new NodeIO();
  const glb = await io.writeBinary(doc);

  return glb;
}

/**
 * Export a Three.js Group (with multiple meshes) to GLB using gltf-transform
 */
async function exportGroupToGLB(group, name) {
  const { Document, NodeIO } = await import("@gltf-transform/core");

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(name);
  const rootNode = doc.createNode(name);
  scene.addChild(rootNode);

  // Process all meshes in the group
  let meshIndex = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const meshName = child.name || `mesh_${meshIndex++}`;
      
      // Get attributes
      const positions = geometry.attributes.position;
      const normals = geometry.attributes.normal;
      const uvs = geometry.attributes.uv;
      const colors = geometry.attributes.color;
      const indices = geometry.index;

      if (!positions) return;

      // Create primitive
      const primitive = doc.createPrimitive();

      // Positions
      const positionAccessor = doc
        .createAccessor()
        .setBuffer(buffer)
        .setType("VEC3")
        .setArray(new Float32Array(positions.array));
      primitive.setAttribute("POSITION", positionAccessor);

      // Normals
      if (normals) {
        const normalAccessor = doc
          .createAccessor()
          .setBuffer(buffer)
          .setType("VEC3")
          .setArray(new Float32Array(normals.array));
        primitive.setAttribute("NORMAL", normalAccessor);
      }

      // UVs
      if (uvs) {
        const uvAccessor = doc
          .createAccessor()
          .setBuffer(buffer)
          .setType("VEC2")
          .setArray(new Float32Array(uvs.array));
        primitive.setAttribute("TEXCOORD_0", uvAccessor);
      }

      // Vertex colors
      if (colors) {
        const colorAccessor = doc
          .createAccessor()
          .setBuffer(buffer)
          .setType(colors.itemSize === 4 ? "VEC4" : "VEC3")
          .setArray(new Float32Array(colors.array));
        primitive.setAttribute("COLOR_0", colorAccessor);
      }

      // Indices
      if (indices) {
        const indexAccessor = doc
          .createAccessor()
          .setBuffer(buffer)
          .setType("SCALAR")
          .setArray(
            indices.array instanceof Uint32Array
              ? new Uint32Array(indices.array)
              : new Uint16Array(indices.array)
          );
        primitive.setIndices(indexAccessor);
      }

      // Create material
      const material = doc.createMaterial(meshName + "_mat");
      if (child.material) {
        const threeMat = child.material;
        if (threeMat.color) {
          material.setBaseColorFactor([
            threeMat.color.r,
            threeMat.color.g,
            threeMat.color.b,
            1.0,
          ]);
        }
        if (threeMat.roughness !== undefined) {
          material.setRoughnessFactor(threeMat.roughness);
        }
        if (threeMat.metalness !== undefined) {
          material.setMetallicFactor(threeMat.metalness);
        }
        if (threeMat.side === THREE.DoubleSide) {
          material.setDoubleSided(true);
        }
      }
      primitive.setMaterial(material);

      // Create mesh and node
      const gltfMesh = doc.createMesh(meshName).addPrimitive(primitive);
      const meshNode = doc.createNode(meshName);
      meshNode.setMesh(gltfMesh);

      // Apply world transform
      child.updateMatrixWorld(true);
      const worldMatrix = child.matrixWorld;
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      worldMatrix.decompose(position, quaternion, scale);

      meshNode.setTranslation([position.x, position.y, position.z]);
      meshNode.setRotation([quaternion.x, quaternion.y, quaternion.z, quaternion.w]);
      meshNode.setScale([scale.x, scale.y, scale.z]);

      rootNode.addChild(meshNode);
    }
  });

  // Export to GLB
  const io = new NodeIO();
  const glb = await io.writeBinary(doc);

  return glb;
}

async function loadGLB(filePath) {
  // Use @gltf-transform for headless GLB loading
  const { NodeIO } = await import("@gltf-transform/core");
  
  const io = new NodeIO();
  const document = await io.read(filePath);
  
  // Convert gltf-transform document to mesh data
  const meshes = [];
  
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const positionAccessor = primitive.getAttribute("POSITION");
      const normalAccessor = primitive.getAttribute("NORMAL");
      const uvAccessor = primitive.getAttribute("TEXCOORD_0");
      const indicesAccessor = primitive.getIndices();
      
      if (!positionAccessor) continue;
      
      const positions = positionAccessor.getArray();
      const normals = normalAccessor?.getArray();
      const uvs = uvAccessor?.getArray();
      const indices = indicesAccessor?.getArray();
      
      // Create Three.js geometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      if (normals) {
        geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
      }
      if (uvs) {
        geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
      }
      if (indices) {
        geometry.setIndex(new THREE.BufferAttribute(
          indices instanceof Uint32Array ? new Uint32Array(indices) : new Uint16Array(indices), 
          1
        ));
      }
      
      const material = new THREE.MeshStandardMaterial();
      const threeMesh = new THREE.Mesh(geometry, material);
      meshes.push(threeMesh);
    }
  }
  
  // Create a group containing all meshes
  const group = new THREE.Group();
  for (const mesh of meshes) {
    group.add(mesh);
  }
  
  return { scene: group };
}

// =============================================================================
// MESH EXTRACTION FOR DECIMATION
// =============================================================================

function extractMeshData(object) {
  const vertices = [];
  const faces = [];
  const uvs = [];
  const faceUVs = [];

  let vertexOffset = 0;
  let uvOffset = 0;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positions = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      const index = geometry.index;

      // Apply world matrix to positions
      const matrix = child.matrixWorld;
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

      // Extract vertices
      const startVertex = vertices.length;
      for (let i = 0; i < positions.count; i++) {
        const v = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        );
        v.applyMatrix4(matrix);
        vertices.push([v.x, v.y, v.z]);
      }

      // Extract UVs
      const startUV = uvs.length;
      if (uv) {
        for (let i = 0; i < uv.count; i++) {
          uvs.push([uv.getX(i), uv.getY(i)]);
        }
      } else {
        // Default UVs
        for (let i = 0; i < positions.count; i++) {
          uvs.push([0, 0]);
        }
      }

      // Extract faces
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          faces.push([
            index.getX(i) + startVertex,
            index.getX(i + 1) + startVertex,
            index.getX(i + 2) + startVertex,
          ]);
          faceUVs.push([
            index.getX(i) + startUV,
            index.getX(i + 1) + startUV,
            index.getX(i + 2) + startUV,
          ]);
        }
      } else {
        for (let i = 0; i < positions.count; i += 3) {
          faces.push([i + startVertex, i + 1 + startVertex, i + 2 + startVertex]);
          faceUVs.push([i + startUV, i + 1 + startUV, i + 2 + startUV]);
        }
      }

      vertexOffset = vertices.length;
      uvOffset = uvs.length;
    }
  });

  return { vertices, faces, uvs, faceUVs };
}

function meshDataToThreeJS(meshData) {
  const geometry = new THREE.BufferGeometry();

  // Positions
  const positions = new Float32Array(meshData.V.length * 3);
  for (let i = 0; i < meshData.V.length; i++) {
    positions[i * 3] = meshData.V[i][0];
    positions[i * 3 + 1] = meshData.V[i][1];
    positions[i * 3 + 2] = meshData.V[i][2];
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Indices
  const indices = new Uint32Array(meshData.F.length * 3);
  for (let i = 0; i < meshData.F.length; i++) {
    indices[i * 3] = meshData.F[i][0];
    indices[i * 3 + 1] = meshData.F[i][1];
    indices[i * 3 + 2] = meshData.F[i][2];
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // UVs
  if (meshData.TC && meshData.TC.length > 0) {
    const uvArray = new Float32Array(meshData.TC.length * 2);
    for (let i = 0; i < meshData.TC.length; i++) {
      uvArray[i * 2] = meshData.TC[i][0];
      uvArray[i * 2 + 1] = meshData.TC[i][1];
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

// =============================================================================
// GENERATION FUNCTIONS
// =============================================================================

async function generateTrees(options) {
  log("Loading tree generator...");

  // Dynamic import of procgen
  const procgen = await import("@hyperforge/procgen");
  const { TreeGenerator, getPresetNames, disposeTreeMesh } = procgen;

  const availablePresets = getPresetNames();
  const presetsToUse = TREE_PRESETS.filter((p) =>
    availablePresets.map((n) => n.toUpperCase()).includes(p)
  );

  if (presetsToUse.length === 0) {
    logError("No valid tree presets found. Available: " + availablePresets.join(", "));
    return [];
  }

  const generated = [];
  const presetCycle = presetsToUse.length;

  for (let i = 0; i < options.count; i++) {
    const presetName = presetsToUse[i % presetCycle];
    const seed = options.seed + i;
    const id = `tree_${presetName.toLowerCase()}_${seed}`;

    if (options.dryRun) {
      log(`Would generate: ${id} (preset: ${presetName}, seed: ${seed})`);
      generated.push({ id, type: "tree", presetName, seed, path: null });
      continue;
    }

    try {
      logVerbose(`Generating tree: ${id}`);
      
      // Generate with non-instanced leaves for better GLB compatibility
      const generator = new TreeGenerator(presetName, {
        generation: { seed },
        geometry: { maxLeaves: 5000 },
        mesh: { useInstancedLeaves: false }, // Non-instanced for GLB export
      });
      const result = generator.generate();

      // Export to GLB using headless exporter
      const glbData = await exportGroupToGLB(result.group, id);
      const outputDir = path.join(PROJECT_ROOT, options.output, "trees");
      await fs.mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${id}.glb`);
      await fs.writeFile(outputPath, Buffer.from(glbData));

      generated.push({
        id,
        type: "tree",
        presetName,
        seed,
        path: path.relative(PROJECT_ROOT, outputPath),
        vertices: result.vertexCount,
        triangles: result.triangleCount,
      });

      logSuccess(`Generated ${id} (${result.vertexCount} vertices)`);

      // Cleanup
      disposeTreeMesh(result);
    } catch (error) {
      logError(`Failed to generate ${id}: ${error.message}`);
      if (options.verbose) {
        console.error(error);
      }
    }
  }

  return generated;
}

async function generateRocks(options) {
  log("Loading rock generator...");

  const procgen = await import("@hyperforge/procgen");
  const { RockGen } = procgen;
  const { RockGenerator } = RockGen;

  const generator = new RockGenerator();
  const generated = [];

  for (let i = 0; i < options.count; i++) {
    const shapePreset = ROCK_SHAPE_PRESETS[i % ROCK_SHAPE_PRESETS.length];
    const seed = `rock-${options.seed + i}`;
    const id = `rock_${shapePreset}_${options.seed + i}`;

    if (options.dryRun) {
      log(`Would generate: ${id} (preset: ${shapePreset}, seed: ${seed})`);
      generated.push({ id, type: "rock", presetName: shapePreset, seed, path: null });
      continue;
    }

    try {
      logVerbose(`Generating rock: ${id}`);
      const result = generator.generateFromPreset(shapePreset, { seed });

      if (!result) {
        logError(`Failed to generate rock with preset ${shapePreset}`);
        continue;
      }

      // Export to GLB using our headless-compatible exporter
      const glbData = await exportMeshToGLB(result.mesh, id);
      const outputDir = path.join(PROJECT_ROOT, options.output, "rocks");
      await fs.mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${id}.glb`);
      await fs.writeFile(outputPath, Buffer.from(glbData));

      generated.push({
        id,
        type: "rock",
        presetName: shapePreset,
        seed,
        path: path.relative(PROJECT_ROOT, outputPath),
        vertices: result.stats.vertices,
        triangles: result.stats.triangles,
      });

      logSuccess(`Generated ${id} (${result.stats.vertices} vertices)`);
    } catch (error) {
      logError(`Failed to generate ${id}: ${error.message}`);
    }
  }

  generator.dispose();
  return generated;
}

async function generatePlants(options) {
  log("Loading plant generator...");

  const procgen = await import("@hyperforge/procgen");
  const { PlantGen } = procgen;
  const { PlantGenerator, getPresetNames } = PlantGen;

  const availablePresets = getPresetNames();
  const presetsToUse = PLANT_PRESETS.filter((p) =>
    availablePresets.includes(p)
  );

  if (presetsToUse.length === 0) {
    logError("No valid plant presets found. Available: " + availablePresets.join(", "));
    return [];
  }

  const generated = [];

  for (let i = 0; i < options.count; i++) {
    const presetName = presetsToUse[i % presetsToUse.length];
    const seed = options.seed + i;
    const id = `plant_${presetName}_${seed}`;

    if (options.dryRun) {
      log(`Would generate: ${id} (preset: ${presetName}, seed: ${seed})`);
      generated.push({ id, type: "plant", presetName, seed, path: null });
      continue;
    }

    try {
      logVerbose(`Generating plant: ${id}`);
      const generator = new PlantGenerator({
        seed,
        generateTextures: false,
        quality: PlantGen.RenderQualityEnum.Maximum,
      });
      generator.loadPreset(presetName);
      const result = generator.generate();

      // Export to GLB using headless exporter
      const glbData = await exportGroupToGLB(result.group, id);
      const outputDir = path.join(PROJECT_ROOT, options.output, "plants");
      await fs.mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${id}.glb`);
      await fs.writeFile(outputPath, Buffer.from(glbData));

      generated.push({
        id,
        type: "plant",
        presetName,
        seed,
        path: path.relative(PROJECT_ROOT, outputPath),
        vertices: result.stats.vertexCount,
        triangles: result.stats.triangleCount,
      });

      logSuccess(`Generated ${id} (${result.stats.vertexCount} vertices)`);

      // Cleanup
      result.dispose();
    } catch (error) {
      logError(`Failed to generate ${id}: ${error.message}`);
      if (options.verbose) {
        console.error(error);
      }
    }
  }

  return generated;
}

// =============================================================================
// LOD GENERATION
// =============================================================================

async function generateLODsForAsset(assetInfo, options) {
  const { decimate, MeshData, VEGETATION_LOD_PRESETS } = await import(
    "@hyperforge/decimation"
  );

  if (options.dryRun) {
    log(`Would generate LODs for: ${assetInfo.id}`);
    return null;
  }

  const fullPath = path.join(PROJECT_ROOT, assetInfo.path);

  try {
    // Load the GLB
    const gltf = await loadGLB(fullPath);

    // Extract mesh data
    const meshData = extractMeshData(gltf.scene);

    if (meshData.vertices.length === 0) {
      logError(`No mesh data found in ${assetInfo.id}`);
      return null;
    }

    // Create MeshData instance
    const mesh = new MeshData(
      meshData.vertices,
      meshData.faces,
      meshData.uvs,
      meshData.faceUVs
    );

    // Get LOD presets for this category
    const category =
      assetInfo.type === "tree"
        ? "tree"
        : assetInfo.type === "rock"
        ? "rock"
        : "plant";
    const lodLevels = VEGETATION_LOD_PRESETS[category] || VEGETATION_LOD_PRESETS.default;

    const lodResults = {};

    for (const levelConfig of lodLevels) {
      const startTime = performance.now();

      // Calculate effective target
      let effectivePercent = levelConfig.targetPercent;
      if (levelConfig.minVertices && mesh.V.length > 0) {
        const minPercent = (levelConfig.minVertices / mesh.V.length) * 100;
        effectivePercent = Math.max(effectivePercent, minPercent);
      }

      // Clone and decimate
      const meshCopy = mesh.clone();
      const result = decimate(meshCopy, {
        targetPercent: effectivePercent,
        strictness: levelConfig.strictness ?? 2,
      });

      const endTime = performance.now();

      // Convert back to Three.js
      const lodMesh = meshDataToThreeJS(result.mesh);

      // Export LOD GLB using headless exporter
      const lodGlb = await exportMeshToGLB(lodMesh, `${assetInfo.id}_${levelConfig.name}`);
      const lodPath = fullPath.replace(".glb", `_${levelConfig.name}.glb`);
      await fs.writeFile(lodPath, Buffer.from(lodGlb));

      lodResults[levelConfig.name] = {
        path: path.relative(PROJECT_ROOT, lodPath),
        originalVertices: mesh.V.length,
        finalVertices: result.finalVertices,
        reductionPercent:
          ((mesh.V.length - result.finalVertices) / mesh.V.length) * 100,
        processingTimeMs: endTime - startTime,
      };

      logVerbose(
        `  ${levelConfig.name}: ${result.finalVertices} vertices (${lodResults[levelConfig.name].reductionPercent.toFixed(1)}% reduction)`
      );
    }

    logSuccess(`Generated LODs for ${assetInfo.id}`);
    return lodResults;
  } catch (error) {
    logError(`Failed to generate LODs for ${assetInfo.id}: ${error.message}`);
    return null;
  }
}

// =============================================================================
// MANIFEST UPDATE
// =============================================================================

async function updateVegetationManifest(generated, lodResults, options) {
  if (options.dryRun) {
    log("Would update vegetation manifest");
    return;
  }

  const manifestPath = path.join(
    PROJECT_ROOT,
    "packages/server/world/assets/manifests/vegetation.json"
  );

  // Assets base directory (paths in manifest are relative to this)
  const assetsBaseDir = path.join(PROJECT_ROOT, "packages/server/world/assets");

  let manifest = {
    version: 2,
    description: "Vegetation asset definitions for procedural world generation",
    assets: [],
  };

  // Load existing manifest if it exists
  try {
    const existing = await fs.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(existing);
  } catch {
    // Start fresh
  }

  // Update or add assets
  const existingIds = new Set(manifest.assets.map((a) => a.id));

  for (const asset of generated) {
    if (!asset.path) continue; // Skip dry-run entries

    // Convert paths to be relative to assets directory
    const fullPath = path.join(PROJECT_ROOT, asset.path);
    const relativePath = path.relative(assetsBaseDir, fullPath);

    const entry = {
      id: asset.id,
      model: relativePath,
      category: asset.type,
      baseScale: asset.type === "tree" ? 4.0 : asset.type === "rock" ? 1.0 : 0.5,
      scaleVariation: [0.8, 1.2],
      randomRotation: true,
      weight: 5,
      maxSlope: 0.5,
      alignToNormal: asset.type !== "tree",
      yOffset: 0,
      metadata: {
        preset: asset.presetName,
        seed: asset.seed,
        vertices: asset.vertices,
        triangles: asset.triangles,
        generatedAt: new Date().toISOString(),
      },
    };

    // Add LOD paths if available (also relative to assets directory)
    const lods = lodResults[asset.id];
    if (lods) {
      if (lods.lod1) {
        const lod1FullPath = path.join(PROJECT_ROOT, lods.lod1.path);
        entry.lod1Model = path.relative(assetsBaseDir, lod1FullPath);
      }
      if (lods.lod2) {
        const lod2FullPath = path.join(PROJECT_ROOT, lods.lod2.path);
        entry.lod2Model = path.relative(assetsBaseDir, lod2FullPath);
      }
    }

    if (existingIds.has(asset.id)) {
      // Update existing
      const index = manifest.assets.findIndex((a) => a.id === asset.id);
      manifest.assets[index] = { ...manifest.assets[index], ...entry };
    } else {
      // Add new
      manifest.assets.push(entry);
    }
  }

  // Write updated manifest
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  logSuccess(`Updated vegetation manifest with ${generated.length} assets`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const options = parseArgs();
  verbose = options.verbose;

  console.log("=".repeat(60));
  console.log("Vegetation Generation and LOD Baking Pipeline");
  console.log("=".repeat(60));

  // Initialize Three.js
  await initThree();

  if (options.dryRun) {
    log("DRY RUN MODE - No files will be created");
  }

  log(`Output directory: ${options.output}`);
  log(`Count per type: ${options.count}`);
  log(`Seed: ${options.seed}`);

  const allGenerated = [];

  // Generate vegetation
  if (options.all || options.type === "tree") {
    log("\n--- Generating Trees ---");
    const trees = await generateTrees(options);
    allGenerated.push(...trees);
  }

  if (options.all || options.type === "rock") {
    log("\n--- Generating Rocks ---");
    const rocks = await generateRocks(options);
    allGenerated.push(...rocks);
  }

  if (options.all || options.type === "plant") {
    log("\n--- Generating Plants ---");
    const plants = await generatePlants(options);
    allGenerated.push(...plants);
  }

  // Generate LODs
  const lodResults = {};
  if (!options.skipLOD && allGenerated.some((a) => a.path)) {
    log("\n--- Generating LODs ---");
    for (const asset of allGenerated) {
      if (!asset.path) continue;
      const lods = await generateLODsForAsset(asset, options);
      if (lods) {
        lodResults[asset.id] = lods;
      }
    }
  }

  // Update manifest
  if (!options.skipManifest) {
    log("\n--- Updating Manifest ---");
    await updateVegetationManifest(allGenerated, lodResults, options);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`Total assets generated: ${allGenerated.length}`);

  const byType = {};
  for (const asset of allGenerated) {
    byType[asset.type] = (byType[asset.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`LOD levels generated: ${Object.keys(lodResults).length}`);

  if (!options.dryRun) {
    console.log(`\nAssets written to: ${path.join(PROJECT_ROOT, options.output)}`);
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
