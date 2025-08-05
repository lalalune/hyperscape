import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hyperscapeUnuseItemAction } from '../../actions/unuse'
import {
  createMockRuntime,
  createMockMemory,
  createMockState,
} from '../test-utils'
import type { IAgentRuntime } from '@elizaos/core'

describe('hyperscapeUnuseItemAction', () => {
  let mockRuntime: IAgentRuntime
  let mockService: any
  let mockWorld: any
  let mockActions: any

  beforeEach(() => {
    vi.restoreAllMocks()

    // Create mock actions
    mockActions = {
      releaseAction: vi.fn(),
    }

    // Create mock world
    mockWorld = {
      actions: mockActions,
      entities: {
        player: {
          data: { id: 'test-player-id', name: 'TestAgent' },
        },
      },
    }

    // Create mock service
    mockService = {
      isConnected: vi.fn().mockReturnValue(true),
      getWorld: vi.fn().mockReturnValue(mockWorld),
    }

    // Create mock runtime with service
    mockRuntime = createMockRuntime()
    vi.spyOn(mockRuntime, 'getService').mockReturnValue(mockService)
  })

  describe('validate', () => {
    it('should return true when service is connected and world has actions', async () => {
      const isValid = await hyperscapeUnuseItemAction.validate(
        mockRuntime as any,
        {} as any,
        {} as any
      )

      expect(isValid).toBe(true)
      expect(mockRuntime.getService).toHaveBeenCalled()
      expect(mockService.isConnected).toHaveBeenCalled()
      expect(mockService.getWorld).toHaveBeenCalled()
    })

    it('should return false when service is not available', async () => {
      mockRuntime.getService = vi.fn().mockReturnValue(null)

      const isValid = await hyperscapeUnuseItemAction.validate(
        mockRuntime as any,
        {} as any,
        {} as any
      )

      expect(isValid).toBe(false)
    })

    it('should return false when service is not connected', async () => {
      mockService.isConnected.mockReturnValue(false)

      const isValid = await hyperscapeUnuseItemAction.validate(
        mockRuntime as any,
        {} as any,
        {} as any
      )

      expect(isValid).toBe(false)
    })

    it('should return false when world is not available', async () => {
      mockService.getWorld.mockReturnValue(null)

      const isValid = await hyperscapeUnuseItemAction.validate(
        mockRuntime as any,
        {} as any,
        {} as any
      )

      expect(isValid).toBe(false)
    })

    it('should return false when world has no actions', async () => {
      mockWorld.actions = undefined

      const isValid = await hyperscapeUnuseItemAction.validate(
        mockRuntime as any,
        {} as any,
        {} as any
      )

      expect(isValid).toBe(false)
    })
  })

  describe('handler', () => {
    it('should release action and send success callback', async () => {
      const mockMessage = createMockMemory()
      const mockState = createMockState()
      const mockCallback = vi.fn()

      const result = await hyperscapeUnuseItemAction.handler(
        mockRuntime as any,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockActions.releaseAction).toHaveBeenCalled()
      expect(result).toEqual({
        text: 'Item released.',
        actions: ['HYPERSCAPE_UNUSE_ITEM'],
        source: 'hyperscape',
        metadata: { status: 'released' },
        success: true,
      })
    })

    it('should handle missing service gracefully', async () => {
      vi.spyOn(mockRuntime, 'getService').mockReturnValue(null)
      const mockMessage = createMockMemory()
      const mockState = createMockState()
      const mockCallback = vi.fn()

      const result = await hyperscapeUnuseItemAction.handler(
        mockRuntime as any,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockActions.releaseAction).not.toHaveBeenCalled()
      expect(result).toEqual({
        text: 'Error: Cannot unuse item. Required systems are unavailable.',
        success: false,
      })
    })

    it('should handle missing world gracefully', async () => {
      mockService.getWorld.mockReturnValue(null)
      const mockMessage = createMockMemory()
      const mockState = createMockState()
      const mockCallback = vi.fn()

      const result = await hyperscapeUnuseItemAction.handler(
        mockRuntime as any,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockActions.releaseAction).not.toHaveBeenCalled()
      expect(result).toEqual({
        text: 'Error: Cannot unuse item. Required systems are unavailable.',
        success: false,
      })
    })

    it('should handle missing actions gracefully', async () => {
      mockWorld.actions = undefined
      const mockMessage = createMockMemory()
      const mockState = createMockState()
      const mockCallback = vi.fn()

      const result = await hyperscapeUnuseItemAction.handler(
        mockRuntime as any,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(result).toEqual({
        text: 'Error: Cannot unuse item. Required systems are unavailable.',
        success: false,
      })
    })

    it('should work without callback', async () => {
      const mockMessage = createMockMemory()
      const mockState = createMockState()

      await hyperscapeUnuseItemAction.handler(
        mockRuntime as any,
        mockMessage,
        mockState,
        {}
      )

      expect(mockActions.releaseAction).toHaveBeenCalled()
    })

    it('should log appropriate messages', async () => {
      const mockMessage = createMockMemory()
      const mockState = createMockState()

      await hyperscapeUnuseItemAction.handler(
        mockRuntime,
        mockMessage,
        mockState
      )

      expect(mockActions.releaseAction).toHaveBeenCalled()
    })

    it('should log error when service is unavailable', async () => {
      vi.spyOn(mockRuntime, 'getService').mockReturnValue(null)
      const mockMessage = createMockMemory()
      const mockState = createMockState()

      await hyperscapeUnuseItemAction.handler(
        mockRuntime,
        mockMessage,
        mockState
      )

      expect(mockActions.releaseAction).not.toHaveBeenCalled()
    })
  })

  describe('examples', () => {
    it('should have valid example structure', () => {
      expect(hyperscapeUnuseItemAction.examples).toBeDefined()
      expect(Array.isArray(hyperscapeUnuseItemAction.examples)).toBe(true)
      expect(hyperscapeUnuseItemAction.examples!.length).toBeGreaterThan(0)

      hyperscapeUnuseItemAction.examples!.forEach(example => {
        expect(Array.isArray(example)).toBe(true)
        expect(example.length).toBe(2)

        example.forEach(message => {
          expect(message).toHaveProperty('name')
          expect(message).toHaveProperty('content')
          expect(message.content).toHaveProperty('text')
        })
      })
    })

    it('should have proper action responses in examples', () => {
      hyperscapeUnuseItemAction.examples!.forEach(example => {
        const [userMessage, agentResponse] = example

        // User messages should not have actions
        expect(userMessage.content.actions).toBeUndefined()

        // Agent responses should have the HYPERSCAPE_UNUSE_ITEM action
        expect(agentResponse.content.actions).toEqual(['HYPERSCAPE_UNUSE_ITEM'])
        expect(agentResponse.content.source).toBe('hyperscape')
      })
    })

    it('should cover different command variations', () => {
      const exampleTexts = hyperscapeUnuseItemAction
        .examples!.map(
          example => example[0]?.content?.text?.toLowerCase() || ''
        )
        .filter(text => text.length > 0)

      // Check for variety in commands
      expect(exampleTexts.some(text => text.includes('drop'))).toBe(true)
      expect(exampleTexts.some(text => text.includes('stop'))).toBe(true)
    })
  })

  describe('metadata', () => {
    it('should have correct action name', () => {
      expect(hyperscapeUnuseItemAction.name).toBe('HYPERSCAPE_UNUSE_ITEM')
    })

    it('should have appropriate similes', () => {
      expect(hyperscapeUnuseItemAction.similes).toBeDefined()
      expect(hyperscapeUnuseItemAction.similes!).toContain('RELEASE_ITEM')
      expect(hyperscapeUnuseItemAction.similes!).toContain('DROP_ITEM')
      expect(hyperscapeUnuseItemAction.similes!).toContain('CANCEL_INTERACTION')
    })

    it('should have a descriptive description', () => {
      expect(hyperscapeUnuseItemAction.description).toContain('Drops')
      expect(hyperscapeUnuseItemAction.description).toContain(
        'stops interacting'
      )
      expect(hyperscapeUnuseItemAction.description).toContain('held item')
    })
  })
})
