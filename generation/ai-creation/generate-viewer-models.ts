#!/usr/bin/env bun

/**
 * Generate the 10 specific models shown in the 3D viewer
 * This replaces the placeholder cube GLB files with real AI-generated models
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { MeshyAIService } from './MeshyAIService'

// The 10 specific items shown in the viewer with their exact prompts
const VIEWER_ITEMS = [
  {
    id: "item_10051_Adamant_Battleaxe",
    name: "Adamant Battleaxe", 
    prompt: "adamant battleaxe, powerful medieval weapon, sharp adamant blade, detailed metal textures, battleaxe design, vertical orientation with head pointing up, heavy weapon head at top, handle at bottom, fantasy RPG style, realistic materials, detailed craftsmanship",
    taskId: "01979eea-b4f6-7edf-bce5-23d1f3a1bdf6"
  },
  {
    id: "item_10070_Dragon_Spear",
    name: "Dragon Spear",
    prompt: "dragon spear, legendary polearm weapon, dragon magic imbued, sharp spear tip, ornate dragon-themed decorations, vertical orientation with tip pointing up, long shaft, fantasy RPG style, realistic materials, detailed metalwork",
    taskId: "01979eea-b5a3-7edf-8a44-a3e2c9f8d4b2"
  },
  {
    id: "item_10121_Pike",
    name: "Pike",
    prompt: "pike weapon, long polearm, sharp metal tip, wooden shaft, medieval design, vertical orientation with tip pointing up, simple but effective design, fantasy RPG style, realistic materials, clean topology",
    taskId: "01979eea-b61f-7edf-9c77-e5f4d2b8a1c9"
  },
  {
    id: "item_10234_Magic_Bow",
    name: "Magic Bow",
    prompt: "magic bow, enchanted ranged weapon, mystical energy, glowing runes, curved bow design, vertical orientation, string facing left, magical aura, fantasy RPG style, realistic materials with magical elements",
    taskId: "01979eea-b6c4-7edf-a8bb-f7d3e4c6b2a8"
  },
  {
    id: "item_10456_Steel_Sword",
    name: "Steel Sword",
    prompt: "steel sword, classic medieval weapon, sharp steel blade, detailed crossguard, leather-wrapped handle, vertical orientation with blade pointing up, sword edge facing left, fantasy RPG style, realistic materials",
    taskId: "01979eea-b758-7edf-b4ee-d9a7f2e5c3b1"
  },
  {
    id: "item_10678_Crystal_Staff",
    name: "Crystal Staff",
    prompt: "crystal staff, magical weapon, large crystal at top, ornate wooden shaft, magical energy emanating, vertical orientation with crystal at top, mystical design, fantasy RPG style, realistic materials with crystal effects",
    taskId: "01979eea-b7f2-7edf-c2aa-b8e6d4f7a5c2"
  },
  {
    id: "item_10789_Iron_Shield",
    name: "Iron Shield", 
    prompt: "iron shield, defensive equipment, circular shield design, iron reinforcement, leather straps visible, vertical orientation facing forward, protective gear, fantasy RPG style, realistic materials, battle-worn appearance",
    taskId: "01979eea-b889-7edf-d1cc-c7f5e3a8b6d4"
  },
  {
    id: "item_10890_Fire_Axe",
    name: "Fire Axe",
    prompt: "fire axe, enchanted weapon, flame-wreathed blade, glowing red metal, magical fire effects, vertical orientation with head pointing up, fiery aura, fantasy RPG style, realistic materials with fire elements",
    taskId: "01979eea-b91e-7edf-e4dd-d6a4f2b9c7e5"
  },
  {
    id: "item_10991_Healing_Potion",
    name: "Healing Potion",
    prompt: "healing potion, glass bottle, red healing liquid, cork stopper, magical glow, isometric view, sitting on flat surface, consumable item, fantasy RPG style, realistic glass and liquid materials",
    taskId: "01979eea-b9b2-7edf-f5ee-e5b3a7c8d6f1"
  },
  {
    id: "item_11002_Ancient_Tome",
    name: "Ancient Tome",
    prompt: "ancient tome, magical book, leather-bound cover, mystical symbols, worn pages, metal clasps, isometric view, sitting closed on surface, knowledge artifact, fantasy RPG style, realistic aged materials",
    taskId: "01979eea-ba46-7edf-a6ff-f4c2b8d7e5a3"
  }
]

async function generateViewerModels() {
  console.log('🎯 Generating 10 specific models for the 3D viewer...\n')
  
  const apiKey = process.env.MESHY_API_KEY
  if (!apiKey) {
    console.error('❌ MESHY_API_KEY environment variable is required')
    process.exit(1)
  }
  
  const service = new MeshyAIService({ apiKey })
  
  let successCount = 0
  let failureCount = 0
  
  for (const item of VIEWER_ITEMS) {
    try {
      console.log(`🎨 Generating ${item.name}...`)
      console.log(`   Prompt: ${item.prompt.substring(0, 80)}...`)
      
      // Generate the model
      const taskId = await service.textTo3D({
        prompt: item.prompt,
        artStyle: 'realistic',
        negativePrompt: 'low quality, blurry, distorted, broken, incomplete'
      })
      
      console.log(`   ✅ Task created: ${taskId}`)
      console.log(`   ⏳ Waiting for completion...`)
      
      // Wait for completion
      const result = await service.waitForCompletion(taskId)
      
      if (result.status === 'SUCCEEDED' && result.model_urls?.glb) {
        console.log(`   📥 Downloading GLB...`)
        
        // Download the GLB file
        const response = await fetch(result.model_urls.glb)
        if (!response.ok) {
          throw new Error(`Failed to download GLB: ${response.status}`)
        }
        
        const glbData = await response.arrayBuffer()
        console.log(`   ✅ Downloaded: ${glbData.byteLength} bytes`)
        
        // Save to the correct location (replacing the placeholder cube)
        const outputDir = join(process.cwd(), 'src/rpg/data/real_3d_models/models', item.id)
        const outputFile = join(outputDir, `${item.name.replace(/\s+/g, '')}.glb`)
        
        // Ensure directory exists
        mkdirSync(outputDir, { recursive: true })
        
        // Write the real GLB file
        writeFileSync(outputFile, new Uint8Array(glbData))
        
        console.log(`   💾 Saved to: ${outputFile}`)
        console.log(`   🎉 SUCCESS: ${item.name} complete!\n`)
        
        successCount++
      } else {
        throw new Error(`Generation failed: ${result.status}`)
      }
      
    } catch (error) {
      console.error(`   ❌ FAILED: ${item.name} - ${error}`)
      failureCount++
    }
  }
  
  console.log(`\n🎯 Generation Summary:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Failed: ${failureCount}`)
  console.log(`   📊 Success Rate: ${((successCount / VIEWER_ITEMS.length) * 100).toFixed(1)}%`)
  
  if (successCount > 0) {
    console.log(`\n🌐 Open the 3D viewer to see your real models:`)
    console.log(`   file://${process.cwd()}/src/rpg/data/real_3d_models/index.html`)
  }
}

// Run if called directly
if (import.meta.main) {
  generateViewerModels().catch(console.error)
}

export { generateViewerModels }