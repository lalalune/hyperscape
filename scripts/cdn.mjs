#!/usr/bin/env node
/**
 * CDN Management Script
 * 
 * Manages the local CDN Docker container for asset serving.
 * Run before dev to ensure assets are available.
 * 
 * Usage:
 *   bun run cdn:up          - Start CDN (or restart if already running)
 *   bun run cdn:up --watch  - Start CDN and watch for file changes
 *   bun run cdn:up --force  - Force restart CDN container
 */

import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { resolveDockerBinary } from '../packages/server/src/infrastructure/docker/resolveDockerBinary.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const serverDir = path.join(rootDir, 'packages/server')
// CDN serves from packages/server/world/assets by default (docker-compose.yml)
const assetsDir = path.join(serverDir, 'world', 'assets')
const DOCKER_BIN = resolveDockerBinary()

const args = process.argv.slice(2)
const forceRestart = args.includes('--force') || args.includes('-f')
const watchMode = args.includes('--watch') || args.includes('-w')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
}

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, options)
}

function runDocker(args, options = {}) {
  return runCommand(DOCKER_BIN, args, options)
}

function runDockerCompose(args, options = {}) {
  const compose = getDockerComposeCommand()
  return runCommand(compose.command, [...compose.args, ...args], options)
}

function isDockerAvailable() {
  try {
    runDocker(['info'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function getDockerComposeCommand() {
  // Try docker compose (newer Docker versions) first
  try {
    runDocker(['compose', 'version'], { stdio: 'ignore' })
    return {
      command: DOCKER_BIN,
      args: ['compose'],
    }
  } catch {
    // Fall back to docker-compose (older versions or standalone)
    try {
      runCommand('docker-compose', ['version'], { stdio: 'ignore' })
      return {
        command: 'docker-compose',
        args: [],
      }
    } catch {
      throw new Error('Neither "docker compose" nor "docker-compose" is available')
    }
  }
}

function isCDNRunning() {
  try {
    const status = runDocker(['ps', '--filter', 'name=^/hyperia-cdn$', '--format', '{{.Status}}'], {
      encoding: 'utf8',
      cwd: serverDir
    }).trim()
    return status && status.includes('Up')
  } catch {
    return false
  }
}

function removeExistingCDNContainer() {
  try {
    const existing = runDocker(
      ['ps', '-a', '--filter', 'name=^/hyperia-cdn$', '--format', '{{.ID}}'],
      { encoding: 'utf8', cwd: serverDir },
    ).trim()

    if (!existing) return false

    console.log(`${colors.yellow}Removing existing hyperia-cdn container...${colors.reset}`)
    runDocker(['rm', '-f', 'hyperia-cdn'], {
      stdio: 'inherit',
      cwd: serverDir,
    })
    return true
  } catch {
    return false
  }
}

async function isCDNHealthy() {
  try {
    const healthRes = await fetch('http://localhost:8080/health')
    return healthRes.ok
  } catch {
    return false
  }
}

function restartCDN() {
  console.log(`${colors.blue}Restarting CDN container...${colors.reset}`)
  // If another stack created a container with the same name but different port mapping,
  // remove it first so this compose file can recreate it with the expected localhost:8080 binding.
  removeExistingCDNContainer()
  // Use force-recreate so volume mounts refresh (important if assets dir was replaced)
  runDockerCompose(['up', '-d', '--force-recreate', 'cdn'], {
    stdio: 'inherit',
    cwd: serverDir
  })
}

function copyPhysXAssets() {
  // Copy PhysX assets to the assets directory (where CDN serves from)
  const assetsWebDir = path.join(assetsDir, 'web')
  fs.mkdirSync(assetsWebDir, { recursive: true })

  const physxWasm = path.join(rootDir, 'node_modules/@hyperforge/physx-js-webidl/dist/physx-js-webidl.wasm')
  const physxJs = path.join(rootDir, 'node_modules/@hyperforge/physx-js-webidl/dist/physx-js-webidl.js')

  if (fs.existsSync(physxWasm)) {
    fs.copyFileSync(physxWasm, path.join(assetsWebDir, 'physx-js-webidl.wasm'))
    fs.copyFileSync(physxJs, path.join(assetsWebDir, 'physx-js-webidl.js'))
    console.log(`${colors.green}✓ PhysX assets copied${colors.reset}`)
    return true
  }
  return false
}

async function waitForHealthy(maxAttempts = 30) {
  console.log(`${colors.dim}Waiting for CDN to be healthy...${colors.reset}`)
  let attempts = 0
  while (attempts < maxAttempts) {
    try {
      const healthRes = await fetch('http://localhost:8080/health')
      if (healthRes.ok) {
        console.log(`${colors.green}✓ CDN is healthy and ready at http://localhost:8080${colors.reset}`)
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
}


async function ensureCDNRunning() {
  if (!isDockerAvailable()) {
    console.log(`${colors.yellow}⚠️  Docker not available - CDN will not start${colors.reset}`)
    console.log(`${colors.dim}Assets will be served from filesystem if available${colors.reset}`)
    return false
  }

  try {
    const isRunning = isCDNRunning()
    
    // Force restart if requested
    if (isRunning && forceRestart) {
      console.log(`${colors.yellow}Force restart requested${colors.reset}`)
      restartCDN()
      return await waitForHealthy()
    }
    
    if (isRunning) {
      const healthy = await isCDNHealthy()
      if (healthy) {
        console.log(`${colors.green}✓ CDN container already running${colors.reset}`)
        console.log(`${colors.dim}  Assets served from: ${assetsDir}${colors.reset}`)
        console.log(`${colors.dim}  Use --force to restart${colors.reset}`)
        return true
      }

      console.log(
        `${colors.yellow}⚠️  hyperia-cdn exists but is not reachable at http://localhost:8080 (likely wrong port mapping). Recreating...${colors.reset}`,
      )
      restartCDN()
      return await waitForHealthy()
    }

    // Copy PhysX assets
    console.log(`${colors.dim}Copying PhysX assets...${colors.reset}`)
    copyPhysXAssets()

    // Start CDN
    console.log(`${colors.blue}Starting CDN container...${colors.reset}`)
    console.log(`${colors.dim}Serving assets from: ${assetsDir}${colors.reset}`)
    try {
      runDockerCompose(['up', '-d', 'cdn'], {
        stdio: 'inherit',
        cwd: serverDir
      })
    } catch {
      // Recover from stale name collisions created by other docker-compose files.
      removeExistingCDNContainer()
      runDockerCompose(['up', '-d', 'cdn'], {
        stdio: 'inherit',
        cwd: serverDir
      })
    }

    return await waitForHealthy()
  } catch (e) {
    console.log(`${colors.red}❌ Failed to start CDN: ${e.message}${colors.reset}`)
    return false
  }
}

async function watchAssets() {
  console.log(`${colors.blue}👀 Watching for asset changes...${colors.reset}`)
  console.log(`${colors.dim}   Directory: ${assetsDir}${colors.reset}`)
  console.log(`${colors.dim}   Press Ctrl+C to stop${colors.reset}`)
  console.log('')
  
  let debounceTimer = null
  const debounceMs = 500
  
  fs.watch(assetsDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return
    
    // Skip hidden files and temp files
    if (filename.startsWith('.') || filename.endsWith('~') || filename.includes('.swp')) {
      return
    }
    
    // Debounce rapid changes
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const timestamp = new Date().toLocaleTimeString()
      console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors.green}✓${colors.reset} ${eventType}: ${filename}`)
    }, debounceMs)
  })
  
  // Keep process running
  await new Promise(() => {})
}

// Run
const success = await ensureCDNRunning()

if (success && watchMode) {
  await watchAssets()
}
