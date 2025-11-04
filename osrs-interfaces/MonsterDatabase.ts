/**
 * OSRS Monster Database Interface
 * Root structure for the monsters-complete.json file
 * @see https://github.com/osrsbox/osrsbox-db
 */

import type { Monster } from './Monster'

/**
 * The complete monster database
 * Key is the monster ID as a string, value is the Monster object
 */
export interface MonsterDatabase {
  [monsterId: string]: Monster
}

/**
 * Helper type to get all monster IDs
 */
export type MonsterId = string

/**
 * Helper function type for querying monsters
 */
export type MonsterQuery<T = Monster> = (monster: Monster) => T | undefined

/**
 * Helper function type for filtering monsters
 */
export type MonsterFilter = (monster: Monster) => boolean
