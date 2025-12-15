import type { FastifyRequest, FastifyReply } from "fastify";
import { getGameSigner } from "../blockchain/GameSigner";
import type { Address } from "viem";

// Extended request type with user data
interface AuthenticatedRequest extends FastifyRequest {
  user?: { address: string };
}

/**
 * POST /api/mint-item
 *
 * Generate signature for player to mint MUD item to ERC-1155 NFT
 *
 * Body: { slot: number, itemId: number }
 * Returns: { signature, instanceId, itemId, amount }
 */
export async function mintItemEndpoint(req: AuthenticatedRequest, reply: FastifyReply) {
  const playerAddress = req.user?.address as Address;
  if (!playerAddress) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const body = req.body as { slot?: number; itemId?: number };
  const { slot, itemId } = body;

  if (typeof slot !== "number" || slot < 0 || slot >= 28) {
    return reply.status(400).send({ error: "Invalid slot (must be 0-27)" });
  }

  if (typeof itemId !== "number" || itemId <= 0) {
    return reply.status(400).send({ error: "Invalid itemId" });
  }

  // TODO: Verify player owns item in MUD inventory
  // const mudItem = await getMudInventorySlot(playerAddress, slot);
  // if (!mudItem || mudItem.itemId !== itemId) {
  //   return reply.status(400).send({ error: 'Item not found in inventory' });
  // }

  // For now, assume amount = 1 (will be queried from MUD in real implementation)
  const amount = 1;

  // Calculate instance ID (matches PlayerSystem.sol)
  const gameSigner = getGameSigner();
  const instanceId = gameSigner.calculateInstanceId(
    playerAddress,
    itemId,
    slot,
  );

  // Generate signature
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
}

/**
 * POST /api/claim-gold
 *
 * Generate signature for player to claim MUD Coins as Gold ERC-20 tokens
 *
 * Returns: { signature, amount, nonce }
 */
export async function claimGoldEndpoint(req: AuthenticatedRequest, reply: FastifyReply) {
  const playerAddress = req.user?.address as Address;
  if (!playerAddress) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  // TODO: Query MUD Coins table
  // const mudCoins = await getMudCoins(playerAddress);
  // const unclaimedAmount = mudCoins.amount - mudCoins.claimed;

  // For now, return mock data (will query MUD in real implementation)
  const mockUnclaimedAmount = 1000n;

  // TODO: Query Gold.sol nonce
  // const nonce = await goldContract.read.getNonce([playerAddress]);

  if (mockUnclaimedAmount <= 0n) {
    return reply.status(400).send({ error: "No unclaimed Gold" });
  }

  // Generate signature
  const gameSigner = getGameSigner();
  const signatureData = await gameSigner.signGoldClaim({
    playerAddress,
    amount: mockUnclaimedAmount,
  });

  return reply.send({
    success: true,
    signature: signatureData.signature,
    amount: signatureData.amount,
    nonce: signatureData.nonce,
  });
}

/**
 * GET /api/item-status/:instanceId
 *
 * Check if item is minted by querying Items.sol
 *
 * Returns: { isMinted, originalMinter }
 */
export async function itemStatusEndpoint(req: FastifyRequest<{ Params: { instanceId: string } }>, reply: FastifyReply) {
  const { instanceId } = req.params;

  if (!instanceId || !instanceId.startsWith("0x")) {
    return reply.status(400).send({ error: "Invalid instanceId" });
  }

  // TODO: Query Items.sol
  // const [isMinted, originalMinter] = await itemsContract.read.checkInstance([instanceId]);

  return reply.send({
    instanceId,
    isMinted: false, // TODO: from contract
    originalMinter: null, // TODO: from contract
  });
}
