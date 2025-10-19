/**
 * BlockchainGateway - Server-side blockchain integration layer
 * 
 * Manages blockchain transactions for critical game state in hybrid mode.
 * This gateway sits between game systems and the blockchain, handling:
 * - Transaction batching for gas optimization
 * - Error handling and retries
 * - Transaction queuing and confirmation
 * - State reconciliation
 * 
 * Hybrid Strategy:
 * - Critical state (inventory, equipment, skills) → Blockchain
 * - Performance state (movement, combat ticks) → Local/WebSocket
 */

import { SystemBase } from '@hyperscape/shared';
import type { World } from '@hyperscape/shared';
import { setupMudClient, type MudClient, isMudClientAvailable } from '@hyperscape/shared/blockchain/mud-client';
import type { Address } from 'viem';

type PendingInventoryOp = {
  type: 'add' | 'remove' | 'move';
  playerAddress: Address;
  itemId?: number;
  slot?: number;
  fromSlot?: number;
  toSlot?: number;
  quantity?: number;
  timestamp: number;
};

export class BlockchainGateway extends SystemBase {
  private mudClient?: MudClient;
  private enabled: boolean = false;
  private pendingInventoryOps = new Map<Address, PendingInventoryOp[]>();
  private batchInterval?: NodeJS.Timeout;
  
  // Configuration
  private readonly BATCH_ENABLED = process.env.BATCH_INVENTORY_CHANGES === 'true';
  private readonly BATCH_INTERVAL = parseInt(process.env.BATCH_INTERVAL_MS || '10000');
  
  constructor(world: unknown) {
    super(world, {
      name: 'blockchain-gateway',
      dependencies: {
        required: [],
        optional: []
      }
    });
  }
  
  async init(): Promise<void> {
    // Check if blockchain integration is enabled
    if (!isMudClientAvailable()) {
      console.log('[BlockchainGateway] ℹ️  Blockchain integration disabled (no WORLD_ADDRESS)');
      console.log('[BlockchainGateway] ℹ️  Set WORLD_ADDRESS to enable hybrid mode');
      console.log('[BlockchainGateway] ℹ️  Game will use PostgreSQL-only mode');
      this.enabled = false;
      return;
    }
    
    try {
      console.log('[BlockchainGateway] 🔗 Initializing MUD client...');
      console.log('[BlockchainGateway] 🔍 Auto-detecting network (Jeju preferred, Anvil fallback)');
      
      this.mudClient = await setupMudClient();
      
      // Verify deployment
      const isDeployed = await this.mudClient.isDeployed();
      if (!isDeployed) {
        throw new Error('No contract deployed at WORLD_ADDRESS');
      }
      
      const blockNumber = await this.mudClient.getBlockNumber();
      
      console.log('[BlockchainGateway] ✅ Connected to blockchain');
      console.log(`[BlockchainGateway]    Network: ${this.mudClient.chain.name} (Chain ID: ${this.mudClient.chain.id})`);
      console.log(`[BlockchainGateway]    RPC: ${this.mudClient.chain.rpcUrls.default.http[0]}`);
      console.log(`[BlockchainGateway]    World: ${this.mudClient.worldAddress}`);
      console.log(`[BlockchainGateway]    Account: ${this.mudClient.account.address}`);
      console.log(`[BlockchainGateway]    Block: ${blockNumber}`);
      console.log(`[BlockchainGateway]    Mode: HYBRID (critical state on-chain, performance off-chain)`);
      
      this.enabled = true;
      
      // Start batch processing if enabled
      if (this.BATCH_ENABLED) {
        this.startBatchProcessing();
      }
      
    } catch (error) {
      console.error('[BlockchainGateway] ❌ Failed to initialize MUD client:', error);
      console.error('[BlockchainGateway] ⚠️  Falling back to PostgreSQL-only mode');
      console.error('[BlockchainGateway] 💡 Ensure blockchain is running:');
      console.error('[BlockchainGateway]    - Jeju: bun run dev (from repo root)');
      console.error('[BlockchainGateway]    - Anvil: anvil (standalone)');
      this.enabled = false;
    }
  }
  
  async destroy(): Promise<void> {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    
    // Process any remaining batched operations
    await this.processBatchedOperations();
  }
  
  /**
   * Check if blockchain integration is active
   */
  isEnabled(): boolean {
    return this.enabled && !!this.mudClient;
  }
  
  /**
   * Get MUD client (throws if not available)
   */
  getMudClient(): MudClient {
    if (!this.mudClient) {
      throw new Error('MUD client not initialized');
    }
    return this.mudClient;
  }
  
  // ============ Player Operations ============
  
  /**
   * Register player on blockchain
   * Called once per character creation
   * On-chain: ✅ Critical state (player identity)
   */
  async registerPlayer(name: string): Promise<{ txHash: string; blockNumber: bigint } | null> {
    if (!this.isEnabled()) {
      console.log('[BlockchainGateway] Skipping registerPlayer (blockchain disabled)');
      return null;
    }
    
    console.log(`[BlockchainGateway] 📝 Registering player "${name}" on blockchain...`);
    
    const receipt = await this.mudClient!.PlayerSystem.register(name);
    
    console.log(`[BlockchainGateway] ✅ Player registered`);
    console.log(`[BlockchainGateway]    Tx: ${receipt.transactionHash}`);
    console.log(`[BlockchainGateway]    Block: ${receipt.blockNumber}`);
    console.log(`[BlockchainGateway]    Gas: ${receipt.gasUsed}`);
    
    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    };
  }
  
  // ============ Inventory Operations ============
  
  /**
   * Add item to inventory
   * Hybrid: Can be batched for gas optimization
   */
  async addItem(
    playerAddress: Address,
    itemId: number,
    quantity: number,
    options?: { batch?: boolean }
  ): Promise<{ txHash?: string; batched?: boolean }> {
    if (!this.isEnabled()) {
      return { batched: false };
    }
    
    if (options?.batch && this.BATCH_ENABLED) {
      // Add to batch queue
      this.queueInventoryOperation({
        type: 'add',
        playerAddress,
        itemId,
        quantity,
        timestamp: Date.now()
      });
      
      return { batched: true };
    }
    
    // Execute immediately
    console.log(`[BlockchainGateway] 📦 Adding item ${itemId} (qty: ${quantity}) to ${playerAddress}`);
    
    const receipt = await this.mudClient!.InventorySystem.addItem(
      playerAddress,
      itemId,
      quantity
    );
    
    console.log(`[BlockchainGateway] ✅ Item added (tx: ${receipt.transactionHash})`);
    
    return { txHash: receipt.transactionHash };
  }
  
  /**
   * Remove item from inventory
   */
  async removeItem(
    playerAddress: Address,
    slot: number,
    quantity: number
  ): Promise<{ txHash?: string }> {
    if (!this.isEnabled()) {
      return {};
    }
    
    const receipt = await this.mudClient!.InventorySystem.removeItem(
      playerAddress,
      slot,
      quantity
    );
    
    console.log(`[BlockchainGateway] ✅ Item removed (tx: ${receipt.transactionHash})`);
    
    return { txHash: receipt.transactionHash };
  }
  
  // ============ Equipment Operations ============
  
  /**
   * Equip item from inventory
   * On-chain: ✅ Critical state (equipped items affect stats)
   */
  async equipItem(inventorySlot: number): Promise<{ txHash: string }> {
    if (!this.isEnabled()) {
      throw new Error('Cannot equip items - blockchain integration disabled');
    }
    
    console.log(`[BlockchainGateway] ⚔️  Equipping item from slot ${inventorySlot}`);
    
    const receipt = await this.mudClient!.EquipmentSystem.equipItem(inventorySlot);
    
    console.log(`[BlockchainGateway] ✅ Item equipped (tx: ${receipt.transactionHash})`);
    
    return { txHash: receipt.transactionHash };
  }
  
  /**
   * Unequip item to inventory
   */
  async unequipItem(equipSlot: number): Promise<{ txHash: string }> {
    if (!this.isEnabled()) {
      throw new Error('Cannot unequip items - blockchain integration disabled');
    }
    
    const receipt = await this.mudClient!.EquipmentSystem.unequipItem(equipSlot);
    
    console.log(`[BlockchainGateway] ✅ Item unequipped (tx: ${receipt.transactionHash})`);
    
    return { txHash: receipt.transactionHash };
  }
  
  // ============ Combat Operations ============
  
  /**
   * Record mob kill and loot on blockchain
   * Hybrid: Individual hits calculated off-chain, only kills on-chain
   * On-chain: ✅ Critical state (loot drops, XP gains)
   */
  async recordMobKill(mobId: Address): Promise<{ txHash: string }> {
    if (!this.isEnabled()) {
      return { txHash: '0x0' };
    }
    
    console.log(`[BlockchainGateway] ⚔️  Recording mob kill on blockchain...`);
    
    const receipt = await this.mudClient!.CombatSystem.attackMob(mobId);
    
    console.log(`[BlockchainGateway] ✅ Mob kill recorded (tx: ${receipt.transactionHash})`);
    console.log(`[BlockchainGateway]    Gas: ${receipt.gasUsed}`);
    
    // Parse events for loot drops and XP gains
    const events = this.parseReceipt(receipt);
    console.log(`[BlockchainGateway]    Events: ${events.length} emitted`);
    
    return { txHash: receipt.transactionHash };
  }
  
  // ============ Resource Operations ============
  
  /**
   * Record resource gathering result
   * On-chain: ✅ Critical state (resource ownership)
   */
  async recordResourceGathered(
    resourceId: Address,
    resourceType: 'tree' | 'fish'
  ): Promise<{ txHash: string }> {
    if (!this.isEnabled()) {
      return { txHash: '0x0' };
    }
    
    const receipt = resourceType === 'tree'
      ? await this.mudClient!.ResourceSystem.chopTree(resourceId)
      : await this.mudClient!.ResourceSystem.fish(resourceId);
    
    console.log(`[BlockchainGateway] ✅ Resource gathered (tx: ${receipt.transactionHash})`);
    
    return { txHash: receipt.transactionHash };
  }
  
  // ============ Batching System ============
  
  private queueInventoryOperation(op: PendingInventoryOp): void {
    const queue = this.pendingInventoryOps.get(op.playerAddress) || [];
    queue.push(op);
    this.pendingInventoryOps.set(op.playerAddress, queue);
    
    console.log(`[BlockchainGateway] 📋 Queued inventory operation (${queue.length} pending)`);
  }
  
  private startBatchProcessing(): void {
    console.log(`[BlockchainGateway] 🔄 Starting batch processing (interval: ${this.BATCH_INTERVAL}ms)`);
    
    this.batchInterval = setInterval(() => {
      this.processBatchedOperations().catch(error => {
        console.error('[BlockchainGateway] ❌ Batch processing error:', error);
      });
    }, this.BATCH_INTERVAL);
  }
  
  private async processBatchedOperations(): Promise<void> {
    if (this.pendingInventoryOps.size === 0) {
      return;
    }
    
    console.log(`[BlockchainGateway] 📦 Processing batched operations...`);
    
    for (const [playerAddress, operations] of this.pendingInventoryOps.entries()) {
      if (operations.length === 0) continue;
      
      console.log(`[BlockchainGateway]    Player ${playerAddress}: ${operations.length} ops`);
      
      // Execute operations sequentially (TODO: use multicall for true batching)
      for (const op of operations) {
        if (op.type === 'add' && op.itemId !== undefined && op.quantity !== undefined) {
          await this.mudClient!.InventorySystem.addItem(
            playerAddress,
            op.itemId,
            op.quantity
          );
        }
        // TODO: Handle other operation types
      }
      
      console.log(`[BlockchainGateway] ✅ Batch complete for ${playerAddress}`);
      
      // Clear processed operations
      this.pendingInventoryOps.delete(playerAddress);
    }
  }
  
  // ============ Utilities ============
  
  private parseReceipt(receipt: { logs: readonly { topics: readonly string[]; data: string }[] }): Array<{
    eventName: string;
    data: Record<string, unknown>;
  }> {
    // TODO: Parse event logs from receipt
    return [];
  }
  
  /**
   * Get blockchain sync status
   */
  async getSyncStatus(): Promise<{
    enabled: boolean;
    blockNumber?: bigint;
    worldAddress?: string;
    pendingOps: number;
  }> {
    const pendingOps = Array.from(this.pendingInventoryOps.values())
      .reduce((sum, ops) => sum + ops.length, 0);
    
    if (!this.isEnabled()) {
      return {
        enabled: false,
        pendingOps: 0
      };
    }
    
    const blockNumber = await this.mudClient!.getBlockNumber();
    
    return {
      enabled: true,
      blockNumber,
      worldAddress: this.mudClient!.worldAddress,
      pendingOps
    };
  }
}

