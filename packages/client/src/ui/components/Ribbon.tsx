/**
 * Ribbon Component
 *
 * Main navigation ribbon with 5 categories (modern MMORPG-style).
 * Supports collapsing, badges, and panel toggling.
 *
 * @packageDocumentation
 */

import React, { memo, useState, useCallback, type CSSProperties } from "react";
import { useTheme } from "../stores/themeStore";
import {
  useBadge,
  type BadgeType,
  BADGE_COLORS,
} from "../core/notifications/useBadges";
import { useAutoCollapse } from "../core/window/useAutoCollapse";

/** Ribbon category */
export interface RibbonCategory {
  id: string;
  icon: string;
  label: string;
  panels: string[];
  badge?: number;
  badgeType?: BadgeType;
}

/** Default ribbon categories (modern MMORPG-style) */
export const DEFAULT_CATEGORIES: RibbonCategory[] = [
  {
    id: "hero",
    icon: "⚔️",
    label: "Hero",
    panels: ["skills", "achievements", "pets", "stats"],
  },
  {
    id: "gear",
    icon: "🎒",
    label: "Gear",
    panels: ["inventory", "equipment", "cosmetics", "loadouts"],
  },
  {
    id: "adventures",
    icon: "📜",
    label: "Adventures",
    panels: ["quests", "challenges", "content_hub"],
  },
  {
    id: "community",
    icon: "👥",
    label: "Community",
    panels: ["friends", "clan", "messages", "hiscores"],
  },
  {
    id: "settings",
    icon: "⚙️",
    label: "Settings",
    panels: ["graphics", "audio", "controls", "edit_mode"],
  },
];

/** Props for RibbonTab component */
interface RibbonTabProps {
  category: RibbonCategory;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

/** Props for Ribbon component */
export interface RibbonProps {
  /** Categories to display */
  categories?: RibbonCategory[];
  /** Currently active category */
  activeCategory?: string;
  /** Callback when category is clicked */
  onCategoryClick?: (categoryId: string) => void;
  /** Callback when panel is clicked */
  onPanelClick?: (panelId: string) => void;
  /** Position of ribbon */
  position?: "top" | "bottom";
  /** Whether auto-collapse is enabled */
  autoCollapse?: boolean;
  /** Auto-collapse delay (ms) */
  collapseDelay?: number;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Individual ribbon tab component
 */
const RibbonTab = memo(function RibbonTab({
  category,
  isActive,
  isCollapsed,
  onClick,
}: RibbonTabProps) {
  const theme = useTheme();
  const { badge } = useBadge(category.id);

  const tabStyle: CSSProperties = {
    display: "flex",
    flexDirection: isCollapsed ? "column" : "row",
    alignItems: "center",
    gap: isCollapsed ? 2 : 8,
    padding: isCollapsed ? "8px 12px" : "12px 16px",
    backgroundColor: isActive
      ? theme.colors.background.tertiary
      : "transparent",
    border: "none",
    borderBottom: isActive
      ? `2px solid ${theme.colors.accent.primary}`
      : "2px solid transparent",
    color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
    cursor: "pointer",
    transition: `all ${theme.transitions.fast}`,
    position: "relative",
  };

  const iconStyle: CSSProperties = {
    fontSize: isCollapsed ? 20 : 16,
  };

  const labelStyle: CSSProperties = {
    fontSize: isCollapsed ? 10 : 14,
    fontWeight: isActive
      ? theme.typography.fontWeight.semibold
      : theme.typography.fontWeight.normal,
    whiteSpace: "nowrap",
  };

  const badgeStyle: CSSProperties = {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: badge
      ? BADGE_COLORS[badge.type]
      : theme.colors.state.danger,
    color: "#ffffff",
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.semibold,
    borderRadius: theme.borderRadius.full,
    padding: "2px 5px",
    minWidth: 16,
    textAlign: "center",
    animation: badge?.pulsate ? "badge-pulse 1s infinite" : undefined,
  };

  const showBadge = badge?.count ?? category.badge;

  return (
    <button style={tabStyle} onClick={onClick}>
      <span style={iconStyle}>{category.icon}</span>
      {!isCollapsed && <span style={labelStyle}>{category.label}</span>}
      {showBadge !== undefined && showBadge > 0 && (
        <span style={badgeStyle}>{showBadge > 99 ? "99+" : showBadge}</span>
      )}
    </button>
  );
});

/**
 * Ribbon dropdown panel
 */
const RibbonDropdown = memo(function RibbonDropdown({
  category,
  onPanelClick,
}: {
  category: RibbonCategory;
  onPanelClick?: (panelId: string) => void;
}) {
  const theme = useTheme();

  const dropdownStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    minWidth: 200,
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.md,
    boxShadow: theme.shadows.lg,
    padding: theme.spacing.sm,
    zIndex: theme.zIndex.dropdown,
  };

  const panelButtonStyle: CSSProperties = {
    display: "block",
    width: "100%",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    backgroundColor: "transparent",
    border: "none",
    borderRadius: theme.borderRadius.sm,
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.base,
    textAlign: "left",
    cursor: "pointer",
    transition: `background-color ${theme.transitions.fast}`,
  };

  return (
    <div style={dropdownStyle}>
      {category.panels.map((panelId) => (
        <button
          key={panelId}
          style={panelButtonStyle}
          onClick={() => onPanelClick?.(panelId)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.background.tertiary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {panelId.charAt(0).toUpperCase() +
            panelId.slice(1).replace(/_/g, " ")}
        </button>
      ))}
    </div>
  );
});

/**
 * Ribbon Component
 *
 * @example
 * ```tsx
 * function GameUI() {
 *   const [activeCategory, setActiveCategory] = useState<string | null>(null);
 *
 *   return (
 *     <Ribbon
 *       activeCategory={activeCategory}
 *       onCategoryClick={(id) => setActiveCategory(id === activeCategory ? null : id)}
 *       onPanelClick={(panelId) => openPanel(panelId)}
 *       autoCollapse
 *       collapseDelay={3000}
 *     />
 *   );
 * }
 * ```
 */
export const Ribbon = memo(function Ribbon({
  categories = DEFAULT_CATEGORIES,
  activeCategory,
  onCategoryClick,
  onPanelClick,
  position = "top",
  autoCollapse = false,
  collapseDelay = 3000,
  className,
  style,
}: RibbonProps) {
  const theme = useTheme();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { isCollapsed, containerProps } = useAutoCollapse({
    enabled: autoCollapse,
    collapseDelay,
  });

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      if (expandedCategory === categoryId) {
        setExpandedCategory(null);
      } else {
        setExpandedCategory(categoryId);
      }
      onCategoryClick?.(categoryId);
    },
    [expandedCategory, onCategoryClick],
  );

  const handlePanelClick = useCallback(
    (panelId: string) => {
      setExpandedCategory(null);
      onPanelClick?.(panelId);
    },
    [onPanelClick],
  );

  const containerStyle: CSSProperties = {
    position: "fixed",
    [position]: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    backgroundColor: theme.colors.background.glass,
    borderBottom:
      position === "top" ? `1px solid ${theme.colors.border.default}` : "none",
    borderTop:
      position === "bottom"
        ? `1px solid ${theme.colors.border.default}`
        : "none",
    backdropFilter: `blur(${theme.glass.blur}px)`,
    WebkitBackdropFilter: `blur(${theme.glass.blur}px)`,
    zIndex: theme.zIndex.sticky,
    transition: `height ${theme.transitions.normal}`,
    ...style,
  };

  const tabsContainerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    position: "relative",
  };

  return (
    <div className={className} style={containerStyle} {...containerProps}>
      <div style={tabsContainerStyle}>
        {categories.map((category) => (
          <div key={category.id} style={{ position: "relative" }}>
            <RibbonTab
              category={category}
              isActive={activeCategory === category.id}
              isCollapsed={isCollapsed}
              onClick={() => handleCategoryClick(category.id)}
            />
            {expandedCategory === category.id && (
              <RibbonDropdown
                category={category}
                onPanelClick={handlePanelClick}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Create a custom ribbon category
 */
export function createRibbonCategory(
  id: string,
  icon: string,
  label: string,
  panels: string[],
): RibbonCategory {
  return { id, icon, label, panels };
}
