/**
 * Loot System - GDD Compliant
 * Handles loot drops, loot tables, and item spawning per GDD specifications:
 * - Guaranteed drops from all mobs
 * - Tier-based loot tables
 * - Visual dropped items in world
 * - Pickup mechanics
 * - Loot despawn timers
 */

import type { World } from '../types/index';
import { EventType } from '../types/events';
import { LootTable, InventoryItem, ItemType } from '../types/core';
import { EntityType, InteractionType, ItemRarity } from '../types/entities';
import type { HeadstoneEntityConfig, ItemEntityConfig } from '../types/entities';
import { Item } from '../types/index';
import { SystemBase } from './SystemBase';
import { items } from '../data/items';
import type { DroppedItem } from '../types/system-interfaces';
import { groundToTerrain } from '../utils/EntityUtils';
import { EntityManager } from './EntityManager';
import { ALL_NPCS } from '../data/npcs';


export class LootSystem extends SystemBase {
  private lootTables = new Map<string, LootTable>(); // String key = mob ID from mobs.json
  private itemDatabase = new Map<string, Item>();
  private droppedItems = new Map<string, DroppedItem>();
  private nextItemId = 1;
  
  // Loot constants per GDD
  private readonly LOOT_DESPAWN_TIME = 120000; // 2 minutes
  private readonly PICKUP_RANGE = 5; // meters
  private readonly MAX_DROPPED_ITEMS = 1000; // Performance limit

  constructor(world: World) {
    super(world, {
      name: 'loot',
      dependencies: {
        required: [], // Self-contained loot management
        optional: ['inventory', 'entity-manager', 'ui', 'client-graphics']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Load item database
    this.loadItemDatabase();
    
    // Set up loot tables per GDD specifications
    this.setupLootTables();
    
    // Subscribe to loot events using type-safe event system
    // Listen for the official mob death event (normalize various emitters)
    this.subscribe(EventType.MOB_DIED, (event: { mobId?: string; killerId?: string; mobType?: string; level?: number; killedBy?: string; position?: { x: number; y: number; z: number } }) => {
      const d = event;
      // Backfill minimal shape expected by handleMobDeath if missing
      const payload = {
        mobId: d.mobId as string,
        mobType: (d.mobType || 'unknown') as string,
        level: (d.level ?? 1) as number,
        killedBy: (d.killerId ?? d.killedBy ?? 'unknown') as string,
        position: d.position ?? { x: 0, y: 0, z: 0 }
      };
      this.handleMobDeath(payload);
    });
    
    // Subscribe to corpse loot requests (separate from ground item pickup)
    this.subscribe(EventType.CORPSE_LOOT_REQUEST, (data) => this.handleLootPickup(data as { playerId: string; itemId: string; corpseId?: string }));
    this.subscribe(EventType.ITEM_DROPPED, (data) => this.dropItem(data as { playerId: string; itemId: string; quantity: number; position: { x: number; y: number; z: number } }));
    
    // Start managed cleanup timer
    this.createInterval(() => {
      this.cleanupExpiredLoot();
    }, 30000); // Check every 30 seconds
    
  }



  /**
   * Load item database from data files
   */
  private loadItemDatabase(): void {
    // Load items from statically imported data
    for (const item of Object.values(items)) {
      this.itemDatabase.set(item.id, item);
    }
  }

  /**
   * Set up loot tables per GDD specifications
   * Dynamically loaded from mob data JSON
   */
  private setupLootTables(): void {
    // Load loot tables from NPC data
    for (const [npcId, npcData] of ALL_NPCS.entries()) {
      // Only process combat NPCs (mob, boss, quest)
      if (npcData.category !== 'mob' && npcData.category !== 'boss' && npcData.category !== 'quest') {
        continue;
      }

      // Convert unified drop system to loot table format
      const guaranteedDrops: Array<{ itemId: string; quantity: number; chance: number }> = [];
      const commonDrops: Array<{ itemId: string; quantity: number; chance: number }> = [];
      const uncommonDrops: Array<{ itemId: string; quantity: number; chance: number }> = [];
      const rareDrops: Array<{ itemId: string; quantity: number; chance: number }> = [];

      // Add default drop if enabled
      if (npcData.drops.defaultDrop.enabled) {
        guaranteedDrops.push({
          itemId: npcData.drops.defaultDrop.itemId,
          quantity: npcData.drops.defaultDrop.quantity,
          chance: 1.0
        });
      }

      // Add all drop tiers
      for (const drop of npcData.drops.always) {
        guaranteedDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance
        });
      }

      for (const drop of npcData.drops.common) {
        commonDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance
        });
      }

      for (const drop of npcData.drops.uncommon) {
        uncommonDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance
        });
      }

      for (const drop of [...npcData.drops.rare, ...npcData.drops.veryRare]) {
        rareDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance
        });
      }

      this.lootTables.set(npcId, {
        id: `${npcId}_loot`,
        mobType: npcId,
        guaranteedDrops,
        commonDrops,
        uncommonDrops,
        rareDrops
      });
    }
    
  }

  /**
   * Handle mob death and generate loot
   */
  private async handleMobDeath(data: { mobId: string; mobType: string; level: number; killedBy: string; position: { x: number; y: number; z: number } }): Promise<void> {

    const mobType = data.mobType; // Mob ID from mobs.json
    const lootTable = this.lootTables.get(mobType);
    if (!lootTable) {
      console.warn(`[LootSystem] No loot table found for mob type: ${mobType}`);
      return;
    }

    const corpseId = `corpse_${data.mobId}`;
    const lootItems: Array<{ itemId: string; quantity: number }> = [];

    // Process guaranteed drops
    for (const entry of lootTable.guaranteedDrops) {
      const quantity = entry.itemId === 'coins' ? this.randomizeCoins(entry.quantity) : entry.quantity;
      lootItems.push({ itemId: entry.itemId, quantity });
    }

    // Process uncommon drops with chance rolls
    for (const entry of lootTable.uncommonDrops) {
      if (Math.random() < entry.chance) {
        const quantity = entry.itemId === 'coins' ? this.randomizeCoins(entry.quantity) : entry.quantity;
        lootItems.push({ itemId: entry.itemId, quantity });
      }
    }

    // Process rare drops with chance rolls
    for (const entry of lootTable.rareDrops) {
      if (Math.random() < entry.chance) {
        const quantity = entry.itemId === 'coins' ? this.randomizeCoins(entry.quantity) : entry.quantity;
        lootItems.push({ itemId: entry.itemId, quantity });
      }
    }

    // Convert loot items to InventoryItem format
    const inventoryItems: InventoryItem[] = lootItems.map((loot, index) => ({
      id: `loot_${corpseId}_${index}`,
      itemId: loot.itemId,
      quantity: loot.quantity,
      slot: index,
      metadata: null
    }));

    // Create corpse entity with loot via EntityManager
    const entityManager = this.world.getSystem<EntityManager>('entity-manager');
    if (!entityManager) {
      console.error('[LootSystem] EntityManager not found, cannot spawn corpse');
      return;
    }

    // Ground to terrain
    const groundedPosition = groundToTerrain(this.world, data.position, 0.2, Infinity);

    const corpseConfig: HeadstoneEntityConfig = {
      id: corpseId,
      name: `${data.mobType} corpse`,
      type: EntityType.HEADSTONE,
      position: groundedPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.LOOT,
      interactionDistance: 2,
      description: `Corpse of a ${data.mobType}`,
      model: null,
      headstoneData: {
        playerId: data.mobId,
        playerName: data.mobType,
        deathTime: Date.now(),
        deathMessage: `Killed by ${data.killedBy}`,
        position: groundedPosition,
        items: inventoryItems,
        itemCount: inventoryItems.length,
        despawnTime: Date.now() + this.LOOT_DESPAWN_TIME
      },
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 1, max: 1 },
        level: 1
      }
    };

    await entityManager.spawnEntity(corpseConfig);


    // Emit loot dropped event
    this.emitTypedEvent(EventType.LOOT_DROPPED, {
      mobId: data.mobId,
      mobType: mobType,
      items: lootItems,
      position: data.position
    });
  }

  /**
   * Spawn a dropped item in the world
   */
  private async spawnDroppedItem(itemId: string, quantity: number, position: { x: number; y: number; z: number }, droppedBy?: string): Promise<void> {
    // Check item limit
    if (this.droppedItems.size >= this.MAX_DROPPED_ITEMS) {
      this.cleanupOldestItems(100); // Remove 100 oldest items
    }

    const item = this.itemDatabase.get(itemId);
    if (!item) {
      console.warn(`[LootSystem] Unknown item: ${itemId}`);
      return;
    }

    const dropId = `drop_${this.nextItemId++}`;
    const now = Date.now();

    // Create entity for the dropped item
    const entityManager = this.world.getSystem<EntityManager>('entity-manager');
    if (!entityManager) {
      return;
    }

    // Ground to terrain - use Infinity to allow any initial height difference
    const groundedPosition = groundToTerrain(this.world, position, 0.2, Infinity);

    const itemEntity = await entityManager.spawnEntity({
      id: dropId,
      name: `${item.name} (${quantity})`,
      type: 'item',
      position: groundedPosition,
      itemId: itemId,
      itemType: this.getItemTypeString(item.type),
      quantity: quantity,
      stackable: item.stackable ?? false,
      value: item.value ?? 0,
      weight: 1.0,
      rarity: ItemRarity.COMMON
    } as ItemEntityConfig);

    if (!itemEntity) {
      return;
    }

    const droppedItem: DroppedItem = {
      id: dropId,
      itemId: itemId,
      quantity: quantity,
      position: groundedPosition,
      despawnTime: now + this.LOOT_DESPAWN_TIME,
      droppedBy: droppedBy ?? 'unknown',
      droppedAt: now,
      entityId: dropId,
      mesh: itemEntity.node || null
    };

    this.droppedItems.set(dropId, droppedItem);
  }

  /**
   * Handle loot drop request from mob death
   */
  private async handleLootDropRequest(data: { position: { x: number; y: number; z: number }; items: { itemId: string; quantity: number }[] }): Promise<void> {
    // Spawn each item in the loot drop
    for (let i = 0; i < data.items.length; i++) {
      const lootItem = data.items[i];
      
      // Spread items around the drop position
      const offsetX = (Math.random() - 0.5) * 2; // -1 to 1 meter spread
      const offsetZ = (Math.random() - 0.5) * 2;
      
      const dropPosition = {
        x: data.position.x + offsetX,
        y: data.position.y + 0.5, // Slightly above ground
        z: data.position.z + offsetZ
      };
      
      await this.spawnDroppedItem(lootItem.itemId, lootItem.quantity, dropPosition, 'mob_drop');
    }

    // Emit loot dropped event
    this.emitTypedEvent(EventType.LOOT_DROPPED, {
      items: data.items,
      position: data.position
    });
  }

  /**
   * Handle corpse loot pickup (from headstones/corpses)
   */
  private async handleLootPickup(data: { playerId: string; itemId: string; corpseId?: string }): Promise<void> {
    const droppedItem = this.droppedItems.get(data.itemId);
    if (!droppedItem) {
      return;
    }

    // Check if item is still valid
    if (Date.now() > droppedItem.despawnTime) {
      this.removeDroppedItem(data.itemId);
      return;
    }

    // Try to add item to player inventory
    const success = await this.addItemToPlayer(data.playerId, droppedItem.itemId, droppedItem.quantity);
    
    if (success) {
      // Remove from world
      this.removeDroppedItem(data.itemId);
      
      // Emit notification event (not ITEM_PICKUP to avoid confusion with ground items)
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `You looted ${droppedItem.quantity}x ${droppedItem.itemId}`,
        type: 'success'
      });
    } else {
      // Inventory full - show message
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: 'Your inventory is full.',
        type: 'warning'
      });
    }
  }

  /**
   * Add item to player inventory via inventory system
   */
  private async addItemToPlayer(playerId: string, itemId: string, quantity: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId: playerId,
        item: {
          id: `${playerId}_${itemId}_${Date.now()}`,
          itemId: itemId,
          quantity: quantity,
          slot: 0,
          metadata: null
        }
      });
      // Assume success - inventory system will handle validation
      resolve(true);
    });
  }

  /**
   * Manual item drop (from inventory)
   */
  private async dropItem(data: { playerId: string; itemId: string; quantity: number; position: { x: number; y: number; z: number } }): Promise<void> {
    await this.spawnDroppedItem(data.itemId, data.quantity, data.position, data.playerId);
  }

  /**
   * Remove dropped item from world
   */
  private removeDroppedItem(itemId: string): void {
    const droppedItem = this.droppedItems.get(itemId);
    if (!droppedItem) return;
    
    const entityManager = this.world.getSystem<EntityManager>('entity-manager');
    if (entityManager && droppedItem.entityId) {
      entityManager.destroyEntity(droppedItem.entityId);
    }
    this.droppedItems.delete(itemId);
  }

  /**
   * Convert ItemType enum to string for entity config
   */
  private getItemTypeString(itemType: ItemType): string {
    switch (itemType) {
      case ItemType.WEAPON: return 'weapon';
      case ItemType.ARMOR: return 'armor';
      case ItemType.TOOL: return 'tool';
      case ItemType.RESOURCE: return 'resource';
      case ItemType.CONSUMABLE: return 'food';
      case ItemType.CURRENCY: return 'coins';
      case ItemType.AMMUNITION: return 'arrow';
      default: return 'misc';
    }
  }

  /**
   * Clean up expired loot
   */
  private cleanupExpiredLoot(): void {
    const now = Date.now();
    const expiredItems: string[] = [];

    for (const [itemId, droppedItem] of this.droppedItems) {
      if (now > droppedItem.despawnTime) {
        expiredItems.push(itemId);
      }
    }

    if (expiredItems.length > 0) {
      for (const itemId of expiredItems) {
        this.removeDroppedItem(itemId);
      }
    }
  }

  /**
   * Clean up oldest items to prevent memory issues
   */
  private cleanupOldestItems(count: number): void {
    const sortedItems = Array.from(this.droppedItems.entries())
      .sort((a, b) => a[1].droppedAt - b[1].droppedAt)
      .slice(0, count);

    for (const [itemId, _droppedItem] of sortedItems) {
      this.removeDroppedItem(itemId);
    }
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomizeCoins(baseAmount: number): number {
    // Add ±25% variation to coin drops
    const variation = 0.25;
    const minAmount = Math.floor(baseAmount * (1 - variation));
    const maxAmount = Math.floor(baseAmount * (1 + variation));
    return this.randomInt(minAmount, maxAmount);
  }

  /**
   * Public API for testing
   */
  public forceCleanupForTesting(): void {
    for (const itemId of [...this.droppedItems.keys()]) {
      this.removeDroppedItem(itemId);
    }
  }

  destroy(): void {
    // Clear all dropped items
    this.droppedItems.clear();
    
    // Clear loot tables
    this.lootTables.clear();
    
    // Clear item database
    this.itemDatabase.clear();
    
    // Reset item ID counter
    this.nextItemId = 1;
    
    // Call parent cleanup (handles event listeners and managed timers automatically)
    super.destroy();
  }
}
