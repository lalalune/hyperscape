/**
 * x402 Payment Protocol for Hyperscape 3D Engine
 * Supports in-game purchases and premium features
 */

import { Address, parseEther } from 'viem';

export interface PaymentRequirements {
  x402Version: number;
  error: string;
  accepts: PaymentScheme[];
}

export interface PaymentScheme {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: Address;
  payTo: Address;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema: string | null;
  maxTimeoutSeconds: number;
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

export const PAYMENT_TIERS = {
  // World Access
  WORLD_ENTRY: parseEther('0.01'), // 0.01 ETH to enter world
  PREMIUM_WORLD: parseEther('0.1'), // 0.1 ETH for premium worlds
  
  // Items and Assets
  PURCHASE_ITEM: parseEther('0.005'), // 0.005 ETH for in-game items
  MINT_NFT: parseEther('0.02'), // 0.02 ETH to mint game NFT
  
  // Premium Features
  AI_NPC_INTERACTION: parseEther('0.001'), // 0.001 ETH per AI NPC interaction
  PROCEDURAL_GENERATION: parseEther('0.05'), // 0.05 ETH for custom world generation
  
  // API Access
  API_CALL: parseEther('0.0001'), // 0.0001 ETH per API call
} as const;

export function createPaymentRequirement(
  resource: string,
  amount: bigint,
  description: string,
  recipientAddress: Address,
  tokenAddress: Address = '0x0000000000000000000000000000000000000000',
  network: string = 'jeju'
): PaymentRequirements {
  return {
    x402Version: 1,
    error: 'Payment required to access this resource',
    accepts: [{
      scheme: 'exact',
      network,
      maxAmountRequired: amount.toString(),
      asset: tokenAddress,
      payTo: recipientAddress,
      resource,
      description,
      mimeType: 'application/json',
      outputSchema: null,
      maxTimeoutSeconds: 300,
    }],
  };
}

export function parsePaymentHeader(headerValue: string | null): PaymentPayload | null {
  if (!headerValue) return null;
  try {
    return JSON.parse(headerValue) as PaymentPayload;
  } catch {
    return null;
  }
}

export async function checkPayment(
  paymentHeader: string | null,
  requiredAmount: bigint,
  recipient: Address
): Promise<{ paid: boolean; error?: string }> {
  const payment = parsePaymentHeader(paymentHeader);
  
  if (!payment) {
    return { paid: false, error: 'No payment' };
  }

  if (BigInt(payment.amount) < requiredAmount) {
    return { paid: false, error: 'Insufficient amount' };
  }

  if (payment.payTo.toLowerCase() !== recipient.toLowerCase()) {
    return { paid: false, error: 'Invalid recipient' };
  }

  return { paid: true };
}

