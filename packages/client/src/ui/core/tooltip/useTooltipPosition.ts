/**
 * Tooltip Positioning Utility
 *
 * Provides intelligent tooltip positioning with automatic axis flipping
 * when tooltips would overflow viewport boundaries.
 *
 * Similar to Floating UI/Popper.js but lightweight and built for Hyperia UI.
 *
 * @packageDocumentation
 */

import type { Point, Size } from "../../types";

/** Placement options for tooltips */
export type TooltipPlacement =
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end"
  | "right"
  | "right-start"
  | "right-end";

/** Options for tooltip positioning */
export interface TooltipPositionOptions {
  /** Preferred placement (default: "bottom-start") */
  placement?: TooltipPlacement;
  /** Offset from anchor in pixels (default: 8) */
  offset?: number;
  /** Margin from viewport edges in pixels (default: 8) */
  viewportMargin?: number;
  /** Whether to flip when overflowing (default: true) */
  flip?: boolean;
  /** Whether to shift along axis to stay in viewport (default: true) */
  shift?: boolean;
}

/** Result from tooltip position calculation */
export interface TooltipPositionResult {
  /** X position (left) */
  x: number;
  /** Y position (top) */
  y: number;
  /** The actual placement after flipping (may differ from requested) */
  placement: TooltipPlacement;
  /** Whether the tooltip was flipped from original placement */
  flipped: boolean;
}

/**
 * Get current viewport dimensions
 */
function getViewport(): Size {
  if (typeof window !== "undefined") {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }
  return { width: 1920, height: 1080 };
}

/**
 * Get the opposite placement for flipping
 */
function getOppositePlacement(placement: TooltipPlacement): TooltipPlacement {
  const opposites: Record<string, string> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };

  const [side, align] = placement.split("-") as [string, string | undefined];
  const oppositeSide = opposites[side] || side;

  return (
    align ? `${oppositeSide}-${align}` : oppositeSide
  ) as TooltipPlacement;
}

/**
 * Calculate base position for a placement
 */
function getBasePosition(
  anchor: Point,
  tooltipSize: Size,
  placement: TooltipPlacement,
  offset: number,
): Point {
  const [side, align = "center"] = placement.split("-") as [string, string];

  let x = anchor.x;
  let y = anchor.y;

  // Position based on side
  switch (side) {
    case "top":
      y = anchor.y - tooltipSize.height - offset;
      break;
    case "bottom":
      y = anchor.y + offset;
      break;
    case "left":
      x = anchor.x - tooltipSize.width - offset;
      break;
    case "right":
      x = anchor.x + offset;
      break;
  }

  // Align along the cross-axis
  if (side === "top" || side === "bottom") {
    switch (align) {
      case "start":
        x = anchor.x;
        break;
      case "end":
        x = anchor.x - tooltipSize.width;
        break;
      case "center":
      default:
        x = anchor.x - tooltipSize.width / 2;
        break;
    }
  } else {
    switch (align) {
      case "start":
        y = anchor.y;
        break;
      case "end":
        y = anchor.y - tooltipSize.height;
        break;
      case "center":
      default:
        y = anchor.y - tooltipSize.height / 2;
        break;
    }
  }

  return { x, y };
}

/**
 * Check if position would overflow viewport
 */
function checkOverflow(
  position: Point,
  tooltipSize: Size,
  viewport: Size,
  margin: number,
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  return {
    top: position.y < margin,
    right: position.x + tooltipSize.width > viewport.width - margin,
    bottom: position.y + tooltipSize.height > viewport.height - margin,
    left: position.x < margin,
  };
}

/**
 * Calculate optimal tooltip position with automatic flipping and shifting.
 *
 * This implements RuneScape-style tooltip positioning where:
 * - Tooltips flip to the opposite side if they would overflow
 * - Tooltips shift along their axis to stay fully visible
 * - Maintains consistent offset from the anchor point
 *
 * @param anchor - The anchor point (usually mouse position or element center)
 * @param tooltipSize - Size of the tooltip element
 * @param options - Positioning options
 * @returns Calculated position and actual placement
 *
 * @example
 * ```tsx
 * const position = calculateTooltipPosition(
 *   { x: mouseX, y: mouseY },
 *   { width: 200, height: 100 },
 *   { placement: "bottom-start", offset: 12 }
 * );
 *
 * return (
 *   <div style={{ left: position.x, top: position.y }}>
 *     Tooltip content
 *   </div>
 * );
 * ```
 */
export function calculateTooltipPosition(
  anchor: Point,
  tooltipSize: Size,
  options: TooltipPositionOptions = {},
): TooltipPositionResult {
  const {
    placement: preferredPlacement = "bottom-start",
    offset = 8,
    viewportMargin = 8,
    flip = true,
    shift = true,
  } = options;

  const viewport = getViewport();
  let placement = preferredPlacement;
  let flipped = false;

  // Calculate initial position
  let position = getBasePosition(anchor, tooltipSize, placement, offset);

  // Check for overflow
  let overflow = checkOverflow(position, tooltipSize, viewport, viewportMargin);

  // Flip if needed
  if (flip) {
    const [side] = placement.split("-") as [string];
    const shouldFlip =
      (side === "top" && overflow.top) ||
      (side === "bottom" && overflow.bottom) ||
      (side === "left" && overflow.left) ||
      (side === "right" && overflow.right);

    if (shouldFlip) {
      const flippedPlacement = getOppositePlacement(placement);
      const flippedPosition = getBasePosition(
        anchor,
        tooltipSize,
        flippedPlacement,
        offset,
      );
      const flippedOverflow = checkOverflow(
        flippedPosition,
        tooltipSize,
        viewport,
        viewportMargin,
      );

      // Only flip if it actually helps
      const flippedSide = flippedPlacement.split("-")[0];
      const flippedIsBetter =
        (flippedSide === "top" && !flippedOverflow.top) ||
        (flippedSide === "bottom" && !flippedOverflow.bottom) ||
        (flippedSide === "left" && !flippedOverflow.left) ||
        (flippedSide === "right" && !flippedOverflow.right);

      if (flippedIsBetter) {
        placement = flippedPlacement;
        position = flippedPosition;
        overflow = flippedOverflow;
        flipped = true;
      }
    }
  }

  // Shift to stay in viewport
  if (shift) {
    // Horizontal shift
    if (overflow.left) {
      position.x = viewportMargin;
    } else if (overflow.right) {
      position.x = viewport.width - tooltipSize.width - viewportMargin;
    }

    // Vertical shift
    if (overflow.top) {
      position.y = viewportMargin;
    } else if (overflow.bottom) {
      position.y = viewport.height - tooltipSize.height - viewportMargin;
    }
  }

  // Final clamp to ensure we're in bounds
  position.x = Math.max(
    viewportMargin,
    Math.min(position.x, viewport.width - tooltipSize.width - viewportMargin),
  );
  position.y = Math.max(
    viewportMargin,
    Math.min(position.y, viewport.height - tooltipSize.height - viewportMargin),
  );

  return {
    x: position.x,
    y: position.y,
    placement,
    flipped,
  };
}

/**
 * Simple tooltip positioning for mouse-following tooltips.
 * Positions tooltip near cursor with automatic edge flipping.
 *
 * This is a simplified version optimized for cursor-following tooltips
 * like item hover info in inventory panels.
 *
 * @param mousePos - Current mouse position
 * @param tooltipSize - Estimated or measured tooltip size
 * @param cursorOffset - Offset from cursor (default: 16)
 * @param margin - Margin from viewport edge (default: 8)
 * @returns Position { left, top } for CSS
 *
 * @example
 * ```tsx
 * const { left, top } = calculateCursorTooltipPosition(
 *   { x: event.clientX, y: event.clientY },
 *   { width: 160, height: 100 }
 * );
 * ```
 */
export function calculateCursorTooltipPosition(
  mousePos: Point,
  tooltipSize: Size,
  cursorOffset: number = 4,
  margin: number = 8,
): { left: number; top: number } {
  const viewport = getViewport();

  let left = mousePos.x + cursorOffset;
  let top = mousePos.y + cursorOffset;

  // Flip horizontally if tooltip would overflow right edge
  if (left + tooltipSize.width > viewport.width - margin) {
    left = mousePos.x - tooltipSize.width - cursorOffset;
  }

  // Flip vertically if tooltip would overflow bottom edge
  if (top + tooltipSize.height > viewport.height - margin) {
    top = mousePos.y - tooltipSize.height - cursorOffset;
  }

  // Ensure we don't go off left or top edges
  left = Math.max(margin, left);
  top = Math.max(margin, top);

  return { left, top };
}

/** Common tooltip size estimates for edge detection */
export const TOOLTIP_SIZE_ESTIMATES = {
  /** Small tooltip (item name only) */
  small: { width: 120, height: 40 },
  /** Medium tooltip (name + 1-2 stats) */
  medium: { width: 160, height: 80 },
  /** Large tooltip (full item stats) */
  large: { width: 200, height: 120 },
  /** Extra large (equipment with full bonuses) */
  xlarge: { width: 240, height: 180 },
} as const;
