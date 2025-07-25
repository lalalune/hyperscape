import { World } from './World'

import { Server } from './systems/Server'
import { ServerLiveKit } from './systems/ServerLiveKit'
import { ServerNetwork } from './systems/ServerNetwork'
import { ServerLoader } from './systems/ServerLoader'
import { ServerEnvironment } from './systems/ServerEnvironment'
import { ServerMonitor } from './systems/ServerMonitor'

// Import unified terrain system
import { TerrainSystem } from './systems/TerrainSystem'

// Import comprehensive RPG system loader
import { registerRPGSystems } from '../rpg/systems/RPGSystemLoader'

export function createServerWorld() {
  const world = new World()
  
  // Register core server systems
  world.register('server', Server);
  world.register('livekit', ServerLiveKit);
  world.register('network', ServerNetwork);
  world.register('loader', ServerLoader);
  world.register('environment', ServerEnvironment);
  world.register('monitor', ServerMonitor);
  
  // Register all RPG systems using the comprehensive loader
  // This includes physics test systems and all other RPG systems
  registerRPGSystems(world);
  
  // Register core non-RPG systems
  world.register('unified-terrain', TerrainSystem);
  
  console.log('[World] Server world created with integrated RPG systems');
  return world;
}
