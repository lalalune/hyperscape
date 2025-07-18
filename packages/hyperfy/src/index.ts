// Core world creation
export { createNodeClientWorld } from './core/createNodeClientWorld.js';
export { createClientWorld } from './core/createClientWorld.js';
export { createServerWorld } from './core/createServerWorld.js';

// Core utilities
export { uuid, clamp, hasRole, addRole, removeRole, serializeRoles, num } from './core/utils.js';

// Export hashFile from utils-client with alias to avoid conflict
export { hashFile as hashFileClient } from './core/utils-client.js';

// Base classes
export { System } from './core/systems/System.js';
export { Node } from './core/nodes/Node.js';

// Core classes
export { World } from './core/World.js';
export { Socket } from './core/Socket.js';

// Extras - Vector and math utilities
export { Vector3Enhanced } from './core/extras/Vector3Enhanced.js';
export { LerpVector3 } from './core/extras/LerpVector3.js';
export { LerpQuaternion } from './core/extras/LerpQuaternion.js';

// Extras - App and entity tools
export * from './core/extras/appTools.js';
export { createEmoteFactory } from './core/extras/createEmoteFactory.js';
export { createNode } from './core/extras/createNode.js';
export { glbToNodes } from './core/extras/glbToNodes.js';
export * from './core/extras/playerEmotes.js';

// Libraries
export { CSM } from './core/libs/csm/CSM.js';
export { GLTFLoader } from './core/libs/gltfloader/GLTFLoader.js';
export type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Re-export all types from types/index.js
export type * from './types/index.js';

// Plugin definition
export const hyperfyPlugin = {
  name: 'hyperfy',
  description: 'Hyperfy virtual world engine',
  version: '0.13.0'
};

export default hyperfyPlugin;