#!/usr/bin/env node
/**
 * Development Setup Script
 * 
 * Ensures all prerequisites are met before starting dev servers:
 * - CDN is running
 * - Build directories exist
 * - PhysX assets are copied
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
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
}

console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════╗
║   Hyperscape Development Setup            ║
╚═══════════════════════════════════════════╝
${colors.reset}`)

// 1. Ensure build directories exist
console.log(`${colors.blue}Creating build directories...${colors.reset}`)
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
console.log(`${colors.green}✓ Build directories ready${colors.reset}`)

// 2. Copy PhysX assets
console.log(`${colors.blue}Copying PhysX assets...${colors.reset}`)
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
  console.log(`${colors.green}✓ PhysX assets copied${colors.reset}`)
} else {
  console.log(`${colors.yellow}⚠️  PhysX package not found - run 'bun install' first${colors.reset}`)
}

// 3. Build shared package once before starting dev servers
console.log(`${colors.blue}Building shared package...${colors.reset}`)
try {
  execSync('cd packages/shared && bun run build', {
    stdio: 'inherit',
    cwd: rootDir,
    shell: true
  })
  console.log(`${colors.green}✓ Shared package built${colors.reset}`)
} catch (e) {
  console.log(`${colors.yellow}⚠️  Shared build failed (will retry in watch mode)${colors.reset}`)
}

// 4. Start CDN
console.log(`${colors.blue}Starting CDN...${colors.reset}`)
try {
  execSync('bun scripts/cdn.mjs', {
    stdio: 'inherit',
    cwd: rootDir
  })
} catch (e) {
  console.log(`${colors.yellow}⚠️  CDN setup failed (non-fatal)${colors.reset}`)
}

console.log(`\n${colors.bright}${colors.green}✓ Setup complete!${colors.reset}`)
console.log(`${colors.dim}Run 'bun run dev' to start all dev servers${colors.reset}\n`)

