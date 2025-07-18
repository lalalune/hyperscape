import type { Vector3 } from '../types';
/**
 * Spatial index for efficient range queries
 */
export declare class SpatialIndex<T extends {
    position: Vector3;
}> {
    private grid;
    private cellSize;
    constructor(cellSize?: number);
    /**
     * Add item to spatial index
     */
    add(item: T): void;
    /**
     * Remove item from spatial index
     */
    remove(item: T): void;
    /**
     * Get all items within range of position
     */
    getInRange(position: Vector3, range: number): T[];
    /**
     * Clear all items
     */
    clear(): void;
    /**
     * Get total item count
     */
    get size(): number;
    /**
     * Get grid key for position
     */
    private getGridKey;
    /**
     * Get cell coordinates for position
     */
    private getCellCoords;
    /**
     * Calculate distance between two positions
     */
    private distance;
}
//# sourceMappingURL=SpatialIndex.d.ts.map