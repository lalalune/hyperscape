import { Vector3, MathUtils } from '../types/math'
import { Player } from '../entities/Player'
import { EventEmitter } from 'events'

interface PathNode {
  position: Vector3
  f: number
  g: number
  h: number
  parent?: PathNode
}

export class PlayerMovementSystem extends EventEmitter {
  private world: any
  private movingPlayers: Map<string, { target: Vector3; path?: Vector3[] }> =
    new Map()
  private lastUpdateTime: number = Date.now()
  private updateInterval: number = 50 // Network update interval in ms
  private lastNetworkUpdate: number = Date.now()

  constructor(world: any) {
    super()
    this.world = world
  }

  async moveTo(playerId: string, target: Vector3): Promise<void> {
    const player = this.world.getPlayer(playerId)
    if (!player) return

    // Find path to target
    const path = this.findPath(player.position, target)
    if (!path) {
      throw new Error('No path found to target')
    }

    // Start movement
    this.startMovement(playerId, target, path)

    // Wait for movement to complete
    return new Promise(resolve => {
      const checkComplete = () => {
        if (!this.movingPlayers.has(playerId)) {
          resolve()
        } else {
          setTimeout(checkComplete, 50)
        }
      }
      checkComplete()
    })
  }

  startMovement(playerId: string, target: Vector3, path?: Vector3[]): void {
    const player = this.world.getPlayer(playerId)
    if (!player) return

    // Calculate path if not provided
    const finalPath = path || this.findPath(player.position, target) || [target]

    // Set player moving
    player.moveTo(target, finalPath)
    this.movingPlayers.set(playerId, { target, path: finalPath })

    // Calculate initial velocity
    this.updatePlayerVelocity(player, finalPath[0])

    // Broadcast movement start
    this.world.broadcast({
      type: 'player:moved',
      playerId,
      position: player.position,
      velocity: player.velocity,
    })
  }

  stopMovement(playerId: string): void {
    const player = this.world.getPlayer(playerId)
    if (!player) return

    player.stopMovement()
    this.movingPlayers.delete(playerId)

    // Broadcast stop
    this.world.broadcast({
      type: 'player:moved',
      playerId,
      position: player.position,
      velocity: { x: 0, y: 0, z: 0 },
    })
  }

  update(deltaTime: number): void {
    const now = Date.now()

    // Update all moving players
    for (const [playerId, movement] of this.movingPlayers) {
      const player = this.world.getPlayer(playerId)
      if (!player) {
        this.movingPlayers.delete(playerId)
        continue
      }

      // Update player position
      player.update(deltaTime)

      // Check for collisions
      if (this.checkCollisions(player)) {
        // Handle collision - stop or slide
        this.handleCollision(player, movement)
      }

      // Check if reached target
      if (!player.isMoving) {
        this.movingPlayers.delete(playerId)
      }
    }

    // Send network updates at intervals
    if (now - this.lastNetworkUpdate >= this.updateInterval) {
      this.sendNetworkUpdates()
      this.lastNetworkUpdate = now
    }
  }

  findPath(start: Vector3, end: Vector3): Vector3[] | null {
    // Simple A* pathfinding implementation
    const openSet: PathNode[] = []
    const closedSet: Set<string> = new Set()
    const gridSize = 1 // 1 unit grid

    const startNode: PathNode = {
      position: this.snapToGrid(start, gridSize),
      f: 0,
      g: 0,
      h: MathUtils.distance2D(start, end),
    }

    openSet.push(startNode)

    while (openSet.length > 0) {
      // Get node with lowest f score
      openSet.sort((a, b) => a.f - b.f)
      const current = openSet.shift()!

      // Check if reached goal
      if (MathUtils.distance2D(current.position, end) < gridSize) {
        return this.reconstructPath(current)
      }

      const key = `${Math.round(current.position.x)},${Math.round(current.position.z)}`
      closedSet.add(key)

      // Check neighbors
      const neighbors = this.getNeighbors(current.position, gridSize)

      for (const neighborPos of neighbors) {
        const neighborKey = `${Math.round(neighborPos.x)},${Math.round(neighborPos.z)}`
        if (closedSet.has(neighborKey)) continue

        // Check if walkable
        if (this.world.checkCollision(neighborPos)) continue

        const g =
          current.g + MathUtils.distance2D(current.position, neighborPos)
        const h = MathUtils.distance2D(neighborPos, end)
        const f = g + h

        // Check if already in open set
        const existing = openSet.find(
          n =>
            Math.abs(n.position.x - neighborPos.x) < 0.1 &&
            Math.abs(n.position.z - neighborPos.z) < 0.1
        )

        if (existing && existing.g <= g) continue

        const neighbor: PathNode = {
          position: neighborPos,
          f,
          g,
          h,
          parent: current,
        }

        if (existing) {
          // Update existing node
          const index = openSet.indexOf(existing)
          openSet[index] = neighbor
        } else {
          openSet.push(neighbor)
        }
      }

      // Limit search
      if (closedSet.size > 1000) {
        return null // Path too complex
      }
    }

    return null // No path found
  }

  private snapToGrid(pos: Vector3, gridSize: number): Vector3 {
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: pos.y,
      z: Math.round(pos.z / gridSize) * gridSize,
    }
  }

  private getNeighbors(pos: Vector3, gridSize: number): Vector3[] {
    const neighbors: Vector3[] = []
    const directions = [
      { x: gridSize, z: 0 }, // Right
      { x: -gridSize, z: 0 }, // Left
      { x: 0, z: gridSize }, // Down
      { x: 0, z: -gridSize }, // Up
      { x: gridSize, z: gridSize }, // Diagonal
      { x: -gridSize, z: gridSize },
      { x: gridSize, z: -gridSize },
      { x: -gridSize, z: -gridSize },
    ]

    for (const dir of directions) {
      neighbors.push({
        x: pos.x + dir.x,
        y: pos.y,
        z: pos.z + dir.z,
      })
    }

    return neighbors
  }

  private reconstructPath(node: PathNode): Vector3[] {
    const path: Vector3[] = []
    let current: PathNode | undefined = node

    while (current) {
      path.unshift(current.position)
      current = current.parent
    }

    // Smooth path
    return this.smoothPath(path)
  }

  private smoothPath(path: Vector3[]): Vector3[] {
    if (path.length <= 2) return path

    const smoothed: Vector3[] = [path[0]]
    let current = 0

    while (current < path.length - 1) {
      let furthest = current + 1

      // Find furthest point we can reach directly
      for (let i = current + 2; i < path.length; i++) {
        if (this.hasDirectPath(path[current], path[i])) {
          furthest = i
        } else {
          break
        }
      }

      smoothed.push(path[furthest])
      current = furthest
    }

    return smoothed
  }

  private hasDirectPath(start: Vector3, end: Vector3): boolean {
    // Check if direct path is clear
    const steps = Math.ceil(MathUtils.distance2D(start, end))

    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const pos = MathUtils.lerp(start, end, t)

      if (this.world.checkCollision(pos)) {
        return false
      }
    }

    return true
  }

  private updatePlayerVelocity(player: any, target: Vector3): void {
    const direction = MathUtils.subtract(target, player.position)
    const normalized = MathUtils.normalize(direction)

    player.velocity = MathUtils.multiply(normalized, player.speed)
  }

  private checkCollisions(player: any): boolean {
    // Check ahead of player
    const lookAhead = MathUtils.add(
      player.position,
      MathUtils.multiply(MathUtils.normalize(player.velocity), 0.5)
    )

    return this.world.checkCollision(lookAhead, 0.4)
  }

  private handleCollision(
    player: any,
    movement: { target: Vector3; path?: Vector3[] }
  ): void {
    // Try to slide along obstacle
    const slideVelocity = this.calculateSlideVelocity(player)

    if (slideVelocity) {
      player.velocity = slideVelocity
    } else {
      // Can't slide, stop
      this.stopMovement(player.id)
    }
  }

  private calculateSlideVelocity(player: any): Vector3 | null {
    // Try perpendicular directions
    const perpendicular1 = {
      x: -player.velocity.z,
      y: 0,
      z: player.velocity.x,
    }
    const perpendicular2 = {
      x: player.velocity.z,
      y: 0,
      z: -player.velocity.x,
    }

    // Test both directions
    for (const perp of [perpendicular1, perpendicular2]) {
      const testPos = MathUtils.add(
        player.position,
        MathUtils.multiply(MathUtils.normalize(perp), 0.5)
      )

      if (!this.world.checkCollision(testPos)) {
        return MathUtils.multiply(MathUtils.normalize(perp), player.speed * 0.7)
      }
    }

    return null
  }

  private sendNetworkUpdates(): void {
    // Send position updates for all moving players
    for (const [playerId, movement] of this.movingPlayers) {
      const player = this.world.getPlayer(playerId)
      if (!player) continue

      this.world.broadcast({
        type: 'player:moved',
        playerId,
        position: player.position,
        velocity: player.velocity,
      })
    }
  }
}
