#!/usr/bin/env node
/**
 * Manually trigger seed asset generation
 * Use this to test asset generation without restarting dev servers
 */

import fetch from 'node-fetch'

const API_PORT = process.env.FORGE_API_PORT || '3001'

async function generateAsset(config) {
  console.log(`\n🎨 Generating: ${config.name}`)
  
  try {
    const res = await fetch(`http://localhost:${API_PORT}/api/generation/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    
    if (!res.ok) {
      const error = await res.text()
      throw new Error(`HTTP ${res.status}: ${error}`)
    }
    
    const result = await res.json()
    console.log(`✅ Pipeline started: ${result.pipelineId}`)
    console.log(`   Status: ${result.status}`)
    console.log(`   Check: http://localhost:${API_PORT}/api/generation/pipeline/${result.pipelineId}`)
    
    return result.pipelineId
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`)
    return null
  }
}

async function main() {
  console.log('Testing Asset Generation → Hyperscape Integration\n')
  console.log(`Target: /Users/shawwalters/hyperscape-2/packages/hyperscape/world/assets/forge/\n`)
  
  // Test with a simple weapon
  const config = {
    assetId: 'test-bronze-sword',
    name: 'Test Bronze Sword',
    description: 'A basic bronze sword for testing, low-poly RuneScape style',
    type: 'weapon',
    subtype: 'sword',
    style: 'runescape2007',
    generationType: 'item',
    enableRigging: false,
    enableRetexturing: false,
    enableSprites: false
  }
  
  const pipelineId = await generateAsset(config)
  
  if (pipelineId) {
    console.log('\n📊 Monitor progress:')
    console.log(`   curl http://localhost:${API_PORT}/api/generation/pipeline/${pipelineId} | jq`)
    console.log('\n📁 Check output when complete:')
    console.log('   ls packages/hyperscape/world/assets/forge/test-bronze-sword/')
    console.log('   cat packages/hyperscape/world/assets/manifests/items.json')
  }
}

main().catch(e => {
  console.error('Failed:', e)
  process.exit(1)
})


