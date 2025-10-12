/**
 * Item Pickup System
 * 
 * Handles ground items, pickup interactions, and drop mechanics.
 * Items appear as colored cubes that players can click to pick up.
 */

import THREE from '../extras/three';
import type {
  ItemDropPayload,
  ItemPickupPayload,
  ItemPickupRequestPayload,
  PlayerEnterPayload,
  PlayerLeavePayload
} from '../types/event-payloads';
import { EventType } from '../types/events';
import { GroundItem, Item, World } from '../types/core';
import { ItemPickupSystemInfo as SystemInfo } from '../types/system-types';
import { safeSceneAdd } from '../utils/EntityUtils';
import { SystemBase } from './SystemBase';

const _v3_1 = new THREE.Vector3()

export class ItemPickupSystem extends SystemBase {
  private groundItems: Map<string, GroundItem> = new Map();
  private itemColors: Map<string, number> = new Map();
  private lastUpdate: number = 0;
  private updateInterval: number = 1000; // Update every second

  constructor(world: World) {
    super(world, {
      name: 'item-pickup',
      dependencies: {
        required: [], // Item pickup can work independently
        optional: ['inventory', 'loot', 'ui', 'client-graphics'] // Better with inventory and graphics systems
      },
      autoCleanup: true
    });
    this.initializeItemColors();
  }

  async init(): Promise<void> {
    
    // Set up type-safe event subscriptions for item pickup mechanics
    this.subscribe<ItemDropPayload>(EventType.ITEM_DROP, (data) => this.handleItemDrop(data));
    this.subscribe<ItemPickupPayload>(EventType.ITEM_PICKUP, (data) => this.handleItemPickup(data));
    this.subscribe<ItemPickupRequestPayload>(EventType.ITEM_PICKUP_REQUEST, (data) => this.handlePickupRequest(data));
    
  }



  /**
   * Initialize item type colors for visual representation
   */
  private initializeItemColors(): void {
    this.itemColors.set('weapon', 0xFFFFFF);       // White for weapons
    this.itemColors.set('armor', 0x8B4513);        // Brown for armor
    this.itemColors.set('shield', 0x4169E1);       // Blue for shields
    this.itemColors.set('ammunition', 0xFFD700);   // Gold for arrows
    this.itemColors.set('food', 0x32CD32);         // Green for food
    this.itemColors.set('resource', 0x654321);     // Dark brown for resources
    this.itemColors.set('tool', 0xC0C0C0);         // Silver for tools
    this.itemColors.set('coin', 0xFFD700);         // Gold for coins
  }

  /**
   * Drop an item at a specific location
   */
  public dropItem(item: Item, position: { x: number; y: number; z: number }, droppedBy: string): string {
    const itemId = `ground_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create visual representation
    const mesh: THREE.Mesh = this.createItemMesh(item, itemId);
    mesh.position.set(position.x, position.y, position.z);
    mesh.position.y += 0.5; // Slightly above ground
    
    // Add to world scene
    safeSceneAdd(this.world, mesh as unknown as THREE.Object3D);
    
    const groundItem: GroundItem = {
      id: itemId,
      item: item,
      position: _v3_1.copy(position),
      mesh: mesh,
      droppedBy: droppedBy,
      droppedAt: Date.now(),
      despawnTime: Date.now() + (5 * 60 * 1000) // 5 minutes despawn time
    };
    this.groundItems.set(itemId, groundItem);
    
    // Emit drop event for other systems
    this.emitTypedEvent(EventType.ITEM_DROPPED, { playerId: droppedBy, itemId, position });
    
    return itemId;
  }

  /**
   * Create visual mesh for ground item
   * Uses small subtle geometries instead of large colored cubes
   */
  private createItemMesh(item: Item, itemId: string): THREE.Mesh {
    // Create a small, subtle sphere for all ground items
    // This makes items pickupable without visual clutter
    // In the future, this should load actual 3D models for each item
    
    const geometry = new THREE.SphereGeometry(0.15, 8, 6); // Small sphere for all items
    
    // Use subtle, realistic colors instead of bright test colors
    const material = new THREE.MeshLambertMaterial({ 
      color: this.getItemColor(item),
      transparent: true,
      opacity: 0.7, // More transparent
      emissive: this.getItemColor(item),
      emissiveIntensity: 0.1 // Subtle glow
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `ground_item_${item.name.replace(/\s+/g, '_')}`;
    mesh.scale.set(0.5, 0.5, 0.5); // Make it even smaller
    
    // Add interaction data for raycasting
    mesh.userData = {
      type: 'ground_item',
      itemId: itemId,
      itemType: item.type,
      itemName: item.name,
      interactive: true,
      clickable: true
    };

    // Add PhysX collider for interaction (small sphere)
    mesh.userData.physx = {
      type: 'sphere',
      radius: 0.15,
      collider: true,
      trigger: false,
      interactive: true
    };

    // Add floating animation
    mesh.userData.startTime = Date.now();
    
    return mesh;
  }

  /**
   * Get item color based on type and material
   */
  private getItemColor(item: Item): number {
    // First check for specific material colors
    const nameLower = item.name.toLowerCase();
    
    if (nameLower.includes('bronze')) return 0xCD7F32;
    if (nameLower.includes('steel')) return 0xC0C0C0;
    if (nameLower.includes('mithril')) return 0x4169E1;
    if (nameLower.includes('leather')) return 0x8B4513;
    
    // Fall back to type-based colors
    return this.itemColors.get(item.type) || 0x808080;
  }

  /**
   * Handle player join event
   */
  private handlePlayerJoin(event: PlayerEnterPayload): void {
    // Player joined - could track player for item proximity checks
    console.log(`[ItemPickupSystem] Player joined: ${event.playerId}`);
  }

  /**
   * Handle player leave event
   */
  private handlePlayerLeave(_event: PlayerLeavePayload): void {
    // Player left - clean up any player-specific item data
    // console.log(`[ItemPickupSystem] Player left: ${event.playerId}`);
  }

  /**
   * Handle pickup request from player interaction
   */
  private handlePickupRequest(event: ItemPickupRequestPayload): void {
    const groundItem = this.groundItems.get(event.itemId);
    if (!groundItem) {
      return;
    }

    const player = this.world.getPlayer(event.playerId);
    if (!player) {
      return;
    }

    // Check if player is close enough to pick up
    const distance = player.node.position.distanceTo(groundItem.position);
    
    if (distance > 3.0) { // 3 meter pickup range
      this.sendMessage(event.playerId, 'You are too far away to pick up that item.', 'warning');
      return;
    }

    // Try to add to inventory
    const item = groundItem.item;
    this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
      playerId: event.playerId,
      item: {
        id: item.id,
        name: item.name,
        type: item.type,
        quantity: 1, // Ground items are always quantity 1
        stackable: item.stackable || false
      }
    });

    // Successfully added to inventory - remove from ground
    this.removeGroundItem(event.itemId);
    this.sendMessage(event.playerId, `Picked up ${item.name}.`, 'info');
    
    
    // Emit pickup event
    this.emitTypedEvent(EventType.ITEM_PICKUP, {
        playerId: event.playerId,
        itemId: event.itemId,
        groundItemId: event.itemId
      });
  }

  /**
   * Handle item drop event
   */
  private handleItemDrop(event: ItemDropPayload): void {
    this.dropItem(event.item, event.position, event.playerId);
  }

  /**
   * Handle item pickup event (direct pickup without distance check)
   */
  private handleItemPickup(event: ItemPickupPayload): void {
    const groundItem = this.groundItems.get(event.itemId);
    if (groundItem) {
      this.removeGroundItem(event.itemId);
    }
  }

  /**
   * Remove ground item
   */
  private removeGroundItem(itemId: string): void {
    const groundItem = this.groundItems.get(itemId);
    if (!groundItem) return;
    
    // Remove mesh from scene
    if (groundItem.mesh.parent) {
      groundItem.mesh.parent.remove(groundItem.mesh);
    }
    
    // Remove from tracking
    this.groundItems.delete(itemId);
  }

  /**
   * Send message to player
   */
  private sendMessage(playerId: string, message: string, type: 'info' | 'warning' | 'error'): void {
    this.emit(EventType.UI_MESSAGE, {
      playerId: playerId,
      message: message,
      type: type
    });
  }

  /**
   * Update system - handle item floating animation and despawning
   */
  update(_deltaTime: number): void {
    const now = Date.now();
    
    // Update floating animation and check for despawns
    for (const [itemId, groundItem] of this.groundItems) {
      // Floating animation
      if (groundItem.mesh) {
        const time = (now - (groundItem.mesh.userData.startTime as number)) * 0.001;
        const originalY = groundItem.position.y + 0.5;
        groundItem.mesh.position.y = originalY + Math.sin(time * 2) * 0.1;
        groundItem.mesh.rotation.y = time * 0.5; // Slow rotation
      }
      
      // Check for despawn
      if (groundItem.despawnTime && now > groundItem.despawnTime) {
        this.removeGroundItem(itemId);
      }
    }
    
    // Periodic cleanup check
    if (now - this.lastUpdate > this.updateInterval) {
      this.lastUpdate = now;
      this.cleanupOrphanedItems();
    }
  }

  /**
   * Clean up orphaned items (items without meshes in scene)
   */
  private cleanupOrphanedItems(): void {
    for (const [itemId, groundItem] of this.groundItems) {
      if (!groundItem.mesh.parent) {
        this.groundItems.delete(itemId);
      }
    }
  }

  /**
   * Get all ground items in range of a position
   */
  public getItemsInRange(position: { x: number; y: number; z: number }, range: number): GroundItem[] {
    const itemsInRange: GroundItem[] = [];
    _v3_1.set(position.x, position.y, position.z)
    
    for (const groundItem of this.groundItems.values()) {
      const distance = _v3_1.distanceTo(groundItem.position)
      if (distance <= range) {
        itemsInRange.push(groundItem);
      }
    }
    
    return itemsInRange;
  }

  /**
   * Get ground item by ID
   */
  public getGroundItem(itemId: string): GroundItem | null {
    return this.groundItems.get(itemId) || null;
  }

  /**
   * Get all ground items
   */
  public getAllGroundItems(): GroundItem[] {
    return Array.from(this.groundItems.values());
  }

  /**
   * Force remove all ground items (for cleanup)
   */
  public clearAllItems(): void {
    for (const groundItem of this.groundItems.values()) {
      if (groundItem.mesh.parent) {
        groundItem.mesh.parent.remove(groundItem.mesh);
      }
    }
    this.groundItems.clear();
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): SystemInfo {
    const oldest = this.getOldestItem();
    const newest = this.getNewestItem();
    
    return {
      totalGroundItems: this.groundItems.size,
      itemsByType: this.getItemsByType(),
      oldestItem: oldest ? {
        itemId: oldest.id,
        position: {
          x: oldest.position.x,
          y: oldest.position.y,
          z: oldest.position.z
        },
        droppedAt: oldest.droppedAt
      } : null,
      newestItem: newest ? {
        itemId: newest.id,
        position: {
          x: newest.position.x,
          y: newest.position.y,
          z: newest.position.z
        },
        droppedAt: newest.droppedAt
      } : null
    };
  }

  private getItemsByType(): Record<string, number> {
    const typeCount: Record<string, number> = {};
    
    for (const groundItem of this.groundItems.values()) {
      const type = groundItem.item.type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    }
    
    return typeCount;
  }

  private getOldestItem(): GroundItem | null {
    let oldest: GroundItem | null = null;
    
    for (const groundItem of this.groundItems.values()) {
      if (!oldest || groundItem.droppedAt < oldest.droppedAt) {
        oldest = groundItem;
      }
    }
    
    return oldest;
  }

  private getNewestItem(): GroundItem | null {
    let newest: GroundItem | null = null;
    
    for (const groundItem of this.groundItems.values()) {
      if (!newest || groundItem.droppedAt > newest.droppedAt) {
        newest = groundItem;
      }
    }
    
    return newest;
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all ground items (calls existing cleanup logic)
    this.clearAllItems();
    
    // Clear item colors mapping
    this.itemColors.clear();
    
    // Reset timing variables
    this.lastUpdate = 0;
    
    // Call parent cleanup
    super.destroy();
  }
}