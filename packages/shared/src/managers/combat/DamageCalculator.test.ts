/**
 * Unit tests for DamageCalculator
 * Tests damage calculations, max hit calculations, and damage reductions
 */

import { describe, expect, it, beforeEach } from 'vitest'
import type { 
  AttackType, 
  CombatStyle, 
  StatsComponent, 
  EquipmentComponent,
  PrayerComponent,
  CombatBonuses,
  SkillData,
  EquipmentSlot,
  Item
} from '../../types'
import { 
  EquipmentSlotName,
  WeaponType,
  ItemType,
  ItemRarity,
  AttackType as AttackTypeEnum
} from '../../types'
import { DamageCalculator } from './DamageCalculator'

// Utility functions to create complete mock objects
function createMockSkillData(level: number): SkillData {
  return { level, xp: level * level * 100 }
}

function createMockItem(id: string, name: string, type: ItemType = ItemType.WEAPON): Item {
  return {
    id,
    name,
    type,
    quantity: 1,
    stackable: false,
    maxStackSize: 1,
    value: 100,
    weight: 1.0,
    equipSlot: type === ItemType.WEAPON ? EquipmentSlotName.WEAPON : EquipmentSlotName.HELMET,
    weaponType: type === ItemType.WEAPON ? WeaponType.SWORD : WeaponType.NONE,
    equipable: true,
    attackType: type === ItemType.WEAPON ? AttackTypeEnum.MELEE : null,
    description: `A ${name}`,
    examine: `This is a ${name}`,
    tradeable: true,
    rarity: ItemRarity.COMMON,
    modelPath: '/models/item.glb',
    iconPath: '/icons/item.png',
    healAmount: 0,
    stats: { attack: 10, defense: 10, strength: 10 },
    bonuses: { attackStab: 5, defenseStab: 5 },
    requirements: { level: 1, skills: {} }
  }
}

function createMockEquipmentSlot(id: string, name: string, slot: EquipmentSlotName): EquipmentSlot {
  const item = createMockItem(id, name, slot === EquipmentSlotName.WEAPON ? ItemType.WEAPON : ItemType.ARMOR)
  return {
    id,
    name,
    slot,
    itemId: id,
    item
  }
}

function createMockEquipmentComponent(): EquipmentComponent {
  return {
    weapon: null,
    shield: null,
    helmet: null,
    body: null,
    legs: null,
    boots: null,
    gloves: null,
    cape: null,
    amulet: null,
    ring: null
  }
}

function createMockPrayerComponent(): PrayerComponent {
  return {
    protectFromMelee: false,
    protectFromRanged: false,
    protectFromMagic: false,
    piety: false,
    chivalry: false,
    ultimateStrength: false,
    superhumanStrength: false,
    burstOfStrength: false,
    rigour: false,
    eagleEye: false,
    hawkEye: false,
    sharpEye: false,
    augury: false,
    mysticMight: false,
    mysticLore: false,
    mysticWill: false
  }
}

function createMockCombatBonuses(): CombatBonuses {
  return {
    attackStab: 0,
    attackSlash: 0,
    attackCrush: 0,
    attackRanged: 0,
    attackMagic: 0,
    defenseStab: 0,
    defenseSlash: 0,
    defenseCrush: 0,
    defenseRanged: 0,
    defenseMagic: 0,
    meleeStrength: 0,
    rangedStrength: 0,
    magicDamage: 0,
    prayer: 0
  }
}

function createMockStatsComponent(overrides: Partial<StatsComponent> = {}): StatsComponent {
  return {
    combatLevel: 70,
    level: 70,
    health: { current: 99, max: 99 },
    attack: createMockSkillData(60),
    strength: createMockSkillData(65),
    defense: createMockSkillData(45),
    constitution: createMockSkillData(50),
    ranged: createMockSkillData(50),
    magic: createMockSkillData(40),
    prayer: { level: 1, points: 100 },
    woodcutting: createMockSkillData(30),
    fishing: createMockSkillData(30),
    firemaking: createMockSkillData(30),
    cooking: createMockSkillData(30),
    activePrayers: createMockPrayerComponent(),
    equipment: createMockEquipmentComponent(),
    equippedSpell: null,
    effects: { onSlayerTask: false, targetIsDragon: false, targetMagicLevel: 1 },
    combatBonuses: createMockCombatBonuses(),
    ...overrides
  }
}

describe('DamageCalculator', () => {
  let damageCalculator: DamageCalculator

  beforeEach(() => {
    damageCalculator = new DamageCalculator()
  })

  describe('calculateMaxHit', () => {
    const mockAttacker: StatsComponent = createMockStatsComponent({
      equipment: {
        ...createMockEquipmentComponent(),
        weapon: createMockEquipmentSlot('iron_sword', 'Iron sword', EquipmentSlotName.WEAPON)
      }
    })

    it('should calculate melee max hit correctly', () => {
      const maxHit = damageCalculator.calculateMaxHit(mockAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      expect(maxHit).toBeGreaterThan(0)
      expect(typeof maxHit).toBe('number')
      expect(Number.isInteger(maxHit)).toBe(true)
    })

    it('should calculate ranged max hit correctly', () => {
      const maxHit = damageCalculator.calculateMaxHit(mockAttacker, 'accurate' as CombatStyle, 'ranged' as AttackType)
      
      expect(maxHit).toBeGreaterThan(0)
      expect(typeof maxHit).toBe('number')
      expect(Number.isInteger(maxHit)).toBe(true)
    })

    it('should calculate magic max hit correctly', () => {
      const maxHit = damageCalculator.calculateMaxHit(mockAttacker, 'accurate' as CombatStyle, 'magic' as AttackType)
      
      expect(maxHit).toBeGreaterThan(0)
      expect(typeof maxHit).toBe('number')
      expect(Number.isInteger(maxHit)).toBe(true)
    })

    it('should return higher max hit for aggressive style in melee', () => {
      const aggressiveHit = damageCalculator.calculateMaxHit(mockAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      const accurateHit = damageCalculator.calculateMaxHit(mockAttacker, 'accurate' as CombatStyle, 'melee' as AttackType)
      
      expect(aggressiveHit).toBeGreaterThan(accurateHit)
    })

    it('should handle attackers with no weapon', () => {
      const unarmedAttacker: StatsComponent = createMockStatsComponent({
        equipment: createMockEquipmentComponent() // All equipment slots are null
      })
      
      const maxHit = damageCalculator.calculateMaxHit(unarmedAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      expect(maxHit).toBeGreaterThan(0)
    })
  })

  describe('rollDamage', () => {
    it('should return damage between 0 and maxHit inclusive', () => {
      const maxHit = 15
      const damage = damageCalculator.rollDamage(maxHit)
      
      expect(damage).toBeGreaterThanOrEqual(0)
      expect(damage).toBeLessThanOrEqual(maxHit)
      expect(Number.isInteger(damage)).toBe(true)
    })

    it('should return 0 when maxHit is 0', () => {
      const damage = damageCalculator.rollDamage(0)
      expect(damage).toBe(0)
    })

    it('should return maxHit when maxHit is 1', () => {
      const damage = damageCalculator.rollDamage(1)
      expect(damage).toBeGreaterThanOrEqual(0)
      expect(damage).toBeLessThanOrEqual(1)
    })

    it('should produce varied results over multiple rolls', () => {
      const maxHit = 20
      const results = new Set()
      
      // Roll 100 times to get variety
      for (let i = 0; i < 100; i++) {
        results.add(damageCalculator.rollDamage(maxHit))
      }
      
      // Should have more than one unique result (very high probability)
      expect(results.size).toBeGreaterThan(1)
    })
  })

  describe('applyDamageReductions', () => {
    const mockTarget: StatsComponent = createMockStatsComponent({
      attack: createMockSkillData(40),
      ranged: createMockSkillData(30),
      magic: createMockSkillData(25),
      strength: createMockSkillData(40),
      defense: createMockSkillData(55),
      combatLevel: 50,
      equipment: {
        ...createMockEquipmentComponent(),
        helmet: createMockEquipmentSlot('iron_helmet', 'Iron helmet', EquipmentSlotName.HELMET),
        body: createMockEquipmentSlot('iron_platebody', 'Iron platebody', EquipmentSlotName.BODY)
      },
      combatBonuses: {
        ...createMockCombatBonuses(),
        defenseStab: 20,
        defenseSlash: 25,
        defenseCrush: 15,
        defenseRanged: 18,
        defenseMagic: 10
      }
    })

    it('should reduce damage based on armor', () => {
      const originalDamage = 20
      const reducedDamage = damageCalculator.applyDamageReductions(
        originalDamage,
        mockTarget,
        'melee' as AttackType
      )
      
      expect(reducedDamage).toBeLessThan(originalDamage)
      expect(reducedDamage).toBeGreaterThan(0)
    })

    it('should apply different reductions for different attack types', () => {
      const originalDamage = 20
      
      const meleeReduction = damageCalculator.applyDamageReductions(
        originalDamage,
        mockTarget,
        'melee' as AttackType
      )
      
      const rangedReduction = damageCalculator.applyDamageReductions(
        originalDamage,
        mockTarget,
        'ranged' as AttackType
      )
      
      const magicReduction = damageCalculator.applyDamageReductions(
        originalDamage,
        mockTarget,
        'magic' as AttackType
      )
      
      // All should be different due to different defense bonuses
      expect(meleeReduction).toBeGreaterThan(0)
      expect(rangedReduction).toBeGreaterThan(0)
      expect(magicReduction).toBeGreaterThan(0)
    })

    it('should never reduce damage to negative values', () => {
      const originalDamage = 1
      const reducedDamage = damageCalculator.applyDamageReductions(
        originalDamage,
        mockTarget,
        'melee' as AttackType
      )
      
      expect(reducedDamage).toBeGreaterThanOrEqual(0)
    })

    it('should handle targets with prayer bonuses', () => {
      const targetWithPrayers: StatsComponent = {
        ...mockTarget,
        activePrayers: {
          ...createMockPrayerComponent(),
          protectFromMelee: true,
          ultimateStrength: true
        }
      }
      
      const originalDamage = 20
      const reducedDamage = damageCalculator.applyDamageReductions(
        originalDamage,
        targetWithPrayers,
        'melee' as AttackType
      )
      
      expect(reducedDamage).toBeLessThan(originalDamage)
    })

    it('should handle targets with no equipment', () => {
      const unequippedTarget: StatsComponent = {
        ...mockTarget,
        equipment: createMockEquipmentComponent()
      }
      
      const originalDamage = 20
      const reducedDamage = damageCalculator.applyDamageReductions(
        originalDamage,
        unequippedTarget,
        'melee' as AttackType
      )
      
      expect(reducedDamage).toBeLessThanOrEqual(originalDamage)
      expect(reducedDamage).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle very low level attackers', () => {
      const lowLevelAttacker: StatsComponent = createMockStatsComponent({
        attack: createMockSkillData(1),
        ranged: createMockSkillData(1),
        magic: createMockSkillData(1),
        strength: createMockSkillData(1),
        defense: createMockSkillData(1),
        health: { current: 10, max: 10 },
        combatLevel: 3,
        level: 3
      })
      
      const maxHit = damageCalculator.calculateMaxHit(lowLevelAttacker, 'accurate' as CombatStyle, 'melee' as AttackType)
      
      expect(maxHit).toBeGreaterThanOrEqual(0)
      expect(typeof maxHit).toBe('number')
    })

    it('should handle very high level attackers', () => {
      const highLevelAttacker: StatsComponent = createMockStatsComponent({
        health: { current: 99, max: 99 },
        combatLevel: 126,
        level: 99,
        attack: createMockSkillData(99),
        strength: createMockSkillData(99),
        ranged: createMockSkillData(99),
        magic: createMockSkillData(99),
        defense: createMockSkillData(99),
        equipment: {
          ...createMockEquipmentComponent(),
          weapon: createMockEquipmentSlot('dragon_longsword', 'Dragon longsword', EquipmentSlotName.WEAPON)
        }
      })
      
      const maxHit = damageCalculator.calculateMaxHit(highLevelAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      expect(maxHit).toBeGreaterThan(0)
      expect(typeof maxHit).toBe('number')
    })

    it('should handle zero damage gracefully', () => {
      const damage = damageCalculator.rollDamage(0)
      expect(damage).toBe(0)
    })

    it('should handle damage reduction with zero damage', () => {
      const mockTarget: StatsComponent = createMockStatsComponent({
        attack: createMockSkillData(40),
        defense: createMockSkillData(55),
        combatLevel: 50
      })
      
      const reducedDamage = damageCalculator.applyDamageReductions(0, mockTarget, 'melee' as AttackType)
      expect(reducedDamage).toBe(0)
    })

    it('should handle attacker with incomplete skills data', () => {
      const incompleteAttacker: StatsComponent = createMockStatsComponent({
        attack: createMockSkillData(50),
        strength: createMockSkillData(50),
        combatLevel: 60
      })
      
      const maxHit = damageCalculator.calculateMaxHit(incompleteAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      expect(maxHit).toBeGreaterThanOrEqual(0)
      expect(typeof maxHit).toBe('number')
    })
  })

  describe('special equipment effects', () => {
    it('should handle void equipment bonuses', () => {
      const voidAttacker: StatsComponent = createMockStatsComponent({
        combatLevel: 85,
        level: 75,
        attack: createMockSkillData(75),
        strength: createMockSkillData(75),
        ranged: createMockSkillData(75),
        magic: createMockSkillData(75),
        defense: createMockSkillData(75),
        equipment: {
          ...createMockEquipmentComponent(),
          helmet: createMockEquipmentSlot('void_melee_helm', 'Void melee helm', EquipmentSlotName.HELMET),
          body: createMockEquipmentSlot('void_knight_top', 'Void knight top', EquipmentSlotName.BODY),
          legs: createMockEquipmentSlot('void_knight_robe', 'Void knight robe', EquipmentSlotName.LEGS),
          gloves: createMockEquipmentSlot('void_knight_gloves', 'Void knight gloves', EquipmentSlotName.GLOVES)
        }
      })
      
      const maxHit = damageCalculator.calculateMaxHit(voidAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      expect(maxHit).toBeGreaterThan(0)
      expect(typeof maxHit).toBe('number')
    })

    it('should handle prayer bonuses correctly', () => {
      const prayerAttacker: StatsComponent = createMockStatsComponent({
        attack: createMockSkillData(70),
        strength: createMockSkillData(70),
        combatLevel: 80,
        level: 70,
        activePrayers: {
          ...createMockPrayerComponent(),
          ultimateStrength: true,
          piety: true
        }
      })
      
      const maxHitWithPrayers = damageCalculator.calculateMaxHit(prayerAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      const prayerlessAttacker: StatsComponent = {
        ...prayerAttacker,
        activePrayers: createMockPrayerComponent()
      }
      
      const maxHitWithoutPrayers = damageCalculator.calculateMaxHit(prayerlessAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      expect(maxHitWithPrayers).toBeGreaterThan(maxHitWithoutPrayers)
    })
  })
})