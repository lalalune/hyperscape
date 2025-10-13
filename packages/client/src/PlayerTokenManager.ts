import EventEmitter from 'eventemitter3';

import type { ClientPlayerToken, PlayerSession } from '@hyperscape/shared'

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

  static getInstance(): PlayerTokenManager {
    if (!PlayerTokenManager.instance) {
      PlayerTokenManager.instance = new PlayerTokenManager();
    }
    return PlayerTokenManager.instance;
  }

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

  endSession(): void {
    this.currentSession.isActive = false;
    this.saveSession(this.currentSession);
    this.emit('session-ended', this.currentSession);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  updateActivity(): void {
    this.currentSession.lastActivity = new Date();
    this.saveSession(this.currentSession);
  }

  getCurrentToken(): ClientPlayerToken {
    return this.currentToken;
  }

  getCurrentSession(): PlayerSession {
    return this.currentSession;
  }

  clearStoredData(): void {
    localStorage.removeItem(PlayerTokenManager.STORAGE_KEY);
    localStorage.removeItem(PlayerTokenManager.SESSION_KEY);
    
    this.currentToken = this.createNewToken('New Player');
    this.currentSession = this.startSession();
    
    this.emit('data-cleared');
  }

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
      const baseUrl = import.meta.env.PUBLIC_API_URL || '';
      const endpoint = baseUrl ? `${baseUrl}/player/disconnect` : '/api/player/disconnect';
      navigator.sendBeacon(endpoint, JSON.stringify(data));
    });
  }

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

// Export singleton instance with the expected name
export const playerTokenManager = PlayerTokenManager.getInstance();