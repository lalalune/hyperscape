/**
 * Building Generation Demo
 * Example of generating banks, stores, and other buildings
 */

import { AICreationService, GenerationRequest, BuildingAnalysisResult, defaultConfig } from '../src'

async function main() {
  // Initialize service
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

  // Example 1: Generate a bank
  console.log('🏦 Generating bank building...')
  
  const bankRequest: GenerationRequest = {
    id: 'bank-varrock',
    name: 'Grand Bank of Varrock',
    description: 'Impressive bank building with marble columns, golden vault door, and grand entrance',
    type: 'building',
    subtype: 'bank',
    style: 'realistic'
  }

  try {
    const bankResult = await service.generate(bankRequest)
    console.log('✅ Bank generated:', bankResult.finalAsset?.modelUrl)
    
    // Check building analysis
    if (bankResult.analysisResult && 'buildingType' in bankResult.analysisResult) {
      const analysis = bankResult.analysisResult as BuildingAnalysisResult
      console.log('\n📊 Bank Analysis:')
      console.log('  Entry points:', analysis.entryPoints.length)
      console.log('  Functional areas:', analysis.functionalAreas.map(a => a.name).join(', '))
      console.log('  NPC positions:', analysis.npcPositions?.length || 0)
      console.log('  Floors:', analysis.metadata?.floors || 1)
    }
  } catch (error) {
    console.error('❌ Bank generation failed:', error)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Example 2: Generate different types of stores
  const stores = [
    {
      id: 'general-store',
      name: 'General Store',
      description: 'Cozy shop with wooden storefront, display windows showing various goods',
      subtype: 'store' as const
    },
    {
      id: 'magic-shop',
      name: 'Mystic Emporium',
      description: 'Magical shop with glowing crystals, arcane symbols, and mystical atmosphere',
      subtype: 'store' as const
    },
    {
      id: 'armor-shop',
      name: 'The Iron Forge',
      description: 'Blacksmith shop with armor displays, weapon racks, and forge in back',
      subtype: 'store' as const
    }
  ]

  for (const store of stores) {
    console.log(`🏪 Generating ${store.name}...`)
    
    const storeRequest: GenerationRequest = {
      id: store.id,
      name: store.name,
      description: store.description,
      type: 'building',
      subtype: store.subtype,
      style: 'stylized'
    }

    try {
      const result = await service.generate(storeRequest)
      console.log(`  ✅ Generated: ${result.finalAsset?.modelUrl}`)
      
      if (result.analysisResult && 'buildingType' in result.analysisResult) {
        const analysis = result.analysisResult as BuildingAnalysisResult
        const shopCounter = analysis.functionalAreas.find(a => a.type === 'counter')
        const displayArea = analysis.functionalAreas.find(a => a.type === 'display')
        
        console.log(`  📍 Shop counter at: ${JSON.stringify(shopCounter?.position)}`)
        console.log(`  📦 Display area: ${displayArea ? 'Yes' : 'No'}`)
        console.log(`  👤 Shopkeeper position: ${JSON.stringify(analysis.npcPositions?.[0]?.position)}`)
      }
      console.log('')
    } catch (error) {
      console.error(`  ❌ Failed:`, error)
    }
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Example 3: Generate a complete town center
  console.log('🏘️ Generating town center buildings...')
  
  const townBuildings: GenerationRequest[] = [
    {
      id: 'town-bank',
      name: 'Lumbridge Bank',
      description: 'Small town bank with friendly atmosphere, wooden structure with iron vault',
      type: 'building',
      subtype: 'bank',
      style: 'stylized'
    },
    {
      id: 'town-store',
      name: 'Lumbridge General Store',
      description: 'Basic shop selling everyday adventuring supplies',
      type: 'building',
      subtype: 'store',
      style: 'stylized'
    },
    {
      id: 'town-inn',
      name: 'The Prancing Pony Inn',
      description: 'Cozy inn with warm lights, chimney smoke, and welcoming entrance',
      type: 'building',
      subtype: 'inn',
      style: 'stylized'
    },
    {
      id: 'town-temple',
      name: 'Temple of Saradomin',
      description: 'White stone temple with blue banners and holy symbols',
      type: 'building',
      subtype: 'temple',
      style: 'stylized'
    }
  ]

  const townResults = await service.batchGenerate(townBuildings)
  
  console.log(`\n📊 Town Center Summary:`)
  console.log(`  Total buildings: ${townResults.length}`)
  console.log(`  Successfully generated: ${townResults.filter(r => r.finalAsset).length}`)
  
  // Display layout information
  console.log(`\n🗺️ Town Layout:`)
  for (const result of townResults) {
    if (result.analysisResult && 'buildingType' in result.analysisResult) {
      const analysis = result.analysisResult as BuildingAnalysisResult
      const mainEntry = analysis.entryPoints.find(e => e.isMain)
      
      console.log(`\n  ${result.request.name}:`)
      console.log(`    Type: ${analysis.buildingType}`)
      console.log(`    Main entrance: ${JSON.stringify(mainEntry?.position)}`)
      console.log(`    Interior size: ${JSON.stringify(analysis.interiorSpace?.size)}`)
      console.log(`    NPCs: ${analysis.npcPositions?.map(n => n.role).join(', ') || 'None'}`)
    }
  }

  // Example 4: Demonstrate building analysis features
  console.log('\n\n🔍 Detailed Building Analysis Example:')
  
  const detailedBankRequest: GenerationRequest = {
    id: 'detailed-bank',
    name: 'Royal Bank of Falador',
    description: 'Massive royal bank with multiple floors, grand vault, ornate architecture',
    type: 'building',
    subtype: 'bank',
    style: 'realistic',
    metadata: {
      floors: 3,
      hasBasement: true
    }
  }

  const detailedResult = await service.generate(detailedBankRequest)
  
  if (detailedResult.analysisResult && 'buildingType' in detailedResult.analysisResult) {
    const analysis = detailedResult.analysisResult as BuildingAnalysisResult
    
    console.log('\n📐 Detailed Analysis:')
    console.log('\nEntry Points:')
    for (const entry of analysis.entryPoints) {
      console.log(`  - ${entry.name}: ${entry.isMain ? 'Main' : 'Secondary'} entrance`)
      console.log(`    Position: ${JSON.stringify(entry.position)}`)
    }
    
    console.log('\nFunctional Areas:')
    for (const area of analysis.functionalAreas) {
      console.log(`  - ${area.name} (${area.type})`)
      console.log(`    Position: ${JSON.stringify(area.position)}`)
      console.log(`    Size: ${JSON.stringify(area.size)}`)
    }
    
    console.log('\nNPC Positions:')
    for (const npc of analysis.npcPositions || []) {
      console.log(`  - ${npc.role}`)
      console.log(`    Position: ${JSON.stringify(npc.position)}`)
      console.log(`    Rotation: ${JSON.stringify(npc.rotation)}`)
    }
    
    console.log('\nBuilding Metadata:')
    console.log(`  Floors: ${analysis.metadata?.floors}`)
    console.log(`  Has Basement: ${analysis.metadata?.hasBasement}`)
    console.log(`  Has Roof: ${analysis.metadata?.hasRoof}`)
  }
}

// Run demo
main().catch(console.error) 