/**
 * createServerWorld.ts - Server World Factory
 * 
 * Creates and configures a World instance for server-side execution.
 * This factory function registers all server-specific systems in the correct order
 * to ensure proper dependency resolution and initialization.
 * 
 * Architecture:
 * - Server world is authoritative for all game state and physics
 * - No interpolation or prediction - clients receive authoritative positions
 * - Server validates all player actions and movement
 * - Runs headless with PhysX physics (Node.js compatible)
 * 
 * Systems Registered:
 * 1. Core Systems: ServerRuntime, ServerLiveKit, ServerLoader
 * 2. Environment: Lighting, shadows, CSM
 * 3. Terrain: Heightmap-based terrain system
 * 4. RPG Systems: All game logic (combat, inventory, skills, etc.)
 * 5. Optional: ServerBot (if MAX_BOT_COUNT > 0 and DISABLE_BOTS != true)
 * 
 * Network System:
 * ServerNetwork is registered separately in the server package (not here)
 * because it has dependencies that should not be included in the shared bundle.
 * 
 * Usage:
 * ```typescript
 * const world = await createServerWorld();
 * await world.init({ assetsDir: './assets', storage: serverStorage });
 * // Server is now running and ready to accept connections
 * ```
 * 
 * Used by: Server package (packages/server/src/index.ts)
 * References: World.ts, registerSystems() in SystemLoader.ts
 */

import { World } from './World'

import { ServerRuntime } from './systems/ServerRuntime'
import { Environment } from './systems/Environment'
import { ServerLiveKit } from './systems/ServerLiveKit'
import { ServerLoader } from './systems/ServerLoader'
// ServerNetwork is server-only, will be imported from server package
// import { ServerNetwork } from './systems/ServerNetwork'

import { TerrainSystem } from './systems/TerrainSystem'

// RPG systems are registered via SystemLoader to keep them modular
import { registerSystems } from './systems/SystemLoader'
import { ServerBot } from './systems/ServerBot'

/**
 * Creates and configures a server-side World instance.
 * 
 * The server world runs with full physics simulation and is authoritative
 * for all game state. It validates all client actions and broadcasts
 * authoritative updates to connected clients.
 * 
 * @returns A fully configured World instance ready for server initialization
 */
export async function createServerWorld(): Promise<World> {
  const world = new World()
  
  // ============================================================================
  // CORE SERVER SYSTEMS
  // ============================================================================
  // These systems provide the foundational server infrastructure:
  // - ServerRuntime: Lifecycle management, monitoring, health checks
  // - ServerLiveKit: Voice chat server integration
  // - ServerLoader: Asset loading and caching for server-side resources
  // - Environment: Lighting, shadows, and CSM (Cascaded Shadow Maps)
  // Note: ServerNetwork is registered separately in the server package
  
  world.register('server', ServerRuntime);
  world.register('livekit', ServerLiveKit);
  world.register('loader', ServerLoader);
  world.register('environment', Environment);
  world.register('monitor', ServerRuntime); // ServerRuntime provides monitoring capabilities
  
  // ============================================================================
  // TERRAIN SYSTEM
  // ============================================================================
  // Provides heightmap-based terrain with pathfinding support
  // Server generates terrain data that clients can request
  
  world.register('terrain', TerrainSystem);
  
  // ============================================================================
  // RPG GAME SYSTEMS
  // ============================================================================
  // SystemLoader registers all RPG gameplay systems including:
  // - CombatSystem: Melee, ranged, and magic combat
  // - InventorySystem: Item storage and management
  // - EquipmentSystem: Weapons, armor, and gear
  // - SkillsSystem: Experience and leveling
  // - MobSystem: Enemy spawning and AI
  // - NPCSystem: Non-hostile character management
  // - LootSystem: Item drops and rewards
  // - DeathSystem: Player/mob death handling
  // - StoreSystem: Shops and trading
  // - BankingSystem: Item and currency storage
  // - ResourceSystem: Gathering nodes (trees, rocks, etc.)
  // - MobSpawnerSystem: Dynamic mob population
  // - ItemSpawnerSystem: Ground item management
  // - PathfindingSystem: A* pathfinding for NPCs/mobs
  // - AggroSystem: Enemy aggression and threat
  // - InteractionSystem: Player-entity interactions
  // - PersistenceSystem: Database saves and loads
  
  
  await registerSystems(world);
  
  // ============================================================================
  // OPTIONAL: SERVER BOT
  // ============================================================================
  // ServerBot system spawns AI-controlled bots for testing and development
  // Controlled by environment variables:
  // - MAX_BOT_COUNT: Number of bots to spawn (default: 0)
  // - DISABLE_BOTS: Explicitly disable bots even if MAX_BOT_COUNT > 0
  
  const maxBots = parseInt((process.env.MAX_BOT_COUNT || '0') as string, 10);
  const disableBots = (process.env.DISABLE_BOTS || '').toLowerCase() === 'true';
  const enableBots = !disableBots && maxBots > 0;
  
  if (enableBots) {
    world.register('server-bot', ServerBot);
  } else {
  }
  
  
  return world;
}
