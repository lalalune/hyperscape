/**
 * Test Scenarios Index
 *
 * Central registry for all RPG test scenarios
 */

import { TestScenario } from '../ScenarioTestFramework.js'

// Export all scenarios
export { BaseTestScenario } from './BaseTestScenario'
export { FetchQuestScenario } from './FetchQuestScenario'
export { KillQuestScenario } from './KillQuestScenario'
export { MultiKillQuestScenario } from './MultiKillQuestScenario'
export { WeaponCombatScenario } from './WeaponCombatScenario'
export { WoodcuttingScenario } from './WoodcuttingScenario'
export { ConstructionScenario } from './ConstructionScenario'
export { BankingTestScenario } from './BankingTestScenario'
export { CombatDeathScenario } from './CombatDeathScenario'
export { MovementNavigationScenario } from './MovementNavigationScenario'
export { AggroChaseEscapeScenario } from './AggroChaseEscapeScenario'
export { DeathRespawnRecoveryScenario } from './DeathRespawnRecoveryScenario'
export { HealingFoodCombatScenario } from './HealingFoodCombatScenario'
export { MagicSpellCombatScenario } from './MagicSpellCombatScenario'
export { BankingManagementScenario } from './BankingManagementScenario'
export { ItemPickupDropScenario } from './ItemPickupDropScenario'
export { ConsumableItemsScenario } from './ConsumableItemsScenario'
export { TradingSystemScenario } from './TradingSystemScenario'

// Import scenarios for the array
import { BankingTestScenario } from './BankingTestScenario.js'
import { CombatDeathScenario } from './CombatDeathScenario.js'
import { MovementNavigationScenario } from './MovementNavigationScenario.js'
import { AggroChaseEscapeScenario } from './AggroChaseEscapeScenario.js'
import { DeathRespawnRecoveryScenario } from './DeathRespawnRecoveryScenario.js'
import { HealingFoodCombatScenario } from './HealingFoodCombatScenario.js'
import { MagicSpellCombatScenario } from './MagicSpellCombatScenario.js'
import { BankingManagementScenario } from './BankingManagementScenario.js'
import { ItemPickupDropScenario } from './ItemPickupDropScenario.js'
import { ConsumableItemsScenario } from './ConsumableItemsScenario.js'
import { TradingSystemScenario } from './TradingSystemScenario.js'

/**
 * All available test scenarios
 */
export const AllTestScenarios: TestScenario[] = [
  BankingTestScenario,
  CombatDeathScenario,
  MovementNavigationScenario,
  AggroChaseEscapeScenario,
  DeathRespawnRecoveryScenario,
  HealingFoodCombatScenario,
  MagicSpellCombatScenario,
  BankingManagementScenario,
  ItemPickupDropScenario,
  ConsumableItemsScenario,
  TradingSystemScenario,
  // ConstructionTestScenario,
  // SkillsTestScenario,
  // PvPTestScenario
]

/**
 * Test scenarios grouped by category
 */
export const TestScenariosByCategory = {
  banking: [BankingTestScenario, BankingManagementScenario],
  combat: [
    CombatDeathScenario,
    AggroChaseEscapeScenario,
    DeathRespawnRecoveryScenario,
    HealingFoodCombatScenario,
    MagicSpellCombatScenario,
  ],
  movement: [MovementNavigationScenario],
  items: [ItemPickupDropScenario, ConsumableItemsScenario],
  trading: [TradingSystemScenario],
  // construction: [ConstructionTestScenario],
  // skills: [SkillsTestScenario],
  // pvp: [PvPTestScenario]
}

/**
 * Quick access to scenarios by ID
 */
export const TestScenariosById = new Map<string, TestScenario>(
  AllTestScenarios.map(scenario => [scenario.id, scenario])
)

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): TestScenario | undefined {
  return TestScenariosById.get(id)
}

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(category: string): TestScenario[] {
  return (TestScenariosByCategory as any)[category] || []
}

/**
 * Get all scenario IDs
 */
export function getAllScenarioIds(): string[] {
  return AllTestScenarios.map(scenario => scenario.id)
}

/**
 * Get scenarios matching a filter
 */
export function getFilteredScenarios(filter: {
  category?: string
  maxDuration?: number
  nameContains?: string
}): TestScenario[] {
  return AllTestScenarios.filter(scenario => {
    if (filter.category) {
      const categoryScenarios = getScenariosByCategory(filter.category)
      if (!categoryScenarios.includes(scenario)) {
        return false
      }
    }

    if (filter.maxDuration && scenario.maxDuration && scenario.maxDuration > filter.maxDuration) {
      return false
    }

    if (filter.nameContains && !scenario.name.toLowerCase().includes(filter.nameContains.toLowerCase())) {
      return false
    }

    return true
  })
}
