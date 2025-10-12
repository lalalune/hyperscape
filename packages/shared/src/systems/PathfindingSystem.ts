
/**
 * Pathfinding System
 * Simple, efficient pathfinding that uses line-of-sight with waypoint generation
 * Much cheaper than full A* while still handling most terrain obstacles
 */

import THREE, { toTHREEVector3 } from '../extras/three';
import type { World } from '../types/index';
import { EventType } from '../types/events';
import { PathRequest } from '../types/core';
import { getWorldScene, safeSceneAdd, safeSceneRemove } from '../utils/EntityUtils';
import { SystemBase } from './SystemBase';

const _v3_1 = new THREE.Vector3()

export class PathfindingSystem extends SystemBase {
  
  private raycaster = new THREE.Raycaster();
  private pendingRequests: PathRequest[] = [];
  
  // Pathfinding parameters
  private readonly STEP_HEIGHT = 0.5; // Max height difference player can step up
  private readonly PROBE_DISTANCE = 0.5; // Distance to probe around obstacles
  private readonly MAX_WAYPOINTS = 20; // Maximum waypoints in a path
  private readonly TERRAIN_LAYERS = ['terrain', 'ground', 'building', 'obstacle'];
  
  constructor(world: World) {
    super(world, {
      name: 'pathfinding',
      dependencies: {
        optional: ['client-graphics', 'world-generation']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Subscribe to pathfinding requests using type-safe event system
    this.subscribe(EventType.PATHFINDING_REQUEST, (data: { playerId: string; start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number }; callback: (path: THREE.Vector3[]) => void }) => this.requestPath(data));
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
    const startVec = new THREE.Vector3(data.start.x, data.start.y, data.start.z);
    const endVec = new THREE.Vector3(data.end.x, data.end.y, data.end.z);
    
    const request: PathRequest = {
      playerId: data.playerId,
      start: startVec,
      end: endVec,
      callback: (path: THREE.Vector3[]) => data.callback(path)
    };
    
    this.pendingRequests.push(request);
  }

  /**
   * Process pending path requests
   */
  update(_deltaTime: number): void {
    // Process one request per frame to avoid blocking
    if (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift()!;
      const path = this.findPath(request.start, request.end);
      request.callback(path);
    }
  }

  /**
   * Find a path using simple line-of-sight with obstacle avoidance
   * Made public for testing purposes
   */
  public findPath(
    start: THREE.Vector3 | { x: number; y: number; z: number },
    end: THREE.Vector3 | { x: number; y: number; z: number },
  ): THREE.Vector3[] {
    const startVec = toTHREEVector3(start)
    const endVec = toTHREEVector3(end)

    // First try direct path
    if (this.hasLineOfSight(startVec, endVec)) {
      return [startVec.clone(), endVec.clone()]
    }

    // If no direct path, use waypoint generation
    const waypoints = this.generateWaypoints(startVec, endVec)
    const path = this.optimizePath([startVec, ...waypoints, endVec])
    // Ensure returned path's last point is EXACTLY the requested end to avoid drift/backtracking
    if (path.length > 0) {
      path[path.length - 1].copy(endVec)
    }

    return path
  }

  /**
   * Get obstacles in the scene for pathfinding
   */
  private getObstacles(): THREE.Object3D[] {
    // Get obstacles from the scene - buildings, walls, etc.
    const obstacles: THREE.Object3D[] = [];
    
    // Try to get obstacles from the stage system
    const stage = this.world.getSystem('Stage');
    if (stage && 'scene' in stage && (stage as { scene?: THREE.Scene }).scene) {
      const scene = (stage as { scene?: THREE.Scene }).scene!;
      scene.traverse((obj: THREE.Object3D) => {
        // Check if object is an obstacle (has collision, is static, etc.)
        if (obj.userData?.isObstacle || obj.userData?.collision) {
          obstacles.push(obj);
        }
      });
    }
    
    return obstacles;
  }

  /**
   * Check if there's a clear line of sight between two points
   */
  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    
    // Use the Vector3 parameters directly
    const fromVec = from;
    const toVec = to;
    
    // Get terrain and obstacle objects
    const obstacles = this.getObstacles();
    if (obstacles.length === 0) return true;
    
    // Cast ray slightly above ground level to avoid minor terrain bumps
    const fromRay = _v3_1.copy(fromVec);
    fromRay.y += 0.3;
    const toRay = toVec.clone();
    toRay.y += 0.3;
    
    const direction = new THREE.Vector3().subVectors(toRay, fromRay);
    const distance = fromRay.distanceTo(toRay);
    
    // Skip raycast if points are too close
    if (distance < 0.001) return true;
    
    direction.normalize();
    
    const fromVector = fromRay.clone();
    const dirVector = direction.clone();
     
    // Prefer physics raycast for robust obstruction checks
    const hit = this.world.raycast(fromVector, dirVector, distance, this.world.createLayerMask('terrain', 'environment'));
    if (hit && hit.distance < distance - 0.1) {
      const point = hit.point;
      if (!this.isWalkable(point)) {
        return false;
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
    const up = _v3_1.set(0, 1, 0);
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
    // Use PhysX raycast downward to validate ground existence and slope
    const origin = point.clone();
    origin.y += 2;
    const dir = new THREE.Vector3(0, -1, 0);
    const hit = this.world.raycast(origin, dir, 5, this.world.createLayerMask('terrain', 'environment'));
    if (!hit) return false;
    const groundPoint = toTHREEVector3(hit.point);
    const groundHeight = groundPoint.y;
    if (Math.abs(groundHeight - point.y) > this.STEP_HEIGHT) return false;
    return this.isWalkable(groundPoint, hit.normal ? toTHREEVector3(hit.normal) : undefined);
  }

  /**
   * Get terrain height at a position
   */
  private getTerrainHeight(position: { x: number; y: number; z: number }): number {
    // Use PhysX raycast to query ground height
    const origin = new THREE.Vector3(position.x, 100, position.z);
    const dir = new THREE.Vector3(0, -1, 0);
    const hit = this.world.raycast(origin, dir, 200, this.world.createLayerMask('terrain', 'environment'));
    if (hit) return hit.point.y;
    return position.y;
  }

  /**
   * Check if a surface is walkable based on its normal
   */
  private isWalkable(point: THREE.Vector3 | { x: number; y: number; z: number }, normal?: THREE.Vector3 | { x: number; y: number; z: number }): boolean {
    // Check if point is on a valid surface
    if (!normal) return false;
    const slope = new THREE.Vector3(normal.x, normal.y, normal.z).angleTo(new THREE.Vector3(0, 1, 0));
    return slope < Math.PI / 4; // 45 degree slope limit
  }

  /**
   * Visualize path for debugging
   */
  debugDrawPath(path: THREE.Vector3[]): void {
    if (!this.world.isClient) return;
    const scene = getWorldScene(this.world);
    if (!scene || path.length < 2) return;
    
    // Create line geometry - convert to standard Vector3 points
    const standardPath = path.map(p => toTHREEVector3(p));
    const geometry = new THREE.BufferGeometry().setFromPoints(standardPath);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x00ff00,
      linewidth: 2 
    });
    
    const line = new THREE.Line(geometry, material);
    line.userData.debugPath = true;
    
    // Remove old debug paths
    const oldPaths = scene.children.filter(
      (child) => (child as unknown as THREE.Object3D).userData.debugPath
    ) as unknown as THREE.Object3D[];
    
    oldPaths.forEach((path) => safeSceneRemove(this.world, path as unknown as THREE.Object3D));
    
    // Add new path
    safeSceneAdd(this.world, line as unknown as THREE.Object3D);
    
    // Remove after 5 seconds
    setTimeout(() => {
      safeSceneRemove(this.world, line as unknown as THREE.Object3D);
    }, 5000);
  }

  destroy(): void {
    // Clear pending pathfinding requests
    this.pendingRequests.length = 0;
    
    // Call parent cleanup (handles event listeners automatically)
    super.destroy();
  }
} 