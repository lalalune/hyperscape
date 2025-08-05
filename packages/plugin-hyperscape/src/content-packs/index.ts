/**
 * Content Packs Export Index
 *
 * Centralized exports for all available content packs in the plugin-hyperscape system.
 */

export { RunescapeRPGPack as RPGContentPack } from './rpg-content-pack'
export { default as RunescapeRPGPack } from './rpg-content-pack'

// Re-export types for convenience
export type {
  IContentPack,
  IGameSystem,
  IVisualConfig,
} from '../types/content-pack'
