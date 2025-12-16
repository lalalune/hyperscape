/**
 * Multicoin Paymaster Integration for Hyperscape
 *
 * Enables gasless transactions for players by paying gas fees with:
 * - ETH
 * - Game tokens (Gold)
 * - Stablecoins (USDC, USDT)
 * - Other supported ERC-20 tokens
 *
 * Uses Jeju's LiquidityPaymaster system.
 */

import {
  createPublicClient,
  http,
  parseAbi,
  encodePacked,
  type Address,
} from "viem";
import { getChain, getOptionalAddress, type JejuNetwork } from "./chain";

// ============ Contract ABIs ============

const PAYMASTER_FACTORY_ABI = parseAbi([
  "function getAllPaymasters() view returns (address[])",
  "function getPaymasterByToken(address token) view returns (address)",
  "function paymasterStake(address paymaster) view returns (uint256)",
  "function isPaymasterActive(address paymaster) view returns (bool)",
]);

const LIQUIDITY_PAYMASTER_ABI = parseAbi([
  "function token() view returns (address)",
  "function oracle() view returns (address)",
  "function getTokenBalance(address user) view returns (uint256)",
  "function estimateGasCost(uint256 gasLimit) view returns (uint256)",
  "function version() view returns (string)",
]);

// ============ Types ============

export interface PaymasterInfo {
  address: Address;
  token: Address;
  stake: bigint;
  active: boolean;
}

export interface GasEstimate {
  gasLimit: bigint;
  tokenCost: bigint;
  token: Address;
}

export interface PaymasterData {
  paymaster: Address;
  verificationGasLimit: bigint;
  postOpGasLimit: bigint;
}

// ============ Constants ============

const MIN_STAKE_THRESHOLD = BigInt(10) * BigInt(10 ** 18); // 10 tokens
const DEFAULT_VERIFICATION_GAS = BigInt(100000);
const DEFAULT_POST_OP_GAS = BigInt(50000);

// ============ Client ============

// Simple client interface to avoid viem 2.x deep type instantiation
interface SimplePublicClient {
  readContract(params: {
    address: Address;
    abi: readonly { name: string; type: string; inputs?: readonly { type: string; name: string }[]; outputs?: readonly { type: string }[]; stateMutability?: string }[];
    functionName: string;
    args?: readonly (bigint | string | Address)[];
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

function getPaymasterFactoryAddress(): Address {
  const address = getOptionalAddress("PAYMASTER_FACTORY_ADDRESS");
  if (!address) {
    throw new Error(
      "PAYMASTER_FACTORY_ADDRESS not configured. Set the environment variable to enable gasless transactions.",
    );
  }
  return address;
}

// ============ Paymaster Discovery ============

/**
 * Get all available paymasters with sufficient stake
 */
export async function getAvailablePaymasters(
  minStake: bigint = MIN_STAKE_THRESHOLD,
): Promise<PaymasterInfo[]> {
  const client = getClient();
  const factoryAddress = getPaymasterFactoryAddress();

  
  const paymasters = (await client.readContract({
    address: factoryAddress,
    abi: PAYMASTER_FACTORY_ABI,
    functionName: "getAllPaymasters",
  })) as Address[];

  const paymasterDetails = await Promise.all(
    paymasters.map(async (paymasterAddr): Promise<PaymasterInfo | null> => {
      
      const tokenPromise = client.readContract({
        address: paymasterAddr,
        abi: LIQUIDITY_PAYMASTER_ABI,
        functionName: "token",
      }) as Promise<Address>;
      
      const stakePromise = client.readContract({
        address: factoryAddress,
        abi: PAYMASTER_FACTORY_ABI,
        functionName: "paymasterStake",
        args: [paymasterAddr],
      }) as Promise<bigint>;
      
      const activePromise = client.readContract({
        address: factoryAddress,
        abi: PAYMASTER_FACTORY_ABI,
        functionName: "isPaymasterActive",
        args: [paymasterAddr],
      }).catch((error) => {
        // If we can't check if paymaster is active, assume inactive for safety
        // This prevents using potentially inactive paymasters
        console.warn(
          `[Paymaster] Failed to check if paymaster ${paymasterAddr} is active:`,
          error,
        );
        return false; // Fail closed: assume inactive if check fails
      }) as Promise<boolean>;
      const [token, stake, active] = await Promise.all([
        tokenPromise,
        stakePromise,
        activePromise,
      ]);

      if (stake < minStake || !active) {
        return null;
      }

      return {
        address: paymasterAddr,
        token,
        stake,
        active,
      };
    }),
  );

  return paymasterDetails.filter((pm): pm is PaymasterInfo => pm !== null);
}

/**
 * Get paymaster for a specific token
 */
export async function getPaymasterForToken(
  tokenAddress: Address,
): Promise<PaymasterInfo | null> {
  const client = getClient();
  const factoryAddress = getPaymasterFactoryAddress();

  
  const paymaster = (await client.readContract({
    address: factoryAddress,
    abi: PAYMASTER_FACTORY_ABI,
    functionName: "getPaymasterByToken",
    args: [tokenAddress],
  })) as Address;

  if (paymaster === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  
  const stakePromise = client.readContract({
    address: factoryAddress,
    abi: PAYMASTER_FACTORY_ABI,
    functionName: "paymasterStake",
    args: [paymaster],
  }) as Promise<bigint>;
  
  const activePromise = client.readContract({
    address: factoryAddress,
    abi: PAYMASTER_FACTORY_ABI,
    functionName: "isPaymasterActive",
    args: [paymaster],
  }).catch((error) => {
    // If we can't check if paymaster is active, assume inactive for safety
    // This prevents using potentially inactive paymasters
    console.warn(
      `[Paymaster] Failed to check if paymaster ${paymaster} is active:`,
      error,
    );
    return false; // Fail closed: assume inactive if check fails
  }) as Promise<boolean>;
  const [stake, active] = await Promise.all([stakePromise, activePromise]);

  if (stake < MIN_STAKE_THRESHOLD || !active) {
    return null;
  }

  return {
    address: paymaster,
    token: tokenAddress,
    stake,
    active,
  };
}

/**
 * Find best paymaster for user based on their token balances
 */
export async function findBestPaymaster(
  userAddress: Address,
  preferredTokens?: Address[],
): Promise<PaymasterInfo | null> {
  const client = getClient();
  const available = await getAvailablePaymasters();

  if (available.length === 0) {
    return null;
  }

  // If preferred tokens specified, try those first
  if (preferredTokens && preferredTokens.length > 0) {
    for (const token of preferredTokens) {
      const match = available.find(
        (pm) => pm.token.toLowerCase() === token.toLowerCase(),
      );
      if (match) {
        
        const balance = (await client.readContract({
          address: match.address,
          abi: LIQUIDITY_PAYMASTER_ABI,
          functionName: "getTokenBalance",
          args: [userAddress],
        })) as bigint;

        if (balance > 0) {
          return match;
        }
      }
    }
  }

  // Otherwise find any paymaster where user has balance
  for (const pm of available) {
    
    const balanceResult = client.readContract({
      address: pm.address,
      abi: LIQUIDITY_PAYMASTER_ABI,
      functionName: "getTokenBalance",
      args: [userAddress],
    });
    const balance = (await balanceResult.catch((error) => {
      // If we can't get balance, assume 0 (no balance) for safety
      // This prevents using paymasters we can't verify balance for
      console.warn(
        `[Paymaster] Failed to get token balance for ${userAddress} on paymaster ${pm.address}:`,
        error,
      );
      return BigInt(0);
    })) as bigint;

    if (balance > 0) {
      return pm;
    }
  }

  return null;
}

// ============ Gas Estimation ============

/**
 * Estimate gas cost in token terms
 */
export async function estimateGasCost(
  paymasterAddress: Address,
  gasLimit: bigint,
): Promise<GasEstimate> {
  const client = getClient();

  
  const tokenCostPromise = client.readContract({
    address: paymasterAddress,
    abi: LIQUIDITY_PAYMASTER_ABI,
    functionName: "estimateGasCost",
    args: [gasLimit],
  }) as Promise<bigint>;
  
  const tokenPromise = client.readContract({
    address: paymasterAddress,
    abi: LIQUIDITY_PAYMASTER_ABI,
    functionName: "token",
  }) as Promise<Address>;
  const [tokenCost, token] = await Promise.all([tokenCostPromise, tokenPromise]);

  return {
    gasLimit,
    tokenCost,
    token,
  };
}

// ============ UserOperation Helpers ============

/**
 * Generate paymaster data for ERC-4337 UserOperation
 */
export function generatePaymasterData(
  paymasterAddress: Address,
  verificationGasLimit: bigint = DEFAULT_VERIFICATION_GAS,
  postOpGasLimit: bigint = DEFAULT_POST_OP_GAS,
): `0x${string}` {
  return encodePacked(
    ["address", "uint128", "uint128"],
    [paymasterAddress, verificationGasLimit, postOpGasLimit],
  );
}

/**
 * Create paymaster configuration for UserOperation
 */
export async function createPaymasterConfig(
  userAddress: Address,
  preferredTokens?: Address[],
): Promise<PaymasterData | null> {
  const paymaster = await findBestPaymaster(userAddress, preferredTokens);

  if (!paymaster) {
    return null;
  }

  return {
    paymaster: paymaster.address,
    verificationGasLimit: DEFAULT_VERIFICATION_GAS,
    postOpGasLimit: DEFAULT_POST_OP_GAS,
  };
}

// ============ Utility Functions ============

/**
 * Check if gasless transactions are available for user
 */
export async function isGaslessAvailable(
  userAddress: Address,
): Promise<boolean> {
  const paymaster = await findBestPaymaster(userAddress);
  return paymaster !== null;
}

/**
 * Get paymaster version
 */
export async function getPaymasterVersion(
  paymasterAddress: Address,
): Promise<string> {
  const client = getClient();

  
  const version = await client.readContract({
    address: paymasterAddress,
    abi: LIQUIDITY_PAYMASTER_ABI,
    functionName: "version",
  });

  return version as string;
}

// ============ Service Export ============

export const paymasterService = {
  getAvailablePaymasters,
  getPaymasterForToken,
  findBestPaymaster,
  estimateGasCost,
  generatePaymasterData,
  createPaymasterConfig,
  isGaslessAvailable,
  getPaymasterVersion,
};
