import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

/**
 * Example Mob Spawner System
 * 
 * Simple spawner that creates mobs at 0,0,0 with cube proxies
 * for easy testing and visualization
 */
export class ExampleMobSpawner extends System {
  private spawnerMesh: any;
  private spawnedMobs: any[] = [];
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[ExampleMobSpawner] Initializing example mob spawner at origin...');
  }

  start(): void {
    console.log('[ExampleMobSpawner] Starting example mob spawner...');
    
    // Only run on client for visual representation
    if (this.world.network?.isServer) {
      console.log('[ExampleMobSpawner] Running on server, skipping visual spawner');
      return;
    }
    
    // Create spawner visual (purple cube at origin)
    this.createSpawnerVisual();
    
    // Spawn some example mobs around the spawner
    this.spawnExampleMobs();
  }

  private createSpawnerVisual(): void {
    if (!THREE) {
      console.warn('[ExampleMobSpawner] THREE.js not available');
      return;
    }

    try {
      // Create spawner cube (purple)
      const geometry = new THREE.BoxGeometry(2, 3, 2);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x9932CC,
        opacity: 0.8,
        transparent: true
      });
      this.spawnerMesh = new THREE.Mesh(geometry, material);
      this.spawnerMesh.position.set(0, 1.5, 0);
      this.spawnerMesh.name = 'ExampleMobSpawner';
      
      // Add PhysX collider for spawner
      this.addPhysXCollider(this.spawnerMesh, {
        width: 2, height: 3, depth: 2,
        entityId: 'example_mob_spawner',
        entityType: 'spawner'
      });
      
      // Add to world
      if (this.world.stage && this.world.stage.scene) {
        this.world.stage.scene.add(this.spawnerMesh);
        console.log('[ExampleMobSpawner] ✅ Spawner visual created at origin (0, 0, 0)');
      }
    } catch (error) {
      console.error('[ExampleMobSpawner] Error creating spawner visual:', error);
    }
  }

  private spawnExampleMobs(): void {
    if (!THREE) return;

    const mobTypes = [
      { name: 'Goblin', color: 0x00ff00, size: 0.8 },
      { name: 'Bandit', color: 0x8B4513, size: 1.0 },
      { name: 'Barbarian', color: 0xA0522D, size: 1.2 }
    ];

    // Spawn mobs in a circle around the spawner
    const radius = 5;
    const mobCount = 6;
    
    for (let i = 0; i < mobCount; i++) {
      const angle = (i / mobCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const mobType = mobTypes[i % mobTypes.length];
      this.createMobCube(x, z, mobType);
    }
    
    console.log(`[ExampleMobSpawner] ✅ Spawned ${mobCount} example mobs around origin`);
  }

  private createMobCube(x: number, z: number, mobType: any): void {
    try {
      const geometry = new THREE.BoxGeometry(mobType.size, mobType.size * 1.5, mobType.size);
      const material = new THREE.MeshBasicMaterial({ color: mobType.color });
      const mob = new THREE.Mesh(geometry, material);
      
      mob.position.set(x, mobType.size * 0.75, z);
      mob.name = `ExampleMob_${mobType.name}_${Date.now()}`;
      mob.userData = {
        type: 'example_mob',
        mobType: mobType.name,
        health: 100
      };
      
      // Add PhysX collider for mob
      this.addPhysXCollider(mob, {
        width: mobType.size, height: mobType.size * 1.5, depth: mobType.size,
        entityId: mob.name,
        entityType: 'example_mob'
      });
      
      // Add to scene
      if (this.world.stage && this.world.stage.scene) {
        this.world.stage.scene.add(mob);
        this.spawnedMobs.push(mob);
      }
    } catch (error) {
      console.error('[ExampleMobSpawner] Error creating mob cube:', error);
    }
  }

  update(delta: number): void {
    // Make mobs slowly rotate
    for (const mob of this.spawnedMobs) {
      if (mob && mob.rotation) {
        mob.rotation.y += delta * 0.5;
      }
    }
    
    // Make spawner pulse
    if (this.spawnerMesh) {
      const scale = 1 + Math.sin(Date.now() * 0.001) * 0.1;
      this.spawnerMesh.scale.set(scale, scale, scale);
    }
  }

  /**
   * Add PhysX collider to a mesh for raycasting and interactions
   */
  private addPhysXCollider(mesh: THREE.Mesh, config: {
    width: number; height: number; depth: number;
    entityId: string; entityType: string;
  }): void {
    // Create PhysX collider data that the physics system can use
    mesh.userData.physx = {
      type: 'box',
      size: { x: config.width, y: config.height, z: config.depth },
      collider: true,
      trigger: false,
      interactive: true
    };
    
    // Add interaction data
    mesh.userData.interactive = true;
    mesh.userData.clickable = true;
    mesh.userData.entityId = config.entityId;
    mesh.userData.entityType = config.entityType;
    
    console.log(`[ExampleMobSpawner] Added PhysX collider to: ${config.entityId}`);
  }
} 