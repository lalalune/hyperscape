import { SystemBase } from './SystemBase';
import { getSystem } from '../utils/SystemUtils';
import { EventType } from '../types/events';
import type { World, AuthenticationResult, PlayerIdentity } from '../types';
import type { DatabaseSystem } from '../types/system-interfaces';

/**
 * Authentication System
 * Integrates with Hyperscape's existing JWT authentication and provides
 * enhanced player identity management for the MMOprototype
 */

export class AuthenticationSystem extends SystemBase {
  private databaseSystem?: DatabaseSystem;
  private authenticatedPlayers = new Map<string, PlayerIdentity>();
  private readonly PLAYER_PREFIX = '';

  constructor(world: World) {
    super(world, {
      name: 'authentication',
      dependencies: {
        required: [],
        optional: ['database']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Get database system reference
    this.databaseSystem = getSystem(this.world, 'database') as DatabaseSystem;
    
    // Set up type-safe event subscriptions for authentication (3 listeners!)
    // Consume PLAYER_AUTHENTICATED as a request and emit a different event on success to avoid recursion
    this.subscribe<{ playerId: string; hyperscapeUserId: string; hyperscapeJwtToken: string; clientToken: string; machineId: string }>(EventType.PLAYER_AUTHENTICATED, (data) => this.handlePlayerAuthentication(data));
    this.subscribe<{ playerId: string }>(EventType.PLAYER_LOGOUT, (data) => this.handlePlayerLogout(data));
    this.subscribe<{ playerId: string; clientToken: string }>(EventType.PLAYER_RECONNECTED, (data) => this.handlePlayerReconnection(data));
    
  }

  /**
   * Authenticate a player using multiple identity sources
   */
  async authenticatePlayer(
    hyperscapeUserId: string,
    hyperscapeJwtToken: string,
    clientToken: string,
    machineId: string
  ): Promise<AuthenticationResult> {
    return await this.authenticateWithHyperscapeJWT(hyperscapeUserId, hyperscapeJwtToken, clientToken, machineId);
  }

  /**
   * Authenticate using Hyperscape's JWT system
   */
  private async authenticateWithHyperscapeJWT(
    hyperscapeUserId: string,
    hyperscapeJwtToken: string,
    clientToken: string,
    machineId: string
  ): Promise<AuthenticationResult> {
    // Check for existing player by Hyperscape ID
    const existingRpgPlayer = await this.findPlayerByHyperscapeId(hyperscapeUserId);
    
    const isNewPlayer = !existingRpgPlayer;
    const rpgPlayerId = this.generatePlayerId();
    
    // Create player identity
    const identity: PlayerIdentity = {
      hyperscapeUserId,
      hyperscapeUserName: 'Hyperscape User',
      hyperscapeUserRoles: ['user'],
      rpgPlayerId,
      rpgPlayerName: 'Adventurer',
      clientMachineId: machineId,
      hyperscapeJwtToken,
      clientPersistentToken: clientToken,
      sessionId: this.generateSessionId(),
      loginTime: new Date(),
      lastActivity: new Date(),
      isGuest: false
    };
    
    // Store authenticated player
    this.authenticatedPlayers.set(identity.rpgPlayerId, identity);
    
    // Create player record if new
    if (isNewPlayer) {
      await this.createPlayerRecord(identity);
    }
    
    // Update last login
    await this.updatePlayerLoginInfo(identity);
    
    return {
      success: true,
      identity,
      isNewPlayer,
      isReturningPlayer: !isNewPlayer
    };
  }

  /**
   * Get authenticated player identity
   */
  getPlayerIdentity(rpgPlayerId: string): PlayerIdentity | null {
    return this.authenticatedPlayers.get(rpgPlayerId) || null;
  }

  /**
   * Update player activity
   */
  updatePlayerActivity(rpgPlayerId: string): void {
    const identity = this.authenticatedPlayers.get(rpgPlayerId);
    if (identity) {
      identity.lastActivity = new Date();
    }
  }

  /**
   * Get all authenticated players
   */
  getAuthenticatedPlayers(): PlayerIdentity[] {
    return Array.from(this.authenticatedPlayers.values());
  }

  /**
   * Handle player authentication event
   */
  private async handlePlayerAuthentication(data: {
    playerId: string;
    hyperscapeUserId: string;
    hyperscapeJwtToken: string;
    clientToken: string;
    machineId: string;
  }): Promise<void> {
    const result = await this.authenticatePlayer(
      data.hyperscapeUserId,
      data.hyperscapeJwtToken,
      data.clientToken,
      data.machineId
    );
    
    // Emit session start to signal downstream systems without re-triggering authentication handler
    this.emitTypedEvent(EventType.PLAYER_SESSION_STARTED, {
      playerId: data.playerId,
      result
    });
  }

  /**
   * Handle player logout
   */
  private async handlePlayerLogout(data: { playerId: string }): Promise<void> {
    const identity = this.authenticatedPlayers.get(data.playerId);
    if (identity) {
      // Update logout time in database
      if (this.databaseSystem) {
        await this.updatePlayerLogoutInfo(identity);
      }
      
      // Remove from active players
      this.authenticatedPlayers.delete(data.playerId);
    }
  }

  /**
   * Handle player reconnection
   */
  private async handlePlayerReconnection(data: {
    playerId: string;
    clientToken: string;
  }): Promise<void> {
    
    const result = await this.authenticateWithClientToken(data.clientToken);
    
    // Signal session activity rather than re-emitting the request event
    this.emitTypedEvent(EventType.PLAYER_SESSION_STARTED, {
      playerId: data.playerId,
      result
    });
  }

  /**
   * Authenticate using a client token
   */
  private async authenticateWithClientToken(clientToken: string): Promise<{ success: boolean; playerId?: string; message?: string }> {
    // Validate the client token (in a real implementation, this would check against a database)
    if (!clientToken || clientToken.length < 10) {
      return { success: false, message: 'Invalid client token' };
    }
    
    // For now, extract player ID from token (in reality, this would be looked up)
    // Assuming token format is like "token_<playerId>_<random>"
    const parts = clientToken.split('_');
    if (parts.length >= 2) {
      const playerId = parts[1];
      return { success: true, playerId };
    }
    
    return { success: false, message: 'Unable to extract player ID from token' };
  }

  // Helper methods for database operations
  private async createPlayerRecord(identity: PlayerIdentity): Promise<void> {
    if (!this.databaseSystem) return;
    
    const playerData = {
      name: identity.rpgPlayerName,
      skills: {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        woodcutting: { level: 1, xp: 0 },
        fishing: { level: 1, xp: 0 },
        firemaking: { level: 1, xp: 0 },
        cooking: { level: 1, xp: 0 },
        constitution: { level: 10, xp: 1154 }
      },
      health: 100,
      position: { x: 0, y: 2, z: 0 },
      alive: true,
      hyperscapeUserId: identity.hyperscapeUserId || null,
      clientToken: identity.clientPersistentToken,
      machineId: identity.clientMachineId
    };
    
    this.databaseSystem.savePlayer(identity.rpgPlayerId, playerData);
  }

  private async updatePlayerLoginInfo(_identity: PlayerIdentity): Promise<void> {
    // Implementation would update login timestamps in database
  }

  private async updatePlayerLogoutInfo(_identity: PlayerIdentity): Promise<void> {
    // Implementation would update logout timestamp in database
  }

  // ID generation helpers
  private generatePlayerId(): string {
    return `${this.PLAYER_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateClientToken(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateGuestName(): string {
    const adjectives = ['Swift', 'Brave', 'Clever', 'Bold', 'Wise', 'Strong', 'Quick', 'Silent'];
    const nouns = ['Adventurer', 'Explorer', 'Warrior', 'Mage', 'Ranger', 'Knight', 'Hero', 'Wanderer'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    
    return `${adjective}${noun}${number}`;
  }

  /**
   * Find existing player by Hyperscape ID
   */
  private async findPlayerByHyperscapeId(hyperscapeId: string): Promise<{ id: string; name: string } | null> {
    if (!this.databaseSystem) {
      return null;
    }

    try {
      // NOTE: getPlayerByHyperscapeId not implemented in DatabaseSystem
      console.warn('[Auth] ⚠️ getPlayerByHyperscapeId not implemented - database schema needs hyperscapeUserId field');
      return null;
    } catch (error) {
      this.logger.error('Failed to find player by Hyperscape ID', error instanceof Error ? error : new Error(String(error)), { hyperscapeId });
    }

    return null;
  }

  /**
   * Update player activity tracking and session management
   */
  update(_dt: number): void {
    // Update player activity tracking
    const now = Date.now();
    for (const [playerId, identity] of this.authenticatedPlayers) {
      const inactiveTime = now - identity.lastActivity.getTime();
      
      // Log out inactive players after 30 minutes
      if (inactiveTime > 30 * 60 * 1000) {
        this.handlePlayerLogout({ playerId });
      }
    }
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all authenticated players
    this.authenticatedPlayers.clear();
    
    // Clear database system reference
    this.databaseSystem = undefined;
    
    this.logger.info('Authentication system destroyed and cleaned up');
    
    // Call parent cleanup
    super.destroy();
  }
}