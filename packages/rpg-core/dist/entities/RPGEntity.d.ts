import { World } from '@hyperfy/sdk';
import { Entity } from '../../core/entities/Entity';
import type { Component } from '../../types/index.js';
/**
 * RPG-specific entity that extends the base Entity class
 * with additional RPG functionality
 */
export declare class RPGEntity extends Entity {
    components: Map<string, Component>;
    visualOverride?: {
        color?: string;
        size?: {
            width: number;
            height: number;
            depth: number;
        };
        animation?: string;
    };
    world: World;
    data: any;
    constructor(world: World, type: string, data: any);
    /**
     * Add a component to the entity
     */
    addComponent(type: string, data?: any): Component;
    /**
     * Get a component by type
     */
    getComponent<T extends Component>(type: string): T | null;
    /**
     * Remove a component by type
     */
    removeComponent(type: string): void;
    /**
     * Check if entity has a component
     */
    hasComponent(type: string): boolean;
    /**
     * Get all components
     */
    getAllComponents(): Component[];
    /**
     * Update entity - called every frame
     */
    update(_delta: number): void;
    /**
     * Fixed update - called at fixed intervals
     */
    fixedUpdate(_delta: number): void;
    /**
     * Late update - called after all updates
     */
    lateUpdate(_delta: number): void;
    /**
     * Serialize entity data
     */
    serialize(): any;
    destroy(local?: boolean): void;
}
//# sourceMappingURL=RPGEntity.d.ts.map