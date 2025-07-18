import { World } from './World';

import { Server } from './systems/Server';
import { ServerLiveKit } from './systems/ServerLiveKit';
import { ServerNetwork } from './systems/ServerNetwork';
import { ServerLoader } from './systems/ServerLoader';
import { ServerEnvironment } from './systems/ServerEnvironment';
import { ServerMonitor } from './systems/ServerMonitor';
import { PersistenceSystem } from './systems/Persistence';
import { WorldStateManager } from './systems/WorldStateManager';

export function createServerWorld() {
  const world = new World();
  world.register('server', Server);
  world.register('livekit', ServerLiveKit);
  world.register('network', ServerNetwork);
  world.register('loader', ServerLoader);
  world.register('environment', ServerEnvironment);
  world.register('monitor', ServerMonitor);
  world.register('persistence', PersistenceSystem);
  world.register('worldStateManager', WorldStateManager);
  return world;
}
