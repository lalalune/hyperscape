import { PlayerMovementSystem } from '../../systems/PlayerMovementSystem'
import { MockWorld } from '../helpers/MockWorld'
import { Player } from '../../entities/Player'
import { Vector3 } from '../../types/math'

describe('PlayerMovementSystem', () => {
  let world: MockWorld
  let movementSystem: PlayerMovementSystem
  let player: Player

  beforeEach(() => {
    world = new MockWorld()
    movementSystem = new PlayerMovementSystem(world)
    player = new Player('test-player', {
      position: { x: 0, y: 0, z: 0 },
      speed: 5.0, // units per second
    })
    world.addPlayer(player)
  })

  describe('Basic Movement', () => {
    it('should move player to target position', async () => {
      const target = { x: 10, y: 0, z: 10 }

      await movementSystem.moveTo(player.id, target)

      expect(player.position).toEqual(target)
      expect(world.broadcasts).toContainEqual({
        type: 'player:moved',
        playerId: player.id,
        position: target,
        velocity: expect.any(Object),
      })
    })

    it('should calculate correct velocity vector', () => {
      const target = { x: 10, y: 0, z: 0 }

      movementSystem.startMovement(player.id, target)

      const velocity = player.velocity
      expect(velocity.x).toBeGreaterThan(0)
      expect(velocity.y).toBe(0)
      expect(velocity.z).toBe(0)

      // Should be normalized to player speed
      const magnitude = Math.sqrt(
        velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2
      )
      expect(magnitude).toBeCloseTo(player.speed, 2)
    })

    it('should stop at target position', async () => {
      const target = { x: 5, y: 0, z: 5 }

      await movementSystem.moveTo(player.id, target)

      // Update a few more times to ensure it doesn't overshoot
      for (let i = 0; i < 10; i++) {
        movementSystem.update(0.1)
      }

      expect(player.position.x).toBeCloseTo(target.x, 2)
      expect(player.position.z).toBeCloseTo(target.z, 2)
    })
  })

  describe('Movement Timing', () => {
    it('should respect movement speed', async () => {
      const target = { x: 50, y: 0, z: 0 }
      const distance = 50
      const expectedTime = distance / player.speed // 10 seconds

      const startTime = Date.now()
      await movementSystem.moveTo(player.id, target)
      const endTime = Date.now()

      const actualTime = (endTime - startTime) / 1000
      expect(actualTime).toBeCloseTo(expectedTime, 1)
    })

    it('should handle different speeds correctly', async () => {
      const fastPlayer = new Player('fast-player', {
        position: { x: 0, y: 0, z: 0 },
        speed: 10.0,
      })
      world.addPlayer(fastPlayer)

      const target = { x: 20, y: 0, z: 0 }

      // Move both players
      const normalPromise = movementSystem.moveTo(player.id, target)
      const fastPromise = movementSystem.moveTo(fastPlayer.id, target)

      const normalStart = Date.now()
      await normalPromise
      const normalTime = Date.now() - normalStart

      const fastStart = Date.now()
      await fastPromise
      const fastTime = Date.now() - fastStart

      // Fast player should take half the time
      expect(fastTime).toBeLessThan(normalTime)
      expect(normalTime / fastTime).toBeCloseTo(2, 1)
    })
  })

  describe('Movement Interruption', () => {
    it('should stop movement when interrupted', () => {
      const target = { x: 100, y: 0, z: 100 }

      movementSystem.startMovement(player.id, target)
      expect(player.isMoving).toBe(true)

      // Move partially
      movementSystem.update(1.0)
      const midPosition = { ...player.position }

      // Stop movement
      movementSystem.stopMovement(player.id)

      expect(player.isMoving).toBe(false)
      expect(player.velocity).toEqual({ x: 0, y: 0, z: 0 })

      // Update again - should not move
      movementSystem.update(1.0)
      expect(player.position).toEqual(midPosition)
    })

    it('should change direction when new target set', () => {
      const target1 = { x: 10, y: 0, z: 0 }
      const target2 = { x: 0, y: 0, z: 10 }

      movementSystem.startMovement(player.id, target1)
      const velocity1 = { ...player.velocity }

      // Change target
      movementSystem.startMovement(player.id, target2)
      const velocity2 = { ...player.velocity }

      // Velocities should be different
      expect(velocity2).not.toEqual(velocity1)
      expect(velocity2.x).toBeLessThan(0) // Moving back towards 0
      expect(velocity2.z).toBeGreaterThan(0) // Moving towards positive z
    })
  })

  describe('Collision Detection', () => {
    it('should not move through walls', () => {
      world.addWall({ x: 5, y: 0, z: 0 }, { x: 5, y: 10, z: 10 })

      const target = { x: 10, y: 0, z: 5 }
      movementSystem.startMovement(player.id, target)

      // Update until collision
      for (let i = 0; i < 20; i++) {
        movementSystem.update(0.1)
      }

      // Should stop before wall (at x < 5)
      expect(player.position.x).toBeLessThan(5)
      expect(player.isMoving).toBe(false)
    })

    it('should slide along walls', () => {
      world.addWall({ x: 5, y: 0, z: -10 }, { x: 5, y: 10, z: 10 })

      // Try to move diagonally through wall
      const target = { x: 10, y: 0, z: 10 }
      movementSystem.startMovement(player.id, target)

      // Update movement
      for (let i = 0; i < 30; i++) {
        movementSystem.update(0.1)
      }

      // Should slide along wall to reach z=10
      expect(player.position.x).toBeLessThan(5)
      expect(player.position.z).toBeCloseTo(10, 1)
    })

    it('should avoid other players', () => {
      const otherPlayer = new Player('other-player', {
        position: { x: 5, y: 0, z: 5 },
      })
      world.addPlayer(otherPlayer)

      const target = { x: 10, y: 0, z: 10 }
      movementSystem.startMovement(player.id, target)

      // Update movement
      for (let i = 0; i < 20; i++) {
        movementSystem.update(0.1)
      }

      // Should maintain minimum distance from other player
      const distance = Math.sqrt(
        (player.position.x - otherPlayer.position.x) ** 2 +
          (player.position.z - otherPlayer.position.z) ** 2
      )
      expect(distance).toBeGreaterThan(1.0) // Minimum separation
    })
  })

  describe('Pathfinding', () => {
    it('should find path around obstacles', () => {
      // Create a wall blocking direct path
      world.addWall({ x: -5, y: 0, z: 5 }, { x: 5, y: 10, z: 5 })

      const target = { x: 0, y: 0, z: 10 }
      const path = movementSystem.findPath(player.position, target)

      expect(path.length).toBeGreaterThan(2) // Not direct path

      // Should go around wall
      const midpoint = path[Math.floor(path.length / 2)]
      expect(Math.abs(midpoint.x)).toBeGreaterThan(5) // Goes around
    })

    it('should return null for unreachable targets', () => {
      // Surround target with walls
      const target = { x: 10, y: 0, z: 10 }
      world.addWall({ x: 5, y: 0, z: 5 }, { x: 15, y: 10, z: 5 })
      world.addWall({ x: 5, y: 0, z: 15 }, { x: 15, y: 10, z: 15 })
      world.addWall({ x: 5, y: 0, z: 5 }, { x: 5, y: 10, z: 15 })
      world.addWall({ x: 15, y: 0, z: 5 }, { x: 15, y: 10, z: 15 })

      const path = movementSystem.findPath(player.position, target)

      expect(path).toBeNull()
    })
  })

  describe('Network Synchronization', () => {
    it('should broadcast position updates at intervals', () => {
      const target = { x: 50, y: 0, z: 0 }
      movementSystem.startMovement(player.id, target)

      world.broadcasts = []

      // Update for 2 seconds
      for (let i = 0; i < 20; i++) {
        movementSystem.update(0.1)
      }

      // Should have multiple position updates
      const positionUpdates = world.broadcasts.filter(
        b => b.type === 'player:moved'
      )
      expect(positionUpdates.length).toBeGreaterThan(0)
      expect(positionUpdates.length).toBeLessThan(20) // Not every frame
    })

    it('should send final position when movement stops', async () => {
      const target = { x: 10, y: 0, z: 10 }

      world.broadcasts = []
      await movementSystem.moveTo(player.id, target)

      const finalUpdate = world.broadcasts[world.broadcasts.length - 1]
      expect(finalUpdate.type).toBe('player:moved')
      expect(finalUpdate.position).toEqual(target)
      expect(finalUpdate.velocity).toEqual({ x: 0, y: 0, z: 0 })
    })
  })

  describe('Edge Cases', () => {
    it('should handle movement to current position', async () => {
      const currentPos = { ...player.position }

      await movementSystem.moveTo(player.id, currentPos)

      expect(player.position).toEqual(currentPos)
      expect(player.isMoving).toBe(false)
    })

    it('should handle very small movements', async () => {
      const target = { x: 0.01, y: 0, z: 0.01 }

      await movementSystem.moveTo(player.id, target)

      expect(player.position.x).toBeCloseTo(target.x, 3)
      expect(player.position.z).toBeCloseTo(target.z, 3)
    })

    it('should handle player removal during movement', () => {
      const target = { x: 100, y: 0, z: 100 }
      movementSystem.startMovement(player.id, target)

      // Remove player mid-movement
      world.removePlayer(player.id)

      // Should not throw when updating
      expect(() => {
        movementSystem.update(0.1)
      }).not.toThrow()
    })
  })
})
