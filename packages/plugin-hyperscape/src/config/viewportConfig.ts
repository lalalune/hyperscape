/**
 * Viewport Configuration
 *
 * Configuration and types for embedded Hyperscape agent viewports
 */

import { z } from "zod";

/**
 * Viewport mode options
 */
export type ViewportMode = "spectator" | "free";

/**
 * Graphics quality presets
 */
export type GraphicsQuality = "low" | "medium" | "high";

/**
 * UI elements that can be hidden
 */
export type HideableUIElement =
  | "chat"
  | "inventory"
  | "minimap"
  | "hotbar"
  | "stats";

/**
 * Embedded viewport configuration passed to client
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
  sessionToken: string; // Short-lived JWT for this viewport session
}

/**
 * Viewport query parameters schema
 */
export const viewportQuerySchema = z.object({
  mode: z.enum(["spectator", "free"]).optional().default("spectator"),
  followEntity: z.string().optional(),
  hiddenUI: z.string().optional(), // Comma-separated list
  quality: z.enum(["low", "medium", "high"]).optional().default("medium"),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
});

export type ViewportQueryParams = z.infer<typeof viewportQuerySchema>;

/**
 * Default viewport configuration
 */
export const DEFAULT_VIEWPORT_CONFIG = {
  mode: "spectator" as ViewportMode,
  quality: "medium" as GraphicsQuality,
  sessionTokenExpiry: 15 * 60 * 1000, // 15 minutes
  defaultWidth: 400,
  defaultHeight: 300,
  targetFPS: 30, // Lower FPS for viewports
  hiddenUIDefault: ["chat"] as HideableUIElement[], // Hide chat input by default
};

/**
 * Graphics quality settings
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
 * Parse hiddenUI query parameter into array
 */
export function parseHiddenUI(hiddenUIParam?: string): HideableUIElement[] {
  if (!hiddenUIParam) {
    return DEFAULT_VIEWPORT_CONFIG.hiddenUIDefault;
  }

  const elements = hiddenUIParam.split(",").map((s) => s.trim());
  const validElements: HideableUIElement[] = [];

  for (const element of elements) {
    if (["chat", "inventory", "minimap", "hotbar", "stats"].includes(element)) {
      validElements.push(element as HideableUIElement);
    }
  }

  return validElements.length > 0
    ? validElements
    : DEFAULT_VIEWPORT_CONFIG.hiddenUIDefault;
}
