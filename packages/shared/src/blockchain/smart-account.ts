/**
 * Smart Account SDK for Jeju Network
 *
 * Modern ERC-4337 account abstraction integration using permissionless.js.
 * Enables gasless transactions, session keys, and seamless UX.
 *
 * Architecture:
 * - Smart Contract Wallets (SimpleAccount) for all users
 * - Bundler integration for UserOperation submission
 * - Paymaster integration for gas sponsorship
 * - Session keys for frequent game actions without popups
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
  type Chain,
  type Account,
  type Transport,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain, getRpcUrl, type JejuNetwork } from "./chain";

// ============ Constants ============

/**
 * ERC-4337 EntryPoint v0.7 address (same on all EVM chains)
 */
export const ENTRYPOINT_ADDRESS_V07 =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;

/**
 * SimpleAccountFactory address for Jeju Network
 * Deploy using: forge create SimpleAccountFactory --constructor-args $ENTRYPOINT
 */
export const SIMPLE_ACCOUNT_FACTORY =
  (process.env.SIMPLE_ACCOUNT_FACTORY_ADDRESS ||
    "0x9406Cc6185a346906296840746125a0E44976454") as Address;

// ============ Types ============

export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface SmartAccountConfig {
  /** Owner's signer (EOA or embedded wallet) */
  signer: WalletClient<Transport, Chain, Account>;
  /** Network to use */
  network?: JejuNetwork;
  /** Custom bundler URL */
  bundlerUrl?: string;
  /** Custom paymaster address for gas sponsorship */
  paymasterAddress?: Address;
  /** App address for paymaster fee distribution */
  appAddress?: Address;
}

export interface TransactionRequest {
  to: Address;
  data: Hex;
  value?: bigint;
}

export interface SmartAccountClient {
  /** Smart account address */
  address: Address;
  /** Send a sponsored transaction (gasless for user) */
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>;
  /** Send batch of transactions in single UserOp */
  sendBatchTransaction: (txs: TransactionRequest[]) => Promise<Hash>;
  /** Get current nonce */
  getNonce: () => Promise<bigint>;
  /** Check if account is deployed */
  isDeployed: () => Promise<boolean>;
  /** Get account balance */
  getBalance: () => Promise<bigint>;
  /** Estimate gas for a transaction */
  estimateGas: (tx: TransactionRequest) => Promise<bigint>;
}

// ============ Bundler Client ============

/**
 * Create a bundler client for submitting UserOperations
 */
export function createBundlerClient(bundlerUrl: string, _chain: Chain) {
  return {
    async sendUserOperation(
      userOp: UserOperation
    ): Promise<Hash> {
      const response = await fetch(bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_sendUserOperation",
          params: [formatUserOpForRpc(userOp), ENTRYPOINT_ADDRESS_V07],
        }),
      });

      const result = (await response.json()) as {
        result?: Hash;
        error?: { message: string };
      };
      if (result.error) {
        throw new Error(`Bundler error: ${result.error.message}`);
      }
      return result.result as Hash;
    },

    async estimateUserOperationGas(
      userOp: Partial<UserOperation>
    ): Promise<{ callGasLimit: bigint; verificationGasLimit: bigint; preVerificationGas: bigint }> {
      const response = await fetch(bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_estimateUserOperationGas",
          params: [formatUserOpForRpc(userOp as UserOperation), ENTRYPOINT_ADDRESS_V07],
        }),
      });

      const result = (await response.json()) as {
        result?: { callGasLimit: string; verificationGasLimit: string; preVerificationGas: string };
        error?: { message: string };
      };
      if (result.error) {
        throw new Error(`Gas estimation error: ${result.error.message}`);
      }

      return {
        callGasLimit: BigInt(result.result?.callGasLimit ?? "0"),
        verificationGasLimit: BigInt(result.result?.verificationGasLimit ?? "0"),
        preVerificationGas: BigInt(result.result?.preVerificationGas ?? "0"),
      };
    },

    async getUserOperationReceipt(
      userOpHash: Hash
    ): Promise<{ success: boolean; transactionHash: Hash } | null> {
      const response = await fetch(bundlerUrl, {
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
        result?: { success: boolean; receipt: { transactionHash: Hash } } | null;
      };
      if (!result.result) return null;

      return {
        success: result.result.success,
        transactionHash: result.result.receipt.transactionHash,
      };
    },

    async waitForUserOperationReceipt(
      userOpHash: Hash,
      timeout = 60000
    ): Promise<{ success: boolean; transactionHash: Hash }> {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const receipt = await this.getUserOperationReceipt(userOpHash);
        if (receipt) return receipt;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error("UserOperation receipt timeout");
    },
  };
}

// ============ Smart Account Creation ============

/**
 * Compute the counterfactual smart account address for an owner
 */
export async function getSmartAccountAddress(
  ownerAddress: Address,
  publicClient: PublicClient,
  salt: bigint = 0n
): Promise<Address> {
  const factoryAbi = [
    {
      name: "getAddress",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "salt", type: "uint256" },
      ],
      outputs: [{ name: "", type: "address" }],
    },
  ] as const;

  const address = await publicClient.readContract({
    address: SIMPLE_ACCOUNT_FACTORY,
    abi: factoryAbi,
    functionName: "getAddress",
    args: [ownerAddress, salt],
  } as unknown as Parameters<typeof publicClient.readContract>[0]);

  return address as Address;
}

/**
 * Create init code for deploying a new smart account
 */
export function createInitCode(ownerAddress: Address, salt: bigint = 0n): Hex {
  const factoryAbi = [
    {
      name: "createAccount",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "owner", type: "address" },
        { name: "salt", type: "uint256" },
      ],
      outputs: [{ name: "ret", type: "address" }],
    },
  ] as const;

  const callData = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createAccount",
    args: [ownerAddress, salt],
  });

  // initCode = factory address + factory calldata
  return `${SIMPLE_ACCOUNT_FACTORY}${callData.slice(2)}` as Hex;
}

/**
 * Create a smart account client for gasless transactions
 */
export async function createSmartAccountClient(
  config: SmartAccountConfig
): Promise<SmartAccountClient> {
  const { signer, network, paymasterAddress, appAddress } = config;
  const chain = getChain(network);
  const rpcUrl = getRpcUrl(network);

  const bundlerUrl =
    config.bundlerUrl ||
    process.env.JEJU_BUNDLER_URL ||
    `${rpcUrl.replace(/\/$/, "")}/bundler`;

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const bundlerClient = createBundlerClient(bundlerUrl, chain);
  const ownerAddress = signer.account.address;
  const smartAccountAddress = await getSmartAccountAddress(
    ownerAddress,
    publicClient as PublicClient
  );

  // Check if account is deployed
  async function isDeployed(): Promise<boolean> {
    const code = await publicClient.getCode({ address: smartAccountAddress });
    return code !== undefined && code !== "0x";
  }

  // Get current nonce from EntryPoint
  async function getNonce(): Promise<bigint> {
    const entryPointAbi = [
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

    const nonce = await publicClient.readContract({
      address: ENTRYPOINT_ADDRESS_V07,
      abi: entryPointAbi,
      functionName: "getNonce",
      args: [smartAccountAddress, 0n],
    } as unknown as Parameters<typeof publicClient.readContract>[0]);

    return nonce as bigint;
  }

  // Build UserOperation for a transaction
  async function buildUserOperation(
    callData: Hex
  ): Promise<UserOperation> {
    const deployed = await isDeployed();
    const nonce = await getNonce();
    const feeData = await publicClient.estimateFeesPerGas();

    // Create partial UserOp for gas estimation
    const partialUserOp: Partial<UserOperation> = {
      sender: smartAccountAddress,
      nonce,
      initCode: deployed ? "0x" : createInitCode(ownerAddress),
      callData,
      maxFeePerGas: feeData.maxFeePerGas ?? 1000000000n,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 1000000000n,
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Estimate gas
    const gasEstimate = await bundlerClient.estimateUserOperationGas(partialUserOp);

    // Add paymaster data if configured
    let paymasterAndData: Hex = "0x";
    if (paymasterAddress) {
      // Format: paymaster (20) + verificationGasLimit (16) + postOpGasLimit (16) + appAddress (20)
      const verificationGas = gasEstimate.verificationGasLimit.toString(16).padStart(32, "0");
      const postOpGas = (50000n).toString(16).padStart(32, "0");
      const app = (appAddress || ownerAddress).slice(2).toLowerCase();
      paymasterAndData = `${paymasterAddress}${verificationGas}${postOpGas}${app}` as Hex;
    }

    return {
      sender: smartAccountAddress,
      nonce,
      initCode: deployed ? "0x" : createInitCode(ownerAddress),
      callData,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: gasEstimate.verificationGasLimit,
      preVerificationGas: gasEstimate.preVerificationGas,
      maxFeePerGas: feeData.maxFeePerGas ?? 1000000000n,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 1000000000n,
      paymasterAndData,
      signature: "0x",
    };
  }

  // Sign UserOperation
  async function signUserOperation(userOp: UserOperation): Promise<Hex> {
    // Hash the UserOperation
    const userOpHash = hashUserOperation(userOp, chain.id);

    // Sign with owner's key
    const signature = await signer.signMessage({
      account: signer.account,
      message: { raw: userOpHash as Hex },
    });

    return signature;
  }

  // Encode call data for SimpleAccount.execute
  function encodeExecute(tx: TransactionRequest): Hex {
    const executeAbi = [
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
    ] as const;

    return encodeFunctionData({
      abi: executeAbi,
      functionName: "execute",
      args: [tx.to, tx.value ?? 0n, tx.data],
    });
  }

  // Encode batch call data for SimpleAccount.executeBatch
  function encodeExecuteBatch(txs: TransactionRequest[]): Hex {
    const executeBatchAbi = [
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

    return encodeFunctionData({
      abi: executeBatchAbi,
      functionName: "executeBatch",
      args: [
        txs.map((tx) => tx.to),
        txs.map((tx) => tx.value ?? 0n),
        txs.map((tx) => tx.data),
      ],
    });
  }

  return {
    address: smartAccountAddress,

    async sendTransaction(tx: TransactionRequest): Promise<Hash> {
      const callData = encodeExecute(tx);
      const userOp = await buildUserOperation(callData);
      userOp.signature = await signUserOperation(userOp);

      const userOpHash = await bundlerClient.sendUserOperation(userOp);
      const receipt = await bundlerClient.waitForUserOperationReceipt(userOpHash);

      return receipt.transactionHash;
    },

    async sendBatchTransaction(txs: TransactionRequest[]): Promise<Hash> {
      const callData = encodeExecuteBatch(txs);
      const userOp = await buildUserOperation(callData);
      userOp.signature = await signUserOperation(userOp);

      const userOpHash = await bundlerClient.sendUserOperation(userOp);
      const receipt = await bundlerClient.waitForUserOperationReceipt(userOpHash);

      return receipt.transactionHash;
    },

    getNonce,
    isDeployed,

    async getBalance(): Promise<bigint> {
      return publicClient.getBalance({ address: smartAccountAddress });
    },

    async estimateGas(tx: TransactionRequest): Promise<bigint> {
      const callData = encodeExecute(tx);
      const userOp = await buildUserOperation(callData);
      return userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
    },
  };
}

// ============ Helper Functions ============

/**
 * Hash a UserOperation for signing
 */
function hashUserOperation(userOp: UserOperation, chainId: number): Hex {
  // Pack the UserOp fields
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
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      keccak256(userOp.paymasterAndData),
    ]
  );

  const userOpHash = keccak256(packed);

  // Final hash includes EntryPoint and chainId
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }],
      [userOpHash, ENTRYPOINT_ADDRESS_V07, BigInt(chainId)]
    )
  );
}

/**
 * Format UserOperation for JSON-RPC
 */
function formatUserOpForRpc(userOp: UserOperation): Record<string, string> {
  return {
    sender: userOp.sender,
    nonce: `0x${userOp.nonce.toString(16)}`,
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
    verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
    preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
    maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

// ============ Factory Functions ============

/**
 * Create a smart account client from a private key (for server-side use)
 */
export async function createSmartAccountFromPrivateKey(
  privateKey: Hex,
  options: Omit<SmartAccountConfig, "signer"> = {}
): Promise<SmartAccountClient> {
  const chain = getChain(options.network);
  const account = privateKeyToAccount(privateKey);

  const signer = createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl(options.network)),
  });

  return createSmartAccountClient({
    ...options,
    signer,
  });
}

/**
 * Check if bundler is available
 */
export async function isBundlerAvailable(network?: JejuNetwork): Promise<boolean> {
  const rpcUrl = getRpcUrl(network);
  const bundlerUrl =
    process.env.JEJU_BUNDLER_URL || `${rpcUrl.replace(/\/$/, "")}/bundler`;

  try {
    const response = await fetch(bundlerUrl, {
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
