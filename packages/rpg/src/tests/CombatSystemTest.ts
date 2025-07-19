import { RPGTestWorld } from './RPGTestWorld.js'
import { RPGPlayer } from '../types/index.js'

/**
 * Combat System Test Suite
 * Tests all combat-related functionality
 */
export class CombatSystemTest {
  private testWorld: RPGTestWorld
  private testResults: any[] = []

  constructor() {
    this.testWorld = new RPGTestWorld()
  }

  async runAllTests(): Promise<boolean> {
    console.log('[CombatSystemTest] Starting combat system tests...')
    
    try {
      await this.testWorld.initialize()
      
      // Run all combat tests
      await this.testBasicCombat()
      await this.testCombatDamage()
      await this.testCombatExperience()
      await this.testCombatSessions()
      await this.testRangedCombat()
      await this.testCombatWithMobs()
      await this.testCombatInterruption()
      await this.testCombatTimeout()
      
      await this.testWorld.cleanup()
      
      const allPassed = this.testResults.every(result => result.passed)
      console.log(`[CombatSystemTest] All tests ${allPassed ? 'PASSED' : 'FAILED'}`)
      
      return allPassed
      
    } catch (error) {
      console.error('[CombatSystemTest] Test suite failed:', error)
      await this.testWorld.cleanup()
      return false
    }
  }

  private async testBasicCombat(): Promise<void> {
    console.log('[CombatSystemTest] Testing basic combat...')
    
    try {
      // Create two test players
      const player1 = await this.testWorld.createTestPlayer('TestPlayer1')
      const player2 = await this.testWorld.createTestPlayer('TestPlayer2')
      
      // Position them close to each other
      await this.testWorld.simulatePlayerMove(player1.id, { x: 0, y: 0, z: 0 })
      await this.testWorld.simulatePlayerMove(player2.id, { x: 1, y: 0, z: 0 })
      
      // Clear test results
      this.testWorld.clearTestResults()
      
      // Simulate player 1 attacking player 2
      await this.testWorld.simulatePlayerAttack(player1.id, player2.id)
      
      // Wait for combat to start
      await this.testWorld.waitForEvent('combat_start', 3000)
      
      // Verify combat started
      const combatStarted = this.testWorld.validateCombatInProgress(player1.id)
      
      this.recordTestResult('testBasicCombat', combatStarted, 'Combat should start between two players')
      
    } catch (error) {
      this.recordTestResult('testBasicCombat', false, `Test failed: ${error.message}`)
    }
  }

  private async testCombatDamage(): Promise<void> {
    console.log('[CombatSystemTest] Testing combat damage...')
    
    try {
      // Create two test players
      const player1 = await this.testWorld.createTestPlayer('TestPlayer1')
      const player2 = await this.testWorld.createTestPlayer('TestPlayer2')
      
      // Position them close to each other
      await this.testWorld.simulatePlayerMove(player1.id, { x: 0, y: 0, z: 0 })
      await this.testWorld.simulatePlayerMove(player2.id, { x: 1, y: 0, z: 0 })
      
      // Record initial health
      const initialHealth = player2.health
      
      // Clear test results
      this.testWorld.clearTestResults()
      
      // Simulate attack
      await this.testWorld.simulatePlayerAttack(player1.id, player2.id)
      
      // Wait for combat update
      await this.testWorld.waitForEvent('combat_update', 5000)
      
      // Check if damage was dealt
      const currentHealth = this.testWorld.getTestPlayer(player2.id)?.health || 0
      const damageTaken = currentHealth < initialHealth
      
      this.recordTestResult('testCombatDamage', damageTaken, 'Damage should be dealt in combat')
      
    } catch (error) {
      this.recordTestResult('testCombatDamage', false, `Test failed: ${error.message}`)
    }
  }

  private async testCombatExperience(): Promise<void> {
    console.log('[CombatSystemTest] Testing combat experience...')
    
    try {
      // Create two test players
      const player1 = await this.testWorld.createTestPlayer('TestPlayer1')
      const player2 = await this.testWorld.createTestPlayer('TestPlayer2')
      
      // Position them close to each other
      await this.testWorld.simulatePlayerMove(player1.id, { x: 0, y: 0, z: 0 })
      await this.testWorld.simulatePlayerMove(player2.id, { x: 1, y: 0, z: 0 })
      
      // Record initial experience
      const initialAttackXp = player1.experience.attack
      
      // Clear test results
      this.testWorld.clearTestResults()
      
      // Simulate sustained combat
      await this.testWorld.simulatePlayerAttack(player1.id, player2.id)
      
      // Wait for combat updates
      await this.testWorld.wait(3000)
      
      // Check if experience was gained
      const currentAttackXp = this.testWorld.getTestPlayer(player1.id)?.experience.attack || 0
      const experienceGained = currentAttackXp > initialAttackXp
      
      this.recordTestResult('testCombatExperience', experienceGained, 'Experience should be gained from combat')
      
    } catch (error) {
      this.recordTestResult('testCombatExperience', false, `Test failed: ${error.message}`)
    }
  }

  private async testCombatSessions(): Promise<void> {
    console.log('[CombatSystemTest] Testing combat sessions...')
    
    try {
      // Create two test players
      const player1 = await this.testWorld.createTestPlayer('TestPlayer1')
      const player2 = await this.testWorld.createTestPlayer('TestPlayer2')
      
      // Position them close to each other
      await this.testWorld.simulatePlayerMove(player1.id, { x: 0, y: 0, z: 0 })
      await this.testWorld.simulatePlayerMove(player2.id, { x: 1, y: 0, z: 0 })
      
      // Clear test results
      this.testWorld.clearTestResults()
      
      // Start combat
      await this.testWorld.simulatePlayerAttack(player1.id, player2.id)
      
      // Wait for combat to start
      await this.testWorld.waitForEvent('combat_start', 3000)
      
      // Verify both players are in combat
      const player1InCombat = this.testWorld.validateCombatInProgress(player1.id)
      const player2InCombat = this.testWorld.validateCombatInProgress(player2.id)
      
      // Move player 1 far away to end combat
      await this.testWorld.simulatePlayerMove(player1.id, { x: 20, y: 0, z: 0 })
      
      // Wait for combat to end
      await this.testWorld.wait(2000)
      
      // Verify combat ended
      const combatEnded = !this.testWorld.validateCombatInProgress(player1.id)
      
      const passed = player1InCombat && player2InCombat && combatEnded
      this.recordTestResult('testCombatSessions', passed, 'Combat sessions should start and end properly')
      
    } catch (error) {
      this.recordTestResult('testCombatSessions', false, `Test failed: ${error.message}`)
    }
  }

  private async testRangedCombat(): Promise<void> {
    console.log('[CombatSystemTest] Testing ranged combat...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('RangerPlayer')
      
      // Get equipment system
      const equipmentSystem = this.testWorld.getEquipmentSystem()
      const inventorySystem = this.testWorld.getInventorySystem()
      
      // Give player a bow and arrows
      inventorySystem.addItem(player.id, 'wood_bow', 1)
      inventorySystem.addItem(player.id, 'arrows', 50)
      
      // Equip bow and arrows
      await this.testWorld.simulatePlayerEquipItem(player.id, 'wood_bow')
      await this.testWorld.simulatePlayerEquipItem(player.id, 'arrows')
      
      // Verify ranged weapon capability
      const canUseRanged = equipmentSystem.canUseRangedWeapon(player.id)
      const initialArrowCount = equipmentSystem.getArrowCount(player.id)
      
      // Create target player
      const target = await this.testWorld.createTestPlayer('TargetPlayer')
      await this.testWorld.simulatePlayerMove(target.id, { x: 5, y: 0, z: 0 })
      
      // Clear test results
      this.testWorld.clearTestResults()
      
      // Simulate ranged attack
      await this.testWorld.simulatePlayerAttack(player.id, target.id)
      
      // Wait for combat
      await this.testWorld.wait(2000)
      
      // Check if arrows were consumed
      const currentArrowCount = equipmentSystem.getArrowCount(player.id)
      const arrowsConsumed = currentArrowCount < initialArrowCount
      
      const passed = canUseRanged && arrowsConsumed
      this.recordTestResult('testRangedCombat', passed, 'Ranged combat should consume arrows')
      
    } catch (error) {
      this.recordTestResult('testRangedCombat', false, `Test failed: ${error.message}`)
    }
  }

  private async testCombatWithMobs(): Promise<void> {
    console.log('[CombatSystemTest] Testing combat with mobs...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('MobFighter')
      
      // Get mob system
      const mobSystem = this.testWorld.getMobSystem()
      const worldSystem = this.testWorld.getWorldSystem()
      
      // Get a spawn point
      const zones = worldSystem.getAllZones()
      const spawnPoint = zones[0]?.spawns[0]
      
      if (!spawnPoint) {
        throw new Error('No spawn points available')
      }
      
      // Spawn a mob
      const mobId = mobSystem.spawnMob(spawnPoint.id)
      
      if (!mobId) {
        throw new Error('Failed to spawn mob')
      }
      
      // Position player near mob
      await this.testWorld.simulatePlayerMove(player.id, { 
        x: spawnPoint.position.x + 1, 
        y: spawnPoint.position.y, 
        z: spawnPoint.position.z 
      })
      
      // Clear test results
      this.testWorld.clearTestResults()
      
      // Attack the mob
      await this.testWorld.simulatePlayerAttack(player.id, mobId)
      
      // Wait for combat to start
      await this.testWorld.waitForEvent('combat_start', 3000)
      
      // Verify combat started
      const combatStarted = this.testWorld.validateCombatInProgress(player.id)
      
      this.recordTestResult('testCombatWithMobs', combatStarted, 'Combat should work with mobs')
      
    } catch (error) {
      this.recordTestResult('testCombatWithMobs', false, `Test failed: ${error.message}`)
    }
  }

  private async testCombatInterruption(): Promise<void> {
    console.log('[CombatSystemTest] Testing combat interruption...')
    
    try {
      // Create two test players
      const player1 = await this.testWorld.createTestPlayer('Fighter1')
      const player2 = await this.testWorld.createTestPlayer('Fighter2')
      
      // Position them close to each other
      await this.testWorld.simulatePlayerMove(player1.id, { x: 0, y: 0, z: 0 })
      await this.testWorld.simulatePlayerMove(player2.id, { x: 1, y: 0, z: 0 })
      
      // Start combat
      await this.testWorld.simulatePlayerAttack(player1.id, player2.id)
      
      // Wait for combat to start
      await this.testWorld.waitForEvent('combat_start', 3000)
      
      // Verify combat started
      const combatStarted = this.testWorld.validateCombatInProgress(player1.id)
      
      // Move one player far away
      await this.testWorld.simulatePlayerMove(player1.id, { x: 50, y: 0, z: 0 })
      
      // Wait for combat to end
      await this.testWorld.wait(3000)
      
      // Verify combat ended
      const combatEnded = !this.testWorld.validateCombatInProgress(player1.id)
      
      const passed = combatStarted && combatEnded
      this.recordTestResult('testCombatInterruption', passed, 'Combat should end when players move apart')
      
    } catch (error) {
      this.recordTestResult('testCombatInterruption', false, `Test failed: ${error.message}`)
    }
  }

  private async testCombatTimeout(): Promise<void> {
    console.log('[CombatSystemTest] Testing combat timeout...')
    
    try {
      // Create test player
      const player = await this.testWorld.createTestPlayer('TimeoutPlayer')
      
      // Simulate starting combat with non-existent target
      await this.testWorld.simulatePlayerAttack(player.id, 'non_existent_target')
      
      // Wait a bit
      await this.testWorld.wait(1000)
      
      // Verify no combat started
      const noCombat = !this.testWorld.validateCombatInProgress(player.id)
      
      this.recordTestResult('testCombatTimeout', noCombat, 'Combat should not start with invalid target')
      
    } catch (error) {
      this.recordTestResult('testCombatTimeout', false, `Test failed: ${error.message}`)
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
    
    console.log(`[CombatSystemTest] ${testName}: ${passed ? 'PASSED' : 'FAILED'} - ${description}`)
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