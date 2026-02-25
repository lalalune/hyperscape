import { createPublicClient, http, decodeFunctionData, type Hash } from "viem";
import { bsc, bscTestnet, base, baseSepolia } from "viem/chains";
import { formatBaseUnitsToDecimal } from "../amounts.js";
import type { ArenaFeeChain } from "../types.js";

const GOLD_CLOB_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "matchId", type: "uint256" },
      { internalType: "bool", name: "isBuy", type: "bool" },
      { internalType: "uint16", name: "price", type: "uint16" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "placeOrder",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

/** Native currency uses 18 decimals (BNB, ETH). */
const NATIVE_DECIMALS = 18;

export interface InboundEvmTransfer {
  fromWallet: string;
  amountBaseUnits: bigint;
  amountGold: string;
}

export class EvmTransactionInspector {
  private bscClient: any = null;
  private baseClient: any = null;
  private bscClobAddress: string | null = null;
  private baseClobAddress: string | null = null;

  constructor() {
    const bscRpcUrl = process.env.VITE_BSC_RPC_URL || process.env.BSC_RPC_URL;
    const baseRpcUrl =
      process.env.VITE_BASE_RPC_URL || process.env.BASE_RPC_URL;

    this.bscClobAddress =
      process.env.VITE_BSC_GOLD_CLOB_ADDRESS ||
      process.env.BSC_GOLD_CLOB_ADDRESS ||
      null;
    this.baseClobAddress =
      process.env.VITE_BASE_GOLD_CLOB_ADDRESS ||
      process.env.BASE_GOLD_CLOB_ADDRESS ||
      null;

    if (bscRpcUrl) {
      const chainId = Number(
        process.env.VITE_BSC_CHAIN_ID || process.env.BSC_CHAIN_ID || 97,
      );
      this.bscClient = createPublicClient({
        chain: chainId === 56 ? bsc : bscTestnet,
        transport: http(bscRpcUrl),
      });
    }

    if (baseRpcUrl) {
      const chainId = Number(
        process.env.VITE_BASE_CHAIN_ID || process.env.BASE_CHAIN_ID || 84532,
      );
      this.baseClient = createPublicClient({
        chain: chainId === 8453 ? base : baseSepolia,
        transport: http(baseRpcUrl),
      });
    }
  }

  public isEnabled(chain: ArenaFeeChain): boolean {
    if (chain === "BSC")
      return this.bscClient !== null && this.bscClobAddress !== null;
    if (chain === "BASE")
      return this.baseClient !== null && this.baseClobAddress !== null;
    return false;
  }

  public async inspectMarketBetTransaction(
    txSignature: string,
    chain: ArenaFeeChain,
    expectedWallet: string,
  ): Promise<InboundEvmTransfer | null> {
    const client = chain === "BSC" ? this.bscClient : this.baseClient;
    const clobAddress =
      chain === "BSC" ? this.bscClobAddress : this.baseClobAddress;

    if (!client || !clobAddress) {
      return null;
    }

    try {
      const tx = await client.getTransaction({ hash: txSignature as Hash });
      if (!tx || !tx.to || tx.to.toLowerCase() !== clobAddress.toLowerCase()) {
        return null; // Reject if it doesn't target the CLOB
      }

      const receipt = await client.getTransactionReceipt({
        hash: txSignature as Hash,
      });
      if (!receipt || receipt.status !== "success") {
        return null; // Reject reverted / failed transactions
      }

      const expectedWalletLower = expectedWallet.toLowerCase();
      if (receipt.from.toLowerCase() !== expectedWalletLower) {
        return null; // Reject griefing attempts where a sybil submits someone else's signature
      }

      // Verify this is a placeOrder call
      const decoded = decodeFunctionData({
        abi: GOLD_CLOB_ABI,
        data: tx.input,
      });

      if (decoded.functionName !== "placeOrder") {
        return null;
      }

      // The share amount from the decoded args
      const shareAmount = BigInt(decoded.args[3] as number | bigint | string);
      if (shareAmount <= 0n) return null;

      // Use msg.value (tx.value) as the verified native currency amount.
      // This is the actual BNB/ETH the user sent, which includes cost + fees.
      const nativeValue = tx.value;
      if (nativeValue <= 0n) return null;

      return {
        fromWallet: receipt.from,
        amountBaseUnits: nativeValue,
        amountGold: formatBaseUnitsToDecimal(nativeValue, NATIVE_DECIMALS),
      };
    } catch (error) {
      console.warn(
        `[EvmTransactionInspector] Failed to parse tx ${txSignature}:`,
        error,
      );
      return null;
    }
  }
}
