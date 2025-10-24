/**
 * General Helpers Tests
 * Tests for ID generation, async operations, retries, and RPG game mechanics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateId,
  sleep,
  retry,
  parseAssetType,
  parseBuildingType,
  parseWeaponType,
  getPolycountForType,
  MATERIAL_TIERS,
  generateMaterialDescription,
  generateTierBatch,
  DIFFICULTY_LEVELS,
  ExponentialBackoff
} from '@/utils/helpers'

describe('helpers', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    it('should include timestamp and random string', () => {
      const id = generateId()
      expect(id).toMatch(/^\d+-[a-z0-9]+$/)
    })

    it('should generate different IDs on successive calls', () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(generateId())
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('sleep', () => {
    it('should delay for specified duration', async () => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some variance
    })

    it('should resolve promise', async () => {
      const result = await sleep(10)
      expect(result).toBeUndefined()
    })
  })

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await retry(fn, 3, 10)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const result = await retry(fn, 3, 10)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'))

      await expect(retry(fn, 2, 10)).rejects.toThrow('always fails')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should use exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const start = Date.now()
      await retry(fn, 3, 10)
      const elapsed = Date.now() - start

      // Should have delays: 10ms, 20ms
      expect(elapsed).toBeGreaterThanOrEqual(25)
    })
  })

  describe('parseAssetType', () => {
    it('should detect weapon types', () => {
      expect(parseAssetType('iron sword with sharp blade')).toBe('weapon')
      expect(parseAssetType('wooden bow')).toBe('weapon')
      expect(parseAssetType('steel axe')).toBe('weapon')
    })

    it('should detect armor types', () => {
      expect(parseAssetType('bronze helmet')).toBe('armor')
      expect(parseAssetType('steel plate armor')).toBe('armor')
      expect(parseAssetType('leather boots')).toBe('armor')
    })

    it('should detect consumable types', () => {
      expect(parseAssetType('healing potion with red liquid')).toBe('consumable')
      expect(parseAssetType('bread loaf')).toBe('consumable')
    })

    it('should detect tool types', () => {
      expect(parseAssetType('bronze pickaxe')).toBe('tool')
      expect(parseAssetType('fishing pole')).toBe('tool')
    })

    it('should detect building types', () => {
      expect(parseAssetType('stone bank building')).toBe('building')
      expect(parseAssetType('medieval castle')).toBe('building')
    })

    it('should detect resource types', () => {
      expect(parseAssetType('iron ore')).toBe('resource')
      expect(parseAssetType('oak log')).toBe('resource')
    })

    it('should detect character types', () => {
      expect(parseAssetType('goblin warrior with club')).toBe('character')
      expect(parseAssetType('skeleton archer')).toBe('character')
    })

    it('should default to decoration', () => {
      expect(parseAssetType('random object')).toBe('decoration')
    })
  })

  describe('parseBuildingType', () => {
    it('should detect bank', () => {
      expect(parseBuildingType('large stone bank with vault')).toBe('bank')
    })

    it('should detect store', () => {
      expect(parseBuildingType('general store with supplies')).toBe('store')
      expect(parseBuildingType('blacksmith shop')).toBe('store')
    })

    it('should detect house', () => {
      expect(parseBuildingType('wooden house')).toBe('house')
      expect(parseBuildingType('player home')).toBe('house')
    })

    it('should detect temple', () => {
      expect(parseBuildingType('stone temple')).toBe('temple')
      expect(parseBuildingType('medieval church')).toBe('temple')
    })

    it('should detect castle', () => {
      expect(parseBuildingType('stone castle')).toBe('castle')
    })

    it('should detect guild', () => {
      expect(parseBuildingType('warriors guild')).toBe('guild')
    })

    it('should detect inn', () => {
      expect(parseBuildingType('medieval inn with tavern')).toBe('inn')
      expect(parseBuildingType('local tavern')).toBe('inn')
    })

    it('should detect tower', () => {
      expect(parseBuildingType('wizard tower')).toBe('tower')
    })

    it('should default to house', () => {
      expect(parseBuildingType('random building')).toBe('house')
    })
  })

  describe('parseWeaponType', () => {
    it('should detect weapon types', () => {
      expect(parseWeaponType('iron longsword with leather grip')).toBe('sword')
      expect(parseWeaponType('wooden bow with arrows')).toBe('bow')
      expect(parseWeaponType('steel battleaxe')).toBe('battleaxe')
    })

    it('should return undefined for non-weapons', () => {
      expect(parseWeaponType('leather armor')).toBeUndefined()
      expect(parseWeaponType('healing potion')).toBeUndefined()
    })

    it('should be case-insensitive', () => {
      expect(parseWeaponType('IRON SWORD')).toBe('sword')
    })
  })

  describe('getPolycountForType', () => {
    it('should return polycount for known types', () => {
      expect(getPolycountForType('weapon')).toBe(5000)
      expect(getPolycountForType('armor')).toBe(8000)
      expect(getPolycountForType('building')).toBe(30000)
      expect(getPolycountForType('character')).toBe(15000)
    })

    it('should return default for unknown types', () => {
      expect(getPolycountForType('unknown')).toBe(5000)
    })
  })

  describe('MATERIAL_TIERS', () => {
    it('should have bronze tier', () => {
      expect(MATERIAL_TIERS.bronze.level).toBe(1)
      expect(MATERIAL_TIERS.bronze.rarity).toBe('common')
    })

    it('should have steel tier', () => {
      expect(MATERIAL_TIERS.steel.level).toBe(10)
      expect(MATERIAL_TIERS.steel.rarity).toBe('uncommon')
    })

    it('should have mithril tier', () => {
      expect(MATERIAL_TIERS.mithril.level).toBe(20)
      expect(MATERIAL_TIERS.mithril.rarity).toBe('rare')
    })

    it('should have wood tier', () => {
      expect(MATERIAL_TIERS.wood.level).toBe(1)
    })

    it('should have leather tier', () => {
      expect(MATERIAL_TIERS.leather.level).toBe(1)
    })
  })

  describe('generateMaterialDescription', () => {
    it('should add material description for weapons', () => {
      const result = generateMaterialDescription(
        'A sharp sword',
        'mithril',
        'weapon'
      )
      expect(result).toContain('magical silvery-blue metal')
      expect(result).toContain('glowing magical runes')
    })

    it('should add material description for armor', () => {
      const result = generateMaterialDescription(
        'Sturdy helmet',
        'steel',
        'armor'
      )
      expect(result).toContain('made from')
      expect(result).toContain('professional craftsmanship')
    })

    it('should add material description for tools', () => {
      const result = generateMaterialDescription(
        'Mining pickaxe',
        'bronze',
        'tool'
      )
      expect(result).toContain('crafted from')
    })
  })

  describe('generateTierBatch', () => {
    it('should generate items for all tiers', () => {
      const baseItem = {
        name: 'Sword',
        description: 'A sharp blade',
        type: 'weapon',
        subtype: 'melee'
      }

      const result = generateTierBatch(baseItem, ['bronze', 'steel', 'mithril'], 'weapon')

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Bronze Sword')
      expect(result[1].name).toBe('Steel Sword')
      expect(result[2].name).toBe('Mithril Sword')
    })

    it('should add tier metadata', () => {
      const baseItem = {
        name: 'Sword',
        description: 'A blade',
        type: 'weapon'
      }

      const result = generateTierBatch(baseItem, ['bronze'], 'weapon')

      expect(result[0].metadata?.tier).toBe('bronze')
      expect(result[0].metadata?.level).toBe(1)
      expect(result[0].metadata?.rarity).toBe('common')
    })

    it('should preserve base metadata', () => {
      const baseItem = {
        name: 'Sword',
        description: 'A blade',
        type: 'weapon',
        metadata: { custom: 'value' }
      }

      const result = generateTierBatch(baseItem, ['bronze'], 'weapon')

      expect(result[0].metadata?.custom).toBe('value')
      expect(result[0].metadata?.tier).toBe('bronze')
    })
  })

  describe('DIFFICULTY_LEVELS', () => {
    it('should have beginner difficulty', () => {
      expect(DIFFICULTY_LEVELS[1].name).toBe('Beginner')
      expect(DIFFICULTY_LEVELS[1].levelRange).toEqual([1, 5])
    })

    it('should have intermediate difficulty', () => {
      expect(DIFFICULTY_LEVELS[2].name).toBe('Intermediate')
      expect(DIFFICULTY_LEVELS[2].levelRange).toEqual([6, 15])
    })

    it('should have advanced difficulty', () => {
      expect(DIFFICULTY_LEVELS[3].name).toBe('Advanced')
      expect(DIFFICULTY_LEVELS[3].levelRange).toEqual([16, 25])
    })
  })

  describe('ExponentialBackoff', () => {
    let backoff: ExponentialBackoff

    beforeEach(() => {
      backoff = new ExponentialBackoff(1000, 10000, 2.0, 0.1)
    })

    it('should start with initial delay', () => {
      const delay = backoff.getCurrentDelay()
      expect(delay).toBe(1000)
    })

    it('should increase delay exponentially', () => {
      const delay1 = backoff.getNextDelay()
      expect(delay1).toBeGreaterThanOrEqual(900) // 1000 - 10% jitter
      expect(delay1).toBeLessThanOrEqual(1100) // 1000 + 10% jitter

      const delay2 = backoff.getNextDelay()
      expect(delay2).toBeGreaterThanOrEqual(1800) // 2000 - 10% jitter
      expect(delay2).toBeLessThanOrEqual(2200) // 2000 + 10% jitter
    })

    it('should cap at max delay', () => {
      // Get many delays to reach max
      for (let i = 0; i < 10; i++) {
        backoff.getNextDelay()
      }

      const delay = backoff.getCurrentDelay()
      expect(delay).toBeLessThanOrEqual(10000)
    })

    it('should reset to initial delay', () => {
      backoff.getNextDelay()
      backoff.getNextDelay()
      backoff.reset()

      expect(backoff.getCurrentDelay()).toBe(1000)
    })

    it('should track metrics', () => {
      backoff.getNextDelay()
      backoff.getNextDelay()
      backoff.getNextDelay()

      const metrics = backoff.getMetrics()
      expect(metrics.totalPolls).toBe(3)
      expect(metrics.elapsedTime).toBeGreaterThan(0)
      expect(metrics.currentDelay).toBeGreaterThan(1000)
    })

    it('should calculate average interval', () => {
      backoff.getNextDelay()
      backoff.getNextDelay()

      const metrics = backoff.getMetrics()
      expect(metrics.averageInterval).toBeGreaterThan(0)
    })

    it('should detect timeout', () => {
      expect(backoff.isTimedOut(100)).toBe(false)

      // Wait a bit
      const start = Date.now()
      while (Date.now() - start < 150) {
        // busy wait
      }

      expect(backoff.isTimedOut(100)).toBe(true)
    })

    it('should track time since last reset', () => {
      const metrics1 = backoff.getMetrics()
      expect(metrics1.timeSinceLastReset).toBeGreaterThanOrEqual(0)

      // Wait and reset
      const start = Date.now()
      while (Date.now() - start < 50) {
        // busy wait
      }
      backoff.reset()

      const metrics2 = backoff.getMetrics()
      expect(metrics2.timeSinceLastReset).toBeLessThan(metrics1.timeSinceLastReset + 50)
    })
  })
})
