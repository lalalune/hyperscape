/**
 * OSRS Monster Drop Interface
 * Extracted from osrsbox-db monsters-complete.json
 * @see https://github.com/osrsbox/osrsbox-db
 */

export interface MonsterDrop {
  /** Item ID */
  id: number

  /** Item name */
  name: string

  /** Whether the item is members-only */
  members: boolean

  /** Quantity dropped (can be a range like "1-3" or single value like "1") */
  quantity: string

  /** Whether the drop is noted */
  noted: boolean

  /** Drop rarity (probability) */
  rarity: number

  /** Number of rolls for this drop */
  rolls: number
}
