#!/usr/bin/env node
/**
 * Simple Server Dev Script
 * 
 * Just watches and rebuilds the server - no child process management.
 * Turbo handles orchestration, this script just focuses on the server.
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')

process.chdir(rootDir)

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

// Track server process
let serverProcess = null
let isRestarting = false

// Start server
function startServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log(`${colors.dim}Server already running (PID ${serverProcess.pid})${colors.reset}`)
    return
  }

  console.log(`${colors.green}Starting server...${colors.reset}`)
  serverProcess = spawn('bun', ['build/index.js'], {
    stdio: 'inherit',
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: process.env.PORT || '5555',
      PUBLIC_WS_URL: process.env.PUBLIC_WS_URL || 'ws://localhost:5555/ws',
      PUBLIC_CDN_URL: process.env.PUBLIC_CDN_URL || 'http://localhost:8088',
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
        await new Promise(r => setTimeout(r, 1000))
      }

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
const cleanup = () => {
  console.log(`\n${colors.yellow}Shutting down...${colors.reset}`)
  watcher.close()
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
  }
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(0)
})

// Keep alive
await new Promise(() => {})

