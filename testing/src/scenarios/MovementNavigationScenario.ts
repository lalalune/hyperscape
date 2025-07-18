/**
 * Movement and Navigation Test Scenario
 *
 * Tests agent movement, pathfinding, obstacle avoidance,
 * and navigation to multiple waypoints with visual validation.
 */

import { TestScenario } from '../ScenarioTestFramework.js'
import { Vector3 } from '../../types'

// Helper function to calculate distance between two points
function calculateDistance(pos1: Vector3, pos2: Vector3): number {
  const dx = pos1.x - pos2.x
  const dy = pos1.y - pos2.y
  const dz = pos1.z - pos2.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export const MovementNavigationScenario: TestScenario = {
  id: 'movement_navigation_test',
  name: 'Movement and Navigation Test',
  description: 'Agent navigates through obstacles to multiple waypoints',
  maxDuration: 90000, // 90 seconds for complex navigation

  async setup(framework) {
    framework.log('🚶 Setting up movement and navigation test scenario...')

    const rpgHelpers = framework.getRPGHelpers()

    // Create navigation course with waypoints
    const waypoints: Vector3[] = [
      { x: 0, y: 1, z: 0 }, // Start
      { x: 5, y: 1, z: 0 }, // East
      { x: 5, y: 1, z: 5 }, // Northeast
      { x: 0, y: 1, z: 5 }, // North
      { x: -5, y: 1, z: 5 }, // Northwest
      { x: -5, y: 1, z: 0 }, // West
      { x: 0, y: 1, z: -5 }, // South
      { x: 0, y: 1, z: 0 }, // Return to start
    ]

    // Spawn test player at start position
    const player = rpgHelpers.spawnPlayer('navigation_test_player', {
      position: waypoints[0],
      stats: {
        hitpoints: { current: 100, max: 100 },
      },
      visualOverride: {
        color: '#0080FF', // Bright blue for navigation test
        size: { width: 1, height: 2, depth: 1 },
      },
    })

    if (!player) {
      throw new Error('Failed to spawn navigation test player')
    }

    framework.log('👤 Navigation test player spawned')

    // Create obstacle course - spawn obstacles
    const obstacles = [
      { position: { x: 2, y: 1, z: 2 }, type: 'rock' },
      { position: { x: -2, y: 1, z: 2 }, type: 'tree' },
      { position: { x: 3, y: 1, z: -2 }, type: 'chest' },
      { position: { x: -3, y: 1, z: -1 }, type: 'barrel' },
    ]

    const obstacleEntities: Array<{ id: string; position: Vector3 }> = []
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i]
      let entity

      if (obstacle.type === 'chest') {
        entity = rpgHelpers.spawnChest('chest_common', {
          position: obstacle.position,
          visualOverride: {
            color: '#8B4513', // Brown obstacles
          },
        })
      } else {
        entity = rpgHelpers.spawnItem(obstacle.type, {
          position: obstacle.position,
          visualOverride: {
            color: '#8B4513', // Brown obstacles
          },
        })
      }

      if (entity) {
        obstacleEntities.push({ id: entity.id, position: obstacle.position })
      }
    }

    framework.log(`🚧 Created ${obstacleEntities.length} navigation obstacles`)

    // Create waypoint markers (visual indicators)
    const waypointMarkers: Array<{ id: string; position: Vector3; index: number }> = []
    for (let i = 1; i < waypoints.length; i++) {
      // Skip start position
      const marker = rpgHelpers.spawnItem('gem', {
        position: waypoints[i],
        visualOverride: {
          color: '#FFFF00', // Yellow waypoint markers
        },
      })

      if (marker) {
        waypointMarkers.push({ id: marker.id, position: waypoints[i], index: i })
      }
    }

    framework.log(`📍 Created ${waypointMarkers.length} waypoint markers`)

    // Store test data
    ;(framework as any).navigationTestData = {
      playerId: 'navigation_test_player',
      waypoints,
      obstacles: obstacleEntities,
      waypointMarkers,
      currentWaypointIndex: 1, // Start with first waypoint (index 0 is start position)
      movementStartTime: null,
      completedWaypoints: [],
      totalDistance: 0,
      phase: 'setup_complete',
    }

    framework.log('✅ Movement navigation scenario setup complete')
  },

  async condition(framework) {
    const testData = (framework as any).navigationTestData
    if (!testData) return false

    const rpgHelpers = framework.getRPGHelpers()

    switch (testData.phase) {
      case 'setup_complete':
        // Phase 1: Start navigation
        framework.log('🎯 Starting navigation sequence...')

        testData.phase = 'navigating'
        testData.navigationStartTime = Date.now()
        return false

      case 'navigating':
        // Phase 2: Navigate through waypoints
        const player = rpgHelpers.getTestEntity(testData.playerId)
        if (!player) {
          framework.log('❌ Navigation player not found')
          return false
        }

        const currentWaypoint = testData.waypoints[testData.currentWaypointIndex]
        if (!currentWaypoint) {
          // All waypoints completed
          framework.log('🏁 All waypoints reached!')
          testData.phase = 'navigation_complete'
          return false
        }

        // Check if we need to start moving to current waypoint
        if (!testData.movementStartTime) {
          framework.log(
            `🚶 Moving to waypoint ${testData.currentWaypointIndex}: (${currentWaypoint.x}, ${currentWaypoint.y}, ${currentWaypoint.z})`
          )

          const moved = rpgHelpers.movePlayer(testData.playerId, currentWaypoint)
          if (moved) {
            testData.movementStartTime = Date.now()
          }
          return false
        }

        // Check if we've reached the current waypoint
        const distance = calculateDistance(player.position, currentWaypoint)
        const tolerance = 1.5 // Allow some tolerance for reaching waypoints

        if (distance <= tolerance) {
          // Waypoint reached!
          framework.log(`✅ Waypoint ${testData.currentWaypointIndex} reached!`)

          testData.completedWaypoints.push({
            index: testData.currentWaypointIndex,
            position: currentWaypoint,
            timeToReach: Date.now() - testData.movementStartTime,
          })

          // Move to next waypoint
          testData.currentWaypointIndex++
          testData.movementStartTime = null

          // Visual verification - check player is at expected position
          const playerVisible = await framework.checkEntityVisual(
            testData.playerId,
            '#0080FF', // Blue player
            currentWaypoint
          )

          if (!playerVisible) {
            framework.log('❌ Player visual verification failed at waypoint')
            return false
          }

          return false
        }

        // Check movement timeout for current waypoint
        const movementElapsed = Date.now() - testData.movementStartTime
        if (movementElapsed > 15000) {
          // 15 seconds per waypoint
          framework.log(`⏰ Movement timeout for waypoint ${testData.currentWaypointIndex}`)

          // Try to continue to next waypoint anyway
          testData.currentWaypointIndex++
          testData.movementStartTime = null
        }

        // Log progress
        const elapsed = Date.now() - testData.navigationStartTime
        if (elapsed % 5000 < 500) {
          // Log every 5 seconds
          framework.log(
            `🗺️ Navigation progress: waypoint ${testData.currentWaypointIndex}/${testData.waypoints.length - 1}, distance: ${distance.toFixed(1)}`
          )
        }

        return false

      case 'navigation_complete':
        // Phase 3: Validate complete navigation
        framework.log('🔍 Validating navigation completion...')

        // Check that we completed most waypoints (allow some failure tolerance)
        const totalWaypoints = testData.waypoints.length - 1 // Exclude start position
        const completedCount = testData.completedWaypoints.length
        const successRate = completedCount / totalWaypoints

        framework.log(
          `📊 Navigation results: ${completedCount}/${totalWaypoints} waypoints (${(successRate * 100).toFixed(1)}%)`
        )

        if (successRate >= 0.75) {
          // 75% success rate required
          // Final visual verification - check obstacles are still there
          let obstaclesIntact = true
          for (const obstacle of testData.obstacles) {
            const obstacleExists = rpgHelpers.getTestEntity(obstacle.id)
            if (!obstacleExists) {
              framework.log(`⚠️ Obstacle missing: ${obstacle.id}`)
              obstaclesIntact = false
            }
          }

          if (obstaclesIntact) {
            framework.log('🎉 Navigation test completed successfully!')
            return true // Test passed
          } else {
            framework.log('❌ Obstacle integrity check failed')
            return false
          }
        } else {
          framework.log('❌ Insufficient waypoints completed')
          return false
        }

      default:
        framework.log('❌ Unknown navigation test phase')
        return false
    }
  },

  async cleanup(framework) {
    framework.log('🧹 Cleaning up movement navigation test scenario...')

    const testData = (framework as any).navigationTestData

    if (testData) {
      // Log final statistics
      framework.log(`📈 Navigation Statistics:`)
      framework.log(`   Total waypoints: ${testData.waypoints.length - 1}`)
      framework.log(`   Completed: ${testData.completedWaypoints.length}`)
      framework.log(
        `   Success rate: ${((testData.completedWaypoints.length / (testData.waypoints.length - 1)) * 100).toFixed(1)}%`
      )

      if (testData.completedWaypoints.length > 0) {
        const avgTime =
          testData.completedWaypoints.reduce((sum, wp) => sum + wp.timeToReach, 0) / testData.completedWaypoints.length
        framework.log(`   Average time per waypoint: ${(avgTime / 1000).toFixed(1)}s`)
      }
    }

    // Clean up test entities
    const rpgHelpers = framework.getRPGHelpers()
    rpgHelpers.cleanup()

    framework.log('✅ Movement navigation scenario cleanup complete')
  },

  expectedVisuals: [
    {
      entityId: 'navigation_test_player',
      color: '#0080FF',
      position: { x: 0, y: 1, z: 0 },
      visible: true,
    },
  ],
}
