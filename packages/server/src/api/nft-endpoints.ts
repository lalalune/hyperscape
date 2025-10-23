import type { Request, Response } from 'express';
import { getGameSigner } from '../blockchain/GameSigner';
import type { Address } from 'viem';

/**
 * POST /api/mint-item
 * 
 * Generate signature for player to mint MUD item to ERC-1155 NFT
 * 
 * Body: { slot: number, itemId: number }
 * Returns: { signature, instanceId, itemId, amount }
 */
export async function mintItemEndpoint(req: Request, res: Response) {
  const playerAddress = req.user?.address as Address;
  if (!playerAddress) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { slot, itemId } = req.body;
  
  if (typeof slot !== 'number' || slot < 0 || slot >= 28) {
    return res.status(400).json({ error: 'Invalid slot (must be 0-27)' });
  }
  
  if (typeof itemId !== 'number' || itemId <= 0) {
    return res.status(400).json({ error: 'Invalid itemId' });
  }

  // TODO: Verify player owns item in MUD inventory
  // const mudItem = await getMudInventorySlot(playerAddress, slot);
  // if (!mudItem || mudItem.itemId !== itemId) {
  //   return res.status(400).json({ error: 'Item not found in inventory' });
  // }
  
  // For now, assume amount = 1 (will be queried from MUD in real implementation)
  const amount = 1;
  
  // Calculate instance ID (matches PlayerSystem.sol)
  const gameSigner = getGameSigner();
  const instanceId = gameSigner.calculateInstanceId(playerAddress, itemId, slot);
  
  // Generate signature
  const signatureData = await gameSigner.signItemMint({
    playerAddress,
    itemId,
    amount,
    instanceId,
  });

  return res.json({
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
export async function claimGoldEndpoint(req: Request, res: Response) {
  const playerAddress = req.user?.address as Address;
  if (!playerAddress) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Query MUD Coins table
  // const mudCoins = await getMudCoins(playerAddress);
  // const unclaimedAmount = mudCoins.amount - mudCoins.claimed;
  
  // For now, return mock data (will query MUD in real implementation)
  const mockUnclaimedAmount = 1000n;
  
  // TODO: Query Gold.sol nonce
  // const nonce = await goldContract.read.getNonce([playerAddress]);
  const mockNonce = 0n;

  if (mockUnclaimedAmount === 0n) {
    return res.status(400).json({ error: 'No unclaimed Gold' });
  }

  // Generate signature
  const gameSigner = getGameSigner();
  const signatureData = await gameSigner.signGoldClaim({
    playerAddress,
    amount: mockUnclaimedAmount,
  });

  return res.json({
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
export async function itemStatusEndpoint(req: Request, res: Response) {
  const { instanceId } = req.params;
  
  if (!instanceId || !instanceId.startsWith('0x')) {
    return res.status(400).json({ error: 'Invalid instanceId' });
  }

  // TODO: Query Items.sol
  // const [isMinted, originalMinter] = await itemsContract.read.checkInstance([instanceId]);
  
  return res.json({
    instanceId,
    isMinted: false, // TODO: from contract
    originalMinter: null, // TODO: from contract
  });
}

