/**
 * Unit tests for HitCalculator
 * Tests hit chance calculations, attack and defense rolls
 */

import { describe, expect, it, beforeEach } from 'vitest'
import type { 
  AttackType, 
  CombatStyle, 
  EntityCombatComponent, 
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
  AttackType as AttackTypeEnum,
  PlayerCombatStyle
} from '../../types'
import { HitCalculator } from './HitCalculator'

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

describe('HitCalculator', () => {
  let hitCalculator: HitCalculator

  beforeEach(() => {
    hitCalculator = new HitCalculator()
  })

  describe('calculateAttackRoll', () => {
    const mockAttacker: StatsComponent = createMockStatsComponent({
      combatLevel: 60,
      attack: createMockSkillData(50),
      ranged: createMockSkillData(40),
      magic: createMockSkillData(30),
      strength: createMockSkillData(45),
      defense: createMockSkillData(35),
      equipment: {
        ...createMockEquipmentComponent(),
        weapon: createMockEquipmentSlot('bronze_sword', 'Bronze sword', EquipmentSlotName.WEAPON)
      }
    })

    it('should calculate melee attack roll correctly', () => {
      const roll = hitCalculator.calculateAttackRoll(mockAttacker, 'accurate' as CombatStyle, 'melee' as AttackType)
      
      // Attack roll should be calculated based on effective attack level + attack bonus
      expect(roll).toBeGreaterThan(0)
      expect(typeof roll).toBe('number')
    })

    it('should calculate ranged attack roll correctly', () => {
      const roll = hitCalculator.calculateAttackRoll(mockAttacker, 'accurate' as CombatStyle, 'ranged' as AttackType)
      
      expect(roll).toBeGreaterThan(0)
      expect(typeof roll).toBe('number')
    })

    it('should calculate magic attack roll correctly', () => {
      const roll = hitCalculator.calculateAttackRoll(mockAttacker, 'accurate' as CombatStyle, 'magic' as AttackType)
      
      expect(roll).toBeGreaterThan(0)
      expect(typeof roll).toBe('number')
    })

    it('should apply combat style bonuses', () => {
      const accurateRoll = hitCalculator.calculateAttackRoll(mockAttacker, 'accurate' as CombatStyle, 'melee' as AttackType)
      const aggressiveRoll = hitCalculator.calculateAttackRoll(mockAttacker, 'aggressive' as CombatStyle, 'melee' as AttackType)
      
      // Accurate should have +3 to attack, aggressive should have +0
      expect(accurateRoll).toBeGreaterThan(aggressiveRoll)
    })
  })

  describe('calculateDefenseRoll', () => {
    const mockDefender: StatsComponent = createMockStatsComponent({
      attack: createMockSkillData(40),
      ranged: createMockSkillData(30),
      magic: createMockSkillData(25),
      strength: createMockSkillData(40),
      defense: createMockSkillData(55),
      combatLevel: 50,
      equipment: {
        ...createMockEquipmentComponent(),
        shield: createMockEquipmentSlot('bronze_shield', 'Bronze shield', EquipmentSlotName.SHIELD)
      },
      combatBonuses: {
        ...createMockCombatBonuses(),
        defenseStab: 10,
        defenseSlash: 10,
        defenseCrush: 10,
        defenseRanged: 8,
        defenseMagic: 5
      }
    })

    it('should calculate defense roll against melee attacks', () => {
      const roll = hitCalculator.calculateDefenseRoll(mockDefender, 'melee' as AttackType)
      
      expect(roll).toBeGreaterThan(0)
      expect(typeof roll).toBe('number')
    })

    it('should calculate defense roll against ranged attacks', () => {
      const roll = hitCalculator.calculateDefenseRoll(mockDefender, 'ranged' as AttackType)
      
      expect(roll).toBeGreaterThan(0)
      expect(typeof roll).toBe('number')
    })

    it('should calculate defense roll against magic attacks', () => {
      const roll = hitCalculator.calculateDefenseRoll(mockDefender, 'magic' as AttackType)
      
      expect(roll).toBeGreaterThan(0)
      expect(typeof roll).toBe('number')
    })

    it('should include equipment defense bonuses', () => {
      const rollWithEquipment = hitCalculator.calculateDefenseRoll(mockDefender, 'melee' as AttackType)
      
      const defenderWithoutEquipment: StatsComponent = {
        ...mockDefender,
        equipment: {
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
        },
        combatBonuses: createMockCombatBonuses()
      }
      const rollWithoutEquipment = hitCalculator.calculateDefenseRoll(defenderWithoutEquipment, 'melee' as AttackType)
      
      expect(rollWithEquipment).toBeGreaterThan(rollWithoutEquipment)
    })
  })

  describe('calculateHitChance', () => {
    it('should return 0% hit chance when defense roll is much higher', () => {
      const attackRoll = 100
      const defenseRoll = 1000
      
      const hitChance = hitCalculator.calculateHitChance(attackRoll, defenseRoll)
      
      expect(hitChance).toBe(0)
    })

    it('should return 100% hit chance when attack roll is much higher', () => {
      const attackRoll = 1000
      const defenseRoll = 100
      
      const hitChance = hitCalculator.calculateHitChance(attackRoll, defenseRoll)
      
      expect(hitChance).toBe(1)
    })

    it('should return 50% hit chance when rolls are equal', () => {
      const attackRoll = 500
      const defenseRoll = 500
      
      const hitChance = hitCalculator.calculateHitChance(attackRoll, defenseRoll)
      
      expect(hitChance).toBeCloseTo(0.5, 2)
    })

    it('should return a value between 0 and 1', () => {
      const attackRoll = 300
      const defenseRoll = 400
      
      const hitChance = hitCalculator.calculateHitChance(attackRoll, defenseRoll)
      
      expect(hitChance).toBeGreaterThanOrEqual(0)
      expect(hitChance).toBeLessThanOrEqual(1)
    })
  })

  describe('private methods', () => {
    it('should calculate effective attack level correctly for accurate style', () => {
      const mockStats: StatsComponent = createMockStatsComponent({
        combatLevel: 60,
        attack: createMockSkillData(50),
        ranged: createMockSkillData(40),
        magic: createMockSkillData(30),
        strength: createMockSkillData(45),
        defense: createMockSkillData(35)
      })

      // Test via public method to verify internal calculation
      const roll = hitCalculator.calculateAttackRoll(mockStats, 'accurate' as CombatStyle, 'melee' as AttackType)
      expect(roll).toBeGreaterThan(0)
    })

    it('should get correct attack bonus for different attack types', () => {
      const mockStats: StatsComponent = createMockStatsComponent({
        attack: createMockSkillData(50),
        ranged: createMockSkillData(40),
        magic: createMockSkillData(30),
        strength: createMockSkillData(45),
        defense: createMockSkillData(35),
        combatLevel: 60,
        equipment: {
          ...createMockEquipmentComponent(),
          weapon: createMockEquipmentSlot('test_weapon', 'Test weapon', EquipmentSlotName.WEAPON)
        }
      })

      // Test different attack types through calculateAttackRoll
      const meleeRoll = hitCalculator.calculateAttackRoll(mockStats, 'accurate' as CombatStyle, 'melee' as AttackType)
      const rangedRoll = hitCalculator.calculateAttackRoll(mockStats, 'accurate' as CombatStyle, 'ranged' as AttackType)
      const magicRoll = hitCalculator.calculateAttackRoll(mockStats, 'accurate' as CombatStyle, 'magic' as AttackType)

      expect(meleeRoll).toBeGreaterThan(0)
      expect(rangedRoll).toBeGreaterThan(0)
      expect(magicRoll).toBeGreaterThan(0)
    })

    it('should calculate defense bonuses correctly', () => {
      const mockStats = createMockStatsComponent({
        attack: { level: 40, xp: 1600 },
        ranged: { level: 30, xp: 900 },
        magic: { level: 25, xp: 625 },
        strength: { level: 40, xp: 1600 },
        defense: { level: 55, xp: 3025 },
        health: { current: 99, max: 99 },
        combatLevel: 50,
        equipment: {
          helmet: { id: 'bronze_helmet', name: 'Bronze helmet', slot: EquipmentSlotName.HELMET, itemId: 'bronze_helmet', item: null },
          shield: { id: 'bronze_shield', name: 'Bronze shield', slot: EquipmentSlotName.SHIELD, itemId: 'bronze_shield', item: null }
        } as EquipmentComponent,
        activePrayers: {
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
      })

      // Test through calculateDefenseRoll to verify bonus application
      const defenseRoll = hitCalculator.calculateDefenseRoll(mockStats, 'melee' as AttackType)
      expect(defenseRoll).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle stats with missing skills', () => {
      const incompleteStats = createMockStatsComponent({
        attack: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        health: { current: 10, max: 10 },
        combatLevel: 3,
        level: 3,
        equipment: {
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
        },
        activePrayers: {
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
      })

      const attackRoll = hitCalculator.calculateAttackRoll(incompleteStats, 'accurate' as CombatStyle, 'melee' as AttackType)
      const defenseRoll = hitCalculator.calculateDefenseRoll(incompleteStats, 'melee' as AttackType)

      expect(attackRoll).toBeGreaterThan(0)
      expect(defenseRoll).toBeGreaterThan(0)
    })

    it('should handle stats with no equipment', () => {
      const statsWithoutEquipment = createMockStatsComponent({
        attack: { level: 50, xp: 2500 },
        ranged: { level: 40, xp: 1600 },
        magic: { level: 30, xp: 900 },
        strength: { level: 45, xp: 2025 },
        defense: { level: 35, xp: 1225 },
        health: { current: 99, max: 99 },
        combatLevel: 60,
        level: 60,
        equipment: {
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
        },
        activePrayers: {
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
      })

      const attackRoll = hitCalculator.calculateAttackRoll(statsWithoutEquipment, 'accurate' as CombatStyle, 'melee' as AttackType)
      const defenseRoll = hitCalculator.calculateDefenseRoll(statsWithoutEquipment, 'melee' as AttackType)

      expect(attackRoll).toBeGreaterThan(0)
      expect(defenseRoll).toBeGreaterThan(0)
    })

    it('should handle EntityCombatComponent in defense calculation', () => {
      const mockStats = createMockStatsComponent({
        attack: { level: 40, xp: 1600 },
        defense: { level: 55, xp: 3025 },
        health: { current: 99, max: 99 },
        combatLevel: 50,
        level: 50,
        equipment: {
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
        },
        activePrayers: {
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
      })

      const mockCombatComponent: EntityCombatComponent = {
        level: 50,
        health: 99,
        maxHealth: 99,
        attackLevel: 50,
        strengthLevel: 50,
        defenseLevel: 50,
        rangedLevel: 50,
        inCombat: true,
        combatTarget: 'enemy1',
        lastAttackTime: Date.now(),
        combatStyle: PlayerCombatStyle.DEFENSE
      }

      const defenseRoll = hitCalculator.calculateDefenseRoll(mockStats, 'melee' as AttackType, mockCombatComponent)
      expect(defenseRoll).toBeGreaterThan(0)
    })

    it('should handle extreme values gracefully', () => {
      const extremeStats = createMockStatsComponent({
        attack: { level: 99, xp: 13034431 },
        ranged: { level: 99, xp: 13034431 },
        magic: { level: 99, xp: 13034431 },
        strength: { level: 99, xp: 13034431 },
        defense: { level: 99, xp: 13034431 },
        health: { current: 99, max: 99 },
        combatLevel: 126,
        level: 99,
        equipment: {
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
        },
        activePrayers: {
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
      })

      const attackRoll = hitCalculator.calculateAttackRoll(extremeStats, 'accurate' as CombatStyle, 'melee' as AttackType)
      const defenseRoll = hitCalculator.calculateDefenseRoll(extremeStats, 'melee' as AttackType)
      const hitChance = hitCalculator.calculateHitChance(attackRoll, defenseRoll)

      expect(attackRoll).toBeGreaterThan(0)
      expect(defenseRoll).toBeGreaterThan(0)
      expect(hitChance).toBeGreaterThanOrEqual(0)
      expect(hitChance).toBeLessThanOrEqual(1)
    })
  })
})