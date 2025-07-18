import { World } from '../../types';
import { createServerWorld } from '../createServerWorld';
import { UGCAppLoader, UGCApp } from './UGCAppLoader';
import * as path from 'path';
import * as fs from 'fs';

export interface WorldConfig {
  id: string;
  name: string;
  route: string; // URL route for this world (e.g., '/default', '/rpg')
  type: 'default' | 'ugc';
  ugcApp?: string; // Path/URL to UGC app if type is 'ugc'
  config?: Record<string, any>;
}

export class WorldManager {
  private worlds = new Map<string, World>();
  private worldConfigs = new Map<string, WorldConfig>();
  private worldApps = new Map<string, UGCApp>();
  private ugcLoader = new UGCAppLoader();

  /**
   * Create and register a world
   */
  async createWorld(config: WorldConfig): Promise<World> {
    try {
      console.log(`[WorldManager] Creating world: ${config.name} (${config.id})`);

      // Create base world
      const world = await createServerWorld();

      // If it's a UGC world, load the app
      if (config.type === 'ugc' && config.ugcApp) {
        const app = await this.ugcLoader.loadApp(config.ugcApp, world);
        this.worldApps.set(config.id, app);
      }

      // Store world and config
      this.worlds.set(config.id, world);
      this.worldConfigs.set(config.id, config);

      console.log(`[WorldManager] World created: ${config.name} at route ${config.route}`);

      return world;
    } catch (error) {
      console.error(`[WorldManager] Failed to create world ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * Get world by ID
   */
  getWorld(worldId: string): World | undefined {
    return this.worlds.get(worldId);
  }

  /**
   * Get world by route
   */
  getWorldByRoute(route: string): World | undefined {
    for (const [id, config] of this.worldConfigs) {
      if (config.route === route) {
        return this.worlds.get(id);
      }
    }
    return undefined;
  }

  /**
   * Get world config by ID
   */
  getWorldConfig(worldId: string): WorldConfig | undefined {
    return this.worldConfigs.get(worldId);
  }

  /**
   * Get all worlds
   */
  getAllWorlds(): Map<string, World> {
    return new Map(this.worlds);
  }

  /**
   * Get all world configs
   */
  getAllWorldConfigs(): WorldConfig[] {
    return Array.from(this.worldConfigs.values());
  }

  /**
   * Get capabilities for a specific world
   */
  getWorldCapabilities(worldId: string): Record<string, any> {
    const app = this.worldApps.get(worldId);
    if (app && app.getCapabilities) {
      return app.getCapabilities();
    }
    return {
      actions: [],
      providers: [],
      systems: [],
      evaluators: []
    };
  }

  /**
   * Destroy a world
   */
  async destroyWorld(worldId: string): Promise<void> {
    const world = this.worlds.get(worldId);
    const app = this.worldApps.get(worldId);

    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }

    // Destroy UGC app if present
    if (app) {
      await this.ugcLoader.unloadApp(app.manifest.id);
      this.worldApps.delete(worldId);
    }

    // Destroy world
    if ((world as any).destroy) {
      await (world as any).destroy();
    }

    // Remove from registry
    this.worlds.delete(worldId);
    this.worldConfigs.delete(worldId);

    console.log(`[WorldManager] Destroyed world: ${worldId}`);
  }

  /**
   * Initialize default worlds (called on server startup)
   */
  async initializeDefaultWorlds(): Promise<void> {
    // Create default world
    await this.createWorld({
      id: 'default',
      name: 'Default World',
      route: '/',
      type: 'default'
    });

    console.log('[WorldManager] Default worlds initialized');
  }
}
