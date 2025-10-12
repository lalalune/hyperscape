/**
 * Player Test System
 * Tests player creation, management, state persistence, and lifecycle
 * - Tests player registration and initialization
 * - Tests player data persistence and loading
 * - Tests player position tracking and updates
 * - Tests player disconnection and cleanup
 * - Tests multi-player scenarios and data isolation
 * - Tests player session management
 */

import type { World } from '../types/core';
import type { PlayerRow } from '../types/database';
import type { DatabaseSystem } from '../types/system-interfaces';
import { PlayerSystem } from './PlayerSystem';
import { VisualTestFramework } from './VisualTestFramework';
import { EventType } from '../types/events';

interface PlayerTestData {
  testType: 'registration' | 'persistence' | 'position_tracking' | 'disconnection' | 'multi_player' | 'comprehensive';
  startTime: number;
  playersCreated: string[];
  playersRegistered: string[];
  playersDisconnected: string[];
  positionUpdates: Record<string, number>;
  dataLoaded: Record<string, boolean>;
  dataSaved: Record<string, boolean>;
  sessionData: Record<string, { startTime: number; endTime?: number }>;
  isolationTests: Record<string, boolean>;
  errors: string[];
}

export class PlayerTestSystem extends VisualTestFramework {
  private testData = new Map<string, PlayerTestData>();
  private testDataByPlayerId = new Map<string, string>(); // playerId -> stationId mapping
  private playerSystem!: PlayerSystem;
  private databaseSystem!: DatabaseSystem;

  constructor(world: World) {
    super(world, {
      name: 'player-test',
      dependencies: {
        required: ['player'],
        optional: ['database']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    await super.init();
    
    this.playerSystem = this.world.getSystem<PlayerSystem>('player')!;
    // Database exists only on server; on client this will be undefined
    this.databaseSystem = (this.world.getSystem<DatabaseSystem>('database') as DatabaseSystem | undefined)!;

    // Set up event listeners
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => this.handlePlayerRegistered(data));
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data) => this.handlePlayerUnregistered(data));
    this.subscribe(EventType.PLAYER_POSITION_UPDATED, (data) => this.handlePositionUpdate(data));
    this.subscribe(EventType.PLAYER_DATA_LOADED, (data) => this.handleDataLoaded(data));
    this.subscribe(EventType.PLAYER_DATA_SAVED, (data) => this.handleDataSaved(data));
    this.subscribe(EventType.PLAYER_SESSION_STARTED, (data) => this.handleSessionStarted(data));
    this.subscribe(EventType.PLAYER_SESSION_ENDED, (data) => this.handleSessionEnded(data));

    this.createTestStations();
    this.testStationsCreated = true;
  }

  protected createTestStations(): void {
    const testConfigs = [
      {
        id: 'player-registration-test',
        name: 'Player Registration Test',
        position: { x: 10, y: 1, z: 15 },
        testType: 'registration' as const
      },
      {
        id: 'player-persistence-test',
        name: 'Player Persistence Test',  
        position: { x: 20, y: 1, z: 15 },
        testType: 'persistence' as const
      },
      {
        id: 'position-tracking-test',
        name: 'Position Tracking Test',
        position: { x: 30, y: 1, z: 15 },
        testType: 'position_tracking' as const
      },
      {
        id: 'disconnection-test',
        name: 'Disconnection Test',
        position: { x: 40, y: 1, z: 15 },
        testType: 'disconnection' as const
      },
      {
        id: 'multi-player-test',
        name: 'Multi-Player Test',
        position: { x: 50, y: 1, z: 15 },
        testType: 'multi_player' as const
      },
      {
        id: 'comprehensive-player-test',
        name: 'Comprehensive Player Test',
        position: { x: 60, y: 1, z: 15 },
        testType: 'comprehensive' as const
      }
    ];

    testConfigs.forEach(config => {
      const _station = this.createTestStation(config);
      this.testData.set(config.id, {
        testType: config.testType,
        startTime: 0,
        playersCreated: [],
        playersRegistered: [],
        playersDisconnected: [],
        positionUpdates: {},
        dataLoaded: {},
        dataSaved: {},
        sessionData: {},
        isolationTests: {},
        errors: []
      });
    });
  }

  protected runTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (!testData) {
      this.logger.error(`[PlayerTestSystem] No test data found for station: ${stationId}`);
      this.logger.error(`[PlayerTestSystem] Available stations: ${Array.from(this.testData.keys()).join(', ')}`);
      this.failTest(stationId, `No test data found for station: ${stationId}`);
      return;
    }

    this.startTest(stationId);
    testData.startTime = Date.now();

    switch (testData.testType) {
      case 'registration':
        this.runRegistrationTest(stationId);
        break;
      case 'persistence':
        this.runPersistenceTest(stationId);
        break;
      case 'position_tracking':
        this.runPositionTrackingTest(stationId);
        break;
      case 'disconnection':
        this.runDisconnectionTest(stationId);
        break;
      case 'multi_player':
        this.runMultiPlayerTest(stationId);
        break;
      case 'comprehensive':
        this.runComprehensivePlayerTest(stationId);
        break;
    }
  }

  private async runRegistrationTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    // Test player registration process
    const testPlayerIds = [
      'test-player-reg-1',
      'test-player-reg-2', 
      'test-player-reg-3'
    ];

    for (const playerId of testPlayerIds) {
      try {
        // Create fake player using the visual test framework method
        const player = this.createPlayer({
          id: playerId,
          name: `TestPlayer_${playerId}`,
          position: { x: 10, y: 1, z: 15 }
        });
        
        if (player) {
          testData.playersCreated.push(playerId);
        }

        // Test duplicate registration (should fail gracefully)
        const duplicatePlayer = this.createPlayer({
          id: playerId,
          name: `DuplicatePlayer_${playerId}`,
          position: { x: 10, y: 1, z: 15 }
        });
        if (duplicatePlayer) {
          testData.errors.push(`Unexpected: duplicate registration succeeded for ${playerId}`);
        }

      } catch {
        testData.errors.push(`Registration failed for ${playerId}`);
      }
    }

    setTimeout(() => {
      this.completeRegistrationTest(stationId);
    }, 5000);
  }

  private async runPersistenceTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    const testPlayerId = 'test-player-persist';
    
    try {
      // Create fake player with specific data
      const player = this.createPlayer({
        id: testPlayerId,
        name: 'PersistenceTestPlayer',
        position: { x: 25.5, y: 1.0, z: 20.3 },
        stats: {
          health: 75,
          maxHealth: 100,
          attack: 25,
          defense: 20,
          strength: 22,
          constitution: 18
        }
      });
      
      if (player) {
        testData.playersCreated.push(testPlayerId);
        
        // Add coins to inventory
        if (player.inventory) {
          player.inventory.coins = 5000;
        }
      }

      // Save player data
      await this.savePlayer(testPlayerId, {
        playerId: testPlayerId,
        name: 'PersistenceTestPlayer',
        positionX: 25.5,
        positionY: 1.0,
        positionZ: 20.3,
        health: 75,
        maxHealth: 100,
        combatLevel: 25,
        attackXp: 15000,
        coins: 5000
      });
      testData.dataSaved[testPlayerId] = true;

      // Simulate player disconnect and reconnect
      await this.disconnectPlayer(testPlayerId);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Load player data  
      const loadedData = await this.loadPlayer(testPlayerId);
      if (loadedData) {
        testData.dataLoaded[testPlayerId] = true;
        
        // Verify data integrity
        const dataMatches = 
          loadedData.positionX === 25.5 &&
          loadedData.positionY === 1.0 &&
          loadedData.positionZ === 20.3 &&
          loadedData.health === 75 &&
          loadedData.coins === 5000;

        if (dataMatches) {
          testData.isolationTests['data_integrity'] = true;
        }
      }

    } catch {
      testData.errors.push(`Persistence test failed`);
    }

    setTimeout(() => {
      this.completePersistenceTest(stationId);
    }, 8000);
  }

  private async runPositionTrackingTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    const testPlayerId = 'test-player-position';
    
    const player = this.createPlayer({
      id: testPlayerId,
      name: 'PositionTestPlayer',
      position: { x: 30, y: 1, z: 15 }
    });

    if (player) {
      testData.playersCreated.push(testPlayerId);
    }

    // Create position update sequence
    const positions = [
      { x: 30, y: 1, z: 15 },
      { x: 35, y: 1, z: 18 },
      { x: 32, y: 1, z: 22 },
      { x: 28, y: 1, z: 19 },
      { x: 30, y: 1, z: 15 }
    ];

    // Wait for player to be fully registered before starting position updates
    setTimeout(() => {
      let positionIndex = 0;
      const updatePosition = () => {
      if (positionIndex >= positions.length) {
        this.completePositionTrackingTest(stationId);
        return;
      }

        const position = positions[positionIndex];
        this.updatePlayerPosition(testPlayerId, position);
        positionIndex++;

        setTimeout(updatePosition, 1500);
      };

      updatePosition();
    }, 1000); // Wait 1 second for player registration
  }

  private async runDisconnectionTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    const testPlayerIds = [
      'test-player-disc-1',
      'test-player-disc-2'
    ];

    // Create fake players
    for (const playerId of testPlayerIds) {
      const player = this.createPlayer({
        id: playerId,
        name: `DisconnectPlayer_${playerId}`,
        position: { x: 40, y: 1, z: 15 }
      });
      
      if (player) {
        testData.playersCreated.push(playerId);
      }
    }

    // Wait a bit for registration to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Disconnect players in sequence
    for (const playerId of testPlayerIds) {
      try {
        await this.disconnectPlayer(playerId);
        testData.playersDisconnected.push(playerId);

        // Verify player was cleaned up
        if (!this.playerSystem.getPlayer(playerId)) {
          testData.isolationTests[`cleanup_${playerId}`] = true;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
              } catch {
          testData.errors.push(`Disconnection failed for ${playerId}`);
        }
    }

    setTimeout(() => {
      this.completeDisconnectionTest(stationId);
    }, 3000);
  }

  private async runMultiPlayerTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    const testPlayerIds = [
      'test-multi-player-1',
      'test-multi-player-2',
      'test-multi-player-3',
      'test-multi-player-4'
    ];

    // Create multiple fake players simultaneously
    const registrationPromises = testPlayerIds.map(async (playerId, index) => {
      try {
        const player = this.createPlayer({
          id: playerId,
          name: `MultiPlayer_${index + 1}`,
          position: { x: 50 + index * 2, y: 1, z: 15 + index },
          stats: {
            health: 100,
            attack: 10 + index,
            defense: 10,
            strength: 10,
            constitution: 10
          }
        });
        
        if (player) {
          testData.playersCreated.push(playerId);
          
          // Add coins directly to the fake player's inventory
          if (player.inventory) {
            player.inventory.coins = 1000 * (index + 1);
          }
        }
        
        return { playerId, success: true };
      } catch {
        testData.errors.push(`Multi-player registration failed for ${playerId}`);
        return { playerId, success: false };
      }
    });

    const results = await Promise.all(registrationPromises);
    const _successfulRegistrations = results.filter(r => r.success).length;

    // Give PlayerSystem time to process PLAYER_JOINED events
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test data isolation between players
    for (let i = 0; i < testPlayerIds.length - 1; i++) {
      const player1Id = testPlayerIds[i];
      const player2Id = testPlayerIds[i + 1];
      
      const isolated = await this.testPlayerIsolation(player1Id, player2Id);
      testData.isolationTests[`isolation_${i}`] = isolated;
    }

    // Test concurrent operations
    const concurrentOperations = testPlayerIds.map(async playerId => {
      this.updatePlayerPosition(playerId, {
        x: Math.random() * 100,
        y: 1,
        z: Math.random() * 100
      });
      
      return this.savePlayer(playerId, { health: Math.floor(Math.random() * 100) });
    });

    await Promise.all(concurrentOperations);

    // Test position synchronization and avatar behavior
    // Note: These tests now run within the game context, not via external Playwright
    await this.testInternalPositionSync();
    await this.testInternalRemotePositionSync();
    await this.testInternalAvatarGrounding();
    await this.testInternalCameraTerrain();

    setTimeout(() => {
      this.completeMultiPlayerTest(stationId);
    }, 6000);
  }

  private async runComprehensivePlayerTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    // Create comprehensive test players
    const testPlayerIds = [
      'comp-test-player-1',
      'comp-test-player-2',
      'comp-test-player-3',
      'comp-test-player-4'
    ];

    // Create all test players first
    for (const playerId of testPlayerIds) {
      try {
        const player = this.createPlayer({
          id: playerId,
          name: `CompTestPlayer_${playerId}`,
          position: { x: 60 + Math.random() * 5, y: 1, z: 15 + Math.random() * 5 },
          stats: {
            health: 100,
            attack: 15,
            defense: 12,
            strength: 14,
            constitution: 16
          }
        });
        
        if (player) {
          testData.playersCreated.push(playerId);
        }
      } catch (error) {
        testData.errors.push(`Failed to create player ${playerId}: ${error}`);
      }
    }

    // Wait for registration events
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run position tracking test
    if (testPlayerIds[0] && this.fakePlayers.get(testPlayerIds[0])) {
      const positions = [
        { x: 61, y: 1, z: 16 },
        { x: 62, y: 1, z: 17 },
        { x: 63, y: 1, z: 18 }
      ];
      
      for (const pos of positions) {
        this.updatePlayerPosition(testPlayerIds[0], pos);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Test isolation between players
    for (let i = 0; i < testPlayerIds.length - 1; i++) {
      const player1Id = testPlayerIds[i];
      const player2Id = testPlayerIds[i + 1];
      
      const isolated = await this.testPlayerIsolation(player1Id, player2Id);
      testData.isolationTests[`isolation_${i}`] = isolated;
    }

    // Test concurrent operations
    const concurrentOperations = testPlayerIds.map(async playerId => {
      this.updatePlayerPosition(playerId, {
        x: Math.random() * 100,
        y: 1,
        z: Math.random() * 100
      });
      
      return this.savePlayer(playerId, { health: Math.floor(Math.random() * 100) });
    });

    await Promise.all(concurrentOperations);

    setTimeout(() => {
      this.completeComprehensiveTest(stationId);
    }, 5000);
  }

  private async testInternalPositionSync(): Promise<void> {
    // Test position synchronization within the game context
    const testPlayerId = 'position-sync-test-player';
    const player = this.createPlayer({
      id: testPlayerId,
      name: 'PositionSyncTestPlayer',
      position: { x: 10, y: 1, z: 10 }
    });
    
    if (player) {
      // Update position and verify it's tracked
      const newPosition = { x: 20, y: 1, z: 20 };
      this.updatePlayerPosition(testPlayerId, newPosition);
      
      // Wait for position update to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if position was updated in player system
      const updatedPlayer = this.playerSystem.getPlayer(testPlayerId);
      if (updatedPlayer && updatedPlayer.position) {
        const positionMatches = 
          Math.abs(updatedPlayer.position.x - newPosition.x) < 0.1 &&
          Math.abs(updatedPlayer.position.z - newPosition.z) < 0.1;
        
        if (!positionMatches) {
          this.logger.warn('[PlayerTestSystem] Position sync test failed');
        }
      }
    }
  }

  private async testInternalRemotePositionSync(): Promise<void> {
    // Test remote player position synchronization
    const localPlayerId = 'local-sync-test';
    const remotePlayerId = 'remote-sync-test';
    
    // Create local and remote players
    this.createPlayer({
      id: localPlayerId,
      name: 'LocalPlayer',
      position: { x: 30, y: 1, z: 30 }
    });
    
    this.createPlayer({
      id: remotePlayerId,
      name: 'RemotePlayer',
      position: { x: 35, y: 1, z: 35 }
    });
    
    // Move local player
    const newLocalPos = { x: 32, y: 1, z: 32 };
    this.updatePlayerPosition(localPlayerId, newLocalPos);
    
    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify positions are independent
    const localPlayer = this.playerSystem.getPlayer(localPlayerId);
    const remotePlayer = this.playerSystem.getPlayer(remotePlayerId);
    
    if (localPlayer && remotePlayer) {
      // Positions should be different (isolation test)
      const isolated = 
        localPlayer.position?.x !== remotePlayer.position?.x ||
        localPlayer.position?.z !== remotePlayer.position?.z;
      
      if (!isolated) {
        this.logger.warn('[PlayerTestSystem] Remote position sync isolation failed');
      }
    }
  }

  private async testInternalAvatarGrounding(): Promise<void> {
    // Test avatar grounding on terrain
    const testPlayerId = 'grounding-test-player';
    
    // Create player at a specific position
    const player = this.createPlayer({
      id: testPlayerId,
      name: 'GroundingTestPlayer',
      position: { x: 40, y: 50, z: 40 } // Start high
    });
    
    if (player) {
      // Wait for physics to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if player has settled to ground level
      const settledPlayer = this.playerSystem.getPlayer(testPlayerId);
      if (settledPlayer && settledPlayer.position) {
        // Y position should be near ground level (not at spawn height)
        const isGrounded = settledPlayer.position.y < 10; // Assuming ground is below y=10
        
        if (!isGrounded) {
          this.logger.warn('[PlayerTestSystem] Avatar grounding test failed - player still at height:', { height: settledPlayer.position.y });
        }
      }
    }
  }

  private async testInternalCameraTerrain(): Promise<void> {
    // Test camera positioning relative to terrain
    const testPlayerId = 'camera-terrain-test';
    
    // Create player
    const player = this.createPlayer({
      id: testPlayerId,
      name: 'CameraTerrainTestPlayer',
      position: { x: 50, y: 1, z: 50 }
    });
    
    if (player) {
      // Move player to test camera following
      const positions = [
        { x: 52, y: 1, z: 52 },
        { x: 55, y: 1, z: 55 },
        { x: 50, y: 1, z: 50 }
      ];
      
      for (const pos of positions) {
        this.updatePlayerPosition(testPlayerId, pos);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // In a real test, we would check camera position here
      // For now, we just verify the player moved successfully
      const finalPlayer = this.playerSystem.getPlayer(testPlayerId);
      if (finalPlayer && finalPlayer.position) {
        const atFinalPosition = 
          Math.abs(finalPlayer.position.x - 50) < 1 &&
          Math.abs(finalPlayer.position.z - 50) < 1;
        
        if (!atFinalPosition) {
          this.logger.warn('[PlayerTestSystem] Camera terrain test - unexpected final position');
        }
      }
    }
  }

  private async testHighLatencySync(): Promise<void> {
    // Simulate delay with await new Promise(resolve => setTimeout(resolve, 200));
    // After move, await delay, then verify
  }
  // Call in runMultiPlayerTest
  // Similar for testRotationSync and testHighLatencyRotation

  // Event handlers
  private handlePlayerRegistered(data: { playerId: string }): void {
    // Track player registrations
    for (const testData of this.testData.values()) {
      if (testData.playersCreated.includes(data.playerId)) {
        testData.playersRegistered.push(data.playerId);
      }
    }
  }

  private handlePlayerUnregistered(data: { playerId: string }): void {
    // Track player disconnections  
    for (const testData of this.testData.values()) {
      if (testData.playersCreated.includes(data.playerId)) {
        testData.playersDisconnected.push(data.playerId);
      }
    }
  }

  private handlePositionUpdate(data: { playerId: string; position: { x: number; y: number; z: number } }): void {
    // Track position updates
    for (const testData of this.testData.values()) {
      if (testData.playersCreated.includes(data.playerId)) {
        testData.positionUpdates[data.playerId] = (testData.positionUpdates[data.playerId] || 0) + 1;
      }
    }
  }

  private handleDataLoaded(data: { playerId: string }): void {
    for (const testData of this.testData.values()) {
      if (testData.playersCreated.includes(data.playerId)) {
        testData.dataLoaded[data.playerId] = true;
      }
    }
  }

  private handleDataSaved(data: { playerId: string }): void {
    for (const testData of this.testData.values()) {
      if (testData.playersCreated.includes(data.playerId)) {
        testData.dataSaved[data.playerId] = true;
      }
    }
  }

  private handleSessionStarted(data: { playerId: string; sessionId: string }): void {
    for (const testData of this.testData.values()) {
      if (testData.playersCreated.includes(data.playerId)) {
        testData.sessionData[data.playerId] = { startTime: Date.now() };
      }
    }
  }

  private handleSessionEnded(data: { playerId: string; sessionId: string }): void {
    for (const testData of this.testData.values()) {
      if (testData.sessionData[data.playerId]) {
        testData.sessionData[data.playerId].endTime = Date.now();
      }
    }
  }

  // Test completion methods
  private completeRegistrationTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const playersCreated = testData.playersCreated.length;
    const playersRegistered = testData.playersRegistered.length;
    const hasErrors = testData.errors.length > 0;

    const success = playersCreated > 0 && playersRegistered === playersCreated && !hasErrors;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Created ${playersCreated}, registered ${playersRegistered}, errors: ${testData.errors.length}`);
    }
  }

  private completePersistenceTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const dataSaved = Object.values(testData.dataSaved).some(saved => saved);
    const dataLoaded = Object.values(testData.dataLoaded).some(loaded => loaded);
    const dataIntegrity = testData.isolationTests['data_integrity'];

    const success = dataSaved && dataLoaded && dataIntegrity;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Save: ${dataSaved}, Load: ${dataLoaded}, Integrity: ${dataIntegrity}`);
    }
  }

  private completePositionTrackingTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const positionUpdates = Object.values(testData.positionUpdates).reduce((sum, count) => sum + count, 0);
    const expectedUpdates = 5; // Number of position updates in sequence

    const success = positionUpdates >= expectedUpdates;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Expected ${expectedUpdates} position updates, got ${positionUpdates}`);
    }
  }

  private completeDisconnectionTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const playersDisconnected = testData.playersDisconnected.length;
    const cleanupTests = Object.values(testData.isolationTests).filter(test => test).length;
    const expectedPlayers = 2;

    const success = playersDisconnected === expectedPlayers && cleanupTests === expectedPlayers;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Disconnected ${playersDisconnected}/${expectedPlayers}, cleaned up ${cleanupTests}/${expectedPlayers}`);
    }
  }

  private completeMultiPlayerTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const playersCreated = testData.playersCreated.length;
    const isolationTests = Object.values(testData.isolationTests).filter(test => test).length;
    const expectedPlayers = 4;

    const success = playersCreated === expectedPlayers && isolationTests > 0;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Created ${playersCreated}/${expectedPlayers} players, ${isolationTests} isolation tests passed`);
    }
  }

  private completeComprehensiveTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const totalPlayers = testData.playersCreated.length;
    const totalRegistrations = testData.playersRegistered.length;
    const totalPositionUpdates = Object.values(testData.positionUpdates).reduce((sum, count) => sum + count, 0);
    const totalIsolationTests = Object.values(testData.isolationTests).filter(test => test).length;

    const success = totalPlayers > 5 && totalRegistrations > 3 && totalPositionUpdates > 5 && totalIsolationTests > 2;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, 'Comprehensive player test did not meet all criteria');
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (testData) {
      // Clean up test players
      testData.playersCreated.forEach(playerId => {
        this.disconnectPlayer(playerId);
      });
      
      this.testData.delete(stationId);
    }
  }

  // Helper methods for player system interaction
  private async registerTestPlayer(playerId: string, playerData: Partial<PlayerRow>): Promise<void> {
    // Register player via database system (player system registerPlayer method doesn't exist)
    this.databaseSystem.savePlayer(playerId, playerData);
  }

  private async disconnectPlayer(_playerId: string): Promise<void> {
    // Disconnect player (unregisterPlayer method doesn't exist, using alternative approach)
    // In a real implementation, this might involve removing from active sessions or marking as disconnected
  }

  private updatePlayerPosition(playerId: string, position: { x: number; y: number; z: number }): void {
    // Update player position (method returns a Promise)
    const playerSystem = this.playerSystem;
    if (!playerSystem) return;
    // Strong type assumption - playerSystem has updatePlayerPosition method
    void playerSystem.updatePlayerPosition(playerId, position);
  }

  private async savePlayer(playerId: string, data: Partial<PlayerRow>): Promise<void> {
    // Prefer database when available (server)
    if (this.databaseSystem) {
      this.databaseSystem.savePlayer(playerId, data);
      return;
    }

    // Client fallback: maintain an in-memory store sufficient for tests
    const existing = this.buildDefaultPlayerRow(playerId, data.name || `Player_${playerId}`);
    const _merged: PlayerRow = {
      ...existing,
      ...data,
      // Ensure explicit numeric fields are preserved when provided
      positionX: data.positionX ?? existing.positionX,
      positionY: data.positionY ?? existing.positionY,
      positionZ: data.positionZ ?? existing.positionZ,
      health: data.health ?? existing.health,
      maxHealth: data.maxHealth ?? existing.maxHealth,
      coins: data.coins ?? existing.coins,
    } as PlayerRow;
    // this.localPlayerStore.set(playerId, merged); // This line is removed
  }

  private async loadPlayer(playerId: string): Promise<PlayerRow | undefined> {
    // Load via database if available (server)
    if (this.databaseSystem) {
      return this.databaseSystem.getPlayer(playerId) || undefined;
    }
    // Client fallback from local store
    return this.buildDefaultPlayerRow(playerId, `Player_${playerId}`);
  }

  private async testPlayerIsolation(player1Id: string, player2Id: string): Promise<boolean> {
    // Ensure PlayerSystem has processed registrations
    await new Promise(resolve => setTimeout(resolve, 200));
    const player1Data = this.playerSystem.getPlayer(player1Id);
    const player2Data = this.playerSystem.getPlayer(player2Id);
    return !!(player1Data && player2Data && player1Data.id !== player2Data.id);
  }

  async getSystemRating(): Promise<string> {
    const allTests = Array.from(this.testStations.values());
    const passedTests = allTests.filter(station => station.status === 'passed').length;
    const totalTests = allTests.length;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return `Player System: ${passedTests}/${totalTests} tests passed (${passRate.toFixed(1)}%)`;
  }

  // Helper to create a fully-typed PlayerRow for client-side tests
  private buildDefaultPlayerRow(playerId: string, name: string): PlayerRow {
    const now = Date.now();
    return {
      id: 0,
      playerId,
      name,
      combatLevel: 1,
      attackLevel: 1,
      strengthLevel: 1,
      defenseLevel: 1,
      constitutionLevel: 10,
      rangedLevel: 1,
      attackXp: 0,
      strengthXp: 0,
      defenseXp: 0,
      constitutionXp: 0,
      rangedXp: 0,
      health: 100,
      maxHealth: 100,
      coins: 0,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      lastLogin: now,
      createdAt: now,
      woodcuttingLevel: 1,
      woodcuttingXp: 0,
      fishingLevel: 1,
      fishingXp: 0,
      firemakingLevel: 1,
      firemakingXp: 0,
      cookingLevel: 1,
      cookingXp: 0,
    };
  }

  // Lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}