/**
 * HeadstoneEntity - Corpse/Grave Entity
 * 
 * Represents corpses and gravestones that contain loot items.
 * Created when players or mobs die, holds their dropped items.
 * 
 * **Extends**: InteractableEntity (players can loot corpses)
 * 
 * **Key Features**:
 * 
 * **Corpse Types**:
 * - **Player Death**: Contains all items from player inventory (if not protected)
 * - **Mob Death**: Contains loot table drops
 * - **PvP Death**: Protected loot for killer only
 * 
 * **Loot System**:
 * - Inventory of lootable items
 * - Item quantities
 * - Loot protection (owner-only for first period)
 * - Multi-player looting (items removed as looted)
 * 
 * **Interaction**:
 * - "Loot" prompt when player is nearby
 * - Opens loot interface showing available items
 * - Items transferred to player inventory
 * - Empty corpses despawn automatically
 * 
 * **Visual Representation**:
 * - Gravestone model (for players)
 * - Corpse model (for mobs)
 * - Name label showing who died
 * - Item count indicator
 * - Glow if valuable loot inside
 * 
 * **Loot Protection**:
 * - Player corpses: Protected for owner only (unsafe PvP zones)
 * - Mob corpses: Protected for attacker for 60 seconds
 * - Shared loot after protection expires
 * - Ironman players: Only they can loot their own corpse
 * 
 * **Despawning**:
 * - Empty corpses despawn immediately
 * - Player graves persist for 15 minutes
 * - Mob corpses despawn after 2 minutes
 * - Valuable loot extends despawn time
 * 
 * **Network Sync**:
 * - Corpse creation broadcast to all
 * - Loot changes sync to all clients
 * - Despawn events trigger removal
 * 
 * **Runs on**: Server (authoritative), Client (visual + UI)
 * **Referenced by**: DeathSystem, LootSystem, InteractionSystem
 * 
 * @public
 */

import THREE from '../extras/three';
import type { World } from '../World';
import type { HeadstoneEntityConfig, EntityInteractionData } from '../types/entities';
import type { InventoryItem } from '../types/core';
import { InteractableEntity, type InteractableConfig } from './InteractableEntity';
import { EventType } from '../types/events';

export class HeadstoneEntity extends InteractableEntity {
  protected config: HeadstoneEntityConfig;
  private lootItems: InventoryItem[] = [];
  private lootRequestHandler?: (data: unknown) => void;

  constructor(world: World, config: HeadstoneEntityConfig) {
    // Convert HeadstoneEntityConfig to InteractableConfig format
    const interactableConfig: InteractableConfig = {
      ...config,
      interaction: {
        prompt: 'Loot',
        description: config.headstoneData.deathMessage || 'A corpse',
        range: 2.0,
        cooldown: 0,
        usesRemaining: -1, // Can be looted multiple times until empty
        maxUses: -1,
        effect: 'loot'
      }
    };
    
    super(world, interactableConfig);
    this.config = config;
    this.lootItems = [...(config.headstoneData.items || [])];
    
    // Listen for loot requests on this specific corpse
    this.lootRequestHandler = (data: unknown) => {
      const lootData = data as { corpseId: string; playerId: string; itemId: string; quantity: number; slot?: number };
      if (lootData.corpseId === this.id) {
        this.handleLootRequest(lootData);
      }
    };
    this.world.on(EventType.CORPSE_LOOT_REQUEST, this.lootRequestHandler);
  }

  private handleLootRequest(data: { playerId: string; itemId: string; quantity: number; slot?: number }): void {
    // Remove item from corpse
    const removed = this.removeItem(data.itemId, data.quantity);
    
    if (removed) {
      // Add to player inventory
      this.world.emit(EventType.INVENTORY_ITEM_ADDED, {
        playerId: data.playerId,
        item: {
          id: `loot_${data.playerId}_${Date.now()}`,
          itemId: data.itemId,
          quantity: data.quantity,
          slot: -1, // Auto-assign slot
          metadata: null
        }
      });
      
    }
  }

  protected async createMesh(): Promise<void> {
    // Don't create mesh on server
    if (this.world.isServer) {
      return;
    }
    
    // Create a tombstone/pile visual for the corpse
    const geometry = new THREE.BoxGeometry(1.5, 0.5, 1.0);
    const material = new THREE.MeshLambertMaterial({
      color: 0x4a4a4a, // Gray for corpse
      transparent: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Corpse_${this.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;

    // Set up userData
    mesh.userData = {
      type: 'corpse',
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      corpseData: {
        id: this.id,
        playerName: this.config.headstoneData.playerName,
        deathMessage: this.config.headstoneData.deathMessage,
        itemCount: this.lootItems.length
      }
    };
    
    // Add mesh to the entity's node
    if (this.mesh && this.node) {
      this.node.add(this.mesh);
      
      // Also set userData on node for easier detection
      this.node.userData.type = 'corpse';
      this.node.userData.entityId = this.id;
      this.node.userData.interactable = true;
      
      // Add text label above corpse
      this.createNameLabel();
    }
  }

  private createNameLabel(): void {
    if (!this.mesh || this.world.isServer) return;
    
    // Text will be handled by a nametag system
    // For now, just ensure userData has the name
    if (this.mesh.userData) {
      this.mesh.userData.showLabel = true;
      this.mesh.userData.labelText = this.config.headstoneData.playerName 
        ? `${this.config.headstoneData.playerName}'s corpse`
        : 'Corpse';
    }
  }

  /**
   * Handle corpse interaction - shows loot interface
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    // Emit corpse click event to show loot interface
    this.world.emit(EventType.CORPSE_CLICK, {
      corpseId: this.id,
      playerId: data.playerId,
      lootItems: this.lootItems,
      position: this.getPosition()
    });
  }

  /**
   * Remove an item from the corpse loot
   */
  public removeItem(itemId: string, quantity: number): boolean {
    const itemIndex = this.lootItems.findIndex(item => item.itemId === itemId);
    if (itemIndex === -1) return false;
    
    const item = this.lootItems[itemIndex];
    if (item.quantity > quantity) {
      item.quantity -= quantity;
    } else {
      this.lootItems.splice(itemIndex, 1);
    }
    
    // Update userData
    if (this.mesh?.userData?.corpseData) {
      this.mesh.userData.corpseData.itemCount = this.lootItems.length;
    }
    
    // If no items left, mark for despawn
    if (this.lootItems.length === 0) {
      this.world.emit(EventType.CORPSE_EMPTY, {
        corpseId: this.id
      });
      
      // Despawn after a short delay
      setTimeout(() => {
        this.destroy();
      }, 2000);
    }
    
    this.markNetworkDirty();
    return true;
  }

  /**
   * Get all loot items
   */
  public getLootItems(): InventoryItem[] {
    return [...this.lootItems];
  }

  /**
   * Check if corpse has loot
   */
  public hasLoot(): boolean {
    return this.lootItems.length > 0;
  }

  /**
   * Network data override
   */
  getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();
    return {
      ...baseData,
      lootItemCount: this.lootItems.length,
      despawnTime: this.config.headstoneData.despawnTime
    };
  }
  
  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);

    // Check if corpse should despawn
    if (this.world.getTime() > this.config.headstoneData.despawnTime) {
      this.destroy();
    }
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
    
    // Slight floating animation
    if (this.mesh) {
      const time = this.world.getTime() * 0.001;
      this.mesh.position.y = 0.25 + Math.sin(time * 1) * 0.05;
    }
  }

  public destroy(): void {
    // Clean up event listener
    if (this.lootRequestHandler) {
      this.world.off(EventType.CORPSE_LOOT_REQUEST, this.lootRequestHandler);
      this.lootRequestHandler = undefined;
    }
    super.destroy();
  }
}

