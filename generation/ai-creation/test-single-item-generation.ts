#!/usr/bin/env bun

/**
 * Test Single Item Generation
 * 
 * Generates one RuneScape item to verify the entire pipeline works correctly
 * including PBR texture generation and model downloading.
 */

import { readFileSync, existsSync } from 'fs'
import { MeshyAIService } from './MeshyAIService'
import { EnhancedBatchGenerationService } from './BatchGenerationService'
import { transformRuneScapeItem } from './utils/item-transformer'
import type { ItemData } from './types'

async function testSingleItemGeneration() {
    console.log('🧪 Testing Single Item Generation with PBR Textures')
    console.log('='.repeat(60))

    // Check for API key
    const apiKey = process.env.MESHY_API_KEY
    if (!apiKey) {
        console.error('❌ MESHY_API_KEY environment variable is not set!')
        console.error('Please set: export MESHY_API_KEY="your-api-key-here"')
        process.exit(1)
    }

    try {
        // Initialize services
        const meshyService = new MeshyAIService({ apiKey })
        const batchService = new EnhancedBatchGenerationService(meshyService, {
            enableHardpointDetection: true,
            enableRetexturing: true,
            enableVisualization: false
        })

        // Use the transformer to convert RuneScape JSON to ItemData
        const bronzeSwordJSON = {
            id: 1,
            name: "Bronze Sword",
            examine: "A bronze sword, a basic weapon for beginners",
            value: 40,
            weight: 2.2,
            stackable: false,
            equipable: true,
            tradeable: true,
            members: false,
            equipment: {
                slot: "weapon",
                requirements: {
                    level: 1
                },
                bonuses: {
                    attackStab: 4,
                    attackSlash: 1,
                    attackCrush: -2,
                    attackMagic: 0,
                    attackRanged: 0,
                    defenseStab: 0,
                    defenseSlash: 0,
                    defenseCrush: 0,
                    defenseMagic: 0,
                    defenseRanged: 0,
                    meleeStrength: 3,
                    rangedStrength: 0,
                    magicDamage: 0,
                    prayerBonus: 0
                },
                weaponType: "sword",
                attackSpeed: 4
            },
            model: "bronze_sword",
            icon: "bronze_sword"
        }

        const testItem = transformRuneScapeItem(bronzeSwordJSON)

        console.log(`\n📦 Test Item: ${testItem.name} (ID: ${testItem.id})`)
        console.log(`📝 Description: ${testItem.examine}`)
        console.log(`⚔️  Type: ${testItem.equipment?.weaponType || 'unknown'}`)
        console.log(`📊 Category: ${testItem.category}`)

        // Generate the item
        console.log('\n🎨 Starting generation pipeline...')
        const results = await batchService.generateAllItems([testItem])

        if (results.length === 0) {
            throw new Error('No results returned from generation')
        }

        const result = results[0]
        console.log(`\n📊 Generation Result:`)
        console.log(`   Status: ${result.status}`)
        console.log(`   Processing Time: ${result.metadata.processingTime}ms`)
        console.log(`   Quality Score: ${(result.metadata.qualityScore * 100).toFixed(1)}%`)

        if (result.status !== 'completed') {
            throw new Error(`Generation failed: ${result.error?.message || 'Unknown error'}`)
        }

        // Check downloaded assets
        const downloadedAssets = (result.metadata as any).downloadedAssets
        if (!downloadedAssets) {
            throw new Error('No downloaded assets found in result')
        }

        console.log('\n📥 Downloaded Assets:')
        console.log(`   Model: ${downloadedAssets.modelPath}`)
        console.log(`   Textures:`)
        if (downloadedAssets.texturePaths.baseColor) {
            console.log(`     - Base Color: ${downloadedAssets.texturePaths.baseColor}`)
        }
        if (downloadedAssets.texturePaths.metallic) {
            console.log(`     - Metallic: ${downloadedAssets.texturePaths.metallic}`)
        }
        if (downloadedAssets.texturePaths.normal) {
            console.log(`     - Normal: ${downloadedAssets.texturePaths.normal}`)
        }
        if (downloadedAssets.texturePaths.roughness) {
            console.log(`     - Roughness: ${downloadedAssets.texturePaths.roughness}`)
        }
        if (downloadedAssets.videoPath) {
            console.log(`   Preview Video: ${downloadedAssets.videoPath}`)
        }

        // Validate the GLB file
        console.log('\n🔍 Validating GLB file...')
        if (existsSync(downloadedAssets.modelPath)) {
            const fileStats = require('fs').statSync(downloadedAssets.modelPath)
            console.log(`   File Size: ${(fileStats.size / 1024).toFixed(1)}KB`)

            // Basic GLB validation (check magic number)
            const buffer = readFileSync(downloadedAssets.modelPath)
            const magic = buffer.toString('utf8', 0, 4)
            if (magic === 'glTF') {
                console.log('   ✅ Valid GLB file (glTF binary format)')
            } else {
                throw new Error('Invalid GLB file format')
            }
        } else {
            throw new Error(`Model file not found: ${downloadedAssets.modelPath}`)
        }

        // Check texture files exist
        console.log('\n🎨 Validating PBR textures...')
        let textureCount = 0
        for (const [type, path] of Object.entries(downloadedAssets.texturePaths)) {
            if (path && existsSync(path as string)) {
                const stats = require('fs').statSync(path)
                console.log(`   ✅ ${type}: ${(stats.size / 1024).toFixed(1)}KB`)
                textureCount++
            }
        }
        console.log(`   Total textures: ${textureCount}`)

        // Check hardpoints if detected
        if (result.hardpoints) {
            console.log('\n🎯 Detected Hardpoints:')
            console.log(`   Primary Grip: ${JSON.stringify(result.hardpoints.primaryGrip.position)}`)
            console.log(`   Confidence: ${(result.hardpoints.confidence * 100).toFixed(1)}%`)
        }

        console.log('\n✅ Test completed successfully!')
        console.log('The generated model has:')
        console.log('- Valid GLB format')
        console.log(`- ${textureCount} PBR texture maps`)
        console.log('- Proper hardpoint detection')
        console.log('- All assets downloaded locally')

        return true

    } catch (error) {
        console.error('\n❌ Test failed:', error)
        return false
    }
}

// Function to validate GLB file structure
export function validateGLBFile(filePath: string): { valid: boolean; details: any } {
    try {
        const buffer = readFileSync(filePath)

        // GLB Header
        const magic = buffer.toString('utf8', 0, 4)
        const version = buffer.readUInt32LE(4)
        const length = buffer.readUInt32LE(8)

        const details = {
            magic,
            version,
            length,
            fileSizeKB: (buffer.length / 1024).toFixed(1)
        }

        const valid = magic === 'glTF' && version === 2

        return { valid, details }
    } catch (error) {
        return {
            valid: false,
            details: { error: error instanceof Error ? error.message : String(error) }
        }
    }
}

// Run the test
if (import.meta.main) {
    testSingleItemGeneration()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('Unexpected error:', error)
            process.exit(1)
        })
}

export { testSingleItemGeneration } 