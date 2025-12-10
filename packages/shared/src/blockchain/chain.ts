/**
 * Jeju Chain Configuration
 * 
 * Network configuration for Jeju L3 and related chains.
 * Supports localnet, testnet, and mainnet environments.
 */

import { type Chain, type Address } from "viem";

// ============ Network Types ============

export type JejuNetwork = "jeju" | "jeju-testnet" | "jeju-mainnet" | "anvil";

// ============ Chain Definitions ============

export const JEJU_LOCALNET: Chain = {
  id: 420691,
  name: "Jeju Localnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.JEJU_RPC_URL || "http://127.0.0.1:9545"] },
  },
  testnet: true,
};

export const JEJU_TESTNET: Chain = {
  id: 420690,
  name: "Jeju Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.JEJU_TESTNET_RPC_URL || "https://testnet-rpc.jeju.network"] },
  },
  blockExplorers: {
    default: { name: "Jeju Explorer", url: "https://testnet-explorer.jeju.network" },
  },
  testnet: true,
};

export const JEJU_MAINNET: Chain = {
  id: 420692,
  name: "Jeju Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.JEJU_MAINNET_RPC_URL || "https://rpc.jeju.network"] },
  },
  blockExplorers: {
    default: { name: "Jeju Explorer", url: "https://explorer.jeju.network" },
  },
};

export const ANVIL_CHAIN: Chain = {
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545"] },
  },
  testnet: true,
};

// ============ Chain Registry ============

export const CHAINS: Record<JejuNetwork, Chain> = {
  jeju: JEJU_LOCALNET,
  "jeju-testnet": JEJU_TESTNET,
  "jeju-mainnet": JEJU_MAINNET,
  anvil: ANVIL_CHAIN,
};

export const CHAIN_IDS: Record<JejuNetwork, number> = {
  jeju: 420691,
  "jeju-testnet": 420690,
  "jeju-mainnet": 420692,
  anvil: 31337,
};

// ============ Contract Addresses ============

export interface ContractAddresses {
  identityRegistry: Address;
  banManager: Address;
  x402Facilitator: Address;
  paymasterFactory: Address;
  gold: Address;
  items: Address;
  bazaar: Address;
  gameIntegration: Address;
  worldAddress: Address;
}

/**
 * Get contract addresses from environment variables
 * Fails fast if required addresses are missing
 */
export function getContractAddresses(): ContractAddresses {
  return {
    identityRegistry: requireAddress("IDENTITY_REGISTRY_ADDRESS"),
    banManager: requireAddress("BAN_MANAGER_ADDRESS"),
    x402Facilitator: requireAddress("X402_FACILITATOR_ADDRESS"),
    paymasterFactory: requireAddress("PAYMASTER_FACTORY_ADDRESS"),
    gold: requireAddress("GOLD_ADDRESS"),
    items: requireAddress("ITEMS_ADDRESS"),
    bazaar: requireAddress("BAZAAR_ADDRESS"),
    gameIntegration: requireAddress("GAME_INTEGRATION_ADDRESS"),
    worldAddress: requireAddress("WORLD_ADDRESS"),
  };
}

/**
 * Get optional contract address (returns null if not set)
 */
export function getOptionalAddress(envVar: string): Address | null {
  const value = process.env[envVar];
  if (!value || value === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return value as Address;
}

function requireAddress(envVar: string): Address {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
  if (value === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Invalid zero address for ${envVar}`);
  }
  return value as Address;
}

// ============ Network Detection ============

/**
 * Detect current network from environment or RPC
 */
export function detectNetwork(): JejuNetwork {
  const envNetwork = process.env.JEJU_NETWORK as JejuNetwork | undefined;
  if (envNetwork && CHAINS[envNetwork]) {
    return envNetwork;
  }

  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : null;
  if (chainId) {
    for (const [network, id] of Object.entries(CHAIN_IDS)) {
      if (id === chainId) {
        return network as JejuNetwork;
      }
    }
  }

  return "jeju";
}

/**
 * Get chain configuration for current network
 */
export function getChain(network?: JejuNetwork): Chain {
  const net = network || detectNetwork();
  return CHAINS[net];
}

/**
 * Get RPC URL for a network
 */
export function getRpcUrl(network?: JejuNetwork): string {
  const chain = getChain(network);
  return chain.rpcUrls.default.http[0];
}

// ============ Validation ============

/**
 * Check if blockchain integration is properly configured
 */
export function isBlockchainConfigured(): boolean {
  const required = [
    "IDENTITY_REGISTRY_ADDRESS",
    "BAN_MANAGER_ADDRESS",
    "WORLD_ADDRESS",
  ];
  return required.every(
    (env) =>
      process.env[env] &&
      process.env[env] !== "0x0000000000000000000000000000000000000000"
  );
}

/**
 * Get configuration status for diagnostics
 */
export function getConfigurationStatus(): Record<string, { configured: boolean; address: string | null }> {
  const envVars = [
    "IDENTITY_REGISTRY_ADDRESS",
    "BAN_MANAGER_ADDRESS",
    "X402_FACILITATOR_ADDRESS",
    "PAYMASTER_FACTORY_ADDRESS",
    "GOLD_ADDRESS",
    "ITEMS_ADDRESS",
    "BAZAAR_ADDRESS",
    "GAME_INTEGRATION_ADDRESS",
    "WORLD_ADDRESS",
  ];

  const status: Record<string, { configured: boolean; address: string | null }> = {};
  for (const envVar of envVars) {
    const value = process.env[envVar];
    const isConfigured = !!value && value !== "0x0000000000000000000000000000000000000000";
    status[envVar] = {
      configured: isConfigured,
      address: isConfigured ? value! : null,
    };
  }
  return status;
}

