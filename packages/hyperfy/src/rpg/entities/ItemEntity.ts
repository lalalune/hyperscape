/**
 * ItemEntity - Represents items in the RPG world
 * Replaces item-based RPGApps with server-authoritative entities
 */

import * as THREE from '../../core/extras/three';
import { RPGEntity, RPGEntityConfig, EntityInteractionData, EntityWorld } from './RPGEntity';

export interface ItemEntityConfig extends RPGEntityConfig {
  type: 'item';
  itemType: 'weapon' | 'armor' | 'consumable' | 'resource' | 'currency' | 'tool';
  itemId: string; // Item definition ID
  quantity: number;
  stackable: boolean;
  value: number;
  weight: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stats?: Record<string, number>; // Weapon/armor stats
  requirements?: Record<string, number>; // Level requirements
  effects?: Array<{ type: string; value: number; duration?: number }>; // Item effects
}

export class ItemEntity extends RPGEntity {
  protected config: ItemEntityConfig;

  constructor(world: EntityWorld, config: ItemEntityConfig) {
    super(world, {
      ...config,
      interactable: true,
      interactionType: 'pickup',
      interactionDistance: 2.0
    });
    
    this.config = config;
  }

  /**
   * Create visual representation based on item type
   */
  protected async createMesh(): Promise<void> {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    let material: THREE.Material;

    // Color based on rarity
    switch (this.config.rarity) {
      case 'common':
        material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        break;
      case 'uncommon':
        material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        break;
      case 'rare':
        material = new THREE.MeshStandardMaterial({ color: 0x0080ff });
        break;
      case 'epic':
        material = new THREE.MeshStandardMaterial({ color: 0x8000ff });
        break;
      case 'legendary':
        material = new THREE.MeshStandardMaterial({ color: 0xff8000 });
        break;
      default:
        material = new THREE.MeshStandardMaterial({ color: 0x888888 });
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `item_${this.config.itemId}`;
    
    // Add item metadata
    (this.mesh as any).userData = {
      ...((this.mesh as any).userData || {}),
      itemType: this.config.itemType,
      itemId: this.config.itemId,
      quantity: this.config.quantity,
      rarity: this.config.rarity
    };

    console.log(`[ItemEntity] Created mesh for ${this.config.itemType}: ${this.name}`);
  }

  /**
   * Handle pickup interaction
   */
  protected async onInteract(data: EntityInteractionData): Promise<void> {
    if (data.interactionType !== 'pickup') return;

    console.log(`[ItemEntity] Player ${data.playerId} picking up ${this.config.itemId} x${this.config.quantity}`);

    // Send pickup event to inventory system
    this.world.emit('item:pickup_request', {
      playerId: data.playerId,
      entityId: this.id,
      itemId: this.config.itemId,
      itemType: this.config.itemType,
      quantity: this.config.quantity,
      value: this.config.value,
      weight: this.config.weight,
      stats: this.config.stats,
      requirements: this.config.requirements,
      effects: this.config.effects,
      rarity: this.config.rarity,
      stackable: this.config.stackable
    });

    // Remove from world after pickup
    this.destroy();
  }

  /**
   * Server-side update logic
   */
  protected serverUpdate(deltaTime: number): void {
    // Items might have special behaviors (decay, effects, etc.)
    super.serverUpdate(deltaTime);

    // Example: Items decay after some time
    const maxAge = this.getProperty('maxAge', 300); // 5 minutes default
    const age = this.world.getTime() - this.getProperty('spawnTime', this.world.getTime());
    
    if (age > maxAge) {
      console.log(`[ItemEntity] ${this.name} decayed after ${age} seconds`);
      this.destroy();
    }
  }

  /**
   * Get item data for inventory/UI
   */
  getItemData(): any {
    return {
      id: this.id,
      itemId: this.config.itemId,
      name: this.name,
      type: this.config.itemType,
      quantity: this.config.quantity,
      value: this.config.value,
      weight: this.config.weight,
      rarity: this.config.rarity,
      stackable: this.config.stackable,
      stats: this.config.stats,
      requirements: this.config.requirements,
      effects: this.config.effects,
      description: this.config.description
    };
  }

  /**
   * Update quantity (for stackable items)
   */
  setQuantity(quantity: number): void {
    if (!this.world.isServer) return;
    
    this.config.quantity = Math.max(0, quantity);
    this.markNetworkDirty();
    
    // Destroy if quantity reaches 0
    if (this.config.quantity <= 0) {
      this.destroy();
    }
  }

  /**
   * Add to quantity (for stackable items)
   */
  addQuantity(amount: number): number {
    if (!this.world.isServer) return 0;
    if (!this.config.stackable) return 0;
    
    const oldQuantity = this.config.quantity;
    this.config.quantity += amount;
    this.markNetworkDirty();
    
    return this.config.quantity - oldQuantity;
  }

  /**
   * Check if item can stack with another
   */
  canStackWith(other: ItemEntity): boolean {
    return this.config.stackable &&
           other.config.stackable &&
           this.config.itemId === other.config.itemId &&
           this.config.rarity === other.config.rarity;
  }

  /**
   * Get network data including item-specific properties
   */
  getNetworkData(): any {
    return {
      ...super.getNetworkData(),
      itemType: this.config.itemType,
      itemId: this.config.itemId,
      quantity: this.config.quantity,
      value: this.config.value,
      weight: this.config.weight,
      rarity: this.config.rarity,
      stackable: this.config.stackable,
      stats: this.config.stats,
      requirements: this.config.requirements,
      effects: this.config.effects
    };
  }
}