import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import {
  IAgentRuntime,
  Action,
  Provider,
  Memory,
  State,
  EventType,
  createUniqueUuid,
} from '@elizaos/core'
import { HyperfyService } from '../../service'
import { DynamicActionLoader } from '../../managers/dynamic-action-loader'

// Mock modules
vi.mock('fs/promises')
vi.mock('../../physx/loadPhysX.js', () => ({
  loadPhysX: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../utils.js', () => ({
  hashFileBuffer: vi.fn(() => 'mockhash'),
  getModuleDirectory: vi.fn(() => '/mock/dir'),
}))

describe('UGC Content Loading', () => {
  let service: HyperfyService
  let mockRuntime: Partial<IAgentRuntime>
  let mockWorld: any
  let emitEventSpy: Mock
  let registerActionSpy: Mock
  let unregisterActionSpy: Mock
  let registerProviderSpy: Mock
  let unregisterProviderSpy: Mock

  beforeEach(() => {
    // Setup mock runtime
    emitEventSpy = vi.fn()
    registerActionSpy = vi.fn()
    unregisterActionSpy = vi.fn()
    registerProviderSpy = vi.fn()
    unregisterProviderSpy = vi.fn()

    mockRuntime = {
      agentId: 'test-agent',
      emitEvent: emitEventSpy,
      registerAction: registerActionSpy,
      unregisterAction: unregisterActionSpy,
      registerProvider: registerProviderSpy,
      unregisterProvider: unregisterProviderSpy,
      actions: [],
      providers: [],
      getService: vi.fn(() => service),
      character: { name: 'Test Agent' },
    }

    // Create service instance
    service = new HyperfyService(mockRuntime as IAgentRuntime)

    // Setup mock world
    mockWorld = {
      entities: {
        player: { data: { id: 'player-1', appearance: {} } },
        items: new Map(),
      },
      network: {
        id: 'mock-network',
        send: vi.fn(),
        upload: vi.fn(),
        disconnect: vi.fn(),
      },
      chat: {
        msgs: [],
        subscribe: vi.fn(),
      },
      events: {
        emit: vi.fn(),
      },
      assetsUrl: 'https://mock.assets.url',
    }

    // Mock the world on service
    ;(service as any).world = mockWorld
    ;(service as any).isServiceConnected = true
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loadUGCContent', () => {
    it('should successfully load content with actions and providers', async () => {
      // Create mock content bundle
      const mockActions: Action[] = [
        {
          name: 'TEST_ACTION_1',
          description: 'Test action 1',
          handler: async () => ({ success: true }),
          validate: async () => true,
          examples: [],
        },
        {
          name: 'TEST_ACTION_2',
          description: 'Test action 2',
          handler: async () => ({ success: true }),
          validate: async () => true,
          examples: [],
        },
      ]

      const mockProviders: Provider[] = [
        {
          name: 'TEST_PROVIDER_1',
          description: 'Test provider 1',
          get: async () => 'provider1 data',
        },
        {
          name: 'TEST_PROVIDER_2',
          description: 'Test provider 2',
          get: async () => 'provider2 data',
        },
      ]

      const mockContentBundle = {
        name: 'Test RPG Content',
        actions: mockActions,
        providers: mockProviders,
        config: {
          features: {
            combat: true,
            inventory: true,
          },
        },
        install: vi.fn(async (world: any, runtime: any) => ({
          id: 'test-content-instance',
          actions: mockActions,
          providers: mockProviders,
          uninstall: vi.fn(),
        })),
      }

      // Load the content
      const result = await service.loadUGCContent('test-rpg', mockContentBundle)

      // Verify success
      expect(result).toBe(true)
      expect(mockContentBundle.install).toHaveBeenCalledWith(
        mockWorld,
        mockRuntime
      )

      // Verify actions were registered
      expect(registerActionSpy).toHaveBeenCalledTimes(2)
      expect(registerActionSpy).toHaveBeenCalledWith(mockActions[0])
      expect(registerActionSpy).toHaveBeenCalledWith(mockActions[1])

      // Verify providers were registered
      expect(registerProviderSpy).toHaveBeenCalledTimes(2)
      expect(registerProviderSpy).toHaveBeenCalledWith(mockProviders[0])
      expect(registerProviderSpy).toHaveBeenCalledWith(mockProviders[1])

      // Verify event was emitted
      expect(emitEventSpy).toHaveBeenCalledWith(EventType.CONTENT_LOADED, {
        runtime: mockRuntime,
        eventName: 'UGC_CONTENT_LOADED',
        data: {
          contentId: 'test-rpg',
          contentName: 'Test RPG Content',
          features: {
            combat: true,
            inventory: true,
          },
          actionsCount: 2,
          providersCount: 2,
        },
      })

      // Verify content is tracked
      expect(service.isContentLoaded('test-rpg')).toBe(true)
    })

    it('should handle content with dynamic actions', async () => {
      // Setup dynamic action loader
      const mockDynamicLoader = new DynamicActionLoader(
        mockRuntime as IAgentRuntime
      )
      const registerActionSpy = vi.spyOn(mockDynamicLoader, 'registerAction')
      ;(service as any).dynamicActionLoader = mockDynamicLoader

      const dynamicActions = [
        {
          name: 'DYNAMIC_COMBAT_ACTION',
          description: 'Dynamic combat action',
          category: 'combat' as const,
          parameters: [],
          examples: ['attack the goblin'],
        },
      ]

      const mockContentBundle = {
        name: 'Dynamic Content',
        dynamicActions,
        install: vi.fn(async () => ({
          id: 'dynamic-content-instance',
          dynamicActions: dynamicActions.map(a => a.name),
          uninstall: vi.fn(),
        })),
      }

      const result = await service.loadUGCContent(
        'dynamic-content',
        mockContentBundle
      )

      expect(result).toBe(true)
      expect(registerActionSpy).toHaveBeenCalledWith(
        dynamicActions[0],
        mockRuntime
      )
    })

    it('should unload existing content before loading new content with same ID', async () => {
      // First load
      const mockContent1 = {
        name: 'Content v1',
        install: vi.fn(async () => ({
          id: 'content-v1',
          uninstall: vi.fn(),
        })),
      }

      await service.loadUGCContent('test-content', mockContent1)
      expect(service.isContentLoaded('test-content')).toBe(true)

      // Second load with same ID
      const mockContent2 = {
        name: 'Content v2',
        install: vi.fn(async () => ({
          id: 'content-v2',
          uninstall: vi.fn(),
        })),
      }

      const unloadSpy = vi.spyOn(service, 'unloadUGCContent')
      await service.loadUGCContent('test-content', mockContent2)

      expect(unloadSpy).toHaveBeenCalledWith('test-content')
      expect(mockContent2.install).toHaveBeenCalled()
    })

    it('should handle missing install method', async () => {
      const invalidBundle = {
        name: 'Invalid Bundle',
        // Missing install method
      }

      const result = await service.loadUGCContent('invalid', invalidBundle)

      expect(result).toBe(false)
      expect(service.isContentLoaded('invalid')).toBe(false)
    })

    it('should handle install errors gracefully', async () => {
      const errorBundle = {
        install: vi.fn(() => {
          throw new Error('Install failed')
        }),
      }

      const result = await service.loadUGCContent('error-content', errorBundle)

      expect(result).toBe(false)
      expect(service.isContentLoaded('error-content')).toBe(false)
    })

    it('should fallback to array push when register methods are not available', async () => {
      // Remove register methods
      delete (mockRuntime as any).registerAction
      delete (mockRuntime as any).registerProvider

      const mockAction: Action = {
        name: 'FALLBACK_ACTION',
        description: 'Test fallback',
        handler: async () => ({ success: true }),
        validate: async () => true,
        examples: [],
      }

      const mockProvider: Provider = {
        name: 'FALLBACK_PROVIDER',
        description: 'Test fallback provider',
        get: async () => 'data',
      }

      const mockBundle = {
        actions: [mockAction],
        providers: [mockProvider],
        install: vi.fn(async () => ({
          id: 'fallback-instance',
          actions: [mockAction],
          providers: [mockProvider],
          uninstall: vi.fn(),
        })),
      }

      const result = await service.loadUGCContent('fallback-test', mockBundle)

      expect(result).toBe(true)
      expect(mockRuntime.actions).toContain(mockAction)
      expect(mockRuntime.providers).toContain(mockProvider)
    })
  })

  describe('unloadUGCContent', () => {
    it('should successfully unload content and unregister components', async () => {
      // First load content
      const mockActions: Action[] = [
        {
          name: 'UNLOAD_TEST_ACTION',
          description: 'Test action',
          handler: async () => ({ success: true }),
          validate: async () => true,
          examples: [],
        },
      ]

      const mockProviders: Provider[] = [
        {
          name: 'UNLOAD_TEST_PROVIDER',
          description: 'Test provider',
          get: async () => 'data',
        },
      ]

      const uninstallSpy = vi.fn()

      const mockBundle = {
        actions: mockActions,
        providers: mockProviders,
        install: vi.fn(async () => ({
          id: 'unload-test-instance',
          actions: mockActions,
          providers: mockProviders,
          uninstall: uninstallSpy,
        })),
      }

      await service.loadUGCContent('unload-test', mockBundle)
      expect(service.isContentLoaded('unload-test')).toBe(true)

      // Now unload
      const result = await service.unloadUGCContent('unload-test')

      expect(result).toBe(true)
      expect(uninstallSpy).toHaveBeenCalled()
      expect(unregisterActionSpy).toHaveBeenCalledWith('UNLOAD_TEST_ACTION')
      expect(unregisterProviderSpy).toHaveBeenCalledWith('UNLOAD_TEST_PROVIDER')
      expect(service.isContentLoaded('unload-test')).toBe(false)

      // Verify event was emitted
      expect(emitEventSpy).toHaveBeenCalledWith(EventType.CONTENT_UNLOADED, {
        runtime: mockRuntime,
        eventName: 'UGC_CONTENT_UNLOADED',
        data: {
          contentId: 'unload-test',
        },
      })
    })

    it('should handle unloading non-existent content', async () => {
      const result = await service.unloadUGCContent('non-existent')
      expect(result).toBe(false)
    })

    it('should handle uninstall errors gracefully', async () => {
      const mockBundle = {
        install: vi.fn(async () => ({
          id: 'error-uninstall',
          uninstall: vi.fn(() => {
            throw new Error('Uninstall failed')
          }),
        })),
      }

      await service.loadUGCContent('error-test', mockBundle)

      const result = await service.unloadUGCContent('error-test')
      expect(result).toBe(false)
      // Content should still be removed from tracking despite error
      expect(service.isContentLoaded('error-test')).toBe(false)
    })

    it('should fallback to array removal when unregister methods are not available', async () => {
      // Remove unregister methods
      delete (mockRuntime as any).unregisterAction
      delete (mockRuntime as any).unregisterProvider

      const mockAction: Action = {
        name: 'ARRAY_REMOVE_ACTION',
        description: 'Test',
        handler: async () => ({ success: true }),
        validate: async () => true,
        examples: [],
      }

      const mockProvider: Provider = {
        name: 'ARRAY_REMOVE_PROVIDER',
        description: 'Test',
        get: async () => 'data',
      }

      // Add directly to arrays
      mockRuntime.actions!.push(mockAction)
      mockRuntime.providers!.push(mockProvider)

      const mockBundle = {
        install: vi.fn(async () => ({
          id: 'array-test',
          actions: [mockAction],
          providers: [mockProvider],
          uninstall: vi.fn(),
        })),
      }

      await service.loadUGCContent('array-test', mockBundle)

      const result = await service.unloadUGCContent('array-test')

      expect(result).toBe(true)
      expect(mockRuntime.actions).not.toContain(mockAction)
      expect(mockRuntime.providers).not.toContain(mockProvider)
    })
  })

  describe('getLoadedContent', () => {
    it('should return loaded content instance', async () => {
      const mockInstance = {
        id: 'test-instance',
        data: 'test data',
      }

      const mockBundle = {
        install: vi.fn(async () => mockInstance),
      }

      await service.loadUGCContent('get-test', mockBundle)

      const content = service.getLoadedContent('get-test')
      expect(content).toBe(mockInstance)
    })

    it('should return null for non-existent content', () => {
      const content = service.getLoadedContent('non-existent')
      expect(content).toBeNull()
    })
  })

  describe('World not connected handling', () => {
    it('should fail to load content when world is not connected', async () => {
      ;(service as any).world = null

      const mockBundle = {
        install: vi.fn(),
      }

      const result = await service.loadUGCContent('no-world', mockBundle)

      expect(result).toBe(false)
      expect(mockBundle.install).not.toHaveBeenCalled()
    })
  })
})
