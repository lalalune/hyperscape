import { System } from './System';
import type { World } from '../World';
import * as THREE from 'three';

interface TestConfig {
  isTest?: boolean
}

interface TestRunnerSystem extends System {
  isTestRunning?: () => boolean
}

interface WorldWithConfig extends World {
  config?: TestConfig
  systems: (System | TestRunnerSystem)[]
}

interface RaycastTestResult {
  screenX: number;
  screenY: number;
  expectedWorld: THREE.Vector3;
  actualHit: THREE.Vector3 | null;
  playerMoved: boolean;
  finalPosition: THREE.Vector3 | null;
  error: number;
}

export class RaycastTestSystem extends System {
  private groundPlane: THREE.Mesh | null = null;
  private testMarkers: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private testResults: RaycastTestResult[] = [];
  private isRunningTests = false;
  private _tempVec3 = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector2();
  
  constructor(world: World) {
    super(world);
  }

  start(): void {
    // Only run in test environments
    const isTestEnv =
      (typeof process !== 'undefined' &&
        ((process as { env: { NODE_ENV?: string; VITEST?: string } }).env
          ?.NODE_ENV === 'test' ||
          (process as { env: { NODE_ENV?: string; VITEST?: string } }).env
            ?.VITEST)) ||
      (this.world as WorldWithConfig).config?.isTest === true ||
      ((this.world as WorldWithConfig).systems as {
        testRunner?: TestRunnerSystem
      }).testRunner?.isTestRunning?.() === true
    if (!isTestEnv) {
            return;
    }
        
    // Use the existing stage ground plane instead of creating our own to avoid z-fighting
    // this.createGroundPlane(); // Commented out to prevent duplicate ground planes
    
    // Start tests after a longer delay to let everything initialize
    setTimeout(() => this.runTests(), 8000);
  }

  private async runTests(): Promise<void> {
    if (this.isRunningTests) return;
    this.isRunningTests = true;
    
                
    const camera = this.world.camera;
    const canvas = this.world.graphics?.renderer?.domElement;
    
    if (!camera || !canvas) {
      console.error('[RaycastTest] Camera or canvas not found');
      return;
    }
    
    // Log camera info
    console.log(`[RaycastTest] Camera position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
    console.log(`[RaycastTest] Camera type: ${camera.type}`);
    const perspectiveCamera = camera as THREE.PerspectiveCamera
    if (perspectiveCamera.fov) {
      console.log(`[RaycastTest] Camera FOV: ${perspectiveCamera.fov}`);
    }
    
    // Update camera matrices to ensure proper projection
    camera.updateMatrixWorld(true);
    if (perspectiveCamera.updateProjectionMatrix) {
      perspectiveCamera.updateProjectionMatrix();
    }
    
    // Define test points based on where camera is actually looking
    // Camera is typically at (x, 5.4, 5.6) looking toward negative Z
    const camPos = camera.position;
    const lookDistance = 10; // How far in front of camera to expect hits
    
    const testPoints = [
      { screenX: 640, screenY: 360, name: 'center', expectedWorld: new THREE.Vector3(camPos.x, 0, camPos.z - lookDistance) },
      { screenX: 320, screenY: 360, name: 'left', expectedWorld: new THREE.Vector3(camPos.x - 5, 0, camPos.z - lookDistance) },
      { screenX: 960, screenY: 360, name: 'right', expectedWorld: new THREE.Vector3(camPos.x + 5, 0, camPos.z - lookDistance) },
      { screenX: 640, screenY: 500, name: 'bottom-center', expectedWorld: new THREE.Vector3(camPos.x, 0, camPos.z - 5) },
      { screenX: 640, screenY: 200, name: 'top-center', expectedWorld: new THREE.Vector3(camPos.x, 0, camPos.z - 15) },
    ];
    
    // Test each point
    for (const testPoint of testPoints) {
      await this.testRaycastPoint(testPoint, camera, canvas);
      await this.wait(2000); // Wait between tests
    }
    
    // Print summary
    this.printTestSummary();
    this.isRunningTests = false;
  }

  private async testRaycastPoint(
    testPoint: { screenX: number; screenY: number; name: string; expectedWorld: THREE.Vector3 },
    camera: THREE.Camera,
    canvas: HTMLCanvasElement
  ): Promise<void> {
    console.log(`\n[RaycastTest] Testing ${testPoint.name} at screen (${testPoint.screenX}, ${testPoint.screenY})`);
    
    // Convert screen to NDC
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((testPoint.screenX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((testPoint.screenY - rect.top) / rect.height) * 2 + 1;
    
    console.log(`[RaycastTest] NDC: (${ndcX.toFixed(3)}, ${ndcY.toFixed(3)})`);
    
    // Perform raycast
    this.raycaster.setFromCamera(this._tempVec2.set(ndcX, ndcY), camera);
    
    // Test against the existing stage ground plane instead of our own
    const stageGroundPlane = this.world.stage?.scene?.getObjectByName('stage-ground');
    const intersects = stageGroundPlane ? this.raycaster.intersectObject(stageGroundPlane) : [];
    
    if (intersects.length > 0) {
      const hit = intersects[0].point;
      console.log(`[RaycastTest] Hit at world: (${hit.x.toFixed(2)}, ${hit.y.toFixed(2)}, ${hit.z.toFixed(2)})`);
      
      // Place a marker at the hit point
      this.placeMarker(hit, 0xff0000);
      
      // Place a marker at the expected point
      this.placeMarker(this._tempVec3.set(testPoint.expectedWorld.x, testPoint.expectedWorld.y, testPoint.expectedWorld.z), 0x0000ff);
      
      // Calculate error
      const error = hit.distanceTo(this._tempVec3);
      console.log(`[RaycastTest] Error from expected: ${error.toFixed(2)} units`);
      
      // Now simulate a click and see if the player moves there
      await this.simulateClickAndVerifyMovement(testPoint.screenX, testPoint.screenY, hit);
      
      this.testResults.push({
        screenX: testPoint.screenX,
        screenY: testPoint.screenY,
        expectedWorld: testPoint.expectedWorld,
        actualHit: hit,
        playerMoved: false, // Will be updated by movement test
        finalPosition: null,
        error: error
      });
    } else {
      console.error(`[RaycastTest] No intersection found for ${testPoint.name}`);
      this.testResults.push({
        screenX: testPoint.screenX,
        screenY: testPoint.screenY,
        expectedWorld: testPoint.expectedWorld,
        actualHit: null,
        playerMoved: false,
        finalPosition: null,
        error: -1
      });
    }
  }

  private async simulateClickAndVerifyMovement(screenX: number, screenY: number, expectedTarget: THREE.Vector3): Promise<void> {
    const player = this.world.getPlayer();
    if (!player) {
      console.error('[RaycastTest] No player found');
      return;
    }
    
    const initialPos = player.position.clone();
    console.log(`[RaycastTest] Player initial position: (${initialPos.x.toFixed(2)}, ${initialPos.y.toFixed(2)}, ${initialPos.z.toFixed(2)})`);
    
    // Simulate click event
    const canvas = this.world.graphics?.renderer?.domElement;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickEvent = new MouseEvent('click', {
      clientX: rect.left + screenX,
      clientY: rect.top + screenY,
      bubbles: true
    });
    
    canvas.dispatchEvent(clickEvent);
    console.log(`[RaycastTest] Dispatched click at (${screenX}, ${screenY})`);
    
    // Wait for movement
    await this.wait(3000);
    
    // Check final position
    const finalPos = player.position.clone();
    console.log(`[RaycastTest] Player final position: (${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)})`);
    
    const distanceMoved = initialPos.distanceTo(finalPos);
    const distanceToTarget = finalPos.distanceTo(expectedTarget);
    
    console.log(`[RaycastTest] Distance moved: ${distanceMoved.toFixed(2)} units`);
    console.log(`[RaycastTest] Distance to target: ${distanceToTarget.toFixed(2)} units`);
    
    if (distanceMoved > 0.5) {
      console.log(`[RaycastTest] ✅ Player moved`);
      if (distanceToTarget < 1.0) {
        console.log(`[RaycastTest] ✅ Player reached target`);
      } else {
        console.log(`[RaycastTest] ⚠️ Player did not reach target (off by ${distanceToTarget.toFixed(2)} units)`);
      }
    } else {
      console.log(`[RaycastTest] ❌ Player did not move`);
    }
    
    // Update test result
    if (this.testResults.length > 0) {
      const lastResult = this.testResults[this.testResults.length - 1];
      lastResult.playerMoved = distanceMoved > 0.5;
      lastResult.finalPosition = finalPos;
    }
  }

  private placeMarker(position: THREE.Vector3, color: number): void {
    const geometry = new THREE.SphereGeometry(0.2);
    const material = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(marker);
      this.testMarkers.push(marker);
    }
  }

  private printTestSummary(): void {
    console.log('\n[RaycastTest] ========================================');
            
    let passedRaycast = 0;
    let passedMovement = 0;
    
    for (const result of this.testResults) {
      const raycastPass = result.actualHit !== null && result.error < 2.0;
      const movementPass = result.playerMoved && result.finalPosition && 
                          result.actualHit && result.finalPosition.distanceTo(result.actualHit) < 1.0;
      
      if (raycastPass) passedRaycast++;
      if (movementPass) passedMovement++;
      
      console.log(`\nScreen (${result.screenX}, ${result.screenY}):`);
      console.log(`  Raycast: ${raycastPass ? '✅' : '❌'} (error: ${result.error.toFixed(2)})`);
      console.log(`  Movement: ${movementPass ? '✅' : '❌'}`);
      if (result.actualHit) {
        console.log(`  Hit: (${result.actualHit.x.toFixed(2)}, ${result.actualHit.y.toFixed(2)}, ${result.actualHit.z.toFixed(2)})`);
      }
      if (result.finalPosition) {
        console.log(`  Final: (${result.finalPosition.x.toFixed(2)}, ${result.finalPosition.y.toFixed(2)}, ${result.finalPosition.z.toFixed(2)})`);
      }
    }
    
    console.log(`\n[RaycastTest] Overall: ${passedRaycast}/${this.testResults.length} raycasts passed`);
    console.log(`[RaycastTest] Overall: ${passedMovement}/${this.testResults.length} movements passed`);
    
    // Export results to window for external testing
    if (typeof window !== 'undefined') {
      ;(
        window as Window &
          typeof globalThis & { __raycastTestResults: RaycastTestResult[] }
      ).__raycastTestResults = this.testResults
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
