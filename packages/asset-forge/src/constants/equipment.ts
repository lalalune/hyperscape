import { Sword, Shield, HardHat, Box, Shirt, LucideIcon } from 'lucide-react'

export interface EquipmentSlot {
  id: string
  name: string
  icon: LucideIcon
  bone: string
  description?: string
}

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  { id: 'Hand_R', name: 'Right Hand', icon: Sword, bone: 'Hand_R', description: 'Weapons, tools, and held items' },
  { id: 'Hand_L', name: 'Left Hand', icon: Shield, bone: 'Hand_L', description: 'Shields and off-hand items' },
  { id: 'Head', name: 'Head', icon: HardHat, bone: 'Head', description: 'Helmets and headgear' },
  { id: 'Spine2', name: 'Chest', icon: Shirt, bone: 'Spine2', description: 'Body armor and clothing' },
  { id: 'Hips', name: 'Legs', icon: Box, bone: 'Hips', description: 'Leg armor and pants' },
] as const

// Equipment types
export const EQUIPMENT_TYPES = {
  weapon: 'weapon',
  armor: 'armor',
  shield: 'shield',
} as const

// Weapon subtypes
export const WEAPON_SUBTYPES = {
  sword: 'sword',
  axe: 'axe',
  mace: 'mace',
  spear: 'spear',
  bow: 'bow',
  staff: 'staff',
  dagger: 'dagger',
  crossbow: 'crossbow',
  shield: 'shield',
  wand: 'wand',
} as const

export type EquipmentType = typeof EQUIPMENT_TYPES[keyof typeof EQUIPMENT_TYPES]
export type WeaponSubtype = typeof WEAPON_SUBTYPES[keyof typeof WEAPON_SUBTYPES]

// Weapon size constraints (in meters)
// Minimum weapon sizes to maintain visibility
export const MIN_WEAPON_SIZES: Record<string, number> = {
  sword: 0.5,
  dagger: 0.15,
  axe: 0.3,
  mace: 0.3,
  staff: 0.8,
  spear: 1.0,
  bow: 0.5,
  crossbow: 0.4,
  shield: 0.3,
  wand: 0.1,
} as const

// Maximum weapon sizes for game balance
export const MAX_WEAPON_SIZES: Record<string, number> = {
  sword: 3.0,
  dagger: 0.8,
  axe: 2.5,
  mace: 2.0,
  staff: 5.0,
  spear: 7.0,
  bow: 3.0,
  crossbow: 2.0,
  shield: 3.0,
  wand: 1.0,
} as const

// Weapon type proportions for medium (human-sized) creatures
// Values represent percentage of creature height
export const BASE_WEAPON_PROPORTIONS: Record<string, number> = {
  sword: 0.65,      // 65% of height
  dagger: 0.25,     // 25% of height
  axe: 0.5,         // 50% of height
  mace: 0.45,       // 45% of height
  staff: 1.1,       // 110% of height
  spear: 1.2,       // 120% of height
  bow: 0.7,         // 70% of height
  crossbow: 0.5,    // 50% of height
  shield: 0.4,      // 40% of height
  wand: 0.2,        // 20% of height
} as const 