/**
 * Content Packs Export Index
 *
 * Centralized exports for all available content packs in the plugin-hyperscape system.
 */

export { RunescapeRPGPack as RPGContentPack } from "./content-pack.js";
export { default as RunescapeRPGPack } from "./content-pack.js";

// Re-export types for convenience
export type {
  IContentPack,
  IGameSystem,
  IVisualConfig,
} from "../types/content-pack.js";
