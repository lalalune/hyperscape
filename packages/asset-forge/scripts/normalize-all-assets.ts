#!/usr/bin/env node
/**
 * Asset Normalization Script
 * Normalizes all existing assets to meet standard conventions
 */

import { promises as fs } from "fs";
import { join } from "path";
import chalk from "chalk";
import { AssetNormalizationService } from "../src/services/processing/AssetNormalizationService";
import { WeaponHandleDetector } from "../src/services/processing/WeaponHandleDetector";

import { AssetMetadata, ExtendedAssetMetadata } from "../src/types";

async function getAllAssets(): Promise<
  Array<{ id: string; metadata: ExtendedAssetMetadata }>
> {
  const assetsDir = join(process.cwd(), "gdd-assets");
  const dirs = await fs.readdir(assetsDir);

  const assets: Array<{ id: string; metadata: ExtendedAssetMetadata }> = [];

  for (const dir of dirs) {
    const metadataPath = join(assetsDir, dir, "metadata.json");
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));
      assets.push({ id: dir, metadata });
    } catch (error) {
      // Skip directories without metadata
    }
  }

  return assets;
}

async function normalizeWeapon(assetId: string): Promise<void> {
  console.log(chalk.blue(`  Normalizing weapon: ${assetId}`));

  const inputPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    `${assetId}.glb`,
  );
  const backupPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    `${assetId}_backup.glb`,
  );

  // Check if already normalized
  const metadataPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    "metadata.json",
  );
  const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

  if (metadata.normalized) {
    console.log(chalk.gray(`    Already normalized, skipping`));
    return;
  }

  try {
    // Backup original
    await fs.copyFile(inputPath, backupPath);

    // Use WeaponHandleDetector for weapons
    const detector = new WeaponHandleDetector();
    const result = await detector.exportNormalizedWeapon(inputPath, inputPath);

    // Update metadata
    metadata.normalized = true;
    metadata.normalizationDate = new Date().toISOString();
    metadata.dimensions = result.dimensions;

    // Remove old transform data
    delete metadata.gripPoint;
    delete metadata.transform;
    delete metadata.position;
    delete metadata.rotation;
    delete metadata.scale;

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(chalk.green(`    ✓ Normalized successfully`));
    console.log(
      chalk.gray(
        `    Dimensions: ${result.dimensions.width.toFixed(2)} x ${result.dimensions.length.toFixed(2)} x ${result.dimensions.height.toFixed(2)}`,
      ),
    );
  } catch (error) {
    console.error(chalk.red(`    ✗ Failed: ${error}`));
    // Restore backup if it exists
    try {
      await fs.copyFile(backupPath, inputPath);
    } catch {}
  }
}

async function normalizeCharacter(
  assetId: string,
  targetHeight: number = 1.83,
): Promise<void> {
  console.log(
    chalk.blue(`  Normalizing character: ${assetId} to ${targetHeight}m`),
  );

  const inputPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    `${assetId}.glb`,
  );
  const backupPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    `${assetId}_backup.glb`,
  );

  // Check if already normalized
  const metadataPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    "metadata.json",
  );
  const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

  if (metadata.normalized) {
    console.log(chalk.gray(`    Already normalized, skipping`));
    return;
  }

  try {
    // Backup original
    await fs.copyFile(inputPath, backupPath);

    // Use AssetNormalizationService
    const normalizer = new AssetNormalizationService();
    const result = await normalizer.normalizeCharacter(inputPath, targetHeight);

    // Save normalized model
    await fs.writeFile(inputPath, Buffer.from(result.glb));

    // Update metadata
    metadata.normalized = true;
    metadata.normalizationDate = new Date().toISOString();
    metadata.dimensions = result.metadata.dimensions;
    metadata.characterHeight = targetHeight;

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(chalk.green(`    ✓ Normalized successfully`));
    console.log(
      chalk.gray(
        `    Height: ${result.metadata.dimensions.height.toFixed(2)}m`,
      ),
    );
  } catch (error) {
    console.error(chalk.red(`    ✗ Failed: ${error}`));
    // Restore backup if it exists
    try {
      await fs.copyFile(backupPath, inputPath);
    } catch {}
  }
}

async function normalizeArmor(
  assetId: string,
  armorType: string,
): Promise<void> {
  console.log(chalk.blue(`  Normalizing armor: ${assetId} (${armorType})`));

  const inputPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    `${assetId}.glb`,
  );
  const backupPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    `${assetId}_backup.glb`,
  );

  // Check if already normalized
  const metadataPath = join(
    process.cwd(),
    "gdd-assets",
    assetId,
    "metadata.json",
  );
  const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

  if (metadata.normalized) {
    console.log(chalk.gray(`    Already normalized, skipping`));
    return;
  }

  try {
    // Backup original
    await fs.copyFile(inputPath, backupPath);

    // Use AssetNormalizationService
    const normalizer = new AssetNormalizationService();
    const result = await normalizer.normalizeArmor(inputPath, armorType);

    // Save normalized model
    await fs.writeFile(inputPath, Buffer.from(result.glb));

    // Update metadata
    metadata.normalized = true;
    metadata.normalizationDate = new Date().toISOString();
    metadata.dimensions = result.metadata.dimensions;

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(chalk.green(`    ✓ Normalized successfully`));
  } catch (error) {
    console.error(chalk.red(`    ✗ Failed: ${error}`));
    // Restore backup if it exists
    try {
      await fs.copyFile(backupPath, inputPath);
    } catch {}
  }
}

async function main() {
  console.log(chalk.cyan("🔧 Asset Normalization Script"));
  console.log(chalk.cyan("============================"));

  const assets = await getAllAssets();
  console.log(chalk.yellow(`Found ${assets.length} assets to check`));

  let weaponsNormalized = 0;
  let charactersNormalized = 0;
  let armorNormalized = 0;
  let skipped = 0;

  for (const asset of assets) {
    const { id, metadata } = asset;

    if (!metadata.hasModel) {
      console.log(chalk.gray(`  Skipping ${id} - no model`));
      skipped++;
      continue;
    }

    if (metadata.type === "weapon") {
      await normalizeWeapon(id);
      if (!metadata.normalized) weaponsNormalized++;
    } else if (metadata.type === "character") {
      // riggingOptions might be stored as a custom property in some assets
      const riggingOptions = (
        metadata as ExtendedAssetMetadata & {
          riggingOptions?: { heightMeters?: number };
        }
      ).riggingOptions;
      const height =
        metadata.characterHeight || riggingOptions?.heightMeters || 1.83;
      await normalizeCharacter(id, height);
      if (!metadata.normalized) charactersNormalized++;
    } else if (metadata.type === "armor") {
      await normalizeArmor(id, metadata.subtype || "chest");
      if (!metadata.normalized) armorNormalized++;
    } else {
      console.log(
        chalk.gray(
          `  Skipping ${id} - type ${metadata.type} not supported yet`,
        ),
      );
      skipped++;
    }
  }

  console.log(chalk.green("\n✅ Normalization Complete!"));
  console.log(chalk.white(`   Weapons normalized: ${weaponsNormalized}`));
  console.log(chalk.white(`   Characters normalized: ${charactersNormalized}`));
  console.log(chalk.white(`   Armor normalized: ${armorNormalized}`));
  console.log(chalk.white(`   Skipped: ${skipped}`));

  // Clean up
  if (globalThis.process) {
    process.exit(0);
  }
}

// Run if called directly
main().catch((error) => {
  console.error(chalk.red("Error:"), error);
  process.exit(1);
});

export { main as normalizeAllAssets };
