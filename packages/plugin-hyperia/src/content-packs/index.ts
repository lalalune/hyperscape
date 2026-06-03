/**
 * Content Packs Export Index
 *
 * Centralized exports for all available content packs in the plugin-hyperia system.
 */

export { RunescapeRPGPack as RPGContentPack } from "./content-pack.js";
export { default as RunescapeRPGPack } from "./content-pack.js";

// Character profiles for agent personality differentiation
export {
  CHARACTER_PROFILES,
  getCharacterProfile,
  getAvailableProfiles,
} from "./character-profiles.js";
export type { CharacterProfile } from "./character-profiles.js";

// Re-export types for convenience
export type {
  IContentPack,
  IGameSystem,
  IVisualConfig,
} from "../types/content-pack.js";
