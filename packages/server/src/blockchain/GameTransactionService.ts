/**
 * Game Transaction Service
 *
 * Server-side service for executing gasless game transactions.
 * This is the core component that makes gameplay completely gasless for users.
 *
 * Architecture:
 * 1. Client sends game action via WebSocket (e.g., "equip sword")
 * 2. Server validates action and creates UserOperation
 * 3. Server signs with game authority key
 * 4. Server submits to bundler with paymaster
 * 5. Client receives confirmation
 *
 * No wallet popups, no gas concerns for players.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ============ Types ============

export interface GameTransaction {
  /** Player's smart account address */
  player: Address;
  /** Target contract */
  target: Address;
  /** Encoded call data */
  callData: Hex;
  /** Optional value to send */
  value?: bigint;
}

export interface TransactionResult {
  success: boolean;
  hash?: Hash;
  error?: string;
  gasUsed?: bigint;
}

export interface GameTransactionConfig {
  /** RPC URL for Jeju network */
  rpcUrl: string;
  /** Bundler URL */
  bundlerUrl: string;
  /** Game authority private key (sponsors transactions) */
  gameAuthorityKey: Hex;
  /** Paymaster address for gas sponsorship */
  paymasterAddress: Address;
  /** App address for fee distribution */
  appAddress: Address;
  /** Chain ID */
  chainId: number;
}

// ============ ABIs ============

const ENTRYPOINT_ABI = [
  {
    name: "handleOps",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const SIMPLE_ACCOUNT_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dest", type: "address[]" },
      { name: "value", type: "uint256[]" },
      { name: "func", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const;

// ============ Constants ============

const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;

// ============ Service Implementation ============

export class GameTransactionService {
  private config: GameTransactionConfig;
  private publicClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient>;
  private gameAuthority: ReturnType<typeof privateKeyToAccount>;
  private pendingNonces: Map<string, bigint> = new Map();

  constructor(config: GameTransactionConfig) {
    this.config = config;
    this.gameAuthority = privateKeyToAccount(config.gameAuthorityKey);

    const chain = {
      id: config.chainId,
      name: "Jeju",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    };

    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.gameAuthority,
      chain,
      transport: http(config.rpcUrl),
    });
  }

  /**
   * Get game authority address
   */
  getGameAuthorityAddress(): Address {
    return this.gameAuthority.address;
  }

  /**
   * Execute a single game transaction (gasless for player)
   */
  async executeTransaction(tx: GameTransaction): Promise<TransactionResult> {
    console.log(`[GameTxService] Executing tx for ${tx.player} -> ${tx.target}`);

    // Check if bundler is available
    const useBundler = await this.isBundlerAvailable();

    if (useBundler) {
      return this.executeViaBundler(tx);
    }

    // Fallback: Direct transaction from game authority
    // This requires the game authority to have permission on target contracts
    return this.executeDirectly(tx);
  }

  /**
   * Execute batch of transactions atomically
   */
  async executeBatch(txs: GameTransaction[]): Promise<TransactionResult> {
    if (txs.length === 0) {
      return { success: false, error: "No transactions provided" };
    }

    if (txs.length === 1) {
      return this.executeTransaction(txs[0]);
    }

    const player = txs[0].player;
    if (!txs.every((tx) => tx.player === player)) {
      return { success: false, error: "All transactions must be for the same player" };
    }

    console.log(`[GameTxService] Executing batch of ${txs.length} txs for ${player}`);

    const callData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: "executeBatch",
      args: [
        txs.map((tx) => tx.target),
        txs.map((tx) => tx.value ?? 0n),
        txs.map((tx) => tx.callData),
      ],
    });

    return this.executeDirectly({
      player,
      target: player, // Smart account address
      callData,
    });
  }

  /**
   * Execute via ERC-4337 bundler (preferred)
   */
  private async executeViaBundler(tx: GameTransaction): Promise<TransactionResult> {
    const nonce = await this.getNonce(tx.player);
    const feeData = await this.publicClient.estimateFeesPerGas();

    const callData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: "execute",
      args: [tx.target, tx.value ?? 0n, tx.callData],
    });

    // Build paymaster data
    const verificationGas = (100000n).toString(16).padStart(32, "0");
    const postOpGas = (50000n).toString(16).padStart(32, "0");
    const appAddr = this.config.appAddress.slice(2).toLowerCase();
    const paymasterAndData = `${this.config.paymasterAddress}${verificationGas}${postOpGas}${appAddr}` as Hex;

    const userOp = {
      sender: tx.player,
      nonce: `0x${nonce.toString(16)}`,
      initCode: "0x",
      callData,
      callGasLimit: "0x50000",
      verificationGasLimit: "0x30000",
      preVerificationGas: "0x10000",
      maxFeePerGas: `0x${(feeData.maxFeePerGas ?? 1000000000n).toString(16)}`,
      maxPriorityFeePerGas: `0x${(feeData.maxPriorityFeePerGas ?? 1000000000n).toString(16)}`,
      paymasterAndData,
      signature: "0x", // Game authority signs on behalf of player
    };

    // Sign UserOp with game authority
    // In production, this requires proper ERC-4337 signature validation
    const userOpHash = this.hashUserOp(userOp);
    userOp.signature = await this.gameAuthority.signMessage({
      message: { raw: userOpHash as Hex },
    });

    // Submit to bundler
    const response = await fetch(this.config.bundlerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, ENTRYPOINT_V07],
      }),
    });

    const result = (await response.json()) as {
      result?: Hash;
      error?: { message: string };
    };

    if (result.error) {
      console.error(`[GameTxService] Bundler error:`, result.error);
      return { success: false, error: result.error.message };
    }

    // Wait for receipt
    const receipt = await this.waitForUserOpReceipt(result.result as Hash);
    return receipt;
  }

  /**
   * Execute directly via game authority (fallback when no bundler)
   */
  private async executeDirectly(tx: GameTransaction): Promise<TransactionResult> {
    const hash = await this.walletClient.sendTransaction({
      to: tx.target,
      data: tx.callData,
      value: tx.value ?? 0n,
    } as Parameters<typeof this.walletClient.sendTransaction>[0]);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      success: receipt.status === "success",
      hash,
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Get nonce for a smart account
   */
  private async getNonce(sender: Address): Promise<bigint> {
    // Check pending nonces cache
    const cacheKey = sender.toLowerCase();
    const pendingNonce = this.pendingNonces.get(cacheKey);

    const onChainNonce = await this.publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: ENTRYPOINT_ABI,
      functionName: "getNonce",
      args: [sender, 0n],
    });

    // Use max of on-chain and pending
    const nonce = pendingNonce && pendingNonce > onChainNonce ? pendingNonce : onChainNonce;

    // Increment pending nonce
    this.pendingNonces.set(cacheKey, nonce + 1n);

    return nonce;
  }

  /**
   * Hash a UserOperation for signing
   */
  private hashUserOp(userOp: Record<string, string>): Hex {
    const packed = encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
      ],
      [
        userOp.sender as Address,
        BigInt(userOp.nonce),
        keccak256(userOp.initCode as Hex),
        keccak256(userOp.callData as Hex),
        BigInt(userOp.callGasLimit),
        BigInt(userOp.verificationGasLimit),
        BigInt(userOp.preVerificationGas),
        BigInt(userOp.maxFeePerGas),
        BigInt(userOp.maxPriorityFeePerGas),
        keccak256(userOp.paymasterAndData as Hex),
      ]
    );

    const userOpHash = keccak256(packed);

    return keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }],
        [userOpHash, ENTRYPOINT_V07, BigInt(this.config.chainId)]
      )
    );
  }

  /**
   * Wait for UserOperation receipt
   */
  private async waitForUserOpReceipt(
    userOpHash: Hash,
    timeout = 60000
  ): Promise<TransactionResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await fetch(this.config.bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getUserOperationReceipt",
          params: [userOpHash],
        }),
      });

      const result = (await response.json()) as {
        result?: { success: boolean; receipt: { transactionHash: Hash; gasUsed: string } } | null;
      };

      if (result.result) {
        return {
          success: result.result.success,
          hash: result.result.receipt.transactionHash,
          gasUsed: BigInt(result.result.receipt.gasUsed),
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { success: false, error: "UserOperation timeout" };
  }

  /**
   * Check if bundler is available
   */
  private async isBundlerAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.config.bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_supportedEntryPoints",
          params: [],
        }),
      });

      const result = (await response.json()) as { result?: string[] };
      return Array.isArray(result.result) && result.result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check paymaster balance
   */
  async getPaymasterBalance(): Promise<bigint> {
    const balance = await this.publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [this.config.paymasterAddress],
    });

    return balance;
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    bundlerAvailable: boolean;
    paymasterBalance: bigint;
    gameAuthority: Address;
  }> {
    const [bundlerAvailable, paymasterBalance] = await Promise.all([
      this.isBundlerAvailable(),
      this.getPaymasterBalance(),
    ]);

    return {
      bundlerAvailable,
      paymasterBalance,
      gameAuthority: this.gameAuthority.address,
    };
  }
}

// ============ Factory ============

let gameTransactionService: GameTransactionService | null = null;

export function initializeGameTransactionService(
  config: GameTransactionConfig
): GameTransactionService {
  gameTransactionService = new GameTransactionService(config);
  console.log(
    `[GameTxService] Initialized with authority: ${gameTransactionService.getGameAuthorityAddress()}`
  );
  return gameTransactionService;
}

export function getGameTransactionService(): GameTransactionService {
  if (!gameTransactionService) {
    throw new Error("[GameTxService] Not initialized. Call initializeGameTransactionService first.");
  }
  return gameTransactionService;
}

/**
 * Initialize from environment variables
 */
export function initializeGameTransactionServiceFromEnv(): GameTransactionService {
  const config: GameTransactionConfig = {
    rpcUrl: process.env.JEJU_RPC_URL || "http://localhost:9545",
    bundlerUrl: process.env.JEJU_BUNDLER_URL || "http://localhost:9545/bundler",
    gameAuthorityKey: (process.env.GAME_AUTHORITY_KEY ||
      process.env.PRIVATE_KEY ||
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Hex,
    paymasterAddress: (process.env.LIQUIDITY_PAYMASTER_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    appAddress: (process.env.APP_REVENUE_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    chainId: parseInt(process.env.CHAIN_ID || "420691"),
  };

  return initializeGameTransactionService(config);
}
