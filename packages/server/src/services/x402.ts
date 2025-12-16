/**
 * X402 Payment Middleware for Hyperscape
 *
 * Re-exports from @hyperscape/shared/blockchain for server use.
 * Use createPaymentMiddleware for Express-style middleware.
 */

import {
  checkPayment,
  createPaymentRequirement,
  generate402Headers,
  GAME_PAYMENT_TIERS,
  type PaymentRequirements,
} from "@hyperscape/shared/blockchain";
import type { Address } from "viem";

export type ServiceName =
  | "gold-claim"
  | "item-mint"
  | "marketplace-list"
  | "trade-escrow"
  | "world-entry"
  | "premium-world"
  | "ai-npc"
  | "guild-creation";

const SERVICE_AMOUNTS: Record<ServiceName, bigint> = {
  "gold-claim": GAME_PAYMENT_TIERS.ITEM_PURCHASE,
  "item-mint": GAME_PAYMENT_TIERS.ITEM_MINT_NFT,
  "marketplace-list": GAME_PAYMENT_TIERS.ITEM_PURCHASE,
  "trade-escrow": GAME_PAYMENT_TIERS.ITEM_PURCHASE,
  "world-entry": GAME_PAYMENT_TIERS.WORLD_ENTRY,
  "premium-world": GAME_PAYMENT_TIERS.PREMIUM_WORLD,
  "ai-npc": GAME_PAYMENT_TIERS.AI_NPC_INTERACTION,
  "guild-creation": GAME_PAYMENT_TIERS.GUILD_CREATION,
};

interface Request {
  headers: Record<string, string | undefined>;
}

interface Response {
  status(code: number): Response;
  json(data: Record<string, unknown>): void;
  set(headers: Record<string, string>): void;
}

/**
 * Create Express middleware that requires x402 payment
 */
export function createPaymentMiddleware(
  service: ServiceName,
  recipientAddress: Address
) {
  const amount = SERVICE_AMOUNTS[service];

  return async (req: Request, res: Response, next: () => void) => {
    const paymentHeader = req.headers["x-payment"] || req.headers["payment"];

    const result = await checkPayment(paymentHeader || null, amount, recipientAddress);

    if (!result.paid) {
      const requirements = createPaymentRequirement(
        service,
        amount,
        `Payment for ${service}`,
        recipientAddress
      );
      const headers = generate402Headers(requirements);
      res.set(headers);
      res.status(402).json(requirements);
      return;
    }

    next();
  };
}

/**
 * Simple payment verification without middleware
 */
export async function verifyServicePayment(
  paymentHeader: string | null,
  service: ServiceName,
  recipientAddress: Address
): Promise<{ paid: boolean; signer?: Address; error?: string }> {
  const amount = SERVICE_AMOUNTS[service];
  return checkPayment(paymentHeader, amount, recipientAddress);
}

/**
 * Get payment requirements for a service
 */
export function getPaymentRequirements(
  service: ServiceName,
  recipientAddress: Address
): PaymentRequirements {
  const amount = SERVICE_AMOUNTS[service];
  return createPaymentRequirement(
    service,
    amount,
    `Payment for ${service}`,
    recipientAddress
  );
}

// Re-export shared utilities
export {
  checkPayment,
  createPaymentRequirement,
  generate402Headers,
  GAME_PAYMENT_TIERS,
} from "@hyperscape/shared/blockchain";
