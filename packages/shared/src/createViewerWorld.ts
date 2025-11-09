/**
 * createViewerWorld.ts - Lightweight Viewer World Factory
 *
 * Creates a minimal World instance for viewing 3D content without full game functionality.
 * This is a lightweight version of the client world that's useful for:
 * - 3D asset preview tools
 * - Model viewers and inspectors
 * - Development tools that need rendering but not gameplay
 * - Embedded 3D viewers in documentation or websites
 *
 * What's Included:
 * - ClientRuntime: Basic lifecycle management
 * - ClientInterface: UI state and preferences
 * - ClientLoader: Asset loading (GLB, textures, etc.)
 * - ClientInput: Basic camera controls (orbit, pan, zoom)
 * - ClientGraphics: WebGL/WebGPU renderer
 * - Environment: Lighting and shadows
 *
 * What's NOT Included (compared to full client world):
 * - Network: No multiplayer or server connection
 * - Audio: No sound system
 * - Physics: No collision detection or physics simulation
 * - Chat: No communication system
 * - Game Systems: No combat, inventory, NPCs, etc.
 * - Entities: No player or mob management
 *
 * Usage:
 * ```typescript
 * const world = createViewerWorld();
 * await world.init({ assetsUrl: '/assets/' });
 * // World is ready for loading and displaying 3D models
 * ```
 *
 * Used by: 3D Asset Forge (packages/asset-forge), development tools
 * References: World.ts, createClientWorld.ts
 */

import { World } from "./World";

import { ClientRuntime } from "./systems/ClientRuntime";
import { ClientInterface } from "./systems/ClientInterface";
import { ClientLoader } from "./systems/ClientLoader";
import { ClientInput } from "./systems/ClientInput";
import { ClientGraphics } from "./systems/ClientGraphics";
import { Environment } from "./systems/Environment";

// Re-export System class for building custom viewer systems
export { System } from "./systems/System";

/**
 * Creates a lightweight viewer world for 3D content display.
 *
 * This world has minimal systems for rendering 3D models without
 * the overhead of networking, physics, or game logic.
 *
 * @returns A minimal World instance configured for viewing 3D content
 */
export function createViewerWorld() {
  const world = new World();

  // Core viewer systems (minimal set for rendering)
  world.register("client", ClientRuntime); // Lifecycle management
  world.register("prefs", ClientInterface); // UI state
  world.register("loader", ClientLoader); // Asset loading
  world.register("controls", ClientInput); // Camera controls
  world.register("graphics", ClientGraphics); // Renderer
  world.register("environment", Environment); // Lighting

  return world;
}
