/**
 * Global type definitions for rpg-core
 */

// THREE.js types (provided by runtime)
declare const THREE: any

// Define Vector2 as alias for Vector3 for compatibility
import { Vector3 } from './index'
export type Vector2 = { x: number; y: number }

// Process type for Node compatibility
declare const process: {
  memoryUsage(): {
    heapUsed: number
  }
}

// Global declarations
declare global {
  interface Window {
    rpg?: any
  }
} 