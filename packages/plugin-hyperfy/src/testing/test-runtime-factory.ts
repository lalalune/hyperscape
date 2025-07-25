import {
  IAgentRuntime,
  Character,
  logger,
  UUID,
  createUniqueUuid
} from '@elizaos/core'
import { HyperfyService } from '../service.js'

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
export async function createDynamicRuntime(config: TestRuntimeConfig): Promise<IAgentRuntime> {
  // Create a minimal mock runtime for testing
  const mockRuntime = {
    agentId: createUniqueUuid() as UUID,
    character: {
      id: createUniqueUuid() as UUID,
      name: config.character.name || 'TestAgent',
      bio: config.character.bio || 'AI agent for visual testing'
    } as Character,
    services: new Map(),
    
    // Mock service registration
    registerService(service: any) {
      this.services.set(service.serviceName, service)
    },
    
    // Mock service retrieval
    getService<T>(serviceName: string): T | undefined {
      return this.services.get(serviceName) as T
    },
    
    // Mock other runtime methods
    composeState: async () => ({}),
    processActions: async () => [],
    evaluate: async () => ({}),
    createMemory: async () => ({} as any),
    addEmbeddingToMemory: async () => {},
    getParticipantUserState: async () => ({}),
    getRoom: async () => ({ type: 'DM' }),
    useModel: async () => 'Mock response'
  } as IAgentRuntime

  logger.info('[TestRuntimeFactory] Creating mock test runtime...')

  // Add Hyperfy service
  const hyperfyService = new HyperfyService(mockRuntime)
  
  // Connect to specified world if provided
  if (config.wsUrl && config.worldId) {
    logger.info(`[TestRuntimeFactory] Connecting to test world: ${config.wsUrl}`)
    try {
      await hyperfyService.connect({
        wsUrl: config.wsUrl,
        worldId: config.worldId as UUID,
        authToken: undefined
      })
      logger.info('[TestRuntimeFactory] Test world connection successful')
    } catch (error) {
      logger.error('[TestRuntimeFactory] Failed to connect to test world:', error)
      throw new Error(`Test world connection failed: ${error.message}`)
    }
  }

  // Register service with runtime
  mockRuntime.registerService(hyperfyService)

  return mockRuntime
}

/**
 * Creates a test runtime with automatic world connection
 */
export async function createVisualTestRuntime(agentName: string = 'VisualTestAgent'): Promise<IAgentRuntime> {
  const testWorldUrl = process.env.TEST_WORLD_URL || process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws'
  const testWorldId = process.env.TEST_WORLD_ID || 'visual-test-world'

  return createDynamicRuntime({
    character: {
      name: agentName,
      bio: `Visual testing agent for RPG system verification`,
      topics: ['rpg', 'testing', 'combat', 'items', 'mobs'],
      style: {
        all: ['precise', 'factual', 'systematic'],
        chat: ['technical', 'verification-focused'],
        post: ['detailed', 'analytical']
      }
    },
    modelProvider: 'openai',
    wsUrl: testWorldUrl,
    worldId: testWorldId
  })
}