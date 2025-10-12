// moment removed; use native Date
import { emoteUrls } from '../extras/playerEmotes'
import THREE from '../extras/three'
import { readPacket, writePacket } from '../packets'
import { storage } from '../storage'
import type { ChatMessage, EntityData, SnapshotData, World, WorldOptions } from '../types'
import { EventType } from '../types/events'
import { uuid } from '../utils'
import { SystemBase } from './SystemBase'
import { PlayerLocal } from '../entities/PlayerLocal'

const _v3_1 = new THREE.Vector3()
const _quat_1 = new THREE.Quaternion()

// SnapshotData interface moved to shared types

/**
 * Client Network System
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
  // Cache character list so UI can render even if it mounts after the packet arrives
  lastCharacterList: Array<{ id: string; name: string; level?: number; lastLocation?: { x: number; y: number; z: number } }> | null = null
  // Cache latest inventory per player so UI can hydrate even if it mounted late
  lastInventoryByPlayerId: Record<string, { playerId: string; items: Array<{ slot: number; itemId: string; quantity: number }>; coins: number; maxSlots: number }> = {}
  
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

    // log the call stack
    // console.debug('ClientNetwork wsUrl:', wsUrl)
    const name = (options as { name?: string }).name
    const avatar = (options as { avatar?: string }).avatar
    
    if (!wsUrl) {
      console.error('[ClientNetwork] No WebSocket URL provided!')
      return
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
        console.log('[ClientNetwork] Using Privy authentication')
      } else {
        // Fall back to legacy auth token
        const legacyToken = storage?.get('authToken')
        authToken = (typeof legacyToken === 'string' ? legacyToken : '') || ''
        console.log('[ClientNetwork] Using legacy authentication')
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
        console.error('[ClientNetwork] WebSocket connection timeout')
        reject(new Error('WebSocket connection timeout'))
      }, 10000)
      
      this.ws.addEventListener('open', () => {
        // console.debug('[ClientNetwork] WebSocket connected successfully')
        this.connected = true
        clearTimeout(timeout)
        resolve()
      })
      
      this.ws.addEventListener('message', this.onPacket)
      this.ws.addEventListener('close', this.onClose)
      
      this.ws.addEventListener('error', (e) => {
        clearTimeout(timeout)
        const isExpectedDisconnect = this.ws?.readyState === WebSocket.CLOSED || this.ws?.readyState === WebSocket.CLOSING
        if (!isExpectedDisconnect) {
          console.error('[ClientNetwork] WebSocket error:', e)
          this.logger.error(`WebSocket error: ${e instanceof ErrorEvent ? e.message : String(e)}`)
          reject(e)
        }
      })
    })
  }

  preFixedUpdate() {
    this.flush()
  }

  send<T = unknown>(name: string, data?: T) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // console.debug(`[ClientNetwork] Sending packet: ${name}`, data)
      const packet = writePacket(name, data)
      this.ws.send(packet)
    } else {
      console.warn(`[ClientNetwork] Cannot send ${name} - WebSocket not open`);
    }
  }

  enqueue(method: string, data: unknown) {
    this.queue.push([method, data])
  }

  async flush() {
    // Don't process queue if WebSocket is not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }
    
    while (this.queue.length) {
      try {
        const [method, data] = this.queue.shift()!
        // Support both direct method names (snapshot) and onX handlers (onSnapshot)
        let handler: unknown = (this as Record<string, unknown>)[method]
        if (!handler) {
          const onName = `on${method.charAt(0).toUpperCase()}${method.slice(1)}`
          handler = (this as Record<string, unknown>)[onName]
        }
        if (!handler) {
          this.logger.warn(`No handler for packet '${method}'`)
          continue
        }
        // Strong type assumption - handler is a function
        const result = (handler as Function).call(this, data)
        if (result instanceof Promise) {
          await result
        }
      } catch (err) {
        this.logger.error(`Error in flush: ${err instanceof Error ? err.message : String(err)}`)
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
    try {
      const snapshotData = data as unknown as { entities?: unknown[]; characters?: unknown[] }
      const isCharacterSelectMode = Array.isArray(snapshotData.entities) && snapshotData.entities.length === 0 && Array.isArray(snapshotData.characters)
      if (isCharacterSelectMode && typeof localStorage !== 'undefined') {
        const selectedCharacterId = localStorage.getItem('selectedCharacterId')
        if (selectedCharacterId) {
          console.log('[ClientNetwork] Auto-entering world with selected character:', selectedCharacterId)
          // Send enterWorld immediately so server spawns the selected character
          this.send('enterWorld', { characterId: selectedCharacterId })
        }
      }
    } catch {}
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
    this.world.assetsUrl = data.assetsUrl || '/world-assets/'

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
            console.error('[ClientNetwork] Local player entity not found after deserialize!')
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
    try {
      const anyData = data as unknown as { entities?: unknown[]; account?: unknown }
      if (Array.isArray(anyData.entities) && anyData.entities.length === 0 && anyData.account) {
        const list = this.lastCharacterList || []
        console.log('[ClientNetwork] Snapshot indicates character-select mode; opening modal with cached list:', list.length)
        this.world.emit('character:list', { characters: list })
      }
    } catch {}

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
      try {
        const isLocalPlayer = (data as { type?: string; owner?: string }).type === 'player' && (data as { owner?: string }).owner === this.id
        if (isLocalPlayer && Array.isArray((data as { position?: number[] }).position)) {
          let pos = (data as { position?: number[] }).position as [number, number, number]
          // Safety clamp: never allow Y < 5 to prevent under-map spawn
          if (pos[1] < 5) {
            console.warn(`[ClientNetwork] Clamping invalid spawn Y=${pos[1]} to safe height 50`)
            pos = [pos[0], 50, pos[2]]
          }
          if (newEntity instanceof PlayerLocal) {
            newEntity.position.set(pos[0], pos[1], pos[2])
            newEntity.updateServerPosition(pos[0], pos[1], pos[2])
            console.log(`[ClientNetwork] Local player spawned at:`, pos)
          }
        }
      } catch {}
    }
  }

  onEntityModified = (data: { id: string; changes?: Record<string, unknown> } & Record<string, unknown>) => {
    const { id } = data
    const entity = this.world.entities.get(id)
    if (!entity) {
      // Limit queued modifications per entity to avoid unbounded growth and spam
      const list = this.pendingModifications.get(id) || []
      if (list.length < 50) {
        list.push(data)
        this.pendingModifications.set(id, list)
      }
      const count = list.length
      if (count % 10 === 1) {
        // Log occasionally to reduce spam but keep visibility
        this.logger.info(`Queuing modification for entity ${id} - not found yet. queued=${count}`)
      }
      return
    }
    // Accept both normalized { changes: {...} } and flat payloads { id, ...changes }
    const changes =
      data.changes ?? Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'id' && k !== 'changes'))
    // If this is the local player: apply server authoritative corrections (snap/interpolate), not entity.modify(p/q)
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
      // For click-to-move, we need to apply ALL changes including emote
      // The server sends position, velocity, rotation, and animation state together
      
      // Simply apply ALL changes through modify() - it handles everything
      // No need for separate updateServerPosition/Velocity calls which cause judder
      entity.modify(changes);
      
      // Log for debugging
    } else {
      // Remote entities or non-transform updates on local
      entity.modify(changes)
    }

    // Re-emit normalized change event so interpolation/observers can react consistently
    // Always emit with canonical { id, changes } shape
    this.world.emit('entityModified', { id, changes })
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
      this.world.emit('resource:spawned', { id: r.id, type: r.type, position: r.position })
      if (!r.isAvailable) this.world.emit('resource:depleted', { resourceId: r.id, position: r.position })
    }
  }
  onResourceSpawnPoints = (data: { spawnPoints: Array<{ id: string; type: string; position: { x: number; y: number; z: number } }> }) => {
    this.world.emit('resource:spawn_points:registered', data)
  }
  onResourceSpawned = (data: { id: string; type: string; position: { x: number; y: number; z: number } }) => {
    this.world.emit('resource:spawned', data)
  }
  onResourceDepleted = (data: { resourceId: string; position?: { x: number; y: number; z: number } }) => {
    this.world.emit('resource:depleted', data)
  }
  onResourceRespawned = (data: { resourceId: string; position?: { x: number; y: number; z: number } }) => {
    this.world.emit('resource:respawned', data)
  }

  onInventoryUpdated = (data: { playerId: string; items: Array<{ slot: number; itemId: string; quantity: number }>; coins: number; maxSlots: number }) => {
    type WindowWithDebug = { DEBUG_RPG?: string }
    if ((window as WindowWithDebug).DEBUG_RPG === '1' || process.env?.DEBUG_RPG === '1') {
      console.log('[ClientNetwork] onInventoryUpdated received:', data.items.length, 'items for', data.playerId)
    }
    // Cache latest snapshot for late-mounting UI
    this.lastInventoryByPlayerId[data.playerId] = data
    // Re-emit with typed event so UI updates without waiting for local add
    this.world.emit('inventory:updated', data)
    this.world.emit(EventType.INVENTORY_UPDATED, data)
  }

  // --- Character selection (flag-gated by server) ---
  onCharacterList = (data: { characters: Array<{ id: string; name: string; level?: number; lastLocation?: { x: number; y: number; z: number } }> }) => {
    // Cache and re-emit so UI can show the modal
    this.lastCharacterList = data.characters || []
    try { console.log('[ClientNetwork] Received characterList:', (this.lastCharacterList || []).length) } catch {}
    this.world.emit('character:list', data)
    // Auto-select previously chosen character if available
    try {
      const storedId = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedCharacterId') : null
      if (storedId && Array.isArray(data.characters) && data.characters.some(c => c.id === storedId)) {
        this.requestCharacterSelect(storedId)
      }
    } catch {}
  }
  onCharacterCreated = (data: { id: string; name: string }) => {
    // Re-emit for UI to update lists
    this.world.emit('character:created', data)
  }
  onCharacterSelected = (data: { characterId: string | null }) => {
    this.world.emit('character:selected', data)
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

  onEntityRemoved = (id: string) => {
    // Strong type assumption - entities system has remove method
    this.world.entities.remove(id)
  }
  
  onGatheringComplete = (data: { playerId: string; resourceId: string; successful: boolean }) => {
    console.log(`[ClientNetwork] 📬 Received gatheringComplete from server:`, data);
    
    // Forward to local event system for UI updates (progress bar, animation)
    this.world.emit(EventType.RESOURCE_GATHERING_COMPLETED, {
      playerId: data.playerId,
      resourceId: data.resourceId,
      successful: data.successful,
      skill: 'woodcutting' // Will be refined later
    });
  }
  
  onShowToast = (data: { playerId: string; message: string; type: string }) => {
    console.log(`[ClientNetwork] 💬 Toast from server:`, data.message);
    
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

  applyPendingModifications = (entityId: string) => {
    const pending = this.pendingModifications.get(entityId)
    if (pending) {
      this.logger.info(`Applying ${pending.length} pending modifications for entity ${entityId}`)
      pending.forEach(mod => this.onEntityModified({ ...mod, id: entityId }))
      this.pendingModifications.delete(entityId)
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

  // Handle compressed updates routed through the network
  // Packets table maps 'compressedUpdate' -> method 'onCompressedUpdate'
  onCompressedUpdate = (packet: unknown) => {
    // Re-emit as a world event so the EntityInterpolationSystem can handle
    this.world.emit('compressedUpdate', packet)
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
    // console.debug('[ClientNetwork] WebSocket closed:', code.code, code.reason)
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
    console.log('[ClientNetwork] Destroying network connection...')
    if (this.ws) {
      console.log('[ClientNetwork] Closing WebSocket, state:', this.ws.readyState)
      this.ws.removeEventListener('message', this.onPacket)
      this.ws.removeEventListener('close', this.onClose)
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
        console.log('[ClientNetwork] WebSocket closed')
      }
      this.ws = null
    }
    // Clear any pending queue items
    this.queue.length = 0
    this.connected = false
    console.log('[ClientNetwork] Network destroyed')
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

