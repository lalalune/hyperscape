import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import chokidar from 'chokidar'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')

const RECOMMENDED_INOTIFY_WATCHES = 524288

/**
 * Check inotify watcher limit on Linux
 */
function checkInotifyLimit() {
  if (process.platform !== 'linux') return
  
  const inotifyPath = '/proc/sys/fs/inotify/max_user_watches'
  if (!fs.existsSync(inotifyPath)) return
  
  const limit = parseInt(fs.readFileSync(inotifyPath, 'utf8').trim(), 10)
  if (limit < RECOMMENDED_INOTIFY_WATCHES) {
    console.warn('\n⚠️  Low inotify watcher limit detected!')
    console.warn(`   Current: ${limit.toLocaleString()}`)
    console.warn(`   Recommended: ${RECOMMENDED_INOTIFY_WATCHES.toLocaleString()}`)
    console.warn('\n   This may cause "ENOSPC: System limit for number of file watchers reached" errors.')
    console.warn('\n   To fix, run:')
    console.warn('   sudo sysctl fs.inotify.max_user_watches=524288')
    console.warn('\n   To make permanent:')
    console.warn('   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p')
    console.warn('')
  }
}

// Ensure build directory exists
await fs.ensureDir(buildDir)

/**
 * TypeScript Plugin for ESBuild
 */
const typescriptPlugin = {
  name: 'typescript',
  setup(build) {
    // Handle .ts and .tsx files
    build.onResolve({ filter: /\.tsx?$/ }, args => {
      return {
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'file',
      }
    })
  },
}

/**
 * Run TypeScript Type Checking
 */
async function runTypeCheck() {
  console.log('Running TypeScript type checking...')
  try {
    execSync('bunx --yes tsc --noEmit', { 
      stdio: 'inherit',
      cwd: rootDir 
    })
    console.log('Type checking passed ✓')
  } catch (error) {
    console.error('Type checking failed')
    // Don't exit in watch mode - continue watching for fixes
  }
}

/**
 * Build all targets
 */
async function buildAll(contexts) {
  console.log('Rebuilding all targets...')
  const startTime = Date.now()
  
  try {
    await Promise.all(contexts.map(ctx => ctx.rebuild()))
    const duration = Date.now() - startTime
    console.log(`✓ Rebuild completed in ${duration}ms`)
  } catch (error) {
    console.error('Build error:', error)
  }
}

/**
 * Main Dev Process with Watch Mode
 */
async function main() {
  checkInotifyLimit()
  console.log('Starting @hyperscape/shared in watch mode...')
  
  // Create esbuild contexts for watch mode
  const contexts = []
  
  // Build full library (server + client)
  console.log('Setting up framework.js (full) watch...')
  const ctxFull = await esbuild.context({
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
    external: [
      './PhysXManager.server',
      './PhysXManager.server.js',
      './storage.server',
      './storage.server.js',
    ],
    plugins: [typescriptPlugin],
  })
  contexts.push(ctxFull)
  
  // Build server-specific modules separately
  console.log('Setting up server-specific modules watch...')
  const ctxServerPhysX = await esbuild.context({
    entryPoints: ['src/physics/PhysXManager.server.ts'],
    outfile: 'build/PhysXManager.server.js',
    platform: 'node',
    format: 'esm',
    bundle: false,
    sourcemap: true,
    target: 'esnext',
  })
  contexts.push(ctxServerPhysX)

  const ctxServerStorage = await esbuild.context({
    entryPoints: ['src/platform/server/storage.server.ts'],
    outfile: 'build/storage.server.js',
    platform: 'node',
    format: 'esm',
    bundle: false,
    sourcemap: true,
    target: 'esnext',
  })
  contexts.push(ctxServerStorage)
  
  // Build client-only library
  console.log('Setting up framework.client.js (client-only) watch...')
  const ctxClient = await esbuild.context({
    entryPoints: ['src/index.client.ts'],
    outfile: 'build/framework.client.js',
    platform: 'browser',
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
    external: [
      './PhysXManager.server',
      './PhysXManager.server.js',
      './storage.server',
      './storage.server.js',
      'node:*',
      'os',
      'fs',
      'path',
      'url'
    ],
    plugins: [typescriptPlugin],
  })
  contexts.push(ctxClient)
  
  // Initial build
  console.log('Running initial build...')
  await buildAll(contexts)
  
  // Run initial type check
  await runTypeCheck()
  
  // Watch for changes using esbuild's built-in watch
  console.log('Watching for changes...')
  await Promise.all(contexts.map(ctx => ctx.watch()))
  
  // Also watch TypeScript files for type checking
  // Use polling on Linux to avoid EINVAL errors with chokidar 4.x on newer kernels
  const watcher = chokidar.watch('src/**/*.{ts,tsx}', {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    cwd: rootDir,
    usePolling: process.platform === 'linux',
    interval: 300,
  })
  
  let typecheckTimeout
  watcher.on('change', (filepath) => {
    console.log(`\n⚡ File changed: ${filepath}`)
    console.log('🔄 Rebuilding @hyperscape/shared...')
    
    // Debounce type checking
    clearTimeout(typecheckTimeout)
    typecheckTimeout = setTimeout(() => {
      runTypeCheck()
      console.log('✅ @hyperscape/shared rebuild complete - dependent packages will reload\n')
    }, 1000)
  })
  
  console.log('✓ Watch mode active - waiting for changes...')
  
  // Keep process alive
  await new Promise(() => {})
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nStopping watch mode...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nStopping watch mode...')
  process.exit(0)
})

// Run the dev watcher
main().catch(error => {
  console.error('Dev watch failed:', error)
  process.exit(1)
})

