import { World } from '@hyperfy/sdk';
import { RPGEntity } from './RPGEntity';
import type { NPCDefinition, Vector3 } from '../types';
import type { Component } from '../types';
interface NPCComponent extends Component {
    type: 'npc';
    npcId: number;
    name: string;
    behavior: string;
    faction: string;
    level: number;
    combatLevel: number;
    maxHitpoints: number;
    currentHitpoints: number;
    aggressionLevel: number;
    aggressionRange: number;
    wanderRadius: number;
    respawnTime: number;
    lastPosition: Vector3;
    homePosition: Vector3;
    spawnPoint: Vector3;
    state: string;
    isAlive: boolean;
    lastCombatTime: number;
    currentTarget: string | null;
    aggroList: string[];
    definition: NPCDefinition;
}
/**
 * NPC Entity class for all non-player characters
 */
export declare class NPCEntity extends RPGEntity {
    npcType: string;
    spawnerId?: string;
    lastInteraction: number;
    spawnPoint: Vector3;
    currentTarget: string | null;
    deathTime: number;
    aiState: 'idle' | 'wandering' | 'chasing' | 'attacking' | 'fleeing' | 'returning';
    stateTimer: number;
    constructor(world: World, id: string, data: {
        position: Vector3;
        definition: NPCDefinition;
    });
    /**
     * Get the NPC component
     */
    getNPCComponent(): NPCComponent | null;
    /**
     * Update position
     */
    setPosition(position: Vector3): void;
    /**
     * Check if NPC is alive
     */
    isAlive(): boolean;
    /**
     * Take damage
     */
    takeDamage(damage: number): void;
    /**
     * Handle death
     */
    die(): void;
    /**
     * Respawn the NPC
     */
    respawn(): void;
    /**
     * Check if player is in interaction range
     */
    isInInteractionRange(playerPosition: Vector3, range?: number): boolean;
}
export {};
//# sourceMappingURL=NPCEntity.d.ts.map