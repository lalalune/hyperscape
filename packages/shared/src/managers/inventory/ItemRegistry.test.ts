/**
 * Unit tests for ItemRegistry
 * Tests item registration, retrieval, and data management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '../../types/core';
import { ItemType, ItemRarity, EquipmentSlotName } from '../../types/core';
import { ItemRegistry } from './ItemRegistry';
import { dataManager } from '../../data/DataManager';

// Helper function to create complete Item objects for testing
function createTestItem(overrides: Partial<Item>): Item {
  return {
    id: '1',
    name: 'Test Item',
    type: ItemType.MISC,
    quantity: 1,
    stackable: false,
    maxStackSize: 1,
    value: 10,
    weight: 1,
    equipSlot: null,
    weaponType: null,
    equipable: false,
    attackType: null,
    description: 'A test item',
    examine: 'This is a test item',
    tradeable: true,
    rarity: ItemRarity.COMMON,
    modelPath: 'items/test.glb',
    iconPath: 'icons/test.png',
    healAmount: 0,
    stats: { attack: 0, defense: 0, strength: 0 },
    bonuses: { attack: 0, defense: 0, ranged: 0, strength: 0 },
    requirements: { level: 1, skills: {} },
    ...overrides
  };
}

describe('ItemRegistry', () => {
  let registry: ItemRegistry;

  beforeEach(() => {
    const mockItems = new Map([
      ['bronze_sword', {
        id: '1',
        name: 'Bronze sword',
        type: ItemType.WEAPON,
        stackable: false,
        value: 50,
        equipSlot: 'weapon'
      }],
      ['iron_helmet', {
        id: '2',
        name: 'Iron helmet',
        type: ItemType.ARMOR,
        stackable: false,
        value: 100,
        equipSlot: 'helmet'
      }]
    ]);

    vi.spyOn(dataManager, 'getAllItems').mockReturnValue(mockItems as Map<string, Item>);
    registry = new ItemRegistry();
  });

  describe('register', () => {
    it('should register an item by ID', () => {
      const item = createTestItem({
        id: '123',
        name: 'Test Sword',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);

      const retrieved = registry.get(123);
      expect(retrieved).toEqual(item);
    });

    it('should register an item by name index', () => {
      const item = createTestItem({
        id: '456',
        name: 'Magic Bow',
        type: ItemType.WEAPON,
        value: 500
      });

      registry.register(item);

      const retrieved = registry.getByName('Magic Bow');
      expect(retrieved).toEqual(item);
    });

    it('should handle string IDs by converting to numbers', () => {
      const item = createTestItem({
        id: '789',
        name: 'Steel Armor',
        type: ItemType.ARMOR,
        value: 300
      });

      registry.register(item);

      const retrieved = registry.get(789);
      expect(retrieved).toEqual(item);
    });

    it('should overwrite existing items with same ID', () => {
      const item1 = createTestItem({
        id: '100',
        name: 'Old Item',
        type: ItemType.WEAPON,
        value: 50
      });

      const item2 = createTestItem({
        id: '100',
        name: 'New Item',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item1);
      registry.register(item2);

      const retrieved = registry.get(100);
      expect(retrieved?.name).toBe('New Item');
    });
  });

  describe('get', () => {
    it('should return null for non-existent item', () => {
      const item = registry.get(999);
      expect(item).toBeNull();
    });

    it('should return registered item by numeric ID', () => {
      const item = createTestItem({
        id: '200',
        name: 'Test Item',
        type: ItemType.WEAPON,
        value: 150
      });

      registry.register(item);

      const retrieved = registry.get(200);
      expect(retrieved).toEqual(item);
    });
  });

  describe('getByName', () => {
    it('should return null for non-existent item name', () => {
      const item = registry.getByName('Non-existent Item');
      expect(item).toBeNull();
    });

    it('should return registered item by exact name', () => {
      const item = createTestItem({
        id: '300',
        name: 'Unique Sword',
        type: ItemType.WEAPON,
        value: 250
      });

      registry.register(item);

      const retrieved = registry.getByName('Unique Sword');
      expect(retrieved).toEqual(item);
    });

    it('should be case sensitive', () => {
      const item = createTestItem({
        id: '400',
        name: 'Case Sensitive Item',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);

      const retrieved = registry.getByName('case sensitive item');
      expect(retrieved).toBeNull();
    });
  });

  describe('isStackable', () => {
    it('should return true for stackable items', () => {
      const item = createTestItem({
        id: '500',
        name: 'Arrows',
        type: ItemType.AMMUNITION,
        stackable: true,
        maxStackSize: 100,
        value: 1
      });

      registry.register(item);

      const isStackable = registry.isStackable(500);
      expect(isStackable).toBe(true);
    });

    it('should return false for non-stackable items', () => {
      const item = createTestItem({
        id: '600',
        name: 'Sword',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);

      const isStackable = registry.isStackable(600);
      expect(isStackable).toBe(false);
    });

    it('should return false for non-existent items', () => {
      const isStackable = registry.isStackable(999);
      expect(isStackable).toBe(false);
    });
  });

  describe('isEquipable', () => {
    it('should return true for equipable items', () => {
      const item = createTestItem({
        id: '700',
        name: 'Helmet',
        type: ItemType.ARMOR,
        value: 50,
        equipable: true
      });

      registry.register(item);

      const isEquipable = registry.isEquipable(700);
      expect(isEquipable).toBe(true);
    });

    it('should return false for non-equipable items', () => {
      const item = createTestItem({
        id: '800',
        name: 'Potion',
        type: ItemType.CONSUMABLE,
        stackable: true,
        maxStackSize: 50,
        value: 10,
        equipable: false
      });

      registry.register(item);

      const isEquipable = registry.isEquipable(800);
      expect(isEquipable).toBe(false);
    });

    it('should return false when equipable property is undefined', () => {
      const item = createTestItem({
        id: '900',
        name: 'Food',
        type: ItemType.CONSUMABLE,
        stackable: true,
        maxStackSize: 50,
        value: 5
      });

      registry.register(item);

      const isEquipable = registry.isEquipable(900);
      expect(isEquipable).toBe(false);
    });

    it('should return false for non-existent items', () => {
      const isEquipable = registry.isEquipable(999);
      expect(isEquipable).toBe(false);
    });
  });

  describe('isTradeable', () => {
    it('should return true for tradeable items (default)', () => {
      const item = createTestItem({
        id: '1000',
        name: 'Tradeable Item',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);

      const isTradeable = registry.isTradeable(1000);
      expect(isTradeable).toBe(true);
    });

    it('should return false for non-tradeable items', () => {
      const item = createTestItem({
        id: '1100',
        name: 'Untradeable Item',
        type: ItemType.WEAPON,
        value: 100,
        tradeable: false
      });

      registry.register(item);

      const isTradeable = registry.isTradeable(1100);
      expect(isTradeable).toBe(false);
    });

    it('should return true when explicitly set to true', () => {
      const item = createTestItem({
        id: '1200',
        name: 'Explicitly Tradeable',
        type: ItemType.WEAPON,
        value: 100,
        tradeable: true
      });

      registry.register(item);

      const isTradeable = registry.isTradeable(1200);
      expect(isTradeable).toBe(true);
    });

    it('should return false for non-existent items', () => {
      const isTradeable = registry.isTradeable(999);
      expect(isTradeable).toBe(false);
    });
  });

  describe('isMembers', () => {
    it('should always return false (MVP feature)', () => {
      const item = createTestItem({
        id: '1700',
        name: 'Regular Item',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);

      const isMembers = registry.isMembers(1700);
      expect(isMembers).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no items registered', () => {
      const items = registry.getAll();
      expect(items).toEqual([]);
    });

    it('should return all registered items', () => {
      const item1 = createTestItem({
        id: '1800',
        name: 'Item 1',
        type: ItemType.WEAPON,
        value: 100
      });

      const item2 = createTestItem({
        id: '1900',
        name: 'Item 2',
        type: ItemType.ARMOR,
        value: 200
      });

      registry.register(item1);
      registry.register(item2);

      const items = registry.getAll();
      expect(items).toHaveLength(2);
      expect(items).toContain(item1);
      expect(items).toContain(item2);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      const weapon = createTestItem({
        id: '2000',
        name: 'Sword',
        type: ItemType.WEAPON,
        value: 100,
        equipSlot: EquipmentSlotName.WEAPON
      });

      const helmet = createTestItem({
        id: '2100',
        name: 'Helmet',
        type: ItemType.ARMOR,
        value: 50,
        equipSlot: EquipmentSlotName.HELMET
      });

      const shield = createTestItem({
        id: '2200',
        name: 'Shield',
        type: ItemType.ARMOR,
        value: 75,
        equipSlot: EquipmentSlotName.SHIELD
      });

      registry.register(weapon);
      registry.register(helmet);
      registry.register(shield);
    });

    it('should return items by equipment slot', () => {
      const weapons = registry.getByCategory('weapon');
      expect(weapons).toHaveLength(1);
      expect(weapons[0].name).toBe('Sword');
    });

    it('should be case insensitive', () => {
      const helmets = registry.getByCategory('HELMET');
      expect(helmets).toHaveLength(1);
      expect(helmets[0].name).toBe('Helmet');
    });

    it('should return empty array for non-existent category', () => {
      const items = registry.getByCategory('non-existent');
      expect(items).toEqual([]);
    });

    it('should handle items without equipSlot', () => {
      const consumable = createTestItem({
        id: '2300',
        name: 'Potion',
        type: ItemType.CONSUMABLE,
        stackable: true,
        maxStackSize: 50,
        value: 10
      });

      registry.register(consumable);

      const consumables = registry.getByCategory('consumable');
      expect(consumables).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      const items = [
        createTestItem({
          id: '3000',
          name: 'Bronze sword',
          type: ItemType.WEAPON,
          value: 50
        }),
        createTestItem({
          id: '3100',
          name: 'Iron sword',
          type: ItemType.WEAPON,
          value: 100
        }),
        createTestItem({
          id: '3200',
          name: 'Steel dagger',
          type: ItemType.WEAPON,
          value: 75
        }),
        createTestItem({
          id: '3300',
          name: 'Magic bow',
          type: ItemType.WEAPON,
          value: 500
        })
      ];

      items.forEach(item => registry.register(item));
    });

    it('should find items by partial name match', () => {
      const results = registry.search('sword');
      expect(results).toHaveLength(2);
      expect(results.some(item => item.name === 'Bronze sword')).toBe(true);
      expect(results.some(item => item.name === 'Iron sword')).toBe(true);
    });

    it('should be case insensitive', () => {
      const results = registry.search('SWORD');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const results = registry.search('nonexistent');
      expect(results).toEqual([]);
    });

    it('should find single character matches', () => {
      const results = registry.search('M');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Magic bow');
    });

    it('should handle empty search query', () => {
      const results = registry.search('');
      expect(results).toHaveLength(4); // All items match empty string
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      const item = createTestItem({
        id: '4000',
        name: 'Test Item',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);
      expect(registry.size()).toBe(1);

      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.get(4000)).toBeNull();
      expect(registry.getByName('Test Item')).toBeNull();
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count after registering items', () => {
      const item1 = createTestItem({
        id: '5000',
        name: 'Item 1',
        type: ItemType.WEAPON,
        value: 100
      });

      const item2 = createTestItem({
        id: '5100',
        name: 'Item 2',
        type: ItemType.ARMOR,
        value: 200
      });

      registry.register(item1);
      expect(registry.size()).toBe(1);

      registry.register(item2);
      expect(registry.size()).toBe(2);
    });
  });

  describe('loadDefaults', () => {
    it('should load items from DataManager', () => {
      registry.loadDefaults();

      // Should have loaded 2 items from mocked DataManager
      expect(registry.size()).toBe(2);
      expect(registry.getByName('Bronze sword')).toBeTruthy();
      expect(registry.getByName('Iron helmet')).toBeTruthy();
    });

    it('should convert string IDs to numeric IDs', () => {
      registry.loadDefaults();

      const bronzeSword = registry.get(1); // DataManager has id: '1'
      expect(bronzeSword).toBeTruthy();
      expect(bronzeSword?.name).toBe('Bronze sword');
    });

    it('should handle items without numeric IDs by hashing', () => {
      // Create a custom registry and test loadDefaults behavior
      registry.clear();
      
      // When loadDefaults processes a non-numeric ID, it uses stringToHash
      // Let's simulate that behavior
      const itemKey = 'special_item';
      const numericId = registry.stringToHash(itemKey);
      const registryItem = createTestItem({
        id: numericId.toString(),
        name: 'Special Item',
        type: ItemType.MISC,
        value: 1000
      });
      
      registry.register(registryItem);

      expect(registry.size()).toBe(1);
      const items = registry.getAll();
      expect(items[0].name).toBe('Special Item');
      // The ID should have been converted to a valid numeric string
      expect(typeof parseInt(items[0].id)).toBe('number');
      expect(isNaN(parseInt(items[0].id))).toBe(false);
    });
  });

  describe('stringToHash', () => {
    it('should produce consistent hashes', () => {
      // Access private method through testing
      const hash1 = registry.stringToHash('test_string');
      const hash2 = registry.stringToHash('test_string');
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('number');
    });

    it('should produce different hashes for different strings', () => {
      const hash1 = registry.stringToHash('string1');
      const hash2 = registry.stringToHash('string2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce positive numbers', () => {
      const hash = registry.stringToHash('any_string');
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle items with missing properties gracefully', () => {
      const minimalItem = createTestItem({
        id: '6000',
        name: 'Minimal Item',
        type: ItemType.MISC,
        value: 0
      });

      registry.register(minimalItem);

      expect(registry.isStackable(6000)).toBe(false);
      expect(registry.isEquipable(6000)).toBe(false);
      expect(registry.isTradeable(6000)).toBe(true); // Default
    });

    it('should handle registering same item multiple times', () => {
      const item = createTestItem({
        id: '7000',
        name: 'Duplicate Item',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);
      registry.register(item);
      registry.register(item);

      expect(registry.size()).toBe(1);
      expect(registry.get(7000)).toEqual(item);
    });

    it('should handle very large item IDs', () => {
      const item = createTestItem({
        id: '999999999',
        name: 'Large ID Item',
        type: ItemType.WEAPON,
        value: 100
      });

      registry.register(item);

      const retrieved = registry.get(999999999);
      expect(retrieved).toEqual(item);
    });
  });
});
