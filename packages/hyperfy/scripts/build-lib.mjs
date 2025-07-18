#!/usr/bin/env node

import { build } from 'esbuild'
import fs from 'fs-extra'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '../')
const buildDir = resolve(__dirname, '../build/lib')

async function buildLibrary() {
  console.log('🔨 Building hyperfy as library...')

  // Clean build directory
  await fs.emptyDir(buildDir)

  // Build with esbuild
  await build({
    entryPoints: [resolve(__dirname, '../src/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outfile: resolve(__dirname, '../build/lib/index.js'),
    external: [
      'three',
      'three/*',
      '@elizaos/*',
      'lodash-es',
      'uuid',
      'events',
      'path',
      'fs',
      'url',
      'child_process',
      'util',
      'stream',
      'buffer',
      'crypto',
      'os',
      'http',
      'https',
      'net',
      'tls',
      'zlib',
      'querystring',
      'assert',
      'constants',
      'async_hooks',
      'inspector',
      'perf_hooks',
      'trace_events',
      'v8',
      'vm',
      'worker_threads',
      'cluster',
      'dgram',
      'dns',
      'domain',
      'readline',
      'repl',
      'tty',
      'string_decoder',
      'punycode',
      'module',
      'process',
      'timers',
      'console',
    ],
    sourcemap: true,
    minify: false,
    keepNames: true,
    metafile: true,
  })

  // Generate TypeScript declarations
  console.log('📝 Generating TypeScript declarations...')
  try {
    execSync('tsc --project tsconfig.lib.json', {
      cwd: resolve(__dirname, '..'),
      stdio: 'inherit',
    })
  } catch (error) {
    console.error('❌ Failed to generate TypeScript declarations:', error)
    process.exit(1)
  }

  // Copy package.json
  const packageJson = await fs.readJson(resolve(__dirname, '../package.json'))
  packageJson.main = 'index.js'
  packageJson.types = 'index.d.ts'
  delete packageJson.scripts
  delete packageJson.devDependencies
  await fs.writeJson(resolve(__dirname, '../build/lib/package.json'), packageJson, { spaces: 2 })

  console.log('✅ Library build complete!')
}

buildLibrary().catch(error => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})
