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
import { LootTable, ItemType, InventoryItem } from '../types/core';
import { ItemRarity, EntityType, InteractionType } from '../types/entities';
import type { HeadstoneEntityConfig } from '../types/entities';
import { MobType, Item } from '../types/index';
import { SystemBase } from './SystemBase';
import type { ItemEntityConfig } from '../types/entities';
// LootEntry unused for now
import { items } from '../data/items';
import type { DroppedItem, } from '../types/systems';
import { calculateDistance, groundToTerrain } from '../utils/EntityUtils';
import { EntityManager } from './EntityManager';


export class LootSystem extends SystemBase {
  private lootTables = new Map<MobType, LootTable>();
  private itemDatabase = new Map<string, Item>();
  private droppedItems = new Map<string, DroppedItem>();
  private nextItemId = 1;
  
  // Loot constants per GDD
  private readonly LOOT_DESPAWN_TIME = 300000; // 5 minutes
  private readonly PICKUP_RANGE = 2.0; // meters
  private readonly MAX_DROPPED_ITEMS = 1000; // Performance limit

  constructor(world: World) {
    super(world, {
      name: 'loot',
      dependencies: {
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
    // NOTE: REMOVED - LootSystem should NOT subscribe to ITEM_DROP
    // ITEM_DROP is for player inventory drops only (handled by InventorySystem)
    // LootSystem handles mob loot via MOB_DEATH event and emits ITEM_SPAWN
    // this.subscribe<{ position: { x: number; y: number; z: number }; lootEntries: { itemId: string; quantity: number }[] }>(EventType.ITEM_DROP, (data) => {
    //   const items = data.lootEntries.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity }));
    //   this.handleLootDropRequest({ position: data.position, items });
    // });
    // NOTE: REMOVED - Do NOT subscribe to ITEM_PICKUP here, it conflicts with InventorySystem
    // InventorySystem is the authoritative handler for ITEM_PICKUP
    // LootSystem should only drop loot via ITEM_SPAWN events
    // this.subscribe<{ playerId: string; itemId: string }>(EventType.ITEM_PICKUP, (data) => { 
    //   this.handleLootPickup(data);
    // });
    this.subscribe<{ playerId: string; position: { x: number; y: number; z: number } }>(EventType.PLAYER_POSITION_UPDATED, (_event) => {
      // Check nearby loot - need to implement this method

    });
    this.subscribe<{ playerId: string; itemId: string; quantity: number; position: { x: number; y: number; z: number } }>(EventType.ITEM_DROPPED, (data) => this.dropItem(data));
    
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
   */
  private setupLootTables(): void {
    // Level 1 Mobs - Bronze tier equipment, small coin drops
    this.lootTables.set(MobType.GOBLIN, {
      id: 'goblin_loot',
      mobType: MobType.GOBLIN,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 10, chance: 1.0 } // 5-15 coins, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'bronze_sword', quantity: 1, chance: 0.1 },
        { itemId: 'bronze_helmet', quantity: 1, chance: 0.05 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.BANDIT, {
      id: 'bandit_loot',
      mobType: MobType.BANDIT,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 14, chance: 1.0 } // 8-20 coins, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'bronze_sword', quantity: 1, chance: 0.12 },
        { itemId: 'leather_body', quantity: 1, chance: 0.08 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.BARBARIAN, {
      id: 'barbarian_loot',
      mobType: MobType.BARBARIAN,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 17, chance: 1.0 } // 10-25 coins, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'bronze_sword', quantity: 1, chance: 0.15 },
        { itemId: 'studded_leather_body', quantity: 1, chance: 0.1 }
      ],
      rareDrops: []
    });

    // Level 2 Mobs - Steel tier equipment, more coins
    this.lootTables.set(MobType.HOBGOBLIN, {
      id: 'hobgoblin_loot',
      mobType: MobType.HOBGOBLIN,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 25, chance: 1.0 } // 15-35 coins, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'steel_sword', quantity: 1, chance: 0.2 },
        { itemId: 'steel_helmet', quantity: 1, chance: 0.15 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.DARK_WARRIOR, {
      id: 'dark_warrior_loot',
      mobType: MobType.DARK_WARRIOR,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 45, chance: 1.0 } // Per GDD data
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'steel_sword', quantity: 1, chance: 0.25 },
        { itemId: 'steel_shield', quantity: 1, chance: 0.20 },
        { itemId: 'steel_body', quantity: 1, chance: 0.15 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.GUARD, {
      id: 'guard_loot',
      mobType: MobType.GUARD,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 30, chance: 1.0 } // 20-40 coins, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'steel_sword', quantity: 1, chance: 0.25 },
        { itemId: 'steel_shield', quantity: 1, chance: 0.18 }
      ],
      rareDrops: []
    });



    // Level 3 Mobs - Mithril tier equipment, substantial coins
    this.lootTables.set(MobType.BLACK_KNIGHT, {
      id: 'black_knight_loot',
      mobType: MobType.BLACK_KNIGHT,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 75, chance: 1.0 } // 50-100 coins, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'mithril_sword', quantity: 1, chance: 0.35 },
        { itemId: 'mithril_helmet', quantity: 1, chance: 0.25 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.ICE_WARRIOR, {
      id: 'ice_warrior_loot',
      mobType: MobType.ICE_WARRIOR,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 60, chance: 1.0 } // 40-80 coins, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'mithril_sword', quantity: 1, chance: 0.3 },
        { itemId: 'mithril_shield', quantity: 1, chance: 0.28 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.DARK_RANGER, {
      id: 'dark_ranger_loot',
      mobType: MobType.DARK_RANGER,
      guaranteedDrops: [
        { itemId: 'coins', quantity: 67, chance: 1.0 }, // 45-90 coins, randomized on drop
        { itemId: 'arrows', quantity: 17, chance: 1.0 } // 10-25 arrows, randomized on drop
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'willow_bow', quantity: 1, chance: 0.25 },
        { itemId: 'mithril_helmet', quantity: 1, chance: 0.2 }
      ],
      rareDrops: []
    });

  }

  /**
   * Handle mob death and generate loot
   */
  private async handleMobDeath(data: { mobId: string; mobType: string; level: number; killedBy: string; position: { x: number; y: number; z: number } }): Promise<void> {

    const mobTypeEnum = data.mobType as MobType;
    const lootTable = this.lootTables.get(mobTypeEnum);
    if (!lootTable) {
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

    console.log(`[LootSystem] 💀 Spawned corpse ${corpseId} with ${inventoryItems.length} items at (${groundedPosition.x.toFixed(1)}, ${groundedPosition.z.toFixed(1)})`);

    // Emit loot dropped event
    this.emitTypedEvent(EventType.LOOT_DROPPED, {
      mobId: data.mobId,
      mobType: mobTypeEnum,
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
      entityId: dropId, // Store the entity ID for removal
      mesh: itemEntity.node || null // Associate the entity's mesh if available
    };

    this.droppedItems.set(dropId, droppedItem);
  }

  /**
   * Handle loot drop request from mob death (from MobSystem generateLoot)
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
      
      // Use the item ID directly since lootItems have itemId property
      const itemId = lootItem.itemId;
      const quantity = lootItem.quantity;
      
      await this.spawnDroppedItem(itemId, quantity, dropPosition, 'mob_drop');
    }

    // Emit loot dropped event
    this.emitTypedEvent(EventType.LOOT_DROPPED, {
      items: data.items,
      position: data.position
    });
  }

  /**
   * Handle loot pickup
   */
  private async handleLootPickup(data: { playerId: string; itemId: string }): Promise<void> {
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
      
      // Emit pickup event
      this.emitTypedEvent(EventType.ITEM_PICKUP, {
        playerId: data.playerId,
        itemId: droppedItem.itemId,
        quantity: droppedItem.quantity,
        position: droppedItem.position
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
          slot: 0, // Will be handled by inventory system
          metadata: null
        }
      });
      // Since the event is async and doesn't have a callback mechanism in the current implementation,
      // we'll assume success for now
      resolve(true);
    });
  }

  /**
   * Check for nearby loot when player moves
   */
  private checkNearbyLoot(data: { entityId: string; position: { x: number; y: number; z: number } }): void {
    // Only check for players
    if (!data.entityId.startsWith('player_')) return;

    const _playerId = data.entityId;
    const playerPos = data.position;
    
    // Find nearby loot
    const nearbyLoot: DroppedItem[] = [];
    
    for (const [_itemId, droppedItem] of this.droppedItems) {
      const distance = calculateDistance(playerPos, droppedItem.position);
      if (distance <= this.PICKUP_RANGE * 2) { // Slightly larger range for notifications
        nearbyLoot.push(droppedItem);
      }
    }

    // Emit nearby loot event for UI updates
    if (nearbyLoot.length > 0) {
      // Show message about nearby loot
            this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.entityId,
        message: `${nearbyLoot.length} item${nearbyLoot.length > 1 ? 's' : ''} nearby`,
        type: 'info' as const
      });
    }
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

  /**
   * Utility methods
   */
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
   * Force immediate cleanup of all expired loot (for testing purposes)
   * This bypasses the normal 5-minute despawn timer
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
