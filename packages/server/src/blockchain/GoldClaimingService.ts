import { type Address, type Hex, encodePacked, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { MudClient } from "@hyperscape/shared/blockchain/mud-client";

/**
 * GoldClaimingService
 *
 * Handles Gold (ERC-20) claiming from MUD Coins table.
 * Players earn coins in MUD, then claim them as Gold tokens.
 */
export class GoldClaimingService {
  private gameSignerKey: Hex;
  private goldContractAddress: Address;
  private mudClient?: MudClient;

  constructor(
    gameSignerKey: Hex,
    goldContractAddress: Address,
    mudClient?: MudClient,
  ) {
    this.gameSignerKey = gameSignerKey;
    this.goldContractAddress = goldContractAddress;
    this.mudClient = mudClient;
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
      encodePacked(["address", "uint256", "uint256"], [player, amount, nonce]),
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
  async getClaimableInfo(
    player: Address,
    mudCoins: {
      amount: bigint;
      claimed: bigint;
    },
    goldNonce: bigint,
  ): Promise<{
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
   *
   * Updates MUD Coins table to mark the claimed amount as claimed.
   * This prevents double-claiming and keeps MUD state in sync with ERC-20 Gold.
   */
  async syncGoldClaim(event: {
    player: Address;
    amount: bigint;
    nonce: bigint;
  }): Promise<void> {
    console.log("[GoldClaiming] Syncing claimed Gold:", {
      player: event.player,
      amount: event.amount,
      nonce: event.nonce,
    });

    if (!this.mudClient) {
      console.warn(
        "[GoldClaiming] MUD client not available - skipping sync to MUD",
      );
      return;
    }

    try {
      // Call MUD NFTIntegrationSystem.recordGoldClaim
      // This updates the Coins table to mark amount as claimed
      if (this.mudClient.NFTIntegrationSystem?.recordGoldClaim) {
        await this.mudClient.NFTIntegrationSystem.recordGoldClaim(
          event.amount,
        );
        console.log(
          `[GoldClaiming] ✅ Successfully synced Gold claim of ${event.amount} to MUD`,
        );
      } else {
        console.warn(
          `[GoldClaiming] NFTIntegrationSystem not available in MUD World - Gold claim of ${event.amount} not synced`,
        );
      }
    } catch (err) {
      console.error("[GoldClaiming] Failed to sync Gold claim to MUD:", err);
      // Don't throw - this is a sync operation, failure shouldn't break the flow
    }
  }
}
