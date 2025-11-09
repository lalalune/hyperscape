/**
 * roundRect.ts - Canvas Rounded Rectangle Utilities
 *
 * Helper functions for drawing rounded rectangles on HTML5 canvas.
 * Used by UI system for rendering buttons, panels, and containers with rounded corners.
 *
 * Functions:
 * - roundRect(): Creates rounded rect path (call before fill/stroke)
 * - fillRoundRect(): Draws filled rounded rectangle
 * - strokeRoundRect(): Draws outlined rounded rectangle
 * - imageRoundRect(): Draws image clipped to rounded rectangle
 *
 * Usage:
 * ```ts
 * const canvas = document.createElement('canvas');
 * const ctx = canvas.getContext('2d')!;
 *
 * // Fill a rounded rect
 * fillRoundRect(ctx, 10, 10, 100, 50, 8, '#4169e1');
 * ```
 *
 * Referenced by: UI nodes (UIView, UIText), UIRenderer, nametag system
 */

/**
 * Draw rounded rectangle path on canvas.
 *
 * Creates a path with rounded corners. Call this inside a beginPath()/fill()/stroke() block.
 * Automatically clamps radius to fit within rectangle dimensions.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param radius - Corner radius (clamped to fit)
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  if (!radius) {
    ctx.rect(x, y, width, height);
    return;
  }

  // Clamp radius to fit within rectangle
  const maxRadius = Math.min(width / 2, height / 2);
  radius = Math.min(radius, maxRadius);

  // Draw path with rounded corners (clockwise from top-left)
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0); // Top-right corner
  ctx.lineTo(x + width, y + height - radius);
  ctx.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2); // Bottom-right corner
  ctx.lineTo(x + radius, y + height);
  ctx.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI); // Bottom-left corner
  ctx.lineTo(x, y + radius);
  ctx.arc(x + radius, y + radius, radius, Math.PI, (Math.PI * 3) / 2); // Top-left corner
  ctx.closePath();
}

/**
 * Fill a rounded rectangle.
 *
 * Convenience function that creates path and fills in one call.
 *
 * @param fillStyle - Fill color/gradient/pattern
 */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient | CanvasPattern,
): void {
  ctx.beginPath();
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/**
 * Stroke a rounded rectangle outline.
 *
 * Convenience function that creates path and strokes in one call.
 *
 * @param strokeStyle - Stroke color/gradient/pattern
 * @param lineWidth - Line width in pixels (default 1)
 */
export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string | CanvasGradient | CanvasPattern,
  lineWidth = 1,
): void {
  ctx.beginPath();
  roundRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Draw image clipped to rounded rectangle.
 *
 * Draws an image that fits within a rounded rectangle shape.
 * Supports custom image dimensions for object-fit style behavior.
 *
 * @param img - Image source to draw
 * @param imgX - Optional: Image X position (for object-fit)
 * @param imgY - Optional: Image Y position
 * @param imgWidth - Optional: Image width
 * @param imgHeight - Optional: Image height
 */
export function imageRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  img: CanvasImageSource,
  imgX?: number,
  imgY?: number,
  imgWidth?: number,
  imgHeight?: number,
): void {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip(); // Clip to rounded rect shape

  if (
    imgX !== undefined &&
    imgY !== undefined &&
    imgWidth !== undefined &&
    imgHeight !== undefined
  ) {
    // Custom dimensions (for object-fit behavior)
    ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
  } else {
    // Default: fill entire rect
    ctx.drawImage(img, x, y, width, height);
  }

  ctx.restore(); // Restore context to remove clipping
}
