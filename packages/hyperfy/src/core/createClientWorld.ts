import { World } from './World'

import { Client } from './systems/Client'
import { Stage } from './systems/Stage'
import { ClientLiveKit } from './systems/ClientLiveKit'
import { ClientPointer } from './systems/ClientPointer'
import { ClientPrefs } from './systems/ClientPrefs'
import { ClientControls } from './systems/ClientControls'
import { ClientNetwork } from './systems/ClientNetwork'
import { ClientLoader } from './systems/ClientLoader'
import { ClientGraphics } from './systems/ClientGraphics'
import { ClientEnvironment } from './systems/ClientEnvironment'
import { ClientAudio } from './systems/ClientAudio'
import { ClientStats } from './systems/ClientStats'
import { ClientBuilder } from './systems/ClientBuilder'
import { ClientActions } from './systems/ClientActions'
import { ClientTarget } from './systems/ClientTarget'
import { ClientUI } from './systems/ClientUI'
// import { LODs } from './systems/LODs'
// import { Nametags } from './systems/Nametags'
// import { Particles } from './systems/Particles'
// import { Snaps } from './systems/Snaps'
// import { Wind } from './systems/Wind'
// import { XR } from './systems/XR'

// Import RPG Systems (client-side only - database system only on server)
import { 
  RPGPlayerSystem,
  RPGCombatSystem,
  RPGInventorySystem,
  RPGXPSystem,
  RPGUISystem,
  RPGMobSystem,
  RPGBankingSystem,
  RPGStoreSystem,
  RPGResourceSystem,
  RPGMovementSystem,
  RPGWorldGenerationSystem,
  DefaultWorldSystem,
  MobSpawnerSystem,
  ExampleMobSpawner,
  RPGVisualTestSystem,
  RPGAppManager
} from '../rpg/systems/index'

// Import unified terrain system
import { TerrainSystem } from './systems/TerrainSystem'

// Import interaction systems
import { RPGInteractionSystem } from '../rpg/systems/RPGInteractionSystem'
import { RPGClientInteractionSystem } from '../rpg/systems/RPGClientInteractionSystem'
import { RPGCameraSystem } from '../rpg/systems/RPGCameraSystem'

// Import RPG System Loader for API setup
import { registerRPGSystems } from '../rpg/systems/RPGSystemLoader'

/**
 * Load client-side plugin systems from a specified path
 */
async function loadClientPluginSystems(world: World, pluginPath: string) {
  console.log(`[Client Plugin Loader] Loading plugin systems from: ${pluginPath}`);
  
  // Convert absolute file system path to relative URL for web
  let webPath = pluginPath;
  if (pluginPath.startsWith('/')) {
    // Convert absolute path to relative URL
    const parts = pluginPath.split('/');
    const packagesIndex = parts.findIndex(part => part === 'packages');
    if (packagesIndex !== -1) {
      webPath = '/' + parts.slice(packagesIndex + 1).join('/');
    }
  }
  
  console.log(`[Client Plugin Loader] Using web path: ${webPath}`);
  
  try {
    // Try multiple possible paths for the RPG plugin bundle
    const possiblePaths = [
      `/rpg/dist/rpg-plugin-bundle.js`,
      `${webPath}/rpg-plugin-bundle.js`
    ];
    
    let success = false;
    
    for (const systemLoaderUrl of possiblePaths) {
      try {
        console.log(`[Client Plugin Loader] Trying path: ${systemLoaderUrl}`);
        const module = await import(systemLoaderUrl);
        if (typeof module.registerRPGSystems === 'function') {
          await module.registerRPGSystems(world);
          console.log(`[Client Plugin Loader] ✅ Plugin systems registered successfully from: ${systemLoaderUrl}`);
          success = true;
          break;
        } else {
          console.warn(`[Client Plugin Loader] registerRPGSystems function not found in: ${systemLoaderUrl}`);
        }
      } catch (importError) {
        console.log(`[Client Plugin Loader] Failed to load from ${systemLoaderUrl}:`, (importError as Error).message);
        continue;
      }
    }
    
    if (!success) {
      throw new Error('Could not load RPG systems from any known path');
    }
    
  } catch (error) {
    console.error('[Client Plugin Loader] Error loading plugin systems:', error);
    throw error;
  }
}

export function createClientWorld() {
  const world = new World()
  world.register('client', Client);
  world.register('stage', Stage);
  world.register('livekit', ClientLiveKit);
  world.register('pointer', ClientPointer);
  world.register('prefs', ClientPrefs);
  world.register('controls', ClientControls);
  world.register('network', ClientNetwork);
  world.register('loader', ClientLoader);
  world.register('graphics', ClientGraphics);
  world.register('environment', ClientEnvironment);
  world.register('audio', ClientAudio);
  world.register('stats', ClientStats);
  world.register('builder', ClientBuilder);
  world.register('actions', ClientActions);
  world.register('target', ClientTarget);
  world.register('ui', ClientUI);
  // world.register('lods', LODs)
  // world.register('nametags', Nametags)
  // world.register('particles', Particles)
  // world.register('snaps', Snaps)  
  // world.register('wind', Wind)
  // world.register('xr', XR)
  
  // Register all RPG systems using the standard naming convention (database system only on server)
  world.register('rpg-app-manager', RPGAppManager);
  world.register('rpg-player', RPGPlayerSystem);
  world.register('rpg-combat', RPGCombatSystem);
  world.register('rpg-inventory', RPGInventorySystem);
  world.register('rpg-xp', RPGXPSystem);
  world.register('rpg-ui', RPGUISystem);
  world.register('rpg-mob', RPGMobSystem);
  world.register('rpg-banking', RPGBankingSystem);
  world.register('rpg-store', RPGStoreSystem);
  world.register('rpg-resource', RPGResourceSystem);
  world.register('rpg-movement', RPGMovementSystem);
  world.register('rpg-world-generation', RPGWorldGenerationSystem);
  world.register('unified-terrain', TerrainSystem);
  world.register('default-world', DefaultWorldSystem);
  world.register('mob-spawner', MobSpawnerSystem);
  world.register('example-mob-spawner', ExampleMobSpawner);
  // Removed SimpleTerrainSystem - using only ProceduralTerrain via RPGClientTerrainSystem
  world.register('rpg-visual-test', RPGVisualTestSystem);
  world.register('rpg-interaction', RPGInteractionSystem);
  world.register('rpg-client-interaction', RPGClientInteractionSystem);
  world.register('rpg-camera', RPGCameraSystem);

  // Expose world object to browser window immediately for testing
  if (typeof window !== 'undefined') {
    console.log('[Client World] Exposing world object to browser window...');
    window.world = world;
    console.log('[Client World] World object exposed to browser window');
  }

  // Set up the RPG API after systems are registered
  setTimeout(async () => {
    try {
      console.log('[Client World] Starting RPG system initialization...');
      console.log('[Client World] World systems available:', Object.keys(world.systems || {}));
      await registerRPGSystems(world);
      console.log('[Client World] RPG systems and API initialized successfully');
      
      // Verify the RPG API was created properly
      if (world.rpg) {
        console.log('[Client World] ✅ world.rpg created successfully');
        console.log('[Client World] RPG systems available:', Object.keys(world.rpg.systems || {}));
        console.log('[Client World] RPG actions available:', Object.keys(world.rpg.actions || {}));
      } else {
        console.error('[Client World] ❌ world.rpg was not created!');
      }
      
      // Update world object in browser window after RPG API is ready
      if (typeof window !== 'undefined') {
        window.world = world;
        console.log('[Client World] World object updated with RPG API');
        console.log('[Client World] RPG API available at window.world.rpg');
        console.log('[Client World] Available RPG systems:', Object.keys(world.rpg?.systems || {}));
        
        // Also expose Three.js if available
        const THREE = globalThis.THREE || window.THREE;
        if (THREE) {
          window.THREE = THREE;
          console.log('[Client World] THREE.js exposed to window for testing');
        } else {
          console.warn('[Client World] THREE.js not found in global scope');
        }
      }
    } catch (error: unknown) {
      console.error('[Client World] Failed to initialize RPG systems:', error);
      if (error instanceof Error) {
        console.error('[Client World] Error stack:', error.stack);
      }
      
      // Still expose world object even if RPG systems fail
      if (typeof window !== 'undefined') {
        window.world = world;
        console.log('[Client World] World object exposed despite RPG system failure');
      }
    }
  }, 2000); // Increased timeout to 2 seconds

  // Add plugin loading hook
  world.loadPlugin = async (plugin: any) => {
    await world.registerPlugin?.(plugin);
  };
  
  // Expose THREE.js through the stage system for RPG systems
  const setupStageWithTHREE = () => {
    if (world.stage) {
      // Extract THREE.js from the stage's existing scene object
      const scene = world.stage.scene;
      if (scene && scene.constructor) {
        // Get THREE from scene constructor's prototype or global THREE
        const THREE = globalThis.THREE || window.THREE;
        if (THREE) {
          world.stage.THREE = THREE;
          console.log('[Client World] THREE.js exposed through stage for RPG systems');
        } else {
          // Create minimal THREE.js compatibility from existing scene objects
          const extractedTHREE = {
            Scene: scene.constructor,
            Group: class Group extends scene.constructor {},
            Mesh: class Mesh {},
            BoxGeometry: class BoxGeometry {},
            CylinderGeometry: class CylinderGeometry {},
            PlaneGeometry: class PlaneGeometry {},
            MeshBasicMaterial: class MeshBasicMaterial {},
            MeshLambertMaterial: class MeshLambertMaterial {},
            Vector3: class Vector3 {},
            Fog: class Fog {}
          };
          world.stage.THREE = extractedTHREE;
          console.log('[Client World] Minimal THREE.js compatibility created for RPG systems');
        }
      }
    }
  };
  
  // Setup THREE.js access after world initialization
  setTimeout(setupStageWithTHREE, 200);
  
  // Load client-side plugin systems if specified
  const PLUGIN_PATH = globalThis.env?.PLUGIN_PATH;
  if (PLUGIN_PATH) {
    setTimeout(async () => {
      try {
        await loadClientPluginSystems(world, PLUGIN_PATH);
        console.log('[Client World] Plugin systems loaded successfully');
      } catch (error: unknown) {
        console.error('[Client World] Failed to load plugin systems:', error instanceof Error ? error.message : error);
      }
    }, 100);
  }
  
  console.log('[World] Client world created with plugin support');
  return world;
}
