/**
 * Export Script: Asset Forge → Assets Repo
 * Syncs approved assets to the deployable assets repository
 */

import "dotenv/config";
import { db } from "../server/db/db";
import { assets } from "../server/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

// Configuration
const ASSETS_REPO_PATH =
  process.env.ASSETS_REPO_PATH || "/Users/home/Downloads/assets-main";
const GDD_ASSETS_PATH = path.join(process.cwd(), "gdd-assets");

interface ManifestEntry {
  characterId?: string;
  itemId?: string;
  name: string;
  type: string;
  description: string;
  modelPath: string;
  iconPath?: string;
  [key: string]: any;
}

/**
 * Main export function
 */
async function exportApprovedAssets() {
  console.log("🚀 Starting asset export...\n");

  // Check if assets repo path exists
  try {
    await fs.access(ASSETS_REPO_PATH);
  } catch (error) {
    console.error(`❌ Assets repo not found at: ${ASSETS_REPO_PATH}`);
    console.error(
      "Set ASSETS_REPO_PATH environment variable to your local assets repo clone",
    );
    process.exit(1);
  }

  // Query approved assets that haven't been published yet
  const approvedAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.status, "approved"));

  if (approvedAssets.length === 0) {
    console.log("✨ No approved assets to export");
    return;
  }

  console.log(`Found ${approvedAssets.length} approved assets:\n`);

  const results = {
    success: [] as string[],
    failed: [] as string[],
  };

  // Process each asset
  for (const asset of approvedAssets) {
    try {
      console.log(`📦 Processing: ${asset.name} (${asset.type})`);

      // 1. Copy GLB file
      const sourceDir = path.join(GDD_ASSETS_PATH, asset.name);
      const targetDir = path.join(ASSETS_REPO_PATH, "models", asset.type);

      // Find GLB file in source
      const files = await fs.readdir(sourceDir);
      const glbFile = files.find((f) => f.endsWith(".glb"));

      if (!glbFile) {
        throw new Error(`No GLB file found in ${sourceDir}`);
      }

      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Copy file
      const sourcePath = path.join(sourceDir, glbFile);
      const targetPath = path.join(targetDir, `${asset.name}.glb`);

      await fs.copyFile(sourcePath, targetPath);
      console.log(
        `  ✓ Copied: ${glbFile} → models/${asset.type}/${asset.name}.glb`,
      );

      // 2. Generate manifest entry
      const manifestEntry = generateManifestEntry(asset, targetPath);

      // 3. Update manifest file
      await updateManifest(asset.type, manifestEntry);
      console.log(`  ✓ Updated manifest: manifests/${asset.type}s.json`);

      // 4. Mark as published in database
      await db
        .update(assets)
        .set({
          status: "published",
          exportedToRepo: new Date(),
        })
        .where(eq(assets.id, asset.id));

      console.log(`  ✓ Marked as published in database\n`);

      results.success.push(asset.name);
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}\n`);
      results.failed.push(asset.name);
    }
  }

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Export Summary\n");
  console.log(`✅ Success: ${results.success.length}`);
  results.success.forEach((name) => console.log(`   - ${name}`));

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach((name) => console.log(`   - ${name}`));
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📌 Next Steps:");
  console.log(`   1. Review changes in: ${ASSETS_REPO_PATH}`);
  console.log("   2. cd to assets repo and run: git diff");
  console.log("   3. Commit and push to deploy:");
  console.log("      git add .");
  console.log('      git commit -m "Add exported assets from Asset Forge"');
  console.log("      git push");
  console.log("\n✨ Railway will auto-deploy the updated assets!");
}

/**
 * Generate manifest entry for an asset
 */
function generateManifestEntry(asset: any, modelPath: string): ManifestEntry {
  const baseEntry: ManifestEntry = {
    name: asset.name,
    type: asset.type,
    description: asset.description || `A ${asset.type} asset`,
    modelPath: `asset://models/${asset.type}/${asset.name}.glb`,
  };

  // Type-specific fields
  if (asset.type === "character") {
    return {
      characterId: asset.name.toLowerCase().replace(/\s+/g, "_"),
      characterType: "npc",
      ...baseEntry,
      level: 1,
      maxHealth: 100,
      currentHealth: 100,
      attackPower: 5,
      defense: 5,
      attackSpeed: 1.0,
      faction: "neutral",
      services: [],
      canBeAttacked: true,
      retaliates: true,
      movementType: "wander",
      moveSpeed: 1.0,
      ...((asset.metadata as any)?.gameProperties || {}),
    };
  }

  if (asset.type === "item") {
    return {
      itemId: asset.name.toLowerCase().replace(/\s+/g, "_"),
      ...baseEntry,
      category: asset.category || "misc",
      stackable: true,
      maxStack: 99,
      value: 10,
      ...((asset.metadata as any)?.gameProperties || {}),
    };
  }

  return baseEntry;
}

/**
 * Update manifest JSON file
 */
async function updateManifest(assetType: string, entry: ManifestEntry) {
  const manifestPath = path.join(
    ASSETS_REPO_PATH,
    "manifests",
    `${assetType}s.json`,
  );

  // Read existing manifest
  let manifest: any = { [assetType + "s"]: [] };

  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(content);
  } catch (error) {
    // Manifest doesn't exist, create new one
    console.log(`  📝 Creating new manifest: ${assetType}s.json`);
  }

  // Add or update entry
  const entries = manifest[assetType + "s"] || [];
  const idField =
    assetType === "character"
      ? "characterId"
      : assetType === "item"
        ? "itemId"
        : "id";
  const existingIndex = entries.findIndex(
    (e: any) => e[idField] === entry[idField],
  );

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  manifest[assetType + "s"] = entries;

  // Write back to file
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

// Run export
exportApprovedAssets()
  .then(() => {
    console.log("\n✅ Export complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Export failed:", error);
    process.exit(1);
  });
