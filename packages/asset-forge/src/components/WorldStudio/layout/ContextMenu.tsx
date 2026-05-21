/**
 * ContextMenu — Portal-rendered right-click context menu.
 *
 * Positioned at the mouse coordinates with smart edge detection:
 * if the menu would overflow the right or bottom edge of the viewport
 * it flips direction to stay on screen.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ContextMenuItem {
  label: string;
  icon?: React.ComponentType<{ size: number }>;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** When true, renders a divider line instead of a clickable row. */
  separator?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ITEM_HEIGHT = 28;
const PADDING_X = 8;
const MENU_MIN_WIDTH = 160;
const VIEWPORT_MARGIN = 8;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(
    null,
  );

  /* ---- Edge detection: measure the menu, flip if needed ---- */
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    let x = position.x;
    let y = position.y;

    if (x + rect.width > window.innerWidth - VIEWPORT_MARGIN) {
      x = position.x - rect.width;
    }
    if (y + rect.height > window.innerHeight - VIEWPORT_MARGIN) {
      y = position.y - rect.height;
    }

    // Clamp to viewport so the menu never goes off-screen entirely
    x = Math.max(VIEWPORT_MARGIN, x);
    y = Math.max(VIEWPORT_MARGIN, y);

    setAdjusted({ x, y });
  }, [position]);

  /* ---- Click-outside to close ---- */
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use capture so we close before any other handler fires
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onClose]);

  /* ---- Escape to close ---- */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  /* ---- Item click handler ---- */
  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled || item.separator) return;
      item.onClick?.();
      onClose();
    },
    [onClose],
  );

  /* ---- Render ---- */
  const menu = (
    <div
      ref={menuRef}
      role="menu"
      className={`fixed z-[9999] py-1 rounded-lg border bg-bg-elevated border-border-secondary ${adjusted ? "ws-dropdown" : ""}`}
      style={{
        left: adjusted?.x ?? position.x,
        top: adjusted?.y ?? position.y,
        minWidth: MENU_MIN_WIDTH,
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
        overflowY: "auto",
        opacity: adjusted ? 1 : 0,
        borderTop: "1px solid var(--surface-highlight-strong)",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.02)",
      }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${idx}`}
              className="my-1 mx-2 border-t border-border-secondary"
              role="separator"
            />
          );
        }

        const Icon = item.icon;

        return (
          <button
            key={`${item.label}-${idx}`}
            role="menuitem"
            disabled={item.disabled}
            className={[
              "flex w-full items-center gap-2 text-left text-xs transition-colors duration-100",
              item.disabled
                ? "text-text-tertiary/50 cursor-not-allowed"
                : item.danger
                  ? "text-red-400 hover:bg-red-400/10"
                  : "text-text-primary hover:bg-bg-tertiary/40",
            ].join(" ")}
            style={{
              height: ITEM_HEIGHT,
              paddingLeft: PADDING_X,
              paddingRight: PADDING_X,
            }}
            onClick={() => handleItemClick(item)}
          >
            {Icon && (
              <span className="flex-shrink-0 w-4 flex items-center justify-center">
                <Icon size={14} />
              </span>
            )}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 flex-shrink-0 text-[10px] text-text-tertiary">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return createPortal(menu, document.body);
}
