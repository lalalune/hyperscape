/**
 * OSRS Interfaces
 * TypeScript interfaces extracted from osrsbox-db
 * @see https://github.com/osrsbox/osrsbox-db
 */

// Monster Drop
export type { MonsterDrop } from './MonsterDrop'

// Monster
export type {
  Monster,
  AttackType,
  SlayerMaster,
  MonsterAttribute
} from './Monster'

// Monster Database
export type {
  MonsterDatabase,
  MonsterId,
  MonsterQuery,
  MonsterFilter
} from './MonsterDatabase'

// Item
export type { Item } from './Item'

// Item Equipment
export type {
  ItemEquipment,
  EquipmentSlot
} from './ItemEquipment'

// Item Weapon
export type {
  ItemWeapon,
  WeaponType,
  WeaponStance
} from './ItemWeapon'

// Item Database
export type {
  ItemDatabase,
  ItemId,
  ItemQuery,
  ItemFilter
} from './ItemDatabase'

// Prayer
export type {
  Prayer,
  PrayerRequirements,
  PrayerBonuses
} from './Prayer'

// Prayer Database
export type {
  PrayerDatabase,
  PrayerId,
  PrayerQuery,
  PrayerFilter
} from './PrayerDatabase'
