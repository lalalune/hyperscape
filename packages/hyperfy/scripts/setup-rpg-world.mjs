#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const WORLD_DIR = join(__dirname, '../world')
const RPG_EXAMPLE_PATH = join(WORLD_DIR, 'rpg-example-world.json')
const WORLD_CONFIG_PATH = join(WORLD_DIR, 'world.json')

async function setupRPGWorld() {
  console.log('🎮 Setting up RPG Example World...')
  
  try {
    // Check if RPG example world exists
    if (!existsSync(RPG_EXAMPLE_PATH)) {
      console.error('❌ RPG example world configuration not found at:', RPG_EXAMPLE_PATH)
      process.exit(1)
    }
    
    // Read the RPG example configuration
    const rpgConfig = JSON.parse(readFileSync(RPG_EXAMPLE_PATH, 'utf-8'))
    console.log(`✅ Loaded RPG configuration: ${rpgConfig.name}`)
    
    // Backup existing world.json if it exists
    if (existsSync(WORLD_CONFIG_PATH)) {
      const backupPath = join(WORLD_DIR, `world.json.backup.${Date.now()}`)
      const existingConfig = readFileSync(WORLD_CONFIG_PATH, 'utf-8')
      writeFileSync(backupPath, existingConfig)
      console.log(`📋 Backed up existing world.json to: ${backupPath}`)
    }
    
    // Create simplified world.json from RPG configuration
    const worldConfig = {
      name: rpgConfig.name,
      description: rpgConfig.description,
      spawn: rpgConfig.spawn,
      settings: rpgConfig.settings,
      entities: rpgConfig.entities.filter(entity => 
        entity.type === 'spawn_point' || 
        entity.type === 'terrain' || 
        entity.type === 'zone_marker'
      )
    }
    
    // Write the new world configuration
    writeFileSync(WORLD_CONFIG_PATH, JSON.stringify(worldConfig, null, 2))
    console.log(`✅ Created world.json with ${worldConfig.entities.length} entities`)
    
    console.log('\\n🌍 RPG World Setup Complete!')
    console.log('\\nWorld Features:')
    console.log('  • 5 Starter Towns with Banks and Stores')
    console.log('  • Multiple Difficulty Zones (Level 1-15)')
    console.log('  • 88 Mob Spawn Points across 10 areas')
    console.log('  • 50 Trees and 6 Fishing Spots')
    console.log('  • Comprehensive Skills System (9 skills)')
    console.log('  • Banking and Store Economy')
    console.log('  • Real-time Combat System')
    console.log('\\nStarting Towns:')
    console.log('  • Brookhaven (Central) - [0, 2, 0]')
    console.log('  • Eastport (Eastern) - [100, 2, 0]') 
    console.log('  • Westfall (Western) - [-100, 2, 0]')
    console.log('  • Northridge (Northern) - [0, 2, 100]')
    console.log('  • Southmere (Southern) - [0, 2, -100]')
    console.log('\\nMob Areas by Difficulty:')
    console.log('  • Level 1: Goblins, Bandits, Barbarians (4 areas)')
    console.log('  • Level 2: Hobgoblins, Guards, Dark Warriors (3 areas)')
    console.log('  • Level 3: Black Knights, Ice Warriors, Dark Rangers (3 areas)')
    console.log('\\nTo start the server:')
    console.log('  bun run dev')
    console.log('\\nTo run integration tests:')
    console.log('  bun run test:rpg:integration')
    console.log('\\nTo reset world (WARNING - deletes player data):')
    console.log('  rm world/db.sqlite && bun run dev')
    
  } catch (error) {
    console.error('❌ Failed to setup RPG world:', error.message)
    process.exit(1)
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupRPGWorld()
}

export { setupRPGWorld }