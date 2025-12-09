#!/usr/bin/env bun
/**
 * Development Script with AI (ElizaOS) Integration
 *
 * Runs all Hyperscape dev servers via Turbo AND starts ElizaOS AI agent server.
 * Use this when working on AI agent features.
 *
 * Usage: bun run dev:ai
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
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
  
  // Start ElizaOS from plugin directory with default Hyperscape agent
  // The default agent acts as the bridge between ElizaOS and Hyperscape game
  const pluginDir = path.join(rootDir, 'packages', 'plugin-hyperscape');

  console.log(`${colors.blue}[ElizaOS]${colors.reset} Starting ElizaOS with default Hyperscape agent`);
  console.log(`${colors.yellow}   → Default agent connects ElizaOS ↔ Hyperscape game${colors.reset}`);
  console.log(`${colors.yellow}   → Additional agents created via Dashboard${colors.reset}`);

  // Run from plugin directory - default character.json will load
  const elizaos = spawn('elizaos', ['start'], {
    cwd: pluginDir,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PORT: process.env.ELIZAOS_PORT || '4001',
    },
  });
  
  // Handle errors
  turbo.on('error', (err) => {
    console.error(`${colors.red}[Turbo] Failed to start:${colors.reset}`, err);
  });
  
  elizaos.on('error', (err) => {
    console.error(`${colors.red}[ElizaOS] Failed to start:${colors.reset}`, err);
  });
  
  // Handle exit
  const cleanup = () => {
    console.log(`\n${colors.yellow}Shutting down all services...${colors.reset}`);
    turbo.kill();
    elizaos.kill();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Exit if any process exits unexpectedly
  turbo.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}[Turbo] Exited with code ${code}${colors.reset}`);
      cleanup();
    }
  });
  
  elizaos.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}[ElizaOS] Exited with code ${code}${colors.reset}`);
      cleanup();
    }
  });
  
  console.log(`\n${colors.green}✓ All services starting!${colors.reset}`);
  console.log(`${colors.cyan}  - Hyperscape Server: http://localhost:5555${colors.reset}`);
  console.log(`${colors.cyan}  - Hyperscape Client: http://localhost:3333${colors.reset}`);
  console.log(`${colors.cyan}  - ElizaOS Server: http://localhost:${process.env.ELIZAOS_PORT || '4001'}${colors.reset}`);
  console.log(`${colors.cyan}  - ElizaOS UI: http://localhost:4000 (with Hyperscape plugin components)${colors.reset}`);
  console.log(`\n${colors.dim}Press Ctrl+C to stop all services${colors.reset}\n`);
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

