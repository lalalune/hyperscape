import { type Address, type Hex, encodePacked, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { MudClient } from "@hyperscape/shared/blockchain/mud-client";

/**
 * ItemMintingService
 *
 * Handles item minting from MUD game state to ERC-1155 NFTs.
 * Generates signatures for Items.mintItem() and syncs minted status.
 */
export class ItemMintingService {
  private gameSignerKey: Hex;
  private itemsContractAddress: Address;
  private mudClient?: MudClient;

  constructor(
    gameSignerKey: Hex,
    itemsContractAddress: Address,
    mudClient?: MudClient,
  ) {
    this.gameSignerKey = gameSignerKey;
    this.itemsContractAddress = itemsContractAddress;
    this.mudClient = mudClient;
  }

  /**
   * Generate signature for player to mint item to ERC-1155
   *
   * Flow:
   * 1. Player has item in MUD inventory
   * 2. Player requests mint signature from server
   * 3. Server verifies ownership in MUD
   * 4. Server generates signature
   * 5. Player calls Items.mintItem() with signature
   * 6. Server listens to ItemMinted event
   * 7. Server calls NFTIntegrationSystem.markItemAsMinted()
   */
  async generateMintSignature(params: {
    player: Address;
    itemId: number;
    amount: number;
    instanceId: Hex;
  }): Promise<{
    signature: Hex;
    instanceId: Hex;
    itemId: number;
    amount: number;
  }> {
    const { player, itemId, amount, instanceId } = params;

    // Signature matches Items.sol:
    // sign(keccak256(abi.encodePacked(msg.sender, itemId, amount, instanceId)))
    const messageHash = keccak256(
      encodePacked(
        ["address", "uint256", "uint256", "bytes32"],
        [player, BigInt(itemId), BigInt(amount), instanceId],
      ),
    );

    const account = privateKeyToAccount(this.gameSignerKey);
    const signature = await account.signMessage({
      message: { raw: messageHash },
    });

    return {
      signature,
      instanceId,
      itemId,
      amount,
    };
  }

  /**
   * Calculate instance ID (must match MUD PlayerSystem._calculateInstanceId)
   */
  calculateInstanceId(player: Address, itemId: number, slot: number): Hex {
    // Matches PlayerSystem.sol:
    // keccak256(abi.encodePacked(player, itemId, slot, "hyperscape"))
    return keccak256(
      encodePacked(
        ["address", "uint16", "uint8", "string"],
        [player, itemId, slot, "hyperscape"],
      ),
    );
  }

  /**
   * Sync minted item status to MUD after ItemMinted event
   *
   * Called by event listener when Items.ItemMinted fires.
   * Updates MUD's NFTIntegrationSystem to mark the item as minted.
   */
  async syncMintedItem(event: {
    minter: Address;
    itemId: bigint;
    instanceId: Hex;
    amount: bigint;
  }): Promise<void> {
    console.log("[ItemMinting] Syncing minted item:", {
      minter: event.minter,
      itemId: event.itemId,
      instanceId: event.instanceId,
      amount: event.amount,
    });

    if (!this.mudClient) {
      console.warn(
        "[ItemMinting] MUD client not available - skipping sync to MUD",
      );
      return;
    }

    try {
      // Call MUD NFTIntegrationSystem.markItemAsMinted
      // This updates the on-chain state to reflect that the item has been minted as an NFT
      if (
        this.mudClient.NFTIntegrationSystem?.markItemAsMinted
      ) {
        await this.mudClient.NFTIntegrationSystem.markItemAsMinted(
          event.instanceId,
          Number(event.itemId),
        );
        console.log(
          `[ItemMinting] ✅ Successfully synced minted item ${event.itemId} to MUD`,
        );
      } else {
        console.warn(
          `[ItemMinting] NFTIntegrationSystem not available in MUD World - item ${event.itemId} minted but not synced`,
        );
        console.log(
          `[ItemMinting] Instance ID: ${event.instanceId}, Minter: ${event.minter}, Amount: ${event.amount}`,
        );
      }
    } catch (err) {
      console.error("[ItemMinting] Failed to sync minted item to MUD:", err);
      // Don't throw - this is a sync operation, failure shouldn't break the flow
    }
  }
}
