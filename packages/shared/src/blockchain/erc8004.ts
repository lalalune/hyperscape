/**
 * ERC-8004 Identity Registry Integration for Hyperscape
 *
 * Integrates with Jeju's IdentityRegistry and BanManager contracts for:
 * - Player identity verification
 * - Ban checking (network-wide and game-specific)
 * - Reputation tier queries
 * - Agent metadata access
 *
 * IMPORTANT: This module uses fail-fast error handling.
 * Errors are thrown, not silently swallowed.
 */

import {
  createPublicClient,
  http,
  keccak256,
  toBytes,
  type Address,
  type Abi,
} from "viem";
import { getChain, getOptionalAddress, type JejuNetwork } from "./chain";

// ============ Contract ABIs ============
// Declared without as const to avoid viem 2.x type inference issues

const IDENTITY_REGISTRY_ABI: Abi = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "agentId" },
          { type: "address", name: "owner" },
          { type: "uint8", name: "tier" },
          { type: "address", name: "stakedToken" },
          { type: "uint256", name: "stakedAmount" },
          { type: "uint256", name: "registeredAt" },
          { type: "uint256", name: "lastActivityAt" },
          { type: "bool", name: "isBanned" },
          { type: "bool", name: "isSlashed" },
        ],
      },
    ],
  },
  {
    name: "getA2AEndpoint",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "getMCPEndpoint",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "getMarketplaceInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [
      { type: "string", name: "a2aEndpoint" },
      { type: "string", name: "mcpEndpoint" },
      { type: "string", name: "serviceType" },
      { type: "string", name: "category" },
      { type: "bool", name: "x402Supported" },
      { type: "uint8", name: "tier" },
      { type: "bool", name: "banned" },
    ],
  },
  {
    name: "agentExists",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "totalAgents",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getMetadata",
    type: "function",
    stateMutability: "view",
    inputs: [
      { type: "uint256", name: "agentId" },
      { type: "string", name: "key" },
    ],
    outputs: [{ type: "bytes" }],
  },
];

const BAN_MANAGER_ABI: Abi = [
  {
    name: "isNetworkBanned",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isAppBanned",
    type: "function",
    stateMutability: "view",
    inputs: [
      { type: "uint256", name: "agentId" },
      { type: "bytes32", name: "appId" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isAccessAllowed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { type: "uint256", name: "agentId" },
      { type: "bytes32", name: "appId" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getNetworkBan",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "bool", name: "isBanned" },
          { type: "uint256", name: "bannedAt" },
          { type: "string", name: "reason" },
          { type: "bytes32", name: "proposalId" },
        ],
      },
    ],
  },
  {
    name: "getBanReason",
    type: "function",
    stateMutability: "view",
    inputs: [
      { type: "uint256", name: "agentId" },
      { type: "bytes32", name: "appId" },
    ],
    outputs: [{ type: "string" }],
  },
  {
    name: "isAddressBanned",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address", name: "target" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isAddressAccessAllowed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "target" },
      { type: "bytes32", name: "appId" },
    ],
    outputs: [{ type: "bool" }],
  },
];

// ============ Types ============

export enum StakeTier {
  NONE = 0,
  SMALL = 1,
  MEDIUM = 2,
  HIGH = 3,
}

export interface AgentRegistration {
  agentId: bigint;
  owner: Address;
  tier: StakeTier;
  stakedToken: Address;
  stakedAmount: bigint;
  registeredAt: bigint;
  lastActivityAt: bigint;
  isBanned: boolean;
  isSlashed: boolean;
}

export interface BanRecord {
  isBanned: boolean;
  bannedAt: bigint;
  reason: string;
  proposalId: `0x${string}`;
}

export interface MarketplaceInfo {
  a2aEndpoint: string;
  mcpEndpoint: string;
  serviceType: string;
  category: string;
  x402Supported: boolean;
  tier: StakeTier;
  banned: boolean;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  banType?: "network" | "app" | "address";
}

// ============ Client Singleton ============

// Simple client interface to avoid viem 2.x deep type instantiation
interface SimplePublicClient {
  readContract(params: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly (bigint | string | `0x${string}`)[];
  }): Promise<unknown>;
}

let publicClient: SimplePublicClient | null = null;

function getClient(network?: JejuNetwork): SimplePublicClient {
  if (!publicClient) {
    const chain = getChain(network);
    publicClient = createPublicClient({
      chain,
      transport: http(),
    }) as SimplePublicClient;
  }
  return publicClient;
}

/**
 * Reset client (useful for testing or network switching)
 */
export function resetClient(): void {
  publicClient = null;
}

// ============ Address Resolution ============

function getIdentityRegistryAddress(): Address {
  const address = getOptionalAddress("IDENTITY_REGISTRY_ADDRESS");
  if (!address) {
    throw new Error(
      "IDENTITY_REGISTRY_ADDRESS not configured. Set the environment variable to enable ERC-8004 integration.",
    );
  }
  return address;
}

function getBanManagerAddress(): Address {
  const address = getOptionalAddress("BAN_MANAGER_ADDRESS");
  if (!address) {
    throw new Error(
      "BAN_MANAGER_ADDRESS not configured. Set the environment variable to enable ban checking.",
    );
  }
  return address;
}

// ============ Contract Read Helper ============
// Wraps readContract to handle type assertions

async function readIdentityRegistry<T>(
  functionName: string,
  args: readonly (bigint | string)[],
): Promise<T> {
  const client = getClient();
  const address = getIdentityRegistryAddress();
  const result = await client.readContract({
    address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName,
    args: args as readonly (bigint | string | `0x${string}`)[],
  });
  return result as T;
}

async function readBanManager<T>(
  functionName: string,
  args: readonly (bigint | string | `0x${string}`)[],
): Promise<T> {
  const client = getClient();
  const address = getBanManagerAddress();
  const result = await client.readContract({
    address,
    abi: BAN_MANAGER_ABI,
    functionName,
    args,
  });
  return result as T;
}

async function readBanManagerWithAddress<T>(
  contractAddress: Address,
  functionName: string,
  args: readonly (bigint | string | `0x${string}`)[],
): Promise<T> {
  const client = getClient();
  const result = await client.readContract({
    address: contractAddress,
    abi: BAN_MANAGER_ABI,
    functionName,
    args,
  });
  return result as T;
}

// ============ Agent Queries ============

/**
 * Check if an agent exists in the registry
 */
export async function agentExists(agentId: bigint): Promise<boolean> {
  return readIdentityRegistry<boolean>("agentExists", [agentId]);
}

/**
 * Get agent registration details
 */
export async function getAgent(agentId: bigint): Promise<AgentRegistration> {
  type AgentTuple = {
    agentId: bigint;
    owner: Address;
    tier: number;
    stakedToken: Address;
    stakedAmount: bigint;
    registeredAt: bigint;
    lastActivityAt: bigint;
    isBanned: boolean;
    isSlashed: boolean;
  };

  const result = await readIdentityRegistry<AgentTuple>("getAgent", [agentId]);

  return {
    agentId: result.agentId,
    owner: result.owner,
    tier: result.tier as StakeTier,
    stakedToken: result.stakedToken,
    stakedAmount: result.stakedAmount,
    registeredAt: result.registeredAt,
    lastActivityAt: result.lastActivityAt,
    isBanned: result.isBanned,
    isSlashed: result.isSlashed,
  };
}

/**
 * Get agent owner address
 */
export async function getAgentOwner(agentId: bigint): Promise<Address> {
  return readIdentityRegistry<Address>("ownerOf", [agentId]);
}

/**
 * Get marketplace info for an agent
 */
export async function getMarketplaceInfo(
  agentId: bigint,
): Promise<MarketplaceInfo> {
  type InfoTuple = [string, string, string, string, boolean, number, boolean];
  const result = await readIdentityRegistry<InfoTuple>("getMarketplaceInfo", [
    agentId,
  ]);

  return {
    a2aEndpoint: result[0],
    mcpEndpoint: result[1],
    serviceType: result[2],
    category: result[3],
    x402Supported: result[4],
    tier: result[5] as StakeTier,
    banned: result[6],
  };
}

/**
 * Get agent metadata by key
 */
export async function getAgentMetadata(
  agentId: bigint,
  key: string,
): Promise<`0x${string}`> {
  return readIdentityRegistry<`0x${string}`>("getMetadata", [agentId, key]);
}

// ============ Ban Checking ============

/**
 * Check if agent is banned from the entire network
 */
export async function isNetworkBanned(agentId: bigint): Promise<boolean> {
  return readBanManager<boolean>("isNetworkBanned", [agentId]);
}

/**
 * Check if agent is banned from a specific app
 */
export async function isAppBanned(
  agentId: bigint,
  appId: `0x${string}`,
): Promise<boolean> {
  return readBanManager<boolean>("isAppBanned", [agentId, appId]);
}

/**
 * Check if agent has access to a specific app (not network or app banned)
 */
export async function isAccessAllowed(
  agentId: bigint,
  appId: `0x${string}`,
): Promise<boolean> {
  return readBanManager<boolean>("isAccessAllowed", [agentId, appId]);
}

/**
 * Get network ban details
 */
export async function getNetworkBan(agentId: bigint): Promise<BanRecord> {
  type BanTuple = {
    isBanned: boolean;
    bannedAt: bigint;
    reason: string;
    proposalId: `0x${string}`;
  };

  const result = await readBanManager<BanTuple>("getNetworkBan", [agentId]);

  return {
    isBanned: result.isBanned,
    bannedAt: result.bannedAt,
    reason: result.reason,
    proposalId: result.proposalId,
  };
}

/**
 * Get ban reason (network or app)
 */
export async function getBanReason(
  agentId: bigint,
  appId: `0x${string}` = "0x0000000000000000000000000000000000000000000000000000000000000000",
): Promise<string> {
  return readBanManager<string>("getBanReason", [agentId, appId]);
}

/**
 * Check if an address is banned (direct address ban)
 */
export async function isAddressBanned(target: Address): Promise<boolean> {
  return readBanManager<boolean>("isAddressBanned", [target]);
}

// ============ High-Level Access Control ============

/**
 * Check player access for Hyperscape game
 *
 * Performs comprehensive access check:
 * 1. Check direct address ban
 * 2. If player has agent ID, check network ban
 * 3. If player has agent ID, check Hyperscape-specific app ban
 *
 * @param playerAddress - Player's wallet address
 * @param playerAgentId - Optional agent ID (if registered)
 * @param appId - App ID for Hyperscape (keccak256 of "hyperscape"))
 */
export async function checkPlayerAccess(
  playerAddress: Address,
  playerAgentId?: bigint,
  appId: `0x${string}` = "0xc54b8b0f8e2f7d3f5c0b8d9b7e4a1f0e3d6c9b8a7f6e5d4c3b2a1908070605040",
): Promise<AccessCheckResult> {
  const banManagerAddress = getOptionalAddress("BAN_MANAGER_ADDRESS");

  if (!banManagerAddress) {
    return { allowed: true };
  }

  // Check direct address ban
  const addressBanned = await readBanManagerWithAddress<boolean>(
    banManagerAddress,
    "isAddressBanned",
    [playerAddress],
  );

  if (addressBanned) {
    return {
      allowed: false,
      reason: "Address is banned from the network",
      banType: "address",
    };
  }

  // If no agent ID, player is allowed (not registered yet)
  if (!playerAgentId) {
    return { allowed: true };
  }

  // Check network ban
  const networkBanned = await readBanManagerWithAddress<boolean>(
    banManagerAddress,
    "isNetworkBanned",
    [playerAgentId],
  );

  if (networkBanned) {
    const ban = await getNetworkBan(playerAgentId);
    return {
      allowed: false,
      reason: ban.reason || "Banned from network",
      banType: "network",
    };
  }

  // Check app-specific ban
  const appAllowed = await readBanManagerWithAddress<boolean>(
    banManagerAddress,
    "isAccessAllowed",
    [playerAgentId, appId],
  );

  if (!appAllowed) {
    const reason = await getBanReason(playerAgentId, appId);
    return {
      allowed: false,
      reason: reason || "Banned from this game",
      banType: "app",
    };
  }

  return { allowed: true };
}

/**
 * Require player access - throws if banned
 */
export async function requirePlayerAccess(
  playerAddress: Address,
  playerAgentId?: bigint,
  appId?: `0x${string}`,
): Promise<void> {
  const result = await checkPlayerAccess(playerAddress, playerAgentId, appId);
  if (!result.allowed) {
    throw new Error(`Access denied: ${result.reason}`);
  }
}

// ============ Utility Functions ============

/**
 * Generate app ID from app name
 */
export function generateAppId(appName: string): `0x${string}` {
  return keccak256(toBytes(appName));
}

/**
 * Hyperscape app ID constant
 */
export const HYPERSCAPE_APP_ID = generateAppId("hyperscape");
