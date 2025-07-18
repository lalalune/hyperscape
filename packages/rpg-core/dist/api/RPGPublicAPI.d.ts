import { World } from '@hyperfy/sdk';
import { RPGWorldManager } from '../world/RPGWorldManager';
import { Vector3 } from '../types';
/**
 * Public API for interacting with the RPG plugin
 * This provides a clean interface for external code to interact with RPG systems
 */
export declare class RPGPublicAPI {
    private world;
    private systems;
    private worldManager;
    constructor(world: World, systems: Map<string, any>, worldManager: RPGWorldManager);
    /**
     * Player Management
     */
    spawnPlayer(playerId: string, options?: {
        position?: Vector3;
        username?: string;
        stats?: any;
    }): Promise<string>;
    getPlayer(playerId: string): any;
    movePlayer(playerId: string, destination: Vector3): boolean;
    /**
     * NPC Management
     */
    spawnNPC(npcType: string, options?: {
        position?: Vector3;
        behavior?: string;
        spawnerId?: string;
    }): Promise<string>;
    getNPC(npcId: string): any;
    /**
     * Combat
     */
    startCombat(attackerId: string, targetId: string): boolean;
    stopCombat(entityId: string): boolean;
    /**
     * Inventory & Items
     */
    giveItem(playerId: string, itemId: number, quantity?: number): boolean;
    removeItem(playerId: string, itemId: number, quantity?: number): boolean;
    getInventory(playerId: string): any[];
    dropItem(position: Vector3, itemId: number, quantity?: number, owner?: string): string | null;
    /**
     * Banking
     */
    openBank(playerId: string): boolean;
    depositItem(playerId: string, itemId: number, quantity?: number): boolean;
    withdrawItem(playerId: string, itemId: number, quantity?: number): boolean;
    /**
     * Skills
     */
    getSkillLevel(playerId: string, skillName: string): number;
    addSkillXP(playerId: string, skillName: string, xp: number): boolean;
    /**
     * UI & Interaction
     */
    showInterface(playerId: string, interfaceId: string): boolean;
    hideInterface(playerId: string, interfaceId: string): boolean;
    sendMessage(playerId: string, message: string, type?: 'game' | 'chat'): void;
    /**
     * World & Environment
     */
    getWorldTime(): number;
    isInSafeZone(position: Vector3): boolean;
    getRegionAt(position: Vector3): string | null;
    /**
     * Testing & Debug
     */
    getEntityCount(): number;
    getAllEntities(): Map<string, any>;
    getSystem(systemName: string): any;
    /**
     * Events
     */
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
    emit(event: string, data: any): void;
}
//# sourceMappingURL=RPGPublicAPI.d.ts.map