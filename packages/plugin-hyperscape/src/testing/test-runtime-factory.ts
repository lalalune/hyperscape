import {
  IAgentRuntime,
  Character,
  logger,
  UUID,
  Memory,
  ServiceTypeName,
  Service,
} from '@elizaos/core'
import { HyperscapeService } from '../service'

// Helper function to generate test UUIDs
function generateTestUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }) as UUID
}

export interface TestRuntimeConfig {
  character: Partial<Character>
  modelProvider?: string
  wsUrl?: string
  worldId?: string
}

/**
 * Creates a mock test runtime for visual testing
 * Simplified version that bypasses full ElizaOS runtime creation
 */
export async function createDynamicRuntime(
  config: TestRuntimeConfig
): Promise<IAgentRuntime> {
  // Create a minimal mock runtime for testing
  const mockRuntime = {
    agentId: generateTestUUID(),
    character: {
      id: generateTestUUID(),
      name: config.character.name || 'TestAgent',
      bio: config.character.bio || 'AI agent for visual testing',
    } as Character,
    services: new Map<string, Service>(),

    // Mock service registration
    registerService(service: Service) {
      this.services.set((service as any).serviceName || 'unknown', service)
    },

    // Mock service retrieval
    getService<T>(serviceName: string): T | undefined {
      return this.services.get(serviceName) as T
    },

    // Mock other runtime methods
    composeState: async () => ({}),
    processActions: async () => [],
    evaluate: async () => ({}),
    createMemory: async () => ({}) as Memory,
    addEmbeddingToMemory: async () => {},
    getParticipantUserState: async () => ({}),
    getRoom: async () => ({ type: 'DM' }),
    useModel: async () => 'Mock response',
  } as unknown as IAgentRuntime

  logger.info('[TestRuntimeFactory] Creating mock test runtime...')

  // Add Hyperscape service
  const hyperscapeService = new HyperscapeService(mockRuntime)

  // Connect to specified world if provided
  if (config.wsUrl && config.worldId) {
    logger.info(
      `[TestRuntimeFactory] Connecting to test world: ${config.wsUrl}`
    )
    try {
      await hyperscapeService.connect({
        wsUrl: config.wsUrl,
        worldId: config.worldId as UUID,
        authToken: undefined,
      })
      logger.info('[TestRuntimeFactory] Test world connection successful')
    } catch (error) {
      logger.error(
        '[TestRuntimeFactory] Failed to connect to test world:',
        error
      )
      throw new Error(
        `Test world connection failed: ${(error as Error).message}`
      )
    }
  }

  // Register service with runtime
  mockRuntime.services.set(
    'hyperscape' as ServiceTypeName,
    hyperscapeService as any
  )

  return mockRuntime
}

/**
 * Creates a test runtime with automatic world connection
 */
export async function createVisualTestRuntime(
  agentName: string = 'VisualTestAgent'
): Promise<IAgentRuntime> {
  const testWorldUrl =
    process.env.TEST_WORLD_URL ||
    process.env.WS_URL ||
    'wss://chill.hyperscape.xyz/ws'
  const testWorldId = process.env.TEST_WORLD_ID || 'visual-test-world'

  return createDynamicRuntime({
    character: {
      name: agentName,
      bio: `Visual testing agent for RPG system verification`,
      topics: ['rpg', 'testing', 'combat', 'items', 'mobs'],
      style: {
        all: ['precise', 'factual', 'systematic'],
        chat: ['technical', 'verification-focused'],
        post: ['detailed', 'analytical'],
      },
    },
    modelProvider: 'openai',
    wsUrl: testWorldUrl,
    worldId: testWorldId,
  })
}
