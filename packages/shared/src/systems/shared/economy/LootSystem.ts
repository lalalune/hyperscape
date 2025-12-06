/**
 * Loot System - GDD Compliant (TICK-BASED)
 * Handles loot drops, loot tables, and item spawning per GDD specifications:
 * - Guaranteed drops from all mobs
 * - Tier-based loot tables
 * - OSRS-style ground items (not corpse entities)
 * - Pickup mechanics via ItemInteractionHandler
 * - TICK-BASED despawn timers via GroundItemManager
 *
 * OSRS-STYLE BEHAVIOR:
 * - Mob dies → Items drop directly to ground at tile center
 * - Items pile on same tile, stackables merge
 * - Click item directly to pick up (no loot window)
 * - 2 minute despawn timer per item
 *
 * @see https://oldschool.runescape.wiki/w/Loot
 * @see https://oldschool.runescape.wiki/w/Dropped_items
 */

import type { World } from "../../../types/index";
import { EventType } from "../../../types/events";
import { LootTable, InventoryItem, ItemType } from "../../../types/core/core";
import { ItemRarity } from "../../../types/entities";
import type { ItemEntityConfig } from "../../../types/entities";
import { Item } from "../../../types/index";
import { SystemBase } from "..";
import { items } from "../../../data/items";
import type { DroppedItem } from "../../../types/systems/system-interfaces";
import { groundToTerrain } from "../../../utils/game/EntityUtils";
import { EntityManager } from "..";
import { ALL_NPCS } from "../../../data/npcs";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { ticksToMs } from "../../../utils/game/CombatCalculations";
import { GroundItemManager } from "../death/GroundItemManager";

export class LootSystem extends SystemBase {
  private lootTables = new Map<string, LootTable>(); // String key = mob ID from mobs.json
  private itemDatabase = new Map<string, Item>();
  private droppedItems = new Map<string, DroppedItem>(); // For manual player drops only
  private groundItemManager: GroundItemManager | null = null; // For mob loot (OSRS-style)
  private nextItemId = 1;

  // Loot constants per GDD (converted from tick constants for backwards compatibility)
  private readonly LOOT_DESPAWN_TIME_MS = ticksToMs(
    COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS,
  );
  private readonly PICKUP_RANGE = 5; // meters
  private readonly MAX_DROPPED_ITEMS = 1000; // Performance limit

  constructor(world: World) {
    super(world, {
      name: "loot",
      dependencies: {
        required: [], // Self-contained loot management
        optional: ["inventory", "entity-manager", "ui", "client-graphics"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Load item database
    this.loadItemDatabase();

    // Set up loot tables per GDD specifications
    this.setupLootTables();

    // Initialize GroundItemManager for OSRS-style mob loot drops
    const entityManager = this.world.getSystem<EntityManager>("entity-manager");
    if (entityManager) {
      // Use "mob" prefix to prevent ID collisions with PlayerDeathSystem's GroundItemManager
      this.groundItemManager = new GroundItemManager(
        this.world,
        entityManager,
        "mob",
      );
    } else {
      console.warn(
        "[LootSystem] EntityManager not found - mob loot drops disabled",
      );
    }

    // Subscribe to loot events using type-safe event system
    // Listen for the official mob death event (normalize various emitters)
    this.subscribe(
      EventType.NPC_DIED,
      (event: {
        mobId?: string;
        killerId?: string;
        mobType?: string;
        level?: number;
        killedBy?: string;
        position?: { x: number; y: number; z: number };
      }) => {
        const d = event;
        // Backfill minimal shape expected by handleMobDeath if missing
        const payload = {
          mobId: d.mobId as string,
          mobType: (d.mobType || "unknown") as string,
          level: (d.level ?? 1) as number,
          killedBy: (d.killerId ?? d.killedBy ?? "unknown") as string,
          position: d.position ?? { x: 0, y: 0, z: 0 },
        };
        this.handleMobDeath(payload);
      },
    );

    // Subscribe to manual item drops (from player inventory)
    this.subscribe(EventType.ITEM_DROPPED, (data) =>
      this.dropItem(
        data as {
          playerId: string;
          itemId: string;
          quantity: number;
          position: { x: number; y: number; z: number };
        },
      ),
    );

    // NOTE: Ground item pickup is handled by InventorySystem via ITEM_PICKUP event
    // NOTE: Cleanup is now tick-based via processTick() called by TickSystem
  }

  /**
   * Process tick - check for expired ground items and dropped items (TICK-BASED)
   * Called once per tick by TickSystem
   *
   * @param currentTick - Current server tick number
   */
  processTick(currentTick: number): void {
    // Process ground item despawn (OSRS-style mob loot)
    if (this.groundItemManager) {
      this.groundItemManager.processTick(currentTick);
    }

    // Clean up expired manually dropped items (legacy time-based check)
    this.cleanupExpiredLoot();
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
      if (
        npcData.category !== "mob" &&
        npcData.category !== "boss" &&
        npcData.category !== "quest"
      ) {
        continue;
      }

      // Convert unified drop system to loot table format
      const guaranteedDrops: Array<{
        itemId: string;
        quantity: number;
        chance: number;
      }> = [];
      const commonDrops: Array<{
        itemId: string;
        quantity: number;
        chance: number;
      }> = [];
      const uncommonDrops: Array<{
        itemId: string;
        quantity: number;
        chance: number;
      }> = [];
      const rareDrops: Array<{
        itemId: string;
        quantity: number;
        chance: number;
      }> = [];

      // Add default drop if enabled
      if (npcData.drops.defaultDrop.enabled) {
        guaranteedDrops.push({
          itemId: npcData.drops.defaultDrop.itemId,
          quantity: npcData.drops.defaultDrop.quantity,
          chance: 1.0,
        });
      }

      // Add all drop tiers
      for (const drop of npcData.drops.always) {
        guaranteedDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance,
        });
      }

      for (const drop of npcData.drops.common) {
        commonDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance,
        });
      }

      for (const drop of npcData.drops.uncommon) {
        uncommonDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance,
        });
      }

      for (const drop of [...npcData.drops.rare, ...npcData.drops.veryRare]) {
        rareDrops.push({
          itemId: drop.itemId,
          quantity: drop.minQuantity,
          chance: drop.chance,
        });
      }

      this.lootTables.set(npcId, {
        id: `${npcId}_loot`,
        mobType: npcId,
        guaranteedDrops,
        commonDrops,
        uncommonDrops,
        rareDrops,
      });
    }
  }

  /**
   * Handle mob death and generate loot (OSRS-style ground items)
   *
   * Drops items directly to ground at tile center instead of creating
   * a corpse entity. Items can be picked up by clicking directly.
   */
  private async handleMobDeath(data: {
    mobId: string;
    mobType: string;
    level: number;
    killedBy: string;
    position: { x: number; y: number; z: number };
  }): Promise<void> {
    const mobType = data.mobType; // Mob ID from mobs.json
    const lootTable = this.lootTables.get(mobType);
    if (!lootTable) {
      console.warn(`[LootSystem] No loot table found for mob type: ${mobType}`);
      return;
    }

    // Check if GroundItemManager is available
    if (!this.groundItemManager) {
      console.error(
        "[LootSystem] GroundItemManager not available, cannot drop loot",
      );
      return;
    }

    const lootItems: Array<{ itemId: string; quantity: number }> = [];

    // Process guaranteed drops
    for (const entry of lootTable.guaranteedDrops) {
      const quantity =
        entry.itemId === "coins"
          ? this.randomizeCoins(entry.quantity)
          : entry.quantity;
      lootItems.push({ itemId: entry.itemId, quantity });
    }

    // Process uncommon drops with chance rolls
    for (const entry of lootTable.uncommonDrops) {
      if (Math.random() < entry.chance) {
        const quantity =
          entry.itemId === "coins"
            ? this.randomizeCoins(entry.quantity)
            : entry.quantity;
        lootItems.push({ itemId: entry.itemId, quantity });
      }
    }

    // Process rare drops with chance rolls
    for (const entry of lootTable.rareDrops) {
      if (Math.random() < entry.chance) {
        const quantity =
          entry.itemId === "coins"
            ? this.randomizeCoins(entry.quantity)
            : entry.quantity;
        lootItems.push({ itemId: entry.itemId, quantity });
      }
    }

    if (lootItems.length === 0) {
      return; // No loot to drop
    }

    // Convert loot items to InventoryItem format for GroundItemManager
    const inventoryItems: InventoryItem[] = lootItems.map((loot, index) => ({
      id: `mob_loot_${data.mobId}_${index}`,
      itemId: loot.itemId,
      quantity: loot.quantity,
      slot: index,
      metadata: null,
    }));

    // Ground position to terrain
    const groundedPosition = groundToTerrain(
      this.world,
      data.position,
      0.2,
      Infinity,
    );

    // OSRS-STYLE: Spawn ground items directly (no corpse entity)
    // Items pile at tile center, stackables merge, 2 minute despawn
    await this.groundItemManager.spawnGroundItems(
      inventoryItems,
      groundedPosition,
      {
        despawnTime: ticksToMs(COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS), // 2 minutes
        droppedBy: data.killedBy, // Killer gets loot protection
        lootProtection: ticksToMs(COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS), // 1 minute protection
        scatter: false, // Items pile at mob position tile center (OSRS-style)
      },
    );

    console.log(
      `[LootSystem] Dropped ${inventoryItems.length} ground items for ${mobType} killed by ${data.killedBy}`,
    );

    // Emit loot dropped event for any listeners
    this.emitTypedEvent(EventType.LOOT_DROPPED, {
      mobId: data.mobId,
      mobType: mobType,
      items: lootItems,
      position: data.position,
    });
  }

  /**
   * Spawn a dropped item in the world
   */
  private async spawnDroppedItem(
    itemId: string,
    quantity: number,
    position: { x: number; y: number; z: number },
    droppedBy?: string,
  ): Promise<void> {
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
    const entityManager = this.world.getSystem<EntityManager>("entity-manager");
    if (!entityManager) {
      return;
    }

    // Ground to terrain - use Infinity to allow any initial height difference
    const groundedPosition = groundToTerrain(
      this.world,
      position,
      0.2,
      Infinity,
    );

    const itemEntity = await entityManager.spawnEntity({
      id: dropId,
      name: `${item.name} (${quantity})`,
      type: "item",
      position: groundedPosition,
      itemId: itemId,
      itemType: this.getItemTypeString(item.type),
      quantity: quantity,
      stackable: item.stackable ?? false,
      value: item.value ?? 0,
      weight: 1.0,
      rarity: ItemRarity.COMMON,
    } as ItemEntityConfig);

    if (!itemEntity) {
      return;
    }

    const droppedItem: DroppedItem = {
      id: dropId,
      itemId: itemId,
      quantity: quantity,
      position: groundedPosition,
      despawnTime: now + this.LOOT_DESPAWN_TIME_MS, // Keep for backwards compat with existing code
      droppedBy: droppedBy ?? "unknown",
      droppedAt: now,
      entityId: dropId,
      mesh: itemEntity.node || null,
    };

    this.droppedItems.set(dropId, droppedItem);
  }

  /**
   * Handle loot drop request from mob death
   */
  private async handleLootDropRequest(data: {
    position: { x: number; y: number; z: number };
    items: { itemId: string; quantity: number }[];
  }): Promise<void> {
    // Spawn each item in the loot drop
    for (let i = 0; i < data.items.length; i++) {
      const lootItem = data.items[i];

      // Spread items around the drop position
      const offsetX = (Math.random() - 0.5) * 2; // -1 to 1 meter spread
      const offsetZ = (Math.random() - 0.5) * 2;

      const dropPosition = {
        x: data.position.x + offsetX,
        y: data.position.y + 0.5, // Slightly above ground
        z: data.position.z + offsetZ,
      };

      await this.spawnDroppedItem(
        lootItem.itemId,
        lootItem.quantity,
        dropPosition,
        "mob_drop",
      );
    }

    // Emit loot dropped event
    this.emitTypedEvent(EventType.LOOT_DROPPED, {
      items: data.items,
      position: data.position,
    });
  }

  /**
   * Manual item drop (from inventory)
   */
  private async dropItem(data: {
    playerId: string;
    itemId: string;
    quantity: number;
    position: { x: number; y: number; z: number };
  }): Promise<void> {
    await this.spawnDroppedItem(
      data.itemId,
      data.quantity,
      data.position,
      data.playerId,
    );
  }

  /**
   * Remove dropped item from world
   */
  private removeDroppedItem(itemId: string): void {
    const droppedItem = this.droppedItems.get(itemId);
    if (!droppedItem) return;

    const entityManager = this.world.getSystem<EntityManager>("entity-manager");
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
    // Clean up ground item manager
    if (this.groundItemManager) {
      this.groundItemManager.destroy();
      this.groundItemManager = null;
    }

    // Clear all dropped items (manual player drops)
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
