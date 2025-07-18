import { Plugin, World } from '@hyperfy/sdk';
import { RPGPluginConfig } from './index';
import { RPGPublicAPI } from './api/RPGPublicAPI';
/**
 * Main RPG Plugin implementation
 */
export declare class RPGPlugin implements Plugin {
    private config;
    private worldManager?;
    private publicAPI?;
    private systems;
    constructor(config?: RPGPluginConfig);
    /**
     * Initialize the plugin
     */
    init(world: World): Promise<void>;
    /**
     * Initialize all game systems
     */
    private initializeSystems;
    /**
     * Initialize a single system
     */
    private initializeSystem;
    /**
     * Update loop
     */
    update(delta: number): void;
    /**
     * Cleanup on plugin removal
     */
    destroy(): void;
    /**
     * Get the public API
     */
    getAPI(): RPGPublicAPI | undefined;
}
//# sourceMappingURL=RPGPlugin.d.ts.map