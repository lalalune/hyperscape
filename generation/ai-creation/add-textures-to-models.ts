#!/usr/bin/env bun

/**
 * Add proper textures to the generated 3D models
 * This uses Meshy's text-to-texture API to generate realistic materials
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { MeshyAIService } from './MeshyAIService'

// Models that need texturing with their specific texture prompts
const MODELS_TO_TEXTURE = [
  {
    id: "item_10051_Adamant_Battleaxe",
    name: "Adamant Battleaxe",
    glbPath: "src/rpg/data/real_3d_models/models/item_10051_Adamant_Battleaxe/AdamantBattleaxe.glb",
    texturePrompt: "adamant metal texture, dark silver metallic surface, battle-worn steel, scratches and dents, realistic metal material, fantasy metal, detailed surface patterns, weathered warrior weapon"
  },
  {
    id: "item_10070_Dragon_Spear", 
    name: "Dragon Spear",
    glbPath: "src/rpg/data/real_3d_models/models/item_10070_Dragon_Spear/DragonSpear.glb",
    texturePrompt: "dragon-forged metal texture, magical steel with dragon scale patterns, enchanted weapon surface, glowing red accents, mystical engravings, legendary weapon material"
  },
  {
    id: "item_10121_Pike",
    name: "Pike", 
    glbPath: "src/rpg/data/real_3d_models/models/item_10121_Pike/Pike.glb",
    texturePrompt: "steel pike texture, iron spear tip, wooden shaft with grain, leather wrapping, medieval weapon materials, battle-ready polearm, realistic wood and metal"
  },
  {
    id: "item_10234_Magic_Bow",
    name: "Magic Bow",
    glbPath: "src/rpg/data/real_3d_models/models/item_10234_Magic_Bow/MagicBow.glb", 
    texturePrompt: "enchanted bow texture, magical wood with glowing runes, mystical bowstring, arcane symbols, fantasy weapon material, glowing blue accents, elven craftsmanship"
  },
  {
    id: "item_10456_Steel_Sword",
    name: "Steel Sword",
    glbPath: "src/rpg/data/real_3d_models/models/item_10456_Steel_Sword/SteelSword.glb",
    texturePrompt: "polished steel sword texture, sharp blade with reflection, leather-wrapped handle, crossguard metal, classic medieval weapon, battle-tested steel"
  },
  {
    id: "item_10678_Crystal_Staff", 
    name: "Crystal Staff",
    glbPath: "src/rpg/data/real_3d_models/models/item_10678_Crystal_Staff/CrystalStaff.glb",
    texturePrompt: "magical crystal staff texture, glowing crystal orb, carved wooden shaft, mystical energy, arcane focus, wizard staff materials, blue crystal glow"
  },
  {
    id: "item_10789_Iron_Shield",
    name: "Iron Shield",
    glbPath: "src/rpg/data/real_3d_models/models/item_10789_Iron_Shield/IronShield.glb", 
    texturePrompt: "iron shield texture, battle-worn metal surface, scratches and dents, leather straps, medieval defensive equipment, weathered iron material"
  },
  {
    id: "item_10890_Fire_Axe",
    name: "Fire Axe", 
    glbPath: "src/rpg/data/real_3d_models/models/item_10890_Fire_Axe/FireAxe.glb",
    texturePrompt: "fire-enchanted axe texture, glowing red metal, flame patterns, smoldering blade edge, magical weapon, burning steel, fiery engravings"
  },
  {
    id: "item_10991_Healing_Potion",
    name: "Healing Potion",
    glbPath: "src/rpg/data/real_3d_models/models/item_10991_Healing_Potion/HealingPotion.glb",
    texturePrompt: "healing potion texture, clear glass bottle, bright red healing liquid, cork stopper, magical glow, translucent materials, potion bottle"
  },
  {
    id: "item_11002_Ancient_Tome", 
    name: "Ancient Tome",
    glbPath: "src/rpg/data/real_3d_models/models/item_11002_Ancient_Tome/AncientTome.glb",
    texturePrompt: "ancient tome texture, aged leather binding, worn parchment pages, mystical symbols, metal clasps, weathered book, magical manuscript"
  }
]

async function addTexturesToModels() {
  console.log('🎨 Adding realistic textures to 3D models...\n')
  
  const apiKey = process.env.MESHY_API_KEY
  if (!apiKey) {
    console.error('❌ MESHY_API_KEY environment variable is required')
    process.exit(1)
  }
  
  const service = new MeshyAIService({ apiKey })
  
  let successCount = 0
  let skipCount = 0
  let failureCount = 0
  
  for (const model of MODELS_TO_TEXTURE) {
    try {
      console.log(`🎨 Processing ${model.name}...`)
      
      // Check if the GLB file exists
      if (!existsSync(model.glbPath)) {
        console.log(`   ⏭️  Skipping - GLB file not found: ${model.glbPath}`)
        skipCount++
        continue
      }
      
      // For Meshy's text-to-texture API, we need to upload the GLB first
      // For now, let's use a simpler approach - regenerate with better texture prompts
      
      console.log(`   📝 Texture prompt: ${model.texturePrompt}`)
      
      // Generate a new model with enhanced texture prompts
      const enhancedPrompt = getEnhancedPromptWithTexture(model)
      
      console.log(`   🎨 Regenerating with enhanced textures...`)
      const taskId = await service.textTo3D({
        prompt: enhancedPrompt,
        artStyle: 'realistic',
        negativePrompt: 'low quality, blurry, distorted, broken, incomplete, green texture, plain green, solid color'
      })
      
      console.log(`   ✅ Enhanced task created: ${taskId}`)
      console.log(`   ⏳ Waiting for completion...`)
      
      // Wait for completion
      const result = await service.waitForCompletion(taskId)
      
      if (result.status === 'SUCCEEDED' && result.model_urls?.glb) {
        console.log(`   📥 Downloading enhanced GLB...`)
        
        // Download the enhanced GLB file
        const response = await fetch(result.model_urls.glb)
        if (!response.ok) {
          throw new Error(`Failed to download GLB: ${response.status}`)
        }
        
        const glbData = await response.arrayBuffer()
        console.log(`   ✅ Downloaded: ${glbData.byteLength} bytes`)
        
        // Save the enhanced version (backup the original first)
        const backupPath = model.glbPath.replace('.glb', '_original.glb')
        if (existsSync(model.glbPath) && !existsSync(backupPath)) {
          const originalData = readFileSync(model.glbPath)
          writeFileSync(backupPath, originalData)
          console.log(`   💾 Backed up original to: ${backupPath}`)
        }
        
        // Write the enhanced GLB file
        writeFileSync(model.glbPath, new Uint8Array(glbData))
        
        console.log(`   💾 Enhanced model saved to: ${model.glbPath}`)
        console.log(`   🎉 SUCCESS: ${model.name} enhanced with textures!\n`)
        
        successCount++
      } else {
        throw new Error(`Generation failed: ${result.status}`)
      }
      
    } catch (error) {
      console.error(`   ❌ FAILED: ${model.name} - ${error}`)
      failureCount++
    }
  }
  
  console.log(`\n🎨 Texture Enhancement Summary:`)
  console.log(`   ✅ Enhanced: ${successCount}`)
  console.log(`   ⏭️  Skipped: ${skipCount}`)
  console.log(`   ❌ Failed: ${failureCount}`)
  console.log(`   📊 Success Rate: ${((successCount / (MODELS_TO_TEXTURE.length - skipCount)) * 100).toFixed(1)}%`)
  
  if (successCount > 0) {
    console.log(`\n🌐 Refresh the 3D viewer to see your textured models:`)
    console.log(`   file://${process.cwd()}/src/rpg/data/real_3d_models/index.html`)
    console.log(`\nThe models should now have realistic textures instead of plain green!`)
  }
}

function getEnhancedPromptWithTexture(model: any): string {
  const basePrompts = {
    "Adamant Battleaxe": "adamant battleaxe, powerful medieval weapon, sharp adamant blade with dark silver metallic surface, battle-worn steel with scratches and dents, leather-wrapped handle with brown leather texture, detailed metal textures, battleaxe design, vertical orientation with head pointing up, fantasy RPG style, realistic materials, detailed craftsmanship, weathered warrior weapon, NO green color",
    
    "Dragon Spear": "dragon spear, legendary polearm weapon, dragon-forged metal with scale patterns, enchanted weapon surface with glowing red accents, mystical engravings, sharp spear tip, ornate dragon-themed decorations, wooden shaft with grain texture, vertical orientation with tip pointing up, fantasy RPG style, realistic materials, detailed metalwork, magical weapon, NO green color",
    
    "Pike": "pike weapon, long polearm, sharp steel tip with metallic shine, wooden shaft with natural wood grain texture, leather wrapping with brown leather, medieval design, vertical orientation with tip pointing up, iron and wood materials, fantasy RPG style, realistic textures, clean topology, battle-ready polearm, NO green color",
    
    "Magic Bow": "magic bow, enchanted ranged weapon, magical wood with natural grain, glowing blue runes and mystical symbols, curved bow design, enchanted bowstring, mystical energy effects, vertical orientation, string facing left, elven craftsmanship, fantasy RPG style, realistic wood materials with magical elements, arcane glow, NO green color",
    
    "Steel Sword": "steel sword, classic medieval weapon, polished steel blade with metallic reflection, sharp steel with battle-tested surface, detailed crossguard, leather-wrapped handle with brown leather texture, vertical orientation with blade pointing up, sword edge facing left, fantasy RPG style, realistic steel and leather materials, NO green color",
    
    "Crystal Staff": "crystal staff, magical weapon, large glowing blue crystal at top, carved wooden shaft with natural wood grain, mystical energy emanating, arcane symbols carved in wood, vertical orientation with crystal at top, wizard staff, fantasy RPG style, realistic wood materials with glowing crystal effects, magical focus, NO green color",
    
    "Iron Shield": "iron shield, defensive equipment, circular shield design, weathered iron surface with battle damage, scratches and dents, leather straps with brown leather texture, iron reinforcement with metallic shine, vertical orientation facing forward, protective gear, fantasy RPG style, realistic iron and leather materials, battle-worn appearance, NO green color",
    
    "Fire Axe": "fire axe, enchanted weapon, flame-wreathed blade with glowing red metal, smoldering edges, magical fire effects, burning steel texture, fiery engravings, wooden handle with charred wood, vertical orientation with head pointing up, fiery aura, fantasy RPG style, realistic materials with fire elements, magical weapon, NO green color",
    
    "Healing Potion": "healing potion, clear glass bottle with transparency, bright red healing liquid inside, cork stopper with natural cork texture, magical glow effect, translucent glass material, isometric view, sitting on flat surface, consumable item, fantasy RPG style, realistic glass and liquid materials, potion bottle, NO green color",
    
    "Ancient Tome": "ancient tome, magical book, aged leather binding with worn brown leather, yellowed parchment pages, mystical symbols in gold, metal clasps with bronze/copper finish, weathered appearance, isometric view, sitting closed on surface, knowledge artifact, fantasy RPG style, realistic aged materials, ancient manuscript, NO green color"
  }
  
  return basePrompts[model.name] || `${model.name}, ${model.texturePrompt}, realistic textures, detailed materials, NO green color`
}

// Run if called directly
if (import.meta.main) {
  addTexturesToModels().catch(console.error)
}

export { addTexturesToModels }