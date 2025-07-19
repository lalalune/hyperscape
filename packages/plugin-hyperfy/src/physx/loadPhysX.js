import PhysXModule from './physx-js-webidl.js'

/**
 * PhysX Loader
 *
 * We are currently using a fork of physx-js-webidl with a custom build, modifying `PhysXWasmBindings.cmake` options to work on both node and browser environments
 *
 */
let promise
export function loadPhysX() {
  if (!promise) {
    promise = new Promise(async resolve => {
      globalThis.PHYSX = await PhysXModule()
      const version = PHYSX.PHYSICS_VERSION
      const allocator = new PHYSX.PxDefaultAllocator()
      const errorCb = new PHYSX.PxDefaultErrorCallback()
      const foundation = PHYSX.CreateFoundation(version, allocator, errorCb)
      resolve({ version, allocator, errorCb, foundation })
    })
  }
  return promise
}
