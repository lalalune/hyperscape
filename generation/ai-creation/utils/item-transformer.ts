/**
 * Transform RuneScape JSON item data to ItemData format
 */

import type { ItemData, ItemCategory, WeaponType } from '../types/geometry'

export interface RuneScapeItemJSON {
    id: number | string
    name: string
    examine: string
    value?: number
    weight?: number
    stackable?: boolean
    equipable?: boolean
    tradeable?: boolean
    members?: boolean
    equipment?: {
        slot: string
        requirements?: any
        bonuses?: any
        weaponType?: string
        attackSpeed?: number
    }
    healAmount?: number
    prayerXp?: number
    doses?: number
    prayerRestore?: number
    model?: string
    icon?: string
}

/**
 * Determine item category based on item properties
 */
function determineCategory(item: RuneScapeItemJSON): ItemCategory {
    if (item.equipment) {
        if (item.equipment.weaponType) {
            return 'weapon'
        }
        return 'armor'
    }

    if (item.healAmount || item.doses || item.name.toLowerCase().includes('food') ||
        item.name.toLowerCase().includes('meat') || item.name.toLowerCase().includes('bread') ||
        item.name.toLowerCase().includes('lobster') || item.name.toLowerCase().includes('shark')) {
        return 'consumable'
    }

    if (item.name.toLowerCase().includes('bones')) {
        return 'resource'
    }

    if (item.name.toLowerCase().includes('hide') || item.name.toLowerCase().includes('ore') ||
        item.name.toLowerCase().includes('bar') || item.name.toLowerCase().includes('log')) {
        return 'resource'
    }

    return 'misc'
}

/**
 * Transform equipment bonuses to simplified stats
 */
function transformEquipmentStats(bonuses: any): any {
    if (!bonuses) return undefined

    // Calculate aggregate stats from OSRS bonuses
    const damage = Math.max(
        bonuses.meleeStrength || 0,
        bonuses.rangedStrength || 0,
        bonuses.magicDamage || 0
    )

    const accuracy = Math.max(
        bonuses.attackStab || 0,
        bonuses.attackSlash || 0,
        bonuses.attackCrush || 0,
        bonuses.attackMagic || 0,
        bonuses.attackRanged || 0
    )

    const defense = Math.max(
        bonuses.defenseStab || 0,
        bonuses.defenseSlash || 0,
        bonuses.defenseCrush || 0,
        bonuses.defenseMagic || 0,
        bonuses.defenseRanged || 0
    )

    return {
        damage,
        accuracy,
        defense,
        strength: bonuses.meleeStrength || 0,
        range: bonuses.attackRanged || 0,
        speed: bonuses.attackSpeed || 4
    }
}

/**
 * Map OSRS weapon types to our WeaponType
 */
function mapWeaponType(weaponType: string | undefined): WeaponType | undefined {
    if (!weaponType) return undefined

    const typeMap: Record<string, WeaponType> = {
        'dagger': 'dagger',
        'sword': 'sword',
        'scimitar': 'sword',
        'longsword': 'sword',
        '2h sword': 'sword',
        'axe': 'axe',
        'hatchet': 'axe',
        'battleaxe': 'axe',
        'mace': 'mace',
        'warhammer': 'mace',
        'staff': 'staff',
        'battlestaff': 'staff',
        'bow': 'bow',
        'crossbow': 'crossbow',
        'spear': 'spear',
        'halberd': 'spear',
        'shield': 'shield'
    }

    return typeMap[weaponType.toLowerCase()] || 'sword'
}

/**
 * Transform RuneScape JSON item to ItemData format
 */
export function transformRuneScapeItem(rsItem: RuneScapeItemJSON): ItemData {
    const category = determineCategory(rsItem)

    const itemData: ItemData = {
        id: rsItem.id,
        name: rsItem.name,
        examine: rsItem.examine,
        category,
        value: rsItem.value,
        weight: rsItem.weight,
        stackable: rsItem.stackable,
        metadata: {
            equipable: rsItem.equipable,
            tradeable: rsItem.tradeable,
            members: rsItem.members,
            model: rsItem.model,
            icon: rsItem.icon,
            healAmount: rsItem.healAmount,
            prayerXp: rsItem.prayerXp,
            doses: rsItem.doses,
            prayerRestore: rsItem.prayerRestore
        }
    }

    // Transform equipment data if present
    if (rsItem.equipment) {
        itemData.equipment = {
            slot: rsItem.equipment.slot as any,
            weaponType: mapWeaponType(rsItem.equipment.weaponType),
            level: rsItem.equipment.requirements?.level || 1,
            stats: transformEquipmentStats(rsItem.equipment.bonuses)
        }
    }

    return itemData
}

/**
 * Transform an array of RuneScape items
 */
export function transformRuneScapeItems(rsItems: RuneScapeItemJSON[]): ItemData[] {
    return rsItems.map(transformRuneScapeItem)
}

/**
 * Load and transform RuneScape items from JSON files
 */
export async function loadRuneScapeItems(filePaths: string[]): Promise<ItemData[]> {
    const { readFileSync, existsSync } = await import('fs')
    const allItems: ItemData[] = []

    for (const filePath of filePaths) {
        if (!existsSync(filePath)) {
            console.warn(`Item file not found: ${filePath}`)
            continue
        }

        try {
            const jsonData = readFileSync(filePath, 'utf-8')
            const rsItems = JSON.parse(jsonData) as RuneScapeItemJSON[]
            const transformedItems = transformRuneScapeItems(rsItems)
            allItems.push(...transformedItems)
            console.log(`✅ Loaded ${transformedItems.length} items from ${filePath}`)
        } catch (error) {
            console.error(`Failed to load items from ${filePath}:`, error)
        }
    }

    return allItems
} 