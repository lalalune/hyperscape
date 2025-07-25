import { System } from '../../core/systems/System';
import { RPG_ITEMS, SHOP_ITEMS, getItem, getItemsByType } from '../data/items';
import { GENERAL_STORES, StoreData } from '../data/banks-stores';
import { ItemType } from '../types/index';

/**
 * ItemSpawnerSystem
 * 
 * Uses EntityManager to spawn item entities instead of RPGItemApp objects.
 * Creates and manages all item instances across the world based on GDD specifications.
 * Handles shop items, world spawns, loot chests, and treasure placement.
 */
export class ItemSpawnerSystem extends System {
  private spawnedItems = new Map<string, string>(); // itemId -> entityId
  private shopItems = new Map<string, string[]>(); // storeId -> entityIds
  private worldItems = new Map<string, string[]>(); // location -> entityIds
  private chestItems = new Map<string, string[]>(); // chestId -> entityIds
  private itemIdCounter = 0;
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[ItemSpawnerSystem] ====================================');
    console.log('[ItemSpawnerSystem] Starting GDD item spawning system...');
    console.log('[ItemSpawnerSystem] ====================================');
    
    try {
      // Spawn shop items at all towns (General Store inventory)
      await this.spawnShopItems();
      
      // Spawn world treasure items (equipment and resources)
      await this.spawnTreasureItems();
      
      // Spawn chest loot items (valuable equipment)
      await this.spawnChestLootItems();
      
      // Spawn resource items
      await this.spawnResourceItems();
      
      console.log('[ItemSpawnerSystem] ====================================');
      console.log(`[ItemSpawnerSystem] Successfully spawned ${this.spawnedItems.size} items from GDD data`);
      console.log('[ItemSpawnerSystem] ====================================');
      
      // Listen for item spawning events
      this.world.on?.('rpg:item:spawn_request', this.spawnItemAtLocation.bind(this));
      this.world.on?.('rpg:item:despawn', this.despawnItem.bind(this));
      this.world.on?.('rpg:item:respawn_shops', this.respawnShopItems.bind(this));
      this.world.on?.('rpg:item:spawn_loot', this.spawnLootItems.bind(this));
      
      console.log('[ItemSpawnerSystem] Item spawner system initialized');
    } catch (error) {
      console.error('[ItemSpawnerSystem] Failed to spawn items:', error);
    }
  }

  start(): void {
    console.log('[ItemSpawnerSystem] Starting GDD item spawning...');
    
    // Spawn all item types across their appropriate locations
    this.spawnAllItemTypes();
    
    console.log('[ItemSpawnerSystem] All GDD items spawned successfully');
  }

  private spawnAllItemTypes(): void {
    console.log('[ItemSpawnerSystem] Spawning all 50+ GDD item types...');
    
    // Spawn shop items (tools and basic equipment)
    this.spawnShopItems();
    
    // Spawn world treasure items (equipment and resources)
    this.spawnTreasureItems();
    
    // Spawn chest loot items (valuable equipment)
    this.spawnChestLootItems();
    
    // Spawn resource items (logs, fish in appropriate locations)
    this.spawnResourceItems();
    
    console.log(`[ItemSpawnerSystem] Successfully spawned ${this.spawnedItems.size} items from GDD data`);
  }

  private async spawnTreasureItems(): Promise<void> {
    console.log('[ItemSpawnerSystem] Spawning treasure items in level-appropriate zones...');
    
    const treasureLocations = [
      // Level 1 areas (starting zones)
      { x: 6, y: 2, z: 6, difficulty: 1 },
      { x: -6, y: 2, z: 6, difficulty: 1 },
      { x: 6, y: 2, z: -6, difficulty: 1 },
      { x: -6, y: 2, z: -6, difficulty: 1 },
      // Level 2 areas
      { x: 12, y: 2, z: 12, difficulty: 2 },
      { x: -12, y: 2, z: 12, difficulty: 2 },
      { x: 12, y: 2, z: -12, difficulty: 2 },
      { x: -12, y: 2, z: -12, difficulty: 2 },
      // Level 3 areas
      { x: 16, y: 2, z: 16, difficulty: 3 },
      { x: -16, y: 2, z: 16, difficulty: 3 },
      { x: 16, y: 2, z: -16, difficulty: 3 }
    ];
    
    for (const location of treasureLocations) {
      const equipment = this.getEquipmentByDifficulty(location.difficulty);
      for (let itemIndex = 0; itemIndex < equipment.length; itemIndex++) {
        const itemData = equipment[itemIndex];
        if (itemData) {
          const position = {
            x: location.x + (itemIndex * 2) - 3, // Spread items around the location
            y: location.y,
            z: location.z + (itemIndex % 2) * 2 - 1
          };
          
          await this.spawnItemFromData(itemData, position, 'treasure', `Level ${location.difficulty} Zone`);
        }
      }
    }
  }

  private spawnShopItems(): void {
    console.log('[ItemSpawnerSystem] Spawning shop items at general stores...');
    
    for (const store of Object.values(GENERAL_STORES)) {
      const shopItemInstances: string[] = [];
      
      for (let itemIndex = 0; itemIndex < store.items.length; itemIndex++) {
        const shopItem = store.items[itemIndex];
        const itemData = getItem(shopItem.itemId);
        
        if (itemData) {
          // Create shop display positions
          const offsetX = (itemIndex % 3) * 1.5 - 1.5; // 3 items per row
          const offsetZ = Math.floor(itemIndex / 3) * 2 - 1; // Create rows
          
          const position = {
            x: store.location.position.x + offsetX,
            y: store.location.position.y + 0.5, // Slightly elevated for display
            z: store.location.position.z + offsetZ
          };
          
          const itemApp = this.spawnItemFromData(itemData, position, 'shop', store.name);
          if (itemApp) {
            shopItemInstances.push(itemApp);
          }
        }
      }
      
      this.shopItems.set(store.name, shopItemInstances);
      console.log(`[ItemSpawnerSystem] Spawned ${shopItemInstances.length} items at ${store.name}`);
    }
  }

  private spawnChestLootItems(): void {
    console.log('[ItemSpawnerSystem] Spawning chest loot items close to origin...');
    
    // Define chest locations closer to origin for visual verification
    const chestLocations = [
      { name: 'Central Test Chest', x: 0, y: 3, z: 0, tier: 'rare' },
      { name: 'North Test Chest', x: 0, y: 3, z: 10, tier: 'rare' },
      { name: 'East Test Chest', x: 10, y: 3, z: 0, tier: 'legendary' },
      { name: 'South Test Chest', x: 0, y: 3, z: -10, tier: 'rare' },
      { name: 'West Test Chest', x: -10, y: 3, z: 0, tier: 'legendary' }
    ];
    
    for (const chest of chestLocations) {
      const chestItemInstances: string[] = [];
      const loot = this.generateChestLoot(chest.tier);
      
      for (let itemIndex = 0; itemIndex < loot.length; itemIndex++) {
        const itemData = loot[itemIndex];
        if (itemData) {
          const position = {
            x: chest.x + (itemIndex * 0.5) - 1,
            y: chest.y,
            z: chest.z
          };
          
          const itemApp = this.spawnItemFromData(itemData, position, 'chest', chest.name);
          if (itemApp) {
            chestItemInstances.push(itemApp);
          }
        }
      }
      
      this.chestItems.set(chest.name, chestItemInstances);
      console.log(`[ItemSpawnerSystem] Spawned ${chestItemInstances.length} items in ${chest.name}`);
    }
  }

  private async spawnResourceItems(): Promise<void> {
    console.log('[ItemSpawnerSystem] Spawning resource items close to origin for visual verification...');
    
    // Spawn resources close to origin for easy visual verification
    const resourceSpawns = [
      // Logs near origin
      { itemId: 'logs', x: 2, y: 2, z: 2 },
      { itemId: 'oak_logs', x: 3, y: 2, z: 2 },
      { itemId: 'willow_logs', x: 4, y: 2, z: 2 },
      
      // Fish near origin  
      { itemId: 'raw_shrimps', x: -2, y: 2, z: 2 },
      { itemId: 'raw_sardine', x: -3, y: 2, z: 2 },
      { itemId: 'raw_trout', x: -4, y: 2, z: 2 },
      { itemId: 'raw_salmon', x: -5, y: 2, z: 2 },
      
      // Cooked food samples
      { itemId: 'cooked_shrimps', x: 2, y: 2, z: -2 },
      { itemId: 'cooked_trout', x: 3, y: 2, z: -2 }
    ];
    
    for (const spawn of resourceSpawns) {
      const itemData = getItem(spawn.itemId);
      if (itemData) {
        await this.spawnItemFromData(itemData, spawn, 'resource', 'Resource Area');
      }
    }
  }

  private spawnItemFromData(itemData: any, position: { x: number; y: number; z: number }, spawnType: string, location: string): string | null {
    const itemId = `gdd_${itemData.id}_${this.itemIdCounter++}`;
    
    console.log(`[ItemSpawnerSystem] Spawning ${itemData.name} at ${location} (${position.x}, ${position.y}, ${position.z})`);
    
    try {
      // Use EntityManager to spawn item via event system
      this.world.emit('item:spawn', {
        id: itemData.id,
        name: itemData.name,
        description: itemData.description || '',
        type: this.getItemTypeString(itemData.type),
        stackable: itemData.stackable,
        quantity: 1, // Default quantity for spawned items
        value: itemData.value || 0,
        model: itemData.modelPath || '',
        icon: itemData.iconPath || '',
        requirements: itemData.requirements || {},
        bonuses: itemData.bonuses || {},
        weaponType: itemData.weaponType || null,
        armorSlot: itemData.armorSlot || null,
        healAmount: itemData.healAmount || 0,
        spawnType: spawnType,
        location: location
      });

      // Create item entity via EntityManager
      const entityManager = this.world['rpg-entity-manager'];
      if (!entityManager) {
        console.error('[ItemSpawnerSystem] RPGEntityManager not available');
        return null;
      }

      // Create entity config for item
      const entityConfig = {
        id: itemId,
        type: 'item' as const,
        position: [position.x, position.y, position.z] as [number, number, number],
        name: itemData.name,
        itemId: itemData.id,
        description: itemData.description || '',
        itemType: this.getItemTypeString(itemData.type),
        stackable: itemData.stackable,
        quantity: 1,
        value: itemData.value || 0,
        requirements: itemData.requirements || {},
        bonuses: itemData.bonuses || {},
        weaponType: itemData.weaponType || null,
        armorSlot: itemData.armorSlot || null,
        healAmount: itemData.healAmount || 0,
        spawnType: spawnType,
        location: location
      };

      const itemEntity = entityManager.spawnEntity(entityConfig);
      
      // Register with systems
      this.world.emit?.('rpg:item:spawned', {
        itemId: itemId,
        itemType: itemData.id,
        position: position,
        spawnType: spawnType,
        location: location,
        config: entityConfig
      });
      
      if (itemEntity) {
        this.spawnedItems.set(itemId, itemEntity.id);
      }
      
      console.log(`[ItemSpawnerSystem] ✅ Successfully spawned ${itemData.name} with ID: ${itemId}`);
      
      return itemEntity.id;
      
    } catch (error) {
      console.error(`[ItemSpawnerSystem] ❌ Failed to spawn ${itemData.name}:`, error);
      return null;
    }
  }

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

  private getEquipmentByDifficulty(difficulty: number): any[] {
    const equipment: any[] = [];
    
    if (difficulty === 1) {
      // Bronze equipment
      equipment.push(getItem('bronze_sword'));
      equipment.push(getItem('bronze_shield'));
      equipment.push(getItem('bronze_helmet'));
      equipment.push(getItem('bronze_body'));
      equipment.push(getItem('bronze_legs'));
      equipment.push(getItem('wood_bow'));
    } else if (difficulty === 2) {
      // Steel equipment
      equipment.push(getItem('steel_sword'));
      equipment.push(getItem('steel_shield'));
      equipment.push(getItem('steel_helmet'));
      equipment.push(getItem('steel_body'));
      equipment.push(getItem('steel_legs'));
      equipment.push(getItem('oak_bow'));
    } else if (difficulty === 3) {
      // Mithril equipment
      equipment.push(getItem('mithril_sword'));
      equipment.push(getItem('mithril_shield'));
      equipment.push(getItem('mithril_helmet'));
      equipment.push(getItem('mithril_body'));
      equipment.push(getItem('mithril_legs'));
      equipment.push(getItem('willow_bow'));
    }
    
    return equipment.filter(item => item !== null);
  }

  private generateChestLoot(tier: string): any[] {
    const loot: any[] = [];
    
    if (tier === 'rare') {
      // Steel equipment and valuable items
      loot.push(getItem('steel_sword'));
      loot.push(getItem('steel_helmet'));
      loot.push(getItem('arrows'));
      loot.push(getItem('coins'));
    } else if (tier === 'legendary') {
      // Mithril equipment and best items
      loot.push(getItem('mithril_sword'));
      loot.push(getItem('mithril_helmet'));
      loot.push(getItem('mithril_body'));
      loot.push(getItem('willow_bow'));
      loot.push(getItem('arrows'));
    }
    
    return loot.filter(item => item !== null);
  }

  private spawnItemAtLocation(data: { itemId: string; position: { x: number; y: number; z: number }; quantity?: number }): void {
    const itemData = getItem(data.itemId);
    if (!itemData) {
      console.error(`[ItemSpawnerSystem] Unknown item ID: ${data.itemId}`);
      return;
    }
    
    this.spawnItemFromData(itemData, data.position, 'spawned', 'Dynamic Spawn');
  }

  private despawnItem(itemId: string): void {
    const entityId = this.spawnedItems.get(itemId);
    if (entityId) {
      this.world.emit('entity:destroy', { entityId });
      this.spawnedItems.delete(itemId);
      
      console.log(`[ItemSpawnerSystem] Despawned item: ${itemId}`);
    }
  }

  private respawnShopItems(): void {
    console.log('[ItemSpawnerSystem] Respawning all shop items...');
    
    // Clear existing shop items
    for (const [shopName, entityIds] of this.shopItems) {
      entityIds.forEach(entityId => {
        this.world.emit('entity:destroy', { entityId });
      });
    }
    this.shopItems.clear();
    
    // Respawn shop items
    this.spawnShopItems();
  }

  private spawnLootItems(data: { position: { x: number; y: number; z: number }; lootTable: string[] }): void {
    console.log(`[ItemSpawnerSystem] Spawning loot items at (${data.position.x}, ${data.position.y}, ${data.position.z})`);
    
    data.lootTable.forEach((itemId, index) => {
      const itemData = getItem(itemId);
      if (itemData) {
        const offsetPosition = {
          x: data.position.x + (index % 3) * 0.5 - 0.5,
          y: data.position.y,
          z: data.position.z + Math.floor(index / 3) * 0.5 - 0.5
        };
        
        this.spawnItemFromData(itemData, offsetPosition, 'loot', 'Mob Drop');
      }
    });
  }

  // Public API
  getSpawnedItems(): Map<string, string> {
    return this.spawnedItems;
  }

  getItemCount(): number {
    return this.spawnedItems.size;
  }

  getItemsByType(itemType: string): string[] {
    const entityManager = this.world['entity-manager'];
    if (!entityManager) return [];
    
    const matchingEntityIds: string[] = [];
    for (const [id, entityId] of this.spawnedItems) {
      const entity = entityManager.getEntity(entityId);
      if (entity && entity.hasComponent('item_data')) {
        const itemData = entity.getComponent('item_data');
        if (itemData && itemData.type === itemType) {
          matchingEntityIds.push(entityId);
        }
      }
    }
    return matchingEntityIds;
  }

  getShopItems(): Map<string, string[]> {
    return this.shopItems;
  }

  getChestItems(): Map<string, string[]> {
    return this.chestItems;
  }

  getItemStats(): any {
    const stats = {
      totalItems: this.spawnedItems.size,
      shopItems: 0,
      treasureItems: 0,
      chestItems: 0,
      resourceItems: 0,
      lootItems: 0,
      byType: {} as Record<string, number>
    };
    
    const entityManager = this.world['entity-manager'];
    if (!entityManager) return stats;
    
    for (const [itemId, entityId] of this.spawnedItems) {
      const entity = entityManager.getEntity(entityId);
      if (entity && entity.hasComponent('item_data')) {
        const itemData = entity.getComponent('item_data');
        if (itemData) {
          // Count by item type
          const itemType = itemData.type || 'misc';
          stats.byType[itemType] = (stats.byType[itemType] || 0) + 1;
          
          // Count by spawn type
          const spawnType = itemData.spawnType || 'unknown';
          if (spawnType === 'shop') stats.shopItems++;
          else if (spawnType === 'treasure') stats.treasureItems++;
          else if (spawnType === 'chest') stats.chestItems++;
          else if (spawnType === 'resource') stats.resourceItems++;
          else if (spawnType === 'loot') stats.lootItems++;
        }
      }
    }
    
    return stats;
  }

  // Required System lifecycle methods
  update(dt: number): void {
    // Update item behaviors, check for respawns, etc.
  }

  destroy(): void {
    // Clean up all spawned items
    for (const [itemId, entityId] of this.spawnedItems) {
      this.world.emit('entity:destroy', { entityId });
    }
    this.spawnedItems.clear();
    this.shopItems.clear();
    this.chestItems.clear();
    this.worldItems.clear();
    console.log('[ItemSpawnerSystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}