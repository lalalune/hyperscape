import type { World } from '../World';
import { SystemBase } from './SystemBase';
import { PlayerSystem } from './PlayerSystem';
import { WorldGenerationSystem } from './WorldGenerationSystem';
import { EventType } from '../types/events';
import { getSystem } from '../utils/SystemUtils';
import THREE from '../extras/three';

/**
 * Spawn Test System
 * Tests player spawning system with fail-fast validation
 * Throws errors if players spawn at (0,0,0) instead of proper terrain positions
 */
export class SpawnTestSystem extends SystemBase {
  private playerSystem!: PlayerSystem;
  private worldGenSystem!: WorldGenerationSystem;
  private _tempVec3 = new THREE.Vector3();
  
  constructor(world: World) {
    super(world, {
      name: 'spawn-test',
      dependencies: {
        required: ['player', 'world-generation'],
        optional: []
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Listen for player spawn events to validate positions
    this.subscribe(EventType.PLAYER_SPAWNED, (data) => this.validatePlayerSpawn(data));
    this.subscribe(EventType.MOVEMENT_COMPLETED, (data) => this.validateTeleportPosition(data));
  }

  start(): void {
    // Get required system references
    this.playerSystem = getSystem<PlayerSystem>(this.world, 'player')!;
    this.worldGenSystem = getSystem<WorldGenerationSystem>(this.world, 'world-generation')!;
    
    // Test spawn position availability immediately
    this.testSpawnPositionAvailability();
  }

  /**
   * Get a random spawn position in the town area
   */
  private getRandomTownPosition(): THREE.Vector3 {
    // Select a random spawn position within the town area
    const townCenterX = 0;
    const townCenterZ = 0;
    const townRadius = 20;
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * townRadius;
    
    const x = townCenterX + Math.cos(angle) * distance;
    const z = townCenterZ + Math.sin(angle) * distance;
    const y = 1; // Default spawn height above ground
    
    return this._tempVec3.set(x, y, z);
  }

  private testSpawnPositionAvailability(): void {
    const spawnPosition = this.getRandomTownPosition();
    
    // Validate position is on terrain (y > 0)
    if (spawnPosition.y <= 0) {
      throw new Error(`[SpawnTestSystem] CRITICAL: Spawn position y=${spawnPosition.y} is at/below ground level!`);
    }
  }

  private validatePlayerSpawn(event: { playerId: string; position: { x: number; y: number; z: number } }): void {
    // CRITICAL TEST: Player should NEVER spawn at (0,0,0)
    if (event.position.x === 0 && event.position.y === 0 && event.position.z === 0) {
      throw new Error(`[SpawnTestSystem] CRITICAL SPAWN FAILURE: Player ${event.playerId} spawned at (0,0,0) instead of terrain!`);
    }
    
    // CRITICAL TEST: Player should spawn above ground (y > 0)
    if (event.position.y <= 0) {
      throw new Error(`[SpawnTestSystem] CRITICAL SPAWN FAILURE: Player ${event.playerId} spawned at/below ground level y=${event.position.y}!`);
    }
    
    // CRITICAL TEST: Player should spawn within reasonable world bounds
    const maxDistance = 200; // Maximum distance from world origin
    const distance = Math.sqrt(event.position.x ** 2 + event.position.z ** 2);
    if (distance > maxDistance) {
      throw new Error(`[SpawnTestSystem] CRITICAL SPAWN FAILURE: Player ${event.playerId} spawned too far from world center (distance=${distance})!`);
    }
  }

  private validateTeleportPosition(event: { playerId: string; finalPosition: { x: number; y: number; z: number } }): void {
    const player = this.world.entities.getPlayer(event.playerId);
    if (!player) return;

    const distance = (player.position as THREE.Vector3).distanceTo(this._tempVec3.set(event.finalPosition.x, event.finalPosition.y, event.finalPosition.z));
    if (distance > 1.0) {
      this.logger.error(`Player ${event.playerId} did not teleport to the correct position.`);
    }
  }
}