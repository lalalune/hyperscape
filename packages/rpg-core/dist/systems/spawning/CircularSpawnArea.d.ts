import type { Vector3, SpawnArea } from '../types';
/**
 * Circular spawn area implementation
 */
export declare class CircularSpawnArea implements SpawnArea {
    private center;
    radius: number;
    type: "circle";
    avoidOverlap: boolean;
    minSpacing: number;
    maxHeight: number;
    constructor(center: Vector3, radius: number, minSpacing?: number, avoidOverlap?: boolean, maxHeight?: number);
    /**
     * Get a random position within the circular area
     */
    getRandomPosition(): Vector3;
    /**
     * Check if position is valid within the area
     */
    isValidPosition(position: Vector3): boolean;
    /**
     * Calculate distance between two positions
     */
    private distance;
}
//# sourceMappingURL=CircularSpawnArea.d.ts.map