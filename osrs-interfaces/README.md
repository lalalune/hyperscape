# OSRS Interfaces

TypeScript interfaces extracted from the [osrsbox-db](https://github.com/osrsbox/osrsbox-db) project.

## Source Data

- **Repository**: https://github.com/osrsbox/osrsbox-db
- **Data Files**:
  - `docs/monsters-complete.json`
  - `docs/items-complete.json`
  - `docs/prayers-complete.json`
- **Last Updated**: 2021-09-24 (per source data)

## Files

### Monster Interfaces
- `MonsterDrop.ts` - Interface for monster drop items
- `Monster.ts` - Interface for monster entities with all stats, bonuses, and properties
- `MonsterDatabase.ts` - Root database structure and helper types

### Item Interfaces
- `Item.ts` - Interface for item entities with all properties
- `ItemEquipment.ts` - Equipment stats and requirements
- `ItemWeapon.ts` - Weapon-specific stats and stances
- `ItemDatabase.ts` - Root database structure and helper types

### Prayer Interfaces
- `Prayer.ts` - Interface for prayer entities with bonuses and requirements
- `PrayerDatabase.ts` - Root database structure and helper types

### Exports
- `index.ts` - Central export file

## Usage

### Monsters

```typescript
import type { Monster, MonsterDatabase, MonsterDrop } from './osrs-interfaces'

// Load the monsters database
const monsters: MonsterDatabase = await fetch('monsters-complete.json').then(r => r.json())

// Access a specific monster by ID
const aberrantSpectre: Monster = monsters['2']

// Filter monsters by criteria
const slayerMonsters = Object.values(monsters).filter(m => m.slayer_monster && m.slayer_level! >= 60)

// Get all drops from a monster
const drops: MonsterDrop[] = aberrantSpectre.drops

// Find monsters by combat level
const highLevelMonsters = Object.values(monsters).filter(m => m.combat_level >= 100)
```

### Items

```typescript
import type { Item, ItemDatabase, ItemEquipment, ItemWeapon } from './osrs-interfaces'

// Load the items database
const items: ItemDatabase = await fetch('items-complete.json').then(r => r.json())

// Access a specific item by ID
const abyssalWhip: Item = items['4151']

// Filter equipable items
const weapons = Object.values(items).filter(i => i.equipable_weapon)

// Find items with requirements
const highLevelGear = Object.values(items).filter(i =>
  i.equipment?.requirements?.attack && i.equipment.requirements.attack >= 70
)

// Get weapon stats
if (abyssalWhip.weapon) {
  console.log('Attack speed:', abyssalWhip.weapon.attack_speed)
  console.log('Weapon type:', abyssalWhip.weapon.weapon_type)
  console.log('Stances:', abyssalWhip.weapon.stances)
}

// Find tradeable items on GE
const tradeableItems = Object.values(items).filter(i => i.tradeable_on_ge)

// Find quest items
const questItems = Object.values(items).filter(i => i.quest_item)
```

### Prayers

```typescript
import type { Prayer, PrayerDatabase } from './osrs-interfaces'

// Load the prayers database
const prayers: PrayerDatabase = await fetch('prayers-complete.json').then(r => r.json())

// Access a specific prayer by ID
const piety: Prayer = prayers['26']

// Filter prayers by level requirement
const highLevelPrayers = Object.values(prayers).filter(p =>
  p.requirements.prayer && p.requirements.prayer >= 70
)

// Get prayers with attack bonuses
const attackPrayers = Object.values(prayers).filter(p =>
  p.bonuses.attack && p.bonuses.attack > 0
)

// Find members-only prayers
const membersPrayers = Object.values(prayers).filter(p => p.members)

// Sort by drain rate
const sortedByDrain = Object.values(prayers).sort((a, b) =>
  a.drain_per_minute - b.drain_per_minute
)
```

## Monster Properties

### Basic Information
- `id` - Unique monster ID
- `name` - Monster name
- `combat_level` - Combat level
- `hitpoints` - HP
- `max_hit` - Maximum damage
- `examine` - Examine text

### Combat Stats
- `attack_level`, `strength_level`, `defence_level`
- `magic_level`, `ranged_level`
- `attack_type` - Array of attack types (melee, magic, ranged, etc.)
- `attack_speed` - Attack speed in game ticks

### Bonuses
- Attack bonuses: `attack_bonus`, `attack_magic`, `attack_ranged`
- Strength bonuses: `strength_bonus`, `magic_bonus`, `ranged_bonus`
- Defence bonuses: `defence_stab`, `defence_slash`, `defence_crush`, `defence_magic`, `defence_ranged`

### Slayer
- `slayer_monster` - Whether it's a slayer task monster
- `slayer_level` - Required slayer level
- `slayer_xp` - XP awarded
- `slayer_masters` - Which masters assign this monster

### Classification
- `attributes` - Monster attributes (undead, demon, dragon, etc.)
- `category` - Monster categories
- `aggressive` - Whether the monster is aggressive
- `poisonous` - Whether it poisons
- `venomous` - Whether it venoms

### Drops
- `drops` - Array of `MonsterDrop` objects with item ID, name, quantity, rarity, etc.

## Item Properties

### Basic Information
- `id` - Unique item ID
- `name` - Item name
- `examine` - Examine text
- `members` - Whether members-only
- `quest_item` - Whether it's a quest item

### Trading & Economy
- `tradeable` - Can be traded to players
- `tradeable_on_ge` - Can be traded on Grand Exchange
- `buy_limit` - GE buy limit per 4 hours
- `cost` - Store cost in coins
- `lowalch` / `highalch` - Alchemy values

### Item Properties
- `stackable` - Whether the item stacks
- `noted` - Whether this is the noted version
- `noteable` - Whether the item can be noted
- `weight` - Item weight in kg
- `equipable` - Whether it can be equipped
- `equipable_weapon` - Whether it's a weapon

### Equipment Stats (if equipable)
- Attack bonuses: `attack_stab`, `attack_slash`, `attack_crush`, `attack_magic`, `attack_ranged`
- Defence bonuses: `defence_stab`, `defence_slash`, `defence_crush`, `defence_magic`, `defence_ranged`
- Strength bonuses: `melee_strength`, `ranged_strength`, `magic_damage`
- `prayer` - Prayer bonus
- `slot` - Equipment slot (head, body, legs, weapon, shield, **2h**, etc.)
  - **Note:** `2h` indicates a two-handed weapon (prevents shield equip)
- `requirements` - Skill requirements to equip

### Weapon Stats (if equipable_weapon)
- `attack_speed` - Attack speed in game ticks
- `weapon_type` - Weapon category (sword, bow, staff, etc.)
- `stances` - Available combat stances

## Prayer Properties

### Basic Information
- `id` - Unique prayer ID
- `name` - Prayer name
- `description` - Prayer description
- `members` - Whether members-only
- `icon` - Icon filename
- `wiki_url` - Wiki URL

### Prayer Mechanics
- `drain_per_minute` - Prayer point drain rate per minute
- `requirements` - Skill requirements (prayer, defence)
- `bonuses` - Combat bonuses (attack, strength, defence, magic, ranged)

## Type Exports

### Monster Types
```typescript
// Main types
Monster
MonsterDrop
MonsterDatabase

// Helper types
AttackType = 'melee' | 'magic' | 'ranged' | 'crush' | 'stab' | 'slash'
SlayerMaster = 'vannaka' | 'chaeldar' | 'konar' | 'nieve' | 'duradel' | ...
MonsterAttribute = 'spectral' | 'undead' | 'demon' | 'dragon' | ...

// Utility types
MonsterId - String type for monster IDs
MonsterQuery<T> - Function type for querying monsters
MonsterFilter - Function type for filtering monsters
```

### Item Types
```typescript
// Main types
Item
ItemEquipment
ItemWeapon
ItemDatabase

// Helper types
EquipmentSlot = '2h' | 'ammo' | 'body' | 'cape' | 'feet' | 'hands' | 'head' | ...
WeaponType = 'axe' | 'bow' | 'crossbow' | 'sword' | 'staff' | 'whip' | ...
WeaponStance = 'accurate' | 'aggressive' | 'controlled' | 'defensive' | ...

// Utility types
ItemId - String type for item IDs
ItemQuery<T> - Function type for querying items
ItemFilter - Function type for filtering items
```

### Prayer Types
```typescript
// Main types
Prayer
PrayerRequirements
PrayerBonuses
PrayerDatabase

// Utility types
PrayerId - String type for prayer IDs
PrayerQuery<T> - Function type for querying prayers
PrayerFilter - Function type for filtering prayers
```

## Examples

### Monster Examples

#### Find All Demons
```typescript
const demons = Object.values(monsters).filter(m =>
  m.attributes.includes('demon')
)
```

#### Get Monsters by Slayer Master
```typescript
const nieveMonsters = Object.values(monsters).filter(m =>
  m.slayer_masters.includes('nieve')
)
```

#### Find High-Value Drops
```typescript
const monstersWithRareDrops = Object.values(monsters).filter(m =>
  m.drops.some(drop => drop.rarity < 0.001)
)
```

#### Get All Members-Only Monsters
```typescript
const membersMonsters = Object.values(monsters).filter(m => m.members)
```

### Item Examples

#### Find All Dragon Equipment
```typescript
const dragonGear = Object.values(items).filter(i =>
  i.name.includes('Dragon') && i.equipable
)
```

#### Get Weapons by Type
```typescript
const bows = Object.values(items).filter(i =>
  i.weapon?.weapon_type === 'bow'
)
```

#### Find Items with High Alch Value
```typescript
const profitableAlchs = Object.values(items).filter(i =>
  i.highalch && i.cost && (i.highalch - i.cost) > 1000
)
```

#### Get All Stackable Items
```typescript
const stackables = Object.values(items).filter(i => i.stackable)
```

#### Find Items by Equipment Slot
```typescript
const helmets = Object.values(items).filter(i =>
  i.equipment?.slot === 'head'
)
```

#### Get Items with Level Requirements
```typescript
const tier70Items = Object.values(items).filter(i => {
  const reqs = i.equipment?.requirements
  return reqs && Object.values(reqs).some(level => level === 70)
})
```

### Prayer Examples

#### Find Overhead Prayers
```typescript
const overheadPrayers = Object.values(prayers).filter(p =>
  p.name.includes('Protect from') || p.name.includes('Retribution')
)
```

#### Get Prayers by Bonus Type
```typescript
const strengthPrayers = Object.values(prayers).filter(p =>
  p.bonuses.strength && p.bonuses.strength > 0
)
```

#### Find Low Drain Prayers
```typescript
const lowDrainPrayers = Object.values(prayers).filter(p =>
  p.drain_per_minute <= 10
)
```

#### Get Free-to-Play Prayers
```typescript
const f2pPrayers = Object.values(prayers).filter(p => !p.members)
```

#### Find Prayers with Defence Requirements
```typescript
const knightPrayers = Object.values(prayers).filter(p =>
  p.requirements.defence && p.requirements.defence > 0
)
```

## License

This project uses data from [osrsbox-db](https://github.com/osrsbox/osrsbox-db) which is licensed under GPL-3.0.

The OSRS data is property of Jagex Ltd. and is used for non-commercial purposes.
