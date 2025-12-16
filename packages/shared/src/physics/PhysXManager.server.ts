/**
 * PhysXManager.server.ts - Server-Side PhysX Loading
 *
 * This module handles ALL Node.js-specific PhysX loading.
 * It is dynamically imported by PhysXManager.ts only in Node.js environments,
 * ensuring browser bundles don't include Node.js modules or dynamic imports.
 *
 * Why Separate File:
 * - Bundlers (Vite, Webpack) can't handle Node.js modules in browser builds
 * - Vite warns about dynamic imports it can't analyze
 * - Keeps ALL Node.js dependencies isolated from browser code
 *
 * Loading Strategy:
 * 1. Load WASM binary from local assets or CDN with caching
 * 2. Dynamically import the physx-js-webidl module
 * 3. Initialize PhysX with the WASM binary
 *
 * Referenced by: PhysXManager.loadPhysXInternal() in Node.js environments only
 */

import type { PhysXModule } from "../types/systems/physics";

/**
 * Load PhysX WASM Binary for Node.js
 *
 * Attempts to load WASM from local assets first, then falls back to CDN fetch with caching.
 *
 * @returns Buffer containing physx-js-webidl.wasm binary
 * @throws Error if WASM file cannot be loaded from any source
 */
export async function loadPhysXWasmForNode(): Promise<Buffer> {
  const { readFileSync, writeFileSync, existsSync, mkdirSync } =
    await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  // Try local assets/web/ directory first (for development and direct workspace access)
  const localPaths = [
    // Workspace root assets
    join(process.cwd(), "assets/web/physx-js-webidl.wasm"),
    join(process.cwd(), "../../assets/web/physx-js-webidl.wasm"),
    join(process.cwd(), "../../../assets/web/physx-js-webidl.wasm"),
  ];

  for (const path of localPaths) {
    if (existsSync(path)) {
      const wasmBuffer = readFileSync(path);
      return wasmBuffer;
    }
  }

  // Fall back to CDN fetch with caching
  const cacheDir = join(tmpdir(), "hyperscape-cache");
  const cachePath = join(cacheDir, "physx-js-webidl.wasm");

  if (existsSync(cachePath)) {
    const wasmBuffer = readFileSync(cachePath);
    return wasmBuffer;
  }

  // Fetch from CDN
  const cdnUrl =
    process.env["PUBLIC_CDN_URL"] || "http://localhost:5555/assets";
  const wasmUrl = `${cdnUrl}/web/physx-js-webidl.wasm`;

  const response = await fetch(wasmUrl);

  if (!response.ok) {
    throw new Error(
      `[PhysXManager] Failed to fetch WASM from CDN: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const wasmBuffer = Buffer.from(arrayBuffer);

  // Cache for future use
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, wasmBuffer);

  return wasmBuffer;
}

/**
 * Load PhysX Module for Node.js
 *
 * This function handles ALL Node.js-specific PhysX loading:
 * 1. Loads the WASM binary
 * 2. Resolves the path to physx-js-webidl
 * 3. Dynamically imports and initializes the PhysX module
 *
 * @param moduleOptions - Options to pass to PhysX initialization
 * @returns Initialized PhysX module
 */
export async function loadPhysXModuleForNode(
  moduleOptions: Record<string, unknown>,
): Promise<PhysXModule> {
  const pathModule = await import("node:path");
  const urlModule = await import("node:url");

  // Load WASM binary
  const wasmBuffer = await loadPhysXWasmForNode();
  moduleOptions.wasmBinary = wasmBuffer;

  // Get the directory containing this file (works in both source and bundled contexts)
  const currentFileUrl = import.meta.url;
  const currentDir = pathModule.dirname(
    urlModule.fileURLToPath(currentFileUrl),
  );

  // Navigate up to find the packages directory and then to physx-js-webidl
  // From: packages/shared/build/framework.js or packages/shared/src/physics/PhysXManager.ts
  // To: packages/physx-js-webidl/dist/physx-js-webidl.js
  let physxPath: string;
  if (currentDir.includes("/build")) {
    // Running from bundled framework.js
    physxPath = pathModule.resolve(
      currentDir,
      "../../physx-js-webidl/dist/physx-js-webidl.js",
    );
  } else {
    // Running from source
    physxPath = pathModule.resolve(
      currentDir,
      "../../../physx-js-webidl/dist/physx-js-webidl.js",
    );
  }

  // Dynamic import of PhysX module - this is Node.js only so no Vite warning
  const physxModule = await import(physxPath);
  const PhysXLoader = physxModule.default || physxModule;

  // Initialize and return PhysX module
  const PHYSX = await (
    PhysXLoader as (options: Record<string, unknown>) => Promise<PhysXModule>
  )(moduleOptions);

  return PHYSX;
}
