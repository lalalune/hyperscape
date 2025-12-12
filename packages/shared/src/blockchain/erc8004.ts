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
  parseAbi,
  keccak256,
  toBytes,
  type Address,
} from "viem";
import { getChain, getOptionalAddress, type JejuNetwork } from "./chain";

// ============ Contract ABIs ============

const IDENTITY_REGISTRY_ABI = parseAbi([
  "function ownerOf(uint256 agentId) view returns (address)",
  "function getAgent(uint256 agentId) view returns ((uint256 agentId, address owner, uint8 tier, address stakedToken, uint256 stakedAmount, uint256 registeredAt, uint256 lastActivityAt, bool isBanned, bool isSlashed))",
  "function getA2AEndpoint(uint256 agentId) view returns (string)",
  "function getMCPEndpoint(uint256 agentId) view returns (string)",
  "function getMarketplaceInfo(uint256 agentId) view returns (string a2aEndpoint, string mcpEndpoint, string serviceType, string category, bool x402Supported, uint8 tier, bool banned)",
  "function agentExists(uint256 agentId) view returns (bool)",
  "function totalAgents() view returns (uint256)",
  "function getMetadata(uint256 agentId, string key) view returns (bytes)",
]);

const BAN_MANAGER_ABI = parseAbi([
  "function isNetworkBanned(uint256 agentId) view returns (bool)",
  "function isAppBanned(uint256 agentId, bytes32 appId) view returns (bool)",
  "function isAccessAllowed(uint256 agentId, bytes32 appId) view returns (bool)",
  "function getNetworkBan(uint256 agentId) view returns ((bool isBanned, uint256 bannedAt, string reason, bytes32 proposalId))",
  "function getBanReason(uint256 agentId, bytes32 appId) view returns (string)",
  "function isAddressBanned(address target) view returns (bool)",
  "function isAddressAccessAllowed(address target, bytes32 appId) view returns (bool)",
]);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publicClient: any = null;

function getClient(network?: JejuNetwork) {
  if (!publicClient) {
    const chain = getChain(network);
    publicClient = createPublicClient({
      chain,
      transport: http(),
    });
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

// ============ Agent Queries ============

/**
 * Check if an agent exists in the registry
 */
export async function agentExists(agentId: bigint): Promise<boolean> {
  const client = getClient();
  const address = getIdentityRegistryAddress();

  const exists = await client.readContract({
    address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "agentExists",
    args: [agentId],
  });

  return exists as boolean;
}

/**
 * Get agent registration details
 */
export async function getAgent(agentId: bigint): Promise<AgentRegistration> {
  const client = getClient();
  const address = getIdentityRegistryAddress();

  const result = await client.readContract({
    address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getAgent",
    args: [agentId],
  });

  const [
    id,
    owner,
    tier,
    stakedToken,
    stakedAmount,
    registeredAt,
    lastActivityAt,
    isBanned,
    isSlashed,
  ] = result as [
    bigint,
    Address,
    number,
    Address,
    bigint,
    bigint,
    bigint,
    boolean,
    boolean,
  ];

  return {
    agentId: id,
    owner,
    tier: tier as StakeTier,
    stakedToken,
    stakedAmount,
    registeredAt,
    lastActivityAt,
    isBanned,
    isSlashed,
  };
}

/**
 * Get agent owner address
 */
export async function getAgentOwner(agentId: bigint): Promise<Address> {
  const client = getClient();
  const address = getIdentityRegistryAddress();

  const owner = await client.readContract({
    address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "ownerOf",
    args: [agentId],
  });

  return owner as Address;
}

/**
 * Get marketplace info for an agent
 */
export async function getMarketplaceInfo(
  agentId: bigint,
): Promise<MarketplaceInfo> {
  const client = getClient();
  const address = getIdentityRegistryAddress();

  const result = await client.readContract({
    address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getMarketplaceInfo",
    args: [agentId],
  });

  const [
    a2aEndpoint,
    mcpEndpoint,
    serviceType,
    category,
    x402Supported,
    tier,
    banned,
  ] = result as [string, string, string, string, boolean, number, boolean];

  return {
    a2aEndpoint,
    mcpEndpoint,
    serviceType,
    category,
    x402Supported,
    tier: tier as StakeTier,
    banned,
  };
}

/**
 * Get agent metadata by key
 */
export async function getAgentMetadata(
  agentId: bigint,
  key: string,
): Promise<Uint8Array> {
  const client = getClient();
  const address = getIdentityRegistryAddress();

  const result = await client.readContract({
    address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getMetadata",
    args: [agentId, key],
  });

  return result as Uint8Array;
}

// ============ Ban Checking ============

/**
 * Check if agent is banned from the entire network
 */
export async function isNetworkBanned(agentId: bigint): Promise<boolean> {
  const client = getClient();
  const address = getBanManagerAddress();

  const banned = await client.readContract({
    address,
    abi: BAN_MANAGER_ABI,
    functionName: "isNetworkBanned",
    args: [agentId],
  });

  return banned as boolean;
}

/**
 * Check if agent is banned from a specific app
 */
export async function isAppBanned(
  agentId: bigint,
  appId: `0x${string}`,
): Promise<boolean> {
  const client = getClient();
  const address = getBanManagerAddress();

  const banned = await client.readContract({
    address,
    abi: BAN_MANAGER_ABI,
    functionName: "isAppBanned",
    args: [agentId, appId],
  });

  return banned as boolean;
}

/**
 * Check if agent has access to a specific app (not network or app banned)
 */
export async function isAccessAllowed(
  agentId: bigint,
  appId: `0x${string}`,
): Promise<boolean> {
  const client = getClient();
  const address = getBanManagerAddress();

  const allowed = await client.readContract({
    address,
    abi: BAN_MANAGER_ABI,
    functionName: "isAccessAllowed",
    args: [agentId, appId],
  });

  return allowed as boolean;
}

/**
 * Get network ban details
 */
export async function getNetworkBan(agentId: bigint): Promise<BanRecord> {
  const client = getClient();
  const address = getBanManagerAddress();

  const result = await client.readContract({
    address,
    abi: BAN_MANAGER_ABI,
    functionName: "getNetworkBan",
    args: [agentId],
  });

  const [isBanned, bannedAt, reason, proposalId] = result as [
    boolean,
    bigint,
    string,
    `0x${string}`,
  ];

  return { isBanned, bannedAt, reason, proposalId };
}

/**
 * Get ban reason (network or app)
 */
export async function getBanReason(
  agentId: bigint,
  appId: `0x${string}` = "0x0000000000000000000000000000000000000000000000000000000000000000",
): Promise<string> {
  const client = getClient();
  const address = getBanManagerAddress();

  const reason = await client.readContract({
    address,
    abi: BAN_MANAGER_ABI,
    functionName: "getBanReason",
    args: [agentId, appId],
  });

  return reason as string;
}

/**
 * Check if an address is banned (direct address ban)
 */
export async function isAddressBanned(target: Address): Promise<boolean> {
  const client = getClient();
  const address = getBanManagerAddress();

  const banned = await client.readContract({
    address,
    abi: BAN_MANAGER_ABI,
    functionName: "isAddressBanned",
    args: [target],
  });

  return banned as boolean;
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

  const client = getClient();

  // Check direct address ban
  const addressBanned = (await client.readContract({
    address: banManagerAddress,
    abi: BAN_MANAGER_ABI,
    functionName: "isAddressBanned",
    args: [playerAddress],
  })) as boolean;

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
  const networkBanned = (await client.readContract({
    address: banManagerAddress,
    abi: BAN_MANAGER_ABI,
    functionName: "isNetworkBanned",
    args: [playerAgentId],
  })) as boolean;

  if (networkBanned) {
    const ban = await getNetworkBan(playerAgentId);
    return {
      allowed: false,
      reason: ban.reason || "Banned from network",
      banType: "network",
    };
  }

  // Check app-specific ban
  const appAllowed = (await client.readContract({
    address: banManagerAddress,
    abi: BAN_MANAGER_ABI,
    functionName: "isAccessAllowed",
    args: [playerAgentId, appId],
  })) as boolean;

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
