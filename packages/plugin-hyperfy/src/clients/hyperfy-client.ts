import { Client, IAgentRuntime, Memory, UUID, generateUUID } from '@elizaos/core'
import WebSocket from 'ws'
import { EventEmitter } from 'events'

export class HyperfyClientInterface extends EventEmitter implements Client {
  private runtime: IAgentRuntime
  private ws: WebSocket | null = null
  private url: string
  private gameRole: string
  private agentId: string
  private connected = false
  private reconnectInterval: NodeJS.Timeout | null = null

  constructor(config: {
    runtime: IAgentRuntime
    url: string
    gameRole: string
    agentId: string
  }) {
    super()
    this.runtime = config.runtime
    this.url = config.url
    this.gameRole = config.gameRole
    this.agentId = config.agentId
  }

  async start(): Promise<void> {
    console.log(`[HyperfyClient] Starting connection to ${this.url}`)
    await this.connect()
  }

  async stop(): Promise<void> {
    console.log('[HyperfyClient] Stopping...')
    this.connected = false

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.on('open', () => {
          console.log('[HyperfyClient] Connected to world')
          this.connected = true

          // Send join message
          const character = this.runtime.character
          this.ws!.send(
            JSON.stringify({
              type: 'join',
              agentId: this.agentId,
              name: character.name,
              position: [
                25 + Math.random() * 10 - 5,
                0,
                25 + Math.random() * 10 - 5,
              ],
              metadata: {
                color: character.settings?.color,
                emoji: character.settings?.emoji,
                role: this.gameRole,
              },
            })
          )

          resolve()
        })

        this.ws.on('message', async data => {
          try {
            const message = JSON.parse(data.toString())
            await this.handleMessage(message)
          } catch (error) {
            console.error('[HyperfyClient] Error handling message:', error)
          }
        })

        this.ws.on('close', () => {
          console.log('[HyperfyClient] Connection closed')
          this.connected = false
          this.ws = null

          // Attempt reconnection
          if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
              if (!this.connected) {
                console.log('[HyperfyClient] Attempting reconnection...')
                this.connect().catch(console.error)
              }
            }, 5000)
          }
        })

        this.ws.on('error', error => {
          console.error('[HyperfyClient] WebSocket error:', error)
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'gameState':
        // Update runtime state with game information
        await this.runtime.updateState({
          gamePhase: message.data.phase,
          taskProgress: message.data.taskProgress,
          alivePlayers: message.data.alivePlayers,
          nearbyPlayers: message.data.nearbyPlayers || [],
        })

        // Trigger decision making
        await this.makeDecision(message.data)
        break

      case 'chat_message':
        // Process incoming chat message
        if (message.data.playerId !== this.agentId) {
          const memory: Memory = {
            id: generateUUID(),
            userId: message.data.playerId as UUID,
            agentId: this.agentId as UUID,
            roomId: generateUUID(),
            content: {
              text: message.data.text,
              playerName: message.data.playerName,
              playerEmoji: message.data.playerEmoji,
            },
            createdAt: new Date(message.data.timestamp).getTime(),
          }

          // Process the message and potentially respond
          await this.runtime.processMemory(memory)
        }
        break
    }
  }

  private async makeDecision(gameState: any): Promise<void> {
    // Only make decisions during gameplay
    if (gameState.phase !== 'gameplay') return

    const player = gameState.players?.find((p: any) => p.id === this.agentId)
    if (!player || !player.alive) return

    // Create context for decision
    const context = {
      role: this.gameRole,
      alive: player.alive,
      position: player.position,
      currentTask: player.currentTask,
      nearbyPlayers: gameState.nearbyPlayers || [],
      nearbyTasks: gameState.nearbyTasks || [],
      nearbyBodies: gameState.nearbyBodies || [],
      taskProgress: gameState.taskProgress,
    }

    // Get AI decision
    const decision = await this.runtime.decide({
      context,
      options: this.getAvailableActions(context),
    })

    // Execute the decision
    if (decision && decision.action) {
      this.sendAction(decision.action, decision.data)

      // Emit decision event for monitoring
      this.runtime.emit('decision', decision)
    }
  }

  private getAvailableActions(context: any): string[] {
    const actions = []

    if (context.role === 'impostor') {
      // Impostor actions
      if (
        context.nearbyPlayers.some(
          (p: any) => p.alive && p.role === 'crewmate' && p.isolated
        )
      ) {
        actions.push('HYPERFY_KILL_PLAYER')
      }
      actions.push('HYPERFY_GOTO_ENTITY') // Fake tasks or hunt
    } else {
      // Crewmate actions
      if (context.nearbyBodies.length > 0) {
        actions.push('HYPERFY_REPORT_BODY')
      }
      if (!context.currentTask && context.nearbyTasks.length > 0) {
        actions.push('HYPERFY_START_TASK')
      }
      if (context.currentTask) {
        actions.push('HYPERFY_COMPLETE_TASK')
      }
      actions.push('HYPERFY_GOTO_ENTITY') // Move to tasks
    }

    // Always allow chat
    actions.push('CHAT_MESSAGE')

    return actions
  }

  private sendAction(action: string, data?: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    this.ws.send(
      JSON.stringify({
        type: 'action',
        action,
        data,
      })
    )
  }

  public sendChat(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    this.ws.send(
      JSON.stringify({
        type: 'chat',
        text,
      })
    )

    // Emit message event for monitoring
    this.runtime.emit('message', {
      content: { text },
    })
  }

  public updatePosition(position: number[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    this.ws.send(
      JSON.stringify({
        type: 'position',
        position,
      })
    )
  }
}
