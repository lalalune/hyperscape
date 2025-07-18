import type { ItemDefinition, EquipmentSlot } from '../../types'
import { WeaponType } from '../../types'

export class ItemRegistry {
  private items: Map<number, ItemDefinition> = new Map()
  private nameIndex: Map<string, ItemDefinition> = new Map()

  /**
   * Register an item definition
   */
  register(item: ItemDefinition): void {
    this.items.set(item.id, item)
    this.nameIndex.set(item.name, item)
  }

  /**
   * Get item by ID
   */
  get(itemId: number): ItemDefinition | null {
    return this.items.get(itemId) || null
  }

  /**
   * Get item by exact name
   */
  getByName(name: string): ItemDefinition | null {
    return this.nameIndex.get(name) || null
  }

  /**
   * Check if item is stackable
   */
  isStackable(itemId: number): boolean {
    const item = this.get(itemId)
    return item ? item.stackable : false
  }

  /**
   * Check if item is equipable
   */
  isEquipable(itemId: number): boolean {
    const item = this.get(itemId)
    return item ? item.equipable : false
  }

  /**
   * Check if item is tradeable
   */
  isTradeable(itemId: number): boolean {
    const item = this.get(itemId)
    return item ? item.tradeable : false
  }

  /**
   * Check if item can be noted
   */
  isNoteable(itemId: number): boolean {
    const item = this.get(itemId)
    return item ? item.noteable === true && !item.noted : false
  }

  /**
   * Check if item is noted
   */
  isNoted(itemId: number): boolean {
    const item = this.get(itemId)
    return item ? item.noted === true : false
  }

  /**
   * Get unnoted version ID
   */
  getUnnoted(itemId: number): number | null {
    const item = this.get(itemId)
    return item && item.noted && item.notedId ? item.notedId : null
  }

  /**
   * Get noted version ID
   */
  getNoted(itemId: number): number | null {
    const item = this.get(itemId)
    return item && item.noteable && item.notedId ? item.notedId : null
  }

  /**
   * Check if item is members only
   */
  isMembers(itemId: number): boolean {
    const item = this.get(itemId)
    return item ? item.members : false
  }

  /**
   * Get all registered items
   */
  getAll(): ItemDefinition[] {
    return Array.from(this.items.values())
  }

  /**
   * Get items by category (equipment slot)
   */
  getByCategory(category: string): ItemDefinition[] {
    const results: ItemDefinition[] = []

    for (const item of this.items.values()) {
      if (item.equipment) {
        const slot = item.equipment.slot.toLowerCase()
        if (slot === category.toLowerCase()) {
          results.push(item)
        }
      }
    }

    return results
  }

  /**
   * Search items by name (case insensitive partial match)
   */
  search(query: string): ItemDefinition[] {
    const lowerQuery = query.toLowerCase()
    const results: ItemDefinition[] = []

    for (const item of this.items.values()) {
      if (item.name.toLowerCase().includes(lowerQuery)) {
        results.push(item)
      }
    }

    return results
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear()
    this.nameIndex.clear()
  }

  /**
   * Get number of registered items
   */
  size(): number {
    return this.items.size
  }

  /**
   * Load default items (called by InventorySystem)
   */
  loadDefaults(): void {
    // Bronze tier weapons
    this.register({
      id: 1,
      name: 'Bronze Sword',
      examine: 'A bronze sword.',
      value: 15,
      weight: 2.2,
      stackable: false,
      equipable: true,
      tradeable: true,
      members: false,
      equipment: {
        slot: 'weapon' as EquipmentSlot,
        requirements: { attack: { level: 1, xp: 0 } },
        bonuses: {
          attackStab: 4,
          attackSlash: 5,
          attackCrush: -2,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 0,
          defenseSlash: 1,
          defenseCrush: 0,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: 4,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0,
        },
        weaponType: WeaponType.SWORD,
        attackSpeed: 4,
      },
      model: 'bronze_sword',
      icon: 'bronze_sword_icon',
    })

    // Currency
    this.register({
      id: 995,
      name: 'Coins',
      examine: 'Lovely money!',
      value: 1,
      weight: 0,
      stackable: true,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'coins',
      icon: 'coins_icon',
    })

    // Raw cooking ingredients
    this.register({
      id: 317,
      name: 'Raw Shrimp',
      examine: 'Raw shrimp, needs cooking.',
      value: 1,
      weight: 0.1,
      stackable: true,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_shrimp',
      icon: 'raw_shrimp_icon',
    })

    this.register({
      id: 327,
      name: 'Raw Sardine',
      examine: 'Raw sardine, needs cooking.',
      value: 2,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_sardine',
      icon: 'raw_sardine_icon',
    })

    this.register({
      id: 335,
      name: 'Raw Trout',
      examine: 'Raw trout, needs cooking.',
      value: 10,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_trout',
      icon: 'raw_trout_icon',
    })

    // Cooked food
    this.register({
      id: 315,
      name: 'Shrimps',
      examine: 'Some nicely cooked shrimps.',
      value: 5,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'shrimps',
      icon: 'shrimps_icon',
    })

    this.register({
      id: 325,
      name: 'Sardine',
      examine: 'A nicely cooked sardine.',
      value: 8,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'sardine',
      icon: 'sardine_icon',
    })

    this.register({
      id: 333,
      name: 'Trout',
      examine: 'A nicely cooked trout.',
      value: 25,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'trout',
      icon: 'trout_icon',
    })

    // Burnt food
    this.register({
      id: 323,
      name: 'Burnt Shrimp',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_shrimp',
      icon: 'burnt_shrimp_icon',
    })

    this.register({
      id: 369,
      name: 'Burnt Sardine',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_sardine',
      icon: 'burnt_sardine_icon',
    })

    this.register({
      id: 343,
      name: 'Burnt Trout',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_trout',
      icon: 'burnt_trout_icon',
    })

    // Bones (always dropped by NPCs)
    this.register({
      id: 526,
      name: 'Bones',
      examine: 'These would be good for prayer training.',
      value: 1,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'bones',
      icon: 'bones_icon',
    })

    // Additional cooking ingredients
    this.register({
      id: 341,
      name: 'Raw Salmon',
      examine: 'Raw salmon, needs cooking.',
      value: 15,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_salmon',
      icon: 'raw_salmon_icon',
    })

    this.register({
      id: 339,
      name: 'Salmon',
      examine: 'A nicely cooked salmon.',
      value: 40,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'salmon',
      icon: 'salmon_icon',
    })

    this.register({
      id: 347,
      name: 'Burnt Salmon',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_salmon',
      icon: 'burnt_salmon_icon',
    })

    this.register({
      id: 359,
      name: 'Raw Tuna',
      examine: 'Raw tuna, needs cooking.',
      value: 20,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_tuna',
      icon: 'raw_tuna_icon',
    })

    this.register({
      id: 361,
      name: 'Tuna',
      examine: 'A nicely cooked tuna.',
      value: 50,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'tuna',
      icon: 'tuna_icon',
    })

    this.register({
      id: 367,
      name: 'Burnt Tuna',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_tuna',
      icon: 'burnt_tuna_icon',
    })

    this.register({
      id: 377,
      name: 'Raw Lobster',
      examine: 'Raw lobster, needs cooking.',
      value: 100,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_lobster',
      icon: 'raw_lobster_icon',
    })

    this.register({
      id: 379,
      name: 'Lobster',
      examine: 'A nicely cooked lobster.',
      value: 150,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'lobster',
      icon: 'lobster_icon',
    })

    this.register({
      id: 381,
      name: 'Burnt Lobster',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_lobster',
      icon: 'burnt_lobster_icon',
    })

    this.register({
      id: 371,
      name: 'Raw Swordfish',
      examine: 'Raw swordfish, needs cooking.',
      value: 200,
      weight: 0.6,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_swordfish',
      icon: 'raw_swordfish_icon',
    })

    this.register({
      id: 373,
      name: 'Swordfish',
      examine: 'A nicely cooked swordfish.',
      value: 300,
      weight: 0.6,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'swordfish',
      icon: 'swordfish_icon',
    })

    this.register({
      id: 375,
      name: 'Burnt Swordfish',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.6,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_swordfish',
      icon: 'burnt_swordfish_icon',
    })

    this.register({
      id: 383,
      name: 'Raw Shark',
      examine: 'Raw shark, needs cooking.',
      value: 500,
      weight: 0.8,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_shark',
      icon: 'raw_shark_icon',
    })

    this.register({
      id: 385,
      name: 'Shark',
      examine: 'A nicely cooked shark.',
      value: 800,
      weight: 0.8,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'shark',
      icon: 'shark_icon',
    })

    this.register({
      id: 387,
      name: 'Burnt Shark',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.8,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_shark',
      icon: 'burnt_shark_icon',
    })

    // Meat items
    this.register({
      id: 2138,
      name: 'Raw Chicken',
      examine: 'Raw chicken, needs cooking.',
      value: 3,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_chicken',
      icon: 'raw_chicken_icon',
    })

    this.register({
      id: 2140,
      name: 'Cooked Chicken',
      examine: 'A nicely cooked chicken.',
      value: 8,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'cooked_chicken',
      icon: 'cooked_chicken_icon',
    })

    this.register({
      id: 2142,
      name: 'Burnt Chicken',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_chicken',
      icon: 'burnt_chicken_icon',
    })

    this.register({
      id: 2132,
      name: 'Raw Beef',
      examine: 'Raw beef, needs cooking.',
      value: 3,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'raw_beef',
      icon: 'raw_beef_icon',
    })

    this.register({
      id: 2134,
      name: 'Cooked Beef',
      examine: 'A nicely cooked beef.',
      value: 8,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'cooked_beef',
      icon: 'cooked_beef_icon',
    })

    this.register({
      id: 2146,
      name: 'Burnt Beef',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_beef',
      icon: 'burnt_beef_icon',
    })

    // Baking items
    this.register({
      id: 2307,
      name: 'Bread Dough',
      examine: 'Bread dough, ready for baking.',
      value: 5,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'bread_dough',
      icon: 'bread_dough_icon',
    })

    this.register({
      id: 2309,
      name: 'Bread',
      examine: 'A nicely baked bread.',
      value: 12,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'bread',
      icon: 'bread_icon',
    })

    this.register({
      id: 2311,
      name: 'Burnt Bread',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_bread',
      icon: 'burnt_bread_icon',
    })

    this.register({
      id: 1889,
      name: 'Cake Mixture',
      examine: 'Cake mixture, ready for baking.',
      value: 50,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'cake_mixture',
      icon: 'cake_mixture_icon',
    })

    this.register({
      id: 1891,
      name: 'Cake',
      examine: 'A nicely baked cake.',
      value: 100,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'cake',
      icon: 'cake_icon',
    })

    this.register({
      id: 1893,
      name: 'Burnt Cake',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_cake',
      icon: 'burnt_cake_icon',
    })

    // Complex items
    this.register({
      id: 2003,
      name: 'Stew Ingredients',
      examine: 'Raw ingredients for stew.',
      value: 20,
      weight: 0.4,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'stew_ingredients',
      icon: 'stew_ingredients_icon',
    })

    this.register({
      id: 2005,
      name: 'Stew',
      examine: 'A hearty stew.',
      value: 50,
      weight: 0.4,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'stew',
      icon: 'stew_icon',
    })

    this.register({
      id: 2007,
      name: 'Burnt Stew',
      examine: 'Burnt to a crisp.',
      value: 1,
      weight: 0.4,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: 'burnt_stew',
      icon: 'burnt_stew_icon',
    })
  }
}
