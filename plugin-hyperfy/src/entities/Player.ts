import { Vector3 } from '../types/math';
import { PlayerRole } from '../apps/amongus/GameState';
import { EventEmitter } from 'events';

export interface PlayerConfig {
  position?: Vector3;
  speed?: number;
  role?: PlayerRole;
  color?: string;
  name?: string;
}

export class Player extends EventEmitter {
  id: string;
  name: string;
  position: Vector3;
  velocity: Vector3;
  speed: number;
  isMoving: boolean;
  alive: boolean;
  role?: PlayerRole;
  color?: string;
  
  // Movement
  targetPosition?: Vector3;
  path?: Vector3[];
  currentPathIndex: number = 0;
  
  // Game state
  tasksCompleted: number = 0;
  lastKillTime?: number;
  suspicionLevel: number = 0;
  
  // Network
  lastUpdateTime: number;
  networkId?: string;

  constructor(id: string, config: PlayerConfig = {}) {
    super();
    this.id = id;
    this.name = config.name || `Player ${id}`;
    this.position = config.position || { x: 25, y: 0, z: 25 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.speed = config.speed || 5.0;
    this.isMoving = false;
    this.alive = true;
    this.role = config.role;
    this.color = config.color;
    this.lastUpdateTime = Date.now();
  }

  moveTo(target: Vector3, path?: Vector3[]): void {
    this.targetPosition = target;
    this.path = path || [target];
    this.currentPathIndex = 0;
    this.isMoving = true;
    this.emit('movement:start', { target, path });
  }

  stopMovement(): void {
    this.isMoving = false;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.targetPosition = undefined;
    this.path = undefined;
    this.emit('movement:stop');
  }

  update(deltaTime: number): void {
    if (!this.isMoving || !this.targetPosition) return;

    // Get current target from path
    const currentTarget = this.path?.[this.currentPathIndex] || this.targetPosition;
    
    // Calculate direction to target
    const dx = currentTarget.x - this.position.x;
    const dz = currentTarget.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Check if reached current waypoint
    if (distance < 0.5) {
      if (this.path && this.currentPathIndex < this.path.length - 1) {
        this.currentPathIndex++;
      } else {
        // Reached final destination
        this.position = { ...this.targetPosition };
        this.stopMovement();
        this.emit('movement:complete');
        return;
      }
    }

    // Update velocity
    if (distance > 0) {
      this.velocity = {
        x: (dx / distance) * this.speed,
        y: 0,
        z: (dz / distance) * this.speed
      };

      // Update position
      const moveDistance = this.speed * deltaTime;
      if (moveDistance >= distance) {
        // Don't overshoot
        this.position = { ...currentTarget };
      } else {
        this.position.x += this.velocity.x * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
      }

      this.emit('position:update', this.position);
    }
  }

  kill(): void {
    this.alive = false;
    this.stopMovement();
    this.emit('death');
  }

  respawn(position?: Vector3): void {
    this.alive = true;
    this.position = position || { x: 25, y: 0, z: 25 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.isMoving = false;
    this.emit('respawn');
  }

  startTask(taskId: string): void {
    if (this.role === PlayerRole.IMPOSTOR) {
      throw new Error('Impostors cannot complete tasks');
    }
    this.emit('task:start', { taskId });
  }

  completeTask(taskId: string): void {
    if (this.role === PlayerRole.IMPOSTOR) {
      throw new Error('Impostors cannot complete tasks');
    }
    this.tasksCompleted++;
    this.emit('task:complete', { taskId });
  }

  canKill(): boolean {
    if (this.role !== PlayerRole.IMPOSTOR || !this.alive) return false;
    
    const now = Date.now();
    const cooldown = 20000; // 20 seconds
    
    return !this.lastKillTime || (now - this.lastKillTime) >= cooldown;
  }

  performKill(victimId: string): void {
    if (!this.canKill()) {
      throw new Error('Cannot kill - on cooldown or not impostor');
    }
    
    this.lastKillTime = Date.now();
    this.emit('kill', { victimId });
  }

  serialize(): any {
    return {
      id: this.id,
      name: this.name,
      position: this.position,
      velocity: this.velocity,
      alive: this.alive,
      role: this.role,
      color: this.color,
      tasksCompleted: this.tasksCompleted,
      isMoving: this.isMoving
    };
  }

  deserialize(data: any): void {
    this.position = data.position || this.position;
    this.velocity = data.velocity || this.velocity;
    this.alive = data.alive !== undefined ? data.alive : this.alive;
    this.isMoving = data.isMoving || false;
    this.tasksCompleted = data.tasksCompleted || 0;
  }
} 