/**
 * Loot System - GDD Compliant (TICK-BASED)
 *
 * Orchestrates loot drops using modular services:
 * - LootTableService: Pure loot table logic and rolling
 * - GroundItemSystem: Shared ground item management
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
import type { InventoryItem } from "../../../types/core/core";
import { SystemBase } from "..";
import { groundToTerrain } from "../../../utils/game/EntityUtils";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { ticksToMs } from "../../../utils/game/CombatCalculations";
import { LootTableService } from "./LootTableService";
import type { GroundItemSystem } from "./GroundItemSystem";

export class LootSystem extends SystemBase {
  private lootTableService: LootTableService;
  private groundItemSystem: GroundItemSystem | null = null;

  constructor(world: World) {
    super(world, {
      name: "loot",
      dependencies: {
        required: ["ground-items"], // Depends on shared GroundItemSystem
        optional: ["inventory", "entity-manager", "ui", "client-graphics"],
      },
      autoCleanup: true,
    });

    // Initialize pure loot table service (no World dependencies)
    this.lootTableService = new LootTableService();
  }

  async init(): Promise<void> {
    // Get shared GroundItemSystem
    this.groundItemSystem =
      this.world.getSystem<GroundItemSystem>("ground-items") ?? null;
    if (!this.groundItemSystem) {
      console.warn(
        "[LootSystem] GroundItemSystem not found - mob loot drops disabled",
      );
    }

    // Subscribe to mob death events
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
        // Validate event data
        if (!event || typeof event !== "object") {
          console.warn("[LootSystem] Invalid NPC_DIED event");
          return;
        }

        if (typeof event.mobId !== "string" || !event.mobId) {
          console.warn("[LootSystem] NPC_DIED missing mobId");
          return;
        }

        if (!event.position || typeof event.position !== "object") {
          console.warn("[LootSystem] NPC_DIED missing position");
          return;
        }

        const pos = event.position;
        if (
          typeof pos.x !== "number" ||
          typeof pos.y !== "number" ||
          typeof pos.z !== "number"
        ) {
          console.warn("[LootSystem] NPC_DIED invalid position");
          return;
        }

        const payload = {
          mobId: event.mobId,
          mobType:
            typeof event.mobType === "string" ? event.mobType : "unknown",
          level: typeof event.level === "number" ? event.level : 1,
          killedBy:
            typeof event.killerId === "string"
              ? event.killerId
              : typeof event.killedBy === "string"
                ? event.killedBy
                : "unknown",
          position: { x: pos.x, y: pos.y, z: pos.z },
        };

        this.handleMobDeath(payload);
      },
    );

    // NOTE: Ground item pickup is handled by InventorySystem via ITEM_PICKUP event
    // NOTE: Ground item despawn is handled by GroundItemSystem.processTick()
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
    // Roll loot using service
    const lootItems = this.lootTableService.rollLoot(data.mobType);
    if (lootItems.length === 0) {
      if (!this.lootTableService.hasLootTable(data.mobType)) {
        console.warn(
          `[LootSystem] No loot table found for mob type: ${data.mobType}`,
        );
      }
      return;
    }

    // Check if GroundItemSystem is available
    if (!this.groundItemSystem) {
      console.error(
        "[LootSystem] GroundItemSystem not available, cannot drop loot",
      );
      return;
    }

    // Convert loot items to InventoryItem format
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
    await this.groundItemSystem.spawnGroundItems(
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
      `[LootSystem] Dropped ${inventoryItems.length} ground items for ${data.mobType} killed by ${data.killedBy}`,
    );

    // Emit loot dropped event for any listeners
    this.emitTypedEvent(EventType.LOOT_DROPPED, {
      mobId: data.mobId,
      mobType: data.mobType,
      items: lootItems,
      position: data.position,
    });
  }

  /**
   * Public API for testing
   */
  public getLootTableCount(): number {
    return this.lootTableService.getLootTableCount();
  }

  destroy(): void {
    // GroundItemSystem cleanup is handled by the system itself
    // Call parent cleanup (handles event listeners)
    super.destroy();
  }
}
