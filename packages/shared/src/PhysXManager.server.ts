/**
 * PhysXManager.server.ts - Server-Side PhysX WASM Loading
 * 
 * This module handles Node.js-specific WASM loading for PhysX.
 * It is dynamically imported by PhysXManager.ts only in Node.js environments,
 * ensuring browser bundles don't include Node.js modules.
 * 
 * Why Separate File:
 * - Bundlers (Vite, Webpack) can't handle Node.js modules in browser builds
 * - Dynamic import with computed path prevents bundler from trying to include this
 * - Keeps Node.js dependencies isolated from browser code
 * 
 * Loading Strategy:
 * - Searches multiple possible paths for physx-js-webidl.wasm
 * - Reads WASM binary into Buffer for direct loading
 * - Provides buffer to PhysX via wasmBinary option (bypasses locateFile)
 * 
 * Referenced by: PhysXManager.loadPhysXInternal() in Node.js environments only
 */

/**
 * Load PhysX WASM Binary for Node.js
 * 
 * Searches multiple possible locations for the WASM file and loads it into a Buffer.
 * The WASM binary is then provided directly to PhysX initialization.
 * 
 * Search Paths (in order):
 * 1. Relative to current module in node_modules
 * 2. Workspace root node_modules
 * 3. Process working directory
 * 4. Build directories
 * 
 * @returns Buffer containing physx-js-webidl.wasm binary
 * @throws Error if WASM file not found in any expected location
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

