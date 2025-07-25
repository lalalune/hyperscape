import { 
  RPGItem, 
  ItemType, 
  WeaponType, 
  ArmorSlot, 
  RPGSkill,
  ItemRequirement
} from '../types/index'

// Re-export types and enums for consumers
export { ItemType, WeaponType, ArmorSlot, RPGSkill } from '../types/index'
export type { RPGItem, ItemRequirement } from '../types/index'

// RPG Item Database
export const RPG_ITEMS: Map<string, RPGItem> = new Map([
  // Currency
  ['coins', {
    id: 'coins',
    name: 'Coins',
    description: 'The universal currency of Hyperia',
    type: ItemType.CURRENCY,
    stackable: true,
    maxStack: 2147483647,
    value: 1,
    weight: 0,
    iconPath: '/icons/coins.png'
  }],

  // Weapons - Swords
  ['bronze_sword', {
    id: 'bronze_sword',
    name: 'Bronze Sword',
    description: 'A basic sword made of bronze',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 100,
    weight: 2,
    requirements: { attack: 1 },
    bonuses: { attack: 4, strength: 3 },
    weaponType: WeaponType.SWORD,
    modelPath: '/assets/models/weapons/bronze_sword.glb',
    iconPath: '/icons/bronze_sword.png'
  }],

  ['steel_sword', {
    id: 'steel_sword',
    name: 'Steel Sword',
    description: 'A sturdy sword made of steel',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 500,
    weight: 3,
    requirements: { attack: 10 },
    bonuses: { attack: 12, strength: 10 },
    weaponType: WeaponType.SWORD,
    modelPath: '/assets/models/weapons/steel_sword.glb',
    iconPath: '/icons/steel_sword.png'
  }],

  ['mithril_sword', {
    id: 'mithril_sword',
    name: 'Mithril Sword',
    description: 'A legendary sword made of mithril',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 2000,
    weight: 2,
    requirements: { attack: 20 },
    bonuses: { attack: 25, strength: 22 },
    weaponType: WeaponType.SWORD,
    modelPath: '/assets/models/weapons/mithril_sword.glb',
    iconPath: '/icons/mithril_sword.png'
  }],

  // Weapons - Bows
  ['wood_bow', {
    id: 'wood_bow',
    name: 'Wood Bow',
    description: 'A simple bow made of wood',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 80,
    weight: 1,
    requirements: { ranged: 1 },
    bonuses: { ranged: 5 },
    weaponType: WeaponType.BOW,
    modelPath: '/assets/models/weapons/wood_bow.glb',
    iconPath: '/icons/wood_bow.png'
  }],

  ['oak_bow', {
    id: 'oak_bow',
    name: 'Oak Bow',
    description: 'A sturdy bow made of oak',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 400,
    weight: 1,
    requirements: { ranged: 10 },
    bonuses: { ranged: 15 },
    weaponType: WeaponType.BOW,
    modelPath: '/assets/models/weapons/oak_bow.glb',
    iconPath: '/icons/oak_bow.png'
  }],

  ['willow_bow', {
    id: 'willow_bow',
    name: 'Willow Bow',
    description: 'A fine bow made of willow',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 1500,
    weight: 1,
    requirements: { ranged: 20 },
    bonuses: { ranged: 30 },
    weaponType: WeaponType.BOW,
    modelPath: '/assets/models/weapons/willow_bow.glb',
    iconPath: '/icons/willow_bow.png'
  }],

  // Shields
  ['bronze_shield', {
    id: 'bronze_shield',
    name: 'Bronze Shield',
    description: 'A basic shield made of bronze',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 80,
    weight: 3,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 5 },
    weaponType: WeaponType.SHIELD,
    modelPath: '/assets/models/weapons/bronze_shield.glb',
    iconPath: '/icons/bronze_shield.png'
  }],

  ['steel_shield', {
    id: 'steel_shield',
    name: 'Steel Shield',
    description: 'A sturdy shield made of steel',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 400,
    weight: 4,
    requirements: { defense: 10 },
    bonuses: { defense: 15 },
    weaponType: WeaponType.SHIELD,
    modelPath: '/assets/models/weapons/steel_shield.glb',
    iconPath: '/icons/steel_shield.png'
  }],

  ['mithril_shield', {
    id: 'mithril_shield',
    name: 'Mithril Shield',
    description: 'A legendary shield made of mithril',
    type: ItemType.WEAPON,
    stackable: false,
    maxStack: 1,
    value: 1800,
    weight: 3,
    requirements: { defense: 20 },
    bonuses: { defense: 30 },
    weaponType: WeaponType.SHIELD,
    modelPath: '/assets/models/weapons/mithril_shield.glb',
    iconPath: '/icons/mithril_shield.png'
  }],

  // Armor - Helmets
  ['bronze_helmet', {
    id: 'bronze_helmet',
    name: 'Bronze Helmet',
    description: 'A basic helmet made of bronze',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 60,
    weight: 2,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 3 },
    armorSlot: ArmorSlot.HELMET,
    modelPath: '/assets/models/armor/bronze_helmet.glb',
    iconPath: '/icons/bronze_helmet.png'
  }],

  ['steel_helmet', {
    id: 'steel_helmet',
    name: 'Steel Helmet',
    description: 'A sturdy helmet made of steel',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 300,
    weight: 3,
    requirements: { defense: 10 },
    bonuses: { defense: 8 },
    armorSlot: ArmorSlot.HELMET,
    modelPath: '/assets/models/armor/steel_helmet.glb',
    iconPath: '/icons/steel_helmet.png'
  }],

  ['mithril_helmet', {
    id: 'mithril_helmet',
    name: 'Mithril Helmet',
    description: 'A legendary helmet made of mithril',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 1200,
    weight: 2,
    requirements: { defense: 20 },
    bonuses: { defense: 18 },
    armorSlot: ArmorSlot.HELMET,
    modelPath: '/assets/models/armor/mithril_helmet.glb',
    iconPath: '/icons/mithril_helmet.png'
  }],

  // Armor - Body
  ['bronze_body', {
    id: 'bronze_body',
    name: 'Bronze Body',
    description: 'Basic body armor made of bronze',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 120,
    weight: 5,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 6 },
    armorSlot: ArmorSlot.BODY,
    modelPath: '/assets/models/armor/bronze_body.glb',
    iconPath: '/icons/bronze_body.png'
  }],

  ['steel_body', {
    id: 'steel_body',
    name: 'Steel Body',
    description: 'Sturdy body armor made of steel',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 600,
    weight: 7,
    requirements: { defense: 10 },
    bonuses: { defense: 16 },
    armorSlot: ArmorSlot.BODY,
    modelPath: '/assets/models/armor/steel_body.glb',
    iconPath: '/icons/steel_body.png'
  }],

  ['mithril_body', {
    id: 'mithril_body',
    name: 'Mithril Body',
    description: 'Legendary body armor made of mithril',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 2400,
    weight: 5,
    requirements: { defense: 20 },
    bonuses: { defense: 35 },
    armorSlot: ArmorSlot.BODY,
    modelPath: '/models/armor/mithril_body.glb',
    iconPath: '/icons/mithril_body.png'
  }],

  // Armor - Legs
  ['bronze_legs', {
    id: 'bronze_legs',
    name: 'Bronze Legs',
    description: 'Basic leg armor made of bronze',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 80,
    weight: 3,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 4 },
    armorSlot: ArmorSlot.LEGS,
    modelPath: '/models/armor/bronze_legs.glb',
    iconPath: '/icons/bronze_legs.png'
  }],

  ['steel_legs', {
    id: 'steel_legs',
    name: 'Steel Legs',
    description: 'Sturdy leg armor made of steel',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 400,
    weight: 4,
    requirements: { defense: 10 },
    bonuses: { defense: 12 },
    armorSlot: ArmorSlot.LEGS,
    modelPath: '/models/armor/steel_legs.glb',
    iconPath: '/icons/steel_legs.png'
  }],

  ['mithril_legs', {
    id: 'mithril_legs',
    name: 'Mithril Legs',
    description: 'Legendary leg armor made of mithril',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 1600,
    weight: 3,
    requirements: { defense: 20 },
    bonuses: { defense: 25 },
    armorSlot: ArmorSlot.LEGS,
    modelPath: '/models/armor/mithril_legs.glb',
    iconPath: '/icons/mithril_legs.png'
  }],

  // Leather Armor - Helmets
  ['leather_helmet', {
    id: 'leather_helmet',
    name: 'Leather Helmet',
    description: 'Basic helmet made of leather',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 20,
    weight: 1,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 1 },
    armorSlot: ArmorSlot.HELMET,
    modelPath: '/models/armor/leather_helmet.glb',
    iconPath: '/icons/leather_helmet.png'
  }],

  ['hard_leather_helmet', {
    id: 'hard_leather_helmet',
    name: 'Hard Leather Helmet',
    description: 'Reinforced leather helmet',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 40,
    weight: 1.5,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 2 },
    armorSlot: ArmorSlot.HELMET,
    modelPath: '/models/armor/hard_leather_helmet.glb',
    iconPath: '/icons/hard_leather_helmet.png'
  }],

  ['studded_leather_helmet', {
    id: 'studded_leather_helmet',
    name: 'Studded Leather Helmet',
    description: 'Leather helmet reinforced with metal studs',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 80,
    weight: 2,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 3 },
    armorSlot: ArmorSlot.HELMET,
    modelPath: '/models/armor/studded_leather_helmet.glb',
    iconPath: '/icons/studded_leather_helmet.png'
  }],

  // Leather Armor - Body
  ['leather_body', {
    id: 'leather_body',
    name: 'Leather Body',
    description: 'Basic body armor made of leather',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 40,
    weight: 3,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 2 },
    armorSlot: ArmorSlot.BODY,
    modelPath: '/models/armor/leather_body.glb',
    iconPath: '/icons/leather_body.png'
  }],

  ['hard_leather_body', {
    id: 'hard_leather_body',
    name: 'Hard Leather Body',
    description: 'Reinforced leather body armor',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 80,
    weight: 4,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 4 },
    armorSlot: ArmorSlot.BODY,
    modelPath: '/models/armor/hard_leather_body.glb',
    iconPath: '/icons/hard_leather_body.png'
  }],

  ['studded_leather_body', {
    id: 'studded_leather_body',
    name: 'Studded Leather Body',
    description: 'Leather body armor reinforced with metal studs',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 160,
    weight: 5,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 5 },
    armorSlot: ArmorSlot.BODY,
    modelPath: '/models/armor/studded_leather_body.glb',
    iconPath: '/icons/studded_leather_body.png'
  }],

  // Leather Armor - Legs
  ['leather_legs', {
    id: 'leather_legs',
    name: 'Leather Legs',
    description: 'Basic leg armor made of leather',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 30,
    weight: 2,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 1 },
    armorSlot: ArmorSlot.LEGS,
    modelPath: '/models/armor/leather_legs.glb',
    iconPath: '/icons/leather_legs.png'
  }],

  ['hard_leather_legs', {
    id: 'hard_leather_legs',
    name: 'Hard Leather Legs',
    description: 'Reinforced leather leg armor',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 60,
    weight: 2.5,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 3 },
    armorSlot: ArmorSlot.LEGS,
    modelPath: '/models/armor/hard_leather_legs.glb',
    iconPath: '/icons/hard_leather_legs.png'
  }],

  ['studded_leather_legs', {
    id: 'studded_leather_legs',
    name: 'Studded Leather Legs',
    description: 'Leather leg armor reinforced with metal studs',
    type: ItemType.ARMOR,
    stackable: false,
    maxStack: 1,
    value: 120,
    weight: 3,
    requirements: { level: 1, skill: RPGSkill.DEFENSE },
    bonuses: { defense: 4 },
    armorSlot: ArmorSlot.LEGS,
    modelPath: '/models/armor/studded_leather_legs.glb',
    iconPath: '/icons/studded_leather_legs.png'
  }],

  // Ammunition
  ['arrows', {
    id: 'arrows',
    name: 'Arrows',
    description: 'Basic arrows for bows',
    type: ItemType.AMMUNITION,
    stackable: true,
    maxStack: 1000,
    value: 1,
    weight: 0.1,
    modelPath: '/models/arrows/arrows.glb',
    iconPath: '/icons/arrows.png'
  }],

  // Tools
  ['bronze_hatchet', {
    id: 'bronze_hatchet',
    name: 'Bronze Hatchet',
    description: 'A basic hatchet for chopping trees',
    type: ItemType.TOOL,
    stackable: false,
    maxStack: 1,
    value: 50,
    weight: 1,
    requirements: { level: 1, skill: RPGSkill.WOODCUTTING },
    modelPath: '/assets/models/tools/bronze_hatchet.glb',
    iconPath: '/icons/bronze_hatchet.png'
  }],

  ['fishing_rod', {
    id: 'fishing_rod',
    name: 'Fishing Rod',
    description: 'A basic fishing rod',
    type: ItemType.TOOL,
    stackable: false,
    maxStack: 1,
    value: 30,
    weight: 1,
    requirements: { level: 1, skill: RPGSkill.FISHING },
    modelPath: '/models/tools/fishing_rod.glb',
    iconPath: '/icons/fishing_rod.png'
  }],

  ['tinderbox', {
    id: 'tinderbox',
    name: 'Tinderbox',
    description: 'Used to light fires',
    type: ItemType.TOOL,
    stackable: false,
    maxStack: 1,
    value: 10,
    weight: 0.1,
    requirements: { level: 1, skill: RPGSkill.FIREMAKING },
    modelPath: '/assets/models/tools/tinderbox.glb',
    iconPath: '/icons/tinderbox.png'
  }],

  // Resources
  ['logs', {
    id: 'logs',
    name: 'Logs',
    description: 'Wood logs from trees',
    type: ItemType.RESOURCE,
    stackable: true,
    maxStack: 100,
    value: 5,
    weight: 0.5,
    modelPath: '/assets/models/resources/logs.glb',
    iconPath: '/icons/logs.png'
  }],

  ['oak_logs', {
    id: 'oak_logs',
    name: 'Oak Logs',
    description: 'Sturdy oak logs',
    type: ItemType.RESOURCE,
    stackable: true,
    maxStack: 100,
    value: 15,
    weight: 0.6,
    modelPath: '/models/resources/oak_logs.glb',
    iconPath: '/icons/oak_logs.png'
  }],

  ['willow_logs', {
    id: 'willow_logs',
    name: 'Willow Logs',
    description: 'Flexible willow logs',
    type: ItemType.RESOURCE,
    stackable: true,
    maxStack: 100,
    value: 25,
    weight: 0.4,
    modelPath: '/models/resources/willow_logs.glb',
    iconPath: '/icons/willow_logs.png'
  }],

  // Fish (Raw)
  ['raw_shrimps', {
    id: 'raw_shrimps',
    name: 'Raw Shrimps',
    description: 'Fresh shrimps from the water',
    type: ItemType.RESOURCE,
    stackable: true,
    maxStack: 100,
    value: 2,
    weight: 0.1,
    modelPath: '/models/resources/raw_shrimps.glb',
    iconPath: '/icons/raw_shrimps.png'
  }],

  ['raw_sardine', {
    id: 'raw_sardine',
    name: 'Raw Sardine',
    description: 'A small but tasty fish',
    type: ItemType.RESOURCE,
    stackable: true,
    maxStack: 100,
    value: 5,
    weight: 0.2,
    modelPath: '/models/resources/raw_sardine.glb',
    iconPath: '/icons/raw_sardine.png'
  }],

  ['raw_trout', {
    id: 'raw_trout',
    name: 'Raw Trout',
    description: 'A medium-sized freshwater fish',
    type: ItemType.RESOURCE,
    stackable: true,
    maxStack: 100,
    value: 15,
    weight: 0.3,
    modelPath: '/models/resources/raw_trout.glb',
    iconPath: '/icons/raw_trout.png'
  }],

  ['raw_salmon', {
    id: 'raw_salmon',
    name: 'Raw Salmon',
    description: 'A large and nutritious fish',
    type: ItemType.RESOURCE,
    stackable: true,
    maxStack: 100,
    value: 30,
    weight: 0.4,
    modelPath: '/models/resources/raw_salmon.glb',
    iconPath: '/icons/raw_salmon.png'
  }],

  // Fish (Cooked)
  ['cooked_shrimps', {
    id: 'cooked_shrimps',
    name: 'Cooked Shrimps',
    description: 'Delicious cooked shrimps (heals 3 HP)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 5,
    weight: 0.1,
    healAmount: 3,
    consumeOnUse: true,
    modelPath: '/models/consumables/cooked_shrimps.glb',
    iconPath: '/icons/cooked_shrimps.png'
  }],

  ['cooked_sardine', {
    id: 'cooked_sardine',
    name: 'Cooked Sardine',
    description: 'A well-cooked sardine (heals 4 HP)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 8,
    weight: 0.2,
    healAmount: 4,
    consumeOnUse: true,
    modelPath: '/models/consumables/cooked_sardine.glb',
    iconPath: '/icons/cooked_sardine.png'
  }],

  ['cooked_trout', {
    id: 'cooked_trout',
    name: 'Cooked Trout',
    description: 'A perfectly cooked trout (heals 7 HP)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 25,
    weight: 0.3,
    healAmount: 7,
    consumeOnUse: true,
    modelPath: '/models/consumables/cooked_trout.glb',
    iconPath: '/icons/cooked_trout.png'
  }],

  ['cooked_salmon', {
    id: 'cooked_salmon',
    name: 'Cooked Salmon',
    description: 'A hearty cooked salmon (heals 9 HP)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 45,
    weight: 0.4,
    healAmount: 9,
    consumeOnUse: true,
    modelPath: '/models/consumables/cooked_salmon.glb',
    iconPath: '/icons/cooked_salmon.png'
  }],

  // Burnt Food Items (for cooking failures)
  ['burnt_shrimps', {
    id: 'burnt_shrimps',
    name: 'Burnt Shrimps',
    description: 'Completely burnt shrimps (inedible)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 1,
    weight: 0.1,
    healAmount: 0,
    consumeOnUse: true,
    modelPath: '/models/consumables/burnt_shrimps.glb',
    iconPath: '/icons/burnt_shrimps.png'
  }],

  ['burnt_sardine', {
    id: 'burnt_sardine',
    name: 'Burnt Sardine',
    description: 'A completely burnt sardine (inedible)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 1,
    weight: 0.1,
    healAmount: 0,
    consumeOnUse: true,
    modelPath: '/models/consumables/burnt_sardine.glb',
    iconPath: '/icons/burnt_sardine.png'
  }],

  ['burnt_trout', {
    id: 'burnt_trout',
    name: 'Burnt Trout',
    description: 'A completely burnt trout (inedible)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 1,
    weight: 0.1,
    healAmount: 0,
    consumeOnUse: true,
    modelPath: '/models/consumables/burnt_trout.glb',
    iconPath: '/icons/burnt_trout.png'
  }],

  ['burnt_salmon', {
    id: 'burnt_salmon',
    name: 'Burnt Salmon',
    description: 'A completely burnt salmon (inedible)',
    type: ItemType.CONSUMABLE,
    stackable: true,
    maxStack: 100,
    value: 1,
    weight: 0.1,
    healAmount: 0,
    consumeOnUse: true,
    modelPath: '/models/consumables/burnt_salmon.glb',
    iconPath: '/icons/burnt_salmon.png'
  }]
])

// Helper function to get item by ID
export function getItem(itemId: string): RPGItem | null {
  return RPG_ITEMS.get(itemId) || null
}

// Helper function to get all items of a specific type
export function getItemsByType(type: ItemType): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => item.type === type)
}

// Helper function to get all weapons
export function getWeapons(): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => item.type === ItemType.WEAPON)
}

// Helper function to get all armor
export function getArmor(): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => item.type === ItemType.ARMOR)
}

// Helper function to get all tools
export function getTools(): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => item.type === ItemType.TOOL)
}

// Helper function to get all consumables
export function getConsumables(): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => item.type === ItemType.CONSUMABLE)
}

// Helper function to get all resources
export function getResources(): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => item.type === ItemType.RESOURCE)
}

// Helper function to get items by skill requirement
export function getItemsBySkill(skill: string): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => 
    item.requirements && item.requirements[skill as keyof ItemRequirement]
  )
}

// Helper function to get items by level requirement  
export function getItemsByLevel(level: number): RPGItem[] {
  return Array.from(RPG_ITEMS.values()).filter(item => {
    if (!item.requirements) return true;
    
    return Object.values(item.requirements).every(req => 
      typeof req === 'number' ? req <= level : true
    );
  })
}

export const SHOP_ITEMS = [
  'bronze_hatchet',
  'fishing_rod', 
  'tinderbox',
  'arrows'
]

// Convert Map to object for compatibility 
const itemsObject: { [key: string]: RPGItem } = {}
for (const [key, value] of RPG_ITEMS) {
  itemsObject[key] = value
}

// Export both formats for different consumers
export const items = itemsObject  // For Object.values(items) usage