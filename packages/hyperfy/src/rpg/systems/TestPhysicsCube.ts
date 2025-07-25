import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

/**
 * TestPhysicsCube System
 * 
 * Creates a simple cube with physics to test basic 3D rendering and physics integration.
 * This helps verify that systems can create visible objects with physics behavior.
 */
export class TestPhysicsCube extends System {
  private testCubes = new Map<string, any>();
  private world3D: any;
  private cubeCounter = 0;
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[TestPhysicsCube] Initializing physics cube test system...');
    
    this.world3D = this.world;
    
    // Listen for cube spawn requests
    this.world.on?.('rpg:test:spawn_cube', this.spawnCube.bind(this));
    this.world.on?.('rpg:test:clear_cubes', this.clearAllCubes.bind(this));
    
    console.log('[TestPhysicsCube] Physics cube test system initialized');
  }

  start(): void {
    console.log('[TestPhysicsCube] Starting physics cube testing...');
    
    // Auto-spawn test cubes
    this.spawnTestCubes();
  }

  private spawnTestCubes(): void {
    console.log('[TestPhysicsCube] Spawning test physics cubes...');
    
    // Spawn a basic red cube at origin
    this.spawnCube({
      position: { x: 0, y: 2, z: 0 },
      color: 0xff0000,
      size: 1,
      hasPhysics: true
    });

    // Spawn additional test cubes
    this.spawnCube({
      position: { x: 3, y: 1, z: 3 },
      color: 0x00ff00,
      size: 0.8,
      hasPhysics: false
    });

    this.spawnCube({
      position: { x: -3, y: 1, z: -3 },
      color: 0x0000ff,
      size: 1.2,
      hasPhysics: true
    });

    // Floating cube for visual reference
    this.spawnCube({
      position: { x: 0, y: 5, z: 0 },
      color: 0xffff00,
      size: 0.5,
      hasPhysics: false
    });
  }

  private spawnCube(data: { 
    position: { x: number; y: number; z: number };
    color: number;
    size: number;
    hasPhysics: boolean;
  }): void {

    const cubeId = `test_cube_${this.cubeCounter++}`;
    
    console.log(`[TestPhysicsCube] Spawning cube at (${data.position.x}, ${data.position.y}, ${data.position.z}) with physics: ${data.hasPhysics}`);

    // Create cube geometry and material
    const geometry = new THREE.BoxGeometry(data.size, data.size, data.size);
    const material = new THREE.MeshBasicMaterial({ 
      color: data.color,
      wireframe: false
    });
    
    const cubeMesh = new THREE.Mesh(geometry, material);
    cubeMesh.position.set(data.position.x, data.position.y, data.position.z);
    cubeMesh.userData = {
      id: cubeId,
      type: 'test_cube',
      hasPhysics: data.hasPhysics,
      interactable: true
    };

    // Add to world using helper method
    this.addToWorld(cubeMesh, 'test_cube');

    // Add physics if requested
    if (data.hasPhysics) {
      this.addPhysicsToEntity(cubeId, cubeMesh, data);
    }

    this.testCubes.set(cubeId, {
      mesh: cubeMesh,
      data: {
        id: cubeId,
        position: data.position,
        size: data.size,
        color: data.color,
        hasPhysics: data.hasPhysics
      }
    });

    console.log(`[TestPhysicsCube] Spawned cube with ID: ${cubeId}, physics: ${data.hasPhysics}`);
  }

  private addPhysicsToEntity(entityId: string, mesh: any, data: any): void {
    console.log(`[TestPhysicsCube] Adding PhysX collider to cube ${entityId}`);
    
    // Add PhysX collider data for raycasting and interaction
    mesh.userData.physx = {
      type: 'box',
      size: { x: data.size, y: data.size, z: data.size },
      collider: true,
      trigger: false,
      interactive: true,
      dynamic: data.hasPhysics
    };
    
    // Add interaction data
    mesh.userData.interactive = true;
    mesh.userData.clickable = true;
    mesh.userData.entityId = entityId;
    mesh.userData.entityType = 'test_cube';
    
    // Emit physics registration event
    this.world.emit?.('rpg:physics:register', {
      entityId: entityId,
      type: 'box',
      size: data.size,
      position: data.position,
      dynamic: data.hasPhysics
    });
    
    console.log(`[TestPhysicsCube] Added PhysX collider to: ${mesh.name || entityId}`);
  }

  // Test interaction functionality
  testCubeInteraction(): void {
    console.log('[TestPhysicsCube] Testing cube interactions...');
    
    for (const [cubeId, cubeData] of this.testCubes) {
      console.log(`Cube ${cubeId}: position(${cubeData.mesh.position.x.toFixed(2)}, ${cubeData.mesh.position.y.toFixed(2)}, ${cubeData.mesh.position.z.toFixed(2)}), physics: ${cubeData.data.hasPhysics}`);
    }
  }

  // Animate cubes for visual testing
  animateCubes(dt: number): void {
    const time = Date.now() * 0.001;
    
    for (const [cubeId, cubeData] of this.testCubes) {
      if (!cubeData.data.hasPhysics && cubeData.mesh) {
        // Simple floating animation for non-physics cubes
        const originalY = cubeData.data.position.y;
        cubeData.mesh.position.y = originalY + Math.sin(time + cubeData.mesh.position.x) * 0.5;
        
        // Rotate cubes slowly
        cubeData.mesh.rotation.x += dt * 0.5;
        cubeData.mesh.rotation.y += dt * 0.3;
      }
    }
  }

  private clearAllCubes(): void {
    console.log('[TestPhysicsCube] Clearing all test cubes...');
    
    for (const [cubeId, cubeData] of this.testCubes) {
      // Remove from 3D world
      if (this.world3D && this.world3D.remove && cubeData.mesh) {
        this.world3D.remove(cubeData.mesh);
      }
      
      // Unregister physics if it had any
      if (cubeData.data.hasPhysics) {
        this.world.emit?.('rpg:physics:unregister', {
          entityId: cubeId
        });
      }
    }
    
    this.testCubes.clear();
    console.log('[TestPhysicsCube] All test cubes cleared');
  }

  // Public API
  getTestCubes(): Map<string, any> {
    return this.testCubes;
  }

  getCubeCount(): number {
    return this.testCubes.size;
  }

  spawnRandomCube(): string | null {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Random position
    const position = {
      x: (Math.random() - 0.5) * 10,
      y: Math.random() * 5 + 1,
      z: (Math.random() - 0.5) * 10
    };
    
    this.spawnCube({
      position,
      color: randomColor,
      size: Math.random() * 1.5 + 0.5,
      hasPhysics: Math.random() > 0.5
    });
    
    return `test_cube_${this.cubeCounter - 1}`;
  }

  update(dt: number): void {
    // Animate the cubes for visual feedback
    this.animateCubes(dt);
  }

  // Helper method for adding objects to world with comprehensive error handling
  private addToWorld(object: any, type: string): boolean {
    console.log(`[TestPhysicsCube] Attempting to add ${type} to world...`);
    
    if (!object) {
      console.error(`[TestPhysicsCube] ❌ Cannot add null ${type} to world`);
      return false;
    }

    console.log("this.world is", this.world)

    // Try multiple Hyperfy world addition methods
    this.world3D.stage.scene.add(object);

    return true;
  }

  destroy(): void {
    this.clearAllCubes();
    console.log('[TestPhysicsCube] System destroyed');
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