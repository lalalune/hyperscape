/**
 * Hyperscape RPG App
 * Main entry point for Hyperfy world
 */

import { createRPGPlugin } from '@hyperscape/rpg-core'

// Initialize when world loads
export async function init(world) {
  console.log('[RPG App] Initializing Hyperscape RPG...')
  
  try {
    // Create RPG plugin with configuration
    const rpgPlugin = createRPGPlugin({
      debug: true,
      worldGen: {
        generateDefault: true
      }
    })
    
    // Initialize the plugin
    await rpgPlugin.init(world)
    
    // Store reference on world for access
    world.rpg = rpgPlugin
    
    console.log('[RPG App] ✅ Hyperscape RPG initialized successfully!')
    
    // Return the plugin instance
    return rpgPlugin
    
  } catch (error) {
    console.error('[RPG App] ❌ Failed to initialize:', error)
    throw error
  }
}

// Update function called each frame
export function update(delta) {
  // Update logic if needed
}

// Cleanup when world unloads
export function destroy() {
  console.log('[RPG App] Cleaning up...')
}

// Export metadata
export const metadata = {
  name: 'Hyperscape RPG',
  version: '1.0.0',
  description: 'A modular RPG world for Hyperfy'
} 