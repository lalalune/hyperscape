#!/usr/bin/env node

/**
 * Asset Coverage Checker
 * Validates which required assets exist and reports missing ones
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { AssetRequirementsService } from '../server/services/AssetRequirementsService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const assetsDir = path.join(__dirname, '../../hyperscape/world/assets')
  const service = new AssetRequirementsService(assetsDir, assetsDir)
  
  console.log('🔍 Checking asset coverage...\n')
  
  // Print coverage summary
  const coverage = await service.printCoverageSummary()
  
  // Export detailed report
  await service.exportCoverageReport()
  
  // Show generation queue
  if (coverage.missing > 0) {
    console.log('📋 GENERATION QUEUE (Next 10 assets):')
    const queue = await service.getGenerationQueue()
    
    for (let i = 0; i < Math.min(10, queue.length); i++) {
      const asset = queue[i]
      console.log(`  ${i + 1}. [${asset.priority.toUpperCase()}] ${asset.name} (${asset.id})`)
      console.log(`     Type: ${asset.type}/${asset.subtype}`)
      console.log(`     Category: ${asset.category}`)
      console.log('')
    }
    
    console.log(`\n💡 To generate missing assets, run:`)
    console.log(`   bun run generate-missing-assets`)
  } else {
    console.log('✅ All required assets exist!')
  }
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})

