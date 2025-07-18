import { World } from '@hyperfy/sdk';
import type { NPCEntity } from '../types';
export declare class NPCBehaviorManager {
    private world;
    private movementSystem;
    private readonly BEHAVIOR_UPDATE_INTERVAL;
    private lastBehaviorUpdate;
    constructor(world: World);
    /**
     * Initialize the behavior manager - called after all systems are ready
     */
    init(): void;
    /**
     * Update NPC behavior
     */
    updateBehavior(npc: NPCEntity, _delta: number): void;
    /**
     * Aggressive behavior - attacks players on sight
     */
    private updateAggressiveBehavior;
    /**
     * Defensive behavior - only attacks when attacked
     */
    private updateDefensiveBehavior;
    /**
     * Passive behavior - never attacks
     */
    private updatePassiveBehavior;
    /**
     * Friendly behavior - interactable NPCs
     */
    private updateFriendlyBehavior;
    /**
     * Patrol behavior - follows waypoints
     */
    private updatePatrolBehavior;
    /**
     * Wander behavior - random movement
     */
    private updateWanderBehavior;
    /**
     * Update movement towards destination
     */
    private updateMovement;
    /**
     * Start combat with a target
     */
    private startCombat;
    /**
     * Find a new target
     */
    private findNewTarget;
    /**
     * Make NPC flee from danger
     */
    private flee;
    /**
     * Move to a specific position
     */
    private moveToPosition;
    /**
     * Make NPC face another entity
     */
    private faceEntity;
    /**
     * Start wandering behavior
     */
    private startWandering;
    /**
     * Check if target is valid
     */
    private isValidTarget;
    /**
     * Check if NPC can attack player
     */
    private canAttackPlayer;
    /**
     * Check if reached destination
     */
    private hasReachedDestination;
    /**
     * Get players in range
     */
    private getPlayersInRange;
    /**
     * Get closest player from list
     */
    private getClosestPlayer;
    /**
     * Get entity position
     */
    private getEntityPosition;
    /**
     * Get entity from world
     */
    private getEntity;
    /**
     * Check if entity is a player
     */
    private isPlayer;
    /**
     * Calculate distance between positions
     */
    private getDistance;
    /**
     * Execute patrol behavior
     */
    private executePatrol;
    /**
     * Generate default waypoints for patrol
     */
    private generateDefaultWaypoints;
    /**
     * Spatial query for nearby entities
     */
    private spatialQuery;
}
//# sourceMappingURL=NPCBehaviorManager.d.ts.map