/**
 * Unit tests for LootTableManager
 * Tests loot table registration, retrieval, and management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LootTableManager } from './LootTableManager'
import { 
  ItemType, 
  ItemRarity, 
  WeaponType,
  AttackType,
  EquipmentSlotName,
  type LootTable,
  type Item 
} from '../../types'
import { MobType } from '../../types/entities'

// Utility function to create complete mock Item objects
function createMockItem(id: string, name: string, type: ItemType = ItemType.MISC, overrides: Partial<Item> = {}): Item {
  return {
    id,
    name,
    type,
    quantity: 1,
    stackable: type === ItemType.MISC || type === ItemType.CURRENCY,
    maxStackSize: type === ItemType.MISC || type === ItemType.CURRENCY ? 1000 : 1,
    value: 1,
    weight: 0.1,
    equipSlot: type === ItemType.WEAPON ? EquipmentSlotName.WEAPON : null,
    weaponType: type === ItemType.WEAPON ? WeaponType.SWORD : WeaponType.NONE,
    equipable: type === ItemType.WEAPON || type === ItemType.ARMOR,
    attackType: type === ItemType.WEAPON ? AttackType.MELEE : null,
    description: `A ${name}`,
    examine: `This is a ${name}`,
    tradeable: true,
    rarity: ItemRarity.COMMON,
    modelPath: '/models/item.glb',
    iconPath: '/icons/item.png',
    healAmount: 0,
    stats: { attack: 0, defense: 0, strength: 0 },
    bonuses: {},
    requirements: { level: 1, skills: {} },
    ...overrides
  }
}

describe('LootTableManager', () => {
  let manager: LootTableManager

  beforeEach(() => {
    manager = new LootTableManager()
  })

  describe('register', () => {
    it('should register a loot table with explicit id', () => {
      const lootTable: LootTable = {
        id: 'goblin_loot',
        mobType: MobType.GOBLIN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('bones', 'Bones', ItemType.MISC, {
            stackable: true,
            value: 1,
            rarity: ItemRarity.ALWAYS
          })
        ]
      }

      manager.register(lootTable)

      const retrieved = manager.get('goblin_loot')
      expect(retrieved).toEqual(lootTable)
    })

    it('should register a loot table using mobType as id', () => {
      const lootTable: LootTable = {
        id: 'bandit',
        mobType: MobType.BANDIT,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('bones', 'Bones', ItemType.MISC, {
            stackable: true,
            value: 1,
            rarity: ItemRarity.ALWAYS
          })
        ]
      }

      manager.register(lootTable)

      const retrieved = manager.get('bandit')
      expect(retrieved).toEqual(lootTable)
    })

    it('should prefer explicit id over mobType', () => {
      const lootTable: LootTable = {
        id: 'special_goblin',
        mobType: MobType.GOBLIN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('rare_item', 'Rare Item', ItemType.WEAPON, {
            value: 1000,
            rarity: ItemRarity.RARE
          })
        ]
      }

      manager.register(lootTable)

      const retrieved = manager.get('special_goblin')
      expect(retrieved).toEqual(lootTable)
      
      const notFound = manager.get('goblin')
      expect(notFound).toBeUndefined()
    })

    it('should use "unknown" as fallback id', () => {
      const lootTable: LootTable = {
        id: 'unknown',
        mobType: MobType.GOBLIN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('mystery_item', 'Mystery Item', ItemType.MISC, {
            stackable: true,
            value: 5,
            rarity: ItemRarity.COMMON
          })
        ]
      }

      manager.register(lootTable)

      const retrieved = manager.get('unknown')
      expect(retrieved).toEqual(lootTable)
    })

    it('should overwrite existing loot table with same id', () => {
      const lootTable1: LootTable = {
        id: 'orc_loot',
        mobType: MobType.BARBARIAN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('coins', 'Coins', ItemType.CURRENCY, {
            stackable: true,
            value: 1,
            rarity: ItemRarity.ALWAYS
          })
        ]
      }

      const lootTable2: LootTable = {
        id: 'orc_loot',
        mobType: MobType.BARBARIAN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('gem', 'Gem', ItemType.MISC, {
            stackable: true,
            value: 100,
            rarity: ItemRarity.RARE
          })
        ]
      }

      manager.register(lootTable1)
      manager.register(lootTable2)

      const retrieved = manager.get('orc_loot')
      expect(retrieved).toEqual(lootTable2)
      expect(retrieved?.drops?.[0]?.id).toBe('gem')
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent loot table', () => {
      const retrieved = manager.get('non_existent')
      expect(retrieved).toBeUndefined()
    })

    it('should return registered loot table', () => {
      const lootTable: LootTable = {
        id: 'dragon_loot',
        mobType: MobType.DARK_WARRIOR,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('dragon_bones', 'Dragon bones', ItemType.MISC, {
            stackable: true,
            value: 1000,
            rarity: ItemRarity.ALWAYS
          })
        ]
      }

      manager.register(lootTable)

      const retrieved = manager.get('dragon_loot')
      expect(retrieved).toEqual(lootTable)
    })

    it('should handle case-sensitive lookups', () => {
      const lootTable: LootTable = {
        id: 'CaseSensitive',
        mobType: MobType.DARK_RANGER,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      const retrieved = manager.get('CaseSensitive')
      expect(retrieved).toEqual(lootTable)

      const notFound = manager.get('casesensitive')
      expect(notFound).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return false for non-existent loot table', () => {
      const exists = manager.has('non_existent')
      expect(exists).toBe(false)
    })

    it('should return true for registered loot table', () => {
      const lootTable: LootTable = {
        id: 'troll_loot',
        mobType: MobType.DARK_WARRIOR,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      const exists = manager.has('troll_loot')
      expect(exists).toBe(true)
    })

    it('should handle case-sensitive checks', () => {
      const lootTable: LootTable = {
        id: 'CaseTest',
        mobType: MobType.ICE_WARRIOR,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      expect(manager.has('CaseTest')).toBe(true)
      expect(manager.has('casetest')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return empty array when no loot tables registered', () => {
      const allTables = manager.getAll()
      expect(allTables).toEqual([])
    })

    it('should return all registered loot tables', () => {
      const lootTable1: LootTable = {
        id: 'goblin_loot',
        mobType: MobType.GOBLIN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('bones', 'Bones', ItemType.MISC, {
            stackable: true,
            value: 1,
            rarity: ItemRarity.ALWAYS
          })
        ]
      }

      const lootTable2: LootTable = {
        id: 'orc_loot',
        mobType: MobType.BARBARIAN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('coins', 'Coins', ItemType.CURRENCY, {
            stackable: true,
            value: 1,
            rarity: ItemRarity.ALWAYS
          })
        ]
      }

      manager.register(lootTable1)
      manager.register(lootTable2)

      const allTables = manager.getAll()
      expect(allTables).toHaveLength(2)
      expect(allTables).toContain(lootTable1)
      expect(allTables).toContain(lootTable2)
    })

    it('should return array of current state (not cached)', () => {
      const lootTable: LootTable = {
        id: 'dynamic_test',
        mobType: MobType.GOBLIN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      const initialTables = manager.getAll()
      expect(initialTables).toHaveLength(0)

      manager.register(lootTable)

      const updatedTables = manager.getAll()
      expect(updatedTables).toHaveLength(1)
      expect(updatedTables[0]).toEqual(lootTable)
    })
  })

  describe('remove', () => {
    it('should return false when removing non-existent loot table', () => {
      const removed = manager.remove('non_existent')
      expect(removed).toBe(false)
    })

    it('should return true when removing existing loot table', () => {
      const lootTable: LootTable = {
        id: 'to_be_removed',
        mobType: MobType.HOBGOBLIN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)
      expect(manager.has('to_be_removed')).toBe(true)

      const removed = manager.remove('to_be_removed')
      expect(removed).toBe(true)
      expect(manager.has('to_be_removed')).toBe(false)
    })

    it('should actually remove the loot table', () => {
      const lootTable: LootTable = {
        id: 'removal_test',
        mobType: MobType.GUARD,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)
      expect(manager.get('removal_test')).toEqual(lootTable)

      manager.remove('removal_test')
      expect(manager.get('removal_test')).toBeUndefined()
    })

    it('should update size after removal', () => {
      const lootTable1: LootTable = { id: 'table1', mobType: MobType.GOBLIN, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      const lootTable2: LootTable = { id: 'table2', mobType: MobType.BANDIT, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }

      manager.register(lootTable1)
      manager.register(lootTable2)
      expect(manager.size).toBe(2)

      manager.remove('table1')
      expect(manager.size).toBe(1)

      manager.remove('table2')
      expect(manager.size).toBe(0)
    })
  })

  describe('clear', () => {
    it('should remove all loot tables', () => {
      const lootTable1: LootTable = { id: 'table1', mobType: MobType.GOBLIN, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      const lootTable2: LootTable = { id: 'table2', mobType: MobType.BANDIT, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      const lootTable3: LootTable = { id: 'table3', mobType: MobType.BARBARIAN, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }

      manager.register(lootTable1)
      manager.register(lootTable2)
      manager.register(lootTable3)

      expect(manager.size).toBe(3)
      expect(manager.getAll()).toHaveLength(3)

      manager.clear()

      expect(manager.size).toBe(0)
      expect(manager.getAll()).toEqual([])
      expect(manager.get('table1')).toBeUndefined()
      expect(manager.get('table2')).toBeUndefined()
      expect(manager.get('table3')).toBeUndefined()
    })

    it('should handle clearing empty manager', () => {
      expect(manager.size).toBe(0)
      
      manager.clear()
      
      expect(manager.size).toBe(0)
      expect(manager.getAll()).toEqual([])
    })
  })

  describe('size', () => {
    it('should return 0 for empty manager', () => {
      expect(manager.size).toBe(0)
    })

    it('should return correct count after registering tables', () => {
      expect(manager.size).toBe(0)

      const lootTable1: LootTable = { id: 'size_test_1', mobType: MobType.GOBLIN, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      manager.register(lootTable1)
      expect(manager.size).toBe(1)

      const lootTable2: LootTable = { id: 'size_test_2', mobType: MobType.BANDIT, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      manager.register(lootTable2)
      expect(manager.size).toBe(2)

      const lootTable3: LootTable = { id: 'size_test_3', mobType: MobType.BARBARIAN, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      manager.register(lootTable3)
      expect(manager.size).toBe(3)
    })

    it('should not increase when overwriting existing table', () => {
      const lootTable1: LootTable = { id: 'overwrite_test', mobType: MobType.HOBGOBLIN, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      const lootTable2: LootTable = { id: 'overwrite_test', mobType: MobType.HOBGOBLIN, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [
        createMockItem('new_item', 'New Item', ItemType.MISC, {
          stackable: true,
          value: 1,
          rarity: ItemRarity.COMMON
        })
      ] }

      manager.register(lootTable1)
      expect(manager.size).toBe(1)

      manager.register(lootTable2)
      expect(manager.size).toBe(1) // Should not increase
    })

    it('should decrease after removal', () => {
      const lootTable1: LootTable = { id: 'remove_size_1', mobType: MobType.GUARD, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      const lootTable2: LootTable = { id: 'remove_size_2', mobType: MobType.DARK_WARRIOR, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }

      manager.register(lootTable1)
      manager.register(lootTable2)
      expect(manager.size).toBe(2)

      manager.remove('remove_size_1')
      expect(manager.size).toBe(1)

      manager.remove('remove_size_2')
      expect(manager.size).toBe(0)
    })

    it('should be 0 after clear', () => {
      const lootTable1: LootTable = { id: 'clear_size_1', mobType: MobType.BLACK_KNIGHT, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }
      const lootTable2: LootTable = { id: 'clear_size_2', mobType: MobType.ICE_WARRIOR, guaranteedDrops: [], commonDrops: [], uncommonDrops: [], rareDrops: [], drops: [] }

      manager.register(lootTable1)
      manager.register(lootTable2)
      expect(manager.size).toBe(2)

      manager.clear()
      expect(manager.size).toBe(0)
    })
  })

  describe('complex loot tables', () => {
    it('should handle loot tables with multiple drops', () => {
      const complexLootTable: LootTable = {
        id: 'boss_loot',
        mobType: MobType.BLACK_KNIGHT,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: [
          createMockItem('boss_bones', 'Boss bones', ItemType.MISC, {
            stackable: true,
            value: 500,
            rarity: ItemRarity.ALWAYS
          }),
          createMockItem('rare_weapon', 'Rare weapon', ItemType.WEAPON, {
            stackable: false,
            value: 10000,
            rarity: ItemRarity.RARE
          }),
          createMockItem('common_item', 'Common item', ItemType.MISC, {
            stackable: true,
            value: 10,
            rarity: ItemRarity.COMMON
          })
        ],
        rareDropTable: true
      }

      manager.register(complexLootTable)

      const retrieved = manager.get('boss_loot')
      expect(retrieved).toEqual(complexLootTable)
      expect(retrieved?.drops).toHaveLength(3)
      expect(retrieved?.rareDropTable).toBe(true)
    })

    it('should handle loot tables with empty drops array', () => {
      const emptyLootTable: LootTable = {
        id: 'empty_drops',
        mobType: MobType.GOBLIN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(emptyLootTable)

      const retrieved = manager.get('empty_drops')
      expect(retrieved).toEqual(emptyLootTable)
      expect(retrieved?.drops).toEqual([])
    })

    it('should handle loot tables with no drops property', () => {
      const noDropsTable: LootTable = {
        id: 'no_drops',
        mobType: MobType.BANDIT,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: []
      }

      manager.register(noDropsTable)

      const retrieved = manager.get('no_drops')
      expect(retrieved).toEqual(noDropsTable)
      expect(retrieved?.drops).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty string ids', () => {
      const lootTable: LootTable = {
        id: '',
        mobType: MobType.BARBARIAN,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      const retrieved = manager.get('')
      expect(retrieved).toEqual(lootTable)
    })

    it('should handle special characters in ids', () => {
      const specialIds = ['special-mob', 'mob_with_underscores', 'mob.with.dots', 'mob with spaces']

      specialIds.forEach(id => {
        const lootTable: LootTable = {
          id,
          mobType: MobType.HOBGOBLIN,
          guaranteedDrops: [],
          commonDrops: [],
          uncommonDrops: [],
          rareDrops: [],
          drops: []
        }

        manager.register(lootTable)

        const retrieved = manager.get(id)
        expect(retrieved).toEqual(lootTable)
      })
    })

    it('should handle numeric-like string ids', () => {
      const lootTable: LootTable = {
        id: '12345',
        mobType: MobType.GUARD,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      const retrieved = manager.get('12345')
      expect(retrieved).toEqual(lootTable)
    })

    it('should handle unicode characters in ids', () => {
      const lootTable: LootTable = {
        id: '龍のloot',
        mobType: MobType.DARK_WARRIOR,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      const retrieved = manager.get('龍のloot')
      expect(retrieved).toEqual(lootTable)
    })

    it('should handle very long ids', () => {
      const longId = 'a'.repeat(1000)
      const lootTable: LootTable = {
        id: longId,
        mobType: MobType.BLACK_KNIGHT,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      const retrieved = manager.get(longId)
      expect(retrieved).toEqual(lootTable)
    })

    it('should maintain reference equality for registered objects', () => {
      const lootTable: LootTable = {
        id: 'reference_test',
        mobType: MobType.ICE_WARRIOR,
        guaranteedDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        drops: []
      }

      manager.register(lootTable)

      const retrieved = manager.get('reference_test')
      expect(retrieved).toBe(lootTable) // Same reference
    })
  })
})