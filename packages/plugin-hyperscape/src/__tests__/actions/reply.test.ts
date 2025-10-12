import { describe, it, expect, vi, beforeEach } from 'vitest'
import { replyAction } from '../../actions/reply'
import { createMockRuntime, toUUID } from '../test-utils'
import type { IAgentRuntime, Memory, State } from '@elizaos/core'

describe('REPLY Action', () => {
  let mockRuntime: IAgentRuntime

  beforeEach(() => {
    vi.restoreAllMocks()
    mockRuntime = createMockRuntime()
  })

  describe('validate', () => {
    it('should always return true', async () => {
      const mockMessage: Memory = {
        id: toUUID('msg-123'),
        content: { text: 'test' },
        entityId: toUUID('test-entity'),
        agentId: toUUID('test-agent'),
        roomId: toUUID('test-room'),
        createdAt: Date.now(),
      }
      const result = await replyAction.validate(mockRuntime, mockMessage)
      expect(result).toBe(true)
    })
  })

  describe('handler', () => {
    let mockMessage: Memory
    let mockState: State
    let mockCallback: vi.Mock

    beforeEach(() => {
      mockMessage = {
        id: toUUID('msg-123'),
        content: {
          text: 'Hello, how are you?',
        },
        entityId: toUUID('test-entity'),
        agentId: toUUID('test-agent'),
        roomId: toUUID('test-room'),
        createdAt: Date.now(),
      }

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      }

      mockCallback = vi.fn()

      // Mock composeState
      mockRuntime.composeState = vi.fn().mockResolvedValue({
        ...mockState,
        conversationContext: 'User greeted the agent',
      })

      // Mock useModel for reply generation
      mockRuntime.useModel = vi.fn().mockResolvedValue({
        thought: 'User is greeting me, I should respond politely',
        message:
          "I'm doing great, thank you for asking! How can I help you today?",
      })
    })

    it('should generate reply without existing responses', async () => {
      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockRuntime.composeState).toHaveBeenCalledWith(mockMessage)
      expect(mockRuntime.useModel).toHaveBeenCalled()
      expect(mockCallback).toHaveBeenCalledWith({
        text: expect.any(String),
        thought: expect.any(String),
        actions: ['HYPERSCAPE_REPLY'],
        source: 'hyperscape',
      })
    })

    it('should use existing reply responses if available', async () => {
      const responses = [
        {
          content: { text: 'Existing', actions: ['REPLY'], thought: 'thought' },
        },
      ]
      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        responses
      )

      expect(mockCallback).toHaveBeenCalledWith({
        text: 'Existing',
        actions: ['HYPERSCAPE_REPLY'],
        source: 'hyperscape',
      })
    })

    it('should handle multiple existing reply responses', async () => {
      const responses = [
        {
          content: {
            text: 'First reply',
            actions: ['REPLY'],
            thought: 'thought1',
          },
        },
        {
          content: {
            text: 'Second reply',
            actions: ['REPLY'],
            thought: 'thought2',
          },
        },
      ]
      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        responses
      )

      expect(mockCallback).toHaveBeenCalledTimes(2)
      expect(mockCallback).toHaveBeenNthCalledWith(1, {
        text: 'First reply',
        actions: ['HYPERSCAPE_REPLY'],
        source: 'hyperscape',
      })
      expect(mockCallback).toHaveBeenNthCalledWith(2, {
        text: 'Second reply',
        actions: ['HYPERSCAPE_REPLY'],
        source: 'hyperscape',
      })
    })

    it('should ignore responses without REPLY action', async () => {
      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        [{ content: { text: '', actions: ['OTHER'], thought: 'thought' } }]
      )

      expect(mockRuntime.useModel).toHaveBeenCalled()
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
          data: {
            source: 'hyperscape',
            action: 'REPLY',
            thought: expect.any(String),
            actions: ['REPLY'],
          },
        })
      )
    })

    it('should handle empty message from model', async () => {
      mockRuntime.useModel.mockResolvedValue({
        thought: 'Nothing to say',
        message: '',
      })

      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        [{ content: { text: '', actions: ['REPLY'], thought: 'thought' } }]
      )

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          data: {
            source: 'hyperscape',
            action: 'REPLY',
            thought: 'Nothing to say',
            actions: ['REPLY'],
          },
        })
      )
    })

    it('should use message field when available in responses', async () => {
      const responses = [
        {
          content: {
            message: 'Message field content',
            actions: ['REPLY'],
            thought: 'thought',
          },
        },
      ]
      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        responses
      )

      // Since replyFieldKeys is ['message', 'text'], it will use message first
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Message field content',
          data: {
            source: 'hyperscape',
            action: 'REPLY',
            thought: expect.any(String),
            actions: ['REPLY'],
          },
        })
      )
    })
  })

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(replyAction.examples).toBeDefined()
      expect(Array.isArray(replyAction.examples)).toBe(true)
      expect(replyAction.examples!.length).toBeGreaterThan(0)
    })

    it('should have properly formatted examples', () => {
      replyAction.examples!.forEach(example => {
        expect(Array.isArray(example)).toBe(true)
        expect(example.length).toBe(2)

        const [user, agent] = example
        expect(user).toHaveProperty('name')
        expect(user).toHaveProperty('content')
        expect(user.content).toHaveProperty('text')

        expect(agent).toHaveProperty('name')
        expect(agent).toHaveProperty('content')
        expect(agent.content).toHaveProperty('text')
        expect(agent.content).toHaveProperty('actions')
        expect(agent.content.actions).toContain('REPLY')
      })
    })
  })
})
