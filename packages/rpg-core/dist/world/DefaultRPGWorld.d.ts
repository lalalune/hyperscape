import { World } from '@hyperfy/sdk';
export interface CubeVisualConfig {
    size: {
        x: number;
        y: number;
        z: number;
    };
    color: string;
    emissive?: string;
    emissiveIntensity?: number;
}
export declare const ENTITY_VISUALS: Record<string, CubeVisualConfig>;
export declare class DefaultRPGWorld {
    private world;
    constructor(world: World);
    /**
     * Initialize the default RPG world with test content
     */
    initialize(): Promise<void>;
    private waitForSystems;
    private createSpawnArea;
    private spawnTestNPCs;
    private createServices;
    private spawnGroundItems;
    /**
     * Add cube visual to entity
     */
    private addCubeVisual;
    /**
     * Add name tag to entity
     */
    private addNameTag;
    /**
     * Get item definition
     */
    private getItemDefinition;
}
/**
 * Initialize default RPG world on server start
 */
export declare function initializeDefaultRPGWorld(world: World): Promise<void>;
//# sourceMappingURL=DefaultRPGWorld.d.ts.map