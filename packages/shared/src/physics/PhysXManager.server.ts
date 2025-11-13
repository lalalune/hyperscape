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
 * 1. Try loading from local assets/web/ directory (workspace root)
 * 2. Fall back to fetching from CDN and caching to temp directory
 * 3. Provides buffer to PhysX via wasmBinary option (bypasses locateFile)
 *
 * Referenced by: PhysXManager.loadPhysXInternal() in Node.js environments only
 */

/**
 * Load PhysX WASM Binary for Node.js
 *
 * Attempts to load WASM from local assets first, then falls back to CDN fetch with caching.
 * The WASM binary is then provided directly to PhysX initialization.
 *
 * Loading Strategy:
 * 1. Check assets/web/ directory relative to workspace root
 * 2. If not found, fetch from CDN (PUBLIC_CDN_URL environment variable)
 * 3. Cache CDN downloads to temp directory for future use
 *
 * @returns Buffer containing physx-js-webidl.wasm binary
 * @throws Error if WASM file cannot be loaded from any source
 */
export async function loadPhysXWasmForNode(): Promise<Buffer> {
  const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import(
    "node:fs"
  );
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
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

  // Check cache first
  const cacheDir = join(tmpdir(), "hyperscape-cache");
  const cachePath = join(cacheDir, "physx-js-webidl.wasm");

  if (existsSync(cachePath)) {
    const wasmBuffer = readFileSync(cachePath);
    return wasmBuffer;
  }

  // Fetch from CDN
  const cdnUrl = process.env["PUBLIC_CDN_URL"] || "http://localhost:8080";
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
