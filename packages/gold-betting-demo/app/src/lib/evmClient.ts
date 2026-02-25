/**
 * EVM client for interacting with the GoldClob contract via viem.
 * Uses native currency (BNB/ETH/AVAX) instead of ERC20 tokens.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
  parseAbiItem,
} from "viem";
import type { EvmChainConfig } from "./chainConfig";
import { GOLD_CLOB_ABI } from "./goldClobAbi";

// ============================================================================
// Types
// ============================================================================

export type MatchStatus = "NULL" | "OPEN" | "RESOLVED";
export type Side = "NONE" | "YES" | "NO";

export type MatchMeta = {
  status: MatchStatus;
  winner: Side;
  yesPool: bigint;
  noPool: bigint;
};

export type Position = {
  yesShares: bigint;
  noShares: bigint;
};

export type OrderInfo = {
  id: bigint;
  price: number;
  isBuy: boolean;
  maker: Address;
  amount: bigint;
  filled: bigint;
};

// ============================================================================
// Status/Side mapping
// ============================================================================

const MATCH_STATUS_MAP: Record<number, MatchStatus> = {
  0: "NULL",
  1: "OPEN",
  2: "RESOLVED",
};

const SIDE_MAP: Record<number, Side> = {
  0: "NONE",
  1: "YES",
  2: "NO",
};

export const SIDE_ENUM: Record<string, number> = {
  NONE: 0,
  YES: 1,
  NO: 2,
};

// ============================================================================
// Client factory
// ============================================================================

export function createEvmPublicClient(
  chainConfig: EvmChainConfig,
): PublicClient {
  return createPublicClient({
    chain: chainConfig.wagmiChain,
    transport: http(chainConfig.rpcUrl),
  });
}

export function createEvmWalletClient(
  chainConfig: EvmChainConfig,
): WalletClient | null {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  return createWalletClient({
    chain: chainConfig.wagmiChain,
    transport: custom((window as any).ethereum),
  });
}

// ============================================================================
// Read functions
// ============================================================================

export async function getMatchMeta(
  client: PublicClient,
  contractAddress: Address,
  matchId: bigint,
): Promise<MatchMeta> {
  const result = (await client.readContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "matches",
    args: [matchId],
  })) as [number, number, bigint, bigint];

  return {
    status: MATCH_STATUS_MAP[result[0]] ?? "NULL",
    winner: SIDE_MAP[result[1]] ?? "NONE",
    yesPool: result[2],
    noPool: result[3],
  };
}

export async function getPosition(
  client: PublicClient,
  contractAddress: Address,
  matchId: bigint,
  userAddress: Address,
): Promise<Position> {
  const result = (await client.readContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "positions",
    args: [matchId, userAddress],
  })) as [bigint, bigint];

  return {
    yesShares: result[0],
    noShares: result[1],
  };
}

export async function getNextMatchId(
  client: PublicClient,
  contractAddress: Address,
): Promise<bigint> {
  return (await client.readContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "nextMatchId",
  })) as bigint;
}

export async function getBestBid(
  client: PublicClient,
  contractAddress: Address,
  matchId: bigint,
): Promise<number> {
  return Number(
    await client.readContract({
      address: contractAddress,
      abi: GOLD_CLOB_ABI,
      functionName: "bestBids",
      args: [matchId],
    }),
  );
}

export async function getBestAsk(
  client: PublicClient,
  contractAddress: Address,
  matchId: bigint,
): Promise<number> {
  return Number(
    await client.readContract({
      address: contractAddress,
      abi: GOLD_CLOB_ABI,
      functionName: "bestAsks",
      args: [matchId],
    }),
  );
}

export async function getFeeBps(
  client: PublicClient,
  contractAddress: Address,
): Promise<number> {
  return Number(
    await client.readContract({
      address: contractAddress,
      abi: GOLD_CLOB_ABI,
      functionName: "feeBps",
    }),
  );
}

/** Get native currency balance for a user address. */
export async function getNativeBalance(
  client: PublicClient,
  userAddress: Address,
): Promise<bigint> {
  return client.getBalance({ address: userAddress });
}

export async function getRecentTrades(
  client: PublicClient,
  contractAddress: Address,
  matchId: bigint,
  blocksToSearch = 100n,
): Promise<
  {
    time: number;
    price: number;
    amount: bigint;
    side: "YES" | "NO";
    id: string;
  }[]
> {
  const currentBlock = await client.getBlockNumber();
  const fromBlock =
    currentBlock > blocksToSearch ? currentBlock - blocksToSearch : 0n;

  const logs = await client.getLogs({
    address: contractAddress,
    event: parseAbiItem(
      "event OrderMatched(uint256 indexed matchId, uint64 makerOrderId, uint64 takerOrderId, uint256 matchedAmount, uint16 price)",
    ),
    args: { matchId },
    fromBlock,
    toBlock: "latest",
  });

  const blockCache = new Map<bigint, number>();

  const trades = await Promise.all(
    logs.map(async (log) => {
      let time = Date.now();
      if (log.blockNumber) {
        if (!blockCache.has(log.blockNumber)) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          blockCache.set(log.blockNumber, Number(block.timestamp) * 1000);
        }
        time = blockCache.get(log.blockNumber)!;
      }
      return {
        id: log.transactionHash + "-" + log.logIndex,
        time,
        price: log.args.price! / 1000,
        amount: log.args.matchedAmount!,
        side: log.args.price! >= 500 ? "YES" : ("NO" as "YES" | "NO"),
      };
    }),
  );

  return trades.reverse();
}

export async function getRecentOrders(
  client: PublicClient,
  contractAddress: Address,
  matchId: bigint,
  blocksToSearch = 100n,
) {
  const currentBlock = await client.getBlockNumber();
  const fromBlock =
    currentBlock > blocksToSearch ? currentBlock - blocksToSearch : 0n;

  const logs = await client.getLogs({
    address: contractAddress,
    event: parseAbiItem(
      "event OrderPlaced(uint256 indexed matchId, uint64 indexed orderId, address indexed maker, bool isBuy, uint16 price, uint256 amount)",
    ),
    args: { matchId },
    fromBlock,
    toBlock: "latest",
  });

  return logs
    .map((log) => ({
      price: log.args.price! / 1000,
      amount: log.args.amount!,
      isBuy: log.args.isBuy!,
    }))
    .reverse();
}

// ============================================================================
// Write functions
// ============================================================================

/** Place an order, sending native currency as msg.value. */
export async function placeOrder(
  walletClient: WalletClient,
  contractAddress: Address,
  matchId: bigint,
  isBuy: boolean,
  price: number,
  amount: bigint,
  account: Address,
  value: bigint,
): Promise<Hash> {
  return walletClient.writeContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "placeOrder",
    args: [matchId, isBuy, price, amount],
    account,
    chain: walletClient.chain,
    value,
  });
}

export async function cancelOrder(
  walletClient: WalletClient,
  contractAddress: Address,
  matchId: bigint,
  orderId: bigint,
  price: number,
  account: Address,
): Promise<Hash> {
  return walletClient.writeContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "cancelOrder",
    args: [matchId, orderId, price],
    account,
    chain: walletClient.chain,
  });
}

export async function claimWinnings(
  walletClient: WalletClient,
  contractAddress: Address,
  matchId: bigint,
  account: Address,
): Promise<Hash> {
  return walletClient.writeContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "claim",
    args: [matchId],
    account,
    chain: walletClient.chain,
  });
}

export async function createMatch(
  walletClient: WalletClient,
  contractAddress: Address,
  account: Address,
): Promise<Hash> {
  return walletClient.writeContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "createMatch",
    args: [],
    account,
    chain: walletClient.chain,
  });
}

export async function resolveMatch(
  walletClient: WalletClient,
  contractAddress: Address,
  matchId: bigint,
  winner: number,
  account: Address,
): Promise<Hash> {
  return walletClient.writeContract({
    address: contractAddress,
    abi: GOLD_CLOB_ABI,
    functionName: "resolveMatch",
    args: [matchId, winner],
    account,
    chain: walletClient.chain,
  });
}
