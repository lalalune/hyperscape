/**
 * borderRoundRect.ts - Rounded Rectangle Border Drawing
 *
 * Draws a rounded rectangle border with proper inset calculation.
 * The border is drawn centered on the rectangle edge (half inside, half outside).
 *
 * Why a Separate Function:
 * - Canvas stroke is centered on path by default
 * - Need to inset path by thickness/2 for proper border appearance
 * - Radius must be adjusted to account for thickness
 *
 * Usage:
 * ```ts
 * ctx.lineWidth = 2;
 * ctx.strokeStyle = '#000';
 * borderRoundRect(ctx, 10, 10, 100, 50, 8, 2);
 * ```
 *
 * Referenced by: UI system for button borders, panel outlines
 */

/**
 * Draw rounded rectangle border.
 *
 * Draws a border that's properly centered on the rectangle edge.
 * Automatically adjusts path for border thickness to prevent overlap.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param radius - Corner radius
 * @param thickness - Border thickness in pixels
 */
export function borderRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  thickness: number,
): void {
  // Calculate inset rectangle (accounts for border width being centered on edge)
  const insetLeft = x + thickness / 2;
  const insetTop = y + thickness / 2;
  const insetWidth = width - thickness;
  const insetHeight = height - thickness;

  // Adjust radius to account for inset
  const adjustedRadius = Math.max(0, radius - thickness / 2);

  // Draw inset rounded rectangle path
  ctx.beginPath();
  ctx.moveTo(insetLeft + adjustedRadius, insetTop);
  ctx.lineTo(insetLeft + insetWidth - adjustedRadius, insetTop);
  ctx.arcTo(
    insetLeft + insetWidth,
    insetTop,
    insetLeft + insetWidth,
    insetTop + adjustedRadius,
    adjustedRadius,
  );
  ctx.lineTo(insetLeft + insetWidth, insetTop + insetHeight - adjustedRadius);
  ctx.arcTo(
    insetLeft + insetWidth,
    insetTop + insetHeight,
    insetLeft + insetWidth - adjustedRadius,
    insetTop + insetHeight,
    adjustedRadius,
  );
  ctx.lineTo(insetLeft + adjustedRadius, insetTop + insetHeight);
  ctx.arcTo(
    insetLeft,
    insetTop + insetHeight,
    insetLeft,
    insetTop + insetHeight - adjustedRadius,
    adjustedRadius,
  );
  ctx.lineTo(insetLeft, insetTop + adjustedRadius);
  ctx.arcTo(
    insetLeft,
    insetTop,
    insetLeft + adjustedRadius,
    insetTop,
    adjustedRadius,
  );
  ctx.closePath();
  ctx.stroke();
}
