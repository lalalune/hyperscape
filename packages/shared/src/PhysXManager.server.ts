/**
 * Server-specific PhysX loading utilities
 * 
 * This module handles Node.js-specific WASM loading for PhysX.
 * It should only be imported on the server side.
 */

export async function loadPhysXWasmForNode(): Promise<Buffer> {
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
      
  // Try multiple locations for the WASM file
  const possiblePaths = [
    // First try relative to the current module
    join(dirname(fileURLToPath(import.meta.url)), '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),
    join(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),

    // Try workspace root
    join(dirname(fileURLToPath(import.meta.url)), '../../../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),
    join(dirname(fileURLToPath(import.meta.url)), '../../../../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),

    // Try relative to process.cwd()
    join(process.cwd(), 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),
    // Try the build directory (where WASM might be copied)
    join(dirname(fileURLToPath(import.meta.url)), '../public/physx-js-webidl.wasm'),
    // Try build/public directory
    join(process.cwd(), 'packages/hyperscape/build/public/physx-js-webidl.wasm'),
    // Try server public directory  
    join(process.cwd(), 'packages/hyperscape/src/server/public/physx-js-webidl.wasm')
  ]

  let wasmPath: string | null = null;
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      wasmPath = path;
      break;
    }
  }
  
  if (!wasmPath) {
    throw new Error(`[PhysXManager] WASM file not found in any of the expected locations:\n${possiblePaths.join('\n')}`);
  }
  
  console.log('[PhysXManager] Reading WASM file from:', wasmPath);
  const wasmBuffer = readFileSync(wasmPath);
  console.log('[PhysXManager] WASM buffer loaded, size:', wasmBuffer.length);
  
  return wasmBuffer;
}

