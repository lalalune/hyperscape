/**
 * Quest Log Component
 *
 * Clean tile-based-MMORPG-style quest log with minimal UI chrome.
 * Features color-coded quest status and collapsible filters.
 *
 * @packageDocumentation
 */

import React, {
  memo,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type CSSProperties,
} from "react";
import { useTheme, useAccessibilityStore, useMobileLayout } from "@/ui";
import {
  getPanelSurfaceStyle,
  getPanelInsetStyle,
  getPanelHeaderStyle,
  getInteractiveTileStyle,
  getWindowSurfaceStyle,
  getDecorativeBorderStyle,
} from "@/ui/theme/themes";
import {
  PANEL_PADDING,
  PANEL_GRID_GAP,
  PANEL_MOBILE_PADDING,
  PANEL_SLOT_RADIUS,
} from "../../../constants/panelLayout";
import {
  type Quest,
  type QuestState,
  type QuestCategory,
  type QuestSortOption,
  type SortDirection,
  CATEGORY_CONFIG,
  STATE_CONFIG,
  calculateQuestProgress,
  formatTimeRemaining,
} from "@/game/systems";
import { QuestObjective } from "./QuestObjective";
import { QuestRewards } from "./QuestRewards";

/** Filter icon SVG */
const FilterIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 2h14v2H1V2zm2 4h10v2H3V6zm2 4h6v2H5v-2z" />
  </svg>
);

/** Search icon SVG */
const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
  </svg>
);

/** Category icon map */
const CATEGORY_ICONS: Record<string, string> = {
  crown: "\u{1F451}",
  scroll: "\u{1F4DC}",
  sun: "\u2600\uFE0F",
  calendar: "\u{1F4C5}",
  star: "\u2B50",
};

/** Props for QuestLog component */
export interface QuestLogProps {
  /** Quests to display (already filtered/sorted from hook) */
  quests: Quest[];
  /** Quest counts by state */
  questCounts?: {
    active: number;
    available: number;
    completed: number;
  };
  /** Search text */
  searchText?: string;
  /** Search change handler */
  onSearchChange?: (text: string) => void;
  /** Current sort option */
  sortBy?: QuestSortOption;
  /** Sort change handler */
  onSortChange?: (option: QuestSortOption) => void;
  /** Sort direction */
  sortDirection?: SortDirection;
  /** Sort direction change handler */
  onSortDirectionChange?: (direction: SortDirection) => void;
  /** Active state filter */
  stateFilter?: QuestState[];
  /** State filter change handler */
  onStateFilterChange?: (states: QuestState[]) => void;
  /** Active category filter */
  categoryFilter?: QuestCategory[];
  /** Category filter change handler */
  onCategoryFilterChange?: (categories: QuestCategory[]) => void;
  /** Currently selected quest ID */
  selectedQuestId?: string | null;
  /** Selection change handler */
  onSelectQuest?: (quest: Quest | null) => void;
  /** Pin toggle handler */
  onTogglePin?: (quest: Quest) => void;
  /** Accept quest handler */
  onAcceptQuest?: (quest: Quest) => void;
  /** Complete quest handler */
  onCompleteQuest?: (quest: Quest) => void;
  /** Track quest handler */
  onTrackQuest?: (quest: Quest) => void;
  /** Group by category */
  groupByCategory?: boolean;
  /** Show search bar */
  showSearch?: boolean;
  /** Show filters */
  showFilters?: boolean;
  /** Show sort options */
  showSort?: boolean;
  /** Show header */
  showHeader?: boolean;
  /** Title */
  title?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Max height (scrollable) */
  maxHeight?: number | string;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /**
   * If true, the internal popup is disabled and onQuestClick is called instead.
   * Use this when you want to render the quest detail in a separate window.
   */
  useExternalPopup?: boolean;
  /**
   * Called when a quest is clicked (only when useExternalPopup is true).
   * Use this to open the quest detail in a separate window/panel.
   */
  onQuestClick?: (quest: Quest) => void;
}

/** Get quest state color from theme-compatible STATE_CONFIG */
function getStateColor(state: QuestState): string {
  return STATE_CONFIG[state].color;
}

/** Props for Quest Detail Popup Component */
export interface QuestDetailPopupProps {
  quest: Quest;
  onClose: () => void;
  onTogglePin?: (quest: Quest) => void;
  onAcceptQuest?: (quest: Quest) => void;
  onCompleteQuest?: (quest: Quest) => void;
  onTrackQuest?: (quest: Quest) => void;
}

/**
 * Quest Detail Popup Component
 *
 * Displays detailed information about a quest including objectives,
 * rewards, and action buttons. Can be used standalone or within QuestLog.
 */
export const QuestDetailPopup = memo(function QuestDetailPopup({
  quest,
  onClose,
  onTogglePin,
  onAcceptQuest,
  onCompleteQuest,
  onTrackQuest,
}: QuestDetailPopupProps): React.ReactElement {
  const theme = useTheme();
  const { shouldUseMobileUI: isMobile } = useMobileLayout();
  const progress = calculateQuestProgress(quest);
  const categoryConfig = CATEGORY_CONFIG[quest.category];

  const canAccept = quest.state === "available";
  const canComplete = quest.state === "active" && progress === 100;

  const stateColor = getStateColor(quest.state);
  const categoryIcon =
    CATEGORY_ICONS[categoryConfig.icon] || categoryConfig.icon;

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: theme.zIndex.modal,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(6px)",
    padding: isMobile ? `${theme.spacing.sm}px` : 0,
  };

  // Use the actual game window surface for an immersive feel
  const windowBase = getWindowSurfaceStyle(theme, { state: "focused" });
  const decorBorder = getDecorativeBorderStyle(theme);
  const popupStyle: CSSProperties = {
    ...windowBase,
    ...decorBorder,
    width: isMobile ? "100%" : "400px",
    maxWidth: "92vw",
    maxHeight: isMobile ? "90vh" : "78vh",
    borderTop: `2px solid ${stateColor}`,
    padding: "0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  // Game-style header with gradient
  const panelHeader = getPanelHeaderStyle(theme);
  const headerStyle: CSSProperties = {
    ...panelHeader,
    display: "flex",
    alignItems: "center",
    gap: isMobile ? "8px" : "6px",
    padding: isMobile ? "10px 12px" : "8px 10px",
    minHeight: isMobile ? "48px" : "38px",
  };

  const buttonSize = isMobile ? "32px" : "24px";
  const headerBtnStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: buttonSize,
    height: buttonSize,
    background: `${theme.colors.slot.empty}`,
    border: `1px solid ${theme.colors.border.default}40`,
    color: theme.colors.text.muted,
    cursor: "pointer",
    padding: 0,
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: isMobile
      ? theme.typography.fontSize.lg
      : theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  // State indicator dot next to title
  const stateDotStyle: CSSProperties = {
    width: isMobile ? "8px" : "6px",
    height: isMobile ? "8px" : "6px",
    borderRadius: "50%",
    backgroundColor: stateColor,
    flexShrink: 0,
    boxShadow: `0 0 4px ${stateColor}60`,
  };

  const contentPad = isMobile ? "10px" : "8px";
  const contentStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: contentPad,
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? "8px" : "6px",
    WebkitOverflowScrolling: "touch",
  };

  // Inset section cards — the core "game panel" feel
  const sectionCardStyle: CSSProperties = {
    ...getPanelInsetStyle(theme, { radius: PANEL_SLOT_RADIUS }),
    padding: isMobile ? "8px 10px" : "6px 8px",
  };

  const sectionTitleStyle: CSSProperties = {
    color: theme.colors.accent.gold,
    fontSize: "9px",
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
    marginBottom: isMobile ? "6px" : "4px",
  };

  const descriptionStyle: CSSProperties = {
    color: theme.colors.text.secondary,
    fontSize: isMobile
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
    lineHeight: theme.typography.lineHeight.relaxed,
    margin: 0,
  };

  // Compact pill badges for meta info
  const metaBadgeStyle = (color: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    padding: isMobile ? "3px 7px" : "2px 5px",
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
    backgroundColor: `${color}15`,
    border: `1px solid ${color}25`,
    color,
    fontSize: isMobile ? "11px" : "9px",
    fontWeight: theme.typography.fontWeight.semibold,
    lineHeight: `${theme.typography.lineHeight.tight}`,
  });

  const progressBarContainerStyle: CSSProperties = {
    height: isMobile ? "5px" : "3px",
    backgroundColor: `${theme.colors.background.primary}80`,
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
    overflow: "hidden",
  };

  const progressBarFillStyle: CSSProperties = {
    height: "100%",
    width: `${progress}%`,
    backgroundColor: progress === 100 ? theme.colors.state.success : stateColor,
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
    transition: "width 0.3s ease",
  };

  // Action footer with game-style buttons
  const actionsStyle: CSSProperties = {
    ...panelHeader,
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    gap: `${PANEL_GRID_GAP + 2}px`,
    padding: isMobile ? "10px 12px" : "8px 10px",
    borderTop: `1px solid ${theme.colors.border.default}30`,
    borderBottom: "none",
  };

  const buttonBaseStyle: CSSProperties = {
    flex: isMobile ? "none" : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    padding: isMobile ? "8px 14px" : "5px 10px",
    border: "none",
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
    minHeight: isMobile ? "44px" : "28px",
    fontSize: isMobile
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const primaryButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: `linear-gradient(180deg, ${stateColor}, ${stateColor}cc)`,
    color: theme.colors.background.primary,
    boxShadow: `0 1px 3px ${stateColor}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
  };

  const secondaryButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: theme.colors.slot.empty,
    color: theme.colors.text.secondary,
    border: `1px solid ${theme.colors.border.default}40`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };

  return (
    <div
      style={overlayStyle}
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={popupStyle}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={headerStyle}>
          <button
            style={headerBtnStyle}
            onClick={onClose}
            title="Back to quest list"
          >
            <svg
              width={isMobile ? 18 : 14}
              height={isMobile ? 18 : 14}
              viewBox="0 0 16 16"
            >
              <path
                d="M11 2L5 8l6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h3 style={titleStyle}>
            {quest.pinned && (
              <span
                style={{ color: theme.colors.accent.gold, marginRight: "6px" }}
                title="Pinned"
              >
                ★
              </span>
            )}
            {quest.title}
          </h3>
          <button style={headerBtnStyle} onClick={onClose} title="Close">
            <svg
              width={isMobile ? 16 : 12}
              height={isMobile ? 16 : 12}
              viewBox="0 0 12 12"
            >
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle} className="scrollbar-thin">
          {/* Meta badges row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: `${PANEL_GRID_GAP + 2}px`,
            }}
          >
            <span style={metaBadgeStyle(categoryConfig.color)}>
              {categoryIcon} {categoryConfig.label}
            </span>
            <span style={metaBadgeStyle(theme.colors.text.secondary)}>
              Lv. {quest.level}
            </span>
            <span style={metaBadgeStyle(stateColor)}>
              {STATE_CONFIG[quest.state].label}
            </span>
            {quest.state === "active" && (
              <span style={metaBadgeStyle(stateColor)}>{progress}%</span>
            )}
          </div>

          {/* Timer if applicable */}
          {quest.timeRemaining !== undefined && quest.state === "active" && (
            <div
              style={{
                ...getPanelInsetStyle(theme, { radius: PANEL_SLOT_RADIUS + 2 }),
                padding: isMobile ? "8px 10px" : "6px 10px",
                background:
                  quest.timeRemaining <= 60
                    ? "rgba(248, 113, 113, 0.12)"
                    : "rgba(251, 191, 36, 0.12)",
                color:
                  quest.timeRemaining <= 60
                    ? theme.colors.state.danger
                    : theme.colors.state.warning,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12A5 5 0 118 3a5 5 0 010 10zm.5-8H7v4.5l3.5 2 .75-1.25-2.75-1.5V5z" />
              </svg>
              {formatTimeRemaining(quest.timeRemaining)}
            </div>
          )}

          {/* Progress bar for active quests */}
          {quest.state === "active" && quest.objectives.length > 0 && (
            <div style={progressBarContainerStyle}>
              <div style={progressBarFillStyle} />
            </div>
          )}

          {/* Description */}
          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Description</div>
            <p style={descriptionStyle}>{quest.description}</p>
            {quest.questGiver && (
              <div
                style={{
                  marginTop: `${PANEL_GRID_GAP + 2}px`,
                  color: theme.colors.text.muted,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                Quest giver:{" "}
                <span style={{ color: theme.colors.text.primary }}>
                  {quest.questGiver}
                </span>
                {quest.questGiverLocation && (
                  <span> · {quest.questGiverLocation}</span>
                )}
              </div>
            )}
          </div>

          {/* Objectives */}
          {quest.objectives.length > 0 && (
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Objectives</div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "2px" }}
              >
                {quest.objectives.map((objective) => (
                  <QuestObjective
                    key={objective.id}
                    objective={objective}
                    showProgress
                  />
                ))}
              </div>
            </div>
          )}

          {/* Rewards */}
          {quest.rewards.length > 0 && (
            <div style={sectionCardStyle}>
              <QuestRewards rewards={quest.rewards} showTitle />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          {canAccept && onAcceptQuest && (
            <button
              style={primaryButtonStyle}
              onClick={() => {
                onAcceptQuest(quest);
                onClose();
              }}
            >
              Accept Quest
            </button>
          )}
          {canComplete && onCompleteQuest && (
            <button
              style={primaryButtonStyle}
              onClick={() => {
                onCompleteQuest(quest);
                onClose();
              }}
            >
              Complete Quest
            </button>
          )}
          {quest.state === "active" && onTogglePin && (
            <button
              style={secondaryButtonStyle}
              onClick={() => onTogglePin(quest)}
            >
              {quest.pinned ? "★ Unpin" : "☆ Pin"}
            </button>
          )}
          {quest.state === "active" && onTrackQuest && (
            <button
              style={secondaryButtonStyle}
              onClick={() => onTrackQuest(quest)}
            >
              Track
            </button>
          )}
          {quest.state === "completed" && (
            <button style={secondaryButtonStyle} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

/** Quest List Item Component — Themed interactive tile */
interface QuestListItemProps {
  quest: Quest;
  onClick: () => void;
  isSelected?: boolean;
}

const QuestListItem = memo(function QuestListItem({
  quest,
  onClick,
  isSelected = false,
}: QuestListItemProps): React.ReactElement {
  const theme = useTheme();
  const { shouldUseMobileUI } = useMobileLayout();
  const { reducedMotion } = useAccessibilityStore();
  const [isHovered, setIsHovered] = useState(false);
  const progress = calculateQuestProgress(quest);
  const stateColor = getStateColor(quest.state);
  const categoryConfig = CATEGORY_CONFIG[quest.category];

  const tileBase = getInteractiveTileStyle(theme, {
    hovered: isHovered,
    active: isSelected,
    radius: PANEL_SLOT_RADIUS,
  });

  const tileStyle: CSSProperties = {
    ...tileBase,
    display: "flex",
    alignItems: "center",
    gap: shouldUseMobileUI ? 8 : 6,
    padding: shouldUseMobileUI
      ? `${PANEL_MOBILE_PADDING + 5}px ${PANEL_MOBILE_PADDING + 6}px`
      : `${PANEL_PADDING + 2}px ${PANEL_PADDING + 4}px`,
    cursor: "pointer",
    borderLeft: `3px solid ${isSelected ? theme.colors.border.active : stateColor}`,
    minHeight: shouldUseMobileUI ? 48 : 34,
    transition: reducedMotion
      ? "none"
      : "background-color 0.1s ease, border-color 0.1s ease",
  };

  const dotStyle: CSSProperties = {
    width: shouldUseMobileUI ? 8 : 6,
    height: shouldUseMobileUI ? 8 : 6,
    borderRadius: "50%",
    backgroundColor: stateColor,
    flexShrink: 0,
  };

  const titleContainerStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
  };

  const titleStyle: CSSProperties = {
    color: theme.colors.text.primary,
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.base
      : theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.lineHeight.tight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const subtitleStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: shouldUseMobileUI ? 6 : 4,
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
    color: theme.colors.text.muted,
    lineHeight: 1.2,
  };

  return (
    <div
      style={tileStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* State dot */}
      <div style={dotStyle} title={STATE_CONFIG[quest.state].label} />

      {/* Title and subtitle */}
      <div style={titleContainerStyle}>
        <span style={titleStyle}>
          {quest.pinned && (
            <span
              style={{
                color: theme.colors.accent.gold,
                marginRight: shouldUseMobileUI ? 5 : 3,
              }}
              title="Pinned"
            >
              ★
            </span>
          )}
          {quest.title}
        </span>
        <div style={subtitleStyle}>
          <span
            style={{
              color: categoryConfig.color,
              fontWeight: theme.typography.fontWeight.medium,
            }}
          >
            {categoryConfig.label}
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Lv. {quest.level}</span>
        </div>
      </div>

      {/* Progress (active quests) */}
      {quest.state === "active" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: shouldUseMobileUI ? 6 : 4,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: shouldUseMobileUI ? 48 : 36,
              height: shouldUseMobileUI ? 5 : 3,
              backgroundColor: theme.colors.background.tertiary,
              borderRadius: PANEL_SLOT_RADIUS,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                backgroundColor:
                  progress === 100
                    ? theme.colors.state.success
                    : theme.colors.accent.primary,
                transition: reducedMotion ? "none" : "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: shouldUseMobileUI
                ? theme.typography.fontSize.xs
                : theme.typography.fontSize.xs,
              color:
                progress === 100
                  ? theme.colors.state.success
                  : theme.colors.text.muted,
              fontWeight: theme.typography.fontWeight.medium,
              minWidth: shouldUseMobileUI ? 28 : 24,
              textAlign: "right",
            }}
          >
            {progress}%
          </span>
        </div>
      )}
    </div>
  );
});

/** Category Group Component — Themed header with accent bar */
interface CategoryGroupProps {
  category: QuestCategory;
  quests: Quest[];
  onQuestClick: (quest: Quest) => void;
  selectedQuestId?: string | null;
  defaultCollapsed?: boolean;
}

const CategoryGroup = memo(function CategoryGroup({
  category,
  quests,
  onQuestClick,
  selectedQuestId,
  defaultCollapsed = false,
}: CategoryGroupProps): React.ReactElement | null {
  const theme = useTheme();
  const { reducedMotion } = useAccessibilityStore();
  const { shouldUseMobileUI } = useMobileLayout();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const config = CATEGORY_CONFIG[category];
  const categoryIcon = CATEGORY_ICONS[config.icon] || "";

  if (quests.length === 0) {
    return null;
  }

  const insetBase = getPanelInsetStyle(theme, {
    emphasis: "normal",
    radius: PANEL_SLOT_RADIUS,
  });

  const headerStyle: CSSProperties = {
    ...insetBase,
    display: "flex",
    alignItems: "center",
    gap: shouldUseMobileUI ? 8 : 6,
    padding: shouldUseMobileUI
      ? `${PANEL_MOBILE_PADDING + 5}px ${PANEL_MOBILE_PADDING + 6}px`
      : `${PANEL_PADDING + 1}px ${PANEL_PADDING + 4}px`,
    cursor: "pointer",
    userSelect: "none",
    borderLeft: `3px solid ${config.color}`,
    minHeight: shouldUseMobileUI ? 40 : 28,
    marginBottom: 1,
  };

  const expandIconStyle: CSSProperties = {
    width: shouldUseMobileUI ? 14 : 10,
    height: shouldUseMobileUI ? 14 : 10,
    color: theme.colors.text.muted,
    transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
    transition: reducedMotion ? "none" : "transform 0.15s ease",
    flexShrink: 0,
  };

  const nameStyle: CSSProperties = {
    flex: 1,
    color: theme.colors.text.secondary,
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  };

  const countBadgeStyle: CSSProperties = {
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.xs
      : theme.typography.fontSize.xs,
    color: theme.colors.text.muted,
    backgroundColor: `${theme.colors.text.muted}15`,
    padding: shouldUseMobileUI ? "2px 8px" : "1px 6px",
    borderRadius: PANEL_SLOT_RADIUS,
    fontWeight: theme.typography.fontWeight.medium,
    flexShrink: 0,
  };

  return (
    <div style={{ marginBottom: PANEL_GRID_GAP }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`${config.label} category${collapsed ? ", collapsed" : ", expanded"}`}
        style={headerStyle}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed(!collapsed);
          }
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="currentColor"
          style={expandIconStyle}
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4V2z" />
        </svg>
        {categoryIcon && (
          <span
            style={{ fontSize: shouldUseMobileUI ? 14 : 11, lineHeight: 1 }}
            aria-hidden="true"
          >
            {categoryIcon}
          </span>
        )}
        <span style={nameStyle}>{config.label}</span>
        <span style={countBadgeStyle}>{quests.length}</span>
      </div>
      {!collapsed && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: PANEL_GRID_GAP,
            padding: `${PANEL_GRID_GAP}px 0`,
          }}
        >
          {quests.map((quest) => (
            <QuestListItem
              key={quest.id}
              quest={quest}
              onClick={() => onQuestClick(quest)}
              isSelected={quest.id === selectedQuestId}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** Pinned Group Component — Gold-accented header for pinned quests */
interface PinnedGroupProps {
  quests: Quest[];
  onQuestClick: (quest: Quest) => void;
  selectedQuestId?: string | null;
  defaultCollapsed?: boolean;
}

const PinnedGroup = memo(function PinnedGroup({
  quests,
  onQuestClick,
  selectedQuestId,
  defaultCollapsed = false,
}: PinnedGroupProps): React.ReactElement | null {
  const theme = useTheme();
  const { reducedMotion } = useAccessibilityStore();
  const { shouldUseMobileUI } = useMobileLayout();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const goldColor = theme.colors.accent.gold;

  if (quests.length === 0) {
    return null;
  }

  const insetBase = getPanelInsetStyle(theme, {
    emphasis: "normal",
    radius: PANEL_SLOT_RADIUS,
  });

  const headerStyle: CSSProperties = {
    ...insetBase,
    display: "flex",
    alignItems: "center",
    gap: shouldUseMobileUI ? 8 : 6,
    padding: shouldUseMobileUI
      ? `${PANEL_MOBILE_PADDING + 5}px ${PANEL_MOBILE_PADDING + 6}px`
      : `${PANEL_PADDING + 1}px ${PANEL_PADDING + 4}px`,
    cursor: "pointer",
    userSelect: "none",
    borderLeft: `3px solid ${goldColor}`,
    minHeight: shouldUseMobileUI ? 40 : 28,
    marginBottom: 1,
  };

  const expandIconStyle: CSSProperties = {
    width: shouldUseMobileUI ? 14 : 10,
    height: shouldUseMobileUI ? 14 : 10,
    color: theme.colors.text.muted,
    transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
    transition: reducedMotion ? "none" : "transform 0.15s ease",
    flexShrink: 0,
  };

  const nameStyle: CSSProperties = {
    flex: 1,
    color: theme.colors.text.secondary,
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  };

  const countBadgeStyle: CSSProperties = {
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.xs
      : theme.typography.fontSize.xs,
    color: goldColor,
    backgroundColor: `${goldColor}15`,
    padding: shouldUseMobileUI ? "2px 8px" : "1px 6px",
    borderRadius: PANEL_SLOT_RADIUS,
    fontWeight: theme.typography.fontWeight.medium,
    flexShrink: 0,
  };

  return (
    <div style={{ marginBottom: PANEL_GRID_GAP }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`Pinned quests${collapsed ? ", collapsed" : ", expanded"}`}
        style={headerStyle}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed(!collapsed);
          }
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="currentColor"
          style={expandIconStyle}
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4V2z" />
        </svg>
        <span
          style={{
            color: goldColor,
            fontSize: shouldUseMobileUI ? 14 : 11,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          ★
        </span>
        <span style={nameStyle}>Pinned</span>
        <span style={countBadgeStyle}>{quests.length}</span>
      </div>
      {!collapsed && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: PANEL_GRID_GAP,
            padding: `${PANEL_GRID_GAP}px 0`,
          }}
        >
          {quests.map((quest) => (
            <QuestListItem
              key={quest.id}
              quest={quest}
              onClick={() => onQuestClick(quest)}
              isSelected={quest.id === selectedQuestId}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Quest Log Component
 *
 * Clean tile-based-MMORPG-style quest log with minimal UI chrome and collapsible filters.
 */
export const QuestLog = memo(function QuestLog({
  quests,
  questCounts,
  searchText = "",
  onSearchChange,
  sortBy = "category",
  onSortChange,
  sortDirection = "asc",
  onSortDirectionChange,
  stateFilter = [],
  onStateFilterChange,
  categoryFilter = [],
  onCategoryFilterChange,
  selectedQuestId,
  onSelectQuest,
  onTogglePin,
  onAcceptQuest,
  onCompleteQuest,
  onTrackQuest,
  groupByCategory = true,
  showSearch = true,
  showFilters = true,
  showSort = true,
  showHeader = true,
  title = "Quest Log",
  emptyMessage = "No quests found",
  maxHeight,
  className,
  style,
  useExternalPopup = false,
  onQuestClick,
}: QuestLogProps): React.ReactElement {
  const theme = useTheme();
  const { reducedMotion } = useAccessibilityStore();
  const { shouldUseMobileUI } = useMobileLayout();
  const [popupQuest, setPopupQuest] = useState<Quest | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Auto-expand search if there's text
  useEffect(() => {
    if (searchText && searchText.length > 0) {
      setSearchExpanded(true);
    }
  }, [searchText]);

  // Handle quest click - open popup or call external handler
  const handleQuestClick = useCallback(
    (quest: Quest) => {
      // Notify parent of selection change
      if (onSelectQuest) {
        onSelectQuest(quest);
      }

      if (useExternalPopup && onQuestClick) {
        // Use external popup handler
        onQuestClick(quest);
      } else {
        // Use internal popup
        setPopupQuest(quest);
      }
    },
    [useExternalPopup, onQuestClick, onSelectQuest],
  );

  // Close popup
  const handleClosePopup = useCallback(() => {
    setPopupQuest(null);
  }, []);

  // Keep popupQuest in sync with quests array (for pinned state changes, etc.)
  useEffect(() => {
    if (popupQuest) {
      const updatedQuest = quests.find((q) => q.id === popupQuest.id);
      if (updatedQuest && updatedQuest.pinned !== popupQuest.pinned) {
        setPopupQuest(updatedQuest);
      }
    }
  }, [quests, popupQuest]);

  // Listen for pin changes from other components for immediate popup update
  useEffect(() => {
    const handlePinChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        questId: string;
        pinned: boolean;
      }>;
      const { questId, pinned } = customEvent.detail;
      if (popupQuest && popupQuest.id === questId) {
        setPopupQuest((prev) => (prev ? { ...prev, pinned } : null));
      }
    };

    window.addEventListener("questPinChanged", handlePinChange);
    return () => window.removeEventListener("questPinChanged", handlePinChange);
  }, [popupQuest]);

  // Separate pinned quests from non-pinned
  const pinnedQuests = useMemo(() => {
    return quests.filter((quest) => quest.pinned);
  }, [quests]);

  const nonPinnedQuests = useMemo(() => {
    return quests.filter((quest) => !quest.pinned);
  }, [quests]);

  // Group non-pinned quests by category
  const questsByCategory = useMemo(() => {
    if (!groupByCategory) return null;

    const groups: Record<QuestCategory, Quest[]> = {
      main: [],
      side: [],
      daily: [],
      weekly: [],
      event: [],
    };

    nonPinnedQuests.forEach((quest) => {
      groups[quest.category].push(quest);
    });

    return groups;
  }, [nonPinnedQuests, groupByCategory]);

  // Toggle state filter
  const toggleStateFilter = useCallback(
    (state: QuestState) => {
      if (!onStateFilterChange) return;

      if (stateFilter.includes(state)) {
        onStateFilterChange(stateFilter.filter((s) => s !== state));
      } else {
        onStateFilterChange([...stateFilter, state]);
      }
    },
    [stateFilter, onStateFilterChange],
  );

  // Toggle category filter
  const toggleCategoryFilter = useCallback(
    (category: QuestCategory) => {
      if (!onCategoryFilterChange) return;

      if (categoryFilter.includes(category)) {
        onCategoryFilterChange(categoryFilter.filter((c) => c !== category));
      } else {
        onCategoryFilterChange([...categoryFilter, category]);
      }
    },
    [categoryFilter, onCategoryFilterChange],
  );

  // Check if any filters are active
  const hasActiveFilters = stateFilter.length > 0 || categoryFilter.length > 0;

  const containerStyle: CSSProperties = {
    ...getPanelSurfaceStyle(theme),
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    height: "100%",
    ...style,
  };

  const headerStyle: CSSProperties = {
    ...getPanelInsetStyle(theme, { radius: 0 }),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: shouldUseMobileUI
      ? `${PANEL_MOBILE_PADDING * 2}px ${PANEL_MOBILE_PADDING * 2 + 2}px`
      : `${PANEL_PADDING}px ${PANEL_PADDING + 2}px`,
    minHeight: shouldUseMobileUI ? "36px" : "26px",
    gap: shouldUseMobileUI ? "6px" : `${PANEL_GRID_GAP}px`,
    borderBottom: `1px solid ${theme.colors.border.default}30`,
  };

  const statsStyle: CSSProperties = {
    display: "flex",
    gap: shouldUseMobileUI ? "6px" : `${PANEL_GRID_GAP}px`,
    flex: 1,
    flexWrap: "wrap",
  };

  const toolbarStyle: CSSProperties = {
    display: "flex",
    gap: shouldUseMobileUI ? "6px" : `${PANEL_GRID_GAP - 1}px`,
    alignItems: "center",
  };

  const iconButtonStyle = (active: boolean): CSSProperties => ({
    width: shouldUseMobileUI ? "32px" : "22px",
    height: shouldUseMobileUI ? "32px" : "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: active
      ? theme.colors.accent.primary
      : theme.colors.slot.empty,
    color: active ? theme.colors.background.primary : theme.colors.text.muted,
    border: `1px solid ${active ? theme.colors.accent.primary : theme.colors.border.default}30`,
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
    cursor: "pointer",
    padding: 0,
    transition: reducedMotion ? "none" : "all 0.1s ease",
  });

  const searchContainerStyle: CSSProperties = {
    padding: shouldUseMobileUI
      ? `${PANEL_MOBILE_PADDING * 2}px`
      : `${PANEL_PADDING}px ${PANEL_PADDING + 2}px`,
    borderBottom: `1px solid ${theme.colors.border.default}30`,
    display: searchExpanded ? "block" : "none",
  };

  const searchInputStyle: CSSProperties = {
    width: "100%",
    padding: shouldUseMobileUI ? "8px 12px" : "4px 8px",
    backgroundColor: theme.colors.slot.empty,
    border: `1px solid ${theme.colors.border.default}30`,
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
    color: theme.colors.text.primary,
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
    outline: "none",
  };

  const filtersContainerStyle: CSSProperties = {
    ...getPanelInsetStyle(theme, { radius: 0 }),
    padding: shouldUseMobileUI
      ? `${PANEL_MOBILE_PADDING * 2}px`
      : `${PANEL_PADDING}px ${PANEL_PADDING + 2}px`,
    borderBottom: `1px solid ${theme.colors.border.default}30`,
    display: filtersExpanded ? "flex" : "none",
    flexDirection: "column",
    gap: shouldUseMobileUI ? "6px" : `${PANEL_GRID_GAP}px`,
  };

  const filterRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: shouldUseMobileUI ? "6px" : `${PANEL_GRID_GAP}px`,
    flexWrap: "wrap",
  };

  const getFilterChipStyle = (active: boolean): CSSProperties => ({
    padding: shouldUseMobileUI ? "4px 8px" : "2px 6px",
    borderRadius: `${PANEL_SLOT_RADIUS}px`,
    backgroundColor: active
      ? theme.colors.accent.primary
      : theme.colors.slot.empty,
    color: active ? theme.colors.background.primary : theme.colors.text.muted,
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    cursor: "pointer",
    border: active ? "none" : `1px solid ${theme.colors.border.default}30`,
    transition: reducedMotion ? "none" : "all 0.1s ease",
    lineHeight: `${theme.typography.lineHeight.tight}`,
  });

  const contentStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    maxHeight: maxHeight,
    padding: shouldUseMobileUI
      ? `${PANEL_MOBILE_PADDING}px`
      : `${PANEL_PADDING}px`,
    WebkitOverflowScrolling: "touch",
  };

  const emptyStyle: CSSProperties = {
    padding: shouldUseMobileUI ? "24px" : "16px",
    textAlign: "center",
    color: theme.colors.text.muted,
    fontSize: shouldUseMobileUI
      ? theme.typography.fontSize.sm
      : theme.typography.fontSize.xs,
  };

  // Sort options
  const sortOptions: { value: QuestSortOption; label: string }[] = [
    { value: "category", label: "Category" },
    { value: "name", label: "Name" },
    { value: "level", label: "Level" },
    { value: "progress", label: "Progress" },
  ];

  // State filter options
  const stateOptions: QuestState[] = [
    "available",
    "active",
    "completed",
    "failed",
  ];

  // Category filter options - only main ones
  const categoryOptions: QuestCategory[] = ["main", "side", "daily"];

  return (
    <>
      <div className={className} style={containerStyle}>
        {/* Header with Title, Stats and Toolbar */}
        {showHeader && (
          <div style={headerStyle}>
            <span
              style={{
                color: theme.colors.text.secondary,
                fontSize: shouldUseMobileUI
                  ? theme.typography.fontSize.sm
                  : theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.semibold,
                marginRight: shouldUseMobileUI ? "8px" : "6px",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </span>
            {questCounts && (
              <div style={statsStyle}>
                {(
                  [
                    {
                      state: "active" as QuestState,
                      count: questCounts.active,
                      label: "Active",
                    },
                    {
                      state: "available" as QuestState,
                      count: questCounts.available,
                      label: "Avail",
                    },
                    {
                      state: "completed" as QuestState,
                      count: questCounts.completed,
                      label: "Done",
                    },
                  ] as const
                ).map(({ state, count, label }) => (
                  <span
                    key={state}
                    style={{
                      backgroundColor: `${getStateColor(state)}18`,
                      color: getStateColor(state),
                      padding: shouldUseMobileUI ? "2px 6px" : "1px 4px",
                      borderRadius: `${PANEL_SLOT_RADIUS}px`,
                      fontSize: shouldUseMobileUI
                        ? theme.typography.fontSize.xs
                        : "9px",
                      fontWeight: theme.typography.fontWeight.semibold,
                      lineHeight: `${theme.typography.lineHeight.tight}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {count} {label}
                  </span>
                ))}
              </div>
            )}
            <div style={toolbarStyle}>
              {/* Search toggle */}
              {showSearch && onSearchChange && (
                <button
                  style={iconButtonStyle(searchExpanded)}
                  onClick={() => setSearchExpanded(!searchExpanded)}
                  title="Search"
                >
                  <SearchIcon size={shouldUseMobileUI ? 16 : 12} />
                </button>
              )}
              {/* Filter toggle */}
              {showFilters &&
                (onStateFilterChange || onCategoryFilterChange) && (
                  <button
                    style={iconButtonStyle(filtersExpanded || hasActiveFilters)}
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                    title="Filters"
                  >
                    <FilterIcon size={shouldUseMobileUI ? 16 : 12} />
                  </button>
                )}
              {/* Sort dropdown with direction toggle */}
              {showSort && onSortChange && (
                <>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      onSortChange(e.target.value as QuestSortOption)
                    }
                    style={{
                      padding: shouldUseMobileUI ? "4px 6px" : "2px 4px",
                      backgroundColor: theme.colors.slot.empty,
                      border: `1px solid ${theme.colors.border.default}30`,
                      borderRadius: `${PANEL_SLOT_RADIUS}px`,
                      color: theme.colors.text.muted,
                      fontSize: shouldUseMobileUI
                        ? theme.typography.fontSize.xs
                        : "9px",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {sortOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {onSortDirectionChange && (
                    <button
                      style={{
                        ...iconButtonStyle(false),
                        width: shouldUseMobileUI ? "28px" : "20px",
                        height: shouldUseMobileUI ? "28px" : "20px",
                      }}
                      onClick={() =>
                        onSortDirectionChange(
                          sortDirection === "asc" ? "desc" : "asc",
                        )
                      }
                      title={
                        sortDirection === "asc" ? "Ascending" : "Descending"
                      }
                    >
                      <svg
                        width={shouldUseMobileUI ? 10 : 8}
                        height={shouldUseMobileUI ? 10 : 8}
                        viewBox="0 0 12 12"
                        fill="currentColor"
                        style={{
                          transform:
                            sortDirection === "desc"
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          transition: reducedMotion
                            ? "none"
                            : "transform 0.15s",
                        }}
                      >
                        <path d="M6 2l4 4H2l4-4z" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Collapsible Search */}
        {showSearch && onSearchChange && (
          <div style={searchContainerStyle}>
            <input
              type="text"
              placeholder="Search quests..."
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              style={searchInputStyle}
              autoFocus={searchExpanded}
            />
          </div>
        )}

        {/* Collapsible Filters */}
        {showFilters && (
          <div style={filtersContainerStyle}>
            {/* State filters */}
            {onStateFilterChange && (
              <div style={filterRowStyle}>
                {stateOptions.map((state) => (
                  <button
                    key={state}
                    style={getFilterChipStyle(stateFilter.includes(state))}
                    onClick={() => toggleStateFilter(state)}
                  >
                    {STATE_CONFIG[state].label}
                  </button>
                ))}
              </div>
            )}

            {/* Category filters */}
            {onCategoryFilterChange && (
              <div style={filterRowStyle}>
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    style={getFilterChipStyle(
                      categoryFilter.includes(category),
                    )}
                    onClick={() => toggleCategoryFilter(category)}
                  >
                    {CATEGORY_CONFIG[category].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content - Quest List */}
        <div style={contentStyle} className="osrs-scrollbar">
          {quests.length === 0 ? (
            <div style={emptyStyle}>
              <div style={{ opacity: 0.5, marginBottom: theme.spacing.xs }}>
                📜
              </div>
              <div>{emptyMessage}</div>
            </div>
          ) : groupByCategory && questsByCategory ? (
            // Grouped view with pinned quests at top
            <>
              {/* Pinned quests group - only shows if there are pinned quests */}
              <PinnedGroup
                quests={pinnedQuests}
                onQuestClick={handleQuestClick}
                selectedQuestId={selectedQuestId}
              />
              {/* Category groups - non-pinned quests */}
              {(Object.keys(questsByCategory) as QuestCategory[]).map(
                (category) => (
                  <CategoryGroup
                    key={category}
                    category={category}
                    quests={questsByCategory[category]}
                    onQuestClick={handleQuestClick}
                    selectedQuestId={selectedQuestId}
                  />
                ),
              )}
            </>
          ) : (
            // Flat list view with pinned quests at top
            <div>
              {/* Pinned quests group - only shows if there are pinned quests */}
              <PinnedGroup
                quests={pinnedQuests}
                onQuestClick={handleQuestClick}
                selectedQuestId={selectedQuestId}
              />
              {/* Non-pinned quests */}
              {nonPinnedQuests.map((quest) => (
                <QuestListItem
                  key={quest.id}
                  quest={quest}
                  onClick={() => handleQuestClick(quest)}
                  isSelected={quest.id === selectedQuestId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quest Detail Popup - only shown when not using external popup */}
      {!useExternalPopup && popupQuest && (
        <QuestDetailPopup
          quest={popupQuest}
          onClose={handleClosePopup}
          onTogglePin={onTogglePin}
          onAcceptQuest={onAcceptQuest}
          onCompleteQuest={onCompleteQuest}
          onTrackQuest={onTrackQuest}
        />
      )}
    </>
  );
});

export default QuestLog;
