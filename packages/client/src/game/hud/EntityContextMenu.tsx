import React, { useState, useEffect, useRef } from "react";
import type { World, LabelSegment } from "@hyperforge/shared";
import { useThemeStore } from "@/ui";
import { UI } from "@/ui/core";
import {
  getContextMenuItemStyle,
  getContextMenuSurfaceStyle,
} from "@/ui/theme/themes";

export interface ContextMenuAction {
  id: string;
  label: string;
  /** Rich text label with colors/styles - takes precedence over label if present */
  styledLabel?: LabelSegment[];
  icon?: string;
  enabled: boolean;
  onClick: () => void;
}

/**
 * Render a styled label with colored segments.
 * Falls back to plain label if no styledLabel provided.
 */
function renderStyledLabel(
  styledLabel: LabelSegment[] | undefined,
  fallbackLabel: string,
): React.ReactNode {
  if (!styledLabel || styledLabel.length === 0) {
    return fallbackLabel;
  }

  return (
    <>
      {styledLabel.map((segment, index) => (
        <span
          key={index}
          style={{
            color: segment.color,
            fontWeight: segment.bold ? "bold" : undefined,
            fontStyle: segment.italic ? "italic" : undefined,
          }}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

export interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number };
  target: {
    id: string;
    type:
      | "item"
      | "resource"
      | "mob"
      | "corpse"
      | "npc"
      | "bank"
      | "store"
      | "headstone"
      | "player"
      | "terrain";
    name: string;
  } | null;
  actions: ContextMenuAction[];
}

interface EntityContextMenuProps {
  world: World;
}

export function EntityContextMenu({ world: _world }: EntityContextMenuProps) {
  const theme = useThemeStore((s) => s.theme);
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    target: null,
    actions: [],
  });

  // Ref to track menu visibility for event dispatch (avoids memory leak in state setter)
  const menuVisibleRef = useRef(false);
  menuVisibleRef.current = menu.visible;

  useEffect(() => {
    // Listen for context menu requests from any system
    const handleContextMenu = (event: Event) => {
      const customEvent = event as CustomEvent<{
        target: {
          id: string;
          type:
            | "item"
            | "resource"
            | "mob"
            | "corpse"
            | "npc"
            | "bank"
            | "store"
            | "headstone"
            | "player"
            | "terrain";
          name: string;
          position?: { x: number; y: number; z: number } | null;
          [key: string]: unknown;
        };
        mousePosition: { x: number; y: number };
        items: Array<{
          id: string;
          label: string;
          icon?: string;
          styledLabel?: LabelSegment[];
          enabled: boolean;
        }>;
      }>;

      if (!customEvent.detail) return;

      const { target, mousePosition, items } = customEvent.detail;

      // Convert items to actions with onClick handlers
      const actions: ContextMenuAction[] = items.map((item) => ({
        ...item,
        onClick: () => {
          // Dispatch selection event
          const selectEvent = new CustomEvent("contextmenu:select", {
            detail: {
              actionId: item.id,
              targetId: target.id,
              position: mousePosition,
            },
          });
          window.dispatchEvent(selectEvent);
          setMenu((prev) => ({ ...prev, visible: false }));
        },
      }));

      setMenu({
        visible: true,
        position: mousePosition,
        target: {
          id: target.id,
          type: target.type,
          name: target.name,
        },
        actions,
      });
    };

    // Listen for close events
    const handleClose = () => {
      setMenu((prev) => ({ ...prev, visible: false }));
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't close if clicking inside menu
      if (target.closest(".context-menu")) {
        return;
      }

      // Dispatch close event before state update (using ref to avoid memory leak)
      if (menuVisibleRef.current) {
        window.dispatchEvent(new CustomEvent("contextmenu:close"));
      }
      setMenu((prev) => ({ ...prev, visible: false }));
    };

    window.addEventListener("contextmenu", handleContextMenu as EventListener);
    window.addEventListener("contextmenu:close", handleClose as EventListener);
    // Use click (not mousedown) to let onClick handlers fire first
    document.addEventListener("click", handleClickOutside, false);

    return () => {
      window.removeEventListener(
        "contextmenu",
        handleContextMenu as EventListener,
      );
      window.removeEventListener(
        "contextmenu:close",
        handleClose as EventListener,
      );
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  if (!menu.visible || !menu.target) return null;

  // Calculate position to keep menu in viewport
  const menuWidth = 280; // maxWidth
  const menuHeight = 300; // maxHeight
  const padding = 8;

  let adjustedX = menu.position.x;
  let adjustedY = menu.position.y;

  // Clamp to viewport boundaries
  if (adjustedX + menuWidth + padding > window.innerWidth) {
    adjustedX = Math.max(padding, window.innerWidth - menuWidth - padding);
  }
  if (adjustedY + menuHeight + padding > window.innerHeight) {
    adjustedY = Math.max(padding, window.innerHeight - menuHeight - padding);
  }
  // Also clamp to left/top edges
  adjustedX = Math.max(padding, adjustedX);
  adjustedY = Math.max(padding, adjustedY);

  const menuStyle: React.CSSProperties = {
    left: `${adjustedX}px`,
    top: `${adjustedY}px`,
    minWidth: "160px",
    maxWidth: "280px",
    maxHeight: "300px", // Limit height for large piles
    overflowY: "auto", // Scroll if too many items
    pointerEvents: "auto",
    userSelect: "none",
    color: "#fff", // White text
  };

  return (
    <div
      className="context-menu fixed rounded pointer-events-auto"
      style={{
        ...menuStyle,
        ...getContextMenuSurfaceStyle(theme, {
          minWidth: 180,
          radius: theme.borderRadius.md,
        }),
        zIndex: UI.Z_INDEX.CONTEXT_MENU,
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {menu.actions.map((action) => {
        return (
          <div
            key={action.id}
            className={`px-3 py-1.5 text-sm text-white transition-colors ${
              action.enabled
                ? "cursor-pointer"
                : "cursor-not-allowed opacity-50"
            }`}
            style={{
              ...getContextMenuItemStyle(theme, {
                radius: 0,
                padding: "6px 12px",
              }),
              pointerEvents: "auto",
              color: theme.colors.text.primary,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (action.enabled) {
                action.onClick();
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {renderStyledLabel(action.styledLabel, action.label)}
          </div>
        );
      })}
    </div>
  );
}
