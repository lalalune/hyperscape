
import path from 'path'
import { fileURLToPath } from 'url'

// support `__dirname` in ESM
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url))


export * as THREE from '../core/extras/three.js';

export { createNodeClientWorld } from '../core/createNodeClientWorld'
export { storage } from '../core/storage'
export { World } from '../core/World'
export { loadPhysX } from '../core/loadPhysX'
export { uuid } from '../core/utils'

export { System } from '../core/systems/System'
export { NodeClient } from '../core/systems/NodeClient'
export { ClientControls } from '../core/systems/ClientControls'
export { ClientNetwork } from '../core/systems/ClientNetwork'
export { ServerLoader } from '../core/systems/ServerLoader'
export { NodeEnvironment } from '../core/systems/NodeEnvironment'

export { Node } from '../core/nodes/Node'

export { Emotes } from '../core/extras/playerEmotes'
export { createEmoteFactory } from '../core/extras/createEmoteFactory'
export { createNode } from '../core/extras/createNode'
export { glbToNodes } from '../core/extras/glbToNodes'
export { Vector3Enhanced } from '../core/extras/Vector3Enhanced'

export { GLTFLoader } from '../core/libs/gltfloader/GLTFLoader'
export { CSM } from '../core/libs/csm/CSM'

/**
 * Returns the absolute path to a PhysX asset within the packaged 'vendor' directory.
 * This assumes that the 'vendor' directory is at the root of the installed package.
 * @param assetName The name of the PhysX asset (e.g., 'physx.wasm').
 */
export function getPhysXAssetPath(assetName) {
  // In ESM, __dirname is not available directly like in CJS.
  // This constructs a path relative to the current module file.
  // Assumes index.js is at the root of the dist/npm package.
  // If index.js is nested, this path needs adjustment (e.g., path.join(__dirname, '../vendor', assetName))
  const currentModulePath = fileURLToPath(import.meta.url);
  const packageRootPath = path.dirname(currentModulePath);
  return path.join(packageRootPath, 'vendor', assetName);
}
