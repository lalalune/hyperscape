#!/usr/bin/env node
/**
 * Check status of 3D Asset Forge integration
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')
const worldAssetsDir = path.join(rootDir, 'world/assets')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
}

console.log(`${colors.cyan}3D Asset Forge → Hyperscape Integration Status${colors.reset}\n`)

// Check Forge API
console.log('🔌 Forge API (http://localhost:3001):')
try {
  const res = await fetch('http://localhost:3001/api/health')
  if (res.ok) {
    const health = await res.json()
    console.log(`   ${colors.green}✓ Running${colors.reset}`)
    console.log(`   Meshy: ${health.services?.meshy ? colors.green + '✓' : colors.yellow + '✗'}${colors.reset}`)
    console.log(`   OpenAI: ${health.services?.openai ? colors.green + '✓' : colors.yellow + '✗'}${colors.reset}`)
  }
} catch (e) {
  console.log(`   ${colors.yellow}✗ Not running${colors.reset}`)
}

// Check directories
console.log('\n📁 File Structure:')
console.log(`   world/assets: ${fs.existsSync(worldAssetsDir) ? colors.green + '✓' : colors.yellow + '✗'}${colors.reset}`)

const forgeDir = path.join(worldAssetsDir, 'forge')
if (fs.existsSync(forgeDir)) {
  const assets = fs.readdirSync(forgeDir).filter(n => !n.startsWith('.'))
  console.log(`   forge/: ${colors.green}✓ ${assets.length} assets${colors.reset}`)
  if (assets.length > 0) {
    console.log(`${colors.dim}   Assets: ${assets.join(', ')}${colors.reset}`)
  }
} else {
  console.log(`   forge/: ${colors.yellow}✗ No assets yet${colors.reset}`)
}

const manifestsDir = path.join(worldAssetsDir, 'manifests')
if (fs.existsSync(manifestsDir)) {
  const manifests = fs.readdirSync(manifestsDir).filter(f => f.endsWith('.json'))
  console.log(`   manifests/: ${colors.green}✓ ${manifests.length} files${colors.reset}`)
  if (manifests.length > 0) {
    console.log(`${colors.dim}   Manifests: ${manifests.join(', ')}${colors.reset}`)
    
    // Count items
    const itemsPath = path.join(manifestsDir, 'items.json')
    if (fs.existsSync(itemsPath)) {
      const items = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'))
      console.log(`   items.json: ${items.length} items`)
    }
  }
} else {
  console.log(`   manifests/: ${colors.yellow}✗ Not created yet${colors.reset}`)
}

// Check bootstrap sentinel
const sentinelPath = path.join(worldAssetsDir, '.bootstrap_done.json')
if (fs.existsSync(sentinelPath)) {
  const sentinel = JSON.parse(fs.readFileSync(sentinelPath, 'utf-8'))
  console.log(`\n🌱 Bootstrap:`)
  console.log(`   ${colors.green}✓ Completed at ${new Date(sentinel.createdAt).toLocaleString()}${colors.reset}`)
  console.log(`${colors.dim}   Seeds: ${sentinel.seeds.join(', ')}${colors.reset}`)
}

console.log('\n📊 URLs:')
console.log(`   Game: http://localhost:3333`)
console.log(`   Forge UI: http://localhost:3003`)
console.log(`   Forge API: http://localhost:3001/api/health`)
console.log(`   Assets: http://localhost:5555/world-assets/`)


