/**
 * OSRS Item Equipment Interface
 * Equipment stats and requirements for equipable items
 * @see https://github.com/osrsbox/osrsbox-db
 */

/**
 * Equipment slots in OSRS
 * Note: '2h' indicates a two-handed weapon (occupies weapon slot, prevents shield)
 */
export type EquipmentSlot = '2h' | 'ammo' | 'body' | 'cape' | 'feet' | 'hands' | 'head' | 'legs' | 'neck' | 'ring' | 'shield' | 'weapon'

export interface ItemEquipment {
  /** Stab attack bonus */
  attack_stab: number

  /** Slash attack bonus */
  attack_slash: number

  /** Crush attack bonus */
  attack_crush: number

  /** Magic attack bonus */
  attack_magic: number

  /** Ranged attack bonus */
  attack_ranged: number

  /** Stab defence bonus */
  defence_stab: number

  /** Slash defence bonus */
  defence_slash: number

  /** Crush defence bonus */
  defence_crush: number

  /** Magic defence bonus */
  defence_magic: number

  /** Ranged defence bonus */
  defence_ranged: number

  /** Melee strength bonus */
  melee_strength: number

  /** Ranged strength bonus */
  ranged_strength: number

  /** Magic damage bonus (%) */
  magic_damage: number

  /** Prayer bonus */
  prayer: number

  /** Equipment slot */
  slot: EquipmentSlot

  /** Skill requirements to equip (e.g., { "attack": 60, "defence": 40 }) */
  requirements: Record<string, number> | null
}
