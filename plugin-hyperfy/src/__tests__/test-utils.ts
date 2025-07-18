import type { IAgentRuntime, Memory, State, UUID } from '@elizaos/core';
import { mock } from 'bun:test';

/**
 * Creates a mock runtime for testing hyperfy plugin
 * Creates a simple mock runtime without relying on core test utilities
 *
 * @param overrides - Optional overrides for the default mock methods and properties
 * @returns A mock runtime for testing
 */
export function createMockRuntime(overrides: Partial<IAgentRuntime> = {}): IAgentRuntime {
  return {
    character: {
      name: 'HyperfyTestAgent',
      bio: ['RPG agent for testing hyperfy world functionality'],
      system: 'You are a test agent for RPG world management',
      messageExamples: [],
      postExamples: [],
      topics: ['rpg', 'gaming', 'world-building'],
      knowledge: [],
      plugins: ['@elizaos/plugin-hyperfy'],
      ...overrides.character,
    },

    // Hyperfy-specific settings
    getSetting: (key: string) => {
      const settings: Record<string, string> = {
        HYPERFY_API_KEY: 'test-hyperfy-api-key',
        HYPERFY_WORLD_ID: 'test-world-123',
        HYPERFY_SERVER_URL: 'http://localhost:3000',
        RPG_WORLD_NAME: 'TestWorld',
        RPG_MAX_PLAYERS: '50',
        API_KEY: 'test-api-key',
        SECRET_KEY: 'test-secret',
        ...(overrides as any)?.settings,
      };
      return settings[key];
    },

    // Hyperfy-specific services
    getService: ((nameOrClass: any) => {
      const name = typeof nameOrClass === 'string' ? nameOrClass : (nameOrClass.serviceName || nameOrClass.name);
      const services: Record<string, any> = {
        'test-service': {
          start: async () => {},
          stop: async () => {},
          doSomething: async () => 'service result',
        },
        hyperfy: createMockHyperfyService(),
        'rpg-server': {
          getWorld: () => createMockWorld(),
          getPlayers: async () => [],
          spawnEntity: async () => true,
        },
        ...(overrides as any)?.services,
      };
      return services[name];
    }) as any,

    // Mock other required runtime methods
    databaseAdapter: {
      init: async () => {},
      close: async () => {},
      getMemories: async () => [],
      createMemory: async () => ({} as Memory),
      removeMemory: async () => {},
      searchMemories: async () => [],
      getGoals: async () => [],
      createGoal: async () => ({} as any),
      removeGoal: async () => {},
      updateGoal: async () => {},
      searchGoals: async () => [],
      createRoom: async () => '',
      removeRoom: async () => {},
      getRoomsForParticipant: async () => [],
      getRoomsForParticipants: async () => [],
      getParticipantsForAccount: async () => [],
      getParticipantsForRoom: async () => [],
      getAccountById: async () => null,
      createAccount: async () => ({} as any),
      getMemoriesByRoomIds: async () => [],
      createRelationship: async () => true,
      getRelationship: async () => null,
      getRelationships: async () => [],
    },

    agentId: 'test-agent-id' as UUID,
    serverUrl: 'http://localhost:3000',
    token: 'test-token',

    // Mock action methods
    async initialize() {},
    async stop() {},
    async evaluate() { return []; },
    async composeState() { return {} as State; },
    async updateRecentMessageState() { return {} as State; },

    // Additional runtime methods needed by tests
    ensureConnection: mock().mockResolvedValue(true),
    getMemories: mock().mockResolvedValue([]),
    getRoom: mock().mockResolvedValue(null),
    emitEvent: mock(),
    useModel: mock().mockResolvedValue({}),
    generateText: mock().mockResolvedValue('generated text'),
    getEntityById: mock().mockResolvedValue(null),
    createMemory: mock().mockResolvedValue({}),
    getEntitiesForRoom: mock().mockResolvedValue([]),
    createEntity: mock().mockResolvedValue({}),
    
    // Message manager
    messageManager: {
      createMemory: mock().mockResolvedValue(true),
      getMemories: mock().mockResolvedValue([]),
      updateMemory: mock().mockResolvedValue(true),
      deleteMemory: mock().mockResolvedValue(true),
      searchMemories: mock().mockResolvedValue([]),
      getLastMessages: mock().mockResolvedValue([]),
    },

    // State
    updateState: mock().mockResolvedValue(true),

    // Actions & Providers
    actions: [],
    providers: [],
    evaluators: [],

    // Components
    createComponent: mock().mockResolvedValue(true),
    getComponents: mock().mockResolvedValue([]),
    updateComponent: mock().mockResolvedValue(true),

    // Database
    db: {
      query: mock().mockResolvedValue([]),
      execute: mock().mockResolvedValue({ changes: 1 }),
      getWorlds: mock().mockResolvedValue([]),
      getWorld: mock().mockResolvedValue(null),
    },

    // Logging
    logger: {
      info: mock(),
      warn: mock(),
      error: mock(),
      debug: mock(),
    },

    ...overrides,
  } as unknown as IAgentRuntime;
}

/**
 * Creates a mock Memory object for testing
 * Simple mock memory without relying on core test utilities
 */
export function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'test-memory-id' as UUID,
    userId: 'test-user-id' as UUID,
    agentId: 'test-agent-id' as UUID,
    roomId: 'test-room-id' as UUID,
    content: {
      text: 'Hyperfy RPG test message',
      source: 'hyperfy-test',
    },
    embedding: new Float32Array([0.1, 0.2, 0.3]),
    createdAt: Date.now(),
    ...overrides,
  } as Memory;
}

/**
 * Creates a mock State object for testing
 * Simple mock state without relying on core test utilities
 */
export function createMockState(overrides: Partial<State> = {}): State {
  return {
    values: {
      hyperfyWorldId: 'test-world-123',
      playerPosition: { x: 10, y: 0, z: 10 },
    },
    text: 'Hyperfy RPG world context',
    ...overrides,
  } as State;
}

/**
 * Creates a mock Hyperfy world object
 */
export function createMockWorld(): any {
  const mockEntities = new Map();

  // Add some test entities
  mockEntities.set('entity-1', {
    data: { id: 'entity-1', name: 'Block', type: 'block' },
    base: {
      position: {
        x: 0,
        y: 0,
        z: 0,
        fromArray: () => {},
        toArray: () => [0, 0, 0],
      },
      quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
        fromArray: () => {},
        toArray: () => [0, 0, 0, 1],
      },
      scale: { x: 1, y: 1, z: 1, fromArray: () => {}, toArray: () => [1, 1, 1] },
    },
    root: {
      position: {
        x: 0,
        y: 0,
        z: 0,
        fromArray: () => {},
        toArray: () => [0, 0, 0],
      },
      quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
        fromArray: () => {},
        toArray: () => [0, 0, 0, 1],
      },
      scale: { x: 1, y: 1, z: 1, fromArray: () => {}, toArray: () => [1, 1, 1] },
    },
    destroy: mock(),
  });

  mockEntities.set('entity-2', {
    data: { id: 'entity-2', name: 'Sphere', type: 'sphere' },
    base: {
      position: {
        x: 5,
        y: 1,
        z: 5,
        fromArray: () => {},
        toArray: () => [5, 1, 5],
      },
      quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
        fromArray: () => {},
        toArray: () => [0, 0, 0, 1],
      },
      scale: { x: 1, y: 1, z: 1, fromArray: () => {}, toArray: () => [1, 1, 1] },
    },
    root: {
      position: {
        x: 5,
        y: 1,
        z: 5,
        fromArray: () => {},
        toArray: () => [5, 1, 5],
      },
      quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
        fromArray: () => {},
        toArray: () => [0, 0, 0, 1],
      },
      scale: { x: 1, y: 1, z: 1, fromArray: () => {}, toArray: () => [1, 1, 1] },
    },
    destroy: mock(),
  });

  return {
    entities: {
      player: {
        data: {
          id: 'test-player-id',
          name: 'TestAgent',
          position: { x: 10, y: 0, z: 10 },
          effect: {},
        },
        base: {
          position: { x: 10, y: 0, z: 10 },
        },
        root: {
          position: { x: 10, y: 0, z: 10 },
        },
      },
      items: mockEntities,
    },
    chat: {
      add: mock(),
      msgs: [],
    },
    controls: {
      goto: mock(),
      stopAllActions: mock(),
    },
    actions: {
      execute: mock(),
      getNearby: mock().mockReturnValue([]),
    },
    network: {
      upload: mock(),
      send: mock(),
    },
    assetsUrl: 'https://test.hyperfy.io/assets',
    blueprints: {
      add: mock(),
    },
  };
}

/**
 * Creates a mock Hyperfy service
 */
export function createMockHyperfyService(): any {
  return {
    start: async () => {},
    stop: async () => {},
    isConnected: () => true,
    getWorld: () => createMockWorld(),
    getMessageManager: () => ({
      sendMessage: () => {},
      handleMessage: () => {},
      getRecentMessages: async () => ({
        formattedHistory: 'No messages yet',
        lastResponseText: '',
        lastActions: [],
      }),
    }),
    getEmoteManager: () => ({
      playEmote: () => {},
      uploadEmotes: () => {},
    }),
    getBehaviorManager: () => ({
      start: () => {},
      stop: () => {},
      isRunning: false,
    }),
    getBuildManager: () => ({
      duplicate: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      delete: () => {},
      importEntity: () => {},
    }),
    getVoiceManager: () => ({
      start: () => {},
      stop: () => {},
    }),
    currentWorldId: 'test-world-123',
    connect: async () => true,
    disconnect: async () => true,
  };
}

/**
 * Sets up logger spies for common usage in tests
 */
export function setupLoggerSpies(mockFn?: any) {
  const originalConsole = {
    info: console.info,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
  };

  if (mockFn) {
    console.info = mockFn(() => {});
    console.error = mockFn(() => {});
    console.warn = mockFn(() => {});
    console.debug = mockFn(() => {});
  }

  // Allow tests to restore originals
  return () => {
    console.info = originalConsole.info;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.debug = originalConsole.debug;
  };
}