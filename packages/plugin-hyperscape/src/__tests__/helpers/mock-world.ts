import { vi } from "vitest";

// Re-export from test-mocks for consistency
export { createMockWorld } from "../../types/test-mocks";

interface MockHyperscapeServiceOverrides {
  world?: unknown;
  [key: string]: unknown;
}

/**
 * Creates a mock Hyperscape world for testing
 */

/**
 * Creates a mock Hyperscape service for testing
 */
export function createMockHyperscapeService(
  overrides: MockHyperscapeServiceOverrides = {},
) {
  // Import createMockWorld from the correct location
  const { createMockWorld } = require("../../types/test-mocks");
  const mockWorld = createMockWorld(overrides.world);

  return {
    serviceType: "hyperscape",
    capabilityDescription:
      "Manages connection and interaction with a Hyperscape world.",

    // Connection state
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),

    // World access
    getWorld: vi.fn().mockReturnValue(mockWorld),
    currentWorldId: "test-world-id",

    // Entity methods
    getEntityById: vi.fn((id) => mockWorld.entities.items.get(id)),
    getEntityName: vi.fn((id) => {
      const entity = mockWorld.entities.items.get(id);
      return entity?.data?.name || "Unnamed";
    }),

    // Manager access
    getEmoteManager: vi.fn().mockReturnValue({
      playEmote: vi.fn(),
      uploadEmotes: vi.fn().mockResolvedValue(true),
    }),
    getBehaviorManager: vi.fn().mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
    }),
    getMessageManager: vi.fn().mockReturnValue({
      sendMessage: vi.fn(),
      handleMessage: vi.fn().mockResolvedValue(true),
      getRecentMessages: vi.fn().mockResolvedValue({
        formattedHistory: "",
        lastResponseText: null,
        lastActions: [],
      }),
    }),
    getVoiceManager: vi.fn().mockReturnValue({
      start: vi.fn(),
      handleUserBuffer: vi.fn(),
      playAudio: vi.fn().mockResolvedValue(true),
    }),
    getPlaywrightManager: vi.fn().mockReturnValue({
      snapshotEquirectangular: vi
        .fn()
        .mockResolvedValue("data:image/jpeg;base64,mock"),
      snapshotFacingDirection: vi
        .fn()
        .mockResolvedValue("data:image/jpeg;base64,mock"),
      snapshotViewToTarget: vi
        .fn()
        .mockResolvedValue("data:image/jpeg;base64,mock"),
    }),
    getBuildManager: vi.fn().mockReturnValue({
      translate: vi.fn().mockResolvedValue(true),
      rotate: vi.fn().mockResolvedValue(true),
      scale: vi.fn().mockResolvedValue(true),
      duplicate: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
      importEntity: vi.fn().mockResolvedValue(true),
    }),

    // Name/appearance
    changeName: vi.fn().mockResolvedValue(true),

    // Apply overrides
    ...overrides,
  };
}

interface MockChatMessageOverrides {
  fromId?: string;
  from?: string;
  body?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Helper to create a mock chat message
 */
export function createMockChatMessage(
  overrides: MockChatMessageOverrides = {},
) {
  return {
    id: `msg-${Date.now()}`,
    fromId: overrides.fromId || "user-123",
    from: overrides.from || "TestUser",
    body: overrides.body || "Hello agent!",
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides,
  };
}

interface MockWorld {
  _eventListeners?: Record<string, Function[]>;
  [key: string]: unknown;
}

/**
 * Helper to simulate world events
 */
export function simulateWorldEvent(
  world: MockWorld,
  event: string,
  data: unknown,
) {
  const listeners = world._eventListeners?.[event] || [];
  listeners.forEach((listener: Function) => listener(data));
}

export function createMockPlaywrightManager() {
  return {
    snapshotEquirectangular: vi
      .fn()
      .mockResolvedValue("data:image/png;base64,test"),
    snapshotFacingDirection: vi
      .fn()
      .mockResolvedValue("data:image/png;base64,test"),
    snapshotViewToTarget: vi
      .fn()
      .mockResolvedValue("data:image/png;base64,test"),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

export function createMockEmoteManager() {
  return {
    playEmote: vi.fn(),
    stopEmote: vi.fn(),
    uploadEmotes: vi.fn().mockResolvedValue(true),
    getEmoteList: vi.fn().mockReturnValue([
      {
        name: "wave",
        path: "/emotes/wave.glb",
        duration: 2000,
        description: "Wave gesture",
      },
      {
        name: "dance",
        path: "/emotes/dance.glb",
        duration: 5000,
        description: "Dance animation",
      },
    ]),
  };
}

export function createMockMessageManager() {
  return {
    sendMessage: vi.fn(),
    processMessage: vi.fn(),
    getHistory: vi.fn().mockReturnValue([]),
  };
}

export function createMockVoiceManager() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
  };
}

export function createMockBehaviorManager() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: false,
  };
}

export function createMockBuildManager() {
  return {
    duplicate: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    delete: vi.fn(),
    importEntity: vi.fn(),
    findNearbyEntities: vi.fn().mockReturnValue([]),
    getEntityInfo: vi.fn(),
  };
}
