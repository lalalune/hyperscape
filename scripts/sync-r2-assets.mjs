#!/usr/bin/env node
/**
 * Sync all game assets to Cloudflare R2 bucket
 * 
 * This script uploads all assets from packages/server/world/assets/ to the
 * hyperia-assets R2 bucket for CDN delivery.
 * 
 * Usage:
 *   bun run sync:r2           # Sync all assets
 *   bun run sync:r2 --dry-run # Show what would be uploaded
 *   bun run sync:r2 --force   # Re-upload all files (skip cache check)
 */

import { execSync } from "child_process";
import { readdirSync, statSync, existsSync } from "fs";
import { join, extname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const ASSETS_DIR = join(ROOT_DIR, "packages/server/world/assets");
const BUCKET_NAME = "hyperia-assets";

// Content type mapping
const CONTENT_TYPES = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".vrm": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".svg": "image/svg+xml",
};

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const VERBOSE = args.includes("--verbose") || args.includes("-v");

// File extensions to include
const ASSET_EXTENSIONS = new Set([
  ".mp3", ".ogg", ".wav",           // Audio
  ".json",                           // Manifests/data
  ".glb", ".gltf", ".vrm",          // 3D models
  ".png", ".jpg", ".jpeg", ".webp", // Images
  ".ktx2",                          // Compressed textures
  ".wasm", ".js",                   // WebAssembly/Scripts
  ".hdr", ".cube", ".3dl",          // HDR/LUT files
]);

// Directories to skip
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  ".cache",
]);

/**
 * Recursively get all asset files in a directory
 */
function getAllFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip certain directories
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      
      getAllFiles(fullPath, files);
    } else if (entry.isFile()) {
      // Skip hidden files and non-asset files
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "Thumbs.db") continue;
      
      // Only include files with known asset extensions
      const ext = extname(entry.name).toLowerCase();
      if (!ASSET_EXTENSIONS.has(ext)) continue;
      
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Get content type for a file
 */
function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

/**
 * Upload a file to R2
 */
function uploadFile(localPath, r2Key, contentType) {
  const cmd = `bunx wrangler r2 object put "${BUCKET_NAME}/${r2Key}" --file="${localPath}" --content-type="${contentType}" --remote`;
  
  if (VERBOSE) {
    console.log(`  Command: ${cmd}`);
  }
  
  try {
    execSync(cmd, { 
      cwd: ROOT_DIR, 
      stdio: VERBOSE ? "inherit" : "pipe",
      encoding: "utf-8"
    });
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to upload ${r2Key}: ${error.message}`);
    return false;
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log("🚀 Syncing assets to Cloudflare R2");
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Source: ${ASSETS_DIR}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : FORCE ? "FORCE" : "Normal"}`);
  console.log("");

  if (!existsSync(ASSETS_DIR)) {
    console.error(`❌ Assets directory not found: ${ASSETS_DIR}`);
    process.exit(1);
  }

  // Get all files
  const allFiles = getAllFiles(ASSETS_DIR);
  console.log(`📦 Found ${allFiles.length} files to sync\n`);

  // Group files by type for reporting
  const byType = {};
  for (const file of allFiles) {
    const ext = extname(file).toLowerCase() || "other";
    byType[ext] = (byType[ext] || 0) + 1;
  }
  
  console.log("📊 Files by type:");
  for (const [ext, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${ext}: ${count}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("🔍 DRY RUN - Files that would be uploaded:");
    for (const file of allFiles.slice(0, 20)) {
      const r2Key = relative(ASSETS_DIR, file);
      const contentType = getContentType(file);
      console.log(`   ${r2Key} (${contentType})`);
    }
    if (allFiles.length > 20) {
      console.log(`   ... and ${allFiles.length - 20} more files`);
    }
    console.log("\n✅ Dry run complete. Run without --dry-run to upload.");
    return;
  }

  // Upload files
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  const startTime = Date.now();

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const r2Key = relative(ASSETS_DIR, file);
    const contentType = getContentType(file);
    const fileSize = statSync(file).size;
    const fileSizeKB = (fileSize / 1024).toFixed(1);

    // Progress indicator
    const progress = `[${i + 1}/${allFiles.length}]`;
    process.stdout.write(`\r${progress} Uploading ${r2Key} (${fileSizeKB} KB)...`.padEnd(80));

    const success = uploadFile(file, r2Key, contentType);
    
    if (success) {
      uploaded++;
    } else {
      failed++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log("\n");
  console.log("═".repeat(50));
  console.log("📊 Sync Summary");
  console.log("═".repeat(50));
  console.log(`   ✅ Uploaded: ${uploaded}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Time: ${elapsed}s`);
  console.log("═".repeat(50));

  if (failed > 0) {
    console.log("\n⚠️  Some uploads failed. Run with --verbose for details.");
    process.exit(1);
  }

  console.log("\n✅ All assets synced to R2!");
  console.log(`   CDN URL: https://assets.hyperia.club/`);
}

main().catch((error) => {
  console.error("❌ Sync failed:", error);
  process.exit(1);
});
