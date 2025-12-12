/**
 * x402 Payment Protocol for Hyperscape
 *
 * Full implementation of HTTP 402 payment protocol with:
 * - EIP-712 typed signature verification
 * - On-chain settlement via X402Facilitator contract
 * - Support for ETH and ERC-20 payments
 * - Game-specific payment tiers
 *
 * @see https://x402.org
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  formatEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  getChain,
  getOptionalAddress,
  type JejuNetwork,
  CHAIN_IDS,
} from "./chain";

// ============ Contract ABI ============

const X402_FACILITATOR_ABI = parseAbi([
  "function settle(address payer, address recipient, address token, uint256 amount, string resource, string nonce, uint256 timestamp, bytes signature) returns (bytes32 paymentId)",
  "function isNonceUsed(address payer, string nonce) view returns (bool)",
  "function hashPayment(address token, address recipient, uint256 amount, string resource, string nonce, uint256 timestamp) view returns (bytes32)",
  "function domainSeparator() view returns (bytes32)",
  "function getStats() view returns (uint256 settlements, uint256 volumeUSD, uint256 feeBps, address feeAddr)",
  "function supportedTokens(address token) view returns (bool)",
]);

// ============ Types ============

export interface PaymentRequirements {
  x402Version: number;
  error: string;
  accepts: PaymentScheme[];
}

export interface PaymentScheme {
  scheme: "exact" | "upto";
  network: string;
  maxAmountRequired: string;
  asset: Address;
  payTo: Address;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema: string | null;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentPayload {
  scheme: string;
  network: string;
  asset: Address;
  payTo: Address;
  amount: string;
  resource: string;
  nonce: string;
  timestamp: number;
  signature?: string;
}

export interface SettlementResult {
  settled: boolean;
  paymentId?: `0x${string}`;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
  error?: string;
}

export interface PaymentVerification {
  valid: boolean;
  signer?: Address;
  error?: string;
}

// ============ Game Payment Tiers ============

export const GAME_PAYMENT_TIERS = {
  WORLD_ENTRY: parseEther("0.01"),
  PREMIUM_WORLD: parseEther("0.1"),
  ITEM_PURCHASE: parseEther("0.005"),
  ITEM_MINT_NFT: parseEther("0.02"),
  AI_NPC_INTERACTION: parseEther("0.001"),
  PROCEDURAL_GENERATION: parseEther("0.05"),
  GUILD_CREATION: parseEther("0.1"),
  TOURNAMENT_ENTRY: parseEther("0.05"),
  PREMIUM_COSMETIC: parseEther("0.02"),
} as const;

// ============ EIP-712 Configuration ============

const EIP712_DOMAIN = {
  name: "x402 Payment Protocol",
  version: "1",
};

const EIP712_TYPES = {
  Payment: [
    { name: "scheme", type: "string" },
    { name: "network", type: "string" },
    { name: "asset", type: "address" },
    { name: "payTo", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "resource", type: "string" },
    { name: "nonce", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

// ============ Client ============

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

function getX402FacilitatorAddress(): Address {
  const address = getOptionalAddress("X402_FACILITATOR_ADDRESS");
  if (!address) {
    throw new Error(
      "X402_FACILITATOR_ADDRESS not configured. Set the environment variable to enable x402 payments.",
    );
  }
  return address;
}

// ============ Core Functions ============

/**
 * Create a 402 Payment Required response for a game resource
 */
export function createPaymentRequirement(
  resource: string,
  amount: bigint,
  description: string,
  recipientAddress: Address,
  tokenAddress: Address = "0x0000000000000000000000000000000000000000",
  network: JejuNetwork = "jeju",
): PaymentRequirements {
  return {
    x402Version: 1,
    error: "Payment required to access this resource",
    accepts: [
      {
        scheme: "exact",
        network,
        maxAmountRequired: amount.toString(),
        asset: tokenAddress,
        payTo: recipientAddress,
        resource,
        description,
        mimeType: "application/json",
        outputSchema: null,
        maxTimeoutSeconds: 300,
        extra: {
          game: "hyperscape",
        },
      },
    ],
  };
}

/**
 * Generate cryptographically secure nonce
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a payment payload ready for signing
 */
export function createPaymentPayload(
  asset: Address,
  payTo: Address,
  amount: bigint,
  resource: string,
  network: JejuNetwork = "jeju",
): Omit<PaymentPayload, "signature"> {
  return {
    scheme: "exact",
    network,
    asset,
    payTo,
    amount: amount.toString(),
    resource,
    nonce: generateNonce(),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Parse x402 payment header from HTTP request
 */
export function parsePaymentHeader(
  headerValue: string | null,
): PaymentPayload | null {
  if (!headerValue) return null;

  let parsed: PaymentPayload;
  try {
    parsed = JSON.parse(headerValue) as PaymentPayload;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.amount || !parsed.payTo || !parsed.nonce) return null;

  return parsed;
}

/**
 * Get EIP-712 domain for signature verification
 */
function getEIP712Domain(network: JejuNetwork) {
  return {
    ...EIP712_DOMAIN,
    chainId: CHAIN_IDS[network],
    verifyingContract: "0x0000000000000000000000000000000000000000" as Address,
  };
}

/**
 * Verify payment signature using EIP-712
 */
export async function verifyPaymentSignature(
  payload: PaymentPayload,
  expectedAmount: bigint,
  expectedRecipient: Address,
): Promise<PaymentVerification> {
  if (!payload.amount || !payload.payTo || !payload.asset) {
    return { valid: false, error: "Missing required payment fields" };
  }

  const paymentAmount = BigInt(payload.amount);

  if (paymentAmount < expectedAmount) {
    return {
      valid: false,
      error: `Insufficient payment: ${formatEther(paymentAmount)} < ${formatEther(expectedAmount)} required`,
    };
  }

  if (payload.payTo.toLowerCase() !== expectedRecipient.toLowerCase()) {
    return {
      valid: false,
      error: `Invalid recipient: ${payload.payTo} !== ${expectedRecipient}`,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - payload.timestamp) > 300) {
    return { valid: false, error: "Payment timestamp expired (>5 min)" };
  }

  if (!payload.signature) {
    return { valid: false, error: "Payment signature required" };
  }

  const { verifyTypedData, recoverTypedDataAddress } = await import("viem");

  const network = payload.network as JejuNetwork;
  const domain = getEIP712Domain(network);

  const message = {
    scheme: payload.scheme,
    network: payload.network,
    asset: payload.asset,
    payTo: payload.payTo,
    amount: BigInt(payload.amount),
    resource: payload.resource,
    nonce: payload.nonce,
    timestamp: BigInt(payload.timestamp),
  };

  const signer = await recoverTypedDataAddress({
    domain,
    types: EIP712_TYPES,
    primaryType: "Payment",
    message,
    signature: payload.signature as `0x${string}`,
  });

  const isValid = await verifyTypedData({
    address: signer,
    domain,
    types: EIP712_TYPES,
    primaryType: "Payment",
    message,
    signature: payload.signature as `0x${string}`,
  });

  if (!isValid) {
    return { valid: false, error: "Invalid payment signature" };
  }

  return { valid: true, signer };
}

/**
 * Sign a payment payload using EIP-712
 */
export async function signPaymentPayload(
  payload: Omit<PaymentPayload, "signature">,
  privateKey: `0x${string}`,
): Promise<PaymentPayload> {
  const account = privateKeyToAccount(privateKey);
  const network = payload.network as JejuNetwork;
  const domain = getEIP712Domain(network);

  const message = {
    scheme: payload.scheme,
    network: payload.network,
    asset: payload.asset,
    payTo: payload.payTo,
    amount: BigInt(payload.amount),
    resource: payload.resource,
    nonce: payload.nonce,
    timestamp: BigInt(payload.timestamp),
  };

  const signature = await account.signTypedData({
    domain,
    types: EIP712_TYPES,
    primaryType: "Payment",
    message,
  });

  return { ...payload, signature };
}

/**
 * Settle payment on-chain via X402Facilitator contract
 */
export async function settlePayment(
  payload: PaymentPayload,
  settlerPrivateKey: `0x${string}`,
  network?: JejuNetwork,
): Promise<SettlementResult> {
  if (!payload.signature) {
    return {
      settled: false,
      error: "Payment signature required for settlement",
    };
  }

  const facilitatorAddress = getX402FacilitatorAddress();
  const chain = getChain(network);

  const account = privateKeyToAccount(settlerPrivateKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletClient: any = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  const client = getClient(network);

  // Check if nonce already used
  const nonceUsed = await client.readContract({
    address: facilitatorAddress,
    abi: X402_FACILITATOR_ABI,
    functionName: "isNonceUsed",
    args: [payload.payTo, payload.nonce],
  });

  if (nonceUsed) {
    return { settled: false, error: "Payment nonce already used" };
  }

  // Recover signer from signature
  const verification = await verifyPaymentSignature(
    payload,
    BigInt(payload.amount),
    payload.payTo,
  );

  if (!verification.valid || !verification.signer) {
    return { settled: false, error: verification.error || "Invalid signature" };
  }

  // Submit settlement transaction
  const hash = await walletClient.writeContract({
    address: facilitatorAddress,
    abi: X402_FACILITATOR_ABI,
    functionName: "settle",
    args: [
      verification.signer,
      payload.payTo,
      payload.asset,
      BigInt(payload.amount),
      payload.resource,
      payload.nonce,
      BigInt(payload.timestamp),
      payload.signature as `0x${string}`,
    ],
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  if (receipt.status === "reverted") {
    return { settled: false, error: "Settlement transaction reverted" };
  }

  // Extract paymentId from logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const log = receipt.logs[0] as any;
  const paymentId = log?.topics?.[1] as `0x${string}` | undefined;

  return {
    settled: true,
    paymentId,
    txHash: hash,
    blockNumber: receipt.blockNumber,
  };
}

/**
 * Check if a token is supported by the facilitator
 */
export async function isTokenSupported(
  tokenAddress: Address,
): Promise<boolean> {
  const client = getClient();
  const facilitatorAddress = getX402FacilitatorAddress();

  const supported = await client.readContract({
    address: facilitatorAddress,
    abi: X402_FACILITATOR_ABI,
    functionName: "supportedTokens",
    args: [tokenAddress],
  });

  return supported as boolean;
}

/**
 * Get facilitator stats
 */
export async function getFacilitatorStats(): Promise<{
  settlements: bigint;
  volumeUSD: bigint;
  feeBps: bigint;
  feeRecipient: Address;
}> {
  const client = getClient();
  const facilitatorAddress = getX402FacilitatorAddress();

  const result = await client.readContract({
    address: facilitatorAddress,
    abi: X402_FACILITATOR_ABI,
    functionName: "getStats",
  });

  const [settlements, volumeUSD, feeBps, feeAddr] = result as [
    bigint,
    bigint,
    bigint,
    Address,
  ];

  return {
    settlements,
    volumeUSD,
    feeBps,
    feeRecipient: feeAddr,
  };
}

// ============ High-Level Payment Functions ============

/**
 * Check if request has valid x402 payment
 */
export async function checkPayment(
  paymentHeader: string | null,
  requiredAmount: bigint,
  recipient: Address,
): Promise<{ paid: boolean; signer?: Address; error?: string }> {
  const payment = parsePaymentHeader(paymentHeader);

  if (!payment) {
    return { paid: false, error: "No valid payment header provided" };
  }

  const verification = await verifyPaymentSignature(
    payment,
    requiredAmount,
    recipient,
  );

  if (!verification.valid) {
    return { paid: false, error: verification.error };
  }

  return { paid: true, signer: verification.signer };
}

/**
 * Require payment - throws if payment invalid
 */
export async function requirePayment(
  paymentHeader: string | null,
  requiredAmount: bigint,
  recipient: Address,
): Promise<Address> {
  const result = await checkPayment(paymentHeader, requiredAmount, recipient);

  if (!result.paid) {
    throw new Error(`Payment required: ${result.error}`);
  }

  return result.signer!;
}

/**
 * Generate 402 response headers
 */
export function generate402Headers(
  requirements: PaymentRequirements,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "WWW-Authenticate": "x402",
    "X-Payment-Requirement": JSON.stringify(requirements),
    "Access-Control-Expose-Headers": "X-Payment-Requirement, WWW-Authenticate",
  };
}

/**
 * Calculate percentage-based fee
 */
export function calculateFee(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints)) / BigInt(10000);
}
