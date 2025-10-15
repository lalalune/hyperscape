/**
 * Settings system types
 * 
 * These types are used for world settings, configuration,
 * and system initialization across the engine.
 */

/**
 * Settings data structure
 */
export interface SettingsData {
  title?: string | null;
  desc?: string | null;
  image?: string | null;
  model?: string | null;
  avatar?: string | null;
  public?: boolean | null;
  playerLimit?: number | null;
}

/**
 * Setting change tracking
 */
export interface SettingsChange {
  prev: unknown;
  value: unknown;
}

/**
 * Collection of setting changes
 */
export interface SettingsChanges {
  [key: string]: SettingsChange;
}

/**
 * Application configuration
 */
export interface AppConfig {
  [key: string]: unknown;
}

/**
 * Terrain configuration
 */
export interface TerrainConfig {
  [key: string]: unknown;
}