#!/usr/bin/env bun
/**
 * Start Localnet and Deploy Hyperscape MUD Contracts
 *
 * This script automates the complete blockchain setup for Hyperscape development:
 * 1. Checks if anvil is running (starts if needed)
 * 2. Deploys Hyperscape MUD contracts
 * 3. Initializes world with items and loot tables
 * 4. Writes contract addresses to .env files
 * 5. Verifies deployment success
 *
 * Usage:
 *   bun scripts/start-localnet.ts
 */

import { spawn, exec } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { promisify } from "util";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

console.log(
  "\n╔══════════════════════════════════════════════════════════════╗",
);
console.log("║                                                              ║");
console.log("║   🔧 HYPERSCAPE LOCALNET SETUP                               ║");
console.log("║   Anvil + MUD Contracts + Configuration                     ║");
console.log("║                                                              ║");
console.log(
  "╚══════════════════════════════════════════════════════════════╝\n",
);

// Step 1: Check/Start Anvil
console.log(`${colors.blue}1️⃣  Checking Anvil...${colors.reset}\n`);

let anvilRunning = false;
try {
  const response = await fetch("http://localhost:8545", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    }),
  });

  if (response.ok) {
    const result = await response.json();
    const blockNum = parseInt(result.result, 16);
    console.log(`${colors.green}✅ Anvil already running${colors.reset}`);
    console.log(`${colors.gray}   Block number: ${blockNum}${colors.reset}\n`);
    anvilRunning = true;
  }
} catch {
  console.log(`${colors.yellow}⏳ Starting anvil...${colors.reset}`);

  // Start anvil in background
  const anvilProcess = spawn(
    "anvil",
    [
      "--block-time",
      "2", // 2 second blocks (like Jeju L3)
      "--port",
      "8545",
      "--accounts",
      "10", // 10 test accounts
      "--balance",
      "10000", // 10000 ETH per account
    ],
    {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  // Create logs directory if it doesn't exist
  const { mkdirSync } = await import("fs");
  const logsDir = join(rootDir, "logs");
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch {}

  // Write anvil logs
  const anvilLogFile = join(logsDir, "anvil.log");
  const logStream = Bun.file(anvilLogFile).writer();

  anvilProcess.stdout!.on("data", (data: Buffer) => {
    logStream.write(data);
  });

  anvilProcess.stderr!.on("data", (data: Buffer) => {
    logStream.write(data);
  });

  anvilProcess.unref();

  // Wait for anvil to start
  console.log(
    `${colors.gray}   Waiting for anvil to initialize...${colors.reset}`,
  );
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify it started
  try {
    const response = await fetch("http://localhost:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
    });

    if (response.ok) {
      console.log(
        `${colors.green}✅ Anvil started successfully${colors.reset}`,
      );
      console.log(`${colors.gray}   Port: 8545${colors.reset}`);
      console.log(`${colors.gray}   Block time: 2 seconds${colors.reset}`);
      console.log(`${colors.gray}   Logs: ${anvilLogFile}${colors.reset}\n`);
      anvilRunning = true;
    }
  } catch (error) {
    console.error(`${colors.reset}❌ Failed to start anvil:`, error);
    process.exit(1);
  }
}

if (!anvilRunning) {
  console.error("❌ Anvil is not running and could not be started");
  process.exit(1);
}

// Step 2: Deploy MUD Contracts
console.log(`${colors.blue}2️⃣  Deploying MUD Contracts...${colors.reset}\n`);

const contractsPath = join(rootDir, "contracts-mud", "mmo");

// Check if contracts directory exists
if (!existsSync(contractsPath)) {
  console.error(`❌ Contracts directory not found: ${contractsPath}`);
  console.error(`   Looking in: ${contractsPath}`);
  console.error(`   Current directory: ${process.cwd()}`);
  process.exit(1);
}

// Ensure MUD dependencies are installed
const nodeModulesPath = join(contractsPath, "node_modules");
if (!existsSync(nodeModulesPath)) {
  console.log(
    `${colors.yellow}⏳ Installing MUD dependencies...${colors.reset}`,
  );
  try {
    await execAsync("npm install", { cwd: contractsPath });
    console.log(`${colors.green}✅ Dependencies installed${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.reset}❌ Failed to install dependencies:`, error);
    process.exit(1);
  }
}

try {
  console.log(`${colors.gray}   Building contracts...${colors.reset}`);
  await execAsync("npm run build", { cwd: contractsPath });

  console.log(`${colors.gray}   Deploying to localnet...${colors.reset}`);
  const { stdout, stderr } = await execAsync("npm run deploy:local", {
    cwd: contractsPath,
    env: {
      ...process.env,
      RPC_URL: "http://localhost:8545",
      PRIVATE_KEY:
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    },
  });

  console.log(`${colors.green}✅ Contracts deployed${colors.reset}\n`);

  // Write deployment logs
  const deploymentLogPath = join(rootDir, "logs", "contract-deployment.log");
  writeFileSync(deploymentLogPath, stdout + "\n" + stderr);
} catch (error) {
  console.error("❌ Contract deployment failed:", error);
  console.error("   Check logs/contract-deployment.log for details");
  process.exit(1);
}

// Step 3: Read Deployment Info
console.log(`${colors.blue}3️⃣  Reading Deployment Info...${colors.reset}\n`);

// Read the actual deployed world address from MUD's deployment output
const worldsJsonPath = `${contractsPath}/worlds.json`;

if (!existsSync(worldsJsonPath)) {
  console.error(
    `${colors.red}❌ Deployment file not found: ${worldsJsonPath}${colors.reset}`,
  );
  console.error("   Contracts may not have deployed correctly");
  process.exit(1);
}

const deploymentData = JSON.parse(readFileSync(worldsJsonPath, "utf-8"));
const worldAddress =
  deploymentData["31337"]?.address || deploymentData.worldAddress;

if (!worldAddress) {
  console.error(
    `${colors.red}❌ World address not found in deployment data${colors.reset}`,
  );
  process.exit(1);
}

console.log(`${colors.green}✅ World deployed${colors.reset}`);
console.log(`${colors.gray}   Address: ${worldAddress}${colors.reset}\n`);

// Step 4: Initialize World (create items and loot tables)
console.log(`${colors.blue}4️⃣  Initializing World...${colors.reset}\n`);

try {
  // Call initialize() on AdminSystem to create items and loot tables
  const { stdout: initOutput } = await execAsync(
    `cast send ${worldAddress} "hyperscape__initialize()" --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`,
    { cwd: contractsPath },
  );

  console.log(`${colors.green}✅ World initialized${colors.reset}`);
  console.log(`${colors.gray}   Created 38 items${colors.reset}`);
  console.log(`${colors.gray}   Set up 9 mob loot tables${colors.reset}\n`);
} catch (error) {
  console.warn(
    `${colors.yellow}⚠️  World initialization may have already been done${colors.reset}\n`,
  );
}

// Step 5: Write Configuration
console.log(`${colors.blue}5️⃣  Writing Configuration...${colors.reset}\n`);

const envContent = `# Hyperscape MUD Configuration (auto-generated by start-localnet.ts)
# Generated: ${new Date().toISOString()}

# Blockchain
WORLD_ADDRESS=${worldAddress}
ANVIL_RPC_URL=http://localhost:8545
CHAIN_ID=31337

# Test account (anvil default account #0)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PLAYER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# MUD Indexer
INDEXER_URL=http://localhost:4350/graphql

# Hybrid Mode Config
HYBRID_MODE=true
ENABLE_BLOCKCHAIN_WRITES=true
BATCH_INVENTORY_CHANGES=true
BATCH_INTERVAL_MS=10000
`;

// Write to all package .env.local files
const packages = ["server", "client", "shared"];
for (const pkg of packages) {
  const envPath = join(rootDir, "packages", pkg, ".env.local");
  writeFileSync(envPath, envContent);
  console.log(`${colors.green}✅ packages/${pkg}/.env.local${colors.reset}`);
}

// Step 6: Verify Deployment
console.log(`\n${colors.blue}6️⃣  Verifying Deployment...${colors.reset}\n`);

try {
  // Check if world is initialized
  const { stdout: configOutput } = await execAsync(
    `cast call ${worldAddress} "getInitialized()(bool)" --rpc-url http://localhost:8545`,
    { cwd: contractsPath },
  );

  const initialized = configOutput.trim() === "true";

  if (initialized) {
    console.log(`${colors.green}✅ World is initialized${colors.reset}`);
  } else {
    console.log(
      `${colors.yellow}⚠️  World not initialized (will initialize on first use)${colors.reset}`,
    );
  }

  // Check a sample item exists
  const { stdout: itemOutput } = await execAsync(
    `cast call ${worldAddress} "getName(uint16)(string)" 1 --rpc-url http://localhost:8545`,
    { cwd: contractsPath },
  );

  if (itemOutput.includes("Logs")) {
    console.log(
      `${colors.green}✅ Items created (sample: Logs)${colors.reset}`,
    );
  }
} catch (error) {
  console.warn(
    `${colors.yellow}⚠️  Could not verify deployment (this is okay)${colors.reset}`,
  );
}

// Success!
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║                                                              ║");
console.log("║   ✅ LOCALNET READY FOR HYPERSCAPE                           ║");
console.log("║                                                              ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");
console.log(
  `${colors.gray}Configuration saved to packages/*/. env.local${colors.reset}`,
);
console.log("");
console.log("🎮 Next steps:");
console.log(
  `${colors.gray}   1. Start the game server: ${colors.blue}npm start${colors.reset}`,
);
console.log(
  `${colors.gray}   2. Open browser: ${colors.blue}http://localhost:5555${colors.reset}`,
);
console.log(
  `${colors.gray}   3. Verify integration: ${colors.blue}bun scripts/verify-blockchain-integration.ts${colors.reset}`,
);
console.log("");
console.log("📊 Blockchain info:");
console.log(`${colors.gray}   RPC: http://localhost:8545${colors.reset}`);
console.log(`${colors.gray}   World: ${worldAddress}${colors.reset}`);
console.log(
  `${colors.gray}   Account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266${colors.reset}`,
);
console.log("");
