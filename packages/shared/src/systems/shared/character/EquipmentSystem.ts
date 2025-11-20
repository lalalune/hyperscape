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
import equipmentRequirementsData from "../../../data/equipment-requirements.json";

// Helper functions for equipment requirements (replaces deleted EquipmentRequirements class)
const equipmentRequirements = {
  getLevelRequirements: (itemId: string) => {
    const allReqs = equipmentRequirementsData.levelRequirements;
    return (
      allReqs.weapons[itemId] ||
      allReqs.shields[itemId] ||
      allReqs.armor.helmets[itemId] ||
      allReqs.armor.body[itemId] ||
      allReqs.armor.legs[itemId] ||
      allReqs.ammunition[itemId] ||
      null
    );
  },
  getRequirementText: (itemId: string) => {
    const reqs = equipmentRequirements.getLevelRequirements(itemId);
    if (!reqs) return "";
    const parts: string[] = [];
    if (reqs.attack > 0) parts.push(`Attack ${reqs.attack}`);
    if (reqs.strength > 0) parts.push(`Strength ${reqs.strength}`);
    if (reqs.defense > 0) parts.push(`Defense ${reqs.defense}`);
    if (reqs.ranged > 0) parts.push(`Ranged ${reqs.ranged}`);
    if (reqs.constitution > 0) parts.push(`Constitution ${reqs.constitution}`);
    return parts.join(", ");
  },
  getEquipmentColor: (itemId: string) => {
    const match = itemId.match(
      /^(bronze|steel|mithril|leather|hard_leather|studded_leather|wood|oak|willow|arrows)_/,
    );
    return match ? equipmentRequirementsData.equipmentColors[match[1]] : null;
  },
  getDefaultColorByType: (itemType: string) => {
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
  ItemBonuses,
  ItemType,
  LevelRequirement,
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
    console.log(
      "[EquipmentSystem] Initializing on",
      this.world.isServer ? "SERVER" : "CLIENT",
    );

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
    this.subscribe(EventType.PLAYER_JOINED, (data) => {
      const typedData = data as { playerId: string };
      this.loadEquipmentFromDatabase(typedData.playerId);
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
    this.subscribe(EventType.EQUIPMENT_EQUIP, (data) => {
      const typedData = data as {
        playerId: string;
        itemId: string;
        slot: string;
      };
      this.equipItem({
        playerId: typedData.playerId,
        itemId: typedData.itemId,
        slot: typedData.slot,
        inventorySlot: undefined,
      });
    });
    this.subscribe(EventType.EQUIPMENT_UNEQUIP, (data) => {
      const typedData = data as { playerId: string; slot: string };
      this.unequipItem({
        playerId: typedData.playerId,
        slot: typedData.slot,
      });
    });
    this.subscribe(EventType.EQUIPMENT_TRY_EQUIP, (data) => {
      const typedData = data as { playerId: string; itemId: string };
      this.tryEquipItem({
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
    console.log(
      "[EquipmentSystem] Subscribing to INVENTORY_ITEM_RIGHT_CLICK event",
    );
    this.subscribe(EventType.INVENTORY_ITEM_RIGHT_CLICK, (data) => {
      const typedData = data as {
        playerId: string;
        itemId: string;
        slot: number;
      };
      console.log(
        "[EquipmentSystem] ⚡ RECEIVED INVENTORY_ITEM_RIGHT_CLICK:",
        typedData,
      );
      this.handleItemRightClick({
        playerId: typedData.playerId,
        itemId: typedData.itemId,
        slot: typedData.slot,
      });
    });
    this.subscribe(EventType.EQUIPMENT_CONSUME_ARROW, (data) => {
      const typedData = data as { playerId: string };
      this.consumeArrow(typedData.playerId);
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
    console.log(
      "[EquipmentSystem] ⚠️ equipStartingItems() called for:",
      playerId,
    );
    console.log(
      "[EquipmentSystem] ⚠️ This should ONLY happen for NEW players with NO saved equipment!",
    );
    console.trace("[EquipmentSystem] Stack trace for equipStartingItems:");

    // Per GDD, players start with bronze sword equipped
    const bronzeSword = this.getItemData("bronze_sword");
    if (bronzeSword) {
      console.log(
        "[EquipmentSystem] 🗡️ Force-equipping bronze sword for new player:",
        playerId,
      );
      this.forceEquipItem(playerId, bronzeSword, "weapon");
    }
  }

  private async loadEquipmentFromDatabase(playerId: string): Promise<void> {
    if (!this.databaseSystem) {
      console.warn(
        "[EquipmentSystem] ⚠️ No database system - cannot load equipment for:",
        playerId,
      );
      return;
    }

    console.log(
      "[EquipmentSystem] 📂 Loading equipment from database for:",
      playerId,
    );

    // Use playerId directly - database layer handles character ID mapping
    const dbEquipment =
      await this.databaseSystem.getPlayerEquipmentAsync(playerId);

    console.log(
      "[EquipmentSystem] 📦 Database returned:",
      dbEquipment?.length || 0,
      "equipment items for player:",
      playerId,
    );
    if (dbEquipment && dbEquipment.length > 0) {
      console.log(
        "[EquipmentSystem] 📋 Equipment items from DB:",
        dbEquipment.map((e) => `${e.slotType}: ${e.itemId}`).join(", "),
      );
    }

    if (dbEquipment && dbEquipment.length > 0) {
      const equipment = this.playerEquipment.get(playerId);
      if (!equipment) {
        console.error(
          "[EquipmentSystem] ❌ Equipment object not found for player:",
          playerId,
        );
        return;
      }

      // Load equipped items from database
      for (const dbItem of dbEquipment) {
        if (!dbItem.itemId) continue; // Skip null items

        const itemData = this.getItemData(dbItem.itemId);
        if (itemData && dbItem.slotType) {
          console.log(
            `[EquipmentSystem] ✅ Loading ${dbItem.slotType}: ${dbItem.itemId} (${itemData.name})`,
          );
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
        } else {
          console.warn(
            `[EquipmentSystem] ⚠️ Failed to load item: ${dbItem.itemId} for slot: ${dbItem.slotType}`,
          );
        }
      }

      // Recalculate stats after loading equipment
      this.recalculateStats(playerId);

      // CRITICAL: Send loaded equipment state to client
      if (this.world.isServer && this.world.network?.send) {
        console.log(
          "[EquipmentSystem] 📤 Sending loaded equipment to client on login:",
          playerId,
        );
        const equipmentData = this.getPlayerEquipment(playerId);
        this.world.network.send("equipmentUpdated", {
          playerId,
          equipment: equipmentData,
        });
      }
    } else {
      console.log(
        "[EquipmentSystem] No equipment found in database for player:",
        playerId,
        "- starting with empty equipment",
      );
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
          console.log(
            `[EquipmentSystem] 💾 Preparing to save ${slot}: ${typedSlot.itemId} (${typedSlot.item?.name || "unknown"})`,
          );
          dbEquipment.push({
            slotType: slot,
            itemId: String(typedSlot.itemId),
            quantity: 1,
          });
        }
      }
    }

    console.log(
      "[EquipmentSystem] 💾 Saving equipment to database for:",
      playerId,
      "- Items:",
      dbEquipment.length,
    );
    console.log(
      "[EquipmentSystem] 💾 Equipment to save:",
      dbEquipment.map((e) => `${e.slotType}:${e.itemId}`).join(", "),
    );

    // Use playerId directly - database layer handles character ID mapping
    // CRITICAL: Use async method to ensure save completes before returning
    await this.databaseSystem.savePlayerEquipmentAsync(playerId, dbEquipment);

    console.log(
      "[EquipmentSystem] ✅ Equipment saved to database for:",
      playerId,
    );
  }

  private cleanupPlayerEquipment(playerId: string): void {
    this.playerEquipment.delete(playerId);
  }

  private handleItemRightClick(data: {
    playerId: string;
    itemId: string | number;
    slot: number;
  }): void {
    console.log("[EquipmentSystem] handleItemRightClick:", data);
    const itemData = this.getItemData(data.itemId);
    console.log("[EquipmentSystem] Item data:", itemData);
    if (!itemData) {
      console.error("[EquipmentSystem] No item data found for:", data.itemId);
      return;
    }

    // Determine if this is equippable
    const equipSlot = this.getEquipmentSlot(itemData);
    console.log("[EquipmentSystem] Equipment slot:", equipSlot);
    if (equipSlot) {
      this.tryEquipItem({
        playerId: data.playerId,
        itemId: data.itemId,
        inventorySlot: data.slot,
      });
    } else {
      console.warn("[EquipmentSystem] Item not equippable:", data.itemId);
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

  private tryEquipItem(data: {
    playerId: string;
    itemId: string | number;
    inventorySlot?: number;
  }): void {
    console.log("[EquipmentSystem] 🔍 tryEquipItem START:", data);
    const player = this.world.getPlayer(data.playerId);
    const equipment = this.playerEquipment.get(data.playerId);

    console.log(
      "[EquipmentSystem] 🔍 Step 1 - Player:",
      !!player,
      "Equipment:",
      !!equipment,
    );
    if (!player || !equipment) {
      console.error("[EquipmentSystem] ❌ Missing player or equipment data!");
      return;
    }

    console.log(
      "[EquipmentSystem] 🔍 Step 2 - About to call getItemData for:",
      data.itemId,
    );
    const itemData = this.getItemData(data.itemId);
    console.log(
      "[EquipmentSystem] 🔍 Step 3 - Got itemData:",
      itemData?.name || "NULL",
    );
    if (!itemData) {
      console.error(
        "[EquipmentSystem] ❌ No item data in tryEquipItem for:",
        data.itemId,
      );
      return;
    }

    console.log("[EquipmentSystem] 🔍 Step 4 - About to call getEquipmentSlot");
    const equipSlot = this.getEquipmentSlot(itemData);
    console.log(
      "[EquipmentSystem] 🔍 Step 5 - Got equipSlot:",
      equipSlot || "NULL",
    );
    if (!equipSlot) {
      console.error(
        "[EquipmentSystem] ❌ No equipment slot for:",
        itemData.name,
      );
      this.sendMessage(
        data.playerId,
        `${itemData.name} cannot be equipped.`,
        "warning",
      );
      return;
    }

    console.log("[EquipmentSystem] 🔍 Step 6 - Checking level requirements");
    const meetsRequirements = this.meetsLevelRequirements(
      data.playerId,
      itemData,
    );
    console.log(
      "[EquipmentSystem] 🔍 Step 7 - Meets requirements:",
      meetsRequirements,
    );
    if (!meetsRequirements) {
      const requirements =
        equipmentRequirements.getLevelRequirements(itemData.id as string) || {};
      const reqText = Object.entries(requirements as Record<string, number>)
        .map(([skill, level]) => `${skill} ${level}`)
        .join(", ");

      console.log("[EquipmentSystem] ❌ Failed level requirements:", reqText);
      this.sendMessage(
        data.playerId,
        `You need ${reqText} to equip ${itemData.name}.`,
        "warning",
      );
      return;
    }

    console.log(
      "[EquipmentSystem] 🔍 Step 8 - Checking inventory (inventorySlot:",
      data.inventorySlot,
      ")",
    );
    if (
      data.inventorySlot === undefined &&
      !this.playerHasItem(data.playerId, data.itemId)
    ) {
      console.log(
        "[EquipmentSystem] ❌ Player doesn't have item:",
        data.itemId,
      );
      return;
    }

    console.log(
      "[EquipmentSystem] ✅ Step 9 - All checks passed! Calling equipItem",
    );

    // Perform the equipment
    this.equipItem({
      playerId: data.playerId,
      itemId: data.itemId,
      slot: equipSlot,
      inventorySlot: data.inventorySlot,
    });
  }

  private equipItem(data: {
    playerId: string;
    itemId: string | number;
    slot: string;
    inventorySlot?: number;
  }): void {
    console.log("[EquipmentSystem] 🔧 equipItem called:", data);
    const equipment = this.playerEquipment.get(data.playerId);
    if (!equipment) {
      console.error("[EquipmentSystem] ❌ No equipment data for player");
      return;
    }

    // Check for valid itemId before calling getItemData
    if (data.itemId === null || data.itemId === undefined) {
      console.error("[EquipmentSystem] ❌ Invalid itemId");
      return;
    }

    const itemData = this.getItemData(data.itemId);
    if (!itemData) {
      console.error("[EquipmentSystem] ❌ No item data for:", data.itemId);
      return;
    }

    console.log("[EquipmentSystem] ✅ Got item data:", itemData.name);
    console.log(
      "[EquipmentSystem] 📦 Current inventory slot:",
      data.inventorySlot,
    );

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
      this.unequipItem({
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
      this.unequipItem({
        playerId: data.playerId,
        slot: data.slot,
      });
    }

    // Equip new item - keep itemId as string | number
    console.log(
      "[EquipmentSystem] Equipping item:",
      data.itemId,
      "into slot:",
      slot,
    );
    equipmentSlot.itemId = data.itemId;
    equipmentSlot.item = itemData;

    // Create visual representation
    this.createEquipmentVisual(data.playerId, equipmentSlot);

    // Remove from inventory
    console.log("[EquipmentSystem] 📤 Emitting INVENTORY_ITEM_REMOVED:", {
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: 1,
      slot: data.inventorySlot,
    });
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

    console.log("[EquipmentSystem] Emitting PLAYER_EQUIPMENT_CHANGED:", {
      playerId: data.playerId,
      slot: slot,
      itemId: itemIdForEvent,
    });

    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
      playerId: data.playerId,
      slot: slot as EquipmentSlotName,
      itemId: itemIdForEvent,
    });

    // CRITICAL: Send equipment state to client
    console.log(
      "[EquipmentSystem] 📤 Sending equipment update to client via network",
    );
    if (this.world.isServer && this.world.network?.send) {
      const equipment = this.getPlayerEquipment(data.playerId);
      console.log("[EquipmentSystem] Equipment to send:", equipment);
      this.world.network.send("equipmentUpdated", {
        playerId: data.playerId,
        equipment,
      });
    }

    this.sendMessage(data.playerId, `Equipped ${itemData.name}.`, "info");

    // Save to database after equipping
    this.saveEquipmentToDatabase(data.playerId);
  }

  private unequipItem(data: { playerId: string; slot: string }): void {
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
    console.log("[EquipmentSystem] 📤 Emitting INVENTORY_ITEM_ADDED:", {
      playerId: data.playerId,
      itemId: itemIdToAdd,
      quantity: 1,
    });
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

    // CRITICAL: Send equipment state to client
    console.log(
      "[EquipmentSystem] 📤 Sending equipment update to client after unequip",
    );
    if (this.world.isServer && this.world.network?.send) {
      const equipment = this.getPlayerEquipment(data.playerId);
      console.log("[EquipmentSystem] Equipment to send:", equipment);
      this.world.network.send("equipmentUpdated", {
        playerId: data.playerId,
        equipment,
      });
    }

    this.sendMessage(data.playerId, `Unequipped ${itemName}.`, "info");

    // Save to database after unequipping
    this.saveEquipmentToDatabase(data.playerId);
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
    const slots = [
      equipment.weapon,
      equipment.shield,
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.arrows,
    ].filter((slot): slot is EquipmentSlot => slot !== null);

    slots.forEach((slot) => {
      if (slot.item) {
        const bonuses = slot.item.bonuses || {};

        Object.keys(equipment.totalStats).forEach((stat) => {
          if (bonuses[stat]) {
            equipment.totalStats[stat as keyof typeof equipment.totalStats] +=
              bonuses[stat];
          }
        });
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

    // Check each specific skill requirement
    const skillChecks = [
      { skill: "attack" as const, required: requirements.attack },
      { skill: "strength" as const, required: requirements.strength },
      { skill: "defense" as const, required: requirements.defense },
      { skill: "ranged" as const, required: requirements.ranged },
      { skill: "constitution" as const, required: requirements.constitution },
    ];

    for (const { skill, required } of skillChecks) {
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
    // Check with inventory system via events
    const itemIdStr = itemId.toString();

    // Request item check from inventory system
    let hasItemResult = false;
    this.emitTypedEvent(EventType.INVENTORY_HAS_ITEM, {
      playerId: playerId,
      itemId: itemIdStr,
      callback: ((hasItem: boolean) => {
        hasItemResult = hasItem;
      }) as unknown,
    });

    if (hasItemResult) {
      return true;
    }

    // Also check if item is already equipped
    const equipment = this.playerEquipment.get(playerId);
    if (equipment) {
      const slots = [
        equipment.weapon,
        equipment.shield,
        equipment.helmet,
        equipment.body,
        equipment.legs,
        equipment.arrows,
      ].filter((slot): slot is EquipmentSlot => slot !== null);

      const isEquipped = slots.some(
        (slot) =>
          slot.itemId === parseInt(itemIdStr, 10) || slot.itemId === itemId,
      );
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

    // Get item data through centralized DataManager
    const itemIdStr = itemId.toString();
    const itemData = dataManager.getItem(itemIdStr);

    if (itemData) {
      return itemData;
    }

    const requirements = equipmentRequirements.getLevelRequirements(itemIdStr);
    if (requirements) {
      // Create basic item data for known equipment
      const itemType = this.inferItemTypeFromId(itemIdStr);
      const inferredBonuses =
        this.inferBonusesFromLevelRequirement(requirements);

      return {
        id: itemIdStr,
        name: this.formatItemName(itemIdStr),
        type: itemType.type as ItemType,
        quantity: 1,
        stackable: itemType.type === "ammunition",
        maxStackSize: itemType.type === "ammunition" ? 1000 : 1,
        value: 0,
        weight: 1,
        equipSlot: itemType.armorSlot
          ? (itemType.armorSlot as EquipmentSlotName)
          : null,
        weaponType: itemType.weaponType
          ? (itemType.weaponType as WeaponType)
          : WeaponType.NONE,
        equipable: true,
        attackType: itemType.type === ItemType.WEAPON ? AttackType.MELEE : null,
        description: `Equipment with requirements: ${equipmentRequirements.getRequirementText(itemIdStr)}`,
        examine: `Level requirements: ${equipmentRequirements.getRequirementText(itemIdStr)}`,
        tradeable: true,
        rarity: ItemRarity.COMMON,
        modelPath: "",
        iconPath: "",
        healAmount: 0,
        stats: {
          attack: inferredBonuses.attack || 0,
          defense: inferredBonuses.defense || 0,
          strength: inferredBonuses.strength || 0,
        },
        bonuses: {
          attack: inferredBonuses.attack,
          defense: inferredBonuses.defense,
          ranged: inferredBonuses.ranged,
          strength: inferredBonuses.strength,
        },
        requirements: {
          level: Math.max(
            requirements.attack,
            requirements.strength,
            requirements.defense,
            requirements.ranged,
            requirements.constitution,
          ),
          skills: {
            attack: requirements.attack,
            strength: requirements.strength,
            defense: requirements.defense,
            ranged: requirements.ranged,
            constitution: requirements.constitution,
          },
        },
      };
    }

    return null;
  }

  private inferItemTypeFromId(itemId: string): {
    type: string;
    weaponType?: string;
    armorSlot?: string;
  } {
    const id = itemId.toLowerCase();

    if (id.includes("sword") || id.includes("bow")) {
      return {
        type: "weapon",
        weaponType: id.includes("bow") ? AttackType.RANGED : AttackType.MELEE,
      };
    }

    if (id.includes("shield")) {
      return {
        type: "armor",
        armorSlot: "shield",
      };
    }

    if (id.includes("helmet")) {
      return {
        type: "armor",
        armorSlot: "helmet",
      };
    }

    if (id.includes("body")) {
      return {
        type: "armor",
        armorSlot: "body",
      };
    }

    if (id.includes("legs")) {
      return {
        type: "armor",
        armorSlot: "legs",
      };
    }

    if (id.includes("arrow")) {
      return {
        type: "arrow",
      };
    }

    return { type: "unknown" };
  }

  private formatItemName(itemId: string): string {
    return itemId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private inferBonusesFromLevelRequirement(
    requirements: LevelRequirement,
  ): ItemBonuses {
    // Infer combat bonuses from level requirements
    // Higher requirements typically mean better stats
    return {
      attack: Math.floor(requirements.attack * 0.8),
      defense: Math.floor(requirements.defense * 0.8),
      ranged: Math.floor(requirements.ranged * 0.8),
      strength: Math.floor(requirements.strength * 0.6),
    };
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

  // Public API
  getPlayerEquipment(playerId: string): PlayerEquipment | undefined {
    return this.playerEquipment.get(playerId);
  }

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

  isItemEquipped(playerId: string, itemId: number): boolean {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return false;

    const slots = [
      equipment.weapon,
      equipment.shield,
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.arrows,
    ].filter((slot): slot is EquipmentSlot => slot !== null);

    return slots.some((slot) => slot.itemId === itemId);
  }

  canEquipItem(playerId: string, itemId: number): boolean {
    const itemData = this.getItemData(itemId);
    if (!itemData) return false;

    const equipSlot = this.getEquipmentSlot(itemData);
    if (!equipSlot) return false;

    return this.meetsLevelRequirements(playerId, itemData);
  }

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

  public consumeArrow(playerId: string): boolean {
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
          this.unequipItem({ playerId, slot: "arrows" });
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
   * Get equipment color based on material
   */
  private getEquipmentColor(item: Item): number {
    const nameLower = (item.name as string)?.toLowerCase() || "";

    return (
      equipmentRequirements.getEquipmentColor(nameLower) ??
      equipmentRequirements.getDefaultColorByType(item.type as string)
    );
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
    Object.entries(attachmentPoints).forEach(([slotName, attachment]) => {
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
    });
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

  destroy(): void {
    // Stop auto-save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    // Final save before shutdown
    if (this.world.isServer && this.databaseSystem) {
      for (const playerId of this.playerEquipment.keys()) {
        this.saveEquipmentToDatabase(playerId);
      }
    }

    // Clear all player equipment data
    this.playerEquipment.clear();

    // Call parent cleanup
    super.destroy();
  }
}
