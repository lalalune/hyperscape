/**
 * HealthBarRenderer - Centralized health bar rendering logic
 *
 * Provides core drawing functions for health bars used by:
 * - UIRenderer (sprite-based health bars for mobs/entities)
 * - Nametags (atlas-based health bars for players)
 *
 * Single source of truth for health bar appearance (colors, dimensions, style).
 */

/// <reference lib="dom" />

/**
 * Health bar color scheme (RuneScape style)
 */
export const HEALTH_BAR_COLORS = {
  /** Red background for depleted health */
  BACKGROUND: "#b91c1c",
  /** Green fill for current health */
  FILL: "#4CAF50",
  /** White border */
  BORDER: "#ffffff",
} as const;

/**
 * Health bar dimensions - SINGLE SOURCE OF TRUTH
 * Used by both player nametags and mob sprites for consistent appearance
 */
export const HEALTH_BAR_DIMENSIONS = {
  /** Canvas width in pixels (2x resolution for sharpness) */
  WIDTH: 160,
  /** Canvas height in pixels (2x resolution for sharpness) */
  HEIGHT: 16,
  /** Border width in pixels */
  BORDER_WIDTH: 2,
  /** Sprite scale for world-space rendering (mob health bars) */
  SPRITE_SCALE: 0.0125, // 160px * 0.0125 = 2.0 world units width
} as const;

/**
 * Style options for health bar rendering
 */
export interface HealthBarStyle {
  backgroundColor?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * Options for creating a standalone health bar canvas
 */
export interface HealthBarCanvasOptions extends HealthBarStyle {
  width?: number;
  height?: number;
}

/**
 * Draw a health bar on an existing canvas context
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position to draw at
 * @param y - Y position to draw at
 * @param width - Width of the health bar
 * @param height - Height of the health bar
 * @param healthPercent - Health percentage (0-1)
 * @param style - Optional style overrides
 */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  healthPercent: number,
  style: HealthBarStyle = {},
): void {
  const {
    backgroundColor = HEALTH_BAR_COLORS.BACKGROUND,
    fillColor = HEALTH_BAR_COLORS.FILL,
    borderColor = HEALTH_BAR_COLORS.BORDER,
    borderWidth = 1,
  } = style;

  // Clamp health percent
  const percent = Math.max(0, Math.min(1, healthPercent));

  // Draw background (red - depleted health)
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(x, y, width, height);

  // Draw health fill (green - current health)
  const fillWidth = (width - borderWidth * 2) * percent;
  ctx.fillStyle = fillColor;
  ctx.fillRect(
    x + borderWidth,
    y + borderWidth,
    fillWidth,
    height - borderWidth * 2,
  );

  // Draw border
  if (borderWidth > 0) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(
      x + borderWidth / 2,
      y + borderWidth / 2,
      width - borderWidth,
      height - borderWidth,
    );
  }
}

/**
 * Clear a health bar area on a canvas context
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position
 * @param y - Y position
 * @param width - Width to clear
 * @param height - Height to clear
 * @param padding - Extra padding around the area (default: 2)
 */
export function clearHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number = 2,
): void {
  ctx.clearRect(
    x - padding,
    y - padding,
    width + padding * 2,
    height + padding * 2,
  );
}

/**
 * Create a standalone canvas with a health bar
 *
 * @param currentHealth - Current health value
 * @param maxHealth - Maximum health value
 * @param options - Canvas size and style options
 * @returns HTMLCanvasElement with rendered health bar
 */
export function createHealthBarCanvas(
  currentHealth: number,
  maxHealth: number,
  options: HealthBarCanvasOptions = {},
): HTMLCanvasElement {
  const {
    width = 50,
    height = 3,
    backgroundColor = HEALTH_BAR_COLORS.BACKGROUND,
    fillColor = HEALTH_BAR_COLORS.FILL,
    borderColor = HEALTH_BAR_COLORS.BORDER,
    borderWidth = 1,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  const healthPercent = maxHealth > 0 ? currentHealth / maxHealth : 0;

  drawHealthBar(ctx, 0, 0, width, height, healthPercent, {
    backgroundColor,
    fillColor,
    borderColor,
    borderWidth,
  });

  return canvas;
}

/**
 * Update an existing health bar canvas
 *
 * @param canvas - Existing canvas to update
 * @param currentHealth - Current health value
 * @param maxHealth - Maximum health value
 * @param options - Style options
 */
export function updateHealthBarCanvas(
  canvas: HTMLCanvasElement,
  currentHealth: number,
  maxHealth: number,
  options: HealthBarCanvasOptions = {},
): void {
  const ctx = canvas.getContext("2d")!;
  const width = canvas.width;
  const height = canvas.height;

  const {
    backgroundColor = HEALTH_BAR_COLORS.BACKGROUND,
    fillColor = HEALTH_BAR_COLORS.FILL,
    borderColor = HEALTH_BAR_COLORS.BORDER,
    borderWidth = 1,
  } = options;

  const healthPercent = maxHealth > 0 ? currentHealth / maxHealth : 0;

  // Clear and redraw
  ctx.clearRect(0, 0, width, height);
  drawHealthBar(ctx, 0, 0, width, height, healthPercent, {
    backgroundColor,
    fillColor,
    borderColor,
    borderWidth,
  });
}
