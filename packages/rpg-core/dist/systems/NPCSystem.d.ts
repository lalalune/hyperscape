import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import { NPCEntity } from '../entities/NPCEntity';
import { NPCDefinition, Vector3 } from '../types/index';
export declare class NPCSystem extends System {
    private npcs;
    private npcDefinitions;
    private behaviorManager;
    private dialogueManager;
    private spawnManager;
    private visualSystem;
    private readonly INTERACTION_RANGE;
    private npcIdCounter;
    private logger;
    constructor(world: World);
    /**
     * Initialize the system
     */
    init(_options: any): Promise<void>;
    /**
     * Fixed update for AI and behavior
     */
    fixedUpdate(_delta: number): void;
    /**
     * Regular update for animations and visuals
     */
    update(_delta: number): void;
    /**
     * Convert NPCConfig to NPCDefinition
     */
    private convertConfigToDefinition;
    /**
     * Register an NPC definition
     */
    registerNPCDefinition(definition: NPCDefinition): void;
    /**
     * Spawn an NPC at a position
     */
    spawnNPC(definitionId: number, position: Vector3, spawnerId?: string): NPCEntity | null;
    /**
     * Despawn an NPC
     */
    despawnNPC(npcId: string): void;
    /**
     * Handle player interaction with NPC
     */
    interactWithNPC(playerId: string, npcId: string): void;
    /**
     * Get NPC by ID
     */
    getNPC(npcId: string): NPCEntity | undefined;
    /**
     * Get all NPCs
     */
    getAllNPCs(): NPCEntity[];
    /**
     * Get NPCs in range of a position
     */
    getNPCsInRange(position: Vector3, range: number): NPCEntity[];
    /**
     * Create NPC entity from definition
     */
    private createNPCEntity;
    /**
     * Add NPC to world
     */
    private addNPCToWorld;
    /**
     * Handle NPC creation
     */
    private onNPCCreated;
    /**
     * Handle NPC death
     */
    private onNPCDeath;
    /**
     * Handle quest giver interaction
     */
    private handleQuestGiverInteraction;
    /**
     * Handle shop interaction
     */
    private handleShopInteraction;
    /**
     * Handle banker interaction
     */
    private handleBankerInteraction;
    /**
     * Handle skill master interaction
     */
    private handleSkillMasterInteraction;
    /**
     * Handle generic interaction
     */
    private handleGenericInteraction;
    /**
     * Check if entity is an NPC
     */
    private isNPCEntity;
    /**
     * Check if NPC is combat-capable
     */
    private isCombatNPC;
    /**
     * Get entity from world
     */
    private getEntity;
    /**
     * Calculate distance between two positions
     */
    private getDistance;
    /**
     * Send message to player
     */
    private sendMessage;
    /**
     * Get entity position
     */
    private getEntityPosition;
}
//# sourceMappingURL=NPCSystem.d.ts.map