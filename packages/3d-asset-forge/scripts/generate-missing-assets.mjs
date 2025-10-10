#!/usr/bin/env node

/**
 * Generate Missing Assets
 * Automatically generates all missing required assets based on priority
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { AssetRequirementsService } from '../server/services/AssetRequirementsService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  priority: 'all',
  limit: 10,
  dryRun: false,
  category: null
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--priority' && args[i + 1]) {
    options.priority = args[i + 1]
    i++
  } else if (args[i] === '--limit' && args[i + 1]) {
    options.limit = parseInt(args[i + 1], 10)
    i++
  } else if (args[i] === '--dry-run') {
    options.dryRun = true
  } else if (args[i] === '--category' && args[i + 1]) {
    options.category = args[i + 1]
    i++
  } else if (args[i] === '--help') {
    printHelp()
    process.exit(0)
  }
}

function printHelp() {
  console.log(`
Generate Missing Assets

Usage:
  bun run generate-missing-assets [options]

Options:
  --priority <level>    Generate only assets with this priority (critical|high|medium|low|all)
                        Default: all
  --limit <n>           Maximum number of assets to generate
                        Default: 10
  --category <name>     Generate only assets from this category (weapons|armor|mobs|etc)
  --dry-run             Show what would be generated without actually generating
  --help                Show this help message

Examples:
  # Generate next 10 critical priority assets
  bun run generate-missing-assets --priority critical --limit 10

  # Generate all missing weapons
  bun run generate-missing-assets --category weapons

  # Preview what would be generated
  bun run generate-missing-assets --dry-run --limit 5
`)
}

async function main() {
  const assetsDir = path.join(__dirname, '../../hyperscape/world/assets')
  const service = new AssetRequirementsService(assetsDir, assetsDir)
  
  console.log('🔍 Loading asset requirements...\n')
  
  const queue = await service.getGenerationQueue()
  
  // Filter by priority if specified
  let filtered = queue
  if (options.priority !== 'all') {
    filtered = filtered.filter(asset => asset.priority === options.priority)
  }
  
  // Filter by category if specified
  if (options.category) {
    filtered = filtered.filter(asset => asset.category === options.category)
  }
  
  // Apply limit
  const toBatch = filtered.slice(0, options.limit)
  
  if (toBatch.length === 0) {
    console.log('✅ No missing assets found matching criteria!')
    return
  }
  
  console.log(`📋 Found ${filtered.length} missing assets matching criteria`)
  console.log(`📦 Will generate ${toBatch.length} assets:\n`)
  
  for (let i = 0; i < toBatch.length; i++) {
    const asset = toBatch[i]
    console.log(`${i + 1}. [${asset.priority.toUpperCase()}] ${asset.name}`)
    console.log(`   ID: ${asset.id}`)
    console.log(`   Type: ${asset.type}/${asset.subtype}`)
    console.log(`   Category: ${asset.category}`)
    if (asset.requiredFor) {
      console.log(`   Required for: ${asset.requiredFor.join(', ')}`)
    }
    console.log('')
  }
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN - No assets will be generated')
    console.log('\nRemove --dry-run flag to actually generate these assets')
    return
  }
  
  console.log('⚠️  AUTOMATIC GENERATION NOT YET IMPLEMENTED')
  console.log('\nTo generate these assets:')
  console.log('1. Open 3D Asset Forge UI: bun run dev (in packages/3d-asset-forge)')
  console.log('2. Go to Generation tab')
  console.log('3. Use the asset list above to create each asset')
  console.log('')
  console.log('Or create a batch generation config:')
  
  const batchConfig = await service.createBatchGenerationConfig(
    options.limit,
    options.priority !== 'all' ? options.priority : null
  )
  
  const configPath = path.join(assetsDir, 'manifests', 'batch-generation.json')
  await fs.writeFile(configPath, JSON.stringify({ assets: batchConfig }, null, 2))
  
  console.log(`\n💾 Batch generation config saved to:`)
  console.log(`   ${configPath}`)
  console.log(`\nYou can use this config to batch-generate assets in the UI`)
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

