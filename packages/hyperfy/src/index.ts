/**
 * @hyperscape/hyperfy
 * 
 * Main export for the Hyperfy framework package
 */

// Export framework components explicitly to avoid conflicts
export { 
  HyperfyFramework,
  WorldManager,
  ConfigManager,
  StorageManager
} from './framework/index.js';

// Export framework types
export type {
  HyperfyFrameworkOptions,
  WorldConfig,
  WorldInfo,
  PersistenceConfig,
  AssetConfig,
  SystemConfig,
  StorageConfig
} from './framework/index.js';

// Export specific core components
export { World } from './core/World.js';
export { createServerWorld } from './core/createServerWorld.js';
export { createClientWorld } from './core/createClientWorld.js';
export { createViewerWorld } from './core/createViewerWorld.js';

// Export node client components explicitly to avoid conflicts
export {
  createNodeClientWorld,
  storage,
  loadPhysX,
  uuid,
  NodeClient,
  ClientControls,
  ClientNetwork,
  ServerLoader,
  NodeEnvironment,
  Node,
  Emotes,
  createEmoteFactory,
  createNode,
  glbToNodes,
  Vector3Enhanced,
  GLTFLoader,
  CSM,
  getPhysXAssetPath
} from './node-client/index.js';

// Export THREE separately to avoid naming conflicts
export * as THREE from 'three';

// Export System from core (single source to avoid duplicates)
export { System } from './core/systems/System.js';

// Default export is the framework
export { HyperfyFramework as default } from './framework/index.js';