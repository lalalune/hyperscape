import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ignoreAction } from '../../actions/ignore'
import { createMockRuntime, toUUID } from '../test-utils'
import type {
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from '@elizaos/core'

interface HandlerResponse {
  content: {
    text: string
    thought?: string
    actions: string[]
  }
}

describe('IGNORE Action', () => {
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
      const result = await ignoreAction.validate(mockRuntime, mockMessage)
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
          text: 'Go away bot',
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
    })

    it('should return true and call callback with response content', async () => {
      const responses: HandlerResponse[] = [
        {
          content: {
            text: '',
            thought: 'User is being rude, I should ignore them',
            actions: ['IGNORE'],
          },
        },
      ]

      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        null as unknown as HandlerCallback,
        responses
      )

      expect(result).toBeDefined()
      expect(result).toHaveProperty('text', '')
      expect(result).toHaveProperty('values', {
        ignored: true,
        reason: 'conversation_ended_or_inappropriate',
      })
      expect(result).toHaveProperty('data', {
        action: 'IGNORE',
        hasResponse: true,
      })
      expect(mockCallback).toHaveBeenCalledWith({
        text: '',
        thought: 'User is being rude, I should ignore them',
        actions: ['IGNORE'],
      })
    })

    it('should return true without calling callback if no responses', async () => {
      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        []
      )

      expect(result).toBeDefined()
      expect(result).toHaveProperty('text', '')
      expect(result).toHaveProperty('values', {
        ignored: true,
        reason: 'conversation_ended_or_inappropriate',
      })
      expect(result).toHaveProperty('data', {
        action: 'IGNORE',
        hasResponse: false,
      })
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should handle responses without content gracefully', async () => {
      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        []
      )

      expect(result).toBeDefined()
      expect(result).toHaveProperty('text', '')
      expect(result).toHaveProperty('values', {
        ignored: true,
        reason: 'conversation_ended_or_inappropriate',
      })
      expect(result).toHaveProperty('data', {
        action: 'IGNORE',
        hasResponse: false,
      })
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should handle null callback gracefully', async () => {
      const responses: HandlerResponse[] = [
        {
          content: {
            text: '',
            actions: ['IGNORE'],
          },
        },
      ]

      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        null as unknown as HandlerCallback,
        responses
      )

      expect(result).toBeDefined()
      expect(result).toHaveProperty('text', '')
      expect(result).toHaveProperty('values', {
        ignored: true,
        reason: 'conversation_ended_or_inappropriate',
      })
      expect(result).toHaveProperty('data', {
        action: 'IGNORE',
        hasResponse: true,
      })
    })

    it('should handle multiple responses by using the first one', async () => {
      const responses: HandlerResponse[] = [
        {
          content: {
            text: '',
            thought: 'First ignore response',
            actions: ['IGNORE'],
          },
        },
        {
          content: {
            text: '',
            thought: 'Second ignore response',
            actions: ['IGNORE'],
          },
        },
      ]

      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        responses
      )

      expect(result).toBeDefined()
      expect(result).toHaveProperty('text', '')
      expect(result).toHaveProperty('values', {
        ignored: true,
        reason: 'conversation_ended_or_inappropriate',
      })
      expect(result).toHaveProperty('data', {
        action: 'IGNORE',
        hasResponse: true,
      })
      expect(mockCallback).toHaveBeenCalledWith({
        text: '',
        thought: 'First ignore response',
        actions: ['IGNORE'],
      })
    })
  })

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(ignoreAction.examples).toBeDefined()
      expect(Array.isArray(ignoreAction.examples)).toBe(true)
      expect(ignoreAction.examples!.length).toBeGreaterThan(0)
    })

    it('should have properly formatted examples', () => {
      ignoreAction.examples!.forEach(example => {
        expect(Array.isArray(example)).toBe(true)
        expect(example.length).toBeGreaterThanOrEqual(1)

        example.forEach(message => {
          expect(message).toHaveProperty('name')
          expect(message).toHaveProperty('content')

          // Check if it's an agent response with IGNORE action
          if (message.content.actions) {
            expect(message.content.actions).toContain('IGNORE')
            // IGNORE actions typically have empty text (but not always)
            if (message.content.text !== 'thats inappropriate') {
              expect(message.content.text).toBe('')
            }
          }
        })
      })
    })

    it('should include examples of different ignore scenarios', () => {
      const examples = ignoreAction.examples!

      // Should have examples for:
      // 1. Aggressive user behavior
      const aggressiveExample = examples.find(
        ex =>
          ex[0].content.text?.toLowerCase().includes('screw') ||
          ex[0].content.text?.toLowerCase().includes('shut up')
      )
      expect(aggressiveExample).toBeDefined()

      // 2. End of conversation
      const goodbyeExample = examples.find(ex =>
        ex.some(
          msg =>
            msg.content.text?.toLowerCase().includes('bye') ||
            msg.content.text?.toLowerCase().includes('cya')
        )
      )
      expect(goodbyeExample).toBeDefined()

      // 3. Inappropriate content
      const inappropriateExample = examples.find(ex =>
        ex[0].content.text?.toLowerCase().includes('cyber')
      )
      expect(inappropriateExample).toBeDefined()
    })
  })

  describe('similes', () => {
    it('should have appropriate similes', () => {
      expect(ignoreAction.similes).toBeDefined()
      expect(Array.isArray(ignoreAction.similes)).toBe(true)
      expect(ignoreAction.similes).toContain('STOP_TALKING')
      expect(ignoreAction.similes).toContain('STOP_CHATTING')
      expect(ignoreAction.similes).toContain('STOP_CONVERSATION')
    })
  })

  describe('description', () => {
    it('should have a comprehensive description', () => {
      expect(ignoreAction.description).toBeDefined()
      expect(ignoreAction.description).toContain('ignoring the user')
      expect(ignoreAction.description).toContain('aggressive')
      expect(ignoreAction.description).toContain(
        'conversation has naturally ended'
      )
    })
  })
})
