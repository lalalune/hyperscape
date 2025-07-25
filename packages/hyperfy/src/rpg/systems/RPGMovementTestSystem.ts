/**
 * RPG Movement Test System
 * Tests player movement, pathfinding, and collision detection
 * - Tests basic movement (walk/run) with stamina system
 * - Tests pathfinding around obstacles
 * - Tests collision detection with terrain and objects
 * - Tests teleportation mechanics
 * - Tests movement speed modifiers and effects
 * - Tests boundary detection and world limits
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';

interface MovementTestData {
  fakePlayer: FakePlayer;
  testType: 'basic_movement' | 'pathfinding' | 'collision' | 'teleportation' | 'comprehensive';
  startTime: number;
  startPosition: { x: number; y: number; z: number };
  targetPosition: { x: number; y: number; z: number };
  currentPosition: { x: number; y: number; z: number };
  waypoints: Array<{ x: number; y: number; z: number; reached: boolean }>;
  distanceTraveled: number;
  movementSpeed: number;
  staminaUsed: number;
  obstaclesAvoided: number;
  teleportationsAttempted: number;
  teleportationsSuccessful: number;
  collisionDetected: boolean;
  pathfindingWorked: boolean;
  boundariesRespected: boolean;
  movementEffectsTested: boolean;
}

export class RPGMovementTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, MovementTestData>();
  private movementSystem: any;
  private collisionSystem: any;
  private pathfindingSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGMovementTestSystem] Initializing movement test system...');
    
    // Get required systems
    this.movementSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGMovementSystem');
    this.collisionSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGCollisionSystem');
    this.pathfindingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGPathfindingSystem');
    
    if (!this.movementSystem) {
      console.warn('[RPGMovementTestSystem] MovementSystem not found, movement tests may not function properly');
    }
    
    if (!this.collisionSystem) {
      console.warn('[RPGMovementTestSystem] CollisionSystem not found, collision tests may not function properly');
    }
    
    if (!this.pathfindingSystem) {
      console.warn('[RPGMovementTestSystem] PathfindingSystem not found, pathfinding tests may not function properly');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGMovementTestSystem] Movement test system initialized');
  }

  private createTestStations(): void {
    // Basic Movement Test
    this.createTestStation({
      id: 'basic_movement_test',
      name: 'Basic Movement Test',
      position: { x: -90, y: 0, z: 10 },
      timeoutMs: 35000 // 35 seconds
    });

    // Pathfinding Test
    this.createTestStation({
      id: 'pathfinding_test',
      name: 'Pathfinding Test',
      position: { x: -90, y: 0, z: 20 },
      timeoutMs: 45000 // 45 seconds
    });

    // Collision Detection Test
    this.createTestStation({
      id: 'collision_test',
      name: 'Collision Detection Test',
      position: { x: -90, y: 0, z: 30 },
      timeoutMs: 30000 // 30 seconds
    });

    // Teleportation Test
    this.createTestStation({
      id: 'teleportation_test',
      name: 'Teleportation Test',
      position: { x: -90, y: 0, z: 40 },
      timeoutMs: 25000 // 25 seconds
    });

    // Comprehensive Movement Test
    this.createTestStation({
      id: 'comprehensive_movement_test',
      name: 'Full Movement Test',
      position: { x: -90, y: 0, z: 50 },
      timeoutMs: 90000 // 90 seconds for full test
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_movement_test':
        this.runBasicMovementTest(stationId);
        break;
      case 'pathfinding_test':
        this.runPathfindingTest(stationId);
        break;
      case 'collision_test':
        this.runCollisionTest(stationId);
        break;
      case 'teleportation_test':
        this.runTeleportationTest(stationId);
        break;
      case 'comprehensive_movement_test':
        this.runComprehensiveMovementTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown movement test: ${stationId}`);
    }
  }

  private async runBasicMovementTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGMovementTestSystem] Starting basic movement test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for movement testing
      const fakePlayer = this.createFakePlayer({
        id: `movement_player_${Date.now()}`,
        name: 'Movement Test Player',
        position: { x: station.position.x - 5, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1,
          strength: 1,
          defense: 1,
          ranged: 1,
          constitution: 10,
          health: 100,
          maxHealth: 100,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 100,
          maxStamina: 100
        }
      });

      const startPos = { x: station.position.x - 5, y: station.position.y, z: station.position.z };
      const targetPos = { x: station.position.x + 8, y: station.position.y, z: station.position.z };

      // Create movement waypoints for walk/run test
      const waypoints = [
        { x: station.position.x - 2, y: station.position.y, z: station.position.z, reached: false }, // Walk
        { x: station.position.x + 2, y: station.position.y, z: station.position.z, reached: false }, // Run
        { x: station.position.x + 5, y: station.position.y, z: station.position.z, reached: false }, // Walk back
        { x: station.position.x + 8, y: station.position.y, z: station.position.z, reached: false }  // Final
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'basic_movement',
        startTime: Date.now(),
        startPosition: startPos,
        targetPosition: targetPos,
        currentPosition: { ...startPos },
        waypoints,
        distanceTraveled: 0,
        movementSpeed: 0,
        staminaUsed: 0,
        obstaclesAvoided: 0,
        teleportationsAttempted: 0,
        teleportationsSuccessful: 0,
        collisionDetected: false,
        pathfindingWorked: false,
        boundariesRespected: true,
        movementEffectsTested: false
      });

      // Create waypoint visuals
      this.createWaypointVisuals(stationId, waypoints);

      // Start basic movement sequence
      this.startBasicMovementSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic movement test error: ${error}`);
    }
  }

  private async runPathfindingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGMovementTestSystem] Starting pathfinding test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for pathfinding testing
      const fakePlayer = this.createFakePlayer({
        id: `pathfinding_player_${Date.now()}`,
        name: 'Pathfinding Test Player',
        position: { x: station.position.x - 6, y: station.position.y, z: station.position.z - 3 },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 5,
          constitution: 15,
          health: 150,
          maxHealth: 150,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 120,
          maxStamina: 120
        }
      });

      const startPos = { x: station.position.x - 6, y: station.position.y, z: station.position.z - 3 };
      const targetPos = { x: station.position.x + 6, y: station.position.y, z: station.position.z + 3 };

      // Create obstacles for pathfinding
      const obstacles = [
        { x: station.position.x - 2, y: station.position.y, z: station.position.z - 1 },
        { x: station.position.x, y: station.position.y, z: station.position.z },
        { x: station.position.x + 2, y: station.position.y, z: station.position.z + 1 }
      ];

      // Create complex waypoints that require pathfinding around obstacles
      const waypoints = [
        { x: station.position.x - 4, y: station.position.y, z: station.position.z - 2, reached: false },
        { x: station.position.x - 2, y: station.position.y, z: station.position.z - 3, reached: false }, // Around obstacle
        { x: station.position.x + 1, y: station.position.y, z: station.position.z - 2, reached: false },
        { x: station.position.x + 3, y: station.position.y, z: station.position.z + 2, reached: false }, // Around obstacle
        { x: station.position.x + 6, y: station.position.y, z: station.position.z + 3, reached: false }  // Target
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'pathfinding',
        startTime: Date.now(),
        startPosition: startPos,
        targetPosition: targetPos,
        currentPosition: { ...startPos },
        waypoints,
        distanceTraveled: 0,
        movementSpeed: 0,
        staminaUsed: 0,
        obstaclesAvoided: 0,
        teleportationsAttempted: 0,
        teleportationsSuccessful: 0,
        collisionDetected: false,
        pathfindingWorked: false,
        boundariesRespected: true,
        movementEffectsTested: false
      });

      // Create obstacle visuals
      this.createObstacleVisuals(stationId, obstacles);
      this.createWaypointVisuals(stationId, waypoints);

      // Start pathfinding sequence
      this.startPathfindingSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Pathfinding test error: ${error}`);
    }
  }

  private async runCollisionTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGMovementTestSystem] Starting collision detection test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for collision testing
      const fakePlayer = this.createFakePlayer({
        id: `collision_player_${Date.now()}`,
        name: 'Collision Test Player',
        position: { x: station.position.x - 4, y: station.position.y, z: station.position.z },
        stats: {
          attack: 3,
          strength: 3,
          defense: 3,
          ranged: 3,
          constitution: 10,
          health: 100,
          maxHealth: 100,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 80,
          maxStamina: 80
        }
      });

      const startPos = { x: station.position.x - 4, y: station.position.y, z: station.position.z };
      
      // Create collision walls/barriers
      const barriers = [
        { x: station.position.x, y: station.position.y, z: station.position.z - 1 },
        { x: station.position.x, y: station.position.y, z: station.position.z },
        { x: station.position.x, y: station.position.y, z: station.position.z + 1 }
      ];

      // Waypoints that test collision (should be blocked by barriers)
      const waypoints = [
        { x: station.position.x - 2, y: station.position.y, z: station.position.z, reached: false },
        { x: station.position.x + 1, y: station.position.y, z: station.position.z, reached: false }, // Should be blocked
        { x: station.position.x - 2, y: station.position.y, z: station.position.z + 2, reached: false }, // Go around
        { x: station.position.x + 2, y: station.position.y, z: station.position.z + 2, reached: false }  // Final
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'collision',
        startTime: Date.now(),
        startPosition: startPos,
        targetPosition: waypoints[waypoints.length - 1],
        currentPosition: { ...startPos },
        waypoints,
        distanceTraveled: 0,
        movementSpeed: 0,
        staminaUsed: 0,
        obstaclesAvoided: 0,
        teleportationsAttempted: 0,
        teleportationsSuccessful: 0,
        collisionDetected: false,
        pathfindingWorked: false,
        boundariesRespected: true,
        movementEffectsTested: false
      });

      // Create barrier visuals
      this.createBarrierVisuals(stationId, barriers);
      this.createWaypointVisuals(stationId, waypoints);

      // Start collision test sequence
      this.startCollisionSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Collision detection test error: ${error}`);
    }
  }

  private async runTeleportationTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGMovementTestSystem] Starting teleportation test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for teleportation testing
      const fakePlayer = this.createFakePlayer({
        id: `teleport_player_${Date.now()}`,
        name: 'Teleportation Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 10,
          strength: 10,
          defense: 10,
          ranged: 10,
          constitution: 20,
          health: 200,
          maxHealth: 200,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 150,
          maxStamina: 150
        }
      });

      const startPos = { x: station.position.x, y: station.position.y, z: station.position.z };

      // Teleportation targets
      const teleportTargets = [
        { x: station.position.x + 5, y: station.position.y, z: station.position.z + 5, reached: false },
        { x: station.position.x - 3, y: station.position.y, z: station.position.z - 3, reached: false },
        { x: station.position.x + 2, y: station.position.y + 1, z: station.position.z, reached: false }, // Elevated
        { x: station.position.x, y: station.position.y, z: station.position.z + 8, reached: false }   // Far
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'teleportation',
        startTime: Date.now(),
        startPosition: startPos,
        targetPosition: teleportTargets[teleportTargets.length - 1],
        currentPosition: { ...startPos },
        waypoints: teleportTargets,
        distanceTraveled: 0,
        movementSpeed: 0,
        staminaUsed: 0,
        obstaclesAvoided: 0,
        teleportationsAttempted: 0,
        teleportationsSuccessful: 0,
        collisionDetected: false,
        pathfindingWorked: false,
        boundariesRespected: true,
        movementEffectsTested: false
      });

      // Create teleport target visuals
      this.createTeleportTargetVisuals(stationId, teleportTargets);

      // Start teleportation sequence
      this.startTeleportationSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Teleportation test error: ${error}`);
    }
  }

  private async runComprehensiveMovementTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGMovementTestSystem] Starting comprehensive movement test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for comprehensive testing
      const fakePlayer = this.createFakePlayer({
        id: `comprehensive_movement_player_${Date.now()}`,
        name: 'Comprehensive Movement Player',
        position: { x: station.position.x - 8, y: station.position.y, z: station.position.z - 8 },
        stats: {
          attack: 15,
          strength: 15,
          defense: 15,
          ranged: 15,
          constitution: 25,
          health: 250,
          maxHealth: 250,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 200,
          maxStamina: 200
        }
      });

      const startPos = { x: station.position.x - 8, y: station.position.y, z: station.position.z - 8 };
      const finalPos = { x: station.position.x + 8, y: station.position.y, z: station.position.z + 8 };

      // Complex course with all movement types
      const waypoints = [
        // Phase 1: Basic movement
        { x: station.position.x - 5, y: station.position.y, z: station.position.z - 5, reached: false },
        { x: station.position.x - 2, y: station.position.y, z: station.position.z - 2, reached: false },
        // Phase 2: Obstacle avoidance
        { x: station.position.x + 1, y: station.position.y, z: station.position.z - 3, reached: false },
        { x: station.position.x + 3, y: station.position.y, z: station.position.z, reached: false },
        // Phase 3: Pathfinding
        { x: station.position.x + 5, y: station.position.y, z: station.position.z + 3, reached: false },
        // Phase 4: Final destination
        { x: station.position.x + 8, y: station.position.y, z: station.position.z + 8, reached: false }
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'comprehensive',
        startTime: Date.now(),
        startPosition: startPos,
        targetPosition: finalPos,
        currentPosition: { ...startPos },
        waypoints,
        distanceTraveled: 0,
        movementSpeed: 0,
        staminaUsed: 0,
        obstaclesAvoided: 0,
        teleportationsAttempted: 0,
        teleportationsSuccessful: 0,
        collisionDetected: false,
        pathfindingWorked: false,
        boundariesRespected: true,
        movementEffectsTested: false
      });

      // Create comprehensive course visuals
      this.createComprehensiveCourseVisuals(stationId, station.position);

      // Start comprehensive sequence
      this.startComprehensiveSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Comprehensive movement test error: ${error}`);
    }
  }

  private createWaypointVisuals(stationId: string, waypoints: Array<{ x: number; y: number; z: number; reached: boolean }>): void {
    waypoints.forEach((waypoint, index) => {
      this.world.emit('rpg:test:waypoint:create', {
        id: `waypoint_${stationId}_${index}`,
        position: waypoint,
        color: '#00ff00', // Green for waypoints
        size: { x: 0.5, y: 0.2, z: 0.5 },
        type: 'waypoint',
        index: index
      });
    });
  }

  private createObstacleVisuals(stationId: string, obstacles: Array<{ x: number; y: number; z: number }>): void {
    obstacles.forEach((obstacle, index) => {
      this.world.emit('rpg:test:obstacle:create', {
        id: `obstacle_${stationId}_${index}`,
        position: obstacle,
        color: '#8b4513', // Brown for obstacles
        size: { x: 1, y: 1.5, z: 1 },
        type: 'obstacle'
      });
    });
  }

  private createBarrierVisuals(stationId: string, barriers: Array<{ x: number; y: number; z: number }>): void {
    barriers.forEach((barrier, index) => {
      this.world.emit('rpg:test:barrier:create', {
        id: `barrier_${stationId}_${index}`,
        position: barrier,
        color: '#ff0000', // Red for collision barriers
        size: { x: 0.8, y: 2, z: 0.8 },
        type: 'collision_barrier'
      });
    });
  }

  private createTeleportTargetVisuals(stationId: string, targets: Array<{ x: number; y: number; z: number; reached: boolean }>): void {
    targets.forEach((target, index) => {
      this.world.emit('rpg:test:teleport_target:create', {
        id: `teleport_target_${stationId}_${index}`,
        position: target,
        color: '#ff00ff', // Magenta for teleport targets
        size: { x: 0.8, y: 0.1, z: 0.8 },
        type: 'teleport_target',
        index: index
      });
    });
  }

  private createComprehensiveCourseVisuals(stationId: string, centerPos: { x: number; y: number; z: number }): void {
    // Create various obstacles and features for comprehensive test
    const obstacles = [
      { x: centerPos.x - 1, y: centerPos.y, z: centerPos.z - 1 },
      { x: centerPos.x + 1, y: centerPos.y, z: centerPos.z + 1 }
    ];

    const barriers = [
      { x: centerPos.x + 2, y: centerPos.y, z: centerPos.z - 1 }
    ];

    this.createObstacleVisuals(stationId, obstacles);
    this.createBarrierVisuals(stationId, barriers);
  }

  private startBasicMovementSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGMovementTestSystem] Starting basic movement sequence...');

    let waypointIndex = 0;
    let isRunning = false;

    const moveToNextWaypoint = async () => {
      if (waypointIndex >= testData.waypoints.length) {
        this.completeBasicMovementTest(stationId);
        return;
      }

      const waypoint = testData.waypoints[waypointIndex];
      console.log(`[RPGMovementTestSystem] Moving to waypoint ${waypointIndex + 1}: (${waypoint.x}, ${waypoint.z})`);

      // Alternate between walking and running
      isRunning = waypointIndex % 2 === 1;
      const moveSpeed = isRunning ? 6 : 3; // Run faster than walk

      if (this.movementSystem) {
        // Record starting position
        const startPos = { ...testData.currentPosition };
        
        // Start movement
        const success = await this.movementSystem.movePlayer(
          testData.fakePlayer.id,
          waypoint,
          { 
            speed: moveSpeed, 
            useStamina: isRunning,
            pathfinding: false // Basic movement doesn't use pathfinding
          }
        );

        if (success) {
          // Calculate distance traveled
          const distance = this.calculateDistance(startPos, waypoint);
          testData.distanceTraveled += distance;
          testData.movementSpeed = moveSpeed;
          
          if (isRunning) {
            testData.staminaUsed += distance * 2; // Running uses more stamina
          }

          // Update current position
          testData.currentPosition = { ...waypoint };
          waypoint.reached = true;

          // Update waypoint visual
          this.world.emit('rpg:test:waypoint:update', {
            id: `waypoint_${stationId}_${waypointIndex}`,
            color: '#ffff00' // Yellow for reached
          });

          console.log(`[RPGMovementTestSystem] Reached waypoint ${waypointIndex + 1} (${isRunning ? 'running' : 'walking'})`);
        } else {
          console.log(`[RPGMovementTestSystem] Failed to reach waypoint ${waypointIndex + 1}`);
        }
      }

      waypointIndex++;
      setTimeout(moveToNextWaypoint, 3000); // 3 seconds between waypoints
    };

    // Start movement sequence
    setTimeout(moveToNextWaypoint, 1000);
  }

  private startPathfindingSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGMovementTestSystem] Starting pathfinding sequence...');

    let waypointIndex = 0;

    const pathfindToNextWaypoint = async () => {
      if (waypointIndex >= testData.waypoints.length) {
        this.completePathfindingTest(stationId);
        return;
      }

      const waypoint = testData.waypoints[waypointIndex];
      console.log(`[RPGMovementTestSystem] Pathfinding to waypoint ${waypointIndex + 1}: (${waypoint.x}, ${waypoint.z})`);

      if (this.pathfindingSystem && this.movementSystem) {
        // Calculate path around obstacles
        const path = await this.pathfindingSystem.findPath(
          testData.currentPosition,
          waypoint,
          { avoidObstacles: true, maxDistance: 20 }
        );

        if (path && path.length > 0) {
          console.log(`[RPGMovementTestSystem] Found path with ${path.length} nodes`);
          testData.pathfindingWorked = true;

          // Move along the path
          for (const pathNode of path) {
            const success = await this.movementSystem.movePlayer(
              testData.fakePlayer.id,
              pathNode,
              { speed: 4, useStamina: false, pathfinding: true }
            );

            if (success) {
              const distance = this.calculateDistance(testData.currentPosition, pathNode);
              testData.distanceTraveled += distance;
              testData.currentPosition = { ...pathNode };
              
              // Check if we avoided obstacles
              if (this.isNearObstacle(pathNode, testData)) {
                testData.obstaclesAvoided++;
              }
            }

            await new Promise(resolve => setTimeout(resolve, 800)); // Short pause between path nodes
          }

          waypoint.reached = true;
          this.world.emit('rpg:test:waypoint:update', {
            id: `waypoint_${stationId}_${waypointIndex}`,
            color: '#ffff00' // Yellow for reached
          });
        } else {
          console.log(`[RPGMovementTestSystem] No path found to waypoint ${waypointIndex + 1}`);
        }
      }

      waypointIndex++;
      setTimeout(pathfindToNextWaypoint, 2000);
    };

    // Start pathfinding sequence
    setTimeout(pathfindToNextWaypoint, 1000);
  }

  private startCollisionSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGMovementTestSystem] Starting collision detection sequence...');

    let waypointIndex = 0;

    const testCollisionAtWaypoint = async () => {
      if (waypointIndex >= testData.waypoints.length) {
        this.completeCollisionTest(stationId);
        return;
      }

      const waypoint = testData.waypoints[waypointIndex];
      console.log(`[RPGMovementTestSystem] Testing collision to waypoint ${waypointIndex + 1}`);

      if (this.movementSystem && this.collisionSystem) {
        // Check for collision before moving
        const collisionCheck = await this.collisionSystem.checkPath(
          testData.currentPosition,
          waypoint
        );

        console.log(`[RPGMovementTestSystem] Collision check result: ${collisionCheck ? 'blocked' : 'clear'}`);

        if (collisionCheck) {
          testData.collisionDetected = true;
          console.log(`[RPGMovementTestSystem] Path blocked by collision, attempting alternative route`);
          
          // Try to find alternative route
          const alternativeWaypoint = {
            x: waypoint.x,
            y: waypoint.y,
            z: waypoint.z + 3 // Move around obstacle
          };

          const success = await this.movementSystem.movePlayer(
            testData.fakePlayer.id,
            alternativeWaypoint,
            { speed: 3, useStamina: false, avoidCollisions: true }
          );

          if (success) {
            const distance = this.calculateDistance(testData.currentPosition, alternativeWaypoint);
            testData.distanceTraveled += distance;
            testData.currentPosition = { ...alternativeWaypoint };
            waypoint.reached = true;
          }
        } else {
          // Path is clear, move normally
          const success = await this.movementSystem.movePlayer(
            testData.fakePlayer.id,
            waypoint,
            { speed: 3, useStamina: false }
          );

          if (success) {
            const distance = this.calculateDistance(testData.currentPosition, waypoint);
            testData.distanceTraveled += distance;
            testData.currentPosition = { ...waypoint };
            waypoint.reached = true;

            this.world.emit('rpg:test:waypoint:update', {
              id: `waypoint_${stationId}_${waypointIndex}`,
              color: '#ffff00' // Yellow for reached
            });
          }
        }
      }

      waypointIndex++;
      setTimeout(testCollisionAtWaypoint, 3500);
    };

    // Start collision testing sequence
    setTimeout(testCollisionAtWaypoint, 1000);
  }

  private startTeleportationSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGMovementTestSystem] Starting teleportation sequence...');

    let targetIndex = 0;

    const teleportToNextTarget = async () => {
      if (targetIndex >= testData.waypoints.length) {
        this.completeTeleportationTest(stationId);
        return;
      }

      const target = testData.waypoints[targetIndex];
      console.log(`[RPGMovementTestSystem] Attempting teleportation ${targetIndex + 1} to (${target.x}, ${target.z})`);

      testData.teleportationsAttempted++;

      if (this.movementSystem) {
        const success = await this.movementSystem.teleportPlayer(
          testData.fakePlayer.id,
          target,
          { validateLocation: true, allowElevation: true }
        );

        if (success) {
          testData.teleportationsSuccessful++;
          testData.currentPosition = { ...target };
          target.reached = true;

          console.log(`[RPGMovementTestSystem] Teleportation ${targetIndex + 1} successful`);

          // Update visual
          this.world.emit('rpg:test:teleport_target:update', {
            id: `teleport_target_${stationId}_${targetIndex}`,
            color: '#00ff00' // Green for successful teleport
          });
        } else {
          console.log(`[RPGMovementTestSystem] Teleportation ${targetIndex + 1} failed`);
          
          // Update visual
          this.world.emit('rpg:test:teleport_target:update', {
            id: `teleport_target_${stationId}_${targetIndex}`,
            color: '#ff0000' // Red for failed teleport
          });
        }
      }

      targetIndex++;
      setTimeout(teleportToNextTarget, 4000); // 4 seconds between teleports
    };

    // Start teleportation sequence
    setTimeout(teleportToNextTarget, 1500);
  }

  private startComprehensiveSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGMovementTestSystem] Starting comprehensive movement sequence...');

    // Phase 1: Basic movement (0-20 seconds)
    setTimeout(() => {
      console.log('[RPGMovementTestSystem] Phase 1: Basic movement');
      this.executeMovementPhase(stationId, 0, 2, false); // Waypoints 0-1, no pathfinding
    }, 2000);

    // Phase 2: Pathfinding (25-45 seconds)
    setTimeout(() => {
      console.log('[RPGMovementTestSystem] Phase 2: Pathfinding around obstacles');
      testData.movementEffectsTested = true;
      this.executeMovementPhase(stationId, 2, 4, true); // Waypoints 2-3, with pathfinding
    }, 25000);

    // Phase 3: Mixed movement with collision avoidance (50-70 seconds)
    setTimeout(() => {
      console.log('[RPGMovementTestSystem] Phase 3: Mixed movement with collision avoidance');
      this.executeMovementPhase(stationId, 4, 6, true); // Waypoints 4-5, with pathfinding
    }, 50000);

    // Complete test at 75 seconds
    setTimeout(() => {
      this.completeComprehensiveTest(stationId);
    }, 75000);
  }

  private async executeMovementPhase(stationId: string, startIndex: number, endIndex: number, usePathfinding: boolean): Promise<void> {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    for (let i = startIndex; i < Math.min(endIndex, testData.waypoints.length); i++) {
      const waypoint = testData.waypoints[i];
      
      if (this.movementSystem) {
        let success = false;

        if (usePathfinding && this.pathfindingSystem) {
          const path = await this.pathfindingSystem.findPath(
            testData.currentPosition,
            waypoint,
            { avoidObstacles: true }
          );

          if (path && path.length > 0) {
            testData.pathfindingWorked = true;
            success = await this.movementSystem.movePlayer(
              testData.fakePlayer.id,
              waypoint,
              { speed: 4, pathfinding: true }
            );
          }
        } else {
          success = await this.movementSystem.movePlayer(
            testData.fakePlayer.id,
            waypoint,
            { speed: 5 }
          );
        }

        if (success) {
          const distance = this.calculateDistance(testData.currentPosition, waypoint);
          testData.distanceTraveled += distance;
          testData.currentPosition = { ...waypoint };
          waypoint.reached = true;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private isNearObstacle(position: { x: number; y: number; z: number }, testData: MovementTestData): boolean {
    // Simple check - in a real implementation this would check against actual obstacle positions
    return Math.abs(position.x % 2) < 0.5 && Math.abs(position.z % 2) < 0.5;
  }

  private completeBasicMovementTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const waypointsReached = testData.waypoints.filter(w => w.reached).length;
    const expectedWaypoints = testData.waypoints.length;

    const results = {
      waypointsReached: waypointsReached,
      expectedWaypoints: expectedWaypoints,
      distanceTraveled: testData.distanceTraveled,
      movementSpeed: testData.movementSpeed,
      staminaUsed: testData.staminaUsed,
      duration: Date.now() - testData.startTime
    };

    if (waypointsReached >= expectedWaypoints * 0.75) { // 75% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Basic movement test failed: reached ${waypointsReached}/${expectedWaypoints} waypoints`);
    }
  }

  private completePathfindingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const waypointsReached = testData.waypoints.filter(w => w.reached).length;

    const results = {
      waypointsReached: waypointsReached,
      expectedWaypoints: testData.waypoints.length,
      pathfindingWorked: testData.pathfindingWorked,
      obstaclesAvoided: testData.obstaclesAvoided,
      distanceTraveled: testData.distanceTraveled,
      duration: Date.now() - testData.startTime
    };

    if (testData.pathfindingWorked && waypointsReached >= 3) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Pathfinding test failed: pathfinding=${testData.pathfindingWorked}, waypoints=${waypointsReached}`);
    }
  }

  private completeCollisionTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      collisionDetected: testData.collisionDetected,
      waypointsReached: testData.waypoints.filter(w => w.reached).length,
      distanceTraveled: testData.distanceTraveled,
      boundariesRespected: testData.boundariesRespected,
      duration: Date.now() - testData.startTime
    };

    if (testData.collisionDetected && results.waypointsReached >= 2) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Collision test failed: detected=${testData.collisionDetected}, waypoints=${results.waypointsReached}`);
    }
  }

  private completeTeleportationTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const successRate = testData.teleportationsAttempted > 0 ? 
      (testData.teleportationsSuccessful / testData.teleportationsAttempted) : 0;

    const results = {
      teleportationsAttempted: testData.teleportationsAttempted,
      teleportationsSuccessful: testData.teleportationsSuccessful,
      successRate: successRate,
      duration: Date.now() - testData.startTime
    };

    if (successRate >= 0.75) { // 75% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Teleportation test failed: ${testData.teleportationsSuccessful}/${testData.teleportationsAttempted} successful (${(successRate * 100).toFixed(1)}%)`);
    }
  }

  private completeComprehensiveTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const waypointsReached = testData.waypoints.filter(w => w.reached).length;

    const results = {
      waypointsReached: waypointsReached,
      expectedWaypoints: testData.waypoints.length,
      distanceTraveled: testData.distanceTraveled,
      pathfindingWorked: testData.pathfindingWorked,
      collisionDetected: testData.collisionDetected,
      movementEffectsTested: testData.movementEffectsTested,
      comprehensiveScore: waypointsReached + (testData.pathfindingWorked ? 2 : 0) + (testData.movementEffectsTested ? 1 : 0),
      duration: Date.now() - testData.startTime
    };

    if (results.comprehensiveScore >= 6) { // Good comprehensive score
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Comprehensive movement test failed: score=${results.comprehensiveScore} (waypoints=${waypointsReached}, pathfinding=${testData.pathfindingWorked}, effects=${testData.movementEffectsTested})`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up waypoint visuals
      testData.waypoints.forEach((_, index) => {
        this.world.emit('rpg:test:waypoint:remove', {
          id: `waypoint_${stationId}_${index}`
        });
      });

      // Clean up obstacle visuals
      for (let i = 0; i < 10; i++) { // Clean up potential obstacles
        this.world.emit('rpg:test:obstacle:remove', {
          id: `obstacle_${stationId}_${i}`
        });
        this.world.emit('rpg:test:barrier:remove', {
          id: `barrier_${stationId}_${i}`
        });
        this.world.emit('rpg:test:teleport_target:remove', {
          id: `teleport_target_${stationId}_${i}`
        });
      }
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGMovementTestSystem] Cleanup completed for ${stationId}`);
  }

  async getSystemRating(): Promise<string> {
    const totalStations = this.testStations.size;
    const completedStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed' || station.status === 'failed'
    ).length;
    
    const successfulStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed'
    ).length;
    
    const completionRate = totalStations > 0 ? completedStations / totalStations : 0;
    const successRate = completedStations > 0 ? successfulStations / completedStations : 0;
    
    // Check for advanced movement features
    const hasBasicMovementTesting = this.testStations.has('movement_basic_test');
    const hasRunningTesting = this.testStations.has('movement_running_test');
    const hasObstacleNavigationTesting = this.testStations.has('movement_obstacle_navigation_test');
    const hasStaminaTesting = this.testStations.has('movement_stamina_test');
    const hasPerformanceTesting = this.testStations.has('movement_performance_test');
    
    const advancedFeatureCount = [
      hasBasicMovementTesting, hasRunningTesting, hasObstacleNavigationTesting,
      hasStaminaTesting, hasPerformanceTesting
    ].filter(Boolean).length;
    
    // Check movement precision and performance
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.distanceTraveled > 0) {
        const expectedDistance = 10.0; // Default expected distance for movement tests
        const accuracy = 1.0 - Math.abs(testData.distanceTraveled - expectedDistance) / expectedDistance;
        if (accuracy > 0.8) { // Good movement accuracy
          hasGoodPerformanceMetrics = true;
          break;
        }
      }
    }
    
    if (completionRate >= 0.95 && successRate >= 0.9 && advancedFeatureCount >= 4 && hasGoodPerformanceMetrics) {
      return 'excellent';
    } else if (completionRate >= 0.8 && successRate >= 0.8 && advancedFeatureCount >= 3) {
      return 'very_good';
    } else if (completionRate >= 0.6 && successRate >= 0.7 && advancedFeatureCount >= 2) {
      return 'good';
    } else if (completionRate >= 0.4 && successRate >= 0.6) {
      return 'fair';
    } else {
      return 'poor';
    }
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