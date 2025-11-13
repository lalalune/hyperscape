import { SystemBase } from "..";
import { getSystem } from "../../../utils/SystemUtils";
import { EventType } from "../../../types/events";
import { GENERAL_STORES } from "../../../data/banks-stores";
import { getItem } from "../../../data/items";
// treasure-locations removed - stub function returning typed array
const getAllTreasureLocations = (): Array<{
  position: { x: number; y: number; z: number };
  difficulty: number;
  maxItems: number;
  description: string;
}> => [];
import { ItemType } from "../../../types/index";
import {
  ItemRarity,
  EntityType,
  InteractionType,
} from "../../../types/entities";
import type { World } from "../../../types/index";
import type { Item } from "../../../types/core/core";
import type { EntityManager } from "..";
import { groundToTerrain } from "../../../utils/game/EntityUtils";
import type { ItemSpawnerStats } from "../../../types/entities";

// Define LootItem locally - Item with quantity
type LootItem = Item & {
  quantity: number;
  rarity?: ItemRarity;
};

/**
 * ItemSpawnerSystem
 *
 * Uses EntityManager to spawn item entities instead of ItemApp objects.
 * Creates and manages all item instances across the world based on GDD specifications.
 * Handles shop items, world spawns, loot chests, and treasure placement.
 */
export class ItemSpawnerSystem extends SystemBase {
  private spawnedItems = new Map<string, string>(); // itemId -> entityId
  private shopItems = new Map<string, string[]>(); // storeId -> entityIds
  private worldItems = new Map<string, string[]>(); // location -> entityIds
  private chestItems = new Map<string, string[]>(); // chestId -> entityIds

  constructor(world: World) {
    super(world, {
      name: "item-spawner",
      dependencies: {
        required: ["entity-manager"], // Depends on EntityManager to spawn items
        optional: ["inventory", "loot", "store"], // Better with item systems
      },
      autoCleanup: true,
    });
  }

  // Helper method to convert Item to LootItem
  private toLootItem(item: Item, quantity = 1, rarity?: ItemRarity): LootItem {
    return {
      ...item,
      quantity,
      rarity: rarity || item.rarity,
    };
  }

  async init(): Promise<void> {
    // Set up type-safe event subscriptions for item spawning (4 listeners!)
    this.subscribe<{
      itemId: string;
      position: { x: number; y: number; z: number };
      quantity?: number;
    }>(
      EventType.ITEM_SPAWN_REQUEST,
      async (data) => await this.spawnItemAtLocation(data, 0),
    );
    this.subscribe<{ itemId: string }>(EventType.ITEM_DESPAWN, (data) =>
      this.despawnItem(data.itemId),
    );
    this.subscribe<{}>(
      EventType.ITEM_RESPAWN_SHOPS,
      async (_data) => await this.respawnShopItems(),
    );
    this.subscribe<{
      position: { x: number; y: number; z: number };
      lootTable: string[];
    }>(
      EventType.ITEM_SPAWN_LOOT,
      async (data) => await this.spawnLootItems(data),
    );
  }

  start(): void {
    // Wait for terrain to be ready before spawning items
    const checkTerrainAndSpawn = async () => {
      const terrainSystem = this.world.getSystem("terrain") as
        | { getHeightAt: (x: number, z: number) => number | null }
        | undefined;
      if (!terrainSystem) {
        console.warn(
          "[ItemSpawnerSystem] Terrain system not ready, waiting...",
        );
        setTimeout(checkTerrainAndSpawn, 500);
        return;
      }

      // Test if terrain has tiles loaded
      const testHeight = terrainSystem.getHeightAt(0, 0);
      if (!Number.isFinite(testHeight) || testHeight === null) {
        console.warn(
          "[ItemSpawnerSystem] Terrain tiles not generated yet, waiting...",
        );
        setTimeout(checkTerrainAndSpawn, 500);
        return;
      }

      // Spawn shop items at all towns (General Store inventory)
      await this.spawnShopItems();

      // Spawn world treasure items (equipment and resources)
      await this.spawnTreasureItems();

      // Spawn chest loot items (valuable equipment)
      await this.spawnChestLootItems();

      // Spawn resource items
      await this.spawnResourceItems();
    };

    // Start checking after a small initial delay
    setTimeout(checkTerrainAndSpawn, 1000);
  }

  private async spawnAllItemTypes(): Promise<void> {
    // Spawn shop items (tools and basic equipment)
    await this.spawnShopItems();

    // Spawn world treasure items (equipment and resources)
    await this.spawnTreasureItems();

    // Spawn chest loot items (valuable equipment)
    await this.spawnChestLootItems();

    // Spawn resource items (logs, fish in appropriate locations)
    await this.spawnResourceItems();
  }

  private async spawnTreasureItems(): Promise<void> {
    // Load treasure locations from externalized data
    const treasureLocations = getAllTreasureLocations();

    for (const location of treasureLocations) {
      const equipment = this.getEquipmentByDifficulty(location.difficulty);
      const maxItems = Math.min(equipment.length, location.maxItems);

      for (let itemIndex = 0; itemIndex < maxItems; itemIndex++) {
        const itemData = equipment[itemIndex];
        if (itemData) {
          // Spread items around the treasure location
          const angle = (itemIndex / maxItems) * Math.PI * 2;
          const radius = 1.5; // Small radius around the treasure location
          // Start with reasonable initial height - will be grounded in spawnItemFromData
          const position = {
            x: location.position.x + Math.cos(angle) * radius,
            y: location.position.y || 2,
            z: location.position.z + Math.sin(angle) * radius,
          };

          await this.spawnItemFromData(
            itemData,
            position,
            "treasure",
            location.description,
            itemIndex,
          );
        }
      }
    }
  }

  private async spawnShopItems(): Promise<void> {
    for (const store of Object.values(GENERAL_STORES)) {
      const shopItemInstances: string[] = [];

      for (let itemIndex = 0; itemIndex < store.items.length; itemIndex++) {
        const shopItem = store.items[itemIndex];
        const itemData = getItem(shopItem.itemId);

        if (itemData) {
          // Create shop display positions - Y will be grounded to terrain
          const offsetX = (itemIndex % 3) * 1.5 - 1.5; // 3 items per row
          const offsetZ = Math.floor(itemIndex / 3) * 2 - 1; // Create rows

          const position = {
            x: store.location.position.x + offsetX,
            y: 0, // Will be grounded to terrain
            z: store.location.position.z + offsetZ,
          };

          const itemApp = await this.spawnItemFromData(
            itemData,
            position,
            "shop",
            store.name,
            itemIndex,
          );
          shopItemInstances.push(itemApp);
        }
      }

      this.shopItems.set(store.name, shopItemInstances);
    }
  }

  private async spawnChestLootItems(): Promise<void> {
    // Define chest locations closer to origin for visual verification
    // Y values will be grounded to terrain
    const chestLocations = [
      { name: "Central Test Chest", x: 0, y: 0, z: 0, tier: ItemRarity.RARE },
      { name: "North Test Chest", x: 0, y: 0, z: 10, tier: ItemRarity.RARE },
      {
        name: "East Test Chest",
        x: 10,
        y: 0,
        z: 0,
        tier: ItemRarity.LEGENDARY,
      },
      { name: "South Test Chest", x: 0, y: 0, z: -10, tier: ItemRarity.RARE },
      {
        name: "West Test Chest",
        x: -10,
        y: 0,
        z: 0,
        tier: ItemRarity.LEGENDARY,
      },
    ];

    for (const chest of chestLocations) {
      const chestItemInstances: string[] = [];
      const loot = this.generateChestLoot(chest.tier);

      for (let itemIndex = 0; itemIndex < loot.length; itemIndex++) {
        const itemData = loot[itemIndex];
        if (itemData) {
          const position = {
            x: chest.x + itemIndex * 0.5 - 1,
            y: chest.y,
            z: chest.z,
          };

          const itemApp = await this.spawnItemFromData(
            itemData,
            position,
            "chest",
            chest.name,
            itemIndex,
          );
          chestItemInstances.push(itemApp);
        }
      }

      this.chestItems.set(chest.name, chestItemInstances);
    }
  }

  private async spawnResourceItems(): Promise<void> {
    // Spawn resources close to origin for easy visual verification
    // Y values will be grounded to terrain
    const resourceSpawns = [
      // Logs near origin
      { itemId: "logs", x: 2, y: 0, z: 2 },
      { itemId: "oak_logs", x: 3, y: 0, z: 2 },
      { itemId: "willow_logs", x: 4, y: 0, z: 2 },

      // Fish near origin
      { itemId: "raw_shrimps", x: -2, y: 0, z: 2 },
      { itemId: "raw_sardine", x: -3, y: 0, z: 2 },
      { itemId: "raw_trout", x: -4, y: 0, z: 2 },
      { itemId: "raw_salmon", x: -5, y: 0, z: 2 },

      // Cooked food samples
      { itemId: "cooked_shrimps", x: 2, y: 0, z: -2 },
      { itemId: "cooked_trout", x: 3, y: 0, z: -2 },
    ];

    let i = 0;
    for (const spawn of resourceSpawns) {
      const itemData = getItem(spawn.itemId);
      if (itemData) {
        const position = { x: spawn.x, y: spawn.y, z: spawn.z };
        await this.spawnItemFromData(
          itemData,
          position,
          "resource",
          "Resource Area",
          i,
        );
        i++;
      }
    }
  }

  #lastKnownIndex: Record<string, number> = {};

  private async spawnItemFromData(
    itemData: Item,
    position: { x: number; y: number; z: number },
    spawnType: string,
    location: string,
    index: number,
  ): Promise<string> {
    if (
      this.#lastKnownIndex[itemData.type] &&
      this.#lastKnownIndex[itemData.type] >= index
    ) {
      index = this.#lastKnownIndex[itemData.type] + 1;
    }
    this.#lastKnownIndex[itemData.type] = index;
    const itemId = `gdd_${itemData.id}_${location}_${index}`;

    // Ground item to terrain - use Infinity to allow any initial height difference
    // This is safe because we're always grounding to actual terrain height
    const groundedPosition = groundToTerrain(
      this.world,
      position,
      0.2,
      Infinity,
    );

    // VALIDATE: Check if Y position is reasonable
    if (groundedPosition.y > 100) {
      console.error(
        `[ItemSpawnerSystem] ❌ EXTREME Y after grounding for ${itemData.name}: ${groundedPosition.y.toFixed(2)}m`,
      );
      console.error(
        `  This suggests terrain height at (${position.x}, ${position.z}) is ${groundedPosition.y.toFixed(2)}m`,
      );
      console.error(`  Expected terrain height: 0-30m`);
    }

    // Create item entity via EntityManager
    const entityManager = getSystem(
      this.world,
      "entity-manager",
    ) as EntityManager;

    // Create entity config for item - ItemEntityConfig needs itemId at top level
    const entityConfig = {
      id: itemId,
      type: EntityType.ITEM,
      name: `Item: ${itemData.name}`,
      position: groundedPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.PICKUP,
      interactionDistance: 2,
      description: itemData.description || "",
      model: itemData.modelPath || null,
      // ItemEntityConfig required fields at top level
      itemId: itemData.id,
      itemType: this.getItemTypeString(itemData.type),
      quantity: 1,
      stackable: itemData.stackable,
      value: itemData.value || 0,
      weight: itemData.weight || 0,
      rarity: itemData.rarity || ItemRarity.COMMON,
      stats: (itemData.stats as Record<string, number>) || {},
      requirements: {
        level: itemData.requirements?.level || 1,
      },
      effects: [],
      armorSlot: itemData.equipSlot || null,
      examine: itemData.examine || "",
      modelPath: itemData.modelPath || "",
      iconPath: itemData.iconPath || "",
      healAmount: itemData.healAmount || 0,
      properties: {
        // Base entity properties
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: {
          current: 1,
          max: 1,
        },
        level: 1,
        // Item-specific properties
        itemId: itemData.id,
        harvestable: false,
        dialogue: [],
        quantity: 1,
        stackable: itemData.stackable,
        value: itemData.value || 0,
        weight: itemData.weight || 0,
        rarity: itemData.rarity,
      },
    };

    const itemEntity = await entityManager.spawnEntity(entityConfig);
    if (!itemEntity) {
      throw new Error(`Failed to spawn item: ${itemData.name}`);
    }

    // Register with systems - use grounded position, not original
    this.emitTypedEvent(EventType.ITEM_SPAWNED, {
      itemId: itemId,
      itemType: itemData.id,
      position: groundedPosition,
      spawnType: spawnType,
      location: location,
      config: entityConfig,
    });

    this.spawnedItems.set(itemId, itemEntity.id);

    return itemEntity.id;
  }

  private getItemTypeString(itemType: ItemType): string {
    switch (itemType) {
      case ItemType.WEAPON:
        return "weapon";
      case ItemType.ARMOR:
        return "armor";
      case ItemType.TOOL:
        return "tool";
      case ItemType.RESOURCE:
        return "resource";
      case ItemType.CONSUMABLE:
        return "food";
      case ItemType.CURRENCY:
        return "coins";
      case ItemType.AMMUNITION:
        return "arrow";
      default:
        return "misc";
    }
  }

  private getEquipmentByDifficulty(difficulty: number): LootItem[] {
    const equipment: LootItem[] = [];
    const itemIds: string[] = [];

    if (difficulty === 1) {
      // Bronze equipment
      itemIds.push(
        "bronze_sword",
        "bronze_shield",
        "bronze_helmet",
        "bronze_body",
        "bronze_legs",
        "wood_bow",
      );
    } else if (difficulty === 2) {
      // Steel equipment
      itemIds.push(
        "steel_sword",
        "steel_shield",
        "steel_helmet",
        "steel_body",
        "steel_legs",
        "oak_bow",
      );
    } else if (difficulty === 3) {
      // Mithril equipment
      itemIds.push(
        "mithril_sword",
        "mithril_shield",
        "mithril_helmet",
        "mithril_body",
        "mithril_legs",
        "willow_bow",
      );
    }

    for (const itemId of itemIds) {
      const item = getItem(itemId);
      if (item) {
        equipment.push(
          this.toLootItem(
            item,
            1,
            difficulty === 3 ? ItemRarity.RARE : ItemRarity.COMMON,
          ),
        );
      }
    }

    return equipment;
  }

  private generateChestLoot(tier: ItemRarity): LootItem[] {
    const loot: LootItem[] = [];
    const itemIds: string[] = [];

    if (tier === ItemRarity.RARE) {
      // Steel equipment and valuable items
      itemIds.push("steel_sword", "steel_helmet", "arrows", "coins");
    } else if (tier === ItemRarity.LEGENDARY) {
      // Mithril equipment and best items
      itemIds.push(
        "mithril_sword",
        "mithril_helmet",
        "mithril_body",
        "willow_bow",
        "arrows",
      );
    }

    for (const itemId of itemIds) {
      const item = getItem(itemId);
      if (item) {
        loot.push(this.toLootItem(item, itemId === "coins" ? 100 : 1, tier));
      }
    }

    return loot;
  }

  private async spawnItemAtLocation(
    data: {
      itemId: string;
      position: { x: number; y: number; z: number };
      quantity?: number;
      model?: string;
    },
    index: number,
  ): Promise<void> {
    const itemData = getItem(data.itemId);
    if (!itemData) {
      throw new Error(`[ItemSpawnerSystem] Unknown item ID: ${data.itemId}`);
    }
    await this.spawnItemFromData(
      itemData,
      data.position,
      "spawned",
      "Dynamic Spawn",
      index,
    );
  }

  private despawnItem(itemId: string): void {
    const entityId = this.spawnedItems.get(itemId);
    if (entityId) {
      this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
      this.spawnedItems.delete(itemId);
    }
  }

  // Public method for test systems
  public async spawnItem(
    itemId: string,
    position: { x: number; y: number; z: number },
    index: number,
    _quantity: number = 1,
  ): Promise<string> {
    const itemData = getItem(itemId);
    if (!itemData) {
      throw new Error(`[ItemSpawnerSystem] Unknown item ID: ${itemId}`);
    }

    return await this.spawnItemFromData(
      itemData,
      position,
      "test",
      "Test Environment",
      index,
    );
  }

  private async respawnShopItems(): Promise<void> {
    // Clear existing shop items
    for (const [_shopName, entityIds] of this.shopItems) {
      entityIds.forEach((entityId) => {
        this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
      });
    }
    this.shopItems.clear();

    // Respawn shop items
    await this.spawnShopItems();
  }

  private async spawnLootItems(data: {
    position: { x: number; y: number; z: number };
    lootTable: string[];
  }): Promise<void> {
    for (let index = 0; index < data.lootTable.length; index++) {
      const itemId = data.lootTable[index];
      const itemData = getItem(itemId);
      if (itemData) {
        const offsetPosition = {
          x: data.position.x + (index % 3) * 0.5 - 0.5,
          y: data.position.y,
          z: data.position.z + Math.floor(index / 3) * 0.5 - 0.5,
        };

        await this.spawnItemFromData(
          itemData,
          offsetPosition,
          "loot",
          "Mob Drop",
          index,
        );
      }
    }
  }

  // Public API
  getSpawnedItems(): Map<string, string> {
    return this.spawnedItems;
  }

  getItemCount(): number {
    return this.spawnedItems.size;
  }

  getItemsByType(itemType: string): string[] {
    const entityManager = getSystem(
      this.world,
      "entity-manager",
    ) as EntityManager;

    const matchingEntityIds: string[] = [];
    for (const [_id, entityId] of this.spawnedItems) {
      const entity = entityManager.getEntity(entityId)!;
      const itemComponent = entity.getComponent("item_data")!;
      if (itemComponent.data.type === itemType) {
        matchingEntityIds.push(entityId);
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

  getItemStats(): ItemSpawnerStats {
    const stats = {
      totalItems: this.spawnedItems.size,
      shopItems: 0,
      treasureItems: 0,
      chestItems: 0,
      resourceItems: 0,
      lootItems: 0,
      byType: {} as Record<string, number>,
    };

    const entityManager = getSystem(
      this.world,
      "entity-manager",
    ) as EntityManager;

    for (const [_itemId, entityId] of this.spawnedItems) {
      const entity = entityManager.getEntity(entityId)!;
      const itemComponent = entity.getComponent("item_data")!;
      // Count by item type
      const itemType = (itemComponent.data.type as string) || "misc";
      stats.byType[itemType] = (stats.byType[itemType] || 0) + 1;

      // Count by spawn type
      const spawnType = (itemComponent.data.spawnType as string) || "unknown";
      if (spawnType === "shop") stats.shopItems++;
      else if (spawnType === "treasure") stats.treasureItems++;
      else if (spawnType === "chest") stats.chestItems++;
      else if (spawnType === "resource") stats.resourceItems++;
      else if (spawnType === "loot") stats.lootItems++;
    }

    return stats;
  }

  // Required System lifecycle methods
  update(_dt: number): void {
    // Update item behaviors, check for respawns, etc.
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all spawn tracking
    this.spawnedItems.clear();
    this.shopItems.clear();
    this.worldItems.clear();
    this.chestItems.clear();

    // Call parent cleanup
    super.destroy();
  }
}
