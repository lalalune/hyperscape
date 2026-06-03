#!/usr/bin/env node
/**
 * AWS Deployment Script for Hyperia
 *
 * This script handles the complete deployment process:
 * 1. Build and push server Docker image to ECR
 * 2. Build and deploy frontend to S3/CloudFront
 * 3. Upload game assets to S3/CloudFront
 * 4. Update ECS service to use new image
 *
 * Usage:
 *   node scripts/deploy-aws.mjs [--server] [--frontend] [--assets] [--asset-forge-api] [--all]
 *
 * Options:
 *   --server          Deploy game server to ECS
 *   --frontend        Deploy frontend to S3/CloudFront
 *   --assets          Upload assets to S3/CloudFront
 *   --asset-forge-api Deploy Asset Forge API to ECS
 *   --all             Deploy everything (default)
 *   --region          AWS region (default: us-east-1)
 *   --env             Environment (default: prod)
 */

import { execSync, spawn } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  server: args.includes("--server") || args.includes("--all") || args.length === 0,
  frontend: args.includes("--frontend") || args.includes("--all") || args.length === 0,
  assets: args.includes("--assets") || args.includes("--all") || args.length === 0,
  assetForgeApi: args.includes("--asset-forge-api") || args.includes("--all") || args.length === 0,
  region: args.find(a => a.startsWith("--region="))?.split("=")[1] || "us-east-1",
  env: args.find(a => a.startsWith("--env="))?.split("=")[1] || "prod",
};

// Configuration
const config = {
  project: "hyperia",
  region: flags.region,
  environment: flags.env,
  accountId: process.env.AWS_ACCOUNT_ID || "",
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

// Get Terraform output
function getTerraformOutput(name) {
  try {
    const result = exec(`terraform -chdir=infrastructure output -raw ${name}`, { silent: true });
    return result?.trim();
  } catch {
    return null;
  }
}

// Get AWS account ID
async function getAccountId() {
  if (config.accountId) return config.accountId;
  try {
    const result = exec("aws sts get-caller-identity --query Account --output text", { silent: true });
    config.accountId = result?.trim();
    return config.accountId;
  } catch {
    logError("Failed to get AWS account ID. Make sure AWS CLI is configured.");
    process.exit(1);
  }
}

// ============================================================================
// Server Deployment
// ============================================================================
async function deployServer() {
  logStep("SERVER", "Deploying game server to ECS...");

  const accountId = await getAccountId();
  const ecrUrl = `${accountId}.dkr.ecr.${config.region}.amazonaws.com`;
  const repoName = `${config.project}-${config.environment}-server`;
  const imageUri = `${ecrUrl}/${repoName}`;

  // Step 1: Authenticate Docker with ECR
  logStep("1/5", "Authenticating with ECR...");
  exec(`aws ecr get-login-password --region ${config.region} | docker login --username AWS --password-stdin ${ecrUrl}`);
  logSuccess("Authenticated with ECR");

  // Step 2: Build shared package
  logStep("2/5", "Building shared package...");
  exec("bun run build:shared");
  logSuccess("Shared package built");

  // Step 3: Build Docker image
  logStep("3/5", "Building Docker image...");
  exec(`docker build -t ${repoName}:latest -f packages/server/Dockerfile .`);
  logSuccess("Docker image built");

  // Step 4: Tag and push image
  logStep("4/5", "Pushing image to ECR...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  exec(`docker tag ${repoName}:latest ${imageUri}:latest`);
  exec(`docker tag ${repoName}:latest ${imageUri}:${timestamp}`);
  exec(`docker push ${imageUri}:latest`);
  exec(`docker push ${imageUri}:${timestamp}`);
  logSuccess(`Pushed image: ${imageUri}:${timestamp}`);

  // Step 5: Update ECS service
  logStep("5/5", "Updating ECS service...");
  const clusterName = `${config.project}-${config.environment}-cluster`;
  const serviceName = `${config.project}-${config.environment}-server`;

  exec(`aws ecs update-service --cluster ${clusterName} --service ${serviceName} --force-new-deployment --region ${config.region}`);
  logSuccess("ECS service updated - new deployment started");

  log(`\n${colors.cyan}Server deployment complete!${colors.reset}`);
  log(`Image: ${imageUri}:${timestamp}`);
  log(`View logs: aws logs tail /ecs/${serviceName} --follow --region ${config.region}`);
}

// ============================================================================
// Frontend Deployment
// ============================================================================
async function deployFrontend() {
  logStep("FRONTEND", "Deploying frontend to S3/CloudFront...");

  const bucketName = getTerraformOutput("frontend_bucket_name") ||
    `${config.project}-${config.environment}-frontend`;
  const distributionId = getTerraformOutput("frontend_cloudfront_id");

  // Get URLs from Terraform outputs for environment config
  const serverUrl = getTerraformOutput("server_url") || `https://${config.project}-${config.environment}-alb.${config.region}.elb.amazonaws.com`;
  const assetsUrl = getTerraformOutput("assets_cdn_url") || `https://${config.project}-${config.environment}-assets.s3.amazonaws.com`;

  // Step 1: Build frontend
  logStep("1/4", "Building frontend...");

  // Get all URLs for frontend environment
  const frontendUrl = getTerraformOutput("frontend_url") || "https://hyperia.club";
  // Backend is hosted on Railway
  const apiUrl = "https://hyperia-production.up.railway.app";
  const wsUrl = "wss://hyperia-production.up.railway.app/ws";

  // Set environment variables for build
  // CRITICAL: Set ALL production URLs to prevent localhost values from .env files
  const buildEnv = {
    ...process.env,
    NODE_ENV: "production",
    // Game server URLs
    PUBLIC_SERVER_URL: serverUrl,
    PUBLIC_API_URL: apiUrl,
    PUBLIC_WS_URL: wsUrl,
    // CDN for assets
    PUBLIC_CDN_URL: assetsUrl,
    // Frontend URL (for OAuth redirects, etc.)
    PUBLIC_APP_URL: frontendUrl,
    // ElizaOS API (uses same server as game API in production)
    PUBLIC_ELIZAOS_URL: apiUrl,
  };

  log(`  Building with production URLs:`);
  log(`    PUBLIC_API_URL: ${buildEnv.PUBLIC_API_URL}`);
  log(`    PUBLIC_WS_URL: ${buildEnv.PUBLIC_WS_URL}`);
  log(`    PUBLIC_CDN_URL: ${buildEnv.PUBLIC_CDN_URL}`);
  log(`    PUBLIC_APP_URL: ${buildEnv.PUBLIC_APP_URL}`);
  log(`    PUBLIC_ELIZAOS_URL: ${buildEnv.PUBLIC_ELIZAOS_URL}`);

  exec("cd packages/client && bun run build", { env: buildEnv });
  logSuccess("Frontend built");

  // Step 2: Sync to S3
  logStep("2/4", "Uploading to S3...");
  exec(`aws s3 sync packages/client/dist s3://${bucketName} --delete --region ${config.region}`);
  logSuccess(`Uploaded to s3://${bucketName}`);

  // Step 3: Set MIME types and cache headers for different file types
  logStep("3/4", "Setting MIME types and cache headers...");

  // HTML files - no cache (always fetch latest)
  exec(`aws s3 cp s3://${bucketName} s3://${bucketName} --recursive --exclude "*" --include "*.html" --metadata-directive REPLACE --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html" --region ${config.region}`);

  // JS files - set correct MIME type and long cache
  exec(`aws s3 cp s3://${bucketName}/assets s3://${bucketName}/assets --recursive --exclude "*" --include "*.js" --metadata-directive REPLACE --content-type "application/javascript" --cache-control "public, max-age=31536000, immutable" --region ${config.region}`, { ignoreError: true });

  // CSS files - set correct MIME type and long cache
  exec(`aws s3 cp s3://${bucketName}/assets s3://${bucketName}/assets --recursive --exclude "*" --include "*.css" --metadata-directive REPLACE --content-type "text/css" --cache-control "public, max-age=31536000, immutable" --region ${config.region}`, { ignoreError: true });

  logSuccess("MIME types and cache headers configured");

  // Step 4: Invalidate CloudFront cache
  if (distributionId) {
    logStep("4/4", "Invalidating CloudFront cache...");
    exec(`aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*" --region us-east-1`);
    logSuccess("CloudFront cache invalidated");
  } else {
    log(`${colors.yellow}⚠ CloudFront distribution ID not found - skipping invalidation${colors.reset}`);
  }

  log(`\n${colors.cyan}Frontend deployment complete!${colors.reset}`);
  log(`URL: ${frontendUrl}`);
}

// ============================================================================
// Assets Deployment
// ============================================================================
async function deployAssets() {
  logStep("ASSETS", "Uploading game assets to S3/CloudFront...");

  const bucketName = getTerraformOutput("assets_bucket_name") ||
    `${config.project}-${config.environment}-assets`;
  const distributionId = getTerraformOutput("assets_cloudfront_id");

  const assetsDir = join(ROOT_DIR, "assets");
  const manifestsDir = join(ROOT_DIR, "packages/server/world/assets/manifests");

  if (!existsSync(assetsDir)) {
    logError(`Assets directory not found: ${assetsDir}`);
    return;
  }

  // Step 1: Count assets
  logStep("1/3", "Analyzing assets...");
  let totalFiles = 0;
  let totalSize = 0;

  function countFiles(dir) {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        countFiles(fullPath);
      } else {
        totalFiles++;
        totalSize += stat.size;
      }
    }
  }
  countFiles(assetsDir);
  logSuccess(`Found ${totalFiles} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

  // Step 2: Sync assets to S3
  logStep("2/3", "Uploading assets to S3...");

  // Content type mappings for game assets
  const contentTypes = {
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
  };

  // Sync with proper content types
  // Upload to root of bucket (not /assets/) so paths like /manifests/, /models/, /world/ work correctly
  // Exclude .git directory and other unnecessary files
  exec(`aws s3 sync ${assetsDir} s3://${bucketName} --delete --exclude ".git/*" --exclude ".DS_Store" --exclude "*.git" --region ${config.region}`);

  // Upload manifests from packages/server/world/assets/manifests/ to /manifests/
  if (existsSync(manifestsDir)) {
    log("Uploading manifests to /manifests/...");
    exec(`aws s3 sync ${manifestsDir} s3://${bucketName}/manifests --delete --exclude ".git/*" --exclude ".DS_Store" --region ${config.region}`);
    logSuccess("Manifests uploaded to s3://" + bucketName + "/manifests");
  } else {
    log(`${colors.yellow}⚠ Manifests directory not found at ${manifestsDir} - skipping${colors.reset}`);
  }

  // Set content types for specific extensions
  // This is critical for WASM files which need application/wasm MIME type
  for (const [ext, contentType] of Object.entries(contentTypes)) {
    const command = `aws s3 cp s3://${bucketName} s3://${bucketName} --recursive --exclude "*" --include "*${ext}" --metadata-directive REPLACE --content-type "${contentType}" --cache-control "public, max-age=31536000" --region ${config.region}`;
    log(`Setting Content-Type for ${ext} files...`);
    exec(command, { ignoreError: true, silent: false });
  }
  
  // Verify WASM files have correct Content-Type
  logStep("VERIFY", "Verifying WASM files have correct Content-Type...");
  const wasmCheck = exec(`aws s3api head-object --bucket ${bucketName} --key web/physx-js-webidl.wasm --region ${config.region}`, { silent: true, ignoreError: true });
  if (wasmCheck) {
    try {
      const metadata = JSON.parse(wasmCheck);
      if (metadata.ContentType === "application/wasm") {
        logSuccess("WASM file has correct Content-Type: application/wasm");
      } else {
        logError(`WASM file has incorrect Content-Type: ${metadata.ContentType} (expected: application/wasm)`);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  logSuccess(`Uploaded to s3://${bucketName}`);

  // Step 3: Invalidate CloudFront cache
  if (distributionId) {
    logStep("3/3", "Invalidating CloudFront cache...");
    exec(`aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*" --region us-east-1`);
    logSuccess("CloudFront cache invalidated");
  } else {
    log(`${colors.yellow}⚠ CloudFront distribution ID not found - skipping invalidation${colors.reset}`);
  }

  const assetsUrl = getTerraformOutput("assets_cdn_url");
  log(`\n${colors.cyan}Assets deployment complete!${colors.reset}`);
  if (assetsUrl) {
    log(`CDN URL: ${assetsUrl}`);
  }
}

// ============================================================================
// Asset Forge API Deployment
// ============================================================================
async function deployAssetForgeApi() {
  logStep("ASSET-FORGE-API", "Deploying Asset Forge API to ECS...");

  const accountId = await getAccountId();
  const ecrUrl = `${accountId}.dkr.ecr.${config.region}.amazonaws.com`;
  const repoName = `${config.project}-${config.environment}-asset-forge-api`;
  const imageUri = `${ecrUrl}/${repoName}`;

  // Step 1: Authenticate Docker with ECR
  logStep("1/5", "Authenticating with ECR...");
  exec(`aws ecr get-login-password --region ${config.region} | docker login --username AWS --password-stdin ${ecrUrl}`);
  logSuccess("Authenticated with ECR");

  // Step 2: Build Docker image
  logStep("2/5", "Building Docker image...");
  exec(`docker build -t ${repoName}:latest -f packages/asset-forge/Dockerfile packages/asset-forge`);
  logSuccess("Docker image built");

  // Step 3: Tag and push image
  logStep("3/5", "Pushing image to ECR...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  exec(`docker tag ${repoName}:latest ${imageUri}:latest`);
  exec(`docker tag ${repoName}:latest ${imageUri}:${timestamp}`);
  exec(`docker push ${imageUri}:latest`);
  exec(`docker push ${imageUri}:${timestamp}`);
  logSuccess(`Pushed image: ${imageUri}:${timestamp}`);

  // Step 4: Update ECS service
  logStep("4/5", "Updating ECS service...");
  const clusterName = `${config.project}-${config.environment}-cluster`;
  const serviceName = `${config.project}-${config.environment}-asset-forge-api`;

  exec(`aws ecs update-service --cluster ${clusterName} --service ${serviceName} --force-new-deployment --region ${config.region}`);
  logSuccess("ECS service updated - new deployment started");

  log(`\n${colors.cyan}Asset Forge API deployment complete!${colors.reset}`);
  log(`Image: ${imageUri}:${timestamp}`);
  log(`View logs: aws logs tail /ecs/${serviceName} --follow --region ${config.region}`);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                   HYPERIA AWS DEPLOYMENT                       ║
╠══════════════════════════════════════════════════════════════════╣
║  Region: ${config.region.padEnd(54)}║
║  Environment: ${config.environment.padEnd(49)}║
╚══════════════════════════════════════════════════════════════════╝
`);

  // Check AWS CLI
  try {
    exec("aws --version", { silent: true });
  } catch {
    logError("AWS CLI not found. Please install: https://aws.amazon.com/cli/");
    process.exit(1);
  }

  // Check Docker (if deploying server or asset-forge-api)
  if (flags.server || flags.assetForgeApi) {
    try {
      exec("docker --version", { silent: true });
    } catch {
      logError("Docker not found. Please install Docker to deploy services.");
      process.exit(1);
    }
  }

  const startTime = Date.now();

  try {
    if (flags.server) {
      await deployServer();
    }

    if (flags.frontend) {
      await deployFrontend();
    }

    if (flags.assets) {
      await deployAssets();
    }

    if (flags.assetForgeApi) {
      await deployAssetForgeApi();
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

    // Print URLs
    const serverUrl = getTerraformOutput("server_url");
    const frontendUrl = getTerraformOutput("frontend_url");
    const assetsUrl = getTerraformOutput("assets_cdn_url");
    const assetForgeApiUrl = getTerraformOutput("asset_forge_api_url");

    if (serverUrl || frontendUrl || assetsUrl || assetForgeApiUrl) {
      console.log("Deployed URLs:");
      if (frontendUrl) console.log(`  🌐 Frontend:        ${frontendUrl}`);
      if (serverUrl) console.log(`  🎮 Game Server:     ${serverUrl}`);
      if (assetsUrl) console.log(`  📦 Assets CDN:       ${assetsUrl}`);
      if (assetForgeApiUrl) console.log(`  🔧 Asset Forge API: ${assetForgeApiUrl}`);
    }

  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
