import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'

const dev = process.argv.includes('--dev')
const typecheck = !process.argv.includes('--no-typecheck')
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
  if (!typecheck) return
  
  console.log('Running TypeScript type checking...')
  try {
    execSync('bunx --yes tsc --noEmit --skipLibCheck', { 
      stdio: 'inherit',
      cwd: rootDir 
    })
    console.log('Type checking passed ✓')
  } catch (error) {
    // Check if errors are only from dependencies in node_modules
    const output = error.stdout?.toString() || error.stderr?.toString() || ''
    if (output.includes('node_modules')) {
      console.log('⚠️  Warning: Type errors found in dependencies (ignoring)')
    } else {
      throw error
    }
  }
}

/**
 * Build Library
 */
async function buildLibrary() {
  console.log('Building library...')
  
  // Build full library (server + client)
  console.log('Building framework.js (full)...')
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
    // Mark server-specific modules as external so they can be dynamically imported
    // These paths are relative to the build output location
    external: [
      './PhysXManager.server',
      './PhysXManager.server.js',
      './storage.server',
      './storage.server.js',
      '@hyperscape/physx-js-webidl',
    ],
    plugins: [typescriptPlugin],
  })
  
  await ctxFull.rebuild()
  await ctxFull.dispose()
  console.log('✓ framework.js built successfully')
  
  // Build server-specific modules separately
  console.log('Building server-specific modules...')
  const ctxServerPhysX = await esbuild.context({
    entryPoints: ['src/physics/PhysXManager.server.ts'],
    outfile: 'build/PhysXManager.server.js',
    platform: 'node',
    format: 'esm',
    bundle: false,
    sourcemap: true,
    target: 'esnext',
  })
  await ctxServerPhysX.rebuild()
  await ctxServerPhysX.dispose()

  const ctxServerStorage = await esbuild.context({
    entryPoints: ['src/platform/server/storage.server.ts'],
    outfile: 'build/storage.server.js',
    platform: 'node',
    format: 'esm',
    bundle: false,
    sourcemap: true,
    target: 'esnext',
  })
  await ctxServerStorage.rebuild()
  await ctxServerStorage.dispose()
  console.log('✓ Server-specific modules built successfully')
  
  // Build client-only library (no Node.js modules)
  console.log('Building framework.client.js (client-only)...')
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
    // Mark server-specific modules as external so they're not bundled
    // These paths are relative to the build output location
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
  
  await ctxClient.rebuild()
  await ctxClient.dispose()
  console.log('✓ framework.client.js built successfully')
  
  console.log('✓ All library builds completed')
}

/**
 * Generate TypeScript Declaration Files
 */
async function generateDeclarations() {
  if (!typecheck) return
  
  console.log('Generating TypeScript declarations...')
  
  // Generate declaration files using tsc
  console.log('Creating type definitions...')
  try {
    execSync('bunx --yes tsc --project tsconfig.json --outDir build', {
      stdio: 'inherit',
      cwd: rootDir
    })
    console.log('✓ Declaration files generated')
  } catch (error) {
    console.warn('⚠️  Type checking errors found, but declarations may have been partially generated')
    // Don't fail the build - declarations are still useful even with some errors
  }
  
  // Copy index.d.ts to build root as framework.d.ts
  // tsc with --outDir build and rootDir src creates build/index.d.ts
  const indexDts = path.join(buildDir, 'index.d.ts')
  const frameworkDts = path.join(buildDir, 'framework.d.ts')
  
  if (await fs.pathExists(indexDts)) {
    await fs.copy(indexDts, frameworkDts)
    console.log('✓ Copied index.d.ts to framework.d.ts')
  } else {
    console.warn('⚠️  index.d.ts not found at', indexDts)
  }
}

/**
 * Main Build Process
 */
async function main() {
  console.log(`Building @hyperscape/shared in ${dev ? 'development' : 'production'} mode...`)
  
  await buildLibrary()
  
  if (!dev) {
    await generateDeclarations()
  } else {
    await runTypeCheck()
  }
  
  console.log('Build completed successfully!')
}

/**
 * Setup PhysX module for runtime resolution
 * This creates a node_modules symlink in the build folder so dynamic imports work
 */
async function setupPhysXModule() {
  console.log('Setting up PhysX module for runtime resolution...')
  
  const physxSrc = path.join(rootDir, '../physx-js-webidl')
  const nodeModulesDir = path.join(buildDir, 'node_modules/@hyperscape')
  const physxDest = path.join(nodeModulesDir, 'physx-js-webidl')
  
  // Create node_modules/@hyperscape directory
  await fs.ensureDir(nodeModulesDir)
  
  // Remove existing symlink/directory if it exists
  try {
    const stats = await fs.lstat(physxDest).catch(() => null)
    if (stats) {
      await fs.remove(physxDest)
    }
  } catch (e) {
    // Ignore if doesn't exist
  }
  
  // Copy the physx package instead of symlinking (more reliable for bundled code)
  await fs.copy(physxSrc, physxDest, { 
    filter: (src) => !src.includes('node_modules') && !src.includes('.git')
  })
  console.log('✓ PhysX module copied to build/node_modules/')
}

// Run the build
main().then(async () => {
  await setupPhysXModule()
}).catch(error => {
  console.error('Build failed:', error)
  process.exit(1)
})

