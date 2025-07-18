import { World } from '../../types';
import { basename } from 'path';

export interface UGCAppManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  main: string; // Entry point file
  type: 'world' | 'plugin' | 'system';
  capabilities?: {
    actions?: string[];
    providers?: string[];
    systems?: string[];
    evaluators?: string[];
  };
  dependencies?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface UGCApp {
  manifest: UGCAppManifest;
  init: (world: World, config?: any) => Promise<void>;
  destroy?: () => Promise<void>;
  getCapabilities?: () => Record<string, any>;
}

export class UGCAppLoader {
  private loadedApps = new Map<string, UGCApp>();
  private appCapabilities = new Map<string, any>();

  /**
   * Load a UGC app from a URL or local path
   */
  async loadApp(source: string, world: World): Promise<UGCApp> {
    try {
      console.log(`[UGCAppLoader] Loading app from ${source}`);

      // Load the app bundle
      const appModule = await import(source);

      // Validate required app structure
      if (!appModule.manifest || !appModule.init) {
        throw new Error('Invalid UGC app: missing manifest or init function');
      }

      // Create UGC app wrapper
      const app: UGCApp = {
        manifest: appModule.manifest,
        init: appModule.init,
        destroy: appModule.destroy,
        getCapabilities: appModule.getCapabilities
      };

      // Validate manifest
      this.validateManifest(app.manifest);

      // Initialize app with world
      await app.init(world);

      // Store the app
      this.loadedApps.set(app.manifest.id, app);

      // Register capabilities
      if (app.getCapabilities) {
        const capabilities = app.getCapabilities();
        this.appCapabilities.set(app.manifest.id, capabilities);
      }

      console.log(`[UGCAppLoader] Successfully loaded app: ${app.manifest.name} v${app.manifest.version}`);
      return app;
    } catch (error) {
      console.error(`[UGCAppLoader] Failed to load app from ${source}:`, error);
      throw error;
    }
  }

  /**
   * Unload a UGC app
   */
  async unloadApp(appId: string): Promise<void> {
    const app = this.loadedApps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    // Call destroy if available
    if (app.destroy) {
      await app.destroy();
    }

    // Remove from registry
    this.loadedApps.delete(appId);
    this.appCapabilities.delete(appId);

    console.log(`[UGCAppLoader] Unloaded app: ${appId}`);
  }

  /**
   * Get all loaded apps
   */
  getLoadedApps(): UGCApp[] {
    return Array.from(this.loadedApps.values());
  }

  /**
   * Get app by ID
   */
  getApp(appId: string): UGCApp | undefined {
    return this.loadedApps.get(appId);
  }

  /**
   * Get all capabilities from all loaded apps
   */
  getAllCapabilities(): Record<string, any> {
    const allCapabilities: Record<string, any> = {
      actions: [],
      providers: [],
      systems: [],
      evaluators: []
    };

    for (const [appId, capabilities] of this.appCapabilities) {
      if (capabilities.actions) {
        allCapabilities.actions.push(...capabilities.actions);
      }
      if (capabilities.providers) {
        allCapabilities.providers.push(...capabilities.providers);
      }
      if (capabilities.systems) {
        allCapabilities.systems.push(...capabilities.systems);
      }
      if (capabilities.evaluators) {
        allCapabilities.evaluators.push(...capabilities.evaluators);
      }
    }

    return allCapabilities;
  }

  /**
   * Validate app manifest
   */
  private validateManifest(manifest: UGCAppManifest): void {
    if (!manifest.id || !manifest.name || !manifest.version || !manifest.main) {
      throw new Error('Invalid manifest: missing required fields');
    }

    if (!['world', 'plugin', 'system'].includes(manifest.type)) {
      throw new Error(`Invalid manifest type: ${manifest.type}`);
    }
  }
}
