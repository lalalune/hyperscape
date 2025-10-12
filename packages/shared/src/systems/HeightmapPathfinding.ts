/**
 * Heightmap-based Pathfinding System
 * 
 * Simple and efficient pathfinding that:
 * - Returns direct path on flat planes (no terrain)
 * - Uses 2D A* grid with heightmap gradient checking for terrain
 * - Blocks movement on steep slopes (high gradients)
 */

import THREE from '../extras/three';
import type { World } from '../types/index';
import { SystemBase } from './SystemBase';
import type { TerrainSystem } from './TerrainSystem';

const _v3_1 = new THREE.Vector3()
const _v3_2 = new THREE.Vector3()

interface GridNode {
  x: number;
  z: number;
  height: number;
  walkable: boolean;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost
  parent?: GridNode;
}

export class HeightmapPathfinding extends SystemBase {
  private gridResolution = 2.0; // 2 meter grid cells
  private readonly MAX_SLOPE = 30; // Maximum walkable slope in degrees
  private readonly MAX_PATH_LENGTH = 100; // Prevent infinite searches
  private terrainSystem: TerrainSystem | null = null;
  
  constructor(world: World) {
    super(world, {
      name: 'heightmap-pathfinding',
      dependencies: {
        optional: ['terrain']
      },
      autoCleanup: true
    });
  }
  
  async init(): Promise<void> {
    // Get terrain system if available
    this.terrainSystem = this.world.getSystem<TerrainSystem>('terrain') as TerrainSystem | null;
    
    if (!this.terrainSystem) {
      this.logger.info('No terrain system found - will use flat plane navigation');
    }
  }
  
  /**
   * Find path from start to end
   * Returns direct path on flat terrain, A* path on heightmap terrain
   */
  public findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    // If no terrain system, just return direct path (flat plane)
    if (!this.terrainSystem) {
      return [start.clone(), end.clone()];
    }
    
    // Check if direct path is possible (no steep slopes)
    if (this.isDirectPathWalkable(start, end)) {
      return [start.clone(), end.clone()];
    }
    
    // Use A* on heightmap grid
    return this.findPathAStar(start, end);
  }
  
  /**
   * Check if direct path is walkable (no steep slopes)
   */
  private isDirectPathWalkable(start: THREE.Vector3, end: THREE.Vector3): boolean {
    const distance = start.distanceTo(end);
    const steps = Math.ceil(distance / this.gridResolution);
    
    let prevHeight = this.getHeightAt(start.x, start.z);
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = _v3_1.copy(start).lerp(end, t);
      const height = this.getHeightAt(point.x, point.z);
      
      // Check slope between previous and current point
      const heightDiff = Math.abs(height - prevHeight);
      const horizontalDist = this.gridResolution;
      const slope = Math.atan(heightDiff / horizontalDist) * (180 / Math.PI);
      
      if (slope > this.MAX_SLOPE) {
        return false; // Path blocked by steep slope
      }
      
      prevHeight = height;
    }
    
    return true;
  }
  
  /**
   * A* pathfinding on heightmap grid
   */
  private findPathAStar(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    // Snap to grid
    const startGrid = this.worldToGrid(start);
    const endGrid = this.worldToGrid(end);
    
    // Initialize open and closed sets
    const openSet: GridNode[] = [];
    const closedSet = new Set<string>();
    
    // Create start node
    const startNode: GridNode = {
      x: startGrid.x,
      z: startGrid.z,
      height: this.getHeightAt(start.x, start.z),
      walkable: true,
      g: 0,
      h: this.heuristic(startGrid, endGrid),
      f: 0
    };
    startNode.f = startNode.g + startNode.h;
    
    openSet.push(startNode);
    
    let iterations = 0;
    
    while (openSet.length > 0 && iterations < this.MAX_PATH_LENGTH * 10) {
      iterations++;
      
      // Get node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      
      // Check if we reached the goal
      if (current.x === endGrid.x && current.z === endGrid.z) {
        return this.reconstructPath(current, start.y, end.y);
      }
      
      const key = `${current.x},${current.z}`;
      closedSet.add(key);
      
      // Check neighbors
      const neighbors = this.getNeighbors(current);
      
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.z}`;
        if (closedSet.has(neighborKey)) continue;
        
        // Check if walkable (slope check)
        if (!this.isWalkable(current, neighbor)) continue;
        
        const tentativeG = current.g + this.distance(current, neighbor);
        
        // Find existing node in open set
        const existingNode = openSet.find(n => n.x === neighbor.x && n.z === neighbor.z);
        
        if (!existingNode) {
          // New node
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, endGrid);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = current;
          openSet.push(neighbor);
        } else if (tentativeG < existingNode.g) {
          // Better path to existing node
          existingNode.g = tentativeG;
          existingNode.f = existingNode.g + existingNode.h;
          existingNode.parent = current;
        }
      }
    }
    
    // No path found, return direct path as fallback
    this.logger.warn('No path found, using direct path');
    return [start.clone(), end.clone()];
  }
  
  /**
   * Get height at world position from terrain or default to 0
   */
  private getHeightAt(x: number, z: number): number {
    if (!this.terrainSystem) return 0;
    
    // Try to get height from terrain system
    if (this.terrainSystem?.getHeightAt) {
      const height = this.terrainSystem.getHeightAt(x, z);
      return height ?? 0;
    }
    
    // Fallback: raycast down
    const origin = new THREE.Vector3(x, 100, z);
    const direction = new THREE.Vector3(0, -1, 0);
    const mask = this.world.createLayerMask('terrain', 'environment');
    const hit = this.world.raycast(origin, direction, 200, mask);
    
    return hit ? hit.point.y : 0;
  }
  
  /**
   * Convert world position to grid coordinates
   */
  private worldToGrid(pos: THREE.Vector3): { x: number; z: number } {
    return {
      x: Math.round(pos.x / this.gridResolution),
      z: Math.round(pos.z / this.gridResolution)
    };
  }
  
  /**
   * Convert grid coordinates to world position
   */
  private gridToWorld(gridX: number, gridZ: number, target: THREE.Vector3): THREE.Vector3 {
    const x = gridX * this.gridResolution;
    const z = gridZ * this.gridResolution;
    const y = this.getHeightAt(x, z);
    return target.set(x, y, z);
  }
  
  /**
   * Get neighboring grid cells
   */
  private getNeighbors(node: GridNode): GridNode[] {
    const neighbors: GridNode[] = [];
    const dirs = [
      { x: 0, z: 1 },   // North
      { x: 1, z: 0 },   // East
      { x: 0, z: -1 },  // South
      { x: -1, z: 0 },  // West
      { x: 1, z: 1 },   // NE
      { x: 1, z: -1 },  // SE
      { x: -1, z: -1 }, // SW
      { x: -1, z: 1 },  // NW
    ];
    
    for (const dir of dirs) {
      const x = node.x + dir.x;
      const z = node.z + dir.z;
      const worldPos = this.gridToWorld(x, z, _v3_1);
      
      neighbors.push({
        x,
        z,
        height: worldPos.y,
        walkable: true,
        g: 0,
        h: 0,
        f: 0
      });
    }
    
    return neighbors;
  }
  
  /**
   * Check if movement between two nodes is walkable (slope check)
   */
  private isWalkable(from: GridNode, to: GridNode): boolean {
    const heightDiff = Math.abs(to.height - from.height);
    const horizontalDist = this.distance(from, to) * this.gridResolution;
    
    if (horizontalDist === 0) return false;
    
    const slope = Math.atan(heightDiff / horizontalDist) * (180 / Math.PI);
    return slope <= this.MAX_SLOPE;
  }
  
  /**
   * Distance between two grid nodes
   */
  private distance(a: GridNode, b: GridNode): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  
  /**
   * Heuristic for A* (Manhattan distance on grid)
   */
  private heuristic(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.abs(b.x - a.x) + Math.abs(b.z - a.z);
  }
  
  /**
   * Reconstruct path from A* result
   */
  private reconstructPath(node: GridNode, startY: number, endY: number): THREE.Vector3[] {
    const path: THREE.Vector3[] = [];
    let current: GridNode | undefined = node;
    
    while (current) {
      const worldPos = this.gridToWorld(current.x, current.z, new THREE.Vector3());
      path.unshift(worldPos);
      current = current.parent;
    }
    
    // Adjust first and last points to exact positions
    if (path.length > 0) {
      path[0].y = startY;
      path[path.length - 1].y = endY;
    }
    
    // Optimize path by removing unnecessary waypoints
    return this.optimizePath(path);
  }
  
  /**
   * Remove unnecessary waypoints (keep only direction changes)
   */
  private optimizePath(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length <= 2) return path;
    
    const optimized: THREE.Vector3[] = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];
      
      // Calculate direction vectors
      const dir1 = _v3_1.subVectors(curr, prev).normalize();
      const dir2 = _v3_2.subVectors(next, curr).normalize();
      
      // Keep waypoint if direction changes significantly
      const dot = dir1.dot(dir2);
      if (dot < 0.99) { // ~8 degree tolerance
        optimized.push(curr);
      }
    }
    
    optimized.push(path[path.length - 1]);
    return optimized;
  }
}
