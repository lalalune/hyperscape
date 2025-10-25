/**
 * ClientNetwork.ts - Client-Side Networking System
 * 
 * Manages WebSocket connection to game server and handles network communication.
 * Provides entity synchronization, latency compensation, and packet handling.
 * 
 * Key Features:
 * - **WebSocket Client**: Persistent connection to game server
 * - **Entity Sync**: Replicates server entities to client
 * - **Interpolation**: Smooth movement between server updates
 * - **Packet System**: Efficient binary protocol using msgpackr
 * - **Reconnection**: Automatic reconnect with exponential backoff
 * - **Ping/Latency**: Round-trip time measurement
 * - **Buffering**: Handles network jitter and packet loss
 * - **Compression**: Optional packet compression for low bandwidth
 * 
 * Network Architecture:
 * - Server is authoritative for all game state
 * - Client receives snapshots at 8Hz (every 125ms)
 * - Client interpolates between snapshots for smooth 60 FPS
 * - Client sends input at 30Hz for responsive controls
 * - Server validates all client actions
 * 
 * Packet Types:
 * - **init**: Initial connection setup
 * - **snapshot**: World state update from server
 * - **entityAdded**: New entity spawned
 * - **entityModified**: Entity state changed
 * - **entityRemoved**: Entity destroyed
 * - **chatMessage**: Text chat from players
 * - **input**: Player input commands
 * - **ping**: Latency measurement
 * 
 * Entity Interpolation:
 * - Maintains buffer of last 3 server snapshots
 * - Interpolates position/rotation between snapshots
 * - Compensates for network jitter
 * - Predicts movement for local player
 * - Server correction when prediction wrong
 * 
 * Latency Compensation:
 * - Measures round-trip time (RTT)
 * - Adjusts interpolation delay based on RTT
 * - Client-side prediction for local player
 * - Server rewind for hit detection
 * 
 * Connection States:
 * - Connecting: Initial WebSocket handshake
 * - Connected: Active connection, receiving packets
 * - Disconnected: Connection lost, attempting reconnect
 * - Error: Fatal error, manual reconnect required
 * 
 * Error Handling:
 * - Graceful disconnect on server shutdown
 * - Auto-reconnect on network interruption
 * - Packet validation and error recovery
 * - Session restoration on reconnect
 * 
 * Usage:
 * ```typescript
 * // Connect to server
 * await world.network.connect('wss://server.com/ws');
 * 
 * // Send chat message
 * world.network.sendChat('Hello world!');
 * 
 * // Get current latency
 * const ping = world.network.getPing();
 * 
 * // Handle disconnection
 * world.network.on('disconnected', () => {
 *   console.log('Lost connection to server');
 * });
 * ```
 * 
 * Related Systems:
 * - ServerNetwork: Server-side counterpart
 * - Entities: Manages replicated entities
 * - PlayerLocal: Sends input to server
 * - ClientInput: Captures player actions
 * 
 * Dependencies:
 * - WebSocket API (browser native)
 * - msgpackr: Binary serialization
 * - EventBus: System events
 * 
 * @see packets.ts for packet format
 * @see ServerNetwork.ts for server implementation
 */

// moment removed; use native Date
import { emoteUrls } from '../extras/playerEmotes'
import THREE from '../extras/three'
import { readPacket, writePacket } from '../packets'
import { storage } from '../storage'
import type { ChatMessage, EntityData, SnapshotData, World, WorldOptions } from '../types'
import type { Entity } from '../entities/Entity'
import { EventType } from '../types/events'
import { uuid } from '../utils'
import { SystemBase } from './SystemBase'
import { PlayerLocal } from '../entities/PlayerLocal'

const _v3_1 = new THREE.Vector3()
const _quat_1 = new THREE.Quaternion()

/**
 * Entity interpolation state for smooth remote entity movement
 */
interface EntitySnapshot {
  position: Float32Array;
  rotation: Float32Array;
  timestamp: number;
}

/**
 * Tracks interpolation state for each remote entity
 */
interface InterpolationState {
  entityId: string;
  snapshots: EntitySnapshot[];
  snapshotIndex: number;
  snapshotCount: number;
  currentPosition: THREE.Vector3;
  currentRotation: THREE.Quaternion;
  tempPosition: THREE.Vector3;
  tempRotation: THREE.Quaternion;
  lastUpdate: number;
}

// SnapshotData interface moved to shared types

/**
 * Client Network System
 * 
 * Manages connection to game server and entity synchronization.
 * Runs only on client (browser).
 * 
 * - runs on the client
 * - provides abstract network methods matching ServerNetwork
 *
 */
export class ClientNetwork extends SystemBase {
  ids: number
  ws: WebSocket | null
  apiUrl: string | null
  id: string | null
  isClient: boolean
  isServer: boolean
  connected: boolean
  queue: Array<[string, unknown]>
  serverTimeOffset: number
  maxUploadSize: number
  pendingModifications: Map<string, Array<Record<string, unknown>>> = new Map()
  pendingModificationTimestamps: Map<string, number> = new Map() // Track when modifications were first queued
  pendingModificationLimitReached: Set<string> = new Set() // Track entities that hit the limit (to avoid log spam)
  destroyedEntities: Set<string> = new Set() // Track entities that have been destroyed
  // Cache character list so UI can render even if it mounts after the packet arrives
  lastCharacterList: Array<{ id: string; name: string; level?: number; lastLocation?: { x: number; y: number; z: number } }> | null = null
  // Cache latest inventory per player so UI can hydrate even if it mounted late
  lastInventoryByPlayerId: Record<string, { playerId: string; items: Array<{ slot: number; itemId: string; quantity: number }>; coins: number; maxSlots: number }> = {}
  // Cache latest skills per player so UI can hydrate even if it mounted late
  lastSkillsByPlayerId: Record<string, Record<string, { level: number; xp: number }>> = {}
  
  // Entity interpolation for smooth remote entity movement
  private interpolationStates: Map<string, InterpolationState> = new Map()
  private interpolationDelay: number = 100 // ms
  private maxSnapshots: number = 10
  private extrapolationLimit: number = 500 // ms
  
  constructor(world: World) {
    super(world, { name: 'client-network', dependencies: { required: [], optional: [] }, autoCleanup: true })
    this.ids = -1
    this.ws = null
    this.apiUrl = null
    this.id = null
    this.isClient = true
    this.isServer = false
    this.connected = false
    this.queue = []
    this.serverTimeOffset = 0
    this.maxUploadSize = 0
  }

  async init(options: WorldOptions): Promise<void> {
    const wsUrl = (options as { wsUrl?: string }).wsUrl

    this.logger.debug(`init() called with wsUrl: ${wsUrl}`)
    this.logger.debug('Current WebSocket state', {
      hasExistingWs: !!this.ws,
      existingReadyState: this.ws?.readyState,
      connected: this.connected,
      id: this.id,
      initialized: this.initialized
    } as unknown as Record<string, unknown>)
    
    const name = (options as { name?: string }).name
    const avatar = (options as { avatar?: string }).avatar
    
    if (!wsUrl) {
      console.error('[ClientNetwork] No WebSocket URL provided!')
      return
    }
    
    // CRITICAL: If we already have a WORKING WebSocket, don't recreate
    // But if it's closed or closing, we need to reconnect
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
      this.logger.debug('WebSocket already connected and working, skipping init')
      this.initialized = true;
      return;
    }
    
    // Clean up any existing WebSocket (closed, closing, or connecting but failed)
    if (this.ws) {
      this.logger.debug(`Cleaning up old WebSocket (state: ${this.ws.readyState})`)
      try {
        this.ws.removeEventListener('message', this.onPacket);
        this.ws.removeEventListener('close', this.onClose);
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch (e) {
        this.logger.debug('Error cleaning up old WebSocket')
      }
      this.ws = null;
      this.connected = false;
      this.id = null;
    }
    
    // Try to get Privy token first, fall back to legacy auth token
    let authToken = ''
    let privyUserId = ''
    
    if (typeof localStorage !== 'undefined') {
      const privyToken = localStorage.getItem('privy_auth_token')
      const privyId = localStorage.getItem('privy_user_id')
      
      if (privyToken && privyId) {
        authToken = privyToken
        privyUserId = privyId
      } else {
        // Fall back to legacy auth token
        // Strong type assumption - storage.get returns unknown, we expect string
        const legacyToken = storage?.get('authToken')
        authToken = (legacyToken as string) || ''
      }
    }
    
    let url = `${wsUrl}?authToken=${authToken}`
    if (privyUserId) url += `&privyUserId=${encodeURIComponent(privyUserId)}`
    if (name) url += `&name=${encodeURIComponent(name)}`
    if (avatar) url += `&avatar=${encodeURIComponent(avatar)}`
    
    // console.debug('[ClientNetwork] Connecting to WebSocket:', url)
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)
      this.ws.binaryType = 'arraybuffer'
      
      const timeout = setTimeout(() => {
        this.logger.warn('WebSocket connection timeout')
        reject(new Error('WebSocket connection timeout'))
      }, 10000)
      
      this.ws.addEventListener('open', () => {
        this.logger.debug('WebSocket connected successfully')
        this.connected = true
        this.initialized = true
        clearTimeout(timeout)
        resolve()
      })
      
      this.ws.addEventListener('message', this.onPacket)
      this.ws.addEventListener('close', this.onClose)
      
      this.ws.addEventListener('error', (e) => {
        clearTimeout(timeout)
        const isExpectedDisconnect = this.ws?.readyState === WebSocket.CLOSED || this.ws?.readyState === WebSocket.CLOSING
        if (!isExpectedDisconnect) {
          this.logger.error('WebSocket error', e instanceof Error ? e : undefined)
          this.logger.error(`WebSocket error: ${e instanceof ErrorEvent ? e.message : String(e)}`)
          reject(e)
        }
      })
    })
  }

  preFixedUpdate() {
    this.flush()
    
    // Periodically clean up stale pending modifications (every ~5 seconds at 60fps = ~300 frames)
    // Only check occasionally to avoid performance impact
    if (Math.random() < 0.003) {
      this.cleanupStalePendingModifications()
    }
  }
  
  /**
   * Clean up pending modifications that are too old (entity never arrived)
   */
  private cleanupStalePendingModifications(): void {
    const now = performance.now()
    const staleTimeout = 10000 // 10 seconds
    
    for (const [entityId, timestamp] of this.pendingModificationTimestamps.entries()) {
      const age = now - timestamp
      if (age > staleTimeout) {
        const count = this.pendingModifications.get(entityId)?.length || 0
        // Silent cleanup to avoid log spam
        this.pendingModifications.delete(entityId)
        this.pendingModificationTimestamps.delete(entityId)
        this.pendingModificationLimitReached.delete(entityId)
      }
    }
  }

  send<T = unknown>(name: string, data?: T) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // console.debug(`[ClientNetwork] Sending packet: ${name}`, data)
      const packet = writePacket(name, data)
      this.ws.send(packet)
    } else {
      console.warn(`[ClientNetwork] Cannot send ${name} - WebSocket not open. State:`, {
        hasWs: !!this.ws,
        readyState: this.ws?.readyState,
        connected: this.connected,
        id: this.id
      });
    }
  }

  enqueue(method: string, data: unknown) {
    this.queue.push([method, data])
  }

  async flush() {
    // Don't process queue if WebSocket is not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    while (this.queue.length) {
      const [method, data] = this.queue.shift()!;
      // Support both direct method names (snapshot) and onX handlers (onSnapshot)
      let handler: unknown = (this as Record<string, unknown>)[method];
      if (!handler) {
        const onName = `on${method.charAt(0).toUpperCase()}${method.slice(1)}`;
        handler = (this as Record<string, unknown>)[onName];
      }
      if (!handler) {
        throw new Error(`No handler for packet '${method}'`);
      }
      // Strong type assumption - handler is a function
      const result = (handler as Function).call(this, data);
      if (result instanceof Promise) {
        await result;
      }
    }
  }

  getTime() {
    return (performance.now() + this.serverTimeOffset) / 1000 // seconds
  }

  onPacket = (e: MessageEvent) => {
    const result = readPacket(e.data)
    if (result && result[0]) {
      const [method, data] = result
      this.enqueue(method, data)
    }
  }

  async onSnapshot(data: SnapshotData) {
    this.id = data.id;  // Store our network ID
    this.connected = true;  // Mark as connected when we get the snapshot
    
    // CRITICAL: Ensure world.network points to this instance and has our ID
    if (!this.world.network || (this.world.network as { id?: string }).id !== this.id) {
      (this.world as { network?: unknown }).network = this;
    }
    
    // Auto-enter world if in character-select mode and we have a selected character
    const isCharacterSelectMode = Array.isArray(data.entities) && data.entities.length === 0 && Array.isArray((data as { characters?: unknown[] }).characters);
    
    this.logger.debug('Snapshot received - checking character select mode')
    
    if (isCharacterSelectMode && typeof localStorage !== 'undefined') {
      const selectedCharacterId = localStorage.getItem('selectedCharacterId');
      this.logger.debug('Selected character ID found in localStorage')
      
      if (selectedCharacterId) {
        // Send enterWorld immediately so server spawns the selected character
        this.logger.debug('Sending enterWorld with selected characterId')
        this.send('enterWorld', { characterId: selectedCharacterId });
      } else {
        this.logger.debug('No selectedCharacterId in localStorage, cannot auto-enter world')
      }
    }
    // Ensure Physics is fully initialized before processing entities
    // This is needed because PlayerLocal uses physics extensions during construction
    if (!this.world.physics.physics) {
      // Wait a bit for Physics to initialize
      let attempts = 0
      while (!this.world.physics.physics && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 10))
        attempts++
      }
      if (!this.world.physics.physics) {
        this.logger.error('Physics failed to initialize after waiting')
      }
    }
    
    // Already set above
    this.serverTimeOffset = data.serverTime - performance.now()
    this.apiUrl = data.apiUrl || null
    this.maxUploadSize = data.maxUploadSize || 10 * 1024 * 1024 // Default 10MB
    
    // Use assetsUrl from server (always absolute URL to CDN)
    this.world.assetsUrl = data.assetsUrl || '/'

    const loader = this.world.loader!
      // Assume preload and execPreload methods exist on loader
      // preload environment model and avatar
      if (loader) {
        if (data.settings && typeof data.settings === 'object' && 'model' in data.settings) {
          const settings = data.settings as { model?: string };
          if (settings?.model) {
            loader.preload('model', settings.model);
          }
        } else if (this.world.environment?.base?.model) {
          loader.preload('model', this.world.environment.base.model);
        }
        if (data.settings && typeof data.settings === 'object' && 'avatar' in data.settings) {
          const settings = data.settings as { avatar?: { url?: string } };
          if (settings?.avatar?.url) {
            loader.preload('avatar', settings.avatar.url);
          }
        }
        // preload emotes
        for (const url of emoteUrls) {
          loader.preload('emote', url as string)
        }
        // We'll preload local player avatar after entities are deserialized
    }

    // Deserialize settings if method exists
    if (data.settings) {
      this.world.settings.deserialize(data.settings);
    }

    if (data.chat) {
      this.world.chat.deserialize(data.chat);
    }
    // Deserialize entities if method exists
    if (data.entities) {
      await this.world.entities.deserialize(data.entities)
      
      // Now preload local player avatar after entities are created
      if (loader) {
        let playerAvatarPreloaded = false
        for (const entity of this.world.entities.values()) {
          if (entity.data?.type === 'player' && entity.data?.owner === this.id) {
            const url = entity.data.sessionAvatar || entity.data.avatar
            if (url) {
              loader.preload('avatar', url)
              playerAvatarPreloaded = true
              break
            }
          }
        }
        if (!playerAvatarPreloaded) {
          // Try from the raw data if entity iteration didn't work
          for (const item of data.entities) {
            const entity = item as { type?: string; owner?: string; sessionAvatar?: string; avatar?: string }
            if (entity.type === 'player' && entity.owner === this.id) {
              const url = entity.sessionAvatar || entity.avatar
              if (url) {
                loader.preload('avatar', url)
                playerAvatarPreloaded = true
                break
              }
            }
          }
        }
        // Now execute preload after all assets are queued
        loader.execPreload()
      }
      
      // Set initial serverPosition for local player immediately to avoid Y=0 flash
      for (const entityData of data.entities) {
        if (entityData && entityData.type === 'player' && entityData.owner === this.id) {
          const local = this.world.entities.get(entityData.id);
          if (local instanceof PlayerLocal) {
            // Force the position immediately
            const pos = entityData.position as [number, number, number]
            local.position.set(pos[0], pos[1], pos[2])

            // Also update server position for reconciliation
            local.updateServerPosition(pos[0], pos[1], pos[2])
          } else {
          this.logger.warn('Local player entity not found after deserialize!')
          }
        }
      }
      // Apply pending modifications to all newly added entities
      for (const entityData of data.entities) {
        if (entityData && entityData.id) {
          this.applyPendingModifications(entityData.id)
        }
      }
    }

    // Character-select mode: if server sent an empty entity list with account info,
    // surface the character list/modal immediately even if the dedicated packet hasn't arrived yet.
    if (Array.isArray(data.entities) && data.entities.length === 0 && (data as { account?: unknown }).account) {
      const list = this.lastCharacterList || [];
      this.world.emit(EventType.CHARACTER_LIST, { characters: list });
    }

    if (data.livekit) {
      this.world.livekit?.deserialize(data.livekit);
    }
      
    storage?.set('authToken', data.authToken)
  }

  onSettingsModified = (data: { key: string; value: unknown }) => {
    this.world.settings.set(data.key, data.value)
  }

  onChatAdded = (msg: ChatMessage) => {
    // Add message to chat if method exists
    this.world.chat.add(msg, false);
  }

  onChatCleared = () => {
    // Clear chat if method exists
    this.world.chat.clear();
  }

  onEntityAdded = (data: EntityData) => {    
    // Add entity if method exists
    const newEntity = this.world.entities.add(data)
    if (newEntity) {
      this.applyPendingModifications(newEntity.id)
      // If this is the local player added after character select, force-set initial position
      const isLocalPlayer = (data as { type?: string; owner?: string }).type === 'player' && (data as { owner?: string }).owner === this.id;
      if (isLocalPlayer && Array.isArray((data as { position?: number[] }).position)) {
        let pos = (data as { position?: number[] }).position as [number, number, number];
        // Safety clamp: never allow Y < 5 to prevent under-map spawn
        if (pos[1] < 5) {
          pos = [pos[0], 50, pos[2]];
        }
        if (newEntity instanceof PlayerLocal) {
          newEntity.position.set(pos[0], pos[1], pos[2]);
          newEntity.updateServerPosition(pos[0], pos[1], pos[2]);
        }
      }
    }
  }

  onEntityRemoved = (data: { id: string }) => {
    const { id } = data
    // Mark entity as destroyed to prevent future modifications
    this.destroyedEntities.add(id)
    
    // Remove from interpolation tracking
    this.interpolationStates.delete(id)
    
    // Clean up any pending modifications for this entity
    this.pendingModifications.delete(id)
    this.pendingModificationTimestamps.delete(id)
    this.pendingModificationLimitReached.delete(id)
    
    // Remove from entities system
    this.world.entities.remove(id)
    
    this.logger.debug(`Entity ${id} marked as destroyed`)
    
    // Clean up destroyed entities set periodically to prevent memory leaks
    // Keep only entities destroyed in the last 30 seconds
    const now = performance.now()
    const maxAge = 30000 // 30 seconds
    for (const entityId of this.destroyedEntities) {
      // We don't track timestamps for destroyed entities, so we'll clean up
      // when the set gets too large (more than 1000 entities)
      if (this.destroyedEntities.size > 1000) {
        this.destroyedEntities.clear()
        this.logger.debug('Cleared destroyed entities set to prevent memory leak')
        break
      }
    }
  }

  onEntityModified = (data: { id: string; changes?: Record<string, unknown> } & Record<string, unknown>) => {
    const { id } = data
    const entity = this.world.entities.get(id)
    if (!entity) {
      // Check if this entity was previously destroyed
      if (this.destroyedEntities.has(id)) {
        // Entity was destroyed, ignore modifications
        this.logger.debug(`Ignoring modification for destroyed entity ${id}`)
        return
      }
      
      // Limit queued modifications per entity to avoid unbounded growth
      const list = this.pendingModifications.get(id) || []
      const now = performance.now()
      
      // Check if modifications are too old (>10 seconds) and drop them
      if (list.length > 0) {
        const firstTimestamp = this.pendingModificationTimestamps.get(id) || now
        const age = now - firstTimestamp
        if (age > 10000) {
          // Entity never arrived, clear the stale modifications (silent)
          this.pendingModifications.delete(id)
          this.pendingModificationTimestamps.delete(id)
          this.pendingModificationLimitReached.delete(id)
          return
        }
      }
      
      if (list.length < 50) {
        list.push(data)
        this.pendingModifications.set(id, list)
        
        // Track timestamp of first modification
        if (list.length === 1) {
          this.pendingModificationTimestamps.set(id, now)
          // Silence first-queue log to avoid spam
        }
      } else if (!this.pendingModificationLimitReached.has(id)) {
        // Mark once then stop logging to avoid spam
        this.pendingModificationLimitReached.add(id)
      }
      // No more logging after limit is reached to prevent spam
      return
    }
    // Accept both normalized { changes: {...} } and flat payloads { id, ...changes }
    const changes =
      data.changes ?? Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'id' && k !== 'changes'))
    
    // Check if this is the local player
    const isLocal = (() => {
      const localEntityId = this.world.entities.player?.id
      if (localEntityId && id === localEntityId) return true
      const ownerId = (entity as { data?: { owner?: string } }).data?.owner
      return !!(this.id && ownerId && ownerId === this.id)
    })()
    
    const hasP = Object.prototype.hasOwnProperty.call(changes, 'p')
    const hasV = Object.prototype.hasOwnProperty.call(changes, 'v')
    const hasQ = Object.prototype.hasOwnProperty.call(changes, 'q')
    
    if (isLocal && (hasP || hasV || hasQ)) {
      // Local player - apply directly through entity.modify()
      entity.modify(changes);
    } else {
      // Remote entities - use interpolation for smooth movement
      if (hasP) {
        this.addInterpolationSnapshot(id, changes as { p?: [number, number, number]; q?: [number, number, number, number]; v?: [number, number, number] })
      }
      // Still apply non-transform changes immediately
      entity.modify(changes)
    }

    // Re-emit normalized change event so other systems can react
    this.world.emit(EventType.ENTITY_MODIFIED, { id, changes })
  }
  
  /**
   * Add snapshot for entity interpolation (client-side only, remote entities only)
   */
  private addInterpolationSnapshot(entityId: string, changes: {
    p?: [number, number, number];
    q?: [number, number, number, number];
    v?: [number, number, number];
  }): void {
    let state = this.interpolationStates.get(entityId)
    if (!state) {
      state = this.createInterpolationState(entityId)
      this.interpolationStates.set(entityId, state)
    }
    
    const snapshot = state.snapshots[state.snapshotIndex]
    
    if (changes.p) {
      snapshot.position[0] = changes.p[0]
      snapshot.position[1] = changes.p[1]
      snapshot.position[2] = changes.p[2]
    }
    
    if (changes.q) {
      snapshot.rotation[0] = changes.q[0]
      snapshot.rotation[1] = changes.q[1]
      snapshot.rotation[2] = changes.q[2]
      snapshot.rotation[3] = changes.q[3]
    } else {
      snapshot.rotation[0] = state.currentRotation.x
      snapshot.rotation[1] = state.currentRotation.y
      snapshot.rotation[2] = state.currentRotation.z
      snapshot.rotation[3] = state.currentRotation.w
    }
    
    snapshot.timestamp = performance.now()
    state.snapshotIndex = (state.snapshotIndex + 1) % this.maxSnapshots
    state.snapshotCount = Math.min(state.snapshotCount + 1, this.maxSnapshots)
    state.lastUpdate = performance.now()
  }
  
  /**
   * Create interpolation state with pre-allocated buffers
   */
  private createInterpolationState(entityId: string): InterpolationState {
    const entity = this.world.entities.get(entityId)
    const position = entity && 'position' in entity ?
      (entity.position as THREE.Vector3).clone() :
      new THREE.Vector3()
    
    const rotation = entity?.node?.quaternion ?
      entity.node.quaternion.clone() :
      new THREE.Quaternion()
    
    const snapshots: EntitySnapshot[] = []
    for (let i = 0; i < this.maxSnapshots; i++) {
      snapshots.push({
        position: new Float32Array(3),
        rotation: new Float32Array(4),
        timestamp: 0
      })
    }
    
    return {
      entityId,
      snapshots,
      snapshotIndex: 0,
      snapshotCount: 0,
      currentPosition: position,
      currentRotation: rotation,
      tempPosition: new THREE.Vector3(),
      tempRotation: new THREE.Quaternion(),
      lastUpdate: performance.now()
    }
  }
  
  /**
   * Update interpolation for remote entities (called in lateUpdate)
   */
  private updateInterpolation(delta: number): void {
    const now = performance.now()
    const renderTime = now - this.interpolationDelay
    
    for (const [entityId, state] of this.interpolationStates) {
      // Skip local player
      if (entityId === this.world.entities.player?.id) {
        this.interpolationStates.delete(entityId)
        continue
      }
      
      const entity = this.world.entities.get(entityId)
      if (!entity) {
        this.interpolationStates.delete(entityId)
        continue
      }
      
      this.interpolateEntityPosition(entity, state, renderTime, now, delta)
    }
  }
  
  /**
   * Interpolate entity position for smooth movement
   */
  private interpolateEntityPosition(
    entity: Entity,
    state: InterpolationState,
    renderTime: number,
    now: number,
    delta: number
  ): void {
    if (state.snapshotCount < 2) {
      if (state.snapshotCount === 1) {
        const snapshot = state.snapshots[0]
        state.tempPosition.set(snapshot.position[0], snapshot.position[1], snapshot.position[2])
        state.tempRotation.set(snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2], snapshot.rotation[3])
        this.applyInterpolated(entity, state.tempPosition, state.tempRotation, state, delta)
      }
      return
    }
    
    // Find two snapshots to interpolate between
    let older: EntitySnapshot | null = null
    let newer: EntitySnapshot | null = null
    
    for (let i = 0; i < state.snapshotCount - 1; i++) {
      const curr = state.snapshots[i]
      const next = state.snapshots[(i + 1) % this.maxSnapshots]
      
      if (curr.timestamp <= renderTime && next.timestamp >= renderTime) {
        older = curr
        newer = next
        break
      }
    }
    
    if (older && newer) {
      const t = (renderTime - older.timestamp) / (newer.timestamp - older.timestamp)
      
      state.tempPosition.set(
        older.position[0] + (newer.position[0] - older.position[0]) * t,
        older.position[1] + (newer.position[1] - older.position[1]) * t,
        older.position[2] + (newer.position[2] - older.position[2]) * t
      )
      
      state.tempRotation.set(
        older.rotation[0] + (newer.rotation[0] - older.rotation[0]) * t,
        older.rotation[1] + (newer.rotation[1] - older.rotation[1]) * t,
        older.rotation[2] + (newer.rotation[2] - older.rotation[2]) * t,
        older.rotation[3] + (newer.rotation[3] - older.rotation[3]) * t
      ).normalize()
      
      this.applyInterpolated(entity, state.tempPosition, state.tempRotation, state, delta)
    } else {
      // Use most recent snapshot
      const timeSinceUpdate = now - state.lastUpdate
      if (timeSinceUpdate < this.extrapolationLimit) {
        const lastIndex = (state.snapshotIndex - 1 + this.maxSnapshots) % this.maxSnapshots
        const last = state.snapshots[lastIndex]
        state.tempPosition.set(last.position[0], last.position[1], last.position[2])
        state.tempRotation.set(last.rotation[0], last.rotation[1], last.rotation[2], last.rotation[3])
        this.applyInterpolated(entity, state.tempPosition, state.tempRotation, state, delta)
      }
    }
  }
  
  /**
   * Apply interpolated values to entity
   */
  private applyInterpolated(
    entity: Entity,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    state: InterpolationState,
    delta: number
  ): void {
    const smoothingRate = 5.0
    const smoothingFactor = 1.0 - Math.exp(-smoothingRate * delta)
    
    state.currentPosition.lerp(position, smoothingFactor)
    state.currentRotation.slerp(rotation, smoothingFactor)
    
    if ('position' in entity) {
      const entityPos = entity.position as THREE.Vector3
      entityPos.copy(state.currentPosition)
    }
    
    if (entity.node) {
      entity.node.position.copy(state.currentPosition)
      entity.node.quaternion.copy(state.currentRotation)
    }
    
    const player = entity as Entity & { base?: { position: THREE.Vector3; quaternion: THREE.Quaternion } }
    if (player.base) {
      player.base.position.copy(state.currentPosition)
      player.base.quaternion.copy(state.currentRotation)
    }
  }

  onEntityEvent = (event: { id: string; version: number; name: string; data?: unknown }) => {
    const { id, version, name, data } = event
    // If event is broadcast world event, re-emit on world so systems can react
    if (id === 'world') {
      this.world.emit(name, data)
      return
    }
    const entity = this.world.entities.get(id)
    if (!entity) return
    // Trigger entity event if method exists
    entity.onEvent(version, name, data, this.id || '');
  }

  // Dedicated resource packet handlers
  onResourceSnapshot = (data: { resources: Array<{ id: string; type: string; position: { x: number; y: number; z: number }; isAvailable: boolean; respawnAt?: number }> }) => {
    for (const r of data.resources) {
      this.world.emit(EventType.RESOURCE_SPAWNED, { id: r.id, type: r.type, position: r.position })
      if (!r.isAvailable) this.world.emit(EventType.RESOURCE_DEPLETED, { resourceId: r.id, position: r.position })
    }
  }
  onResourceSpawnPoints = (data: { spawnPoints: Array<{ id: string; type: string; position: { x: number; y: number; z: number } }> }) => {
    this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, data)
  }
  onResourceSpawned = (data: { id: string; type: string; position: { x: number; y: number; z: number } }) => {
    this.world.emit(EventType.RESOURCE_SPAWNED, data)
  }
  onResourceDepleted = (data: { resourceId: string; position?: { x: number; y: number; z: number }; depleted?: boolean }) => {
    console.log('[ClientNetwork] 🪵 Resource depleted:', data.resourceId);
    
    // Update the ResourceEntity visual
    const entity = this.world.entities.get(data.resourceId);
    if (entity && typeof (entity as unknown as { updateFromNetwork?: (data: Record<string, unknown>) => void }).updateFromNetwork === 'function') {
      (entity as unknown as { updateFromNetwork: (data: Record<string, unknown>) => void }).updateFromNetwork({ depleted: true });
    }
    
    // Also emit the event for other systems
    this.world.emit(EventType.RESOURCE_DEPLETED, data)
  }
  
  onResourceRespawned = (data: { resourceId: string; position?: { x: number; y: number; z: number }; depleted?: boolean }) => {
    console.log('[ClientNetwork] 🌳 Resource respawned:', data.resourceId);
    
    // Update the ResourceEntity visual
    const entity = this.world.entities.get(data.resourceId);
    if (entity && typeof (entity as unknown as { updateFromNetwork?: (data: Record<string, unknown>) => void }).updateFromNetwork === 'function') {
      (entity as unknown as { updateFromNetwork: (data: Record<string, unknown>) => void }).updateFromNetwork({ depleted: false });
    }
    
    // Also emit the event for other systems
    this.world.emit(EventType.RESOURCE_RESPAWNED, data)
  }

  onInventoryUpdated = (data: { playerId: string; items: Array<{ slot: number; itemId: string; quantity: number }>; coins: number; maxSlots: number }) => {
    type WindowWithDebug = { DEBUG_RPG?: string }
    if ((window as WindowWithDebug).DEBUG_RPG === '1' || process.env?.DEBUG_RPG === '1') {
    }
    // Cache latest snapshot for late-mounting UI
    this.lastInventoryByPlayerId[data.playerId] = data
    // Re-emit with typed event so UI updates without waiting for local add
    this.world.emit(EventType.INVENTORY_UPDATED, data)
  }

  onSkillsUpdated = (data: { playerId: string; skills: Record<string, { level: number; xp: number }> }) => {
    // Cache latest snapshot for late-mounting UI
    this.lastSkillsByPlayerId = this.lastSkillsByPlayerId || {}
    this.lastSkillsByPlayerId[data.playerId] = data.skills
    // Re-emit with typed event so UI updates
    this.world.emit(EventType.SKILLS_UPDATED, data)
  }

  // --- Character selection (flag-gated by server) ---
  onCharacterList = (data: { characters: Array<{ id: string; name: string; level?: number; lastLocation?: { x: number; y: number; z: number } }> }) => {
    // Cache and re-emit so UI can show the modal
    this.lastCharacterList = data.characters || [];
    this.world.emit(EventType.CHARACTER_LIST, data);
    // Auto-select previously chosen character if available
    const storedId = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedCharacterId') : null;
    if (storedId && Array.isArray(data.characters) && data.characters.some(c => c.id === storedId)) {
      this.requestCharacterSelect(storedId);
    }
  }
  onCharacterCreated = (data: { id: string; name: string }) => {
    // Re-emit for UI to update lists
    this.world.emit(EventType.CHARACTER_CREATED, data)
  }
  onCharacterSelected = (data: { characterId: string | null }) => {
    this.world.emit(EventType.CHARACTER_SELECTED, data)
  }

  // Convenience methods
  requestCharacterCreate(name: string) {
    this.send('characterCreate', { name })
  }
  requestCharacterSelect(characterId: string) {
    this.send('characterSelected', { characterId })
  }
  requestEnterWorld() {
    this.send('enterWorld', {})
  }

  // Inventory actions
  dropItem(itemId: string, slot?: number, quantity?: number) {
    this.send('dropItem', { itemId, slot, quantity })
  }
  
  /**
   * Update interpolation in lateUpdate (after entity updates)
   */
  lateUpdate(delta: number): void {
    this.updateInterpolation(delta)
  }
  
  onGatheringComplete = (data: { playerId: string; resourceId: string; successful: boolean }) => {
    
    // Forward to local event system for UI updates (progress bar, animation)
    this.world.emit(EventType.RESOURCE_GATHERING_COMPLETED, {
      playerId: data.playerId,
      resourceId: data.resourceId,
      successful: data.successful,
      skill: 'woodcutting' // Will be refined later
    });
  }
  
  onPlayerState = (data: unknown) => {
    // Forward player state updates from server to local UI_UPDATE event
    const playerData = data as { playerId?: string; skills?: Record<string, { level: number; xp: number }> };
    
    // Cache skills if provided
    if (playerData.playerId && playerData.skills) {
      this.lastSkillsByPlayerId = this.lastSkillsByPlayerId || {}
      this.lastSkillsByPlayerId[playerData.playerId] = playerData.skills
    }
    
    this.world.emit(EventType.UI_UPDATE, {
      component: 'player',
      data: data
    });
  }
  
  onShowToast = (data: { playerId: string; message: string; type: string }) => {
    
    // Only show toast for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system for toast display
      this.world.emit(EventType.UI_TOAST, {
        message: data.message,
        type: data.type
      });
    }
  }

  // ======================== TRADING SYSTEM HANDLERS ========================

  onTradeRequest = (data: { tradeId: string; fromPlayerId: string; fromPlayerName: string }) => {
    console.log('[ClientNetwork] 📨 Received trade request from:', data.fromPlayerName);
    
    // Emit event for UI to show trade request modal
    this.world.emit(EventType.TRADE_REQUEST_RECEIVED, {
      tradeId: data.tradeId,
      fromPlayerId: data.fromPlayerId,
      fromPlayerName: data.fromPlayerName
    });
  }

  onTradeStarted = (data: { tradeId: string; initiatorId: string; initiatorName: string; recipientId: string; recipientName: string }) => {
    console.log('[ClientNetwork] 🤝 Trade started:', data.tradeId);
    
    // Emit event for UI to open trade window
    this.world.emit(EventType.TRADE_STARTED, data);
  }

  onTradeUpdated = (data: {
    tradeId: string;
    initiatorOffer: { items: Array<{ itemId: string; quantity: number; slot: number }>; coins: number };
    recipientOffer: { items: Array<{ itemId: string; quantity: number; slot: number }>; coins: number };
    initiatorConfirmed: boolean;
    recipientConfirmed: boolean;
  }) => {
    console.log('[ClientNetwork] 🔄 Trade updated:', data.tradeId);
    
    // Emit event for UI to update trade window
    this.world.emit(EventType.TRADE_UPDATED, data);
  }

  onTradeCompleted = (data: { tradeId: string; message: string }) => {
    console.log('[ClientNetwork] ✅ Trade completed:', data.tradeId);
    
    // Emit event for UI to show success and close trade window
    this.world.emit(EventType.TRADE_COMPLETED, data);
    
    // Show success toast
    this.world.emit(EventType.UI_TOAST, {
      message: 'Trade completed successfully!',
      type: 'success'
    });
  }

  onTradeCancelled = (data: { tradeId: string; reason: string; byPlayerId?: string }) => {
    console.log('[ClientNetwork] ❌ Trade cancelled:', data.reason);
    
    // Emit event for UI to close trade window
    this.world.emit(EventType.TRADE_CANCELLED, data);
    
    // Show cancellation toast
    this.world.emit(EventType.UI_TOAST, {
      message: `Trade cancelled: ${data.reason}`,
      type: 'warning'
    });
  }

  onTradeError = (data: { message: string }) => {
    console.error('[ClientNetwork] ⚠️ Trade error:', data.message);
    
    // Emit event for UI to show error
    this.world.emit(EventType.TRADE_ERROR, data);
    
    // Show error toast
    this.world.emit(EventType.UI_TOAST, {
      message: data.message,
      type: 'error'
    });
  }

  // ======================== END TRADING HANDLERS ========================

  applyPendingModifications = (entityId: string) => {
    const pending = this.pendingModifications.get(entityId)
    if (pending && pending.length > 0) {
      this.logger.info(`Applying ${pending.length} pending modifications for entity ${entityId}`)
      pending.forEach(mod => this.onEntityModified({ ...mod, id: entityId }))
      
      // Clean up tracking structures
      this.pendingModifications.delete(entityId)
      this.pendingModificationTimestamps.delete(entityId)
      this.pendingModificationLimitReached.delete(entityId)
    }
  }

  onPlayerTeleport = (data: { playerId: string; position: [number, number, number] }) => {
    const player = this.world.entities.player
    if (player instanceof PlayerLocal) {
      const pos = _v3_1.set(data.position[0], data.position[1], data.position[2])
      player.teleport(pos)
    }
  }

  onPlayerPush = (data: { force: [number, number, number] }) => {
    const player = this.world.entities.player
    if (player instanceof PlayerLocal) {
      const force = _v3_1.set(data.force[0], data.force[1], data.force[2])
      player.push(force)
    }
  }

  onPlayerSessionAvatar = (data: { playerId: string; avatar: string }) => {
    const player = this.world.entities.player as { setSessionAvatar?: (url: string) => void }
    if (player?.setSessionAvatar) {
      player.setSessionAvatar(data.avatar)
    }
  }

  // Handle compressed updates (deprecated - compression disabled)
  onCompressedUpdate = (_packet: unknown) => {
    // Compression disabled - this handler is a no-op
  }

  onPong = (time: number) => {
    if (this.world.stats) {
      this.world.stats.onPong(time);
    }
  }

  onKick = (code: string) => {
    // Emit a typed UI event for kicks
    this.emitTypedEvent('UI_KICK', {
      playerId: this.id || 'unknown',
      reason: code || 'unknown',
    })
  }

  onClose = (code: CloseEvent) => {
    console.error('[ClientNetwork] 🔌 WebSocket CLOSED:', {
      code: code.code,
      reason: code.reason,
      wasClean: code.wasClean,
      currentId: this.id,
      stackTrace: new Error().stack
    });
    this.connected = false
    this.world.chat.add({
      id: uuid(),
      from: 'System',
      fromId: undefined,
      body: `You have been disconnected.`,
      text: `You have been disconnected.`,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    }, false)
    // Emit a typed network disconnect event
    this.emitTypedEvent('NETWORK_DISCONNECTED', {
      code: code.code,
      reason: code.reason || 'closed',
    })
  }

  destroy = () => {
    if (this.ws) {
      this.ws.removeEventListener('message', this.onPacket)
      this.ws.removeEventListener('close', this.onClose)
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
    // Clear any pending queue items
    this.queue.length = 0
    this.connected = false
    // Clear interpolation states
    this.interpolationStates.clear()
    // Clear pending modifications tracking
    this.pendingModifications.clear()
    this.pendingModificationTimestamps.clear()
    this.pendingModificationLimitReached.clear()
  }

  // Plugin-specific upload method
  async upload(file: File): Promise<string> {
    // For now, just return a placeholder URL
    // In a real implementation, this would upload the file to a server
    // console.debug('[ClientNetwork] Upload requested for file:', file.name, `(${file.size} bytes)`)
    return Promise.resolve(`uploaded-${Date.now()}-${file.name}`)
  }

  // Plugin-specific disconnect method
  async disconnect(): Promise<void> {
    // console.debug('[ClientNetwork] Disconnect called')
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
    return Promise.resolve()
  }
}

