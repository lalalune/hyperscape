/**
 * @fileoverview Item Instance Tracking System
 * @module hyperscape/shared/systems/ItemInstanceSystem
 * 
 * Prevents item duplication by tracking unique instance IDs for every spawned item.
 * Implements pessimistic locking to handle race conditions when multiple players
 * attempt to pick up the same item simultaneously.
 * 
 * Security Features:
 * - Unique instance ID per spawned item (keccak256 hash)
 * - Pessimistic locking on pickup attempts
 * - First-pickup-wins semantics
 * - Integration with MUD ItemInstance table
 * - Integration with on-chain NFT minting
 * 
 * Architecture:
 * - Server authoritative (all decisions made server-side)
 * - In-memory lock registry for performance
 * - MUD table for persistent storage
 * - Event-based communication
 */

import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';
import { Logger } from '../utils/Logger';
import type { World } from '../World';
import { keccak256, solidityPacked, randomBytes } from 'ethers';

export interface ItemInstance {
  instanceId: string; // Unique keccak256 hash
  itemId: string; // Item definition ID (e.g., "bronze_sword")
  owner: string | null; // Player address, null if on ground
  isMinted: boolean; // Has been minted as NFT
  mintedTokenId: bigint | null; // NFT token ID if minted
  createdAt: number; // Timestamp
  position: {
    x: number;
    y: number;
    z: number;
  } | null;
  isOnGround: boolean;
}

interface ItemLock {
  instanceId: string;
  playerId: string;
  acquiredAt: number;
  expiresAt: number;
}

export class ItemInstanceSystem extends SystemBase {
  private instances: Map<string, ItemInstance> = new Map();
  private locks: Map<string, ItemLock> = new Map();
  private readonly LOCK_TIMEOUT_MS = 5000; // 5 seconds
  private readonly CLEANUP_INTERVAL_MS = 30000; // 30 seconds

  constructor(world: World) {
    super(world, {
      name: 'item-instance',
      dependencies: {
        required: [],
        optional: ['entity-manager', 'inventory', 'database']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Subscribe to item spawn events
    this.subscribe(EventType.ITEM_SPAWNED, (data) => {
      this.handleItemSpawn(data as { 
        entityId: string; 
        itemId: string; 
        position: { x: number; y: number; z: number };
        spawnedBy?: string;
      });
    });

    // Subscribe to item pickup attempts
    this.subscribe(EventType.ITEM_PICKUP_ATTEMPT, (data) => {
      this.handlePickupAttempt(data as {
        playerId: string;
        instanceId: string;
        entityId: string;
      });
    });

    // Subscribe to NFT mint events
    this.subscribe(EventType.ITEM_MINTED_AS_NFT, (data) => {
      this.handleItemMinted(data as {
        instanceId: string;
        tokenId: bigint;
        owner: string;
      });
    });

    // Subscribe to NFT burn events (drop back in game)
    this.subscribe(EventType.ITEM_NFT_BURNED, (data) => {
      this.handleNFTBurned(data as {
        instanceId: string;
        position: { x: number; y: number; z: number };
      });
    });

    // Start cleanup timer for expired locks
    this.createInterval(() => {
      this.cleanupExpiredLocks();
    }, this.CLEANUP_INTERVAL_MS);

    Logger.system('ItemInstanceSystem', 'Initialized - preventing item duplication');
  }

  /**
   * Generate a unique instance ID for a new item
   */
  generateInstanceId(itemId: string, playerId: string): string {
    const timestamp = Date.now();
    const random = randomBytes(32);
    
    const hash = keccak256(
      solidityPacked(
        ['string', 'string', 'uint256', 'bytes32'],
        [itemId, playerId, timestamp, random]
      )
    );
    
    return hash;
  }

  /**
   * Handle item spawn - create instance record
   */
  private handleItemSpawn(data: {
    entityId: string;
    itemId: string;
    position: { x: number; y: number; z: number };
    spawnedBy?: string;
  }): void {
    // Generate unique instance ID
    const instanceId = this.generateInstanceId(
      data.itemId,
      data.spawnedBy || 'system'
    );

    // Create instance record
    const instance: ItemInstance = {
      instanceId,
      itemId: data.itemId,
      owner: null,
      isMinted: false,
      mintedTokenId: null,
      createdAt: Date.now(),
      position: data.position,
      isOnGround: true
    };

    this.instances.set(instanceId, instance);

    // TODO: Persist to MUD ItemInstance table
    // ItemInstance.set(instanceId, { ... });

    Logger.system('ItemInstanceSystem', `Created instance ${instanceId.substring(0, 10)}... for ${data.itemId}`);

    // Emit event with instance ID so entity can store it
    this.emitTypedEvent(EventType.ITEM_INSTANCE_CREATED, {
      entityId: data.entityId,
      instanceId,
      itemId: data.itemId
    });
  }

  /**
   * Handle pickup attempt with pessimistic locking
   */
  private async handlePickupAttempt(data: {
    playerId: string;
    instanceId: string;
    entityId: string;
  }): Promise<void> {
    const { playerId, instanceId, entityId } = data;

    // Get instance
    const instance = this.instances.get(instanceId);
    if (!instance) {
      Logger.systemError('ItemInstanceSystem', `Instance not found: ${instanceId}`, new Error('Instance not found'));
      this.emitTypedEvent(EventType.ITEM_PICKUP_FAILED, {
        playerId,
        instanceId,
        reason: 'Instance not found'
      });
      return;
    }

    // Check if already owned
    if (instance.owner !== null) {
      Logger.system('ItemInstanceSystem', `Item already owned by ${instance.owner}`);
      this.emitTypedEvent(EventType.ITEM_PICKUP_FAILED, {
        playerId,
        instanceId,
        reason: 'Already picked up'
      });
      return;
    }

    // Try to acquire lock
    const lockAcquired = this.tryAcquireLock(instanceId, playerId);
    if (!lockAcquired) {
      Logger.system('ItemInstanceSystem', `Failed to acquire lock for ${instanceId.substring(0, 10)}...`);
      this.emitTypedEvent(EventType.ITEM_PICKUP_FAILED, {
        playerId,
        instanceId,
        reason: 'Lock contention'
      });
      return;
    }

    try {
      // Double-check ownership (race condition protection)
      const currentInstance = this.instances.get(instanceId);
      if (!currentInstance || currentInstance.owner !== null) {
        this.releaseLock(instanceId);
        this.emitTypedEvent(EventType.ITEM_PICKUP_FAILED, {
          playerId,
          instanceId,
          reason: 'Already picked up (race condition)'
        });
        return;
      }

      // Assign ownership
      instance.owner = playerId;
      instance.isOnGround = false;
      instance.position = null;

      // Persist change
      // TODO: Update MUD ItemInstance table
      // ItemInstance.setOwner(instanceId, playerId);
      // ItemInstance.setIsOnGround(instanceId, false);

      Logger.system('ItemInstanceSystem', `Player ${playerId} picked up ${instance.itemId} (${instanceId.substring(0, 10)}...)`);

      // Emit success event
      this.emitTypedEvent(EventType.ITEM_PICKUP_SUCCESS, {
        playerId,
        instanceId,
        itemId: instance.itemId,
        entityId
      });

    } finally {
      // Always release lock
      this.releaseLock(instanceId);
    }
  }

  /**
   * Try to acquire a lock on an item instance
   */
  private tryAcquireLock(instanceId: string, playerId: string): boolean {
    const now = Date.now();

    // Check for existing lock
    const existingLock = this.locks.get(instanceId);
    if (existingLock) {
      // Check if expired
      if (now < existingLock.expiresAt) {
        return false; // Lock still active
      }
      // Lock expired, remove it
      this.locks.delete(instanceId);
    }

    // Acquire new lock
    const lock: ItemLock = {
      instanceId,
      playerId,
      acquiredAt: now,
      expiresAt: now + this.LOCK_TIMEOUT_MS
    };

    this.locks.set(instanceId, lock);
    return true;
  }

  /**
   * Release a lock
   */
  private releaseLock(instanceId: string): void {
    this.locks.delete(instanceId);
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [instanceId, lock] of this.locks.entries()) {
      if (now >= lock.expiresAt) {
        this.locks.delete(instanceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.system('ItemInstanceSystem', `Cleaned up ${cleaned} expired locks`);
    }
  }

  /**
   * Handle item minted as NFT
   */
  private handleItemMinted(data: {
    instanceId: string;
    tokenId: bigint;
    owner: string;
  }): void {
    const instance = this.instances.get(data.instanceId);
    if (!instance) {
      Logger.systemError('ItemInstanceSystem', `Cannot mint - instance not found: ${data.instanceId}`, new Error('Instance not found'));
      return;
    }

    if (instance.isMinted) {
      Logger.systemError('ItemInstanceSystem', `Instance already minted: ${data.instanceId}`, new Error('Already minted'));
      return;
    }

    // Mark as minted
    instance.isMinted = true;
    instance.mintedTokenId = data.tokenId;
    instance.owner = data.owner;

    // TODO: Update MUD table
    // ItemInstance.setIsMinted(data.instanceId, true);
    // ItemInstance.setMintedTokenId(data.instanceId, data.tokenId);

    Logger.system('ItemInstanceSystem', `Item ${instance.itemId} minted as NFT #${data.tokenId} (instance: ${data.instanceId.substring(0, 10)}...)`);
  }

  /**
   * Handle NFT burned (dropped back in game)
   */
  private handleNFTBurned(data: {
    instanceId: string;
    position: { x: number; y: number; z: number };
  }): void {
    const instance = this.instances.get(data.instanceId);
    if (!instance) {
      Logger.systemError('ItemInstanceSystem', `Cannot burn - instance not found: ${data.instanceId}`, new Error('Instance not found'));
      return;
    }

    // Reset minting status
    instance.isMinted = false;
    instance.mintedTokenId = null;
    instance.owner = null;
    instance.isOnGround = true;
    instance.position = data.position;

    // TODO: Update MUD table
    // ItemInstance.setIsMinted(data.instanceId, false);
    // ItemInstance.setMintedTokenId(data.instanceId, null);
    // ItemInstance.setOwner(data.instanceId, null);
    // ItemInstance.setIsOnGround(data.instanceId, true);

    Logger.system('ItemInstanceSystem', `NFT burned, item ${instance.itemId} dropped at (${data.position.x}, ${data.position.y}, ${data.position.z})`);

    // Spawn item entity in world
    this.emitTypedEvent(EventType.ITEM_RESPAWN, {
      instanceId: data.instanceId,
      itemId: instance.itemId,
      position: data.position
    });
  }

  /**
   * Check if an instance exists and is available for pickup
   */
  canPickup(instanceId: string): { canPickup: boolean; reason?: string } {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { canPickup: false, reason: 'Instance not found' };
    }

    if (instance.owner !== null) {
      return { canPickup: false, reason: 'Already owned' };
    }

    if (instance.isMinted) {
      return { canPickup: false, reason: 'Minted as NFT' };
    }

    if (!instance.isOnGround) {
      return { canPickup: false, reason: 'Not on ground' };
    }

    const lock = this.locks.get(instanceId);
    if (lock && Date.now() < lock.expiresAt) {
      return { canPickup: false, reason: 'Locked by another player' };
    }

    return { canPickup: true };
  }

  /**
   * Get instance by ID
   */
  getInstance(instanceId: string): ItemInstance | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Get instances by owner
   */
  getInstancesByOwner(owner: string): ItemInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.owner === owner
    );
  }

  /**
   * Get mintable instances (owned but not yet minted)
   */
  getMintableInstances(owner: string): ItemInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.owner === owner && !instance.isMinted
    );
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalInstances: number;
    ownedInstances: number;
    mintedInstances: number;
    groundInstances: number;
    activeLocks: number;
  } {
    const instances = Array.from(this.instances.values());
    
    return {
      totalInstances: instances.length,
      ownedInstances: instances.filter(i => i.owner !== null).length,
      mintedInstances: instances.filter(i => i.isMinted).length,
      groundInstances: instances.filter(i => i.isOnGround).length,
      activeLocks: this.locks.size
    };
  }
}

