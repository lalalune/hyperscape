#!/usr/bin/env node
/**
 * Simple Server Dev Script
 * 
 * Just watches and rebuilds the server - no child process management.
 * Turbo handles orchestration, this script just focuses on the server.
 */

import { spawn, execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')

process.chdir(rootDir)

const PORT = parseInt(process.env.PORT || '5555', 10)

/**
 * Kill any process using the specified port
 */
function killPort(port) {
  try {
    // Linux/Mac: find and kill process using the port
    const result = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim()
    if (result) {
      const pids = result.split('\n').filter(Boolean)
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid, 10), 'SIGKILL')
          console.log(`Killed process ${pid} on port ${port}`)
        } catch {
          // Process may have already exited
        }
      }
      // Give OS time to release the port
      execSync('sleep 0.5')
    }
  } catch {
    // lsof not available or no process found - that's fine
  }
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
}

// Build configuration
const buildScript = `
import * as esbuild from 'esbuild'

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

console.log('✅ Server build complete')
`

// Check if build exists - skip rebuild by default for faster startup
// Use FORCE_BUILD=1 to trigger a rebuild
const buildIndexPath = path.join(rootDir, 'build/index.js')
const hasBuild = fs.existsSync(buildIndexPath)
const forceBuild = process.env.FORCE_BUILD === '1'

if (hasBuild && !forceBuild) {
  console.log(`${colors.dim}Using existing build (run with FORCE_BUILD=1 to rebuild)${colors.reset}`)
} else {
  // Initial build
  console.log(`${colors.blue}Building server...${colors.reset}`)
  await new Promise((resolve, reject) => {
    const proc = spawn('bun', ['-e', buildScript], {
      stdio: 'inherit',
      cwd: rootDir
    })
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`Build failed with code ${code}`)))
    proc.on('error', reject)
  })
}

// Track server process
let serverProcess = null
let isRestarting = false

// Kill any existing process on the port before starting
console.log(`${colors.dim}Checking port ${PORT}...${colors.reset}`)
killPort(PORT)

// Start server
function startServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log(`${colors.dim}Server already running (PID ${serverProcess.pid})${colors.reset}`)
    return
  }

  // Double-check port is free before starting
  killPort(PORT)

  console.log(`${colors.green}Starting server...${colors.reset}`)
  
  // Use Bun.spawn for better compatibility (spawns using current bun runtime)
  const Bun = globalThis.Bun
  if (Bun && Bun.spawn) {
    serverProcess = Bun.spawn(['bun', 'build/index.js'], {
      cwd: rootDir,
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: process.env.PORT || '5555',
        PUBLIC_WS_URL: process.env.PUBLIC_WS_URL || 'ws://localhost:5555/ws',
        // Default to server's own /assets/ endpoint (matches config.ts default)
        PUBLIC_CDN_URL: process.env.PUBLIC_CDN_URL || `http://localhost:${process.env.PORT || '5555'}/assets`,
      }
    })
    
    // Handle process events via exited promise
    serverProcess.exited.then((code) => {
      console.log(`${colors.yellow}Server exited (code: ${code})${colors.reset}`)
      serverProcess = null
      if (code !== 0 && !isRestarting) {
        console.log(`${colors.red}Server crashed. Fix the error and save a file to rebuild.${colors.reset}`)
      }
    })
  } else {
    // Fallback to Node.js spawn
    serverProcess = spawn('bun', ['build/index.js'], {
      stdio: 'inherit',
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: process.env.PORT || '5555',
        PUBLIC_WS_URL: process.env.PUBLIC_WS_URL || 'ws://localhost:5555/ws',
        // Default to server's own /assets/ endpoint (matches config.ts default)
        PUBLIC_CDN_URL: process.env.PUBLIC_CDN_URL || `http://localhost:${process.env.PORT || '5555'}/assets`,
      }
    })

    serverProcess.on('exit', (code, signal) => {
      console.log(`${colors.yellow}Server exited (code: ${code}, signal: ${signal})${colors.reset}`)
      serverProcess = null
      
      // Don't auto-restart on intentional shutdown
      if (signal !== 'SIGTERM' && signal !== 'SIGINT' && !isRestarting) {
        console.log(`${colors.red}Server crashed. Fix the error and save a file to rebuild.${colors.reset}`)
      }
    })
    
    serverProcess.on('error', (err) => {
      console.error(`${colors.red}Server error:${colors.reset}`, err)
    })
  }
}

// Start initial server
startServer()

// Setup file watcher
console.log(`${colors.blue}Setting up file watcher...${colors.reset}`)

const { default: chokidar } = await import('chokidar')

const watcher = chokidar.watch([
  'src/**/*.{ts,tsx,js,mjs}',
  '../shared/build/**/*.{js,d.ts}'
], {
  cwd: rootDir,
  ignored: [
    '**/node_modules/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/build/**',
    '**/dist/**',
  ],
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100
  }
})

let rebuildTimeout = null

const rebuild = async (filePath) => {
  if (isRestarting) return
  
  clearTimeout(rebuildTimeout)
  rebuildTimeout = setTimeout(async () => {
    isRestarting = true
    
    const shortPath = filePath.replace(rootDir, '').replace(/^\//, '')
    console.log(`\n${colors.yellow}⚡ Change detected: ${shortPath}${colors.reset}`)
    console.log(`${colors.blue}Rebuilding server...${colors.reset}`)

    try {
      // Rebuild
      await new Promise((resolve, reject) => {
        const proc = spawn('bun', ['-e', buildScript], {
          stdio: 'inherit',
          cwd: rootDir
        })
        proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`Build failed`)))
        proc.on('error', reject)
      })

      console.log(`${colors.green}✓ Rebuild complete${colors.reset}`)
      console.log(`${colors.blue}Restarting server...${colors.reset}`)

      // Kill old server
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM')
        // Wait for graceful shutdown
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            if (serverProcess && !serverProcess.killed) {
              serverProcess.kill('SIGKILL')
            }
            resolve()
          }, 2000)
          
          if (serverProcess.exited) {
            serverProcess.exited.then(() => {
              clearTimeout(timeout)
              resolve()
            })
          } else if (serverProcess.on) {
            serverProcess.on('exit', () => {
              clearTimeout(timeout)
              resolve()
            })
          }
        })
      }
      
      // Ensure port is free
      killPort(PORT)

      // Start new server
      startServer()
      console.log(`${colors.green}✓ Server restarted${colors.reset}\n`)
    } catch (err) {
      console.error(`${colors.red}Rebuild failed:${colors.reset}`, err.message)
    } finally {
      isRestarting = false
    }
  }, 200)
}

watcher.on('change', rebuild)
watcher.on('add', rebuild)
watcher.on('ready', () => {
  const fileCount = Object.values(watcher.getWatched()).reduce((sum, files) => sum + files.length, 0)
  console.log(`${colors.green}✓ Watching ${fileCount} files for changes${colors.reset}`)
})

// Cleanup on exit
const cleanup = async () => {
  console.log(`\n${colors.yellow}Shutting down...${colors.reset}`)
  watcher.close()
  
  if (serverProcess && !serverProcess.killed) {
    // Try graceful shutdown first
    serverProcess.kill('SIGTERM')
    
    // Wait up to 2 seconds for graceful shutdown
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          console.log(`${colors.yellow}Force killing server...${colors.reset}`)
          serverProcess.kill('SIGKILL')
        }
        resolve()
      }, 2000)
      
      // If process exits cleanly, clear the timeout
      if (serverProcess.exited) {
        serverProcess.exited.then(() => {
          clearTimeout(timeout)
          resolve()
        })
      } else if (serverProcess.on) {
        serverProcess.on('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      }
    })
  }
  
  // Final cleanup: kill any orphaned processes on the port
  killPort(PORT)
}

process.on('SIGINT', async () => {
  await cleanup()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(0)
})

// Keep alive
await new Promise(() => {})

