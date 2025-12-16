/**
 * Blockchain Routes - NFT minting, gold claims, x402 payment endpoints
 *
 * These endpoints handle blockchain integration with proper x402 payment requirements.
 * Premium features require payment before processing.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { World } from "@hyperscape/shared";
import type { Address } from "viem";
import {
  verifyServicePayment,
  getPaymentRequirements,
  type ServiceName,
} from "../../services/x402";
import { getGameSigner } from "../../blockchain/GameSigner";
import { isBlockchainConfigured } from "@hyperscape/shared/blockchain";

// Extend FastifyRequest to include user
interface AuthenticatedRequest extends FastifyRequest {
  user?: { address: string };
}

/**
 * Register blockchain-related routes with x402 payment gates
 */
export function registerBlockchainRoutes(
  fastify: FastifyInstance,
  _world: World,
): void {
  console.log("[API] Registering blockchain routes...");

  // Check if blockchain is configured
  const blockchainEnabled = isBlockchainConfigured();
  if (!blockchainEnabled) {
    console.log("[API] ⚠️ Blockchain not configured - routes will return 503");
  }

  // Get recipient address from env
  const recipientAddress = (process.env.GAME_TREASURY_ADDRESS ||
    process.env.GAME_SIGNER_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as Address;

  /**
   * GET /api/blockchain/status
   * Check blockchain integration status
   */
  fastify.get("/api/blockchain/status", async (_request, reply) => {
    return reply.send({
      enabled: blockchainEnabled,
      network: process.env.NETWORK || "localnet",
      features: {
        goldBridge: !!process.env.GOLD_ADDRESS,
        itemBridge: !!process.env.ITEMS_ADDRESS,
        bans: !!process.env.BAN_MANAGER_ADDRESS,
      },
    });
  });

  /**
   * GET /api/blockchain/payment-requirements/:service
   * Get payment requirements for a service (for client to prepare payment)
   */
  fastify.get<{ Params: { service: string } }>(
    "/api/blockchain/payment-requirements/:service",
    async (request, reply) => {
      const { service } = request.params;
      const validServices: ServiceName[] = [
        "gold-claim",
        "item-mint",
        "marketplace-list",
        "trade-escrow",
        "world-entry",
        "premium-world",
        "ai-npc",
        "guild-creation",
      ];

      if (!validServices.includes(service as ServiceName)) {
        return reply.status(400).send({ error: "Invalid service name" });
      }

      const requirements = getPaymentRequirements(
        service as ServiceName,
        recipientAddress,
      );
      return reply.send(requirements);
    },
  );

  /**
   * POST /api/blockchain/mint-item
   * Generate signature for player to mint MUD item to ERC-1155 NFT
   * Requires x402 payment
   */
  fastify.post<{ Body: { slot: number; itemId: number } }>(
    "/api/blockchain/mint-item",
    {
      preHandler: async (
        request: AuthenticatedRequest,
        reply: FastifyReply,
      ) => {
        // Check blockchain availability first
        if (!blockchainEnabled) {
          return reply.status(503).send({ error: "Blockchain not configured" });
        }

        // Verify x402 payment
        const paymentHeader =
          request.headers["x-payment"] || request.headers["payment"];
        const result = await verifyServicePayment(
          paymentHeader as string | null,
          "item-mint",
          recipientAddress,
        );

        if (!result.paid) {
          const requirements = getPaymentRequirements(
            "item-mint",
            recipientAddress,
          );
          reply.header("WWW-Authenticate", "x402");
          reply.header("X-Payment-Requirement", JSON.stringify(requirements));
          return reply.status(402).send(requirements);
        }
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const playerAddress = request.user?.address as Address;
      if (!playerAddress) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { slot, itemId } = request.body;

      if (typeof slot !== "number" || slot < 0 || slot >= 28) {
        return reply.status(400).send({ error: "Invalid slot (must be 0-27)" });
      }

      if (typeof itemId !== "number" || itemId <= 0) {
        return reply.status(400).send({ error: "Invalid itemId" });
      }

      // TODO: Verify player owns item in MUD inventory via world.getPlayerInventory
      const amount = 1;

      const gameSigner = getGameSigner();
      const instanceId = gameSigner.calculateInstanceId(
        playerAddress,
        itemId,
        slot,
      );

      const signatureData = await gameSigner.signItemMint({
        playerAddress,
        itemId,
        amount,
        instanceId,
      });

      return reply.send({
        success: true,
        signature: signatureData.signature,
        instanceId: signatureData.instanceId,
        itemId: signatureData.itemId,
        amount: signatureData.amount,
      });
    },
  );

  /**
   * POST /api/blockchain/claim-gold
   * Generate signature for player to claim Gold ERC-20 tokens
   * Requires x402 payment
   */
  fastify.post(
    "/api/blockchain/claim-gold",
    {
      preHandler: async (
        request: AuthenticatedRequest,
        reply: FastifyReply,
      ) => {
        if (!blockchainEnabled) {
          return reply.status(503).send({ error: "Blockchain not configured" });
        }

        const paymentHeader =
          request.headers["x-payment"] || request.headers["payment"];
        const result = await verifyServicePayment(
          paymentHeader as string | null,
          "gold-claim",
          recipientAddress,
        );

        if (!result.paid) {
          const requirements = getPaymentRequirements(
            "gold-claim",
            recipientAddress,
          );
          reply.header("WWW-Authenticate", "x402");
          reply.header("X-Payment-Requirement", JSON.stringify(requirements));
          return reply.status(402).send(requirements);
        }
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const playerAddress = request.user?.address as Address;
      if (!playerAddress) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // TODO: Query MUD Coins table for real unclaimed amount
      const mockUnclaimedAmount = 1000n;

      if (mockUnclaimedAmount === 0n) {
        return reply.status(400).send({ error: "No unclaimed Gold" });
      }

      const gameSigner = getGameSigner();
      const signatureData = await gameSigner.signGoldClaim({
        playerAddress,
        amount: mockUnclaimedAmount,
      });

      return reply.send({
        success: true,
        signature: signatureData.signature,
        amount: signatureData.amount.toString(),
        nonce: signatureData.nonce.toString(),
      });
    },
  );

  /**
   * GET /api/blockchain/item-status/:instanceId
   * Check if item is minted (free endpoint - no payment required)
   */
  fastify.get<{ Params: { instanceId: string } }>(
    "/api/blockchain/item-status/:instanceId",
    async (request, reply) => {
      const { instanceId } = request.params;

      if (!instanceId || !instanceId.startsWith("0x")) {
        return reply.status(400).send({ error: "Invalid instanceId" });
      }

      // TODO: Query Items.sol checkInstance
      return reply.send({
        instanceId,
        isMinted: false,
        originalMinter: null,
      });
    },
  );

  /**
   * GET /api/blockchain/gold-balance/:address
   * Get player's on-chain gold balance (free endpoint)
   */
  fastify.get<{ Params: { address: string } }>(
    "/api/blockchain/gold-balance/:address",
    async (request, reply) => {
      const { address } = request.params;

      if (!address || !address.startsWith("0x") || address.length !== 42) {
        return reply.status(400).send({ error: "Invalid address" });
      }

      if (!blockchainEnabled) {
        return reply.status(503).send({ error: "Blockchain not configured" });
      }

      // TODO: Query Gold.sol balanceOf
      return reply.send({
        address,
        balance: "0",
        formatted: "0 GOLD",
      });
    },
  );

  console.log("[API] ✅ Blockchain routes registered");
}
