/**
 * ItemEntity - Represents items in the world
 * Replaces item-based Apps with server-authoritative entities
 */

import THREE from '../extras/three';
import type { World } from '../World';
import type { ItemType, MeshUserData, Item } from '../types/core';
import { EquipmentSlotName, WeaponType } from '../types/core';
import type { EntityInteractionData, ItemEntityConfig } from '../types/entities';
import { InteractableEntity, type InteractableConfig } from './InteractableEntity';
import { EventType } from '../types/events';

// Re-export types for external use
export type { ItemEntityConfig } from '../types/entities';

export class ItemEntity extends InteractableEntity {
  protected config: ItemEntityConfig;

  constructor(world: World, config: ItemEntityConfig) {
    // Convert ItemEntityConfig to InteractableConfig format
    const interactableConfig: InteractableConfig = {
      ...config,
      interaction: {
        prompt: 'Take',
        description: `${config.name} - ${config.description || 'An item'}`,
        range: 2.0,
        cooldown: 0,
        usesRemaining: 1, // Items can only be picked up once
        maxUses: 1,
        effect: 'pickup'
      }
    };
    
    super(world, interactableConfig);
    this.config = config;
    
    // Items don't have health - set to 0 to prevent health bars
    this.health = 0;
    this.maxHealth = 0;
  }

  protected async createMesh(): Promise<void> {
    console.log(`[ItemEntity] createMesh() called for ${this.config.itemId}`, {
      hasModelPath: !!this.config.model,
      modelPath: this.config.model,
      hasLoader: !!this.world.loader,
      isServer: this.world.isServer,
      isClient: this.world.isClient
    });
    
    // SKIP 3D MODEL LOADING - Use clean sphere fallbacks
    // Models would cause 404 errors until /world-assets/forge/ is populated
    // Uncomment below when you have actual GLB files
    
    // No model path or model failed to load - create subtle fallback mesh
    if (this.world.isServer) {
      return; // Don't create fallback mesh on server
    }
    
    console.log(`[ItemEntity] No model path for ${this.config.itemId}, creating minimal fallback sphere`);
    
    // Create a very small, subtle sphere as fallback
    // This makes items pickupable without being visually intrusive
    const geometry = new THREE.SphereGeometry(0.12, 8, 6);
    
    // Get subtle color based on item type
    let color = 0xC0C0C0; // Default: Silver-gray
    const nameLower = this.config.name.toLowerCase();
    
    if (nameLower.includes('bronze')) color = 0xCD7F32;
    else if (nameLower.includes('steel')) color = 0xB0C4DE;
    else if (nameLower.includes('gold') || nameLower.includes('coin')) color = 0xFFD700;
    else if (nameLower.includes('wood') || nameLower.includes('log')) color = 0x8B4513;
    else if (nameLower.includes('fish')) color = 0xB0E0E6;
    
    const material = new THREE.MeshLambertMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      emissive: color,
      emissiveIntensity: 0.05
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `Item_${this.config.itemId}`;
    this.mesh.scale.set(0.8, 0.8, 0.8); // Small
    this.mesh.castShadow = false; // Don't cast shadows for small items
    this.mesh.receiveShadow = false;
    
    // Set up node userData for interaction system
    this.node.userData.type = 'item';
    this.node.userData.entityId = this.id;
    this.node.userData.interactable = true;
    this.node.userData.itemData = {
      id: this.id,
      itemId: this.config.itemId,
      name: this.config.name,
      type: this.config.itemType,
      quantity: this.config.quantity
    };
    
    // Also set mesh userData
    this.mesh.userData = { ...this.node.userData };
    
    // Add mesh to node
    this.node.add(this.mesh);
  }

  /**
   * Handle item interaction - implements InteractableEntity.handleInteraction
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    // Handle item pickup - emit ITEM_PICKUP event which will be handled by InventorySystem
    this.world.emit(EventType.ITEM_PICKUP, {
      playerId: data.playerId,
      itemId: this.id,
      entityId: this.id,
      position: this.getPosition()
    });
    
    // Item is consumed after pickup, so it will be destroyed by the system
  }

  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);

    // Floating animation - mesh position is RELATIVE to node, not absolute world position
    // Node is already positioned at terrain height, so just offset from that
    if (this.mesh && this.mesh.position && this.mesh.rotation) {
      const time = this.world.getTime() * 0.001;
      this.mesh.position.y = 0.5 + Math.sin(time * 2) * 0.1; // Float above node position
      this.mesh.rotation.y += deltaTime * 0.5;
    }

    // Check for despawn conditions
    this.checkDespawn();
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);

    // Same floating animation on client - mesh position is RELATIVE to node
    if (this.mesh && this.mesh.position && this.mesh.rotation) {
      const time = this.world.getTime() * 0.001;
      this.mesh.position.y = 0.5 + Math.sin(time * 2) * 0.1; // Float above node position
      this.mesh.rotation.y += deltaTime * 0.5;
    }
  }

  private checkDespawn(): void {
    // Items despawn after 10 minutes if not picked up
    const despawnTime = this.getProperty('spawnTime', this.world.getTime()) + (10 * 60 * 1000);
    if (this.world.getTime() > despawnTime) {
      this.destroy();
    }
  }

  // REMOVED: Dead code - glow effects not used
  // Items should use actual 3D models, not colored cube proxies



  // Get item data for systems
  getItemData(): Item {
    return {
      id: this.config.itemId,
      name: this.config.name,
      type: this.config.itemType as ItemType, // Cast string to ItemType enum
      quantity: this.config.quantity || 1,
      stackable: this.config.stackable,
      maxStackSize: 100,
      value: this.config.value,
      weight: this.config.weight || 0,
      equipSlot: this.config.armorSlot ? this.config.armorSlot as EquipmentSlotName : null,
      weaponType: WeaponType.NONE,
      equipable: this.config.armorSlot ? true : false,
      attackType: null,
      description: this.config.description,
      examine: this.config.examine || '',
      tradeable: true,
      rarity: this.config.rarity,
      modelPath: this.config.modelPath || '',
      iconPath: this.config.iconPath || '',
      healAmount: this.config.healAmount || 0,
      stats: {
        attack: this.config.stats.attack || 0,
        defense: this.config.stats.defense || 0,
        strength: this.config.stats.strength || 0
      },
      bonuses: {
        attack: 0,
        defense: 0,
        ranged: 0,
        strength: 0
      },
      requirements: {
        level: this.config.requirements.level || 1,
        skills: {} as Partial<Record<string, number>>
      }
    };
  }

  // Quantity management
  setQuantity(quantity: number): void {
    this.config.quantity = Math.max(0, quantity);
    
    // Update userData
    if (this.mesh?.userData) {
      const userData = this.mesh.userData as MeshUserData;
      if (userData.itemData && typeof userData.itemData === 'object') {
        const itemData = userData.itemData as { quantity?: number };
        itemData.quantity = this.config.quantity;
      }
    }

    // Destroy if quantity reaches 0
    if (this.config.quantity <= 0) {
      this.destroy();
    }

    this.markNetworkDirty();
  }

  addQuantity(amount: number): number {
    if (!this.config.stackable && amount > 0) {
      return 0; // Can't add to non-stackable items
    }

    const oldQuantity = this.config.quantity;
    this.setQuantity(this.config.quantity + amount);
    return this.config.quantity - oldQuantity;
  }

  // Check if this item can stack with another
  canStackWith(other: ItemEntity): boolean {
    return this.config.stackable && 
           other.config.stackable &&
           this.config.itemId === other.config.itemId &&
           this.config.itemType === other.config.itemType;
  }

  // Network data override
  getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();
    return {
      ...baseData,
      itemId: this.config.itemId,
      itemType: this.config.itemType,
      quantity: this.config.quantity,
      value: this.config.value,
      rarity: this.config.rarity,
      stackable: this.config.stackable
    };
  }
}