import { vi } from 'vitest'
import * as THREE from 'three'

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
    teleport: vi.fn(),
    setSessionAvatar: vi.fn(),
    modify: vi.fn(),
  }

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
            fromArray: vi.fn(),
            toArray: vi.fn().mockReturnValue([0, 0, 0]),
          },
          quaternion: {
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            fromArray: vi.fn(),
            toArray: vi.fn().mockReturnValue([0, 0, 0, 1]),
          },
          scale: {
            x: 1,
            y: 1,
            z: 1,
            fromArray: vi.fn(),
            toArray: vi.fn().mockReturnValue([1, 1, 1]),
          },
        },
        blueprint: { name: 'block', unique: false },
        isApp: true,
        destroy: vi.fn(),
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
            fromArray: vi.fn(),
            toArray: vi.fn().mockReturnValue([5, 0, 5]),
          },
          quaternion: {
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            fromArray: vi.fn(),
            toArray: vi.fn().mockReturnValue([0, 0, 0, 1]),
          },
          scale: {
            x: 1,
            y: 1,
            z: 1,
            fromArray: vi.fn(),
            toArray: vi.fn().mockReturnValue([1, 1, 1]),
          },
        },
        blueprint: { name: 'sphere', unique: false },
        isApp: true,
        destroy: vi.fn(),
      },
    ],
  ])

  const mockWorld = {
    // Basic properties
    assetsUrl: 'https://assets.hyperfy.io/',

    // Entities system
    entities: {
      player: overrides.player || defaultPlayer,
      players: new Map(),
      items: overrides.entities || defaultEntities,
      add: vi.fn(),
      remove: vi.fn(),
      getPlayer: vi.fn(id => defaultPlayer),
    },

    // Network system
    network: {
      id: 'test-network-id',
      send: vi.fn(),
      upload: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn(),
      maxUploadSize: 100, // MB
    },

    // Chat system
    chat: {
      msgs: [],
      listeners: [],
      add: vi.fn((msg, broadcast) => {
        mockWorld.chat.msgs.push(msg)
        mockWorld.chat.listeners.forEach((cb: any) => cb(mockWorld.chat.msgs))
      }),
      subscribe: vi.fn(callback => {
        mockWorld.chat.listeners.push(callback)
        return () => {
          const idx = mockWorld.chat.listeners.indexOf(callback)
          if (idx > -1) {
            mockWorld.chat.listeners.splice(idx, 1)
          }
        }
      }),
    },

    // Controls system
    controls: {
      goto: vi.fn().mockResolvedValue(true),
      followEntity: vi.fn().mockResolvedValue(true),
      stopAllActions: vi.fn(),
      stopNavigation: vi.fn(),
      stopRotation: vi.fn(),
      rotateTo: vi.fn().mockResolvedValue(true),
      startRandomWalk: vi.fn(),
      stopRandomWalk: vi.fn(),
      getIsNavigating: vi.fn().mockReturnValue(false),
      getIsWalkingRandomly: vi.fn().mockReturnValue(false),
      setKey: vi.fn(),
    },

    // Actions system
    actions: {
      getNearby: vi.fn().mockReturnValue([
        {
          ctx: { entity: defaultEntities.get('entity-1') },
          _label: 'Pick up',
          _duration: 1000,
          _onTrigger: vi.fn(),
          _onCancel: vi.fn(),
        },
      ]),
      performAction: vi.fn(),
      releaseAction: vi.fn(),
      currentNode: null,
    },

    // Loader system
    loader: {
      get: vi.fn(),
      load: vi.fn().mockResolvedValue({
        gltf: {},
        toNodes: vi.fn(),
        factory: {},
      }),
    },

    // Stage/Scene
    stage: {
      scene: {
        add: vi.fn(),
        remove: vi.fn(),
        toJSON: vi.fn().mockReturnValue({}),
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
      on: vi.fn(),
      publishAudioStream: vi.fn().mockResolvedValue(true),
    },

    // Event system
    events: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },

    // Blueprints
    blueprints: {
      add: vi.fn(),
    },

    // Settings
    settings: {
      on: vi.fn(),
      model: null,
    },

    // Systems array
    systems: [],

    // World lifecycle
    init: vi.fn().mockResolvedValue(true),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),

    // Apply overrides
    ...overrides,
  }

  return mockWorld
}

/**
 * Creates a mock Hyperfy service for testing
 */
export function createMockHyperfyService(overrides: any = {}) {
  const mockWorld = createMockWorld(overrides.world)

  return {
    serviceType: 'hyperfy',
    capabilityDescription:
      'Manages connection and interaction with a Hyperfy world.',

    // Connection state
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),

    // World access
    getWorld: vi.fn().mockReturnValue(mockWorld),
    currentWorldId: 'test-world-id',

    // Entity methods
    getEntityById: vi.fn(id => mockWorld.entities.items.get(id)),
    getEntityName: vi.fn(id => {
      const entity = mockWorld.entities.items.get(id)
      return entity?.data?.name || entity?.blueprint?.name || 'Unnamed'
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
        formattedHistory: '',
        lastResponseText: null,
        lastActions: [],
      }),
    }),
    getVoiceManager: vi.fn().mockReturnValue({
      start: vi.fn(),
      handleUserBuffer: vi.fn(),
      playAudio: vi.fn().mockResolvedValue(true),
    }),
    getPuppeteerManager: vi.fn().mockReturnValue({
      snapshotEquirectangular: vi.fn().mockResolvedValue(
        'data:image/jpeg;base64,mock'
      ),
      snapshotFacingDirection: vi.fn().mockResolvedValue(
        'data:image/jpeg;base64,mock'
      ),
      snapshotViewToTarget: vi.fn().mockResolvedValue(
        'data:image/jpeg;base64,mock'
      ),
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
  }
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
  }
}

/**
 * Helper to simulate world events
 */
export function simulateWorldEvent(world: any, event: string, data: any) {
  const listeners = world._eventListeners?.[event] || []
  listeners.forEach((listener: Function) => listener(data))
}

export function createMockPuppeteerManager() {
  return {
    snapshotEquirectangular: vi.fn().mockResolvedValue(
      'data:image/png;base64,test'
    ),
    snapshotFacingDirection: vi.fn().mockResolvedValue(
      'data:image/png;base64,test'
    ),
    snapshotViewToTarget: vi.fn().mockResolvedValue(
      'data:image/png;base64,test'
    ),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

export function createMockEmoteManager() {
  return {
    playEmote: vi.fn(),
    stopEmote: vi.fn(),
    uploadEmotes: vi.fn().mockResolvedValue(true),
    getEmoteList: vi.fn().mockReturnValue([
      {
        name: 'wave',
        path: '/emotes/wave.glb',
        duration: 2000,
        description: 'Wave gesture',
      },
      {
        name: 'dance',
        path: '/emotes/dance.glb',
        duration: 5000,
        description: 'Dance animation',
      },
    ]),
  }
}

export function createMockMessageManager() {
  return {
    sendMessage: vi.fn(),
    processMessage: vi.fn(),
    getHistory: vi.fn().mockReturnValue([]),
  }
}

export function createMockVoiceManager() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
  }
}

export function createMockBehaviorManager() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: false,
  }
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
  }
}
