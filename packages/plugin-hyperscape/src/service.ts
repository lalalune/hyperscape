/**
 * Hyperscape Service - ElizaOS World Integration
 *
 * This service manages the connection between ElizaOS agents and Hyperscape 3D worlds.
 * It handles real-time state synchronization, action execution, and event routing for
 * autonomous agents operating in virtual environments.
 *
 * **Architecture**:
 *
 * **Connection Management**:
 * - Establishes WebSocket connection to Hyperscape server
 * - Maintains connection state and handles reconnection
 * - Synchronizes world state with the agent's decision-making system
 *
 * **Agent Managers**:
 * - `BehaviorManager`: Coordinates agent behaviors and action selection
 * - `BuildManager`: Handles world editing and entity placement
 * - `EmoteManager`: Manages gestures and animations
 * - `MessageManager`: Routes chat messages and handles replies
 * - `MultiAgentManager`: Coordinates multiple agents in the same world
 * - `VoiceManager`: Manages voice chat and audio interactions
 * - `PlaywrightManager`: Provides headless testing capabilities
 * - `DynamicActionLoader`: Loads custom actions from content packs
 *
 * **World Interaction**:
 * - Movement: Navigate to locations, patrol areas, wander randomly
 * - Interaction: Use items, activate objects, gather resources
 * - Communication: Send chat messages, respond to users, perform emotes
 * - Building: Place entities, modify the world (if agent has builder permissions)
 * - Perception: Scan environment, identify nearby entities and users
 *
 * **State Management**:
 * - Tracks agent's current position, health, inventory
 * - Monitors nearby entities and users
 * - Maintains conversation context for natural interactions
 * - Persists agent state across reconnections
 *
 * **Event Handling**:
 * Listens for world events and routes them to the agent:
 * - Chat messages → MessageManager → Agent decision-making
 * - Entity spawns/despawns → Update world state
 * - Player join/leave → Update social context
 * - System events → Trigger appropriate behaviors
 *
 * **Content Packs**:
 * Supports loading custom content bundles that extend agent capabilities:
 * - Custom actions and behaviors
 * - World-specific knowledge
 * - Specialized interaction patterns
 *
 * **Testing Support**:
 * Integrates with Playwright for automated testing:
 * - Headless agent spawning
 * - Scripted behavior sequences
 * - World state verification
 * - Screenshot capture for debugging
 *
 * **Referenced by**: ElizaOS plugin system, agent runtime, action handlers
 */

import {
  createUniqueUuid,
  EventType,
  IAgentRuntime,
  logger,
  Service,
  type Component as ElizaComponent,
  type UUID,
} from "@elizaos/core";
// Minimal implementation for now - we'll improve this once we have proper imports working
import type { Quaternion } from "@hyperscape/shared";
import {
  Chat,
  ClientInput,
  Entity,
  loadPhysX,
  type NetworkSystem,
  type World,
  type Player,
  THREE,
  type Position3D,
} from "@hyperscape/shared";
import { promises as fsPromises } from "fs";
import path from "path";

// Type alias for Vector3 - can be THREE.Vector3 or plain object
type Vector3 = THREE.Vector3 | { x: number; y: number; z: number };
import { BehaviorManager } from "./managers/behavior-manager";
import { BuildManager } from "./managers/build-manager";
import { DynamicActionLoader } from "./managers/dynamic-action-loader";
import { EmoteManager } from "./managers/emote-manager";
import { MessageManager } from "./managers/message-manager";
import { MultiAgentManager } from "./managers/multi-agent-manager";
import { PlaywrightManager } from "./managers/playwright-manager";
import { VoiceManager } from "./managers/voice-manager";
import { AgentActions } from "./systems/actions";
import { EnvironmentSystem } from "./systems/environment";
import { AgentLiveKit } from "./systems/liveKit";
import { AgentLoader } from "./systems/loader";
import type {
  CharacterControllerOptions,
  EntityModificationData,
  RPGStateManager,
  TeleportOptions,
} from "./types/content-types";
import type {
  CharacterController,
  ChatMessage,
  ContentBundle,
  ContentInstance,
  Position,
  RigidBody,
  WorldConfig,
} from "./types/core-types";

/**
 * EntityData interface for agent-created entities
 * Defines the structure for entities the agent can spawn or modify
 */
interface EntityData {
  id: string;
  type: string;
  position?: [number, number, number] | { x: number; y: number; z: number };
  quaternion?:
    | [number, number, number, number]
    | { x: number; y: number; z: number; w: number };
  [key: string]: unknown;
}

import type { NetworkEventData } from "./types/event-types";
import type { MockWorldConfig } from "./types/hyperscape-types";
import { getModuleDirectory, hashFileBuffer } from "./utils";

const moduleDirPath = getModuleDirectory();
const LOCAL_AVATAR_PATH = `${moduleDirPath}/avatars/avatar.vrm`;

import { AGENT_CONFIG, NETWORK_CONFIG } from "./config/constants";

type ChatSystem = Chat;

/**
 * Extended NetworkSystem interface with upload capability
 */
interface UploadableNetwork extends NetworkSystem {
  upload: (file: File) => Promise<string>;
}

/**
 * Extended Player interface with modification methods
 */
interface ModifiablePlayer extends Player {
  modify: (data: { name: string }) => void;
  setSessionAvatar: (url: string) => void;
}

/**
 * HyperscapeService - Main service class for agent-world integration
 *
 * Manages connection lifecycle, state synchronization, and coordinates
 * all agent activities within the Hyperscape world.
 */
export class HyperscapeService extends Service {
  static serviceName = "hyperscape";
  serviceName = "hyperscape";
  declare runtime: IAgentRuntime;

  capabilityDescription = `
Hyperscape world integration service that enables agents to:
- Connect to 3D virtual worlds through WebSocket connections
- Navigate virtual environments and interact with objects
- Communicate with other users via chat and voice
- Perform gestures and emotes
- Build and modify world environments
- Share content and media within virtual spaces
- Manage multi-agent interactions in virtual environments
  `;

  // Connection and world state
  private isServiceConnected = false;
  private world: World | null = null;

  // Manager components
  private playwrightManager: PlaywrightManager | null = null;
  private emoteManager: EmoteManager | null = null;
  private messageManager: MessageManager | null = null;
  private voiceManager: VoiceManager | null = null;
  private behaviorManager: BehaviorManager | null = null;
  private buildManager: BuildManager | null = null;
  private dynamicActionLoader: DynamicActionLoader | null = null;

  // Network state
  private maxRetries = 3;
  private retryDelay = NETWORK_CONFIG.RETRY_DELAY_MS;
  private connectionTimeoutMs = NETWORK_CONFIG.CONNECTION_TIMEOUT_MS;

  private _currentWorldId: UUID | null = null;
  private lastMessageHash: string | null = null;
  private appearanceRefreshInterval: NodeJS.Timeout | null = null;
  private appearanceHash: string | null = null;
  private connectionTime: number | null = null;
  private multiAgentManager?: MultiAgentManager;
  private processedMsgIds: Set<string> = new Set();
  private playerNamesMap: Map<string, string> = new Map();
  private hasChangedName = false;

  // UGC content support
  private loadedContent: Map<string, ContentInstance> = new Map();

  public get currentWorldId(): UUID | null {
    return this._currentWorldId;
  }

  public getWorld(): World | null {
    return this.world;
  }

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    console.info("HyperscapeService instance created");
  }

  /**
   * Start the Hyperscape service
   */
  static async start(runtime: IAgentRuntime): Promise<HyperscapeService> {
    console.info("*** Starting Hyperscape service ***");
    const service = new HyperscapeService(runtime);
    console.info(
      `Attempting automatic connection to default Hyperscape URL: ${NETWORK_CONFIG.DEFAULT_WS_URL}`,
    );
    const defaultWorldId = createUniqueUuid(
      runtime,
      `${runtime.agentId}-default-hyperscape`,
    ) as UUID;
    const authToken: string | undefined = undefined;

    service
      .connect({
        wsUrl: NETWORK_CONFIG.DEFAULT_WS_URL,
        worldId: defaultWorldId,
        authToken,
      })
      .then(() => console.info("Automatic Hyperscape connection initiated."))
      .catch((err) =>
        console.error(`Automatic Hyperscape connection failed: ${err.message}`),
      );

    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    console.info("*** Stopping Hyperscape service ***");
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    if (service) {
      await service.stop();
    } else {
      console.warn("Hyperscape service not found during stop.");
      throw new Error("Hyperscape service not found");
    }
  }

  async connect(config: {
    wsUrl: string;
    authToken?: string;
    worldId: UUID;
  }): Promise<void> {
    if (this.isServiceConnected) {
      console.warn(
        `HyperscapeService already connected to world ${this._currentWorldId}. Disconnecting first.`,
      );
      await this.disconnect();
    }

    console.info(
      `Attempting to connect HyperscapeService to ${config.wsUrl} for world ${config.worldId}`,
    );
    this._currentWorldId = config.worldId;
    this.appearanceHash = null;

    // Create real Hyperscape world connection
    console.info(
      "[HyperscapeService] Creating real Hyperscape world connection",
    );

    // Create mock DOM elements for headless operation
    const mockElement = {
      appendChild: () => {},
      removeChild: () => {},
      offsetWidth: 1920,
      offsetHeight: 1080,
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {},
    };

    // Initialize the world with proper configuration
    const hyperscapeConfig: WorldConfig = {
      wsUrl: config.wsUrl,
      viewport: mockElement,
      ui: mockElement,
      initialAuthToken: config.authToken,
      loadPhysX,
      assetsUrl:
        process.env.HYPERSCAPE_ASSETS_URL || "https://assets.hyperscape.io",
      physics: true,
      networkRate: 60,
    };

    // Create a minimal world with the basic structure we need
    const mockConfig: MockWorldConfig = {
      worldId: config.worldId,
      name: `world-${config.worldId}`,
      assets: ["https://assets.hyperscape.io"],
      physics: hyperscapeConfig.physics,
    };
    this.world = this.createWorld(mockConfig);

    console.info("[HyperscapeService] Created real Hyperscape world instance");

    this.playwrightManager = new PlaywrightManager(this.runtime);
    this.emoteManager = new EmoteManager(this.runtime);
    this.messageManager = new MessageManager(this.runtime);
    this.voiceManager = new VoiceManager(this.runtime);
    this.behaviorManager = new BehaviorManager(this.runtime);
    this.buildManager = new BuildManager(this.runtime);
    this.dynamicActionLoader = new DynamicActionLoader(this.runtime);

    // Initialize world systems using the real world instance
    const livekit = new AgentLiveKit(this.world);
    this.world.systems.push(livekit);

    const actions = new AgentActions(this.world);
    this.world.systems.push(actions);

    // Register ClientInput as controls - this provides both human and agent control
    this.world.register("controls", ClientInput);

    const loader = new AgentLoader(this.world);
    this.world.systems.push(loader);

    const environment = new EnvironmentSystem(this.world);
    this.world.systems.push(environment);

    console.info(
      "[HyperscapeService] Hyperscape world initialized successfully",
    );

    this.voiceManager.start();

    this.behaviorManager.start();

    this.subscribeToHyperscapeEvents();

    this.isServiceConnected = true;

    this.connectionTime = Date.now();

    console.info(`HyperscapeService connected successfully to ${config.wsUrl}`);

    // Initialize managers
    await this.emoteManager.uploadEmotes();

    // Discover and load dynamic actions
    const discoveredActions = await this.dynamicActionLoader.discoverActions(
      this.world,
    );
    console.info(
      `[HyperscapeService] Discovered ${discoveredActions.length} dynamic actions`,
    );

    for (const actionDescriptor of discoveredActions) {
      await this.dynamicActionLoader.registerAction(
        actionDescriptor,
        this.runtime,
      );
    }
    // Don't auto-load any content - it will be loaded on demand

    // Access appearance data for validation
    if (this.world?.entities.player?.data.appearance) {
      const appearance = this.world.entities.player.data.appearance;
      console.debug("[Appearance] Current appearance data available");
    }
  }

  private subscribeToHyperscapeEvents(): void {
    if (!this.world) return;
    this.world.off("disconnect");

    this.world.on("disconnect", (data: unknown) => {
      const disconnectData = data as Record<string, unknown> | string;
      // Data is either a string reason or an object with reason property
      const reason =
        (typeof disconnectData === "object" &&
        disconnectData !== null &&
        "reason" in disconnectData
          ? (disconnectData as { reason?: string }).reason
          : typeof disconnectData === "string"
            ? disconnectData
            : undefined) || "Unknown reason";
      console.warn(`Hyperscape world disconnected: ${reason}`);
      this.runtime.emitEvent(EventType.WORLD_LEFT, {
        runtime: this.runtime,
        eventName: "HYPERSCAPE_DISCONNECTED",
        data: { worldId: this._currentWorldId, reason },
      });
      this.handleDisconnect();
    });

    this.startChatSubscription();
  }

  private async uploadCharacterAssets(): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.world?.entities.player) {
      return { success: false, error: "Player entity not available" };
    }
    const agentPlayer = this.world.entities.player;
    const localAvatarPath = path.resolve(LOCAL_AVATAR_PATH);

    console.info(`[Appearance] Reading avatar file from: ${localAvatarPath}`);
    const fileBuffer: Buffer = await fsPromises.readFile(localAvatarPath);
    const fileName = path.basename(localAvatarPath);
    const mimeType = fileName.endsWith(".vrm")
      ? "model/gltf-binary"
      : "application/octet-stream";

    console.info(
      `[Appearance] Uploading ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB, Type: ${mimeType})...`,
    );

    const hash = await hashFileBuffer(fileBuffer);
    const ext = fileName.split(".").pop()!.toLowerCase();
    const fullFileNameWithHash = `${hash}.${ext}`;
    if (!this.world) {
      return { success: false, error: "World not available" };
    }
    const baseUrl = this.world.assetsUrl.replace(/\/$/, "");
    const constructedHttpUrl = `${baseUrl}/${fullFileNameWithHash}`;

    // Strong type assumption - network has upload method
    const network = this.world.network as UploadableNetwork;

    console.info(`[Appearance] Uploading avatar to ${constructedHttpUrl}...`);
    const fileArrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    ) as ArrayBuffer;
    const fileForUpload = new File(
      [new Uint8Array(fileArrayBuffer)],
      fileName,
      {
        type: mimeType,
      },
    );

    // Strong type assumption - network has upload method
    const uploadPromise = network.upload(fileForUpload);
    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(
        () => reject(new Error("Upload timed out")),
        NETWORK_CONFIG.UPLOAD_TIMEOUT_MS,
      ),
    );

    await Promise.race([uploadPromise, timeoutPromise]);
    console.info("[Appearance] Avatar uploaded successfully.");
    (agentPlayer as ModifiablePlayer).setSessionAvatar(constructedHttpUrl);

    if (this.emoteManager) {
      await this.emoteManager.uploadEmotes();
    }

    // Assume send method exists on network
    if (this.world?.network) {
      this.world.network.send("playerSessionAvatar", {
        avatar: constructedHttpUrl,
      });
      console.info(
        `[Appearance] Sent playerSessionAvatar with: ${constructedHttpUrl}`,
      );
    }

    return { success: true };
  }

  private startAppearancePolling(): void {
    if (this.appearanceRefreshInterval) {
      clearInterval(this.appearanceRefreshInterval);
    }
    const pollingTasks = {
      avatar: this.appearanceHash !== null,
      name: this.world?.entities?.player?.data?.name !== undefined,
    };

    if (pollingTasks.avatar && pollingTasks.name) {
      console.info("[Appearance/Name Polling] Already set, skipping start.");
      return;
    }
    console.info(
      `[Appearance/Name Polling] Initializing interval every ${AGENT_CONFIG.APPEARANCE_POLL_INTERVAL_MS}ms.`,
    );

    const f = async () => {
      if (pollingTasks.avatar && pollingTasks.name) {
        if (this.appearanceRefreshInterval) {
          clearInterval(this.appearanceRefreshInterval);
        }
        this.appearanceRefreshInterval = null;
        console.info(
          "[Appearance/Name Polling] Both avatar and name set. Polling stopped.",
        );
        return;
      }

      const agentPlayer = this.world?.entities?.player;
      const agentPlayerReady = !!agentPlayer;
      const agentPlayerId = agentPlayer?.data?.id;
      const agentPlayerIdReady = !!agentPlayerId;
      const networkReady = this.world?.network.id !== null;
      const assetsUrlReady = !!this.world?.assetsUrl;

      console.log("agentPlayerReady", agentPlayerReady);
      console.log("agentPlayerIdReady", agentPlayerIdReady);
      console.log("networkReady", networkReady);
      if (agentPlayerReady && agentPlayerIdReady && networkReady) {
        const entityId = createUniqueUuid(this.runtime, this.runtime.agentId);
        const entity = await this.runtime.getEntityById(entityId);

        if (entity) {
          // Add or update the appearance component
          entity.components = entity.components || [];
          const appearanceComponent = entity.components.find(
            (c) => c.type === "appearance",
          );
          if (appearanceComponent) {
            const appearance = this.world?.entities.player?.data.appearance;
            if (appearance) {
              appearanceComponent.data = {
                appearance,
              };
            }
          } else {
            const appearance = this.world?.entities.player?.data.appearance;
            if (appearance) {
              const newComponent: Partial<ElizaComponent> = {
                type: "appearance",
                data: { appearance },
              };
              entity.components.push(newComponent as ElizaComponent);
            }
          }
          // Cast runtime to include updateEntity and call it directly
          const runtimeWithUpdate = this.runtime as IAgentRuntime & {
            updateEntity: (entity: unknown) => Promise<void>;
          };
          await runtimeWithUpdate.updateEntity(entity);
        }

        // Also attempt to change name on first appearance
        if (!this.hasChangedName) {
          const character = this.runtime.character;
          await this.changeName(character.name);
          this.hasChangedName = true;
          console.info(
            `[Name Polling] Initial name successfully set to "${character.name}".`,
          );
        }

        if (!pollingTasks.avatar && assetsUrlReady) {
          console.info(
            `[Appearance Polling] Player (ID: ${agentPlayerId}), network, assetsUrl ready. Attempting avatar upload and set...`,
          );
          const result = await this.uploadCharacterAssets();

          if (result.success) {
            const hashValue = await hashFileBuffer(
              Buffer.from(JSON.stringify(result.success)),
            );
            this.appearanceHash = hashValue;
            pollingTasks.avatar = true;
            console.info(
              "[Appearance Polling] Avatar setting process successfully completed.",
            );
          } else {
            console.warn(
              `[Appearance Polling] Avatar setting process failed: ${result.error || "Unknown reason"}. Will retry...`,
            );
          }
        } else if (!pollingTasks.avatar) {
          console.debug(
            `[Appearance Polling] Waiting for: Assets URL (${assetsUrlReady})...`,
          );
        }
      } else {
        console.debug(
          `[Appearance/Name Polling] Waiting for: Player (${agentPlayerReady}), Player ID (${agentPlayerIdReady}), Network (${networkReady})...`,
        );
      }
    };
    this.appearanceRefreshInterval = setInterval(
      f,
      AGENT_CONFIG.APPEARANCE_POLL_INTERVAL_MS,
    );
    f();
  }

  // Removed type guard - assume updateEntity exists when needed

  private stopAppearancePolling(): void {
    if (this.appearanceRefreshInterval) {
      clearInterval(this.appearanceRefreshInterval);
      this.appearanceRefreshInterval = null;
      console.info("[Appearance Polling] Stopped.");
    }
  }

  public isConnected(): boolean {
    return this.isServiceConnected;
  }

  public getEntityById(entityId: string): Entity | null {
    return this.world?.entities?.items?.get(entityId) || null;
  }

  public getEntityName(entityId: string): string | null {
    const entity = this.world?.entities?.items?.get(entityId);
    return (
      entity?.data?.name ||
      ((entity as Entity)?.metadata?.hyperscape as { name: string })?.name ||
      "Unnamed"
    );
  }

  async handleDisconnect(): Promise<void> {
    if (!this.isServiceConnected && !this.world) {
      return;
    }
    console.info("Handling Hyperscape disconnection...");
    this.isServiceConnected = false;

    this.stopAppearancePolling();

    if (this.world) {
      console.info(
        "[Hyperscape Cleanup] Calling world.disconnect() and world.destroy()...",
      );
      await this.world.disconnect();
      this.world.destroy();
    }

    this.world = null;
    this.connectionTime = null;

    if (this.appearanceRefreshInterval) {
      clearInterval(this.appearanceRefreshInterval);
      this.appearanceRefreshInterval = null;
    }

    if (this.dynamicActionLoader) {
      // Unregister all dynamic actions
      const registeredActions = this.dynamicActionLoader.getRegisteredActions();
      for (const [actionName, _] of registeredActions) {
        await this.dynamicActionLoader.unregisterAction(
          actionName,
          this.runtime,
        );
      }
      this.dynamicActionLoader.clear();
      this.dynamicActionLoader = null;
    }

    // Clean up loaded content
    for (const [contentId, content] of this.loadedContent) {
      // Assume uninstall is a function
      await (content as { uninstall: () => Promise<void> }).uninstall();
    }
    this.loadedContent.clear();

    console.info("Hyperscape disconnection handling complete.");
  }

  async disconnect(): Promise<void> {
    console.info(
      `Disconnecting HyperscapeService from world ${this._currentWorldId}`,
    );
    await this.handleDisconnect();

    // Assume emitEvent is a function
    (
      this.runtime as {
        emitEvent: (type: EventType, data: unknown) => void;
      }
    ).emitEvent(EventType.WORLD_LEFT, {
      runtime: this.runtime,
      worldId: this._currentWorldId,
    });

    this.world = null;
    this.isServiceConnected = false;
    this._currentWorldId = null;
    console.info("HyperscapeService disconnect complete.");
  }

  // Removed type guard - assume disconnect exists when needed

  async changeName(newName: string): Promise<void> {
    if (!this.world?.entities.player?.data.id) {
      throw new Error("Player entity not available");
    }
    const agentPlayerId = this.world.entities.player.data.id;

    console.info(
      `[Action] Attempting to change name to "${newName}" for ID ${agentPlayerId}`,
    );

    // Update the name map
    if (this.playerNamesMap.has(agentPlayerId)) {
      console.info(
        `[Name Map Update] Setting name via changeName for ID ${agentPlayerId}: '${newName}'`,
      );
      this.playerNamesMap.set(agentPlayerId, newName);
    } else {
      console.warn(
        `[Name Map Update] Attempted changeName for ID ${agentPlayerId} not currently in map. Adding.`,
      );
      this.playerNamesMap.set(agentPlayerId, newName);
    }

    // --- Use agentPlayer.modify for local update --- >
    const agentPlayer = this.world?.entities.player;
    if (!agentPlayer) {
      throw new Error("Player entity not available");
    }
    (agentPlayer as ModifiablePlayer).modify({ name: newName });
    agentPlayer.data.name = newName;

    if (this.world?.network) {
      this.world.network.send("entityModified", {
        id: agentPlayer.data.id,
        name: newName,
      });
    }
    console.debug(`[Action] Called agentPlayer.modify({ name: "${newName}" })`);
  }

  async stop(): Promise<void> {
    console.info("*** Stopping Hyperscape service instance ***");
    await this.disconnect();
  }

  private startChatSubscription(): void {
    console.info("[HyperscapeService] Initializing chat subscription...");
    if (!this.world?.chat) return;

    // Pre-populate processed IDs with existing messages
    (this.world.chat as ChatSystem).msgs.forEach((msg: ChatMessage) => {
      this.processedMsgIds.add(msg.id);
    });

    this.world.chat.subscribe((msgs: ChatMessage[]) => {
      const chatMessages = msgs as ChatMessage[];

      const newMessagesFound: ChatMessage[] = []; // Temporary list for new messages

      // Step 1: Identify new messages and update processed set
      chatMessages.forEach((msg: ChatMessage) => {
        // Check timestamp FIRST - only consider messages newer than connection time
        const messageTimestamp = new Date(msg.createdAt).getTime();
        if (messageTimestamp <= this.connectionTime!) {
          // Ensure historical messages are marked processed if encountered *before* connectionTime was set (edge case)
          if (!this.processedMsgIds.has(msg.id.toString())) {
            this.processedMsgIds.add(msg.id.toString());
          }
          return; // Skip this message
        }

        // Check if we've already processed this message ID (secondary check for duplicates)
        const msgIdStr = msg.id.toString();
        if (!this.processedMsgIds.has(msgIdStr)) {
          newMessagesFound.push(msg); // Add the full message object
          this.processedMsgIds.add(msgIdStr); // Mark ID as processed immediately
        }
      });

      // Step 2: Process only the newly found messages
      if (newMessagesFound.length > 0) {
        console.info(
          `[Chat] Found ${newMessagesFound.length} new messages to process.`,
        );

        newMessagesFound.forEach(async (msg: ChatMessage) => {
          if (this.messageManager) {
            await this.messageManager.handleMessage(msg);
          }
        });
      }
    });
  }

  getEmoteManager() {
    return this.emoteManager;
  }

  getBehaviorManager() {
    return this.behaviorManager;
  }

  getMessageManager() {
    return this.messageManager;
  }

  getVoiceManager() {
    return this.voiceManager;
  }

  getPlaywrightManager() {
    return this.playwrightManager;
  }

  getBuildManager(): BuildManager | null {
    return this.buildManager;
  }

  getMultiAgentManager() {
    return this.multiAgentManager;
  }

  setMultiAgentManager(manager: MultiAgentManager) {
    this.multiAgentManager = manager;
  }

  getDynamicActionLoader() {
    return this.dynamicActionLoader;
  }

  /**
   * Load UGC content bundle into the current world
   */
  async loadUGCContent(
    contentId: string,
    contentBundle: ContentBundle,
  ): Promise<boolean> {
    if (this.loadedContent.has(contentId)) {
      console.warn(
        `[HyperscapeService] Content ${contentId} already loaded. Unloading first...`,
      );
      await this.unloadUGCContent(contentId);
    }

    console.info(`[HyperscapeService] Loading UGC content: ${contentId}`);

    // Install the content bundle
    if (!this.world) {
      throw new Error("World not available");
    }
    if (!contentBundle.install) {
      throw new Error("Content bundle does not have install method");
    }
    const instance = await contentBundle.install(this.world, this.runtime);
    this.loadedContent.set(contentId, instance);

    // Handle actions from the content bundle
    if (contentBundle.actions) {
      console.info(
        `[HyperscapeService] Registering ${contentBundle.actions.length} actions from ${contentId}`,
      );
      for (const action of contentBundle.actions) {
        // Register each action with the runtime
        await this.runtime.registerAction(action);
      }
    }

    // Handle providers from the content bundle
    if (contentBundle.providers) {
      console.info(
        `[HyperscapeService] Registering ${contentBundle.providers.length} providers from ${contentId}`,
      );
      for (const provider of contentBundle.providers) {
        // Register each provider with the runtime
        await this.runtime.registerProvider(provider);
      }
    }

    // Support for dynamic action discovery via the dynamic loader
    if (contentBundle.dynamicActions) {
      console.info(
        `[HyperscapeService] Discovering dynamic actions from ${contentId}`,
      );
      const discoveredActions = contentBundle.dynamicActions;
      for (const actionDescriptor of discoveredActions) {
        if (this.dynamicActionLoader) {
          await this.dynamicActionLoader.registerAction(
            actionDescriptor,
            this.runtime,
          );
        }
      }
    }

    // Emit event for content loaded
    this.runtime.emitEvent(EventType.WORLD_JOINED, {
      runtime: this.runtime,
      eventName: "UGC_CONTENT_LOADED",
      data: {
        contentId: contentId,
        contentName: contentBundle.name || contentId,
        features: contentBundle.config?.features || {},
        actionsCount: contentBundle.actions?.length || 0,
        providersCount: contentBundle.providers?.length || 0,
      },
    });

    console.info(
      `[HyperscapeService] UGC content ${contentId} loaded successfully`,
    );
    return true;
  }

  /**
   * Unload UGC content
   */
  async unloadUGCContent(contentId: string): Promise<boolean> {
    const content = this.loadedContent.get(contentId)!;

    console.info(`[HyperscapeService] Unloading UGC content: ${contentId}`);

    // First, unregister any actions that were registered
    if (content.actions) {
      console.info(
        `[HyperscapeService] Unregistering ${content.actions.length} actions from ${contentId}`,
      );
      for (const action of content.actions) {
        // Cast runtime to include unregisterAction
        const runtimeWithUnregister = this.runtime as IAgentRuntime & {
          unregisterAction: (name: string) => Promise<void>;
        };
        await runtimeWithUnregister.unregisterAction(action.name);
      }
    }

    // Unregister any providers that were registered
    if (content.providers) {
      console.info(
        `[HyperscapeService] Unregistering ${content.providers.length} providers from ${contentId}`,
      );
      for (const provider of content.providers) {
        // Cast runtime to include unregisterProvider
        const runtimeWithUnregisterProvider = this.runtime as IAgentRuntime & {
          unregisterProvider: (name: string) => Promise<void>;
        };
        await runtimeWithUnregisterProvider.unregisterProvider(provider.name);
      }
    }

    // Unregister any dynamic actions
    if (content.dynamicActions) {
      console.info(
        `[HyperscapeService] Unregistering ${content.dynamicActions.length} dynamic actions from ${contentId}`,
      );
      for (const actionName of content.dynamicActions) {
        if (this.dynamicActionLoader) {
          await this.dynamicActionLoader.unregisterAction(
            actionName,
            this.runtime,
          );
        }
      }
    }

    // Call the content's uninstall method
    await (content as { uninstall: () => Promise<void> }).uninstall();

    this.loadedContent.delete(contentId);

    // Emit event for content unloaded
    this.runtime.emitEvent(EventType.WORLD_LEFT, {
      runtime: this.runtime,
      eventName: "UGC_CONTENT_UNLOADED",
      data: {
        contentId: contentId,
      },
    });

    console.info(
      `[HyperscapeService] UGC content ${contentId} unloaded successfully`,
    );
    return true;
  }

  // Removed type guard - assume unregisterAction exists when needed

  // Removed type guard - assume unregisterProvider exists when needed

  /**
   * Get loaded UGC content instance
   */
  getLoadedContent(contentId: string): ContentInstance | null {
    return this.loadedContent.get(contentId) || null;
  }

  /**
   * Check if UGC content is loaded
   */
  isContentLoaded(contentId: string): boolean {
    return this.loadedContent.has(contentId);
  }

  async initialize(): Promise<void> {
    // Initialize managers
    this.playwrightManager = new PlaywrightManager(this.runtime);
    this.emoteManager = new EmoteManager(this.runtime);
    this.messageManager = new MessageManager(this.runtime);
    this.voiceManager = new VoiceManager(this.runtime);
    this.behaviorManager = new BehaviorManager(this.runtime);
    this.buildManager = new BuildManager(this.runtime);
    this.dynamicActionLoader = new DynamicActionLoader(this.runtime);

    logger.info("[HyperscapeService] Service initialized successfully");
  }

  getRPGStateManager(): RPGStateManager | null {
    // Return RPG state manager for testing
    return null;
  }

  /**
   * Create a minimal world implementation with proper physics
   */
  private createWorld(config: MockWorldConfig): World {
    console.info("[MinimalWorld] Creating minimal world with physics");

    const minimalWorld: Partial<World> = {
      // Core world properties
      systems: [],

      // Configuration
      assetsUrl: config.assets?.[0] || "https://assets.hyperscape.io",

      // Physics system - cast as any to avoid type issues with mock
      physics: {
        enabled: true,
        gravity: { x: 0, y: -9.81, z: 0 },
        timeStep: 1 / 60,
        world: null, // Will be set after PhysX loads
        controllers: new Map<string, CharacterController>(),
        rigidBodies: new Map<string, any>(),

        // Physics helper methods
        createRigidBody: (
          _type: "static" | "dynamic" | "kinematic",
          _position?: Vector3,
          _rotation?: Quaternion,
        ): RigidBody => {
          console.log(
            "[MinimalWorld Physics] Creating rigid body:",
            _type,
            _position,
          );
          const _velocity = new THREE.Vector3();
          const _angularVelocity = new THREE.Vector3();
          return {
            type: _type,
            position: _position,
            rotation: _rotation,
            velocity: _velocity,
            angularVelocity: _angularVelocity,
            mass: 1,
            applyForce: (force: Vector3) => {
              console.log("[MinimalWorld Physics] Applying force:", force);
            },
            applyImpulse: (impulse: Vector3) => {
              console.log("[MinimalWorld Physics] Applying impulse:", impulse);
            },
            setLinearVelocity: (velocity: Vector3) => {
              console.log(
                "[MinimalWorld Physics] Setting linear velocity:",
                velocity,
              );
            },
            setAngularVelocity: (velocity: Vector3) => {
              console.log(
                "[MinimalWorld Physics] Setting angular velocity:",
                velocity,
              );
            },
          };
        },

        createCharacterController: (
          options: CharacterControllerOptions & {
            id?: string;
            position?: Position;
            maxSpeed?: number;
          },
        ) => {
          const controllerId = options.id || `controller-${Date.now()}`;
          console.log(
            "[MinimalWorld Physics] Creating character controller:",
            controllerId,
          );

          // Create simple position objects that satisfy the Vector3 interface
          const createVector3 = (
            x: number = 0,
            y: number = 0,
            z: number = 0,
          ): Vector3 => {
            return { x, y, z } as Vector3;
          };

          const controller: CharacterController = {
            id: controllerId,
            position: options.position || createVector3(),
            velocity: createVector3(),
            isGrounded: true,
            radius: options.radius || 0.5,
            height: options.height || 1.8,
            maxSpeed: options.maxSpeed || 5.0,

            move: (displacement: Position) => {
              const dt = minimalWorld.physics!.timeStep;

              // Apply horizontal movement (velocity-based)
              controller.velocity.x = displacement.x;
              controller.velocity.z = displacement.z;

              // Apply gravity if not grounded
              if (!controller.isGrounded) {
                controller.velocity.y += minimalWorld.physics!.gravity.y * dt;
              }

              // Update position based on velocity
              controller.position.x += controller.velocity.x * dt;
              controller.position.y += controller.velocity.y * dt;
              controller.position.z += controller.velocity.z * dt;

              // Ground check (simple)
              if (controller.position.y <= 0) {
                controller.position.y = 0;
                controller.velocity.y = 0;
                controller.isGrounded = true;
              } else {
                controller.isGrounded = false;
              }

              console.log(
                `[Physics] Controller ${controllerId} moved to (${controller.position.x.toFixed(2)}, ${controller.position.y.toFixed(2)}, ${controller.position.z.toFixed(2)})`,
              );
            },

            jump: () => {
              if (controller.isGrounded) {
                controller.velocity.y = 10.0; // Jump velocity
                controller.isGrounded = false;
                console.log(`[Physics] Controller ${controllerId} jumped`);
              }
            },

            walkToward: (
              direction: { x: number; z: number },
              speed: number = 5.0,
            ) => {
              // Normalize direction vector
              const length = Math.sqrt(
                direction.x * direction.x + direction.z * direction.z,
              );
              if (length > 0) {
                const normalizedDir = {
                  x: (direction.x / length) * speed,
                  y: 0, // Don't move vertically when walking
                  z: (direction.z / length) * speed,
                };
                controller.move(normalizedDir as Position);
                return controller.position;
              }
              return controller.position;
            },

            setPosition: (position: Position) => {
              Object.assign(controller.position, position);
              controller.velocity = createVector3();
              controller.isGrounded = position.y <= 0.1;
            },

            getPosition: () => controller.position,
            getVelocity: () => controller.velocity,
          };

          // Store controller for physics updates
          minimalWorld.physics!.controllers.set(controllerId, controller);

          return controller;
        },

        // Physics simulation step
        step: (deltaTime: number) => {
          // Simple physics simulation
          for (const [id, controller] of minimalWorld.physics!.controllers) {
            // Update entity position based on physics
            const entity =
              minimalWorld.entities!.items.get(id) ||
              minimalWorld.entities!.players.get(id);
            if (entity && entity.position) {
              entity.position.x = controller.position.x;
              entity.position.y = controller.position.y;
              entity.position.z = controller.position.z;

              if (entity.base && entity.position) {
                entity.position.x = controller.position.x;
                entity.position.y = controller.position.y;
                entity.position.z = controller.position.z;
              }
            }
          }
        },
      } as any,

      // Network system
      network: {
        id: `network-${Date.now()}`,
        isClient: true,
        isServer: false,
        send: (type: string, data?: NetworkEventData) => {
          console.log(`[MinimalWorld] Network send: ${type}`, data);
        },
        upload: async (file: File) => {
          console.log("[MinimalWorld] File upload requested");
          return Promise.resolve(`uploaded-${Date.now()}`);
        },
        disconnect: async () => {
          console.log("[MinimalWorld] Network disconnect");
          return Promise.resolve();
        },
        maxUploadSize: 10 * 1024 * 1024,
      } as any,

      // Chat system - cast as any to avoid complex type issues
      chat: {
        msgs: [],
        listeners: [] as Array<(msgs: ChatMessage[]) => void>,
        add: (msg: ChatMessage, broadcast?: boolean) => {
          console.log("[MinimalWorld] Chat message added:", msg);
          minimalWorld.chat!.msgs.push(msg);
          // Notify listeners
          const chatListeners = (minimalWorld.chat as any).listeners as Array<
            (msgs: ChatMessage[]) => void
          >;
          for (const listener of chatListeners) {
            listener(minimalWorld.chat!.msgs);
          }
        },
        subscribe: ((callback: (msgs: ChatMessage[]) => void) => {
          console.log("[MinimalWorld] Chat subscription added");
          const chatListeners = (minimalWorld.chat as any).listeners as Array<
            (msgs: ChatMessage[]) => void
          >;
          chatListeners.push(callback);
          const subscription = {
            unsubscribe: () => {
              const index = chatListeners.indexOf(callback);
              if (index >= 0) {
                chatListeners.splice(index, 1);
              }
            },
            get active() {
              return chatListeners.indexOf(callback) >= 0;
            },
          };
          return subscription;
        }) as any,
      } as any,

      // Events system - cast as any to avoid complex type issues
      events: Object.assign(
        function <T extends string | symbol>(event: T) {
          // Default listener getter for compatibility
          return (minimalWorld.events as any).__listeners?.get(event) || [];
        },
        {
          listeners: new Map<string, ((data: unknown) => void)[]>() as any,
          __listeners: new Map<
            string | symbol,
            Set<(...args: unknown[]) => void>
          >(),
          emit: function <T extends string | symbol>(
            event: T,
            ...args: unknown[]
          ): boolean {
            console.log(`[MinimalWorld] Event emitted: ${String(event)}`, args);
            const listeners = this.__listeners.get(event);
            if (listeners) {
              for (const listener of listeners) {
                listener(...args);
              }
            }
            return true;
          },
          on: function <T extends string | symbol>(
            event: T,
            fn: (...args: unknown[]) => void,
            _context?: unknown,
          ) {
            console.log(
              `[MinimalWorld] Event listener added: ${String(event)}`,
            );
            if (!this.__listeners.has(event)) {
              this.__listeners.set(event, new Set());
            }
            this.__listeners.get(event)!.add(fn);
            return this;
          },
          off: function <T extends string | symbol>(
            event: T,
            fn?: (...args: unknown[]) => void,
            _context?: unknown,
            _once?: boolean,
          ) {
            console.log(
              `[MinimalWorld] Event listener removed: ${String(event)}`,
            );
            if (fn) {
              const listeners = this.__listeners.get(event);
              if (listeners) {
                listeners.delete(fn);
              }
            } else {
              this.__listeners.delete(event);
            }
            return this;
          },
        },
      ) as any,

      // Entities system - cast as any to avoid complex type issues
      entities: {
        player: null,
        players: new Map(),
        items: new Map(),
        add: ((data: any, local?: boolean) => {
          console.log("[MinimalWorld] Entity added:", data.id || "unknown");
          // Handle both Entity objects and EntityData
          let entity = data;
          if (!(data instanceof Entity)) {
            // Create a mock entity if data is EntityData
            entity = {
              id: data.id || `entity-${Date.now()}`,
              type: data.type || "generic",
              position: data.position || { x: 0, y: 0, z: 0 },
              data: data,
            };
          }
          minimalWorld.entities!.items.set(entity.id, entity);
          return entity;
        }) as ((data: EntityData, local?: boolean) => Entity) &
          ((data: unknown, local?: boolean) => unknown),
        remove: (entityId: string) => {
          console.log("[MinimalWorld] Entity removed:", entityId);
          minimalWorld.entities!.items.delete(entityId);
          minimalWorld.entities!.players.delete(entityId);
          return true;
        },
        getPlayer: () => {
          return minimalWorld.entities!.player;
        },
        getLocalPlayer: () => minimalWorld.entities!.player,
        getPlayers: () => Array.from(minimalWorld.entities!.players.values()),
      } as any,

      // Initialize method
      init: async (initConfig?: Partial<MockWorldConfig>) => {
        console.log("[MinimalWorld] Initializing with physics...");

        const playerId = `player-${Date.now()}`;

        // Create physics character controller for player
        if (!minimalWorld.physics?.createCharacterController) {
          throw new Error("Physics system not available");
        }
        const characterController =
          minimalWorld.physics.createCharacterController({
            id: playerId,
            position: { x: 0, y: 0, z: 0 } as Vector3,
            radius: 0.5,
            height: 1.8,
            maxSpeed: 5.0,
          });

        if (minimalWorld.physics?.controllers) {
          minimalWorld.physics.controllers.set(playerId, characterController);
        }

        // Create basic player entity - cast as any to avoid type issues
        minimalWorld.entities!.player = {
          id: playerId,
          type: "player",
          data: {
            id: playerId,
            type: "player",
            name: "TestPlayer",
            appearance: {},
          },
          base: {
            position: { x: 0, y: 0, z: 0 } as Vector3,
            quaternion: { x: 0, y: 0, z: 0, w: 1 } as Quaternion,
            scale: { x: 1, y: 1, z: 1 } as Vector3,
          },
          position: { x: 0, y: 0, z: 0 },

          // Physics-based movement methods
          move: (displacement: Position) => {
            console.log("[MinimalWorld] Player physics move:", displacement);
            const controller = minimalWorld.physics!.controllers.get(playerId);
            if (controller && controller.move) {
              controller.move(displacement);
            }
          },

          // Walk toward a specific position
          walkToward: (targetPosition: Position, speed: number = 5) => {
            console.log(
              "[MinimalWorld] Player walking toward:",
              targetPosition,
            );
            const currentPos = minimalWorld.entities!.player!.position!;
            const controller = minimalWorld.physics!.controllers?.get(playerId);
            if (controller && (controller as any).walkToward) {
              const direction = {
                x: targetPosition.x - currentPos.x,
                z: targetPosition.z - currentPos.z,
              };
              return (controller as any).walkToward(direction, speed);
            }
            return currentPos;
          },

          // Teleport (instant position change) - kept for compatibility
          teleport: (options: TeleportOptions) => {
            console.log("[MinimalWorld] Player teleport:", options);
            if (options.position) {
              // Update both entity and physics controller
              Object.assign(
                minimalWorld.entities!.player!.position!,
                options.position,
              );
              Object.assign(
                minimalWorld.entities!.player!.position,
                options.position,
              );

              const controller =
                minimalWorld.physics!.controllers.get(playerId);
              if (controller && controller.setPosition) {
                controller.setPosition(options.position);
              }
            }
          },

          modify: (data: EntityModificationData) => {
            console.log("[MinimalWorld] Player modify:", data);
            Object.assign(minimalWorld.entities!.player!.data, data);
          },

          setSessionAvatar: (url: string) => {
            console.log("[MinimalWorld] Player setSessionAvatar:", url);
            const player = minimalWorld.entities!.player;
            if (player && (player as any).data) {
              (player as any).data.appearance =
                (player as any).data.appearance || {};
              (player as any).data.appearance.avatar = url;
            }
          },
        } as any;

        // Start physics simulation loop
        if (
          minimalWorld.physics?.enabled &&
          minimalWorld.physics.step &&
          minimalWorld.physics.timeStep
        ) {
          const timeStep = minimalWorld.physics.timeStep;
          setInterval(() => {
            if (minimalWorld.physics?.step && minimalWorld.physics.timeStep) {
              minimalWorld.physics.step(minimalWorld.physics.timeStep);
            }
          }, timeStep * 1000); // Convert to milliseconds
        }

        console.log("[MinimalWorld] Initialized successfully");
        return Promise.resolve();
      },

      // Disconnect network
      disconnect: async () => {
        console.log("[MinimalWorld] Disconnecting...");
        if (minimalWorld.network && "disconnect" in minimalWorld.network) {
          const networkWithDisconnect =
            minimalWorld.network as NetworkSystem & {
              disconnect: () => Promise<void>;
            };
          await networkWithDisconnect.disconnect();
        }
      },

      // Cleanup
      destroy: () => {
        console.log("[MinimalWorld] Destroying...");
        minimalWorld.systems = [];
        minimalWorld.entities!.players.clear();
        minimalWorld.entities!.items.clear();
        (minimalWorld.events as any).__listeners?.clear();
        (minimalWorld.events as any).listeners?.clear();
        (minimalWorld.chat as any).listeners = [];
      },
    };

    return minimalWorld as World;
  }
}
