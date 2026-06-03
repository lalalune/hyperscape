#!/usr/bin/env node
/**
 * Update Manifests with LOD1 Paths
 *
 * Scans asset directories for *_lod1.glb files and updates the corresponding
 * manifests (vegetation.json, biomes.json) with lod1Model paths.
 *
 * Run after bake-lod.sh to update manifests with the generated LOD files.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(PROJECT_ROOT, "assets");
const MANIFESTS_DIR = path.join(ASSETS_DIR, "manifests");

/**
 * Find all LOD1 files in asset directories
 */
async function findLOD1Files() {
  // Note: Rocks are now procedurally generated via @hyperforge/procgen/rock
  // and do not need static LOD GLB files
  const patterns = [
    "vegetation/**/*_lod1.glb",
    "trees/**/*_lod1.glb",
    "grass/**/*_lod1.glb",
  ];

  const lod1Files = new Map();

  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: ASSETS_DIR });
    for (const file of files) {
      // Extract the base model path (without _lod1)
      const basePath = file.replace("_lod1.glb", ".glb");
      lod1Files.set(basePath, file);
    }
  }

  console.log(`Found ${lod1Files.size} LOD1 files`);
  return lod1Files;
}

/**
 * Update vegetation.json manifest
 */
function updateVegetationManifest(lod1Files) {
  const manifestPath = path.join(MANIFESTS_DIR, "vegetation.json");

  if (!fs.existsSync(manifestPath)) {
    console.log("vegetation.json not found, skipping");
    return 0;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  let updated = 0;

  // Update documentation
  if (manifest._documentation) {
    manifest._documentation.LOD_SYSTEM = {
      description:
        "3-tier LOD: LOD0 (full) -> LOD1 (pre-baked low poly) -> Imposter (billboard)",
      lod1_source: "Pre-baked using scripts/bake-lod.sh (Blender)",
      lod1Model: "Path to pre-baked LOD1 file (auto-detected from *_lod1.glb)",
    };
    delete manifest._documentation.auto_generation;
    delete manifest._documentation.AUTO_GENERATION_RATIOS;
  }

  // Update assets
  if (manifest.assets) {
    for (const asset of manifest.assets) {
      if (asset.model) {
        // Check if LOD1 exists for this model
        const lod1Path = lod1Files.get(asset.model);
        if (lod1Path) {
          asset.lod1Model = lod1Path;
          updated++;
          console.log(`  ${asset.id}: ${asset.model} -> ${lod1Path}`);
        }
      }
    }
  }

  // Update version
  manifest.version = 3;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Updated vegetation.json: ${updated} assets with LOD1 paths`);
  return updated;
}

/**
 * Update biomes.json with LOD1 paths in vegetation configs
 */
function updateBiomesManifest(lod1Files) {
  const manifestPath = path.join(MANIFESTS_DIR, "biomes.json");

  if (!fs.existsSync(manifestPath)) {
    console.log("biomes.json not found, skipping");
    return 0;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  let updated = 0;

  // Recursively update vegetation references in biomes
  function updateVegetationRefs(obj) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      obj.forEach(updateVegetationRefs);
      return;
    }

    // If this object has a 'model' property, check for LOD1
    if (obj.model && typeof obj.model === "string") {
      const lod1Path = lod1Files.get(obj.model);
      if (lod1Path && !obj.lod1Model) {
        obj.lod1Model = lod1Path;
        updated++;
      }
    }

    // Recurse into nested objects
    for (const key of Object.keys(obj)) {
      updateVegetationRefs(obj[key]);
    }
  }

  updateVegetationRefs(manifest);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Updated biomes.json: ${updated} vegetation refs with LOD1 paths`);
  return updated;
}

/**
 * Main entry point
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Update Manifests with LOD1 Paths");
  console.log("=".repeat(60));
  console.log(`Assets dir: ${ASSETS_DIR}`);
  console.log(`Manifests dir: ${MANIFESTS_DIR}`);
  console.log("");

  // Find all LOD1 files
  const lod1Files = await findLOD1Files();

  if (lod1Files.size === 0) {
    console.log("No LOD1 files found. Run bake-lod.sh first.");
    process.exit(0);
  }

  console.log("");

  // Update manifests
  let totalUpdated = 0;
  totalUpdated += updateVegetationManifest(lod1Files);
  totalUpdated += updateBiomesManifest(lod1Files);

  console.log("");
  console.log("=".repeat(60));
  console.log(`Total: Updated ${totalUpdated} asset references`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
