import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import {
  IAgentRuntime,
  Memory,
  HandlerCallback,
  Character,
  UUID,
} from '@elizaos/core'
import { HyperfyService } from '../../service'
import { loadRPGAction } from '../../actions/load-rpg'
import { generateTestUUID, toUUID } from '../test-utils'

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

    // Setup mock runtime
    const mockServiceImpl = {
      world: {
        contentPacks: new Map(),
        network: {
          send: vi.fn(),
        },
      },
      loadContentPack: vi.fn().mockResolvedValue(true),
      isConnected: true,
    }
    
    mockRuntime = {
      agentId: toUUID('test-agent'),
      getService: vi.fn().mockReturnValue(mockServiceImpl),
      actions: [],
      providers: [],
      emit: vi.fn(),
    } as unknown as IAgentRuntime

    mockService = mockServiceImpl as unknown as HyperfyService
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('validation', () => {
    it('should validate when connected and message contains RPG-related keywords', async () => {
      const message: Memory = {
        id: toUUID('test-msg'),
        content: { text: 'Can you load the RPG mode?' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
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
        id: toUUID('test-msg'),
        content: { text: 'Load RPG' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
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
        const id = `test-msg-${phrase}` as any; // Temporary workaround for test
        const message: Memory = {
          id,
          content: { text: phrase },
          entityId: toUUID('user-1'),
          agentId: toUUID('agent-1'),
          roomId: toUUID('room-1'),
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
        id: toUUID('test-msg'),
        content: { text: 'check content status' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
      if (result) {
        expect(result).toBe(true)
        expect(result).toBe(true)
      }
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
        id: toUUID('test-msg'),
        content: { text: 'list available content' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
      if (result) {
        expect(result).toBe(true)
        expect(result).toBe(true)
      }
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
        id: toUUID('test-msg'),
        content: { text: 'load rpg mode' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
      expect(loadUGCContentSpy).toHaveBeenCalledWith('rpg', rpgBundle)
      expect(result).toBe(true)
      expect(result).toBe(true)
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
        id: toUUID('test-msg'),
        content: { text: 'enable rpg' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
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
        id: toUUID('test-msg'),
        content: { text: 'load rpg' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
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
        id: toUUID('test-msg'),
        content: { text: 'load rpg' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
      expect(result).toBe(true)
      expect(loadUGCContentSpy).not.toHaveBeenCalled()
    })

    it('should handle no content available', async () => {
      const message: Memory = {
        id: toUUID('test-msg'),
        content: { text: 'load rpg' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(false)
      expect(result).toBe(false)
      expect(result).toBe(false)
    })
  })

  describe('handler - unloading content', () => {
    it('should unload content when requested', async () => {
      isContentLoadedSpy.mockReturnValue(true)

      const message: Memory = {
        id: toUUID('test-msg'),
        content: { text: 'disable rpg mode' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
      expect(unloadUGCContentSpy).toHaveBeenCalledWith('rpg')
      expect(result).toBe(true)
    })

    it('should handle unloading when no content is loaded', async () => {
      isContentLoadedSpy.mockReturnValue(false)

      const message: Memory = {
        id: toUUID('test-msg'),
        content: { text: 'stop rpg' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(true)
      expect(result).toBe(true)
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
        id: toUUID('test-msg'),
        content: { text: 'load rpg' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(false)
      expect(result).toBe(false)
    })

    it('should handle exceptions during loading', async () => {
      mockWorld.content.getBundle.mockRejectedValue(new Error('Network error'))

      const message: Memory = {
        id: toUUID('test-msg'),
        content: { text: 'load rpg' },
        entityId: toUUID('user-1'),
        agentId: toUUID('agent-1'),
        roomId: toUUID('room-1'),
        createdAt: Date.now(),
      }

      const result = await loadRPGAction.handler!(
        mockRuntime as IAgentRuntime,
        message,
        {} as any,
        {},
        {} as HandlerCallback
      )

      expect(result).toBe(false)
      expect(result).toBe(false)
      expect(result).toBe(false)
    })
  })
})
