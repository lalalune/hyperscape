/**
 * Touch Action Bar Component
 *
 * Mobile-optimized action bar with 5 slots (classic MMORPG-mobile pattern).
 * Features:
 * - 48x48px minimum touch targets
 * - 8px spacing between targets
 * - Swipe gestures for bar switching
 *
 * @packageDocumentation
 */

import React, { useState, useRef, useCallback } from "react";
import { useTheme } from "../stores/themeStore";
import { useIsTouchDevice } from "../core/responsive";
import type { ActionSlot } from "./ActionBar";

/** Props for TouchActionBar */
export interface TouchActionBarProps {
  /** Array of action bars (max 5 slots each) */
  bars: Array<{
    id: number;
    slots: ActionSlot[];
  }>;
  /** Currently active bar index */
  activeBarIndex: number;
  /** Callback when bar is changed via swipe */
  onBarChange?: (index: number) => void;
  /** Callback when action is clicked */
  onActionClick?: (slot: ActionSlot, barIndex: number) => void;
  /** Callback when action is long-pressed */
  onActionLongPress?: (slot: ActionSlot, barIndex: number) => void;
  /** Slot size (default 48 for mobile) */
  slotSize?: number;
  /** Gap between slots */
  gap?: number;
  /** Orientation: horizontal (default) or vertical */
  orientation?: "horizontal" | "vertical";
  /** Hide container background and border (minimal mode) */
  minimal?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

/** Single touch slot component */
function TouchSlot({
  slot,
  size,
  onClick,
  onLongPress,
  hideKeybinds = false,
  minimal = false,
}: {
  slot: ActionSlot;
  size: number;
  onClick?: () => void;
  onLongPress?: () => void;
  hideKeybinds?: boolean;
  minimal?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = useCallback(() => {
    setIsPressed(true);
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress();
        setIsPressed(false);
      }, 500);
    }
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isPressed) {
      onClick?.();
    }
    setIsPressed(false);
  }, [isPressed, onClick]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressed(false);
  }, []);

  const isEmpty = !slot.action;
  const isOnCooldown = slot.cooldownRemaining && slot.cooldownRemaining > 0;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{
        width: size,
        height: size,
        backgroundColor: isEmpty
          ? theme.colors.slot.empty
          : isPressed
            ? theme.colors.slot.selected
            : theme.colors.slot.filled,
        border: minimal
          ? `1px solid ${theme.colors.border.default}`
          : `1px solid ${isEmpty ? theme.colors.border.default : theme.colors.border.decorative}`,
        borderRadius: minimal ? 0 : theme.borderRadius.sm,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        touchAction: "manipulation",
        userSelect: "none",
        transform: isPressed ? "scale(0.95)" : "scale(1)",
        transition: "transform 0.1s ease, background-color 0.1s ease",
        boxShadow: minimal ? "none" : isEmpty ? "none" : theme.shadows.sm,
      }}
    >
      {/* Action icon */}
      {slot.action && (
        <span
          style={{
            fontSize: size * 0.5,
            opacity: isOnCooldown ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {typeof slot.action.icon === "string" ? (
            slot.action.icon
          ) : (
            <slot.action.icon size={size * 0.5} />
          )}
        </span>
      )}

      {/* Cooldown overlay */}
      {isOnCooldown && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            borderRadius: theme.borderRadius.md - 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: theme.colors.text.primary,
            }}
          >
            {Math.ceil(slot.cooldownRemaining! / 1000)}
          </span>
        </div>
      )}

      {/* Keybind indicator (bottom) - hidden on mobile */}
      {slot.keybind && !hideKeybinds && (
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            fontSize: 9,
            fontWeight: 600,
            color: theme.colors.text.muted,
            textShadow: "0 0 2px black",
          }}
        >
          {slot.keybind}
        </span>
      )}
    </div>
  );
}

/**
 * Touch Action Bar
 *
 * Mobile-optimized action bar with large touch targets and swipe
 * gestures for switching between bars.
 *
 * @example
 * ```tsx
 * <TouchActionBar
 *   bars={[
 *     { id: 0, slots: createActionBar(0).slots.slice(0, 5) },
 *     { id: 1, slots: createActionBar(1).slots.slice(0, 5) },
 *   ]}
 *   activeBarIndex={0}
 *   onBarChange={(index) => setActiveBar(index)}
 *   onActionClick={(slot) => executeAction(slot.action)}
 * />
 * ```
 */
export function TouchActionBar({
  bars,
  activeBarIndex,
  onBarChange,
  onActionClick,
  onActionLongPress,
  slotSize = 48,
  gap = 8,
  orientation = "horizontal",
  minimal = false,
  className,
  style,
}: TouchActionBarProps): React.ReactElement {
  const theme = useTheme();
  const isTouch = useIsTouchDevice();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const activeBar = bars[activeBarIndex];
  const slots = activeBar?.slots.slice(0, 5) || [];
  const isVertical = orientation === "vertical";

  // Handle swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Swipe detection based on orientation
      if (isVertical) {
        // Vertical: swipe up/down to change bars
        if (Math.abs(deltaY) > 50 && Math.abs(deltaY) > Math.abs(deltaX) * 2) {
          if (deltaY > 0 && activeBarIndex > 0) {
            onBarChange?.(activeBarIndex - 1);
          } else if (deltaY < 0 && activeBarIndex < bars.length - 1) {
            onBarChange?.(activeBarIndex + 1);
          }
        }
      } else {
        // Horizontal: swipe left/right to change bars
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
          if (deltaX > 0 && activeBarIndex > 0) {
            onBarChange?.(activeBarIndex - 1);
          } else if (deltaX < 0 && activeBarIndex < bars.length - 1) {
            onBarChange?.(activeBarIndex + 1);
          }
        }
      }

      touchStartRef.current = null;
    },
    [activeBarIndex, bars.length, onBarChange, isVertical],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: "flex",
        flexDirection: isVertical ? "row" : "column",
        alignItems: "center",
        gap: minimal ? 0 : theme.spacing.xs,
        padding: minimal ? 0 : `${theme.spacing.xs}px ${theme.spacing.sm}px`,
        backgroundColor: minimal
          ? "transparent"
          : theme.colors.background.overlay,
        borderRadius: minimal ? 0 : theme.borderRadius.md,
        border: minimal ? "none" : `1px solid ${theme.colors.border.default}`,
        boxShadow: minimal ? "none" : theme.shadows.md,
        touchAction: isVertical ? "pan-x" : "pan-y",
        ...style,
      }}
    >
      {/* Bar indicator dots */}
      {bars.length > 1 && !minimal && (
        <div
          style={{
            display: "flex",
            flexDirection: isVertical ? "column" : "row",
            gap: theme.spacing.xs,
            marginBottom: isVertical ? 0 : theme.spacing.xs,
            marginRight: isVertical ? theme.spacing.xs : 0,
          }}
        >
          {bars.map((bar, index) => (
            <div
              key={bar.id}
              onClick={() => onBarChange?.(index)}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor:
                  index === activeBarIndex
                    ? theme.colors.accent.primary
                    : theme.colors.background.tertiary,
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              }}
            />
          ))}
        </div>
      )}

      {/* Slots - horizontal or vertical */}
      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          gap: gap,
        }}
      >
        {slots.map((slot, index) => (
          <TouchSlot
            key={slot.index ?? index}
            slot={slot}
            size={slotSize}
            onClick={() => onActionClick?.(slot, activeBarIndex)}
            onLongPress={() => onActionLongPress?.(slot, activeBarIndex)}
            hideKeybinds={minimal}
            minimal={minimal}
          />
        ))}

        {/* Fill empty slots up to 5 */}
        {Array.from({ length: 5 - slots.length }).map((_, i) => (
          <TouchSlot
            key={`empty-${i}`}
            slot={{
              index: slots.length + i,
              action: null,
              keybind: "",
              cooldownRemaining: 0,
            }}
            size={slotSize}
            hideKeybinds={minimal}
            minimal={minimal}
          />
        ))}
      </div>

      {/* Swipe hint - only show when not minimal */}
      {isTouch && bars.length > 1 && !minimal && (
        <div
          style={{
            fontSize: 9,
            color: theme.colors.text.muted,
            marginTop: isVertical ? 0 : theme.spacing.xs,
            marginLeft: isVertical ? theme.spacing.xs : 0,
            writingMode: isVertical ? "vertical-rl" : undefined,
          }}
        >
          {isVertical ? "↑ Swipe ↓" : "← Swipe to switch bars →"}
        </div>
      )}
    </div>
  );
}
