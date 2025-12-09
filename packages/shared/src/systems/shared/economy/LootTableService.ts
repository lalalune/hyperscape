/**
 * LootTableService - Pure Loot Table Logic
 *
 * Responsibilities:
 * - Load loot tables from NPC data
 * - Roll loot based on mob type
 * - Randomize coin quantities
 *
 * This is a pure service with no World dependencies.
 * Extracted from LootSystem for Single Responsibility Principle.
 */

import type { LootTable } from "../../../types/core/core";
import { ALL_NPCS } from "../../../data/npcs";

export interface LootDrop {
  itemId: string;
  quantity: number;
}

export class LootTableService {
  private lootTables = new Map<string, LootTable>();

  constructor() {
    this.setupLootTables();
  }

  /**
   * Set up loot tables from NPC data
   * Dynamically loaded from mob data JSON
   */
  private setupLootTables(): void {
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
   * Roll loot for a mob death
   * @param mobType - Mob ID from mobs.json
   * @returns Array of items to drop (empty if no loot table found)
   */
  rollLoot(mobType: string): LootDrop[] {
    const lootTable = this.lootTables.get(mobType);
    if (!lootTable) {
      return [];
    }

    const lootItems: LootDrop[] = [];

    // Process guaranteed drops
    for (const entry of lootTable.guaranteedDrops) {
      const quantity =
        entry.itemId === "coins"
          ? this.randomizeCoins(entry.quantity)
          : entry.quantity;
      lootItems.push({ itemId: entry.itemId, quantity });
    }

    // Process common drops with chance rolls
    for (const entry of lootTable.commonDrops) {
      if (Math.random() < entry.chance) {
        const quantity =
          entry.itemId === "coins"
            ? this.randomizeCoins(entry.quantity)
            : entry.quantity;
        lootItems.push({ itemId: entry.itemId, quantity });
      }
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

    return lootItems;
  }

  /**
   * Check if a loot table exists for a mob type
   */
  hasLootTable(mobType: string): boolean {
    return this.lootTables.has(mobType);
  }

  /**
   * Get loot table count (for testing/debugging)
   */
  getLootTableCount(): number {
    return this.lootTables.size;
  }

  /**
   * Randomize coin quantity with ±25% variation
   */
  private randomizeCoins(baseAmount: number): number {
    const variation = 0.25;
    const minAmount = Math.floor(baseAmount * (1 - variation));
    const maxAmount = Math.floor(baseAmount * (1 + variation));
    return this.randomInt(minAmount, maxAmount);
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
