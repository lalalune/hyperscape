/**
 * RPGInventorySystem - Manages player inventories
 */

import { System } from '../../core/systems/System';
import { getItem } from '../data/items';
import { Inventory } from '../types';

export interface InventoryItem {
  slot: number;
  itemId: string;
  quantity: number;
  item?: any;
}

export interface PlayerInventory {
  playerId: string;
  items: InventoryItem[];
  coins: number;
}

export class RPGInventorySystem extends System {
  private playerInventories = new Map<string, PlayerInventory>();
  private readonly MAX_INVENTORY_SLOTS = 28;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGInventorySystem] Initializing inventory system...');
    
    // Listen for inventory events
    this.world.on('player:init', this.initializeInventory.bind(this));
    this.world.on('player:cleanup', this.cleanupInventory.bind(this));
    this.world.on('inventory:add', this.addItem.bind(this));
    this.world.on('inventory:remove', this.removeItem.bind(this));
    this.world.on('inventory:drop', this.dropItem.bind(this));
    this.world.on('inventory:use', this.useItem.bind(this));
    this.world.on('inventory:pickup', this.pickupItem.bind(this));
    this.world.on('inventory:update_coins', this.updateCoins.bind(this));
    this.world.on('inventory:move', this.moveItem.bind(this));
    
    console.log('[RPGInventorySystem] Inventory system initialized');
  }

  private initializeInventory(playerData: { id: string }): void {
    console.log(`[RPGInventorySystem] Initializing inventory for player ${playerData.id}`);
    
    const inventory: PlayerInventory = {
      playerId: playerData.id,
      items: [],
      coins: 100 // Starting coins per GDD
    };
    
    this.playerInventories.set(playerData.id, inventory);
    
    // Give starter equipment - per GDD, players start with bronze gear
    this.addStarterEquipment(playerData.id);
    
    this.world.emit('inventory:initialized', {
      playerId: playerData.id,
      inventory: this.getInventoryData(playerData.id)
    });
  }

  private addStarterEquipment(playerId: string): void {
    const starterItems = [
      { itemId: 'bronze_sword', quantity: 1 },
      { itemId: 'bronze_shield', quantity: 1 },
      { itemId: 'bronze_helmet', quantity: 1 },
      { itemId: 'bronze_body', quantity: 1 },
      { itemId: 'bronze_legs', quantity: 1 },
      { itemId: 'wood_bow', quantity: 1 },
      { itemId: 'arrows', quantity: 100 },
      { itemId: 'tinderbox', quantity: 1 },
      { itemId: 'hatchet', quantity: 1 },
      { itemId: 'fishing_rod', quantity: 1 }
    ];
    
    starterItems.forEach(({ itemId, quantity }) => {
      this.addItem({ playerId, itemId, quantity });
    });
  }

  private cleanupInventory(playerId: string): void {
    this.playerInventories.delete(playerId);
  }

  private addItem(data: { playerId: string; itemId: string; quantity: number; slot?: number }): boolean {
    const inventory = this.playerInventories.get(data.playerId);
    if (!inventory) {
      console.error(`[RPGInventorySystem] No inventory found for player ${data.playerId}`);
      return false;
    }
    
    const itemData = getItem(data.itemId);
    
    console.log(`[RPGInventorySystem] Adding ${data.quantity}x ${data.itemId} to player ${data.playerId}`);
    
    // Special handling for coins
    if (data.itemId === 'coins') {
      inventory.coins += data.quantity;
      this.world.emit('inventory:coins_updated', {
        playerId: data.playerId,
        coins: inventory.coins
      });
      return true;
    }
    
    if (!itemData) {
      console.error(`[RPGInventorySystem] Unknown item: ${data.itemId}`);
      return false;
    }
    
    // Check if item is stackable
    if (itemData.stackable) {
      // Find existing stack
      const existingItem = inventory.items.find(item => item.itemId === data.itemId);
      if (existingItem) {
        existingItem.quantity += data.quantity;
        this.emitInventoryUpdate(data.playerId);
        return true;
      }
    }
    
    // Find empty slot
    const emptySlot = this.findEmptySlot(inventory);
    if (emptySlot === -1) {
      console.log(`[RPGInventorySystem] Inventory full for player ${data.playerId}`);
      this.world.emit('inventory:full', { playerId: data.playerId });
      return false;
    }
    
    // Add new item
    inventory.items.push({
      slot: emptySlot,
      itemId: data.itemId,
      quantity: data.quantity,
      item: itemData
    });
    
    this.emitInventoryUpdate(data.playerId);
    return true;
  }

  private removeItem(data: { playerId: string; itemId: string; quantity: number; slot?: number }): boolean {
    const inventory = this.playerInventories.get(data.playerId);
    if (!inventory) {
      console.error(`[RPGInventorySystem] No inventory found for player ${data.playerId}`);
      return false;
    }
    
    // Handle coins
    if (data.itemId === 'coins') {
      if (inventory.coins >= data.quantity) {
        inventory.coins -= data.quantity;
        this.world.emit('inventory:coins_updated', {
          playerId: data.playerId,
          coins: inventory.coins
        });
        return true;
      }
      return false;
    }
    
    // Find item
    const itemIndex = data.slot !== undefined 
      ? inventory.items.findIndex(item => item.slot === data.slot)
      : inventory.items.findIndex(item => item.itemId === data.itemId);
    
    if (itemIndex === -1) return false;
    
    const item = inventory.items[itemIndex];
    
    if (item.quantity > data.quantity) {
      item.quantity -= data.quantity;
    } else {
      inventory.items.splice(itemIndex, 1);
    }
    
    this.emitInventoryUpdate(data.playerId);
    return true;
  }

  private dropItem(data: { playerId: string; itemId: string; quantity: number; slot?: number }): void {
    const removed = this.removeItem(data);
    
    if (removed) {
      if (!this.world.getPlayer) {
        console.warn('[RPGInventorySystem] getPlayer method not available on world');
        return;
      }
      
      const player = this.world.getPlayer(data.playerId);
      if (!player) {
        console.warn(`[RPGInventorySystem] Player not found: ${data.playerId}`);
        return;
      }
      
      const position = player.position;
      
      // Spawn item in world
      this.world.emit('item:spawn', {
        itemId: data.itemId,
        quantity: data.quantity,
        position: {
          x: position.x + (Math.random() - 0.5) * 2,
          y: position.y,
          z: position.z + (Math.random() - 0.5) * 2
        }
      });
      
      console.log(`[RPGInventorySystem] Player ${data.playerId} dropped ${data.quantity}x ${data.itemId}`);
    }
  }

  private useItem(data: { playerId: string; itemId: string; slot: number }): void {
    const inventory = this.playerInventories.get(data.playerId);
    if (!inventory) {
      console.error(`[RPGInventorySystem] No inventory found for player ${data.playerId}`);
      return;
    }
    
    const item = inventory.items.find(i => i.slot === data.slot);
    if (!item) {
      console.error(`[RPGInventorySystem] No item found in slot ${data.slot}`);
      return;
    }
    
    console.log(`[RPGInventorySystem] Player ${data.playerId} using item ${data.itemId}`);
    
    // Emit item use event for specific systems to handle
    this.world.emit('item:used', {
      playerId: data.playerId,
      itemId: data.itemId,
      slot: data.slot,
      itemData: item.item
    });
    
    // Remove consumables after use
    if (item.item?.type === 'food' || item.item?.type === 'potion') {
      this.removeItem({ playerId: data.playerId, itemId: data.itemId, quantity: 1, slot: data.slot });
    }
  }

  private pickupItem(data: { playerId: string; entityId: string }): void {
    // Get item entity data from entity manager
    const entityManager = this.world['rpg-entity-manager'];
    if (!entityManager) {
      console.error('[RPGInventorySystem] RPGEntityManager not found');
      return;
    }
    
    const entity = entityManager.getEntity(data.entityId);
    if (!entity) {
      console.warn(`[RPGInventorySystem] Entity not found: ${data.entityId}`);
      return;
    }
    
    const itemId = entity.getProperty('itemId');
    const quantity = entity.getProperty('quantity');
    
    // Try to add to inventory
    const added = this.addItem({
      playerId: data.playerId,
      itemId,
      quantity
    });
    
    if (added) {
      // Destroy item entity
      this.world.emit('entity:destroy', { entityId: data.entityId });
      
      console.log(`[RPGInventorySystem] Player ${data.playerId} picked up ${quantity}x ${itemId}`);
    }
  }

  private updateCoins(data: { playerId: string; amount: number }): void {
    const inventory = this.playerInventories.get(data.playerId);
    if (!inventory) {
      console.error(`[RPGInventorySystem] No inventory found for player ${data.playerId}`);
      return;
    }
    
    if (data.amount > 0) {
      inventory.coins += data.amount;
    } else {
      inventory.coins = Math.max(0, inventory.coins + data.amount);
    }
    
    this.world.emit('inventory:coins_updated', {
      playerId: data.playerId,
      coins: inventory.coins
    });
  }

  private moveItem(data: { playerId: string; fromSlot: number; toSlot: number }): void {
    const inventory = this.playerInventories.get(data.playerId);
    if (!inventory) {
      console.error(`[RPGInventorySystem] No inventory found for player ${data.playerId}`);
      return;
    }
    
    const fromItem = inventory.items.find(item => item.slot === data.fromSlot);
    const toItem = inventory.items.find(item => item.slot === data.toSlot);
    
    // Simple swap
    if (fromItem && toItem) {
      fromItem.slot = data.toSlot;
      toItem.slot = data.fromSlot;
    } else if (fromItem) {
      fromItem.slot = data.toSlot;
    }
    
    this.emitInventoryUpdate(data.playerId);
  }

  private findEmptySlot(inventory: PlayerInventory): number {
    const usedSlots = new Set(inventory.items.map(item => item.slot));
    
    for (let i = 0; i < this.MAX_INVENTORY_SLOTS; i++) {
      if (!usedSlots.has(i)) {
        return i;
      }
    }
    
    return -1;
  }

  private emitInventoryUpdate(playerId: string): void {
    this.world.emit('inventory:updated', {
      playerId,
      inventory: this.getInventoryData(playerId)
    });
  }

  // Public API
  getInventory(playerId: string): PlayerInventory | undefined {
    return this.playerInventories.get(playerId);
  }

  getInventoryData(playerId: string): any {
    const inventory = this.playerInventories.get(playerId);
    if (!inventory) {
      return { items: [], coins: 0, maxSlots: this.MAX_INVENTORY_SLOTS };
    }
    
    return {
      items: inventory.items,
      coins: inventory.coins,
      maxSlots: this.MAX_INVENTORY_SLOTS
    };
  }

  hasItem(playerId: string, itemId: string, quantity: number = 1): boolean {
    const inventory = this.playerInventories.get(playerId);
    if (!inventory) return false;
    
    // Check coins
    if (itemId === 'coins') {
      return inventory.coins >= quantity;
    }
    
    const totalQuantity = inventory.items
      .filter(item => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
    
    return totalQuantity >= quantity;
  }

  getItemQuantity(playerId: string, itemId: string): number {
    const inventory = this.playerInventories.get(playerId);
    if (!inventory) return 0;
    
    if (itemId === 'coins') {
      return inventory.coins;
    }
    
    return inventory.items
      .filter(item => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  getCoins(playerId: string): number {
    const inventory = this.playerInventories.get(playerId);
    return inventory?.coins || 0;
  }

  getTotalWeight(playerId: string): number {
    const inventory = this.playerInventories.get(playerId);
    if (!inventory) return 0;
    
    return inventory.items.reduce((total, item) => {
      const itemData = getItem(item.itemId);
      return total + (itemData?.weight || 0) * item.quantity;
    }, 0);
  }

  isFull(playerId: string): boolean {
    const inventory = this.playerInventories.get(playerId);
    if (!inventory) return false;
    
    return inventory.items.length >= this.MAX_INVENTORY_SLOTS;
  }

  destroy(): void {
    this.playerInventories.clear();
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}