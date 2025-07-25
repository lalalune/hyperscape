/**
 * RPG Pathfinding System
 * Simple, efficient pathfinding that uses line-of-sight with waypoint generation
 * Much cheaper than full A* while still handling most terrain obstacles
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

interface Waypoint {
  position: THREE.Vector3;
  isCorner?: boolean;
}

interface PathRequest {
  playerId: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  callback: (path: THREE.Vector3[]) => void;
}

export class RPGPathfindingSystem extends System {
  private raycaster = new THREE.Raycaster();
  private pendingRequests: PathRequest[] = [];
  
  // Pathfinding parameters
  private readonly STEP_HEIGHT = 0.5; // Max height difference player can step up
  private readonly PROBE_DISTANCE = 0.5; // Distance to probe around obstacles
  private readonly MAX_WAYPOINTS = 20; // Maximum waypoints in a path
  private readonly TERRAIN_LAYERS = ['terrain', 'ground', 'building', 'obstacle'];
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGPathfindingSystem] Initializing pathfinding system...');
    
    // Listen for pathfinding requests
    this.world.on('rpg:pathfinding:request', this.requestPath.bind(this));
    
    console.log('[RPGPathfindingSystem] Pathfinding system initialized');
  }

  /**
   * Request a path from start to end position
   */
  private requestPath(data: {
    playerId: string;
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    callback: (path: THREE.Vector3[]) => void;
  }): void {
    const request: PathRequest = {
      playerId: data.playerId,
      start: new THREE.Vector3(data.start.x, data.start.y, data.start.z),
      end: new THREE.Vector3(data.end.x, data.end.y, data.end.z),
      callback: data.callback
    };
    
    this.pendingRequests.push(request);
  }

  /**
   * Process pending path requests
   */
  update(deltaTime: number): void {
    // Process one request per frame to avoid blocking
    if (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift()!;
      const path = this.findPath(request.start, request.end);
      request.callback(path);
    }
  }

  /**
   * Find a path using simple line-of-sight with obstacle avoidance
   */
  private findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    // First try direct path
    if (this.hasLineOfSight(start, end)) {
      return [start.clone(), end.clone()];
    }
    
    // If no direct path, use waypoint generation
    const waypoints = this.generateWaypoints(start, end);
    const path = this.optimizePath([start, ...waypoints, end]);
    
    return path;
  }

  /**
   * Check if there's a clear line of sight between two points
   */
  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    // Get terrain and obstacle objects
    const obstacles = this.getObstacles();
    if (obstacles.length === 0) return true;
    
    // Cast ray slightly above ground level to avoid minor terrain bumps
    const fromRay = from.clone();
    fromRay.y += 0.3;
    const toRay = to.clone();
    toRay.y += 0.3;
    
    const direction = new THREE.Vector3().subVectors(toRay, fromRay).normalize();
    const distance = fromRay.distanceTo(toRay);
    
    this.raycaster.set(fromRay, direction);
    this.raycaster.far = distance;
    
    const intersects = this.raycaster.intersectObjects(obstacles, true);
    
    // Check if any intersections block the path
    for (const hit of intersects) {
      if (hit.distance < distance - 0.1) {
        // Check if this is a walkable slope
        if (!this.isWalkable(hit.point as any, hit.face?.normal as any)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Generate waypoints around obstacles
   */
  private generateWaypoints(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    const waypoints: THREE.Vector3[] = [];
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const distance = start.distanceTo(end);
    
    // Step along the direct path and find obstacles
    const stepSize = 2.0; // Check every 2 meters
    const steps = Math.ceil(distance / stepSize);
    
    for (let i = 1; i < steps; i++) {
      const checkPoint = start.clone().addScaledVector(direction, i * stepSize);
      
      // If this point is blocked, generate waypoints around it
      if (!this.isPointWalkable(checkPoint)) {
        const avoidanceWaypoints = this.generateAvoidanceWaypoints(checkPoint, direction);
        waypoints.push(...avoidanceWaypoints);
        
        // Skip ahead to avoid generating too many waypoints
        i += 2;
      }
    }
    
    // Limit waypoints
    if (waypoints.length > this.MAX_WAYPOINTS) {
      // Keep only every Nth waypoint to stay under limit
      const keepEvery = Math.ceil(waypoints.length / this.MAX_WAYPOINTS);
      return waypoints.filter((_, index) => index % keepEvery === 0);
    }
    
    return waypoints;
  }

  /**
   * Generate waypoints to avoid an obstacle at a given point
   */
  private generateAvoidanceWaypoints(obstaclePoint: THREE.Vector3, moveDirection: THREE.Vector3): THREE.Vector3[] {
    const waypoints: THREE.Vector3[] = [];
    
    // Calculate perpendicular directions (left and right)
    const up = new THREE.Vector3(0, 1, 0);
    const leftDir = new THREE.Vector3().crossVectors(up, moveDirection).normalize();
    const rightDir = leftDir.clone().negate();
    
    // Try to find clear points to the left and right
    const probeDistances = [2, 4, 6]; // Try different distances
    
    for (const distance of probeDistances) {
      const leftPoint = obstaclePoint.clone().addScaledVector(leftDir, distance);
      const rightPoint = obstaclePoint.clone().addScaledVector(rightDir, distance);
      
      // Adjust height to terrain
      leftPoint.y = this.getTerrainHeight(leftPoint) + 0.1;
      rightPoint.y = this.getTerrainHeight(rightPoint) + 0.1;
      
      // Check which side is clearer
      const leftClear = this.isPointWalkable(leftPoint);
      const rightClear = this.isPointWalkable(rightPoint);
      
      if (leftClear || rightClear) {
        // Choose the clearer side, or the closer one if both are clear
        if (leftClear && !rightClear) {
          waypoints.push(leftPoint);
        } else if (rightClear && !leftClear) {
          waypoints.push(rightPoint);
        } else {
          // Both clear, choose shorter detour
          const leftDetour = leftPoint.distanceTo(obstaclePoint);
          const rightDetour = rightPoint.distanceTo(obstaclePoint);
          waypoints.push(leftDetour < rightDetour ? leftPoint : rightPoint);
        }
        break;
      }
    }
    
    return waypoints;
  }

  /**
   * Optimize path by removing unnecessary waypoints
   */
  private optimizePath(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length <= 2) return path;
    
    const optimized: THREE.Vector3[] = [path[0]];
    let current = 0;
    
    while (current < path.length - 1) {
      // Find the furthest point we can reach with line of sight
      let furthest = current + 1;
      
      for (let i = current + 2; i < path.length; i++) {
        if (this.hasLineOfSight(path[current], path[i])) {
          furthest = i;
        }
      }
      
      optimized.push(path[furthest]);
      current = furthest;
    }
    
    return optimized;
  }

  /**
   * Check if a point is walkable
   */
  private isPointWalkable(point: THREE.Vector3): boolean {
    const obstacles = this.getObstacles();
    
    // Cast ray downward to check if there's ground
    const rayStart = point.clone();
    rayStart.y += 2; // Start above expected terrain
    
    this.raycaster.set(rayStart, new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 5;
    
    const hits = this.raycaster.intersectObjects(obstacles, true);
    
    if (hits.length === 0) return false; // No ground
    
    const ground = hits[0];
    const groundHeight = ground.point.y;
    
    // Check if the height difference is walkable
    if (Math.abs(groundHeight - point.y) > this.STEP_HEIGHT) {
      return false;
    }
    
    // Check if the surface is too steep
    return this.isWalkable(ground.point as any, ground.face?.normal as any);
  }

  /**
   * Get terrain height at a position
   */
  private getTerrainHeight(position: THREE.Vector3): number {
    const obstacles = this.getObstacles();
    
    const rayStart = position.clone();
    rayStart.y = 100; // Start high above terrain
    
    this.raycaster.set(rayStart, new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 200;
    
    const hits = this.raycaster.intersectObjects(obstacles, true);
    
    if (hits.length > 0) {
      return hits[0].point.y;
    }
    
    return position.y; // Fallback to input height
  }

  /**
   * Check if a surface is walkable based on its normal
   */
  private isWalkable(point: THREE.Vector3, normal?: THREE.Vector3): boolean {
    if (!normal) return true;
    
    // Calculate slope angle
    const up = new THREE.Vector3(0, 1, 0);
    const angle = Math.acos(normal.dot(up));
    const maxSlope = Math.PI * 0.25; // 45 degrees
    
    return angle < maxSlope;
  }

  /**
   * Get all obstacle objects in the world
   */
  private getObstacles(): THREE.Object3D[] {
    if (!this.world.stage?.scene) return [];
    
    return this.world.stage.scene.children.filter((child: any) => {
      const userData = child.userData;
      return (
        userData?.collision === true ||
        this.TERRAIN_LAYERS.includes(userData?.type) ||
        userData?.isObstacle === true
      );
    });
  }

  /**
   * Visualize path for debugging
   */
  debugDrawPath(path: THREE.Vector3[]): void {
    if (!this.world.stage?.scene || path.length < 2) return;
    
    // Create line geometry
    const geometry = new THREE.BufferGeometry().setFromPoints(path);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x00ff00,
      linewidth: 2 
    });
    
    const line = new THREE.Line(geometry, material);
    line.userData.debugPath = true;
    
    // Remove old debug paths
    const oldPaths = this.world.stage.scene.children.filter(
      (child: any) => child.userData.debugPath
    );
    oldPaths.forEach((path: any) => this.world.stage.scene.remove(path));
    
    // Add new path
    this.world.stage.scene.add(line);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (this.world.stage?.scene) {
        this.world.stage.scene.remove(line);
      }
    }, 5000);
  }

  destroy(): void {
    this.pendingRequests = [];
    console.log('[RPGPathfindingSystem] System destroyed');
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