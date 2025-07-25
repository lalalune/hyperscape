/**
 * RPG Item Pickup System
 * 
 * Handles ground items, pickup interactions, and drop mechanics.
 * Items appear as colored cubes that players can click to pick up.
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';
import { RPGItem, ItemType } from '../data/items';

export interface GroundItem {
  id: string;
  item: RPGItem;
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  droppedBy?: string;
  droppedAt: number;
  despawnTime?: number;
}

export class RPGItemPickupSystem extends System {
  private groundItems: Map<string, GroundItem> = new Map();
  private itemColors: Map<string, number> = new Map();
  private lastUpdate: number = 0;
  private updateInterval: number = 1000; // Update every second

  constructor(world: any) {
    super(world);
    this.initializeItemColors();
  }

  async init(): Promise<void> {
    console.log('[RPGItemPickupSystem] Initializing item pickup system...');
    
    // Listen for item drop/pickup events
    this.world.on?.('rpg:item:drop', this.handleItemDrop.bind(this));
    this.world.on?.('rpg:item:pickup', this.handleItemPickup.bind(this));
    this.world.on?.('rpg:item:pickup_request', this.handlePickupRequest.bind(this));
    
    // Listen for player events
    this.world.on?.('enter', this.handlePlayerJoin.bind(this));
    this.world.on?.('leave', this.handlePlayerLeave.bind(this));
  }

  start(): void {
    console.log('[RPGItemPickupSystem] Item pickup system started');
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
  public dropItem(item: RPGItem, position: THREE.Vector3, droppedBy?: string): string {
    const itemId = `ground_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create visual representation
    const mesh = this.createItemMesh(item, itemId);
    mesh.position.copy(position);
    mesh.position.y += 0.5; // Slightly above ground
    
    // Add to world scene
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(mesh);
    }
    
    const groundItem: GroundItem = {
      id: itemId,
      item: item,
      position: position.clone(),
      mesh: mesh,
      droppedBy: droppedBy,
      droppedAt: Date.now(),
      despawnTime: Date.now() + (5 * 60 * 1000) // 5 minutes despawn time
    };
    
    this.groundItems.set(itemId, groundItem);
    
    console.log(`[RPGItemPickupSystem] Dropped ${item.name} at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    
    // Emit drop event for other systems
    this.world.emit?.('rpg:item:dropped', { itemId, item, position, droppedBy });
    
    return itemId;
  }

  /**
   * Create visual mesh for ground item
   */
  private createItemMesh(item: RPGItem, itemId: string): THREE.Object3D {
    if (!THREE) {
      console.warn('[RPGItemPickupSystem] THREE.js not available');
      return new (THREE as any).Object3D();
    }

    // Create geometry based on item type
    let geometry: THREE.BufferGeometry;
    
    switch (item.type) {
      case ItemType.WEAPON:
        if (item.name.toLowerCase().includes('bow')) {
          geometry = new THREE.BoxGeometry(0.1, 0.8, 0.05);
        } else if (item.name.toLowerCase().includes('shield')) {
          geometry = new THREE.BoxGeometry(0.03, 0.5, 0.4);
        } else {
          geometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
        }
        break;
      case ItemType.ARMOR:
        if (item.armorSlot === 'helmet') {
          geometry = new THREE.BoxGeometry(0.3, 0.25, 0.3);
        } else if (item.armorSlot === 'body') {
          geometry = new THREE.BoxGeometry(0.4, 0.5, 0.2);
        } else if (item.armorSlot === 'legs') {
          geometry = new THREE.BoxGeometry(0.3, 0.6, 0.2);
        } else {
          geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        }
        break;
      case ItemType.AMMUNITION:
        geometry = new THREE.BoxGeometry(0.02, 0.3, 0.02);
        break;
      case ItemType.CONSUMABLE:
        geometry = new THREE.SphereGeometry(0.1, 6, 4);
        break;
      case ItemType.TOOL:
        geometry = new THREE.BoxGeometry(0.05, 0.4, 0.05);
        break;
      default:
        geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    }

    // Get color for item type
    const color = this.getItemColor(item);
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `ground_item_${item.name.replace(/\s+/g, '_')}`;
    
    // Add interaction data for raycasting
    mesh.userData = {
      type: 'ground_item',
      itemId: itemId,
      itemType: item.type,
      itemName: item.name,
      interactive: true,
      clickable: true
    };

    // Add PhysX collider for interaction
    mesh.userData.physx = {
      type: 'box',
      size: { 
        x: (geometry as any).parameters?.width || 0.2,
        y: (geometry as any).parameters?.height || 0.2,
        z: (geometry as any).parameters?.depth || 0.2
      },
      collider: true,
      trigger: false,
      interactive: true
    };

    // Add floating animation
    mesh.userData.startTime = Date.now();
    
    console.log(`[RPGItemPickupSystem] Created mesh for ${item.name} with color 0x${color.toString(16)}`);
    
    return mesh;
  }

  /**
   * Get item color based on type and material
   */
  private getItemColor(item: RPGItem): number {
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
   * Handle pickup request from player interaction
   */
  private handlePickupRequest(event: { playerId: string; itemId: string }): void {
    const groundItem = this.groundItems.get(event.itemId);
    if (!groundItem) {
      console.warn(`[RPGItemPickupSystem] Ground item not found: ${event.itemId}`);
      return;
    }

    const player = this.world.getPlayer?.(event.playerId);
    if (!player) {
      console.warn(`[RPGItemPickupSystem] Player not found: ${event.playerId}`);
      return;
    }

    // Check if player is close enough to pick up
    let distance = Infinity;
    if (player.position && groundItem.position) {
      if (typeof player.position.distanceTo === 'function') {
        distance = player.position.distanceTo(groundItem.position);
      } else {
        // Manual distance calculation if distanceTo is not available
        const dx = player.position.x - groundItem.position.x;
        const dy = player.position.y - groundItem.position.y;
        const dz = player.position.z - groundItem.position.z;
        distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    }
    
    if (distance > 3.0) { // 3 meter pickup range
      this.sendMessage(event.playerId, 'You are too far away to pick up that item.', 'warning');
      return;
    }

    // Try to add to inventory
    const addedToInventory = this.world.emit?.('rpg:inventory:add', {
      playerId: event.playerId,
      item: {
        id: groundItem.item.id,
        name: groundItem.item.name,
        type: groundItem.item.type,
        quantity: 1, // Ground items are always quantity 1
        stackable: groundItem.item.stackable || false
      }
    });

    if (addedToInventory !== false) {
      // Successfully added to inventory - remove from ground
      this.removeGroundItem(event.itemId);
      this.sendMessage(event.playerId, `Picked up ${groundItem.item.name}.`, 'info');
      
      console.log(`[RPGItemPickupSystem] Player ${event.playerId} picked up ${groundItem.item.name}`);
      
      // Emit pickup event
      this.world.emit?.('rpg:item:picked_up', {
        playerId: event.playerId,
        item: groundItem.item,
        itemId: event.itemId
      });
    } else {
      this.sendMessage(event.playerId, 'Your inventory is full!', 'warning');
    }
  }

  /**
   * Handle item drop event
   */
  private handleItemDrop(event: { item: RPGItem; position: THREE.Vector3; playerId?: string }): void {
    this.dropItem(event.item, event.position, event.playerId);
  }

  /**
   * Handle item pickup event (direct pickup without distance check)
   */
  private handleItemPickup(event: { playerId: string; itemId: string }): void {
    const groundItem = this.groundItems.get(event.itemId);
    if (groundItem) {
      this.removeGroundItem(event.itemId);
      
      console.log(`[RPGItemPickupSystem] Player ${event.playerId} picked up ${groundItem.item.name} (direct)`);
    }
  }

  /**
   * Remove ground item
   */
  private removeGroundItem(itemId: string): void {
    const groundItem = this.groundItems.get(itemId);
    if (groundItem) {
      // Remove mesh from scene
      if (groundItem.mesh.parent) {
        groundItem.mesh.parent.remove(groundItem.mesh);
      }
      
      // Remove from tracking
      this.groundItems.delete(itemId);
      
      console.log(`[RPGItemPickupSystem] Removed ground item: ${groundItem.item.name}`);
    }
  }

  /**
   * Handle player join
   */
  private handlePlayerJoin(event: { playerId: string }): void {
    // Send existing ground items to new player
    for (const [itemId, groundItem] of this.groundItems) {
      this.world.emit?.('rpg:client:ground_item_spawn', {
        playerId: event.playerId,
        itemId: itemId,
        item: groundItem.item,
        position: groundItem.position
      });
    }
  }

  /**
   * Handle player leave
   */
  private handlePlayerLeave(event: { playerId: string }): void {
    // No specific cleanup needed for pickup system
  }

  /**
   * Send message to player
   */
  private sendMessage(playerId: string, message: string, type: 'info' | 'warning' | 'error'): void {
    this.world.emit?.('rpg:ui:message', {
      playerId: playerId,
      message: message,
      type: type
    });
  }

  /**
   * Update system - handle item floating animation and despawning
   */
  update(deltaTime: number): void {
    const now = Date.now();
    
    // Update floating animation and check for despawns
    for (const [itemId, groundItem] of this.groundItems) {
      // Floating animation
      if (groundItem.mesh) {
        const time = (now - groundItem.mesh.userData.startTime) * 0.001;
        const originalY = groundItem.position.y + 0.5;
        groundItem.mesh.position.y = originalY + Math.sin(time * 2) * 0.1;
        groundItem.mesh.rotation.y = time * 0.5; // Slow rotation
      }
      
      // Check for despawn
      if (groundItem.despawnTime && now > groundItem.despawnTime) {
        console.log(`[RPGItemPickupSystem] Despawning ${groundItem.item.name} (${itemId})`);
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
        console.warn(`[RPGItemPickupSystem] Cleaning up orphaned item: ${groundItem.item.name}`);
        this.groundItems.delete(itemId);
      }
    }
  }

  /**
   * Get all ground items in range of a position
   */
  public getItemsInRange(position: THREE.Vector3, range: number = 5.0): GroundItem[] {
    const itemsInRange: GroundItem[] = [];
    
    for (const groundItem of this.groundItems.values()) {
      const distance = position.distanceTo(groundItem.position);
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
    for (const [itemId, groundItem] of this.groundItems) {
      if (groundItem.mesh.parent) {
        groundItem.mesh.parent.remove(groundItem.mesh);
      }
    }
    this.groundItems.clear();
    console.log('[RPGItemPickupSystem] Cleared all ground items');
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): any {
    return {
      totalGroundItems: this.groundItems.size,
      itemsByType: this.getItemsByType(),
      oldestItem: this.getOldestItem(),
      newestItem: this.getNewestItem()
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

  private getOldestItem(): { name: string; age: number } | null {
    let oldest: GroundItem | null = null;
    
    for (const groundItem of this.groundItems.values()) {
      if (!oldest || groundItem.droppedAt < oldest.droppedAt) {
        oldest = groundItem;
      }
    }
    
    if (oldest) {
      return {
        name: oldest.item.name,
        age: Math.floor((Date.now() - oldest.droppedAt) / 1000)
      };
    }
    
    return null;
  }

  private getNewestItem(): { name: string; age: number } | null {
    let newest: GroundItem | null = null;
    
    for (const groundItem of this.groundItems.values()) {
      if (!newest || groundItem.droppedAt > newest.droppedAt) {
        newest = groundItem;
      }
    }
    
    if (newest) {
      return {
        name: newest.item.name,
        age: Math.floor((Date.now() - newest.droppedAt) / 1000)
      };
    }
    
    return null;
  }

  destroy(): void {
    this.clearAllItems();
    console.log('[RPGItemPickupSystem] System destroyed');
  }
}