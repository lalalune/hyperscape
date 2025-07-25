import { System } from '../../core/systems/System';
import { RPGDatabaseSystem } from './RPGDatabaseSystem';
import { RPGPlayerSystem } from './RPGPlayerSystem';
import { TerrainSystem } from '../../core/systems/TerrainSystem';
import type { RPGPlayerSession, RPGWorldChunk } from '../types/index';

/**
 * RPG Persistence System
 * Coordinates all persistence operations across the RPG systems
 * - Manages periodic saves for performance optimization
 * - Handles session tracking and cleanup
 * - Manages chunk inactivity and reset timers
 * - Provides centralized persistence monitoring
 */
export class RPGPersistenceSystem extends System {
  private databaseSystem?: RPGDatabaseSystem;
  private playerSystem?: RPGPlayerSystem;
  private terrainSystem?: TerrainSystem;
  
  // Timers and intervals
  private periodicSaveInterval?: NodeJS.Timeout;
  private chunkCleanupInterval?: NodeJS.Timeout;
  private sessionCleanupInterval?: NodeJS.Timeout;
  private maintenanceInterval?: NodeJS.Timeout;
  
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

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGPersistenceSystem] Initializing persistence system...');
    
    // Get references to other systems
    this.databaseSystem = this.world['rpg-database-system'];
    if (!this.databaseSystem) {
      throw new Error('[RPGPersistenceSystem] RPGDatabaseSystem not found!');
    }
    
    this.playerSystem = this.world['rpg-player-system'];
    if (!this.playerSystem) {
      console.warn('[RPGPersistenceSystem] RPGPlayerSystem not found - player persistence will be limited');
    }
    
    this.terrainSystem = this.world['unified-terrain-system'];
    if (!this.terrainSystem) {
      console.warn('[RPGPersistenceSystem] TerrainSystem not found - chunk persistence will be limited');
    }
    
    // Listen for critical events
    this.world.on?.('rpg:player:enter', this.onPlayerEnter.bind(this));
    this.world.on?.('rpg:player:leave', this.onPlayerLeave.bind(this));
    this.world.on?.('rpg:chunk:loaded', this.onChunkLoaded.bind(this));
    this.world.on?.('rpg:chunk:unloaded', this.onChunkUnloaded.bind(this));
    
    console.log('[RPGPersistenceSystem] Persistence system initialized');
  }

  start(): void {
    console.log('[RPGPersistenceSystem] Starting persistence system...');
    
    // Start all periodic tasks
    this.startPeriodicSave();
    this.startChunkCleanup();
    this.startSessionCleanup();
    this.startMaintenance();
    
    console.log('[RPGPersistenceSystem] All persistence tasks started');
  }

  destroy(): void {
    // Stop all intervals
    if (this.periodicSaveInterval) {
      clearInterval(this.periodicSaveInterval);
      this.periodicSaveInterval = undefined;
    }
    
    if (this.chunkCleanupInterval) {
      clearInterval(this.chunkCleanupInterval);
      this.chunkCleanupInterval = undefined;
    }
    
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = undefined;
    }
    
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = undefined;
    }
    
    console.log('[RPGPersistenceSystem] Persistence system destroyed');
  }

  // Event Handlers
  private async onPlayerEnter(event: { playerId: string; playerToken?: string }): Promise<void> {
    if (!this.databaseSystem) return;
    
    try {
      // Create player session
      const sessionData: Omit<RPGPlayerSession, 'id'> = {
        sessionId: `session_${event.playerId}_${Date.now()}`,
        playerId: event.playerId,
        playerToken: event.playerToken || 'unknown',
        startTime: new Date(),
        lastActivity: new Date(),
        lastSaveTime: new Date(),
        autoSaveInterval: 30, // seconds
        isActive: true
      };
      
      await this.databaseSystem.createPlayerSession(sessionData);
      console.log(`[RPGPersistenceSystem] Created session for player ${event.playerId}`);
    } catch (error) {
      console.error(`[RPGPersistenceSystem] Failed to create session for player ${event.playerId}:`, error);
    }
  }

  private async onPlayerLeave(event: { playerId: string; sessionId?: string; reason?: string }): Promise<void> {
    if (!this.databaseSystem) return;
    
    try {
      // Find and end the player's active session
      const activeSessions = this.databaseSystem.getActivePlayerSessions();
      const playerSession = activeSessions.find(s => s.playerId === event.playerId);
      
      if (playerSession) {
        this.databaseSystem.endPlayerSession(playerSession.sessionId, event.reason || 'disconnect');
        this.stats.sessionsEnded++;
        console.log(`[RPGPersistenceSystem] Ended session for player ${event.playerId}`);
      }
    } catch (error) {
      console.error(`[RPGPersistenceSystem] Failed to end session for player ${event.playerId}:`, error);
    }
  }

  private async onChunkLoaded(event: { chunkX: number; chunkZ: number }): Promise<void> {
    if (!this.databaseSystem) return;
    
    try {
      // Update chunk activity
      this.databaseSystem.updateChunkPlayerCount(event.chunkX, event.chunkZ, 1);
      console.log(`[RPGPersistenceSystem] Chunk (${event.chunkX}, ${event.chunkZ}) loaded`);
    } catch (error) {
      console.error(`[RPGPersistenceSystem] Failed to update chunk activity:`, error);
    }
  }

  private async onChunkUnloaded(event: { chunkX: number; chunkZ: number }): Promise<void> {
    if (!this.databaseSystem) return;
    
    try {
      // Update chunk activity
      this.databaseSystem.updateChunkPlayerCount(event.chunkX, event.chunkZ, 0);
      console.log(`[RPGPersistenceSystem] Chunk (${event.chunkX}, ${event.chunkZ}) unloaded`);
    } catch (error) {
      console.error(`[RPGPersistenceSystem] Failed to update chunk activity:`, error);
    }
  }

  // Periodic Tasks
  private startPeriodicSave(): void {
    if (this.periodicSaveInterval) {
      clearInterval(this.periodicSaveInterval);
    }

    this.periodicSaveInterval = setInterval(async () => {
      await this.performPeriodicSave();
    }, this.PERIODIC_SAVE_INTERVAL);

    console.log(`[RPGPersistenceSystem] Periodic save started (${this.PERIODIC_SAVE_INTERVAL}ms interval)`);
  }

  private async performPeriodicSave(): Promise<void> {
    try {
      const startTime = Date.now();
      let saveCount = 0;

      // Save active player sessions
      if (this.databaseSystem) {
        const activeSessions = this.databaseSystem.getActivePlayerSessions();
        for (const session of activeSessions) {
          this.databaseSystem.updatePlayerSession(session.sessionId, {
            lastActivity: new Date(),
            lastSaveTime: new Date()
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
          this.databaseSystem.saveWorldChunk(chunk);
          saveCount++;
        }
      }

      const duration = Date.now() - startTime;
      this.stats.totalSaves += saveCount;
      this.stats.lastSaveTime = Date.now();

      if (saveCount > 0) {
        console.log(`[RPGPersistenceSystem] Periodic save completed: ${saveCount} items in ${duration}ms`);
      }
    } catch (error) {
      console.error('[RPGPersistenceSystem] Periodic save failed:', error);
    }
  }

  private startChunkCleanup(): void {
    if (this.chunkCleanupInterval) {
      clearInterval(this.chunkCleanupInterval);
    }

    this.chunkCleanupInterval = setInterval(async () => {
      await this.performChunkCleanup();
    }, this.CHUNK_CLEANUP_INTERVAL);

    console.log(`[RPGPersistenceSystem] Chunk cleanup started (${this.CHUNK_CLEANUP_INTERVAL}ms interval)`);
  }

  private async performChunkCleanup(): Promise<void> {
    if (!this.databaseSystem) return;

    try {
      // Find chunks that have been inactive for too long
      const inactiveChunks = this.databaseSystem.getInactiveChunks(this.CHUNK_INACTIVE_TIME / 60000); // Convert to minutes
      
      for (const chunk of inactiveChunks) {
        // Mark chunk for reset
        this.databaseSystem.markChunkForReset(chunk.chunkX, chunk.chunkZ);
        
        // If chunk has no players and has been marked for reset, reset it
        if (chunk.playerCount === 0 && chunk.needsReset) {
          this.databaseSystem.resetChunk(chunk.chunkX, chunk.chunkZ);
          this.stats.chunksReset++;
          console.log(`[RPGPersistenceSystem] Reset inactive chunk (${chunk.chunkX}, ${chunk.chunkZ})`);
        }
      }

      if (inactiveChunks.length > 0) {
        console.log(`[RPGPersistenceSystem] Processed ${inactiveChunks.length} inactive chunks`);
      }
    } catch (error) {
      console.error('[RPGPersistenceSystem] Chunk cleanup failed:', error);
    }
  }

  private startSessionCleanup(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }

    this.sessionCleanupInterval = setInterval(async () => {
      await this.performSessionCleanup();
    }, this.SESSION_CLEANUP_INTERVAL);

    console.log(`[RPGPersistenceSystem] Session cleanup started (${this.SESSION_CLEANUP_INTERVAL}ms interval)`);
  }

  private async performSessionCleanup(): Promise<void> {
    if (!this.databaseSystem) return;

    try {
      // End stale sessions (no activity for 5+ minutes)
      const activeSessions = this.databaseSystem.getActivePlayerSessions();
      const cutoffTime = Date.now() - 300000; // 5 minutes

      for (const session of activeSessions) {
        if (session.lastActivity.getTime() < cutoffTime) {
          this.databaseSystem.endPlayerSession(session.sessionId, 'timeout');
          this.stats.sessionsEnded++;
          console.log(`[RPGPersistenceSystem] Ended stale session: ${session.sessionId}`);
        }
      }
    } catch (error) {
      console.error('[RPGPersistenceSystem] Session cleanup failed:', error);
    }
  }

  private startMaintenance(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    this.maintenanceInterval = setInterval(async () => {
      await this.performMaintenance();
    }, this.MAINTENANCE_INTERVAL);

    console.log(`[RPGPersistenceSystem] Maintenance started (${this.MAINTENANCE_INTERVAL}ms interval)`);
  }

  private async performMaintenance(): Promise<void> {
    if (!this.databaseSystem) return;

    try {
      console.log('[RPGPersistenceSystem] Starting maintenance...');

      // Clean up old sessions (7+ days old)
      const oldSessionsDeleted = this.databaseSystem.cleanupOldSessions(7);
      
      // Clean up old chunk activity records (30+ days old)
      const oldActivityDeleted = this.databaseSystem.cleanupOldChunkActivity(30);
      
      // Get database statistics
      const dbStats = this.databaseSystem.getDatabaseStats();

      this.stats.lastMaintenanceTime = Date.now();

      console.log(`[RPGPersistenceSystem] Maintenance completed:`, {
        oldSessionsDeleted,
        oldActivityDeleted,
        databaseStats: dbStats,
        systemStats: this.stats
      });
    } catch (error) {
      console.error('[RPGPersistenceSystem] Maintenance failed:', error);
    }
  }

  // Helper methods
  private async getActiveChunks(): Promise<RPGWorldChunk[]> {
    // This would need to be implemented to get active chunks from the terrain system
    // For now, return empty array
    return [];
  }

  // Public API
  async forceSave(): Promise<void> {
    console.log('[RPGPersistenceSystem] Forcing immediate save...');
    await this.performPeriodicSave();
  }

  async forceChunkCleanup(): Promise<void> {
    console.log('[RPGPersistenceSystem] Forcing chunk cleanup...');
    await this.performChunkCleanup();
  }

  async forceMaintenance(): Promise<void> {
    console.log('[RPGPersistenceSystem] Forcing maintenance...');
    await this.performMaintenance();
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}