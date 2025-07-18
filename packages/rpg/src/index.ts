/**
 * @hyperscape/rpg
 * 
 * Core RPG game logic for Hyperfy
 * This plugin provides a complete RPG experience with combat, skills, banking, trading, and more.
 */

import { Plugin, World } from './types/hyperfy'
import { RPGPlugin } from './RPGPlugin'
import { RPGPublicAPI } from './api/RPGPublicAPI'

// Re-export all public types
export * from './types'
export * from './api/RPGPublicAPI'
export * from './api/events'
export * from './api/queries'

/**
 * Creates and initializes the RPG plugin
 */
export function createRPGPlugin(config?: RPGPluginConfig): Plugin {
  return new RPGPlugin(config)
}

/**
 * Plugin configuration options
 */
export interface RPGPluginConfig {
  /** Enable debug logging */
  debug?: boolean
  
  /** World generation settings */
  worldGen?: {
    /** Generate default world on init */
    generateDefault?: boolean
    /** Custom spawn areas */
    customSpawns?: SpawnArea[]
  }
  
  /** System configuration */
  systems?: {
    /** Enable/disable specific systems */
    combat?: boolean
    banking?: boolean
    skills?: boolean
  }
  
  /** Visual configuration */
  visuals?: {
    /** Enable shadows */
    enableShadows?: boolean
    /** Maximum view distance */
    maxViewDistance?: number
  }
}

/**
 * Spawn area configuration
 */
export interface SpawnArea {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  radius: number
  type: 'safe' | 'pvp' | 'wilderness'
}

// Default export for convenience
export default createRPGPlugin 