/**
 * Player Token and Session Manager
 * 
 * This module manages player identity and session persistence on the client side.
 * It works in conjunction with the server-side AuthenticationSystem to provide:
 * 
 * - **Persistent Player Identity**: Generates and stores unique player tokens in localStorage
 *   that survive browser restarts, allowing players to maintain their identity across sessions
 * 
 * - **Session Tracking**: Manages active play sessions with start/end times and activity tracking
 * 
 * - **Machine Fingerprinting**: Creates a stable machine ID based on browser fingerprinting
 *   to detect and prevent duplicate accounts on the same device
 * 
 * - **Activity Heartbeat**: Sends periodic heartbeat events to track player activity and
 *   detect inactive sessions
 * 
 * - **Graceful Disconnect**: Uses sendBeacon on page unload to notify the server when
 *   a player closes the browser
 * 
 * The PlayerTokenManager is a singleton that emits events for token updates, session changes,
 * and heartbeats that other systems can subscribe to.
 * 
 * Events emitted:
 * - 'token-updated': When player token is refreshed
 * - 'session-started': When a new session begins
 * - 'session-ended': When a session is terminated
 * - 'heartbeat': Periodic activity ping with token and session info
 * - 'data-cleared': When stored data is reset
 * - 'name-updated': When player name changes
 * 
 * Referenced by: Client initialization, authentication flows, session monitoring
 */

import EventEmitter from 'eventemitter3';

interface ClientPlayerToken {
  playerId: string
  tokenSecret: string
  playerName: string
  createdAt: Date
  lastSeen: Date
  sessionId: string
  machineId: string
  clientVersion: string
  hyperscapeUserId: string
  hyperscapeLinked: boolean
  persistenceVersion: number
}

interface PlayerSession {
  sessionId: string
  playerId: string
  startTime: Date
  lastActivity: Date
  isActive: boolean
}

/**
 * Manages player tokens and sessions for client-side identity persistence
 * This is the client-side component that works with the server-side AuthenticationSystem
 */
export class PlayerTokenManager extends EventEmitter {
  private static readonly STORAGE_KEY = 'hyperscape_player_token';
  private static readonly SESSION_KEY = 'hyperscape_session';
  private static instance: PlayerTokenManager;

  private currentToken: ClientPlayerToken;
  private currentSession: PlayerSession;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor() {
    super();
    // Load existing token and session immediately
    const storedToken = localStorage.getItem(PlayerTokenManager.STORAGE_KEY);
    this.currentToken = storedToken ? JSON.parse(storedToken) : this.createNewToken('New Player');
    const storedSession = localStorage.getItem(PlayerTokenManager.SESSION_KEY);
    this.currentSession = storedSession ? JSON.parse(storedSession) : this.startSession();
    this.setupBeforeUnloadHandler();
    this.startHeartbeat();
  }

  /**
   * Gets the singleton instance of PlayerTokenManager
   * 
   * @returns The singleton instance
   * 
   * @public
   */
  static getInstance(): PlayerTokenManager {
    if (!PlayerTokenManager.instance) {
      PlayerTokenManager.instance = new PlayerTokenManager();
    }
    return PlayerTokenManager.instance;
  }

  /**
   * Gets or creates a player token for the given player name
   * 
   * Updates the existing token with the current player name and timestamp,
   * then saves it to localStorage and emits a 'token-updated' event.
   * 
   * @param playerName - The player's display name
   * @returns The player token with updated information
   * 
   * @public
   */
  getOrCreatePlayerToken(playerName: string): ClientPlayerToken {
    // Always validate and update token
    this.currentToken.lastSeen = new Date();
    this.currentToken.playerName = playerName;
    this.currentToken.clientVersion = '1.0.0';
    this.currentToken.persistenceVersion = 1;
    
    this.saveToken(this.currentToken);
    this.emit('token-updated', this.currentToken);
    
    return this.currentToken;
  }

  private createNewToken(playerName: string): ClientPlayerToken {
    const token: ClientPlayerToken = {
      playerId: this.generatePlayerId(),
      tokenSecret: this.generateTokenSecret(),
      playerName: playerName,
      createdAt: new Date(),
      lastSeen: new Date(),
      sessionId: this.generateSessionId(),
      machineId: this.generateMachineId(),
      clientVersion: '1.0.0',
      hyperscapeUserId: '',
      hyperscapeLinked: false,
      persistenceVersion: 1
    };
    
    this.saveToken(token);
    return token;
  }

  /**
   * Starts a new player session
   * 
   * Creates a new session record with a unique session ID and start time.
   * Sessions track individual play periods and are used for analytics.
   * 
   * @returns The newly created session
   * 
   * @public
   */
  startSession(): PlayerSession {
    const session: PlayerSession = {
      sessionId: this.generateSessionId(),
      playerId: this.currentToken.playerId,
      startTime: new Date(),
      lastActivity: new Date(),
      isActive: true
    };
    
    this.currentSession = session;
    this.saveSession(session);
    this.emit('session-started', session);
    
    return session;
  }

  /**
   * Ends the current player session
   * 
   * Marks the session as inactive, saves to localStorage, and stops the
   * heartbeat timer. Called when the player logs out or closes the browser.
   * 
   * @public
   */
  endSession(): void {
    this.currentSession.isActive = false;
    this.saveSession(this.currentSession);
    this.emit('session-ended', this.currentSession);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * Updates the last activity timestamp for the current session
   * 
   * Called periodically by the heartbeat and when user performs actions.
   * Used for idle detection and activity tracking.
   * 
   * @public
   */
  updateActivity(): void {
    this.currentSession.lastActivity = new Date();
    this.saveSession(this.currentSession);
  }

  /**
   * Gets the current player token
   * 
   * @returns The current player token
   * 
   * @public
   */
  getCurrentToken(): ClientPlayerToken {
    return this.currentToken;
  }

  /**
   * Gets the current player session
   * 
   * @returns The current session
   * 
   * @public
   */
  getCurrentSession(): PlayerSession {
    return this.currentSession;
  }

  /**
   * Clears all stored player data from localStorage
   * 
   * Removes the player token and session from storage, creates a new token
   * and session, and emits a 'data-cleared' event. Use this for logout or
   * when the player wants to start fresh.
   * 
   * @public
   */
  clearStoredData(): void {
    localStorage.removeItem(PlayerTokenManager.STORAGE_KEY);
    localStorage.removeItem(PlayerTokenManager.SESSION_KEY);
    
    this.currentToken = this.createNewToken('New Player');
    this.currentSession = this.startSession();
    
    this.emit('data-cleared');
  }

  /**
   * Updates the player's display name
   * 
   * Changes the player name in the token and saves to localStorage.
   * Emits a 'name-updated' event that other systems can listen for.
   * 
   * @param newName - The new player name
   * 
   * @public
   */
  updatePlayerName(newName: string): void {
    this.currentToken.playerName = newName;
    this.saveToken(this.currentToken);
    this.emit('name-updated', newName);
  }

  private generatePlayerId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `player_${timestamp}_${randomPart}`;
  }

  private generateTokenSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private generateMachineId(): string {
    // Generate a unique machine ID based on browser fingerprinting
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('🎮🎯🎲', 2, 2);
    const dataURL = canvas.toDataURL();
    
    const hash = Array.from(dataURL).reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    return `machine_${Math.abs(hash).toString(36)}_${navigator.hardwareConcurrency}_${screen.width}x${screen.height}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveToken(token: ClientPlayerToken): void {
    const serialized = JSON.stringify(token, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
    localStorage.setItem(PlayerTokenManager.STORAGE_KEY, serialized);
  }

  private saveSession(session: PlayerSession): void {
    const serialized = JSON.stringify(session, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
    localStorage.setItem(PlayerTokenManager.SESSION_KEY, serialized);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.updateActivity();
      this.emit('heartbeat', {
        token: this.currentToken,
        session: this.currentSession
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Save final state
      this.currentToken.lastSeen = new Date();
      this.saveToken(this.currentToken);
      
      this.currentSession.lastActivity = new Date();
      this.saveSession(this.currentSession);
      
      // Attempt to notify server of disconnect
      const data = {
        playerId: this.currentToken.playerId,
        sessionId: this.currentSession.sessionId,
        reason: 'window_unload'
      };
      
      // Use sendBeacon for reliable delivery during page unload
      const baseUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:5555';
      const endpoint = `${baseUrl}/api/player/disconnect`;
      navigator.sendBeacon(endpoint, JSON.stringify(data));
    });
  }

  /**
   * Gets statistics about the current player session
   * 
   * Returns session metadata including duration, activity timestamps,
   * and identification. Useful for debugging and analytics.
   * 
   * @returns Object containing session statistics
   * 
   * @example
   * ```typescript
   * const stats = playerTokenManager.getPlayerStats();
   * console.log(`Session duration: ${stats.sessionDuration}ms`);
   * console.log(`Player ID: ${stats.playerId}`);
   * ```
   * 
   * @public
   */
  getPlayerStats(): {
    hasToken: boolean;
    hasSession: boolean;
    playerId: string;
    sessionId: string;
    sessionDuration: number;
    lastActivity: Date;
  } {
    const sessionDuration = Date.now() - new Date(this.currentSession.startTime).getTime();
    
    return {
      hasToken: true,
      hasSession: true,
      playerId: this.currentToken.playerId,
      sessionId: this.currentSession.sessionId,
      sessionDuration,
      lastActivity: new Date(this.currentSession.lastActivity)
    };
  }
}

/**
 * Singleton instance of PlayerTokenManager
 * 
 * Use this throughout the application for player identity and session management.
 * 
 * @public
 */
export const playerTokenManager = PlayerTokenManager.getInstance();