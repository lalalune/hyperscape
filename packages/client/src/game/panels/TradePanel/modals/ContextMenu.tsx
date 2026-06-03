/**
 * Trade Context Menu Component
 *
 * OSRS-style context menu for trade inventory items.
 * Shows offer options (1, 5, 10, X, All) plus Value and Examine.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getItem } from "@hyperforge/shared";
import {
  getContextMenuItemStyle,
  getContextMenuSurfaceStyle,
  getPanelHeaderStyle,
} from "@/ui/theme/themes";
import { UI } from "@/ui/core";
import type { TradeContextMenuProps } from "../types";

export function TradeContextMenu({
  x,
  y,
  item,
  theme,
  onOffer,
  onClose,
}: TradeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemData = getItem(item.itemId);
  const itemName = itemData?.name || item.itemId;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 280);

  const menuOptions = [
    { label: `Offer ${itemName}`, action: () => onOffer(1) },
    { label: "Offer-5", action: () => onOffer(5) },
    { label: "Offer-10", action: () => onOffer(10) },
    { label: "Offer-X", action: () => onOffer("x") },
    { label: "Offer-All", action: () => onOffer("all") },
    { label: "Value", action: () => onOffer("value") },
    { label: "Examine", action: () => onOffer("examine") },
  ];

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        zIndex: UI.Z_INDEX.CONTEXT_MENU,
        ...getContextMenuSurfaceStyle(theme, {
          minWidth: 160,
          radius: theme.borderRadius.md,
        }),
        padding: "2px 0",
      }}
    >
      {/* Header with item name */}
      <div
        style={{
          ...getPanelHeaderStyle(theme),
          padding: "4px 8px",
          color: theme.colors.text.accent,
          fontWeight: "bold",
          fontSize: "12px",
        }}
      >
        {itemName}
      </div>
      {menuOptions.map((option, i) => (
        <div
          key={i}
          onClick={() => {
            option.action();
            onClose();
          }}
          style={{
            ...getContextMenuItemStyle(theme, {
              radius: theme.borderRadius.sm,
              padding: "4px 8px",
            }),
            color:
              i === 0 ? theme.colors.text.accent : theme.colors.text.primary,
            fontSize: "12px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(214, 197, 160, 0.12) 24%, rgba(21, 25, 31, 0.98) 100%)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {option.label}
        </div>
      ))}
    </div>,
    document.body,
  );
}
