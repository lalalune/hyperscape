/**
 * Example: Using the refactored Hyperscape packages
 */

// 1. Using the RPG as a Hyperfy plugin
import { createRPGPlugin } from '@hyperscape/rpg-core'
import { World } from '@hyperfy/sdk'

async function runRPG() {
  // Create the RPG plugin with configuration
  const rpgPlugin = createRPGPlugin({
    debug: true,
    worldGen: {
      generateDefault: true,
      customSpawns: [
        {
          id: 'custom_spawn',
          name: 'Custom Spawn Area',
          position: { x: 1000, y: 10, z: 1000 },
          radius: 50,
          type: 'safe'
        }
      ]
    },
    systems: {
      combat: true,
      banking: true,
      trading: true,
      skills: true,
      quests: false // Disable quest system
    }
  })
  
  // Initialize with a Hyperfy world
  const world = new World()
  await rpgPlugin.init(world)
  
  // Access the public API
  const rpg = (world as any).rpg
  
  // Use the API to interact with the game
  await rpg.spawnPlayer('player1', {
    position: { x: 100, y: 1, z: 100 },
    username: 'TestPlayer'
  })
  
  // Give the player some items
  rpg.giveItem('player1', 995, 1000) // 1000 gold
  rpg.giveItem('player1', 1205, 1)   // Bronze dagger
  
  // Start combat with an NPC
  const goblinId = await rpg.spawnNPC('goblin', {
    position: { x: 105, y: 1, z: 100 }
  })
  rpg.startCombat('player1', goblinId)
}

// 2. Writing and running tests
import { createTestFramework } from '@hyperscape/test-framework'
import { getAllScenarios } from '@hyperscape/rpg-tests'

async function runTests() {
  // Create test framework
  const framework = createTestFramework()
  
  // Initialize with the RPG plugin
  await framework.initialize({
    pluginModule: await import('@hyperscape/rpg-core'),
    pluginConfig: {
      debug: false,
      worldGen: { generateDefault: false }
    }
  })
  
  // Register test scenarios
  const scenarios = getAllScenarios()
  framework.registerScenarios(scenarios)
  
  // Run all tests
  const runner = framework.getRunner()
  const report = await runner.run({
    parallel: true,
    maxConcurrent: 5,
    generateReport: true,
    outputDir: './test-results',
    verbose: true
  })
  
  // Check results
  console.log(`Tests completed: ${report.summary.passed}/${report.summary.total} passed`)
  
  // Cleanup
  await framework.cleanup()
}

// 3. Creating a custom test scenario
import { TestScenario, TestContext, TestValidation, ValidationHelpers } from '@hyperscape/test-framework'

class CustomTestScenario implements TestScenario {
  id = 'custom_test'
  name = 'Custom Test Scenario'
  description = 'Example of a custom test'
  category = 'custom'
  tags = ['example', 'custom']
  
  async setup(context: TestContext): Promise<void> {
    // Setup test environment
    await context.helpers.invokeAPI('spawnPlayer', 'test_player', {
      position: { x: 0, y: 0, z: 0 }
    })
  }
  
  async execute(context: TestContext): Promise<void> {
    // Perform test actions
    const moved = context.helpers.invokeAPI('movePlayer', 'test_player', { x: 10, y: 0, z: 10 })
    context.data.set('moveResult', moved)
    
    // Wait for movement to complete
    await context.wait(2000)
  }
  
  async validate(context: TestContext): Promise<TestValidation> {
    // Validate results
    const player = context.helpers.getEntity('test_player')
    const moveResult = context.data.get('moveResult')
    
    const checks = [
      ValidationHelpers.assertTrue(moveResult === true, 'Move command should succeed'),
      ValidationHelpers.assertTrue(player.position.x === 10, 'Player X position should be 10'),
      ValidationHelpers.assertTrue(player.position.z === 10, 'Player Z position should be 10')
    ]
    
    return ValidationHelpers.createValidation(checks)
  }
  
  async cleanup(context: TestContext): Promise<void> {
    // Cleanup
    context.world.entities.destroy('test_player')
  }
}

// Run the custom test
async function runCustomTest() {
  const framework = createTestFramework()
  await framework.initialize({
    pluginModule: await import('@hyperscape/rpg-core')
  })
  
  framework.registerScenario(new CustomTestScenario())
  
  const runner = framework.getRunner()
  const report = await runner.run({
    scenarios: ['custom_test']
  })
  
  console.log('Custom test result:', report.results[0].status)
} 