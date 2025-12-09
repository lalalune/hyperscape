/**
 * Pathfinding System
 *
 * Intelligent pathfinding that adapts to terrain complexity.
 *
 * Strategy Selection:
 *
 * 1. **Direct Path** (fastest)
 *    - If line-of-sight is clear and terrain is flat enough
 *    - Returns [start, end] with no intermediate waypoints
 *
 * 2. **Heightmap A*** (terrain-aware)
 *    - For complex terrain with slopes and elevation changes
 *    - Grid-based search with slope validation (<30° walkable)
 *    - Path optimization to remove redundant waypoints
 *
 * 3. **Obstacle Avoidance**
 *    - For scenes with collision objects but no heightmap
 *    - Generates waypoints around detected obstacles
 *    - Line-of-sight optimization between waypoints
 *
 * Features:
 * - Slope checking (blocks paths steeper than MAX_SLOPE)
 * - Grid-snapped A* for performance
 * - Path optimization (removes collinear waypoints)
 * - Configurable grid resolution (2m cells by default)
 * - Physics-based raycasting for obstacle detection
 * - Debug visualization (client-side only)
 */

import THREE, { toTHREEVector3 } from "../../../extras/three/three";
import type { World } from "../../../types/index";
import { EventType } from "../../../types/events";
import { PathRequest } from "../../../types/core/core";
import { SystemBase } from "..";
import type { TerrainSystem } from "..";

const _v3_1 = new THREE.Vector3();
const _v3_2 = new THREE.Vector3();

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

export class PathfindingSystem extends SystemBase {
  private raycaster = new THREE.Raycaster();
  private pendingRequests: PathRequest[] = [];
  private terrainSystem: TerrainSystem | null = null;

  // Grid-based pathfinding parameters
  private gridResolution = 2.0; // 2 meter grid cells
  private readonly MAX_SLOPE = 30; // Maximum walkable slope in degrees
  private readonly MAX_PATH_LENGTH = 100; // Prevent infinite searches

  // Line-of-sight pathfinding parameters
  private readonly STEP_HEIGHT = 0.5; // Max height difference player can step up
  private readonly PROBE_DISTANCE = 0.5; // Distance to probe around obstacles
  private readonly MAX_WAYPOINTS = 20; // Maximum waypoints in a path
  private readonly TERRAIN_LAYERS = [
    "terrain",
    "ground",
    "building",
    "obstacle",
  ];

  constructor(world: World) {
    super(world, {
      name: "pathfinding",
      dependencies: {
        optional: ["terrain", "client-graphics"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Get terrain system if available
    this.terrainSystem = this.world.getSystem<TerrainSystem>(
      "terrain",
    ) as TerrainSystem | null;

    if (!this.terrainSystem) {
      this.logger.info(
        "No terrain system found - will use flat plane navigation",
      );
    }

    // Subscribe to pathfinding requests using type-safe event system
    this.subscribe(
      EventType.PATHFINDING_REQUEST,
      (data: {
        playerId: string;
        start: { x: number; y: number; z: number };
        end: { x: number; y: number; z: number };
        callback: (path: THREE.Vector3[]) => void;
      }) => this.requestPath(data),
    );
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
    const startVec = new THREE.Vector3(
      data.start.x,
      data.start.y,
      data.start.z,
    );
    const endVec = new THREE.Vector3(data.end.x, data.end.y, data.end.z);

    const request: PathRequest = {
      playerId: data.playerId,
      start: startVec,
      end: endVec,
      callback: (path: THREE.Vector3[]) => data.callback(path),
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
   * Main pathfinding entry point - chooses best strategy
   * Made public for testing purposes
   */
  public findPath(
    start: THREE.Vector3 | { x: number; y: number; z: number },
    end: THREE.Vector3 | { x: number; y: number; z: number },
  ): THREE.Vector3[] {
    const startVec = toTHREEVector3(start);
    const endVec = toTHREEVector3(end);

    // Strategy 1: Try direct path first (fastest)
    if (
      this.hasLineOfSight(startVec, endVec) &&
      this.isDirectPathWalkable(startVec, endVec)
    ) {
      return [startVec.clone(), endVec.clone()];
    }

    if (this.terrainSystem) {
      return this.findPathAStar(startVec, endVec);
    }

    const waypoints = this.generateWaypoints(startVec, endVec);
    const path = this.optimizePath([startVec, ...waypoints, endVec]);

    // Ensure returned path's last point is EXACTLY the requested end to avoid drift/backtracking
    if (path.length > 0) {
      path[path.length - 1].copy(endVec);
    }

    return path;
  }

  // ============================================================================
  // HEIGHTMAP A* PATHFINDING (Strategy 2)
  // ============================================================================

  /**
   * Check if direct path is walkable (no steep slopes)
   */
  private isDirectPathWalkable(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): boolean {
    if (!this.terrainSystem) return true; // No terrain = flat plane

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
  private findPathAStar(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): THREE.Vector3[] {
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
      f: 0,
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
        if (!this.isGridWalkable(current, neighbor)) continue;

        const tentativeG = current.g + this.gridDistance(current, neighbor);

        // Find existing node in open set
        const existingNode = openSet.find(
          (n) => n.x === neighbor.x && n.z === neighbor.z,
        );

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

    this.logger.warn("No A* path found, using direct path");
    return [start.clone(), end.clone()];
  }

  /**
   * Reconstruct path from A* result
   */
  private reconstructPath(
    node: GridNode,
    startY: number,
    endY: number,
  ): THREE.Vector3[] {
    const path: THREE.Vector3[] = [];
    let current: GridNode | undefined = node;

    while (current) {
      const worldPos = this.gridToWorld(
        current.x,
        current.z,
        new THREE.Vector3(),
      );
      path.unshift(worldPos);
      current = current.parent;
    }

    // Adjust first and last points to exact positions
    if (path.length > 0) {
      path[0].y = startY;
      path[path.length - 1].y = endY;
    }

    // Optimize path by removing unnecessary waypoints
    return this.optimizePathGrid(path);
  }

  /**
   * Get neighboring grid cells (8-directional)
   */
  private getNeighbors(node: GridNode): GridNode[] {
    const neighbors: GridNode[] = [];
    const dirs = [
      { x: 0, z: 1 }, // North
      { x: 1, z: 0 }, // East
      { x: 0, z: -1 }, // South
      { x: -1, z: 0 }, // West
      { x: 1, z: 1 }, // NE
      { x: 1, z: -1 }, // SE
      { x: -1, z: -1 }, // SW
      { x: -1, z: 1 }, // NW
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
        f: 0,
      });
    }

    return neighbors;
  }

  /**
   * Check if movement between two grid nodes is walkable (slope check)
   */
  private isGridWalkable(from: GridNode, to: GridNode): boolean {
    const heightDiff = Math.abs(to.height - from.height);
    const horizontalDist = this.gridDistance(from, to) * this.gridResolution;

    if (horizontalDist === 0) return false;

    const slope = Math.atan(heightDiff / horizontalDist) * (180 / Math.PI);
    return slope <= this.MAX_SLOPE;
  }

  /**
   * Convert world position to grid coordinates
   */
  private worldToGrid(pos: THREE.Vector3): { x: number; z: number } {
    return {
      x: Math.round(pos.x / this.gridResolution),
      z: Math.round(pos.z / this.gridResolution),
    };
  }

  /**
   * Convert grid coordinates to world position
   */
  private gridToWorld(
    gridX: number,
    gridZ: number,
    target: THREE.Vector3,
  ): THREE.Vector3 {
    const x = gridX * this.gridResolution;
    const z = gridZ * this.gridResolution;
    const y = this.getHeightAt(x, z);
    return target.set(x, y, z);
  }

  /**
   * Distance between two grid nodes
   */
  private gridDistance(a: GridNode, b: GridNode): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Heuristic for A* (Manhattan distance on grid)
   */
  private heuristic(
    a: { x: number; z: number },
    b: { x: number; z: number },
  ): number {
    return Math.abs(b.x - a.x) + Math.abs(b.z - a.z);
  }

  /**
   * Remove unnecessary waypoints from grid path (keep only direction changes)
   */
  private optimizePathGrid(path: THREE.Vector3[]): THREE.Vector3[] {
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
      if (dot < 0.99) {
        // ~8 degree tolerance
        optimized.push(curr);
      }
    }

    optimized.push(path[path.length - 1]);
    return optimized;
  }

  // ============================================================================
  // LINE-OF-SIGHT & OBSTACLE AVOIDANCE (Strategy 3)
  // ============================================================================

  /**
   * Get obstacles in the scene for pathfinding
   */
  private getObstacles(): THREE.Object3D[] {
    // Get obstacles from the scene - buildings, walls, etc.
    const obstacles: THREE.Object3D[] = [];

    // Try to get obstacles from the stage system
    const stage = this.world.getSystem("Stage");
    if (stage && "scene" in stage && (stage as { scene?: THREE.Scene }).scene) {
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
    const hit = this.world.raycast(
      fromVector,
      dirVector,
      distance,
      this.world.createLayerMask("terrain", "environment"),
    );
    if (hit && hit.distance < distance - 0.1) {
      const point = hit.point;
      if (
        !this.isWalkablePoint(
          point,
          hit.normal ? toTHREEVector3(hit.normal) : undefined,
        )
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate waypoints around obstacles
   */
  private generateWaypoints(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): THREE.Vector3[] {
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
        const avoidanceWaypoints = this.generateAvoidanceWaypoints(
          checkPoint,
          direction,
        );
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
  private generateAvoidanceWaypoints(
    obstaclePoint: THREE.Vector3,
    moveDirection: THREE.Vector3,
  ): THREE.Vector3[] {
    const waypoints: THREE.Vector3[] = [];

    // Calculate perpendicular directions (left and right)
    const up = _v3_1.set(0, 1, 0);
    const leftDir = new THREE.Vector3()
      .crossVectors(up, moveDirection)
      .normalize();
    const rightDir = leftDir.clone().negate();

    // Try to find clear points to the left and right
    const probeDistances = [2, 4, 6]; // Try different distances

    for (const distance of probeDistances) {
      const leftPoint = obstaclePoint
        .clone()
        .addScaledVector(leftDir, distance);
      const rightPoint = obstaclePoint
        .clone()
        .addScaledVector(rightDir, distance);

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
   * Optimize path by removing unnecessary waypoints (line-of-sight)
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

  // ============================================================================
  // TERRAIN HEIGHT & WALKABILITY HELPERS
  // ============================================================================

  /**
   * Get height at world position from terrain system or raycast
   */
  private getHeightAt(x: number, z: number): number {
    if (!this.terrainSystem) return 0;

    // Try terrain system first
    if (this.terrainSystem?.getHeightAt) {
      const height = this.terrainSystem.getHeightAt(x, z);
      return height ?? 0;
    }

    const origin = new THREE.Vector3(x, 100, z);
    const direction = new THREE.Vector3(0, -1, 0);
    const mask = this.world.createLayerMask("terrain", "environment");
    const hit = this.world.raycast(origin, direction, 200, mask);

    return hit ? hit.point.y : 0;
  }

  /**
   * Check if a point is walkable (raycast validation)
   */
  private isPointWalkable(point: THREE.Vector3): boolean {
    // Use PhysX raycast downward to validate ground existence and slope
    const origin = point.clone();
    origin.y += 2;
    const dir = new THREE.Vector3(0, -1, 0);
    const hit = this.world.raycast(
      origin,
      dir,
      5,
      this.world.createLayerMask("terrain", "environment"),
    );
    if (!hit) return false;

    const groundPoint = toTHREEVector3(hit.point);
    const groundHeight = groundPoint.y;
    if (Math.abs(groundHeight - point.y) > this.STEP_HEIGHT) return false;

    return this.isWalkablePoint(
      groundPoint,
      hit.normal ? toTHREEVector3(hit.normal) : undefined,
    );
  }

  private getTerrainHeight(position: {
    x: number;
    y: number;
    z: number;
  }): number {
    // Try terrain system first
    if (this.terrainSystem?.getHeightAt) {
      const height = this.terrainSystem.getHeightAt(position.x, position.z);
      if (height !== null && height !== undefined) return height;
    }

    // Use PhysX raycast to query ground height
    const origin = new THREE.Vector3(position.x, 100, position.z);
    const dir = new THREE.Vector3(0, -1, 0);
    const hit = this.world.raycast(
      origin,
      dir,
      200,
      this.world.createLayerMask("terrain", "environment"),
    );
    if (hit) return hit.point.y;
    return position.y;
  }

  /**
   * Check if a surface is walkable based on its normal
   */
  private isWalkablePoint(
    point: THREE.Vector3 | { x: number; y: number; z: number },
    normal?: THREE.Vector3 | { x: number; y: number; z: number },
  ): boolean {
    // Check if point is on a valid surface
    if (!normal) return false;
    const slope = new THREE.Vector3(normal.x, normal.y, normal.z).angleTo(
      new THREE.Vector3(0, 1, 0),
    );
    return slope < Math.PI / 4; // 45 degree slope limit
  }

  // ============================================================================
  // DEBUG VISUALIZATION
  // ============================================================================

  /**
   * Visualize path for debugging
   */
  debugDrawPath(path: THREE.Vector3[]): void {
    if (!this.world.isClient || path.length < 2) return;

    const scene = this.world.stage.scene;

    // Create line geometry - convert to standard Vector3 points
    const standardPath = path.map((p) => toTHREEVector3(p));
    const geometry = new THREE.BufferGeometry().setFromPoints(standardPath);
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
    });

    const line = new THREE.Line(geometry, material);
    line.userData.debugPath = true;

    // Remove old debug paths
    const oldPaths = scene.children.filter(
      (child) => (child as unknown as THREE.Object3D).userData.debugPath,
    ) as unknown as THREE.Object3D[];

    oldPaths.forEach((path) => scene.remove(path as unknown as THREE.Object3D));

    // Add new path
    scene.add(line as unknown as THREE.Object3D);

    // Remove after 5 seconds
    setTimeout(() => {
      scene.remove(line as unknown as THREE.Object3D);
    }, 5000);
  }

  destroy(): void {
    // Clear pending pathfinding requests
    this.pendingRequests.length = 0;

    // Call parent cleanup (handles event listeners automatically)
    super.destroy();
  }
}
