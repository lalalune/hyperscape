#!/usr/bin/env node

import { spawn } from 'child_process'
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🎯 SPAWNING RPG ENTITIES IN WORLD')
console.log('======================================================================')

let serverProcess = null
let browser = null
let page = null

const screenshots = path.join(__dirname, '../../../screenshots')
await fs.mkdir(screenshots, { recursive: true })

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

try {
  // Start Hyperfy server
  console.log('🚀 Starting server for RPG spawning...')
  
  const hyperfyPath = '/Users/shawwalters/hyperscape/packages/hyperfy'
  
  serverProcess = spawn('npm', ['start'], {
    cwd: hyperfyPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  })
  
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString()
    if (output.includes('[Server]') || output.includes('running on port') || output.includes('Error') || output.includes('🎮')) {
      console.log(`[Server] ${output.trim()}`)
    }
  })
  
  serverProcess.stderr.on('data', (data) => {
    console.log(`[Server Error] ${data.toString().trim()}`)
  })
  
  // Wait for server startup
  await delay(8000)
  console.log('✅ RPG Server ready')
  
  // Launch browser
  console.log('🌐 Spawning RPG in browser...')
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  
  // Navigate to world
  console.log('🏠 Loading RPG world...')
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
  
  // Wait for world to load
  await delay(3000)
  
  // Try to spawn RPG entities manually via browser console
  console.log('🧙 Manually spawning RPG entities via browser...')
  
  const spawnResult = await page.evaluate(async () => {
    try {
      // Try to access the world and spawn entities
      if (window.world && window.world.apps) {
        console.log('World and apps available, attempting spawn...')
        
        // Try to get available blueprints
        const collections = window.world.collections || {}
        console.log('Available collections:', Object.keys(collections))
        
        // Try to spawn RPG Player
        if (collections.default) {
          const blueprints = collections.default.blueprints || {}
          console.log('Available blueprints:', Object.keys(blueprints))
          
          // Try to manually spawn RPGPlayer
          const rpgPlayerBlueprint = blueprints['default/RPGPlayer.hyp']
          if (rpgPlayerBlueprint) {
            console.log('Found RPGPlayer blueprint, spawning...')
            
            // Create app instance
            const rpgPlayerApp = await window.world.spawn({
              blueprint: 'default/RPGPlayer.hyp',
              position: [-3, 0, 0],
              properties: {
                playerName: 'TestHero',
                startingLevel: 1,
                health: 100,
                visualColor: 'blue'
              }
            })
            
            console.log('RPG Player spawned:', rpgPlayerApp.id)
            
            // Try to spawn RPG Goblin
            const rpgGoblinBlueprint = blueprints['default/RPGGoblin.hyp']
            if (rpgGoblinBlueprint) {
              console.log('Found RPGGoblin blueprint, spawning...')
              
              const rpgGoblinApp = await window.world.spawn({
                blueprint: 'default/RPGGoblin.hyp',
                position: [3, 0, 0],
                properties: {
                  goblinName: 'TestGoblin',
                  level: 2,
                  maxHealth: 25,
                  aggressive: true
                }
              })
              
              console.log('RPG Goblin spawned:', rpgGoblinApp.id)
              return { success: true, spawned: ['RPGPlayer', 'RPGGoblin'] }
            }
            
            return { success: true, spawned: ['RPGPlayer'] }
          }
        }
        
        return { success: false, error: 'No RPG blueprints found' }
      }
      
      return { success: false, error: 'World/apps not available' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
  
  console.log('🧪 Spawn result:', spawnResult)
  
  // Wait for entities to initialize
  await delay(2000)
  
  // Take screenshot to verify
  const screenshotPath = path.join(screenshots, `rpg-spawn-test-${Date.now()}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  
  // Analyze what's in the world
  const worldAnalysis = await page.evaluate(() => {
    try {
      const entities = []
      
      // Check for any RPG-related objects in the scene
      if (window.world && window.world.scene) {
        const scene = window.world.scene
        
        scene.traverse((obj) => {
          if (obj.userData && obj.userData.rpg) {
            entities.push({
              type: 'RPG_ENTITY',
              name: obj.userData.name || 'Unknown',
              position: obj.position
            })
          }
          
          // Look for blue or green meshes (our RPG entities)
          if (obj.material && obj.material.color) {
            const color = obj.material.color
            if ((color.r < 0.1 && color.g < 0.1 && color.b > 0.8) || // Blue
                (color.r < 0.1 && color.g > 0.8 && color.b < 0.1)) { // Green
              entities.push({
                type: 'COLORED_MESH',
                color: color.r > 0.5 ? 'red' : color.g > 0.5 ? 'green' : 'blue',
                position: obj.position
              })
            }
          }
        })
      }
      
      return { entities, worldExists: !!window.world }
    } catch (error) {
      return { error: error.message }
    }
  })
  
  console.log('\n📊 SPAWN TEST RESULTS:')
  console.log('==================================================')
  console.log('Screenshot:', screenshotPath)
  console.log('Spawn Result:', spawnResult)
  console.log('World Analysis:', worldAnalysis)
  
  if (spawnResult.success && worldAnalysis.entities && worldAnalysis.entities.length > 0) {
    console.log('✅ SUCCESS: RPG entities spawned and detected!')
  } else {
    console.log('❌ FAILURE: Could not spawn or detect RPG entities')
  }

} catch (error) {
  console.error('💥 Spawn test failed:', error)
} finally {
  // Cleanup
  console.log('🔄 Closing browser...')
  if (browser) await browser.close()
  
  console.log('🛑 Stopping RPG server...')
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    await delay(2000)
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL')
    }
  }
  
  process.exit(0)
}