import React, { useState, useCallback, useEffect } from "react";
import {
  useWindowStore,
  useAutoCollapse,
  useBadge,
  BADGE_COLORS,
  type WindowConfig,
  useThemeStore,
} from "@/ui";

/** Ribbon category definition */
interface RibbonCategory {
  id: string;
  label: string;
  icon: string;
  items: RibbonItem[];
}

/** Ribbon item (panel that can be opened) */
interface RibbonItem {
  id: string;
  label: string;
  icon?: string;
  panelId: string;
}

/** Ribbon categories for Hyperia */
const CATEGORIES: RibbonCategory[] = [
  {
    id: "character",
    label: "Character",
    icon: "👤",
    items: [
      { id: "skills", label: "Skills", panelId: "skills" },
      { id: "combat", label: "Combat", panelId: "combat" },
      { id: "account", label: "Account", panelId: "account" },
    ],
  },
  {
    id: "gear",
    label: "Gear",
    icon: "🎒",
    items: [
      { id: "inventory", label: "Inventory", panelId: "inventory" },
      { id: "equipment", label: "Equipment", panelId: "equipment" },
      { id: "bank", label: "Bank", panelId: "bank" },
    ],
  },
  {
    id: "world",
    label: "World",
    icon: "🗺️",
    items: [
      { id: "quests", label: "Quests", panelId: "quests" },
      { id: "map", label: "World Map", panelId: "map" },
    ],
  },
  {
    id: "social",
    label: "Social",
    icon: "💬",
    items: [
      { id: "chat", label: "Chat", panelId: "chat" },
      { id: "friends", label: "Friends", panelId: "friends" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙️",
    items: [
      { id: "settings", label: "Settings", panelId: "settings" },
      { id: "presets", label: "Layout Presets", panelId: "presets" },
    ],
  },
];

/** NavigationRibbon Props */
interface NavigationRibbonProps {
  /** Position of the ribbon */
  position?: "top" | "bottom";
  /** Whether the ribbon is visible */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
}

/** Category button with badge support */
interface CategoryButtonProps {
  category: RibbonCategory;
  isExpanded: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  style: React.CSSProperties;
  activeStyle: React.CSSProperties;
}

function CategoryButton({
  category,
  isExpanded,
  onClick,
  onMouseEnter,
  style,
  activeStyle,
}: CategoryButtonProps) {
  const { badge, isVisible: hasBadge } = useBadge(category.id);
  const theme = useThemeStore((s) => s.theme);

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: badge
      ? BADGE_COLORS[badge.type]
      : theme.colors.state.danger,
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 600,
    borderRadius: theme.borderRadius.full,
    padding: "2px 5px",
    minWidth: 16,
    textAlign: "center",
    animation: badge?.pulsate ? "badge-pulse 1s infinite" : undefined,
    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
  };

  return (
    <button
      style={{
        ...style,
        ...(isExpanded ? activeStyle : {}),
        position: "relative",
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <span>{category.icon}</span>
      <span>{category.label}</span>
      {hasBadge && badge && (
        <span style={badgeStyle}>{badge.count > 99 ? "99+" : badge.count}</span>
      )}
    </button>
  );
}

/**
 * Navigation ribbon component
 *
 * Provides quick access to all game panels organized by category.
 * Coexists with the radial menu - user can choose their preference.
 *
 * @example
 * ```tsx
 * function GameUI() {
 *   const [showRibbon, setShowRibbon] = useState(true);
 *
 *   return (
 *     <>
 *       <NavigationRibbon visible={showRibbon} />
 *       <InterfaceManager>
 *         <GameViewport />
 *       </InterfaceManager>
 *     </>
 *   );
 * }
 * ```
 */
export function NavigationRibbon({
  position = "top",
  visible = true,
  onVisibilityChange,
}: NavigationRibbonProps): React.ReactElement | null {
  const theme = useThemeStore((s) => s.theme);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Auto-collapse the ribbon after inactivity using auto-collapse hook
  const { isCollapsed, containerProps, expand, collapse, isPending } =
    useAutoCollapse({
      collapseDelay: 5000, // 5 seconds of inactivity
      enabled: visible,
      onCollapse: () => setExpandedCategory(null), // Close dropdowns when collapsing
    });

  // Notify parent when visibility changes
  useEffect(() => {
    onVisibilityChange?.(visible && !isCollapsed);
  }, [visible, isCollapsed, onVisibilityChange]);

  const handleOpenPanel = useCallback((item: RibbonItem) => {
    const store = useWindowStore.getState();
    const windows = Array.from(store.windows.values());

    // Check if panel is already open in a window
    const existingWindow = windows.find((w) =>
      w.tabs.some((t) => t.content === item.panelId),
    );

    if (existingWindow) {
      // Bring window to front and activate the tab
      const tabIndex = existingWindow.tabs.findIndex(
        (t) => t.content === item.panelId,
      );
      if (tabIndex >= 0) {
        store.updateWindow(existingWindow.id, {
          activeTabIndex: tabIndex,
          visible: true,
        });
        store.bringToFront(existingWindow.id);
      }
      setExpandedCategory(null);
      return;
    }

    // Create new window with this panel
    const config: WindowConfig = {
      id: `panel-${item.panelId}-${Date.now()}`,
      position: {
        x: Math.max(100, window.innerWidth / 2 - 200),
        y: Math.max(100, window.innerHeight / 2 - 150),
      },
      size: { width: 400, height: 350 },
      minSize: { width: 250, height: 200 },
      tabs: [
        {
          id: item.panelId,
          label: item.label,
          content: item.panelId,
          closeable: true,
        },
      ],
    };
    store.createWindow(config);
    setExpandedCategory(null);
  }, []);

  if (!visible) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    [position]: isCollapsed ? -44 : 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: theme.colors.background.secondary,
    borderBottom:
      position === "top" ? `1px solid ${theme.colors.border.default}` : "none",
    borderTop:
      position === "bottom"
        ? `1px solid ${theme.colors.border.default}`
        : "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    zIndex: theme.zIndex.modal,
    transition: `${position} 200ms ease`,
    backdropFilter: "blur(10px)",
    pointerEvents: "auto", // Ensure clicks are captured
  };

  const categoryStyle: React.CSSProperties = {
    position: "relative",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    backgroundColor: "transparent",
    border: "none",
    color: theme.colors.text.secondary,
    cursor: "pointer",
    fontSize: theme.typography.fontSize.sm,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    transition: "all 150ms ease",
  };

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: position === "top" ? "100%" : "auto",
    bottom: position === "bottom" ? "100%" : "auto",
    left: 0,
    backgroundColor: theme.colors.background.tertiary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    minWidth: 150,
    boxShadow: theme.shadows.lg,
    zIndex: theme.zIndex.modal + 1,
  };

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    backgroundColor: "transparent",
    border: "none",
    color: theme.colors.text.primary,
    cursor: "pointer",
    fontSize: theme.typography.fontSize.sm,
    textAlign: "left",
    borderRadius: theme.borderRadius.sm,
    transition: "background-color 100ms ease",
  };

  const collapseButtonStyle: React.CSSProperties = {
    position: "absolute",
    right: theme.spacing.md,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    backgroundColor: "transparent",
    border: "none",
    color: theme.colors.text.muted,
    cursor: "pointer",
    fontSize: theme.typography.fontSize.xs,
  };

  return (
    <div style={containerStyle} {...containerProps}>
      {CATEGORIES.map((category) => (
        <div key={category.id} style={{ position: "relative" }}>
          <CategoryButton
            category={category}
            isExpanded={expandedCategory === category.id}
            onClick={() =>
              setExpandedCategory(
                expandedCategory === category.id ? null : category.id,
              )
            }
            onMouseEnter={() => {
              if (expandedCategory) {
                setExpandedCategory(category.id);
              }
            }}
            style={categoryStyle}
            activeStyle={{
              backgroundColor: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
            }}
          />

          {expandedCategory === category.id && (
            <div style={dropdownStyle}>
              {category.items.map((item) => (
                <button
                  key={item.id}
                  style={itemStyle}
                  onClick={() => handleOpenPanel(item)}
                  onMouseEnter={(e) => {
                    const btn = e.target as HTMLElement;
                    btn.style.backgroundColor =
                      theme.colors.background.secondary;
                  }}
                  onMouseLeave={(e) => {
                    const btn = e.target as HTMLElement;
                    btn.style.backgroundColor = "transparent";
                  }}
                >
                  {item.icon && (
                    <span style={{ marginRight: 8 }}>{item.icon}</span>
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <button
        style={{
          ...collapseButtonStyle,
          opacity: isPending ? 0.6 : 1,
        }}
        onClick={() => (isCollapsed ? expand() : collapse())}
        title={isCollapsed ? "Expand ribbon" : "Collapse ribbon"}
      >
        {isCollapsed ? "▼" : "▲"}
      </button>
    </div>
  );
}
