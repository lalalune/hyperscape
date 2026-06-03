/**
 * Action Panel - Quick access to inventory items
 * Shows first N items from inventory with pagination
 * Supports right-click context menus, keyboard shortcuts (1-7), and drag-and-drop reordering
 */

import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CursorTooltip, useThemeStore } from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import { breakpoints, gameUI } from "../../constants";
import {
  getItem,
  isFood,
  isPotion,
  isBone,
  usesWield,
  usesWear,
  CONTEXT_MENU_COLORS,
} from "@hyperforge/shared";
import { ItemIcon } from "@/ui/components/ItemIcon";
/**
 * Minimal item type for ActionPanel - only requires the properties actually used
 * Compatible with both InventorySlotItem and InventorySlotViewItem
 */
interface ActionPanelItem {
  slot: number;
  itemId: string;
  quantity: number;
}

interface ActionPanelProps {
  items: ActionPanelItem[];
  onItemUse?: (item: ActionPanelItem, index: number) => void;
  onItemAction?: (item: ActionPanelItem, index: number, action: string) => void;
  onItemMove?: (fromIndex: number, toIndex: number) => void;
  /** Orientation of the action panel - horizontal (default) or vertical */
  orientation?: "horizontal" | "vertical";
}

interface ContextMenuItem {
  id: string;
  label: string;
  styledLabel: Array<{ text: string; color?: string }>;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  targetItem: ActionPanelItem | null;
  targetIndex: number;
}

// Draggable slot component - memoized to prevent unnecessary re-renders
const DraggableSlot = memo(function DraggableSlot({
  item,
  slotNumber,
  slotSize,
  isMobile,
  isHovered,
  onHover,
  onLeave,
  onClick,
  onContextMenu,
}: {
  item: ActionPanelItem | null;
  slotNumber: number;
  slotSize: number;
  isMobile: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const isEmpty = !item;
  const [hoverState, setHoverState] = useState<{ x: number; y: number } | null>(
    null,
  );

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `action-slot-${slotNumber}`,
    data: { item, slotNumber },
    disabled: isEmpty,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `action-drop-${slotNumber}`,
    data: { slotNumber },
  });

  // Combine refs

  const combinedRef = (node: HTMLButtonElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const tooltipLabel = item
    ? `Slot ${slotNumber + 1}: ${getItem(item.itemId)?.name || item.itemId}${item.quantity > 1 ? ` x${item.quantity}` : ""}`
    : `Empty slot ${slotNumber + 1}`;

  return (
    <>
      <button
        ref={combinedRef}
        onClick={onClick}
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
        className="relative"
        style={{
          width: `${slotSize}px`,
          height: `${slotSize}px`,
          background: isEmpty
            ? theme.colors.slot.empty
            : isOver
              ? `linear-gradient(180deg, ${theme.colors.accent.primary}40 0%, ${theme.colors.border.decorative}4d 100%)`
              : isHovered
                ? `linear-gradient(180deg, ${theme.colors.accent.primary}26 0%, ${theme.colors.border.decorative}33 100%)`
                : theme.colors.slot.filled,
          border: isEmpty
            ? `1px solid ${theme.colors.border.default}`
            : isOver
              ? `2px solid ${theme.colors.accent.primary}b3`
              : isHovered
                ? `1px solid ${theme.colors.accent.primary}80`
                : `1px solid ${theme.colors.border.decorative}80`,
          borderRadius: `${theme.borderRadius.sm}px`,
          cursor: isEmpty ? "default" : isDragging ? "grabbing" : "grab",
          opacity: isDragging ? 0.3 : 1,
          transform: isOver
            ? "scale(1.05)"
            : isDragging
              ? "scale(0.95)"
              : "scale(1)",
          transition: theme.transitions.fast,
          touchAction: "none",
          boxShadow: isOver
            ? `0 0 8px ${theme.colors.accent.primary}66`
            : "none",
        }}
        {...attributes}
        {...listeners}
      >
        {/* Item Icon */}
        {!isEmpty ? (
          <div
            className="flex items-center justify-center h-full"
            style={{
              fontSize: isMobile ? "14px" : "16px",
              filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))",
            }}
          >
            <ItemIcon itemId={item.itemId} size={isMobile ? 32 : 36} />
          </div>
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{
              color: theme.colors.border.default,
              fontSize: "6px",
            }}
          >
            •
          </div>
        )}

        {/* Quantity Badge */}
        {item && item.quantity > 1 && (
          <div
            className="absolute font-bold"
            style={{
              bottom: "1px",
              right: "1px",
              background: theme.colors.accent.primary,
              color: theme.colors.background.primary,
              fontSize: theme.typography.fontSize.xs,
              padding: "0px 2px",
              borderRadius: `${theme.borderRadius.sm}px`,
              lineHeight: 1.1,
            }}
          >
            {item.quantity > 999
              ? `${Math.floor(item.quantity / 1000)}K`
              : item.quantity}
          </div>
        )}

        {/* Slot Number (1-based for display) */}
        <div
          className="absolute font-bold"
          style={{
            top: "1px",
            left: "2px",
            color: isEmpty
              ? theme.colors.text.muted
              : theme.colors.text.secondary,
            fontSize: "7px",
            textShadow: "0 1px 1px rgba(0, 0, 0, 0.6)",
          }}
        >
          {slotNumber + 1}
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
            maxWidth: "220px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            {tooltipLabel}
          </div>
          {item && (
            <div style={{ ...getTooltipMetaStyle(theme), marginTop: "4px" }}>
              Drag to reorder • Right-click for options
            </div>
          )}
        </CursorTooltip>
      )}
    </>
  );
});

export function ActionPanel({
  items,
  onItemUse,
  onItemAction,
  onItemMove,
  orientation = "horizontal",
}: ActionPanelProps) {
  const isVertical = orientation === "vertical";
  const theme = useThemeStore((s) => s.theme);

  // Configure sensors for accessibility and mobile support
  // PointerSensor: distance-based for mouse, TouchSensor: delay-based for mobile long-press
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Long-press 250ms to start drag on mobile
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoints.md : false,
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<ActionPanelItem | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
    targetItem: null,
    targetIndex: -1,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // Note: Drag sensors are handled internally with useDraggable

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoints.md);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    // Always return a cleanup function for consistent effect behavior
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu.visible]);

  // Use action bar configuration from gameUI
  const totalSlots = gameUI.inventory.slots; // 28
  const slotsPerPage = gameUI.actionBar.defaultSlots; // 7 slots per page (horizontal)
  const totalPages = gameUI.actionBar.totalPages; // 4 pages
  const startSlot = currentPage * slotsPerPage;
  const endSlot = Math.min(startSlot + slotsPerPage, totalSlots);

  // Create a map of slot number -> item for quick lookup
  const itemsBySlot = new Map<number, ActionPanelItem>();
  for (const item of items) {
    itemsBySlot.set(item.slot, item);
  }

  // Keyboard shortcuts (1-7) for quick use
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const key = parseInt(e.key);
      if (key >= 1 && key <= 7) {
        const slotNumber = startSlot + (key - 1);
        if (slotNumber < totalSlots) {
          // Build the map inline to avoid dependency on the mutable Map
          const slotItem = items.find((item) => item.slot === slotNumber);
          if (slotItem && onItemUse) {
            onItemUse(slotItem, slotNumber);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, onItemUse, startSlot]);

  // Build slots array - each slot corresponds to an actual inventory slot number
  const slots: (ActionPanelItem | null)[] = [];
  for (let slotNum = startSlot; slotNum < endSlot; slotNum++) {
    slots.push(itemsBySlot.get(slotNum) || null);
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // @dnd-kit: data is at active.data.current.data (DragItem.data)
    const activeDataWrapper = active.data.current as
      | { data?: Record<string, unknown> }
      | undefined;
    const dragData = activeDataWrapper?.data as
      | { item?: ActionPanelItem; slotNumber?: number }
      | undefined;
    const item = dragData?.item || null;
    setDraggedItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over || active.id === over.id) return;

    // @dnd-kit: data is at active.data.current.data (DragItem.data)
    const activeDataWrapper = active.data.current as
      | { data?: Record<string, unknown> }
      | undefined;
    const activeData = activeDataWrapper?.data as
      | { slotNumber?: number }
      | undefined;
    // @dnd-kit: data is at over.data.current
    const overDataCurrent = over.data.current as
      | { slotNumber?: number }
      | undefined;
    const fromSlot = activeData?.slotNumber;
    const toSlot = overDataCurrent?.slotNumber;

    if (fromSlot !== undefined && toSlot !== undefined && onItemMove) {
      onItemMove(fromSlot, toSlot);
    }
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: ActionPanelItem | null, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (!item) return;

      const itemData = getItem(item.itemId);
      const itemName = itemData?.name || item.itemId;
      const menuItems: ContextMenuItem[] = [];

      // Primary action based on item type
      if (itemData?.inventoryActions && itemData.inventoryActions.length > 0) {
        for (const action of itemData.inventoryActions) {
          menuItems.push({
            id: action.toLowerCase(),
            label: `${action} ${itemName}`,
            styledLabel: [
              { text: `${action} `, color: "#fff" },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
          });
        }
      } else {
        if (isFood(itemData)) {
          menuItems.push({
            id: "eat",
            label: `Eat ${itemName}`,
            styledLabel: [
              { text: "Eat ", color: "#fff" },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
          });
        } else if (isPotion(itemData)) {
          menuItems.push({
            id: "drink",
            label: `Drink ${itemName}`,
            styledLabel: [
              { text: "Drink ", color: "#fff" },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
          });
        } else if (isBone(itemData)) {
          menuItems.push({
            id: "bury",
            label: `Bury ${itemName}`,
            styledLabel: [
              { text: "Bury ", color: "#fff" },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
          });
        } else if (usesWield(itemData)) {
          menuItems.push({
            id: "wield",
            label: `Wield ${itemName}`,
            styledLabel: [
              { text: "Wield ", color: "#fff" },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
          });
        } else if (usesWear(itemData)) {
          menuItems.push({
            id: "wear",
            label: `Wear ${itemName}`,
            styledLabel: [
              { text: "Wear ", color: "#fff" },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
          });
        } else {
          menuItems.push({
            id: "use",
            label: `Use ${itemName}`,
            styledLabel: [
              { text: "Use ", color: "#fff" },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
          });
        }
      }

      // Drop option (only add if not already present from inventoryActions)
      if (!menuItems.some((m) => m.id === "drop")) {
        menuItems.push({
          id: "drop",
          label: `Drop ${itemName}`,
          styledLabel: [
            { text: "Drop ", color: "#fff" },
            { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
          ],
        });
      }

      // Examine (only add if not already present from inventoryActions)
      if (!menuItems.some((m) => m.id === "examine")) {
        menuItems.push({
          id: "examine",
          label: `Examine ${itemName}`,
          styledLabel: [
            { text: "Examine ", color: "#fff" },
            { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
          ],
        });
      }

      // Cancel
      menuItems.push({
        id: "cancel",
        label: "Cancel",
        styledLabel: [{ text: "Cancel", color: "#fff" }],
      });

      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        items: menuItems,
        targetItem: item,
        targetIndex: index,
      });
    },
    [],
  );

  const handleMenuItemClick = useCallback(
    (menuItem: ContextMenuItem) => {
      if (menuItem.id === "cancel") {
        setContextMenu((prev) => ({ ...prev, visible: false }));
        return;
      }

      if (contextMenu.targetItem && onItemAction) {
        // Use dedicated action handler when available
        onItemAction(
          contextMenu.targetItem,
          contextMenu.targetIndex,
          menuItem.id,
        );
      } else if (contextMenu.targetItem && onItemUse) {
        // Fallback to onItemUse for all actions including drop/examine
        // In production, this fallback is silent; enable debug logging via console if needed
        onItemUse(contextMenu.targetItem, contextMenu.targetIndex);
      }
      // No warning logged in production when handlers are missing - this is expected
      // for components that only care about certain actions

      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [contextMenu.targetItem, contextMenu.targetIndex, onItemAction, onItemUse],
  );

  const slotSize = isMobile ? 36 : 42;
  const gap = 3;

  // For vertical layout, use arrows that indicate left/right for prev/next
  const prevArrow = isVertical ? "◀" : "▲";
  const nextArrow = isVertical ? "▶" : "▼";

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={
            isVertical ? "flex flex-col items-center" : "flex items-center"
          }
          style={{ gap: `${gap}px` }}
        >
          {/* Pagination Controls with Page Indicator */}
          <div
            className={
              isVertical
                ? "flex flex-row items-center"
                : "flex flex-col items-center"
            }
            style={{ gap: "1px" }}
          >
            {/* Prev Arrow (Up for horizontal, Left for vertical) */}
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="transition-all duration-100"
              style={{
                width: isVertical ? "14px" : `${slotSize}px`,
                height: isVertical ? `${slotSize}px` : "14px",
                background:
                  currentPage === 0
                    ? theme.colors.slot.disabled
                    : `linear-gradient(180deg, ${theme.colors.accent.primary}1f 0%, ${theme.colors.border.decorative}26 100%)`,
                border:
                  currentPage === 0
                    ? `1px solid ${theme.colors.border.default}`
                    : `1px solid ${theme.colors.accent.primary}59`,
                borderRadius: isVertical
                  ? `${theme.borderRadius.sm}px 0 0 ${theme.borderRadius.sm}px`
                  : `${theme.borderRadius.sm}px ${theme.borderRadius.sm}px 0 0`,
                color:
                  currentPage === 0
                    ? theme.colors.text.disabled
                    : theme.colors.accent.primary,
                cursor: currentPage === 0 ? "default" : "pointer",
                fontSize: "7px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {prevArrow}
            </button>

            {/* Clickable Page Indicator */}
            <button
              onClick={() => setCurrentPage((currentPage + 1) % totalPages)}
              className="transition-all duration-100"
              title={`Page ${currentPage + 1} of ${totalPages} (Slots ${startSlot + 1}-${endSlot})`}
              style={{
                width: isVertical ? "14px" : `${slotSize}px`,
                height: isVertical ? `${slotSize}px` : "14px",
                background: `linear-gradient(180deg, ${theme.colors.accent.primary}1a 0%, ${theme.colors.border.decorative}1f 100%)`,
                border: `1px solid ${theme.colors.border.decorative}66`,
                borderRadius: "0",
                color: theme.colors.accent.primary,
                cursor: "pointer",
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                writingMode: isVertical ? "vertical-rl" : undefined,
                textOrientation: isVertical ? "mixed" : undefined,
              }}
            >
              {currentPage + 1}/{totalPages}
            </button>

            {/* Next Arrow (Down for horizontal, Right for vertical) */}
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
              }
              disabled={currentPage >= totalPages - 1}
              className="transition-all duration-100"
              style={{
                width: isVertical ? "14px" : `${slotSize}px`,
                height: isVertical ? `${slotSize}px` : "14px",
                background:
                  currentPage >= totalPages - 1
                    ? theme.colors.slot.disabled
                    : `linear-gradient(180deg, ${theme.colors.accent.primary}1f 0%, ${theme.colors.border.decorative}26 100%)`,
                border:
                  currentPage >= totalPages - 1
                    ? `1px solid ${theme.colors.border.default}`
                    : `1px solid ${theme.colors.accent.primary}59`,
                borderRadius: isVertical
                  ? `0 ${theme.borderRadius.sm}px ${theme.borderRadius.sm}px 0`
                  : `0 0 ${theme.borderRadius.sm}px ${theme.borderRadius.sm}px`,
                color:
                  currentPage >= totalPages - 1
                    ? theme.colors.text.disabled
                    : theme.colors.accent.primary,
                cursor: currentPage >= totalPages - 1 ? "default" : "pointer",
                fontSize: "7px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {nextArrow}
            </button>
          </div>

          {/* Action Slots */}
          <div
            className={isVertical ? "flex flex-col" : "flex"}
            style={{ gap: `${gap}px` }}
          >
            {slots.map((item, index) => {
              const slotNumber = startSlot + index;
              return (
                <DraggableSlot
                  key={slotNumber}
                  item={item}
                  slotNumber={slotNumber}
                  slotSize={slotSize}
                  isMobile={isMobile}
                  isHovered={hoveredSlot === slotNumber}
                  onHover={() => setHoveredSlot(slotNumber)}
                  onLeave={() => setHoveredSlot(null)}
                  onClick={() => item && onItemUse?.(item, slotNumber)}
                  onContextMenu={(e) => handleContextMenu(e, item, slotNumber)}
                />
              );
            })}
          </div>
        </div>

        {/* Drag Overlay - Follows cursor smoothly */}
        <DragOverlay>
          {draggedItem && (
            <div
              style={{
                width: `${slotSize}px`,
                height: `${slotSize}px`,
                background: `linear-gradient(180deg, ${theme.colors.accent.primary}4d 0%, ${theme.colors.border.decorative}59 100%)`,
                border: `2px solid ${theme.colors.accent.primary}cc`,
                borderRadius: `${theme.borderRadius.md}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: isMobile ? "14px" : "16px",
                boxShadow: `${theme.shadows.lg}, 0 0 8px ${theme.colors.accent.primary}40`,
                pointerEvents: "none",
              }}
            >
              <ItemIcon itemId={draggedItem.itemId} size={isMobile ? 32 : 36} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Context Menu Portal - Compact, with dynamic positioning */}
      {contextMenu.visible &&
        createPortal(
          <ContextMenuPortal
            menuRef={menuRef}
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onItemClick={handleMenuItemClick}
          />,
          document.body,
        )}
    </>
  );
}

/** Context menu portal component with edge-aware positioning */
const ContextMenuPortal = memo(function ContextMenuPortal({
  menuRef,
  x,
  y,
  items,
  onItemClick,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onItemClick: (item: ContextMenuItem) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  // Initialize position near click coordinates to reduce flash
  const [position, setPosition] = React.useState(() => {
    // Start near the click position (adjust after measurement)
    const padding = 4;
    return {
      left: Math.max(padding, x),
      top: Math.max(padding, y - 100), // Estimate - will be refined after measurement
      openUpward: true,
    };
  });
  const [isPositioned, setIsPositioned] = React.useState(false);

  React.useEffect(() => {
    // Calculate position after first render to measure menu size
    const updatePosition = () => {
      // Access menuRef.current inside the callback, not as a dependency
      const menu = menuRef.current;
      if (!menu) return;

      const rect = menu.getBoundingClientRect();
      const menuHeight = rect.height;
      const menuWidth = rect.width;
      const padding = 4;

      // Default: open upward from click position
      let finalTop = y - menuHeight - padding;
      let openUpward = true;

      // If not enough space above, open downward
      if (finalTop < padding) {
        finalTop = y + padding;
        openUpward = false;
      }

      // Clamp horizontal position to stay within viewport
      const finalLeft = Math.max(
        padding,
        Math.min(x, window.innerWidth - menuWidth - padding),
      );

      setPosition({ left: finalLeft, top: finalTop, openUpward });
      setIsPositioned(true);
    };

    // Initial positioning
    updatePosition();

    // Reposition on window resize
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed"
      style={{
        left: position.left,
        top: position.top,
        zIndex: theme.zIndex.tooltip,
        // Hide until positioned to prevent flash
        opacity: isPositioned ? 1 : 0,
        visibility: isPositioned ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          background: theme.colors.background.panelPrimary,
          border: `1px solid ${theme.colors.border.decorative}80`,
          borderRadius: `${theme.borderRadius.sm}px`,
          boxShadow: theme.shadows.md,
          overflow: "hidden",
          minWidth: "100px",
        }}
      >
        {items.map((menuItem, idx) => (
          <button
            key={menuItem.id}
            onClick={() => onItemClick(menuItem)}
            className="w-full text-left transition-colors duration-75"
            style={{
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              fontSize: theme.typography.fontSize.xs,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              borderTop:
                idx > 0 ? `1px solid ${theme.colors.border.default}` : "none",
              display: "block",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.slot.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {menuItem.styledLabel.map((segment, i) => (
              <span
                key={i}
                style={{ color: segment.color || theme.colors.text.primary }}
              >
                {segment.text}
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
});
