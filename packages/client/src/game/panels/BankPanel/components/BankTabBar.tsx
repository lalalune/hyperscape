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

import { useState } from "react";
import { CursorTooltip, useThemeStore } from "@/ui";
import { getTooltipTitleStyle } from "@/ui/core/tooltip/tooltipStyles";
import { getInteractiveTileStyle, getPanelInsetStyle } from "@/ui/theme/themes";
import type { BankItem, BankTab, ConfirmModalState } from "../types";
import type { DragState } from "../hooks";
import { TAB_INDEX_ALL, TAB_INDEX_NEW_TAB_HOVER } from "../constants";
import { formatItemName } from "../utils";
import { ItemIcon } from "@/ui/components/ItemIcon";

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
  const theme = useThemeStore((s) => s.theme);
  const { draggedSlot, draggedTabIndex, hoveredTabIndex } = dragState;
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{
    label: string;
    position: { x: number; y: number };
  } | null>(null);

  const getTabIconSlotStyle = (
    state: "idle" | "hovered" | "active" | "success",
  ): React.CSSProperties => {
    const accentColor =
      state === "success"
        ? theme.colors.state.success
        : theme.colors.accent.primary;
    const hovered = state === "hovered" || state === "success";
    const active = state === "active";

    return {
      ...getInteractiveTileStyle(theme, {
        hovered,
        active,
        radius: theme.borderRadius.sm,
        accentColor,
      }),
      width: 36,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: active
        ? `${theme.shadows.sm}, inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 14px rgba(0,0,0,0.16)`
        : hovered
          ? `${theme.shadows.sm}, inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 14px rgba(0,0,0,0.12)`
          : "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -8px 12px rgba(0,0,0,0.14)",
    };
  };

  // Get the next available tab index for creating new tabs
  // modern MMORPG-STYLE: Always append at end (max + 1), never fill gaps
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
      {/* All Tab (∞) - modern MMORPG style */}
      <button
        onClick={() => onSelectTab(TAB_INDEX_ALL)}
        className="px-2 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
        title="View all items across all tabs"
        style={{
          background:
            selectedTab === TAB_INDEX_ALL
              ? String(
                  getInteractiveTileStyle(theme, {
                    active: true,
                    radius: theme.borderRadius.sm,
                  }).background,
                )
              : hoveredButton === "all"
                ? String(
                    getInteractiveTileStyle(theme, {
                      hovered: true,
                      radius: theme.borderRadius.sm,
                    }).background,
                  )
                : String(
                    getPanelInsetStyle(theme, { radius: theme.borderRadius.sm })
                      .background,
                  ),
          color:
            selectedTab === TAB_INDEX_ALL
              ? theme.colors.text.primary
              : hoveredButton === "all"
                ? theme.colors.text.primary
                : theme.colors.text.secondary,
          borderTop:
            selectedTab === TAB_INDEX_ALL
              ? `1px solid ${theme.colors.border.default}`
              : `1px solid ${theme.colors.border.decorative}`,
          borderLeft:
            selectedTab === TAB_INDEX_ALL
              ? `1px solid ${theme.colors.border.default}`
              : `1px solid ${theme.colors.border.decorative}`,
          borderRight:
            selectedTab === TAB_INDEX_ALL
              ? `1px solid ${theme.colors.border.default}`
              : `1px solid ${theme.colors.border.decorative}`,
          borderBottom: "none",
        }}
        onMouseEnter={(e) => {
          setHoveredButton("all");
          setHoverTooltip({
            label: "View all items across all tabs",
            position: { x: e.clientX, y: e.clientY },
          });
        }}
        onMouseMove={(e) => {
          setHoverTooltip((prev) =>
            prev?.label === "View all items across all tabs"
              ? {
                  label: prev.label,
                  position: { x: e.clientX, y: e.clientY },
                }
              : prev,
          );
        }}
        onMouseLeave={() => {
          setHoveredButton((prev) => (prev === "all" ? null : prev));
          setHoverTooltip((prev) =>
            prev?.label === "View all items across all tabs" ? null : prev,
          );
        }}
      >
        <div
          style={getTabIconSlotStyle(
            selectedTab === TAB_INDEX_ALL
              ? "active"
              : hoveredButton === "all"
                ? "hovered"
                : "idle",
          )}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>∞</span>
        </div>
      </button>

      {/* All Tabs (0-9) - modern MMORPG style: Tab 0 is just another tab, icon = first item */}
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
            ? `1px solid ${theme.colors.accent.primary}`
            : isSelected
              ? `1px solid ${theme.colors.border.default}`
              : `1px solid ${theme.colors.border.decorative}`;
          // modern MMORPG-style: Tab icon = first item by slot order
          // Prefer real items (qty > 0), but fall back to placeholders if tab only has placeholders
          const tabItemsSorted = items
            .filter((i) => i.tabIndex === tabIndex)
            .sort((a, b) => a.slot - b.slot);
          const firstRealItem = tabItemsSorted.find((i) => i.quantity > 0);
          const firstAnyItem = tabItemsSorted[0];
          const iconItem = firstRealItem || firstAnyItem;
          const tabIcon = iconItem ? (
            <ItemIcon itemId={iconItem.itemId} size={14} />
          ) : (
            <span>{tabIndex}</span>
          );
          const isPlaceholderIcon = iconItem && iconItem.quantity === 0;
          // Tab 0 can't be deleted, only custom tabs (1-9)
          const canDelete = tabIndex > 0;
          const tooltipLabel = iconItem
            ? `${formatItemName(iconItem.itemId)}${isPlaceholderIcon ? " (empty)" : ""}${canDelete ? " - Right-click to delete" : ""}`
            : `Tab ${tabIndex}${canDelete ? " - Right-click to delete" : ""}`;
          return (
            <button
              key={tabIndex}
              onClick={() => onSelectTab(tabIndex)}
              title={tooltipLabel}
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
              className="px-2 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
              style={{
                background: isHovered
                  ? String(
                      getInteractiveTileStyle(theme, {
                        hovered: true,
                        radius: theme.borderRadius.sm,
                      }).background,
                    )
                  : isSelected
                    ? String(
                        getInteractiveTileStyle(theme, {
                          active: true,
                          radius: theme.borderRadius.sm,
                        }).background,
                      )
                    : hoveredButton === `tab-${tabIndex}`
                      ? String(
                          getInteractiveTileStyle(theme, {
                            hovered: true,
                            radius: theme.borderRadius.sm,
                          }).background,
                        )
                      : String(
                          getPanelInsetStyle(theme, {
                            radius: theme.borderRadius.sm,
                          }).background,
                        ),
                color: isSelected
                  ? theme.colors.text.primary
                  : hoveredButton === `tab-${tabIndex}`
                    ? theme.colors.text.primary
                    : theme.colors.text.secondary,
                borderTop: borderColor,
                borderLeft: borderColor,
                borderRight: borderColor,
                borderBottom: "none",
                opacity: isPlaceholderIcon && !isSelected ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                setHoveredButton(`tab-${tabIndex}`);
                setHoverTooltip({
                  label: tooltipLabel,
                  position: { x: e.clientX, y: e.clientY },
                });
              }}
              onMouseMove={(e) => {
                setHoverTooltip((prev) =>
                  prev
                    ? { ...prev, position: { x: e.clientX, y: e.clientY } }
                    : prev,
                );
              }}
              onMouseLeave={() => {
                setHoveredButton((prev) =>
                  prev === `tab-${tabIndex}` ? null : prev,
                );
                setHoverTooltip(null);
              }}
            >
              <div
                style={getTabIconSlotStyle(
                  isSelected
                    ? "active"
                    : isHovered || hoveredButton === `tab-${tabIndex}`
                      ? "hovered"
                      : "idle",
                )}
              >
                {tabIcon}
              </div>
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
          className="px-2 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
          title="Drag an item here to create a new tab"
          style={{
            background:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? String(
                    getInteractiveTileStyle(theme, {
                      hovered: true,
                      radius: theme.borderRadius.sm,
                      accentColor: theme.colors.state.success,
                    }).background,
                  )
                : hoveredButton === "new-tab"
                  ? String(
                      getInteractiveTileStyle(theme, {
                        hovered: true,
                        radius: theme.borderRadius.sm,
                        accentColor: theme.colors.state.success,
                      }).background,
                    )
                  : String(
                      getPanelInsetStyle(theme, {
                        radius: theme.borderRadius.sm,
                      }).background,
                    ),
            color: theme.colors.state.success,
            borderTop:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? `1px solid ${theme.colors.state.success}`
                : hoveredButton === "new-tab"
                  ? `1px solid ${theme.colors.state.success}`
                  : `1px dashed ${theme.colors.state.success}66`,
            borderLeft:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? `1px solid ${theme.colors.state.success}`
                : hoveredButton === "new-tab"
                  ? `1px solid ${theme.colors.state.success}`
                  : `1px dashed ${theme.colors.state.success}66`,
            borderRight:
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                ? `1px solid ${theme.colors.state.success}`
                : hoveredButton === "new-tab"
                  ? `1px solid ${theme.colors.state.success}`
                  : `1px dashed ${theme.colors.state.success}66`,
            borderBottom: "none",
          }}
          onMouseEnter={(e) => {
            setHoveredButton("new-tab");
            setHoverTooltip({
              label: "Drag an item here to create a new tab",
              position: { x: e.clientX, y: e.clientY },
            });
          }}
          onMouseMove={(e) => {
            setHoverTooltip((prev) =>
              prev?.label === "Drag an item here to create a new tab"
                ? {
                    label: prev.label,
                    position: { x: e.clientX, y: e.clientY },
                  }
                : prev,
            );
          }}
          onMouseLeave={() => {
            setHoveredButton((prev) => (prev === "new-tab" ? null : prev));
            setHoverTooltip((prev) =>
              prev?.label === "Drag an item here to create a new tab"
                ? null
                : prev,
            );
          }}
        >
          <div
            style={getTabIconSlotStyle(
              hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER ||
                hoveredButton === "new-tab"
                ? "success"
                : "idle",
            )}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
          </div>
        </button>
      )}

      {hoverTooltip && (
        <CursorTooltip
          visible={true}
          position={hoverTooltip.position}
          estimatedSize={{ width: 220, height: 48 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: "160px",
            maxWidth: "260px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            {hoverTooltip.label}
          </div>
        </CursorTooltip>
      )}
    </div>
  );
}
