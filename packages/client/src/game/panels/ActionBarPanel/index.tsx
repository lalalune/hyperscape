/**
 * ActionBarPanel - A window-based action bar panel
 *
 * Features:
 * - Configurable slot count (4-12 slots, adjustable via +/- buttons)
 * - Drag items from inventory to action bar
 * - Drag skills/spells/prayers to action bar
 * - modern MMORPG-style keyboard shortcuts with modifier support:
 *   - Bar 1: 1-9, 0, -, =, Backspace, Insert
 *   - Bar 2: Ctrl+1-9, Ctrl+0, etc.
 *   - Bar 3: Shift+1-9, Shift+0, etc.
 *   - Bar 4: Alt+1-9, Alt+0, etc.
 *   - Bar 5: Q, W, E, R, T, Y, U, I, O, P, [, ], \
 * - Right-click context menu
 * - Multiple action bars support (up to 5)
 * - Horizontal or vertical layout orientation
 */

import React, { useCallback } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useTheme } from "@/ui";
import { getPanelInsetStyle, getPanelSurfaceStyle } from "@/ui/theme/themes";

// Types
export type {
  ActionBarSlotContent,
  ActionBarPanelProps,
  ActionBarSlotUpdatePayload,
} from "./types";

// Utils and constants
export {
  ACTION_BAR_DIMENSIONS,
  SLOT_SIZE,
  SLOT_GAP,
  PADDING,
  CONTROL_BUTTON_SIZE,
  CONTROL_BUTTON_GAP,
  MIN_SLOT_COUNT,
  MAX_SLOT_COUNT,
  getSlotIcon,
} from "./utils";

// Hooks
import { useActionBarState } from "./useActionBarState";
import { useActionBarDragDrop } from "./useActionBarDragDrop";
import {
  useContextMenu,
  ActionBarContextMenuPortal,
} from "./ActionBarContextMenu";

// Components
import { ActionBarSlot, RubbishBin } from "./ActionBarSlot";
import { ItemIcon } from "@/ui/components/ItemIcon";

// Local imports
import type { ActionBarPanelProps } from "./types";
import {
  SLOT_SIZE,
  SLOT_GAP,
  PADDING,
  CONTROL_BUTTON_SIZE,
  CONTROL_BUTTON_GAP,
  MIN_SLOT_COUNT,
  MAX_SLOT_COUNT,
  getSlotIcon,
  formatKeybindForDisplay,
} from "./utils";

export function ActionBarPanel({
  world,
  barId = 0,
  isEditMode = false,
  windowId,
  useParentDndContext = false,
  orientation = "horizontal",
  showShortcuts = true,
  showControls = true,
}: ActionBarPanelProps): React.ReactElement {
  const theme = useTheme();
  const isVertical = orientation === "vertical";

  // State management
  const {
    slotCount,
    slots,
    hoveredSlot,
    activePrayers,
    activeAttackStyle,
    isLocked,
    keyboardShortcuts,
    setSlots,
    setHoveredSlot,
    handleIncreaseSlots,
    handleDecreaseSlots,
    handleToggleLock,
    handleClearAll,
    handleUseSlot,
    getItemAvailability,
  } = useActionBarState({
    world,
    barId,
    isEditMode,
    windowId,
    useParentDndContext,
  });

  // Drag and drop
  const { sensors, draggedSlot, handleDragStart, handleDragEnd } =
    useActionBarDragDrop({
      slots,
      setSlots,
    });

  // Context menu
  const {
    contextMenu,
    menuRef,
    handleContextMenu,
    handleMenuItemClick: baseHandleMenuItemClick,
    handleRubbishBinContextMenu,
  } = useContextMenu(handleUseSlot, handleClearAll);

  // Extended menu item click handler to handle remove action
  const handleMenuItemClick = useCallback(
    (menuItem: {
      id: string;
      label: string;
      styledLabel: Array<{ text: string; color?: string }>;
    }) => {
      if (menuItem.id === "remove" && contextMenu.targetIndex >= 0) {
        setSlots((prev) => {
          const newSlots = [...prev];
          newSlots[contextMenu.targetIndex] = {
            type: "empty",
            id: `empty-${contextMenu.targetIndex}`,
          };
          return newSlots;
        });
      }
      baseHandleMenuItemClick(menuItem);
    },
    [contextMenu.targetIndex, setSlots, baseHandleMenuItemClick],
  );

  // Control button styles
  const getControlButtonStyle = (isDisabled: boolean): React.CSSProperties => ({
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    minWidth: CONTROL_BUTTON_SIZE,
    minHeight: CONTROL_BUTTON_SIZE,
    background: isDisabled
      ? theme.colors.background.panelPrimary
      : `linear-gradient(180deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`,
    border: isDisabled
      ? `1px solid ${theme.colors.border.default}33`
      : `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.sm,
    color: isDisabled
      ? `${theme.colors.text.secondary}4D`
      : theme.colors.text.secondary,
    fontSize: 14,
    fontWeight: "bold",
    cursor: isDisabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
    boxShadow: `${theme.shadows.sm}, inset 0 2px 4px rgba(0, 0, 0, 0.4)`,
  });

  // Render slot with current state
  const renderSlot = (slot: (typeof slots)[number], index: number) => {
    const itemAvailability =
      slot.type === "item" && slot.itemId
        ? getItemAvailability(slot.itemId)
        : { available: true, quantity: 0 };

    return (
      <ActionBarSlot
        key={`${barId}-${index}`}
        slot={slot}
        slotIndex={index}
        slotSize={SLOT_SIZE}
        shortcut={
          showShortcuts
            ? formatKeybindForDisplay(keyboardShortcuts[index] || "")
            : ""
        }
        isHovered={hoveredSlot === index}
        isActive={
          slot.type === "prayer" && slot.prayerId
            ? activePrayers.has(slot.prayerId)
            : slot.type === "combatstyle" && slot.combatStyleId
              ? activeAttackStyle === slot.combatStyleId
              : false
        }
        isLocked={isLocked}
        isAvailable={itemAvailability.available}
        inventoryQuantity={
          slot.type === "item" ? itemAvailability.quantity : undefined
        }
        onHover={() => setHoveredSlot(index)}
        onLeave={() => setHoveredSlot(null)}
        onClick={() => handleUseSlot(slot, index)}
        onContextMenu={(e) => handleContextMenu(e, slot, index)}
      />
    );
  };

  // Action bar content - supports horizontal and vertical layouts
  const actionBarContent = (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          alignItems: "center",
          gap: CONTROL_BUTTON_GAP,
        }}
      >
        {/* Decrease button - horizontal only, edit mode only */}
        {!isVertical && isEditMode && showControls && (
          <button
            onClick={handleDecreaseSlots}
            disabled={slotCount <= MIN_SLOT_COUNT}
            title={`Remove slot (${slotCount}/${MAX_SLOT_COUNT})`}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            style={getControlButtonStyle(slotCount <= MIN_SLOT_COUNT)}
            onMouseEnter={(e) => {
              if (slotCount > MIN_SLOT_COUNT) {
                e.currentTarget.style.background = `linear-gradient(180deg, ${theme.colors.accent.secondary}22 0%, ${theme.colors.background.panelPrimary} 100%)`;
                e.currentTarget.style.borderColor = theme.colors.accent.primary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                slotCount <= MIN_SLOT_COUNT
                  ? theme.colors.background.panelPrimary
                  : `linear-gradient(180deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`;
              e.currentTarget.style.borderColor =
                slotCount <= MIN_SLOT_COUNT
                  ? `${theme.colors.border.default}33`
                  : theme.colors.border.default;
            }}
          >
            −
          </button>
        )}

        {/* Slots container */}
        <div
          style={{
            display: "grid",
            ...(isVertical
              ? { gridTemplateRows: `repeat(${slotCount}, ${SLOT_SIZE}px)` }
              : {
                  gridTemplateColumns: `repeat(${slotCount}, ${SLOT_SIZE}px)`,
                }),
            gap: SLOT_GAP,
            padding: PADDING,
            justifyContent: "center",
            ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
            ...getPanelInsetStyle(theme, { emphasis: "strong", radius: 8 }),
            borderRadius: theme.borderRadius.md,
            boxShadow: `${theme.shadows.sm}, inset 0 2px 8px rgba(0, 0, 0, 0.5)`,
          }}
        >
          {slots.map((slot, index) => renderSlot(slot, index))}
        </div>

        {/* Rubbish bin - horizontal only */}
        {!isVertical && !isLocked && showControls && (
          <RubbishBin
            onContextMenu={handleRubbishBinContextMenu}
            isDragging={draggedSlot !== null}
          />
        )}

        {/* Lock button */}
        {showControls && (
          <button
            onClick={handleToggleLock}
            title={isLocked ? "Unlock action bar" : "Lock action bar"}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            style={{
              ...getControlButtonStyle(false),
              opacity: isLocked ? 1 : 0.6,
              color: isLocked
                ? theme.colors.state.warning
                : theme.colors.text.secondary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(180deg, ${theme.colors.accent.secondary}22 0%, ${theme.colors.background.panelPrimary} 100%)`;
              e.currentTarget.style.borderColor = theme.colors.accent.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `linear-gradient(180deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`;
              e.currentTarget.style.borderColor = theme.colors.border.default;
            }}
          >
            {isLocked ? "🔒" : "🔓"}
          </button>
        )}

        {/* Increase button - horizontal only, edit mode only */}
        {!isVertical && isEditMode && showControls && (
          <button
            onClick={handleIncreaseSlots}
            disabled={slotCount >= MAX_SLOT_COUNT}
            title={`Add slot (${slotCount}/${MAX_SLOT_COUNT})`}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            style={getControlButtonStyle(slotCount >= MAX_SLOT_COUNT)}
            onMouseEnter={(e) => {
              if (slotCount < MAX_SLOT_COUNT) {
                e.currentTarget.style.background = `linear-gradient(180deg, ${theme.colors.accent.secondary}22 0%, ${theme.colors.background.panelPrimary} 100%)`;
                e.currentTarget.style.borderColor = theme.colors.accent.primary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                slotCount >= MAX_SLOT_COUNT
                  ? theme.colors.background.panelPrimary
                  : `linear-gradient(180deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`;
              e.currentTarget.style.borderColor =
                slotCount >= MAX_SLOT_COUNT
                  ? `${theme.colors.border.default}33`
                  : theme.colors.border.default;
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Drag Overlay */}
      {!useParentDndContext && (
        <DragOverlay>
          {draggedSlot && (
            <div
              style={{
                width: SLOT_SIZE,
                height: SLOT_SIZE,
                background: `linear-gradient(180deg, ${theme.colors.accent.secondary}4D 0%, ${theme.colors.background.panelSecondary} 100%)`,
                border: `2px solid ${theme.colors.accent.primary}CC`,
                borderRadius: theme.borderRadius.sm,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                boxShadow: `0 4px 12px rgba(0, 0, 0, 0.4), 0 0 8px ${theme.colors.accent.primary}40`,
                pointerEvents: "none",
              }}
            >
              {draggedSlot.type === "item" && draggedSlot.itemId ? (
                <ItemIcon
                  itemId={draggedSlot.itemId}
                  size={Math.max(18, SLOT_SIZE - 6)}
                />
              ) : (
                getSlotIcon(draggedSlot)
              )}
            </div>
          )}
        </DragOverlay>
      )}
    </>
  );

  // When used in a window (has windowId), use absolute positioning to fill the window
  // When used standalone (mobile), use inline layout
  const wrapperStyle: React.CSSProperties = windowId
    ? {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }
    : {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      };

  return (
    <>
      <div style={wrapperStyle}>
        {useParentDndContext ? (
          actionBarContent
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {actionBarContent}
          </DndContext>
        )}
      </div>

      <ActionBarContextMenuPortal
        contextMenu={contextMenu}
        menuRef={menuRef}
        onItemClick={handleMenuItemClick}
      />
    </>
  );
}
