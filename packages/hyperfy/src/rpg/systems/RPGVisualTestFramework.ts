/**
 * RPG Visual Test Framework System
 * Provides infrastructure for visual testing of all gameplay systems
 * - Creates visible test stations around the world with floating names
 * - Manages test lifecycle (setup, execution, validation, cleanup, restart)
 * - Provides fake players, mobs, and items for testing
 * - Automatic timeout and error handling
 * - Visual status indicators and logging
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

export interface TestStation {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  status: 'idle' | 'running' | 'passed' | 'failed';
  lastRunTime: number;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  currentError?: string;
  timeoutMs: number;
  ui?: any; // UI element for floating name
  testZone?: any; // Visual zone indicator
}

export interface TestResult {
  success: boolean;
  error?: string;
  duration: number;
  details?: any;
}

export interface FakePlayer {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  stats: {
    // Combat Skills
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
    constitution: number;
    health: number;
    maxHealth: number;
    // Gathering Skills
    woodcutting: number;
    fishing: number;
    firemaking: number;
    cooking: number;
    // Movement
    stamina: number;
    maxStamina: number;
  };
  inventory: any[];
  equipment: any;
  visualProxy?: any; // Colored cube for visual representation
}

export abstract class RPGVisualTestFramework extends System {
  protected testStations = new Map<string, TestStation>();
  protected fakePlayers = new Map<string, FakePlayer>();
  private updateInterval: NodeJS.Timeout | null = null;
  private testColors = {
    idle: '#888888',     // Gray
    running: '#ffaa00',  // Orange
    passed: '#00ff00',   // Green
    failed: '#ff0000'    // Red
  };

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGVisualTestFramework] Initializing visual test framework...');
    
    // Only run on server
    if (!this.world.isServer) {
      console.log('[RPGVisualTestFramework] Client detected, skipping server-only framework');
      return;
    }

    // Listen for world events
    this.world.on('rpg:test:station:created', this.onTestStationCreated.bind(this));
    this.world.on('rpg:test:result', this.onTestResult.bind(this));
    
    console.log('[RPGVisualTestFramework] Visual test framework initialized');
  }

  start(): void {
    console.log('[RPGVisualTestFramework] Starting visual test framework...');
    
    // Start test monitoring loop
    this.updateInterval = setInterval(() => {
      this.updateTestStations();
    }, 1000); // Update every second
    
    console.log('[RPGVisualTestFramework] Visual test framework started');
  }

  /**
   * Creates a new test station at the specified position
   */
  protected createTestStation(config: {
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    timeoutMs?: number;
  }): TestStation {
    const station: TestStation = {
      id: config.id,
      name: config.name,
      position: config.position,
      status: 'idle',
      lastRunTime: 0,
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      timeoutMs: config.timeoutMs || 30000, // 30 seconds default
    };

    // Create visual indicators
    this.createStationVisuals(station);
    
    this.testStations.set(config.id, station);
    
    console.log(`[RPGVisualTestFramework] Created test station: ${config.name} at (${config.position.x}, ${config.position.y}, ${config.position.z})`);
    
    // Notify world
    this.world.emit('rpg:test:station:created', { station });
    
    return station;
  }

  /**
   * Creates visual indicators for a test station
   */
  private createStationVisuals(station: TestStation): void {
    // Create floating name UI
    station.ui = this.createFloatingNameUI(station);
    
    // Create colored zone indicator (cube at ground level)
    station.testZone = this.createTestZoneIndicator(station);
    
    this.updateStationVisuals(station);
  }

  /**
   * Creates floating name UI above test station
   */
  private createFloatingNameUI(station: TestStation): any {
    // Create UI container for floating name
    const ui = this.world.stage?.scene ? {
      // Simplified UI creation for now - would be enhanced with actual Hyperfy UI system
      position: { ...station.position, y: station.position.y + 3 },
      text: station.name,
      status: station.status
    } : null;

    if (ui && this.world.stage?.scene) {
      // In a real implementation, this would create a UI element
      // For now, we'll emit an event that the client systems can handle
      this.world.emit('rpg:test:ui:create', {
        id: `test_ui_${station.id}`,
        type: 'floating_name',
        position: ui.position,
        text: ui.text,
        color: this.testColors[station.status]
      });
    }

    return ui;
  }

  /**
   * Creates a colored cube indicator on the ground
   */
  private createTestZoneIndicator(station: TestStation): any {
    const indicator = {
      position: { ...station.position, y: station.position.y + 0.5 },
      color: this.testColors[station.status],
      size: { x: 2, y: 1, z: 2 }
    };

    // Emit event for visual creation
    this.world.emit('rpg:test:zone:create', {
      id: `test_zone_${station.id}`,
      position: indicator.position,
      color: indicator.color,
      size: indicator.size
    });

    return indicator;
  }

  /**
   * Updates visual indicators for a station
   */
  private updateStationVisuals(station: TestStation): void {
    const color = this.testColors[station.status];
    
    // Update floating name
    if (station.ui) {
      const statusText = this.getStatusText(station);
      this.world.emit('rpg:test:ui:update', {
        id: `test_ui_${station.id}`,
        text: `${station.name}\n${statusText}`,
        color: color
      });
    }

    // Update zone indicator
    if (station.testZone) {
      this.world.emit('rpg:test:zone:update', {
        id: `test_zone_${station.id}`,
        color: color
      });
    }
  }

  /**
   * Gets status text for display
   */
  private getStatusText(station: TestStation): string {
    const successRate = station.totalRuns > 0 ? 
      (station.successCount / station.totalRuns * 100).toFixed(1) : '0.0';
    
    let statusText = `${station.status.toUpperCase()}`;
    statusText += `\nRuns: ${station.totalRuns} | Success: ${successRate}%`;
    
    if (station.status === 'failed' && station.currentError) {
      statusText += `\nError: ${station.currentError.substring(0, 30)}...`;
    }
    
    return statusText;
  }

  /**
   * Creates a fake player for testing
   */
  protected createFakePlayer(config: {
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    stats?: Partial<FakePlayer['stats']>;
  }): FakePlayer {
    const fakePlayer: FakePlayer = {
      id: config.id,
      name: config.name,
      position: config.position,
      rotation: { x: 0, y: 0, z: 0 },
      stats: {
        // Combat Skills
        attack: 10,
        strength: 10,
        defense: 10,
        ranged: 10,
        constitution: 10,
        health: 100,
        maxHealth: 100,
        // Gathering Skills  
        woodcutting: 1,
        fishing: 1,
        firemaking: 1,
        cooking: 1,
        // Movement
        stamina: 100,
        maxStamina: 100,
        ...config.stats
      },
      inventory: [],
      equipment: {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      }
    };

    // Create visual proxy (colored cube)
    this.createFakePlayerVisual(fakePlayer);
    
    this.fakePlayers.set(config.id, fakePlayer);
    
    console.log(`[RPGVisualTestFramework] Created fake player: ${config.name}`);
    
    return fakePlayer;
  }

  /**
   * Creates visual representation of fake player
   */
  private createFakePlayerVisual(player: FakePlayer): void {
    this.world.emit('rpg:test:player:create', {
      id: `fake_player_${player.id}`,
      position: { ...player.position, y: player.position.y + 1 },
      color: '#0088ff', // Blue for fake players
      size: { x: 0.8, y: 1.8, z: 0.8 },
      name: player.name
    });
  }

  /**
   * Moves a fake player to a new position
   */
  protected moveFakePlayer(playerId: string, newPosition: { x: number; y: number; z: number }): void {
    const player = this.fakePlayers.get(playerId);
    if (!player) return;

    player.position = newPosition;
    
    // Update visual
    this.world.emit('rpg:test:player:move', {
      id: `fake_player_${playerId}`,
      position: { ...newPosition, y: newPosition.y + 1 }
    });
  }

  /**
   * Starts a test for a specific station
   */
  protected startTest(stationId: string): void {
    const station = this.testStations.get(stationId);
    if (!station) return;

    station.status = 'running';
    station.lastRunTime = Date.now();
    station.totalRuns++;
    station.currentError = undefined;
    
    this.updateStationVisuals(station);
    
    console.log(`[RPGVisualTestFramework] Starting test: ${station.name}`);
    
    // Set timeout
    setTimeout(() => {
      if (station.status === 'running') {
        this.failTest(stationId, 'Test timeout exceeded');
      }
    }, station.timeoutMs);
  }

  /**
   * Marks a test as passed
   */
  protected passTest(stationId: string, details?: any): void {
    const station = this.testStations.get(stationId);
    if (!station) return;

    station.status = 'passed';
    station.successCount++;
    
    this.updateStationVisuals(station);
    
    const duration = Date.now() - station.lastRunTime;
    console.log(`[RPGVisualTestFramework] Test passed: ${station.name} (${duration}ms)`);
    
    // Emit result
    this.world.emit('rpg:test:result', {
      stationId,
      result: { success: true, duration, details }
    });
    
    // Schedule restart after 5 seconds
    setTimeout(() => {
      this.restartTest(stationId);
    }, 5000);
  }

  /**
   * Marks a test as failed
   */
  protected failTest(stationId: string, error: string): void {
    const station = this.testStations.get(stationId);
    if (!station) return;

    station.status = 'failed';
    station.failureCount++;
    station.currentError = error;
    
    this.updateStationVisuals(station);
    
    const duration = Date.now() - station.lastRunTime;
    console.error(`[RPGVisualTestFramework] Test failed: ${station.name} - ${error} (${duration}ms)`);
    
    // Emit result
    this.world.emit('rpg:test:result', {
      stationId,
      result: { success: false, error, duration }
    });
    
    // Schedule restart after 10 seconds (longer for failed tests)
    setTimeout(() => {
      this.restartTest(stationId);
    }, 10000);
  }

  /**
   * Restarts a test
   */
  protected restartTest(stationId: string): void {
    const station = this.testStations.get(stationId);
    if (!station) return;

    station.status = 'idle';
    station.currentError = undefined;
    
    this.updateStationVisuals(station);
    
    console.log(`[RPGVisualTestFramework] Restarting test: ${station.name}`);
    
    // Clean up any test state
    this.cleanupTest(stationId);
    
    // Start the test again after a brief delay
    setTimeout(() => {
      this.runTest(stationId);
    }, 2000);
  }

  /**
   * Updates all test stations
   */
  private updateTestStations(): void {
    for (const [stationId, station] of this.testStations) {
      // Auto-start idle tests
      if (station.status === 'idle') {
        this.runTest(stationId);
      }
      
      // Check for hanging tests
      if (station.status === 'running') {
        const elapsed = Date.now() - station.lastRunTime;
        if (elapsed > station.timeoutMs) {
          this.failTest(stationId, 'Test timeout exceeded');
        }
      }
    }
  }

  /**
   * Event handlers
   */
  private onTestStationCreated(data: { station: TestStation }): void {
    console.log(`[RPGVisualTestFramework] Test station created: ${data.station.name}`);
  }

  private onTestResult(data: { stationId: string; result: TestResult }): void {
    const station = this.testStations.get(data.stationId);
    if (station) {
      console.log(`[RPGVisualTestFramework] Test result for ${station.name}: ${data.result.success ? 'PASS' : 'FAIL'}`);
    }
  }

  /**
   * Abstract methods that must be implemented by test systems
   */
  protected abstract runTest(stationId: string): void;
  protected abstract cleanupTest(stationId: string): void;

  /**
   * Utility methods for tests
   */
  protected async waitForCondition(
    condition: () => boolean,
    timeoutMs: number = 5000,
    checkIntervalMs: number = 100
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const check = () => {
        if (condition()) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }
        
        setTimeout(check, checkIntervalMs);
      };
      
      check();
    });
  }

  protected getDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  protected generateRandomPosition(center: { x: number; y: number; z: number }, radius: number): { x: number; y: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    
    return {
      x: center.x + Math.cos(angle) * distance,
      y: center.y,
      z: center.z + Math.sin(angle) * distance
    };
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Clean up all test stations
    for (const stationId of this.testStations.keys()) {
      this.cleanupTest(stationId);
    }
    
    this.testStations.clear();
    this.fakePlayers.clear();
    
    console.log('[RPGVisualTestFramework] Test framework destroyed');
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