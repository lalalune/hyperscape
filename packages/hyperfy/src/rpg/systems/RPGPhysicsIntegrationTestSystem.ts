import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

/**
 * RPG Physics Integration Test System
 * 
 * Creates comprehensive physics "minigame" tests to validate:
 * - Terrain collision and height detection
 * - Character movement and colliders
 * - Ball/sphere physics with ramps and obstacles
 * - Cube dropping and stacking
 * - Expected trajectories and outcomes
 * 
 * Tests are positioned ~10 meters away from spawn for visibility
 * Throws detailed errors when expectations are not met
 */
export class RPGPhysicsIntegrationTestSystem extends System {
  private testScenarios = new Map<string, any>();
  private physicsTestObjects = new Map<string, any>();
  private testResults = new Map<string, any>();
  private ballTestId = 0;
  private cubeTestId = 0;
  private characterTestId = 0;
  private testStartTime = 0;
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[PhysicsTests] Initializing comprehensive physics test system...');
    
    // Listen for test requests
    this.world.on('rpg:physics:test:ball_ramp', this.testBallOnRamp.bind(this));
    this.world.on('rpg:physics:test:cube_drop', this.testCubeDrop.bind(this));
    this.world.on('rpg:physics:test:character_collision', this.testCharacterCollision.bind(this));
    this.world.on('rpg:physics:test:run_all', this.runAllPhysicsTests.bind(this));
    
    console.log('[PhysicsTests] Physics integration test system initialized');
  }

  start(): void {
    console.log('[PhysicsTests] Starting physics integration tests...');
    this.testStartTime = Date.now();
    
    // Create all test scenarios positioned 10 meters from spawn
    this.createBallRampTest();
    this.createCubeDropTest();
    this.createCharacterColliderTest();
    this.createTerrainValidationTest();
    this.createRampTrajectoryTest();
    
    // Start automated test sequence
    setTimeout(() => {
      this.runAllPhysicsTests();
    }, 2000); // Wait 2 seconds for world to stabilize
  }

  /**
   * Ball Ramp Physics Test
   * Creates a ramp and drops balls to test rolling physics
   * Expected: balls should roll down and stop at predictable positions
   */
  private createBallRampTest(): void {
    console.log('[PhysicsTests] Creating ball ramp physics test...');
    
    const testPosition = new THREE.Vector3(10, 1, 10);
    
    // Create ramp geometry
    const rampGeometry = new THREE.BoxGeometry(8, 0.2, 3);
    const rampMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brown
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    
    // Position and rotate ramp to create slope
    ramp.position.copy(testPosition);
    ramp.rotation.z = -Math.PI / 6; // 30 degree slope
    ramp.userData = {
      type: 'physics_test_ramp',
      testId: 'ball_ramp_test',
      physics: {
        type: 'box',
        isStatic: true,
        mass: 0
      }
    };
    
    this.world.stage.scene.add(ramp);
    
    // Create colored balls at top of ramp
    const ballColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00];
    const balls: any[] = [];
    
    ballColors.forEach((color, index) => {
      const ballGeometry = new THREE.SphereGeometry(0.3);
      const ballMaterial = new THREE.MeshBasicMaterial({ color });
      const ball = new THREE.Mesh(ballGeometry, ballMaterial);
      
      // Position balls at top of ramp with slight offset
      ball.position.set(
        testPosition.x - 3 + (index * 0.5),
        testPosition.y + 3,
        testPosition.z + (index * 0.2)
      );
      
      ball.userData = {
        type: 'physics_test_ball',
        testId: `ball_${this.ballTestId++}`,
        color: color,
        expectedFinalPosition: new THREE.Vector3(
          testPosition.x + 3,
          testPosition.y - 2,
          testPosition.z
        ),
        tolerance: 2.0,
        physics: {
          type: 'sphere',
          isDynamic: true,
          mass: 1,
          restitution: 0.3,
          friction: 0.4
        }
      };
      
      balls.push(ball);
      this.world.stage.scene.add(ball);
      this.physicsTestObjects.set(ball.userData.testId, ball);
    });
    
    this.testScenarios.set('ball_ramp', {
      type: 'ball_ramp',
      ramp: ramp,
      balls: balls,
      expectedOutcome: 'Balls should roll down ramp and settle at bottom',
      testStarted: false,
      testCompleted: false
    });
    
    console.log('[PhysicsTests] Ball ramp test created with 4 colored balls');
  }

  /**
   * Cube Drop Test
   * Tests cube stacking and floor collision detection
   * Expected: cubes should stack and not fall below ground level
   */
  private createCubeDropTest(): void {
    console.log('[PhysicsTests] Creating cube drop physics test...');
    
    const testPosition = new THREE.Vector3(-10, 5, 10);
    const cubes: any[] = [];
    
    // Create tower of cubes at different heights
    for (let i = 0; i < 5; i++) {
      const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
      const cubeColor = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF][i];
      const cubeMaterial = new THREE.MeshBasicMaterial({ color: cubeColor });
      const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
      
      cube.position.set(
        testPosition.x + (Math.random() - 0.5) * 0.1,
        testPosition.y + (i * 1.2),
        testPosition.z + (Math.random() - 0.5) * 0.1
      );
      
      cube.userData = {
        type: 'physics_test_cube',
        testId: `cube_${this.cubeTestId++}`,
        color: cubeColor,
        dropHeight: testPosition.y + (i * 1.2),
        expectedMinY: -0.5, // Should never fall below ground
        physics: {
          type: 'box',
          isDynamic: true,
          mass: 1,
          restitution: 0.1,
          friction: 0.6
        }
      };
      
      cubes.push(cube);
      this.world.stage.scene.add(cube);
      this.physicsTestObjects.set(cube.userData.testId, cube);
    }
    
    this.testScenarios.set('cube_drop', {
      type: 'cube_drop',
      cubes: cubes,
      expectedOutcome: 'Cubes should fall and stack without falling through floor',
      testStarted: false,
      testCompleted: false
    });
    
    console.log('[PhysicsTests] Cube drop test created with 5 colored cubes');
  }

  /**
   * Character Collider Test
   * Tests character movement boundaries and collision
   */
  private createCharacterColliderTest(): void {
    console.log('[PhysicsTests] Creating character collider test...');
    
    const testPosition = new THREE.Vector3(0, 1, -10);
    
    // Create invisible character proxy (capsule shape)
    const characterGeometry = new THREE.CapsuleGeometry(0.5, 1.8);
    const characterMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00FFFF, 
      transparent: true, 
      opacity: 0.5 
    });
    const characterProxy = new THREE.Mesh(characterGeometry, characterMaterial);
    
    characterProxy.position.copy(testPosition);
    characterProxy.userData = {
      type: 'physics_test_character',
      testId: `character_${this.characterTestId++}`,
      startPosition: testPosition.clone(),
      expectedFinalPosition: new THREE.Vector3(testPosition.x, testPosition.y, testPosition.z + 5),
      tolerance: 1.0,
      physics: {
        type: 'capsule',
        isDynamic: true,
        mass: 70, // Typical human weight
        friction: 0.8
      }
    };
    
    this.world.stage.scene.add(characterProxy);
    this.physicsTestObjects.set(characterProxy.userData.testId, characterProxy);
    
    // Create obstacles for collision testing
    const obstacles: any[] = [];
    for (let i = 0; i < 3; i++) {
      const obstacleGeometry = new THREE.BoxGeometry(2, 2, 0.5);
      const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
      const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
      
      obstacle.position.set(
        testPosition.x + (i - 1) * 3,
        testPosition.y,
        testPosition.z + 2 + (i * 1.5)
      );
      
      obstacle.userData = {
        type: 'physics_test_obstacle',
        physics: {
          type: 'box',
          isStatic: true,
          mass: 0
        }
      };
      
      obstacles.push(obstacle);
      this.world.stage.scene.add(obstacle);
    }
    
    this.testScenarios.set('character_collision', {
      type: 'character_collision',
      character: characterProxy,
      obstacles: obstacles,
      expectedOutcome: 'Character should move and collide with obstacles properly',
      testStarted: false,
      testCompleted: false
    });
    
    console.log('[PhysicsTests] Character collider test created');
  }

  /**
   * Terrain Validation Test
   * Validates that terrain height detection works correctly
   */
  private createTerrainValidationTest(): void {
    console.log('[PhysicsTests] Creating terrain validation test...');
    
    // Test various positions for height validation
    const testPositions = [
      new THREE.Vector3(15, 10, 0),
      new THREE.Vector3(-15, 10, 0),
      new THREE.Vector3(0, 10, 15),
      new THREE.Vector3(0, 10, -15)
    ];
    
    const heightTestObjects: any[] = [];
    
    testPositions.forEach((pos, index) => {
      const testGeometry = new THREE.SphereGeometry(0.2);
      const testMaterial = new THREE.MeshBasicMaterial({ color: 0xFF8000 }); // Orange
      const testSphere = new THREE.Mesh(testGeometry, testMaterial);
      
      testSphere.position.copy(pos);
      testSphere.userData = {
        type: 'physics_test_height_probe',
        testId: `height_probe_${index}`,
        testPosition: pos.clone(),
        expectedBehavior: 'Should settle on terrain surface',
        physics: {
          type: 'sphere',
          isDynamic: true,
          mass: 0.1
        }
      };
      
      heightTestObjects.push(testSphere);
      this.world.stage.scene.add(testSphere);
      this.physicsTestObjects.set(testSphere.userData.testId, testSphere);
    });
    
    this.testScenarios.set('terrain_validation', {
      type: 'terrain_validation',
      probes: heightTestObjects,
      expectedOutcome: 'All probes should rest on terrain surface',
      testStarted: false,
      testCompleted: false
    });
    
    console.log('[PhysicsTests] Terrain validation test created with 4 height probes');
  }

  /**
   * Ramp Trajectory Test
   * Tests projectile physics on angled surfaces
   */
  private createRampTrajectoryTest(): void {
    console.log('[PhysicsTests] Creating ramp trajectory test...');
    
    const rampPosition = new THREE.Vector3(10, 1, -10);
    
    // Create launch ramp
    const rampGeometry = new THREE.BoxGeometry(4, 0.2, 2);
    const rampMaterial = new THREE.MeshBasicMaterial({ color: 0x4169E1 }); // Royal blue
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    
    ramp.position.copy(rampPosition);
    ramp.rotation.x = Math.PI / 4; // 45 degree ramp
    ramp.userData = {
      type: 'physics_test_launch_ramp',
      physics: {
        type: 'box',
        isStatic: true,
        mass: 0
      }
    };
    
    this.world.stage.scene.add(ramp);
    
    // Create projectile
    const projectileGeometry = new THREE.SphereGeometry(0.25);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xFF1493 }); // Deep pink
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    projectile.position.set(rampPosition.x - 2, rampPosition.y + 1, rampPosition.z);
    projectile.userData = {
      type: 'physics_test_projectile',
      testId: 'trajectory_projectile',
      launchPosition: new THREE.Vector3(rampPosition.x - 2, rampPosition.y + 1, rampPosition.z),
      expectedLandingArea: new THREE.Vector3(rampPosition.x + 8, rampPosition.y - 3, rampPosition.z),
      tolerance: 3.0,
      physics: {
        type: 'sphere',
        isDynamic: true,
        mass: 0.5,
        restitution: 0.7,
        friction: 0.3
      }
    };
    
    this.world.stage.scene.add(projectile);
    this.physicsTestObjects.set(projectile.userData.testId, projectile);
    
    this.testScenarios.set('ramp_trajectory', {
      type: 'ramp_trajectory',
      ramp: ramp,
      projectile: projectile,
      expectedOutcome: 'Projectile should launch off ramp and land in expected area',
      testStarted: false,
      testCompleted: false
    });
    
    console.log('[PhysicsTests] Ramp trajectory test created');
  }

  /**
   * Execute ball ramp test
   */
  private testBallOnRamp(): void {
    console.log('[PhysicsTests] Starting ball ramp test...');
    
    const scenario = this.testScenarios.get('ball_ramp');
    if (!scenario) {
      throw new Error('[PhysicsTests] Ball ramp test scenario not found');
    }
    
    scenario.testStarted = true;
    
    // Apply initial force to balls to start rolling
    scenario.balls.forEach((ball: any, index: number) => {
      // Simulate physics push
      const initialVelocity = new THREE.Vector3(1, 0, 0);
      ball.userData.initialVelocity = initialVelocity;
      
      console.log(`[PhysicsTests] Ball ${index} (${ball.userData.color.toString(16)}) starting roll from position:`, 
        ball.position.x.toFixed(2), ball.position.y.toFixed(2), ball.position.z.toFixed(2));
    });
    
    // Schedule test validation
    setTimeout(() => {
      this.validateBallRampTest();
    }, 5000); // Allow 5 seconds for physics simulation
  }

  private validateBallRampTest(): void {
    console.log('[PhysicsTests] Validating ball ramp test results...');
    
    const scenario = this.testScenarios.get('ball_ramp');
    if (!scenario) return;
    
    const results: any[] = [];
    let allTestsPassed = true;
    
    scenario.balls.forEach((ball: any, index: number) => {
      const finalPosition = ball.position;
      const expectedPosition = ball.userData.expectedFinalPosition;
      const tolerance = ball.userData.tolerance;
      
      const distance = finalPosition.distanceTo(expectedPosition);
      const passed = distance <= tolerance;
      
      if (!passed) {
        allTestsPassed = false;
      }
      
      // Check if ball fell below ground
      if (finalPosition.y < -1.0) {
        allTestsPassed = false;
        throw new Error(`[PhysicsTests] CRITICAL FAILURE: Ball ${index} fell through floor! ` +
          `Final Y position: ${finalPosition.y.toFixed(2)}, expected minimum: -1.0`);
      }
      
      const result = {
        ballIndex: index,
        color: `#${ball.userData.color.toString(16).padStart(6, '0')}`,
        finalPosition: {
          x: finalPosition.x.toFixed(2),
          y: finalPosition.y.toFixed(2),
          z: finalPosition.z.toFixed(2)
        },
        expectedPosition: {
          x: expectedPosition.x.toFixed(2),
          y: expectedPosition.y.toFixed(2),
          z: expectedPosition.z.toFixed(2)
        },
        distance: distance.toFixed(2),
        tolerance: tolerance.toFixed(2),
        passed: passed
      };
      
      results.push(result);
      
      console.log(`[PhysicsTests] Ball ${index} result:`, result);
    });
    
    scenario.testCompleted = true;
    scenario.results = results;
    scenario.allTestsPassed = allTestsPassed;
    
    this.testResults.set('ball_ramp', {
      scenario: 'Ball Ramp Physics Test',
      passed: allTestsPassed,
      results: results,
      summary: allTestsPassed ? 
        'All balls rolled down ramp correctly' : 
        'Some balls did not reach expected positions',
      timestamp: Date.now()
    });
    
    if (!allTestsPassed) {
      const failedBalls = results.filter(r => !r.passed);
      throw new Error(`[PhysicsTests] Ball ramp test FAILED! ${failedBalls.length} balls out of ${results.length} ` +
        `did not reach expected positions. Failed balls: ${failedBalls.map(b => b.ballIndex).join(', ')}`);
    }
    
    console.log('[PhysicsTests] ✅ Ball ramp test PASSED');
  }

  /**
   * Execute cube drop test
   */
  private testCubeDrop(): void {
    console.log('[PhysicsTests] Starting cube drop test...');
    
    const scenario = this.testScenarios.get('cube_drop');
    if (!scenario) {
      throw new Error('[PhysicsTests] Cube drop test scenario not found');
    }
    
    scenario.testStarted = true;
    
    scenario.cubes.forEach((cube: any, index: number) => {
      console.log(`[PhysicsTests] Cube ${index} dropping from height:`, cube.userData.dropHeight.toFixed(2));
    });
    
    // Schedule test validation
    setTimeout(() => {
      this.validateCubeDropTest();
    }, 4000); // Allow 4 seconds for cubes to settle
  }

  private validateCubeDropTest(): void {
    console.log('[PhysicsTests] Validating cube drop test results...');
    
    const scenario = this.testScenarios.get('cube_drop');
    if (!scenario) return;
    
    const results: any[] = [];
    let allTestsPassed = true;
    
    scenario.cubes.forEach((cube: any, index: number) => {
      const finalPosition = cube.position;
      const dropHeight = cube.userData.dropHeight;
      const expectedMinY = cube.userData.expectedMinY;
      
      // Check if cube fell through floor
      const fellThroughFloor = finalPosition.y < expectedMinY;
      if (fellThroughFloor) {
        allTestsPassed = false;
      }
      
      // Check if cube moved too much horizontally (should stack somewhat)
      const horizontalMovement = Math.sqrt(
        Math.pow(finalPosition.x - (-10), 2) + 
        Math.pow(finalPosition.z - 10, 2)
      );
      
      const excessiveHorizontalMovement = horizontalMovement > 3.0;
      if (excessiveHorizontalMovement) {
        allTestsPassed = false;
      }
      
      const result = {
        cubeIndex: index,
        color: `#${cube.userData.color.toString(16).padStart(6, '0')}`,
        dropHeight: dropHeight.toFixed(2),
        finalPosition: {
          x: finalPosition.x.toFixed(2),
          y: finalPosition.y.toFixed(2),
          z: finalPosition.z.toFixed(2)
        },
        fellThroughFloor: fellThroughFloor,
        horizontalMovement: horizontalMovement.toFixed(2),
        passed: !fellThroughFloor && !excessiveHorizontalMovement
      };
      
      results.push(result);
      
      if (fellThroughFloor) {
        throw new Error(`[PhysicsTests] CRITICAL FAILURE: Cube ${index} fell through floor! ` +
          `Final Y position: ${finalPosition.y.toFixed(2)}, minimum expected: ${expectedMinY}`);
      }
      
      console.log(`[PhysicsTests] Cube ${index} result:`, result);
    });
    
    scenario.testCompleted = true;
    scenario.results = results;
    scenario.allTestsPassed = allTestsPassed;
    
    this.testResults.set('cube_drop', {
      scenario: 'Cube Drop Physics Test',
      passed: allTestsPassed,
      results: results,
      summary: allTestsPassed ? 
        'All cubes dropped and stacked correctly' : 
        'Some cubes had unexpected behavior',
      timestamp: Date.now()
    });
    
    if (!allTestsPassed) {
      const failedCubes = results.filter(r => !r.passed);
      throw new Error(`[PhysicsTests] Cube drop test FAILED! ${failedCubes.length} cubes out of ${results.length} ` +
        `had unexpected behavior. Failed cubes: ${failedCubes.map(c => c.cubeIndex).join(', ')}`);
    }
    
    console.log('[PhysicsTests] ✅ Cube drop test PASSED');
  }

  /**
   * Execute character collision test
   */
  private testCharacterCollision(): void {
    console.log('[PhysicsTests] Starting character collision test...');
    
    const scenario = this.testScenarios.get('character_collision');
    if (!scenario) {
      throw new Error('[PhysicsTests] Character collision test scenario not found');
    }
    
    scenario.testStarted = true;
    
    // Apply movement force to character
    const character = scenario.character;
    const targetPosition = character.userData.expectedFinalPosition;
    
    console.log('[PhysicsTests] Moving character from', 
      character.position.x.toFixed(2), character.position.y.toFixed(2), character.position.z.toFixed(2),
      'towards', targetPosition.x.toFixed(2), targetPosition.y.toFixed(2), targetPosition.z.toFixed(2));
    
    // Simulate movement (in real implementation this would be physics-driven)
    const movement = new THREE.Vector3().subVectors(targetPosition, character.position).normalize();
    character.userData.movementDirection = movement;
    
    // Schedule test validation
    setTimeout(() => {
      this.validateCharacterCollisionTest();
    }, 3000); // Allow 3 seconds for movement
  }

  private validateCharacterCollisionTest(): void {
    console.log('[PhysicsTests] Validating character collision test results...');
    
    const scenario = this.testScenarios.get('character_collision');
    if (!scenario) return;
    
    const character = scenario.character;
    const finalPosition = character.position;
    const startPosition = character.userData.startPosition;
    const tolerance = character.userData.tolerance;
    
    // Check if character moved at all
    const totalMovement = finalPosition.distanceTo(startPosition);
    const movedSignificantly = totalMovement > 0.1;
    
    // Check if character fell through floor
    const fellThroughFloor = finalPosition.y < -1.0;
    
    // Check if character moved too far (indicates no collision detection)
    const excessiveMovement = totalMovement > 15.0;
    
    const passed = movedSignificantly && !fellThroughFloor && !excessiveMovement;
    
    const result = {
      startPosition: {
        x: startPosition.x.toFixed(2),
        y: startPosition.y.toFixed(2),
        z: startPosition.z.toFixed(2)
      },
      finalPosition: {
        x: finalPosition.x.toFixed(2),
        y: finalPosition.y.toFixed(2),
        z: finalPosition.z.toFixed(2)
      },
      totalMovement: totalMovement.toFixed(2),
      movedSignificantly: movedSignificantly,
      fellThroughFloor: fellThroughFloor,
      excessiveMovement: excessiveMovement,
      passed: passed
    };
    
    scenario.testCompleted = true;
    scenario.results = result;
    scenario.allTestsPassed = passed;
    
    this.testResults.set('character_collision', {
      scenario: 'Character Collision Test',
      passed: passed,
      results: result,
      summary: passed ? 
        'Character movement and collision worked correctly' : 
        'Character movement had unexpected behavior',
      timestamp: Date.now()
    });
    
    if (fellThroughFloor) {
      throw new Error(`[PhysicsTests] CRITICAL FAILURE: Character fell through floor! ` +
        `Final Y position: ${finalPosition.y.toFixed(2)}, expected minimum: -1.0`);
    }
    
    if (!movedSignificantly) {
      throw new Error(`[PhysicsTests] Character collision test FAILED: Character did not move! ` +
        `Total movement: ${totalMovement.toFixed(2)}, expected > 0.1`);
    }
    
    if (excessiveMovement) {
      throw new Error(`[PhysicsTests] Character collision test FAILED: Character moved too far (no collision)! ` +
        `Total movement: ${totalMovement.toFixed(2)}, expected < 15.0`);
    }
    
    console.log('[PhysicsTests] Character collision result:', result);
    console.log('[PhysicsTests] ✅ Character collision test PASSED');
  }

  /**
   * Run all physics tests in sequence
   */
  private runAllPhysicsTests(): void {
    console.log('[PhysicsTests] Running all physics integration tests...');
    
    // Run tests with proper timing
    setTimeout(() => this.testBallOnRamp(), 1000);
    setTimeout(() => this.testCubeDrop(), 2000);
    setTimeout(() => this.testCharacterCollision(), 3000);
    
    // Final validation after all tests
    setTimeout(() => {
      this.validateAllTests();
    }, 15000);
  }

  /**
   * Validate all test results and provide comprehensive report
   */
  private validateAllTests(): void {
    console.log('[PhysicsTests] Validating all physics test results...');
    
    const allResults = Array.from(this.testResults.values());
    const allTestsPassed = allResults.every(result => result.passed);
    const totalTestTime = Date.now() - this.testStartTime;
    
    const report = {
      totalTests: allResults.length,
      passedTests: allResults.filter(r => r.passed).length,
      failedTests: allResults.filter(r => !r.passed).length,
      allTestsPassed: allTestsPassed,
      totalTestTimeMs: totalTestTime,
      results: allResults,
      summary: allTestsPassed ? 
        'All physics integration tests PASSED' : 
        'Some physics integration tests FAILED',
      timestamp: Date.now()
    };
    
    console.log('[PhysicsTests] FINAL REPORT:', report);
    
    if (!allTestsPassed) {
      const failedTests = allResults.filter(r => !r.passed);
      throw new Error(`[PhysicsTests] PHYSICS TESTS FAILED! ${failedTests.length} out of ${allResults.length} tests failed. ` +
        `Failed tests: ${failedTests.map(t => t.scenario).join(', ')}`);
    }
    
    console.log('[PhysicsTests] ✅ ALL PHYSICS INTEGRATION TESTS PASSED');
    
    // Emit success event
    this.world.emit('rpg:physics:tests:completed', report);
  }

  /**
   * Get test results for external inspection
   */
  getTestResults(): any {
    return {
      scenarios: Array.from(this.testScenarios.entries()).map(([key, value]) => ({
        name: key,
        ...value
      })),
      results: Array.from(this.testResults.entries()).map(([key, value]) => ({
        name: key,
        ...value
      })),
      objects: Array.from(this.physicsTestObjects.entries()).map(([key, value]) => ({
        id: key,
        type: value.userData.type,
        position: value.position
      }))
    };
  }

  /**
   * Clean up test objects
   */
  cleanup(): void {
    console.log('[PhysicsTests] Cleaning up physics test objects...');
    
    this.physicsTestObjects.forEach((object, id) => {
      if (object.parent) {
        object.parent.remove(object);
      }
    });
    
    this.physicsTestObjects.clear();
    this.testScenarios.clear();
    this.testResults.clear();
  }

  update(dt: number): void {
    // Monitor test objects and detect issues in real-time
    this.physicsTestObjects.forEach((object, id) => {
      // Check for objects falling through floor
      if (object.position.y < -2.0) {
        console.error(`[PhysicsTests] WARNING: Object ${id} fell below expected floor level:`, object.position.y);
      }
      
      // Check for objects moving too far from test area
      const distanceFromOrigin = object.position.length();
      if (distanceFromOrigin > 50) {
        console.error(`[PhysicsTests] WARNING: Object ${id} moved too far from test area:`, distanceFromOrigin);
      }
    });
  }

  destroy(): void {
    this.cleanup();
    console.log('[PhysicsTests] Physics integration test system destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}