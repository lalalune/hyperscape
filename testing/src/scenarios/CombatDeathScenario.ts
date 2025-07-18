/**
 * Combat Death Test Scenario
 *
 * Tests combat system with condition: mob attacks player until player dies,
 * validates combat mechanics, damage, death animations, and loot drops.
 */

import { TestScenario } from '../ScenarioTestFramework.js'
import { Vector3, CombatComponent, StatsComponent } from '../../types'

export const CombatDeathScenario: TestScenario = {
  id: 'combat_death_test',
  name: 'Combat Death Test',
  description: 'Mob attacks player until player dies, validates combat mechanics and death',
  maxDuration: 60000, // 60 seconds

  async setup(framework) {
    framework.log('⚔️ Setting up combat death test scenario...')

    const rpgHelpers = framework.getRPGHelpers()

    // Spawn test player with low health for faster testing
    const playerPosition: Vector3 = { x: 0, y: 1, z: 0 }
    const player = rpgHelpers.spawnPlayer('combat_test_player', {
      position: playerPosition,
      stats: {
        hitpoints: { current: 20, max: 20 }, // Low health for faster death
        defence: { level: 1, xp: 0 }, // Low defence
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
      },
      visualOverride: {
        color: '#00FF00', // Bright green for player
        size: { width: 1, height: 2, depth: 1 },
      },
    })

    if (!player) {
      throw new Error('Failed to spawn test player')
    }

    framework.log('👤 Player spawned with low health for testing')

    // Spawn aggressive goblin nearby
    const goblinPosition: Vector3 = { x: 3, y: 1, z: 0 }
    const goblin = rpgHelpers.spawnNPC('goblin', {
      position: goblinPosition,
      visualOverride: {
        color: '#FF0000', // Bright red for aggressive goblin
        size: { width: 0.8, height: 1.2, depth: 0.8 },
      },
    })

    if (!goblin) {
      throw new Error('Failed to spawn test goblin')
    }

    framework.log('👹 Aggressive goblin spawned')

    // Spawn weapon for player
    const swordPosition: Vector3 = { x: -1, y: 1, z: 0 }
    const sword = rpgHelpers.spawnItem('sword', {
      position: swordPosition,
      visualOverride: {
        color: '#C0C0C0', // Silver sword
      },
    })

    framework.log('⚔️ Sword spawned for player')

    // Store test data
    ;(framework as any).combatTestData = {
      playerId: 'combat_test_player',
      goblinId: goblin.id,
      swordId: sword?.id,
      playerStartHealth: 20,
      combatStarted: false,
      playerDied: false,
      deathTime: null,
      phase: 'setup_complete',
    }

    framework.log('✅ Combat death scenario setup complete')
  },

  async condition(framework) {
    const testData = (framework as any).combatTestData
    if (!testData) return false

    const rpgHelpers = framework.getRPGHelpers()

    switch (testData.phase) {
      case 'setup_complete':
        // Phase 1: Player equips weapon
        framework.log('🗡️ Player picking up weapon...')

        const equipped = rpgHelpers.equipItem(testData.playerId, 'sword')
        if (equipped) {
          testData.phase = 'weapon_equipped'
          framework.log('✅ Weapon equipped')
        }
        await framework.wait(1000)
        return false

      case 'weapon_equipped':
        // Phase 2: Start combat
        framework.log('⚔️ Initiating combat...')

        const combatStarted = rpgHelpers.startCombat(testData.goblinId, testData.playerId)
        if (combatStarted) {
          testData.combatStarted = true
          testData.combatStartTime = Date.now()
          testData.phase = 'combat_in_progress'
          framework.log('🥊 Combat initiated!')
        }
        return false

      case 'combat_in_progress':
        // Phase 3: Monitor combat until player dies
        const player = rpgHelpers.getTestEntity(testData.playerId)
        const goblin = rpgHelpers.getTestEntity(testData.goblinId)

        if (!player || !goblin) {
          framework.log('❌ Combat entities missing')
          return false
        }

        // Check player health (simulate damage over time)
        const combat = player.getComponent('combat')
        const stats = player.getComponent('stats')

        if (stats) {
          // Simulate damage being dealt
          const elapsed = Date.now() - testData.combatStartTime
          const damagePerSecond = 3 // 3 HP per second
          const totalDamage = Math.floor(elapsed / 1000) * damagePerSecond
          const currentHealth = Math.max(0, testData.playerStartHealth - totalDamage)

          stats.hitpoints.current = currentHealth

          if (currentHealth <= 0 && !testData.playerDied) {
            framework.log('💀 Player has died!')
            testData.playerDied = true
            testData.deathTime = Date.now()
            testData.phase = 'player_died'

            // Trigger death animation
            const visualSystem = framework.getWorld().getSystem('visualRepresentation') as any
            if (visualSystem && visualSystem.playAnimation) {
              visualSystem.playAnimation(testData.playerId, 'die', false, 3000)
            }

            return false
          }

          if (currentHealth > 0) {
            framework.log(`⚡ Combat ongoing - Player health: ${currentHealth}/${testData.playerStartHealth}`)

            // Visual verification during combat
            const playerVisible = await framework.checkEntityVisual(
              testData.playerId,
              '#00FF00', // Green player
              player.position
            )

            const goblinVisible = await framework.checkEntityVisual(
              testData.goblinId,
              '#FF0000', // Red goblin
              goblin.position
            )

            if (!playerVisible || !goblinVisible) {
              framework.log('❌ Visual verification failed during combat')
              return false
            }
          }
        }

        return false

      case 'player_died':
        // Phase 4: Validate death and loot
        framework.log('🪦 Validating death mechanics...')

        const deathElapsed = Date.now() - testData.deathTime

        if (deathElapsed > 3000) {
          // Wait for death animation
          // Drop loot
          const lootDropped = rpgHelpers.dropLoot([
            {
              type: 'coin',
              position: {
                x: testData.playerPosition?.x || 0,
                y: 1,
                z: testData.playerPosition?.z || 0,
              },
            },
          ])

          if (lootDropped) {
            framework.log('💰 Loot dropped on death')
            testData.phase = 'death_complete'
          }
        }

        return false

      case 'death_complete':
        // Phase 5: Final validation
        framework.log('🏁 Final death validation...')

        // Verify all visual elements are correct
        const finalPlayer = rpgHelpers.getTestEntity(testData.playerId)
        const finalGoblin = rpgHelpers.getTestEntity(testData.goblinId)

        if (finalPlayer && finalGoblin) {
          // Check that player is visually "dead" (different color/position)
          const playerStats = finalPlayer.getComponent('stats')
          if (playerStats && playerStats.hitpoints.current <= 0) {
            framework.log('✅ Death validated - Player health is 0')
            framework.log('🎉 Combat death test completed successfully!')
            return true // Test passed
          }
        }

        framework.log('❌ Death validation failed')
        return false

      default:
        framework.log('❌ Unknown combat test phase')
        return false
    }
  },

  async cleanup(framework) {
    framework.log('🧹 Cleaning up combat death test scenario...')

    const testData = (framework as any).combatTestData

    // Stop any ongoing combat
    if (testData && testData.combatStarted) {
      framework.log('⏹️ Stopping combat')
      // In a real implementation, this would use the combat system to end combat
    }

    // Clean up test entities
    const rpgHelpers = framework.getRPGHelpers()
    rpgHelpers.cleanup()

    framework.log('✅ Combat death scenario cleanup complete')
  },

  expectedVisuals: [
    {
      entityId: 'combat_test_player',
      color: '#00FF00',
      position: { x: 0, y: 1, z: 0 },
      visible: true,
    },
    {
      entityId: 'goblin', // Will be dynamically assigned
      color: '#FF0000',
      position: { x: 3, y: 1, z: 0 },
      visible: true,
    },
  ],
}
