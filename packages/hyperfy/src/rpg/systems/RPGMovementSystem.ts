/**
 * RPGMovementSystem - Handles player movement with click-to-move and pathfinding
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

interface RPGMovementTarget {
  playerId: string;
  targetPosition: { x: number; y: number; z: number };
  startPosition: { x: number; y: number; z: number };
  startTime: number;
  estimatedDuration: number;
  movementSpeed: number;
  isRunning: boolean;
  path?: THREE.Vector3[]; // Path waypoints
  currentWaypoint?: number; // Current waypoint index
}

/**
 * RPG Movement System
 * Manages click-to-move navigation per GDD specifications:
 * 
 * - Orthographic overhead camera with point-and-click navigation
 * - Walking (default speed) and running (faster, consumes stamina)
 * - Pathfinding around obstacles
 * - Movement interruption for actions
 * - Stamina system for running
 */
export class RPGMovementSystem extends System {
  private activeMovements = new Map<string, RPGMovementTarget>();
  private playerStamina = new Map<string, { current: number; max: number; regenerating: boolean }>();
  
  private readonly WALK_SPEED = 4; // meters per second
  private readonly RUN_SPEED = 8; // meters per second
  private readonly MAX_STAMINA = 100;
  private readonly STAMINA_DRAIN_RATE = 10; // per second while running
  private readonly STAMINA_REGEN_RATE = 5; // per second while not running
  private readonly MIN_MOVEMENT_DISTANCE = 0.5; // Don't move if clicking too close

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGMovementSystem] Initializing movement system...');
    
    // Listen for movement events
    this.world.on?.('rpg:movement:click_to_move', this.startMovement.bind(this));
    this.world.on?.('rpg:movement:stop', this.stopMovement.bind(this));
    this.world.on?.('rpg:movement:toggle_run', this.toggleRunning.bind(this));
    this.world.on?.('rpg:player:register', this.initializePlayerStamina.bind(this));
    this.world.on?.('rpg:player:unregister', this.cleanupPlayerMovement.bind(this));
    this.world.on?.('rpg:movement:interrupt', this.interruptMovement.bind(this));
    
    console.log('[RPGMovementSystem] Movement system initialized with click-to-move navigation');
  }

  start(): void {
    console.log('[RPGMovementSystem] Movement system started');
    
    // Start update loops
    setInterval(() => {
      this.updateMovements();
    }, 50); // 20 FPS for smooth movement
    
    setInterval(() => {
      this.updateStamina();
    }, 1000); // Update stamina every second
  }

  private initializePlayerStamina(playerData: { id: string }): void {
    this.playerStamina.set(playerData.id, {
      current: this.MAX_STAMINA,
      max: this.MAX_STAMINA,
      regenerating: true
    });
    
    console.log(`[RPGMovementSystem] Initialized stamina for player: ${playerData.id}`);
  }

  private cleanupPlayerMovement(playerId: string): void {
    this.activeMovements.delete(playerId);
    this.playerStamina.delete(playerId);
    console.log(`[RPGMovementSystem] Cleaned up movement data for player: ${playerId}`);
  }

  private startMovement(data: { 
    playerId: string; 
    targetPosition: { x: number; y: number; z: number }; 
    currentPosition: { x: number; y: number; z: number };
    isRunning?: boolean;
  }): void {
    // Stop any existing movement
    this.stopMovement({ playerId: data.playerId });

    // Request path from pathfinding system
    this.world.emit('rpg:pathfinding:request', {
      playerId: data.playerId,
      start: data.currentPosition,
      end: data.targetPosition,
      callback: (path: THREE.Vector3[]) => {
        if (path.length < 2) {
          console.log(`[RPGMovementSystem] No path found for player ${data.playerId}`);
          return;
        }

        // Calculate total path distance
        let totalDistance = 0;
        for (let i = 1; i < path.length; i++) {
          totalDistance += path[i - 1].distanceTo(path[i]);
        }

        // Don't move if path is too short
        if (totalDistance < this.MIN_MOVEMENT_DISTANCE) {
          console.log(`[RPGMovementSystem] Path too short for player ${data.playerId}: ${totalDistance}m`);
          return;
        }

        // Check stamina
        const stamina = this.playerStamina.get(data.playerId);
        const isRunning = data.isRunning && stamina && stamina.current > 0;
        
        if (data.isRunning && (!stamina || stamina.current <= 0)) {
          this.world.emit?.('rpg:ui:message', {
            playerId: data.playerId,
            message: 'You are too tired to run.',
            type: 'info'
          });
        }

        // Determine movement speed
        const speed = isRunning ? this.RUN_SPEED : this.WALK_SPEED;

        // Create movement with path
        const movement: RPGMovementTarget = {
          playerId: data.playerId,
          targetPosition: { 
            x: path[path.length - 1].x,
            y: path[path.length - 1].y,
            z: path[path.length - 1].z
          },
          startPosition: { 
            x: path[0].x,
            y: path[0].y,
            z: path[0].z
          },
          startTime: Date.now(),
          estimatedDuration: (totalDistance / speed) * 1000,
          movementSpeed: speed,
          isRunning: isRunning || false,
          path: path,
          currentWaypoint: 0
        };

        // Start movement
        this.activeMovements.set(data.playerId, movement);

        console.log(`[RPGMovementSystem] Player ${data.playerId} started ${isRunning ? 'running' : 'walking'} along path with ${path.length} waypoints`);
        
        // Show path visualization in debug mode
        if ((this.world as any).debugMode) {
          const pathfinding = (this.world as any)['rpg-pathfinding'];
          pathfinding?.debugDrawPath(path);
        }

        // Emit movement started event
        this.world.emit?.('rpg:movement:started', {
          playerId: data.playerId,
          targetPosition: data.targetPosition,
          isRunning: isRunning,
          estimatedDuration: movement.estimatedDuration
        });

        // Update stamina regeneration status
        if (stamina) {
          stamina.regenerating = !isRunning;
        }
      }
    });
  }

  private stopMovement(data: { playerId: string }): void {
    const movement = this.activeMovements.get(data.playerId);
    if (movement) {
      this.activeMovements.delete(data.playerId);
      
      console.log(`[RPGMovementSystem] Player ${data.playerId} stopped movement`);
      
      // Emit movement stopped event
      this.world.emit?.('rpg:movement:stopped', {
        playerId: data.playerId
      });

      // Resume stamina regeneration
      const stamina = this.playerStamina.get(data.playerId);
      if (stamina) {
        stamina.regenerating = true;
      }
    }
  }

  private toggleRunning(data: { playerId: string; isRunning: boolean }): void {
    const movement = this.activeMovements.get(data.playerId);
    if (movement) {
      const stamina = this.playerStamina.get(data.playerId);
      
      // Check if player can run
      if (data.isRunning && (!stamina || stamina.current <= 0)) {
        this.world.emit?.('rpg:ui:message', {
          playerId: data.playerId,
          message: 'You are too tired to run.',
          type: 'info'
        });
        return;
      }

      // Update movement speed
      const wasRunning = movement.isRunning;
      movement.isRunning = !!(data.isRunning && stamina && stamina.current > 0);
      
      if (wasRunning !== movement.isRunning) {
        // Recalculate remaining time with new speed
        const elapsed = Date.now() - movement.startTime;
        const progress = elapsed / movement.estimatedDuration;
        const remainingDistance = this.calculateDistance(
          this.getCurrentPosition(movement),
          movement.targetPosition
        );
        
        movement.movementSpeed = movement.isRunning ? this.RUN_SPEED : this.WALK_SPEED;
        const newRemainingTime = (remainingDistance / movement.movementSpeed) * 1000;
        movement.estimatedDuration = elapsed + newRemainingTime;

        console.log(`[RPGMovementSystem] Player ${data.playerId} toggled to ${movement.isRunning ? 'running' : 'walking'}`);
        
        // Update stamina regeneration
        if (stamina) {
          stamina.regenerating = !movement.isRunning;
        }

        // Emit speed change event
        this.world.emit?.('rpg:movement:speed_changed', {
          playerId: data.playerId,
          isRunning: movement.isRunning,
          newSpeed: movement.movementSpeed
        });
      }
    }
  }

  private interruptMovement(data: { playerId: string; reason?: string }): void {
    const movement = this.activeMovements.get(data.playerId);
    if (movement) {
      this.stopMovement({ playerId: data.playerId });
      
      console.log(`[RPGMovementSystem] Player ${data.playerId} movement interrupted: ${data.reason || 'unknown reason'}`);
      
      // Emit interruption event
      this.world.emit?.('rpg:movement:interrupted', {
        playerId: data.playerId,
        reason: data.reason
      });
    }
  }

  private updateMovements(): void {
    const now = Date.now();

    for (const [playerId, movement] of this.activeMovements.entries()) {
      const player = this.getPlayer(playerId);
      if (!player) {
        this.activeMovements.delete(playerId);
        continue;
      }

      // If we have a path, follow waypoints
      if (movement.path && movement.currentWaypoint !== undefined) {
        this.updatePathMovement(player, movement);
      } else {
        // Fallback to direct movement
        this.updateDirectMovement(player, movement);
      }

      // Check if movement is complete
      if (movement.path && movement.currentWaypoint !== undefined && 
          movement.currentWaypoint >= movement.path.length - 1) {
        const distanceToTarget = this.calculateDistance(
          { x: player.position.x, y: player.position.y, z: player.position.z },
          movement.targetPosition
        );
        
        if (distanceToTarget < 0.5) {
          // Movement complete
          this.completeMovement(playerId, movement, player);
        }
      }
    }
  }

  /**
   * Update movement along path waypoints
   */
  private updatePathMovement(player: any, movement: RPGMovementTarget): void {
    if (!movement.path || movement.currentWaypoint === undefined) return;

    const currentWaypoint = movement.path[movement.currentWaypoint];
    const nextWaypoint = movement.path[movement.currentWaypoint + 1];
    
    if (!nextWaypoint) {
      // At last waypoint
      this.moveTowardsPoint(player, movement.path[movement.path.length - 1], movement);
      return;
    }

    // Move towards next waypoint
    const playerPos = { x: player.position.x, y: player.position.y, z: player.position.z };
    const distanceToNext = this.calculateDistance(playerPos, {
      x: nextWaypoint.x,
      y: nextWaypoint.y,
      z: nextWaypoint.z
    });

    // If close to waypoint, advance to next
    if (distanceToNext < 1.0) {
      movement.currentWaypoint++;
      console.log(`[RPGMovementSystem] Player ${movement.playerId} reached waypoint ${movement.currentWaypoint}/${movement.path.length - 1}`);
    }

    // Move towards current target waypoint
    this.moveTowardsPoint(player, nextWaypoint, movement);
  }

  /**
   * Update direct movement (fallback)
   */
  private updateDirectMovement(player: any, movement: RPGMovementTarget): void {
    const elapsed = Date.now() - movement.startTime;
    const progress = Math.min(elapsed / movement.estimatedDuration, 1.0);
    
    // Calculate new position
    const newPosition = new THREE.Vector3(
      movement.startPosition.x + (movement.targetPosition.x - movement.startPosition.x) * progress,
      movement.startPosition.y + (movement.targetPosition.y - movement.startPosition.y) * progress,
      movement.startPosition.z + (movement.targetPosition.z - movement.startPosition.z) * progress
    );

    // Update position
    this.updatePlayerPosition(player, newPosition, movement);

    // Check if reached target
    if (progress >= 1.0) {
      this.completeMovement(movement.playerId, movement, player);
    }
  }

  /**
   * Move player towards a specific point
   */
  private moveTowardsPoint(player: any, target: THREE.Vector3, movement: RPGMovementTarget): void {
    const playerPos = player.position;
    const direction = new THREE.Vector3(
      target.x - playerPos.x,
      0, // Don't change Y for now
      target.z - playerPos.z
    ).normalize();

    // Calculate movement delta
    const deltaTime = 1 / 60; // Assume 60 FPS
    const moveDistance = movement.movementSpeed * deltaTime;
    
    const newPosition = new THREE.Vector3(
      playerPos.x + direction.x * moveDistance,
      playerPos.y, // Keep current Y
      playerPos.z + direction.z * moveDistance
    );

    // Update position
    this.updatePlayerPosition(player, newPosition, movement);
  }

  /**
   * Update player position and rotation
   */
  private updatePlayerPosition(player: any, newPosition: THREE.Vector3, movement: RPGMovementTarget): void {
    // Handle different player object structures
    if (player.position && typeof player.position.set === 'function') {
      // Direct position property
      player.position.set(newPosition.x, newPosition.y, newPosition.z);
    } else if (player.base?.position && typeof player.base.position.set === 'function') {
      // Position on base object
      player.base.position.set(newPosition.x, newPosition.y, newPosition.z);
    } else if (player.setPosition && typeof player.setPosition === 'function') {
      // Method to set position
      player.setPosition(newPosition.x, newPosition.y, newPosition.z);
    } else {
      console.warn('[RPGMovementSystem] Unable to update player position - unknown player structure', player);
      return;
    }

    // Update player rotation
    const deltaTime = 1 / 60; // Assume 60 FPS
    const moveDistance = movement.movementSpeed * deltaTime;

    // Calculate facing direction
    const direction = new THREE.Vector3(
      movement.targetPosition.x - movement.startPosition.x,
      0,
      movement.targetPosition.z - movement.startPosition.z
    ).normalize();

    // Calculate facing direction based on movement
    let facingTarget: THREE.Vector3;
    
    if (movement.path && movement.currentWaypoint !== undefined) {
      // Face towards next waypoint
      const nextWaypoint = movement.path[Math.min(movement.currentWaypoint + 1, movement.path.length - 1)];
      facingTarget = nextWaypoint;
    } else {
      // Face towards final target
      facingTarget = new THREE.Vector3(
        movement.targetPosition.x,
        newPosition.y,
        movement.targetPosition.z
      );
    }

    const directionToFace = new THREE.Vector3(
      facingTarget.x - newPosition.x,
      0,
      facingTarget.z - newPosition.z
    ).normalize();

    // Calculate target rotation angle
    const targetAngle = Math.atan2(directionToFace.x, directionToFace.z);
    
    // Update player rotation based on structure
    if (player.rotation && typeof player.rotation.y !== 'undefined') {
      // Smoothly rotate towards target
      const currentAngle = player.rotation.y;
      let angleDiff = targetAngle - currentAngle;
      
      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Apply rotation with smoothing
      player.rotation.y = currentAngle + angleDiff * 0.1;
    } else if (player.base?.rotation && typeof player.base.rotation.y !== 'undefined') {
      // Rotation on base object
      const currentAngle = player.base.rotation.y;
      let angleDiff = targetAngle - currentAngle;
      
      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Apply rotation with smoothing
      player.base.rotation.y = currentAngle + angleDiff * 0.1;
    } else if (player.setRotation && typeof player.setRotation === 'function') {
      // Method to set rotation
      player.setRotation(0, targetAngle, 0);
    }
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Public API for apps  
  isPlayerMoving(playerId: string): boolean {
    return this.activeMovements.has(playerId);
  }

  getPlayerMovement(playerId: string): RPGMovementTarget | undefined {
    return this.activeMovements.get(playerId);
  }

  getPlayerStamina(playerId: string): { current: number; max: number; regenerating: boolean } | undefined {
    return this.playerStamina.get(playerId);
  }

  canPlayerRun(playerId: string): boolean {
    const stamina = this.playerStamina.get(playerId);
    return !!(stamina && stamina.current > 0);
  }

  getMovementSpeed(playerId: string): number {
    const movement = this.activeMovements.get(playerId);
    if (movement) {
      return movement.movementSpeed;
    }
    
    // Return default walking speed if not moving
    return this.WALK_SPEED;
  }

  getEstimatedArrivalTime(playerId: string): number | null {
    const movement = this.activeMovements.get(playerId);
    if (!movement) return null;
    
    return movement.startTime + movement.estimatedDuration;
  }

  // Force stop movement (for combat, actions, etc.)
  forceStopMovement(playerId: string, reason: string): void {
    this.interruptMovement({ playerId, reason });
  }

  // Set player stamina (for effects, level ups, etc.)
  setPlayerStamina(playerId: string, current: number, max?: number): void {
    const stamina = this.playerStamina.get(playerId);
    if (stamina) {
      stamina.current = Math.max(0, Math.min(current, stamina.max));
      if (max !== undefined) {
        stamina.max = Math.max(1, max);
        stamina.current = Math.min(stamina.current, stamina.max);
      }
      
      this.world.emit?.('rpg:player:stamina:update', {
        playerId: playerId,
        current: stamina.current,
        max: stamina.max,
        regenerating: stamina.regenerating
      });
    }
  }

  // Get all active movements (for debugging/admin tools)
  getAllActiveMovements(): Map<string, RPGMovementTarget> {
    return new Map(this.activeMovements);
  }

  destroy(): void {
    this.activeMovements.clear();
    this.playerStamina.clear();
    console.log('[RPGMovementSystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    this.updateMovements();
    this.updateStamina();
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}

  /**
   * Complete a movement
   */
  private completeMovement(playerId: string, movement: RPGMovementTarget, player: any): void {
    // Remove from active movements
    this.activeMovements.delete(playerId);

    console.log(`[RPGMovementSystem] Player ${playerId} reached destination`);

    // Emit movement completed event
    this.world.emit?.('rpg:movement:completed', {
      playerId: playerId,
      finalPosition: movement.targetPosition
    });

    // Update final position
    this.world.emit?.('rpg:player:position:update', {
      entityId: playerId,
      position: movement.targetPosition
    });

    // Resume stamina regeneration
    const stamina = this.playerStamina.get(playerId);
    if (stamina) {
      stamina.regenerating = true;
    }
  }

  /**
   * Get player entity
   */
  private getPlayer(playerId: string): any {
    // Try different methods to get the player
    const player = this.world.getPlayer?.(playerId) || 
                   (this.world as any).players?.get(playerId) ||
                   (this.world as any).entities?.get(playerId);
                   
    return player;
  }

  /**
   * Consume stamina while running
   */
  private consumeStamina(playerId: string, amount: number): void {
    const stamina = this.playerStamina.get(playerId);
    if (!stamina) return;

    stamina.current = Math.max(0, stamina.current - amount);
    
    // Force stop running if stamina depleted
    if (stamina.current <= 0) {
      const movement = this.activeMovements.get(playerId);
      if (movement && movement.isRunning) {
        movement.isRunning = false;
        movement.movementSpeed = this.WALK_SPEED;
        
        this.world.emit?.('rpg:ui:message', {
          playerId: playerId,
          message: 'You are too tired to continue running.',
          type: 'info'
        });
      }
    }
  }

  /**
   * Update stamina for all players
   */
  private updateStamina(): void {
    for (const [playerId, stamina] of this.playerStamina.entries()) {
      const movement = this.activeMovements.get(playerId);
      
      if (movement && movement.isRunning) {
        // Drain stamina while running
        stamina.current = Math.max(0, stamina.current - this.STAMINA_DRAIN_RATE);
        stamina.regenerating = false;
        
        // Force stop running if stamina depleted
        if (stamina.current <= 0) {
          this.toggleRunning({ playerId, isRunning: false });
          this.world.emit?.('rpg:ui:message', {
            playerId: playerId,
            message: 'You are too tired to continue running.',
            type: 'info'
          });
        }
      } else if (stamina.regenerating && stamina.current < stamina.max) {
        // Regenerate stamina when not running
        stamina.current = Math.min(stamina.max, stamina.current + this.STAMINA_REGEN_RATE);
      }

      // Emit stamina update if changed
      this.world.emit?.('rpg:player:stamina:update', {
        playerId: playerId,
        current: stamina.current,
        max: stamina.max,
        regenerating: stamina.regenerating
      });
    }
  }

  /**
   * Get current interpolated position of a movement
   */
  private getCurrentPosition(movement: RPGMovementTarget): { x: number; y: number; z: number } {
    const elapsed = Date.now() - movement.startTime;
    const progress = Math.min(1, elapsed / movement.estimatedDuration);
    
    // Linear interpolation between start and target positions
    return {
      x: movement.startPosition.x + (movement.targetPosition.x - movement.startPosition.x) * progress,
      y: movement.startPosition.y + (movement.targetPosition.y - movement.startPosition.y) * progress,
      z: movement.startPosition.z + (movement.targetPosition.z - movement.startPosition.z) * progress
    };
  }
}