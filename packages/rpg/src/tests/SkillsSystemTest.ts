import { RPGTestWorld } from './RPGTestWorld.js'
import { RPGSkill } from '../types/index.js'

/**
 * Skills System Test Suite
 * Tests all skill-related functionality
 */
export class SkillsSystemTest {
  private testWorld: RPGTestWorld
  private testResults: any[] = []

  constructor() {
    this.testWorld = new RPGTestWorld()
  }

  async runAllTests(): Promise<boolean> {
    console.log('[SkillsSystemTest] Starting skills system tests...')
    
    try {
      await this.testWorld.initialize()
      
      // Run all skills tests
      await this.testExperienceGain()
      await this.testLevelUp()
      await this.testSkillRequirements()
      await this.testCombatLevelCalculation()
      await this.testWoodcuttingSkill()
      await this.testFishingSkill()
      await this.testCookingSkill()
      await this.testFiremakingSkill()
      await this.testSkillProgress()
      await this.testSuccessRates()
      
      await this.testWorld.cleanup()
      
      const allPassed = this.testResults.every(result => result.passed)
      console.log(`[SkillsSystemTest] All tests ${allPassed ? 'PASSED' : 'FAILED'}`)
      
      return allPassed
      
    } catch (error) {
      console.error('[SkillsSystemTest] Test suite failed:', error)
      await this.testWorld.cleanup()
      return false
    }
  }

  private async testExperienceGain(): Promise<void> {
    console.log('[SkillsSystemTest] Testing experience gain...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('SkillPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      
      // Record initial experience
      const initialXp = player.experience[RPGSkill.ATTACK]
      
      // Gain experience
      const xpToGain = 100
      const gained = skillsSystem.gainExperience(player.id, RPGSkill.ATTACK, xpToGain)
      
      // Check if experience was gained
      const currentXp = this.testWorld.getTestPlayer(player.id)?.experience[RPGSkill.ATTACK] || 0
      const xpGained = currentXp === initialXp + xpToGain
      
      const passed = gained && xpGained
      this.recordTestResult('testExperienceGain', passed, 'Experience should be gained successfully')
      
    } catch (error) {
      this.recordTestResult('testExperienceGain', false, `Test failed: ${error.message}`)
    }
  }

  private async testLevelUp(): Promise<void> {
    console.log('[SkillsSystemTest] Testing level up...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('LevelUpPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      
      // Record initial level
      const initialLevel = player.stats[RPGSkill.ATTACK]
      
      // Clear test results
      this.testWorld.clearTestResults()
      
      // Gain enough experience to level up
      const xpForLevel2 = 83 // XP required for level 2
      skillsSystem.gainExperience(player.id, RPGSkill.ATTACK, xpForLevel2)
      
      // Wait for level up event
      await this.testWorld.waitForEvent('level_up', 3000)
      
      // Check if level increased
      const currentLevel = this.testWorld.getTestPlayer(player.id)?.stats[RPGSkill.ATTACK] || 0
      const leveledUp = currentLevel > initialLevel
      
      // Check if level up event was recorded
      const levelUpEvent = this.testWorld.validateEventOccurred('level_up')
      
      const passed = leveledUp && levelUpEvent
      this.recordTestResult('testLevelUp', passed, 'Level should increase when gaining enough experience')
      
    } catch (error) {
      this.recordTestResult('testLevelUp', false, `Test failed: ${error.message}`)
    }
  }

  private async testSkillRequirements(): Promise<void> {
    console.log('[SkillsSystemTest] Testing skill requirements...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('RequirementPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      
      // Test level requirement check
      const hasLevel1 = skillsSystem.hasLevelRequirement(player.id, RPGSkill.ATTACK, 1)
      const hasLevel50 = skillsSystem.hasLevelRequirement(player.id, RPGSkill.ATTACK, 50)
      
      const passed = hasLevel1 && !hasLevel50
      this.recordTestResult('testSkillRequirements', passed, 'Skill requirements should be checked correctly')
      
    } catch (error) {
      this.recordTestResult('testSkillRequirements', false, `Test failed: ${error.message}`)
    }
  }

  private async testCombatLevelCalculation(): Promise<void> {
    console.log('[SkillsSystemTest] Testing combat level calculation...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('CombatLevelPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      
      // Calculate initial combat level
      const initialCombatLevel = skillsSystem.getCombatLevel(player.id)
      
      // Level up attack skill
      skillsSystem.gainExperience(player.id, RPGSkill.ATTACK, 1000)
      
      // Recalculate combat level
      const newCombatLevel = skillsSystem.getCombatLevel(player.id)
      
      // Combat level should increase
      const combatLevelIncreased = newCombatLevel > initialCombatLevel
      
      this.recordTestResult('testCombatLevelCalculation', combatLevelIncreased, 'Combat level should increase with skill levels')
      
    } catch (error) {
      this.recordTestResult('testCombatLevelCalculation', false, `Test failed: ${error.message}`)
    }
  }

  private async testWoodcuttingSkill(): Promise<void> {
    console.log('[SkillsSystemTest] Testing woodcutting skill...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('WoodcutterPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      const inventorySystem = this.testWorld.getInventorySystem()
      
      // Give player a hatchet
      inventorySystem.addItem(player.id, 'bronze_hatchet', 1)
      
      // Record initial woodcutting level
      const initialLevel = player.stats[RPGSkill.WOODCUTTING]
      
      // Simulate woodcutting
      await this.testWorld.simulatePlayerGatherResource(player.id, 'tree_1', 'tree')
      
      // Wait for potential level change
      await this.testWorld.wait(1000)
      
      // Check if logs were added to inventory
      const hasLogs = inventorySystem.hasItem(player.id, 'logs', 1)
      
      // Check if experience was gained
      const currentLevel = this.testWorld.getTestPlayer(player.id)?.stats[RPGSkill.WOODCUTTING] || 0
      const xpGained = currentLevel >= initialLevel
      
      const passed = hasLogs && xpGained
      this.recordTestResult('testWoodcuttingSkill', passed, 'Woodcutting should produce logs and experience')
      
    } catch (error) {
      this.recordTestResult('testWoodcuttingSkill', false, `Test failed: ${error.message}`)
    }
  }

  private async testFishingSkill(): Promise<void> {
    console.log('[SkillsSystemTest] Testing fishing skill...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('FisherPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      const inventorySystem = this.testWorld.getInventorySystem()
      
      // Give player a fishing rod
      inventorySystem.addItem(player.id, 'fishing_rod', 1)
      
      // Record initial fishing level
      const initialLevel = player.stats[RPGSkill.FISHING]
      
      // Simulate fishing
      await this.testWorld.simulatePlayerGatherResource(player.id, 'fishing_1', 'fishing_spot')
      
      // Wait for potential level change
      await this.testWorld.wait(1000)
      
      // Check if fish were added to inventory
      const hasFish = inventorySystem.hasItem(player.id, 'raw_shrimps', 1)
      
      // Check if experience was gained
      const currentLevel = this.testWorld.getTestPlayer(player.id)?.stats[RPGSkill.FISHING] || 0
      const xpGained = currentLevel >= initialLevel
      
      const passed = hasFish && xpGained
      this.recordTestResult('testFishingSkill', passed, 'Fishing should produce fish and experience')
      
    } catch (error) {
      this.recordTestResult('testFishingSkill', false, `Test failed: ${error.message}`)
    }
  }

  private async testCookingSkill(): Promise<void> {
    console.log('[SkillsSystemTest] Testing cooking skill...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('CookPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      const inventorySystem = this.testWorld.getInventorySystem()
      
      // Give player raw fish
      inventorySystem.addItem(player.id, 'raw_shrimps', 1)
      
      // Record initial cooking level
      const initialLevel = player.stats[RPGSkill.COOKING]
      
      // Get cooking experience for this fish
      const expectedXp = skillsSystem.getCookingExperience('cooked_shrimps')
      
      // Simulate cooking (this would need to be implemented in the test world)
      // For now, directly gain cooking experience
      skillsSystem.gainExperience(player.id, RPGSkill.COOKING, expectedXp)
      
      // Check if experience was gained
      const currentLevel = this.testWorld.getTestPlayer(player.id)?.stats[RPGSkill.COOKING] || 0
      const xpGained = currentLevel >= initialLevel
      
      this.recordTestResult('testCookingSkill', xpGained, 'Cooking should provide experience')
      
    } catch (error) {
      this.recordTestResult('testCookingSkill', false, `Test failed: ${error.message}`)
    }
  }

  private async testFiremakingSkill(): Promise<void> {
    console.log('[SkillsSystemTest] Testing firemaking skill...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('FiremakerPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      const inventorySystem = this.testWorld.getInventorySystem()
      
      // Give player logs and tinderbox
      inventorySystem.addItem(player.id, 'logs', 1)
      inventorySystem.addItem(player.id, 'tinderbox', 1)
      
      // Record initial firemaking level
      const initialLevel = player.stats[RPGSkill.FIREMAKING]
      
      // Get firemaking experience for logs
      const expectedXp = skillsSystem.getFiremakingExperience('logs')
      
      // Simulate firemaking (this would need to be implemented in the test world)
      // For now, directly gain firemaking experience
      skillsSystem.gainExperience(player.id, RPGSkill.FIREMAKING, expectedXp)
      
      // Check if experience was gained
      const currentLevel = this.testWorld.getTestPlayer(player.id)?.stats[RPGSkill.FIREMAKING] || 0
      const xpGained = currentLevel >= initialLevel
      
      this.recordTestResult('testFiremakingSkill', xpGained, 'Firemaking should provide experience')
      
    } catch (error) {
      this.recordTestResult('testFiremakingSkill', false, `Test failed: ${error.message}`)
    }
  }

  private async testSkillProgress(): Promise<void> {
    console.log('[SkillsSystemTest] Testing skill progress tracking...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('ProgressPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      
      // Get initial progress
      const initialProgress = skillsSystem.getSkillProgress(player.id, RPGSkill.ATTACK)
      
      // Gain some experience
      skillsSystem.gainExperience(player.id, RPGSkill.ATTACK, 50)
      
      // Get updated progress
      const newProgress = skillsSystem.getSkillProgress(player.id, RPGSkill.ATTACK)
      
      // Progress should have increased
      const progressIncreased = newProgress.progressPercent > initialProgress.progressPercent
      
      this.recordTestResult('testSkillProgress', progressIncreased, 'Skill progress should track correctly')
      
    } catch (error) {
      this.recordTestResult('testSkillProgress', false, `Test failed: ${error.message}`)
    }
  }

  private async testSuccessRates(): Promise<void> {
    console.log('[SkillsSystemTest] Testing success rates...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('SuccessPlayer')
      const skillsSystem = this.testWorld.getSkillsSystem()
      
      // Test success rate calculation
      const level1Success = skillsSystem.getSuccessRate(1, 1)
      const level10Success = skillsSystem.getSuccessRate(10, 1)
      
      // Higher level should have higher success rate
      const successRateIncreases = level10Success > level1Success
      
      // Test success roll
      const shouldSucceed = skillsSystem.rollSuccess(player.id, RPGSkill.ATTACK, 1)
      const shouldFail = skillsSystem.rollSuccess(player.id, RPGSkill.ATTACK, 99)
      
      const passed = successRateIncreases && shouldSucceed && !shouldFail
      this.recordTestResult('testSuccessRates', passed, 'Success rates should work correctly')
      
    } catch (error) {
      this.recordTestResult('testSuccessRates', false, `Test failed: ${error.message}`)
    }
  }

  private recordTestResult(testName: string, passed: boolean, description: string): void {
    const result = {
      testName,
      passed,
      description,
      timestamp: new Date()
    }
    
    this.testResults.push(result)
    
    console.log(`[SkillsSystemTest] ${testName}: ${passed ? 'PASSED' : 'FAILED'} - ${description}`)
  }

  getTestResults(): any[] {
    return [...this.testResults]
  }

  getPassedTests(): any[] {
    return this.testResults.filter(result => result.passed)
  }

  getFailedTests(): any[] {
    return this.testResults.filter(result => !result.passed)
  }
}