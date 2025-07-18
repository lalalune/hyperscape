#!/usr/bin/env bun

/**
 * Generate ALL RuneScape Items with Meshy AI
 * 
 * This script:
 * 1. Loads all RuneScape item data from JSON files
 * 2. Generates 3D models using Meshy AI with OSRS-specific prompts
 * 3. Applies realistic textures using text-to-texture API
 * 4. Remeshes models to max 2k triangles for optimal performance
 * 
 * Features:
 * - Intelligent caching to skip already generated items
 * - Progress tracking and ETA
 * - Automatic retries on failures
 * - Comprehensive reporting
 * - RuneScape-specific prompt generation
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { MeshyAIService } from './MeshyAIService'
import { RuneScapePromptService } from './RuneScapePromptService'
import { RuneScapeBatchService } from './RuneScapeBatchService'
import { EnhancedBatchGenerationService, BatchGenerationService } from './BatchGenerationService'
import { loadRuneScapeItems } from './utils/item-transformer'

// Configuration
const CONFIG = {
    MESHY_API_KEY: process.env.MESHY_API_KEY || '',
    OUTPUT_DIR: './generation-output/runescape-items',
    CACHE_FILE: './generation-output/runescape-items/generation-cache.json',
    MAX_TRIANGLES: 2000, // Target polygon count for remeshing
    ENABLE_TEXTURING: true,
    ENABLE_REMESHING: true,
    BATCH_SIZE: 3, // Process 3 items concurrently
}

interface ItemResult {
    id: number
    name: string
    success: boolean
    modelUrl?: string
    texturedUrl?: string
    finalUrl?: string
    error?: string
}

// Extended MeshyAIService with remesh capability
class EnhancedMeshyService extends MeshyAIService {
    private apiKey: string

    constructor(config: { apiKey: string }) {
        super(config)
        this.apiKey = config.apiKey
    }

    async remeshModel(modelUrl: string, targetPolyCount: number = 2000): Promise<string> {
        console.log(`🔧 Remeshing model to ${targetPolyCount} triangles...`)

        const response = await fetch(`https://api.meshy.ai/v1/remesh`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model_url: modelUrl,
                target_polycount: targetPolyCount,
                enable_pbr: true,
                preserve_topology: false,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Meshy remesh API error: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        return result.result // Task ID
    }

    async waitForRemeshCompletion(taskId: string, maxWaitTime: number = 300000): Promise<any> {
        const startTime = Date.now()
        const pollInterval = 5000

        while (Date.now() - startTime < maxWaitTime) {
            const response = await fetch(`https://api.meshy.ai/v1/remesh/${taskId}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            })

            const result = await response.json()

            if (result.status === 'SUCCEEDED') {
                return result
            }

            if (result.status === 'FAILED') {
                throw new Error(`Remesh failed: ${result.task_error?.message || 'Unknown error'}`)
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval))
        }

        throw new Error(`Remesh timed out after ${maxWaitTime}ms`)
    }
}

async function generateAllRuneScapeItems() {
    console.log('🎯 RuneScape Item Generation - Complete Pipeline')
    console.log('='.repeat(60))

    // Check for API key first
    if (!CONFIG.MESHY_API_KEY) {
        console.error('\n❌ MESHY_API_KEY environment variable is not set!')
        console.error('\nTo use this script, you need to:')
        console.error('1. Sign up for a Meshy AI account at https://www.meshy.ai')
        console.error('2. Get your API key from the dashboard')
        console.error('3. Set the environment variable:')
        console.error('   export MESHY_API_KEY="your-api-key-here"')
        console.error('\nAlternatively, create a .env file in the project root with:')
        console.error('   MESHY_API_KEY=your-api-key-here\n')

        console.log('\n📝 For now, let\'s do a dry run to show what would be generated...\n')

        // Do a dry run to show what items would be generated
        await dryRun()
        return
    }

    console.log(`📁 Output directory: ${CONFIG.OUTPUT_DIR}`)
    console.log(`🎯 Target triangles: ${CONFIG.MAX_TRIANGLES}`)
    console.log(`🎨 Texturing: ${CONFIG.ENABLE_TEXTURING ? 'Enabled' : 'Disabled'}`)
    console.log(`🔧 Remeshing: ${CONFIG.ENABLE_REMESHING ? 'Enabled' : 'Disabled'}`)
    console.log('')

    // Initialize services
    const meshyService = new EnhancedMeshyService({
        apiKey: CONFIG.MESHY_API_KEY
    })

    const osrsPromptService = new RuneScapePromptService({
        visualStyle: 'osrs',
        polyCount: 'ultra_low', // For 2k triangle target
        colorPalette: 'authentic'
    })

    const batchService = new EnhancedBatchGenerationService(meshyService, {
        maxConcurrentTasks: CONFIG.BATCH_SIZE,
        enableRetexturing: CONFIG.ENABLE_TEXTURING,
        enableHardpointDetection: true,
        enableVisualization: false
    })

    // Ensure output directories exist
    mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true })

    // Load all item data using the transformer
    const itemFiles = [
        '../config/items/basic_items.json',
        '../config/items/food_items.json',
        '../config/items/bones.json'
    ]

    const allItems = await loadRuneScapeItems(itemFiles)
    console.log(`\n📦 Total items to generate: ${allItems.length}`)

    // Generate all items using BatchGenerationService
    console.log('\n🎨 Starting batch generation...')
    const generationResults = await batchService.generateAllItems(allItems)

    // Load existing cache for remeshing
    let cache: Record<string, any> = {}
    if (existsSync(CONFIG.CACHE_FILE)) {
        try {
            cache = JSON.parse(readFileSync(CONFIG.CACHE_FILE, 'utf-8'))
            console.log(`💾 Loaded cache with ${Object.keys(cache).length} entries`)
        } catch (error) {
            console.warn('⚠️  Failed to load cache:', error)
        }
    }

    const results: ItemResult[] = []
    const startTime = Date.now()

    // Check for already generated files
    const existingFiles = new Set<string>()
    if (existsSync(CONFIG.OUTPUT_DIR)) {
        const files = require('fs').readdirSync(CONFIG.OUTPUT_DIR)
        files.forEach((file: string) => {
            if (file.endsWith('.glb')) {
                // Extract ID from filename (e.g., "1_Bronze_Sword.glb" -> "1")
                const match = file.match(/^(\d+)_/)
                if (match) {
                    existingFiles.add(match[1])
                }
            }
        })
    }
    console.log(`📁 Found ${existingFiles.size} existing models`)

    // Process each generated item for remeshing
    for (let i = 0; i < generationResults.length; i++) {
        const result = generationResults[i]
        const item = allItems.find(it => String(it.id) === String(result.id))

        if (!item) continue

        const itemIdStr = String(item.id)

        // Check if model already exists
        if (existingFiles.has(itemIdStr)) {
            console.log(`\n[${i + 1}/${generationResults.length}] Skipping: ${item.name} (ID: ${item.id}) - already exists`)
            results.push({
                id: Number(item.id),
                name: item.name,
                success: true,
                modelUrl: 'existing',
                texturedUrl: 'existing',
                finalUrl: 'existing'
            })
            continue
        }

        console.log(`\n[${i + 1}/${generationResults.length}] Post-processing: ${item.name} (ID: ${item.id})`)

        if (result.status !== 'completed') {
            console.log('   ❌ Generation failed')
            results.push({
                id: Number(item.id),
                name: item.name,
                success: false,
                error: result.error?.message || 'Generation failed'
            })
            continue
        }

        try {
            // Get model URL from meshyResult
            let finalUrl = result.meshyResult?.model_urls?.glb

            // Step 3: Remesh to 2k triangles if needed
            if (CONFIG.ENABLE_REMESHING && finalUrl && !cache[itemIdStr]?.remeshed) {
                console.log(`   🔧 Remeshing to ${CONFIG.MAX_TRIANGLES} triangles...`)

                const remeshTaskId = await meshyService.remeshModel(finalUrl, CONFIG.MAX_TRIANGLES)
                const remeshResult = await meshyService.waitForRemeshCompletion(remeshTaskId)

                if (remeshResult.status === 'SUCCEEDED' && remeshResult.model_urls?.glb) {
                    finalUrl = remeshResult.model_urls.glb
                    cache[itemIdStr] = { ...cache[itemIdStr], remeshed: true, finalUrl }
                }
            } else if (cache[itemIdStr]?.remeshed) {
                finalUrl = cache[itemIdStr].finalUrl
                console.log('   ✅ Already remeshed (cached)')
            }

            // Save the final model
            if (finalUrl) {
                const response = await fetch(finalUrl)
                if (response.ok) {
                    const modelData = await response.arrayBuffer()
                    const outputPath = join(CONFIG.OUTPUT_DIR, `${item.id}_${item.name.replace(/\s+/g, '_')}.glb`)
                    writeFileSync(outputPath, new Uint8Array(modelData))
                    console.log(`   💾 Saved: ${outputPath} (${(modelData.byteLength / 1024).toFixed(1)}KB)`)
                }
            }

            results.push({
                id: Number(item.id),
                name: item.name,
                success: true,
                modelUrl: result.meshyResult?.model_urls?.glb,
                texturedUrl: result.meshyResult?.model_urls?.glb,
                finalUrl
            })

        } catch (error) {
            console.error(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`)
            results.push({
                id: Number(item.id),
                name: item.name,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            })
        }

        // Save cache after each item
        writeFileSync(CONFIG.CACHE_FILE, JSON.stringify(cache, null, 2))
    }

    // Generate final report
    const totalTime = (Date.now() - startTime) / 1000
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    const report = {
        summary: {
            totalItems: results.length,
            successful,
            failed,
            totalTime,
            averageTime: totalTime / results.length
        },
        results
    }

    const reportPath = join(CONFIG.OUTPUT_DIR, 'generation-report.json')
    writeFileSync(reportPath, JSON.stringify(report, null, 2))

    // Generate HTML report
    const htmlReport = generateHTMLReport(report, CONFIG)
    const htmlPath = join(CONFIG.OUTPUT_DIR, 'generation-report.html')
    writeFileSync(htmlPath, htmlReport)

    console.log('\n' + '='.repeat(60))
    console.log('📊 FINAL SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Successful: ${successful}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⏱️  Total time: ${totalTime.toFixed(1)}s`)
    console.log(`📦 Models saved to: ${CONFIG.OUTPUT_DIR}`)
    console.log(`📊 Report saved to: ${reportPath}`)
    console.log(`🌐 HTML report: ${htmlPath}`)

    if (failed > 0) {
        console.log(`\n⚠️  ${failed} items failed. Check the report for details.`)
    }
}

function generateHTMLReport(report: any, config: typeof CONFIG): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>RuneScape Item Generation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .success-rate { width: 100%; background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; margin: 20px 0; }
        .success-fill { height: 100%; background: #4caf50; text-align: center; color: white; line-height: 20px; }
        .error-list { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
        .status-success { color: #28a745; }
        .status-failed { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎮 RuneScape Item Generation Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${report.summary.totalItems}</div>
                <div class="stat-label">Total Items</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.successful}</div>
                <div class="stat-label">Successful</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.averageTime.toFixed(1)}s</div>
                <div class="stat-label">Avg Time/Item</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${(report.summary.totalTime / 60).toFixed(1)}m</div>
                <div class="stat-label">Total Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${((report.summary.successful / report.summary.totalItems) * 100).toFixed(1)}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        </div>

        <div class="success-rate">
            <div class="success-fill" style="width: ${(report.summary.successful / report.summary.totalItems) * 100}%">
                ${((report.summary.successful / report.summary.totalItems) * 100).toFixed(1)}% Success Rate
            </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2>📊 Detailed Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.results.map((result: ItemResult) => `
                        <tr>
                            <td>${result.id}</td>
                            <td>${result.name}</td>
                            <td class="${result.success ? 'status-success' : 'status-failed'}">
                                ${result.success ? '✅ Success' : '❌ Failed'}
                            </td>
                            <td>${result.error || 'Generated successfully'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${report.summary.failed > 0 ? `
            <div class="error-list">
                <h2>⚠️ Failed Items</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.results.filter((r: ItemResult) => !r.success).map((failure: ItemResult) => `
                            <tr>
                                <td>${failure.id}</td>
                                <td>${failure.name}</td>
                                <td>${failure.error}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}

        <div style="text-align: center; margin: 40px 0; color: #666;">
            <p>Generated with Meshy AI Integration for RuneScape RPG</p>
            <p>Models remeshed to ${config.MAX_TRIANGLES} triangles for optimal performance</p>
        </div>
    </div>
</body>
</html>`
}

// Dry run function to show what would be generated
async function dryRun() {
    // Load all item data using the transformer
    const itemFiles = [
        '../config/items/basic_items.json',
        '../config/items/food_items.json',
        '../config/items/bones.json'
    ]

    const allItems = await loadRuneScapeItems(itemFiles)

    console.log(`\n📦 Total items found: ${allItems.length}`)
    console.log('\n📋 Items that would be generated:')
    console.log('='.repeat(60))

    // Group items by category
    const weapons = allItems.filter(item => item.category === 'weapon')
    const armor = allItems.filter(item => item.category === 'armor')
    const consumables = allItems.filter(item => item.category === 'consumable')
    const resources = allItems.filter(item => item.category === 'resource')
    const misc = allItems.filter(item => item.category === 'misc')

    console.log(`\n⚔️  Weapons (${weapons.length}):`)
    weapons.forEach(item => {
        console.log(`   - ${item.name} (ID: ${item.id}) - ${item.equipment?.weaponType || 'unknown'}`)
    })

    console.log(`\n🛡️  Armor (${armor.length}):`)
    armor.forEach(item => {
        console.log(`   - ${item.name} (ID: ${item.id}) - ${item.equipment?.slot || 'unknown'}`)
    })

    console.log(`\n🍞 Consumables (${consumables.length}):`)
    consumables.forEach(item => {
        console.log(`   - ${item.name} (ID: ${item.id})`)
    })

    console.log(`\n📦 Resources (${resources.length}):`)
    resources.forEach(item => {
        console.log(`   - ${item.name} (ID: ${item.id})`)
    })

    console.log(`\n🎯 Misc Items (${misc.length}):`)
    misc.forEach(item => {
        console.log(`   - ${item.name} (ID: ${item.id})`)
    })

    console.log('\n' + '='.repeat(60))
    console.log('💡 Each item would be:')
    console.log('   1. Generated as a 3D model using RuneScape-specific prompts')
    console.log('   2. Textured with appropriate materials (bronze, iron, leather, etc.)')
    console.log('   3. Remeshed to 2000 triangles for optimal performance')
    console.log('   4. Saved as a .glb file ready for use in Hyperfy')
    console.log('\n💰 Estimated Meshy AI credits needed: ~' + (allItems.length * 3) + ' (3 per item for generation + texture + remesh)')
}

// Run if called directly
if (import.meta.main) {
    generateAllRuneScapeItems().catch(console.error)
}

export { generateAllRuneScapeItems } 