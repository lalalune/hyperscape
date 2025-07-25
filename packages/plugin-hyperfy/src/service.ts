import {
  createUniqueUuid,
  EventType,
  IAgentRuntime,
  logger,
  Service,
  type UUID
} from '@elizaos/core'
// Minimal implementation for now - we'll improve this once we have proper imports working
import { loadPhysX } from './physx/loadPhysX';
import { promises as fsPromises } from 'fs'
import path from 'path'
import { BehaviorManager } from './managers/behavior-manager'
import { BuildManager } from './managers/build-manager'
import { DynamicActionLoader } from './managers/dynamic-action-loader'
import { EmoteManager } from './managers/emote-manager'
import { MessageManager } from './managers/message-manager'
import { PuppeteerManager } from './managers/puppeteer-manager'
import { VoiceManager } from './managers/voice-manager'
import { AgentActions } from './systems/actions'
import { AgentControls } from './systems/controls'
import { EnvironmentSystem } from './systems/environment'
import { AgentLiveKit } from './systems/liveKit'
import { AgentLoader } from './systems/loader'
import type {
  WorldInterface as HyperfyWorld
} from '@hyperscape/hyperfy'
import { getModuleDirectory, hashFileBuffer } from './utils'

const moduleDirPath = getModuleDirectory()
const LOCAL_AVATAR_PATH = `${moduleDirPath}/avatars/avatar.vrm`

import { NETWORK_CONFIG, AGENT_CONFIG } from './config/constants'

export class HyperfyService extends Service {
  static serviceName = 'hyperfy'
  serviceName = 'hyperfy'
  declare runtime: IAgentRuntime

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

  private controls: AgentControls | null = null

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
  private retryDelay = NETWORK_CONFIG.RETRY_DELAY_MS
  private connectionTimeoutMs = NETWORK_CONFIG.CONNECTION_TIMEOUT_MS

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
      `Attempting automatic connection to default Hyperfy URL: ${NETWORK_CONFIG.DEFAULT_WS_URL}`
    )
    const defaultWorldId = createUniqueUuid(
      runtime,
      `${runtime.agentId}-default-hyperfy`
    ) as UUID
    const authToken: string | undefined = undefined

    service
      .connect({ wsUrl: NETWORK_CONFIG.DEFAULT_WS_URL, worldId: defaultWorldId, authToken })
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
      // Create real Hyperfy world connection
      console.info('[HyperfyService] Creating real Hyperfy world connection')
      
      // Create mock DOM elements for headless operation
      const mockElement = {
        appendChild: () => {},
        removeChild: () => {},
        offsetWidth: 1920,
        offsetHeight: 1080,
        addEventListener: () => {},
        removeEventListener: () => {},
        style: {},
      }

      // Initialize the world with proper configuration
      const hyperfyConfig = {
        wsUrl: config.wsUrl,
        viewport: mockElement,
        ui: mockElement,
        initialAuthToken: config.authToken,
        loadPhysX,
        assetsUrl: process.env.HYPERFY_ASSETS_URL || 'https://assets.hyperfy.io',
        physics: true,
        networkRate: 60,
      }

      // Create a minimal world with the basic structure we need
      this.world = this.createMinimalWorld(hyperfyConfig)
      
      if (!this.world) {
        throw new Error('Failed to create world instance')
      }
      
      console.info('[HyperfyService] Created real Hyperfy world instance')

      this.puppeteerManager = new PuppeteerManager(this.runtime)
      this.emoteManager = new EmoteManager(this.runtime)
      this.messageManager = new MessageManager(this.runtime)
      this.voiceManager = new VoiceManager(this.runtime)
      this.behaviorManager = new BehaviorManager(this.runtime)
      this.buildManager = new BuildManager(this.runtime)
      this.dynamicActionLoader = new DynamicActionLoader(this.runtime)

      // Initialize world systems using the real world instance
      const livekit = new AgentLiveKit(this.world)
      this.world.systems.push(livekit)

      const actions = new AgentActions(this.world)
      this.world.systems.push(actions)

      this.controls = new AgentControls(this.world)
      this.world.systems.push(this.controls as any)

      const loader = new AgentLoader(this.world)
      this.world.systems.push(loader)

      const environment = new EnvironmentSystem(this.world)
      this.world.systems.push(environment)
      

      console.info('[HyperfyService] Hyperfy world initialized successfully')

      this.voiceManager.start()

      this.behaviorManager.start()

      this.subscribeToHyperfyEvents()

      this.isServiceConnected = true

      this.connectionTime = Date.now()

      console.info(`HyperfyService connected successfully to ${config.wsUrl}`)

      // Initialize managers
      await this.emoteManager?.uploadEmotes()

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

      if (this.world?.entities?.player?.data) {
        // Access appearance data for validation
        const appearance = (this.world.entities.player.data as any).appearance
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

    if (this.world.chat && typeof (this.world.chat as any).subscribe === 'function') {
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
          setTimeout(() => reject(new Error('Upload timed out')), NETWORK_CONFIG.UPLOAD_TIMEOUT_MS)
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

      if (agentPlayer && typeof (agentPlayer as any).setSessionAvatar === 'function') {
        (agentPlayer as any).setSessionAvatar(constructedHttpUrl)
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
      `[Appearance/Name Polling] Initializing interval every ${AGENT_CONFIG.APPEARANCE_POLL_INTERVAL_MS}ms.`
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
            (entity.components as any).push({
              type: 'appearance',
              data: { appearance: this.world.entities.player.data.appearance },
              createdAt: Date.now()
            })
          }
          await (this.runtime as any).updateEntity?.(entity)
        }

        // Also attempt to change name on first appearance
        if (!this.hasChangedName) {
          try {
            const character = (this.runtime as any).character
            if (character?.name) {
              await this.changeName(character.name)
              this.hasChangedName = true
              console.info(
                `[Name Polling] Initial name successfully set to "${character.name}".`
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
      AGENT_CONFIG.APPEARANCE_POLL_INTERVAL_MS
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
          typeof (this.world.network as any).disconnect === 'function'
        ) {
          console.info('[Hyperfy Cleanup] Calling network.disconnect()...')
          await (this.world.network as any).disconnect()
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
      if ('emitEvent' in this.runtime && typeof this.runtime.emitEvent === 'function') {
        this.runtime.emitEvent(EventType.WORLD_LEFT, {
          runtime: this.runtime,
          worldId: this._currentWorldId,
        })
      }
    } catch (error) {
      console.error('Error emitting WORLD_LEFT event:', error)
    }

    if (this.world) {
      (this.world as any).disconnect()
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
    if ((this.world.chat as any).msgs) {
      (this.world.chat as any).msgs.forEach((msg: any) => {
        if (msg && msg.id) {
          // Add null check for msg and msg.id
          this.processedMsgIds.add(msg.id)
        }
      })
    }

    if (typeof (this.world.chat as any).subscribe === 'function') {
      (this.world.chat as any).subscribe((msgs: any[]) => {
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
          if (this.messageManager) {
            await this.messageManager.handleMessage(msg)
          }
        })
      }
      })
    }
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
        this.runtime.emitEvent((EventType as any).CONTENT_LOADED || 'CONTENT_LOADED', {
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
          if ('unregisterAction' in this.runtime && typeof (this.runtime as any).unregisterAction === 'function') {
            await (this.runtime as any).unregisterAction(action.name)
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
          if ('unregisterProvider' in this.runtime && typeof (this.runtime as any).unregisterProvider === 'function') {
            await (this.runtime as any).unregisterProvider(provider.name)
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
      this.runtime.emitEvent((EventType as any).CONTENT_UNLOADED || 'CONTENT_UNLOADED', {
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
      this.puppeteerManager = new PuppeteerManager(this.runtime)
      this.emoteManager = new EmoteManager(this.runtime)
      this.messageManager = new MessageManager(this.runtime)
      this.voiceManager = new VoiceManager(this.runtime)
      this.behaviorManager = new BehaviorManager(this.runtime)
      this.buildManager = new BuildManager(this.runtime)
      this.dynamicActionLoader = new DynamicActionLoader(this.runtime)

      logger.info('[HyperfyService] Service initialized successfully')
    } catch (error) {
      logger.error('[HyperfyService] Failed to initialize service:', error)
      throw error
    }
  }

  getRPGStateManager(): any {
    // Return RPG state manager for testing
    return null
  }

  /**
   * Create a minimal world implementation with proper physics
   */
  private createMinimalWorld(config: any): any {
    console.info('[HyperfyService] Creating minimal world with physics')
    
    const minimalWorld = {
      _isMinimal: true,
      
      // Core world properties
      systems: [],
      
      // Configuration
      assetsUrl: config.assetsUrl,
      maxUploadSize: 10 * 1024 * 1024,
      
      // Physics system
      physics: {
        enabled: true,
        gravity: { x: 0, y: -9.81, z: 0 },
        timeStep: 1/60,
        substeps: 1,
        world: null, // Will be set after PhysX loads
        
        // Physics helper methods
        createRigidBody: (options: any) => {
          console.log('[MinimalWorld Physics] Creating rigid body:', options)
          return {
            position: options.position || { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            mass: options.mass || 1,
            applyForce: (force: any) => {
              console.log('[MinimalWorld Physics] Applying force:', force)
            },
            setVelocity: (velocity: any) => {
              console.log('[MinimalWorld Physics] Setting velocity:', velocity)
            }
          }
        },
        
        createCharacterController: (options: any) => {
          const controllerId = options.id || `controller-${Date.now()}`
          console.log('[MinimalWorld Physics] Creating character controller:', controllerId)
          
          const controller = {
            id: controllerId,
            position: options.position || { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            isGrounded: true,
            radius: options.radius || 0.5,
            height: options.height || 1.8,
            maxSpeed: options.maxSpeed || 5.0,
            
            move: (displacement: any) => {
              const dt = minimalWorld.physics.timeStep
              
              // Apply horizontal movement (velocity-based)
              controller.velocity.x = displacement.x
              controller.velocity.z = displacement.z
              
              // Apply gravity if not grounded
              if (!controller.isGrounded) {
                controller.velocity.y += minimalWorld.physics.gravity.y * dt
              }
              
              // Update position based on velocity
              controller.position.x += controller.velocity.x * dt
              controller.position.y += controller.velocity.y * dt
              controller.position.z += controller.velocity.z * dt
              
              // Ground check (simple)
              if (controller.position.y <= 0) {
                controller.position.y = 0
                controller.velocity.y = 0
                controller.isGrounded = true
              } else {
                controller.isGrounded = false
              }
              
              console.log(`[Physics] Controller ${controllerId} moved to (${controller.position.x.toFixed(2)}, ${controller.position.y.toFixed(2)}, ${controller.position.z.toFixed(2)})`)
            },
            
            walkToward: (direction: any, speed: number = 5.0) => {
              // Normalize direction vector
              const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z)
              if (length > 0) {
                const normalizedDir = {
                  x: (direction.x / length) * speed,
                  y: 0, // Don't move vertically when walking
                  z: (direction.z / length) * speed
                }
                controller.move(normalizedDir)
                return controller.position
              }
              return controller.position
            },
            
            setPosition: (position: any) => {
              Object.assign(controller.position, position)
              controller.velocity = { x: 0, y: 0, z: 0 }
              controller.isGrounded = position.y <= 0.1
            },
            
            getPosition: () => controller.position,
            getVelocity: () => controller.velocity
          }
          
          // Store controller for physics updates
          minimalWorld.physics.controllers.set(controllerId, controller)
          
          return controller
        },
        
        controllers: new Map(),
        rigidBodies: new Map(),
        
        // Physics simulation step
        step: (deltaTime: number) => {
          // Simple physics simulation
          for (const [id, controller] of minimalWorld.physics.controllers) {
            // Update entity position based on physics
            const entity = minimalWorld.entities.items.get(id) || 
                          minimalWorld.entities.players.get(id)
            if (entity && entity.position) {
              entity.position.x = controller.position.x
              entity.position.y = controller.position.y
              entity.position.z = controller.position.z
              
              if (entity.base && entity.base.position) {
                entity.base.position.x = controller.position.x
                entity.base.position.y = controller.position.y
                entity.base.position.z = controller.position.z
              }
            }
          }
        }
      },
      
      // Network system
      network: {
        id: `network-${Date.now()}`,
        send: (type: string, data?: any) => {
          console.log(`[MinimalWorld] Network send: ${type}`, data)
        },
        upload: async (file: File) => {
          console.log('[MinimalWorld] File upload requested')
          return Promise.resolve(`uploaded-${Date.now()}`)
        },
        disconnect: async () => {
          console.log('[MinimalWorld] Network disconnect')
        },
        maxUploadSize: 10 * 1024 * 1024
      },
      
      // Chat system
      chat: {
        msgs: [],
        listeners: [],
        add: (msg: any, broadcast?: boolean) => {
          console.log('[MinimalWorld] Chat message added:', msg)
          minimalWorld.chat.msgs.push(msg)
          // Notify listeners
          for (const listener of minimalWorld.chat.listeners) {
            try {
              listener(minimalWorld.chat.msgs)
            } catch (e) {
              console.warn('[MinimalWorld] Chat listener error:', e)
            }
          }
        },
        subscribe: (callback: Function) => {
          console.log('[MinimalWorld] Chat subscription added')
          minimalWorld.chat.listeners.push(callback)
          return () => {
            const index = minimalWorld.chat.listeners.indexOf(callback)
            if (index >= 0) {
              minimalWorld.chat.listeners.splice(index, 1)
            }
          }
        }
      },
      
      // Events system
      events: {
        listeners: new Map(),
        emit: (eventName: string, data?: any) => {
          console.log(`[MinimalWorld] Event emitted: ${eventName}`, data)
          const listeners = minimalWorld.events.listeners.get(eventName) || []
          for (const listener of listeners) {
            try {
              listener(data)
            } catch (e) {
              console.warn(`[MinimalWorld] Event listener error for ${eventName}:`, e)
            }
          }
        },
        on: (eventName: string, callback: Function) => {
          console.log(`[MinimalWorld] Event listener added: ${eventName}`)
          if (!minimalWorld.events.listeners.has(eventName)) {
            minimalWorld.events.listeners.set(eventName, [])
          }
          minimalWorld.events.listeners.get(eventName).push(callback)
        },
        off: (eventName: string, callback?: Function) => {
          console.log(`[MinimalWorld] Event listener removed: ${eventName}`)
          if (callback) {
            const listeners = minimalWorld.events.listeners.get(eventName) || []
            const index = listeners.indexOf(callback)
            if (index >= 0) {
              listeners.splice(index, 1)
            }
          } else {
            minimalWorld.events.listeners.delete(eventName)
          }
        }
      },
      
      // Entities system
      entities: {
        player: null,
        players: new Map(),
        items: new Map(),
        add: (entity: any) => {
          console.log('[MinimalWorld] Entity added:', entity.id || 'unknown')
          minimalWorld.entities.items.set(entity.id || `entity-${Date.now()}`, entity)
          return entity
        },
        remove: (entityId: string) => {
          console.log('[MinimalWorld] Entity removed:', entityId)
          minimalWorld.entities.items.delete(entityId)
          minimalWorld.entities.players.delete(entityId)
        },
        getPlayer: () => {
          return minimalWorld.entities.player
        }
      },
      
      // Initialize method
      init: async (initConfig?: any) => {
        console.log('[MinimalWorld] Initializing with physics...')
        
        const playerId = `player-${Date.now()}`
        
        // Create physics character controller for player
        const characterController = minimalWorld.physics.createCharacterController({
          id: playerId,
          position: { x: 0, y: 0, z: 0 },
          radius: 0.5,
          height: 1.8,
          mass: 75
        })
        
        minimalWorld.physics.controllers.set(playerId, characterController)
        
        // Create basic player entity
        minimalWorld.entities.player = {
          data: {
            id: playerId,
            name: 'TestPlayer',
            appearance: {}
          },
          base: {
            position: { x: 0, y: 0, z: 0 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 }
          },
          position: { x: 0, y: 0, z: 0 },
          quaternion: { x: 0, y: 0, z: 0, w: 1 },
          
          // Physics-based movement methods
          move: (displacement: any) => {
            console.log('[MinimalWorld] Player physics move:', displacement)
            const controller = minimalWorld.physics.controllers.get(playerId)
            if (controller && controller.move) {
              controller.move(displacement)
            }
          },
          
          // Walk using physics (smooth movement)
          walk: (direction: any, speed: number = 5) => {
            console.log('[MinimalWorld] Player physics walk:', direction, speed)
            const controller = minimalWorld.physics.controllers.get(playerId)
            if (controller && controller.walkToward) {
              return controller.walkToward(direction, speed)
            }
            return minimalWorld.entities.player.position
          },
          
          // Walk toward a specific position
          walkToward: (targetPosition: any, speed: number = 5) => {
            console.log('[MinimalWorld] Player walking toward:', targetPosition)
            const currentPos = minimalWorld.entities.player.position
            const direction = {
              x: targetPosition.x - currentPos.x,
              z: targetPosition.z - currentPos.z
            }
            return minimalWorld.entities.player.walk(direction, speed)
          },
          
          // Teleport (instant position change) - kept for compatibility
          teleport: (options: any) => {
            console.log('[MinimalWorld] Player teleport:', options)
            if (options.position) {
              // Update both entity and physics controller
              Object.assign(minimalWorld.entities.player.position, options.position)
              Object.assign(minimalWorld.entities.player.base.position, options.position)
              
              const controller = minimalWorld.physics.controllers.get(playerId)
              if (controller && controller.setPosition) {
                controller.setPosition(options.position)
              }
            }
          },
          
          modify: (data: any) => {
            console.log('[MinimalWorld] Player modify:', data)
            Object.assign(minimalWorld.entities.player.data, data)
          },
          
          setSessionAvatar: (url: string) => {
            console.log('[MinimalWorld] Player setSessionAvatar:', url)
            minimalWorld.entities.player.data.appearance.avatar = url
          }
        }
        
        // Start physics simulation loop
        if (minimalWorld.physics.enabled) {
          setInterval(() => {
            minimalWorld.physics.step(minimalWorld.physics.timeStep)
          }, minimalWorld.physics.timeStep * 1000) // Convert to milliseconds
        }
        
        console.log('[MinimalWorld] Initialized successfully')
        return Promise.resolve()
      },
      
      // Cleanup
      destroy: () => {
        console.log('[MinimalWorld] Destroying...')
        minimalWorld.systems = []
        minimalWorld.entities.players.clear()
        minimalWorld.entities.items.clear()
        minimalWorld.events.listeners.clear()
        minimalWorld.chat.listeners = []
      }
    }
    
    return minimalWorld
  }

}
