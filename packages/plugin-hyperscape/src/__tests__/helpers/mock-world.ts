import { mock } from "bun:test";

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
    isConnected: mock(() => {}).mockReturnValue(true),
    connect: mock(() => {}).mockResolvedValue(true),
    disconnect: mock(() => {}).mockResolvedValue(true),

    // World access
    getWorld: mock(() => {}).mockReturnValue(mockWorld),
    currentWorldId: "test-world-id",

    // Entity methods
    getEntityById: mock((id) => mockWorld.entities.items.get(id)),
    getEntityName: mock((id) => {
      const entity = mockWorld.entities.items.get(id);
      return entity?.data?.name || "Unnamed";
    }),

    // Manager access
    getEmoteManager: mock(() => {}).mockReturnValue({
      playEmote: mock(() => {}),
      uploadEmotes: mock(() => {}).mockResolvedValue(true),
    }),
    getBehaviorManager: mock(() => {}).mockReturnValue({
      start: mock(() => {}),
      stop: mock(() => {}),
    }),
    getMessageManager: mock(() => {}).mockReturnValue({
      sendMessage: mock(() => {}),
      handleMessage: mock(() => {}).mockResolvedValue(true),
      getRecentMessages: mock(() => {}).mockResolvedValue({
        formattedHistory: "",
        lastResponseText: null,
        lastActions: [],
      }),
    }),
    getVoiceManager: mock(() => {}).mockReturnValue({
      start: mock(() => {}),
      handleUserBuffer: mock(() => {}),
      playAudio: mock(() => {}).mockResolvedValue(true),
    }),
    getPlaywrightManager: mock(() => {}).mockReturnValue({
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
    getBuildManager: mock(() => {}).mockReturnValue({
      translate: mock(() => {}).mockResolvedValue(true),
      rotate: mock(() => {}).mockResolvedValue(true),
      scale: mock(() => {}).mockResolvedValue(true),
      duplicate: mock(() => {}).mockResolvedValue(true),
      delete: mock(() => {}).mockResolvedValue(true),
      importEntity: mock(() => {}).mockResolvedValue(true),
    }),

    // Name/appearance
    changeName: mock(() => {}).mockResolvedValue(true),

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
    start: mock(() => {}),
    stop: mock(() => {}),
  };
}

export function createMockEmoteManager(): {
  playEmote: ReturnType<typeof mock>;
  stopEmote: ReturnType<typeof mock>;
  uploadEmotes: ReturnType<typeof mock>;
  getEmoteList: ReturnType<typeof mock>;
} {
  return {
    playEmote: mock(() => {}),
    stopEmote: mock(() => {}),
    uploadEmotes: mock(() => {}).mockResolvedValue(true),
    getEmoteList: mock(() => {}).mockReturnValue([
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

export function createMockMessageManager(): {
  sendMessage: ReturnType<typeof mock>;
  processMessage: ReturnType<typeof mock>;
  getHistory: ReturnType<typeof mock>;
} {
  return {
    sendMessage: mock(() => {}),
    processMessage: mock(() => {}),
    getHistory: mock(() => {}).mockReturnValue([]),
  };
}

export function createMockVoiceManager(): {
  start: ReturnType<typeof mock>;
  stop: ReturnType<typeof mock>;
  joinChannel: ReturnType<typeof mock>;
  leaveChannel: ReturnType<typeof mock>;
  mute: ReturnType<typeof mock>;
  unmute: ReturnType<typeof mock>;
} {
  return {
    start: mock(() => {}),
    stop: mock(() => {}),
    joinChannel: mock(() => {}),
    leaveChannel: mock(() => {}),
    mute: mock(() => {}),
    unmute: mock(() => {}),
  };
}

export function createMockBehaviorManager(): {
  start: ReturnType<typeof mock>;
  stop: ReturnType<typeof mock>;
  isRunning: boolean;
} {
  return {
    start: mock(() => {}),
    stop: mock(() => {}),
    isRunning: false,
  };
}

export function createMockBuildManager(): {
  duplicate: ReturnType<typeof mock>;
  translate: ReturnType<typeof mock>;
  rotate: ReturnType<typeof mock>;
  scale: ReturnType<typeof mock>;
  delete: ReturnType<typeof mock>;
  importEntity: ReturnType<typeof mock>;
  findNearbyEntities: ReturnType<typeof mock>;
} {
  return {
    duplicate: mock(() => {}),
    translate: mock(() => {}),
    rotate: mock(() => {}),
    scale: mock(() => {}),
    delete: mock(() => {}),
    importEntity: mock(() => {}),
    findNearbyEntities: mock(() => {}).mockReturnValue([]),
    getEntityInfo: mock(() => {}),
  };
}
