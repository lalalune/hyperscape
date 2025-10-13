#!/usr/bin/env node
/**
 * CDN Management Script
 * 
 * Manages the local CDN Docker container for asset serving.
 * Run before dev to ensure assets are available.
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const serverDir = path.join(rootDir, 'packages/server')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
}

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
    // Check if CDN is already running
    const status = execSync('docker ps --filter "name=hyperscape-cdn" --format "{{.Status}}"', { 
      encoding: 'utf8',
      cwd: serverDir 
    }).trim()
    
    if (status && status.includes('Up')) {
      console.log(`${colors.green}✓ CDN container already running${colors.reset}`)
      return true
    }

    // Copy PhysX assets to CDN directory
    console.log(`${colors.dim}Copying PhysX assets...${colors.reset}`)
    const assetsWebDir = path.join(rootDir, 'assets/web')
    await fs.promises.mkdir(assetsWebDir, { recursive: true })
    
    const physxWasm = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm')
    const physxJs = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js')
    
    if (fs.existsSync(physxWasm)) {
      fs.copyFileSync(physxWasm, path.join(assetsWebDir, 'physx-js-webidl.wasm'))
      fs.copyFileSync(physxJs, path.join(assetsWebDir, 'physx-js-webidl.js'))
      console.log(`${colors.green}✓ PhysX assets copied${colors.reset}`)
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
        const healthRes = await fetch('http://localhost:8080/health')
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

// Run
await ensureCDNRunning()

