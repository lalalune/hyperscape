/**
 * Unit tests for EquipmentBonusCalculator
 * Tests equipment bonus calculations, requirements checking, and weight calculations
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type {
  Item,
  SkillData,
  StatsComponent
} from '../../types'
import {
  AttackType,
  EquipmentSlotName,
  ItemRarity,
  ItemType,
  WeaponType
} from '../../types/core'
import { EquipmentBonusCalculator } from './EquipmentBonusCalculator'
import { ItemRegistry } from './ItemRegistry'

// Utility functions to create complete mock objects
function createMockSkillData(level: number): SkillData {
  return { level, xp: level * level * 100 }
}

function createMockItem(id: string, name: string, type: ItemType = ItemType.ARMOR, overrides: Partial<Item> = {}): Item {
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
    attackType: type === ItemType.WEAPON ? AttackType.MELEE : null,
    description: `A ${name}`,
    examine: `This is a ${name}`,
    tradeable: true,
    rarity: ItemRarity.COMMON,
    modelPath: '/models/item.glb',
    iconPath: '/icons/item.png',
    healAmount: 0,
    stats: { attack: 10, defense: 10, strength: 10 },
    bonuses: { attackStab: 0, defenseStab: 0 },
    requirements: { level: 1, skills: {} },
    ...overrides
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
    },
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
    equippedSpell: null,
    effects: { onSlayerTask: false, targetIsDragon: false, targetMagicLevel: 1 },
    combatBonuses: {
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
    },
    ...overrides
  }
}

describe('EquipmentBonusCalculator', () => {
  let calculator: EquipmentBonusCalculator
  let mockItemRegistry: ItemRegistry

  beforeEach(() => {
    mockItemRegistry = new ItemRegistry()
    calculator = new EquipmentBonusCalculator(mockItemRegistry)
  })

  describe('calculateTotalBonuses', () => {
    it('should calculate empty bonuses when no equipment', () => {
      const equipment: Record<string, Item | null> = {}
      const bonuses = calculator.calculateTotalBonuses(equipment)

      expect(bonuses).toEqual({
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 0,
        defenseSlash: 0,
        defenseCrush: 0,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      })
    })

    it('should calculate bonuses from single piece of equipment', () => {
      const helmet: Item = createMockItem('iron_helmet', 'Iron helmet', ItemType.ARMOR, {
        equipSlot: EquipmentSlotName.HELMET,
        bonuses: {
          defenseStab: 5,
          defenseSlash: 5,
          defenseCrush: 5
        }
      })

      const equipment: Record<string, Item | null> = {
        helmet
      }

      const bonuses = calculator.calculateTotalBonuses(equipment)

      expect(bonuses.defenseStab).toBe(5)
      expect(bonuses.defenseSlash).toBe(5)
      expect(bonuses.defenseCrush).toBe(5)
      expect(bonuses.attackStab).toBe(0)
    })

    it('should sum bonuses from multiple equipment pieces', () => {
      const helmet: Item = createMockItem('iron_helmet', 'Iron helmet', ItemType.ARMOR, {
        equipSlot: EquipmentSlotName.HELMET,
        bonuses: { defenseStab: 5, defenseSlash: 5, defenseCrush: 5 }
      })

      const platebody: Item = createMockItem('iron_platebody', 'Iron platebody', ItemType.ARMOR, {
        equipSlot: EquipmentSlotName.BODY,
        value: 500,
        bonuses: { defenseStab: 15, defenseSlash: 15, defenseCrush: 15 }
      })

      const equipment: Record<string, Item | null> = {
        helmet,
        body: platebody
      }

      const bonuses = calculator.calculateTotalBonuses(equipment)

      expect(bonuses.defenseStab).toBe(20)
      expect(bonuses.defenseSlash).toBe(20)
      expect(bonuses.defenseCrush).toBe(20)
    })

    it('should handle null equipment slots', () => {
      const equipment: Record<string, Item | null> = {
        helmet: null,
        body: createMockItem('iron_platebody', 'Iron platebody', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.BODY,
          value: 500,
          bonuses: { defenseStab: 15 }
        }),
        legs: null
      }

      const bonuses = calculator.calculateTotalBonuses(equipment)

      expect(bonuses.defenseStab).toBe(15)
      expect(bonuses.attackStab).toBe(0)
    })

    it('should handle items without bonuses', () => {
      const item: Item = createMockItem('cooking_pot', 'Cooking pot', ItemType.TOOL, {
        equipSlot: EquipmentSlotName.WEAPON,
        value: 10,
        bonuses: {} // No bonuses
      })

      const equipment: Record<string, Item | null> = {
        weapon: item
      }

      const bonuses = calculator.calculateTotalBonuses(equipment)

      expect(bonuses).toEqual(calculator.createEmptyBonuses())
    })
  })

  describe('meetsRequirements', () => {
    const mockStats: StatsComponent = createMockStatsComponent({
      attack: createMockSkillData(40),
      strength: createMockSkillData(35),
      defense: createMockSkillData(30),
      ranged: createMockSkillData(25),
      magic: createMockSkillData(20),
      combatLevel: 45
    })

    it('should return true for items with no requirements', () => {
      const item: Item = createMockItem('bronze_sword', 'Bronze sword', ItemType.WEAPON, {
        value: 50,
        requirements: { level: 1, skills: {} } // No specific requirements
      })

      const meetsReqs = calculator.meetsRequirements(item, mockStats)
      expect(meetsReqs).toBe(true)
    })

    it('should return true when player meets all requirements', () => {
      const item: Item = createMockItem('iron_sword', 'Iron sword', ItemType.WEAPON, {
        value: 200,
        requirements: {
          level: 30,
          skills: {
            attack: 30
          }
        }
      })

      const meetsReqs = calculator.meetsRequirements(item, mockStats)
      expect(meetsReqs).toBe(true)
    })

    it('should return false when player does not meet requirements', () => {
      const item: Item = createMockItem('dragon_sword', 'Dragon sword', ItemType.WEAPON, {
        value: 50000,
        requirements: {
          level: 60,
          skills: {
            attack: 60
          }
        }
      })

      const meetsReqs = calculator.meetsRequirements(item, mockStats)
      expect(meetsReqs).toBe(false)
    })

    it('should handle multiple requirements', () => {
      const item: Item = createMockItem('magic_bow', 'Magic bow', ItemType.WEAPON, {
        value: 10000,
        requirements: {
          level: 50,
          skills: {
            ranged: 50
          }
        }
      })

      const meetsReqs = calculator.meetsRequirements(item, mockStats)
      expect(meetsReqs).toBe(false) // Ranged requirement not met
    })

    it('should handle skill objects with level property', () => {
      const statsWithSkillObjects: StatsComponent = {
        ...mockStats,
        attack: { level: 60, xp: 273742 },
        strength: { level: 60, xp: 273742 }
      }

      const item: Item = createMockItem('dragon_sword', 'Dragon sword', ItemType.WEAPON, {
        value: 50000,
        requirements: {
          level: 60,
          skills: {
            attack: 60,
            strength: 60
          }
        }
      })

      const meetsReqs = calculator.meetsRequirements(item, statsWithSkillObjects)
      expect(meetsReqs).toBe(true)
    })

    it('should handle numeric skill values', () => {
      const statsWithNumericSkills: StatsComponent = {
        ...mockStats,
        attack: createMockSkillData(70),
        strength: createMockSkillData(70)
      }

      const item: Item = createMockItem('dragon_sword', 'Dragon sword', ItemType.WEAPON, {
        value: 50000,
        requirements: {
          level: 60,
          skills: {
            attack: 60,
            strength: 60
          }
        }
      })

      const meetsReqs = calculator.meetsRequirements(item, statsWithNumericSkills)
      expect(meetsReqs).toBe(true)
    })
  })

  describe('getEquipmentWeight', () => {
    it('should return 0 for empty equipment', () => {
      const equipment: Record<string, Item | null> = {}
      const weight = calculator.getEquipmentWeight(equipment)
      expect(weight).toBe(0)
    })

    it('should calculate total weight of equipped items', () => {
      const helmet: Item = createMockItem('iron_helmet', 'Iron helmet', ItemType.ARMOR, {
        equipSlot: EquipmentSlotName.HELMET,
        value: 100,
        weight: 2.5
      })

      const platebody: Item = createMockItem('iron_platebody', 'Iron platebody', ItemType.ARMOR, {
        equipSlot: EquipmentSlotName.BODY,
        value: 500,
        weight: 8.0
      })

      const equipment: Record<string, Item | null> = {
        helmet,
        body: platebody
      }

      const weight = calculator.getEquipmentWeight(equipment)
      expect(weight).toBe(10.5)
    })

    it('should handle items without weight property', () => {
      const item: Item = createMockItem('weightless_item', 'Weightless item', ItemType.ARMOR, {
        equipSlot: EquipmentSlotName.HELMET,
        value: 100,
        weight: 0 // No weight
      })

      const equipment: Record<string, Item | null> = {
        weapon: item
      }

      const weight = calculator.getEquipmentWeight(equipment)
      expect(weight).toBe(0)
    })

    it('should handle null equipment slots', () => {
      const equipment: Record<string, Item | null> = {
        helmet: null,
        body: createMockItem('iron_platebody', 'Iron platebody', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.BODY,
          value: 500,
          weight: 8.0
        }),
        legs: null
      }

      const weight = calculator.getEquipmentWeight(equipment)
      expect(weight).toBe(8.0)
    })
  })

  describe('createEmptyBonuses', () => {
    it('should create bonuses object with all properties set to 0', () => {
      const bonuses = calculator.createEmptyBonuses()

      expect(bonuses).toEqual({
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 0,
        defenseSlash: 0,
        defenseCrush: 0,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      })
    })
  })

  describe('getSetBonuses', () => {
    it('should return empty bonuses when no complete sets', () => {
      const equipment: Record<string, Item | null> = {
        helmet: createMockItem('dharok_helm', "Dharok's helm", ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.HELMET,
          value: 1000000
        })
      }

      const setBonuses = calculator.getSetBonuses(equipment)
      expect(setBonuses).toEqual(calculator.createEmptyBonuses())
    })

    it('should detect complete dharok set', () => {
      const equipment: Record<string, Item | null> = {
        helmet: createMockItem('dharok_helm', "Dharok's helm", ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.HELMET,
          value: 1000000
        }),
        body: createMockItem('dharok_platebody', "Dharok's platebody", ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.BODY,
          value: 2000000
        }),
        legs: createMockItem('dharok_platelegs', "Dharok's platelegs", ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.LEGS,
          value: 1500000
        }),
        weapon: createMockItem('dharok_greataxe', "Dharok's greataxe", ItemType.WEAPON, {
          value: 3000000
        })
      }

      const setBonuses = calculator.getSetBonuses(equipment)
      // Dharok's set doesn't provide direct stat bonuses (handled separately)
      expect(setBonuses).toEqual(calculator.createEmptyBonuses())
    })

    it('should detect void knight set', () => {
      const equipment: Record<string, Item | null> = {
        helmet: createMockItem('void_melee_helm', 'Void melee helm', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.HELMET,
          value: 0
        }),
        body: createMockItem('void_knight_top', 'Void knight top', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.BODY,
          value: 0
        }),
        legs: createMockItem('void_knight_robe', 'Void knight robe', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.LEGS,
          value: 0
        }),
        gloves: createMockItem('void_knight_gloves', 'Void knight gloves', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.GLOVES,
          value: 0
        })
      }

      const setBonuses = calculator.getSetBonuses(equipment)
      // Void provides percentage bonuses handled in combat calculations
      expect(setBonuses).toEqual(calculator.createEmptyBonuses())
    })
  })

  describe('calculateWeightReduction', () => {
    it('should return 0 for no weight-reducing equipment', () => {
      const equipment: Record<string, Item | null> = {
        helmet: createMockItem('iron_helmet', 'Iron helmet', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.HELMET,
          value: 100
        })
      }

      const reduction = calculator.calculateWeightReduction(equipment)
      expect(reduction).toBe(0)
    })

    it('should calculate graceful outfit weight reduction', () => {
      const equipment: Record<string, Item | null> = {
        helmet: createMockItem('graceful_hood', 'Graceful hood', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.HELMET,
          value: 0
        }),
        body: createMockItem('graceful_top', 'Graceful top', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.BODY,
          value: 0
        }),
        legs: createMockItem('graceful_legs', 'Graceful legs', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.LEGS,
          value: 0
        })
      }

      const reduction = calculator.calculateWeightReduction(equipment)
      expect(reduction).toBe(9) // 3 pieces * 3kg each
    })

    it('should give full set bonus for complete graceful', () => {
      const gracefulPieces = ['hood', 'top', 'legs', 'gloves', 'boots', 'cape']
      const equipment: Record<string, Item | null> = {}
      const slotMap: Record<string, EquipmentSlotName> = {
        hood: EquipmentSlotName.HELMET,
        top: EquipmentSlotName.BODY,
        legs: EquipmentSlotName.LEGS,
        gloves: EquipmentSlotName.GLOVES,
        boots: EquipmentSlotName.BOOTS,
        cape: EquipmentSlotName.CAPE
      }

      gracefulPieces.forEach((piece, _index) => {
        equipment[piece] = createMockItem(`graceful_${piece}`, `Graceful ${piece}`, ItemType.ARMOR, {
          equipSlot: slotMap[piece],
          value: 0
        })
      })

      const reduction = calculator.calculateWeightReduction(equipment)
      expect(reduction).toBe(21) // 6 pieces * 3kg + 3kg set bonus
    })

    it('should handle spottier cape weight reduction', () => {
      const equipment: Record<string, Item | null> = {
        cape: createMockItem('spottier_cape', 'Spottier cape', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.CAPE,
          value: 0
        })
      }

      const reduction = calculator.calculateWeightReduction(equipment)
      expect(reduction).toBe(5)
    })

    it('should handle boots of lightness', () => {
      const equipment: Record<string, Item | null> = {
        boots: createMockItem('boots_of_lightness', 'Boots of lightness', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.BOOTS,
          value: 0
        })
      }

      const reduction = calculator.calculateWeightReduction(equipment)
      expect(reduction).toBe(4)
    })
  })

  describe('getPrayerDrainReduction', () => {
    it('should return 0 for no prayer bonus equipment', () => {
      const equipment: Record<string, Item | null> = {
        helmet: createMockItem('iron_helmet', 'Iron helmet', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.HELMET,
          value: 100
        })
      }

      const reduction = calculator.getPrayerDrainReduction(equipment)
      expect(reduction).toBe(0)
    })

    it('should calculate prayer drain reduction', () => {
      const equipment: Record<string, Item | null> = {
        amulet: createMockItem('holy_symbol', 'Holy symbol', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.AMULET,
          value: 100,
          bonuses: {
            prayer: 8
          }
        })
      }

      const reduction = calculator.getPrayerDrainReduction(equipment)
      expect(reduction).toBeCloseTo(0.2664, 4) // 8 * 3.33% = 26.64%
    })

    it('should cap prayer drain reduction at 50%', () => {
      const equipment: Record<string, Item | null> = {
        amulet: createMockItem('super_holy_symbol', 'Super holy symbol', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.AMULET,
          value: 100,
          bonuses: {
            prayer: 50 // Would give 166% reduction, but should be capped
          }
        })
      }

      const reduction = calculator.getPrayerDrainReduction(equipment)
      expect(reduction).toBe(0.5) // Capped at 50%
    })

    it('should sum prayer bonuses from multiple items', () => {
      const equipment: Record<string, Item | null> = {
        amulet: createMockItem('holy_symbol', 'Holy symbol', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.AMULET,
          value: 100,
          bonuses: { prayer: 5 }
        }),
        cape: createMockItem('prayer_cape', 'Prayer cape', ItemType.ARMOR, {
          equipSlot: EquipmentSlotName.CAPE,
          value: 100,
          bonuses: { prayer: 3 }
        })
      }

      const reduction = calculator.getPrayerDrainReduction(equipment)
      expect(reduction).toBeCloseTo(0.2664, 4) // (5 + 3) * 3.33% = 26.64%
    })
  })

  describe('edge cases', () => {
    it('should handle equipment with undefined bonuses', () => {
      const equipment: Record<string, Item | null> = {
        weapon: createMockItem('bronze_sword', 'Bronze sword', ItemType.WEAPON, {
          value: 50,
          bonuses: {}
        })
      }

      const bonuses = calculator.calculateTotalBonuses(equipment)
      expect(bonuses).toEqual(calculator.createEmptyBonuses())
    })

    it('should handle stats with undefined skill levels', () => {
      const incompleteStats: StatsComponent = createMockStatsComponent({
        attack: createMockSkillData(50),
        combatLevel: 50
      })

      const item: Item = createMockItem('dragon_sword', 'Dragon sword', ItemType.WEAPON, {
        value: 50000,
        requirements: {
          level: 60,
          skills: {
            attack: 60
          }
        }
      })

      const meetsReqs = calculator.meetsRequirements(item, incompleteStats)
      expect(meetsReqs).toBe(false) // Should default to level 0
    })

    it('should handle empty requirements object', () => {
      const item: Item = createMockItem('bronze_sword', 'Bronze sword', ItemType.WEAPON, {
        value: 50,
        requirements: { level: 1, skills: {} }
      })

      const mockStats: StatsComponent = createMockStatsComponent({
        attack: createMockSkillData(1),
        combatLevel: 3
      })

      const meetsReqs = calculator.meetsRequirements(item, mockStats)
      expect(meetsReqs).toBe(true)
    })
  })
})