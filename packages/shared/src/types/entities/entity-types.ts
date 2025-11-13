/**
 * Entity and Component Types
 * ECS (Entity Component System) type definitions
 */

import THREE from "../../extras/three/three";
import type { Position3D } from "../core/base-types";
import type { EntityData as BaseEntityData } from "../core/base-types";

// Skill structure with level and experience
export interface SkillData {
  level: number;
  xp: number;
}

// Complete skills set
export interface Skills {
  attack: SkillData;
  strength: SkillData;
  defense: SkillData;
  constitution: SkillData;
  ranged: SkillData;
  woodcutting: SkillData;
  fishing: SkillData;
  firemaking: SkillData;
  cooking: SkillData;
}

// Component data map - strongly typed, no optionals
export interface ComponentDataMap {
  transform: {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    scale: [number, number, number];
  };
  physics: {
    type: "static" | "kinematic" | "dynamic";
    mass: number;
    friction: number;
    restitution: number;
  };
  health: {
    current: number;
    maximum: number;
  };
  inventory: {
    items: Array<{
      id: string;
      itemId: string;
      quantity: number;
      slot: number;
    }>;
    capacity: number;
  };
  combat: {
    attackLevel: number;
    strengthLevel: number;
    defenseLevel: number;
    constitutionLevel: number;
    rangeLevel: number;
    inCombat: boolean;
    target: string | null;
  };
  skills: {
    woodcutting: number;
    fishing: number;
    firemaking: number;
    cooking: number;
  };
}

// Entity data extends core EntityData
export interface EntityData extends BaseEntityData {
  components: Partial<ComponentDataMap>;
  userData: {
    rpgData: {
      playerId: string;
      characterName: string;
      level: number;
      experience: number;
    };
  };
  health: number;
}

// Inventory item type
export interface InventoryItem {
  id: string; // Unique instance ID (e.g., for unstackable items)
  itemId: string; // Reference to the base Item
  quantity: number; // How many of this item
  slot: number; // Inventory slot position
  metadata: Record<string, number | string | boolean> | null; // Instance-specific data (e.g., durability, enchantments)
}

// Component interfaces for ECS system
export interface InventoryComponent {
  items: InventoryItem[];
  capacity: number;
  coins: number;
}

export interface StatsComponent {
  combatLevel: number;
  level: number;
  health: { current: number; max: number };
  attack: SkillData;
  strength: SkillData;
  defense: SkillData;
  constitution: SkillData;
  ranged: SkillData;
  magic: SkillData;
  prayer: { level: number; points: number };
  woodcutting: SkillData;
  fishing: SkillData;
  firemaking: SkillData;
  cooking: SkillData;
  activePrayers: {
    protectFromMelee: boolean;
    protectFromRanged: boolean;
    protectFromMagic: boolean;
    piety: boolean;
    chivalry: boolean;
    ultimateStrength: boolean;
    superhumanStrength: boolean;
    burstOfStrength: boolean;
    rigour: boolean;
    eagleEye: boolean;
    hawkEye: boolean;
    sharpEye: boolean;
    augury: boolean;
    mysticMight: boolean;
    mysticLore: boolean;
    mysticWill: boolean;
  };
  equipment: {
    weapon: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    shield: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    helmet: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    body: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    legs: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    boots: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    gloves: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    cape: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    amulet: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
    ring: {
      id: string;
      name: string;
      slot: string;
      itemId: string | number | null;
      item: unknown | null;
      visualMesh?: THREE.Object3D | THREE.Mesh;
    } | null;
  };
  equippedSpell: string | null;
  effects: {
    onSlayerTask: boolean;
    targetIsDragon: boolean;
    targetMagicLevel: number;
  };
  combatBonuses: {
    attack?: number;
    defense?: number;
    ranged?: number;
    strength?: number;
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
  };
}

export interface NPCComponent {
  behavior:
    | "aggressive"
    | "defensive"
    | "passive"
    | "friendly"
    | "patrol"
    | "wander";
  state:
    | "idle"
    | "wandering"
    | "chasing"
    | "combat"
    | "attacking"
    | "fleeing"
    | "patrolling";
  currentTarget: string | null;
  spawnPoint: Position3D;
  wanderRadius: number;
  aggroRange: number;
  isHostile: boolean;
  combatLevel: number;
  aggressionLevel: number;
  dialogueLines: string[];
  dialogue: string | null;
  services: string[];
}

export interface PrayerComponent {
  protectFromMelee: boolean;
  protectFromRanged: boolean;
  protectFromMagic: boolean;
  // Melee strength prayers
  piety: boolean;
  chivalry: boolean;
  ultimateStrength: boolean;
  superhumanStrength: boolean;
  burstOfStrength: boolean;
  // Ranged strength prayers
  rigour: boolean;
  eagleEye: boolean;
  hawkEye: boolean;
  sharpEye: boolean;
  // Magic damage prayers
  augury: boolean;
  mysticMight: boolean;
  mysticLore: boolean;
  mysticWill: boolean;
}

export interface EquipmentComponent {
  weapon: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  shield: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  helmet: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  body: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  legs: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  boots: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  gloves: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  cape: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  amulet: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
  ring: {
    id: string;
    name: string;
    slot: string;
    itemId: string | number | null;
    item: unknown | null;
    visualMesh?: THREE.Object3D | THREE.Mesh;
  } | null;
}

export interface MeshUserData {
  entityId: string;
  type: "mob" | "npc" | "resource" | "item" | "player" | "static";
  name: string;
  interactable: boolean;
  interactionDistance?: number;
  interactionType?: string;
  mobData: {
    id: string;
    name: string;
    type: string;
    level: number;
    health: number;
    maxHealth: number;
  } | null;
  itemData?: {
    id?: string;
    itemId?: string;
    name?: string;
    type?: string;
    quantity?: number;
    [key: string]: unknown;
  };
}

// Inventory with full data
export interface Inventory {
  items: InventoryItem[];
  capacity: number;
  coins: number;
}

// Inventory data state
export interface InventoryDataState {
  items: InventoryItem[];
  coins: number;
  maxSlots: number;
}
