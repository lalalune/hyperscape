import { System } from '@hyperfy/sdk';
import type { World } from '../types';
export declare class DeathRespawnSystem extends System {
    private gravestones;
    private deathTimers;
    private gravestoneEntities;
    private config;
    constructor(world: World);
    /**
     * Initialize the system
     */
    init(_options: any): Promise<void>;
    /**
     * Handle entity death
     */
    private handleDeath;
    /**
     * Handle player death
     */
    private handlePlayerDeath;
    /**
     * Handle NPC death
     */
    private handleNPCDeath;
    /**
     * Calculate items kept on death
     */
    private calculateItemsKeptOnDeath;
    /**
     * Create gravestone
     */
    private createGravestone;
    /**
     * Respawn player
     */
    private respawn;
    /**
     * Handle respawn request
     */
    private handleRespawnRequest;
    /**
     * Get respawn location
     */
    private getRespawnLocation;
    /**
     * Check if player can use respawn point
     */
    private canUseRespawnPoint;
    /**
     * Handle gravestone interaction
     */
    private handleGravestoneInteraction;
    /**
     * Reclaim items from gravestone
     */
    reclaimItems(playerId: string, gravestoneId: string, payFee?: boolean): boolean;
    /**
     * Handle gravestone blessing
     */
    private handleGravestoneBless;
    /**
     * Expire gravestone
     */
    private expireGravestone;
    /**
     * Remove gravestone
     */
    private removeGravestone;
    /**
     * Check if position is in safe zone
     */
    private isInSafeZone;
    /**
     * Get player gravestone tier
     */
    private getPlayerGravestoneTier;
    /**
     * Get gravestone model
     */
    private getGravestoneModel;
    /**
     * Calculate gravestone value
     */
    private calculateGravestoneValue;
    /**
     * Get item value
     */
    private getItemValue;
    /**
     * Get player gold amount
     */
    private getPlayerGold;
    /**
     * Remove gold from player
     */
    private removePlayerGold;
    /**
     * Send message to player
     */
    private sendMessage;
    /**
     * Update system
     */
    update(_delta: number): void;
}
//# sourceMappingURL=DeathRespawnSystem.d.ts.map