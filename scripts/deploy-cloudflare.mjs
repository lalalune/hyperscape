#!/usr/bin/env node
/**
 * Cloudflare Deployment Script for Hyperia
 *
 * This script handles deployment to Cloudflare services:
 * 1. Deploy frontend to Cloudflare Pages
 * 2. Upload game assets to Cloudflare R2
 *
 * Prerequisites:
 *   - Install Wrangler: npm install -g wrangler
 *   - Login: wrangler login
 *   - Create R2 bucket: wrangler r2 bucket create hyperia-assets
 *   - Create Pages project: wrangler pages project create hyperia-client
 *
 * Usage:
 *   node scripts/deploy-cloudflare.mjs [--frontend] [--assets] [--all]
 *
 * Options:
 *   --frontend    Deploy frontend to Cloudflare Pages
 *   --assets      Upload assets to Cloudflare R2
 *   --all         Deploy everything (default)
 *   --production  Deploy to production (vs preview)
 *
 * Environment Variables:
 *   CLOUDFLARE_ACCOUNT_ID  - Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN   - API token with R2 and Pages permissions
 *   R2_BUCKET_NAME         - R2 bucket name (default: hyperia-assets)
 *   PAGES_PROJECT_NAME     - Pages project name (default: hyperia-client)
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, dirname, extname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  frontend: args.includes("--frontend") || args.includes("--all") || args.length === 0,
  assets: args.includes("--assets") || args.includes("--all") || args.length === 0,
  production: args.includes("--production") || args.includes("--prod"),
};

// Configuration
// Account ID: 50ad2052bbc6ca528d6993a689b419a4
const config = {
  r2BucketName: process.env.R2_BUCKET_NAME || "hyperia-assets",
  pagesProjectName: process.env.PAGES_PROJECT_NAME || "hyperia",
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "50ad2052bbc6ca528d6993a689b419a4",
};

// Color output helpers
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.bright}${colors.blue}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT_DIR,
      encoding: "utf-8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

// Content type mappings for game assets
const CONTENT_TYPES = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".vrm": "model/gltf-binary",
  ".ktx2": "image/ktx2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".cube": "text/plain",
  ".3dl": "text/plain",
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
};

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

// ============================================================================
// Frontend Deployment (Cloudflare Pages)
// ============================================================================
async function deployFrontend() {
  logStep("FRONTEND", "Deploying frontend to Cloudflare Pages...");

  const clientDir = join(ROOT_DIR, "packages/client");
  const distDir = join(clientDir, "dist");

  // Step 1: Build shared package first
  logStep("1/4", "Building shared package...");
  exec("bun run build:shared");
  logSuccess("Shared package built");

  // Step 2: Build frontend
  logStep("2/4", "Building frontend...");
  
  // Build with production env vars
  // These should be set in Cloudflare Pages dashboard for runtime
  exec("bun run build", { cwd: clientDir });
  logSuccess("Frontend built");

  // Verify build output
  if (!existsSync(distDir)) {
    logError("Build failed - dist directory not found");
    process.exit(1);
  }

  // Step 3: Deploy to Cloudflare Pages
  logStep("3/4", "Deploying to Cloudflare Pages...");
  
  const branch = flags.production ? "main" : "preview";
  const deployCmd = `wrangler pages deploy dist --project-name=${config.pagesProjectName} --branch=${branch}`;
  
  exec(deployCmd, { cwd: clientDir });
  logSuccess("Deployed to Cloudflare Pages");

  // Step 4: Show URLs
  logStep("4/4", "Deployment complete!");
  
  if (flags.production) {
    log(`\n📡 Production URL: https://${config.pagesProjectName}.pages.dev`);
  } else {
    log(`\n📡 Preview deployment created - check Wrangler output for URL`);
  }
  
  log(`\n${colors.cyan}Frontend deployment complete!${colors.reset}`);
}

// ============================================================================
// Assets Deployment (Cloudflare R2)
// ============================================================================
async function deployAssets() {
  logStep("ASSETS", "Uploading game assets to Cloudflare R2...");

  const assetsDir = join(ROOT_DIR, "assets");
  const manifestsDir = join(ROOT_DIR, "packages/server/world/assets/manifests");

  // Step 1: Count assets
  logStep("1/4", "Analyzing assets...");
  
  let totalFiles = 0;
  let totalSize = 0;
  const filesToUpload = [];

  function collectFiles(dir, prefix = "") {
    if (!existsSync(dir)) return;
    
    const items = readdirSync(dir);
    for (const item of items) {
      // Skip hidden files and directories
      if (item.startsWith(".")) continue;
      
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      const key = prefix ? `${prefix}/${item}` : item;
      
      if (stat.isDirectory()) {
        collectFiles(fullPath, key);
      } else {
        totalFiles++;
        totalSize += stat.size;
        filesToUpload.push({ path: fullPath, key });
      }
    }
  }

  // Collect assets from both directories
  if (existsSync(assetsDir)) {
    collectFiles(assetsDir);
  }
  
  // Collect manifests (put them in /manifests/ prefix)
  if (existsSync(manifestsDir)) {
    const manifestFiles = [];
    function collectManifests(dir, prefix = "manifests") {
      const items = readdirSync(dir);
      for (const item of items) {
        if (item.startsWith(".")) continue;
        
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        const key = `${prefix}/${item}`;
        
        if (stat.isDirectory()) {
          collectManifests(fullPath, key);
        } else {
          totalFiles++;
          totalSize += stat.size;
          filesToUpload.push({ path: fullPath, key });
        }
      }
    }
    collectManifests(manifestsDir);
  }
  
  logSuccess(`Found ${totalFiles} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

  if (filesToUpload.length === 0) {
    log(`${colors.yellow}⚠ No files to upload${colors.reset}`);
    return;
  }

  // Step 2: Upload files to R2
  logStep("2/4", `Uploading ${filesToUpload.length} files to R2 bucket: ${config.r2BucketName}...`);
  
  let uploaded = 0;
  let failed = 0;
  
  for (const file of filesToUpload) {
    const contentType = getContentType(file.path);
    
    try {
      // Use wrangler r2 object put
      const cmd = `wrangler r2 object put "${config.r2BucketName}/${file.key}" --file="${file.path}" --content-type="${contentType}"`;
      exec(cmd, { silent: true });
      uploaded++;
      
      // Show progress every 50 files
      if (uploaded % 50 === 0) {
        log(`  Uploaded ${uploaded}/${filesToUpload.length} files...`);
      }
    } catch (error) {
      failed++;
      log(`${colors.yellow}  ⚠ Failed to upload: ${file.key}${colors.reset}`);
    }
  }
  
  logSuccess(`Uploaded ${uploaded} files${failed > 0 ? `, ${failed} failed` : ""}`);

  // Step 3: Configure public access (if not already)
  logStep("3/4", "Verifying R2 public access...");
  log(`  Make sure your R2 bucket has public access enabled:`);
  log(`  1. Go to Cloudflare dashboard → R2 → ${config.r2BucketName}`);
  log(`  2. Settings → Public access → Enable`);
  log(`  3. Note the public URL (e.g., https://pub-xxx.r2.dev)`);
  
  // Step 4: Done
  logStep("4/4", "Asset deployment complete!");
  
  log(`\n${colors.cyan}Assets deployment complete!${colors.reset}`);
  log(`\nTo get the CDN URL, go to:`);
  log(`  Cloudflare Dashboard → R2 → ${config.r2BucketName} → Settings`);
  log(`  Copy the "Public R2.dev URL" or configure a custom domain`);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║               HYPERIA CLOUDFLARE DEPLOYMENT                    ║
╠══════════════════════════════════════════════════════════════════╣
║  R2 Bucket: ${config.r2BucketName.padEnd(50)}║
║  Pages Project: ${config.pagesProjectName.padEnd(46)}║
║  Mode: ${(flags.production ? "Production" : "Preview").padEnd(55)}║
╚══════════════════════════════════════════════════════════════════╝
`);

  // Check Wrangler
  try {
    exec("wrangler --version", { silent: true });
  } catch {
    logError("Wrangler not found. Please install: npm install -g wrangler");
    log("Then login: wrangler login");
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    if (flags.assets) {
      await deployAssets();
    }

    if (flags.frontend) {
      await deployFrontend();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`
${colors.bright}${colors.green}
╔══════════════════════════════════════════════════════════════════╗
║                    DEPLOYMENT COMPLETE! 🎉                        ║
╠══════════════════════════════════════════════════════════════════╣
║  Duration: ${duration}s${" ".repeat(52 - duration.length)}║
╚══════════════════════════════════════════════════════════════════╝
${colors.reset}`);

    log("\n📝 Next steps:");
    log("   1. Set environment variables in Cloudflare Pages dashboard:");
    log("      PUBLIC_WS_URL, PUBLIC_CDN_URL, PUBLIC_PRIVY_APP_ID");
    log("   2. Configure custom domains if needed");
    log("   3. Update CI/CD workflows with Cloudflare credentials");

  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
