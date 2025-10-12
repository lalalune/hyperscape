#!/usr/bin/env node
/**
 * Hyperscape Development Server
 * 
 * Single unified dev script that manages:
 * - Game Server (Fastify + WebSocket)
 * - Game Client (Vite dev server)
 * - 3D Asset Forge API & UI
 * 
 * Configuration via environment variables:
 * - PORT: Game server port (default: 5555)
 * - VITE_PORT: Client dev server port (default: 3333)
 * - FORGE_API_PORT: Asset Forge API port (default: 3001)
 * - FORGE_VITE_PORT: Asset Forge UI port (default: 3003)
 */

import { spawn, execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')

// Change to package directory
process.chdir(rootDir)

// ===== CONFIGURATION =====
const CONFIG = {
  PORT: process.env.PORT || '5555',           // Game server WebSocket port
  VITE_PORT: process.env.VITE_PORT || '3333',  // Vite dev server port
  FORGE_API_PORT: process.env.FORGE_API_PORT || '3001',   // Asset Forge API port
  FORGE_VITE_PORT: process.env.FORGE_VITE_PORT || '3003', // Asset Forge UI port
  PUBLIC_WS_URL: process.env.PUBLIC_WS_URL || `ws://localhost:${process.env.PORT || '5555'}/ws`,
  PUBLIC_ASSETS_URL: process.env.PUBLIC_ASSETS_URL || '/world-assets/',
}

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

// PID tracking file
const pidFile = path.join(os.tmpdir(), 'hyperscape-dev.pid')

// Kill all processes on the given ports and any stored PIDs
function killEverything() {
  console.log(`${colors.yellow}Killing all processes...${colors.reset}`)
  
  // Kill any stored PIDs
  if (fs.existsSync(pidFile)) {
    try {
      const pids = fs.readFileSync(pidFile, 'utf8').split('\n').filter(Boolean)
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGKILL')
        } catch (e) {
          // Process might already be dead
        }
      }
      fs.unlinkSync(pidFile)
    } catch (e) {
      // Ignore
    }
  }
  
  // Kill anything on configured ports
  const ports = [CONFIG.PORT, CONFIG.VITE_PORT, CONFIG.FORGE_API_PORT, CONFIG.FORGE_VITE_PORT]
  try {
    if (process.platform === 'win32') {
      ports.forEach(port => {
        execSync(`netstat -ano | findstr :${port} | findstr LISTENING | for /f "tokens=5" %a in ('more') do taskkill /PID %a /F`, { stdio: 'ignore' })
      })
    } else {
      ports.forEach(port => {
        execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' })
      })
    }
  } catch (e) {
    // Ignore
  }
  
  // Note: Do NOT kill all bun processes here; this script itself runs under bun.
  // Killing all bun processes would terminate this script before it can start servers.
}

// Track child processes
const children = []
let isShuttingDown = false

// Store PIDs
function storePid(pid) {
  if (!pid) return
  const pids = fs.existsSync(pidFile) 
    ? fs.readFileSync(pidFile, 'utf8').split('\n').filter(Boolean) 
    : []
  pids.push(pid.toString())
  fs.writeFileSync(pidFile, pids.join('\n'))
}

// Spawn a child process and track it
function spawnChild(name, cmd, args, options = {}) {
  console.log(`${colors.blue}[${name}]${colors.reset} Starting...`)
  
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    ...options,
    // Important: Don't detach, we want to maintain control
    detached: false
  })
  
  if (child.pid) {
    storePid(child.pid)
    children.push({ name, process: child, pid: child.pid })
  }
  
  child.on('exit', (code, signal) => {
    console.log(`${colors.yellow}[${name}]${colors.reset} Exited (code: ${code}, signal: ${signal})`)
    const index = children.findIndex(c => c.process === child)
    if (index !== -1) {
      children.splice(index, 1)
    }
    
    // DISABLED: Auto-restart causes zombie processes when server crashes
    // Instead, let the server crash and show the error so we can fix it
    if (!isShuttingDown && code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      console.log(`${colors.red}[${name}]${colors.reset} Crashed with code ${code}. NOT auto-restarting to prevent zombies.`)
      console.log(`${colors.yellow}Fix the error and manually restart with: bun run dev${colors.reset}`)
    }
  })
  
  child.on('error', (err) => {
    console.error(`${colors.red}[${name}]${colors.reset} Error: ${err.message}`)
  })
  
  return child
}

// Guaranteed cleanup
async function cleanup(signal) {
  if (isShuttingDown) return
  isShuttingDown = true
  
  console.log(`\n${colors.yellow}Received ${signal}, shutting down...${colors.reset}`)
  
  // First attempt: graceful shutdown
  for (const { name, process } of children) {
    if (process && !process.killed) {
      console.log(`${colors.dim}Stopping ${name}...${colors.reset}`)
      try {
        process.kill('SIGTERM')
      } catch (e) {
        // Ignore
      }
    }
  }
  
  // Wait 1 second
  await new Promise(r => setTimeout(r, 1000))
  
  // Second attempt: force kill remaining
  for (const { process, pid } of children) {
    if (process && !process.killed) {
      try {
        process.kill('SIGKILL')
      } catch (e) {
        // Ignore
      }
    }
    // Also try PID directly
    if (pid) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch (e) {
        // Ignore
      }
    }
  }
  
  // Nuclear option: kill everything
  killEverything()
  
  console.log(`${colors.green}Cleanup complete${colors.reset}`)
  
  // Exit hard
  process.exit(0)
}

// Signal handlers
process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
process.on('SIGHUP', () => cleanup('SIGHUP'))

// Emergency exit handler
process.on('exit', () => {
  if (!isShuttingDown) {
    killEverything()
  }
})

// Uncaught errors
process.on('uncaughtException', (error) => {
  console.error(`${colors.red}Uncaught exception:${colors.reset}`, error)
  cleanup('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  console.error(`${colors.red}Unhandled rejection:${colors.reset}`, reason)
  cleanup('unhandledRejection')
})

// Build script for server
const buildScript = `
import * as esbuild from 'esbuild'
import path from 'path'

const buildFramework = process.env.BUILD_FRAMEWORK !== 'false'

const excludeTestsPlugin = {
  name: 'exclude-tests',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      if (args.path.includes('__tests__') || 
          args.path.includes('/tests/') ||
          args.path.includes('.test.') ||
          args.path.includes('.spec.')) {
        return { path: args.path, external: true }
      }
    })
  }
}

async function build() {
  console.log('[Build] Building server (src/index.ts)...')

  await esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'build/index.js',
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    external: ['vitest'],
    target: 'node22',
    define: {
      'process.env.CLIENT': 'false',
      'process.env.SERVER': 'true',
    },
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    plugins: [excludeTestsPlugin],
    logLevel: 'error',
  })

  console.log('[Build] ✅ Server build complete')

  if (buildFramework) {
    console.log('[Build] Building framework (src/index.ts)...')
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      outfile: 'build/framework.js',
      platform: 'neutral',
      format: 'esm',
      bundle: true,
      treeShaking: true,
      minify: false,
      sourcemap: true,
      packages: 'external',
      target: 'esnext',
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
      },
      logLevel: 'error',
    })
    console.log('[Build] ✅ Framework build complete')
  } else {
    console.log('[Build] Skipping framework build (BUILD_FRAMEWORK=false)')
  }

  console.log('[Build] ✅ Build complete')
}

build().catch(err => {
  console.error('[Build] Failed:', err)
  process.exit(1)
})
`

// Main
async function main() {
  console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════╗
║     Hyperscape Development Server         ║
╚═══════════════════════════════════════════╝
${colors.reset}`)
  
  // Clean up any previous runs
  killEverything()
  
  // Ensure directories exist
  await fs.promises.mkdir('build/public', { recursive: true }).catch(() => {})
  
  // Copy PhysX assets
  console.log(`${colors.dim}Copying PhysX assets...${colors.reset}`)
  try {
    const physxWasm = 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'
    const physxJs = 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js'
    if (fs.existsSync(physxWasm)) {
      fs.copyFileSync(physxWasm, 'build/public/physx-js-webidl.wasm')
      fs.copyFileSync(physxJs, 'build/public/physx-js-webidl.js')
    }
  } catch (e) {
    // Ignore
  }
  
  // Build server first
  console.log(`${colors.blue}Building server...${colors.reset}`)
  execSync(`bun -e "${buildScript.replace(/"/g, '\\"')}"`, { 
    stdio: 'inherit',
    cwd: rootDir,
    env: {
      ...process.env,
      // Skip heavy framework bundle during dev unless explicitly enabled
      BUILD_FRAMEWORK: process.env.BUILD_FRAMEWORK || 'false',
    }
  })
  
  // Start Game Server
  spawnChild('Server', 'bun', ['build/index.js'], {
    cwd: rootDir,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      PORT: CONFIG.PORT,
      PUBLIC_WS_URL: `ws://localhost:${CONFIG.PORT}/ws`,
      PUBLIC_ASSETS_URL: '/world-assets/',
      MESHY_API_KEY: process.env.MESHY_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      DISABLE_BOTS: process.env.DISABLE_BOTS || 'false',
      NODE_ENV: 'development',
      MAX_BOT_COUNT: '1',
    }
  })
  
  // Wait for server to start
  await new Promise(r => setTimeout(r, 2000))
  
  // Start Vite Client from client package directory
  const clientDir = path.join(rootDir, '../client')
  spawnChild('Client', 'bun', ['run', 'dev'], {
    cwd: clientDir,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      PORT: CONFIG.PORT, // Vite proxy needs this to forward to game server
      VITE_PORT: CONFIG.VITE_PORT,
      SERVER_ORIGIN: `http://localhost:${CONFIG.PORT}`,
      PUBLIC_WS_URL: CONFIG.PUBLIC_WS_URL,
      NODE_ENV: 'development',
    }
  })
  
  // Start 3D Asset Forge (API + Vite) with ASSET_OUTPUT_DIR pointing to Hyperscape world assets
  const assetForgeDir = path.join(rootDir, '../3d-asset-forge')
  if (fs.existsSync(assetForgeDir)) {
    const worldAssetsDir = path.join(rootDir, 'world/assets')
    // Ensure assets directory exists
    await fs.promises.mkdir(worldAssetsDir, { recursive: true }).catch(() => {})

    console.log(`${colors.dim}Starting 3D Asset Forge (output: ${worldAssetsDir})...${colors.reset}`)

    // Start Forge API
    spawnChild('Forge-API', 'node', ['server/api.mjs'], {
      cwd: assetForgeDir,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        API_PORT: CONFIG.FORGE_API_PORT,
        ASSET_OUTPUT_DIR: worldAssetsDir,
        MESHY_API_KEY: process.env.MESHY_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        IMAGE_SERVER_URL: process.env.IMAGE_SERVER_URL,
        NODE_ENV: 'development',
      }
    })

    // Start Forge UI
    spawnChild('Forge-UI', 'bun', ['x', 'vite', '--host', '--port', CONFIG.FORGE_VITE_PORT], {
      cwd: assetForgeDir,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        VITE_PORT: CONFIG.FORGE_VITE_PORT,
        NODE_ENV: 'development',
      }
    })
  }

  // Idempotent bootstrap: if no assets and MESHY_API_KEY is set, trigger default generation via Forge API
  try {
    const worldAssetsDir = path.join(rootDir, 'world/assets')
    const manifestsDir = path.join(worldAssetsDir, 'manifests')
    const sentinelPath = path.join(worldAssetsDir, '.bootstrap_done.json')

    const hasAnyAssets = () => {
      try {
        const forgeDir = path.join(worldAssetsDir, 'forge')
        return fs.existsSync(forgeDir) && fs.readdirSync(forgeDir).some(name => {
          const dir = path.join(forgeDir, name)
          const hasGlb = fs.existsSync(path.join(dir, `${name}.glb`))
          const hasAnyGlb = fs.existsSync(dir) && fs.readdirSync(dir).some(f => f.endsWith('.glb'))
          return hasGlb || hasAnyGlb
        })
      } catch (_e) {
        return false
      }
    }

    const hasManifests = fs.existsSync(path.join(manifestsDir, 'items.json')) ||
                         fs.existsSync(path.join(manifestsDir, 'mobs.json')) ||
                         fs.existsSync(path.join(manifestsDir, 'avatars.json'))

    const assetsPresent = hasAnyAssets() || hasManifests
    const apiPort = CONFIG.FORGE_API_PORT
    // Prefer Forge API health; wait briefly for API to boot
    let meshyKeyPresent = false
    {
      let attempts = 0
      const maxAttempts = 20
      while (attempts < maxAttempts) {
        try {
          const healthRes = await fetch(`http://localhost:${apiPort}/api/health`)
          if (healthRes.ok) {
            const health = await healthRes.json()
            meshyKeyPresent = !!(health?.services?.meshy)
            break
          }
        } catch (_e) {}
        attempts++
        await new Promise(r => setTimeout(r, 250))
      }
      if (!meshyKeyPresent) {
        // Final fallback to local env if API isn't reachable in time
        meshyKeyPresent = !!process.env.MESHY_API_KEY
      }
    }

    if (!assetsPresent) {
      if (!meshyKeyPresent) {
        console.warn(`${colors.yellow}No assets found in world/assets and MESHY_API_KEY not set. Skipping default generation.${colors.reset}`)
      } else {
        console.log(`${colors.cyan}No assets found. Bootstrapping default assets using Meshy...${colors.reset}`)
        // Simple seed list (MVP): a few representative items; Forge can be expanded to a richer set
        const seeds = [
          { assetId: 'bronze-sword', name: 'Bronze Sword', type: 'weapon', subtype: 'sword', description: 'A basic bronze sword, low-poly RuneScape style', style: 'runescape2007' },
          { assetId: 'steel-sword', name: 'Steel Sword', type: 'weapon', subtype: 'sword', description: 'A sturdy steel sword, low-poly RuneScape style', style: 'runescape2007' },
          { assetId: 'wood-bow', name: 'Wood Bow', type: 'weapon', subtype: 'bow', description: 'A simple wooden bow, low-poly RuneScape style', style: 'runescape2007' },
          { assetId: 'bronze-shield', name: 'Bronze Shield', type: 'weapon', subtype: 'shield', description: 'A basic bronze shield, low-poly RuneScape style', style: 'runescape2007' },
          { assetId: 'leather-body', name: 'Leather Body', type: 'armor', subtype: 'body', description: 'Basic leather body armor, low-poly RuneScape style', style: 'runescape2007' },
          { assetId: 'adventurer-avatar', name: 'Adventurer', type: 'character', subtype: 'humanoid', description: 'Humanoid adventurer in T-pose, game-ready, low-poly RuneScape style', style: 'runescape2007', generationType: 'avatar', enableRigging: true, riggingOptions: { heightMeters: 1.83 } },
        ]

        // Skip seeds already present
        const seedsToRun = seeds.filter(seed => {
          const dir = path.join(worldAssetsDir, 'forge', seed.assetId)
          try {
            if (fs.existsSync(dir)) {
              const files = fs.readdirSync(dir)
              const hasAnyGlb = files.some(f => f.endsWith('.glb'))
              return !hasAnyGlb
            }
          } catch (_e) {}
          return true
        })

        if (seedsToRun.length === 0) {
          console.log(`${colors.dim}All seed assets already present. Skipping generation.${colors.reset}`)
        } else {
          // Submit pipelines to Forge API
          for (const seed of seedsToRun) {
            try {
              const res = await fetch(`http://localhost:${apiPort}/api/generation/pipeline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  assetId: seed.assetId,
                  name: seed.name,
                  description: seed.description,
                  type: seed.type,
                  subtype: seed.subtype,
                  style: seed.style,
                  generationType: seed.generationType || 'item',
                  enableRigging: !!seed.enableRigging,
                  riggingOptions: seed.riggingOptions || undefined,
                  enableRetexturing: seed.type === 'weapon' ? true : false,
                  materialPresets: seed.type === 'weapon' ? [ { id: 'bronze', displayName: 'Bronze', category: 'metal', tier: 1, color: '#CD7F32', stylePrompt: 'bronze metal texture' } ] : []
                })
              })
              if (!res.ok) {
                console.warn(`${colors.yellow}Seed submit failed for ${seed.assetId}: HTTP ${res.status}${colors.reset}`)
              }
            } catch (e) {
              console.warn(`${colors.yellow}Failed to contact Forge API for seed ${seed.assetId}: ${e.message}${colors.reset}`)
            }
            // Small delay to avoid bursting
            await new Promise(r => setTimeout(r, 250))
          }

          // Write sentinel
          try {
            const sentinel = { createdAt: new Date().toISOString(), seeds: seeds.map(s => s.assetId) }
            fs.writeFileSync(sentinelPath, JSON.stringify(sentinel, null, 2))
          } catch (_e) {}
        }
      }
    }
  } catch (e) {
    console.warn(`${colors.yellow}Bootstrap step failed: ${e.message}${colors.reset}`)
  }
  
  // Show ready message
  setTimeout(() => {
    console.log(`\n${colors.bright}${colors.green}═══ Development servers ready! ═══${colors.reset}\n`)
    console.log(`  ${colors.cyan}Game Client:${colors.reset}    http://localhost:${CONFIG.VITE_PORT}`)
    console.log(`  ${colors.blue}Game Server:${colors.reset}    ws://localhost:${CONFIG.PORT}/ws`)
    console.log(`  ${colors.magenta}Asset Forge UI:${colors.reset} http://localhost:${CONFIG.FORGE_VITE_PORT}`)
    console.log(`  ${colors.dim}Forge API:${colors.reset}      http://localhost:${CONFIG.FORGE_API_PORT}`)
    console.log(`\n${colors.dim}Press Ctrl+C to stop all servers${colors.reset}\n`)
  }, 3000)
  
  // Keep process alive
  process.stdin.resume()
}

// Start
main().catch(error => {
  console.error(`${colors.red}Failed to start:${colors.reset}`, error)
  cleanup('error')
})
