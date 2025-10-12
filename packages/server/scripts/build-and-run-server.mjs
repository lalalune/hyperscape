#!/usr/bin/env node
/**
 * Build and Run Server
 * 
 * This script builds the server and then runs it.
 * It watches for changes and rebuilds/restarts automatically.
 */

import 'dotenv/config'
import fs from 'fs-extra'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import chokidar from 'chokidar'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')
const buildDir = path.join(rootDir, 'build')

// Ensure build directories
await fs.ensureDir(buildDir)
await fs.ensureDir(path.join(buildDir, 'public'))

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message, color = colors.reset) {
  console.log(`${color}[Server]${colors.reset} ${message}`)
}

// Plugin to exclude test files
const excludeTestsPlugin = {
  name: 'exclude-tests',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      if (args.path.includes('__tests__') || 
          args.path.includes('/tests/') ||
          args.path.includes('.test.') ||
          args.path.includes('.spec.') ||
          args.path.includes('vitest')) {
        return { path: args.path, external: true }
      }
    })
  }
}

let serverContext = null
let frameworkContext = null
let serverProcess = null
let isBuilding = false

/**
 * Build the server and framework
 */
async function build() {
  if (isBuilding) return
  isBuilding = true
  
  const startTime = Date.now()
  log('Building...', colors.blue)
  
  try {
    // Create contexts if they don't exist
    if (!serverContext) {
      serverContext = await esbuild.context({
        entryPoints: ['src/server/index.ts'],
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
    }
    
    if (!frameworkContext) {
      frameworkContext = await esbuild.context({
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
    }
    
    // Rebuild
    await Promise.all([
      frameworkContext.rebuild(),
      serverContext.rebuild()
    ])
    
    const buildTime = Date.now() - startTime
    log(`✅ Build completed in ${buildTime}ms`, colors.green)
    
    return true
  } catch (error) {
    log(`Build failed: ${error.message}`, colors.red)
    
    // Reset contexts if they're broken
    if (error.message.includes('no longer running') || 
        error.message.includes('disposed')) {
      serverContext = null
      frameworkContext = null
    }
    
    return false
  } finally {
    isBuilding = false
  }
}

/**
 * Start the server
 */
async function startServer() {
  // Kill existing server if running
  if (serverProcess) {
    log('Stopping previous server...', colors.dim)
    serverProcess.kill('SIGTERM')
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill('SIGKILL')
        }
        resolve()
      }, 3000)
      
      serverProcess.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    serverProcess = null
  }
  
  // Start new server
  const port = process.env.PORT || '5555'
  log(`Starting server on port ${port}...`, colors.blue)
  serverProcess = spawn('bun', [path.join(rootDir, 'build/index.js')], {
    stdio: 'inherit',
    cwd: rootDir,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      PORT: port,
      PUBLIC_WS_URL: process.env.PUBLIC_WS_URL || `ws://localhost:${port}/ws`,
      PUBLIC_ASSETS_URL: process.env.PUBLIC_ASSETS_URL || '/world-assets/',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  })
  
  serverProcess.on('error', (err) => {
    log(`Process error: ${err.message}`, colors.red)
  })
  
  serverProcess.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      log(`Process exited unexpectedly (code: ${code})`, colors.yellow)
      // Don't restart here - let the manager handle it
    }
  })
}

/**
 * Build and restart
 */
async function buildAndRestart() {
  const success = await build()
  if (success) {
    await startServer()
  }
}

/**
 * Setup file watcher
 */
function setupWatcher() {
  const watchPaths = [
    path.join(rootDir, 'src/**/*.ts'),
    path.join(rootDir, 'src/**/*.tsx'),
  ]
  
  const ignored = [
    '**/node_modules/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/tests/**',
    '**/__tests__/**',
    '**/src/client/**', // Client files handled by Vite
    '**/build/**',
    '**/dist/**',
    '**/*.log',
    '**/*.tmp',
    '**/world/**',
    '**/.git/**',
    '**/coverage/**',
    '**/test-results/**',
  ]
  
  log('Setting up file watcher...', colors.dim)
  
  const watcher = chokidar.watch(watchPaths, {
    ignored,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300, // Increased to prevent rapid rebuilds
      pollInterval: 100
    },
    // Additional options to reduce false positives
    atomic: true,
    followSymlinks: false,
    usePolling: false,
    interval: 300,
    binaryInterval: 300
  })
  
  let rebuildTimeout = null
  let lastRebuildTime = 0
  const MIN_REBUILD_INTERVAL = 2000 // Minimum 2 seconds between rebuilds
  
  const triggerRebuild = (filepath) => {
    // Debounce and rate limit rebuilds
    const now = Date.now()
    if (now - lastRebuildTime < MIN_REBUILD_INTERVAL) {
      log(`Skipping rebuild (too soon after last rebuild)`, colors.dim)
      return
    }
    
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout)
    }
    
    rebuildTimeout = setTimeout(() => {
      lastRebuildTime = Date.now()
      buildAndRestart()
    }, 500) // Increased delay to batch multiple changes
  }
  
  // Track file sizes to detect actual content changes
  const fileSizes = new Map()
  
  watcher
    .on('change', async (filepath) => {
      const relativePath = path.relative(rootDir, filepath)
      // Additional filtering for runtime-generated patterns
      if (relativePath.includes('.tmp') || 
          relativePath.includes('.log') ||
          relativePath.includes('world/') ||
          relativePath.endsWith('.sqlite') ||
          relativePath.endsWith('.sqlite-wal') ||
          relativePath.endsWith('.sqlite-shm') ||
          relativePath.includes('.swp') ||
          relativePath.includes('~')) {
        return // Ignore these changes
      }
      
      // Check if the file actually changed by comparing size
      try {
        const stats = await fsPromises.stat(filepath)
        const currentSize = stats.size
        const lastSize = fileSizes.get(filepath)
        
        if (lastSize !== undefined && lastSize === currentSize) {
          // File size hasn't changed, likely a false positive from editor
          log(`File touched but not changed: ${relativePath} (${currentSize} bytes)`, colors.dim)
          return
        }
        
        fileSizes.set(filepath, currentSize)
        log(`File changed: ${relativePath} (${lastSize || 0} → ${currentSize} bytes)`, colors.dim)
      } catch (e) {
        log(`File changed: ${relativePath}`, colors.dim)
      }
      
      triggerRebuild(filepath)
    })
    .on('add', (filepath) => {
      const relativePath = path.relative(rootDir, filepath)
      // Only trigger rebuild for new source files
      if (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx')) {
        log(`File added: ${relativePath}`, colors.dim)
        triggerRebuild(filepath)
      }
    })
    .on('unlink', (filepath) => {
      const relativePath = path.relative(rootDir, filepath)
      // Only trigger rebuild for removed source files
      if (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx')) {
        log(`File removed: ${relativePath}`, colors.dim)
        triggerRebuild(filepath)
      }
    })
    .on('error', (error) => {
      log(`Watcher error: ${error.message}`, colors.red)
    })
  
  log('✅ Watching for changes', colors.green)
  return watcher
}

/**
 * Cleanup on exit
 */
let isCleaningUp = false
async function cleanup() {
  if (isCleaningUp) return
  isCleaningUp = true
  
  log('Shutting down...', colors.yellow)
  
  if (serverProcess) {
    log('Stopping server...', colors.dim)
    serverProcess.kill('SIGTERM')
    
    // Wait up to 3 seconds for graceful shutdown
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          log('Force killing server...', colors.yellow)
          serverProcess.kill('SIGKILL')
        }
        resolve()
      }, 3000)
      
      if (serverProcess) {
        serverProcess.once('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      } else {
        clearTimeout(timeout)
        resolve()
      }
    })
  }
  
  if (serverContext) {
    try {
      await serverContext.dispose()
    } catch (e) {}
  }
  
  if (frameworkContext) {
    try {
      await frameworkContext.dispose()
    } catch (e) {}
  }
  
  log('Cleanup complete', colors.green)
}

// Handle shutdown signals
process.on('SIGINT', async () => {
  await cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(0)
})

// Emergency cleanup on exit
process.on('exit', () => {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill('SIGKILL')
    } catch (e) {}
  }
})

// Main
async function main() {
  // Initial build and start
  await buildAndRestart()
  
  // Setup watcher for auto-rebuild
  setupWatcher()
}

main().catch(error => {
  console.error(colors.red + 'Failed to start:' + colors.reset, error)
  process.exit(1)
})

