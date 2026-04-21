/**
 * ConnectionManager.ts - WebSocket Connection Lifecycle Manager
 *
 * Handles all WebSocket connection lifecycle management for the client:
 * - Opening and authenticating connections
 * - Reconnection with exponential backoff
 * - Clean disconnection
 * - File upload via API
 *
 * Extracted from ClientNetwork to isolate connection concerns.
 *
 * Architecture:
 * - Plain class (not a System subclass)
 * - Receives World reference for chat messages and event emission
 * - Communicates back to ClientNetwork via ConnectionCallbacks interface
 * - ClientNetwork delegates all connection operations here
 */

import { readPacket, writePacket } from "../../../platform/shared/packets";
import { storage } from "../../../platform/shared/storage";
import type { World, WorldOptions } from "../../../types";
import { uuid } from "../../../utils";
import { SystemLogger } from "../../../utils/Logger";

/**
 * Callback interface for ConnectionManager to communicate back to ClientNetwork.
 * Keeps the dependency direction clean: ConnectionManager -> callbacks -> ClientNetwork.
 */
export interface ConnectionCallbacks {
  /** Handle an incoming WebSocket message (feeds into the enqueue system) */
  onPacket: (e: MessageEvent) => void;
  /** Called when connection is fully established (after auth) */
  onConnected: () => void;
  /** Called when connection is lost */
  onDisconnected: (code: number, reason: string) => void;
  /** Called when a reconnection attempt begins */
  onReconnecting: (
    attempt: number,
    maxAttempts: number,
    delayMs: number,
  ) => void;
  /** Called when all reconnection attempts are exhausted */
  onReconnectFailed: (attempts: number) => void;
  /** Flush queued outgoing messages after reconnection */
  flushOutgoingQueue: () => void;
}

/**
 * Manages the WebSocket connection lifecycle for the client.
 *
 * Responsibilities:
 * - Build WebSocket URL and open connections
 * - Handle first-message auth and legacy URL-based auth
 * - Reconnect with exponential backoff on unexpected disconnects
 * - Provide clean disconnect for intentional logouts
 * - File upload via API endpoint
 */
export class ConnectionManager {
  /** The active WebSocket connection */
  ws: WebSocket | null = null;

  /** API base URL received from server snapshot */
  apiUrl: string | null = null;

  /** Our player/connection ID assigned by the server */
  id: string | null = null;

  /** Whether we currently have an active connection */
  connected: boolean = false;

  /** Maximum file upload size (bytes), set from server snapshot */
  maxUploadSize: number = 0;

  /** Whether this client is running as an embedded spectator viewport */
  isEmbeddedSpectator: boolean = false;

  // Reconnection state
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastWsUrl: string | null = null;
  private lastInitOptions: Record<string, unknown> | null = null;
  private intentionalDisconnect: boolean = false;

  private readonly world: World;
  private readonly callbacks: ConnectionCallbacks;
  private readonly logger: SystemLogger;

  constructor(world: World, callbacks: ConnectionCallbacks) {
    this.world = world;
    this.callbacks = callbacks;
    this.logger = new SystemLogger("connection-manager");
  }

  /**
   * Open a WebSocket connection to the game server.
   *
   * Handles:
   * - Building the WebSocket URL with non-sensitive params
   * - First-message authentication (secure) or legacy URL-based auth
   * - Reading embedded viewport configuration
   * - Connection timeout
   *
   * Returns a promise that resolves when the connection is authenticated and ready,
   * or when onSnapshot is expected to finalize the setup.
   *
   * @param options - World options containing wsUrl, name, avatar
   * @param onEmbeddedConfig - Callback to set embedded character ID on the caller
   */
  async connect(
    options: WorldOptions,
    onEmbeddedConfig: (characterId: string | null) => void,
  ): Promise<void> {
    const wsUrl = (options as { wsUrl?: string }).wsUrl;

    this.logger.debug(`connect() called with wsUrl: ${wsUrl}`);
    this.logger.debug("Current WebSocket state", {
      hasExistingWs: !!this.ws,
      existingReadyState: this.ws?.readyState,
      connected: this.connected,
      id: this.id,
    } as unknown as Record<string, unknown>);

    const name = (options as { name?: string }).name;
    const avatar = (options as { avatar?: string }).avatar;

    if (!wsUrl) {
      console.error("[ConnectionManager] No WebSocket URL provided!");
      return;
    }

    // Store connection options for reconnection
    this.lastWsUrl = wsUrl;
    this.lastInitOptions = options as Record<string, unknown>;

    // CRITICAL: If we already have a WORKING WebSocket, don't recreate
    // But if it's closed or closing, we need to reconnect
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
      this.logger.debug(
        "WebSocket already connected and working, skipping connect",
      );
      return;
    }

    // Clean up any existing WebSocket (closed, closing, or connecting but failed)
    if (this.ws) {
      this.logger.debug(
        `Cleaning up old WebSocket (state: ${this.ws.readyState})`,
      );
      try {
        this.ws.removeEventListener("message", this.callbacks.onPacket);
        this.ws.removeEventListener("close", this.handleClose);
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

    // SECURITY: First-message authentication pattern
    // Auth token is NOT included in URL to prevent leaking via:
    // - Server logs (WebSocket URLs are often logged)
    // - Browser history
    // - Referrer headers
    // Instead, we send credentials in an 'authenticate' packet after connection opens

    // Check if wsUrl already contains an authToken (e.g., legacy embedded viewport)
    // If so, use legacy URL-based auth for backward compatibility
    const urlHasAuthToken = wsUrl.includes("authToken=");

    let authToken = "";
    let privyUserId = "";
    const isPlaywrightRuntime =
      process.env.PLAYWRIGHT_TEST === "true" ||
      (typeof window !== "undefined" &&
        (
          window as Window & {
            __PLAYWRIGHT_TEST__?: boolean;
          }
        ).__PLAYWRIGHT_TEST__ === true);

    if (!urlHasAuthToken && typeof localStorage !== "undefined") {
      // Get auth credentials from localStorage for first-message auth
      const privyToken = localStorage.getItem("privy_auth_token");
      const privyId = localStorage.getItem("privy_user_id");

      if (privyToken && privyId && !isPlaywrightRuntime) {
        authToken = privyToken;
        privyUserId = privyId;
      } else if (!isPlaywrightRuntime) {
        // Fall back to legacy auth token
        // Strong type assumption - storage.get returns unknown, we expect string
        const legacyToken = storage?.get("authToken");
        authToken = (legacyToken as string) || "";
      }
    }

    // Build WebSocket URL - only include non-auth params
    let url: string;
    if (urlHasAuthToken) {
      // URL already has authToken (legacy embedded mode) - use as-is
      url = wsUrl;
      this.logger.debug("Using authToken from URL (legacy embedded mode)");
    } else {
      // First-message auth mode - don't put authToken in URL
      url = wsUrl;
      this.logger.debug("Using first-message auth pattern (secure)");
    }
    // Add non-sensitive params to URL
    const hasParams = url.includes("?");
    if (name) url += `${hasParams ? "&" : "?"}name=${encodeURIComponent(name)}`;
    if (avatar) {
      const separator = url.includes("?") ? "&" : "?";
      url += `${separator}avatar=${encodeURIComponent(avatar)}`;
    }

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
        this.isEmbeddedSpectator =
          embeddedConfig.mode === "spectator" ||
          embeddedConfig.mode === "stream";
        const characterId = embeddedConfig.characterId || null;
        onEmbeddedConfig(characterId);

        this.logger.debug("[ConnectionManager] Embedded config loaded", {
          isSpectator: this.isEmbeddedSpectator,
          hasCharacterId: !!characterId,
        });
      }
    }

    const isStreamingConnection = /[?&]mode=streaming(?:[&#]|$)/.test(url);
    const isSpectatorConnection = /[?&]mode=spectator(?:[&#]|$)/.test(url);
    const allowsAnonymousMode =
      isStreamingConnection ||
      isSpectatorConnection ||
      this.isEmbeddedSpectator;
    // Streaming/spectator connections are read-only public viewers. They must
    // not send an empty authenticate packet when URL auth is absent.
    const useFirstMessageAuth = !urlHasAuthToken && !allowsAnonymousMode;
    const connectionTimeoutMs =
      isStreamingConnection || isSpectatorConnection ? 120_000 : 30_000;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";

      const timeout = setTimeout(() => {
        this.logger.warn("WebSocket connection timeout");
        reject(new Error("WebSocket connection timeout"));
      }, connectionTimeoutMs);

      // Handler for first-message auth response
      const handleAuthResult = (event: MessageEvent) => {
        const packet = readPacket(event.data as ArrayBuffer);
        if (!packet || packet.length === 0) return;

        const [method, data] = packet;
        if (method === "onAuthResult") {
          const result = data as { success: boolean; error?: string };

          // Remove auth handler - we're done with auth phase
          this.ws?.removeEventListener("message", handleAuthResult);

          if (result.success) {
            this.logger.debug("First-message authentication successful");
            // Auth successful - complete connection setup
            this.completeConnectionSetup(timeout, resolve);
          } else {
            const errorMessage = `Authentication failed: ${result.error || "Unknown error"}`;
            this.logger.error(errorMessage);
            clearTimeout(timeout);
            reject(new Error(errorMessage));
          }
        }
      };

      this.ws.addEventListener("open", () => {
        this.logger.debug("WebSocket connected successfully");

        if (useFirstMessageAuth) {
          // First-message auth: send authenticate packet and wait for response
          this.logger.debug("Sending first-message authentication...");

          // Add auth result handler BEFORE sending authenticate packet
          this.ws?.addEventListener("message", handleAuthResult);

          // Send authentication credentials
          const authPacket = writePacket("authenticate", {
            authToken,
            privyUserId,
            name,
            avatar,
          });
          this.ws?.send(authPacket);

          // Don't resolve yet - wait for authResult
        } else {
          // Legacy URL-based auth: complete immediately
          this.completeConnectionSetup(timeout, resolve);
        }
      });

      this.ws.addEventListener("message", this.callbacks.onPacket);
      this.ws.addEventListener("close", this.handleClose);

      this.ws.addEventListener("error", (e) => {
        clearTimeout(timeout);
        const isExpectedDisconnect =
          this.ws?.readyState === WebSocket.CLOSED ||
          this.ws?.readyState === WebSocket.CLOSING;
        if (!isExpectedDisconnect) {
          this.logger.error(
            "WebSocket error",
            e instanceof Error ? e : undefined,
          );
          this.logger.error(
            `WebSocket error: ${e instanceof ErrorEvent ? e.message : String(e)}`,
          );
          reject(e);
        }
      });
    });
  }

  /**
   * Complete the connection setup after authentication (or immediately for legacy URL auth).
   * Extracted to avoid code duplication between first-message auth and legacy auth paths.
   */
  private completeConnectionSetup(
    timeout: ReturnType<typeof setTimeout>,
    resolve: () => void,
  ): void {
    this.connected = true;
    clearTimeout(timeout);

    // Handle reconnection success
    if (this.isReconnecting) {
      this.logger.debug(`Reconnected after ${this.reconnectAttempts} attempts`);
      this.callbacks.onConnected();
      this.world.chat.add(
        {
          id: uuid(),
          from: "System",
          fromId: undefined,
          body: "Connection restored.",
          text: "Connection restored.",
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        },
        false,
      );
      // Flush outgoing queue after reconnection
      this.callbacks.flushOutgoingQueue();
    }

    // Reset reconnection state
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.intentionalDisconnect = false;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    resolve();
  }

  /**
   * Internal close handler bound as arrow function so it can be added/removed as a listener.
   */
  handleClose = (code: CloseEvent) => {
    console.error("[ConnectionManager] WebSocket CLOSED:", {
      code: code.code,
      reason: code.reason,
      wasClean: code.wasClean,
      currentId: this.id,
      intentionalDisconnect: this.intentionalDisconnect,
    });
    this.connected = false;

    // Notify ClientNetwork of disconnection
    this.callbacks.onDisconnected(code.code, code.reason || "closed");

    // Don't attempt reconnection if this was intentional (user logout, etc.)
    if (this.intentionalDisconnect) {
      this.world.chat.add(
        {
          id: uuid(),
          from: "System",
          fromId: undefined,
          body: "You have been disconnected.",
          text: "You have been disconnected.",
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        },
        false,
      );
      return;
    }

    // Don't reconnect for certain close codes (e.g., server rejected auth)
    const noReconnectCodes = [
      4001, // Authentication failed
      4002, // Invalid token
      4003, // Banned
      4004, // Server full
      1000, // Normal closure (server initiated clean disconnect)
    ];
    if (noReconnectCodes.includes(code.code)) {
      this.logger.debug(`Not reconnecting due to close code: ${code.code}`);
      this.world.chat.add(
        {
          id: uuid(),
          from: "System",
          fromId: undefined,
          body: "You have been disconnected.",
          text: "You have been disconnected.",
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        },
        false,
      );
      return;
    }

    // Attempt automatic reconnection
    this.attemptReconnect();
  };

  /**
   * Attempt to reconnect to the server with exponential backoff.
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached, giving up`,
      );
      this.isReconnecting = false;
      this.callbacks.onReconnectFailed(this.reconnectAttempts);
      this.world.chat.add(
        {
          id: uuid(),
          from: "System",
          fromId: undefined,
          body: "Connection lost. Please refresh the page to reconnect.",
          text: "Connection lost. Please refresh the page to reconnect.",
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        },
        false,
      );
      return;
    }

    if (!this.lastWsUrl) {
      this.logger.error("Cannot reconnect - no previous WebSocket URL stored");
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, up to 30s max
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      30000,
    );

    // Emit reconnecting event with attempt info
    this.callbacks.onReconnecting(
      this.reconnectAttempts,
      this.maxReconnectAttempts,
      delay,
    );

    this.logger.debug(
      `Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    // Show reconnecting message only on first attempt
    if (this.reconnectAttempts === 1) {
      this.world.chat.add(
        {
          id: uuid(),
          from: "System",
          fromId: undefined,
          body: "Connection lost. Attempting to reconnect...",
          text: "Connection lost. Attempting to reconnect...",
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        },
        false,
      );
    }

    this.reconnectTimeoutId = setTimeout(async () => {
      try {
        // Clean up old WebSocket reference
        if (this.ws) {
          try {
            this.ws.removeEventListener("message", this.callbacks.onPacket);
            this.ws.removeEventListener("close", this.handleClose);
          } catch {
            // Ignore cleanup errors
          }
          this.ws = null;
        }

        // Re-initialize with stored options - pass a no-op for embedded config
        // since it was already read during the first connect() call
        await this.connect(
          this.lastInitOptions as WorldOptions,
          () => {}, // Embedded config already read
        );
      } catch (error) {
        this.logger.error(
          "Reconnect attempt failed:",
          error instanceof Error ? error : undefined,
        );
        // Try again
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Cancel any pending reconnection attempts.
   */
  cancelReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if currently attempting to reconnect.
   */
  get reconnecting(): boolean {
    return this.isReconnecting;
  }

  /**
   * Clean disconnect - marks the disconnect as intentional to prevent reconnection.
   */
  async disconnect(): Promise<void> {
    // Mark as intentional disconnect to prevent reconnection
    this.intentionalDisconnect = true;
    this.cancelReconnect();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    return Promise.resolve();
  }

  /**
   * Clean up all WebSocket resources. Called by ClientNetwork.destroy().
   */
  destroyConnection(): void {
    this.intentionalDisconnect = true;
    this.cancelReconnect();

    if (this.ws) {
      this.ws.removeEventListener("message", this.callbacks.onPacket);
      this.ws.removeEventListener("close", this.handleClose);
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Plugin-specific upload method.
   */
  async upload(file: File): Promise<string> {
    // For now, just return a placeholder URL
    // In a real implementation, this would upload the file to a server
    return Promise.resolve(`uploaded-${Date.now()}-${file.name}`);
  }
}
