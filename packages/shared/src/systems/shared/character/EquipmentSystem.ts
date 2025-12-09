/**
 * Equipment System
 * Handles equipment management, stat bonuses, level requirements, and visual attachment per GDD specifications
 * - Equipment slots (weapon, shield, helmet, body, legs, arrows)
 * - Level requirements for equipment tiers
 * - Stat bonuses from equipped items
 * - Right-click equip/unequip functionality
 * - Visual equipment attachment to player avatars
 * - Colored cube representations for equipment
 */

import THREE from "../../../extras/three/three";
import { EventType } from "../../../types/events";
import { dataManager } from "../../../data/DataManager";
import type { InventorySystem } from "./InventorySystem";
import { EQUIPMENT_SLOT_NAMES } from "../../../constants/EquipmentConstants";

/**
 * Equipment color mapping by material type (visual only)
 * Used for colored cube representations in the game.
 */
const EQUIPMENT_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  steel: "#C0C0C0",
  mithril: "#4169E1",
  leather: "#8B4513",
  hard_leather: "#A0522D",
  studded_leather: "#654321",
  wood: "#8B4513",
  oak: "#8B7355",
  willow: "#9ACD32",
  arrows: "#FFD700",
};

/**
 * Helper functions for equipment requirements
 * Now uses manifest-driven data from DataManager instead of separate JSON file.
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

  /**
   * Get equipment color based on material prefix (for visual representation)
   */
  getEquipmentColor: (itemId: string): string | null => {
    const match = itemId.match(
      /^(bronze|steel|mithril|leather|hard_leather|studded_leather|wood|oak|willow|arrows)_/,
    );
    return match ? EQUIPMENT_COLORS[match[1]] : null;
  },

  /**
   * Get default color by item type
   */
  getDefaultColorByType: (itemType: string): string => {
    const defaults: Record<string, string> = {
      weapon: "#808080",
      shield: "#A0A0A0",
      helmet: "#606060",
      body: "#505050",
      legs: "#404040",
      arrows: "#FFD700",
    };
    return defaults[itemType] || "#808080";
  },
};
import { SystemBase } from "..";
import { Logger } from "../../../utils/Logger";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";

import { World } from "../../../core/World";
import {
  AttackType,
  ItemType,
  EquipmentSlot,
  EquipmentSlotName,
  PlayerEquipment as PlayerEquipment,
  Item,
  WeaponType,
} from "../../../types/core/core";
import { ItemRarity } from "../../../types/entities";
import type { PlayerWithEquipmentSupport } from "../../../types/rendering/ui";

const attachmentPoints = {
  helmet: { bone: "head", offset: new THREE.Vector3(0, 0.1, 0) },
  body: { bone: "spine", offset: new THREE.Vector3(0, 0, 0) },
  legs: { bone: "hips", offset: new THREE.Vector3(0, -0.2, 0) },
  weapon: { bone: "rightHand", offset: new THREE.Vector3(0.1, 0, 0) },
  shield: { bone: "leftHand", offset: new THREE.Vector3(-0.1, 0, 0) },
  arrows: { bone: "spine", offset: new THREE.Vector3(0, 0, -0.2) },
};

// Cache attachment point entries to avoid Object.entries allocation
const attachmentPointEntries: Array<
  [string, { bone: string; offset: THREE.Vector3 }]
> = [
  ["helmet", attachmentPoints.helmet],
  ["body", attachmentPoints.body],
  ["legs", attachmentPoints.legs],
  ["weapon", attachmentPoints.weapon],
  ["shield", attachmentPoints.shield],
  ["arrows", attachmentPoints.arrows],
];

// Re-export for backward compatibility
export type { EquipmentSlot, PlayerEquipment };

/**
 * Equipment System - GDD Compliant
 * Manages player equipment per GDD specifications:
 * - 6 equipment slots as defined in GDD
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
  private saveInterval?: NodeJS.Timeout;
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  // Reusable arrays to avoid allocations
  private readonly _reusableSlotsArray: Array<{
    key: string;
    slot: EquipmentSlotName;
  }> = [
    { key: "weapon", slot: EquipmentSlotName.WEAPON },
    { key: "shield", slot: EquipmentSlotName.SHIELD },
    { key: "helmet", slot: EquipmentSlotName.HELMET },
    { key: "body", slot: EquipmentSlotName.BODY },
    { key: "legs", slot: EquipmentSlotName.LEGS },
    { key: "arrows", slot: EquipmentSlotName.ARROWS },
  ];
  private readonly _reusableSlotNames: readonly string[] = [
    "weapon",
    "shield",
    "helmet",
    "body",
    "legs",
    "arrows",
  ] as const;
  private readonly _reusableStatKeys: readonly (keyof {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
    constitution: number;
  })[] = ["attack", "strength", "defense", "ranged", "constitution"] as const;
  // Cache EquipmentSlotName values to avoid Object.values allocation
  private readonly _cachedEquipmentSlotNames: readonly EquipmentSlotName[] = [
    EquipmentSlotName.WEAPON,
    EquipmentSlotName.SHIELD,
    EquipmentSlotName.HELMET,
    EquipmentSlotName.BODY,
    EquipmentSlotName.LEGS,
    EquipmentSlotName.ARROWS,
  ] as const;

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

  async init(): Promise<void> {
    // Get DatabaseSystem for persistence
    this.databaseSystem = this.world.getSystem("database") as
      | DatabaseSystem
      | undefined;

    if (!this.databaseSystem && this.world.isServer) {
      console.warn(
        "[EquipmentSystem] DatabaseSystem not found - equipment will not persist!",
      );
    }

    // Set up type-safe event subscriptions with proper type casting
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => {
      const typedData = data as { playerId: string };
      this.initializePlayerEquipment({ id: typedData.playerId });
    });
    // CRITICAL: Must await database load to prevent race condition
    // where client receives empty equipment before DB load completes
    this.subscribe(EventType.PLAYER_JOINED, async (data) => {
      const typedData = data as { playerId: string };
      await this.loadEquipmentFromDatabase(typedData.playerId);
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
        slot: string;
      };
      await this.equipItem({
        playerId: typedData.playerId,
        itemId: typedData.itemId,
        slot: typedData.slot,
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
      this.handleForceEquip({
        playerId: typedData.playerId,
        item: this.getItemData(typedData.itemId)!,
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
      arrows: {
        id: `${playerData.id}_arrows`,
        name: "Arrow Slot",
        slot: EquipmentSlotName.ARROWS,
        itemId: null,
        item: null,
      },
      totalStats: {
        attack: 0,
        strength: 0,
        defense: 0,
        ranged: 0,
        constitution: 0,
      },
    };

    this.playerEquipment.set(playerData.id, equipment);

    // NOTE: Starting items are equipped in loadEquipmentFromDatabase()
    // only if no equipment is found in the database
  }

  private equipStartingItems(playerId: string): void {
    // Per GDD, players start with bronze sword equipped
    const bronzeSword = this.getItemData("bronze_sword");
    if (bronzeSword) {
      this.forceEquipItem(playerId, bronzeSword, "weapon");
    }
  }

  private async loadEquipmentFromDatabase(playerId: string): Promise<void> {
    if (!this.databaseSystem) {
      return;
    }

    // Use playerId directly - database layer handles character ID mapping
    const dbEquipment =
      await this.databaseSystem.getPlayerEquipmentAsync(playerId);

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
          }
        }
      }

      // Recalculate stats after loading equipment
      this.recalculateStats(playerId);

      // CRITICAL: Send loaded equipment state to client
      if (this.world.isServer && this.world.network?.send) {
        const equipmentData = this.getPlayerEquipment(playerId);
        this.world.network.send("equipmentUpdated", {
          playerId,
          equipment: equipmentData,
        });
      }

      // Emit PLAYER_EQUIPMENT_CHANGED for each slot to update visuals
      for (const slotName of EQUIPMENT_SLOT_NAMES) {
        const slot = equipment[slotName] as EquipmentSlot | null;
        const itemId = slot?.itemId ? slot.itemId.toString() : null;
        this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
          playerId: playerId,
          slot: slotName as EquipmentSlotName,
          itemId: itemId,
        });
      }
    } else {
      // NEW PLAYERS START WITH EMPTY EQUIPMENT
      // Starting items (like bronze sword) should be in INVENTORY, not equipped

      // Send empty equipment to client
      if (this.world.isServer && this.world.network?.send) {
        const equipmentData = this.getPlayerEquipment(playerId);
        this.world.network.send("equipmentUpdated", {
          playerId,
          equipment: equipmentData,
        });
      }

      // Emit PLAYER_EQUIPMENT_CHANGED for each slot with null (clear visuals)
      for (const slotName of EQUIPMENT_SLOT_NAMES) {
        this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
          playerId: playerId,
          slot: slotName as EquipmentSlotName,
          itemId: null, // No equipment - clear visuals
        });
      }
    }
  }

  private async saveEquipmentToDatabase(playerId: string): Promise<void> {
    if (!this.databaseSystem) {
      console.warn(
        "[EquipmentSystem] 💾 Cannot save - no database system for:",
        playerId,
      );
      return;
    }

    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      console.warn(
        "[EquipmentSystem] 💾 Cannot save - no equipment data for:",
        playerId,
      );
      return;
    }

    // Convert to database format
    const dbEquipment: Array<{
      slotType: string;
      itemId: string;
      quantity: number;
    }> = [];

    const slots = [
      { key: "weapon", slot: EquipmentSlotName.WEAPON },
      { key: "shield", slot: EquipmentSlotName.SHIELD },
      { key: "helmet", slot: EquipmentSlotName.HELMET },
      { key: "body", slot: EquipmentSlotName.BODY },
      { key: "legs", slot: EquipmentSlotName.LEGS },
      { key: "arrows", slot: EquipmentSlotName.ARROWS },
    ];

    for (const { key, slot } of slots) {
      const equipSlot = equipment[key as keyof PlayerEquipment];
      // Strong type assumption - equipSlot is EquipmentSlot if it's not playerId or totalStats
      if (
        equipSlot &&
        equipSlot !== equipment.playerId &&
        equipSlot !== equipment.totalStats
      ) {
        const typedSlot = equipSlot as EquipmentSlot;
        if (typedSlot.itemId) {
          dbEquipment.push({
            slotType: slot,
            itemId: String(typedSlot.itemId),
            quantity: 1,
          });
        }
      }
    }

    // Use playerId directly - database layer handles character ID mapping
    // CRITICAL: Use async method to ensure save completes before returning
    await this.databaseSystem.savePlayerEquipmentAsync(playerId, dbEquipment);
  }

  /**
   * Clear all equipped items immediately (for death system)
   * CRITICAL for death system to prevent item duplication
   */
  async clearEquipmentImmediate(playerId: string): Promise<number> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      return 0;
    }

    // Count equipped items before clearing
    let clearedCount = 0;

    for (const slotName of EQUIPMENT_SLOT_NAMES) {
      const slot = equipment[slotName] as EquipmentSlot | null;
      if (slot && slot.item) {
        clearedCount++;

        // CRITICAL: Clear the slot's contents, but keep the slot object intact!
        // Don't do: equipment[slotName] = null (this destroys the slot object)
        // Instead: Clear the slot's properties while keeping the object
        slot.itemId = null;
        slot.item = null;
        if (slot.visualMesh) {
          slot.visualMesh = undefined;
        }

        // Emit PLAYER_EQUIPMENT_CHANGED for visual system to remove item from avatar
        this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
          playerId: playerId,
          slot: slotName as EquipmentSlotName,
          itemId: null, // null = item removed
        });
      }
    }

    // Reset total stats
    equipment.totalStats = {
      attack: 0,
      strength: 0,
      defense: 0,
      ranged: 0,
      constitution: 0,
    };

    // Emit UI update event
    this.emitTypedEvent(EventType.UI_EQUIPMENT_UPDATE, {
      playerId,
      equipment: {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null,
      },
    });

    // CRITICAL: Persist to database IMMEDIATELY (no debounce)
    await this.saveEquipmentToDatabase(playerId);

    return clearedCount;
  }

  private cleanupPlayerEquipment(playerId: string): void {
    this.playerEquipment.delete(playerId);
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
    } else {
      // Not equippable - maybe it's consumable?
      if (itemData.type === "food") {
        this.emitTypedEvent(EventType.INVENTORY_CONSUME_ITEM, {
          playerId: data.playerId,
          itemId: data.itemId,
          slot: data.slot,
        });
      }
    }
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

    // Unequip current item in slot if any
    if (equipmentSlot.itemId) {
      await this.unequipItem({
        playerId: data.playerId,
        slot: data.slot,
      });
    }

    // Equip new item - keep itemId as string | number
    equipmentSlot.itemId = data.itemId;
    equipmentSlot.item = itemData;

    // Create visual representation
    this.createEquipmentVisual(data.playerId, equipmentSlot);

    // Remove from inventory
    this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: 1,
      slot: data.inventorySlot,
    });

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
    if (this.world.isServer && this.world.network?.send) {
      const equipment = this.getPlayerEquipment(data.playerId);
      this.world.network.send("equipmentUpdated", {
        playerId: data.playerId,
        equipment,
      });
    }

    this.sendMessage(data.playerId, `Equipped ${itemData.name}.`, "info");

    // Save to database after equipping - MUST await to prevent data loss on logout
    await this.saveEquipmentToDatabase(data.playerId);
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

    // Store item name before clearing the slot
    const itemName = equipmentSlot.item.name;
    const itemIdToAdd = equipmentSlot.itemId?.toString() || "";

    // Add back to inventory - use correct event format for InventoryItemAddedPayload
    this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
      playerId: data.playerId,
      item: {
        id: `inv_${data.playerId}_${Date.now()}`,
        itemId: itemIdToAdd,
        quantity: 1,
        slot: -1, // Let system find empty slot
        metadata: null,
      },
    });

    // Always proceed with unequipping (assume inventory has space)
    // Remove visual representation
    this.removeEquipmentVisual(equipmentSlot);

    // Clear equipment slot
    equipmentSlot.itemId = null;
    equipmentSlot.item = null;

    // Update stats
    this.recalculateStats(data.playerId);

    // Update combat system (emit per-slot change for type consistency)
    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
      playerId: data.playerId,
      slot: slot as EquipmentSlotName,
      itemId: null,
    });

    // Send equipment state to client
    if (this.world.isServer && this.world.network?.send) {
      const equipment = this.getPlayerEquipment(data.playerId);
      this.world.network.send("equipmentUpdated", {
        playerId: data.playerId,
        equipment,
      });
    }

    this.sendMessage(data.playerId, `Unequipped ${itemName}.`, "info");

    // Save to database after unequipping - MUST await to prevent data loss on logout
    await this.saveEquipmentToDatabase(data.playerId);
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

    // Create visual representation
    this.createEquipmentVisual(playerId, equipmentSlot);

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

    // Reset stats
    equipment.totalStats = {
      attack: 0,
      strength: 0,
      defense: 0,
      ranged: 0,
      constitution: 0,
    };

    // Add bonuses from each equipped item
    // Optimize: avoid filter/forEach/Object.keys allocations
    const slots = [
      equipment.weapon,
      equipment.shield,
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.arrows,
    ];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot && slot.item) {
        const bonuses = slot.item.bonuses;
        if (bonuses) {
          // Optimize: iterate stat keys directly instead of Object.keys()
          for (let j = 0; j < this._reusableStatKeys.length; j++) {
            const stat = this._reusableStatKeys[j];
            const bonus = bonuses[stat];
            if (bonus) {
              equipment.totalStats[stat] += bonus;
            }
          }
        }
      }
    }

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
    // Handle 2-handed weapons (they go in weapon slot)
    if (this.is2hWeapon(itemData)) {
      return "weapon";
    }

    switch (itemData.type) {
      case ItemType.WEAPON:
        return itemData.weaponType === WeaponType.BOW ||
          itemData.weaponType === WeaponType.CROSSBOW
          ? "weapon"
          : "weapon";
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
    // Optimize: avoid Object.entries allocation - use Object.keys iteration
    const reqKeys = Object.keys(requirements);
    for (let i = 0; i < reqKeys.length; i++) {
      const skill = reqKeys[i];
      const required = requirements[skill];
      if (required !== undefined) {
        const playerLevel = playerSkills[skill] || 1;
        if (playerLevel < required) {
          return false;
        }
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
      fishing: 1,
      firemaking: 1,
      cooking: 1,
    };
  }

  private playerHasItem(playerId: string, itemId: number | string): boolean {
    const itemIdStr = itemId.toString();

    // Check with InventorySystem directly (not via events - events require subscriber)
    const inventorySystem = this.world.getSystem<InventorySystem>("inventory");
    if (inventorySystem && inventorySystem.hasItem(playerId, itemIdStr, 1)) {
      return true;
    }

    // Also check if item is already equipped
    const equipment = this.playerEquipment.get(playerId);
    if (equipment) {
      // Optimize: avoid filter/some allocations - use direct checks
      const slots = [
        equipment.weapon,
        equipment.shield,
        equipment.helmet,
        equipment.body,
        equipment.legs,
        equipment.arrows,
      ];
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (
          slot &&
          (slot.itemId === parseInt(itemIdStr, 10) || slot.itemId === itemId)
        ) {
          return true;
        }
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

    return {
      weapon: equipment.weapon?.item || null,
      shield: equipment.shield?.item || null,
      helmet: equipment.helmet?.item || null,
      body: equipment.body?.item || null,
      legs: equipment.legs?.item || null,
      arrows: equipment.arrows?.item || null,
    };
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
  isItemEquipped(playerId: string, itemId: number): boolean {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return false;

    // Optimize: avoid filter/some allocations - use direct checks
    const slots = [
      equipment.weapon,
      equipment.shield,
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.arrows,
    ];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot && slot.itemId === itemId) {
        return true;
      }
    }
    return false;
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
    if (!equipment || !equipment.arrows?.item) return 0;

    // Get arrow quantity from inventory system
    const inventorySystem = this.world.getSystem("inventory") as
      | import("./InventorySystem").InventorySystem
      | undefined;
    if (inventorySystem && equipment.arrows.itemId) {
      const arrowCount = inventorySystem.getItemQuantity(
        playerId,
        equipment.arrows.itemId?.toString() || "",
      );
      return Math.max(0, arrowCount);
    }

    return (equipment.arrows as { quantity?: number }).quantity || 0;
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
    if (!equipment || !equipment.arrows?.item) {
      return false;
    }

    // Request inventory to remove arrow via typed event API
    if (equipment.arrows.itemId) {
      this.emitTypedEvent(EventType.INVENTORY_REMOVE_ITEM, {
        playerId,
        itemId: equipment.arrows.itemId?.toString() || "",
        quantity: 1,
      });

      {
        // Update equipment quantity
        const arrowsWithQuantity = equipment.arrows as { quantity?: number };
        if (arrowsWithQuantity.quantity) {
          arrowsWithQuantity.quantity = Math.max(
            0,
            arrowsWithQuantity.quantity - 1,
          );
        }

        // If no arrows left, unequip the arrow slot
        if (this.getArrowCount(playerId) === 0) {
          await this.unequipItem({ playerId, slot: "arrows" });
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Create visual representation of equipped item
   * DISABLED: Cube-based equipment visuals clutter the scene
   * Equipment should be attached to player skeleton, not floating cubes
   */
  private createEquipmentVisual(_playerId: string, _slot: EquipmentSlot): void {
    // DISABLED: Box geometry equipment visuals are debug/test artifacts
    //
    // Proper implementation should:
    // 1. Load actual 3D models for equipment (GLB files)
    // 2. Attach to player/mob skeleton bones (e.g., hand bone for weapon)
    // 3. Use proper material/texture system
    // 4. Handle equipment swapping with smooth transitions
    //
    // For MVP: Equipment is tracked in data/stats but not visually shown
    // Combat mechanics work without visual equipment representation

    // DO NOT CREATE CUBE PROXIES
    return;
  }

  /**
   * Remove visual representation of equipment
   */
  private removeEquipmentVisual(slot: EquipmentSlot): void {
    if (slot.visualMesh) {
      // Remove from scene
      if (slot.visualMesh.parent) {
        slot.visualMesh.parent.remove(slot.visualMesh);
      }
      slot.visualMesh = undefined;
    }
  }

  /**
   * Get equipment color based on material (returns Three.js hex number)
   */
  private getEquipmentColor(item: Item): number {
    const nameLower = (item.name as string)?.toLowerCase() || "";

    const hexString =
      equipmentRequirements.getEquipmentColor(nameLower) ??
      equipmentRequirements.getDefaultColorByType(item.type as string);

    // Convert CSS hex string (#RRGGBB) to Three.js number (0xRRGGBB)
    return parseInt(hexString.replace("#", ""), 16);
  }

  /**
   * Type guard to check if player supports equipment attachment
   */
  private hasEquipmentSupport(
    player: unknown,
  ): player is PlayerWithEquipmentSupport {
    return (
      typeof player === "object" &&
      player !== null &&
      "position" in player &&
      "getBoneTransform" in player
    );
  }

  /**
   * Update equipment positions to follow player avatars
   */
  private updateEquipmentPositions(): void {
    for (const [playerId, equipment] of this.playerEquipment) {
      // Check if player still exists (may have disconnected)
      const player = this.world.getPlayer
        ? this.world.getPlayer(playerId)
        : this.world.entities?.get(playerId);

      // Skip if player not found or doesn't have equipment support
      if (!player || !this.hasEquipmentSupport(player)) {
        // Clean up equipment for disconnected players
        if (!player) {
          this.playerEquipment.delete(playerId);
        }
        continue;
      }

      this.updatePlayerEquipmentVisuals(player, equipment);
    }
  }

  /**
   * Update equipment visuals for a specific player
   */
  private updatePlayerEquipmentVisuals(
    player: PlayerWithEquipmentSupport,
    equipment: PlayerEquipment,
  ): void {
    // Process each equipment slot
    // Optimize: avoid Object.entries/forEach allocations - use cached entries array
    for (let i = 0; i < attachmentPointEntries.length; i++) {
      const [slotName, attachment] = attachmentPointEntries[i];
      const slot = equipment[
        slotName as keyof PlayerEquipment
      ] as EquipmentSlot;
      if (slot?.visualMesh) {
        this.attachEquipmentToPlayer(
          player,
          slot.visualMesh as THREE.Object3D,
          attachment.bone,
          attachment.offset,
        );
      }
    }
  }

  /**
   * Attach equipment visual to player avatar bone
   */
  private attachEquipmentToPlayer(
    player: PlayerWithEquipmentSupport,
    equipmentMesh: THREE.Object3D,
    boneName: string,
    offset: THREE.Vector3,
  ): void {
    // Try to get bone transform from player avatar
    if (player.getBoneTransform) {
      const boneMatrix = player.getBoneTransform(boneName);
      if (boneMatrix) {
        equipmentMesh.position.setFromMatrixPosition(boneMatrix);
        equipmentMesh.quaternion.setFromRotationMatrix(boneMatrix);
        equipmentMesh.position.add(offset);
        return;
      }
    }

    equipmentMesh.position.copy(player.position);
    equipmentMesh.position.add(offset);
    equipmentMesh.position.y += 1.8;
  }

  /**
   * Main update loop - preserve equipment visual updates
   */
  update(_dt: number): void {
    // Update equipment visuals every frame
    this.updateEquipmentPositions();
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
    // Start periodic auto-save on server only
    if (this.world.isServer && this.databaseSystem) {
      this.startAutoSave();
    }
  }

  private startAutoSave(): void {
    this.saveInterval = setInterval(() => {
      this.performAutoSave();
    }, this.AUTO_SAVE_INTERVAL);
  }

  private async performAutoSave(): Promise<void> {
    if (!this.databaseSystem) return;

    for (const playerId of this.playerEquipment.keys()) {
      try {
        await this.saveEquipmentToDatabase(playerId);
      } catch (error) {
        Logger.systemError(
          "EquipmentSystem",
          `Error during auto-save for player ${playerId}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }

  /**
   * Async destroy - properly awaits all database saves before cleanup.
   * Call this for graceful shutdown to prevent data loss.
   */
  async destroyAsync(): Promise<void> {
    // Stop auto-save interval first
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    // Await all final saves before shutdown
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
