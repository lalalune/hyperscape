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
import { emoteUrls } from "../../data/playerEmotes";
import THREE from "../../extras/three/three";
import { readPacket, writePacket } from "../../platform/shared/packets";
import { storage } from "../../platform/shared/storage";
import {
  hashEntityId,
  parseBatchUpdate,
  UpdateFlags,
} from "../../utils/network/compression";
import type { ChatMessage, EntityData, World, WorldOptions } from "../../types";
import type {
  EntityModificationPacket,
  InventoryUpdatePacket,
  SkillsUpdatePacket,
  ResourceSnapshotPacket,
  ResourceStatePacket,
  CharacterListPacket,
  CharacterCreatedPacket,
  CharacterSelectedPacket,
  PlayerStatePacket,
  ShowToastPacket,
  TradeRequestReceivedPacket,
  TradeStartedPacket,
  TradeUpdatedPacket,
  TradeCompletedPacket,
  TradeCancelledPacket,
  TradeErrorPacket,
  SnapshotPacket,
  EntityEventPacket,
} from "../../types/network-types";
import type { Entity } from "../../entities/Entity";
import { EventType } from "../../types/events";
import { uuid } from "../../utils";
import { SystemBase } from "../shared/infrastructure/SystemBase";
import { PlayerLocal } from "../../entities/player/PlayerLocal";
import { TileInterpolator } from "./TileInterpolator";
import { type TileCoord } from "../shared/movement/TileSystem"; // Internal import within shared package

// PERFORMANCE: Reusable objects for hot path packet handling
const _v3_1 = new THREE.Vector3();
const _v3_2 = new THREE.Vector3();
const _v3_3 = new THREE.Vector3();
const _quat_1 = new THREE.Quaternion();

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
  ids: number;
  ws: WebSocket | null;
  apiUrl: string | null;
  id: string | null;
  isClient: boolean;
  isServer: boolean;
  connected: boolean;
  queue: Array<[string, unknown]>;
  serverTimeOffset: number;
  maxUploadSize: number;
  pendingModifications: Map<string, Array<EntityModificationPacket>> =
    new Map();
  pendingModificationTimestamps: Map<string, number> = new Map(); // Track when modifications were first queued
  pendingModificationLimitReached: Set<string> = new Set(); // Track entities that hit the limit (to avoid log spam)
  destroyedEntities: Set<string> = new Set(); // Track entities that have been destroyed

  // Entity ID hash lookup for compressed updates (hash → entityId)
  private entityHashToId: Map<number, string> = new Map();

  // Cache character list so UI can render even if it mounts after the packet arrives
  lastCharacterList: Array<{
    id: string;
    name: string;
    level?: number;
    lastLocation?: { x: number; y: number; z: number };
  }> | null = null;
  // Cache latest inventory per player so UI can hydrate even if it mounted late
  lastInventoryByPlayerId: Record<
    string,
    {
      playerId: string;
      items: Array<{ slot: number; itemId: string; quantity: number }>;
      coins: number;
      maxSlots: number;
    }
  > = {};
  // Cache latest skills per player so UI can hydrate even if it mounted late
  lastSkillsByPlayerId: Record<
    string,
    Record<string, { level: number; xp: number }>
  > = {};
  // Cache latest equipment per player so UI can hydrate even if it mounted late
  lastEquipmentByPlayerId: Record<string, any> = {};

  // Entity interpolation for smooth remote entity movement
  private interpolationStates: Map<string, InterpolationState> = new Map();
  private interpolationDelay: number = 100; // ms
  private maxSnapshots: number = 10;
  private extrapolationLimit: number = 500; // ms

  // Tile-based interpolation for RuneScape-style movement
  // Public to allow position sync on respawn/teleport
  public tileInterpolator: TileInterpolator = new TileInterpolator();

  // Embedded viewport configuration (read once at init)
  private embeddedCharacterId: string | null = null;
  private isEmbeddedSpectator: boolean = false;

  constructor(world: World) {
    super(world, {
      name: "client-network",
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
    this.ids = -1;
    this.ws = null;
    this.apiUrl = null;
    this.id = null;
    this.isClient = true;
    this.isServer = false;
    this.connected = false;
    this.queue = [];
    this.serverTimeOffset = 0;
    this.maxUploadSize = 0;
  }

  async init(options: WorldOptions): Promise<void> {
    const wsUrl = (options as { wsUrl?: string }).wsUrl;

    this.logger.debug(`init() called with wsUrl: ${wsUrl}`);
    this.logger.debug("Current WebSocket state", {
      hasExistingWs: !!this.ws,
      existingReadyState: this.ws?.readyState,
      connected: this.connected,
      id: this.id,
      initialized: this.initialized,
    } as unknown as Record<string, unknown>);

    const name = (options as { name?: string }).name;
    const avatar = (options as { avatar?: string }).avatar;

    if (!wsUrl) {
      console.error("[ClientNetwork] No WebSocket URL provided!");
      return;
    }

    // If we already have a working WebSocket, don't recreate
    // But if it's closed or closing, we need to reconnect
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
      this.logger.debug(
        "WebSocket already connected and working, skipping init",
      );
      this.initialized = true;
      return;
    }

    // Clean up any existing WebSocket (closed, closing, or connecting but failed)
    if (this.ws) {
      this.logger.debug(
        `Cleaning up old WebSocket (state: ${this.ws.readyState})`,
      );
      try {
        this.ws.removeEventListener("message", this.onPacket);
        this.ws.removeEventListener("close", this.onClose);
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close();
        }
      } catch {
        this.logger.debug("Error cleaning up old WebSocket");
      }
      this.ws = null;
      this.connected = false;
      this.id = null;
    }

    // Check if wsUrl already contains an authToken (e.g., from embedded viewport)
    // If so, use it as-is instead of overwriting with localStorage
    const urlHasAuthToken = wsUrl.includes("authToken=");

    let authToken = "";
    let privyUserId = "";

    if (!urlHasAuthToken && typeof localStorage !== "undefined") {
      // Only get from localStorage if URL doesn't already have authToken
      const privyToken = localStorage.getItem("privy_auth_token");
      const privyId = localStorage.getItem("privy_user_id");

      if (privyToken && privyId) {
        authToken = privyToken;
        privyUserId = privyId;
      } else {
        // Fall back to legacy auth token
        // Strong type assumption - storage.get returns unknown, we expect string
        const legacyToken = storage?.get("authToken");
        authToken = (legacyToken as string) || "";
      }
    }

    // Build WebSocket URL - preserve existing params if authToken already present
    let url: string;
    if (urlHasAuthToken) {
      // URL already has authToken (embedded mode) - use as-is
      url = wsUrl;
      this.logger.debug("Using authToken from URL (embedded mode)");
    } else {
      // Normal mode - add authToken from localStorage
      url = `${wsUrl}?authToken=${authToken}`;
      if (privyUserId) url += `&privyUserId=${encodeURIComponent(privyUserId)}`;
    }
    if (name) url += `&name=${encodeURIComponent(name)}`;
    if (avatar) url += `&avatar=${encodeURIComponent(avatar)}`;

    // Read embedded configuration once at initialization
    if (typeof window !== "undefined") {
      const isEmbedded = (window as { __HYPERSCAPE_EMBEDDED__?: boolean })
        .__HYPERSCAPE_EMBEDDED__;
      const embeddedConfig = (
        window as {
          __HYPERSCAPE_CONFIG__?: { mode?: string; characterId?: string };
        }
      ).__HYPERSCAPE_CONFIG__;

      if (isEmbedded && embeddedConfig) {
        this.isEmbeddedSpectator = embeddedConfig.mode === "spectator";
        this.embeddedCharacterId = embeddedConfig.characterId || null;

        this.logger.debug("[ClientNetwork] Embedded config loaded", {
          isSpectator: this.isEmbeddedSpectator,
          hasCharacterId: !!this.embeddedCharacterId,
        } as unknown as Record<string, unknown>);
      }
    }

    // console.debug('[ClientNetwork] Connecting to WebSocket:', url)

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.logger.warn("WebSocket connection timeout");
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);

      this.ws.addEventListener("open", () => {
        if (!settled) {
          settled = true;
          this.logger.debug("WebSocket connected successfully");
          this.connected = true;
          this.initialized = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.ws.addEventListener("message", this.onPacket);
      this.ws.addEventListener("close", this.onClose);

      // Handle close during connection (before open fires)
      this.ws.addEventListener("close", (e) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          const reason = e.reason || "Connection closed before establishing";
          this.logger.error(
            "WebSocket closed during connection",
            new Error(reason),
          );
          reject(
            new Error(
              `WebSocket connection failed: ${reason} (code: ${e.code})`,
            ),
          );
        }
      });

      this.ws.addEventListener("error", (e) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          const errorMessage =
            e instanceof ErrorEvent ? e.message : "WebSocket connection failed";
          this.logger.error("WebSocket error", new Error(errorMessage));
          reject(new Error(errorMessage));
        }
      });
    });
  }

  preFixedUpdate() {
    this.flush();

    // Periodically clean up stale pending modifications (every ~5 seconds at 60fps = ~300 frames)
    // Only check occasionally to avoid performance impact
    if (Math.random() < 0.003) {
      this.cleanupStalePendingModifications();
    }
  }

  /**
   * Clean up pending modifications that are too old (entity never arrived)
   */
  private cleanupStalePendingModifications(): void {
    const now = performance.now();
    const staleTimeout = 10000; // 10 seconds

    for (const [
      entityId,
      timestamp,
    ] of this.pendingModificationTimestamps.entries()) {
      const age = now - timestamp;
      if (age > staleTimeout) {
        // Silent cleanup to avoid log spam
        this.pendingModifications.delete(entityId);
        this.pendingModificationTimestamps.delete(entityId);
        this.pendingModificationLimitReached.delete(entityId);
      }
    }
  }

  send<T = unknown>(name: string, data?: T) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // console.debug(`[ClientNetwork] Sending packet: ${name}`, data)
      const packet = writePacket(name, data);
      this.ws.send(packet);
    } else {
      console.warn(
        `[ClientNetwork] Cannot send ${name} - WebSocket not open. State:`,
        {
          hasWs: !!this.ws,
          readyState: this.ws?.readyState,
          connected: this.connected,
          id: this.id,
        },
      );
    }
  }

  enqueue(method: string, data: unknown) {
    this.queue.push([method, data]);
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
        console.error(`[ClientNetwork] No handler for packet '${method}'`);
        continue; // Skip unknown packets instead of throwing to avoid breaking queue
      }
      try {
        // Strong type assumption - handler is a function
        const result = (handler as Function).call(this, data);
        if (result instanceof Promise) {
          await result;
        }
      } catch (err) {
        console.error(
          `[ClientNetwork] Error handling packet '${method}':`,
          err,
        );
        // Continue processing remaining packets even if one fails
      }
    }
  }

  getTime() {
    return (performance.now() + this.serverTimeOffset) / 1000; // seconds
  }

  onPacket = (e: MessageEvent) => {
    const result = readPacket(e.data);
    if (result && result[0]) {
      const [method, data] = result;
      this.enqueue(method, data);
    }
  };

  async onSnapshot(data: SnapshotPacket) {
    this.id = data.id; // Store our network ID
    this.connected = true; // Mark as connected when we get the snapshot

    // Ensure world.network points to this instance and has our ID
    if (
      !this.world.network ||
      (this.world.network as { id?: string }).id !== this.id
    ) {
      (this.world as { network?: unknown }).network = this;
    }

    // Check if this is a spectator connection (from server snapshot)
    const isSpectatorMode =
      (data as { spectatorMode?: boolean }).spectatorMode === true;
    const followEntityId = (data as { followEntity?: string }).followEntity;

    if (isSpectatorMode) {
      this.logger.info(
        "👁️ Spectator mode detected - skipping character selection and enterWorld",
      );
      this.logger.info(
        `👁️ Spectator snapshot contains ${data.entities?.length || 0} entities`,
      );
      // Spectators don't spawn player entities - they just receive broadcasts
      // Store followEntity for camera setup after entities are loaded
      if (followEntityId) {
        this.logger.info(`👁️ Spectator will follow entity: ${followEntityId}`);
        (this as any).spectatorFollowEntity = followEntityId;
      }
      // Continue to entity processing below
    } else {
      // Auto-enter world if in character-select mode and we have a selected character
      const isCharacterSelectMode =
        Array.isArray(data.entities) &&
        data.entities.length === 0 &&
        Array.isArray((data as { characters?: unknown[] }).characters);

      this.logger.debug("Snapshot received - checking character select mode");

      // Handle character selection and world entry (non-spectators only)
      if (isCharacterSelectMode) {
        // Get characterId from embedded config (read at init) OR localStorage
        const characterId =
          this.embeddedCharacterId ||
          (typeof localStorage !== "undefined"
            ? localStorage.getItem("selectedCharacterId")
            : null);

        if (characterId) {
          this.logger.debug(`Auto-selecting character: ${characterId}`, {
            isEmbedded: this.isEmbeddedSpectator,
          } as unknown as Record<string, unknown>);

          // Embedded spectator mode needs characterSelected packet first
          if (this.isEmbeddedSpectator) {
            this.send("characterSelected", { characterId });
          }

          // Both modes need enterWorld to spawn the character
          this.send("enterWorld", { characterId });

          this.logger.debug("Character selection packets sent");
        } else {
          // Check if we're in dev mode (no character selection required)
          // In dev mode, auto-enter world without a character ID
          const isDevMode =
            typeof window !== "undefined" &&
            (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env
              ?.DEV === true;

          if (isDevMode) {
            this.logger.info(
              "Dev mode: Auto-entering world without character ID",
            );
            this.send("enterWorld", {});
          } else {
            this.logger.debug(
              "No characterId available, skipping auto-enter world",
            );
          }
        }
      }
    }
    // Ensure Physics is fully initialized before processing entities
    // This is needed because PlayerLocal uses physics extensions during construction
    if (!this.world.physics.physics) {
      // Wait a bit for Physics to initialize
      let attempts = 0;
      while (!this.world.physics.physics && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        attempts++;
      }
      if (!this.world.physics.physics) {
        this.logger.error("Physics failed to initialize after waiting");
      }
    }

    // Already set above
    this.serverTimeOffset = data.serverTime - performance.now();
    this.apiUrl = data.apiUrl || null;
    this.maxUploadSize =
      typeof data.maxUploadSize === "number"
        ? data.maxUploadSize
        : 10 * 1024 * 1024; // Default 10MB

    // Use assetsUrl from server (always absolute URL to CDN)
    this.world.assetsUrl = data.assetsUrl || "/";

    const loader = this.world.loader!;
    // Assume preload and execPreload methods exist on loader
    // preload environment model and avatar
    if (loader) {
      if (
        data.settings &&
        typeof data.settings === "object" &&
        "model" in data.settings
      ) {
        const settings = data.settings as { model?: string };
        if (settings?.model) {
          loader.preload("model", settings.model);
        }
      } else if (this.world.environment?.base?.model) {
        loader.preload("model", this.world.environment.base.model);
      }
      if (
        data.settings &&
        typeof data.settings === "object" &&
        "avatar" in data.settings
      ) {
        const settings = data.settings as { avatar?: { url?: string } };
        if (settings?.avatar?.url) {
          loader.preload("avatar", settings.avatar.url);
        }
      }
      // preload emotes
      for (const url of emoteUrls) {
        loader.preload("emote", url as string);
      }
      // We'll preload local player avatar after entities are deserialized
    }

    // Deserialize settings if method exists
    if (data.settings) {
      this.world.settings.deserialize(data.settings);
    }

    if (data.chat) {
      this.world.chat.deserialize(data.chat as ChatMessage[]);
    }
    // Deserialize entities if method exists
    if (data.entities) {
      await this.world.entities.deserialize(data.entities);

      // Now preload local player avatar after entities are created
      if (loader) {
        let playerAvatarPreloaded = false;
        for (const entity of this.world.entities.values()) {
          if (
            entity.data?.type === "player" &&
            entity.data?.owner === this.id
          ) {
            const url = entity.data.sessionAvatar || entity.data.avatar;
            if (url) {
              loader.preload("avatar", url);
              playerAvatarPreloaded = true;
              break;
            }
          }
        }
        if (!playerAvatarPreloaded) {
          // Try from the raw data if entity iteration didn't work
          for (const item of data.entities) {
            const entity = item as {
              type?: string;
              owner?: string;
              sessionAvatar?: string;
              avatar?: string;
            };
            if (entity.type === "player" && entity.owner === this.id) {
              const url = entity.sessionAvatar || entity.avatar;
              if (url) {
                loader.preload("avatar", url);
                playerAvatarPreloaded = true;
                break;
              }
            }
          }
        }
        // Now execute preload after all assets are queued
        loader.execPreload();
      }

      // Set initial serverPosition for local player immediately to avoid Y=0 flash
      for (const entityData of data.entities) {
        if (
          entityData &&
          entityData.type === "player" &&
          entityData.owner === this.id
        ) {
          const local = this.world.entities.get(entityData.id);
          if (local instanceof PlayerLocal) {
            // Force the position immediately
            const pos = entityData.position as [number, number, number];
            local.position.set(pos[0], pos[1], pos[2]);

            // Also update server position for reconciliation
            local.updateServerPosition(pos[0], pos[1], pos[2]);
          } else {
            this.logger.warn(
              "Local player entity not found after deserialize!",
            );
          }
        }
      }
      // Apply pending modifications to all newly added entities
      for (const entityData of data.entities) {
        if (entityData && entityData.id) {
          this.applyPendingModifications(entityData.id);
        }
      }
    }

    // Character-select mode: if server sent an empty entity list with account info,
    // surface the character list/modal immediately even if the dedicated packet hasn't arrived yet.
    if (
      Array.isArray(data.entities) &&
      data.entities.length === 0 &&
      (data as { account?: unknown }).account
    ) {
      const list = this.lastCharacterList || [];
      this.world.emit(EventType.CHARACTER_LIST, { characters: list });
    }

    // Spectator mode: Auto-follow the target entity after entities are loaded
    const spectatorFollowId = (this as any).spectatorFollowEntity;
    if (isSpectatorMode && spectatorFollowId) {
      // Mark that we're waiting for spectator target
      (this as any).spectatorTargetPending = true;

      const MAX_RETRY_SECONDS = 15;
      let retryCount = 0;

      // Helper to set camera target
      const setCameraTarget = (entity: unknown) => {
        const camera = this.world.getSystem("camera") as {
          setTarget?: (target: unknown) => void;
        };
        if (camera?.setTarget) {
          this.logger.info(
            `👁️ Setting camera target to entity ${spectatorFollowId}`,
          );
          camera.setTarget(entity);
        } else {
          this.logger.warn(
            "👁️ Camera system not found or missing setTarget method",
          );
        }
      };

      // Helper to attempt following the entity
      const attemptFollow = (): boolean => {
        const targetEntity =
          this.world.entities.items.get(spectatorFollowId) ||
          this.world.entities.players.get(spectatorFollowId);

        if (targetEntity) {
          // Found the entity - clear pending state and interval
          (this as any).spectatorTargetPending = false;
          if ((this as any).spectatorRetryInterval) {
            clearInterval((this as any).spectatorRetryInterval);
            (this as any).spectatorRetryInterval = null;
          }
          this.logger.info(
            `👁️ Spectator following entity ${spectatorFollowId}`,
          );
          setCameraTarget(targetEntity);
          return true;
        }
        return false;
      };

      // Try immediately after a short delay for entity initialization
      setTimeout(() => {
        if (!attemptFollow()) {
          this.logger.info(
            `👁️ Spectator target entity ${spectatorFollowId} not found - starting retry loop`,
          );

          // Start retry interval - check every 1 second for up to 15 seconds
          (this as any).spectatorRetryInterval = setInterval(() => {
            retryCount++;

            if (attemptFollow()) {
              this.logger.info(
                `👁️ Found spectator target after ${retryCount}s`,
              );
              return;
            }

            if (retryCount >= MAX_RETRY_SECONDS) {
              clearInterval((this as any).spectatorRetryInterval);
              (this as any).spectatorRetryInterval = null;
              (this as any).spectatorTargetPending = false;
              this.logger.error(
                `👁️ Agent entity ${spectatorFollowId} not found after ${MAX_RETRY_SECONDS}s`,
              );
            } else if (retryCount % 5 === 0) {
              // Log progress every 5 seconds to avoid spam
              this.logger.info(
                `👁️ Still waiting for agent entity (${retryCount}/${MAX_RETRY_SECONDS}s)...`,
              );
            }
          }, 1000);
        }
      }, 100);
    }

    if (data.livekit) {
      this.world.livekit?.deserialize(data.livekit);
    }

    storage?.set("authToken", data.authToken);
  }

  onSettingsModified = (data: {
    key: string;
    value: string | number | boolean | Record<string, unknown>;
  }) => {
    this.world.settings.set(data.key, data.value);
  };

  onChatAdded = (msg: ChatMessage) => {
    // Add message to chat if method exists
    this.world.chat.add(msg, false);
  };

  onChatCleared = () => {
    // Clear chat if method exists
    this.world.chat.clear();
  };

  onSystemMessage = (data: { message: string; type: string }) => {
    // Add system message to chat (from UI_MESSAGE events)
    // These are server-generated messages like equipment requirements, combat info, etc.
    const chatMessage: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from: "", // Empty from = system message (no [PlayerName] prefix)
      body: data.message,
      text: data.message,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };
    this.world.chat.add(chatMessage, false);
  };

  onEntityAdded = (data: EntityData) => {
    // Add entity if method exists
    const newEntity = this.world.entities.add(data);
    if (newEntity) {
      // Register entity ID hash for compressed updates
      const hash = hashEntityId(newEntity.id);
      this.entityHashToId.set(hash, newEntity.id);

      this.applyPendingModifications(newEntity.id);
      // If this is the local player added after character select, force-set initial position
      const isLocalPlayer =
        (data as { type?: string; owner?: string }).type === "player" &&
        (data as { owner?: string }).owner === this.id;
      if (
        isLocalPlayer &&
        Array.isArray((data as { position?: number[] }).position)
      ) {
        let pos = (data as { position?: number[] }).position as [
          number,
          number,
          number,
        ];
        // Safety clamp: never allow Y < 5 to prevent under-map spawn
        if (pos[1] < 5) {
          console.warn(
            `[ClientNetwork] Clamping invalid spawn Y=${pos[1]} to safe height 50`,
          );
          pos = [pos[0], 50, pos[2]];
        }
        if (newEntity instanceof PlayerLocal) {
          newEntity.position.set(pos[0], pos[1], pos[2]);
          newEntity.updateServerPosition(pos[0], pos[1], pos[2]);
        }
      }

      // Check if this is the spectator target entity we're waiting for
      const spectatorFollowId = (this as any).spectatorFollowEntity;
      const isWaitingForTarget = (this as any).spectatorTargetPending;

      if (isWaitingForTarget && data.id === spectatorFollowId) {
        this.logger.info(
          `👁️ Spectator target entity ${spectatorFollowId} just spawned!`,
        );

        // Clear retry interval if running
        if ((this as any).spectatorRetryInterval) {
          clearInterval((this as any).spectatorRetryInterval);
          (this as any).spectatorRetryInterval = null;
        }
        (this as any).spectatorTargetPending = false;

        // Set camera to follow this entity
        const camera = this.world.getSystem("camera") as {
          setTarget?: (target: unknown) => void;
        };
        if (camera?.setTarget) {
          this.logger.info(
            `👁️ Setting camera target to newly spawned entity ${spectatorFollowId}`,
          );
          camera.setTarget(newEntity);
        }
      }
    }
  };

  onEntityModified = (data: EntityModificationPacket) => {
    const { id } = data;
    const entity = this.world.entities.get(id);
    if (!entity) {
      // Check if this entity was previously destroyed
      if (this.destroyedEntities.has(id)) {
        // Entity was destroyed, ignore modifications
        this.logger.debug(`Ignoring modification for destroyed entity ${id}`);
        return;
      }

      // Limit queued modifications per entity to avoid unbounded growth
      const list = this.pendingModifications.get(id) || [];
      const now = performance.now();

      // Check if modifications are too old (>10 seconds) and drop them
      if (list.length > 0) {
        const firstTimestamp =
          this.pendingModificationTimestamps.get(id) || now;
        const age = now - firstTimestamp;
        if (age > 10000) {
          // Entity never arrived, clear the stale modifications (silent)
          this.pendingModifications.delete(id);
          this.pendingModificationTimestamps.delete(id);
          this.pendingModificationLimitReached.delete(id);
          return;
        }
      }

      if (list.length < 50) {
        list.push(data);
        this.pendingModifications.set(id, list);

        // Track timestamp of first modification
        if (list.length === 1) {
          this.pendingModificationTimestamps.set(id, now);
          // Silence first-queue log to avoid spam
        }
      } else if (!this.pendingModificationLimitReached.has(id)) {
        // Mark once then stop logging to avoid spam
        this.pendingModificationLimitReached.add(id);
      }
      // No more logging after limit is reached to prevent spam
      return;
    }
    // Accept both normalized { changes: {...} } and flat payloads { id, ...changes }
    const changes =
      data.changes ??
      Object.fromEntries(
        Object.entries(data).filter(([k]) => k !== "id" && k !== "changes"),
      );

    // Check if this is the local player
    const isLocal = (() => {
      const localEntityId = this.world.entities.player?.id;
      if (localEntityId && id === localEntityId) return true;
      const ownerId = (entity as { data?: { owner?: string } }).data?.owner;
      return !!(this.id && ownerId && ownerId === this.id);
    })();

    const hasP = Object.prototype.hasOwnProperty.call(changes, "p");
    const hasV = Object.prototype.hasOwnProperty.call(changes, "v");
    const hasQ = Object.prototype.hasOwnProperty.call(changes, "q");

    if (isLocal && (hasP || hasV || hasQ)) {
      // Local player - apply directly through entity.modify()
      // BUT: Skip position AND rotation updates if tile movement is active
      // (let tile interpolator handle them smoothly - server values cause twitching)
      if (this.tileInterpolator.hasState(id)) {
        // Tile movement active - strip position and rotation
        const { p, q, ...restChanges } = changes as Record<string, unknown>;
        entity.modify(restChanges);
      } else {
        entity.modify(changes);
      }
    } else {
      // Remote entities - use interpolation for smooth movement
      // If mob is dead (or entering dead state), clear interpolation buffer
      // This prevents sliding from stale snapshots that were added before death
      const entityData = entity.serialize();

      // Use new state if present, otherwise use current state
      // This ensures when mob respawns (changes.aiState='idle'), it's treated as alive
      // and position updates are applied correctly
      const newState = changes.aiState || entityData.aiState;
      const isDead = newState === "dead";

      // Mob AI state tracking (no logging needed in production)

      // Clear interpolation buffer for ANY dead mob (defense in depth)
      if (isDead && this.interpolationStates.has(id)) {
        this.interpolationStates.delete(id);
      }

      // Clear tile state when mob dies - they need death/respawn positions
      // Without this, position is stripped and mob can't receive death position or respawn position
      if (isDead && this.tileInterpolator.hasState(id)) {
        this.tileInterpolator.removeEntity(id);
      }

      // Skip adding new interpolation snapshots for dead mobs
      // Also skip for entities using tile movement (tile interpolator handles them)
      const hasTileState = this.tileInterpolator.hasState(id);
      if (hasP && !isDead && !hasTileState) {
        this.addInterpolationSnapshot(
          id,
          changes as {
            p?: [number, number, number];
            q?: [number, number, number, number];
            v?: [number, number, number];
          },
        );
      }

      // Still apply non-transform changes immediately
      // But strip position AND rotation for tile-moving entities
      // EXCEPTION: Dead entities need position for death/respawn (don't strip)
      // (let tile interpolator handle them smoothly - server values cause twitching)
      if (hasTileState && !isDead) {
        const {
          p: _p,
          q: _q,
          ...restChanges
        } = changes as Record<string, unknown>;
        entity.modify(restChanges);
      } else {
        entity.modify(changes);
      }

      // Re-emit normalized change event so other systems can react
      this.world.emit(EventType.ENTITY_MODIFIED, { id, changes });
    }
  };

  /**
   * Add snapshot for entity interpolation (client-side only, remote entities only)
   */
  private addInterpolationSnapshot(
    entityId: string,
    changes: {
      p?: [number, number, number];
      q?: [number, number, number, number];
      v?: [number, number, number];
    },
  ): void {
    let state = this.interpolationStates.get(entityId);
    if (!state) {
      state = this.createInterpolationState(entityId);
      this.interpolationStates.set(entityId, state);
    }

    const snapshot = state.snapshots[state.snapshotIndex];

    if (changes.p) {
      snapshot.position[0] = changes.p[0];
      snapshot.position[1] = changes.p[1];
      snapshot.position[2] = changes.p[2];
    }

    if (changes.q) {
      snapshot.rotation[0] = changes.q[0];
      snapshot.rotation[1] = changes.q[1];
      snapshot.rotation[2] = changes.q[2];
      snapshot.rotation[3] = changes.q[3];
    } else {
      snapshot.rotation[0] = state.currentRotation.x;
      snapshot.rotation[1] = state.currentRotation.y;
      snapshot.rotation[2] = state.currentRotation.z;
      snapshot.rotation[3] = state.currentRotation.w;
    }

    snapshot.timestamp = performance.now();
    state.snapshotIndex = (state.snapshotIndex + 1) % this.maxSnapshots;
    state.snapshotCount = Math.min(state.snapshotCount + 1, this.maxSnapshots);
    state.lastUpdate = performance.now();
  }

  /**
   * Create interpolation state with pre-allocated buffers
   */
  private createInterpolationState(entityId: string): InterpolationState {
    const entity = this.world.entities.get(entityId);
    const position =
      entity && "position" in entity
        ? (entity.position as THREE.Vector3).clone()
        : new THREE.Vector3();

    const rotation = entity?.node?.quaternion
      ? entity.node.quaternion.clone()
      : new THREE.Quaternion();

    const snapshots: EntitySnapshot[] = [];
    for (let i = 0; i < this.maxSnapshots; i++) {
      snapshots.push({
        position: new Float32Array(3),
        rotation: new Float32Array(4),
        timestamp: 0,
      });
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
      lastUpdate: performance.now(),
    };
  }

  /**
   * Update interpolation for remote entities (called in lateUpdate)
   */
  private updateInterpolation(delta: number): void {
    const now = performance.now();
    const renderTime = now - this.interpolationDelay;

    for (const [entityId, state] of this.interpolationStates) {
      // Skip local player - tile interpolation handles local player movement
      if (entityId === this.world.entities.player?.id) {
        this.interpolationStates.delete(entityId);
        continue;
      }

      // Skip entities that have ANY tile interpolation state
      // Once an entity uses tile movement, ALL position updates should come from tile packets
      // Using hasState() instead of isInterpolating() prevents position conflicts when entity is stationary
      if (this.tileInterpolator.hasState(entityId)) {
        continue;
      }

      const entity = this.world.entities.get(entityId);
      if (!entity) {
        this.interpolationStates.delete(entityId);
        continue;
      }

      // Skip interpolation for entities controlled by TileInterpolator
      // TileInterpolator handles position and rotation for tile-based movement
      if (entity.data?.tileInterpolatorControlled === true) {
        continue; // Don't interpolate - TileInterpolator handles this entity
      }

      // Skip interpolation for dead mobs to prevent death animation sliding
      // Dead mobs lock their position client-side for RuneScape-style stationary death
      // Check if entity has aiState property (indicates it's a MobEntity)
      const mobData = entity.serialize();
      if (mobData.aiState === "dead") {
        continue; // Don't interpolate - let MobEntity maintain locked death position
      }

      this.interpolateEntityPosition(entity, state, renderTime, now, delta);
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
    delta: number,
  ): void {
    if (state.snapshotCount < 2) {
      if (state.snapshotCount === 1) {
        const snapshot = state.snapshots[0];
        state.tempPosition.set(
          snapshot.position[0],
          snapshot.position[1],
          snapshot.position[2],
        );
        state.tempRotation.set(
          snapshot.rotation[0],
          snapshot.rotation[1],
          snapshot.rotation[2],
          snapshot.rotation[3],
        );
        this.applyInterpolated(
          entity,
          state.tempPosition,
          state.tempRotation,
          state,
          delta,
        );
      }
      return;
    }

    // Find two snapshots to interpolate between
    let older: EntitySnapshot | null = null;
    let newer: EntitySnapshot | null = null;

    for (let i = 0; i < state.snapshotCount - 1; i++) {
      const curr = state.snapshots[i];
      const next = state.snapshots[(i + 1) % this.maxSnapshots];

      if (curr.timestamp <= renderTime && next.timestamp >= renderTime) {
        older = curr;
        newer = next;
        break;
      }
    }

    if (older && newer) {
      const t =
        (renderTime - older.timestamp) / (newer.timestamp - older.timestamp);

      state.tempPosition.set(
        older.position[0] + (newer.position[0] - older.position[0]) * t,
        older.position[1] + (newer.position[1] - older.position[1]) * t,
        older.position[2] + (newer.position[2] - older.position[2]) * t,
      );

      state.tempRotation
        .set(
          older.rotation[0] + (newer.rotation[0] - older.rotation[0]) * t,
          older.rotation[1] + (newer.rotation[1] - older.rotation[1]) * t,
          older.rotation[2] + (newer.rotation[2] - older.rotation[2]) * t,
          older.rotation[3] + (newer.rotation[3] - older.rotation[3]) * t,
        )
        .normalize();

      this.applyInterpolated(
        entity,
        state.tempPosition,
        state.tempRotation,
        state,
        delta,
      );
    } else {
      // Use most recent snapshot
      const timeSinceUpdate = now - state.lastUpdate;
      if (timeSinceUpdate < this.extrapolationLimit) {
        const lastIndex =
          (state.snapshotIndex - 1 + this.maxSnapshots) % this.maxSnapshots;
        const last = state.snapshots[lastIndex];
        state.tempPosition.set(
          last.position[0],
          last.position[1],
          last.position[2],
        );
        state.tempRotation.set(
          last.rotation[0],
          last.rotation[1],
          last.rotation[2],
          last.rotation[3],
        );
        this.applyInterpolated(
          entity,
          state.tempPosition,
          state.tempRotation,
          state,
          delta,
        );
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
    delta: number,
  ): void {
    const smoothingRate = 5.0;
    const smoothingFactor = 1.0 - Math.exp(-smoothingRate * delta);

    state.currentPosition.lerp(position, smoothingFactor);
    state.currentRotation.slerp(rotation, smoothingFactor);

    if ("position" in entity) {
      const entityPos = entity.position as THREE.Vector3;
      entityPos.copy(state.currentPosition);
    }

    if (entity.node) {
      entity.node.position.copy(state.currentPosition);
      entity.node.quaternion.copy(state.currentRotation);
    }

    const player = entity as Entity & {
      base?: { position: THREE.Vector3; quaternion: THREE.Quaternion };
    };
    if (player.base) {
      player.base.position.copy(state.currentPosition);
      player.base.quaternion.copy(state.currentRotation);
    }
  }

  onEntityEvent = (event: EntityEventPacket) => {
    const { id, version, name, data } = event;
    // If event is broadcast world event, re-emit on world so systems can react
    if (id === "world") {
      this.world.emit(name, data);
      return;
    }
    const entity = this.world.entities.get(id);
    if (!entity) return;
    // Trigger entity event if method exists
    entity.onEvent(version, name, data, this.id || "");
  };

  // Dedicated resource packet handlers
  onResourceSnapshot = (data: ResourceSnapshotPacket) => {
    for (const r of data.resources) {
      this.world.emit(EventType.RESOURCE_SPAWNED, {
        id: r.id,
        type: r.type,
        position: r.position,
      });
      if (!r.isAvailable)
        this.world.emit(EventType.RESOURCE_DEPLETED, {
          resourceId: r.id,
          position: r.position,
        });
    }
  };
  onResourceSpawnPoints = (
    data: ResourceSnapshotPacket & {
      spawnPoints?: Array<{
        id: string;
        type: string;
        position: { x: number; y: number; z: number };
      }>;
    },
  ) => {
    this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, {
      spawnPoints: data.spawnPoints || [],
    });
  };
  onResourceSpawned = (data: {
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
  }) => {
    this.world.emit(EventType.RESOURCE_SPAWNED, data);
  };
  onResourceDepleted = (data: ResourceStatePacket) => {
    // Update the ResourceEntity visual
    const entity = this.world.entities.get(data.resourceId);
    if (
      entity &&
      typeof (
        entity as unknown as {
          updateFromNetwork?: (data: Record<string, unknown>) => void;
        }
      ).updateFromNetwork === "function"
    ) {
      (
        entity as unknown as {
          updateFromNetwork: (data: Record<string, unknown>) => void;
        }
      ).updateFromNetwork({ depleted: true });
    }

    // Also emit the event for other systems
    this.world.emit(EventType.RESOURCE_DEPLETED, data);
  };

  onResourceRespawned = (data: ResourceStatePacket) => {
    // Update the ResourceEntity visual
    const entity = this.world.entities.get(data.resourceId);
    if (
      entity &&
      typeof (
        entity as unknown as {
          updateFromNetwork?: (data: Record<string, unknown>) => void;
        }
      ).updateFromNetwork === "function"
    ) {
      (
        entity as unknown as {
          updateFromNetwork: (data: Record<string, unknown>) => void;
        }
      ).updateFromNetwork({ depleted: false });
    }

    // Also emit the event for other systems
    this.world.emit(EventType.RESOURCE_RESPAWNED, data);
  };

  onInventoryUpdated = (data: InventoryUpdatePacket) => {
    type WindowWithDebug = { DEBUG_RPG?: string };
    if (
      (window as WindowWithDebug).DEBUG_RPG === "1" ||
      process.env?.DEBUG_RPG === "1"
    ) {
      // Debug logging disabled
    }
    // Cache latest snapshot for late-mounting UI
    this.lastInventoryByPlayerId[data.playerId] = data;
    // Re-emit with typed event so UI updates without waiting for local add
    this.world.emit(EventType.INVENTORY_UPDATED, data);
  };

  onCoinsUpdated = (data: { playerId: string; coins: number }) => {
    // Update cached inventory coins
    if (this.lastInventoryByPlayerId[data.playerId]) {
      this.lastInventoryByPlayerId[data.playerId].coins = data.coins;
    }
    // Emit event for UI to update coin display
    this.world.emit(EventType.INVENTORY_UPDATE_COINS, {
      playerId: data.playerId,
      coins: data.coins,
    });
  };

  onEquipmentUpdated = (data: {
    playerId: string;
    equipment: Record<string, unknown>;
  }) => {
    // Cache latest equipment for late-mounting UI
    this.lastEquipmentByPlayerId = this.lastEquipmentByPlayerId || {};
    this.lastEquipmentByPlayerId[data.playerId] = data.equipment;

    // Update local player's equipment so systems can access it
    // Equipment format from server: { weapon: { item: Item, itemId: string }, ... }
    // Local player format: { weapon: Item | null, ... }
    const localPlayer = this.world.getPlayer?.();
    if (localPlayer && data.playerId === localPlayer.id) {
      const rawEq = data.equipment;
      if (rawEq && "equipment" in localPlayer) {
        const playerWithEquipment = localPlayer as unknown as {
          equipment: {
            weapon: unknown;
            shield: unknown;
            helmet: unknown;
            body: unknown;
            legs: unknown;
            arrows: unknown;
          };
        };
        const getItem = (key: string) =>
          (rawEq[key] as { item?: unknown })?.item || null;
        playerWithEquipment.equipment = {
          weapon: getItem("weapon"),
          shield: getItem("shield"),
          helmet: getItem("helmet"),
          body: getItem("body"),
          legs: getItem("legs"),
          arrows: getItem("arrows"),
        };
      }
    }

    // Re-emit as UI update event for Sidebar to handle
    this.world.emit(EventType.UI_UPDATE, {
      component: "equipment",
      data: {
        equipment: data.equipment,
      },
    });

    // Also emit PLAYER_EQUIPMENT_CHANGED for each slot
    // so EquipmentVisualSystem can attach/remove 3D models to the avatar
    if (data.equipment) {
      const equipment = data.equipment;
      const slots = ["weapon", "shield", "helmet", "body", "legs", "arrows"];

      for (const slot of slots) {
        const slotData = equipment[slot] as
          | { itemId?: string; item?: { id?: string } }
          | undefined;
        // Emit for ALL slots, including null (to remove items on death)
        const itemId = slotData?.itemId || slotData?.item?.id || null;
        this.world.emit(EventType.PLAYER_EQUIPMENT_CHANGED, {
          playerId: data.playerId,
          slot: slot,
          itemId: itemId,
        });
      }
    }
  };

  onSkillsUpdated = (data: SkillsUpdatePacket) => {
    // Cache latest snapshot for late-mounting UI
    this.lastSkillsByPlayerId = this.lastSkillsByPlayerId || {};
    this.lastSkillsByPlayerId[data.playerId] = data.skills;
    // Re-emit with typed event so UI updates
    this.world.emit(EventType.SKILLS_UPDATED, data);
  };

  // --- Bank state handler ---
  onBankState = (data: {
    playerId: string;
    bankId?: string;
    items: Array<{
      itemId: string;
      quantity: number;
      slot: number;
      tabIndex?: number;
    }>;
    tabs?: Array<{ tabIndex: number; iconItemId: string | null }>;
    alwaysSetPlaceholder?: boolean;
    maxSlots: number;
    isOpen?: boolean;
  }) => {
    // Emit as UI update for BankPanel to handle
    this.world.emit(EventType.UI_UPDATE, {
      playerId: data.playerId,
      component: "bank",
      data: {
        bankId: data.bankId,
        items: data.items,
        tabs: data.tabs,
        alwaysSetPlaceholder: data.alwaysSetPlaceholder,
        maxSlots: data.maxSlots,
        isOpen: data.isOpen ?? true,
      },
    });
  };

  // --- Bank close handler (server-authoritative) ---
  // Server sends this when player moves too far from bank
  onBankClose = (data: { reason: string; sessionType: string }) => {
    // Emit UI update to close the bank
    this.world.emit(EventType.UI_UPDATE, {
      component: "bank",
      data: {
        isOpen: false,
        reason: data.reason,
      },
    });
  };

  // --- Store state handler ---
  onStoreState = (data: {
    storeId: string;
    storeName: string;
    buybackRate: number;
    items: Array<{
      id: string;
      itemId: string;
      name: string;
      price: number;
      stockQuantity: number;
      description?: string;
      category?: string;
    }>;
    isOpen: boolean;
    npcEntityId?: string;
  }) => {
    // Emit as UI update for StorePanel to handle
    this.world.emit(EventType.UI_UPDATE, {
      component: "store",
      data: {
        storeId: data.storeId,
        storeName: data.storeName,
        buybackRate: data.buybackRate,
        items: data.items,
        isOpen: data.isOpen,
        npcEntityId: data.npcEntityId,
      },
    });
  };

  // --- Store close handler (server-authoritative) ---
  // Server sends this when player moves too far from shopkeeper
  onStoreClose = (data: { reason: string; sessionType: string }) => {
    // Emit UI update to close the store
    this.world.emit(EventType.UI_UPDATE, {
      component: "store",
      data: {
        isOpen: false,
        reason: data.reason,
      },
    });
  };

  // --- Dialogue handlers ---
  onDialogueStart = (data: {
    npcId: string;
    npcName: string;
    nodeId: string;
    text: string;
    responses: Array<{ text: string; nextNodeId: string; effect?: string }>;
    npcEntityId?: string;
  }) => {
    // Emit as UI update for DialoguePanel to handle
    this.world.emit(EventType.UI_UPDATE, {
      component: "dialogue",
      data: {
        npcId: data.npcId,
        npcName: data.npcName,
        text: data.text,
        responses: data.responses,
        npcEntityId: data.npcEntityId,
      },
    });
  };

  onDialogueNodeChange = (data: {
    npcId: string;
    nodeId: string;
    text: string;
    responses: Array<{ text: string; nextNodeId: string; effect?: string }>;
  }) => {
    // Emit as UI update for DialoguePanel to handle - preserve npcName from previous state
    this.world.emit(EventType.UI_UPDATE, {
      component: "dialogue",
      data: {
        npcId: data.npcId,
        npcName: "", // Will be preserved by UI from existing state
        text: data.text,
        responses: data.responses,
      },
    });
  };

  onDialogueEnd = (data: { npcId: string }) => {
    // Emit UI update to close dialogue panel
    this.world.emit(EventType.UI_UPDATE, {
      component: "dialogueEnd",
      data: { npcId: data.npcId },
    });
  };

  // --- Dialogue close handler (server-authoritative) ---
  // Server sends this when player moves too far from NPC during dialogue
  onDialogueClose = (data: { reason: string; sessionType: string }) => {
    // Emit UI update to close the dialogue
    this.world.emit(EventType.UI_UPDATE, {
      component: "dialogueEnd",
      data: {
        reason: data.reason,
        serverClose: true,
      },
    });
  };

  // --- Character selection (flag-gated by server) ---
  onCharacterList = (data: CharacterListPacket) => {
    // Cache and re-emit so UI can show the modal
    this.lastCharacterList = data.characters || [];
    this.world.emit(EventType.CHARACTER_LIST, data);
    // Auto-select previously chosen character if available
    const storedId =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("selectedCharacterId")
        : null;
    if (
      storedId &&
      Array.isArray(data.characters) &&
      data.characters.some((c) => c.id === storedId)
    ) {
      this.requestCharacterSelect(storedId);
    }
  };
  onCharacterCreated = (data: CharacterCreatedPacket) => {
    // Re-emit for UI to update lists
    this.world.emit(EventType.CHARACTER_CREATED, data);
  };
  onCharacterSelected = (data: CharacterSelectedPacket) => {
    this.world.emit(EventType.CHARACTER_SELECTED, data);
  };

  // Convenience methods
  requestCharacterCreate(name: string) {
    this.send("characterCreate", { name });
  }
  requestCharacterSelect(characterId: string) {
    this.send("characterSelected", { characterId });
  }
  requestEnterWorld() {
    this.send("enterWorld", {});
  }

  // Inventory actions
  dropItem(itemId: string, slot?: number, quantity?: number) {
    this.send("dropItem", { itemId, slot, quantity });
  }

  onEntityRemoved = (data: { id: string }) => {
    const { id } = data;
    // Mark entity as destroyed to prevent future modifications
    this.destroyedEntities.add(id);

    // Remove from entity hash lookup
    const hash = hashEntityId(id);
    this.entityHashToId.delete(hash);

    // Remove from interpolation tracking
    this.interpolationStates.delete(id);
    // Remove from tile interpolation tracking (RuneScape-style movement)
    this.tileInterpolator.removeEntity(id);
    // Clean up pending modifications tracking
    this.pendingModifications.delete(id);
    this.pendingModificationTimestamps.delete(id);
    this.pendingModificationLimitReached.delete(id);

    // Remove from entities system
    this.world.entities.remove(id);

    this.logger.debug(`Entity ${id} marked as destroyed`);

    // Clean up destroyed entities set periodically to prevent memory leaks
    // We don't track timestamps for destroyed entities, so we'll clean up
    // when the set gets too large (more than 1000 entities)
    if (this.destroyedEntities.size > 1000) {
      this.destroyedEntities.clear();
      this.logger.debug(
        "Cleared destroyed entities set to prevent memory leak",
      );
    }
  };

  /**
   * Update interpolation in lateUpdate (after entity updates)
   */
  lateUpdate(delta: number): void {
    this.updateInterpolation(delta);

    // Get terrain system for height lookups
    const terrain = this.world.getSystem("terrain") as {
      getHeightAt?: (x: number, z: number) => number | null;
    } | null;

    // Update tile-based interpolation (RuneScape-style)
    this.tileInterpolator.update(
      delta,
      (id: string) => {
        const entity = this.world.entities.get(id);
        if (!entity) return undefined;
        // Cast to access base (players have VRM on base, rotation should be set there)
        const entityWithBase = entity as typeof entity & {
          base?: THREE.Object3D;
        };
        return {
          position: entity.position as THREE.Vector3,
          node: entity.node as THREE.Object3D | undefined,
          base: entityWithBase.base,
          data: entity.data as Record<string, unknown>,
          // modify() triggers PlayerLocal's emote handling (avatar animation updates)
          modify: (data: Record<string, unknown>) => entity.modify(data),
        };
      },
      // Pass terrain height function for smooth Y updates
      terrain?.getHeightAt
        ? (x: number, z: number) => terrain.getHeightAt!(x, z)
        : undefined,
      // Callback when entity finishes moving - emit ENTITY_MODIFIED for InteractionSystem
      // This enables event-based pending interactions (NPC trade, bank open, etc.)
      (entityId: string, position: { x: number; y: number; z: number }) => {
        this.world.emit(EventType.ENTITY_MODIFIED, {
          id: entityId,
          changes: {
            e: "idle",
            p: [position.x, position.y, position.z],
          },
        });
      },
    );
  }

  onGatheringComplete = (data: {
    playerId: string;
    resourceId: string;
    successful: boolean;
  }) => {
    // Forward to local event system for UI updates (progress bar, animation)
    this.world.emit(EventType.RESOURCE_GATHERING_COMPLETED, {
      playerId: data.playerId,
      resourceId: data.resourceId,
      successful: data.successful,
      skill: "woodcutting", // Will be refined later
    });
  };

  onPlayerState = (data: PlayerStatePacket) => {
    // Forward player state updates from server to local UI_UPDATE event
    const playerData = data;

    // Cache skills if provided
    if (playerData.playerId && playerData.skills) {
      this.lastSkillsByPlayerId = this.lastSkillsByPlayerId || {};
      this.lastSkillsByPlayerId[playerData.playerId] = playerData.skills;
    }

    this.world.emit(EventType.UI_UPDATE, {
      component: "player",
      data: data,
    });
  };

  onShowToast = (data: ShowToastPacket) => {
    // Only show toast for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system for toast display
      this.world.emit(EventType.UI_TOAST, {
        message: data.message,
        type: data.type,
      });
    }
  };

  // ======================== TRADING SYSTEM HANDLERS ========================

  onTradeRequest = (data: TradeRequestReceivedPacket) => {
    // Emit event for UI to show trade request modal
    this.world.emit(EventType.TRADE_REQUEST_RECEIVED, {
      tradeId: data.tradeId,
      fromPlayerId: data.fromPlayerId,
      fromPlayerName: data.fromPlayerName,
    });
  };

  onTradeStarted = (data: TradeStartedPacket) => {
    this.world.emit(EventType.TRADE_STARTED, data);
  };

  onTradeUpdated = (data: TradeUpdatedPacket) => {
    this.world.emit(EventType.TRADE_UPDATED, data);
  };

  onTradeCompleted = (data: TradeCompletedPacket) => {
    this.world.emit(EventType.TRADE_COMPLETED, data);

    // Show success toast
    this.world.emit(EventType.UI_TOAST, {
      message: "Trade completed successfully!",
      type: "success",
    });
  };

  onTradeCancelled = (data: TradeCancelledPacket) => {
    this.world.emit(EventType.TRADE_CANCELLED, data);

    // Show cancellation toast
    this.world.emit(EventType.UI_TOAST, {
      message: `Trade cancelled: ${data.reason}`,
      type: "warning",
    });
  };

  onTradeError = (data: TradeErrorPacket) => {
    console.error("[ClientNetwork] ⚠️ Trade error:", data.message);

    // Emit event for UI to show error
    this.world.emit(EventType.TRADE_ERROR, data);

    // Show error toast
    this.world.emit(EventType.UI_TOAST, {
      message: data.message,
      type: "error",
    });
  };

  // ======================== END TRADING HANDLERS ========================

  // ======================== DEATH/RESPAWN HANDLERS ========================

  onDeathScreen = (data: {
    playerId: string;
    message: string;
    killedBy: string;
    respawnTime: number;
  }) => {
    // Only show death screen for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system for death screen display
      this.world.emit(EventType.UI_DEATH_SCREEN, {
        message: data.message,
        killedBy: data.killedBy,
        respawnTime: data.respawnTime,
      });
    }
  };

  onDeathScreenClose = (data: { playerId: string }) => {
    // Only close death screen for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system to close death screen
      this.world.emit(EventType.UI_DEATH_SCREEN_CLOSE, {
        playerId: data.playerId,
      });
    }
  };

  onPlayerSetDead = (data: {
    playerId: string;
    isDead: boolean;
    deathPosition?: number[];
  }) => {
    // Only handle for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system so PlayerLocal can handle it
      this.world.emit(EventType.PLAYER_SET_DEAD, {
        playerId: data.playerId,
        isDead: data.isDead,
        deathPosition: data.deathPosition,
      });
    }
  };

  onPlayerRespawned = (data: {
    playerId: string;
    spawnPosition: number[];
    townName?: string;
    deathLocation?: number[];
  }) => {
    // Only handle for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system so PlayerLocal can handle it
      this.world.emit(EventType.PLAYER_RESPAWNED, {
        playerId: data.playerId,
        spawnPosition: data.spawnPosition,
        townName: data.townName,
        deathLocation: data.deathLocation,
      });
    }
  };

  onAttackStyleChanged = (data: {
    playerId: string;
    currentStyle: unknown;
    availableStyles: unknown;
    canChange: boolean;
    cooldownRemaining?: number;
  }) => {
    // Only handle for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system so UI can update
      this.world.emit(EventType.UI_ATTACK_STYLE_CHANGED, data);
    }
  };

  onAttackStyleUpdate = (data: {
    playerId: string;
    currentStyle: unknown;
    availableStyles: unknown;
    canChange: boolean;
  }) => {
    // Only handle for local player
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // Forward to local event system so UI can update
      this.world.emit(EventType.UI_ATTACK_STYLE_UPDATE, data);
    }
  };

  onCombatDamageDealt = (data: {
    attackerId: string;
    targetId: string;
    damage: number;
    targetType: "player" | "mob";
    position: { x: number; y: number; z: number };
  }) => {
    // Forward to local event system so DamageSplatSystem can show visual feedback
    this.world.emit(EventType.COMBAT_DAMAGE_DEALT, data);
  };

  onPlayerUpdated = (data: {
    health: number;
    maxHealth: number;
    alive: boolean;
  }) => {
    const localPlayer = this.world.getPlayer();
    if (!localPlayer) {
      return;
    }

    // Use modify() to update entity - this triggers PlayerLocal.modify()
    // which updates _playerHealth (the field the UI reads)
    localPlayer.modify({
      health: data.health,
      maxHealth: data.maxHealth,
    });

    // Update alive status
    if ("alive" in localPlayer) {
      (localPlayer as { alive: boolean }).alive = data.alive;
    }

    // Emit health update event for UI
    this.world.emit(EventType.PLAYER_HEALTH_UPDATED, {
      playerId: localPlayer.id,
      health: data.health,
      maxHealth: data.maxHealth,
    });
  };

  onCorpseLoot = (data: {
    corpseId: string;
    playerId: string;
    lootItems: Array<{ itemId: string; quantity: number }>;
    position: { x: number; y: number; z: number };
  }) => {
    // Forward to local event system so UI can open loot window
    this.world.emit(EventType.CORPSE_CLICK, data);
  };

  // ======================== END DEATH/RESPAWN HANDLERS ========================

  applyPendingModifications = (entityId: string) => {
    const pending = this.pendingModifications.get(entityId);
    if (pending && pending.length > 0) {
      this.logger.info(
        `Applying ${pending.length} pending modifications for entity ${entityId}`,
      );
      pending.forEach((mod) => this.onEntityModified({ ...mod, id: entityId }));

      // Clean up tracking structures
      this.pendingModifications.delete(entityId);
      this.pendingModificationTimestamps.delete(entityId);
      this.pendingModificationLimitReached.delete(entityId);
    }
  };

  onPlayerTeleport = (data: {
    playerId: string;
    position: [number, number, number];
  }) => {
    const player = this.world.entities.player;
    if (player instanceof PlayerLocal) {
      const pos = _v3_1.set(
        data.position[0],
        data.position[1],
        data.position[2],
      );
      player.teleport(pos);
    }
  };

  onPlayerPush = (data: { force: [number, number, number] }) => {
    const player = this.world.entities.player;
    if (player instanceof PlayerLocal) {
      const force = _v3_1.set(data.force[0], data.force[1], data.force[2]);
      player.push(force);
    }
  };

  onPlayerSessionAvatar = (data: { playerId: string; avatar: string }) => {
    const player = this.world.entities.player as {
      setSessionAvatar?: (url: string) => void;
    };
    if (player?.setSessionAvatar) {
      player.setSessionAvatar(data.avatar);
    }
  };

  /**
   * Handle compressed batch updates from server
   * These are AOI-aware, throttled, and batched entity updates
   */
  onCompressedUpdate = (packet: Uint8Array | ArrayBuffer) => {
    // Convert to Uint8Array if needed
    const buffer =
      packet instanceof Uint8Array ? packet : new Uint8Array(packet);

    const updates = parseBatchUpdate(buffer);

    for (const update of updates) {
      // Look up entity ID from hash
      const entityId = this.entityHashToId.get(update.entityIdHash);
      if (!entityId) continue; // Entity not known to client

      const entity = this.world.entities.get(entityId);
      if (!entity) continue;

      // Apply position update
      if (update.flags & UpdateFlags.POSITION && update.position) {
        const pos = update.position;
        if (entity.position) {
          entity.position.set(pos.x, pos.y, pos.z);
        }
        if (entity.data) {
          entity.data.position = [pos.x, pos.y, pos.z];
        }
      }

      // Apply rotation update
      if (update.flags & UpdateFlags.ROTATION && update.quaternion) {
        const q = update.quaternion;
        if (entity.node?.quaternion) {
          entity.node.quaternion.set(q.x, q.y, q.z, q.w);
        }
        if (entity.data) {
          entity.data.quaternion = [q.x, q.y, q.z, q.w];
        }
      }

      // Apply health update
      if (update.flags & UpdateFlags.HEALTH && update.health) {
        if (entity.data) {
          entity.data.health = update.health.current;
          entity.data.maxHealth = update.health.max;
        }
      }

      // Apply state update
      if (update.flags & UpdateFlags.STATE && update.state !== undefined) {
        if (entity.data) {
          entity.data.state = update.state;
        }
      }
    }
  };

  onPong = (time: number) => {
    if (this.world.stats) {
      this.world.stats.onPong(time);
    }
  };

  onKick = (code: string) => {
    // Emit a typed UI event for kicks
    this.emitTypedEvent("UI_KICK", {
      playerId: this.id || "unknown",
      reason: code || "unknown",
    });
  };

  // ==== Tile Movement Handlers (RuneScape-style) ====

  /**
   * Handle tile position update from server
   * Server sends this every tick (600ms) when an entity moves
   */
  onEntityTileUpdate = (data: {
    id: string;
    tile: TileCoord;
    worldPos: [number, number, number];
    quaternion?: [number, number, number, number];
    emote: string;
    tickNumber: number;
    moveSeq?: number;
  }) => {
    // PERFORMANCE: Use cached vector instead of allocating new one
    const worldPos = _v3_2.set(
      data.worldPos[0],
      data.worldPos[1],
      data.worldPos[2],
    );

    // Get entity's current position as fallback for smooth interpolation
    // (in case tileMovementStart was missed due to packet loss)
    const entity = this.world.entities.get(data.id);
    // PERFORMANCE: Use cached vector for clone, TileInterpolator will copy if needed
    const entityCurrentPos = entity?.position
      ? _v3_3.copy(entity.position as THREE.Vector3)
      : undefined;

    // Update tile interpolator with tick number and moveSeq for proper sequencing
    this.tileInterpolator.onTileUpdate(
      data.id,
      data.tile,
      worldPos,
      data.emote,
      data.quaternion,
      entityCurrentPos,
      data.tickNumber,
      data.moveSeq,
    );

    // Set the flag immediately after tile update
    // This prevents race conditions where entityModified packets arrive after this
    // and apply stale server rotation, causing flickering
    if (entity?.data) {
      entity.data.tileInterpolatorControlled = true;
    }

    // Also update the entity data for consistency
    if (entity) {
      entity.data.emote = data.emote;
      // DON'T update quaternion here - TileInterpolator handles rotation smoothly
      // Storing server quaternion in entity.data could cause other code to read and apply it
      // if (data.quaternion) {
      //   entity.data.quaternion = data.quaternion;
      // }
    }
  };

  /**
   * Handle movement path started
   *
   * OSRS Model: Client receives FULL PATH and walks through it at fixed speed.
   * Server tick updates are for sync/verification only.
   */
  onTileMovementStart = (data: {
    id: string;
    startTile?: TileCoord;
    path: TileCoord[];
    running: boolean;
    destinationTile?: TileCoord;
    moveSeq?: number;
    emote?: string;
    tilesPerTick?: number; // Mob-specific speed (optional, defaults to walk/run speed)
  }) => {
    // Get entity's current position for smooth start (fallback if startTile not provided)
    // PERFORMANCE: Don't clone here - TileInterpolator.onMovementStart() clones internally
    const entity = this.world.entities.get(data.id);
    const currentPosition = entity?.position
      ? (entity.position as THREE.Vector3)
      : undefined;

    // Pass server's authoritative path to interpolator
    // startTile: where server knows entity IS (authoritative)
    // path: complete path from server (no client recalculation)
    // destinationTile: final target for verification
    // moveSeq: packet ordering to ignore stale packets
    // emote: bundled animation (OSRS-style)
    // tilesPerTick: mob-specific speed (for faster/slower mobs)
    this.tileInterpolator.onMovementStart(
      data.id,
      data.path,
      data.running,
      currentPosition,
      data.startTile,
      data.destinationTile,
      data.moveSeq,
      data.emote,
      data.tilesPerTick,
    );

    // Set the flag immediately when movement starts
    // This prevents race conditions where entityModified packets arrive before update() runs
    // and apply stale server rotation, causing flickering between north/south
    if (entity?.data) {
      entity.data.tileInterpolatorControlled = true;
      // Apply emote immediately - don't wait for interpolator update() cycle
      // This ensures animation matches movement from the very first frame
      // Use modify() to trigger PlayerLocal's emote handling (avatar animation update)
      if (data.emote) {
        entity.modify({ e: data.emote });
      }
    }
  };

  /**
   * Handle entity arrived at destination
   */
  onTileMovementEnd = (data: {
    id: string;
    tile: TileCoord;
    worldPos: [number, number, number];
    moveSeq?: number;
  }) => {
    // PERFORMANCE: Use cached vector instead of allocating new one
    const worldPos = _v3_2.set(
      data.worldPos[0],
      data.worldPos[1],
      data.worldPos[2],
    );
    // Let TileInterpolator handle the arrival smoothly
    // It will snap only if already at destination, otherwise let interpolation finish
    // moveSeq ensures stale end packets are ignored
    this.tileInterpolator.onMovementEnd(
      data.id,
      data.tile,
      worldPos,
      data.moveSeq,
    );

    // Get entity for flag and emote updates
    const entity = this.world.entities.get(data.id);

    // Keep the flag set - TileInterpolator might still be finishing interpolation
    // The flag will be managed by TileInterpolator during its update cycle
    if (entity?.data) {
      entity.data.tileInterpolatorControlled = true;
    }

    // DON'T snap entity position here - TileInterpolator handles smooth arrival
    // Only update emote if interpolator says we're not moving
    if (!this.tileInterpolator.isInterpolating(data.id)) {
      if (entity) {
        entity.data.emote = "idle";
      }
    }
  };

  onClose = (code: CloseEvent) => {
    console.error("[ClientNetwork] 🔌 WebSocket CLOSED:", {
      code: code.code,
      reason: code.reason,
      wasClean: code.wasClean,
      currentId: this.id,
      stackTrace: new Error().stack,
    });
    this.connected = false;
    this.world.chat.add(
      {
        id: uuid(),
        from: "System",
        fromId: undefined,
        body: `You have been disconnected.`,
        text: `You have been disconnected.`,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
      },
      false,
    );
    // Emit a typed network disconnect event
    this.emitTypedEvent("NETWORK_DISCONNECTED", {
      code: code.code,
      reason: code.reason || "closed",
    });
  };

  destroy = () => {
    if (this.ws) {
      this.ws.removeEventListener("message", this.onPacket);
      this.ws.removeEventListener("close", this.onClose);
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
    // Clear any pending queue items
    this.queue.length = 0;
    this.connected = false;
    // Clear interpolation states
    this.interpolationStates.clear();
    // Clear tile interpolation states
    this.tileInterpolator.clear();
    // Clear pending modifications tracking
    this.pendingModifications.clear();
    this.pendingModificationTimestamps.clear();
    this.pendingModificationLimitReached.clear();
  };

  // Plugin-specific upload method
  async upload(file: File): Promise<string> {
    // For now, just return a placeholder URL
    // In a real implementation, this would upload the file to a server
    // console.debug('[ClientNetwork] Upload requested for file:', file.name, `(${file.size} bytes)`)
    return Promise.resolve(`uploaded-${Date.now()}-${file.name}`);
  }

  // Plugin-specific disconnect method
  async disconnect(): Promise<void> {
    // console.debug('[ClientNetwork] Disconnect called')
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    return Promise.resolve();
  }
}
