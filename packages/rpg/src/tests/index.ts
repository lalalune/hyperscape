// RPG Tests Export
export { RPGTestRunner } from './RPGTestRunner.js'
export { RPGTestWorld } from './RPGTestWorld.js'
export { CombatSystemTest } from './CombatSystemTest.js'
export { SkillsSystemTest } from './SkillsSystemTest.js'

// Convenience function to run all tests
export async function runRPGTests(): Promise<boolean> {
  const testRunner = new RPGTestRunner()
  return await testRunner.runAllTests()
}

// Convenience function to run specific test suites
export async function runCombatTests(): Promise<boolean> {
  const combatTest = new CombatSystemTest()
  return await combatTest.runAllTests()
}

export async function runSkillsTests(): Promise<boolean> {
  const skillsTest = new SkillsSystemTest()
  return await skillsTest.runAllTests()
}

// Test configuration
export const TEST_CONFIG = {
  timeout: 30000, // 30 seconds timeout per test
  retries: 2,     // Number of retries for failed tests
  verbose: true   // Verbose logging
}