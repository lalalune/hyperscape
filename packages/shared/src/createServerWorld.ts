import { World } from './World'

import { ServerRuntime } from './systems/ServerRuntime'
import { Environment } from './systems/Environment'
import { ServerLiveKit } from './systems/ServerLiveKit'
import { ServerLoader } from './systems/ServerLoader'
// ServerNetwork is server-only, will be imported from server package
// import { ServerNetwork } from './systems/ServerNetwork'

// Import unified terrain system
import { TerrainSystem } from './systems/TerrainSystem'

// Import RPG systems loader
import { registerSystems } from './systems/SystemLoader'
import { ServerBot } from './systems/ServerBot'

export async function createServerWorld(): Promise<World> {
  console.log('[Server World] Creating server world...');
  const world = new World()
  
  // Register core server systems
  console.log('[Server World] Registering core server systems...');
  world.register('server', ServerRuntime);
  world.register('livekit', ServerLiveKit);
  // world.register('network', ServerNetwork); // ServerNetwork moved to server package
  world.register('loader', ServerLoader);
  world.register('environment', Environment);
  world.register('monitor', ServerRuntime); // Monitor is now part of ServerRuntime
  
  // Register core terrain system
  world.register('terrain', TerrainSystem);
  
  // Position validation is now integrated into ServerNetwork
  
  // NO interpolation system - server is authoritative for movement
  
  // Do not register client systems on server; server exposes only RPG systems via SystemLoader when enabled
  
  console.log('[Server World] Core systems registered');
  
  // Register RPG game systems
  console.log('[Server World] Registering RPG game systems...');
  await registerSystems(world);
  console.log('[Server World] RPG game systems registered successfully');
  
  // Register server bot only when explicitly enabled
  const maxBots = parseInt((process.env.MAX_BOT_COUNT || '0') as string, 10);
  const disableBots = (process.env.DISABLE_BOTS || '').toLowerCase() === 'true';
  const enableBots = !disableBots && maxBots > 0;
  if (enableBots) {
    // Test systems consolidated into MovementValidationSystem (registered in SystemLoader)
    world.register('server-bot', ServerBot);
    console.log('[Server World] Server bot registered');
  } else {
    console.log('[Server World] Server bot disabled (MAX_BOT_COUNT=0 or DISABLE_BOTS=true)');
  }
  console.log('[Server World] All test systems registered');
  
  console.log('[Server World] Server world created successfully');
  
  return world;
}
