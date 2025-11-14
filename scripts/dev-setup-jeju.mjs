#!/usr/bin/env node
/**
 * Minimal Development Setup for Jeju Environment
 * 
 * Skips localnet setup since Jeju dev environment handles that.
 * Only does build preparation.
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
}

console.log(`${colors.blue}Setting up Hyperscape for Jeju dev environment...${colors.reset}`)

// 1. Start CDN
function isDockerAvailable() {
  try {
    execSync('docker info', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function ensureCDNRunning() {
  if (!isDockerAvailable()) {
    console.log(`${colors.yellow}⚠️  Docker not available - CDN will not start${colors.reset}`)
    console.log(`${colors.dim}Assets will be served from filesystem if available${colors.reset}`)
    return false
  }

  try {
    const serverDir = path.join(rootDir, 'packages/server')
    
    // Check if CDN is already running
    const status = execSync('docker ps --filter "name=hyperscape-cdn" --format "{{.Status}}"', { 
      encoding: 'utf8',
      cwd: serverDir 
    }).trim()
    
    if (status && status.includes('Up')) {
      console.log(`${colors.green}✓ CDN container already running${colors.reset}`)
      return true
    }

    // Start CDN
    console.log(`${colors.blue}Starting CDN container...${colors.reset}`)
    execSync('docker-compose up -d cdn', { 
      stdio: 'inherit',
      cwd: serverDir
    })

    // Wait for health check
    console.log(`${colors.dim}Waiting for CDN to be healthy...${colors.reset}`)
    let attempts = 0
    const maxAttempts = 30
    while (attempts < maxAttempts) {
      try {
        const healthRes = await fetch('http://localhost:8088/health')
        if (healthRes.ok) {
          console.log(`${colors.green}✓ CDN is healthy and ready${colors.reset}`)
          return true
        }
      } catch {
        // Still starting
      }
      attempts++
      await new Promise(r => setTimeout(r, 1000))
    }

    console.log(`${colors.yellow}⚠️  CDN health check timed out${colors.reset}`)
    return false
  } catch (e) {
    console.log(`${colors.yellow}⚠️  Failed to start CDN: ${e.message}${colors.reset}`)
    return false
  }
}

await ensureCDNRunning()

// 2. Ensure build directories exist
const dirs = [
  'packages/shared/build',
  'packages/server/build',
  'packages/client/dist',
  'assets/web',
]

for (const dir of dirs) {
  const fullPath = path.join(rootDir, dir)
  await fs.promises.mkdir(fullPath, { recursive: true })
}

// 3. Copy PhysX assets if available
const physxSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist')
const physxDest = path.join(rootDir, 'assets/web')

if (fs.existsSync(physxSrc)) {
  const files = ['physx-js-webidl.wasm', 'physx-js-webidl.js', 'physx-js-webidl.d.ts']
  for (const file of files) {
    const src = path.join(physxSrc, file)
    const dest = path.join(physxDest, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
    }
  }
}

// 4. Build shared package
try {
  execSync('cd packages/shared && bun run build', {
    stdio: 'inherit',
    cwd: rootDir,
    shell: true
  })
} catch (e) {
  console.log(`${colors.yellow}⚠️  Shared build failed (will retry in watch mode)${colors.reset}`)
}

console.log(`${colors.green}✓ Setup complete (using Jeju localnet)${colors.reset}`)

