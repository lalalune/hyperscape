#!/usr/bin/env node

import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { build } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')
const clientBuildDir = path.join(rootDir, 'dist/client')

/**
 * Run TypeScript type checking
 */
async function runTypeCheck() {
  console.log('🔍 Running TypeScript type checking...')
  try {
    execSync('npx tsc --noEmit', {
      stdio: 'inherit',
      cwd: rootDir,
    })
    console.log('✅ Type checking passed')
  } catch (error) {
    console.error('❌ Type checking failed!')
    process.exit(1)
  }
}

/**
 * Build client with Vite
 */
async function buildClient() {
  console.log('🔨 Building client with Vite...')

  await build({
    configFile: path.join(rootDir, 'vite.config.ts'),
    mode: 'production',
  })

  // Copy PhysX files to client build (in client-assets directory)
  const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
  const physxWasmDest = path.join(clientBuildDir, 'client-assets', 'physx-js-webidl.wasm')
  await fs.ensureDir(path.join(clientBuildDir, 'client-assets'))
  await fs.copy(physxWasmSrc, physxWasmDest)

  console.log('✅ Client build complete')
}

/**
 * Build server with ESBuild
 */
async function buildServer() {
  console.log('🔨 Building server with ESBuild...')

  const result = await esbuild.build({
    entryPoints: ['src/server/index.ts'],
    outfile: 'build/index.js',
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    target: 'node22',
    metafile: true,
    define: {
      'process.env.CLIENT': 'false',
      'process.env.SERVER': 'true',
    },
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
  })

  // Copy PhysX files
  const physxJsSrc = path.join(rootDir, 'src/core/physx-js-webidl.js')
  const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
  const physxJsDest = path.join(buildDir, 'physx-js-webidl.js')
  const physxWasmDest = path.join(buildDir, 'physx-js-webidl.wasm')

  await fs.copy(physxJsSrc, physxJsDest)
  await fs.copy(physxWasmSrc, physxWasmDest)

  // Write metafile for analysis
  await fs.writeFile(path.join(buildDir, 'server-meta.json'), JSON.stringify(result.metafile, null, 2))

  console.log('✅ Server build complete')
}

/**
 * Generate TypeScript declarations
 */
async function generateDeclarations() {
  console.log('📝 Generating TypeScript declarations...')
  try {
    execSync('npx tsc --emitDeclarationOnly', {
      stdio: 'inherit',
      cwd: rootDir,
    })

    // Create a simple index.d.ts
    const indexDeclaration = `// TypeScript declarations for Hyperfy
export * from './core/index';
export * from './types/index';
`
    await fs.writeFile(path.join(rootDir, 'build/index.d.ts'), indexDeclaration)
    console.log('✅ Declaration files generated')
  } catch (error) {
    console.error('❌ Declaration generation failed!')
    process.exit(1)
  }
}

/**
 * Main production build
 */
async function main() {
  console.log('🚀 Building Hyperfy for production...')

  // Disable debug mode during build
  process.env.NODE_OPTIONS = '--max-old-space-size=4096'

  // Clean directories
  await fs.emptyDir(buildDir)
  await fs.emptyDir(clientBuildDir)

  // Run type checking first
  await runTypeCheck()

  // Build client and server in parallel
  await Promise.all([buildClient(), buildServer()])

  // Generate declarations
  await generateDeclarations()

  console.log('\n✨ Production build complete!')
  console.log(`   📦 Server: ${buildDir}`)
  console.log(`   📦 Client: ${clientBuildDir}`)
  console.log('\n   Run "npm start" to start the server\n')
}

// Run the build
main().catch(error => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})
