/**
 * AI Creation Demo
 * Example of programmatic usage
 */

import { AICreationService, GenerationRequest, defaultConfig } from '../src'

async function main() {
  // Initialize service with custom config
  const service = new AICreationService({
    ...defaultConfig,
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'dall-e-3'
    },
    meshy: {
      apiKey: process.env.MESHY_API_KEY || '',
      baseUrl: 'https://api.meshy.ai'
    }
  })

  // Example 1: Generate a single weapon
  console.log('🗡️  Generating single weapon...')
  const swordRequest: GenerationRequest = {
    id: 'demo-sword',
    name: 'Flamebrand',
    description: 'A legendary sword with a blade of pure flame, ancient runes glow along its length',
    type: 'weapon',
    subtype: 'sword',
    style: 'realistic'
  }

  // Track progress
  service.on('stage-start', ({ result, stage }) => {
    console.log(`  ⏳ Starting ${stage}...`)
  })

  service.on('stage-complete', ({ result, stage }) => {
    console.log(`  ✅ Completed ${stage}`)
  })

  try {
    const swordResult = await service.generate(swordRequest)
    console.log('  📦 Sword generated:', swordResult.finalAsset?.modelUrl)
    console.log('')
  } catch (error) {
    console.error('  ❌ Failed:', error)
  }

  // Example 2: Batch generate armor set
  console.log('🛡️  Generating armor set...')
  const armorPieces: GenerationRequest[] = [
    {
      id: 'dragon-helmet',
      name: 'Dragon Scale Helmet',
      description: 'A helmet forged from dragon scales with horn-like protrusions',
      type: 'armor',
      subtype: 'helmet',
      style: 'realistic'
    },
    {
      id: 'dragon-chest',
      name: 'Dragon Scale Chestplate',
      description: 'Heavy chestplate made from overlapping dragon scales',
      type: 'armor',
      subtype: 'chest',
      style: 'realistic'
    },
    {
      id: 'dragon-gloves',
      name: 'Dragon Scale Gauntlets',
      description: 'Clawed gauntlets with dragon scale protection',
      type: 'armor',
      subtype: 'gloves',
      style: 'realistic'
    }
  ]

  const armorResults = await service.batchGenerate(armorPieces)
  console.log(`  📦 Generated ${armorResults.length} armor pieces`)
  console.log('')

  // Example 3: Generate a character with rigging
  console.log('👹 Generating character...')
  const characterRequest: GenerationRequest = {
    id: 'demo-goblin',
    name: 'Goblin Scout',
    description: 'A sneaky goblin scout with leather armor and daggers',
    type: 'character',
    style: 'stylized',
    metadata: {
      creatureType: 'biped'
    }
  }

  const characterResult = await service.generate(characterRequest)
  console.log('  📦 Character generated:', characterResult.finalAsset?.modelUrl)
  
  // Check rigging result
  if (characterResult.analysisResult && 'rigType' in characterResult.analysisResult) {
    console.log('  🦴 Rig type:', characterResult.analysisResult.rigType)
    console.log('  🦴 Bones:', characterResult.analysisResult.bones.length)
    console.log('  🎬 Animations:', characterResult.analysisResult.animations?.join(', '))
  }
  console.log('')

  // Example 4: Regenerate a stage
  console.log('🔄 Demonstrating stage regeneration...')
  
  // First, get an existing generation
  const existingGen = await service.getGeneration('demo-sword')
  if (existingGen) {
    console.log('  📝 Found existing generation')
    console.log('  🔄 Regenerating from remesh stage...')
    
    const regenerated = await service.regenerateStage('demo-sword', 'remesh')
    console.log('  ✅ Regeneration complete')
  }

  // Example 5: Check active generations
  const active = service.getActiveGenerations()
  console.log(`\n📊 Active generations: ${active.length}`)
}

// Run demo
main().catch(console.error) 