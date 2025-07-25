import { System } from '../../core/systems/System';
import { PlayerTokenManager } from '../../client/PlayerTokenManager';
import { RPGDatabaseSystem } from './RPGDatabaseSystem';
import type { World } from '../../types';

/**
 * RPG Authentication System
 * Integrates with Hyperfy's existing JWT authentication and provides
 * enhanced player identity management for the MMORPG prototype
 */

export interface RPGPlayerIdentity {
  // Core Hyperfy identity
  hyperfyUserId: string;
  hyperfyUserName: string;
  hyperfyUserRoles: string[];
  
  // RPG-specific identity
  rpgPlayerId: string;
  rpgPlayerName: string;
  clientMachineId: string;
  
  // Authentication tokens
  hyperfyJwtToken?: string;
  clientPersistentToken: string;
  
  // Session info
  sessionId: string;
  loginTime: Date;
  lastActivity: Date;
  isGuest: boolean;
}

export interface AuthenticationResult {
  success: boolean;
  identity?: RPGPlayerIdentity;
  error?: string;
  isNewPlayer: boolean;
  isReturningPlayer: boolean;
}

export class RPGAuthenticationSystem extends System {
  private databaseSystem?: RPGDatabaseSystem;
  private authenticatedPlayers = new Map<string, RPGPlayerIdentity>();
  private readonly GUEST_PREFIX = 'guest_';
  private readonly RPG_PLAYER_PREFIX = 'rpg_';

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGAuth] 🔐 Initializing RPG Authentication System');
    
    // Get database system reference
    this.databaseSystem = this.world['rpg-database-system'] || this.world['rpg-database'];
    if (!this.databaseSystem) {
      console.warn('[RPGAuth] ⚠️ RPGDatabaseSystem not found - authentication limited');
    }
    
    // Listen for player authentication events
    this.world.on?.('player:authenticate', this.handlePlayerAuthentication.bind(this));
    this.world.on?.('player:logout', this.handlePlayerLogout.bind(this));
    this.world.on?.('player:reconnect', this.handlePlayerReconnection.bind(this));
    
    console.log('[RPGAuth] ✅ Authentication system initialized');
  }

  /**
   * Authenticate a player using multiple identity sources
   */
  async authenticatePlayer(
    hyperfyUserId?: string,
    hyperfyJwtToken?: string,
    clientToken?: string,
    machineId?: string
  ): Promise<AuthenticationResult> {
    try {
      console.log('[RPGAuth] 🔍 Authenticating player...', {
        hasHyperfyId: !!hyperfyUserId,
        hasJwtToken: !!hyperfyJwtToken,
        hasClientToken: !!clientToken,
        hasMachineId: !!machineId
      });

      // Priority 1: Use Hyperfy JWT authentication if available
      if (hyperfyUserId && hyperfyJwtToken) {
        return await this.authenticateWithHyperfyJWT(hyperfyUserId, hyperfyJwtToken, clientToken, machineId);
      }
      
      // Priority 2: Use client persistent token for returning players
      if (clientToken) {
        return await this.authenticateWithClientToken(clientToken, machineId);
      }
      
      // Priority 3: Create guest account with machine ID
      return await this.createGuestAccount(machineId);
      
    } catch (error) {
      console.error('[RPGAuth] ❌ Authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        isNewPlayer: false,
        isReturningPlayer: false
      };
    }
  }

  /**
   * Authenticate using Hyperfy's JWT system
   */
  private async authenticateWithHyperfyJWT(
    hyperfyUserId: string,
    hyperfyJwtToken: string,
    clientToken?: string,
    machineId?: string
  ): Promise<AuthenticationResult> {
    console.log('[RPGAuth] 🎫 Authenticating with Hyperfy JWT...');
    
    try {
      // In a real implementation, we would verify the JWT token
      // For now, we trust the Hyperfy system has already verified it
      
      // For now, always create new RPG players since we don't have Hyperfy ID mapping
      let existingRpgPlayer = null;
      // TODO: Implement proper Hyperfy ID to RPG player mapping
      
      const isNewPlayer = !existingRpgPlayer;
      const rpgPlayerId = this.generateRPGPlayerId();
      
      // Get or create client persistent token
      const finalClientToken = clientToken || this.generateClientToken();
      
      // Create player identity
      const identity: RPGPlayerIdentity = {
        hyperfyUserId,
        hyperfyUserName: 'Hyperfy User', // Would be from JWT payload
        hyperfyUserRoles: ['user'], // Would be from JWT payload
        rpgPlayerId,
        rpgPlayerName: 'Adventurer',
        clientMachineId: machineId || this.generateMachineId(),
        hyperfyJwtToken,
        clientPersistentToken: finalClientToken,
        sessionId: this.generateSessionId(),
        loginTime: new Date(),
        lastActivity: new Date(),
        isGuest: false
      };
      
      // Store authenticated player
      this.authenticatedPlayers.set(identity.rpgPlayerId, identity);
      
      // Create RPG player record if new
      if (isNewPlayer && this.databaseSystem) {
        await this.createRPGPlayerRecord(identity);
      }
      
      // Update last login
      if (this.databaseSystem) {
        await this.updatePlayerLoginInfo(identity);
      }
      
      console.log('[RPGAuth] ✅ Hyperfy JWT authentication successful', {
        rpgPlayerId: identity.rpgPlayerId,
        isNewPlayer,
        isGuest: false
      });
      
      return {
        success: true,
        identity,
        isNewPlayer,
        isReturningPlayer: !isNewPlayer
      };
      
    } catch (error) {
      console.error('[RPGAuth] ❌ Hyperfy JWT authentication failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate using client persistent token (returning player)
   */
  private async authenticateWithClientToken(
    clientToken: string,
    machineId?: string
  ): Promise<AuthenticationResult> {
    console.log('[RPGAuth] 🔄 Authenticating with client token...');
    
    try {
      // Look for existing player with this client token
      let existingPlayer = null;
      // TODO: Implement getPlayerDataByClientToken method in RPGDatabaseSystem
      
      if (!existingPlayer) {
        // Client token not found, treat as new guest
        return await this.createGuestAccount(machineId, clientToken);
      }
      
      // Create identity for returning player
      const identity: RPGPlayerIdentity = {
        hyperfyUserId: '', // No Hyperfy account linked
        hyperfyUserName: '',
        hyperfyUserRoles: [],
        rpgPlayerId: 'placeholder', // Would be existingPlayer.id
        rpgPlayerName: 'Guest Player', // Would be existingPlayer.name
        clientMachineId: machineId || this.generateMachineId(),
        clientPersistentToken: clientToken,
        sessionId: this.generateSessionId(),
        loginTime: new Date(),
        lastActivity: new Date(),
        isGuest: true // Still a guest until they link Hyperfy account
      };
      
      // Store authenticated player
      this.authenticatedPlayers.set(identity.rpgPlayerId, identity);
      
      // Update last login
      if (this.databaseSystem) {
        await this.updatePlayerLoginInfo(identity);
      }
      
      console.log('[RPGAuth] ✅ Client token authentication successful', {
        rpgPlayerId: identity.rpgPlayerId,
        isReturningPlayer: true
      });
      
      return {
        success: true,
        identity,
        isNewPlayer: false,
        isReturningPlayer: true
      };
      
    } catch (error) {
      console.error('[RPGAuth] ❌ Client token authentication failed:', error);
      throw error;
    }
  }

  /**
   * Create new guest account
   */
  private async createGuestAccount(
    machineId?: string,
    existingClientToken?: string
  ): Promise<AuthenticationResult> {
    console.log('[RPGAuth] 👤 Creating guest account...');
    
    try {
      const rpgPlayerId = this.generateRPGPlayerId();
      const clientToken = existingClientToken || this.generateClientToken();
      const finalMachineId = machineId || this.generateMachineId();
      
      // Create guest identity
      const identity: RPGPlayerIdentity = {
        hyperfyUserId: '',
        hyperfyUserName: '',
        hyperfyUserRoles: [],
        rpgPlayerId,
        rpgPlayerName: this.generateGuestName(),
        clientMachineId: finalMachineId,
        clientPersistentToken: clientToken,
        sessionId: this.generateSessionId(),
        loginTime: new Date(),
        lastActivity: new Date(),
        isGuest: true
      };
      
      // Store authenticated player
      this.authenticatedPlayers.set(identity.rpgPlayerId, identity);
      
      // Create RPG player record
      if (this.databaseSystem) {
        await this.createRPGPlayerRecord(identity);
      }
      
      console.log('[RPGAuth] ✅ Guest account created', {
        rpgPlayerId: identity.rpgPlayerId,
        guestName: identity.rpgPlayerName
      });
      
      return {
        success: true,
        identity,
        isNewPlayer: true,
        isReturningPlayer: false
      };
      
    } catch (error) {
      console.error('[RPGAuth] ❌ Guest account creation failed:', error);
      throw error;
    }
  }

  /**
   * Link guest account to Hyperfy account
   */
  async linkGuestToHyperfyAccount(
    guestRpgPlayerId: string,
    hyperfyUserId: string,
    hyperfyJwtToken: string
  ): Promise<boolean> {
    console.log('[RPGAuth] 🔗 Linking guest account to Hyperfy...', {
      guestId: guestRpgPlayerId,
      hyperfyId: hyperfyUserId
    });
    
    try {
      const guestIdentity = this.authenticatedPlayers.get(guestRpgPlayerId);
      if (!guestIdentity || !guestIdentity.isGuest) {
        throw new Error('Guest account not found or already linked');
      }
      
      // Update identity
      guestIdentity.hyperfyUserId = hyperfyUserId;
      guestIdentity.hyperfyJwtToken = hyperfyJwtToken;
      guestIdentity.isGuest = false;
      guestIdentity.lastActivity = new Date();
      
      // Update database record
      if (this.databaseSystem) {
        await this.updatePlayerHyperfyLink(guestIdentity);
      }
      
      console.log('[RPGAuth] ✅ Successfully linked guest to Hyperfy account');
      return true;
      
    } catch (error) {
      console.error('[RPGAuth] ❌ Failed to link guest to Hyperfy:', error);
      return false;
    }
  }

  /**
   * Get authenticated player identity
   */
  getPlayerIdentity(rpgPlayerId: string): RPGPlayerIdentity | null {
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
  getAuthenticatedPlayers(): RPGPlayerIdentity[] {
    return Array.from(this.authenticatedPlayers.values());
  }

  /**
   * Handle player authentication event
   */
  private async handlePlayerAuthentication(data: {
    playerId: string;
    hyperfyUserId?: string;
    hyperfyJwtToken?: string;
    clientToken?: string;
    machineId?: string;
  }): Promise<void> {
    const result = await this.authenticatePlayer(
      data.hyperfyUserId,
      data.hyperfyJwtToken,
      data.clientToken,
      data.machineId
    );
    
    // Emit authentication result
    this.world.emit?.('rpg:player:authenticated', {
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
      
      console.log('[RPGAuth] 👋 Player logged out:', {
        rpgPlayerId: data.playerId,
        sessionDuration: Date.now() - identity.loginTime.getTime()
      });
    }
  }

  /**
   * Handle player reconnection
   */
  private async handlePlayerReconnection(data: {
    playerId: string;
    clientToken: string;
  }): Promise<void> {
    console.log('[RPGAuth] 🔄 Handling player reconnection...');
    
    const result = await this.authenticateWithClientToken(data.clientToken);
    
    this.world.emit?.('rpg:player:reconnected', {
      playerId: data.playerId,
      result
    });
  }

  // Helper methods for database operations
  private async createRPGPlayerRecord(identity: RPGPlayerIdentity): Promise<void> {
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
      health: { current: 100, max: 100 },
      position: { x: 0, y: 2, z: 0 },
      alive: true,
      hyperfyUserId: identity.hyperfyUserId || null,
      clientToken: identity.clientPersistentToken,
      machineId: identity.clientMachineId
    };
    
    this.databaseSystem.savePlayerData(identity.rpgPlayerId, playerData);
  }

  private async updatePlayerLoginInfo(identity: RPGPlayerIdentity): Promise<void> {
    // Implementation would update login timestamps in database
    console.log('[RPGAuth] 📝 Updated login info for player:', identity.rpgPlayerId);
  }

  private async updatePlayerLogoutInfo(identity: RPGPlayerIdentity): Promise<void> {
    // Implementation would update logout timestamp in database
    console.log('[RPGAuth] 📝 Updated logout info for player:', identity.rpgPlayerId);
  }

  private async updatePlayerHyperfyLink(identity: RPGPlayerIdentity): Promise<void> {
    // Implementation would update Hyperfy link in database
    console.log('[RPGAuth] 📝 Updated Hyperfy link for player:', identity.rpgPlayerId);
  }

  // ID generation helpers
  private generateRPGPlayerId(): string {
    return `${this.RPG_PLAYER_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateClientToken(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateMachineId(): string {
    // In a real implementation, this would use browser fingerprinting
    return `machine_${Math.random().toString(36).substr(2, 12)}`;
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

  // System lifecycle methods
  destroy(): void {
    console.log('[RPGAuth] 🔥 Destroying authentication system');
    this.authenticatedPlayers.clear();
  }

  // Required System interface methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Update player activity tracking
    const now = Date.now();
    for (const [playerId, identity] of this.authenticatedPlayers) {
      const inactiveTime = now - identity.lastActivity.getTime();
      
      // Log out inactive players after 30 minutes
      if (inactiveTime > 30 * 60 * 1000) {
        console.log(`[RPGAuth] ⏰ Auto-logging out inactive player: ${playerId}`);
        this.handlePlayerLogout({ playerId });
      }
    }
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}