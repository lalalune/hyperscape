/**
 * OSRS Prayer Database Interface
 * Root structure for the prayers-complete.json file
 * @see https://github.com/osrsbox/osrsbox-db
 */

import type { Prayer } from './Prayer'

/**
 * The complete prayer database
 * Key is the prayer ID as a string, value is the Prayer object
 */
export interface PrayerDatabase {
  [prayerId: string]: Prayer
}

/**
 * Helper type to get all prayer IDs
 */
export type PrayerId = string

/**
 * Helper function type for querying prayers
 */
export type PrayerQuery<T = Prayer> = (prayer: Prayer) => T | undefined

/**
 * Helper function type for filtering prayers
 */
export type PrayerFilter = (prayer: Prayer) => boolean
