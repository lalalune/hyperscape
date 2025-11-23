/**
 * Embedded Viewport Configuration Types
 *
 * Types for embedded Hyperscape client configuration when running in viewport mode
 */

/**
 * Viewport mode options
 */
export type ViewportMode = "spectator" | "free";

/**
 * Graphics quality presets
 */
export type GraphicsQuality = "low" | "medium" | "high";

/**
 * UI elements that can be hidden in viewport mode
 */
export type HideableUIElement =
  | "chat"
  | "inventory"
  | "minimap"
  | "hotbar"
  | "stats";

/**
 * Embedded viewport configuration injected via window.__HYPERSCAPE_CONFIG__
 */
export interface EmbeddedViewportConfig {
  agentId: string;
  authToken: string;
  characterId?: string;
  wsUrl: string;
  mode: ViewportMode;
  followEntity?: string;
  hiddenUI?: HideableUIElement[];
  quality?: GraphicsQuality;
  sessionToken: string;
}

/**
 * Viewport performance settings injected via window.__HYPERSCAPE_VIEWPORT_SETTINGS__
 */
export interface ViewportSettings {
  targetFPS: number;
  quality: GraphicsQuality;
  renderOnlyWhenVisible: boolean;
}

/**
 * Check if running in embedded viewport mode
 */
export function isEmbeddedMode(): boolean {
  return !!(window as any).__HYPERSCAPE_EMBEDDED__;
}

/**
 * Get embedded viewport configuration
 */
export function getEmbeddedConfig(): EmbeddedViewportConfig | null {
  return (window as any).__HYPERSCAPE_CONFIG__ || null;
}

/**
 * Get viewport performance settings
 */
export function getViewportSettings(): ViewportSettings | null {
  return (window as any).__HYPERSCAPE_VIEWPORT_SETTINGS__ || null;
}

/**
 * Check if a UI element should be hidden
 */
export function isUIElementHidden(element: HideableUIElement): boolean {
  const config = getEmbeddedConfig();
  if (!config || !config.hiddenUI) return false;
  return config.hiddenUI.includes(element);
}

/**
 * Graphics quality preset configurations
 */
export const QUALITY_PRESETS = {
  low: {
    shadows: false,
    antialiasing: false,
    lodDistance: 50,
    maxParticles: 50,
    renderScale: 0.75,
  },
  medium: {
    shadows: false,
    antialiasing: true,
    lodDistance: 100,
    maxParticles: 100,
    renderScale: 1.0,
  },
  high: {
    shadows: true,
    antialiasing: true,
    lodDistance: 200,
    maxParticles: 200,
    renderScale: 1.0,
  },
} as const;

/**
 * Get quality preset for current config
 */
export function getQualityPreset() {
  const config = getEmbeddedConfig();
  const quality = config?.quality || "medium";
  return QUALITY_PRESETS[quality];
}
