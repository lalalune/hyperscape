/**
 * Equipment System
 * Handles equipment management, stat bonuses, level requirements, and persistence per GDD specifications
 * - Equipment slots (weapon, shield, helmet, body, legs, boots, gloves, cape, amulet, ring, arrows)
 * - Level requirements for equipment tiers
 * - Stat bonuses from equipped items
 * - Right-click equip/unequip functionality
 * - Write-through database persistence
 */

import { EventType, type EquipmentSyncData } from "../../../types/events";
import { dataManager } from "../../../data/DataManager";
import type { InventorySystem } from "./InventorySystem";
import { EQUIPMENT_SLOT_NAMES } from "../../../constants/EquipmentConstants";

/**
 * Helper functions for equipment requirements
 * Uses manifest-driven data from DataManager.
 */
const equipmentRequirements = {
  /**
   * Get skill requirements for an item from the manifest.
   * Returns object like { attack: 10 } or { woodcutting: 1, attack: 1 }
   */
  getLevelRequirements: (itemId: string): Record<string, number> | null => {
    const item = dataManager.getItem(itemId);
    return item?.requirements?.skills || null;
  },

  /**
   * Format requirements as human-readable text.
   * e.g., "Attack 10" or "Woodcutting 1, Attack 1"
   */
  getRequirementText: (itemId: string): string => {
    const reqs = equipmentRequirements.getLevelRequirements(itemId);
    if (!reqs) return "";
    return Object.entries(reqs)
      .filter(([, level]) => level > 0)
      .map(
        ([skill, level]) =>
          `${skill.charAt(0).toUpperCase() + skill.slice(1)} ${level}`,
      )
      .join(", ");
  },
};
import { SystemBase } from "../infrastructure/SystemBase";
import type { WorldOptions } from "../../../types";
import { Logger } from "../../../utils/Logger";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";
import type { TransactionContext } from "../../../types/death";

import { World } from "../../../core/World";
import {
  ItemType,
  EquipmentSlot,
  EquipmentSlotName,
  PlayerEquipment as PlayerEquipment,
  Item,
} from "../../../types/core/core";

// Re-export for backward compatibility
export type { EquipmentSlot, PlayerEquipment };

/** Create a zeroed-out equipment stats object (all 16 fields = 0) */
function createEmptyTotalStats(): PlayerEquipment["totalStats"] {
  return {
    attack: 0,
    strength: 0,
    defense: 0,
    ranged: 0,
    constitution: 0,
    rangedAttack: 0,
    rangedStrength: 0,
    magicAttack: 0,
    magicDefense: 0,
    defenseStab: 0,
    defenseSlash: 0,
    defenseCrush: 0,
    defenseRanged: 0,
    attackStab: 0,
    attackSlash: 0,
    attackCrush: 0,
  };
}

/**
 * Equipment System - GDD Compliant
 * Manages player equipment per GDD specifications:
 * - 11 equipment slots (weapon, shield, helmet, body, legs, boots, gloves, cape, amulet, ring, arrows)
 * - Level requirements (bronze=1, steel=10, mithril=20)
 * - Automatic stat calculation from equipped items
 * - Arrow consumption integration with combat
 * - Equipment persistence via inventory system
 */
export class EquipmentSystem extends SystemBase {
  private playerEquipment = new Map<string, PlayerEquipment>();
  private playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();
  private databaseSystem?: DatabaseSystem;

  // GDD-compliant level requirements
  // Level requirements are now stored in item data directly

  constructor(world: World) {
    super(world, {
      name: "equipment",
      dependencies: {
        required: [
          "inventory", // Equipment needs inventory for item management
        ],
        optional: [
          "player", // Better with player system for player data
          "ui", // Better with UI for notifications
          "database", // For persistence
        ],
      },
      autoCleanup: true,
    });
  }

  async init(_options?: WorldOptions): Promise<void> {
    // Get DatabaseSystem for persistence
    this.databaseSystem = this.world.getSystem("database") as
      | DatabaseSystem
      | undefined;

    if (!this.databaseSystem && this.world.isServer) {
      Logger.systemWarn(
        "EquipmentSystem",
        "DatabaseSystem not found - equipment will not persist!",
      );
    }

    // Set up type-safe event subscriptions with proper type casting
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => {
      const typedData = data as { playerId: string };
      this.initializePlayerEquipment({ id: typedData.playerId });
    });
    // CRITICAL: Equipment is now passed via event payload from character-selection
    // This eliminates the race condition where two systems query DB independently
    this.subscribe(EventType.PLAYER_JOINED, async (data) => {
      const typedData = data as {
        playerId: string;
        equipment?: EquipmentSyncData[];
        isReconnect?: boolean;
      };

      // On reconnection, equipment is already in memory — just re-send to client
      // This prevents stale DB data from overwriting current in-memory equipment
      if (
        typedData.isReconnect &&
        this.playerEquipment.has(typedData.playerId)
      ) {
        this.sendEquipmentUpdated(typedData.playerId);
        this.emitEquipmentChangedForAllSlots(typedData.playerId);
        return;
      }

      // Use equipment from payload (single source of truth from character-selection)
      if (typedData.equipment && typedData.equipment.length > 0) {
        await this.loadEquipmentFromPayload(
          typedData.playerId,
          typedData.equipment,
        );
      } else if (typedData.equipment) {
        // Empty array = new player or cleared equipment, no need to query DB
        // Just ensure slot visuals are cleared
        this.emitEmptyEquipmentEvents(typedData.playerId);
      } else {
        // Backwards compatibility: no equipment in payload, fall back to DB query
        await this.loadEquipmentFromDatabase(typedData.playerId);
      }
    });
    this.subscribe(EventType.PLAYER_RESPAWNED, async (data) => {
      const typedData = data as { playerId: string };
      // Reload equipment from database after respawn (equipment cleared on death)
      await this.loadEquipmentFromDatabase(typedData.playerId);
    });
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data) => {
      const typedData = data as { playerId: string };
      this.cleanupPlayerEquipment(typedData.playerId);
    });
    this.subscribe(EventType.PLAYER_LEFT, async (data) => {
      const typedData = data as { playerId: string };
      await this.saveEquipmentToDatabase(typedData.playerId);
    });

    // Listen to skills updates for reactive patterns
    this.subscribe(EventType.SKILLS_UPDATED, (data) => {
      const typedData = data as {
        playerId: string;
        skills: Record<string, { level: number; xp: number }>;
      };
      this.playerSkills.set(typedData.playerId, typedData.skills);
    });
    this.subscribe(EventType.EQUIPMENT_EQUIP, async (data) => {
      const typedData = data as {
        playerId: string;
        itemId: string;
      };
      await this.tryEquipItem({
        playerId: typedData.playerId,
        itemId: typedData.itemId,
        inventorySlot: undefined,
      });
    });
    this.subscribe(EventType.EQUIPMENT_UNEQUIP, async (data) => {
      const typedData = data as { playerId: string; slot: string };
      await this.unequipItem({
        playerId: typedData.playerId,
        slot: typedData.slot,
      });
    });
    this.subscribe(EventType.EQUIPMENT_TRY_EQUIP, async (data) => {
      const typedData = data as { playerId: string; itemId: string };
      await this.tryEquipItem({
        playerId: typedData.playerId,
        itemId: typedData.itemId,
        inventorySlot: undefined,
      });
    });
    this.subscribe(EventType.EQUIPMENT_FORCE_EQUIP, (data) => {
      const typedData = data as {
        playerId: string;
        itemId: string;
        slot: string;
      };
      const itemData = this.getItemData(typedData.itemId);
      if (!itemData) {
        Logger.systemError(
          "EquipmentSystem",
          `FORCE_EQUIP: unknown item "${typedData.itemId}" for player ${typedData.playerId}`,
        );
        return;
      }
      this.handleForceEquip({
        playerId: typedData.playerId,
        item: itemData,
        slot: typedData.slot,
      });
    });
    this.subscribe(EventType.INVENTORY_ITEM_RIGHT_CLICK, async (data) => {
      const typedData = data as {
        playerId: string;
        itemId: string;
        slot: number;
      };
      await this.handleItemRightClick({
        playerId: typedData.playerId,
        itemId: typedData.itemId,
        slot: typedData.slot,
      });
    });
    this.subscribe(EventType.EQUIPMENT_CONSUME_ARROW, async (data) => {
      const typedData = data as { playerId: string };
      await this.consumeArrow(typedData.playerId);
    });
  }

  private initializePlayerEquipment(playerData: { id: string }): void {
    // Idempotent: don't overwrite existing equipment (prevents reconnection/re-registration wiping gear)
    if (this.playerEquipment.has(playerData.id)) {
      this.logger.debug(
        `Equipment already initialized for ${playerData.id}, skipping`,
      );
      return;
    }

    const equipment: PlayerEquipment = {
      playerId: playerData.id,
      weapon: {
        id: `${playerData.id}_weapon`,
        name: "Weapon Slot",
        slot: EquipmentSlotName.WEAPON,
        itemId: null,
        item: null,
      },
      shield: {
        id: `${playerData.id}_shield`,
        name: "Shield Slot",
        slot: EquipmentSlotName.SHIELD,
        itemId: null,
        item: null,
      },
      helmet: {
        id: `${playerData.id}_helmet`,
        name: "Helmet Slot",
        slot: EquipmentSlotName.HELMET,
        itemId: null,
        item: null,
      },
      body: {
        id: `${playerData.id}_body`,
        name: "Body Slot",
        slot: EquipmentSlotName.BODY,
        itemId: null,
        item: null,
      },
      legs: {
        id: `${playerData.id}_legs`,
        name: "Legs Slot",
        slot: EquipmentSlotName.LEGS,
        itemId: null,
        item: null,
      },
      boots: {
        id: `${playerData.id}_boots`,
        name: "Boots Slot",
        slot: EquipmentSlotName.BOOTS,
        itemId: null,
        item: null,
      },
      gloves: {
        id: `${playerData.id}_gloves`,
        name: "Gloves Slot",
        slot: EquipmentSlotName.GLOVES,
        itemId: null,
        item: null,
      },
      cape: {
        id: `${playerData.id}_cape`,
        name: "Cape Slot",
        slot: EquipmentSlotName.CAPE,
        itemId: null,
        item: null,
      },
      amulet: {
        id: `${playerData.id}_amulet`,
        name: "Amulet Slot",
        slot: EquipmentSlotName.AMULET,
        itemId: null,
        item: null,
      },
      ring: {
        id: `${playerData.id}_ring`,
        name: "Ring Slot",
        slot: EquipmentSlotName.RING,
        itemId: null,
        item: null,
      },
      arrows: {
        id: `${playerData.id}_arrows`,
        name: "Arrow Slot",
        slot: EquipmentSlotName.ARROWS,
        itemId: null,
        item: null,
      },
      totalStats: createEmptyTotalStats(),
    };

    this.playerEquipment.set(playerData.id, equipment);

    // NOTE: Starting items are equipped in loadEquipmentFromDatabase()
    // only if no equipment is found in the database
  }

  private async loadEquipmentFromDatabase(playerId: string): Promise<void> {
    if (!this.databaseSystem) {
      return;
    }

    const allowNonFatalDbErrors =
      process.env.DB_WRITE_ERRORS_NON_FATAL === "true" ||
      process.env.DB_READ_ERRORS_NON_FATAL === "true" ||
      process.env.STREAMING_DUEL_ENABLED === "true";
    let dbEquipment;

    try {
      // Use playerId directly - database layer handles character ID mapping
      dbEquipment = await this.databaseSystem.getPlayerEquipmentAsync(playerId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (!allowNonFatalDbErrors) {
        throw error;
      }

      Logger.systemWarn(
        "EquipmentSystem",
        `Non-fatal DB read failure loading equipment for ${playerId}: ${reason}`,
      );
      this.sendEquipmentUpdated(playerId);
      this.emitEquipmentChangedForAllSlots(playerId);
      return;
    }

    if (dbEquipment && dbEquipment.length > 0) {
      const equipment = this.playerEquipment.get(playerId);
      if (!equipment) {
        return;
      }

      // Load equipped items from database
      for (const dbItem of dbEquipment) {
        if (!dbItem.itemId) continue; // Skip null items

        const itemData = this.getItemData(dbItem.itemId);
        if (itemData && dbItem.slotType) {
          const slot = equipment[dbItem.slotType as keyof PlayerEquipment];
          // Strong type assumption - slot is EquipmentSlot if it exists
          if (
            slot &&
            slot !== equipment.playerId &&
            slot !== equipment.totalStats
          ) {
            const equipSlot = slot as EquipmentSlot;
            // Keep itemId as STRING (matches database format)
            equipSlot.itemId = dbItem.itemId;
            equipSlot.item = itemData;
            // Load quantity for stackable items (like arrows)
            equipSlot.quantity = dbItem.quantity ?? 1;
          }
        }
      }

      // Recalculate stats after loading equipment
      this.recalculateStats(playerId);

      // Send loaded equipment state to client and update visuals
      this.sendEquipmentUpdated(playerId);
      this.emitEquipmentChangedForAllSlots(playerId);
    } else {
      // NEW PLAYERS START WITH EMPTY EQUIPMENT
      // Starting items (like bronze sword) should be in INVENTORY, not equipped
      this.sendEquipmentUpdated(playerId);
      this.emitEquipmentChangedForAllSlots(playerId);
    }
  }

  /**
   * Load equipment from event payload data (single source of truth pattern)
   *
   * Called when PLAYER_JOINED event includes equipment data from character-selection.
   * This eliminates the race condition where EquipmentSystem and character-selection
   * both query the database independently, potentially causing stale data.
   *
   * @param playerId - The player ID
   * @param equipmentData - Equipment data from event payload
   */
  private async loadEquipmentFromPayload(
    playerId: string,
    equipmentData: EquipmentSyncData[],
  ): Promise<void> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      return;
    }

    // Load equipped items from payload data
    for (const dbItem of equipmentData) {
      if (!dbItem.itemId) continue; // Skip null items

      const itemData = this.getItemData(dbItem.itemId);
      if (itemData && dbItem.slotType) {
        const slot = equipment[dbItem.slotType as keyof PlayerEquipment];
        // Strong type assumption - slot is EquipmentSlot if it exists
        if (
          slot &&
          slot !== equipment.playerId &&
          slot !== equipment.totalStats
        ) {
          const equipSlot = slot as EquipmentSlot;
          // Keep itemId as STRING (matches database format)
          equipSlot.itemId = dbItem.itemId;
          equipSlot.item = itemData;
          // Load quantity for stackable items (like arrows)
          equipSlot.quantity = dbItem.quantity ?? 1;
        }
      }
    }

    // Recalculate stats after loading equipment
    this.recalculateStats(playerId);

    // Do NOT call sendEquipmentUpdated() here — it would broadcast via sendToAll
    // BEFORE entityAdded packets are sent from character-selection.ts, causing
    // remote clients to receive equipment for entities that don't exist yet.
    // character-selection.ts handles the equipment broadcast at the correct time
    // (after entityAdded packets have been sent to all clients).

    // Emit PLAYER_EQUIPMENT_CHANGED for each slot to update server-side systems
    // (visual attachment, combat calculations, etc.)
    this.emitEquipmentChangedForAllSlots(playerId);
  }

  /** Send full equipment state to client via network */
  private sendEquipmentUpdated(playerId: string): void {
    if (this.world.isServer && this.world.network?.send) {
      const equipment = this.getPlayerEquipment(playerId);
      this.world.network.send("equipmentUpdated", {
        playerId,
        equipment,
      });
    }
  }

  /** Emit PLAYER_EQUIPMENT_CHANGED for every slot (uses current equipment state) */
  private emitEquipmentChangedForAllSlots(playerId: string): void {
    const equipment = this.playerEquipment.get(playerId);
    for (const slotName of EQUIPMENT_SLOT_NAMES) {
      const slot = equipment?.[slotName] as EquipmentSlot | null | undefined;
      const itemId = slot?.itemId ? slot.itemId.toString() : null;
      this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
        playerId,
        slot: slotName as EquipmentSlotName,
        itemId,
      });
    }
  }

  /** Emit UI_EQUIPMENT_UPDATE with all slots set to null (for clearing) */
  private emitAllSlotsNullUIUpdate(playerId: string): void {
    const nullSlots: Record<string, null> = {};
    for (const slotName of EQUIPMENT_SLOT_NAMES) {
      nullSlots[slotName] = null;
    }
    this.emitTypedEvent(EventType.UI_EQUIPMENT_UPDATE, {
      playerId,
      equipment: nullSlots,
    });
  }

  /**
   * Emit empty equipment events for a player with no equipment
   *
   * Called when PLAYER_JOINED payload contains an empty equipment array,
   * indicating a new player or a player whose equipment was cleared.
   *
   * @param playerId - The player ID
   */
  private emitEmptyEquipmentEvents(playerId: string): void {
    this.emitEquipmentChangedForAllSlots(playerId);
  }

  /**
   * Save equipment to database with optional transaction context
   *
   * @param playerId - The player ID
   * @param _tx - Optional transaction context for atomic operations (reserved for future use)
   */
  private async saveEquipmentToDatabase(
    playerId: string,
    _tx?: TransactionContext,
  ): Promise<void> {
    if (!this.databaseSystem) {
      Logger.systemWarn(
        "EquipmentSystem",
        `Cannot save - no database system for: ${playerId}`,
      );
      return;
    }

    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      Logger.systemWarn(
        "EquipmentSystem",
        `Cannot save - no equipment data for: ${playerId}`,
      );
      return;
    }

    // Convert to database format
    const dbEquipment: Array<{
      slotType: string;
      itemId: string;
      quantity: number;
    }> = [];

    for (const slotName of EQUIPMENT_SLOT_NAMES) {
      const slot = equipment[slotName] as EquipmentSlot | undefined;
      if (slot?.itemId) {
        dbEquipment.push({
          slotType: slotName,
          itemId: String(slot.itemId),
          quantity: slot.quantity ?? 1,
        });
      }
    }

    // Use playerId directly - database layer handles character ID mapping
    // CRITICAL: Use async method to ensure save completes before returning
    // Note: Transaction context not passed here; equipment save is independent
    await this.databaseSystem.savePlayerEquipmentAsync(playerId, dbEquipment);
  }

  /**
   * Clear all equipped items immediately (for death system)
   * CRITICAL for death system to prevent item duplication
   */
  async clearEquipmentImmediate(playerId: string): Promise<number> {
    const clearedItems = await this.clearEquipmentAndReturn(playerId);
    return clearedItems.length;
  }

  /**
   * Atomically clear all equipment and return the items
   *
   * CRITICAL FOR DEATH SYSTEM SECURITY:
   * This method atomically reads AND clears equipment in one operation,
   * preventing the race condition where equipment is read, server crashes,
   * and on restart items get duplicated because equipment wasn't cleared.
   *
   * The returned items should be used for gravestone/ground item spawning.
   * Database save happens inside the same transaction as inventory clear.
   *
   * @param playerId - The player ID
   * @param tx - Optional transaction context for atomic operations
   * @returns Array of cleared equipment items with itemId and slot info
   */
  async clearEquipmentAndReturn(
    playerId: string,
    tx?: TransactionContext,
  ): Promise<
    Array<{
      itemId: string;
      slot: string;
      quantity: number;
    }>
  > {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      return [];
    }

    const clearedItems: Array<{
      itemId: string;
      slot: string;
      quantity: number;
    }> = [];

    // Atomically collect AND clear all equipped items
    for (const slotName of EQUIPMENT_SLOT_NAMES) {
      const slot = equipment[slotName] as EquipmentSlot | null;
      if (slot && slot.itemId) {
        // Collect item info BEFORE clearing (use actual quantity for stackable items like arrows)
        clearedItems.push({
          itemId: String(slot.itemId),
          slot: slotName,
          quantity: slot.quantity ?? 1,
        });

        // Clear the slot atomically (including quantity for stackable items)
        slot.itemId = null;
        slot.item = null;
        slot.quantity = undefined;

        // Emit PLAYER_EQUIPMENT_CHANGED for visual system
        this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
          playerId: playerId,
          slot: slotName as EquipmentSlotName,
          itemId: null,
        });
      }
    }

    // Reset total stats
    equipment.totalStats = createEmptyTotalStats();

    // Emit UI update event with all slots null
    this.emitAllSlotsNullUIUpdate(playerId);

    // When called within a death transaction (tx provided), skip the independent
    // DB save — it opens a nested transaction that deadlocks on SQLite.
    // The caller's transaction handles persistence; in-memory state is already cleared.
    if (!tx) {
      await this.saveEquipmentToDatabase(playerId);
    }

    return clearedItems;
  }

  private cleanupPlayerEquipment(playerId: string): void {
    this.playerEquipment.delete(playerId);
    this.playerSkills.delete(playerId);
  }

  private async handleItemRightClick(data: {
    playerId: string;
    itemId: string | number;
    slot: number;
  }): Promise<void> {
    const itemData = this.getItemData(data.itemId);

    if (!itemData) {
      return;
    }

    // Determine if this is equippable
    const equipSlot = this.getEquipmentSlot(itemData);

    if (equipSlot) {
      await this.tryEquipItem({
        playerId: data.playerId,
        itemId: data.itemId,
        inventorySlot: data.slot,
      });
    }
    // Non-equippable items (food, potions) are handled by InventoryInteractionSystem
  }

  private async tryEquipItem(data: {
    playerId: string;
    itemId: string | number;
    inventorySlot?: number;
  }): Promise<void> {
    const player = this.world.getPlayer(data.playerId);
    const equipment = this.playerEquipment.get(data.playerId);

    if (!player || !equipment) {
      return;
    }

    const itemData = this.getItemData(data.itemId);
    if (!itemData) {
      return;
    }

    const equipSlot = this.getEquipmentSlot(itemData);
    if (!equipSlot) {
      this.sendMessage(
        data.playerId,
        `${itemData.name} cannot be equipped.`,
        "warning",
      );
      return;
    }

    const meetsRequirements = this.meetsLevelRequirements(
      data.playerId,
      itemData,
    );
    if (!meetsRequirements) {
      const requirements =
        equipmentRequirements.getLevelRequirements(itemData.id as string) || {};
      const reqList = Object.entries(requirements as Record<string, number>)
        .map(
          ([skill, level]) =>
            `level ${level} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
        )
        .join(" and ");

      this.sendMessage(
        data.playerId,
        `You need at least ${reqList} to equip ${itemData.name}.`,
        "warning",
      );
      return;
    }

    if (
      data.inventorySlot === undefined &&
      !this.playerHasItem(data.playerId, data.itemId)
    ) {
      return;
    }

    // Perform the equipment - MUST await to ensure DB save completes
    await this.equipItem({
      playerId: data.playerId,
      itemId: data.itemId,
      slot: equipSlot,
      inventorySlot: data.inventorySlot,
    });
  }

  private async equipItem(data: {
    playerId: string;
    itemId: string | number;
    slot: string;
    inventorySlot?: number;
  }): Promise<void> {
    const equipment = this.playerEquipment.get(data.playerId);
    if (!equipment) {
      return;
    }

    // Check for valid itemId before calling getItemData
    if (data.itemId === null || data.itemId === undefined) {
      return;
    }

    const itemData = this.getItemData(data.itemId);
    if (!itemData) {
      return;
    }

    const slot = data.slot;
    if (!this.isValidEquipmentSlot(slot)) return;

    const equipmentSlot = equipment[slot];
    if (!equipmentSlot) {
      Logger.systemError(
        "EquipmentSystem",
        `Equipment slot ${slot} is null for player ${data.playerId}`,
      );
      return;
    }

    // Check for 2-handed weapon logic
    const is2hWeapon = this.is2hWeapon(itemData);
    const currentWeapon = equipment.weapon?.item;
    const currentWeaponIs2h = currentWeapon
      ? this.is2hWeapon(currentWeapon)
      : false;

    // If equipping a 2h weapon, unequip shield first
    if (is2hWeapon && slot === "weapon" && equipment.shield?.itemId) {
      // Pre-check inventory space before attempting shield auto-unequip
      const invSystemForShield = this.world.getSystem("inventory");
      if (
        invSystemForShield &&
        !invSystemForShield.hasSpace(data.playerId, 1)
      ) {
        this.sendMessage(
          data.playerId,
          "Your inventory is too full to unequip the shield for a 2-handed weapon.",
          "warning",
        );
        return;
      }

      await this.unequipItem({
        playerId: data.playerId,
        slot: "shield",
      });
      this.sendMessage(
        data.playerId,
        "Shield unequipped (2-handed weapon equipped).",
        "info",
      );
    }

    // If equipping a shield, check if 2h weapon is equipped
    if (slot === "shield" && currentWeaponIs2h) {
      this.sendMessage(
        data.playerId,
        "Cannot equip shield while wielding a 2-handed weapon.",
        "warning",
      );
      return;
    }

    // Same-type stackable merge: if equipping the same stackable item that's
    // already in the slot (e.g. adding arrows to an existing arrow stack),
    // just merge the quantity directly. Avoids the unequip→inventory flash→re-equip cycle.
    const isSameStackableMerge =
      itemData.stackable &&
      equipmentSlot.itemId !== null &&
      String(equipmentSlot.itemId) === String(data.itemId);

    if (!isSameStackableMerge) {
      // Different item or empty slot — unequip current item first if any
      if (equipmentSlot.itemId) {
        await this.unequipItem({
          playerId: data.playerId,
          slot: data.slot,
        });
      }
    }

    // DUPLICATION FIX: Acquire transaction lock to prevent race conditions
    const inventorySystem = this.world.getSystem("inventory");
    if (inventorySystem && !inventorySystem.lockForTransaction(data.playerId)) {
      // Another transaction in progress, abort to prevent duplication
      this.sendMessage(
        data.playerId,
        "Please wait, another action is in progress.",
        "warning",
      );
      return;
    }

    try {
      // DUPLICATION FIX: Verify item exists at inventory slot before equipping
      if (
        inventorySystem &&
        data.inventorySlot !== undefined &&
        !inventorySystem.hasItemAtSlot(
          data.playerId,
          String(data.itemId),
          data.inventorySlot,
        )
      ) {
        Logger.systemError(
          "EquipmentSystem",
          `Cannot equip: item ${data.itemId} not found at slot ${data.inventorySlot}`,
        );
        return;
      }

      // Get the full quantity from inventory for stackable items (like arrows)
      let quantityToEquip = 1;
      if (
        itemData.stackable &&
        inventorySystem &&
        data.inventorySlot !== undefined
      ) {
        const inventory = inventorySystem.getInventory(data.playerId);
        const invItem = inventory?.items.find(
          (item) =>
            item.slot === data.inventorySlot &&
            item.itemId === String(data.itemId),
        );
        if (invItem) {
          quantityToEquip = invItem.quantity;
        }
      }

      // DUPLICATION FIX: Remove from inventory FIRST, then equip
      // This ensures if removal fails, item is not duplicated
      // For stackable items like arrows, remove the ENTIRE stack
      const removed = inventorySystem?.removeItemDirect(data.playerId, {
        itemId: String(data.itemId),
        quantity: quantityToEquip,
        slot: data.inventorySlot,
      });

      if (!removed) {
        Logger.systemError(
          "EquipmentSystem",
          `Cannot equip: failed to remove item ${data.itemId} from inventory`,
        );
        this.sendMessage(
          data.playerId,
          "Failed to equip item - item not in inventory.",
          "warning",
        );
        return;
      }

      if (isSameStackableMerge) {
        // Merge quantity into already-equipped stack
        equipmentSlot.quantity =
          (equipmentSlot.quantity ?? 0) + quantityToEquip;
      } else {
        // Now safe to equip - item has been removed from inventory
        equipmentSlot.itemId = data.itemId;
        equipmentSlot.item = itemData;
        equipmentSlot.quantity = quantityToEquip;
      }
    } finally {
      // Always release the lock
      inventorySystem?.unlockTransaction(data.playerId);
    }

    // Update stats
    this.recalculateStats(data.playerId);

    // Update combat system with new equipment (emit per-slot change for type consistency)
    const itemIdForEvent =
      equipmentSlot.itemId !== null
        ? typeof equipmentSlot.itemId === "string"
          ? equipmentSlot.itemId
          : equipmentSlot.itemId.toString()
        : null;

    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
      playerId: data.playerId,
      slot: slot as EquipmentSlotName,
      itemId: itemIdForEvent,
    });

    // Send equipment state to client
    this.sendEquipmentUpdated(data.playerId);

    this.sendMessage(data.playerId, `Equipped ${itemData.name}.`, "info");

    // Save to database after equipping - MUST await to prevent data loss on logout
    try {
      await this.saveEquipmentToDatabase(data.playerId);
    } catch (err) {
      Logger.systemError(
        "EquipmentSystem",
        `Failed to save equipment after equip for ${data.playerId}: ${err}`,
      );
    }
  }

  private async unequipItem(data: {
    playerId: string;
    slot: string;
  }): Promise<void> {
    const equipment = this.playerEquipment.get(data.playerId);
    if (!equipment) return;

    const slot = data.slot;
    if (!this.isValidEquipmentSlot(slot)) return;

    const equipmentSlot = equipment[slot];
    if (!equipmentSlot || !equipmentSlot.itemId) return;

    // Additional check for item data
    if (!equipmentSlot.item) {
      Logger.systemError(
        "EquipmentSystem",
        `Cannot unequip item: item data is null for slot ${slot} on player ${data.playerId}`,
      );
      return;
    }

    // Store item info before clearing the slot
    const itemName = equipmentSlot.item.name;
    const itemIdToAdd = equipmentSlot.itemId?.toString() || "";
    const itemData = equipmentSlot.item;
    const quantityToReturn = equipmentSlot.quantity ?? 1;

    // DUPLICATION FIX: Check inventory has space FIRST
    const inventorySystem = this.world.getSystem("inventory");
    if (inventorySystem && !inventorySystem.hasSpace(data.playerId, 1)) {
      this.sendMessage(
        data.playerId,
        "Cannot unequip - inventory is full.",
        "warning",
      );
      return;
    }

    // DUPLICATION FIX: Acquire transaction lock to prevent race conditions
    if (inventorySystem && !inventorySystem.lockForTransaction(data.playerId)) {
      this.sendMessage(
        data.playerId,
        "Please wait, another action is in progress.",
        "warning",
      );
      return;
    }

    try {
      // DUPLICATION FIX: Clear equipment slot FIRST, then add to inventory
      // This ensures if add fails, item is already removed from equipment
      // The item is "lost" temporarily but not duplicated

      // Clear equipment slot FIRST (including quantity)
      equipmentSlot.itemId = null;
      equipmentSlot.item = null;
      equipmentSlot.quantity = undefined;

      // Now add back to inventory - use direct method for better error handling
      // For stackable items like arrows, return the FULL quantity
      const added = await inventorySystem?.addItemDirect(data.playerId, {
        itemId: itemIdToAdd,
        quantity: quantityToReturn,
      });

      if (!added) {
        // This should rarely happen since we checked hasSpace above
        // But if it does, we need to restore the equipment slot
        Logger.systemError(
          "EquipmentSystem",
          `Failed to add unequipped item ${itemIdToAdd} to inventory, restoring equipment`,
        );
        equipmentSlot.itemId = itemIdToAdd;
        equipmentSlot.item = itemData;
        equipmentSlot.quantity = quantityToReturn;
        this.sendMessage(
          data.playerId,
          "Failed to unequip - inventory error.",
          "warning",
        );
        return;
      }
    } finally {
      // Always release the lock
      inventorySystem?.unlockTransaction(data.playerId);
    }

    // Update stats
    this.recalculateStats(data.playerId);

    // Update combat system (emit per-slot change for type consistency)
    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
      playerId: data.playerId,
      slot: slot as EquipmentSlotName,
      itemId: null,
    });

    // Send equipment state to client
    this.sendEquipmentUpdated(data.playerId);

    this.sendMessage(data.playerId, `Unequipped ${itemName}.`, "info");

    // Save to database after unequipping - MUST await to prevent data loss on logout
    try {
      await this.saveEquipmentToDatabase(data.playerId);
    } catch (err) {
      Logger.systemError(
        "EquipmentSystem",
        `Failed to save equipment after unequip for ${data.playerId}: ${err}`,
      );
    }
  }

  private handleForceEquip(data: {
    playerId: string;
    item: Item;
    slot: string;
  }): void {
    this.forceEquipItem(data.playerId, data.item, data.slot);
  }

  private forceEquipItem(playerId: string, itemData: Item, slot: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      this.initializePlayerEquipment({ id: playerId });
      return;
    }

    const equipSlot = slot as keyof PlayerEquipment;
    if (equipSlot === "playerId" || equipSlot === "totalStats") return;

    const equipmentSlot = equipment[equipSlot] as EquipmentSlot;
    if (!equipmentSlot) {
      Logger.systemError(
        "EquipmentSystem",
        `Equipment slot ${equipSlot} is null for player ${playerId}`,
      );
      return;
    }

    // Keep itemId as STRING (e.g., "bronze_sword", "steel_sword")
    equipmentSlot.itemId = itemData.id as string | number;
    equipmentSlot.item = itemData;

    this.recalculateStats(playerId);

    // Update combat system (emit per-slot change for type consistency)
    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
      playerId: playerId,
      slot: equipSlot as EquipmentSlotName,
      itemId:
        equipmentSlot.itemId !== null ? equipmentSlot.itemId.toString() : null,
    });
  }

  private recalculateStats(playerId: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;

    // Reset stats (including ranged/magic bonuses for F2P combat)
    equipment.totalStats = createEmptyTotalStats();

    // Add bonuses from each equipped item
    const slots = EQUIPMENT_SLOT_NAMES.map(
      (name) => equipment[name] as EquipmentSlot | null,
    ).filter((slot): slot is EquipmentSlot => slot !== null);

    slots.forEach((slot) => {
      if (slot.item) {
        const bonuses = slot.item.bonuses as Record<string, number> | undefined;
        if (!bonuses) return;

        // Map simple bonuses (attack, strength, defense, ranged)
        if (bonuses.attack) equipment.totalStats.attack += bonuses.attack;
        if (bonuses.strength) equipment.totalStats.strength += bonuses.strength;
        if (bonuses.defense) equipment.totalStats.defense += bonuses.defense;
        if (bonuses.ranged) equipment.totalStats.ranged += bonuses.ranged;

        // Map detailed ranged bonuses (attackRanged -> rangedAttack, rangedStrength)
        if (bonuses.attackRanged)
          equipment.totalStats.rangedAttack += bonuses.attackRanged;
        if (bonuses.rangedStrength)
          equipment.totalStats.rangedStrength += bonuses.rangedStrength;

        // Map detailed magic bonuses (attackMagic -> magicAttack, defenseMagic -> magicDefense)
        if (bonuses.attackMagic)
          equipment.totalStats.magicAttack += bonuses.attackMagic;
        if (bonuses.defenseMagic)
          equipment.totalStats.magicDefense += bonuses.defenseMagic;

        // Map per-style defence bonuses (classic MMORPG combat triangle)
        if (bonuses.defenseStab)
          equipment.totalStats.defenseStab += bonuses.defenseStab;
        if (bonuses.defenseSlash)
          equipment.totalStats.defenseSlash += bonuses.defenseSlash;
        if (bonuses.defenseCrush)
          equipment.totalStats.defenseCrush += bonuses.defenseCrush;
        if (bonuses.defenseRanged)
          equipment.totalStats.defenseRanged += bonuses.defenseRanged;

        // Map per-style attack bonuses
        if (bonuses.attackStab)
          equipment.totalStats.attackStab += bonuses.attackStab;
        if (bonuses.attackSlash)
          equipment.totalStats.attackSlash += bonuses.attackSlash;
        if (bonuses.attackCrush)
          equipment.totalStats.attackCrush += bonuses.attackCrush;
      }
    });

    // Emit stats update
    this.emitTypedEvent(EventType.PLAYER_STATS_EQUIPMENT_UPDATED, {
      playerId: playerId,
      equipmentStats: equipment.totalStats,
    });
  }

  /**
   * Check if item is a 2-handed weapon
   * Uses equipSlot: '2h' or explicit is2h flag
   */
  private is2hWeapon(item: Item): boolean {
    return item.equipSlot === "2h" || item.is2h === true;
  }

  private getEquipmentSlot(itemData: Item): string | null {
    // BANK NOTE SYSTEM: Explicitly non-equipable items cannot be equipped
    // This catches noted items (e.g., "bronze_sword_noted") which inherit
    // type from base but are marked equipable: false
    if (itemData.equipable === false) {
      return null;
    }

    // Handle 2-handed weapons (they go in weapon slot)
    if (this.is2hWeapon(itemData)) {
      return "weapon";
    }

    // rules-accurate: Check explicit equipSlot first (handles tools like hatchets/pickaxes)
    // Tools have type: "tool" but equipSlot: "weapon" - they should be equipable
    if (itemData.equipSlot && itemData.equipSlot !== "2h") {
      return itemData.equipSlot;
    }

    // Fall back to type-based detection for items without explicit equipSlot
    switch (itemData.type) {
      case ItemType.WEAPON:
        return "weapon";
      case ItemType.ARMOR:
        return itemData.equipSlot || null;
      case ItemType.AMMUNITION:
        return "arrows";
      default:
        return null;
    }
  }

  private meetsLevelRequirements(playerId: string, itemData: Item): boolean {
    const requirements = equipmentRequirements.getLevelRequirements(
      itemData.id as string,
    );
    if (!requirements) return true; // No requirements

    // Get player skills (simplified for MVP)
    const playerSkills = this.getPlayerSkills(playerId);

    // Check each required skill from manifest
    // New format only includes skills that are required (no zeros)
    for (const [skill, required] of Object.entries(requirements)) {
      const playerLevel = playerSkills[skill] || 1;
      if (playerLevel < required) {
        return false;
      }
    }

    return true;
  }

  private getPlayerSkills(playerId: string): Record<string, number> {
    // Use cached skills data (reactive pattern)
    const cachedSkills = this.playerSkills.get(playerId);

    if (cachedSkills) {
      return {
        attack: cachedSkills.attack?.level || 1,
        strength: cachedSkills.strength?.level || 1,
        defense: cachedSkills.defense?.level || 1,
        ranged: cachedSkills.ranged?.level || 1,
        constitution: cachedSkills.constitution?.level || 10,
        woodcutting: cachedSkills.woodcutting?.level || 1,
        mining: cachedSkills.mining?.level || 1,
        fishing: cachedSkills.fishing?.level || 1,
        firemaking: cachedSkills.firemaking?.level || 1,
        cooking: cachedSkills.cooking?.level || 1,
      };
    }

    return {
      attack: 1,
      strength: 1,
      defense: 1,
      ranged: 1,
      constitution: 10,
      woodcutting: 1,
      mining: 1,
      fishing: 1,
      firemaking: 1,
      cooking: 1,
    };
  }

  private playerHasItem(playerId: string, itemId: number | string): boolean {
    const itemIdStr = itemId.toString();

    // Check with InventorySystem directly (not via events - events require subscriber)
    const inventorySystem = this.world.getSystem("inventory");
    if (inventorySystem && inventorySystem.hasItem(playerId, itemIdStr, 1)) {
      return true;
    }

    // Also check if item is already equipped
    const equipment = this.playerEquipment.get(playerId);
    if (equipment) {
      const isEquipped = EQUIPMENT_SLOT_NAMES.some((name) => {
        const slot = equipment[name] as EquipmentSlot | null;
        return slot?.itemId === itemIdStr;
      });
      if (isEquipped) {
        return true;
      }
    }

    return false;
  }

  private getItemData(itemId: string | number): Item | null {
    // Check for null/undefined itemId first
    if (itemId === null || itemId === undefined) {
      return null;
    }

    // Get item data through centralized DataManager (manifest-driven)
    const itemIdStr = itemId.toString();
    return dataManager.getItem(itemIdStr);
  }

  private sendMessage(
    playerId: string,
    message: string,
    type: "info" | "warning" | "error",
  ): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: playerId,
      message: message,
      type: type,
    });
  }

  // ========== Public API ==========

  /**
   * Get the full equipment state for a player.
   *
   * Returns all equipped items and calculated stat bonuses.
   * Used by combat system and UI to determine player capabilities.
   *
   * @param playerId - The player ID to look up
   * @returns PlayerEquipment object with all slots and stats, or undefined if not found
   *
   * @example
   * const equipment = equipmentSystem.getPlayerEquipment(playerId);
   * if (equipment?.weapon?.item) {
   *   console.log(`Wielding: ${equipment.weapon.item.name}`);
   * }
   */
  getPlayerEquipment(playerId: string): PlayerEquipment | undefined {
    return this.playerEquipment.get(playerId);
  }

  /**
   * Get equipped items as a simplified data object.
   *
   * Returns only the Item data for each slot (no slot metadata).
   * Useful for serialization or when only item info is needed.
   *
   * @param playerId - The player ID to look up
   * @returns Record with slot names as keys and Item data (or null) as values
   *
   * @example
   * const data = equipmentSystem.getEquipmentData(playerId);
   * // { weapon: { id: "bronze_sword", ... }, shield: null, ... }
   */
  getEquipmentData(playerId: string): Record<string, unknown> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return {};

    const data: Record<string, unknown> = {};
    for (const slotName of EQUIPMENT_SLOT_NAMES) {
      const slot = equipment[slotName] as EquipmentSlot | null | undefined;
      data[slotName] = slot?.item || null;
    }
    return data;
  }

  /**
   * Get total stat bonuses from all equipped items.
   *
   * Aggregates attack, strength, defense, ranged, and constitution
   * bonuses from all equipped gear. Used by combat calculations.
   *
   * @param playerId - The player ID to look up
   * @returns Record with stat names and their total bonus values
   *
   * @example
   * const stats = equipmentSystem.getEquipmentStats(playerId);
   * const totalAttack = baseAttack + stats.attack;
   */
  getEquipmentStats(playerId: string): Record<string, number> {
    const equipment = this.playerEquipment.get(playerId);
    return (
      equipment?.totalStats || {
        attack: 0,
        strength: 0,
        defense: 0,
        ranged: 0,
        constitution: 0,
      }
    );
  }

  /**
   * Check if a specific item is currently equipped by a player.
   *
   * Searches all equipment slots for the given item ID.
   *
   * @param playerId - The player ID to check
   * @param itemId - The item ID to search for
   * @returns true if item is equipped in any slot
   *
   * @example
   * if (equipmentSystem.isItemEquipped(playerId, bronzeSwordId)) {
   *   console.log("Player has bronze sword equipped");
   * }
   */
  isItemEquipped(playerId: string, itemId: number | string): boolean {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return false;

    const itemIdStr = itemId.toString();
    return EQUIPMENT_SLOT_NAMES.some((name) => {
      const slot = equipment[name] as EquipmentSlot | null;
      return slot?.itemId === itemIdStr;
    });
  }

  /**
   * Check if a player can equip a specific item.
   *
   * Validates:
   * - Item exists in manifest
   * - Item is equippable (has equipment slot)
   * - Player meets all skill level requirements
   *
   * Does NOT check inventory space for unequipping current item.
   *
   * @param playerId - The player ID to check
   * @param itemId - The item ID to validate
   * @returns true if player meets all requirements to equip the item
   *
   * @example
   * if (!equipmentSystem.canEquipItem(playerId, mithrilSwordId)) {
   *   showMessage("You don't meet the level requirements for this item.");
   * }
   */
  canEquipItem(playerId: string, itemId: number): boolean {
    const itemData = this.getItemData(itemId);
    if (!itemData) return false;

    const equipSlot = this.getEquipmentSlot(itemData);
    if (!equipSlot) return false;

    return this.meetsLevelRequirements(playerId, itemData);
  }

  // ========== Bank Equipment Tab API ==========
  // These methods support direct equip/unequip from bank without using inventory

  /**
   * Get the equipment slot name for an item.
   *
   * Used by bank equipment tab to determine if item can be withdrawn to equipment
   * and which slot it would go to.
   *
   * @param itemId - The item ID to check
   * @returns Slot name (weapon, shield, etc.) or null if not equipable
   *
   * @example
   * const slot = equipmentSystem.getEquipmentSlotForItem("bronze_sword");
   * // Returns: "weapon"
   */
  getEquipmentSlotForItem(itemId: string | number): string | null {
    const itemData = this.getItemData(itemId);
    if (!itemData) return null;
    return this.getEquipmentSlot(itemData);
  }

  /**
   * Check if a player meets level requirements to equip an item.
   *
   * Used by bank equipment tab to validate before attempting equip.
   *
   * @param playerId - The player ID
   * @param itemId - The item ID to check
   * @returns true if player meets requirements
   */
  canPlayerEquipItem(playerId: string, itemId: string | number): boolean {
    const itemData = this.getItemData(itemId);
    if (!itemData) return false;

    const equipSlot = this.getEquipmentSlot(itemData);
    if (!equipSlot) return false;

    return this.meetsLevelRequirements(playerId, itemData);
  }

  /**
   * Equip item directly (bypassing inventory).
   *
   * Used by bank equipment tab to equip items directly from bank.
   * Does NOT remove from inventory - caller is responsible for bank item removal.
   * Handles 2h weapon/shield conflicts and returns displaced items.
   *
   * @param playerId - The player ID
   * @param itemId - The item ID to equip
   * @returns Result with success status and any displaced items
   *
   * @example
   * const result = await equipmentSystem.equipItemDirect(playerId, "bronze_sword");
   * if (result.success) {
   *   // Item equipped, handle result.displacedItems if any
   * }
   */
  async equipItemDirect(
    playerId: string,
    itemId: string | number,
  ): Promise<{
    success: boolean;
    error?: string;
    equippedSlot?: string;
    displacedItems: Array<{ itemId: string; slot: string; quantity: number }>;
  }> {
    const displacedItems: Array<{
      itemId: string;
      slot: string;
      quantity: number;
    }> = [];

    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      return {
        success: false,
        error: "Equipment not initialized",
        displacedItems,
      };
    }

    const itemData = this.getItemData(itemId);
    if (!itemData) {
      return { success: false, error: "Item not found", displacedItems };
    }

    const slotName = this.getEquipmentSlot(itemData);
    if (!slotName) {
      return { success: false, error: "Item is not equipable", displacedItems };
    }

    if (!this.meetsLevelRequirements(playerId, itemData)) {
      return {
        success: false,
        error: "Level requirements not met",
        displacedItems,
      };
    }

    // Handle 2h weapon logic
    const is2hWeapon = this.is2hWeapon(itemData);
    const currentWeapon = equipment.weapon?.item;
    const currentWeaponIs2h = currentWeapon
      ? this.is2hWeapon(currentWeapon)
      : false;

    // If equipping a 2h weapon, collect shield for displacement
    if (is2hWeapon && slotName === "weapon" && equipment.shield?.itemId) {
      const shieldItemId = equipment.shield.itemId?.toString() || "";
      displacedItems.push({
        itemId: shieldItemId,
        slot: "shield",
        quantity: 1,
      });

      // Clear shield slot
      equipment.shield.itemId = null;
      equipment.shield.item = null;

      // Emit change event for shield
      this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
        playerId,
        slot: "shield" as EquipmentSlotName,
        itemId: null,
      });
    }

    // If equipping a shield and 2h weapon equipped, reject
    if (slotName === "shield" && currentWeaponIs2h) {
      return {
        success: false,
        error: "Cannot equip shield with 2h weapon",
        displacedItems,
      };
    }

    // Collect current item in target slot for displacement
    if (!this.isValidEquipmentSlot(slotName)) {
      return {
        success: false,
        error: "Invalid equipment slot",
        displacedItems,
      };
    }

    const targetSlot = equipment[slotName] as EquipmentSlot | undefined;
    if (targetSlot?.itemId) {
      const currentItemId = targetSlot.itemId?.toString() || "";
      displacedItems.push({
        itemId: currentItemId,
        slot: slotName,
        quantity: 1,
      });

      // Clear the slot
      targetSlot.itemId = null;
      targetSlot.item = null;
    }

    // Equip the new item
    if (targetSlot) {
      targetSlot.itemId = itemId;
      targetSlot.item = itemData;
    }

    // Update stats
    this.recalculateStats(playerId);

    // Emit change event
    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
      playerId,
      slot: slotName as EquipmentSlotName,
      itemId: itemId?.toString() || null,
    });

    // Send equipment state to client
    this.sendEquipmentUpdated(playerId);

    // Save to database
    await this.saveEquipmentToDatabase(playerId);

    return { success: true, equippedSlot: slotName, displacedItems };
  }

  /**
   * Unequip item directly (bypassing inventory).
   *
   * Used by bank equipment tab to deposit worn equipment directly to bank.
   * Does NOT add to inventory - caller is responsible for bank item addition.
   *
   * @param playerId - The player ID
   * @param slotName - The slot to unequip (weapon, shield, etc.)
   * @returns Result with success status and the unequipped item
   *
   * @example
   * const result = await equipmentSystem.unequipItemDirect(playerId, "weapon");
   * if (result.success && result.itemId) {
   *   // Add result.itemId to bank
   * }
   */
  async unequipItemDirect(
    playerId: string,
    slotName: string,
  ): Promise<{
    success: boolean;
    error?: string;
    itemId?: string;
    quantity: number;
  }> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      return {
        success: false,
        error: "Equipment not initialized",
        quantity: 0,
      };
    }

    if (!this.isValidEquipmentSlot(slotName)) {
      return { success: false, error: "Invalid slot", quantity: 0 };
    }

    const slot = equipment[slotName] as EquipmentSlot | undefined;
    if (!slot || !slot.itemId) {
      return { success: false, error: "Slot is empty", quantity: 0 };
    }

    const itemId = slot.itemId?.toString() || "";
    const quantity = slot.quantity ?? 1;

    // Clear slot (including quantity)
    slot.itemId = null;
    slot.item = null;
    slot.quantity = undefined;

    // Update stats
    this.recalculateStats(playerId);

    // Emit change event
    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
      playerId,
      slot: slotName as EquipmentSlotName,
      itemId: null,
    });

    // Send equipment state to client
    this.sendEquipmentUpdated(playerId);

    // Save to database
    await this.saveEquipmentToDatabase(playerId);

    return { success: true, itemId, quantity };
  }

  /**
   * Get all equipped items for deposit-all operation.
   *
   * Used by bank equipment tab "Deposit Worn Items" button.
   *
   * @param playerId - The player ID
   * @returns Array of all equipped item info
   */
  getAllEquippedItems(
    playerId: string,
  ): Array<{ slot: string; itemId: string; quantity: number }> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return [];

    const result: Array<{ slot: string; itemId: string; quantity: number }> =
      [];

    for (const slotName of EQUIPMENT_SLOT_NAMES) {
      const slot = equipment[slotName] as EquipmentSlot | undefined;
      if (slot?.itemId) {
        result.push({
          slot: slotName,
          itemId: slot.itemId.toString(),
          quantity: slot.quantity ?? 1,
        });
      }
    }

    return result;
  }

  /**
   * Get the quantity of arrows currently equipped.
   *
   * Queries the inventory system for the arrow stack quantity.
   * Used by ranged combat to determine available ammunition.
   *
   * @param playerId - The player ID to check
   * @returns Number of arrows equipped (0 if none)
   *
   * @example
   * const arrows = equipmentSystem.getArrowCount(playerId);
   * if (arrows === 0) {
   *   showMessage("You're out of arrows!");
   * }
   */
  getArrowCount(playerId: string): number {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment || !equipment.arrows?.item || !equipment.arrows.itemId) {
      return 0;
    }

    // Arrows are stored directly in the equipment slot with quantity
    return equipment.arrows.quantity ?? 0;
  }

  /**
   * Consume one arrow from the equipped arrow slot.
   *
   * Removes one arrow from inventory and updates equipment state.
   * Auto-unequips arrows when the last one is consumed.
   * Used by ranged combat after each attack.
   *
   * @param playerId - The player ID consuming the arrow
   * @returns true if an arrow was consumed, false if none available
   *
   * @example
   * if (!await equipmentSystem.consumeArrow(playerId)) {
   *   // Switch to melee combat or show out of ammo message
   * }
   */
  public async consumeArrow(playerId: string): Promise<boolean> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment || !equipment.arrows?.item || !equipment.arrows.itemId) {
      return false;
    }

    // Arrows are stored directly in equipment slot with quantity
    const currentQuantity = equipment.arrows.quantity ?? 1;

    if (currentQuantity <= 0) {
      // No arrows left
      await this.unequipItem({ playerId, slot: "arrows" });
      return false;
    }

    // Reduce quantity by 1
    equipment.arrows.quantity = currentQuantity - 1;

    // If no arrows left after consumption, clear the slot
    if (equipment.arrows.quantity <= 0) {
      // Clear the arrow slot
      equipment.arrows.itemId = null;
      equipment.arrows.item = null;
      equipment.arrows.quantity = undefined;

      // Notify client of equipment change
      this.sendEquipmentUpdated(playerId);

      // Save to database
      await this.saveEquipmentToDatabase(playerId);
    }

    return true;
  }

  /**
   * Main update loop
   */
  update(_dt: number): void {
    // No-op: visual equipment attachment will be implemented
    // when proper 3D models are available for equipment items
  }

  private isValidEquipmentSlot(
    slot: string,
  ): slot is keyof Omit<PlayerEquipment, "playerId" | "totalStats"> {
    return Object.values(EquipmentSlotName).includes(slot as EquipmentSlotName);
  }

  /**
   * Cleanup when system is destroyed
   */
  start(): void {
    // Write-through persistence: no auto-save needed, all mutations persist immediately
  }

  /**
   * Async destroy - properly awaits all database saves before cleanup.
   * Call this for graceful shutdown to prevent data loss.
   */
  async destroyAsync(): Promise<void> {
    // Final save pass for all connected players before shutdown
    if (this.world.isServer && this.databaseSystem) {
      const savePromises: Promise<void>[] = [];
      for (const playerId of this.playerEquipment.keys()) {
        savePromises.push(this.saveEquipmentToDatabase(playerId));
      }
      // Wait for all saves to complete (with error handling)
      const results = await Promise.allSettled(savePromises);
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        Logger.systemError(
          "EquipmentSystem",
          `${failures.length} equipment saves failed during shutdown`,
          new Error("Partial save failure on shutdown"),
        );
      }
    }

    // Clear all player equipment data
    this.playerEquipment.clear();

    // Call parent cleanup
    super.destroy();
  }

  destroy(): void {
    // Fire-and-forget async cleanup (best effort for non-async callers)
    this.destroyAsync().catch((err) => {
      Logger.systemError(
        "EquipmentSystem",
        "Error during async destroy",
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  }
}
