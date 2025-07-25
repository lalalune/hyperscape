import { IAgentRuntime, Memory } from '@elizaos/core'

// Fallback implementations for missing exports
const generateUUID = () => crypto.randomUUID()
interface Client {}
type UUID = string
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
      case 'chat_message':
        // Process incoming chat message
        if (message.data.playerId !== this.agentId) {
          const memory: Memory = {
            id: generateUUID() as any,
            entityId: this.agentId as any,
            agentId: this.agentId as any,
            roomId: generateUUID() as any,
            content: {
              text: message.data.text,
              playerName: message.data.playerName,
              playerEmoji: message.data.playerEmoji,
            },
            createdAt: new Date(message.data.timestamp).getTime(),
          }
        }
        break
    }
  }

  private getAvailableActions(context: any): string[] {
    const actions = []

    actions.push('HYPERFY_GOTO_ENTITY') // Move to tasks

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
    if ('emit' in this.runtime && typeof this.runtime.emit === 'function') {
      (this.runtime as any).emit('message', {
        content: { text },
      })
    }
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
