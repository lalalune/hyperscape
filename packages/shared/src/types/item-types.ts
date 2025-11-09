/**
 * Item and Equipment Types
 * All item, inventory, and equipment-related type definitions
 */

import THREE from "../extras/three";
import type { ItemRarity } from "./entities";
import type { Skills } from "./entity-types";

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
export enum AttackType {
  MELEE = "melee",
  RANGED = "ranged",
  MAGIC = "magic",
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
  quantity: number; // Quantity of the item
  stackable: boolean; // Can stack in inventory
  maxStackSize: number; // Max stack size (999 for stackable, 1 for non-stackable)
  value: number; // Base value in coins
  weight: number; // Item weight

  // Equipment properties
  equipSlot: EquipmentSlotName | "2h" | null; // Equipment slot (weapon, shield, helmet, etc.) or '2h' for two-handed
  weaponType: WeaponType | null; // Type of weapon (if applicable)
  equipable: boolean; // Can be equipped
  attackType: AttackType | null; // Type of attack (melee, ranged, magic)
  attackSpeed?: number; // Attack speed in milliseconds (for weapons)
  is2h?: boolean; // Explicit flag for 2-handed weapons (alternative to equipSlot: '2h')

  // Item properties
  description: string; // Item description
  examine: string; // Examine text
  tradeable: boolean; // Can be traded
  rarity: ItemRarity; // ItemRarity tier

  // Visual assets
  modelPath: string | null; // 3D model path (null if no model exists yet)
  iconPath: string; // UI icon path

  // Consumable properties
  healAmount: number; // Health restored (0 if not consumable)

  // Combat stats (for equipment)
  stats: {
    attack: number;
    defense: number;
    strength: number;
  };

  // Combat bonuses (for equipment)
  bonuses: CombatBonuses;

  // Requirements to use/equip
  requirements: {
    level: number;
    skills: Partial<Record<keyof Skills, number>>;
  };
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
  position: { x: number; y: number; z: number };
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
