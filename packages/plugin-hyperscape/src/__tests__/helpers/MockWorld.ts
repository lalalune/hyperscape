import { EventEmitter } from 'events'
import { Player, THREE, EventType } from '@hyperscape/shared'

type Vector3 = THREE.Vector3

export interface Wall {
  start: Vector3
  end: Vector3
}

export class MockWorld extends EventEmitter {
  players: Map<string, Player> = new Map()
  walls: Wall[] = []
  broadcasts: any[] = []
  activeGames: Map<string, any> = new Map()
  connectedAgents: Map<string, any> = new Map()

  addPlayer(player: Player): void {
    this.players.set(player.id, player)
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId)
  }

  addWall(start: Vector3, end: Vector3): void {
    this.walls.push({ start, end })
  }

  broadcast(message: any): void {
    this.broadcasts.push(message)
    this.emit('broadcast', message)
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId)
  }

  disconnectAgent(agentId: string): void {
    this.connectedAgents.delete(agentId)
    this.emit(EventType.CLIENT_DISCONNECT, { agentId })
  }

  checkCollision(position: Vector3, radius: number = 0.5): boolean {
    // Check wall collisions
    for (const wall of this.walls) {
      if (this.lineCircleIntersection(wall.start, wall.end, position, radius)) {
        return true
      }
    }

    // Check player collisions
    for (const [id, player] of this.players) {
      const distance = Math.sqrt(
        (position.x - player.node.position.x) ** 2 +
          (position.z - player.node.position.z) ** 2
      )
      if (distance < radius * 2 && distance > 0) {
        return true
      }
    }

    return false
  }

  private lineCircleIntersection(
    lineStart: Vector3,
    lineEnd: Vector3,
    circleCenter: Vector3,
    radius: number
  ): boolean {
    // Simple line-circle intersection for 2D (ignoring Y)
    const dx = lineEnd.x - lineStart.x
    const dz = lineEnd.z - lineStart.z
    const fx = lineStart.x - circleCenter.x
    const fz = lineStart.z - circleCenter.z

    const a = dx * dx + dz * dz
    const b = 2 * (fx * dx + fz * dz)
    const c = fx * fx + fz * fz - radius * radius

    const discriminant = b * b - 4 * a * c
    if (discriminant < 0) {
      return false
    }

    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a)
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a)

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)
  }

  reset(): void {
    this.players.clear()
    this.walls = []
    this.broadcasts = []
    this.activeGames.clear()
    this.connectedAgents.clear()
  }
}
