/**
 * OSRS Item Database Interface
 * Root structure for the items-complete.json file
 * @see https://github.com/osrsbox/osrsbox-db
 */

import type { Item } from './Item'

/**
 * The complete item database
 * Key is the item ID as a string, value is the Item object
 */
export interface ItemDatabase {
  [itemId: string]: Item
}

/**
 * Helper type to get all item IDs
 */
export type ItemId = string

/**
 * Helper function type for querying items
 */
export type ItemQuery<T = Item> = (item: Item) => T | undefined

/**
 * Helper function type for filtering items
 */
export type ItemFilter = (item: Item) => boolean
