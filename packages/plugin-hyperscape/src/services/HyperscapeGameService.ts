import { THREE } from '@hyperscape/shared'
import { HyperscapeService } from '../service'
import { elizaLogger } from '@elizaos/core'

export class HyperscapeGameService {
  private hyperscapeService: HyperscapeService

  constructor(hyperscapeService: HyperscapeService) {
    this.hyperscapeService = hyperscapeService
  }

  async movePlayer(playerId: string, position: THREE.Vector3): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Update player position
      const player = world.entities.players.get(playerId)
      if (player) {
        player.node.position.copy(position)

        // Broadcast movement
        if (world.network && world.network.send) {
          world.network.send('playerMove', {
            playerId,
            position,
          })
        }
      }

      elizaLogger.info(
        `Player ${playerId} moved to ${position.x}, ${position.y}, ${position.z}`
      )
    } catch (error) {
      elizaLogger.error(`Failed to move player ${playerId}:`, error)
      throw error
    }
  }

  async startTask(playerId: string, taskId: string): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Start task logic
      if (world.network && world.network.send) {
        world.network.send('taskStart', {
          playerId,
          taskId,
          timestamp: Date.now(),
        })
      }

      elizaLogger.info(`Player ${playerId} started task ${taskId}`)
    } catch (error) {
      elizaLogger.error(`Failed to start task:`, error)
      throw error
    }
  }

  async performKill(killerId: string, victimId: string): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Kill animation and effects
      if (world.network && world.network.send) {
        world.network.send('playerKill', {
          killerId,
          victimId,
          timestamp: Date.now(),
        })
      }

      elizaLogger.info(`Player ${killerId} eliminated ${victimId}`)
    } catch (error) {
      elizaLogger.error(`Failed to perform kill:`, error)
      throw error
    }
  }

  async reportBody(reporterId: string, bodyId: string): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Trigger meeting
      if (world.network && world.network.send) {
        world.network.send('bodyReport', {
          reporterId,
          bodyId,
          timestamp: Date.now(),
        })
      }

      elizaLogger.info(`Player ${reporterId} reported body ${bodyId}`)
    } catch (error) {
      elizaLogger.error(`Failed to report body:`, error)
      throw error
    }
  }

  async sendChat(playerId: string, message: string): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Send chat message
      if (world.chat && world.chat.add) {
        const chatSystem = world.chat as { add: (message: any) => void }
        chatSystem.add({
          id: `msg-${Date.now()}`,
          entityId: playerId,
          text: message,
          timestamp: Date.now(),
        }) // removed extra parameter that was causing error
      }

      elizaLogger.info(`Player ${playerId} said: ${message}`)
    } catch (error) {
      elizaLogger.error(`Failed to send chat:`, error)
      throw error
    }
  }

  async castVote(voterId: string, targetId: string | null): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Cast vote
      if (world.network && world.network.send) {
        world.network.send('castVote', {
          voterId,
          targetId,
          timestamp: Date.now(),
        })
      }

      elizaLogger.info(`Player ${voterId} voted for ${targetId || 'skip'}`)
    } catch (error) {
      elizaLogger.error(`Failed to cast vote:`, error)
      throw error
    }
  }

  async createGameEntity(entityData: any): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Add entity to world
      if (world.entities && world.entities.add) {
        world.entities.add(entityData)
      }

      elizaLogger.info(`Created game entity: ${entityData.id}`)
    } catch (error) {
      elizaLogger.error(`Failed to create game entity:`, error)
      throw error
    }
  }

  async updateGameState(stateUpdate: any): Promise<void> {
    try {
      const world = this.hyperscapeService.getWorld()
      if (!world) {
        throw new Error('World not initialized')
      }

      // Update game state
      if (world.network && world.network.send) {
        world.network.send('gameStateUpdate', stateUpdate)
      }

      elizaLogger.info(`Updated game state:`, stateUpdate)
    } catch (error) {
      elizaLogger.error(`Failed to update game state:`, error)
      throw error
    }
  }

  getWorld() {
    return this.hyperscapeService.getWorld()
  }

  isConnected(): boolean {
    return this.hyperscapeService.isConnected()
  }
}
