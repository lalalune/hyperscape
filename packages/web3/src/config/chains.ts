import { type Chain, foundry, baseSepolia, base } from "viem/chains";

/**
 * Chain configuration for Hyperia Web3 mode.
 *
 * Three environments:
 * - Local: Anvil (chain 31337) for development
 * - Testnet: Base Sepolia (chain 84532) for staging
 * - Mainnet: Base (chain 8453) for production
 *
 * The active chain is determined by environment variables:
 * - MAINNET=true → Base Mainnet
 * - CHAIN=base-sepolia → Base Sepolia (default for start:web3)
 * - CHAIN=anvil or unset → Anvil (default for dev:web3)
 */

export interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  wsRpcUrl: string;
  worldAddress: `0x${string}`;
  indexerUrl: string;
  blockExplorerUrl: string;
}

/**
 * Resolve the active chain configuration from environment variables.
 */
export function resolveChainConfig(): ChainConfig {
  const isMainnet = process.env.MAINNET === "true";
  const chainEnv = process.env.CHAIN ?? "anvil";

  if (isMainnet) {
    return {
      chain: base,
      rpcUrl: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
      wsRpcUrl: process.env.BASE_WS_RPC_URL ?? "wss://mainnet.base.org",
      worldAddress: (process.env.WORLD_ADDRESS ?? "0x0") as `0x${string}`,
      indexerUrl: process.env.MUD_INDEXER_URL ?? "",
      blockExplorerUrl: "https://basescan.org",
    };
  }

  if (chainEnv === "base-sepolia") {
    return {
      chain: baseSepolia,
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      wsRpcUrl: process.env.BASE_SEPOLIA_WS_RPC_URL ?? "wss://sepolia.base.org",
      worldAddress: (process.env.WORLD_ADDRESS ?? "0x0") as `0x${string}`,
      indexerUrl: process.env.MUD_INDEXER_URL ?? "",
      blockExplorerUrl: "https://sepolia.basescan.org",
    };
  }

  // Default: Anvil local development
  return {
    chain: foundry,
    rpcUrl: process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545",
    wsRpcUrl: process.env.ANVIL_WS_RPC_URL ?? "ws://127.0.0.1:8545",
    worldAddress: (process.env.WORLD_ADDRESS ?? "0x0") as `0x${string}`,
    indexerUrl: process.env.MUD_INDEXER_URL ?? "http://127.0.0.1:3001",
    blockExplorerUrl: "",
  };
}

/**
 * Get a human-readable chain name for logging.
 */
export function getChainName(config: ChainConfig): string {
  switch (config.chain.id) {
    case 31337:
      return "Anvil (Local)";
    case 84532:
      return "Base Sepolia (Testnet)";
    case 8453:
      return "Base (Mainnet)";
    default:
      return `Chain ${config.chain.id}`;
  }
}
