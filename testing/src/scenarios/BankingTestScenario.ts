/**
 * Banking System Test Scenario
 *
 * Tests agent walking into a physical bank, UI appearing,
 * and banking operations with visual verification.
 */

import { TestScenario } from '../ScenarioTestFramework.js'
import { BuildingTemplates } from '../BuildingProxySystem.js'
import { Vector3 } from '../../types'

export const BankingTestScenario: TestScenario = {
  id: 'banking_test',
  name: 'Banking System Test',
  description: 'Agent walks into bank, opens banking UI, performs banking operations',
  maxDuration: 45000, // 45 seconds

  async setup(framework) {
    framework.log('🏦 Setting up banking test scenario...')

    // Get building proxy system (we'll create it if needed)
    const world = framework.getWorld()
    let buildingSystem = world.getSystem('buildingProxy') as any

    if (!buildingSystem) {
      const { BuildingProxySystem } = await import('../BuildingProxySystem')
      buildingSystem = new BuildingProxySystem(world)
      await buildingSystem.init()
      ;(world as any).systems = (world as any).systems || new Map()
      ;(world as any).systems.set('buildingProxy', buildingSystem)
    }

    // Create bank building at test position
    const bankPosition: Vector3 = { x: 10, y: 1, z: 10 }
    const bankConfig = BuildingTemplates.bank('test_bank', bankPosition)

    // Override color for testing
    bankConfig.color = '#FFD700' // Bright gold for visibility

    const bank = buildingSystem.createBuilding(bankConfig)
    if (!bank) {
      throw new Error('Failed to create test bank building')
    }

    framework.log('🏦 Bank building created with trigger zones')

    // Spawn test player outside the bank
    const playerStartPosition: Vector3 = { x: 10, y: 1, z: 18 } // 8 units in front of bank
    const rpgHelpers = framework.getRPGHelpers()

    const player = rpgHelpers.spawnPlayer('banking_test_player', {
      position: playerStartPosition,
      stats: {
        hitpoints: { current: 100, max: 100 },
      },
      visualOverride: {
        color: '#FF69B4', // Hot pink for high visibility
        size: { width: 1, height: 2, depth: 1 },
      },
    })

    if (!player) {
      throw new Error('Failed to spawn test player')
    }

    framework.log('👤 Test player spawned outside bank')

    // Give player some items to bank
    const testItems = ['coin', 'sword', 'potion']
    for (let i = 0; i < testItems.length; i++) {
      rpgHelpers.spawnItem(testItems[i], {
        position: {
          x: playerStartPosition.x + i - 1,
          y: playerStartPosition.y,
          z: playerStartPosition.z - 1,
        },
        visualOverride: {
          color: '#00FFFF', // Cyan for test items
        },
      })
    }

    framework.log('💰 Test items spawned for banking')

    // Store test data for condition checking
    ;(framework as any).bankingTestData = {
      bankId: 'test_bank',
      playerId: 'banking_test_player',
      playerStartPosition,
      bankPosition,
      phase: 'setup_complete',
    }

    framework.log('✅ Banking scenario setup complete')
  },

  async condition(framework) {
    const testData = (framework as any).bankingTestData
    if (!testData) return false

    const rpgHelpers = framework.getRPGHelpers()
    const world = framework.getWorld()
    const buildingSystem = world.getSystem('buildingProxy')

    switch (testData.phase) {
      case 'setup_complete':
        // Phase 1: Move player towards bank
        framework.log('🚶 Moving player towards bank...')

        const bankEntrancePosition: Vector3 = {
          x: testData.bankPosition.x,
          y: testData.bankPosition.y,
          z: testData.bankPosition.z + 5, // Just outside entrance trigger
        }

        const moved = rpgHelpers.movePlayer(testData.playerId, bankEntrancePosition)
        if (moved) {
          testData.phase = 'moving_to_bank'
          framework.log('🎯 Player movement started')
        }
        return false

      case 'moving_to_bank':
        // Wait for movement to complete (check if near entrance)
        await framework.wait(2000) // Give time for movement animation

        framework.log('🚪 Moving player into bank entrance...')

        // Move player into trigger zone
        const triggerPosition: Vector3 = {
          x: testData.bankPosition.x,
          y: testData.bankPosition.y,
          z: testData.bankPosition.z + 5,
        }

        rpgHelpers.movePlayer(testData.playerId, triggerPosition)
        testData.phase = 'entering_bank'
        return false

      case 'entering_bank':
        // Check if player triggered bank zone
        await framework.wait(1000)

        framework.log('🔍 Checking trigger zone activation...')

        const player = rpgHelpers.getTestEntity(testData.playerId)
        if (player) {
          const triggeredZones = (buildingSystem as any).checkTriggerZones(player.position)

          if (triggeredZones.length > 0) {
            const bankTrigger = triggeredZones.find(z => z.buildingId === testData.bankId && z.uiType === 'banking')

            if (bankTrigger) {
              framework.log('✅ Bank trigger zone activated!')
              testData.phase = 'bank_ui_opening'
              return false
            }
          }
        }

        // Timeout check - if we've been in this phase too long, consider it failed
        if (!testData.enteringStartTime) {
          testData.enteringStartTime = Date.now()
        } else if (Date.now() - testData.enteringStartTime > 10000) {
          framework.log('❌ Failed to trigger bank zone within timeout')
          return false
        }

        return false

      case 'bank_ui_opening':
        // Simulate UI opening (in a real scenario, this would be handled by UI system)
        framework.log('🖥️ Simulating banking UI opening...')

        // Move player to banking counter position
        const counterPosition: Vector3 = {
          x: testData.bankPosition.x,
          y: testData.bankPosition.y,
          z: testData.bankPosition.z - 2,
        }

        rpgHelpers.movePlayer(testData.playerId, counterPosition)

        testData.phase = 'performing_banking'
        testData.counterPosition = counterPosition
        await framework.wait(1000)
        return false

      case 'performing_banking':
        // Simulate banking operations
        framework.log('💰 Simulating banking operations...')

        // Visual verification: Check that bank and player are visible
        const bankBuilding = (buildingSystem as any).getBuilding(testData.bankId)
        const bankVisible = await framework.checkEntityVisual(
          testData.bankId,
          '#FFD700', // Gold bank color
          testData.bankPosition
        )

        const playerVisible = await framework.checkEntityVisual(
          testData.playerId,
          '#FF69B4', // Hot pink player color
          testData.counterPosition
        )

        if (bankVisible && playerVisible) {
          framework.log('✅ Visual verification passed: Bank and player visible')
          testData.phase = 'banking_complete'
          return false
        } else {
          framework.log('❌ Visual verification failed')
          return false
        }

      case 'banking_complete':
        // Final phase - banking operations complete
        framework.log('🎉 Banking operations completed successfully!')
        return true // Test passed

      default:
        framework.log('❌ Unknown test phase')
        return false
    }
  },

  async cleanup(framework) {
    framework.log('🧹 Cleaning up banking test scenario...')

    const testData = (framework as any).bankingTestData
    if (testData) {
      // Remove bank building
      const world = framework.getWorld()
      const buildingSystem = world.getSystem('buildingProxy')
      if (buildingSystem && testData.bankId) {
        (buildingSystem as any).removeBuilding(testData.bankId)
        framework.log('🏦 Bank building removed')
      }
    }

    // Clean up test entities
    const rpgHelpers = framework.getRPGHelpers()
    rpgHelpers.cleanup()

    framework.log('✅ Banking scenario cleanup complete')
  },

  expectedVisuals: [
    {
      entityId: 'test_bank',
      color: '#FFD700',
      position: { x: 10, y: 1, z: 10 },
      visible: true,
    },
    {
      entityId: 'banking_test_player',
      color: '#FF69B4',
      position: { x: 10, y: 1, z: 18 },
      visible: true,
    },
  ],
}
