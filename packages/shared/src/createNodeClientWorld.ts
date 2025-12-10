/**
 * createNodeClientWorld.ts - Headless Node.js Client World Factory
 * 
 * Creates a minimal headless client World that runs in Node.js (not a browser).
 * This is useful for:
 * - Automated testing (connecting bots to test multiplayer)
 * - Load testing (spinning up many headless clients)
 * - AI agents (ElizaOS agents connecting to Hyperscape worlds)
 * - Server-side rendering or analysis
 * - Development tools that need to connect as clients
 * 
 * Architecture:
 * - Runs in Node.js environment (no DOM, no WebGL)
 * - Can connect to game servers via WebSocket
 * - Receives and processes game state
 * - No rendering or audio (headless)
 * - No user input (controlled programmatically)
 * 
 * Systems Registered:
 * - NodeClient: Headless client lifecycle (no rendering)
 * - ClientNetwork: WebSocket connection to server
 * - Environment: Basic environment info (no rendering)
 * 
 * Systems NOT Registered (compared to browser client):
 * - ClientGraphics: No renderer (headless)
 * - ClientAudio: No audio system
 * - ClientInput: No user input
 * - ClientLoader: Uses server-side asset loading instead
 * - UI/Interface: No DOM or React
 * - ClientActions: No user-triggered actions
 * 
 * Usage:
 * ```typescript
 * const world = createNodeClientWorld();
 * await world.init({ 
 *   assetsDir: './assets',
 *   storage: nodeStorage 
 * });
 * world.network.connect('ws://localhost:5009');
 * // Headless client is now connected to server
 * ```
 * 
 * Used by: Plugin-Hyperscape (ElizaOS agents), testing tools, load testing
 * References: World.ts, NodeClient.ts, ClientNetwork.ts
 */

import { World } from './World'

import { NodeClient } from './systems/NodeClient'
import { ClientNetwork } from './systems/ClientNetwork'
import { Environment } from './systems/Environment'

/**
 * Creates a headless Node.js client world.
 * 
 * This world can connect to game servers as a client but has no
 * rendering, audio, or user input. It's controlled programmatically
 * for testing, bots, or AI agents.
 * 
 * @returns A headless World instance configured for Node.js client operation
 */
export function createNodeClientWorld() {
  const world = new World()
  
  // Minimal headless client systems
  world.register('client', NodeClient)         // Headless lifecycle
  world.register('network', ClientNetwork)     // Server connection
  world.register('environment', Environment)   // Basic environment
  
  return world
}
