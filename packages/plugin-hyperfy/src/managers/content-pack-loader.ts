import { IAgentRuntime, logger } from '@elizaos/core'
import {
  IContentPack,
  IContentPackLoader,
  IGameSystem,
} from '../types/content-pack'
import { HyperfyService } from '../service'
import { DynamicActionLoader } from './dynamic-action-loader'

/**
 * Manages loading and unloading of modular content packs
 */
export class ContentPackLoader implements IContentPackLoader {
  private runtime: IAgentRuntime
  private service: HyperfyService
  private loadedPacks: Map<string, IContentPack> = new Map()
  private activeSystems: Map<string, IGameSystem[]> = new Map()

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
    this.service = runtime.getService<HyperfyService>(
      HyperfyService.serviceName
    )!
  }

  /**
   * Load a content pack into the world
   */
  async loadPack(pack: IContentPack, runtime?: IAgentRuntime): Promise<void> {
    if (this.loadedPacks.has(pack.id)) {
      logger.warn(`[ContentPackLoader] Pack ${pack.id} already loaded`)
      return
    }

    logger.info(
      `[ContentPackLoader] Loading content pack: ${pack.name} v${pack.version}`
    )

    try {
      const world = this.service.getWorld()
      const targetRuntime = runtime || this.runtime

      // Execute onLoad hook if provided
      if (pack.onLoad) {
        await pack.onLoad(targetRuntime, world)
      }

      // Load visual configuration
      if (pack.visuals) {
        this.loadVisualConfig(pack.visuals)
      }

      // Initialize game systems
      if (pack.systems && pack.systems.length > 0) {
        const systems = await this.initializeSystems(pack.systems, world)
        this.activeSystems.set(pack.id, systems)
      }

      // Register actions dynamically
      if (pack.actions && pack.actions.length > 0) {
        const actionLoader = this.service.getDynamicActionLoader?.()
        if (actionLoader) {
          for (const action of pack.actions) {
            await actionLoader.registerAction(action as any, this.runtime)
          }
        } else {
          // Fallback to runtime registration
          pack.actions.forEach(action => {
            if (
              'registerAction' in targetRuntime &&
              typeof targetRuntime.registerAction === 'function'
            ) {
              targetRuntime.registerAction(action)
            }
          })
        }
      }

      // Register providers
      if (pack.providers && pack.providers.length > 0) {
        pack.providers.forEach(provider => {
          targetRuntime.registerProvider(provider)
        })
      }

      // Register evaluators
      if (pack.evaluators && pack.evaluators.length > 0) {
        pack.evaluators.forEach(evaluator => {
          targetRuntime.registerEvaluator(evaluator)
        })
      }

      // Initialize state manager
      if (pack.stateManager) {
        // Initialize for current player
        const playerId = world?.player?.id || 'default'
        pack.stateManager.initPlayerState(playerId)
      }

      this.loadedPacks.set(pack.id, pack)
      logger.info(`[ContentPackLoader] Successfully loaded pack: ${pack.id}`)
    } catch (error) {
      logger.error(`[ContentPackLoader] Failed to load pack ${pack.id}:`, error)
      throw error
    }
  }

  /**
   * Unload a content pack
   */
  async unloadPack(packId: string): Promise<void> {
    const pack = this.loadedPacks.get(packId)
    if (!pack) {
      logger.warn(`[ContentPackLoader] Pack ${packId} not loaded`)
      return
    }

    logger.info(`[ContentPackLoader] Unloading content pack: ${pack.name}`)

    try {
      const world = this.service.getWorld()

      // Execute onUnload hook if provided
      if (pack.onUnload) {
        await pack.onUnload(this.runtime, world)
      }

      // Cleanup game systems
      const systems = this.activeSystems.get(packId)
      if (systems) {
        for (const system of systems) {
          system.cleanup()
        }
        this.activeSystems.delete(packId)
      }

      // TODO: Unregister actions, providers, evaluators
      // This requires tracking in the runtime

      this.loadedPacks.delete(packId)
      logger.info(`[ContentPackLoader] Successfully unloaded pack: ${packId}`)
    } catch (error) {
      logger.error(
        `[ContentPackLoader] Failed to unload pack ${packId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Get all loaded packs
   */
  getLoadedPacks(): IContentPack[] {
    return Array.from(this.loadedPacks.values())
  }

  /**
   * Check if a pack is loaded
   */
  isPackLoaded(packId: string): boolean {
    return this.loadedPacks.has(packId)
  }

  /**
   * Load visual configuration into the world
   */
  private loadVisualConfig(visuals: any): void {
    const world = this.service.getWorld()

    // Register entity colors for visual detection
    if (visuals.entityColors && world?.colorDetector) {
      Object.entries(visuals.entityColors).forEach(
        ([entityType, config]: [string, any]) => {
          world.colorDetector.registerEntityColor(entityType, config)
        }
      )
    }

    // Apply UI theme if provided
    if (visuals.uiTheme && world?.ui) {
      (world.ui as any).applyTheme(visuals.uiTheme)
    }

    // Load assets
    if (visuals.assets && (world as any)?.assetLoader) {
      if (visuals.assets.models) {
        visuals.assets.models.forEach((url: string) => {
          (world as any).assetLoader.loadModel(url)
        })
      }
      // Load other asset types...
    }
  }

  /**
   * Initialize game systems
   */
  private async initializeSystems(
    systems: IGameSystem[],
    world: any
  ): Promise<IGameSystem[]> {
    const initialized: IGameSystem[] = []

    for (const system of systems) {
      try {
        await system.init(world)
        initialized.push(system)
        logger.info(`[ContentPackLoader] Initialized system: ${system.name}`)
      } catch (error) {
        logger.error(
          `[ContentPackLoader] Failed to initialize system ${system.name}:`,
          error
        )
      }
    }

    return initialized
  }

  /**
   * Update all active systems (called from game loop)
   */
  updateSystems(deltaTime: number): void {
    for (const [packId, systems] of this.activeSystems) {
      for (const system of systems) {
        if (system.update) {
          try {
            system.update(deltaTime)
          } catch (error) {
            logger.error(
              `[ContentPackLoader] Error updating system in pack ${packId}:`,
              error
            )
          }
        }
      }
    }
  }

  /**
   * Get state manager for a loaded pack
   */
  getPackStateManager(packId: string): any {
    const pack = this.loadedPacks.get(packId)
    return pack?.stateManager
  }
}
