import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';
import { getSystem } from '../utils/SystemUtils';
import type { World } from '../types/index';
import { TerrainSystem } from './TerrainSystem';
import { IPlayerSystemForPersistence } from '../types/core';
import type { WorldChunk } from '../types/core';
import type { WorldChunkData, PlayerSessionRow } from '../types/database';
import type { DatabaseSystem } from '../types/system-interfaces';
import { PlayerIdMapper } from '../utils/PlayerIdMapper';

/**
 * Persistence System
 * Coordinates all persistence operations across the systems
 * - Manages periodic saves for performance optimization
 * - Handles session tracking and cleanup
 * - Manages chunk inactivity and reset timers
 * - Provides centralized persistence monitoring
 */
export class PersistenceSystem extends SystemBase {
  private databaseSystem?: DatabaseSystem;
  private playerSystem?: IPlayerSystemForPersistence;
  private terrainSystem?: TerrainSystem;
  
  // Timers and intervals
  // Last execution times for frame-based updates
  private lastPeriodicSave = 0;
  private lastChunkCleanup = 0;
  private lastSessionCleanup = 0;
  private lastMaintenance = 0;
  
  // Configuration
  private readonly PERIODIC_SAVE_INTERVAL = 30000; // 30 seconds
  private readonly CHUNK_CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly SESSION_CLEANUP_INTERVAL = 600000; // 10 minutes  
  private readonly MAINTENANCE_INTERVAL = 3600000; // 1 hour
  private readonly CHUNK_INACTIVE_TIME = 900000; // 15 minutes
  
  // Statistics
  private stats = {
    totalSaves: 0,
    lastSaveTime: 0,
    chunksReset: 0,
    sessionsEnded: 0,
    lastMaintenanceTime: 0
  };

  constructor(world: World) {
    super(world, {
      name: 'persistence',
      dependencies: {
        required: [], // Database is server-only; presence enforced at runtime on server
        optional: ['database', 'player', 'terrain'] // Use if available
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Get references to other systems
    this.databaseSystem = getSystem<DatabaseSystem>(this.world, 'database') || undefined;
    if (!this.databaseSystem && this.world.isServer) {
      throw new Error('[PersistenceSystem] DatabaseSystem not found on server!');
    }
    
    this.playerSystem = (getSystem(this.world, 'player') as IPlayerSystemForPersistence | null) || undefined;
    if (!this.playerSystem) {
      this.logger.warn('PlayerSystem not found - player persistence will be limited');
    }
    
    this.terrainSystem = getSystem<TerrainSystem>(this.world, 'terrain') || undefined;
    if (!this.terrainSystem) {
      // This is expected in test environments without terrain, so use debug level
      this.logger.debug('TerrainSystem not found - chunk persistence will be limited');
    }
    
    // Subscribe to critical persistence events using type-safe event system
    this.subscribe(EventType.PLAYER_JOINED, (data) => this.onPlayerEnter(data as { playerId: string; userId?: string; playerToken?: string }));
    this.subscribe(EventType.PLAYER_LEFT, (data) => this.onPlayerLeave(data as { playerId: string }));
    this.subscribe(EventType.CHUNK_LOADED, (data: { chunkId: string; chunkData: WorldChunk }) => {
      // Convert chunkId to chunkX/chunkZ coordinates
      const coords = this.parseChunkId(data.chunkId);
      this.onChunkLoaded({ chunkX: coords.x, chunkZ: coords.z });
    });
    this.subscribe(EventType.CHUNK_UNLOADED, (data: { chunkId: string }) => {
      // Convert chunkId to chunkX/chunkZ coordinates
      const coords = this.parseChunkId(data.chunkId);
      this.onChunkUnloaded({ chunkX: coords.x, chunkZ: coords.z });
    });
    
    // Subscribe to persistence test events
    this.subscribe(EventType.PERSISTENCE_SAVE, (data: { playerId: string; data?: Record<string, unknown> }) => {
      this.handleTestSave({ playerId: data.playerId, data: data.data || {} });
    });
    this.subscribe(EventType.PERSISTENCE_LOAD, (data: { playerId: string }) => {
      this.handleTestLoad({ playerId: data.playerId });
    });
    
  }

  /**
   * Handle test save request
   */
  private handleTestSave(data: { playerId: string; data: Record<string, unknown> }): void {
    // Save test data for a player
    this.logger.info(`Test save for player ${data.playerId}`);
    // In a real implementation, this would save the data to storage
    // For now, just emit a success event
    this.emitTypedEvent(EventType.PERSISTENCE_SAVE, {
      playerId: data.playerId,
      success: true
    });
  }

  /**
   * Handle test load request
   */
  private handleTestLoad(data: { playerId: string }): void {
    // Load test data for a player
    this.logger.info(`Test load for player ${data.playerId}`);
    // In a real implementation, this would load the data from storage
    // For now, just emit a success event with mock data
    this.emitTypedEvent(EventType.PERSISTENCE_LOAD, {
      playerId: data.playerId,
      data: {
        testData: 'loaded'
      },
      success: true
    });
  }

  /**
   * Parse a chunk ID string like "chunk_10_20" to coordinates
   */
  private parseChunkId(chunkId: string): { x: number; z: number } {
    const parts = chunkId.split('_');
    if (parts.length >= 3) {
      return { x: parseInt(parts[1], 10), z: parseInt(parts[2], 10) };
    }
    this.logger.warn(`Invalid chunk ID format: ${chunkId}`);
    return { x: 0, z: 0 };
  }

  start(): void {
    this.logger.info('Starting persistence services...');
    
    // Initialize last execution times
    const now = Date.now();
    this.lastPeriodicSave = now;
    this.lastChunkCleanup = now;
    this.lastSessionCleanup = now;
    this.lastMaintenance = now;
    
    this.logger.info('Persistence services started - using frame-based updates');
  }

  destroy(): void {
    // Perform final save before shutting down
    this.performPeriodicSave().catch(error => {
      this.logger.error('Failed to perform final save', error instanceof Error ? error : new Error(String(error)));
    });
    
    // Clear persistence state
    this.stats = {
      totalSaves: 0,
      lastSaveTime: 0,
      chunksReset: 0,
      sessionsEnded: 0,
      lastMaintenanceTime: 0
    };
    
    // Reset timing variables
    this.lastPeriodicSave = 0;
    this.lastChunkCleanup = 0;
    this.lastSessionCleanup = 0;
    this.lastMaintenance = 0;
    
    // Call parent cleanup (handles event listeners automatically)
    super.destroy();
    
    this.logger.info('Persistence system destroyed');
  }

  // Event Handlers
  private async onPlayerEnter(event: { playerId: string; userId?: string; playerToken?: string }): Promise<void> {
    if (!this.databaseSystem) return;
    
    console.log('[PersistenceSystem] onPlayerEnter event:', {
      playerId: event.playerId,
      userId: event.userId,
      hasUserId: !!event.userId
    });
    
    // Use userId from event if available, otherwise fall back to playerId
    // userId is the persistent account/character ID that exists in the database
    const characterId = event.userId || event.playerId;
    
    console.log('[PersistenceSystem] Using characterId for session:', characterId);
    
    // Ensure the character exists before creating the session
    // Use UPSERT to create minimal character if it doesn't exist yet
    // This handles race conditions where PersistenceSystem runs before PlayerSystem
    await this.databaseSystem.savePlayerAsync(characterId, {
      name: `Player_${characterId.substring(0, 8)}`,
      // These are defaults that will be overwritten by PlayerSystem when it runs
      combatLevel: 1,
      attackLevel: 1, 
      strengthLevel: 1,
      defenseLevel: 1,
      constitutionLevel: 10,
      rangedLevel: 1,
      health: 100,
      maxHealth: 100
    });
    
    const sessionData: Omit<PlayerSessionRow, 'id' | 'sessionId'> = {
      playerId: characterId, // Use character ID for foreign key
      sessionStart: Date.now(),
      sessionEnd: null,
      playtimeMinutes: 0,
      reason: null,
      lastActivity: Date.now()
    };
    
    await this.databaseSystem.createPlayerSessionAsync(sessionData);
  }

  private async onPlayerLeave(event: { playerId: string; userId?: string; sessionId?: string; reason?: string }): Promise<void> {
    if (!this.databaseSystem) return;
    
    // Use userId from event if available, otherwise try mapper, then fall back to playerId
    const characterId = event.userId || PlayerIdMapper.getDatabaseId(event.playerId);
    
    // Find and end the player's active session using character ID
    const activeSessions = await this.databaseSystem.getActivePlayerSessionsAsync();
    const playerSession = activeSessions.find(s => s.playerId === characterId);
    
    if (playerSession) {
      await this.databaseSystem.endPlayerSessionAsync(playerSession.id, event.reason || 'disconnect');
      this.stats.sessionsEnded++;
    }
  }

  private async onChunkLoaded(event: { chunkX: number; chunkZ: number }): Promise<void> {
    if (!this.databaseSystem) return;
    
    // Update chunk activity
    this.databaseSystem.updateChunkPlayerCount(event.chunkX, event.chunkZ, 1);
  }

  private async onChunkUnloaded(event: { chunkX: number; chunkZ: number }): Promise<void> {
    if (!this.databaseSystem) return;
    
    // Update chunk activity
    this.databaseSystem.updateChunkPlayerCount(event.chunkX, event.chunkZ, 0);
  }

  // Periodic Tasks
  private async performPeriodicSave(): Promise<void> {
    const startTime = Date.now();
    let saveCount = 0;

    // Save active player sessions
    if (this.databaseSystem) {
      const activeSessions = await this.databaseSystem.getActivePlayerSessionsAsync();
      for (const session of activeSessions) {
        this.databaseSystem.updatePlayerSession(session.id, {
          lastActivity: Date.now()
        });
        saveCount++;
      }
    }

    // Save active chunks
    if (this.terrainSystem && this.databaseSystem) {
      // Get active chunks from terrain system and save them
      // This would need to be implemented in the terrain system
      const activeChunks = await this.getActiveChunks();
      for (const chunk of activeChunks) {
        // Convert WorldChunk to WorldChunkData
        const chunkData: WorldChunkData = {
          chunkX: chunk.chunkX,
          chunkZ: chunk.chunkZ,
          data: JSON.stringify(chunk.data || {}),
          lastActive: chunk.lastActivity ? chunk.lastActivity.getTime() : Date.now(),
          playerCount: 0, // Will be updated by active player tracking
          version: 1
        };
        this.databaseSystem.saveWorldChunk(chunkData);
        saveCount++;
      }
    }

    const duration = Date.now() - startTime;
    this.stats.totalSaves += saveCount;
    this.stats.lastSaveTime = Date.now();

    if (saveCount > 0) {
      this.logger.info(`💾 Periodic save completed: ${saveCount} items in ${duration}ms`);
    }
  }

  private async performChunkCleanup(): Promise<void> {
    if (!this.databaseSystem) return;

    // Find chunks that have been inactive for too long
    const inactiveChunks = this.databaseSystem.getInactiveChunks(this.CHUNK_INACTIVE_TIME / 60000); // Convert to minutes
    
    for (const chunk of inactiveChunks) {
      // Mark chunk for reset
      this.databaseSystem.markChunkForReset(chunk.chunkX, chunk.chunkZ);
      
      // If chunk has no players and has been marked for reset, reset it
      if (chunk.playerCount === 0 && chunk.needsReset === 1) {
        this.databaseSystem.resetChunk(chunk.chunkX, chunk.chunkZ);
        this.stats.chunksReset++;
      }
    }

    if (inactiveChunks.length > 0) {
      this.logger.info(`🧹 Chunk cleanup: ${inactiveChunks.length} inactive chunks processed`);
    }
  }

  private async performSessionCleanup(): Promise<void> {
    if (!this.databaseSystem) return;

    // End stale sessions (no activity for 5+ minutes)
    const activeSessions = await this.databaseSystem.getActivePlayerSessionsAsync();
    const cutoffTime = Date.now() - 300000; // 5 minutes

    for (const session of activeSessions) {
      if (session.lastActivity && session.lastActivity < cutoffTime) {
        this.databaseSystem.endPlayerSession(session.id, 'timeout');
        this.stats.sessionsEnded++;
      }
    }
  }

  private async performMaintenance(): Promise<void> {
    if (!this.databaseSystem) return;

    // Clean up old sessions (7+ days old)
    const oldSessionsDeleted = this.databaseSystem.cleanupOldSessions(7);
    
    // Clean up old chunk activity records (30+ days old)
    const oldActivityDeleted = this.databaseSystem.cleanupOldChunkActivity(30);
    
    // Get database statistics
    const dbStats = this.databaseSystem.getDatabaseStats();

    this.stats.lastMaintenanceTime = Date.now();

    this.logger.info('🔧 Maintenance completed', {
      oldSessionsDeleted,
      oldActivityDeleted,
      dbStats
    });
  }

  // Helper methods
  private async getActiveChunks(): Promise<WorldChunk[]> {
    const activeChunksData = this.terrainSystem?.getActiveChunks() || [];
    return activeChunksData.map(chunkData => {
      const chunkId = `${chunkData.x}_${chunkData.z}`;
      const worldArea = {
        id: 'wilderness',
        name: 'Wilderness',
        description: 'An untamed wilderness area',
        difficultyLevel: 1,
        bounds: {
          minX: chunkData.x * 100,
          maxX: (chunkData.x + 1) * 100,
          minZ: chunkData.z * 100,
          maxZ: (chunkData.z + 1) * 100,
        },
        biomeType: 'plains',
        safeZone: false,
        npcs: [],
        resources: [],
        mobSpawns: [],
        connections: [],
        specialFeatures: [],
      }
      
      return {
        id: chunkId,
        chunkX: chunkData.x,
        chunkZ: chunkData.z,
        bounds: { minX: chunkData.x * 100, maxX: (chunkData.x + 1) * 100, minZ: chunkData.z * 100, maxZ: (chunkData.z + 1) * 100 },
        area: worldArea,
        npcs: [],
        resources: [],
        mobs: [],
        terrainMesh: undefined,
        isLoaded: true,
        data: {},
        lastActivity: new Date(),
        playerCount: 0,
        needsReset: false,
        biome: 'plains',
        heightData: [],
        resourceStates: {},
        mobSpawnStates: {},
        playerModifications: {},
        chunkSeed: 0,
        lastActiveTime: new Date()
      } as WorldChunk;
    });
  }

  // Public API
  async forceSave(): Promise<void> {
    await this.performPeriodicSave();
  }

  async forceChunkCleanup(): Promise<void> {
    await this.performChunkCleanup();
  }

  async forceMaintenance(): Promise<void> {
    await this.performMaintenance();
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  // Active persistence update cycle
  update(_dt: number): void {
    const now = Date.now();
    
    // Check if it's time for periodic save
    if (now - this.lastPeriodicSave >= this.PERIODIC_SAVE_INTERVAL) {
      this.lastPeriodicSave = now;
      this.performPeriodicSave().catch(error => {
        this.logger.error('Periodic save failed', error instanceof Error ? error : new Error(String(error)));
      });
    }
    
    // Check if it's time for chunk cleanup
    if (now - this.lastChunkCleanup >= this.CHUNK_CLEANUP_INTERVAL) {
      this.lastChunkCleanup = now;
      this.performChunkCleanup().catch(error => {
        this.logger.error('Chunk cleanup failed', error instanceof Error ? error : new Error(String(error)));
      });
    }
    
    // Check if it's time for session cleanup
    if (now - this.lastSessionCleanup >= this.SESSION_CLEANUP_INTERVAL) {
      this.lastSessionCleanup = now;
      this.performSessionCleanup().catch(error => {
        this.logger.error('Session cleanup failed', error instanceof Error ? error : new Error(String(error)));
      });
    }
    
    // Check if it's time for maintenance
    if (now - this.lastMaintenance >= this.MAINTENANCE_INTERVAL) {
      this.lastMaintenance = now;
      this.performMaintenance().catch(error => {
        this.logger.error('Maintenance failed', error instanceof Error ? error : new Error(String(error)));
      });
    }
  }

}