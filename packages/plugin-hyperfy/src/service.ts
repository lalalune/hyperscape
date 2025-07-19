import {
  createUniqueUuid,
  EventType,
  IAgentRuntime,
  logger,
  Service,
  type UUID
} from '@elizaos/core'
// import { createNodeClientWorld } from '@hyperscape/hyperfy'; // Not available
import { promises as fsPromises } from 'fs'
import path from 'path'
import { BehaviorManager } from './managers/behavior-manager.js'
import { BuildManager } from './managers/build-manager.js'
import { DynamicActionLoader } from './managers/dynamic-action-loader.js'
import { EmoteManager } from './managers/emote-manager.js'
import { MessageManager } from './managers/message-manager.js'
import { PuppeteerManager } from './managers/puppeteer-manager.js'
import { VoiceManager } from './managers/voice-manager.js'
import { loadPhysX } from './physx/loadPhysX.js'
import { AgentActions } from './systems/actions.js'
import { AgentControls } from './systems/controls.js'
import { EnvironmentSystem } from './systems/environment.js'
import { AgentLiveKit } from './systems/liveKit.js'
import { AgentLoader } from './systems/loader.js'
import type {
  World as HyperfyWorld
} from '@hyperscape/hyperfy'
import { getModuleDirectory, hashFileBuffer } from './utils.js'

const moduleDirPath = getModuleDirectory()
const LOCAL_AVATAR_PATH = `${moduleDirPath}/avatars/avatar.vrm`

const HYPERFY_WS_URL = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws'
const HYPERFY_APPEARANCE_POLL_INTERVAL = 30000

export class HyperfyService extends Service {
  static serviceName = 'hyperfy'
  serviceName = 'hyperfy'
  // @ts-ignore - Runtime property not properly typed in base class
  runtime: IAgentRuntime

  capabilityDescription = `
Hyperfy world integration service that enables agents to:
- Connect to 3D virtual worlds through WebSocket connections
- Navigate virtual environments and interact with objects
- Communicate with other users via chat and voice
- Perform gestures and emotes
- Build and modify world environments
- Share content and media within virtual spaces
- Manage multi-agent interactions in virtual environments
  `

  // Connection and world state
  private isServiceConnected = false
  private world: HyperfyWorld | null = null

  // @ts-ignore - Controls property not properly typed
  private controls: any = null

  // Manager components
  private puppeteerManager: PuppeteerManager | null = null
  private emoteManager: EmoteManager | null = null
  private messageManager: MessageManager | null = null
  private voiceManager: VoiceManager | null = null
  private behaviorManager: BehaviorManager | null = null
  private buildManager: BuildManager | null = null
  private dynamicActionLoader: DynamicActionLoader | null = null

  // Network state
  private maxRetries = 3
  private retryDelay = 5000
  private connectionTimeoutMs = 10000

  private _currentWorldId: UUID | null = null
  private lastMessageHash: string | null = null
  private appearanceRefreshInterval: NodeJS.Timeout | null = null
  private appearanceHash: string | null = null
  private connectionTime: number | null = null
  private multiAgentManager?: any
  private processedMsgIds: Set<string> = new Set()
  private playerNamesMap: Map<string, string> = new Map()
  private hasChangedName = false

  // UGC content support
  private loadedContent: Map<string, any> = new Map()

  public get currentWorldId(): UUID | null {
    return this._currentWorldId
  }

  public getWorld(): HyperfyWorld | null {
    return this.world
  }

  constructor(runtime: IAgentRuntime) {
    super()
    // @ts-ignore - Runtime property initialization
    this.runtime = runtime
    console.info('HyperfyService instance created')
  }

  /**
   * Start the Hyperfy service
   */
  static async start(runtime: IAgentRuntime): Promise<HyperfyService> {
    console.info('*** Starting Hyperfy service ***')
    const service = new HyperfyService(runtime)
    console.info(
      `Attempting automatic connection to default Hyperfy URL: ${HYPERFY_WS_URL}`
    )
    const defaultWorldId = createUniqueUuid(
      runtime,
      `${runtime.agentId}-default-hyperfy`
    ) as UUID
    const authToken: string | undefined = undefined

    service
      .connect({ wsUrl: HYPERFY_WS_URL, worldId: defaultWorldId, authToken })
      .then(() => console.info('Automatic Hyperfy connection initiated.'))
      .catch(err =>
        console.error(`Automatic Hyperfy connection failed: ${err.message}`)
      )

    return service
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    console.info('*** Stopping Hyperfy service ***')
    const service = runtime.getService<HyperfyService>(
      HyperfyService.serviceName
    )
    if (service) {
      await service.stop()
    } else {
      console.warn('Hyperfy service not found during stop.')
      throw new Error('Hyperfy service not found')
    }
  }

  async connect(config: {
    wsUrl: string
    authToken?: string
    worldId: UUID
  }): Promise<void> {
    if (this.isServiceConnected) {
      console.warn(
        `HyperfyService already connected to world ${this._currentWorldId}. Disconnecting first.`
      )
      await this.disconnect()
    }

    console.info(
      `Attempting to connect HyperfyService to ${config.wsUrl} for world ${config.worldId}`
    )
    this._currentWorldId = config.worldId
    this.appearanceHash = null

    try {
      // const world = createNodeClientWorld(); // Not available
      // Create a mock world object
      const world: any = {
        entities: {
          player: null,
          players: new Map(),
          items: new Map(),
          add: () => {},
          remove: () => {},
          getPlayer: () => null,
        },
        network: {
          id: 'mock-network',
          send: () => {},
          upload: async () => {},
          disconnect: async () => {},
          maxUploadSize: 10 * 1024 * 1024,
        },
        chat: {
          msgs: [],
          listeners: [],
          add: () => {},
          subscribe: () => () => {},
        },
        controls: null,
        loader: null,
        stage: { scene: null },
        camera: null,
        rig: null,
        livekit: null,
        events: {
          emit: () => {},
          on: () => {},
          off: () => {},
        },
        blueprints: { add: () => {} },
        settings: { on: () => {}, model: {} },
        systems: [],
        actions: null,
        init: async () => {},
        destroy: () => {},
        on: () => {},
        off: () => {},
      }
      this.world = world

      this.puppeteerManager = new PuppeteerManager(this.runtime)
      this.emoteManager = new EmoteManager(this.runtime)
      this.messageManager = new MessageManager(this.runtime)
      this.voiceManager = new VoiceManager(this.runtime)
      this.behaviorManager = new BehaviorManager(this.runtime)
      this.buildManager = new BuildManager(this.runtime)
      this.dynamicActionLoader = new DynamicActionLoader(this.runtime)

      const livekit = new AgentLiveKit(world)
      world.systems.push(livekit)

      const actions = new AgentActions(world)
      world.systems.push(actions)

      // @ts-ignore - Controls property access
      this.controls = new AgentControls(world)
      // @ts-ignore - Controls property access
      world.systems.push(this.controls)

      const loader = new AgentLoader(world)
      world.systems.push(loader)

      const environment = new EnvironmentSystem(world)
      world.systems.push(environment)
      ;(world as any).chat.add = (msg, broadcast) => {
        const chat = (world as any).chat
        const MAX_MSGS = 50

        chat.msgs = [...chat.msgs, msg]

        if (chat.msgs.length > MAX_MSGS) {
          chat.msgs.shift()
        }
        for (const callback of chat.listeners) {
          callback(chat.msgs)
        }

        const readOnly = Object.freeze({ ...msg })
        if (this.world) {
          this.world.events.emit('chat', readOnly)
          if (broadcast && this.world.network) {
            this.world.network.send('chatAdded', msg)
          }
        }
      }

      const mockElement = {
        appendChild: () => {},
        removeChild: () => {},
        offsetWidth: 1920,
        offsetHeight: 1080,
        addEventListener: () => {},
        removeEventListener: () => {},
        style: {},
      }

      const hyperfyConfig = {
        wsUrl: config.wsUrl,
        viewport: mockElement,
        ui: mockElement,
        initialAuthToken: config.authToken,
        loadPhysX,
      }

      if (typeof this.world.init !== 'function') {
        throw new Error('world.init is not a function')
      }
      await this.world.init(hyperfyConfig)
      console.info('Hyperfy world initialized.')

      this.voiceManager.start()

      this.behaviorManager.start()

      this.subscribeToHyperfyEvents()

      this.isServiceConnected = true

      this.connectionTime = Date.now()

      console.info(`HyperfyService connected successfully to ${config.wsUrl}`)

      // Initialize managers
      // @ts-ignore - Manager initialization
      await this.emoteManager.uploadEmotes()

      // Discover and load dynamic actions
      if (this.dynamicActionLoader && this.world) {
        const discoveredActions =
          await this.dynamicActionLoader.discoverActions(this.world)
        console.info(
          `[HyperfyService] Discovered ${discoveredActions.length} dynamic actions`
        )

        for (const actionDescriptor of discoveredActions) {
          await this.dynamicActionLoader.registerAction(
            actionDescriptor,
            this.runtime
          )
        }
      }
      // Don't auto-load any content - it will be loaded on demand

      // @ts-ignore - Appearance property access
      if (this.world?.entities?.player?.data) {
        // Access appearance data for validation
        const appearance = this.world.entities.player.data.appearance
        if (appearance) {
          console.debug('[Appearance] Current appearance data available')
        }
      }
    } catch (error: any) {
      console.error(
        `HyperfyService connection failed for ${config.worldId} at ${config.wsUrl}: ${error.message}`,
        error.stack
      )
      await this.handleDisconnect()
      throw error
    }
  }

  private subscribeToHyperfyEvents(): void {
    if (!this.world || typeof this.world.on !== 'function') {
      console.warn(
        '[Hyperfy Events] Cannot subscribe: World or world.on not available.'
      )
      return
    }

    this.world.off('disconnect')

    this.world.on('disconnect', (data: Record<string, unknown>) => {
      const reason =
        typeof data === 'string' ? data : data.reason || 'Unknown reason'
      console.warn(`Hyperfy world disconnected: ${reason}`)
      this.runtime.emitEvent(EventType.WORLD_LEFT, {
        runtime: this.runtime,
        eventName: 'HYPERFY_DISCONNECTED',
        data: { worldId: this._currentWorldId, reason },
      })
      this.handleDisconnect()
    })

    if (this.world.chat && typeof this.world.chat.subscribe === 'function') {
      this.startChatSubscription()
    } else {
      console.warn('[Hyperfy Events] world.chat.subscribe not available.')
    }
  }

  private async uploadCharacterAssets(): Promise<{
    success: boolean
    error?: string
  }> {
    if (
      !this.world ||
      !this.world.entities?.player ||
      !this.world.network ||
      !this.world.assetsUrl
    ) {
      console.warn(
        '[Appearance] Cannot set avatar: World, player, network, or assetsUrl not ready.'
      )
      return { success: false, error: 'Prerequisites not met' }
    }

    const agentPlayer = this.world.entities.player
    const localAvatarPath = path.resolve(LOCAL_AVATAR_PATH)
    let fileName = ''

    try {
      console.info(`[Appearance] Reading avatar file from: ${localAvatarPath}`)
      const fileBuffer: Buffer = await fsPromises.readFile(localAvatarPath)
      fileName = path.basename(localAvatarPath)
      const mimeType = fileName.endsWith('.vrm')
        ? 'model/gltf-binary'
        : 'application/octet-stream'

      console.info(
        `[Appearance] Uploading ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB, Type: ${mimeType})...`
      )

      if (!crypto.subtle || typeof crypto.subtle.digest !== 'function') {
        throw new Error(
          'crypto.subtle.digest is not available. Ensure Node.js version supports Web Crypto API.'
        )
      }

      const hash = await hashFileBuffer(fileBuffer)
      const ext = fileName.split('.').pop()?.toLowerCase() || 'vrm'
      const fullFileNameWithHash = `${hash}.${ext}`
      const baseUrl = this.world.assetsUrl.replace(/\/$/, '')
      const constructedHttpUrl = `${baseUrl}/${fullFileNameWithHash}`

      if (typeof this.world.network.upload !== 'function') {
        console.warn(
          '[Appearance] world.network.upload function not found. Cannot upload.'
        )
        return { success: false, error: 'Upload function unavailable' }
      }

      try {
        console.info(
          `[Appearance] Uploading avatar to ${constructedHttpUrl}...`
        )
        const fileForUpload = new File([fileBuffer], fileName, {
          type: mimeType,
        })

        const uploadPromise = this.world.network.upload(fileForUpload)
        const timeoutPromise = new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('Upload timed out')), 30000)
        )

        await Promise.race([uploadPromise, timeoutPromise])
        console.info('[Appearance] Avatar uploaded successfully.')
      } catch (uploadError: any) {
        console.error(
          `[Appearance] Avatar upload failed: ${uploadError.message}`,
          uploadError.stack
        )
        return {
          success: false,
          error: `Upload failed: ${uploadError.message}`,
        }
      }

      if (agentPlayer && typeof agentPlayer.setSessionAvatar === 'function') {
        agentPlayer.setSessionAvatar(constructedHttpUrl)
      } else {
        console.warn('[Appearance] agentPlayer.setSessionAvatar not available.')
      }

      await this.emoteManager.uploadEmotes()

      if (typeof this.world.network.send === 'function') {
        this.world.network.send('playerSessionAvatar', {
          avatar: constructedHttpUrl,
        })
        console.info(
          `[Appearance] Sent playerSessionAvatar with: ${constructedHttpUrl}`
        )
      } else {
        console.error(
          '[Appearance] Upload succeeded but world.network.send is not available.'
        )
      }

      return { success: true }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(
          `[Appearance] Avatar file not found at ${localAvatarPath}. CWD: ${process.cwd()}`
        )
      } else {
        console.error(
          '[Appearance] Unexpected error during avatar process:',
          error.message,
          error.stack
        )
      }
      return { success: false, error: error.message }
    }
  }

  private startAppearancePolling(): void {
    if (this.appearanceRefreshInterval) {
      clearInterval(this.appearanceRefreshInterval)
    }
    const pollingTasks = {
      avatar: this.appearanceHash !== null,
      name: this.world?.entities?.player?.data?.name !== undefined,
    }

    if (pollingTasks.avatar && pollingTasks.name) {
      console.info('[Appearance/Name Polling] Already set, skipping start.')
      return
    }
    console.info(
      `[Appearance/Name Polling] Initializing interval every ${HYPERFY_APPEARANCE_POLL_INTERVAL}ms.`
    )

    const f = async () => {
      if (pollingTasks.avatar && pollingTasks.name) {
        if (this.appearanceRefreshInterval) {
          clearInterval(this.appearanceRefreshInterval)
        }
        this.appearanceRefreshInterval = null
        console.info(
          '[Appearance/Name Polling] Both avatar and name set. Polling stopped.'
        )
        return
      }

      const agentPlayer = this.world?.entities?.player
      const agentPlayerReady = !!agentPlayer
      const agentPlayerId = agentPlayer?.data?.id
      const agentPlayerIdReady = !!agentPlayerId
      const networkReady = this.world?.network?.id !== null
      const assetsUrlReady = !!this.world?.assetsUrl

      console.log('agentPlayerReady', agentPlayerReady)
      console.log('agentPlayerIdReady', agentPlayerIdReady)
      console.log('networkReady', networkReady)
      if (agentPlayerReady && agentPlayerIdReady && networkReady) {
        const entityId = createUniqueUuid(this.runtime, this.runtime.agentId)
        const entity = await this.runtime.getEntityById(entityId)

        if (entity) {
          // Add or update the appearance component
          entity.components = entity.components || []
          const appearanceComponent = entity.components.find(
            c => c.type === 'appearance'
          )
          if (appearanceComponent) {
            appearanceComponent.data = {
              appearance: this.world.entities.player.data.appearance,
            }
          } else {
            entity.components.push({
              type: 'appearance',
              data: { appearance: this.world.entities.player.data.appearance },
              
              createdAt: 0
            })
          }
          // @ts-ignore - Runtime property access
          await this.runtime.updateEntity(entity)
        }

        // Also attempt to change name on first appearance
        if (!this.hasChangedName) {
          try {
            // @ts-ignore - Runtime property access
            if (this.runtime.character && this.runtime.character.name) {
              // @ts-ignore - Runtime property access
              await this.changeName(this.runtime.character.name)
              this.hasChangedName = true
              // @ts-ignore - Runtime property access
              console.info(
                `[Name Polling] Initial name successfully set to "${this.runtime.character.name}".`
              )
            }
          } catch (error) {
            console.warn('[Name Polling] Failed to set initial name:', error)
          }
        }

        if (!pollingTasks.avatar && assetsUrlReady) {
          console.info(
            `[Appearance Polling] Player (ID: ${agentPlayerId}), network, assetsUrl ready. Attempting avatar upload and set...`
          )
          const result = await this.uploadCharacterAssets()

          if (result.success) {
            const hashValue = await hashFileBuffer(
              Buffer.from(JSON.stringify(result.success))
            )
            this.appearanceHash = hashValue
            pollingTasks.avatar = true
            console.info(
              '[Appearance Polling] Avatar setting process successfully completed.'
            )
          } else {
            console.warn(
              `[Appearance Polling] Avatar setting process failed: ${result.error || 'Unknown reason'}. Will retry...`
            )
          }
        } else if (!pollingTasks.avatar) {
          console.debug(
            `[Appearance Polling] Waiting for: Assets URL (${assetsUrlReady})...`
          )
        }
      } else {
        console.debug(
          `[Appearance/Name Polling] Waiting for: Player (${agentPlayerReady}), Player ID (${agentPlayerIdReady}), Network (${networkReady})...`
        )
      }
    }
    this.appearanceRefreshInterval = setInterval(
      f,
      HYPERFY_APPEARANCE_POLL_INTERVAL
    )
    f()
  }

  private stopAppearancePolling(): void {
    if (this.appearanceRefreshInterval) {
      clearInterval(this.appearanceRefreshInterval)
      this.appearanceRefreshInterval = null
      console.info('[Appearance Polling] Stopped.')
    }
  }

  public isConnected(): boolean {
    return this.isServiceConnected
  }

  public getEntityById(entityId: string): any | null {
    return this.world?.entities?.items?.get(entityId) || null
  }

  public getEntityName(entityId: string): string | null {
    const entity = this.world?.entities?.items?.get(entityId)
    return entity?.data?.name || entity?.blueprint?.name || 'Unnamed'
  }

  async handleDisconnect(): Promise<void> {
    if (!this.isServiceConnected && !this.world) {
      return
    }
    console.info('Handling Hyperfy disconnection...')
    this.isServiceConnected = false

    this.stopAppearancePolling()

    if (this.world) {
      try {
        if (
          this.world.network &&
          typeof this.world.network.disconnect === 'function'
        ) {
          console.info('[Hyperfy Cleanup] Calling network.disconnect()...')
          await this.world.network.disconnect()
        }
        if (typeof this.world.destroy === 'function') {
          console.info('[Hyperfy Cleanup] Calling world.destroy()...')
          this.world.destroy()
        }
      } catch (e: any) {
        console.warn(
          `[Hyperfy Cleanup] Error during world network disconnect/destroy: ${e.message}`
        )
      }
    }

    this.world = null
    // @ts-ignore - Controls cleanup
    this.controls = null
    this.connectionTime = null

    if (this.appearanceRefreshInterval) {
      clearInterval(this.appearanceRefreshInterval)
      this.appearanceRefreshInterval = null
    }

    if (this.dynamicActionLoader) {
      // Unregister all dynamic actions
      const registeredActions = this.dynamicActionLoader.getRegisteredActions()
      for (const [actionName, _] of registeredActions) {
        await this.dynamicActionLoader.unregisterAction(
          actionName,
          this.runtime
        )
      }
      this.dynamicActionLoader.clear()
      this.dynamicActionLoader = null
    }

    // Clean up loaded content
    for (const [contentId, content] of this.loadedContent) {
      if (content && typeof content.uninstall === 'function') {
        try {
          await content.uninstall()
        } catch (error) {
          console.error(
            `[HyperfyService] Error uninstalling content ${contentId}:`,
            error
          )
        }
      }
    }
    this.loadedContent.clear()

    console.info('Hyperfy disconnection handling complete.')
  }

  async disconnect(): Promise<void> {
    console.info(
      `Disconnecting HyperfyService from world ${this._currentWorldId}`
    )
    await this.handleDisconnect()
    console.info('HyperfyService disconnect complete.')

    try {
      // @ts-ignore - Runtime property access issues
      this.runtime.emitEvent(EventType.WORLD_LEFT, {
        runtime: this.runtime,
        worldId: this._currentWorldId,
      })
    } catch (error) {
      console.error('Error emitting WORLD_LEFT event:', error)
    }

    if (this.world) {
      this.world.disconnect()
      this.world = null
    }

    this.isServiceConnected = false
    this._currentWorldId = null
    console.info('HyperfyService disconnect complete.')
  }

  async changeName(newName: string): Promise<void> {
    if (
      !this.isConnected() ||
      !this.world?.network ||
      !this.world?.entities?.player
    ) {
      throw new Error(
        'HyperfyService: Cannot change name. Network or player not ready.'
      )
    }
    const agentPlayerId = this.world.entities.player.data.id
    if (!agentPlayerId) {
      throw new Error(
        'HyperfyService: Cannot change name. Player ID not available.'
      )
    }

    console.info(
      `[Action] Attempting to change name to "${newName}" for ID ${agentPlayerId}`
    )

    try {
      // 2. Update local state immediately
      // Update the name map
      if (this.playerNamesMap.has(agentPlayerId)) {
        console.info(
          `[Name Map Update] Setting name via changeName for ID ${agentPlayerId}: '${newName}'`
        )
        this.playerNamesMap.set(agentPlayerId, newName)
      } else {
        console.warn(
          `[Name Map Update] Attempted changeName for ID ${agentPlayerId} not currently in map. Adding.`
        )
        this.playerNamesMap.set(agentPlayerId, newName)
      }

      // --- Use agentPlayer.modify for local update --- >
      const agentPlayer = this.world.entities.player
      if (agentPlayer.modify) {
        agentPlayer.modify({ name: newName })
        agentPlayer.data.name = newName
      }

      this.world.network.send('entityModified', {
        id: agentPlayer.data.id,
        name: newName,
      })
      console.debug(
        `[Action] Called agentPlayer.modify({ name: "${newName}" })`
      )
    } catch (error: any) {
      console.error(`[Action] Error during changeName to "${newName}":`, error)
      throw error
    }
  }

  async stop(): Promise<void> {
    console.info('*** Stopping Hyperfy service instance ***')
    await this.disconnect()
  }

  private startChatSubscription(): void {
    if (!this.world || !this.world.chat) {
      console.error(
        'Cannot subscribe to chat: World or Chat system not available.'
      )
      return
    }

    console.info('[HyperfyService] Initializing chat subscription...')

    // Pre-populate processed IDs with existing messages
    this.world.chat.msgs?.forEach((msg: any) => {
      if (msg && msg.id) {
        // Add null check for msg and msg.id
        this.processedMsgIds.add(msg.id)
      }
    })

    this.world.chat.subscribe((msgs: any[]) => {
      // Wait for player entity (ensures world/chat exist too)
      if (
        !this.world ||
        !this.world.chat ||
        !this.world.entities?.player ||
        !this.connectionTime
      ) {
        return
      }

      const newMessagesFound: any[] = [] // Temporary list for new messages

      // Step 1: Identify new messages and update processed set
      msgs.forEach((msg: any) => {
        // Check timestamp FIRST - only consider messages newer than connection time
        const messageTimestamp = msg.createdAt
          ? new Date(msg.createdAt).getTime()
          : 0
        if (
          !messageTimestamp ||
          !this.connectionTime ||
          messageTimestamp <= this.connectionTime
        ) {
          // console.debug(`[Chat Sub] Ignoring historical/old message ID ${msg?.id} (ts: ${messageTimestamp})`);
          // Ensure historical messages are marked processed if encountered *before* connectionTime was set (edge case)
          if (msg?.id && !this.processedMsgIds.has(msg.id.toString())) {
            this.processedMsgIds.add(msg.id.toString())
          }
          return // Skip this message
        }

        // Check if we've already processed this message ID (secondary check for duplicates)
        const msgIdStr = msg.id?.toString()
        if (msgIdStr && !this.processedMsgIds.has(msgIdStr)) {
          newMessagesFound.push(msg) // Add the full message object
          this.processedMsgIds.add(msgIdStr) // Mark ID as processed immediately
        }
      })

      // Step 2: Process only the newly found messages
      if (newMessagesFound.length > 0) {
        console.info(
          `[Chat] Found ${newMessagesFound.length} new messages to process.`
        )

        newMessagesFound.forEach(async (msg: any) => {
          // @ts-ignore - Manager null check
          if (this.messageManager) {
            await this.messageManager.handleMessage(msg)
          }
        })
      }
    })
  }

  getEmoteManager() {
    return this.emoteManager
  }

  getBehaviorManager() {
    return this.behaviorManager
  }

  getMessageManager() {
    return this.messageManager
  }

  getVoiceManager() {
    return this.voiceManager
  }

  getPuppeteerManager() {
    return this.puppeteerManager
  }

  getBuildManager() {
    return this.buildManager
  }

  getMultiAgentManager() {
    return this.multiAgentManager
  }

  setMultiAgentManager(manager: any) {
    this.multiAgentManager = manager
  }

  getDynamicActionLoader() {
    return this.dynamicActionLoader
  }

  /**
   * Load UGC content bundle into the current world
   */
  async loadUGCContent(
    contentId: string,
    contentBundle: any
  ): Promise<boolean> {
    if (!this.world) {
      console.error('[HyperfyService] Cannot load content: No world connected')
      return false
    }

    if (this.loadedContent.has(contentId)) {
      console.warn(
        `[HyperfyService] Content ${contentId} already loaded. Unloading first...`
      )
      await this.unloadUGCContent(contentId)
    }

    try {
      console.info(`[HyperfyService] Loading UGC content: ${contentId}`)

      // Install the content bundle
      if (typeof contentBundle.install === 'function') {
        const instance = await contentBundle.install(this.world, this.runtime)
        this.loadedContent.set(contentId, instance)

        // Handle actions from the content bundle
        if (contentBundle.actions && Array.isArray(contentBundle.actions)) {
          console.info(
            `[HyperfyService] Registering ${contentBundle.actions.length} actions from ${contentId}`
          )
          for (const action of contentBundle.actions) {
            // Register each action with the runtime
            if (this.runtime.registerAction) {
              await this.runtime.registerAction(action)
            } else if (
              this.runtime.actions &&
              Array.isArray(this.runtime.actions)
            ) {
              // Fallback: add to actions array
              this.runtime.actions.push(action)
            }
          }
        }

        // Handle providers from the content bundle
        if (contentBundle.providers && Array.isArray(contentBundle.providers)) {
          console.info(
            `[HyperfyService] Registering ${contentBundle.providers.length} providers from ${contentId}`
          )
          for (const provider of contentBundle.providers) {
            // Register each provider with the runtime
            if (this.runtime.registerProvider) {
              await this.runtime.registerProvider(provider)
            } else if (
              this.runtime.providers &&
              Array.isArray(this.runtime.providers)
            ) {
              // Fallback: add to providers array
              this.runtime.providers.push(provider)
            }
          }
        }

        // Support for dynamic action discovery via the dynamic loader
        if (contentBundle.dynamicActions && this.dynamicActionLoader) {
          console.info(
            `[HyperfyService] Discovering dynamic actions from ${contentId}`
          )
          const discoveredActions = contentBundle.dynamicActions
          for (const actionDescriptor of discoveredActions) {
            await this.dynamicActionLoader.registerAction(
              actionDescriptor,
              this.runtime
            )
          }
        }

        // Emit event for content loaded
        this.runtime.emitEvent(EventType.CONTENT_LOADED, {
          runtime: this.runtime,
          eventName: 'UGC_CONTENT_LOADED',
          data: {
            contentId: contentId,
            contentName: contentBundle.name || contentId,
            features: contentBundle.config?.features || {},
            actionsCount: contentBundle.actions?.length || 0,
            providersCount: contentBundle.providers?.length || 0,
          },
        })

        console.info(
          `[HyperfyService] UGC content ${contentId} loaded successfully`
        )
        return true
      } else {
        console.error(`[HyperfyService] Content bundle missing install method`)
        return false
      }
    } catch (error) {
      console.error(
        `[HyperfyService] Failed to load UGC content ${contentId}:`,
        error
      )
      return false
    }
  }

  /**
   * Unload UGC content
   */
  async unloadUGCContent(contentId: string): Promise<boolean> {
    const content = this.loadedContent.get(contentId)
    if (!content) {
      console.warn(`[HyperfyService] No content loaded with ID: ${contentId}`)
      return false
    }

    try {
      console.info(`[HyperfyService] Unloading UGC content: ${contentId}`)

      // First, unregister any actions that were registered
      if (content.actions && Array.isArray(content.actions)) {
        console.info(
          `[HyperfyService] Unregistering ${content.actions.length} actions from ${contentId}`
        )
        for (const action of content.actions) {
          if (this.runtime.unregisterAction) {
            await this.runtime.unregisterAction(action.name)
          } else if (
            this.runtime.actions &&
            Array.isArray(this.runtime.actions)
          ) {
            // Fallback: remove from actions array
            const index = this.runtime.actions.findIndex(
              a => a.name === action.name
            )
            if (index !== -1) {
              this.runtime.actions.splice(index, 1)
            }
          }
        }
      }

      // Unregister any providers that were registered
      if (content.providers && Array.isArray(content.providers)) {
        console.info(
          `[HyperfyService] Unregistering ${content.providers.length} providers from ${contentId}`
        )
        for (const provider of content.providers) {
          if (this.runtime.unregisterProvider) {
            await this.runtime.unregisterProvider(provider.name)
          } else if (
            this.runtime.providers &&
            Array.isArray(this.runtime.providers)
          ) {
            // Fallback: remove from providers array
            const index = this.runtime.providers.findIndex(
              p => p.name === provider.name
            )
            if (index !== -1) {
              this.runtime.providers.splice(index, 1)
            }
          }
        }
      }

      // Unregister any dynamic actions
      if (content.dynamicActions && this.dynamicActionLoader) {
        console.info(
          `[HyperfyService] Unregistering ${content.dynamicActions.length} dynamic actions from ${contentId}`
        )
        for (const actionName of content.dynamicActions) {
          await this.dynamicActionLoader.unregisterAction(
            actionName,
            this.runtime
          )
        }
      }

      // Call the content's uninstall method if available
      if (typeof content.uninstall === 'function') {
        await content.uninstall()
      }

      this.loadedContent.delete(contentId)

      // Emit event for content unloaded
      this.runtime.emitEvent(EventType.CONTENT_UNLOADED, {
        runtime: this.runtime,
        eventName: 'UGC_CONTENT_UNLOADED',
        data: {
          contentId: contentId,
        },
      })

      console.info(
        `[HyperfyService] UGC content ${contentId} unloaded successfully`
      )
      return true
    } catch (error) {
      console.error(
        `[HyperfyService] Failed to unload UGC content ${contentId}:`,
        error
      )
      return false
    }
  }

  /**
   * Get loaded UGC content instance
   */
  getLoadedContent(contentId: string): any | null {
    return this.loadedContent.get(contentId) || null
  }

  /**
   * Check if UGC content is loaded
   */
  isContentLoaded(contentId: string): boolean {
    return this.loadedContent.has(contentId)
  }

  async initialize(): Promise<void> {
    try {
      // Initialize managers
      // @ts-ignore - Runtime type issue
      this.puppeteerManager = new PuppeteerManager(this.runtime)
      // @ts-ignore - Runtime type issue
      this.emoteManager = new EmoteManager(this.runtime)
      // @ts-ignore - Runtime type issue
      this.messageManager = new MessageManager(this.runtime)
      // @ts-ignore - Runtime type issue
      this.voiceManager = new VoiceManager(this.runtime)
      // @ts-ignore - Runtime type issue
      this.behaviorManager = new BehaviorManager(this.runtime)
      // @ts-ignore - Runtime type issue
      this.buildManager = new BuildManager(this.runtime)
      // @ts-ignore - Runtime type issue
      this.dynamicActionLoader = new DynamicActionLoader(this.runtime)

      logger.info('[HyperfyService] Service initialized successfully')
    } catch (error) {
      logger.error('[HyperfyService] Failed to initialize service:', error)
      throw error
    }
  }
}
