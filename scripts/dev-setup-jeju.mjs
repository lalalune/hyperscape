#!/usr/bin/env node
/**
 * Minimal Development Setup for Jeju Environment
 * 
 * Skips localnet setup since Jeju dev environment handles that.
 * Only does build preparation.
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
}

console.log(`${colors.blue}Setting up Hyperscape for Jeju dev environment...${colors.reset}`)

// 1. Ensure build directories exist
const dirs = [
  'packages/shared/build',
  'packages/server/build',
  'packages/client/dist',
  'assets/web',
]

for (const dir of dirs) {
  const fullPath = path.join(rootDir, dir)
  await fs.promises.mkdir(fullPath, { recursive: true })
}

// 2. Copy PhysX assets if available
const physxSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist')
const physxDest = path.join(rootDir, 'assets/web')

if (fs.existsSync(physxSrc)) {
  const files = ['physx-js-webidl.wasm', 'physx-js-webidl.js', 'physx-js-webidl.d.ts']
  for (const file of files) {
    const src = path.join(physxSrc, file)
    const dest = path.join(physxDest, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
    }
  }
}

// 3. Build shared package
try {
  execSync('cd packages/shared && bun run build', {
    stdio: 'inherit',
    cwd: rootDir,
    shell: true
  })
} catch (e) {
  console.log(`${colors.yellow}⚠️  Shared build failed (will retry in watch mode)${colors.reset}`)
}

console.log(`${colors.green}✓ Setup complete (using Jeju localnet)${colors.reset}`)

