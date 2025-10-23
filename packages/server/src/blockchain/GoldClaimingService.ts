import { type Address, type Hex, encodePacked, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * GoldClaimingService
 * 
 * Handles Gold (ERC-20) claiming from MUD Coins table.
 * Players earn coins in MUD, then claim them as Gold tokens.
 */
export class GoldClaimingService {
  private gameSignerKey: Hex;
  private goldContractAddress: Address;

  constructor(gameSignerKey: Hex, goldContractAddress: Address) {
    this.gameSignerKey = gameSignerKey;
    this.goldContractAddress = goldContractAddress;
  }

  /**
   * Generate signature for player to claim Gold tokens
   * 
   * Flow:
   * 1. Player earns coins in MUD (Coins table tracks amount)
   * 2. Player requests claim signature from server
   * 3. Server checks Coins.claimed vs Coins.amount
   * 4. Server generates signature for unclaimed amount
   * 5. Player calls Gold.claimGold() with signature
   * 6. Server listens to GoldClaimed event
   * 7. Server calls NFTIntegrationSystem.recordGoldClaim()
   */
  async generateClaimSignature(params: {
    player: Address;
    amount: bigint;
    nonce: bigint;
  }): Promise<{
    signature: Hex;
    amount: bigint;
    nonce: bigint;
  }> {
    const { player, amount, nonce } = params;

    // Signature matches Gold.sol:
    // sign(keccak256(abi.encodePacked(player, amount, nonce)))
    const messageHash = keccak256(
      encodePacked(['address', 'uint256', 'uint256'], [player, amount, nonce])
    );

    const account = privateKeyToAccount(this.gameSignerKey);
    const signature = await account.signMessage({
      message: { raw: messageHash },
    });

    return {
      signature,
      amount,
      nonce,
    };
  }

  /**
   * Get claimable Gold for player
   * Queries MUD Coins table and Gold.sol nonce
   */
  async getClaimableInfo(player: Address, mudCoins: {
    amount: bigint;
    claimed: bigint;
  }, goldNonce: bigint): Promise<{
    claimableAmount: bigint;
    nonce: bigint;
  }> {
    const unclaimedCoins = mudCoins.amount - mudCoins.claimed;
    
    return {
      claimableAmount: unclaimedCoins,
      nonce: goldNonce,
    };
  }

  /**
   * Sync Gold claim to MUD after GoldClaimed event
   */
  async syncGoldClaim(event: {
    player: Address;
    amount: bigint;
    nonce: bigint;
  }): Promise<void> {
    console.log('[GoldClaiming] Syncing claimed Gold:', {
      player: event.player,
      amount: event.amount,
      nonce: event.nonce,
    });

    // TODO: Call MUD transaction
    // await mudWorld.write.hyperscape__recordGoldClaim([event.amount]);
  }
}

