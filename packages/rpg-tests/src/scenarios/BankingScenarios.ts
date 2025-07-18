import { TestScenario, TestContext, TestValidation, ValidationHelpers } from '@hyperscape/test-framework'

/**
 * Basic Banking Test
 * Tests deposit and withdrawal operations
 */
class BasicBankingScenario implements TestScenario {
  id = 'banking_basic'
  name = 'Basic Banking Test'
  description = 'Tests basic deposit and withdrawal operations'
  category = 'banking'
  tags = ['banking', 'deposit', 'withdraw']
  timeout = 30000
  
  private playerId = 'test_player_banking'
  private testItemId = 995 // Gold coins
  
  async setup(context: TestContext): Promise<void> {
    context.log('Setting up banking test...')
    
    // Spawn player
    await context.helpers.invokeAPI('spawnPlayer', this.playerId, {
      position: { x: 3200, y: 1, z: 3200 } // Near bank
    })
    
    // Give player some items
    context.helpers.invokeAPI('giveItem', this.playerId, this.testItemId, 1000)
    context.helpers.invokeAPI('giveItem', this.playerId, 1205, 1) // Bronze dagger
    
    context.log('Banking test setup complete')
  }
  
  async execute(context: TestContext): Promise<void> {
    context.log('Testing banking operations...')
    
    // Open bank
    const bankOpened = context.helpers.invokeAPI('openBank', this.playerId)
    if (!bankOpened) {
      throw new Error('Failed to open bank')
    }
    
    // Wait for bank open event
    await context.helpers.listenForEvent('bank:opened', 5000)
    
    // Record initial inventory
    const initialInventory = context.helpers.invokeAPI('getInventory', this.playerId)
    context.data.set('initialInventory', initialInventory)
    
    // Deposit gold
    context.log('Depositing 500 gold...')
    const deposited = context.helpers.invokeAPI('depositItem', this.playerId, this.testItemId, 500)
    context.data.set('depositSuccess', deposited)
    
    await context.wait(1000)
    
    // Withdraw some gold back
    context.log('Withdrawing 200 gold...')
    const withdrawn = context.helpers.invokeAPI('withdrawItem', this.playerId, this.testItemId, 200)
    context.data.set('withdrawSuccess', withdrawn)
    
    await context.wait(1000)
    
    // Record final inventory
    const finalInventory = context.helpers.invokeAPI('getInventory', this.playerId)
    context.data.set('finalInventory', finalInventory)
  }
  
  async validate(context: TestContext): Promise<TestValidation> {
    context.log('Validating banking results...')
    
    const depositSuccess = context.data.get('depositSuccess')
    const withdrawSuccess = context.data.get('withdrawSuccess')
    const initialInventory = context.data.get('initialInventory')
    const finalInventory = context.data.get('finalInventory')
    
    // Find gold in inventories
    const initialGold = initialInventory?.find((item: any) => item.itemId === this.testItemId)
    const finalGold = finalInventory?.find((item: any) => item.itemId === this.testItemId)
    
    const checks = [
      // Check deposit succeeded
      ValidationHelpers.assertTrue(
        depositSuccess === true,
        'Deposit operation should succeed'
      ),
      
      // Check withdrawal succeeded
      ValidationHelpers.assertTrue(
        withdrawSuccess === true,
        'Withdrawal operation should succeed'
      ),
      
      // Check gold amount is correct (1000 - 500 + 200 = 700)
      ValidationHelpers.assertEqual(
        finalGold?.quantity,
        700,
        'Final gold amount should be 700'
      ),
      
      // Check other items unchanged
      ValidationHelpers.assertEqual(
        initialInventory?.length,
        finalInventory?.length,
        'Number of item stacks should remain the same'
      )
    ]
    
    const metrics = context.helpers.captureMetrics()
    return ValidationHelpers.createValidation(checks, [], metrics)
  }
  
  async cleanup(context: TestContext): Promise<void> {
    context.log('Cleaning up banking test...')
    
    const world = context.world
    world.entities.destroy(this.playerId)
    
    context.log('Banking test cleanup complete')
  }
}

/**
 * Get all banking test scenarios
 */
export function getAllBankingScenarios(): TestScenario[] {
  return [
    new BasicBankingScenario()
  ]
} 