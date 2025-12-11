/**
 * BankTabBar Component
 *
 * Tab strip for navigating between bank tabs.
 * Supports:
 * - "All" tab (view all items across tabs)
 * - Individual tabs (0-9)
 * - Drag-drop to move items between tabs
 * - Create new tab by dragging to "+"
 * - Delete tabs via right-click
 */

import type { BankItem, BankTab, ConfirmModalState, DragState } from "../types";
import {
  TAB_INDEX_ALL,
  TAB_INDEX_NEW_TAB_HOVER,
  BANK_THEME,
} from "../constants";
import { getItemIcon, formatItemName } from "../utils";

export interface BankTabBarProps {
  tabs: BankTab[];
  items: BankItem[];
  selectedTab: number;
  onSelectTab: (tab: number) => void;

  // Drag state (from useDragDrop hook)
  dragState: DragState;
  setDraggedSlot: (slot: number | null) => void;
  setDraggedTabIndex: (tab: number | null) => void;
  setHoveredTabIndex: (tab: number | null) => void;

  // Tab management
  handleMoveToTab: (
    fromSlot: number,
    fromTabIndex: number,
    toTabIndex: number,
    toSlot?: number,
  ) => void;
  handleCreateTab: (
    fromSlot: number,
    fromTabIndex: number,
    newTabIndex: number,
  ) => void;
  handleDeleteTab: (tabIndex: number) => void;

  // For confirm modal when deleting tabs
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState>>;
}

export function BankTabBar({
  tabs,
  items,
  selectedTab,
  onSelectTab,
  dragState,
  setDraggedSlot,
  setDraggedTabIndex,
  setHoveredTabIndex,
  handleMoveToTab,
  handleCreateTab,
  handleDeleteTab,
  setConfirmModal,
}: BankTabBarProps) {
  const { draggedSlot, draggedTabIndex, hoveredTabIndex } = dragState;

  // Get the next available tab index for creating new tabs
  // RS3-STYLE: Always append at end (max + 1), never fill gaps
  const nextAvailableTabIndex = (() => {
    if (tabs.length === 0) return 1; // No custom tabs yet, start at 1
    const maxTabIndex = Math.max(...tabs.map((t) => t.tabIndex));
    if (maxTabIndex >= 9) return null; // All tabs used (max is 9)
    return maxTabIndex + 1;
  })();

  return (
    <div
      className="mx-3 mt-2 mb-0 flex gap-1 overflow-x-auto pb-0"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* All Tab (∞) - RS3 style */}
      <button
        onClick={() => onSelectTab(TAB_INDEX_ALL)}
        className="px-3 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
        style={{
          background:
            selectedTab === TAB_INDEX_ALL
              ? "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(100, 50, 10, 0.7) 100%)"
              : "rgba(50, 40, 30, 0.6)",
          color:
            selectedTab === TAB_INDEX_ALL ? "#fff" : BANK_THEME.TEXT_GOLD_DIM,
          borderTop:
            selectedTab === TAB_INDEX_ALL
              ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
              : `1px solid ${BANK_THEME.TAB_BORDER}`,
          borderLeft:
            selectedTab === TAB_INDEX_ALL
              ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
              : `1px solid ${BANK_THEME.TAB_BORDER}`,
          borderRight:
            selectedTab === TAB_INDEX_ALL
              ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
              : `1px solid ${BANK_THEME.TAB_BORDER}`,
          borderBottom: "none",
        }}
        title="View all items across all tabs"
      >
        ∞
      </button>

      {/* All Tabs (0-9) - RS3 style: Tab 0 is just another tab, icon = first item */}
      {(() => {
        // Create array of all tabs including tab 0 (which always exists implicitly)
        const allTabIndexes = [0, ...tabs.map((t) => t.tabIndex)].sort(
          (a, b) => a - b,
        );
        // Remove duplicates (in case tab 0 is somehow in tabs array)
        const uniqueTabIndexes = [...new Set(allTabIndexes)];

        return uniqueTabIndexes.map((tabIndex) => {
          const isSelected = selectedTab === tabIndex;
          const isHovered = hoveredTabIndex === tabIndex;
          const borderColor = isHovered
            ? "1px solid rgba(100, 200, 255, 0.8)"
            : isSelected
              ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
              : `1px solid ${BANK_THEME.TAB_BORDER}`;
          // RS3-style: Tab icon = first item by slot order
          // Prefer real items (qty > 0), but fall back to placeholders if tab only has placeholders
          const tabItemsSorted = items
            .filter((i) => i.tabIndex === tabIndex)
            .sort((a, b) => a.slot - b.slot);
          const firstRealItem = tabItemsSorted.find((i) => i.quantity > 0);
          const firstAnyItem = tabItemsSorted[0];
          const iconItem = firstRealItem || firstAnyItem;
          const tabIcon = iconItem
            ? getItemIcon(iconItem.itemId)
            : `${tabIndex}`;
          const isPlaceholderIcon = iconItem && iconItem.quantity === 0;
          // Tab 0 can't be deleted, only custom tabs (1-9)
          const canDelete = tabIndex > 0;
          return (
            <button
              key={tabIndex}
              onClick={() => onSelectTab(tabIndex)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (canDelete) {
                  setConfirmModal({
                    visible: true,
                    title: "Delete Tab",
                    message: `Delete tab ${tabIndex}? All items will be moved to tab 0.`,
                    onConfirm: () => {
                      handleDeleteTab(tabIndex);
                      if (selectedTab === tabIndex) {
                        onSelectTab(0);
                      }
                    },
                  });
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setHoveredTabIndex(tabIndex);
              }}
              onDragLeave={() => setHoveredTabIndex(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (
                  draggedSlot !== null &&
                  draggedTabIndex !== null &&
                  draggedTabIndex !== tabIndex
                ) {
                  handleMoveToTab(draggedSlot, draggedTabIndex, tabIndex);
                }
                setDraggedSlot(null);
                setDraggedTabIndex(null);
                setHoveredTabIndex(null);
              }}
              className="px-3 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
              style={{
                background: isHovered
                  ? "rgba(100, 200, 255, 0.3)"
                  : isSelected
                    ? "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(100, 50, 10, 0.7) 100%)"
                    : isPlaceholderIcon
                      ? "rgba(40, 35, 28, 0.6)"
                      : "rgba(50, 40, 30, 0.6)",
                color: isSelected ? "#fff" : BANK_THEME.TEXT_GOLD_DIM,
                borderTop: borderColor,
                borderLeft: borderColor,
                borderRight: borderColor,
                borderBottom: "none",
                opacity: isPlaceholderIcon && !isSelected ? 0.6 : 1,
              }}
              title={
                iconItem
                  ? `${formatItemName(iconItem.itemId)}${isPlaceholderIcon ? " (empty)" : ""}${canDelete ? " - Right-click to delete" : ""}`
                  : `Tab ${tabIndex}${canDelete ? " - Right-click to delete" : ""}`
              }
            >
              {tabIcon}
            </button>
          );
        });
      })()}

      {/* Add Tab Button (+) */}
      {nextAvailableTabIndex !== null && (
        <button
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setHoveredTabIndex(TAB_INDEX_NEW_TAB_HOVER);
          }}
          onDragLeave={() => setHoveredTabIndex(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (
              draggedSlot !== null &&
              draggedTabIndex !== null &&
              nextAvailableTabIndex !== null
            ) {
              handleCreateTab(
                draggedSlot,
                draggedTabIndex,
                nextAvailableTabIndex,
              );
            }
            setDraggedSlot(null);
            setDraggedTabIndex(null);
            setHoveredTabIndex(null);
          }}
          className="px-3 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
          style={{
            background:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? "rgba(100, 255, 100, 0.3)"
                : "rgba(50, 50, 50, 0.4)",
            color: "rgba(100, 200, 100, 0.8)",
            borderTop:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? "1px solid rgba(100, 255, 100, 0.8)"
                : "1px dashed rgba(100, 200, 100, 0.4)",
            borderLeft:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? "1px solid rgba(100, 255, 100, 0.8)"
                : "1px dashed rgba(100, 200, 100, 0.4)",
            borderRight:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? "1px solid rgba(100, 255, 100, 0.8)"
                : "1px dashed rgba(100, 200, 100, 0.4)",
            borderBottom: "none",
          }}
          title="Drag an item here to create a new tab"
        >
          +
        </button>
      )}
    </div>
  );
}
