/**
 * Hyperscape RPG App Entry Point
 * This file exports the functions needed for Hyperfy to run the RPG as an app
 */

import { World } from "./types/hyperfy"
import { RPGPlugin } from './RPGPlugin'
import { RPGPluginConfig } from './index'

// Store plugin instance
let rpgPlugin: RPGPlugin | null = null

/**
 * Initialize the RPG when world loads
 */
export async function init(world: World): Promise<void> {
  console.log('[RPG App] Initializing Hyperscape RPG...')
  
  try {
    // Create RPG plugin with configuration
    const config: RPGPluginConfig = {
      debug: true,
      worldGen: {
        generateDefault: true
      }
    }
    
    rpgPlugin = new RPGPlugin(config)
    
    // Initialize the plugin
    await rpgPlugin.init(world)
    
    // Store reference on world for access
    // ;(world as any).rpg = rpgPlugin.getAPI()
    
    console.log('[RPG App] ✅ Hyperscape RPG initialized successfully!')
    
  } catch (error) {
    console.error('[RPG App] ❌ Failed to initialize:', error)
    throw error
  }
}

/**
 * Update function called each frame
 */
export function update(delta: number): void {
  if (rpgPlugin) {
    rpgPlugin.update(delta)
  }
}

/**
 * Cleanup when world unloads
 */
export function destroy(): void {
  console.log('[RPG App] Cleaning up...')
  if (rpgPlugin) {
    rpgPlugin.destroy()
    rpgPlugin = null
  }
}

/**
 * Export metadata for the Hyperfy app
 */
export const metadata = {
  name: 'Hyperscape RPG',
  version: '1.0.0',
  description: 'A modular RPG world for Hyperfy'
} 