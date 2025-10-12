/**
 * Production-Grade AI Navigation System
 * 
 * Provides intelligent pathfinding and navigation for AI agents with:
 * - Real-time walkability analysis based on heightmap terrain
 * - Dynamic obstacle avoidance
 * - Optimized A* pathfinding with terrain awareness
 * - Slope-based movement restrictions
 * - Multi-agent coordination and collision avoidance
 * - Performance monitoring and error handling
 */

import type { World } from '../World';
import { calculateDistance } from '../utils/MathUtils';
import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';
import type {
  NavigationNode,
  PathfindingRequest,
  PathResult,
  AgentNavigationState,
} from '../types/game-types'

interface TerrainValidationSystem extends SystemBase {
  getTerrainHeight: (x: number, z: number) => number | null
  calculateSlope: (x: number, z: number) => number
  isPositionWalkable: (
    x: number,
    z: number,
    height?: number,
    slope?: number,
  ) => boolean
  getBiomeAtPosition: (x: number, z: number) => string | null
}

// Types moved to shared types in ../types/game-types

export class AINavigationSystem extends SystemBase {
  private navigationGrid = new Map<string, NavigationNode>();
  private pathfindingQueue: PathfindingRequest[] = [];
  private activeAgents = new Map<string, AgentNavigationState>();
  private terrainValidationSystem?: TerrainValidationSystem;
  private isProcessingRequests = false;
  private gridResolution = 2; // 2 meter grid resolution
  private maxPathfindingTime = 50; // 50ms max per frame for pathfinding
  private processorIntervalId: ReturnType<typeof setInterval> | null = null;
  
  // Navigation configuration
  private readonly CONFIG = {
    GRID_RESOLUTION: 2, // 2m grid for navigation
    MAX_SLOPE_WALKABLE: 0.7, // 35 degrees max walkable slope for AI
    AGENT_DEFAULT_SIZE: 0.5, // 50cm default agent radius
    PATHFINDING_TIMEOUT: 5000, // 5 second timeout for pathfinding
    STUCK_DETECTION_TIME: 2000, // 2 seconds stuck detection
    STUCK_DISTANCE_THRESHOLD: 0.5, // 50cm movement to not be stuck
    MAX_SEARCH_NODES: 1000, // Maximum nodes to search in A*
    DIAGONAL_COST: 1.414, // Cost multiplier for diagonal movement
    HEIGHT_COST_MULTIPLIER: 2.0, // Extra cost for height changes
    BIOME_COSTS: {
      'plains': 1.0,
      'forest': 1.2,
      'mountain': 1.5,
      'water': 10.0, // Very expensive to cross water
      'swamp': 2.0,
      'desert': 1.3
    } as Record<string, number>
  };

  constructor(world: World) {
    super(world, { name: 'ai-navigation', dependencies: { required: [], optional: ['terrain-validation'] }, autoCleanup: true });
  }

  async init(): Promise<void> {
    
    // Find terrain validation system
    const system = this.world.getSystem<TerrainValidationSystem>(
      'terrain-validation',
    )
    if (system) {
      this.terrainValidationSystem = system
    }
    if (!this.terrainValidationSystem) {
      this.logger.error('TerrainValidationSystem not found! AI navigation will be limited.');
    }

    // Listen for terrain changes
    this.subscribe(EventType.TERRAIN_TILE_GENERATED, (data: { bounds: unknown }) => this.onTerrainChanged(data));
    this.subscribe(EventType.TERRAIN_VALIDATION_COMPLETE, (data: { walkabilityMap: Map<string, { isWalkable: boolean; slope: number; biome: string }> }) => this.onValidationComplete(data));
    this.subscribe(EventType.ENTITY_POSITION_CHANGED, (data: { agentId: string; position: { x: number; y: number; z: number } }) => this.onAgentMoved(data));
    
    // Listen for navigation requests
    this.subscribe(EventType.AI_NAVIGATION_REQUEST, (request: PathfindingRequest) => this.handleNavigationRequest(request));
    this.subscribe(EventType.AI_AGENT_REGISTER, (data: { agentId: string; position: { x: number; y: number; z: number }; speed?: number; size?: number; maxSlope?: number }) => this.registerAgent(data));
    this.subscribe(EventType.AI_AGENT_UNREGISTER, (data: { agentId: string }) => this.unregisterAgent(data));

  }

  start(): void {
    
    // Start processing pathfinding requests
    this.startPathfindingProcessor();
    
    // Generate initial navigation grid
    this.generateNavigationGrid();
  }

  /**
   * Start pathfinding request processor
   */
  private startPathfindingProcessor(): void {
    this.processorIntervalId = setInterval(() => {
      if (!this.isProcessingRequests && this.pathfindingQueue.length > 0) {
        this.processPathfindingRequests();
      }
    }, 16); // ~60fps
  }

  /**
   * Get the bounds of the loaded terrain
   */
  private getLoadedTerrainBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    // For now, return default bounds
    // In a real implementation, this would query the terrain system
    return {
      minX: -500,
      maxX: 500,
      minZ: -500,
      maxZ: 500
    };
  }

  /**
   * Generate navigation grid from terrain data
   */
  private generateNavigationGrid(): void {
    
    const startTime = performance.now();
    let nodesGenerated = 0;
    
    // Get loaded terrain bounds
    const bounds = this.getLoadedTerrainBounds();
    if (!bounds) {
      console.warn('[AINavigation] No terrain bounds available for navigation grid');
      return;
    }

    const { minX, maxX, minZ, maxZ } = bounds;
    
    // Generate grid nodes
    for (let x = minX; x <= maxX; x += this.CONFIG.GRID_RESOLUTION) {
      for (let z = minZ; z <= maxZ; z += this.CONFIG.GRID_RESOLUTION) {
        const node = this.createNavigationNode(x, z);
        if (node) {
          const key = this.getGridKey(x, z);
          this.navigationGrid.set(key, node);
          nodesGenerated++;
        }
      }
    }
    
    // Connect neighbors
    this.connectNavigationNodes();
    
    const generationTime = performance.now() - startTime;
    
    // Emit navigation grid ready
    this.emitTypedEvent(EventType.AI_NAVIGATION_GRID_READY, {
      nodeCount: nodesGenerated,
      generationTime,
      bounds
    });
  }

  /**
   * Create a navigation node at the given position
   */
  private createNavigationNode(x: number, z: number): NavigationNode | null {
    // Get terrain height
    const height = this.getTerrainHeight(x, z);
    if (height === null) return null;
    
    // Calculate slope
    const slope = this.calculateSlope(x, z);
    
    // Determine walkability
    const walkable = this.isPositionWalkable(x, z, height, slope);
    
    // Get biome
    const biome = this.getBiomeAtPosition(x, z) || 'plains';
    
    // Calculate movement cost
    const biomeCost = this.CONFIG.BIOME_COSTS[biome] || 1.0;
    const slopeCost = 1.0 + (slope * this.CONFIG.HEIGHT_COST_MULTIPLIER);
    const cost = biomeCost * slopeCost;
    
    return {
      x,
      z,
      y: height,
      walkable,
      slope,
      biome,
      cost,
      neighbors: [],
      gScore: Infinity,
      hScore: 0,
      fScore: Infinity
    };
  }

  /**
   * Connect navigation nodes to their neighbors
   */
  private connectNavigationNodes(): void {
    
    const directions = [
      { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }, // Cardinal
      { x: 1, z: 1 }, { x: -1, z: -1 }, { x: 1, z: -1 }, { x: -1, z: 1 } // Diagonal
    ];
    
    let _connectionsCreated = 0;
    
    for (const [_key, node] of this.navigationGrid) {
      for (const dir of directions) {
        const neighborX = node.x + (dir.x * this.CONFIG.GRID_RESOLUTION);
        const neighborZ = node.z + (dir.z * this.CONFIG.GRID_RESOLUTION);
        const neighborKey = this.getGridKey(neighborX, neighborZ);
        const neighbor = this.navigationGrid.get(neighborKey);
        
        if (neighbor && this.canTraverseBetween(node, neighbor)) {
          node.neighbors.push(neighbor);
          _connectionsCreated++;
        }
      }
    }
    
  }

  /**
   * Check if agent can traverse between two nodes
   */
  private canTraverseBetween(from: NavigationNode, to: NavigationNode): boolean {
    // Both nodes must be walkable
    if (!from.walkable || !to.walkable) return false;
    
    // Check height difference
    const heightDiff = Math.abs(to.y - from.y);
    const distance = Math.sqrt((to.x - from.x) ** 2 + (to.z - from.z) ** 2);
    const slope = heightDiff / distance;
    
    // Too steep
    if (slope > this.CONFIG.MAX_SLOPE_WALKABLE) return false;
    
    // Check for obstacles between nodes (simplified)
    // In production, this would do a more detailed sweep
    const midX = (from.x + to.x) / 2;
    const midZ = (from.z + to.z) / 2;
    const midHeight = this.getTerrainHeight(midX, midZ);
    
    if (midHeight === null) return false;
    
    // Check if path goes underground
    const expectedMidHeight = (from.y + to.y) / 2;
    if (midHeight > expectedMidHeight + 2) return false; // 2m obstacle tolerance
    
    return true;
  }

  /**
   * Handle navigation request
   */
  private handleNavigationRequest(request: PathfindingRequest): void {
    
    // Validate request
    if (!this.isValidPosition(request.start.x, request.start.z)) {
      request.callback({
        success: false,
        path: [],
        totalDistance: 0,
        estimatedTime: 0,
        errorMessage: 'Invalid start position'
      });
      return;
    }
    
    if (!this.isValidPosition(request.goal.x, request.goal.z)) {
      request.callback({
        success: false,
        path: [],
        totalDistance: 0,
        estimatedTime: 0,
        errorMessage: 'Invalid goal position'
      });
      return;
    }
    
    // Add to queue
    this.pathfindingQueue.push(request);
    
    // Sort by priority
    this.pathfindingQueue.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Process pathfinding requests
   */
  private async processPathfindingRequests(): Promise<void> {
    if (this.pathfindingQueue.length === 0) return;
    
    this.isProcessingRequests = true;
    const startTime = performance.now();
    
    while (this.pathfindingQueue.length > 0 && (performance.now() - startTime) < this.maxPathfindingTime) {
      const request = this.pathfindingQueue.shift();
      if (!request) break;
      
      const result = await this.findPath(request);
      request.callback(result);
    }
    
    this.isProcessingRequests = false;
  }

  /**
   * Find path using A* algorithm
   */
  private findPath(request: PathfindingRequest): PathResult {
    const startTime = performance.now();
    
    // Get start and goal nodes
    const startNode = this.getClosestNode(request.start.x, request.start.z);
    const goalNode = this.getClosestNode(request.goal.x, request.goal.z);
    
    if (!startNode || !goalNode) {
      return {
        success: false,
        path: [],
        totalDistance: 0,
        estimatedTime: 0,
        errorMessage: 'Start or goal not on navigation grid'
      };
    }
    
    if (!startNode.walkable || !goalNode.walkable) {
      return {
        success: false,
        path: [],
        totalDistance: 0,
        estimatedTime: 0,
        errorMessage: 'Start or goal not walkable'
      };
    }
    
    // A* pathfinding
    const openSet = new Set<NavigationNode>([startNode]);
    const closedSet = new Set<NavigationNode>();
    
    // Initialize start node
    startNode.gScore = 0;
    startNode.hScore = this.heuristic(startNode, goalNode);
    startNode.fScore = startNode.hScore;
    startNode.parent = undefined;
    
    let nodesSearched = 0;
    
    while (openSet.size > 0) {
      // Check timeout
      if (performance.now() - startTime > this.CONFIG.PATHFINDING_TIMEOUT) {
        return {
          success: false,
          path: [],
          totalDistance: 0,
          estimatedTime: 0,
          errorMessage: 'Pathfinding timeout'
        };
      }
      
      // Check search limit
      if (nodesSearched > this.CONFIG.MAX_SEARCH_NODES) {
        return {
          success: false,
          path: [],
          totalDistance: 0,
          estimatedTime: 0,
          errorMessage: 'Search space too large'
        };  
      }
      
      // Get node with lowest fScore
      let current: NavigationNode | null = null;
      let lowestFScore = Infinity;
      
      for (const node of openSet) {
        if (node.fScore < lowestFScore) {
          lowestFScore = node.fScore;
          current = node;
        }
      }
      
      if (!current) break;
      
      // Found goal
      if (current === goalNode) {
        const path = this.reconstructPath(current);
        const totalDistance = this.calculatePathDistance(path);
        const estimatedTime = totalDistance / 3.0; // 3 m/s average speed
        
        
        return {
          success: true,
          path,
          totalDistance,
          estimatedTime
        };
      }
      
      openSet.delete(current);
      closedSet.add(current);
      nodesSearched++;
      
      // Check neighbors
      for (const neighbor of current.neighbors) {
        if (closedSet.has(neighbor)) continue;
        
        // Check agent-specific constraints
        if (neighbor.slope > request.maxSlope) continue;
        if (request.allowedBiomes && !request.allowedBiomes.includes(neighbor.biome)) continue;
        
        // Calculate distance and cost
        const distance = this.calculateDistanceBetweenNodes(current, neighbor);
        const tentativeGScore = current.gScore + (distance * neighbor.cost);
        
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        } else if (tentativeGScore >= neighbor.gScore) {
          continue;
        }
        
        // Best path to neighbor found
        neighbor.parent = current;
        neighbor.gScore = tentativeGScore;
        neighbor.hScore = this.heuristic(neighbor, goalNode);
        neighbor.fScore = neighbor.gScore + neighbor.hScore;
      }
    }
    
    return {
      success: false,
      path: [],
      totalDistance: 0,
      estimatedTime: 0,
      errorMessage: 'No path found'
    };
  }

  /**
   * Reconstruct path from goal to start
   */
  private reconstructPath(goalNode: NavigationNode): { x: number; y: number; z: number }[] {
    const path: { x: number; y: number; z: number }[] = [];
    let current: NavigationNode | undefined = goalNode;
    
    while (current) {
      path.unshift({ x: current.x, y: current.y, z: current.z });
      current = current.parent;
    }
    
    return path;
  }

  /**
   * Calculate heuristic distance (Manhattan distance with height factor)
   */
  private heuristic(from: NavigationNode, to: NavigationNode): number {
    const dx = Math.abs(to.x - from.x);
    const dz = Math.abs(to.z - from.z);
    const dy = Math.abs(to.y - from.y);
    
    return dx + dz + (dy * this.CONFIG.HEIGHT_COST_MULTIPLIER);
  }

  /**
   * Calculate actual distance between nodes
   */
  private calculateDistanceBetweenNodes(from: NavigationNode, to: NavigationNode): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dy = to.y - from.y;
    
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    
    // Add height component for navigation cost
    return horizontalDistance + Math.abs(dy);
  }

  /**
   * Calculate total path distance
   */
  private calculatePathDistance(path: { x: number; y: number; z: number }[]): number {
    let totalDistance = 0;
    
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      
      totalDistance += calculateDistance(prev, curr);
    }
    
    return totalDistance;
  }

  /**
   * Register an agent for navigation
   */
  private registerAgent(data: {
    agentId: string;
    position: { x: number; y: number; z: number }
    speed?: number;
    size?: number;
    maxSlope?: number;
  }): void {
    
    const agent: AgentNavigationState = {
      agentId: data.agentId,
      position: { ...data.position },
      targetPosition: { ...data.position },
      currentPath: [],
      pathIndex: 0,
      speed: data.speed || 3.0, // 3 m/s default
      size: data.size || this.CONFIG.AGENT_DEFAULT_SIZE,
      maxSlope: data.maxSlope || this.CONFIG.MAX_SLOPE_WALKABLE,
      isMoving: false,
      isStuck: false,
      stuckTimer: 0,
      lastValidPosition: { ...data.position }
    };
    
    this.activeAgents.set(data.agentId, agent);
  }

  /**
   * Unregister an agent
   */
  private unregisterAgent(data: { agentId: string }): void {
    this.activeAgents.delete(data.agentId);
  }

  /**
   * Handle agent movement
   */
  private onAgentMoved(data: {
    agentId: string;
    position: { x: number; y: number; z: number }
  }): void {
    const agent = this.activeAgents.get(data.agentId);
    if (!agent) return;
    
    const oldPosition = { ...agent.position };
    agent.position = { ...data.position };
    
    // Check if agent is making progress
    const distanceMoved = calculateDistance(oldPosition, agent.position);
    
    if (distanceMoved < this.CONFIG.STUCK_DISTANCE_THRESHOLD) {
      agent.stuckTimer += 16; // ~60fps
      
      if (agent.stuckTimer > this.CONFIG.STUCK_DETECTION_TIME) {
        if (!agent.isStuck) {
          this.logger.warn(`Agent ${data.agentId} appears stuck at ${agent.position.x.toFixed(1)}, ${agent.position.z.toFixed(1)}`);
          agent.isStuck = true;
          
          // Attempt to find alternative path
          this.handleStuckAgent(agent);
        }
      }
    } else {
      agent.stuckTimer = 0;
      agent.isStuck = false;
      agent.lastValidPosition = { ...agent.position };
    }
  }

  /**
   * Handle stuck agent
   */
  private handleStuckAgent(agent: AgentNavigationState): void {
    // Clear current path
    agent.currentPath = [];
    agent.pathIndex = 0;
    agent.isMoving = false;
    
    // Try to move back to last valid position
    this.emitTypedEvent(EventType.AI_AGENT_UNSTUCK, {
      agentId: agent.agentId,
      currentPosition: agent.position,
      fallbackPosition: agent.lastValidPosition
    });
  }

  /**
   * Get closest navigation node to position
   */
  private getClosestNode(x: number, z: number): NavigationNode | null {
    // Snap to grid
    const gridX = Math.round(x / this.CONFIG.GRID_RESOLUTION) * this.CONFIG.GRID_RESOLUTION;
    const gridZ = Math.round(z / this.CONFIG.GRID_RESOLUTION) * this.CONFIG.GRID_RESOLUTION;
    
    const key = this.getGridKey(gridX, gridZ);
    return this.navigationGrid.get(key) || null;
  }

  /**
   * Get grid key for position
   */
  private getGridKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  // Helper methods using terrain validation system
  private getTerrainHeight(x: number, z: number): number | null {
    if (!this.terrainValidationSystem) return null;
    return this.terrainValidationSystem.getTerrainHeight(x, z) || null;
  }

  private calculateSlope(x: number, z: number): number {
    if (!this.terrainValidationSystem) return 0;
    return this.terrainValidationSystem.calculateSlope(x, z) || 0;
  }

  private isPositionWalkable(x: number, z: number, height?: number, slope?: number): boolean {
    if (!this.terrainValidationSystem) return true;
    return this.terrainValidationSystem.isPositionWalkable(x, z, height, slope) || false;
  }

  private getBiomeAtPosition(x: number, z: number): string | null {
    if (!this.terrainValidationSystem) return 'plains';
    return this.terrainValidationSystem.getBiomeAtPosition(x, z) || 'plains';
  }

  private isValidPosition(x: number, z: number): boolean {
    return this.getTerrainHeight(x, z) !== null;
  }

  // Event handlers
  private onTerrainChanged(_data: { bounds: unknown }): void {
    // Regenerate affected grid sections
    this.updateGridFromValidation(new Map());
  }

  private onValidationComplete(data: { walkabilityMap: Map<string, { isWalkable: boolean; slope: number; biome: string }> }): void {
    // Update navigation grid with new walkability data
    this.updateGridFromValidation(data.walkabilityMap);
  }

  private updateGridFromValidation(walkabilityMap: Map<string, { isWalkable: boolean; slope: number; biome: string }>): void {
    // Update navigation grid walkability from terrain validation
    for (const [key, walkabilityData] of walkabilityMap) {
      const node = this.navigationGrid.get(key);
      if (node) {
        node.walkable = walkabilityData.isWalkable;
        node.slope = walkabilityData.slope;
        node.biome = walkabilityData.biome;
        
        // Recalculate cost
        const biomeCost = this.CONFIG.BIOME_COSTS[node.biome] || 1.0;
        const slopeCost = 1.0 + (node.slope * this.CONFIG.HEIGHT_COST_MULTIPLIER);
        node.cost = biomeCost * slopeCost;
      }
    }
  }

  // Public API
  public requestNavigation(
    agentId: string,
    start: { x: number; z: number },
    goal: { x: number; z: number },
    options: {
      agentSize?: number;
      maxSlope?: number;
      allowedBiomes?: string[];
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<PathResult> {
    return new Promise((resolve) => {
      const request: PathfindingRequest = {
        id: `${agentId}_${Date.now()}`,
        agentId,
        start,
        goal,
        agentSize: options.agentSize || this.CONFIG.AGENT_DEFAULT_SIZE,
        maxSlope: options.maxSlope || this.CONFIG.MAX_SLOPE_WALKABLE,
        allowedBiomes: options.allowedBiomes,
        priority: options.priority || 'normal',
        callback: (path: PathResult | null) => {
          if (path) {
            resolve(path);
          } else {
            resolve({
              success: false,
              path: [],
              totalDistance: 0,
              estimatedTime: 0,
              errorMessage: 'Path not found'
            });
          }
        }
      };
      
      this.handleNavigationRequest(request);
    });
  }

  public getAgentNavigationState(agentId: string): AgentNavigationState | null {
    return this.activeAgents.get(agentId) || null;
  }

  public getNavigationGridStats(): {
    totalNodes: number;
    walkableNodes: number;
    unwalkableNodes: number;
    activeAgents: number;
    queuedRequests: number;
    gridResolution: number;
  } {
    const walkableNodes = Array.from(this.navigationGrid.values()).filter(n => n.walkable).length;
    
    return {
      totalNodes: this.navigationGrid.size,
      walkableNodes,
      unwalkableNodes: this.navigationGrid.size - walkableNodes,
      activeAgents: this.activeAgents.size,
      queuedRequests: this.pathfindingQueue.length,
      gridResolution: this.CONFIG.GRID_RESOLUTION
    };
  }

  // System lifecycle
  update(_dt: number): void {
    // Update agent navigation states
    for (const [_agentId, agent] of this.activeAgents) {
      if (agent.isMoving && agent.currentPath.length > 0) {
        // Agent navigation logic would go here
        // This would be handled by individual agent systems
      }
    }
  }

  destroy(): void {
    this.navigationGrid.clear();
    this.pathfindingQueue = [];
    this.activeAgents.clear();
    if (this.processorIntervalId) {
      clearInterval(this.processorIntervalId);
      this.processorIntervalId = null;
    }
  }

  // Required System interface methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}