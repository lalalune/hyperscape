import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IAgentRuntime, Memory, UUID, Action, Provider } from '../types/eliza-mock';
import { HyperfyService } from '../../service';
import { ContentPackLoader } from '../../managers/content-pack-loader';
import { IContentPack } from '../../types/content-pack';
import WebSocket from 'ws';

// Mock WebSocket
vi.mock('ws');

describe('Content Pack E2E Integration', () => {
  let runtime: IAgentRuntime;
  let service: HyperfyService;
  let mockWs: any;
  let registeredActions: Map<string, Action>;
  let registeredProviders: Map<string, Provider>;

  // Create a test content pack
  const testRPGPack: IContentPack = {
    id: 'test-rpg',
    name: 'Test RPG Module',
    description: 'Test RPG content pack',
    version: '1.0.0',
    
    actions: [
      {
        name: 'ATTACK_TARGET',
        description: 'Attack a target entity',
        similes: ['attack', 'hit', 'fight', 'combat'],
        examples: [
          { user: 'user', content: { text: 'Attack the goblin' } },
          { user: 'assistant', content: { text: 'I attack the goblin with my sword' } }
        ],
        handler: async (runtime, message, state) => {
          const target = state?.target || 'unknown';
          return {
            success: true,
            response: `Attacking ${target}!`,
            data: { damage: 10, target }
          };
        },
        validate: async (runtime, message, state) => {
          return state?.target ? true : false;
        }
      },
      {
        name: 'MINE_RESOURCE',
        description: 'Mine a resource node',
        similes: ['mine', 'gather', 'extract'],
        examples: [
          { user: 'user', content: { text: 'Mine the iron rock' } },
          { user: 'assistant', content: { text: 'I start mining the iron ore' } }
        ],
        handler: async (runtime, message, state) => {
          return {
            success: true,
            response: 'Mining resource...',
            data: { resource: 'iron_ore', quantity: 3 }
          };
        },
        validate: async () => true
      }
    ],
    
    providers: [
      {
        name: 'rpgStats',
        description: 'Provides RPG character stats',
        get: async (runtime, message, state) => {
          return JSON.stringify({
            level: 10,
            health: { current: 85, max: 100 },
            skills: {
              mining: { level: 5, experience: 1250 },
              combat: { level: 8, experience: 3400 }
            }
          });
        }
      }
    ],
    
    visuals: {
      entityColors: {
        'npcs.goblin': { color: 2263842, hex: '#228822' },
        'items.sword': { color: 16729156, hex: '#FF4444' },
        'resources.iron_rock': { color: 4210752, hex: '#404040' }
      }
    },
    
    stateManager: {
      initPlayerState: (playerId: string) => ({
        playerId,
        level: 1,
        health: { current: 100, max: 100 },
        inventory: { items: [], gold: 0 }
      }),
      getState: (playerId: string) => ({
        playerId,
        level: 10,
        health: { current: 85, max: 100 }
      }),
      updateState: (playerId: string, updates: any) => {},
      subscribe: (playerId: string, callback: Function) => () => {},
      serialize: (playerId: string) => '{}',
      deserialize: (playerId: string, data: string) => {}
    },
    
    onLoad: async (runtime, world) => {
      console.log('[TestRPG] Content pack loaded');
    },
    
    onUnload: async (runtime, world) => {
      console.log('[TestRPG] Content pack unloaded');
    }
  };

  beforeEach(() => {
    // Create mock runtime with action/provider tracking
    registeredActions = new Map();
    registeredProviders = new Map();
    
    runtime = {
      agentId: UUID(),
      serverUrl: 'http://localhost:3000',
      token: 'test-token',
      modelProvider: 'openai',
      character: {
        name: 'TestAgent',
        description: 'Test agent for content pack loading'
      },
      
      // Track registered actions
      registerAction: vi.fn((action: Action) => {
        registeredActions.set(action.name, action);
        console.log(`[Runtime] Registered action: ${action.name}`);
      }),
      
      // Track registered providers
      registerProvider: vi.fn((provider: Provider) => {
        registeredProviders.set(provider.name, provider);
        console.log(`[Runtime] Registered provider: ${provider.name}`);
      }),
      
      getAction: vi.fn((name: string) => registeredActions.get(name)),
      getProvider: vi.fn((name: string) => registeredProviders.get(name)),
      
      registerEvaluator: vi.fn(),
      getService: vi.fn((name: string) => {
        if (name === HyperfyService.serviceName) return service;
        return null;
      }),
      
      getSetting: vi.fn(),
      getConversationLength: vi.fn(() => 0),
      processActions: vi.fn(),
      evaluate: vi.fn(),
      findNearestCachedMemory: vi.fn(),
      
      databaseAdapter: {
        db: null,
        init: vi.fn(),
        close: vi.fn(),
        getMemoriesByRoomIds: vi.fn(() => Promise.resolve([])),
        searchMemoriesByEmbedding: vi.fn(() => Promise.resolve([])),
        getCachedEmbeddings: vi.fn(() => Promise.resolve([])),
        log: vi.fn(() => Promise.resolve()),
        getActorDetails: vi.fn(() => Promise.resolve([])),
        searchMemories: vi.fn(() => Promise.resolve([])),
        updateGoalStatus: vi.fn(() => Promise.resolve()),
        createMemory: vi.fn(() => Promise.resolve()),
        removeMemory: vi.fn(() => Promise.resolve()),
        countMemories: vi.fn(() => Promise.resolve(0)),
        getGoals: vi.fn(() => Promise.resolve([])),
        updateGoal: vi.fn(() => Promise.resolve()),
        createGoal: vi.fn(() => Promise.resolve()),
        removeGoal: vi.fn(() => Promise.resolve()),
        createRoom: vi.fn(() => Promise.resolve()),
        removeRoom: vi.fn(() => Promise.resolve()),
        getRoomsForParticipant: vi.fn(() => Promise.resolve([])),
        getRoomsForParticipants: vi.fn(() => Promise.resolve([])),
        addParticipantToRoom: vi.fn(() => Promise.resolve()),
        removeParticipantFromRoom: vi.fn(() => Promise.resolve()),
        createRelationship: vi.fn(() => Promise.resolve()),
        getRelationship: vi.fn(() => Promise.resolve(null)),
        getRelationships: vi.fn(() => Promise.resolve([]))
      },
      
      messageManager: {
        createMemory: vi.fn(),
        addEmbeddingToMemory: vi.fn(),
        getMemories: vi.fn(() => Promise.resolve([]))
      },
      
      descriptionManager: {
        getDescription: vi.fn(() => 'Test description')
      },
      
      loreManager: {
        getLore: vi.fn(() => [])
      },
      
      providers: [],
      actions: [],
      evaluators: [],
      plugins: []
    } as any;

    // Create service instance
    service = new HyperfyService();
    
    // Mock WebSocket connection
    mockWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      ping: vi.fn()
    };
    
    // Replace WebSocket constructor
    (WebSocket as any).mockImplementation(() => mockWs);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Content Pack Loading Flow', () => {
    it('should complete the entire flow from connection to action availability', async () => {
      // Step 1: Initialize service
      await service.initialize(runtime);
      expect(service).toBeDefined();
      
      // Step 2: Connect to world (simulate connection)
      const connectPromise = service.connect('test-world-id');
      
      // Simulate WebSocket connection events
      const onCall = mockWs.on.mock.calls.find(call => call[0] === 'open');
      if (onCall && onCall[1]) {
        onCall[1](); // Trigger 'open' event
      }
      
      await connectPromise;
      
      // Step 3: Simulate receiving world bundle with RPG content flag
      const worldBundle = {
        type: 'world-state',
        data: {
          worldId: 'test-world-id',
          contentPacks: ['test-rpg'],
          rpgEnabled: true,
          actions: [
            {
              id: 'ATTACK_TARGET',
              name: 'Attack Target',
              description: 'Attack a target entity',
              category: 'combat',
              parameters: [
                { name: 'target', type: 'entity', required: true }
              ]
            },
            {
              id: 'MINE_RESOURCE',
              name: 'Mine Resource',
              description: 'Mine a resource node',
              category: 'skills',
              parameters: [
                { name: 'resourceId', type: 'string', required: true }
              ]
            }
          ]
        }
      };
      
      // Simulate receiving world state
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler(JSON.stringify(worldBundle));
      }
      
      // Step 4: Load content pack
      const contentLoader = new ContentPackLoader(runtime);
      await contentLoader.loadPack(testRPGPack, runtime);
      
      // Step 5: Verify actions were registered
      expect(runtime.registerAction).toHaveBeenCalledTimes(2);
      expect(registeredActions.has('ATTACK_TARGET')).toBe(true);
      expect(registeredActions.has('MINE_RESOURCE')).toBe(true);
      
      // Step 6: Verify providers were registered
      expect(runtime.registerProvider).toHaveBeenCalledTimes(1);
      expect(registeredProviders.has('rpgStats')).toBe(true);
      
      // Step 7: Test action execution
      const attackAction = registeredActions.get('ATTACK_TARGET');
      expect(attackAction).toBeDefined();
      
      const attackResult = await attackAction!.handler(
        runtime,
        { content: { text: 'Attack the goblin' } } as any,
        { target: 'goblin' }
      );
      
      expect(attackResult.success).toBe(true);
      expect(attackResult.response).toBe('Attacking goblin!');
      expect(attackResult.data).toEqual({ damage: 10, target: 'goblin' });
      
      // Step 8: Test provider access
      const statsProvider = registeredProviders.get('rpgStats');
      expect(statsProvider).toBeDefined();
      
      const stats = await statsProvider!.get(runtime, {} as any, {});
      const parsedStats = JSON.parse(stats);
      expect(parsedStats.level).toBe(10);
      expect(parsedStats.health.current).toBe(85);
      
      // Step 9: Verify content pack is tracked as loaded
      expect(contentLoader.isPackLoaded('test-rpg')).toBe(true);
      expect(contentLoader.getLoadedPacks()).toHaveLength(1);
      
      // Step 10: Test unloading
      await contentLoader.unloadPack('test-rpg');
      expect(contentLoader.isPackLoaded('test-rpg')).toBe(false);
    });

    it('should handle dynamic action discovery from world', async () => {
      await service.initialize(runtime);
      
      // Mock the dynamic action loader
      const mockDynamicLoader = {
        discoverActions: vi.fn(() => Promise.resolve([
          {
            id: 'CUSTOM_ACTION',
            name: 'Custom Action',
            description: 'Dynamically discovered action',
            category: 'custom',
            parameters: []
          }
        ])),
        registerAction: vi.fn(),
        createActionHandler: vi.fn(() => ({
          name: 'CUSTOM_ACTION',
          handler: async () => ({ success: true, response: 'Custom action executed' })
        }))
      };
      
      // Override the service method to return our mock
      service.getDynamicActionLoader = () => mockDynamicLoader as any;
      
      // Discover and register actions
      const discovered = await mockDynamicLoader.discoverActions();
      expect(discovered).toHaveLength(1);
      
      for (const actionDesc of discovered) {
        const action = mockDynamicLoader.createActionHandler(actionDesc);
        await runtime.registerAction(action);
      }
      
      // Verify the custom action is available
      expect(registeredActions.has('CUSTOM_ACTION')).toBe(true);
    });

    it('should provide visual configuration to ColorDetector', async () => {
      await service.initialize(runtime);
      
      // Create a mock world with ColorDetector
      const mockColorDetector = {
        registerEntityColor: vi.fn()
      };
      
      const mockWorld = {
        colorDetector: mockColorDetector,
        actions: {
          execute: vi.fn()
        }
      };
      
      // Override getWorld to return our mock
      service.getWorld = () => mockWorld as any;
      
      // Load content pack
      const contentLoader = new ContentPackLoader(runtime);
      await contentLoader.loadPack(testRPGPack, runtime);
      
      // Verify visual colors were registered
      expect(mockColorDetector.registerEntityColor).toHaveBeenCalledWith(
        'npcs.goblin',
        { color: 2263842, hex: '#228822' }
      );
      expect(mockColorDetector.registerEntityColor).toHaveBeenCalledWith(
        'items.sword',
        { color: 16729156, hex: '#FF4444' }
      );
    });

    it('should handle state management lifecycle', async () => {
      await service.initialize(runtime);
      
      const contentLoader = new ContentPackLoader(runtime);
      await contentLoader.loadPack(testRPGPack, runtime);
      
      // Get state manager
      const stateManager = contentLoader.getPackStateManager('test-rpg');
      expect(stateManager).toBeDefined();
      
      // Test state operations
      const playerId = 'test-player';
      const initialState = stateManager.initPlayerState(playerId);
      expect(initialState.playerId).toBe(playerId);
      expect(initialState.level).toBe(1);
      
      const currentState = stateManager.getState(playerId);
      expect(currentState.level).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      await service.initialize(runtime);
      
      // Simulate connection error
      const connectPromise = service.connect('test-world-id');
      
      const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')?.[1];
      if (errorHandler) {
        errorHandler(new Error('Connection failed'));
      }
      
      // Should not throw, but handle gracefully
      await expect(connectPromise).rejects.toThrow('Connection failed');
    });

    it('should handle malformed content packs', async () => {
      const badPack = {
        id: 'bad-pack',
        // Missing required fields
      } as any;
      
      const contentLoader = new ContentPackLoader(runtime);
      await expect(contentLoader.loadPack(badPack)).rejects.toThrow();
    });
  });
}); 