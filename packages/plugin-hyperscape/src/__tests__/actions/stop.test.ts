import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hyperscapeStopMovingAction } from '../../actions/stop'
import { createMockRuntime } from '../test-utils'
import { createMockWorld } from '../helpers/mock-world'

describe('HYPERSCAPE_STOP_MOVING Action', () => {
  let mockRuntime: any
  let mockWorld: any
  let mockService: any
  let mockControls: any

  beforeEach(() => {
    vi.restoreAllMocks()
    mockRuntime = createMockRuntime()
    mockWorld = createMockWorld()

    mockControls = {
      stopAllActions: vi.fn(),
      getIsNavigating: vi.fn().mockReturnValue(true),
      getIsWalkingRandomly: vi.fn().mockReturnValue(false),
    }

    mockWorld.controls = mockControls

    mockService = {
      isConnected: vi.fn().mockReturnValue(true),
      getWorld: vi.fn().mockReturnValue(mockWorld),
    }

    mockRuntime.getService = vi.fn().mockReturnValue(mockService)
  })

  describe('validate', () => {
    it('should return true when service is connected and controls exist', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } }
      const result = await hyperscapeStopMovingAction.validate(
        mockRuntime,
        mockMessage as any
      )

      expect(result).toBe(true)
      expect(mockService.isConnected).toHaveBeenCalled()
    })

    it('should return false when service is not connected', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } }
      mockService.isConnected.mockReturnValue(false)

      const result = await hyperscapeStopMovingAction.validate(
        mockRuntime,
        mockMessage as any
      )

      expect(result).toBe(false)
    })

    it('should return false when controls are missing', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } }
      mockWorld.controls = null

      const result = await hyperscapeStopMovingAction.validate(
        mockRuntime,
        mockMessage as any
      )

      expect(result).toBe(false)
    })
  })

  describe('handler', () => {
    let mockMessage: any
    let mockState: any
    let mockCallback: any

    beforeEach(() => {
      mockMessage = {
        id: 'msg-123',
        content: { text: 'Stop moving' },
      }

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      }

      mockCallback = vi.fn()
    })

    it('should stop movement when navigating', async () => {
      await hyperscapeStopMovingAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockControls.stopAllActions).toHaveBeenCalledWith(
        'stop action called'
      )
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          actions: ['HYPERSCAPE_STOP_MOVING'],
          source: 'hyperscape',
          metadata: {
            status: 'movement_stopped',
            reason: 'stop action called',
          },
        })
      )
    })

    it('should stop movement when walking randomly', async () => {
      mockControls.getIsNavigating.mockReturnValue(false)
      mockControls.getIsWalkingRandomly.mockReturnValue(true)

      await hyperscapeStopMovingAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockControls.stopAllActions).toHaveBeenCalledWith(
        'stop action called'
      )
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          metadata: {
            status: 'movement_stopped',
            reason: 'stop action called',
          },
        })
      )
    })

    it('should report when not moving', async () => {
      mockControls.getIsNavigating.mockReturnValue(false)
      mockControls.getIsWalkingRandomly.mockReturnValue(false)

      await hyperscapeStopMovingAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockControls.stopAllActions).toHaveBeenCalledWith(
        'stop action called'
      )
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          metadata: {
            status: 'movement_stopped',
            reason: 'stop action called',
          },
        })
      )
    })

    it('should handle missing controls gracefully', async () => {
      mockControls.stopAllActions = undefined

      await hyperscapeStopMovingAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Stop functionality not available in controls.',
        })
      )
    })

    it('should handle missing service gracefully', async () => {
      mockRuntime.getService.mockReturnValue(null)

      await hyperscapeStopMovingAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Cannot stop movement. Hyperscape connection/controls unavailable.',
        })
      )
    })

    it('should handle missing world gracefully', async () => {
      mockService.getWorld.mockReturnValue(null)

      await hyperscapeStopMovingAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      )

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Cannot stop movement. Hyperscape connection/controls unavailable.',
        })
      )
    })
  })

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperscapeStopMovingAction.examples).toBeDefined()
      expect(Array.isArray(hyperscapeStopMovingAction.examples)).toBe(true)
      expect(hyperscapeStopMovingAction.examples!.length).toBeGreaterThan(0)
    })

    it('should have properly formatted examples', () => {
      hyperscapeStopMovingAction.examples!.forEach((example: any) => {
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
        expect(agent.content.actions).toContain('HYPERSCAPE_STOP_MOVING')
      })
    })
  })
})
