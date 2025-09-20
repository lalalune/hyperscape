import {
  Entity as ElizaEntity,
  IAgentRuntime,
  Memory,
  ModelType,
  UUID,
} from '@elizaos/core'
import type { HyperscapeService } from '../service'
import { World, Entity } from '../types/core-types'
import { ChatMessage } from '../types'
import {
  composeContext,
  generateMessageResponse,
  shouldRespond,
} from '../utils/ai-helpers'

type HyperscapePlayerData = Entity & {
  metadata?: {
    hyperscape?: {
      name?: string
    }
  }
  data: {
    appearance?: {
      avatar?: string
    }
    [key: string]: any
  }
}

type ElizaEntityWithHyperscape = ElizaEntity & {
  data?: {
    name?: string
  }
  metadata?: {
    hyperscape?: {
      name?: string
    }
    [key: string]: any
  }
}

interface MessageManagerInterface {
  processMessage(msg: ChatMessage): Promise<void>
  sendMessage(message: string): Promise<void>
  handleChatError(error: Error): void
}

interface MessageResponse {
  text: string
  shouldRespond: boolean
  confidence: number
}

interface EntityDetails {
  id: string
  name: string
  type: string
  position?: { x: number; y: number; z: number }
}

export class MessageManager {
  public runtime: IAgentRuntime

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
  }

  async handleMessage(msg: ChatMessage): Promise<void> {
    try {
      console.info('[MessageManager] Processing message:', {
        id: msg.id,
        userId: msg.userId,
        username: msg.username,
        text:
          msg.text?.substring(0, 100) + (msg.text?.length > 100 ? '...' : ''),
      })

      const service = this.getService()
      if (!service || !service.isConnected()) {
        console.warn('[MessageManager] Service not available or not connected')
        return
      }

      const world = service.getWorld()
      if (!world) {
        console.warn('[MessageManager] World not available')
        return
      }

      // Skip messages from this agent
      if (msg.userId === this.runtime.agentId) {
        console.debug('[MessageManager] Skipping own message')
        return
      }

      // Convert chat message to Memory format
      const memory: Memory = {
        id: msg.id as UUID,
        entityId: msg.id as UUID,
        agentId: this.runtime.agentId,
        content: {
          text: msg.text,
          source: 'hyperscape_chat',
        },
        roomId:
          (world.entities.player?.data?.id as UUID) ||
          (crypto.randomUUID() as UUID),
        createdAt: new Date(msg.createdAt).getTime(),
        metadata: {
          type: 'message',
          hyperscape: {
            username: msg.username,
            name: msg.username,
            worldId: service.currentWorldId || undefined,
          },
          username: msg.username,
          avatar: msg.avatar,
          userId: msg.userId || 'unknown',
        },
      }

      // Compose state for response generation
      const state = await this.runtime.composeState(memory)

      // Check if we should respond to this message
      const shouldRespondToMessage = await shouldRespond(
        this.runtime,
        memory,
        state
      )

      if (!shouldRespondToMessage) {
        console.debug('[MessageManager] Determined not to respond to message')
        // Still save the message to memory even if not responding
        await this.runtime.createMemory(memory, 'messages')
        return
      }

      console.info('[MessageManager] Generating response to message')

      // Generate response using enhanced context
      const context = await composeContext({
        state,
        template: `
# Hyperscape Chat Response Instructions

You are an AI agent in a 3D virtual world called Hyperscape. You're chatting with other players in real-time.

## Current Context
Sender: {{senderEntity.name}} ({{senderEntity.id}})
Message: "{{content.text}}"
World State: {{worldContext}}
Recent Chat History: {{recentMessages}}

## Response Guidelines
- Be conversational and engaging
- Reference the virtual world context when relevant
- Keep responses concise but meaningful
- Show interest in other players and their activities
- Ask follow-up questions to encourage conversation
- Be helpful and friendly

Generate a natural chat response that fits the conversation flow.
        `,
      })

      const response = await generateMessageResponse({
        runtime: this.runtime,
        context,
        modelType: ModelType.TEXT_LARGE,
      })

      if (response && response.text) {
        // Create response memory
        const responseMemory: Memory = {
          id: crypto.randomUUID() as UUID,
          entityId: crypto.randomUUID() as UUID,
          agentId: this.runtime.agentId,
          content: {
            text: response.text,
            source: 'agent_response',
          },
          roomId: memory.roomId,
          createdAt: Date.now(),
          metadata: {
            type: 'message',
            inReplyTo: memory.id,
          },
        }

        // Save both original message and response to memory
        await this.runtime.createMemory(memory, 'messages')
        await this.runtime.createMemory(responseMemory, 'messages')

        // Send the response via chat
        await this.sendMessage(response.text)

        console.info('[MessageManager] Response sent:', {
          originalMessage: msg.text?.substring(0, 50) + '...',
          response: response.text?.substring(0, 50) + '...',
        })
      } else {
        console.debug('[MessageManager] No response generated')
        // Still save the original message
        await this.runtime.createMemory(memory, 'messages')
      }
    } catch (error) {
      console.error('[MessageManager] Error handling message:', error)
    }
  }

  async sendMessage(text: string): Promise<void> {
    try {
      const service = this.getService()
      if (!service || !service.isConnected()) {
        throw new Error('Service not available or not connected')
      }

      const world = service.getWorld()
      if (!world?.chat) {
        throw new Error('Chat system not available')
      }

      const player = world.entities.player
      if (!player) {
        throw new Error('Player entity not available')
      }

      // Create chat message
      const chatMessage: ChatMessage = {
        id: crypto.randomUUID(),
        from:
          player.data?.name ||
          (player as HyperscapePlayerData).metadata?.hyperscape?.name ||
          'AI Agent',
        userId: this.runtime.agentId,
        username: player.data.name || 'AI Agent',
        text: text,
        body: text,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        avatar: (player.data as HyperscapePlayerData['data'])?.appearance
          ?.avatar,
      }

      // Add message to chat system
      world.chat.add(chatMessage, true)

      console.info(`[MessageManager] Sent message: ${text}`)
    } catch (error) {
      console.error('[MessageManager] Error sending message:', error)
      throw error
    }
  }

  formatMessages({
    messages,
    entities,
  }: {
    messages: Memory[]
    entities: ElizaEntity[]
  }): string {
    try {
      if (!messages || messages.length === 0) {
        return 'No recent messages'
      }

      // Create entity lookup map
      const entityMap = new Map<string, ElizaEntity>()
      entities.forEach(entity => {
        if (entity.id) {
          entityMap.set(entity.id, entity)
        }
      })

      // Format messages with entity context
      const formattedMessages = messages
        .slice(-10) // Get last 10 messages
        .map(msg => {
          const userId =
            msg.metadata &&
            typeof msg.metadata === 'object' &&
            'userId' in msg.metadata
              ? String(msg.metadata.userId)
              : ''
          const entity = entityMap.get(userId)
          const username =
            msg.metadata &&
            typeof msg.metadata === 'object' &&
            'username' in msg.metadata
              ? String(msg.metadata.username)
              : 'Unknown'
          const senderName =
            (entity as ElizaEntityWithHyperscape).data?.name ||
            (entity as ElizaEntityWithHyperscape).metadata?.hyperscape?.name ||
            username
          const timestamp = new Date(
            msg.createdAt || Date.now()
          ).toLocaleTimeString()
          const text = msg.content.text || ''

          return `[${timestamp}] ${senderName}: ${text}`
        })
        .join('\n')

      return formattedMessages
    } catch (error) {
      console.error('[MessageManager] Error formatting messages:', error)
      return 'Error formatting messages'
    }
  }

  async getRecentMessages(roomId: UUID, count = 20): Promise<Memory[]> {
    try {
      // Get recent messages from runtime memory
      const memories = await this.runtime.getMemories({
        roomId,
        count,
        unique: false,
        tableName: 'messages',
      })

      // Filter for message-type memories and sort by creation time
      const messageMemories = memories
        .filter(
          memory =>
            memory.content.source === 'hyperscape_chat' ||
            memory.content.source === 'agent_response'
        )
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .slice(-count)

      return messageMemories
    } catch (error) {
      console.error('[MessageManager] Error getting recent messages:', error)
      return []
    }
  }

  private getService(): HyperscapeService | null {
    return this.runtime.getService<HyperscapeService>('hyperscape') || null
  }

  private generateId(): string {
    return crypto.randomUUID()
  }

  private findEntityByUserId(world: World, userId: string): Entity | null {
    try {
      // Check players first
      for (const [id, player] of world.entities.players || new Map()) {
        if (player.data.id === userId || id === userId) {
          return player
        }
      }

      // Check other entities
      for (const [id, entity] of world.entities.items || new Map()) {
        if (entity.data.id === userId || id === userId) {
          return entity
        }
      }

      return null
    } catch (error) {
      console.error('[MessageManager] Error finding entity by user ID:', error)
      return null
    }
  }

  private getEntityDetails(entity: Entity): EntityDetails {
    return {
      id: entity.id || 'unknown',
      name:
        entity.data.name ||
        (entity as HyperscapePlayerData).metadata?.hyperscape?.name ||
        'Unknown',
      type: (entity.data.type as string) || 'entity',
      position: entity.position
        ? {
            x: entity.position.x,
            y: entity.position.y,
            z: entity.position.z,
          }
        : undefined,
    }
  }

  private getWorldContext(world: World): string {
    try {
      const playerCount = world.entities.players?.size || 0
      const entityCount = world.entities.items?.size || 0
      const player = world.entities.player

      const context = [
        `Players online: ${playerCount}`,
        `Entities in world: ${entityCount}`,
        player
          ? `Agent position: (${player.node.position?.x?.toFixed(1) || 0}, ${player.node.position?.y?.toFixed(1) || 0}, ${player.node.position?.z?.toFixed(1) || 0})`
          : 'Agent position: unknown',
      ]

      return context.join(', ')
    } catch (error) {
      console.error('[MessageManager] Error getting world context:', error)
      return 'World context unavailable'
    }
  }
}
