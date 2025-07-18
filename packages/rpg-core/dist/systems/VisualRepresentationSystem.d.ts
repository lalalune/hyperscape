import { World } from '../types';
import { System } from '@hyperfy/sdk';
import { RPGEntity } from '../entities/RPGEntity';
import { VisualComponent } from '../types/visual.types';
/**
 * System that manages visual representations for all RPG entities
 */
export declare class VisualRepresentationSystem extends System {
    private config;
    private templates;
    private entityVisuals;
    private activeAnimations;
    private scene;
    private sceneRoot;
    constructor(world: World);
    /**
     * Initialize the system
     */
    init(options: any): Promise<void>;
    /**
     * Load templates from configuration
     */
    private loadTemplates;
    /**
     * Add visual representation for an entity (alias for createVisual)
     */
    addVisual(entity: RPGEntity, templateName?: string): void;
    /**
     * Create visual representation for an entity
     */
    createVisual(entity: RPGEntity, templateName?: string): void;
    /**
     * Apply visual template to entity's existing Three.js node
     */
    private applyVisualToEntityNode;
    /**
     * Create visual component from template
     */
    private createVisualComponent;
    /**
     * Get template for entity
     */
    private getTemplate;
    /**
     * Create material from template
     */
    private createMaterial;
    /**
     * Sync visual position with entity
     */
    private syncVisualWithEntity;
    /**
     * Play animation for entity
     */
    playAnimation(entityId: string, animationType: string, loop?: boolean, duration?: number): void;
    /**
     * Stop animation for entity
     */
    stopAnimation(entityId: string): void;
    /**
     * Update animations and sync with entities
     */
    update(_delta: number): void;
    /**
     * Apply animation to visual
     */
    private applyAnimation;
    /**
     * Set opacity for visual
     */
    private setOpacity;
    /**
     * Remove visual representation
     */
    removeVisual(entityId: string): void;
    /**
     * Get visual for entity
     */
    getVisual(entityId: string): VisualComponent | undefined;
    /**
     * Clean up
     */
    destroy(): void;
}
//# sourceMappingURL=VisualRepresentationSystem.d.ts.map