/**
 * RPG Loot System - GDD Compliant
 * Handles loot drops, loot tables, and item spawning per GDD specifications:
 * - Guaranteed drops from all mobs
 * - Tier-based loot tables
 * - Visual dropped items in world
 * - Pickup mechanics
 * - Loot despawn timers
 */

import { System } from '../../core/systems/System';
import { LootEntry, MobType, RPGItem } from '../types/index';

interface DroppedItem {
  id: string;
  itemId: string;
  quantity: number;
  position: { x: number; y: number; z: number };
  droppedBy?: string;
  droppedAt: number;
  despawnTime: number;
  entityId: string;
}

interface LootTable {
  mobType: MobType;
  guaranteedDrops: LootEntry[];
  commonDrops: LootEntry[];
  uncommonDrops: LootEntry[];
  rareDrops: LootEntry[];
}

export class RPGLootSystem extends System {
  private droppedItems = new Map<string, DroppedItem>();
  private lootTables = new Map<MobType, LootTable>();
  private itemDatabase = new Map<string, RPGItem>();
  private nextItemId = 1;
  
  // Loot constants per GDD
  private readonly LOOT_DESPAWN_TIME = 300000; // 5 minutes
  private readonly PICKUP_RANGE = 2.0; // meters
  private readonly MAX_DROPPED_ITEMS = 1000; // Performance limit

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGLootSystem] Initializing loot system...');
    
    // Load item database
    await this.loadItemDatabase();
    
    // Set up loot tables per GDD specifications
    this.setupLootTables();
    
    // Listen for events
    this.world.on?.('rpg:mob:death', this.handleMobDeath.bind(this));
    this.world.on?.('rpg:loot:pickup', this.handleLootPickup.bind(this));
    this.world.on?.('rpg:player:position:update', this.checkNearbyLoot.bind(this));
    this.world.on?.('rpg:item:drop', this.dropItem.bind(this));
    
    // Start cleanup timer
    setInterval(() => {
      this.cleanupExpiredLoot();
    }, 30000); // Check every 30 seconds
    
    console.log('[RPGLootSystem] Loot system initialized with GDD-compliant drop tables');
  }

  start(): void {
    console.log('[RPGLootSystem] Loot system started');
  }

  /**
   * Load item database from data files
   */
  private async loadItemDatabase(): Promise<void> {
    // Import items from data file
    const { items } = await import('../data/items');
    
    for (const item of Object.values(items)) {
      this.itemDatabase.set(item.id, item);
    }
    
    console.log(`[RPGLootSystem] Loaded ${this.itemDatabase.size} items into database`);
  }

  /**
   * Set up loot tables per GDD specifications
   */
  private setupLootTables(): void {
    // Level 1 Mobs - Bronze tier equipment, small coin drops
    this.lootTables.set(MobType.GOBLIN, {
      mobType: MobType.GOBLIN,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(5, 15), chance: 1.0 }
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'bronze_sword', quantity: 1, chance: 0.1 },
        { itemId: 'bronze_helmet', quantity: 1, chance: 0.05 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.BANDIT, {
      mobType: MobType.BANDIT,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(8, 20), chance: 1.0 }
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'bronze_sword', quantity: 1, chance: 0.12 },
        { itemId: 'leather_body', quantity: 1, chance: 0.08 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.BARBARIAN, {
      mobType: MobType.BARBARIAN,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(10, 25), chance: 1.0 }
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
      mobType: MobType.HOBGOBLIN,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(15, 35), chance: 1.0 }
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'steel_sword', quantity: 1, chance: 0.2 },
        { itemId: 'steel_helmet', quantity: 1, chance: 0.15 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.GUARD, {
      mobType: MobType.GUARD,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(20, 40), chance: 1.0 }
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'steel_sword', quantity: 1, chance: 0.25 },
        { itemId: 'steel_shield', quantity: 1, chance: 0.18 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.DARK_WARRIOR, {
      mobType: MobType.DARK_WARRIOR,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(25, 50), chance: 1.0 }
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'steel_sword', quantity: 1, chance: 0.3 },
        { itemId: 'steel_body', quantity: 1, chance: 0.2 }
      ],
      rareDrops: []
    });

    // Level 3 Mobs - Mithril tier equipment, substantial coins
    this.lootTables.set(MobType.BLACK_KNIGHT, {
      mobType: MobType.BLACK_KNIGHT,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(50, 100), chance: 1.0 }
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'mithril_sword', quantity: 1, chance: 0.35 },
        { itemId: 'mithril_helmet', quantity: 1, chance: 0.25 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.ICE_WARRIOR, {
      mobType: MobType.ICE_WARRIOR,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(40, 80), chance: 1.0 }
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'mithril_sword', quantity: 1, chance: 0.3 },
        { itemId: 'mithril_shield', quantity: 1, chance: 0.28 }
      ],
      rareDrops: []
    });

    this.lootTables.set(MobType.DARK_RANGER, {
      mobType: MobType.DARK_RANGER,
      guaranteedDrops: [
        { itemId: 'coins', quantity: () => this.randomInt(45, 90), chance: 1.0 },
        { itemId: 'arrows', quantity: () => this.randomInt(10, 25), chance: 1.0 } // Rangers always drop arrows
      ],
      commonDrops: [],
      uncommonDrops: [
        { itemId: 'willow_bow', quantity: 1, chance: 0.25 },
        { itemId: 'mithril_helmet', quantity: 1, chance: 0.2 }
      ],
      rareDrops: []
    });

    console.log(`[RPGLootSystem] Set up ${this.lootTables.size} loot tables`);
  }

  /**
   * Handle mob death and generate loot
   */
  private async handleMobDeath(data: { mobId: string; mobType: MobType; position: { x: number; y: number; z: number }; killerId?: string }): Promise<void> {
    const lootTable = this.lootTables.get(data.mobType);
    if (!lootTable) {
      console.warn(`[RPGLootSystem] No loot table found for ${data.mobType}`);
      return;
    }

    console.log(`[RPGLootSystem] Generating loot for ${data.mobType} at position (${data.position.x}, ${data.position.y}, ${data.position.z})`);

    const lootItems: Array<{ itemId: string; quantity: number }> = [];

    // Process guaranteed drops
    for (const entry of lootTable.guaranteedDrops) {
      const quantity = typeof entry.quantity === 'function' ? entry.quantity() : entry.quantity;
      lootItems.push({ itemId: entry.itemId, quantity });
    }

    // Process uncommon drops with chance rolls
    for (const entry of lootTable.uncommonDrops) {
      if (Math.random() < entry.chance) {
        const quantity = typeof entry.quantity === 'function' ? entry.quantity() : entry.quantity;
        lootItems.push({ itemId: entry.itemId, quantity });
      }
    }

    // Process rare drops with chance rolls
    for (const entry of lootTable.rareDrops) {
      if (Math.random() < entry.chance) {
        const quantity = typeof entry.quantity === 'function' ? entry.quantity() : entry.quantity;
        lootItems.push({ itemId: entry.itemId, quantity });
      }
    }

    // Spawn loot items in world
    for (let i = 0; i < lootItems.length; i++) {
      const loot = lootItems[i];
      
      // Spread items around the drop position
      const offsetX = (Math.random() - 0.5) * 2; // -1 to 1 meter spread
      const offsetZ = (Math.random() - 0.5) * 2;
      
      const dropPosition = {
        x: data.position.x + offsetX,
        y: data.position.y + 0.5, // Slightly above ground
        z: data.position.z + offsetZ
      };
      
      await this.spawnDroppedItem(loot.itemId, loot.quantity, dropPosition, data.killerId);
    }

    // Emit loot dropped event
    this.world.emit?.('rpg:loot:dropped', {
      mobId: data.mobId,
      mobType: data.mobType,
      items: lootItems,
      position: data.position,
      killerId: data.killerId
    });
  }

  /**
   * Spawn a dropped item in the world
   */
  private async spawnDroppedItem(itemId: string, quantity: number, position: { x: number; y: number; z: number }, droppedBy?: string): Promise<void> {
    // Check item limit
    if (this.droppedItems.size >= this.MAX_DROPPED_ITEMS) {
      console.warn('[RPGLootSystem] Maximum dropped items reached, cleaning up oldest items');
      this.cleanupOldestItems(100); // Remove 100 oldest items
    }

    const item = this.itemDatabase.get(itemId);
    if (!item) {
      console.error(`[RPGLootSystem] Unknown item ID: ${itemId}`);
      return;
    }

    const dropId = `drop_${this.nextItemId++}`;
    const now = Date.now();

    // Create entity for the dropped item
    const entityManager = this.world['entity-manager'];
    if (!entityManager) {
      console.error('[RPGLootSystem] EntityManager not available');
      return;
    }

    const itemEntity = entityManager.createEntity({
      id: dropId,
      name: `${item.name} (${quantity})`,
      type: 'dropped_item',
      position: [position.x, position.y, position.z],
      components: [
        {
          type: 'mesh',
          data: {
            geometry: 'box',
            material: { color: '#FFD700' }, // Gold color for loot
            scale: [0.3, 0.3, 0.3]
          }
        },
        {
          type: 'interaction',
          data: {
            type: 'pickup',
            range: this.PICKUP_RANGE,
            label: `Pick up ${item.name} x${quantity}`
          }
        },
        {
          type: 'item_data',
          data: {
            itemId: itemId,
            quantity: quantity,
            description: `${item.name} x${quantity}`
          }
        }
      ]
    });

    const droppedItem: DroppedItem = {
      id: dropId,
      itemId: itemId,
      quantity: quantity,
      position: { ...position },
      droppedBy: droppedBy,
      droppedAt: now,
      despawnTime: now + this.LOOT_DESPAWN_TIME,
      entityId: itemEntity.id
    };

    this.droppedItems.set(dropId, droppedItem);

    console.log(`[RPGLootSystem] Spawned ${item.name} x${quantity} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  /**
   * Handle loot pickup
   */
  private async handleLootPickup(data: { playerId: string; itemId: string }): Promise<void> {
    const droppedItem = this.droppedItems.get(data.itemId);
    if (!droppedItem) {
      console.warn(`[RPGLootSystem] Dropped item not found: ${data.itemId}`);
      return;
    }

    // Check if item is still valid
    if (Date.now() > droppedItem.despawnTime) {
      console.log(`[RPGLootSystem] Item ${data.itemId} has expired`);
      this.removeDroppedItem(data.itemId);
      return;
    }

    console.log(`[RPGLootSystem] Player ${data.playerId} picking up ${droppedItem.itemId} x${droppedItem.quantity}`);

    // Try to add item to player inventory
    const success = await this.addItemToPlayer(data.playerId, droppedItem.itemId, droppedItem.quantity);
    
    if (success) {
      // Remove from world
      this.removeDroppedItem(data.itemId);
      
      // Emit pickup event
      this.world.emit?.('rpg:loot:picked_up', {
        playerId: data.playerId,
        itemId: droppedItem.itemId,
        quantity: droppedItem.quantity,
        position: droppedItem.position
      });
    } else {
      // Inventory full - show message
      this.world.emit?.('rpg:ui:message', {
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
      this.world.emit?.('rpg:inventory:add_item', {
        playerId: playerId,
        itemId: itemId,
        quantity: quantity,
        callback: (success: boolean) => resolve(success)
      });
    });
  }

  /**
   * Check for nearby loot when player moves
   */
  private checkNearbyLoot(data: { entityId: string; position: { x: number; y: number; z: number } }): void {
    // Only check for players
    if (!data.entityId.startsWith('player_')) return;

    const playerId = data.entityId;
    const playerPos = data.position;
    
    // Find nearby loot
    const nearbyLoot: DroppedItem[] = [];
    
    for (const [itemId, droppedItem] of this.droppedItems) {
      const distance = this.calculateDistance(playerPos, droppedItem.position);
      if (distance <= this.PICKUP_RANGE * 2) { // Slightly larger range for notifications
        nearbyLoot.push(droppedItem);
      }
    }

    // Emit nearby loot event for UI updates
    if (nearbyLoot.length > 0) {
      this.world.emit?.('rpg:loot:nearby', {
        playerId: playerId,
        loot: nearbyLoot.map(item => ({
          id: item.id,
          itemId: item.itemId,
          quantity: item.quantity,
          distance: this.calculateDistance(playerPos, item.position)
        }))
      });
    }
  }

  /**
   * Manual item drop (from inventory)
   */
  private async dropItem(data: { playerId: string; itemId: string; quantity: number; position: { x: number; y: number; z: number } }): Promise<void> {
    await this.spawnDroppedItem(data.itemId, data.quantity, data.position, data.playerId);
    
    console.log(`[RPGLootSystem] Player ${data.playerId} dropped ${data.itemId} x${data.quantity}`);
  }

  /**
   * Remove dropped item from world
   */
  private removeDroppedItem(itemId: string): void {
    const droppedItem = this.droppedItems.get(itemId);
    if (droppedItem) {
      const entityManager = this.world['entity-manager'];
      if (entityManager) {
        entityManager.destroyEntity(droppedItem.entityId);
      }
      this.droppedItems.delete(itemId);
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
      console.log(`[RPGLootSystem] Cleaning up ${expiredItems.length} expired loot items`);
      
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

    for (const [itemId, _] of sortedItems) {
      this.removeDroppedItem(itemId);
    }
  }

  /**
   * Utility methods
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Public API
   */
  getDroppedItems(): Map<string, DroppedItem> {
    return new Map(this.droppedItems);
  }

  getDroppedItemsNear(position: { x: number; y: number; z: number }, radius: number): DroppedItem[] {
    const nearbyItems: DroppedItem[] = [];
    
    for (const droppedItem of this.droppedItems.values()) {
      const distance = this.calculateDistance(position, droppedItem.position);
      if (distance <= radius) {
        nearbyItems.push(droppedItem);
      }
    }
    
    return nearbyItems;
  }

  getLootTable(mobType: MobType): LootTable | undefined {
    return this.lootTables.get(mobType);
  }

  destroy(): void {
    // Clean up all dropped items
    for (const itemId of this.droppedItems.keys()) {
      this.removeDroppedItem(itemId);
    }
    
    this.droppedItems.clear();
    this.lootTables.clear();
    this.itemDatabase.clear();
    
    console.log('[RPGLootSystem] System destroyed');
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