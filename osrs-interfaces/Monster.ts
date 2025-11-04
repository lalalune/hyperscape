/**
 * OSRS Monster Interface
 * Extracted from osrsbox-db monsters-complete.json
 * @see https://github.com/osrsbox/osrsbox-db
 */

import type { MonsterDrop } from './MonsterDrop'

export type AttackType = 'melee' | 'magic' | 'ranged' | 'crush' | 'stab' | 'slash'

export type SlayerMaster = 'vannaka' | 'chaeldar' | 'konar' | 'nieve' | 'duradel' | 'krystilia' | 'turael' | 'mazchna'

export type MonsterAttribute = 'spectral' | 'undead' | 'demon' | 'dragon' | 'fiery' | 'leafy' | 'vampyre' | 'kalphite' | 'xerician'

export interface Monster {
  // Basic Information
  /** Unique monster ID */
  id: number

  /** Monster name */
  name: string

  /** Last update date (YYYY-MM-DD format) */
  last_updated: string

  /** Whether the monster data is incomplete */
  incomplete: boolean

  /** Whether the monster is members-only */
  members: boolean

  /** Release date (YYYY-MM-DD format) */
  release_date: string

  /** Whether this is a duplicate entry */
  duplicate: boolean

  /** Examine text */
  examine: string

  /** Wiki page name */
  wiki_name: string

  /** Wiki URL */
  wiki_url: string

  // Combat Stats
  /** Combat level */
  combat_level: number

  /** Monster size */
  size: number

  /** Hit points */
  hitpoints: number

  /** Maximum hit damage */
  max_hit: number

  /** Attack types used by the monster */
  attack_type: AttackType[]

  /** Attack speed (game ticks) */
  attack_speed: number

  /** Whether the monster is aggressive */
  aggressive: boolean

  /** Whether the monster is poisonous */
  poisonous: boolean

  /** Whether the monster is venomous */
  venomous: boolean

  /** Whether the monster is immune to poison */
  immune_poison: boolean

  /** Whether the monster is immune to venom */
  immune_venom: boolean

  // Classification
  /** Monster attributes (e.g., undead, demon) */
  attributes: MonsterAttribute[]

  /** Monster categories */
  category: string[]

  // Slayer Information
  /** Whether this is a slayer monster */
  slayer_monster: boolean

  /** Required slayer level */
  slayer_level: number | null

  /** Slayer XP awarded */
  slayer_xp: number | null

  /** Slayer masters who assign this monster */
  slayer_masters: SlayerMaster[]

  // Skill Levels
  /** Attack level */
  attack_level: number

  /** Strength level */
  strength_level: number

  /** Defence level */
  defence_level: number

  /** Magic level */
  magic_level: number

  /** Ranged level */
  ranged_level: number

  // Attack Bonuses
  /** Melee attack bonus */
  attack_bonus: number

  /** Melee strength bonus */
  strength_bonus: number

  /** Magic attack bonus */
  attack_magic: number

  /** Magic damage bonus */
  magic_bonus: number

  /** Ranged attack bonus */
  attack_ranged: number

  /** Ranged strength bonus */
  ranged_bonus: number

  // Defence Bonuses
  /** Stab defence */
  defence_stab: number

  /** Slash defence */
  defence_slash: number

  /** Crush defence */
  defence_crush: number

  /** Magic defence */
  defence_magic: number

  /** Ranged defence */
  defence_ranged: number

  // Drops
  /** Array of item drops */
  drops: MonsterDrop[]
}
