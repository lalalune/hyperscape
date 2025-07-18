#!/usr/bin/env bun

/**
 * Enhanced Model Processing: Textures + Remeshing
 * 
 * 1. Regenerates models with enhanced texture prompts (no green)
 * 2. Remeshes models to target 5k polygons for optimal performance
 * 3. Uses Meshy's remesh API for topology optimization
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { MeshyAIService } from './MeshyAIService'

// Extended MeshyAIService with remesh capability
class EnhancedMeshyService extends MeshyAIService {
  /**
   * Remesh a 3D model to target polygon count
   * https://docs.meshy.ai/en/api/remesh
   */
  async remeshModel(modelUrl: string, targetPolyCount: number = 5000): Promise<string> {
    console.log(`🔧 Remeshing model to ${targetPolyCount} polygons: ${modelUrl}`)

    try {
      const response = await fetch(`${this.baseUrl}/v1/remesh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_url: modelUrl,
          target_polycount: targetPolyCount,
          enable_pbr: true, // Keep PBR materials
          preserve_topology: false, // Allow topology changes for optimization
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Meshy remesh API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      console.log(`✅ Remesh task created: ${result.result}`)

      return result.result // Task ID
    } catch (error) {
      console.error('❌ Remesh failed:', error)
      throw new Error(`Failed to remesh model: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get remesh task status
   */
  async getRemeshTaskStatus(taskId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/remesh/${taskId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Meshy API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('❌ Failed to get remesh task status:', error)
      throw new Error(`Failed to get remesh task status: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Wait for remesh task completion
   */
  async waitForRemeshCompletion(taskId: string, maxWaitTime: number = 300000): Promise<any> {
    console.log(`⏳ Waiting for remesh completion: ${taskId}`)

    const startTime = Date.now()
    const pollInterval = 5000 // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getRemeshTaskStatus(taskId)

      if (status.status === 'SUCCEEDED') {
        console.log(`✅ Remesh completed successfully: ${taskId}`)
        return status
      }

      if (status.status === 'FAILED') {
        throw new Error(`Remesh failed: ${status.task_error?.message || 'Unknown error'}`)
      }

      console.log(`⏳ Remesh ${taskId} status: ${status.status}, waiting...`)
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Remesh ${taskId} timed out after ${maxWaitTime}ms`)
  }
}

// Models to process with enhanced texture prompts
const MODELS_TO_ENHANCE = [
  {
    id: "item_10051_Adamant_Battleaxe",
    name: "Adamant Battleaxe",
    glbPath: "src/rpg/data/real_3d_models/models/item_10051_Adamant_Battleaxe/AdamantBattleaxe.glb",
    prompt: "adamant battleaxe, powerful medieval weapon, sharp adamant blade with dark silver metallic surface, battle-worn steel with scratches and dents, leather-wrapped handle with brown leather texture, detailed metal textures, battleaxe design, vertical orientation with head pointing up, fantasy RPG style, realistic materials, detailed craftsmanship, weathered warrior weapon, NO green color, high quality textures"
  },
  {
    id: "item_10070_Dragon_Spear", 
    name: "Dragon Spear",
    glbPath: "src/rpg/data/real_3d_models/models/item_10070_Dragon_Spear/DragonSpear.glb",
    prompt: "dragon spear, legendary polearm weapon, dragon-forged metal with scale patterns, enchanted weapon surface with glowing red accents, mystical engravings, sharp spear tip, ornate dragon-themed decorations, wooden shaft with grain texture, vertical orientation with tip pointing up, fantasy RPG style, realistic materials, detailed metalwork, magical weapon, NO green color, high quality textures"
  },
  {
    id: "item_10121_Pike",
    name: "Pike", 
    glbPath: "src/rpg/data/real_3d_models/models/item_10121_Pike/Pike.glb",
    prompt: "pike weapon, long polearm, sharp steel tip with metallic shine, wooden shaft with natural wood grain texture, leather wrapping with brown leather, medieval design, vertical orientation with tip pointing up, iron and wood materials, fantasy RPG style, realistic textures, clean topology, battle-ready polearm, NO green color, high quality textures"
  }
]

async function enhanceAndRemeshModels() {
  console.log('🚀 Enhanced Model Processing: Textures + 5k Polygon Remeshing...\n')
  
  const apiKey = process.env.MESHY_API_KEY
  if (!apiKey) {
    console.error('❌ MESHY_API_KEY environment variable is required')
    process.exit(1)
  }
  
  const service = new EnhancedMeshyService({ apiKey })
  
  let successCount = 0
  let failureCount = 0
  
  for (const model of MODELS_TO_ENHANCE) {
    try {
      console.log(`🎯 Processing ${model.name}...`)
      
      // Step 1: Generate enhanced model with better textures
      console.log(`   🎨 Step 1: Generating with enhanced textures...`)
      const textureTaskId = await service.textTo3D({
        prompt: model.prompt,
        artStyle: 'realistic',
        negativePrompt: 'low quality, blurry, distorted, broken, incomplete, green texture, plain green, solid color, flat shading'
      })
      
      console.log(`   ✅ Texture generation started: ${textureTaskId}`)
      const textureResult = await service.waitForCompletion(textureTaskId)
      
      if (textureResult.status !== 'SUCCEEDED' || !textureResult.model_urls?.glb) {
        throw new Error(`Texture generation failed: ${textureResult.status}`)
      }
      
      console.log(`   ✅ Enhanced texture model generated`)
      
      // Step 2: Remesh to 5k polygons for optimal performance
      console.log(`   🔧 Step 2: Remeshing to 5k polygons...`)
      const remeshTaskId = await service.remeshModel(textureResult.model_urls.glb, 5000)
      
      console.log(`   ✅ Remesh started: ${remeshTaskId}`)
      const remeshResult = await service.waitForRemeshCompletion(remeshTaskId)
      
      if (remeshResult.status !== 'SUCCEEDED' || !remeshResult.model_urls?.glb) {
        throw new Error(`Remesh failed: ${remeshResult.status}`)
      }
      
      console.log(`   ✅ Remesh completed - optimized to 5k polygons`)
      
      // Step 3: Download and save the final optimized model
      console.log(`   📥 Step 3: Downloading final optimized model...`)
      const response = await fetch(remeshResult.model_urls.glb)
      if (!response.ok) {
        throw new Error(`Failed to download final GLB: ${response.status}`)
      }
      
      const finalGlbData = await response.arrayBuffer()
      console.log(`   ✅ Downloaded final model: ${finalGlbData.byteLength} bytes`)
      
      // Backup original if it exists
      if (existsSync(model.glbPath)) {
        const backupPath = model.glbPath.replace('.glb', '_original.glb')
        if (!existsSync(backupPath)) {
          const originalData = readFileSync(model.glbPath)
          writeFileSync(backupPath, originalData)
          console.log(`   💾 Backed up original to: ${backupPath}`)
        }
      }
      
      // Ensure directory exists
      mkdirSync(dirname(model.glbPath), { recursive: true })
      
      // Save the final optimized model
      writeFileSync(model.glbPath, new Uint8Array(finalGlbData))
      
      // Also save a remeshed version
      const remeshedPath = model.glbPath.replace('.glb', '_5k.glb')
      writeFileSync(remeshedPath, new Uint8Array(finalGlbData))
      
      console.log(`   💾 Enhanced model saved to: ${model.glbPath}`)
      console.log(`   💾 5k polygon version saved to: ${remeshedPath}`)
      console.log(`   🎉 SUCCESS: ${model.name} - Textured + Remeshed to 5k polygons!\n`)
      
      successCount++
      
    } catch (error) {
      console.error(`   ❌ FAILED: ${model.name} - ${error}\n`)
      failureCount++
    }
  }
  
  console.log(`🎯 Processing Summary:`)
  console.log(`   ✅ Enhanced + Remeshed: ${successCount}`)
  console.log(`   ❌ Failed: ${failureCount}`)
  console.log(`   📊 Success Rate: ${((successCount / MODELS_TO_ENHANCE.length) * 100).toFixed(1)}%`)
  
  if (successCount > 0) {
    console.log(`\n🎮 Your models now have:`)
    console.log(`   🎨 Realistic textures (no more green!)`)
    console.log(`   🔧 Optimized 5k polygon topology`)
    console.log(`   📈 Better performance in the viewer`)
    console.log(`\n🌐 Refresh the 3D viewer to see the improvements:`)
    console.log(`   file://${process.cwd()}/src/rpg/data/real_3d_models/index.html`)
  }
}

// Run if called directly
if (import.meta.main) {
  enhanceAndRemeshModels().catch(console.error)
}

export { enhanceAndRemeshModels }