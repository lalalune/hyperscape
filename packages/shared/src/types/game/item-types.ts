/**
 * Item and Equipment Types
 * All item, inventory, and equipment-related type definitions
 */

import THREE from "../../extras/three/three";
import type { ItemRarity } from "../entities";
import type { Skills } from "../entities/entity-types";

// Item related enums
export enum WeaponType {
  SWORD = "sword",
  AXE = "axe",
  MACE = "mace",
  DAGGER = "dagger",
  SPEAR = "spear",
  BOW = "bow",
  CROSSBOW = "crossbow",
  STAFF = "staff",
  WAND = "wand",
  SHIELD = "shield",
  SCIMITAR = "scimitar",
  HALBERD = "halberd",
  NONE = "none",
}

export enum ItemType {
  WEAPON = "weapon",
  ARMOR = "armor",
  FOOD = "food",
  RESOURCE = "resource",
  TOOL = "tool",
  MISC = "misc",
  CURRENCY = "currency",
  CONSUMABLE = "consumable",
  AMMUNITION = "ammunition",
}

// Combat related enums
// MVP: Melee-only combat. Ranged/Magic deferred for future expansion.
export enum AttackType {
  MELEE = "melee",
  // RANGED = "ranged",  // Deferred: Re-add when implementing ranged combat
  // MAGIC = "magic",    // Deferred: Re-add when implementing magic combat
}

// Equipment slot type enum - use this consistently
export enum EquipmentSlotName {
  WEAPON = "weapon",
  SHIELD = "shield",
  HELMET = "helmet",
  BODY = "body",
  LEGS = "legs",
  BOOTS = "boots",
  GLOVES = "gloves",
  CAPE = "cape",
  AMULET = "amulet",
  RING = "ring",
  ARROWS = "arrows",
}

// Type alias for equipment slot values - use this for type safety
export type EquipmentSlotType = `${EquipmentSlotName}`;

// Combat bonuses interface
export interface CombatBonuses {
  // Simple bonuses for backward compatibility
  attack?: number;
  defense?: number;
  ranged?: number;
  strength?: number;

  // Detailed combat bonuses
  attackStab?: number;
  attackSlash?: number;
  attackCrush?: number;
  attackRanged?: number;
  attackMagic?: number;
  defenseStab?: number;
  defenseSlash?: number;
  defenseCrush?: number;
  defenseRanged?: number;
  defenseMagic?: number;
  meleeStrength?: number;
  rangedStrength?: number;
  magicDamage?: number;
  prayer?: number;
  prayerBonus?: number;
}

// Simple item bonuses interface for equipment
export interface ItemBonuses {
  attack?: number;
  defense?: number;
  ranged?: number;
  strength?: number;
}

// Item stats interface
export interface ItemStats {
  attackStab?: number;
  attackSlash?: number;
  attackCrush?: number;
  attackRanged?: number;
  attackMagic?: number;
  defenseStab?: number;
  defenseSlash?: number;
  defenseCrush?: number;
  defenseRanged?: number;
  defenseMagic?: number;
  strength?: number;
  prayer?: number;
  weight?: number;
}

export interface ItemRequirement {
  level?: number;
  attack?: number;
  strength?: number;
  defense?: number;
  ranged?: number;
  skill?: string;
}

// Item types
export interface Item {
  id: string; // Unique item ID (e.g., "bronze_sword", "cooked_fish")
  name: string; // Display name
  type: ItemType; // Item category

  // Inventory properties - optional, DataManager provides defaults
  quantity?: number; // Default: 1
  stackable?: boolean; // Default: false
  maxStackSize?: number; // Default: 1 (only specify for stackable items)
  value?: number; // Default: 0
  weight?: number; // Default: 0.1

  // Equipment properties - optional, only needed for equipable items
  equipSlot?: EquipmentSlotName | "2h" | null; // Default: null (not equipable)
  weaponType?: WeaponType | null; // Default: null
  equipable?: boolean; // Default: false (derived from equipSlot if not specified)
  attackType?: AttackType | null; // Default: null
  attackSpeed?: number; // Attack speed in game ticks (OSRS-style: 4 = standard sword)
  attackRange?: number; // Attack range in tiles (1 = adjacent melee, 2 = halberd, 7+ = ranged)
  is2h?: boolean; // Explicit flag for 2-handed weapons (alternative to equipSlot: '2h')

  // Item properties
  description: string; // Item description
  examine: string; // Examine text
  tradeable: boolean; // Can be traded
  rarity: ItemRarity; // ItemRarity tier

  // Visual assets
  modelPath: string | null; // 3D model path for DROPPED items (null if no model exists yet)
  equippedModelPath?: string | null; // 3D model path for EQUIPPED items (hand-held weapons)
  iconPath: string; // UI icon path

  // Consumable properties - only for food/consumables
  healAmount?: number; // Health restored when consumed

  // Combat bonuses (for equipment) - optional for non-equipment items
  bonuses?: CombatBonuses;

  // Requirements to use/equip - optional, default: no requirements
  requirements?: {
    level: number;
    skills: Partial<Record<keyof Skills, number>>;
  };

  // === BANK NOTE SYSTEM ===
  /**
   * Can this item be converted to a bank note?
   * Auto-derived if not specified: tradeable && !stackable && type !== currency
   */
  noteable?: boolean;

  /**
   * ID of the noted version of this item.
   * Only present on BASE items (e.g., "logs" has notedItemId: "logs_noted")
   * Set automatically by NoteGenerator at runtime.
   */
  notedItemId?: string;

  /**
   * ID of the base (unnoted) version of this item.
   * Only present on NOTED items (e.g., "logs_noted" has baseItemId: "logs")
   * Set automatically by NoteGenerator at runtime.
   */
  baseItemId?: string;

  /**
   * True if this item IS a bank note.
   * Noted items are always stackable and cannot be equipped/consumed.
   */
  isNoted?: boolean;
}

export interface EquipmentSlot {
  id: string;
  name: string;
  slot: EquipmentSlotName;
  itemId: string | number | null;
  item: Item | null;
  visualMesh?: THREE.Object3D | THREE.Mesh;
}

export interface Equipment {
  weapon: EquipmentSlot | null;
  shield: EquipmentSlot | null;
  helmet: EquipmentSlot | null;
  body: EquipmentSlot | null;
  legs: EquipmentSlot | null;
  boots: EquipmentSlot | null;
  gloves: EquipmentSlot | null;
  cape: EquipmentSlot | null;
  amulet: EquipmentSlot | null;
  ring: EquipmentSlot | null;
  arrows: EquipmentSlot | null;
}

// Inventory item with full item data (used by InventorySystem)
export interface InventorySlotItem {
  slot: number;
  itemId: string;
  quantity: number;
  item: Item;
}

export type StoreItemCategory =
  | "tools"
  | "ammunition"
  | "consumables"
  | "weapons"
  | "armor";

// Store types
export interface StoreItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  description: string;
  category: StoreItemCategory;
  stockQuantity: number; // -1 for unlimited
  restockTime: number; // 0 for no restock
}

export interface Store {
  id: string;
  name: string;
  /** @deprecated Position comes from the NPC entity, not the store */
  position?: { x: number; y: number; z: number };
  items: StoreItem[];
  npcName: string;
  buyback: boolean;
  buybackRate: number; // 0-1 percentage
}

// Banking types
export interface BankItem {
  id: string;
  name: string;
  quantity: number;
  stackable: boolean;
}

// Starting items
export interface StartingItem {
  id: string;
  name: string;
  quantity: number;
  stackable: boolean;
  equipped: boolean; // Whether to auto-equip on spawn
  slot: EquipmentSlotName | null;
}

// Equipment requirements
export interface LevelRequirement {
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  constitution: number;
}

export interface EquipmentDataJSON {
  levelRequirements: {
    weapons: Record<string, LevelRequirement>;
    shields: Record<string, LevelRequirement>;
    armor: {
      helmets: Record<string, LevelRequirement>;
      body: Record<string, LevelRequirement>;
      legs: Record<string, LevelRequirement>;
    };
    ammunition: Record<string, LevelRequirement>;
  };
  equipmentColors: Record<string, string>;
  starterEquipment: Array<{
    itemId: string;
    slot: string;
    autoEquip: boolean;
  }>;
}

export interface StarterEquipmentItem {
  itemId: string;
  slot: string;
  autoEquip: boolean;
}

// Item Action System types
export interface ItemAction {
  id: string;
  label: string;
  callback: (playerId: string, itemId: string, slot: number | null) => void;
  priority: number; // Lower number = higher priority in menu
  condition: ((item: Item, playerId: string) => boolean) | null;
}

export interface ItemContextMenu {
  playerId: string;
  itemId: string;
  slot: number | null;
  actions: ItemAction[];
  position: { x: number; y: number };
  visible: boolean;
}

// Ground items
export interface GroundItem {
  id: string;
  item: Item;
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  droppedBy: string | null;
  droppedAt: number;
  despawnTime: number;
}

// === BANK NOTE TYPE GUARDS ===

/**
 * Type guard: Check if item can be noted (has noted variant)
 */
export function isNoteableItem(
  item: Item,
): item is Item & { noteable: true; notedItemId: string } {
  return item.noteable === true && typeof item.notedItemId === "string";
}

/**
 * Type guard: Check if item IS a note (has base item reference)
 */
export function isNotedItem(
  item: Item,
): item is Item & { isNoted: true; baseItemId: string } {
  return item.isNoted === true && typeof item.baseItemId === "string";
}
