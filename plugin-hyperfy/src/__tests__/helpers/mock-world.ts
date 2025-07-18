import { mock } from 'bun:test';
import * as THREE from 'three';

/**
 * Creates a mock Hyperfy world for testing
 */
export function createMockWorld(overrides: any = {}) {
  const defaultPlayer = {
    data: {
      id: 'test-player-id',
      name: 'TestAgent',
      position: { x: 10, y: 0, z: 10 },
      effect: {},
      rotation: [0, 0, 0, 1],
    },
    base: {
      position: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
    },
    root: {
      position: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
      scale: new THREE.Vector3(1, 1, 1),
    },
    moving: false,
    teleport: mock(),
    setSessionAvatar: mock(),
    modify: mock(),
  };

  const defaultEntities = new Map([
    [
      'entity-1',
      {
        data: { id: 'entity-1', name: 'Block', pinned: false },
        base: {
          position: { x: 0, y: 0, z: 0 },
          quaternion: { x: 0, y: 0, z: 0, w: 1 },
        },
        root: {
          position: {
            x: 0,
            y: 0,
            z: 0,
            fromArray: mock(),
            toArray: mock().mockReturnValue([0, 0, 0]),
          },
          quaternion: {
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            fromArray: mock(),
            toArray: mock().mockReturnValue([0, 0, 0, 1]),
          },
          scale: {
            x: 1,
            y: 1,
            z: 1,
            fromArray: mock(),
            toArray: mock().mockReturnValue([1, 1, 1]),
          },
        },
        blueprint: { name: 'block', unique: false },
        isApp: true,
        destroy: mock(),
      },
    ],
    [
      'entity-2',
      {
        data: { id: 'entity-2', name: 'Sphere', pinned: false },
        base: {
          position: { x: 5, y: 0, z: 5 },
          quaternion: { x: 0, y: 0, z: 0, w: 1 },
        },
        root: {
          position: {
            x: 5,
            y: 0,
            z: 5,
            fromArray: mock(),
            toArray: mock().mockReturnValue([5, 0, 5]),
          },
          quaternion: {
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            fromArray: mock(),
            toArray: mock().mockReturnValue([0, 0, 0, 1]),
          },
          scale: {
            x: 1,
            y: 1,
            z: 1,
            fromArray: mock(),
            toArray: mock().mockReturnValue([1, 1, 1]),
          },
        },
        blueprint: { name: 'sphere', unique: false },
        isApp: true,
        destroy: mock(),
      },
    ],
  ]);

  const mockWorld = {
    // Basic properties
    assetsUrl: 'https://assets.hyperfy.io/',

    // Entities system
    entities: {
      player: overrides.player || defaultPlayer,
      players: new Map(),
      items: overrides.entities || defaultEntities,
      add: mock(),
      remove: mock(),
      getPlayer: mock((id) => defaultPlayer),
    },

    // Network system
    network: {
      id: 'test-network-id',
      send: mock(),
      upload: mock().mockResolvedValue(true),
      disconnect: mock(),
      maxUploadSize: 100, // MB
    },

    // Chat system
    chat: {
      msgs: [],
      listeners: [],
      add: mock((msg, broadcast) => {
        mockWorld.chat.msgs.push(msg);
        mockWorld.chat.listeners.forEach((cb: any) => cb(mockWorld.chat.msgs));
      }),
      subscribe: mock((callback) => {
        mockWorld.chat.listeners.push(callback);
        return () => {
          const idx = mockWorld.chat.listeners.indexOf(callback);
          if (idx > -1) {
            mockWorld.chat.listeners.splice(idx, 1);
          }
        };
      }),
    },

    // Controls system
    controls: {
      goto: mock().mockResolvedValue(true),
      followEntity: mock().mockResolvedValue(true),
      stopAllActions: mock(),
      stopNavigation: mock(),
      stopRotation: mock(),
      rotateTo: mock().mockResolvedValue(true),
      startRandomWalk: mock(),
      stopRandomWalk: mock(),
      getIsNavigating: mock().mockReturnValue(false),
      getIsWalkingRandomly: mock().mockReturnValue(false),
      setKey: mock(),
    },

    // Actions system
    actions: {
      getNearby: mock().mockReturnValue([
        {
          ctx: { entity: defaultEntities.get('entity-1') },
          _label: 'Pick up',
          _duration: 1000,
          _onTrigger: mock(),
          _onCancel: mock(),
        },
      ]),
      performAction: mock(),
      releaseAction: mock(),
      currentNode: null,
    },

    // Loader system
    loader: {
      get: mock(),
      load: mock().mockResolvedValue({
        gltf: {},
        toNodes: mock(),
        factory: {},
      }),
    },

    // Stage/Scene
    stage: {
      scene: {
        add: mock(),
        remove: mock(),
        toJSON: mock().mockReturnValue({}),
        environment: null,
        background: null,
        fog: null,
      },
    },

    // Camera/Rig
    camera: {
      position: new THREE.Vector3(0, 5, 10),
      rotation: new THREE.Euler(0, 0, 0),
    },
    rig: {
      position: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },

    // LiveKit integration
    livekit: {
      on: mock(),
      publishAudioStream: mock().mockResolvedValue(true),
    },

    // Event system
    events: {
      emit: mock(),
      on: mock(),
      off: mock(),
    },

    // Blueprints
    blueprints: {
      add: mock(),
    },

    // Settings
    settings: {
      on: mock(),
      model: null,
    },

    // Systems array
    systems: [],

    // World lifecycle
    init: mock().mockResolvedValue(true),
    destroy: mock(),
    on: mock(),
    off: mock(),

    // Apply overrides
    ...overrides,
  };

  return mockWorld;
}

/**
 * Creates a mock Hyperfy service for testing
 */
export function createMockHyperfyService(overrides: any = {}) {
  const mockWorld = createMockWorld(overrides.world);

  return {
    serviceType: 'hyperfy',
    capabilityDescription: 'Manages connection and interaction with a Hyperfy world.',

    // Connection state
    isConnected: mock().mockReturnValue(true),
    connect: mock().mockResolvedValue(true),
    disconnect: mock().mockResolvedValue(true),

    // World access
    getWorld: mock().mockReturnValue(mockWorld),
    currentWorldId: 'test-world-id',

    // Entity methods
    getEntityById: mock((id) => mockWorld.entities.items.get(id)),
    getEntityName: mock((id) => {
      const entity = mockWorld.entities.items.get(id);
      return entity?.data?.name || entity?.blueprint?.name || 'Unnamed';
    }),

    // Manager access
    getEmoteManager: mock().mockReturnValue({
      playEmote: mock(),
      uploadEmotes: mock().mockResolvedValue(true),
    }),
    getBehaviorManager: mock().mockReturnValue({
      start: mock(),
      stop: mock(),
    }),
    getMessageManager: mock().mockReturnValue({
      sendMessage: mock(),
      handleMessage: mock().mockResolvedValue(true),
      getRecentMessages: mock().mockResolvedValue({
        formattedHistory: '',
        lastResponseText: null,
        lastActions: [],
      }),
    }),
    getVoiceManager: mock().mockReturnValue({
      start: mock(),
      handleUserBuffer: mock(),
      playAudio: mock().mockResolvedValue(true),
    }),
    getPuppeteerManager: mock().mockReturnValue({
      snapshotEquirectangular: mock().mockResolvedValue('data:image/jpeg;base64,mock'),
      snapshotFacingDirection: mock().mockResolvedValue('data:image/jpeg;base64,mock'),
      snapshotViewToTarget: mock().mockResolvedValue('data:image/jpeg;base64,mock'),
    }),
    getBuildManager: mock().mockReturnValue({
      translate: mock().mockResolvedValue(true),
      rotate: mock().mockResolvedValue(true),
      scale: mock().mockResolvedValue(true),
      duplicate: mock().mockResolvedValue(true),
      delete: mock().mockResolvedValue(true),
      importEntity: mock().mockResolvedValue(true),
    }),

    // Name/appearance
    changeName: mock().mockResolvedValue(true),

    // Apply overrides
    ...overrides,
  };
}

/**
 * Helper to create a mock chat message
 */
export function createMockChatMessage(overrides: any = {}) {
  return {
    id: `msg-${Date.now()}`,
    fromId: overrides.fromId || 'user-123',
    from: overrides.from || 'TestUser',
    body: overrides.body || 'Hello agent!',
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Helper to simulate world events
 */
export function simulateWorldEvent(world: any, event: string, data: any) {
  const listeners = world._eventListeners?.[event] || [];
  listeners.forEach((listener: Function) => listener(data));
}

export function createMockPuppeteerManager() {
  return {
    snapshotEquirectangular: mock().mockResolvedValue('data:image/png;base64,test'),
    snapshotFacingDirection: mock().mockResolvedValue('data:image/png;base64,test'),
    snapshotViewToTarget: mock().mockResolvedValue('data:image/png;base64,test'),
    start: mock(),
    stop: mock(),
  };
}

export function createMockEmoteManager() {
  return {
    playEmote: mock(),
    stopEmote: mock(),
    uploadEmotes: mock().mockResolvedValue(true),
    getEmoteList: mock().mockReturnValue([
      { name: 'wave', path: '/emotes/wave.glb', duration: 2000, description: 'Wave gesture' },
      { name: 'dance', path: '/emotes/dance.glb', duration: 5000, description: 'Dance animation' },
    ]),
  };
}

export function createMockMessageManager() {
  return {
    sendMessage: mock(),
    processMessage: mock(),
    getHistory: mock().mockReturnValue([]),
  };
}

export function createMockVoiceManager() {
  return {
    start: mock(),
    stop: mock(),
    joinChannel: mock(),
    leaveChannel: mock(),
    mute: mock(),
    unmute: mock(),
  };
}

export function createMockBehaviorManager() {
  return {
    start: mock(),
    stop: mock(),
    isRunning: false,
  };
}

export function createMockBuildManager() {
  return {
    duplicate: mock(),
    translate: mock(),
    rotate: mock(),
    scale: mock(),
    delete: mock(),
    importEntity: mock(),
    findNearbyEntities: mock().mockReturnValue([]),
    getEntityInfo: mock(),
  };
}
