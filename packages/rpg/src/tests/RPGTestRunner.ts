import { CombatSystemTest } from './CombatSystemTest.js'
import { SkillsSystemTest } from './SkillsSystemTest.js'
import { RPGTestWorld } from './RPGTestWorld.js'

/**
 * Main test runner for the RPG system
 * Coordinates all test suites and provides comprehensive results
 */
export class RPGTestRunner {
  private testResults: any[] = []
  private startTime: number = 0
  private endTime: number = 0

  constructor() {}

  async runAllTests(): Promise<boolean> {
    console.log('\n=== RPG System Test Suite ===')
    console.log('Starting comprehensive RPG system tests...\n')
    
    this.startTime = Date.now()
    
    try {
      // Run all test suites
      const combatResults = await this.runCombatTests()
      const skillsResults = await this.runSkillsTests()
      const inventoryResults = await this.runInventoryTests()
      const equipmentResults = await this.runEquipmentTests()
      const worldResults = await this.runWorldTests()
      const integrationResults = await this.runIntegrationTests()
      
      // Collect all results
      this.testResults = [
        ...combatResults,
        ...skillsResults,
        ...inventoryResults,
        ...equipmentResults,
        ...worldResults,
        ...integrationResults
      ]
      
      this.endTime = Date.now()
      
      // Generate report
      this.generateTestReport()
      
      // Return overall success
      return this.testResults.every(result => result.passed)
      
    } catch (error) {
      console.error('Test suite failed with error:', error)
      return false
    }
  }

  private async runCombatTests(): Promise<any[]> {
    console.log('--- Combat System Tests ---')
    
    const combatTest = new CombatSystemTest()
    const passed = await combatTest.runAllTests()
    
    console.log(`Combat tests: ${passed ? 'PASSED' : 'FAILED'}\n`)
    
    return combatTest.getTestResults().map(result => ({
      ...result,
      suite: 'Combat'
    }))
  }

  private async runSkillsTests(): Promise<any[]> {
    console.log('--- Skills System Tests ---')
    
    const skillsTest = new SkillsSystemTest()
    const passed = await skillsTest.runAllTests()
    
    console.log(`Skills tests: ${passed ? 'PASSED' : 'FAILED'}\n`)
    
    return skillsTest.getTestResults().map(result => ({
      ...result,
      suite: 'Skills'
    }))
  }

  private async runInventoryTests(): Promise<any[]> {
    console.log('--- Inventory System Tests ---')
    
    // Basic inventory tests
    const inventoryResults = await this.runBasicInventoryTests()
    
    console.log(`Inventory tests: ${inventoryResults.every(r => r.passed) ? 'PASSED' : 'FAILED'}\n`)
    
    return inventoryResults.map(result => ({
      ...result,
      suite: 'Inventory'
    }))
  }

  private async runBasicInventoryTests(): Promise<any[]> {
    const testWorld = new RPGTestWorld()
    const results: any[] = []
    
    try {
      await testWorld.initialize()
      
      // Test adding items
      const player = await testWorld.createTestPlayer('InventoryPlayer')
      const inventorySystem = testWorld.getInventorySystem()
      
      // Test adding stackable items
      const addResult = inventorySystem.addItem(player.id, 'logs', 5)
      results.push({
        testName: 'addStackableItems',
        passed: addResult,
        description: 'Should be able to add stackable items',
        timestamp: new Date()
      })
      
      // Test checking item count
      const count = inventorySystem.getItemCount(player.id, 'logs')
      results.push({
        testName: 'getItemCount',
        passed: count === 5,
        description: 'Should return correct item count',
        timestamp: new Date()
      })
      
      // Test removing items
      const removeResult = inventorySystem.removeItem(player.id, 'logs', 2)
      const newCount = inventorySystem.getItemCount(player.id, 'logs')
      results.push({
        testName: 'removeItems',
        passed: removeResult && newCount === 3,
        description: 'Should be able to remove items',
        timestamp: new Date()
      })
      
      // Test inventory space
      const canAdd = inventorySystem.canAddItem(player.id, 'logs', 100)
      results.push({
        testName: 'inventorySpace',
        passed: canAdd,
        description: 'Should check inventory space correctly',
        timestamp: new Date()
      })
      
      await testWorld.cleanup()
      
    } catch (error) {
      results.push({
        testName: 'inventorySystemError',
        passed: false,
        description: `Inventory test failed: ${error.message}`,
        timestamp: new Date()
      })
    }
    
    return results
  }

  private async runEquipmentTests(): Promise<any[]> {
    console.log('--- Equipment System Tests ---')
    
    const equipmentResults = await this.runBasicEquipmentTests()
    
    console.log(`Equipment tests: ${equipmentResults.every(r => r.passed) ? 'PASSED' : 'FAILED'}\n`)
    
    return equipmentResults.map(result => ({
      ...result,
      suite: 'Equipment'
    }))
  }

  private async runBasicEquipmentTests(): Promise<any[]> {
    const testWorld = new RPGTestWorld()
    const results: any[] = []
    
    try {
      await testWorld.initialize()
      
      // Test equipping items
      const player = await testWorld.createTestPlayer('EquipmentPlayer')
      const equipmentSystem = testWorld.getEquipmentSystem()
      const inventorySystem = testWorld.getInventorySystem()
      
      // Give player a sword
      inventorySystem.addItem(player.id, 'bronze_sword', 1)
      
      // Test equipping
      const equipResult = equipmentSystem.equipItem(player.id, 'bronze_sword')
      results.push({
        testName: 'equipItem',
        passed: equipResult,
        description: 'Should be able to equip items',
        timestamp: new Date()
      })
      
      // Test equipment bonuses
      const bonuses = equipmentSystem.getEquipmentBonuses(player.id)
      results.push({
        testName: 'equipmentBonuses',
        passed: bonuses.attack > 0,
        description: 'Should provide equipment bonuses',
        timestamp: new Date()
      })
      
      // Test unequipping
      const unequipResult = equipmentSystem.unequipItem(player.id, 'weapon')
      results.push({
        testName: 'unequipItem',
        passed: unequipResult,
        description: 'Should be able to unequip items',
        timestamp: new Date()
      })
      
      await testWorld.cleanup()
      
    } catch (error) {
      results.push({
        testName: 'equipmentSystemError',
        passed: false,
        description: `Equipment test failed: ${error.message}`,
        timestamp: new Date()
      })
    }
    
    return results
  }

  private async runWorldTests(): Promise<any[]> {
    console.log('--- World System Tests ---')
    
    const worldResults = await this.runBasicWorldTests()
    
    console.log(`World tests: ${worldResults.every(r => r.passed) ? 'PASSED' : 'FAILED'}\n`)
    
    return worldResults.map(result => ({
      ...result,
      suite: 'World'
    }))
  }

  private async runBasicWorldTests(): Promise<any[]> {
    const testWorld = new RPGTestWorld()
    const results: any[] = []
    
    try {
      await testWorld.initialize()
      
      const worldSystem = testWorld.getWorldSystem()
      const mobSystem = testWorld.getMobSystem()
      
      // Test world zones
      const zones = worldSystem.getAllZones()
      results.push({
        testName: 'worldZones',
        passed: zones.length > 0,
        description: 'Should have world zones',
        timestamp: new Date()
      })
      
      // Test spawn points
      const spawnPoints = zones[0]?.spawns || []
      results.push({
        testName: 'spawnPoints',
        passed: spawnPoints.length > 0,
        description: 'Should have spawn points',
        timestamp: new Date()
      })
      
      // Test mob spawning
      if (spawnPoints.length > 0) {
        const mobId = mobSystem.spawnMob(spawnPoints[0].id)
        results.push({
          testName: 'mobSpawning',
          passed: mobId !== null,
          description: 'Should be able to spawn mobs',
          timestamp: new Date()
        })
      }
      
      await testWorld.cleanup()
      
    } catch (error) {
      results.push({
        testName: 'worldSystemError',
        passed: false,
        description: `World test failed: ${error.message}`,
        timestamp: new Date()
      })
    }
    
    return results
  }

  private async runIntegrationTests(): Promise<any[]> {
    console.log('--- Integration Tests ---')
    
    const integrationResults = await this.runBasicIntegrationTests()
    
    console.log(`Integration tests: ${integrationResults.every(r => r.passed) ? 'PASSED' : 'FAILED'}\n`)
    
    return integrationResults.map(result => ({
      ...result,
      suite: 'Integration'
    }))
  }

  private async runBasicIntegrationTests(): Promise<any[]> {
    const testWorld = new RPGTestWorld()
    const results: any[] = []
    
    try {
      await testWorld.initialize()
      
      // Test complete player workflow
      const player = await testWorld.createTestPlayer('IntegrationPlayer')
      const inventorySystem = testWorld.getInventorySystem()
      const equipmentSystem = testWorld.getEquipmentSystem()
      const skillsSystem = testWorld.getSkillsSystem()
      
      // Give player items
      inventorySystem.addItem(player.id, 'bronze_sword', 1)
      inventorySystem.addItem(player.id, 'logs', 10)
      
      // Equip weapon
      const equipped = equipmentSystem.equipItem(player.id, 'bronze_sword')
      
      // Gain experience
      skillsSystem.gainExperience(player.id, 'attack', 100)
      
      // Check that everything worked together
      const hasEquipment = equipmentSystem.getEquippedItem(player.id, 'weapon') === 'bronze_sword'
      const hasItems = inventorySystem.hasItem(player.id, 'logs', 10)
      const hasExperience = player.experience.attack >= 100
      
      const integrationWorked = equipped && hasEquipment && hasItems && hasExperience
      
      results.push({
        testName: 'completeWorkflow',
        passed: integrationWorked,
        description: 'All systems should work together',
        timestamp: new Date()
      })
      
      await testWorld.cleanup()
      
    } catch (error) {
      results.push({
        testName: 'integrationError',
        passed: false,
        description: `Integration test failed: ${error.message}`,
        timestamp: new Date()
      })
    }
    
    return results
  }

  private generateTestReport(): void {
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.passed).length
    const failedTests = totalTests - passedTests
    const duration = this.endTime - this.startTime
    
    console.log('\n=== Test Report ===')
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests}`)
    console.log(`Failed: ${failedTests}`)
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)
    console.log(`Duration: ${duration}ms`)
    console.log(`Status: ${failedTests === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
    
    if (failedTests > 0) {
      console.log('\n=== Failed Tests ===')
      this.testResults.filter(r => !r.passed).forEach(test => {
        console.log(`❌ ${test.suite}.${test.testName}: ${test.description}`)
      })
    }
    
    console.log('\n=== Test Summary by Suite ===')
    const suites = ['Combat', 'Skills', 'Inventory', 'Equipment', 'World', 'Integration']
    
    suites.forEach(suite => {
      const suiteTests = this.testResults.filter(r => r.suite === suite)
      const suitePassed = suiteTests.filter(r => r.passed).length
      const suiteTotal = suiteTests.length
      
      if (suiteTotal > 0) {
        console.log(`${suite}: ${suitePassed}/${suiteTotal} (${((suitePassed / suiteTotal) * 100).toFixed(1)}%)`)
      }
    })
    
    console.log('\n========================\n')
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

  getTestSummary(): any {
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.passed).length
    const failedTests = totalTests - passedTests
    const duration = this.endTime - this.startTime
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      duration,
      allPassed: failedTests === 0
    }
  }
}