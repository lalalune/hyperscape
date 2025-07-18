import { World } from '@hyperfy/sdk';
/**
 * Initialize an RPG world with default content
 */
export declare function initializeRPGWorld(world: World): Promise<void>;
/**
 * Create an example RPG world definition
 */
export declare const RPGWorldDefinition: {
    name: string;
    description: string;
    spawn: {
        x: number;
        y: number;
        z: number;
    };
    environment: {
        skybox: string;
        fog: {
            color: string;
            near: number;
            far: number;
        };
        lighting: {
            ambient: number;
            directional: number;
        };
    };
    rules: {
        pvp: boolean;
        maxPlayers: number;
        itemDropOnDeath: boolean;
        skillCap: number;
        combatLevelCap: number;
    };
    starterKit: {
        itemId: number;
        quantity: number;
    }[];
};
//# sourceMappingURL=RPGWorld.d.ts.map