#!/usr/bin/env bun

/**
 * Usage Example: Complete Meshy AI Integration Workflow
 * 
 * This example shows how to use all the services together to:
 * 1. Generate 3D models for RPG items and mobs
 * 2. Detect hardpoints for weapons 
 * 3. Apply performance optimizations
 * 4. Generate visualizations and reports
 */

import { MeshyAIService } from './MeshyAIService'
import { PromptAugmentationService } from './PromptAugmentationService'
import { HardpointDetectionService } from './HardpointDetectionService'
import { BatchGenerationService } from './BatchGenerationService'
import { VisualizationService } from './VisualizationService'

// Example data
const sampleWeapons = [
  {
    id: 1,
    name: "Bronze Sword",
    examine: "A simple bronze sword with leather-wrapped handle",
    equipment: { weaponType: "sword", slot: "weapon" }
  },
  {
    id: 2,
    name: "Wooden Bow", 
    examine: "A sturdy wooden longbow with hemp string",
    equipment: { weaponType: "bow", slot: "weapon" }
  },
  {
    id: 3,
    name: "Steel Crossbow",
    examine: "A heavy crossbow with steel prod",
    equipment: { weaponType: "crossbow", slot: "weapon" }
  }
]

const sampleMobs = [
  {
    id: 1,
    name: "Goblin Warrior",
    examine: "A small green humanoid with crude armor",
    npcType: "monster",
    level: 5
  },
  {
    id: 2,
    name: "Skeleton Archer",
    examine: "An undead archer with glowing eyes",
    npcType: "monster", 
    level: 12
  }
]

async function demonstrateWorkflow() {
  console.log('🎯 Meshy AI Integration - Complete Workflow Example')
  console.log('=' .repeat(60))

  // Initialize services
  const meshyService = new MeshyAIService({
    apiKey: process.env.MESHY_API_KEY || 'demo-key'
  })

  const promptService = new PromptAugmentationService({
    artStyle: 'realistic',
    includeOrientation: true,
    includeMaterials: true
  })

  const hardpointService = new HardpointDetectionService({
    confidenceThreshold: 0.7,
    visualizationEnabled: true
  })

  const batchService = new BatchGenerationService(meshyService, {
    maxConcurrentTasks: 3,
    enableHardpointDetection: true,
    enableRetexturing: true
  })

  const visualizationService = new VisualizationService({
    outputFormat: 'html',
    showHardpointMarkers: true,
    showConfidenceHeatmap: true
  })

  // Example 1: Single Weapon Generation with Hardpoint Detection
  console.log('\n🗡️  Example 1: Single Weapon Generation')
  console.log('-' .repeat(40))

  const sword = sampleWeapons[0]
  
  // Step 1: Create augmented prompt
  const augmentedPrompt = promptService.augmentWeaponPrompt(
    sword.examine,
    sword.equipment.weaponType,
    sword
  )
  
  console.log('Enhanced Prompt:', augmentedPrompt.enhancedPrompt)
  console.log('Hardpoint Hints:', augmentedPrompt.hardpointHints?.primaryGripLocation)
  console.log('Orientation:', augmentedPrompt.orientationRules.pose)

  // Step 2: Mock hardpoint detection (since we don't have actual 3D geometry)
  const mockGeometry = { vertices: [], triangles: [] }
  const hardpoints = await hardpointService.detectWeaponHardpoints(
    mockGeometry,
    sword.equipment.weaponType
  )
  
  console.log('Detected Hardpoints:')
  console.log(`  Primary Grip: ${hardpoints.primaryGrip.position.x}, ${hardpoints.primaryGrip.position.y}, ${hardpoints.primaryGrip.position.z}`)
  console.log(`  Confidence: ${(hardpoints.confidence * 100).toFixed(1)}%`)

  // Step 3: Generate visualization
  const visualization = await visualizationService.visualizeHardpoints(hardpoints)
  console.log('Generated visualization with interactive 3D viewer')

  // Example 2: Batch Generation
  console.log('\n📦 Example 2: Batch Generation')
  console.log('-' .repeat(40))

  // Set up progress monitoring
  let lastProgress = 0
  batchService.onProgress(progress => {
    if (progress.completed !== lastProgress) {
      console.log(`Progress: ${progress.completed}/${progress.total} (${progress.currentPhase})`)
      lastProgress = progress.completed
    }
  })

  // Generate all weapons
  console.log('Generating weapons...')
  const weaponResults = await batchService.generateAllItems(sampleWeapons)
  
  console.log('Weapon Generation Results:')
  weaponResults.forEach(result => {
    const status = result.status === 'completed' ? '✅' : '❌'
    const cacheHit = result.metadata.cacheHit ? '(cached)' : '(new)'
    console.log(`  ${status} ${result.id} ${cacheHit} - ${result.metadata.processingTime}ms`)
    
    if (result.hardpoints) {
      console.log(`    → Hardpoints detected with ${(result.hardpoints.confidence * 100).toFixed(1)}% confidence`)
    }
  })

  // Example 3: Character/Mob Generation
  console.log('\n👹 Example 3: Character Generation')
  console.log('-' .repeat(40))

  const mobResults = await batchService.generateAllMobs(sampleMobs)
  
  console.log('Mob Generation Results:')
  mobResults.forEach(result => {
    const status = result.status === 'completed' ? '✅' : '❌'
    console.log(`  ${status} ${result.id}`)
    
    if (result.augmentedPrompt) {
      console.log(`    → T-pose: ${result.augmentedPrompt.orientationRules.pose?.includes('T-pose') ? 'Yes' : 'No'}`)
      console.log(`    → Facing: ${result.augmentedPrompt.orientationRules.facing}`)
    }
  })

  // Example 4: Comprehensive Report
  console.log('\n📊 Example 4: Comprehensive Report')
  console.log('-' .repeat(40))

  const allResults = [...weaponResults, ...mobResults]
  const mockProgress = {
    total: allResults.length,
    completed: allResults.filter(r => r.status === 'completed').length,
    failed: allResults.filter(r => r.status === 'failed').length,
    pending: 0,
    processing: 0,
    currentPhase: 'completed' as const,
    estimatedTimeRemaining: 0,
    throughputPerHour: 0
  }

  const batchReport = await visualizationService.generateBatchReport(allResults, mockProgress)
  
  console.log('Batch Report Summary:')
  console.log(`  Total Items: ${batchReport.summary.totalItems}`)
  console.log(`  Success Rate: ${(batchReport.summary.successRate * 100).toFixed(1)}%`)
  console.log(`  Cache Hit Rate: ${(batchReport.summary.cacheHitRate * 100).toFixed(1)}%`)
  console.log(`  Processing Time: ${batchReport.summary.processingTime}ms`)

  console.log('\nCategory Breakdown:')
  batchReport.categoryBreakdown.forEach(cat => {
    console.log(`  ${cat.category}: ${cat.count} items, ${(cat.successRate * 100).toFixed(1)}% success`)
  })

  // Example 5: Cache Statistics
  console.log('\n💾 Example 5: Cache Performance')
  console.log('-' .repeat(40))

  const cacheStats = batchService.getCacheStats()
  console.log('Cache Statistics:')
  console.log(`  Entries: ${cacheStats.entries}`)
  console.log(`  Total Size: ${Math.round(cacheStats.totalSize / 1024)}KB`)
  console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`)

  // Example 6: Prompt Comparison
  console.log('\n🎨 Example 6: Prompt Enhancement Comparison')
  console.log('-' .repeat(40))

  const originalPrompt = "A medieval crossbow"
  const enhanced = promptService.augmentWeaponPrompt(originalPrompt, "crossbow")
  
  console.log('Original:', originalPrompt)
  console.log('Enhanced:', enhanced.enhancedPrompt)
  console.log('Key additions:')
  console.log('  → Orientation: horizontal, top-down view')
  console.log('  → Direction: bolt channel pointing left') 
  console.log('  → Materials: wood stock, steel prod, metal trigger')
  console.log('  → Quality: high quality, detailed, game-ready')

  // Example 7: Different Weapon Types
  console.log('\n⚔️  Example 7: Weapon-Specific Orientations')
  console.log('-' .repeat(40))

  const weaponTypes = ['sword', 'bow', 'crossbow', 'shield', 'axe']
  
  for (const weaponType of weaponTypes) {
    const prompt = promptService.augmentWeaponPrompt(`A ${weaponType}`, weaponType)
    console.log(`${weaponType.toUpperCase()}:`)
    console.log(`  → Camera: ${prompt.orientationRules.cameraAngle}`)
    console.log(`  → Position: ${prompt.orientationRules.position}`)
    console.log(`  → Special: ${prompt.hardpointHints?.projectileDirection || 'N/A'}`)
  }

  console.log('\n🎉 Workflow demonstration complete!')
  console.log('\nKey Features Demonstrated:')
  console.log('✅ Intelligent prompt augmentation for different asset types')
  console.log('✅ Weapon-specific orientation requirements (vertical swords, horizontal crossbows)')
  console.log('✅ Projectile direction specification (bows/crossbows fire leftward)')
  console.log('✅ T-pose character generation with orthographic view')
  console.log('✅ Hardpoint detection for grips, attachments, and projectile origins')
  console.log('✅ Batch processing with intelligent caching')
  console.log('✅ Performance optimization through retexturing')
  console.log('✅ Comprehensive visualization and reporting')
  console.log('✅ Error handling and retry logic')
  console.log('✅ Real-time progress monitoring')
}

// Usage examples for specific scenarios

export async function generateSpecificWeaponTypes() {
  const promptService = new PromptAugmentationService()
  
  // Sword: vertical, blade up, edge left
  const sword = promptService.augmentWeaponPrompt("A steel longsword", "sword")
  console.log('Sword orientation:', sword.orientationRules.pose)
  
  // Bow: vertical, string left, projectile leftward
  const bow = promptService.augmentWeaponPrompt("An elven bow", "bow") 
  console.log('Bow projectile direction:', bow.hardpointHints?.projectileDirection)
  
  // Crossbow: horizontal, top-down, bolt channel left
  const crossbow = promptService.augmentWeaponPrompt("A heavy crossbow", "crossbow")
  console.log('Crossbow orientation:', crossbow.orientationRules.cameraAngle)
}

export async function generateCharactersWithTPose() {
  const promptService = new PromptAugmentationService()
  
  // All characters generated in T-pose, facing forward, orthographic view
  const goblin = promptService.augmentCharacterPrompt("A goblin warrior", "monster")
  const human = promptService.augmentCharacterPrompt("A human knight", "npc")
  
  console.log('Goblin pose:', goblin.orientationRules.pose)
  console.log('Human pose:', human.orientationRules.pose)
  console.log('Expected dimensions:', goblin.expectedDimensions)
}

export async function demonstrateHardpointAccuracy() {
  const hardpointService = new HardpointDetectionService()
  const mockGeometry = { vertices: [], triangles: [] }
  
  // Detect hardpoints for different weapon types
  const swordHardpoints = await hardpointService.detectWeaponHardpoints(mockGeometry, 'sword')
  const bowHardpoints = await hardpointService.detectWeaponHardpoints(mockGeometry, 'bow')
  
  // Calculate accuracy metrics
  const swordAccuracy = hardpointService.calculateAccuracyMetrics(swordHardpoints)
  const bowAccuracy = hardpointService.calculateAccuracyMetrics(bowHardpoints)
  
  console.log('Sword accuracy:', swordAccuracy.overallScore)
  console.log('Bow accuracy:', bowAccuracy.overallScore)
  
  // Generate accuracy visualization
  const visualizationService = new VisualizationService()
  const swordViz = await visualizationService.visualizeHardpoints(swordHardpoints, swordAccuracy)
  
  console.log('Generated interactive visualization with accuracy metrics')
}

// Run the demonstration
if (import.meta.main) {
  demonstrateWorkflow().catch(console.error)
}