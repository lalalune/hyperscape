/**
 * OSRS Item Interface
 * Extracted from osrsbox-db items-complete.json
 * @see https://github.com/osrsbox/osrsbox-db
 */

import type { ItemEquipment } from './ItemEquipment'
import type { ItemWeapon } from './ItemWeapon'

export interface Item {
  // Basic Information
  /** Unique item ID */
  id: number

  /** Item name */
  name: string

  /** Last update date (YYYY-MM-DD format) */
  last_updated: string

  /** Whether the item data is incomplete */
  incomplete: boolean

  /** Whether the item is members-only */
  members: boolean

  /** Whether the item can be traded to other players */
  tradeable: boolean

  /** Whether the item can be traded on the Grand Exchange */
  tradeable_on_ge: boolean

  /** Whether the item is stackable */
  stackable: boolean

  /** Stack size if pre-stacked (e.g., rune packs) */
  stacked: number | null

  /** Whether this is the noted version of an item */
  noted: boolean

  /** Whether the item can be noted */
  noteable: boolean

  /** Linked item ID (normal/noted/placeholder relationships) */
  linked_id_item: number | null

  /** Linked noted item ID */
  linked_id_noted: number | null

  /** Linked placeholder item ID */
  linked_id_placeholder: number | null

  /** Whether this is a placeholder item */
  placeholder: boolean

  /** Whether the item can be equipped */
  equipable: boolean

  /** Whether the item can be equipped by a player */
  equipable_by_player: boolean

  /** Whether the item is an equipable weapon */
  equipable_weapon: boolean

  /** Store cost in coins */
  cost: number

  /** Low alchemy value */
  lowalch: number | null

  /** High alchemy value */
  highalch: number | null

  /** Item weight in kg */
  weight: number | null

  /** Grand Exchange buy limit per 4 hours */
  buy_limit: number | null

  /** Whether this is a quest item */
  quest_item: boolean

  /** Release date (YYYY-MM-DD format) */
  release_date: string | null

  /** Whether this is a duplicate entry */
  duplicate: boolean

  /** Examine text */
  examine: string | null

  /** Icon filename */
  icon: string

  /** Wiki page name */
  wiki_name: string | null

  /** Wiki URL */
  wiki_url: string | null

  // Equipment Stats (only present if equipable is true)
  /** Equipment bonuses and requirements */
  equipment?: ItemEquipment

  // Weapon Stats (only present if equipable_weapon is true)
  /** Weapon-specific stats */
  weapon?: ItemWeapon
}
