/**
 * @fileoverview NFT Drop System
 * @module hyperscape/server/blockchain/NFTDropSystem
 * 
 * Handles burning NFTs to drop items back into the game world.
 * When a player burns an NFT, this system:
 * 1. Listens for burn events from HyperscapeItems contract
 * 2. Spawns the item entity in the game world
 * 3. Other players can pick up the dropped item
 * 4. Item can be re-minted by new owner
 * 
 * Security:
 * - Only reacts to verified on-chain burn events
 * - Instance ID is unmarked as minted
 * - Item becomes available for anyone to pick up
 * - Re-minting requires new signature
 */

import { ethers, Contract, EventLog } from 'ethers';
import type { Log } from 'ethers';

export interface NFTBurnEvent {
  player: string;
  tokenId: bigint;
  instanceId: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface ItemDropConfig {
  instanceId: string;
  itemId: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  stats: {
    attack: number;
    defense: number;
    strength: number;
  };
  rarity: number;
}

export class NFTDropSystem {
  private provider: ethers.JsonRpcProvider;
  private contract: Contract;
  private isListening: boolean = false;
  private onDropCallback?: (drop: ItemDropConfig) => void;

  // HyperscapeItems ABI (minimal, just what we need)
  private static readonly ABI = [
    'event ItemBurned(address indexed player, uint256 indexed tokenId, bytes32 instanceId)',
    'function getItemMetadata(uint256 tokenId) view returns (tuple(string itemId, bytes32 instanceId, uint16 attack, uint16 defense, uint16 strength, uint8 rarity, uint64 mintedAt))'
  ];

  constructor(
    rpcUrl: string,
    contractAddress: string
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new Contract(contractAddress, NFTDropSystem.ABI, this.provider);
  }

  /**
   * Start listening for burn events
   */
  async startListening(onDrop: (drop: ItemDropConfig) => void): Promise<void> {
    if (this.isListening) {
      console.warn('[NFTDropSystem] Already listening');
      return;
    }

    this.onDropCallback = onDrop;
    this.isListening = true;

    // Listen for new burn events
    this.contract.on('ItemBurned', async (player: string, tokenId: bigint, instanceId: string, event: Log) => {
      console.log('[NFTDropSystem] NFT burned:', {
        player,
        tokenId: tokenId.toString(),
        instanceId: instanceId.substring(0, 20) + '...',
        block: event.blockNumber
      });

      await this.handleBurnEvent({
        player,
        tokenId,
        instanceId,
        timestamp: Date.now(),
        blockNumber: event.blockNumber || 0,
        transactionHash: event.transactionHash || ''
      });
    });

    // Also check for recent burns we might have missed
    await this.syncRecentBurns();

    console.log('[NFTDropSystem] Started listening for NFT burns');
  }

  /**
   * Stop listening for burn events
   */
  stopListening(): void {
    if (!this.isListening) return;

    this.contract.removeAllListeners('ItemBurned');
    this.isListening = false;
    this.onDropCallback = undefined;

    console.log('[NFTDropSystem] Stopped listening');
  }

  /**
   * Handle a burn event
   */
  private async handleBurnEvent(event: NFTBurnEvent): Promise<void> {
    if (!this.onDropCallback) {
      console.warn('[NFTDropSystem] No callback registered');
      return;
    }

    try {
      // Get metadata about the burned item
      // Note: This will fail for already-burned tokens, which is expected
      // We'll need to store metadata before burn or get it from events
      
      // For now, we'll create a drop with default position (player's last known position)
      // In production, burn transaction should include position data
      
      const drop: ItemDropConfig = {
        instanceId: event.instanceId,
        itemId: 'unknown', // Should be retrieved from game state or event data
        position: {
          x: 0, // Should be from burn transaction or player position
          y: 0,
          z: 0
        },
        stats: {
          attack: 0, // Should be from stored metadata
          defense: 0,
          strength: 0
        },
        rarity: 0
      };

      // Call the callback to spawn the item in-game
      this.onDropCallback(drop);

      console.log('[NFTDropSystem] Item dropped in world:', {
        instanceId: event.instanceId.substring(0, 20) + '...',
        player: event.player.substring(0, 10) + '...'
      });

    } catch (error) {
      console.error('[NFTDropSystem] Error handling burn event:', error);
    }
  }

  /**
   * Sync recent burn events (last 1000 blocks)
   */
  private async syncRecentBurns(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);

      console.log('[NFTDropSystem] Syncing burns from block', fromBlock, 'to', currentBlock);

      const filter = this.contract.filters.ItemBurned();
      const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);

      console.log('[NFTDropSystem] Found', events.length, 'recent burn events');

      for (const event of events) {
        if (event instanceof EventLog) {
          const { player, tokenId, instanceId } = event.args;
          
          await this.handleBurnEvent({
            player: player as string,
            tokenId: tokenId as bigint,
            instanceId: instanceId as string,
            timestamp: Date.now(),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
          });
        }
      }

    } catch (error) {
      console.error('[NFTDropSystem] Error syncing recent burns:', error);
    }
  }

  /**
   * Manually trigger a drop (for testing)
   */
  async testDrop(drop: ItemDropConfig): Promise<void> {
    if (this.onDropCallback) {
      this.onDropCallback(drop);
      console.log('[NFTDropSystem] Test drop triggered');
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return this.contract.target as string;
  }

  /**
   * Check if listening
   */
  isActive(): boolean {
    return this.isListening;
  }
}

/**
 * Integration with game server
 */
export class NFTDropIntegration {
  private dropSystem?: NFTDropSystem;
  private itemSpawnCallback?: (drop: ItemDropConfig) => void;

  /**
   * Initialize the NFT drop system
   */
  async initialize(
    rpcUrl: string,
    contractAddress: string,
    onItemSpawn: (drop: ItemDropConfig) => void
  ): Promise<void> {
    this.itemSpawnCallback = onItemSpawn;
    this.dropSystem = new NFTDropSystem(rpcUrl, contractAddress);

    await this.dropSystem.startListening((drop) => {
      this.handleDrop(drop);
    });

    console.log('[NFTDropIntegration] Initialized and listening for NFT drops');
  }

  /**
   * Handle a dropped item
   */
  private handleDrop(drop: ItemDropConfig): void {
    if (!this.itemSpawnCallback) {
      console.warn('[NFTDropIntegration] No spawn callback registered');
      return;
    }

    console.log('[NFTDropIntegration] Processing NFT drop:', {
      instanceId: drop.instanceId.substring(0, 20) + '...',
      itemId: drop.itemId,
      position: drop.position
    });

    // Spawn the item in the game world
    this.itemSpawnCallback(drop);

    // Emit event that game systems can listen to
    // This would integrate with your World event system
    // this.world.emit(EventType.ITEM_RESPAWN, { ... });
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.dropSystem) {
      this.dropSystem.stopListening();
      this.dropSystem = undefined;
    }
    console.log('[NFTDropIntegration] Shutdown complete');
  }

  /**
   * Check if active
   */
  isActive(): boolean {
    return this.dropSystem?.isActive() ?? false;
  }
}

/**
 * Example usage in game server:
 * 
 * ```typescript
 * import { NFTDropIntegration } from './blockchain/NFTDropSystem';
 * 
 * const nftDrops = new NFTDropIntegration();
 * 
 * await nftDrops.initialize(
 *   'http://localhost:8545',
 *   '0xHyperscapeItemsAddress',
 *   (drop) => {
 *     // Spawn item entity in game
 *     entityManager.spawnEntity({
 *       id: drop.instanceId,
 *       name: drop.itemId,
 *       type: 'item',
 *       position: drop.position,
 *       itemId: drop.itemId,
 *       stats: drop.stats,
 *       rarity: drop.rarity
 *     });
 *   }
 * );
 * ```
 */

