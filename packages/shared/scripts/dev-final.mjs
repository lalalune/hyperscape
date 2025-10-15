import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import chokidar from 'chokidar'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')

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
    entryPoints: ['src/PhysXManager.server.ts'],
    outfile: 'build/PhysXManager.server.js',
    platform: 'node',
    format: 'esm',
    bundle: false,
    sourcemap: true,
    target: 'esnext',
  })
  contexts.push(ctxServerPhysX)
  
  const ctxServerStorage = await esbuild.context({
    entryPoints: ['src/storage.server.ts'],
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
  const watcher = chokidar.watch('src/**/*.{ts,tsx}', {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    cwd: rootDir
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

