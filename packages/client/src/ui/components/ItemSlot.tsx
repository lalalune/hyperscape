/**
 * Item Slot Component
 *
 * modern MMORPG-style inventory/equipment slot with drag-drop support.
 * Used for inventory grids, equipment slots, and action bars.
 *
 * @packageDocumentation
 */

import React, {
  memo,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTheme } from "../stores/themeStore";
import { useDraggable, useDroppable, useDndMonitor } from "../core/drag";
import type { DragEndEvent } from "../core/drag";
import { getSlotStyle } from "../theme/themes";
import { CursorTooltip } from "../core/tooltip/CursorTooltip";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "../core/tooltip/tooltipStyles";

/** Item data interface */
export interface ItemData {
  id: string;
  name: string;
  icon: string | ReactNode;
  quantity?: number;
  stackable?: boolean;
  noted?: boolean;
  tooltip?: string;
}

/** Item slot props */
export interface ItemSlotProps {
  /** Unique slot identifier */
  slotId: string;
  /** Item in this slot (null if empty) */
  item: ItemData | null;
  /** Size of the slot in pixels */
  size?: number;
  /** Whether the slot is selected */
  selected?: boolean;
  /** Whether the slot is disabled */
  disabled?: boolean;
  /** Whether to enable drag */
  draggable?: boolean;
  /** Whether to accept drops */
  droppable?: boolean;
  /** Click handler */
  onClick?: (slotId: string, item: ItemData | null) => void;
  /** Right-click handler */
  onContextMenu?: (
    slotId: string,
    item: ItemData | null,
    e: React.MouseEvent,
  ) => void;
  /** Drop handler */
  onDrop?: (slotId: string, droppedItem: ItemData) => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Item Slot Component
 *
 * @example
 * ```tsx
 * function InventorySlot({ index, item }) {
 *   return (
 *     <ItemSlot
 *       slotId={`inv-${index}`}
 *       item={item}
 *       onClick={(id, item) => selectItem(item)}
 *       onContextMenu={(id, item, e) => showContextMenu(item, e)}
 *       onDrop={(id, dropped) => moveItem(dropped, index)}
 *     />
 *   );
 * }
 * ```
 */
export const ItemSlot = memo(function ItemSlot({
  slotId,
  item,
  size,
  selected = false,
  disabled = false,
  draggable = true,
  droppable = true,
  onClick,
  onContextMenu,
  onDrop,
  className,
  style,
}: ItemSlotProps): React.ReactElement {
  const theme = useTheme();
  const slotSize = size ?? theme.slot.size;
  const [hoverState, setHoverState] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Track the drop target ID for this slot
  const dropTargetId = `drop-${slotId}`;

  // Drag handling
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: slotId,
    data: { item, slotId },
    disabled: !draggable || disabled || !item,
  });

  // Drop handling
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropTargetId,
    data: { slotId },
    disabled: !droppable || disabled,
  });

  // Store onDrop callback in ref to avoid stale closure issues
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  // Listen for drag end events and call onDrop when an item is dropped on this slot
  useDndMonitor({
    onDragEnd: useCallback(
      (event: DragEndEvent) => {
        // Check if the drop was on this slot
        if (event.over?.id === dropTargetId && onDropRef.current) {
          // Extract the dropped item data
          const droppedData = event.active.data as {
            item?: ItemData;
            slotId?: string;
          };
          if (droppedData?.item) {
            onDropRef.current(slotId, droppedData.item);
          }
        }
      },
      [dropTargetId, slotId],
    ),
  });

  // Combine refs
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );

  // Click handler
  const handleClick = useCallback(() => {
    if (!disabled && onClick) {
      onClick(slotId, item);
    }
  }, [disabled, onClick, slotId, item]);

  // Context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!disabled && onContextMenu) {
        onContextMenu(slotId, item, e);
      }
    },
    [disabled, onContextMenu, slotId, item],
  );

  // Determine slot state
  const getState = () => {
    if (disabled) return "disabled";
    if (selected) return "selected";
    if (isOver) return "hover";
    if (item) return "filled";
    return "empty";
  };

  // Get base slot styling from theme
  const baseSlotStyle = getSlotStyle(theme, getState());

  // Container styles
  const containerStyle: CSSProperties = {
    ...baseSlotStyle,
    width: slotSize,
    height: slotSize,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : item ? "pointer" : "default",
    opacity: isDragging ? 0.4 : 1,
    // Drop indicator
    ...(isOver
      ? {
          borderColor: theme.colors.accent.primary,
          boxShadow: `inset 0 0 0 1px ${theme.colors.accent.primary}40`,
        }
      : {}),
    ...style,
  };

  // Icon container style
  const iconContainerStyle: CSSProperties = {
    width: theme.slot.iconSize,
    height: theme.slot.iconSize,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: theme.slot.iconSize * 0.75,
    userSelect: "none",
  };

  // Quantity badge style
  const quantityStyle: CSSProperties = {
    position: "absolute",
    bottom: 2,
    right: 2,
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
    color:
      item?.quantity && item.quantity >= 10000000
        ? theme.colors.state.success // Green for 10M+
        : item?.quantity && item.quantity >= 100000
          ? theme.colors.text.primary // White for 100K+
          : theme.colors.accent.secondary, // Yellow for normal
    textShadow: "1px 1px 1px rgba(0,0,0,0.8)",
    lineHeight: 1,
  };

  // Format quantity display
  const formatQuantity = (qty: number): string => {
    if (qty >= 10000000) return `${Math.floor(qty / 1000000)}M`;
    if (qty >= 100000) return `${Math.floor(qty / 1000)}K`;
    if (qty >= 1000) return qty.toLocaleString();
    return String(qty);
  };

  // Noted indicator style
  const notedStyle: CSSProperties = {
    position: "absolute",
    top: 2,
    left: 2,
    fontSize: 8,
    color: theme.colors.text.muted,
  };

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={containerStyle}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={(e) => {
        if (item) {
          setHoverState({ x: e.clientX, y: e.clientY });
        }
      }}
      onMouseMove={(e) => {
        if (item) {
          setHoverState({ x: e.clientX, y: e.clientY });
        }
      }}
      onMouseLeave={() => setHoverState(null)}
      {...dragAttributes}
      {...dragListeners}
    >
      {/* Item icon */}
      {item && (
        <div style={iconContainerStyle}>
          {typeof item.icon === "string" ? (
            item.icon.startsWith("http") || item.icon.startsWith("/") ? (
              <img
                src={item.icon}
                alt={item.name}
                style={{
                  width: theme.slot.iconSize,
                  height: theme.slot.iconSize,
                  objectFit: "contain",
                }}
                draggable={false}
              />
            ) : (
              <span>{item.icon}</span>
            )
          ) : (
            item.icon
          )}
        </div>
      )}

      {/* Quantity display */}
      {item?.quantity && item.quantity > 1 && (
        <span style={quantityStyle}>{formatQuantity(item.quantity)}</span>
      )}

      {/* Noted indicator */}
      {item?.noted && <span style={notedStyle}>N</span>}

      {item && hoverState && (
        <CursorTooltip
          visible={true}
          position={hoverState}
          estimatedSize={{ width: 150, height: 48 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: "120px",
            maxWidth: "220px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            {item.tooltip || item.name}
            {item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ""}
          </div>
          <div style={{ ...getTooltipMetaStyle(theme), marginTop: "4px" }}>
            Item slot
          </div>
        </CursorTooltip>
      )}
    </div>
  );
});

/**
 * Item Grid Component
 *
 * Grid layout for multiple item slots (inventory, bank, etc.)
 */
export interface ItemGridProps {
  /** Grid identifier */
  gridId: string;
  /** Items in the grid (sparse array allowed) */
  items: (ItemData | null)[];
  /** Number of columns */
  columns?: number;
  /** Slot size */
  slotSize?: number;
  /** Selected slot index */
  selectedIndex?: number | null;
  /** Click handler */
  onSlotClick?: (index: number, item: ItemData | null) => void;
  /** Context menu handler */
  onSlotContextMenu?: (
    index: number,
    item: ItemData | null,
    e: React.MouseEvent,
  ) => void;
  /** Drop handler */
  onSlotDrop?: (index: number, droppedItem: ItemData) => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

export const ItemGrid = memo(function ItemGrid({
  gridId,
  items,
  columns = 4,
  slotSize,
  selectedIndex,
  onSlotClick,
  onSlotContextMenu,
  onSlotDrop,
  className,
  style,
}: ItemGridProps): React.ReactElement {
  const theme = useTheme();

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: theme.slot.gap,
    padding: theme.spacing.xs,
    ...style,
  };

  return (
    <div className={className} style={gridStyle}>
      {items.map((item, index) => (
        <ItemSlot
          key={`${gridId}-${index}`}
          slotId={`${gridId}-${index}`}
          item={item}
          size={slotSize}
          selected={selectedIndex === index}
          onClick={onSlotClick ? () => onSlotClick(index, item) : undefined}
          onContextMenu={
            onSlotContextMenu
              ? (_, __, e) => onSlotContextMenu(index, item, e)
              : undefined
          }
          onDrop={
            onSlotDrop ? (_, dropped) => onSlotDrop(index, dropped) : undefined
          }
        />
      ))}
    </div>
  );
});

export default ItemSlot;
