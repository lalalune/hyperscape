/**
 * ActionBarPanel - Context menu component
 */

import React, { memo, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/ui";
import { UI } from "@/ui/core";
import {
  getContextMenuItemStyle,
  getContextMenuSurfaceStyle,
} from "@/ui/theme/themes";
import { CONTEXT_MENU_COLORS } from "@hyperforge/shared";
import type {
  ActionBarSlotContent,
  ContextMenuItem,
  ContextMenuState,
} from "./types";

export interface UseContextMenuResult {
  contextMenu: ContextMenuState;
  menuRef: React.RefObject<HTMLDivElement | null>;
  handleContextMenu: (
    e: React.MouseEvent,
    slot: ActionBarSlotContent,
    index: number,
  ) => void;
  handleMenuItemClick: (menuItem: ContextMenuItem) => void;
  handleRubbishBinContextMenu: (e: React.MouseEvent) => void;
}

export function useContextMenu(
  handleUseSlot: (slot: ActionBarSlotContent, index: number) => void,
  handleClearAll: () => void,
): UseContextMenuResult {
  const menuRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
    targetSlot: null,
    targetIndex: -1,
  });

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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu.visible]);

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, slot: ActionBarSlotContent, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      const menuItems: ContextMenuItem[] = [];

      if (slot.type !== "empty") {
        const name =
          slot.label ||
          slot.itemId ||
          slot.skillId ||
          slot.prayerId ||
          "Unknown";

        const actionText =
          slot.type === "prayer"
            ? "Activate "
            : slot.type === "skill"
              ? "View "
              : "Use ";
        const slotColor =
          slot.type === "prayer"
            ? "#60a5fa"
            : slot.type === "skill"
              ? "#4ade80"
              : CONTEXT_MENU_COLORS.ITEM;

        menuItems.push({
          id: "use",
          label: `${actionText}${name}`,
          styledLabel: [
            { text: actionText, color: "#fff" },
            { text: name, color: slotColor },
          ],
        });

        menuItems.push({
          id: "remove",
          label: `Remove ${name}`,
          styledLabel: [
            { text: "Remove ", color: "#fff" },
            { text: name, color: slotColor },
          ],
        });
      }

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
        targetSlot: slot,
        targetIndex: index,
      });
    },
    [],
  );

  // Handle context menu item click
  const handleMenuItemClick = useCallback(
    (menuItem: ContextMenuItem) => {
      if (menuItem.id === "cancel") {
        setContextMenu((prev) => ({ ...prev, visible: false }));
        return;
      }

      if (menuItem.id === "use" && contextMenu.targetSlot) {
        handleUseSlot(contextMenu.targetSlot, contextMenu.targetIndex);
      } else if (menuItem.id === "remove") {
        // Note: This will be handled by parent - we just close the menu
        // The parent needs to listen to this and update slots
      } else if (menuItem.id === "clearAll") {
        handleClearAll();
      }

      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [
      contextMenu.targetSlot,
      contextMenu.targetIndex,
      handleUseSlot,
      handleClearAll,
    ],
  );

  // Handle rubbish bin context menu
  const handleRubbishBinContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuItems: ContextMenuItem[] = [
      {
        id: "clearAll",
        label: "Clear All",
        styledLabel: [
          { text: "Clear ", color: "#fff" },
          { text: "All", color: "#ef4444" },
        ],
      },
      {
        id: "cancel",
        label: "Cancel",
        styledLabel: [{ text: "Cancel", color: "#fff" }],
      },
    ];

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      items: menuItems,
      targetSlot: null,
      targetIndex: -1,
    });
  }, []);

  return {
    contextMenu,
    menuRef,
    handleContextMenu,
    handleMenuItemClick,
    handleRubbishBinContextMenu,
  };
}

/** Context menu portal component */
export const ContextMenuPortal = memo(function ContextMenuPortal({
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
  const theme = useTheme();
  const [position, setPosition] = useState(() => ({
    left: Math.max(4, x),
    top: Math.max(4, y - 100),
  }));
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const padding = 4;
    let finalTop = y - rect.height - padding;
    if (finalTop < padding) finalTop = y + padding;
    const finalLeft = Math.max(
      padding,
      Math.min(x, window.innerWidth - rect.width - padding),
    );

    setPosition({ left: finalLeft, top: finalTop });
    setIsPositioned(true);
  }, [x, y, menuRef]);

  return (
    <div
      ref={menuRef}
      className="fixed"
      style={{
        left: position.left,
        top: position.top,
        zIndex: UI.Z_INDEX.CONTEXT_MENU,
        opacity: isPositioned ? 1 : 0,
        visibility: isPositioned ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          ...getContextMenuSurfaceStyle(theme, {
            minWidth: 124,
            radius: theme.borderRadius.sm,
          }),
        }}
      >
        {items.map((menuItem, idx) => (
          <button
            key={menuItem.id}
            onClick={() => onItemClick(menuItem)}
            className="w-full text-left transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60"
            style={{
              ...getContextMenuItemStyle(theme, {
                radius: 0,
                padding: "4px 8px",
              }),
              fontSize: 10,
              border: "none",
              cursor: "pointer",
              borderTop:
                idx > 0 ? `1px solid ${theme.colors.border.default}26` : "none",
              display: "block",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(214, 197, 160, 0.12) 24%, rgba(21, 25, 31, 0.98) 100%)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {menuItem.styledLabel.map((segment, i) => (
              <span key={i} style={{ color: segment.color || "#fff" }}>
                {segment.text}
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
});

/** Context menu portal wrapper for rendering */
export function ActionBarContextMenuPortal({
  contextMenu,
  menuRef,
  onItemClick,
}: {
  contextMenu: ContextMenuState;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onItemClick: (item: ContextMenuItem) => void;
}): React.ReactNode {
  if (!contextMenu.visible) return null;

  return createPortal(
    <ContextMenuPortal
      menuRef={menuRef}
      x={contextMenu.x}
      y={contextMenu.y}
      items={contextMenu.items}
      onItemClick={onItemClick}
    />,
    document.body,
  );
}
