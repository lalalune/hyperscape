#!/usr/bin/env node

/**
 * Generate Missing Assets
 * Automatically generates all missing required assets based on priority
 */

import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { AssetRequirementsService } from '../server/services/AssetRequirementsService.mjs'

// Load environment variables
dotenv.config()

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
  // Validate API keys are present (check both VITE_ prefixed and non-prefixed)
  const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
  const meshyKey = process.env.MESHY_API_KEY || process.env.VITE_MESHY_API_KEY
  
  if (!openaiKey || !meshyKey) {
    console.error('❌ ERROR: Missing required API keys!')
    console.error('\nChecked for:')
    console.error('  OPENAI_API_KEY or VITE_OPENAI_API_KEY')
    console.error('  MESHY_API_KEY or VITE_MESHY_API_KEY')
    console.error('\nFound in env:')
    console.error(`  OPENAI: ${process.env.OPENAI_API_KEY ? 'YES' : 'NO'}, VITE_OPENAI: ${process.env.VITE_OPENAI_API_KEY ? 'YES' : 'NO'}`)
    console.error(`  MESHY: ${process.env.MESHY_API_KEY ? 'YES' : 'NO'}, VITE_MESHY: ${process.env.VITE_MESHY_API_KEY ? 'YES' : 'NO'}`)
    process.exit(1)
  }
  
  // Set environment variables for GenerationService to use
  if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY
  }
  if (!process.env.MESHY_API_KEY && process.env.VITE_MESHY_API_KEY) {
    process.env.MESHY_API_KEY = process.env.VITE_MESHY_API_KEY
  }
  if (!process.env.IMAGE_SERVER_URL && process.env.VITE_IMAGE_SERVER_URL) {
    process.env.IMAGE_SERVER_URL = process.env.VITE_IMAGE_SERVER_URL
  }
  
  console.log('✅ API keys found')
  console.log(`   OpenAI: ${openaiKey.substring(0, 10)}...`)
  console.log(`   Meshy: ${meshyKey.substring(0, 10)}...`)
  
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
  
  // Import generation service dynamically
  const { GenerationService } = await import('../server/services/GenerationService.mjs')
  const generationService = new GenerationService()
  
  console.log('\n🚀 Starting automatic generation...\n')
  console.log('⏱️  This will take approximately 2-5 minutes per asset')
  console.log(`📊 Total estimated time: ${Math.ceil(toBatch.length * 3)} minutes\n`)
  
  let successCount = 0
  let failCount = 0
  
  for (let i = 0; i < toBatch.length; i++) {
    const asset = toBatch[i]
    console.log(`\n[${ i + 1}/${toBatch.length}] Generating: ${asset.name} (${asset.id})`)
    console.log(`   Priority: ${asset.priority.toUpperCase()}`)
    console.log(`   Type: ${asset.type}/${asset.subtype}`)
    
    try {
      // Create generation config
      const config = {
        assetId: asset.id,
        name: asset.name,
        description: asset.description || `A ${asset.name} for a RuneScape-style RPG game`,
        type: asset.type,
        subtype: asset.subtype,
        generationType: asset.category === 'mobs' || asset.category === 'avatars' ? 'avatar' : 'item',
        style: 'runescape2007',
        enablePromptEnhancement: true,
        enableRigging: false,
        enableSprites: false
      }
      
      // Start pipeline
      const result = await generationService.startPipeline(config)
      console.log(`   ✅ Pipeline started: ${result.pipelineId}`)
      
      // Wait for pipeline to complete (poll status)
      let completed = false
      let attempts = 0
      const maxAttempts = 120 // 10 minutes max (5 second intervals)
      
      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
        
        const status = generationService.getPipelineStatus(result.pipelineId)
        if (!status) {
          console.log(`   ❌ Pipeline lost`)
          break
        }
        
        // Log progress
        if (attempts % 6 === 0) { // Every 30 seconds
          console.log(`   ⏳ Progress: ${Math.round(status.progress)}% (${status.status})`)
        }
        
        if (status.status === 'completed') {
          console.log(`   ✅ Generation completed!`)
          completed = true
          successCount++
        } else if (status.status === 'failed') {
          console.log(`   ❌ Generation failed: ${status.error || 'Unknown error'}`)
          failCount++
          break
        }
        
        attempts++
      }
      
      if (!completed && attempts >= maxAttempts) {
        console.log(`   ⏱️  Timeout after ${maxAttempts * 5} seconds`)
        failCount++
      }
      
    } catch (error) {
      console.error(`   ❌ Error generating ${asset.name}:`, error.message)
      failCount++
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 GENERATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Successful: ${successCount}/${toBatch.length}`)
  console.log(`❌ Failed: ${failCount}/${toBatch.length}`)
  console.log(`\n💾 Assets saved to: ${path.join(assetsDir, 'models')}`)
  console.log('\n📝 Next steps:')
  console.log('   1. Refresh your browser to load new models')
  console.log('   2. Run bun run assets:normalize to optimize models')
  console.log('   3. Run bun run assets:rebuild-manifests to update manifests')
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

