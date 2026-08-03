/**
 * ActionBarPanel - Individual slot component
 */

import React, {
  memo,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CursorTooltip, useTheme } from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import { getInteractiveTileStyle, getPanelInsetStyle } from "@/ui/theme/themes";
import type { ActionBarSlotContent } from "./types";
import { getSlotIcon, SLOT_SIZE } from "./utils";

/** Combat style SVG icons for action bar - distinct visual for each style */
const CombatStyleIcon = ({
  styleId,
  size = 18,
  isActive,
}: {
  styleId: string;
  size?: number;
  isActive?: boolean;
}) => {
  // Use active colors when the style is currently selected
  const activeColors: Record<string, string> = {
    accurate: "#ef4444", // red
    aggressive: "#22c55e", // green
    defensive: "#3b82f6", // blue
    controlled: "#a855f7", // purple
  };
  const color = isActive ? activeColors[styleId] || "#fbbf24" : "currentColor";

  switch (styleId) {
    case "accurate":
      // Target/bullseye - concentric circles
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill={color} />
        </svg>
      );
    case "aggressive":
      // Double swords crossing - attack power
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4l7.5 7.5-7.5 7.5" />
          <path d="M5.5 4l7.5 7.5-7.5 7.5" />
        </svg>
      );
    case "defensive":
      // Shield - protection
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "controlled":
      // Balance scale - balanced training
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    default:
      return <span>⚔️</span>;
  }
};

export interface ActionBarSlotProps {
  slot: ActionBarSlotContent;
  slotIndex: number;
  slotSize: number;
  shortcut: string;
  isHovered: boolean;
  isActive: boolean;
  isLocked: boolean;
  /** modern MMORPG-style: Whether item is available in inventory (for item slots) */
  isAvailable?: boolean;
  /** Current quantity in inventory (for item slots) */
  inventoryQuantity?: number;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const ActionBarSlot = memo(function ActionBarSlot({
  slot,
  slotIndex,
  slotSize,
  shortcut,
  isHovered,
  isActive,
  isLocked,
  isAvailable = true,
  inventoryQuantity,
  onHover,
  onLeave,
  onClick,
  onContextMenu,
}: ActionBarSlotProps) {
  const theme = useTheme();
  const [hoverState, setHoverState] = useState<{ x: number; y: number } | null>(
    null,
  );
  const isEmpty = slot.type === "empty";
  const isPrayer = slot.type === "prayer";
  const isCombatStyle = slot.type === "combatstyle";
  const isItem = slot.type === "item";
  // modern MMORPG behavior: Items are dimmed when not available in inventory
  const isUnavailable = isItem && !isAvailable;
  // Combat styles and prayers both have active states
  const hasActiveState = isPrayer || isCombatStyle;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `actionbar-slot-${slotIndex}`,
    data: { slot, slotIndex, source: "actionbar" },
    disabled: isEmpty || isLocked,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `actionbar-drop-${slotIndex}`,
    data: { slotIndex, target: "actionbar" },
  });

  // Track drag and long press state
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Wrap pointer handlers
  const wrappedListeners = useMemo(() => {
    if (!listeners) return {};

    const originalPointerDown = listeners.onPointerDown;

    return {
      ...listeners,
      onPointerDown: (e: React.PointerEvent) => {
        longPressTriggeredRef.current = false;
        pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

        // Long-press for touch devices
        if (e.pointerType === "touch" && !isEmpty) {
          clearLongPressTimer();
          longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            const syntheticEvent = {
              preventDefault: () => {},
              clientX: e.clientX,
              clientY: e.clientY,
            } as React.MouseEvent;
            onContextMenu(syntheticEvent);
          }, 500);
        }

        originalPointerDown?.(e);
      },
      onPointerUp: () => {
        clearLongPressTimer();
      },
      onPointerCancel: () => {
        clearLongPressTimer();
      },
    };
  }, [listeners, isEmpty, onContextMenu, clearLongPressTimer]);

  // Handle click
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        return;
      }

      if (pointerStartPosRef.current) {
        const dx = e.clientX - pointerStartPosRef.current.x;
        const dy = e.clientY - pointerStartPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 3) {
          return;
        }
      }

      onClick();
    },
    [onClick],
  );

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  // Combine refs
  const combinedRef = (node: HTMLButtonElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const icon = getSlotIcon(slot);

  const slotStyle = useMemo(
    (): React.CSSProperties => ({
      width: slotSize,
      height: slotSize,
      ...getInteractiveTileStyle(theme, {
        active: hasActiveState && isActive,
        hovered: isHovered,
        dragging: isDragging,
        disabled: isUnavailable,
        dropTarget: isOver,
        radius: 4,
      }),
      background: isEmpty
        ? getPanelInsetStyle(theme, { radius: 4 }).background
        : undefined,
      border: isEmpty
        ? `1px solid ${theme.colors.border.default}66`
        : isUnavailable
          ? `1px solid ${theme.colors.state.danger}40`
          : undefined,
      cursor:
        isEmpty || isLocked ? "default" : isDragging ? "grabbing" : "grab",
      // modern MMORPG behavior: dim unavailable items
      opacity: isDragging ? 0.3 : isUnavailable ? 0.5 : 1,
      transform: isOver
        ? "scale(1.05)"
        : isDragging
          ? "scale(0.95)"
          : "scale(1)",
      touchAction: "none",
      boxShadow:
        hasActiveState && isActive
          ? `0 0 12px ${theme.colors.accent.primary}80, inset 0 0 15px ${theme.colors.accent.primary}33`
          : isOver
            ? `0 0 8px ${theme.colors.accent.primary}66`
            : `inset 0 2px 4px rgba(0, 0, 0, 0.4)`,
    }),
    [
      isEmpty,
      hasActiveState,
      isActive,
      isOver,
      isHovered,
      isDragging,
      isLocked,
      isUnavailable,
      slotSize,
      theme,
    ],
  );

  const tooltipLabel = isEmpty
    ? `Empty slot (${shortcut})`
    : isUnavailable
      ? `${slot.label || slot.itemId || "Unknown"} - Not in inventory (${shortcut})`
      : `${slot.label || slot.itemId || slot.skillId || "Unknown"} (${shortcut})`;

  return (
    <>
      <button
        ref={combinedRef}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        onMouseEnter={(e) => {
          onHover();
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => {
          onLeave();
          setHoverState(null);
        }}
        className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        style={slotStyle}
        {...attributes}
        {...wrappedListeners}
      >
        {/* Icon */}
        {!isEmpty && (
          <div
            className="flex items-center justify-center h-full"
            style={{
              fontSize: 16,
              filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))",
            }}
          >
            {isCombatStyle && slot.combatStyleId ? (
              <CombatStyleIcon
                styleId={slot.combatStyleId}
                size={18}
                isActive={isActive}
              />
            ) : (
              icon
            )}
          </div>
        )}

        {/* Quantity Badge - modern MMORPG style: shows actual inventory quantity */}
        {slot.type === "item" &&
          (() => {
            // Use inventory quantity if provided, otherwise fall back to slot quantity
            const qty = inventoryQuantity ?? slot.quantity ?? 0;
            if (qty <= 0) return null;
            return (
              <div
                className="absolute font-bold"
                style={{
                  bottom: 1,
                  right: 1,
                  background: theme.colors.background.overlay,
                  color: isUnavailable
                    ? theme.colors.state.danger
                    : theme.colors.text.primary,
                  fontSize: 8,
                  padding: "0px 2px",
                  borderRadius: 2,
                  lineHeight: 1.1,
                }}
              >
                {qty > 999999
                  ? `${Math.floor(qty / 1000000)}M`
                  : qty > 999
                    ? `${Math.floor(qty / 1000)}K`
                    : qty}
              </div>
            );
          })()}

        {/* Shortcut Key */}
        <div
          className="absolute font-bold"
          style={{
            top: 1,
            left: 2,
            color: isEmpty
              ? `${theme.colors.text.secondary}80`
              : `${theme.colors.text.secondary}A6`,
            fontSize: 7,
            textShadow: "0 1px 1px rgba(0, 0, 0, 0.6)",
          }}
        >
          {shortcut}
        </div>
      </button>

      {hoverState && (
        <CursorTooltip
          visible={true}
          position={hoverState}
          estimatedSize={{ width: 180, height: 48 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: "140px",
            maxWidth: "260px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            {tooltipLabel}
          </div>
          {!isEmpty && (
            <div style={{ ...getTooltipMetaStyle(theme), marginTop: "4px" }}>
              Drag to reorder
            </div>
          )}
        </CursorTooltip>
      )}
    </>
  );
});

/** Rubbish bin component for drag-to-delete functionality */
export const RubbishBin = memo(function RubbishBin({
  onContextMenu,
  isDragging,
}: {
  onContextMenu: (e: React.MouseEvent) => void;
  isDragging: boolean;
}) {
  const theme = useTheme();
  const [hoverState, setHoverState] = useState<{ x: number; y: number } | null>(
    null,
  );
  const { setNodeRef, isOver } = useDroppable({
    id: "actionbar-rubbish-bin",
    data: { target: "rubbish-bin" },
  });

  return (
    <>
      <button
        ref={setNodeRef}
        onContextMenu={onContextMenu}
        onMouseEnter={(e) => {
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => setHoverState(null)}
        className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        style={{
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          ...getInteractiveTileStyle(theme, {
            active: false,
            hovered: isDragging,
            dropTarget: isOver,
            radius: 4,
            accentColor: theme.colors.state.danger,
          }),
          border: isOver
            ? `2px solid ${theme.colors.state.danger}B3`
            : isDragging
              ? `1px dashed ${theme.colors.state.warning}80`
              : `1px solid ${theme.colors.border.default}66`,
          cursor: "default",
          opacity: isDragging ? 1 : 0.6,
          transform: isOver ? "scale(1.1)" : "scale(1)",
          boxShadow: isOver
            ? `0 0 12px ${theme.colors.state.danger}80, inset 0 0 15px ${theme.colors.state.danger}33`
            : `inset 0 2px 4px rgba(0, 0, 0, 0.4)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        🗑️
      </button>

      {hoverState && (
        <CursorTooltip
          visible={true}
          position={hoverState}
          estimatedSize={{ width: 170, height: 44 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: "140px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            Drag items here to remove them
          </div>
        </CursorTooltip>
      )}
    </>
  );
});
