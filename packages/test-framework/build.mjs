import * as esbuild from 'esbuild'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true })
}

// First generate TypeScript declarations
console.log('Generating TypeScript declarations...')
execSync('tsc --emitDeclarationOnly', { stdio: 'inherit' })

// Then bundle with esbuild
console.log('Building with esbuild...')

await esbuild.build({
  entryPoints: [
    'src/index.ts',
    'src/cli.ts',
    'src/world-map-testing/SimpleRPGTest.ts'
  ],
  bundle: true, // Bundle to handle imports properly
  outdir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  external: [
    // Mark workspace dependencies as external
    '@hyperscape/hyperfy',
    // Mark Node.js built-ins as external
    'fs', 'path', 'url', 'child_process', 'events', 'crypto', 'os',
    // Mark dependencies as external
    'playwright', 'chalk', 'commander', 'fs-extra', 'better-sqlite3', 'tsx',
    // Keep three.js external since it's imported via hyperfy
    'three'
  ],
  define: {
    // Ensure Node.js compatibility
    'import.meta.url': 'import.meta.url'
  },
  loader: {
    '.ts': 'ts'
  },
  packages: 'external' // Keep all packages external by default
})

console.log('Build completed!')