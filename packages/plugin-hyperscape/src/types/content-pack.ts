import { Action, Provider, Evaluator, IAgentRuntime } from '@elizaos/core'

/**
 * Interface for modular content packs that can be loaded into Hyperscape
 */
export interface IContentPack {
  id: string
  name: string
  description: string
  version: string

  // Core functionality
  actions?: Action[]
  providers?: Provider[]
  evaluators?: Evaluator[]

  systems?: IGameSystem[]

  // Visual configuration
  visuals?: IVisualConfig

  // State management
  stateManager?: IStateManager

  // Lifecycle hooks
  onLoad?: (runtime: IAgentRuntime, world: any) => Promise<void>
  onUnload?: (runtime: IAgentRuntime, world: any) => Promise<void>
}

/**
 * Game system interface for modular gameplay features
 */
export interface IGameSystem {
  id: string
  name: string
  type: 'combat' | 'inventory' | 'skills' | 'quests' | 'trading' | 'custom'

  // System initialization
  init(world: any): Promise<void>

  // System update loop (if needed)
  update?(deltaTime: number): void

  // System cleanup
  cleanup(): void
}

/**
 * Visual configuration for content packs
 */
export interface IVisualConfig {
  // Entity color mappings for visual detection
  entityColors: Record<
    string,
    {
      color: number
      hex: string
      tolerance?: number
    }
  >

  // UI theme overrides
  uiTheme?: {
    primaryColor?: string
    secondaryColor?: string
    fonts?: Record<string, string>
  }

  // Asset manifests
  assets?: {
    models?: string[]
    textures?: string[]
    sounds?: string[]
    animations?: string[]
  }
}

/**
 * State manager interface for content pack state
 */
export interface IStateManager {
  // Initialize state for a player
  initPlayerState(playerId: string): any

  // Get current state
  getState(playerId: string): any

  // Update state
  updateState(playerId: string, updates: any): void

  // Subscribe to state changes
  subscribe(playerId: string, callback: (state: any) => void): () => void

  // Serialize/deserialize for persistence
  serialize(playerId: string): string
  deserialize(playerId: string, data: string): void
}

/**
 * Content pack loader interface
 */
export interface IContentPackLoader {
  // Load a content pack
  loadPack(pack: IContentPack, runtime: IAgentRuntime): Promise<void>

  // Unload a content pack
  unloadPack(packId: string): Promise<void>

  // Get loaded packs
  getLoadedPacks(): IContentPack[]

  // Check if pack is loaded
  isPackLoaded(packId: string): boolean
}
