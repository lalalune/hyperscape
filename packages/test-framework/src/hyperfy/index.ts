/**
 * Hyperfy Framework Re-exports
 * 
 * This module re-exports everything from the @hyperscape/hyperfy package
 * for use by the test framework.
 */

// Import from the built hyperfy package
export {
  HyperfyFramework,
  WorldManager,
  ConfigManager,
  StorageManager,
  World,
  createServerWorld,
  createClientWorld,
  createViewerWorld,
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
  getPhysXAssetPath,
  System
} from '../../../hyperfy/build/framework.js';

export type {
  HyperfyFrameworkOptions,
  WorldConfig,
  WorldInfo,
  PersistenceConfig,
  AssetConfig,
  SystemConfig,
  StorageConfig
} from '../../../hyperfy/build/framework.d.ts';

// Export THREE separately to avoid naming conflicts
export * as THREE from 'three';

// Default export for convenience
export { HyperfyFramework as default } from '../../../hyperfy/build/framework.js';