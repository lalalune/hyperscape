import { type Address, type Hex, encodePacked, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * ItemMintingService
 *
 * Handles item minting from MUD game state to ERC-1155 NFTs.
 * Generates signatures for Items.mintItem() and syncs minted status.
 */
export class ItemMintingService {
  private gameSignerKey: Hex;
  private itemsContractAddress: Address;

  constructor(gameSignerKey: Hex, itemsContractAddress: Address) {
    this.gameSignerKey = gameSignerKey;
    this.itemsContractAddress = itemsContractAddress;
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
   */
  async syncMintedItem(event: {
    minter: Address;
    itemId: bigint;
    instanceId: Hex;
    amount: bigint;
  }): Promise<void> {
    // This should call MUD World's NFTIntegrationSystem.markItemAsMinted
    // Implementation depends on MUD client setup
    console.log("[ItemMinting] Syncing minted item:", {
      minter: event.minter,
      itemId: event.itemId,
      instanceId: event.instanceId,
      amount: event.amount,
    });

    // TODO: Call MUD transaction
    // await mudWorld.write.hyperscape__markItemAsMinted([event.instanceId, event.itemId]);
  }
}
