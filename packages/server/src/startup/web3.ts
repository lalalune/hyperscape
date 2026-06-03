/**
 * Web3 Initialization Module
 *
 * Sets up the ChainWriter and ChainWriterBridge when the server
 * runs in Web3 mode (MODE=web3).
 *
 * This module is imported lazily (dynamic import) so that the web3
 * package is not loaded in Web2 mode, keeping the default server
 * startup lightweight.
 *
 * Usage in server main:
 * ```typescript
 * if (process.env.MODE === "web3") {
 *   const { initializeWeb3 } = await import("./startup/web3.js");
 *   const web3Context = await initializeWeb3(world);
 *   // web3Context.bridge is attached to world events
 *   // Call web3Context.shutdown() on server shutdown
 * }
 * ```
 */

import type { World } from "@hyperforge/shared";

export interface ChainWriterStats {
  totalCallsFlushed: number;
  totalFlushes: number;
  failedFlushes: number;
  pending: number;
}

export interface Web3Context {
  /** Flush pending writes and shut down chain writer */
  shutdown: () => Promise<void>;
  /** Get chain writer statistics */
  getStats: () => ChainWriterStats;
  /** Register a player's wallet for chain writes */
  registerPlayerWallet: (playerId: string, walletAddress: string) => void;
}

/**
 * Initialize Web3 mode for the game server.
 *
 * 1. Imports @hyperforge/web3 (lazy, not loaded in web2 mode)
 * 2. Builds the item ID mapping from manifests
 * 3. Creates and initializes the ChainWriter
 * 4. Creates the ChainWriterBridge and attaches to world events
 *
 * @param world The initialized game world
 * @returns Web3Context with the bridge and shutdown function
 */
export async function initializeWeb3(world: World): Promise<Web3Context> {
  console.log("[Web3] Initializing Web3 mode...");

  // Dynamic import - only loads @hyperforge/web3 in web3 mode
  const { ChainWriter, ChainWriterBridge, buildItemIdMap, getManifestsDir } =
    await import("@hyperforge/web3");

  // Build item ID mapping from manifests
  console.log("[Web3] Building item ID mapping...");
  const manifestsDir = getManifestsDir();
  const mapping = await buildItemIdMap(manifestsDir);
  console.log(
    `[Web3] Item mapping: ${mapping.baseItemCount} base items, ${mapping.totalItemCount} total`,
  );

  // Create and initialize ChainWriter
  const chainWriter = new ChainWriter();
  await chainWriter.initialize();

  // Create bridge and attach to world events
  const bridge = new ChainWriterBridge(chainWriter, mapping.stringToNumeric);
  bridge.attachToWorld(
    world as {
      on: (event: string, handler: (payload: object) => void) => void;
    },
  );

  console.log("[Web3] ✅ Web3 mode initialized");

  return {
    shutdown: async () => {
      console.log("[Web3] Shutting down chain writer...");
      await bridge.shutdown();
      console.log("[Web3] ✅ Chain writer shut down");
    },
    getStats: () => bridge.getChainWriter().getStats(),
    registerPlayerWallet: (playerId: string, walletAddress: string) => {
      bridge.registerPlayerWallet(playerId, walletAddress as `0x${string}`);
    },
  };
}
