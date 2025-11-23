import { IAgentRuntime, logger } from "@elizaos/core";
import {
  IContentPack,
  IGameSystem,
  IVisualConfig,
} from "../types/content-pack";
import { HyperscapeService } from "../service";
import { HyperscapeActionDescriptor } from "../types/core-types";
import { World } from "../types/core-types";

/**
 * Manages loading and unloading of modular content packs
 */
export class ContentPackLoader {
  private runtime: IAgentRuntime;
  private service: HyperscapeService;
  private loadedPacks: Map<string, IContentPack> = new Map();
  private activeSystems: Map<string, IGameSystem[]> = new Map();

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    )!;
  }

  /**
   * Load a content pack into the world
   */
  async loadPack(pack: IContentPack, runtime?: IAgentRuntime): Promise<void> {
    logger.info(
      `[ContentPackLoader] Loading content pack: ${pack.name} v${pack.version}`,
    );

    const world = this.service.getWorld()!;
    const targetRuntime = runtime || this.runtime;

    // Execute onLoad hook if provided
    if (pack.onLoad) {
      await pack.onLoad(targetRuntime, world);
    }

    // Load visual configuration
    if (pack.visuals) {
      this.loadVisualConfig(pack.visuals);
    }

    // Initialize game systems
    if (pack.systems) {
      const systems = await this.initializeSystems(pack.systems, world);
      this.activeSystems.set(pack.id, systems);
    }

    // Register actions dynamically
    if (pack.actions) {
      const actionLoader = this.service.getDynamicActionLoader()!;
      for (const action of pack.actions) {
        // Action might be an Action or HyperscapeActionDescriptor
        if ("parameters" in action && "category" in action) {
          // Convert ElizaOS Action format to HyperscapeActionDescriptor
          const descriptor: HyperscapeActionDescriptor = {
            name: action.name,
            description: action.description,
            parameters:
              action.parameters as unknown as HyperscapeActionDescriptor["parameters"],
            examples: Array.isArray(action.examples)
              ? action.examples.flat().map((ex) => JSON.stringify(ex))
              : [],
            category: action.category as HyperscapeActionDescriptor["category"],
            handler: undefined,
          };
          await actionLoader.registerAction(descriptor, this.runtime);
        }
      }
    }

    // Register providers
    if (pack.providers) {
      pack.providers.forEach((provider) => {
        targetRuntime.registerProvider(provider);
      });
    }

    // Register evaluators
    if (pack.evaluators) {
      pack.evaluators.forEach((evaluator) => {
        targetRuntime.registerEvaluator(evaluator);
      });
    }

    // Initialize state manager
    if (pack.stateManager && pack.onLoad) {
      // State initialization happens in onLoad callback
      // const playerId = world.entities.player!.data.id;
      // pack.stateManager.initPlayerState?.(playerId);
    }

    this.loadedPacks.set(pack.id, pack);
    logger.info(`[ContentPackLoader] Successfully loaded pack: ${pack.id}`);
  }

  /**
   * Unload a content pack
   */
  async unloadPack(packId: string): Promise<void> {
    const pack = this.loadedPacks.get(packId)!;

    logger.info(`[ContentPackLoader] Unloading content pack: ${pack.name}`);

    const world = this.service.getWorld()!;

    // Execute onUnload hook if provided
    if (pack.onUnload) {
      await pack.onUnload(this.runtime, world);
    }

    // Cleanup game systems
    const systems = this.activeSystems.get(packId);
    if (systems) {
      for (const system of systems) {
        system.cleanup();
      }
      this.activeSystems.delete(packId);
    }

    // Clean shutdown - actions/providers/evaluators are managed by ElizaOS core
    // This requires tracking in the runtime

    this.loadedPacks.delete(packId);
    logger.info(`[ContentPackLoader] Successfully unloaded pack: ${packId}`);
  }

  /**
   * Get all loaded packs
   */
  getLoadedPacks(): IContentPack[] {
    return Array.from(this.loadedPacks.values());
  }

  /**
   * Check if a pack is loaded
   */
  isPackLoaded(packId: string): boolean {
    return this.loadedPacks.has(packId);
  }

  /**
   * Load visual configuration into the world
   */
  private loadVisualConfig(visuals: IVisualConfig): void {
    const world = this.service.getWorld()!;

    // Register entity colors for visual detection
    if (visuals.entityColors) {
      const colorDetector = world.colorDetector;
      if (colorDetector) {
        Object.entries(visuals.entityColors).forEach(([entityType, config]) => {
          colorDetector.registerEntityColor(entityType, config);
        });
      }
    }

    // Apply UI theme if provided
    if (visuals.uiTheme && world.ui) {
      // Assume applyTheme is a function
      (world.ui as { applyTheme: (theme: unknown) => void }).applyTheme(
        visuals.uiTheme,
      );
    }

    // Load assets
    if (visuals.assets) {
      const assetLoader = (
        world as { assetLoader: { loadModel: (url: string) => void } }
      ).assetLoader;
      if (visuals.assets.models) {
        // models is Record<string, string>, convert to array of URLs
        Object.values(visuals.assets.models).forEach((url: string) => {
          assetLoader.loadModel(url);
        });
      }
      // Load other asset types...
    }
  }

  /**
   * Initialize game systems
   */
  private async initializeSystems(
    systems: IGameSystem[],
    world: World,
  ): Promise<IGameSystem[]> {
    const initialized: IGameSystem[] = [];

    for (const system of systems) {
      await system.init(world);
      initialized.push(system);
      logger.info(`[ContentPackLoader] Initialized system: ${system.name}`);
    }

    return initialized;
  }

  /**
   * Update all active systems (called from game loop)
   */
  updateSystems(deltaTime: number): void {
    for (const [_packId, systems] of this.activeSystems) {
      for (const system of systems) {
        if (system.update) {
          system.update(deltaTime);
        }
      }
    }
  }

  /**
   * Get state manager for a loaded pack
   */
  getPackStateManager(packId: string): unknown {
    const pack = this.loadedPacks.get(packId);
    return pack?.stateManager;
  }
}
