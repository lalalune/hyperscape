/**
 * @hyperscape/rpg-core
 *
 * Core RPG game logic for Hyperfy
 * This plugin provides a complete RPG experience with combat, skills, banking, trading, and more.
 */
import { Plugin } from '@hyperfy/sdk';
export * from './types';
export * from './api/RPGPublicAPI';
export * from './api/events';
export * from './api/queries';
/**
 * Creates and initializes the RPG plugin
 */
export declare function createRPGPlugin(config?: RPGPluginConfig): Plugin;
/**
 * Plugin configuration options
 */
export interface RPGPluginConfig {
    /** Enable debug logging */
    debug?: boolean;
    /** World generation settings */
    worldGen?: {
        /** Generate default world on init */
        generateDefault?: boolean;
        /** Custom spawn areas */
        customSpawns?: SpawnArea[];
    };
    /** System configuration */
    systems?: {
        /** Enable/disable specific systems */
        combat?: boolean;
        banking?: boolean;
        trading?: boolean;
        skills?: boolean;
        quests?: boolean;
    };
    /** Visual configuration */
    visuals?: {
        /** Enable shadows */
        enableShadows?: boolean;
        /** Maximum view distance */
        maxViewDistance?: number;
    };
}
/**
 * Spawn area configuration
 */
export interface SpawnArea {
    id: string;
    name: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    radius: number;
    type: 'safe' | 'pvp' | 'wilderness';
}
export default createRPGPlugin;
//# sourceMappingURL=index.d.ts.map