import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import {
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  createUniqueUuid,
} from '@elizaos/core'
import { HyperfyService } from '../../service'
import { loadRPGAction } from '../../actions/load-rpg'

// Mock modules
vi.mock('../../physx/loadPhysX.js', () => ({
  loadPhysX: vi.fn(() => Promise.resolve({})),
}))

describe('Load RPG Action Integration', () => {
  let mockRuntime: Partial<IAgentRuntime>
  let mockService: Partial<HyperfyService>
  let mockWorld: any
  let loadUGCContentSpy: Mock
  let unloadUGCContentSpy: Mock
  let isContentLoadedSpy: Mock

  beforeEach(() => {
    // Setup mock world
    mockWorld = {
      entities: {
        items: new Map(),
        player: { data: { id: 'player-1' } },
      },
      content: {
        getBundle: vi.fn(),
      },
    }

    // Setup mock service
    loadUGCContentSpy = vi.fn(() => Promise.resolve(true))
    unloadUGCContentSpy = vi.fn(() => Promise.resolve(true))
    isContentLoadedSpy = vi.fn(() => false)

    mockService = {
      isConnected: vi.fn(() => true),
      getWorld: vi.fn(() => mockWorld),
      currentWorldId: 'test-world-id' as any,
      loadUGCContent: loadUGCContentSpy,
      unloadUGCContent: unloadUGCContentSpy,
      isContentLoaded: isContentLoadedSpy,
      getDynamicActionLoader: vi.fn(() => ({
        discoverActions: vi.fn(() => []),
        registerAction: vi.fn(),
        unregisterAction: vi.fn(),
        getRegisteredActions: vi.fn(() => new Map()),
        getWorldActions: vi.fn(() => new Map()),
        clear: vi.fn(),
      })) as any,
    }

    // Setup mock runtime
    mockRuntime = {
      agentId: 'test-agent',
      getService: vi.fn(() => mockService),
      actions: [],
      providers: [],
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('validation', () => {
    it('should validate when connected and message contains RPG-related keywords', async () => {
      const message: Memory = {
        id: 'test-msg',
        content: { text: 'Can you load the RPG mode?' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const isValid = await loadRPGAction.validate!(
        mockRuntime as IAgentRuntime,
        message
      )
      expect(isValid).toBe(true)
    })

    it('should not validate when not connected to Hyperfy', async () => {
      ;(mockService.isConnected as Mock).mockReturnValue(false)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'Load RPG' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const isValid = await loadRPGAction.validate!(
        mockRuntime as IAgentRuntime,
        message
      )
      expect(isValid).toBe(false)
    })

    it('should validate various RPG-related phrases', async () => {
      const testPhrases = [
        'enable game mode',
        'start RPG',
        'load content',
        'activate UGC',
        'disable rpg mode',
      ]

      for (const phrase of testPhrases) {
        const message: Memory = {
          id: `test-msg-${phrase}`,
          content: { text: phrase },
          userId: 'user-1',
          agentId: 'agent-1',
          roomId: 'room-1',
          createdAt: Date.now(),
        }

        const isValid = await loadRPGAction.validate!(
          mockRuntime as IAgentRuntime,
          message
        )
        expect(isValid).toBe(true)
      }
    })
  })

  describe('handler - status check', () => {
    it('should return loaded content status', async () => {
      isContentLoadedSpy.mockReturnValue(true)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'check content status' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('Currently loaded: RPG Mode')
      expect(result.data.loaded).toContain('RPG Mode')
    })

    it('should detect available content in world entities', async () => {
      // Add content bundle entity to world
      const contentEntity = {
        id: 'content-1',
        components: [
          {
            type: 'content-bundle',
            data: {
              name: 'Epic RPG Bundle',
              type: 'rpg',
            },
          },
        ],
      }
      mockWorld.entities.items.set('content-1', contentEntity)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'list available content' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('Epic RPG Bundle')
      expect(result.data.available).toContain('Epic RPG Bundle')
    })
  })

  describe('handler - loading content', () => {
    it('should load RPG content from world entity', async () => {
      // Setup content bundle entity
      const rpgBundle = {
        id: 'rpg-content',
        type: 'rpg',
        name: 'Fantasy RPG',
        description: 'An epic fantasy RPG experience',
        features: { combat: true, quests: true },
        install: vi.fn(async (world: any, runtime: any) => ({
          id: 'rpg-instance',
          uninstall: vi.fn(),
        })),
      }

      const contentEntity = {
        id: 'content-1',
        components: [
          {
            type: 'content-bundle',
            data: rpgBundle,
          },
        ],
      }
      mockWorld.entities.items.set('content-1', contentEntity)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'load rpg mode' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(loadUGCContentSpy).toHaveBeenCalledWith('rpg', rpgBundle)
      expect(result.message).toContain('Fantasy RPG')
      expect(result.message).toContain(
        'Try "examine" to see what\'s around you!'
      )
    })

    it('should load content from world content registry', async () => {
      // Setup world content registry
      const rpgBundle = {
        id: 'rpg',
        name: 'World RPG',
        install: vi.fn(async () => ({ id: 'rpg-instance' })),
      }
      mockWorld.content.getBundle.mockResolvedValue(rpgBundle)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'enable rpg' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(mockWorld.content.getBundle).toHaveBeenCalledWith('rpg')
      expect(loadUGCContentSpy).toHaveBeenCalledWith('rpg', rpgBundle)
    })

    it('should create dynamic bundle from discovered actions', async () => {
      // Setup dynamic action loader to return combat actions
      const dynamicActions = [
        {
          name: 'ATTACK',
          category: 'combat',
          description: 'Attack an enemy',
        },
        {
          name: 'ACCEPT_QUEST',
          category: 'quest',
          description: 'Accept a quest',
        },
      ]

      ;(mockService.getDynamicActionLoader as Mock).mockReturnValue({
        discoverActions: vi.fn(() => dynamicActions),
        registerAction: vi.fn(),
        unregisterAction: vi.fn(),
      })

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'load rpg' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(loadUGCContentSpy).toHaveBeenCalled()

      // Check that a dynamic bundle was created
      const [contentId, bundle] = loadUGCContentSpy.mock.calls[0]
      expect(contentId).toBe('rpg')
      expect(bundle.name).toBe('Dynamic RPG')
      expect(typeof bundle.install).toBe('function')
    })

    it('should handle already loaded content', async () => {
      isContentLoadedSpy.mockReturnValue(true)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'load rpg' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('already loaded')
      expect(loadUGCContentSpy).not.toHaveBeenCalled()
    })

    it('should handle no content available', async () => {
      const message: Memory = {
        id: 'test-msg',
        content: { text: 'load rpg' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('No RPG content found')
      expect(result.message).toContain('world creator needs to add')
    })
  })

  describe('handler - unloading content', () => {
    it('should unload content when requested', async () => {
      isContentLoadedSpy.mockReturnValue(true)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'disable rpg mode' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(unloadUGCContentSpy).toHaveBeenCalledWith('rpg')
      expect(result.message).toContain('unloaded the game content')
    })

    it('should handle unloading when no content is loaded', async () => {
      isContentLoadedSpy.mockReturnValue(false)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'stop rpg' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('No game content is currently loaded')
      expect(unloadUGCContentSpy).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle load failures gracefully', async () => {
      loadUGCContentSpy.mockResolvedValue(false)

      const rpgBundle = {
        id: 'rpg',
        name: 'Test RPG',
        install: vi.fn(),
      }
      mockWorld.content.getBundle.mockResolvedValue(rpgBundle)

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'load rpg' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to load the RPG content')
    })

    it('should handle exceptions during loading', async () => {
      mockWorld.content.getBundle.mockRejectedValue(new Error('Network error'))

      const message: Memory = {
        id: 'test-msg',
        content: { text: 'load rpg' },
        userId: 'user-1',
        agentId: 'agent-1',
        roomId: 'room-1',
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler(
        mockRuntime as IAgentRuntime,
        message
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('error occurred')
      expect(result.error).toBe('Network error')
    })
  })
})
