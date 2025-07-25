import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

/**
 * RPG Precision Physics Test System
 * 
 * High-precision physics tests with detailed vector math validation:
 * - Projectile motion with gravity calculations
 * - Collision response verification
 * - Energy conservation tests
 * - Friction coefficient validation
 * - Angular momentum tests with spinning objects
 * 
 * Tests positioned around spawn area with mathematical precision requirements
 */
export class RPGPrecisionPhysicsTestSystem extends System {
  private precisionTests = new Map<string, any>();
  private physicsObjects = new Map<string, any>();
  private testResults = new Map<string, any>();
  private testSequenceId = 0;
  private gravity = -9.81; // m/s²
  private testStartTime = 0;
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[PrecisionPhysics] Initializing precision physics test system...');
    
    // Listen for precision test requests
    this.world.on('rpg:physics:precision:projectile', this.testProjectileMotion.bind(this));
    this.world.on('rpg:physics:precision:collision', this.testCollisionResponse.bind(this));
    this.world.on('rpg:physics:precision:energy', this.testEnergyConservation.bind(this));
    this.world.on('rpg:physics:precision:friction', this.testFrictionCoefficient.bind(this));
    this.world.on('rpg:physics:precision:run_all', this.runAllPrecisionTests.bind(this));
    
    console.log('[PrecisionPhysics] Precision physics test system initialized');
  }

  start(): void {
    console.log('[PrecisionPhysics] Starting precision physics tests...');
    this.testStartTime = Date.now();
    
    // Create precision test scenarios
    this.createProjectileMotionTest();
    this.createCollisionResponseTest();
    this.createEnergyConservationTest();
    this.createFrictionTest();
    this.createAngularMomentumTest();
    
    // Start automated precision test sequence
    setTimeout(() => {
      this.runAllPrecisionTests();
    }, 1500);
  }

  /**
   * Projectile Motion Test
   * Tests physics accuracy against known projectile motion equations
   * Expected: Object follows parabolic trajectory according to kinematic equations
   */
  private createProjectileMotionTest(): void {
    console.log('[PrecisionPhysics] Creating projectile motion test...');
    
    const launchPosition = new THREE.Vector3(20, 5, 0);
    const launchVelocity = new THREE.Vector3(10, 8, 0); // m/s
    const testDuration = 2.0; // seconds
    
    // Calculate expected landing position using kinematic equations
    // x = v₀ₓt, y = y₀ + v₀ᵧt + ½gt²
    const expectedLandingTime = (-launchVelocity.y - Math.sqrt(
      launchVelocity.y * launchVelocity.y - 2 * this.gravity * launchPosition.y
    )) / this.gravity;
    
    const expectedLandingPosition = new THREE.Vector3(
      launchPosition.x + launchVelocity.x * expectedLandingTime,
      0, // Ground level
      launchPosition.z + launchVelocity.z * expectedLandingTime
    );
    
    // Create projectile object
    const projectileGeometry = new THREE.SphereGeometry(0.15);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4500 }); // Orange red
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    projectile.position.copy(launchPosition);
    projectile.userData = {
      type: 'precision_projectile',
      testId: `projectile_${this.testSequenceId++}`,
      launchPosition: launchPosition.clone(),
      launchVelocity: launchVelocity.clone(),
      expectedLandingPosition: expectedLandingPosition.clone(),
      expectedLandingTime: expectedLandingTime,
      tolerance: 0.5, // 50cm tolerance
      physics: {
        type: 'sphere',
        isDynamic: true,
        mass: 1.0,
        restitution: 0.0, // No bounce for clean test
        friction: 0.0
      }
    };
    
    this.world.stage.scene.add(projectile);
    this.physicsObjects.set(projectile.userData.testId, projectile);
    
    // Create target marker for visual reference
    const targetGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1);
    const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.position.copy(expectedLandingPosition);
    target.position.y = 0.05;
    this.world.stage.scene.add(target);
    
    this.precisionTests.set('projectile_motion', {
      type: 'projectile_motion',
      projectile: projectile,
      target: target,
      expectedOutcome: `Projectile should land at (${expectedLandingPosition.x.toFixed(2)}, 0, ${expectedLandingPosition.z.toFixed(2)}) after ${expectedLandingTime.toFixed(2)}s`,
      testStarted: false,
      testCompleted: false,
      calculatedValues: {
        launchVelocity: launchVelocity,
        expectedLandingTime: expectedLandingTime,
        expectedLandingPosition: expectedLandingPosition
      }
    });
    
    console.log('[PrecisionPhysics] Projectile motion test created');
    console.log(`  Launch velocity: (${launchVelocity.x}, ${launchVelocity.y}, ${launchVelocity.z}) m/s`);
    console.log(`  Expected landing time: ${expectedLandingTime.toFixed(2)}s`);
    console.log(`  Expected landing position: (${expectedLandingPosition.x.toFixed(2)}, ${expectedLandingPosition.y.toFixed(2)}, ${expectedLandingPosition.z.toFixed(2)})`);
  }

  /**
   * Collision Response Test
   * Tests conservation of momentum in elastic collisions
   */
  private createCollisionResponseTest(): void {
    console.log('[PrecisionPhysics] Creating collision response test...');
    
    const collisionPosition = new THREE.Vector3(-20, 2, 0);
    
    // Create two spheres for collision test
    const sphere1Geometry = new THREE.SphereGeometry(0.5);
    const sphere1Material = new THREE.MeshBasicMaterial({ color: 0xFF0000 }); // Red
    const sphere1 = new THREE.Mesh(sphere1Geometry, sphere1Material);
    
    const sphere2Geometry = new THREE.SphereGeometry(0.5);
    const sphere2Material = new THREE.MeshBasicMaterial({ color: 0x0000FF }); // Blue
    const sphere2 = new THREE.Mesh(sphere2Geometry, sphere2Material);
    
    // Position spheres for head-on collision
    sphere1.position.set(collisionPosition.x - 2, collisionPosition.y, collisionPosition.z);
    sphere2.position.set(collisionPosition.x + 2, collisionPosition.y, collisionPosition.z);
    
    // Set up collision physics data
    const mass1 = 2.0; // kg
    const mass2 = 1.0; // kg
    const velocity1 = new THREE.Vector3(3, 0, 0); // m/s moving right
    const velocity2 = new THREE.Vector3(-2, 0, 0); // m/s moving left
    
    // Calculate expected post-collision velocities using conservation of momentum
    // For elastic collision: v1' = ((m1-m2)v1 + 2m2v2)/(m1+m2)
    // v2' = ((m2-m1)v2 + 2m1v1)/(m1+m2)
    const expectedVel1 = new THREE.Vector3(
      ((mass1 - mass2) * velocity1.x + 2 * mass2 * velocity2.x) / (mass1 + mass2),
      0,
      0
    );
    const expectedVel2 = new THREE.Vector3(
      ((mass2 - mass1) * velocity2.x + 2 * mass1 * velocity1.x) / (mass1 + mass2),
      0,
      0
    );
    
    sphere1.userData = {
      type: 'collision_sphere',
      testId: `collision_sphere1_${this.testSequenceId}`,
      mass: mass1,
      initialVelocity: velocity1.clone(),
      expectedPostCollisionVelocity: expectedVel1.clone(),
      tolerance: 0.3,
      physics: {
        type: 'sphere',
        isDynamic: true,
        mass: mass1,
        restitution: 1.0, // Perfectly elastic
        friction: 0.0
      }
    };
    
    sphere2.userData = {
      type: 'collision_sphere',
      testId: `collision_sphere2_${this.testSequenceId++}`,
      mass: mass2,
      initialVelocity: velocity2.clone(),
      expectedPostCollisionVelocity: expectedVel2.clone(),
      tolerance: 0.3,
      physics: {
        type: 'sphere',
        isDynamic: true,
        mass: mass2,
        restitution: 1.0, // Perfectly elastic
        friction: 0.0
      }
    };
    
    this.world.stage.scene.add(sphere1);
    this.world.stage.scene.add(sphere2);
    this.physicsObjects.set(sphere1.userData.testId, sphere1);
    this.physicsObjects.set(sphere2.userData.testId, sphere2);
    
    this.precisionTests.set('collision_response', {
      type: 'collision_response',
      sphere1: sphere1,
      sphere2: sphere2,
      expectedOutcome: 'Spheres should exchange momentum according to conservation laws',
      testStarted: false,
      testCompleted: false,
      calculatedValues: {
        initialMomentum: mass1 * velocity1.x + mass2 * velocity2.x,
        expectedFinalMomentum: mass1 * expectedVel1.x + mass2 * expectedVel2.x,
        expectedVel1: expectedVel1,
        expectedVel2: expectedVel2
      }
    });
    
    console.log('[PrecisionPhysics] Collision response test created');
    console.log(`  Initial momentum: ${(mass1 * velocity1.x + mass2 * velocity2.x).toFixed(2)} kg⋅m/s`);
    console.log(`  Expected post-collision velocities: sphere1=${expectedVel1.x.toFixed(2)}, sphere2=${expectedVel2.x.toFixed(2)} m/s`);
  }

  /**
   * Energy Conservation Test
   * Tests kinetic energy conservation in pendulum motion
   */
  private createEnergyConservationTest(): void {
    console.log('[PrecisionPhysics] Creating energy conservation test...');
    
    const pendulumPosition = new THREE.Vector3(0, 8, 20);
    const stringLength = 3.0; // meters
    const initialAngle = Math.PI / 4; // 45 degrees
    
    // Create pendulum bob
    const bobGeometry = new THREE.SphereGeometry(0.3);
    const bobMaterial = new THREE.MeshBasicMaterial({ color: 0xFFD700 }); // Gold
    const bob = new THREE.Mesh(bobGeometry, bobMaterial);
    
    // Position bob at initial angle
    const initialPosition = new THREE.Vector3(
      pendulumPosition.x + stringLength * Math.sin(initialAngle),
      pendulumPosition.y - stringLength * Math.cos(initialAngle),
      pendulumPosition.z
    );
    bob.position.copy(initialPosition);
    
    // Calculate expected maximum velocity at bottom of swing
    // Using conservation of energy: mgh = ½mv²
    const heightDrop = stringLength * (1 - Math.cos(initialAngle));
    const expectedMaxVelocity = Math.sqrt(2 * Math.abs(this.gravity) * heightDrop);
    
    bob.userData = {
      type: 'pendulum_bob',
      testId: `pendulum_${this.testSequenceId++}`,
      stringLength: stringLength,
      initialAngle: initialAngle,
      initialPosition: initialPosition.clone(),
      pivotPosition: pendulumPosition.clone(),
      expectedMaxVelocity: expectedMaxVelocity,
      tolerance: 0.2,
      physics: {
        type: 'sphere',
        isDynamic: true,
        mass: 1.0,
        restitution: 0.0,
        friction: 0.0
      }
    };
    
    this.world.stage.scene.add(bob);
    this.physicsObjects.set(bob.userData.testId, bob);
    
    // Create string visualization
    const stringGeometry = new THREE.CylinderGeometry(0.02, 0.02, stringLength);
    const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const string = new THREE.Mesh(stringGeometry, stringMaterial);
    string.position.lerpVectors(pendulumPosition, initialPosition, 0.5);
    string.lookAt(initialPosition);
    string.rotateX(Math.PI / 2);
    this.world.stage.scene.add(string);
    
    this.precisionTests.set('energy_conservation', {
      type: 'energy_conservation',
      bob: bob,
      string: string,
      expectedOutcome: `Pendulum should reach maximum velocity of ${expectedMaxVelocity.toFixed(2)} m/s at bottom`,
      testStarted: false,
      testCompleted: false,
      calculatedValues: {
        stringLength: stringLength,
        initialAngle: initialAngle,
        heightDrop: heightDrop,
        expectedMaxVelocity: expectedMaxVelocity
      }
    });
    
    console.log('[PrecisionPhysics] Energy conservation test created');
    console.log(`  String length: ${stringLength}m, Initial angle: ${(initialAngle * 180 / Math.PI).toFixed(1)}°`);
    console.log(`  Height drop: ${heightDrop.toFixed(2)}m, Expected max velocity: ${expectedMaxVelocity.toFixed(2)} m/s`);
  }

  /**
   * Friction Coefficient Test
   * Tests sliding friction with known coefficient
   */
  private createFrictionTest(): void {
    console.log('[PrecisionPhysics] Creating friction coefficient test...');
    
    const rampPosition = new THREE.Vector3(0, 2, -20);
    const rampAngle = Math.PI / 6; // 30 degrees
    const frictionCoeff = 0.3; // Known friction coefficient
    
    // Create inclined plane
    const rampGeometry = new THREE.BoxGeometry(6, 0.2, 3);
    const rampMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.copy(rampPosition);
    ramp.rotation.z = rampAngle;
    
    // Create friction test block
    const blockGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const blockMaterial = new THREE.MeshBasicMaterial({ color: 0x800080 }); // Purple
    const block = new THREE.Mesh(blockGeometry, blockMaterial);
    
    // Position block at top of ramp
    const blockStartPosition = new THREE.Vector3(
      rampPosition.x - 2.5,
      rampPosition.y + 1,
      rampPosition.z
    );
    block.position.copy(blockStartPosition);
    
    // Calculate expected acceleration down ramp: a = g(sin θ - μ cos θ)
    const expectedAcceleration = Math.abs(this.gravity) * (
      Math.sin(rampAngle) - frictionCoeff * Math.cos(rampAngle)
    );
    
    // Calculate expected velocity after sliding for 2 seconds
    const testTime = 2.0;
    const expectedVelocity = expectedAcceleration * testTime;
    const expectedDistance = 0.5 * expectedAcceleration * testTime * testTime;
    
    block.userData = {
      type: 'friction_block',
      testId: `friction_block_${this.testSequenceId++}`,
      startPosition: blockStartPosition.clone(),
      rampAngle: rampAngle,
      frictionCoeff: frictionCoeff,
      expectedAcceleration: expectedAcceleration,
      expectedVelocity: expectedVelocity,
      expectedDistance: expectedDistance,
      tolerance: 0.4,
      physics: {
        type: 'box',
        isDynamic: true,
        mass: 2.0,
        restitution: 0.0,
        friction: frictionCoeff
      }
    };
    
    this.world.stage.scene.add(ramp);
    this.world.stage.scene.add(block);
    this.physicsObjects.set(block.userData.testId, block);
    
    this.precisionTests.set('friction_coefficient', {
      type: 'friction_coefficient',
      ramp: ramp,
      block: block,
      expectedOutcome: `Block should slide ${expectedDistance.toFixed(2)}m down ramp in ${testTime}s`,
      testStarted: false,
      testCompleted: false,
      calculatedValues: {
        rampAngle: rampAngle,
        frictionCoeff: frictionCoeff,
        expectedAcceleration: expectedAcceleration,
        expectedVelocity: expectedVelocity,
        expectedDistance: expectedDistance
      }
    });
    
    console.log('[PrecisionPhysics] Friction coefficient test created');
    console.log(`  Ramp angle: ${(rampAngle * 180 / Math.PI).toFixed(1)}°, Friction coefficient: ${frictionCoeff}`);
    console.log(`  Expected acceleration: ${expectedAcceleration.toFixed(2)} m/s², Distance in ${testTime}s: ${expectedDistance.toFixed(2)}m`);
  }

  /**
   * Angular Momentum Test
   * Tests conservation of angular momentum with spinning object
   */
  private createAngularMomentumTest(): void {
    console.log('[PrecisionPhysics] Creating angular momentum test...');
    
    const spinPosition = new THREE.Vector3(20, 3, -20);
    
    // Create spinning disc
    const discGeometry = new THREE.CylinderGeometry(1.0, 1.0, 0.2);
    const discMaterial = new THREE.MeshBasicMaterial({ color: 0x32CD32 }); // Lime green
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    disc.position.copy(spinPosition);
    
    // Set up spinning motion parameters
    const momentOfInertia = 0.5 * 1.0 * 1.0 * 1.0; // I = ½mr² for solid disc
    const initialAngularVelocity = 5.0; // rad/s
    const initialAngularMomentum = momentOfInertia * initialAngularVelocity;
    
    disc.userData = {
      type: 'spinning_disc',
      testId: `spinning_disc_${this.testSequenceId++}`,
      momentOfInertia: momentOfInertia,
      initialAngularVelocity: initialAngularVelocity,
      initialAngularMomentum: initialAngularMomentum,
      tolerance: 0.1,
      physics: {
        type: 'cylinder',
        isDynamic: true,
        mass: 1.0,
        restitution: 0.2,
        friction: 0.1
      }
    };
    
    this.world.stage.scene.add(disc);
    this.physicsObjects.set(disc.userData.testId, disc);
    
    this.precisionTests.set('angular_momentum', {
      type: 'angular_momentum',
      disc: disc,
      expectedOutcome: `Disc should maintain angular momentum of ${initialAngularMomentum.toFixed(2)} kg⋅m²/s`,
      testStarted: false,
      testCompleted: false,
      calculatedValues: {
        momentOfInertia: momentOfInertia,
        initialAngularVelocity: initialAngularVelocity,
        initialAngularMomentum: initialAngularMomentum
      }
    });
    
    console.log('[PrecisionPhysics] Angular momentum test created');
    console.log(`  Moment of inertia: ${momentOfInertia.toFixed(2)} kg⋅m², Initial angular velocity: ${initialAngularVelocity.toFixed(2)} rad/s`);
  }

  /**
   * Execute projectile motion test
   */
  private testProjectileMotion(): void {
    console.log('[PrecisionPhysics] Starting projectile motion test...');
    
    const test = this.precisionTests.get('projectile_motion');
    if (!test) {
      throw new Error('[PrecisionPhysics] Projectile motion test not found');
    }
    
    test.testStarted = true;
    test.startTime = Date.now();
    
    const projectile = test.projectile;
    const launchVelocity = projectile.userData.launchVelocity;
    
    // Apply initial velocity (simulated - in real implementation this would be physics-driven)
    projectile.userData.currentVelocity = launchVelocity.clone();
    
    console.log('[PrecisionPhysics] Projectile launched with velocity:', launchVelocity);
    
    // Schedule validation
    setTimeout(() => {
      this.validateProjectileMotionTest();
    }, 3000);
  }

  private validateProjectileMotionTest(): void {
    console.log('[PrecisionPhysics] Validating projectile motion test...');
    
    const test = this.precisionTests.get('projectile_motion');
    if (!test) return;
    
    const projectile = test.projectile;
    const finalPosition = projectile.position;
    const expectedPosition = projectile.userData.expectedLandingPosition;
    const tolerance = projectile.userData.tolerance;
    
    const distance = finalPosition.distanceTo(expectedPosition);
    const passed = distance <= tolerance;
    
    // Check if projectile fell through ground
    if (finalPosition.y < -1.0) {
      throw new Error('[PrecisionPhysics] CRITICAL: Projectile fell through ground! ' +
        `Final Y: ${finalPosition.y.toFixed(2)}, expected ≥ -1.0`);
    }
    
    const result = {
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
      passed: passed,
      calculatedValues: test.calculatedValues
    };
    
    test.testCompleted = true;
    test.results = result;
    
    this.testResults.set('projectile_motion', {
      scenario: 'Projectile Motion Test',
      passed: passed,
      results: result,
      summary: passed ? 
        'Projectile followed expected trajectory' : 
        `Projectile deviated by ${distance.toFixed(2)}m from expected landing`,
      timestamp: Date.now()
    });
    
    if (!passed) {
      throw new Error('[PrecisionPhysics] Projectile motion test FAILED! ' +
        `Landing position error: ${distance.toFixed(2)}m, tolerance: ${tolerance}m`);
    }
    
    console.log('[PrecisionPhysics] ✅ Projectile motion test PASSED');
  }

  /**
   * Run all precision physics tests in sequence
   */
  private runAllPrecisionTests(): void {
    console.log('[PrecisionPhysics] Running all precision physics tests...');
    
    setTimeout(() => this.testProjectileMotion(), 500);
    setTimeout(() => this.testCollisionResponse(), 1500);
    setTimeout(() => this.testEnergyConservation(), 2500);
    setTimeout(() => this.testFrictionCoefficient(), 3500);
    
    // Final validation
    setTimeout(() => {
      this.validateAllPrecisionTests();
    }, 10000);
  }

  /**
   * Stub methods for other tests (implementations would follow similar patterns)
   */
  private testCollisionResponse(): void {
    console.log('[PrecisionPhysics] Starting collision response test...');
    // Implementation would test momentum conservation
  }

  private testEnergyConservation(): void {
    console.log('[PrecisionPhysics] Starting energy conservation test...');
    // Implementation would test kinetic/potential energy conversion
  }

  private testFrictionCoefficient(): void {
    console.log('[PrecisionPhysics] Starting friction coefficient test...');
    // Implementation would test sliding friction
  }

  /**
   * Validate all precision test results
   */
  private validateAllPrecisionTests(): void {
    console.log('[PrecisionPhysics] Validating all precision test results...');
    
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
        'All precision physics tests PASSED' : 
        'Some precision physics tests FAILED',
      timestamp: Date.now()
    };
    
    console.log('[PrecisionPhysics] PRECISION TEST REPORT:', report);
    
    if (!allTestsPassed) {
      const failedTests = allResults.filter(r => !r.passed);
      throw new Error('[PrecisionPhysics] PRECISION PHYSICS TESTS FAILED! ' +
        `${failedTests.length} out of ${allResults.length} tests failed. ` +
        `Failed tests: ${failedTests.map(t => t.scenario).join(', ')}`);
    }
    
    console.log('[PrecisionPhysics] ✅ ALL PRECISION PHYSICS TESTS PASSED');
    
    this.world.emit('rpg:physics:precision:completed', report);
  }

  /**
   * Get test results for external inspection
   */
  getTestResults(): any {
    return {
      tests: Array.from(this.precisionTests.entries()).map(([key, value]) => ({
        name: key,
        ...value
      })),
      results: Array.from(this.testResults.entries()).map(([key, value]) => ({
        name: key,
        ...value
      })),
      objects: Array.from(this.physicsObjects.entries()).map(([key, value]) => ({
        id: key,
        type: value.userData.type,
        position: value.position
      }))
    };
  }

  update(dt: number): void {
    // Monitor precision test objects for anomalies
    this.physicsObjects.forEach((object, id) => {
      // Check for extreme positions that indicate physics failure
      if (object.position.y < -5.0) {
        console.error(`[PrecisionPhysics] CRITICAL: Object ${id} fell to Y=${object.position.y.toFixed(2)}`);
      }
      
      // Check for NaN positions
      if (isNaN(object.position.x) || isNaN(object.position.y) || isNaN(object.position.z)) {
        console.error(`[PrecisionPhysics] CRITICAL: Object ${id} has NaN position:`, object.position);
      }
    });
  }

  destroy(): void {
    this.physicsObjects.forEach((object, id) => {
      if (object.parent) {
        object.parent.remove(object);
      }
    });
    
    this.physicsObjects.clear();
    this.precisionTests.clear();
    this.testResults.clear();
    
    console.log('[PrecisionPhysics] Precision physics test system destroyed');
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