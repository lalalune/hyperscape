import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import type { Vector3 } from '../types';
export interface NavigationPath {
    _entityId: string;
    waypoints: Vector3[];
    currentWaypoint: number;
    speed: number;
    arrived: boolean;
    callback?: () => void;
}
export interface NavigationRequest {
    _entityId: string;
    destination: Vector3;
    speed?: number;
    callback?: () => void;
}
/**
 * Simple navigation system for direct movement without collision detection
 * This is a basic implementation that can be enhanced with pathfinding later
 */
export declare class NavigationSystem extends System {
    private activePaths;
    private readonly DEFAULT_SPEED;
    private readonly ARRIVAL_THRESHOLD;
    constructor(world: World);
    init(_options: any): Promise<void>;
    /**
     * Navigate entity to destination
     */
    navigateTo(request: NavigationRequest): void;
    /**
     * Update navigation paths
     */
    fixedUpdate(delta: number): void;
    /**
     * Update a single navigation path
     */
    private updatePath;
    /**
     * Stop navigation for entity
     */
    stopNavigation(_entityId: string): void;
    /**
     * Check if entity is currently navigating
     */
    isNavigating(_entityId: string): boolean;
    /**
     * Get distance between two positions
     */
    getDistance(pos1: Vector3, pos2: Vector3): number;
    /**
     * Get entity by ID with comprehensive fallback strategies
     */
    private getEntity;
    destroy(): void;
}
//# sourceMappingURL=NavigationSystem.d.ts.map