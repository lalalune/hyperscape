import {
  IAgentRuntime,
  Character,
  logger,
  UUID,
  Memory,
  ServiceTypeName,
  Service,
} from "@elizaos/core";
import { HyperiaService } from "../services/HyperiaService.js";

// Helper function to generate test UUIDs
function generateTestUUID(): UUID {
  return crypto.randomUUID() as UUID;
}

export interface TestRuntimeConfig {
  character: Partial<Character>;
  modelProvider?: string;
  wsUrl?: string;
  worldId?: string;
}

/**
 * Creates a mock test runtime for visual testing
 * Simplified version that bypasses full ElizaOS runtime creation
 */
export async function createDynamicRuntime(
  config: TestRuntimeConfig,
): Promise<IAgentRuntime> {
  // Legitimate cast: Test mock with minimal IAgentRuntime interface (100+ properties)
  // We only implement the methods actually used by plugin-hyperia visual tests
  const mockRuntime = {
    agentId: generateTestUUID(),
    character: {
      id: generateTestUUID(),
      name: config.character.name || "TestAgent",
      bio: config.character.bio || "AI agent for visual testing",
    } as Character,
    services: new Map() as Map<ServiceTypeName, Service[]>,

    // Mock service registration - simplified for test mocks
    // Legitimate cast: Test mock doesn't match full IAgentRuntime signature
    registerService(_service: typeof Service | Service) {
      // No-op for test mock - services added directly to map below
    },

    // Mock service retrieval
    getService<T>(serviceName: string): T | undefined {
      const serviceType = serviceName as ServiceTypeName;
      const services = this.services.get(serviceType);
      return (services?.[0] || undefined) as T | undefined;
    },

    // Mock other runtime methods
    composeState: async () => ({}),
    processActions: async () => [],
    evaluate: async () => ({}),
    createMemory: async () => ({}) as Memory,
    addEmbeddingToMemory: async () => {},
    getParticipantUserState: async () => ({}),
    getRoom: async () => ({ type: "DM" }),
    useModel: async () => "Mock response",
  } as unknown as IAgentRuntime;

  logger.info("[TestRuntimeFactory] Creating mock test runtime...");

  // Add Hyperia service
  const hyperiaService = new HyperiaService(mockRuntime);

  // Connect to specified world if provided
  if (config.wsUrl) {
    logger.info(
      `[TestRuntimeFactory] Connecting to test server: ${config.wsUrl}`,
    );
    try {
      await hyperiaService.connect(config.wsUrl);
      logger.info("[TestRuntimeFactory] Test server connection successful");
    } catch (error) {
      logger.error(
        "[TestRuntimeFactory] Failed to connect to test server:",
        error,
      );
      throw new Error(
        `Test server connection failed: ${(error as Error).message}`,
      );
    }
  }

  // Register service with runtime - add directly to services map for mock
  mockRuntime.services.set("hyperia" as ServiceTypeName, [hyperiaService]);

  return mockRuntime;
}

/**
 * Creates a test runtime with automatic world connection
 */
export async function createVisualTestRuntime(
  agentName: string = "VisualTestAgent",
): Promise<IAgentRuntime> {
  const testWorldUrl =
    process.env.TEST_WORLD_URL || process.env.WS_URL || "wss://hyperia.gg/ws";
  const testWorldId = process.env.TEST_WORLD_ID || "visual-test-world";

  return createDynamicRuntime({
    character: {
      name: agentName,
      bio: `Visual testing agent for RPG system verification`,
      topics: ["rpg", "testing", "combat", "items", "mobs"],
      style: {
        all: ["precise", "factual", "systematic"],
        chat: ["technical", "verification-focused"],
        post: ["detailed", "analytical"],
      },
    },
    modelProvider: "openai",
    wsUrl: testWorldUrl,
    worldId: testWorldId,
  });
}
