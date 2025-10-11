#!/usr/bin/env node

/**
 * Integration Validation Script
 * Tests that all generated assets are properly integrated and will load correctly
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const HYPERSCAPE_DIR = path.join(__dirname, '../../hyperscape')
const MANIFESTS_DIR = path.join(HYPERSCAPE_DIR, 'world/assets/manifests')
const FORGE_DIR = path.join(HYPERSCAPE_DIR, 'world/assets/forge')

async function validateManifests() {
  console.log('🔍 Validating Asset Integration...\n')
  
  const results = {
    items: { total: 0, valid: 0, issues: [] },
    mobs: { total: 0, valid: 0, issues: [] },
    npcs: { total: 0, valid: 0, issues: [] },
    resources: { total: 0, valid: 0, issues: [] },
    buildings: { total: 0, valid: 0, issues: [] },
    avatars: { total: 0, valid: 0, issues: [] }
  }
  
  // Validate Items
  await validateManifest('items', results.items, async (item) => {
    const issues = []
    
    // Check ID format (should use underscores)
    if (item.id.includes('-')) {
      issues.push(`ID uses hyphens instead of underscores: ${item.id}`)
    }
    
    // Check required fields
    if (!item.name || item.name === item.id) {
      issues.push(`Missing or generic name: ${item.name}`)
    }
    if (!item.type) issues.push('Missing type')
    if (!item.modelPath) issues.push('Missing modelPath')
    
    // Validate model path format
    if (item.modelPath && !item.modelPath.startsWith('/world-assets/')) {
      issues.push(`Invalid modelPath format: ${item.modelPath}`)
    }
    
    // Check if model file exists
    if (item.modelPath) {
      const modelFile = item.modelPath.replace('/world-assets/', '')
      const fullPath = path.join(HYPERSCAPE_DIR, 'world/assets', modelFile)
      try {
        await fs.access(fullPath)
      } catch (error) {
        issues.push(`Model file not found: ${fullPath}`)
      }
    }
    
    // Validate weapon type enum
    if (item.weaponType && !['NONE', 'SWORD', 'BOW', 'AXE', 'MACE', 'SPEAR', 'STAFF', 'DAGGER', 'SHIELD'].includes(item.weaponType)) {
      issues.push(`Invalid weaponType: ${item.weaponType}`)
    }
    
    return issues
  })
  
  // Validate Mobs
  await validateManifest('mobs', results.mobs, async (mob) => {
    const issues = []
    
    if (mob.id.includes('-')) issues.push(`ID uses hyphens: ${mob.id}`)
    if (!mob.name || mob.name === mob.id) issues.push(`Generic name: ${mob.name}`)
    if (!mob.modelPath) issues.push('Missing modelPath')
    if (!mob.stats) issues.push('Missing stats')
    if (!mob.behavior) issues.push('Missing behavior')
    
    // Check model file
    if (mob.modelPath) {
      const modelFile = mob.modelPath.replace('/world-assets/', '')
      const fullPath = path.join(HYPERSCAPE_DIR, 'world/assets', modelFile)
      try {
        await fs.access(fullPath)
      } catch (error) {
        issues.push(`Model file not found: ${fullPath}`)
      }
    }
    
    // Check animations
    if (mob.animationSet) {
      for (const [animName, animPath] of Object.entries(mob.animationSet)) {
        if (animPath && animPath.startsWith('/world-assets/')) {
          const fullPath = path.join(HYPERSCAPE_DIR, 'world/assets', animPath.replace('/world-assets/', ''))
          try {
            await fs.access(fullPath)
          } catch (error) {
            issues.push(`Animation ${animName} not found: ${fullPath}`)
          }
        }
      }
    }
    
    return issues
  })
  
  // Validate NPCs
  await validateManifest('npcs', results.npcs, async (npc) => {
    const issues = []
    
    if (npc.id.includes('-')) issues.push(`ID uses hyphens: ${npc.id}`)
    if (!npc.name || npc.name === npc.id) issues.push(`Generic name: ${npc.name}`)
    if (!npc.modelPath) issues.push('Missing modelPath')
    if (!npc.type) issues.push('Missing type')
    if (!npc.services || npc.services.length === 0) issues.push('Missing services')
    
    return issues
  })
  
  // Validate Resources
  await validateManifest('resources', results.resources, async (resource) => {
    const issues = []
    
    if (resource.id.includes('-')) issues.push(`ID uses hyphens: ${resource.id}`)
    if (!resource.name || resource.name === resource.id) issues.push(`Generic name: ${resource.name}`)
    if (!resource.modelPath) issues.push('Missing modelPath')
    if (!resource.harvestSkill) issues.push('Missing harvestSkill')
    if (!resource.yields || resource.yields.length === 0) issues.push('Missing yields')
    
    return issues
  })
  
  // Validate Buildings
  await validateManifest('buildings', results.buildings, async (building) => {
    const issues = []
    
    if (building.id.includes('-')) issues.push(`ID uses hyphens: ${building.id}`)
    if (!building.name || building.name === building.id) issues.push(`Generic name: ${building.name}`)
    if (!building.modelPath) issues.push('Missing modelPath')
    
    return issues
  })
  
  // Validate Avatars
  await validateManifest('avatars', results.avatars, async (avatar) => {
    const issues = []
    
    if (avatar.id.includes('-')) issues.push(`ID uses hyphens: ${avatar.id}`)
    if (!avatar.name || avatar.name === avatar.id) issues.push(`Generic name: ${avatar.name}`)
    if (!avatar.modelPath) issues.push('Missing modelPath')
    if (!avatar.isRigged) issues.push('Not rigged (avatars should be rigged)')
    if (!avatar.animations) issues.push('Missing animations')
    
    // Check model file
    if (avatar.modelPath) {
      const modelFile = avatar.modelPath.replace('/world-assets/', '')
      const fullPath = path.join(HYPERSCAPE_DIR, 'world/assets', modelFile)
      try {
        await fs.access(fullPath)
      } catch (error) {
        issues.push(`Model file not found: ${fullPath}`)
      }
    }
    
    return issues
  })
  
  // Print results
  console.log('=' .repeat(60))
  console.log('INTEGRATION VALIDATION RESULTS')
  console.log('='.repeat(60))
  
  let totalValid = 0
  let totalIssues = 0
  
  for (const [category, result] of Object.entries(results)) {
    if (result.total === 0) continue
    
    const status = result.valid === result.total ? '✅' : result.valid > 0 ? '⚠️' : '❌'
    console.log(`\n${status} ${category.toUpperCase()}: ${result.valid}/${result.total} valid`)
    
    totalValid += result.valid
    totalIssues += result.issues.length
    
    if (result.issues.length > 0) {
      console.log(`   Issues found:`)
      for (const issue of result.issues.slice(0, 5)) {
        console.log(`   - ${issue}`)
      }
      if (result.issues.length > 5) {
        console.log(`   ... and ${result.issues.length - 5} more issues`)
      }
    }
  }
  
  console.log('\n' + '='.repeat(60))
  const totalAssets = Object.values(results).reduce((sum, r) => sum + r.total, 0)
  console.log(`SUMMARY: ${totalValid}/${totalAssets} assets valid`)
  console.log(`Total issues: ${totalIssues}`)
  
  if (totalIssues === 0) {
    console.log('\n✅ All assets are properly integrated!')
  } else {
    console.log('\n⚠️  Some assets have issues - review above')
  }
  console.log('='.repeat(60) + '\n')
  
  return { totalAssets, totalValid, totalIssues }
}

async function validateManifest(name, result, validator) {
  const manifestPath = path.join(MANIFESTS_DIR, `${name}.json`)
  
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8')
    const entries = JSON.parse(raw)
    
    result.total = entries.length
    
    for (const entry of entries) {
      const issues = await validator(entry)
      
      if (issues.length === 0) {
        result.valid++
      } else {
        result.issues.push(`${entry.id}: ${issues.join(', ')}`)
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not load ${name}.json:`, error.message)
  }
}

async function main() {
  const validation = await validateManifests()
  
  if (validation.totalIssues > 0) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Validation failed:', error)
  process.exit(1)
})

