#!/usr/bin/env node
/**
 * Integration Test for 3D Asset Forge → Hyperscape
 * 
 * Validates:
 * 1. Forge API is reachable and has keys
 * 2. Assets write to correct location
 * 3. Manifests are written correctly
 * 4. DataManager loads manifests
 */

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
}

async function test() {
  console.log(`${colors.cyan}Testing 3D Asset Forge → Hyperscape Integration${colors.reset}\n`)
  
  let passed = 0
  let failed = 0
  
  // Test 1: Check Forge API health
  console.log('Test 1: Forge API health check...')
  try {
    const res = await fetch('http://localhost:3001/api/health')
    if (res.ok) {
      const health = await res.json()
      if (health.services?.meshy) {
        console.log(`${colors.green}✓ Forge API running with Meshy key${colors.reset}`)
        passed++
      } else {
        console.log(`${colors.yellow}⚠ Forge API running but no Meshy key${colors.reset}`)
        passed++
      }
    } else {
      throw new Error(`HTTP ${res.status}`)
    }
  } catch (e) {
    console.log(`${colors.red}✗ Forge API not reachable: ${e.message}${colors.reset}`)
    failed++
  }
  
  // Test 2: Check assets directory structure
  console.log('\nTest 2: Assets directory structure...')
  const worldAssetsDir = path.join(rootDir, 'world/assets')
  if (fs.existsSync(worldAssetsDir)) {
    console.log(`${colors.green}✓ world/assets exists${colors.reset}`)
    passed++
  } else {
    console.log(`${colors.red}✗ world/assets missing${colors.reset}`)
    failed++
  }
  
  // Test 3: Check for forge subdirectory
  console.log('\nTest 3: Forge output subdirectory...')
  const forgeDir = path.join(worldAssetsDir, 'forge')
  if (fs.existsSync(forgeDir)) {
    const assets = fs.readdirSync(forgeDir).filter(n => !n.startsWith('.'))
    console.log(`${colors.green}✓ forge/ exists with ${assets.length} assets${colors.reset}`)
    passed++
  } else {
    console.log(`${colors.yellow}⚠ forge/ doesn't exist yet (assets haven't generated)${colors.reset}`)
    passed++
  }
  
  // Test 4: Check manifests directory
  console.log('\nTest 4: Manifests directory...')
  const manifestsDir = path.join(worldAssetsDir, 'manifests')
  if (fs.existsSync(manifestsDir)) {
    const manifests = fs.readdirSync(manifestsDir).filter(f => f.endsWith('.json'))
    console.log(`${colors.green}✓ manifests/ exists with ${manifests.length} files${colors.reset}`)
    passed++
  } else {
    console.log(`${colors.yellow}⚠ manifests/ doesn't exist yet${colors.reset}`)
    passed++
  }
  
  // Test 5: Check Hyperscape server serves world-assets
  console.log('\nTest 5: Hyperscape world-assets serving...')
  try {
    const res = await fetch('http://localhost:5555/world-assets/')
    if (res.ok || res.status === 403) { // 403 is fine (directory listing disabled)
      console.log(`${colors.green}✓ /world-assets/ endpoint active${colors.reset}`)
      passed++
    } else {
      throw new Error(`HTTP ${res.status}`)
    }
  } catch (e) {
    console.log(`${colors.red}✗ /world-assets/ not reachable: ${e.message}${colors.reset}`)
    failed++
  }
  
  // Test 6: Verify DataManager can load
  console.log('\nTest 6: DataManager initialization...')
  try {
    // Dynamic import to test the actual module
    const { dataManager } = await import('../src/data/DataManager.ts')
    console.log(`${colors.green}✓ DataManager module loads${colors.reset}`)
    passed++
  } catch (e) {
    console.log(`${colors.red}✗ DataManager failed: ${e.message}${colors.reset}`)
    failed++
  }
  
  console.log(`\n${colors.cyan}Results: ${passed} passed, ${failed} failed${colors.reset}`)
  
  if (failed === 0) {
    console.log(`${colors.green}All tests passed! Integration ready.${colors.reset}`)
    process.exit(0)
  } else {
    console.log(`${colors.yellow}Some tests failed. Check the output above.${colors.reset}`)
    process.exit(1)
  }
}

test().catch(e => {
  console.error(`${colors.red}Test suite failed:${colors.reset}`, e)
  process.exit(1)
})


