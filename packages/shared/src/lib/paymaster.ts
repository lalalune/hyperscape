/**
 * Multicoin Paymaster Integration for Hyperscape
 * Supports gas payments for in-game transactions
 */

import { Address, createPublicClient, http, parseAbi, encodePacked } from 'viem';

const JEJU_CHAIN = {
  id: 1337,
  name: 'Jeju L3',
  network: 'jeju',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:9545'] },
    public: { http: ['http://127.0.0.1:9545'] },
  },
};

const PAYMASTER_FACTORY_ABI = parseAbi([
  'function getAllPaymasters() external view returns (address[] memory)',
  'function getPaymasterByToken(address token) external view returns (address)',
  'function paymasterStake(address paymaster) external view returns (uint256)',
]);

const PAYMASTER_ABI = parseAbi([
  'function token() external view returns (address)',
]);

const PAYMASTER_FACTORY_ADDRESS = (process.env.PAYMASTER_FACTORY_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as Address;

const MIN_STAKE_THRESHOLD = BigInt(10) * BigInt(10 ** 18);

export interface PaymasterInfo {
  address: Address;
  token: Address;
  stake: bigint;
  available: boolean;
}

function getPublicClient() {
  return createPublicClient({
    chain: JEJU_CHAIN,
    transport: http(),
  });
}

export async function getAvailablePaymasters(minStake: bigint = MIN_STAKE_THRESHOLD): Promise<PaymasterInfo[]> {
  if (PAYMASTER_FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return [];
  }

  try {
    const client = getPublicClient();
    
    const paymasters = await client.readContract({
      address: PAYMASTER_FACTORY_ADDRESS,
      abi: PAYMASTER_FACTORY_ABI,
      functionName: 'getAllPaymasters',
    }) as Address[];

    const paymasterDetails = await Promise.all(
      paymasters.map(async (paymasterAddr) => {
        try {
          const [token, stake] = await Promise.all([
            client.readContract({
              address: paymasterAddr,
              abi: PAYMASTER_ABI,
              functionName: 'token',
            }),
            client.readContract({
              address: PAYMASTER_FACTORY_ADDRESS,
              abi: PAYMASTER_FACTORY_ABI,
              functionName: 'paymasterStake',
              args: [paymasterAddr],
            }),
          ]);

          return {
            address: paymasterAddr,
            token: token as Address,
            stake: stake as bigint,
            available: (stake as bigint) >= minStake,
          };
        } catch {
          return null;
        }
      })
    );

    return paymasterDetails.filter((pm): pm is PaymasterInfo => pm !== null && pm.available);
  } catch {
    return [];
  }
}

export async function getPaymasterForToken(tokenAddress: Address): Promise<Address | null> {
  if (PAYMASTER_FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  try {
    const client = getPublicClient();
    
    const paymaster = await client.readContract({
      address: PAYMASTER_FACTORY_ADDRESS,
      abi: PAYMASTER_FACTORY_ABI,
      functionName: 'getPaymasterByToken',
      args: [tokenAddress],
    }) as Address;

    const stake = await client.readContract({
      address: PAYMASTER_FACTORY_ADDRESS,
      abi: PAYMASTER_FACTORY_ABI,
      functionName: 'paymasterStake',
      args: [paymaster],
    }) as bigint;

    return stake >= MIN_STAKE_THRESHOLD ? paymaster : null;
  } catch {
    return null;
  }
}

export function generatePaymasterData(
  paymasterAddress: Address,
  verificationGasLimit: bigint = BigInt(100000),
  postOpGasLimit: bigint = BigInt(50000)
): `0x${string}` {
  return encodePacked(
    ['address', 'uint128', 'uint128'],
    [paymasterAddress, BigInt(verificationGasLimit), BigInt(postOpGasLimit)]
  );
}

export const paymasterService = {
  getAvailablePaymasters,
  getPaymasterForToken,
  generatePaymasterData,
};

