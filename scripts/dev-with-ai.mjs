#!/usr/bin/env bun
/**
 * Development Script with AI (ElizaOS) Integration
 *
 * Runs all Hyperscape dev servers via Turbo AND starts ElizaOS AI agents.
 * Automatically spawns 3 agents in the game world:
 * - Theron (Warrior) - Combat-focused
 * - Mira (Gatherer) - Skilling-focused  
 * - Zephyr (Explorer) - Social/exploration-focused
 *
 * Use this when working on AI agent features.
 *
 * Usage: bun run dev:ai
 * 
 * Environment Variables:
 * - START_ELIZAOS: Set to 'false' to disable ElizaOS
 * - AGENT_COUNT: Number of agents to start (default: 3, max: 3)
 * - ELIZAOS_PORT: Base port for ElizaOS servers (default: 4001)
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Agent configurations
const AGENTS = [
  { name: 'Theron', character: 'warrior.json', port: 4001 },
  { name: 'Mira', character: 'gatherer.json', port: 4002 },
  { name: 'Zephyr', character: 'explorer.json', port: 4003 },
];

// Default localnet wallet address (for e2e testing / local dev)
const DEFAULT_LOCALNET_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
};

console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════╗
║   Starting Hyperscape + AI Agents         ║
╚═══════════════════════════════════════════╝
${colors.reset}`);

// Check if elizaos is available
const checkElizaOS = () => {
  try {
    execSync('which elizaos', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

// ElizaOS can run without config - just check if CLI is available
// Per techstack.mdc: "Eliza runs with 'elizaos start'"
// Start ElizaOS if CLI is available (unless explicitly disabled)
// Default to starting ElizaOS if not explicitly disabled
const shouldStartElizaOS = checkElizaOS() && process.env.START_ELIZAOS !== 'false';

if (!checkElizaOS() && process.env.START_ELIZAOS === 'true') {
  console.log(`${colors.yellow}⚠️  ElizaOS CLI not found in PATH${colors.reset}`);
  console.log(`${colors.yellow}   Install with: bun install -g elizaos${colors.reset}`);
  console.log(`${colors.yellow}   Falling back to Turbo-only dev mode...${colors.reset}\n`);
  
  // Fall back to regular turbo dev
  const turbo = spawn('bun', ['x', 'turbo', 'run', 'dev', '--filter=!3d-asset-forge'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });
  
  turbo.on('error', (err) => {
    console.error(`${colors.red}Failed to start Turbo:${colors.reset}`, err);
    process.exit(1);
  });
  
  process.on('SIGINT', () => {
    turbo.kill();
    process.exit(0);
  });
  
  turbo.on('exit', (code) => {
    process.exit(code || 0);
  });
  
} else if (shouldStartElizaOS) {
  console.log(`${colors.green}✓ Starting all services...${colors.reset}\n`);
  
  // Start Turbo (Hyperscape services)
  console.log(`${colors.blue}[Turbo]${colors.reset} Starting Hyperscape dev servers...`);
  const turbo = spawn('bun', ['x', 'turbo', 'run', 'dev', '--filter=!3d-asset-forge'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });
  
  // Determine how many agents to start
  const agentCount = Math.min(parseInt(process.env.AGENT_COUNT || '3', 10), AGENTS.length);
  const agentsToStart = AGENTS.slice(0, agentCount);
  
  const pluginDir = path.join(rootDir, 'packages', 'plugin-hyperscape');
  const agentsDir = path.join(pluginDir, 'agents');
  
  console.log(`${colors.blue}[ElizaOS]${colors.reset} Starting ${agentCount} AI agents in Hyperscape world:`);
  for (const agent of agentsToStart) {
    console.log(`${colors.yellow}   → ${agent.name} (port ${agent.port})${colors.reset}`);
  }
  console.log(`${colors.yellow}   → All agents owned by: ${DEFAULT_LOCALNET_WALLET}${colors.reset}`);
  console.log(`${colors.yellow}   → Agents run continuously for debugging/testing${colors.reset}\n`);

  // Start agents after a short delay to let game server initialize
  const startAgents = async () => {
    console.log(`${colors.blue}[ElizaOS]${colors.reset} Waiting for game server to start...`);
    
    // Give turbo time to start the game server
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const agentProcesses = [];
    
    for (const agent of agentsToStart) {
      const characterPath = path.join(agentsDir, agent.character);
      
      if (!fs.existsSync(characterPath)) {
        console.error(`${colors.red}[ElizaOS] Character file not found: ${characterPath}${colors.reset}`);
        continue;
      }
      
      console.log(`${colors.green}[ElizaOS]${colors.reset} Starting agent: ${agent.name}`);
      
      const agentProcess = spawn('elizaos', ['start', '--character', characterPath], {
        cwd: pluginDir,
        stdio: 'pipe',
        shell: true,
        env: {
          ...process.env,
          PORT: String(agent.port),
          HYPERSCAPE_WALLET_ADDRESS: DEFAULT_LOCALNET_WALLET,
          AGENT_NAME: agent.name,
        },
      });
      
      // Prefix output with agent name
      agentProcess.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          console.log(`${colors.cyan}[${agent.name}]${colors.reset} ${line}`);
        }
      });
      
      agentProcess.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          console.error(`${colors.yellow}[${agent.name}]${colors.reset} ${line}`);
        }
      });
      
      agentProcess.on('error', (err) => {
        console.error(`${colors.red}[${agent.name}] Failed to start:${colors.reset}`, err);
      });
      
      agentProcesses.push({ name: agent.name, process: agentProcess });
    }
    
    return agentProcesses;
  };
  
  let agentProcesses = [];
  
  // Start agents asynchronously
  startAgents().then(processes => {
    agentProcesses = processes;
    console.log(`\n${colors.green}✓ All ${processes.length} agents started!${colors.reset}\n`);
  }).catch(err => {
    console.error(`${colors.red}[ElizaOS] Failed to start agents:${colors.reset}`, err);
  });
  
  // Handle errors
  turbo.on('error', (err) => {
    console.error(`${colors.red}[Turbo] Failed to start:${colors.reset}`, err);
  });
  
  // Handle exit
  const cleanup = () => {
    console.log(`\n${colors.yellow}Shutting down all services...${colors.reset}`);
    turbo.kill();
    for (const { name, process } of agentProcesses) {
      console.log(`${colors.yellow}Stopping agent: ${name}${colors.reset}`);
      process.kill();
    }
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Exit if turbo exits unexpectedly
  turbo.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}[Turbo] Exited with code ${code}${colors.reset}`);
      cleanup();
    }
  });
  
  console.log(`\n${colors.green}✓ All services starting!${colors.reset}`);
  console.log(`${colors.cyan}  - Hyperscape Server: http://localhost:5555${colors.reset}`);
  console.log(`${colors.cyan}  - Hyperscape Client: http://localhost:3333${colors.reset}`);
  for (const agent of agentsToStart) {
    console.log(`${colors.cyan}  - ${agent.name} Agent: http://localhost:${agent.port}${colors.reset}`);
  }
  console.log(`\n${colors.bright}${colors.green}Dev agents will spawn in the game world automatically.${colors.reset}`);
  console.log(`${colors.dim}Press Ctrl+C to stop all services${colors.reset}\n`);
} else {
  // ElizaOS not configured or not requested - run Turbo + Plugin Frontend
  console.log(`${colors.blue}[Turbo]${colors.reset} Starting Hyperscape dev servers...\n`);
  
  const turbo = spawn('bun', ['x', 'turbo', 'run', 'dev', '--filter=!3d-asset-forge'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });
  
  const cleanup = () => {
    console.log(`\n${colors.yellow}Shutting down all services...${colors.reset}`);
    turbo.kill();
    process.exit(0);
  };
  
  turbo.on('error', (err) => {
    console.error(`${colors.red}Failed to start Turbo:${colors.reset}`, err);
    process.exit(1);
  });
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  turbo.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}[Turbo] Exited with code ${code}${colors.reset}`);
      cleanup();
    }
  });
  
  console.log(`\n${colors.green}✓ Services starting!${colors.reset}`);
  console.log(`${colors.cyan}  - Hyperscape Server: http://localhost:5555${colors.reset}`);
  console.log(`${colors.cyan}  - Hyperscape Client: http://localhost:3333${colors.reset}`);
  console.log(`\n${colors.dim}Press Ctrl+C to stop all services${colors.reset}\n`);
}

