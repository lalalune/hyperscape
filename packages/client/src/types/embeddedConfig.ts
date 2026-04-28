/**
 * Embedded Viewport Configuration Types
 *
 * Types for embedded Hyperscape client configuration when running in viewport mode
 */

/**
 * Viewport mode options
 */
export type ViewportMode = "spectator" | "stream" | "free";

/**
 * Embedded surface variants
 * - viewport: passive live view
 * - agent-control: live view with command/log panels for steering the agent
 */
export type EmbeddedSurface = "viewport" | "agent-control";

/**
 * Graphics quality presets
 * - potato: Minimal effects for very old devices
 * - low: Basic rendering for older devices
 * - medium: Balanced quality and performance
 * - high: Good quality with most effects enabled
 * - ultra: Maximum quality with all effects
 */
export type GraphicsQuality = "potato" | "low" | "medium" | "high" | "ultra";

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
 *
 * @security
 * SECURITY NOTE: authToken and sessionToken should NEVER be passed via URL parameters.
 * URL parameters are exposed in:
 * - Browser history
 * - Server logs
 * - Referrer headers
 * - Browser extensions
 *
 * Instead, authToken/sessionToken should be passed via:
 * 1. postMessage from the parent window after the iframe loads
 * 2. Session-based authentication with the server
 *
 * The parent window should:
 * 1. Wait for 'HYPERSCAPE_READY' message from iframe
 * 2. Send 'HYPERSCAPE_AUTH' message with { type: 'HYPERSCAPE_AUTH', authToken: '...' }
 */
export interface EmbeddedViewportConfig {
  agentId: string;
  /**
   * Authentication token for API/WebSocket connections
   *
   * @security
   * This token is populated via postMessage from parent window,
   * NOT from URL parameters (which would be a security vulnerability)
   */
  authToken: string;
  characterId?: string;
  wsUrl: string;
  mode: ViewportMode;
  surface?: EmbeddedSurface;
  followEntity?: string;
  hiddenUI?: HideableUIElement[];
  quality?: GraphicsQuality;
  /** Session token for additional verification, sourced from the trusted parent bootstrap path */
  sessionToken: string;
  /** Privy user ID for authentication verification */
  privyUserId?: string;
}

/**
 * Viewport performance settings injected via window.__HYPERSCAPE_VIEWPORT_SETTINGS__
 */
export interface ViewportSettings {
  targetFPS: number;
  quality: GraphicsQuality;
  renderOnlyWhenVisible: boolean;
}

// Extend Window interface for Hyperscape globals
declare global {
  interface Window {
    __HYPERSCAPE_EMBEDDED__?: boolean;
    __HYPERSCAPE_CONFIG__?: EmbeddedViewportConfig;
    __HYPERSCAPE_VIEWPORT_SETTINGS__?: ViewportSettings;
  }
}

/**
 * Check if running in embedded viewport mode
 */
export function isEmbeddedMode(): boolean {
  return !!window.__HYPERSCAPE_EMBEDDED__;
}

/**
 * Get embedded viewport configuration
 */
export function getEmbeddedConfig(): EmbeddedViewportConfig | null {
  return window.__HYPERSCAPE_CONFIG__ || null;
}

/**
 * Get viewport performance settings
 */
export function getViewportSettings(): ViewportSettings | null {
  return window.__HYPERSCAPE_VIEWPORT_SETTINGS__ || null;
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
 * Used for both embedded mode and main game settings
 */
export interface QualityPresetConfig {
  /** Shadow quality: 'none' | 'low' | 'med' | 'high' */
  shadows: "none" | "low" | "med" | "high";
  /** Enable antialiasing */
  antialiasing: boolean;
  /** Enable post-processing effects */
  postProcessing: boolean;
  /** Enable bloom effect */
  bloom: boolean;
  /** Enable color grading */
  colorGrading: boolean;
  /** LOD distance for models */
  lodDistance: number;
  /** Maximum particles */
  maxParticles: number;
  /** Render scale (DPR multiplier) */
  renderScale: number;
  /** Vegetation density multiplier */
  vegetationDensity: number;
  /** View distance multiplier */
  viewDistance: number;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPresetConfig> = {
  potato: {
    shadows: "none",
    antialiasing: false,
    postProcessing: false,
    bloom: false,
    colorGrading: false,
    lodDistance: 30,
    maxParticles: 20,
    renderScale: 0.5,
    vegetationDensity: 0.25,
    viewDistance: 0.5,
  },
  low: {
    shadows: "none",
    antialiasing: false,
    postProcessing: false,
    bloom: false,
    colorGrading: false,
    lodDistance: 50,
    maxParticles: 50,
    renderScale: 0.75,
    vegetationDensity: 0.5,
    viewDistance: 0.75,
  },
  medium: {
    shadows: "low",
    antialiasing: true,
    postProcessing: true,
    bloom: false,
    colorGrading: true,
    lodDistance: 100,
    maxParticles: 100,
    renderScale: 1.0,
    vegetationDensity: 0.75,
    viewDistance: 1.0,
  },
  high: {
    shadows: "med",
    antialiasing: true,
    postProcessing: true,
    bloom: true,
    colorGrading: true,
    lodDistance: 200,
    maxParticles: 200,
    renderScale: 1.0,
    vegetationDensity: 1.0,
    viewDistance: 1.0,
  },
  ultra: {
    shadows: "high",
    antialiasing: true,
    postProcessing: true,
    bloom: true,
    colorGrading: true,
    lodDistance: 300,
    maxParticles: 500,
    renderScale: 1.0,
    vegetationDensity: 1.0,
    viewDistance: 1.25,
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

/**
 * Detect recommended quality level based on device capabilities
 * Uses GPU info, memory, and device type to recommend a quality level
 */
export function detectRecommendedQuality(): GraphicsQuality {
  // Check if we're on mobile
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  // Get device memory (if available)
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory;

  // Get hardware concurrency (logical processors)
  const cores = navigator.hardwareConcurrency || 4;

  // Check for WebGPU support (high-end indicator)
  const hasWebGPU = "gpu" in navigator;

  // Check for reduced motion preference (accessibility)
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Mobile detection
  if (isMobile) {
    // Low-end mobile
    if (deviceMemory && deviceMemory <= 2) {
      return "potato";
    }
    // Standard mobile
    if (deviceMemory && deviceMemory <= 4) {
      return "low";
    }
    // High-end mobile
    return "medium";
  }

  // Desktop detection
  if (prefersReducedMotion) {
    return "low";
  }

  // Very low-end desktop
  if (cores <= 2 || (deviceMemory && deviceMemory <= 2)) {
    return "potato";
  }

  // Low-end desktop
  if (cores <= 4 && deviceMemory && deviceMemory <= 4) {
    return "low";
  }

  // No WebGPU = likely older GPU
  if (!hasWebGPU) {
    return "medium";
  }

  // High-end desktop
  if (cores >= 8 && (!deviceMemory || deviceMemory >= 8)) {
    return "ultra";
  }

  // Good desktop
  if (cores >= 6 || (deviceMemory && deviceMemory >= 8)) {
    return "high";
  }

  // Default to medium
  return "medium";
}

/**
 * Get human-readable quality name
 */
export function getQualityDisplayName(quality: GraphicsQuality): string {
  const names: Record<GraphicsQuality, string> = {
    potato: "Potato (Minimum)",
    low: "Low",
    medium: "Medium",
    high: "High",
    ultra: "Ultra (Maximum)",
  };
  return names[quality];
}

/**
 * All available quality levels in order
 */
export const QUALITY_LEVELS: GraphicsQuality[] = [
  "potato",
  "low",
  "medium",
  "high",
  "ultra",
];
