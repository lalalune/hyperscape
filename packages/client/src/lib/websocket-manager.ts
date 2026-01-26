/**
 * WebSocket Manager with Exponential Backoff Reconnection
 *
 * Provides a robust WebSocket wrapper with:
 * - Automatic reconnection with exponential backoff
 * - Connection state tracking
 * - Event queuing during reconnection
 * - Max retry limit with user notification
 *
 * @remarks
 * Note: CharacterSelectScreen uses custom binary packet handling (readPacket/writePacket)
 * and requires careful integration. GameClient and EmbeddedGameClient use Hyperscape's
 * internal world.init() which manages its own networking layer.
 *
 * This manager is available for:
 * - Future reconnection improvements to character selection
 * - Custom WebSocket connections outside of Hyperscape core
 * - Agent/dashboard WebSocket connections
 *
 * @packageDocumentation
 */

/** Connection state enum */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
}

/** WebSocket manager configuration */
export interface WebSocketManagerConfig {
  /** Base URL for WebSocket connection */
  url: string;
  /** Initial retry delay in milliseconds (default: 1000) */
  initialRetryDelay?: number;
  /** Maximum retry delay in milliseconds (default: 30000) */
  maxRetryDelay?: number;
  /** Maximum number of retry attempts (default: 10) */
  maxRetries?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Protocols to use for WebSocket connection */
  protocols?: string | string[];
}

/** Event callbacks for WebSocket manager */
export interface WebSocketManagerCallbacks {
  /** Called when connection is established */
  onConnected?: () => void;
  /** Called when connection is lost */
  onDisconnected?: (event: CloseEvent) => void;
  /** Called when reconnecting */
  onReconnecting?: (attempt: number, nextDelay: number) => void;
  /** Called when max retries exceeded */
  onMaxRetriesExceeded?: () => void;
  /** Called when a message is received */
  onMessage?: (event: MessageEvent) => void;
  /** Called on error */
  onError?: (event: Event) => void;
}

/**
 * WebSocket Manager class
 *
 * Manages WebSocket connections with automatic reconnection using exponential backoff.
 *
 * @example
 * ```typescript
 * const manager = new WebSocketManager({
 *   url: 'wss://example.com/socket',
 *   maxRetries: 10,
 * });
 *
 * manager.setCallbacks({
 *   onConnected: () => console.log('Connected!'),
 *   onReconnecting: (attempt, delay) => console.log(`Retrying in ${delay}ms...`),
 * });
 *
 * manager.connect();
 * ```
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<Omit<WebSocketManagerConfig, "protocols">> & {
    protocols?: string | string[];
  };
  private callbacks: WebSocketManagerCallbacks = {};
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private retryCount = 0;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: Array<string | ArrayBuffer | Blob> = [];
  private intentionallyClosed = false;

  /** Heartbeat interval handle */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  /** Heartbeat timeout for pong response */
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Heartbeat interval in milliseconds */
  private readonly HEARTBEAT_INTERVAL = 30000;
  /** Heartbeat timeout in milliseconds */
  private readonly HEARTBEAT_TIMEOUT = 10000;
  /** Last ping timestamp */
  private lastPingTime = 0;
  /** Last pong received timestamp */
  private lastPongTime = 0;

  constructor(config: WebSocketManagerConfig) {
    this.config = {
      url: config.url,
      initialRetryDelay: config.initialRetryDelay ?? 1000,
      maxRetryDelay: config.maxRetryDelay ?? 30000,
      maxRetries: config.maxRetries ?? 10,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      protocols: config.protocols,
    };
  }

  /**
   * Set callback functions for WebSocket events
   */
  setCallbacks(callbacks: WebSocketManagerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Check if WebSocket is connected and ready
   */
  isConnected(): boolean {
    return (
      this.state === ConnectionState.CONNECTED &&
      this.ws?.readyState === WebSocket.OPEN
    );
  }

  /**
   * Update the connection URL (for reconnection with new auth tokens)
   */
  updateUrl(url: string): void {
    this.config.url = url;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (
      this.state === ConnectionState.CONNECTING ||
      this.state === ConnectionState.CONNECTED
    ) {
      return;
    }

    this.intentionallyClosed = false;
    this.setState(ConnectionState.CONNECTING);
    this.createConnection();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.intentionallyClosed = true;
    this.clearRetryTimeout();
    this.stopHeartbeat();
    this.retryCount = 0;
    this.messageQueue = [];

    if (this.ws) {
      this.ws.close(1000, "Client disconnected");
      this.ws = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a message through the WebSocket
   * If not connected, the message will be queued and sent when connection is established
   */
  send(data: string | ArrayBuffer | Blob): boolean {
    if (this.isConnected()) {
      this.ws!.send(data);
      return true;
    }

    // Queue message for later delivery
    this.messageQueue.push(data);
    return false;
  }

  /**
   * Get the underlying WebSocket instance (use with caution)
   */
  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  private createConnection(): void {
    try {
      this.ws = this.config.protocols
        ? new WebSocket(this.config.url, this.config.protocols)
        : new WebSocket(this.config.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error("[WebSocketManager] Failed to create WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    this.setState(ConnectionState.CONNECTED);
    this.retryCount = 0;

    // Start heartbeat
    this.startHeartbeat();

    // Flush queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.ws!.send(message);
    }

    this.callbacks.onConnected?.();
  }

  private handleClose(event: CloseEvent): void {
    this.ws = null;
    this.stopHeartbeat();

    // Don't reconnect if intentionally closed or server sent normal close
    if (this.intentionallyClosed) {
      this.setState(ConnectionState.DISCONNECTED);
      return;
    }

    this.callbacks.onDisconnected?.(event);

    // Attempt reconnection
    this.scheduleReconnect();
  }

  private handleError(event: Event): void {
    console.error("[WebSocketManager] WebSocket error:", event);
    this.callbacks.onError?.(event);
  }

  private handleMessage(event: MessageEvent): void {
    // Check for pong response
    if (typeof event.data === "string") {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") {
          this.handlePong();
          return;
        }
      } catch {
        // Not a JSON message, pass through
      }
    }

    this.callbacks.onMessage?.(event);
  }

  /**
   * Starts the heartbeat ping/pong mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendPing();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stops the heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Sends a ping message to the server
   */
  private sendPing(): void {
    if (!this.isConnected()) return;

    this.lastPingTime = Date.now();
    this.send(JSON.stringify({ type: "ping", timestamp: this.lastPingTime }));

    // Set timeout for pong response
    this.heartbeatTimeout = setTimeout(() => {
      console.warn("[WebSocketManager] Heartbeat timeout - no pong received");
      // Connection may be stale, force reconnect
      if (this.ws) {
        this.ws.close(4000, "Heartbeat timeout");
      }
    }, this.HEARTBEAT_TIMEOUT);
  }

  /**
   * Handles a pong response from the server
   */
  private handlePong(): void {
    this.lastPongTime = Date.now();

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Gets the current connection latency (ping-pong round trip time)
   */
  getLatency(): number {
    if (this.lastPingTime === 0 || this.lastPongTime === 0) return 0;
    return this.lastPongTime - this.lastPingTime;
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) {
      return;
    }

    if (this.retryCount >= this.config.maxRetries) {
      this.setState(ConnectionState.DISCONNECTED);
      this.callbacks.onMaxRetriesExceeded?.();
      return;
    }

    this.setState(ConnectionState.RECONNECTING);

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.initialRetryDelay *
        Math.pow(this.config.backoffMultiplier, this.retryCount),
      this.config.maxRetryDelay,
    );

    this.retryCount++;

    this.callbacks.onReconnecting?.(this.retryCount, delay);

    this.retryTimeoutId = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  private clearRetryTimeout(): void {
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
  }

  /**
   * Force a reconnection attempt (resets retry count)
   */
  forceReconnect(): void {
    this.clearRetryTimeout();
    this.retryCount = 0;
    this.intentionallyClosed = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connect();
  }
}

/**
 * React hook for using WebSocket manager state
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const [state, setState] = useState(ConnectionState.DISCONNECTED);
 *   const [retryInfo, setRetryInfo] = useState({ attempt: 0, delay: 0 });
 *
 *   useEffect(() => {
 *     const manager = new WebSocketManager({ url: 'wss://...' });
 *     manager.setCallbacks({
 *       onConnected: () => setState(ConnectionState.CONNECTED),
 *       onDisconnected: () => setState(ConnectionState.DISCONNECTED),
 *       onReconnecting: (attempt, delay) => {
 *         setState(ConnectionState.RECONNECTING);
 *         setRetryInfo({ attempt, delay });
 *       },
 *     });
 *     manager.connect();
 *     return () => manager.disconnect();
 *   }, []);
 * }
 * ```
 */
export function createWebSocketManager(
  config: WebSocketManagerConfig,
): WebSocketManager {
  return new WebSocketManager(config);
}
