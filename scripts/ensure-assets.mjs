#!/usr/bin/env node
/**
 * Ensure Assets Script
 *
 * Automatically downloads game assets if missing.
 * Runs as postinstall hook - new devs get assets automatically.
 *
 * Behavior:
 * - If /packages/server/world/assets/ has content → skip (preserves custom assets)
 * - If empty or missing → clone from GitHub assets repo
 */

import { existsSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const assetsDir = path.join(rootDir, "packages/server/world/assets");
const assetsRepo = "https://github.com/HyperscapeAI/assets.git";

function hasContent(dir) {
  if (!existsSync(dir)) return false;
  try {
    const files = readdirSync(dir);
    // Ignore hidden files like .gitkeep
    return files.some((f) => !f.startsWith("."));
  } catch {
    return false;
  }
}

function checkGitLfs() {
  try {
    execSync("git lfs version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function printLfsInstallInstructions() {
  console.error(`
⚠️  Git LFS is required for game assets

Install it for your platform:
  macOS:   brew install git-lfs
  Ubuntu:  sudo apt install git-lfs
  Windows: Download from https://git-lfs.com

Then re-run:
  bun install
`);
}

async function main() {
  console.log("📦 Checking game assets...");

  if (hasContent(assetsDir)) {
    console.log("✅ Assets already present");
    return;
  }

  // Check for git-lfs before attempting download
  if (!checkGitLfs()) {
    printLfsInstallInstructions();
    process.exit(1);
  }

  // Initialize git-lfs (safe to run multiple times, ignore errors if already set up)
  try {
    execSync("git lfs install", { stdio: "ignore" });
  } catch {
    // May fail if already initialized or in CI environments - that's ok
  }

  console.log("📥 Downloading game assets (~200MB)...");
  console.log(`   From: ${assetsRepo}`);
  console.log(`   To: ${assetsDir}`);

  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(assetsDir);
    if (!existsSync(parentDir)) {
      execSync(`mkdir -p "${parentDir}"`, { stdio: "inherit" });
    }

    // Clone with depth 1 for faster download (keep .git for future syncs)
    try {
      execSync(`git clone --depth 1 ${assetsRepo} "${assetsDir}"`, {
        stdio: "inherit",
        cwd: rootDir,
      });
    } catch (e) {
      console.warn("⚠️ Standard clone failed (likely LFS budget). Retrying without LFS blobs...");
      // Cleanup failed partial clone
      execSync(`rm -rf "${assetsDir}"`, { stdio: "ignore" });
      
      // Retry with smudge skipped
      execSync(`git clone --depth 1 ${assetsRepo} "${assetsDir}"`, {
        stdio: "inherit",
        cwd: rootDir,
        env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" }
      });
      console.warn("⚠️ Assets downloaded as LFS pointers only. Binary files are missing.");
    }

    console.log("✅ Assets downloaded successfully!");
    console.log("   Run 'bun run assets:sync' to update assets later");
  } catch (error) {
    console.error("❌ Failed to download assets:", error.message);
    console.error("   You can manually clone:");
    console.error(`   git clone ${assetsRepo} ${assetsDir}`);
    // Do not exit with error in CI if fallback works, but if fallback failed, we crash.
    // Actually, distinct try/catch above handles the fallback. 
    // This outer catch handles IF THE FALLBACK ALSO FAILS.
    process.exit(1);
  }
}

main();
