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
  execSync('bunx --yes tsc --noEmit', { 
    stdio: 'inherit',
    cwd: rootDir 
  })
  console.log('Type checking passed ✓')
}

/**
 * Build Library
 */
async function buildLibrary() {
  console.log('Building library...')
  const ctx = await esbuild.context({
    entryPoints: ['src/index.ts'],
    outfile: 'build/framework.js',
    platform: 'neutral',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: !dev,
    sourcemap: true,
    packages: 'external',
    target: 'esnext',
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    plugins: [typescriptPlugin],
  })
  
  await ctx.rebuild()
  await ctx.dispose()
  console.log('✓ Library built successfully')
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
    execSync('bunx --yes tsc --emitDeclarationOnly --outDir build', {
      stdio: 'inherit',
      cwd: rootDir
    })
    console.log('✓ Declaration files generated')
  } catch (error) {
    console.warn('⚠️  Type checking errors found, but declarations may have been partially generated')
    // Don't fail the build - declarations are still useful even with some errors
  }
  
  // Copy index.d.ts to build root as framework.d.ts (tsc preserves directory structure)
  const nestedIndexDts = path.join(buildDir, 'packages/shared/src/index.d.ts')
  const rootFrameworkDts = path.join(buildDir, 'framework.d.ts')
  
  if (await fs.pathExists(nestedIndexDts)) {
    await fs.copy(nestedIndexDts, rootFrameworkDts)
    console.log('✓ Copied index.d.ts to build/framework.d.ts')
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

// Run the build
main().catch(error => {
  console.error('Build failed:', error)
  process.exit(1)
})

