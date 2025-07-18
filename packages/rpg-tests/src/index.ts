/**
 * @hyperscape/rpg-tests
 * 
 * Test scenarios for the Hyperscape RPG
 */

// Export all test scenarios
export * from './scenarios/CombatScenarios'
export * from './scenarios/BankingScenarios'
export * from './scenarios/MovementScenarios'
export * from './scenarios/ItemScenarios'
export * from './scenarios/SkillScenarios'
export * from './scenarios/NPCScenarios'

// Export test helpers
export * from './helpers/RPGTestHelpers'

import { TestScenario } from '@hyperscape/test-framework'
import { getAllCombatScenarios } from './scenarios/CombatScenarios'
import { getAllBankingScenarios } from './scenarios/BankingScenarios'
import { getAllMovementScenarios } from './scenarios/MovementScenarios'
import { getAllItemScenarios } from './scenarios/ItemScenarios'
import { getAllSkillScenarios } from './scenarios/SkillScenarios'
import { getAllNPCScenarios } from './scenarios/NPCScenarios'

/**
 * Get all RPG test scenarios
 */
export function getAllScenarios(): TestScenario[] {
  return [
    ...getAllCombatScenarios(),
    ...getAllBankingScenarios(),
    ...getAllMovementScenarios(),
    ...getAllItemScenarios(),
    ...getAllSkillScenarios(),
    ...getAllNPCScenarios()
  ]
}

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(category: string): TestScenario[] {
  return getAllScenarios().filter(s => s.category === category)
} 