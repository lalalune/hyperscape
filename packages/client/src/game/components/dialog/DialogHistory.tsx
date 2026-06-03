/**
 * DialogHistory Component
 *
 * Scrollable conversation log showing dialog history.
 * Displays NPC and player messages with timestamps and portraits.
 *
 * @packageDocumentation
 */

import React, {
  memo,
  useEffect,
  useRef,
  type CSSProperties,
  type RefObject,
} from "react";
import { useTheme } from "@/ui";
import type { DialogHistoryEntry, DialogMood } from "@/game/systems";

// ============================================================================
// Types
// ============================================================================

/** Props for DialogHistory component */
export interface DialogHistoryProps {
  /** History entries to display */
  entries: DialogHistoryEntry[];
  /** Optional external scroll ref (from useDialogHistory) */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Maximum height before scrolling */
  maxHeight?: number | string;
  /** Whether to auto-scroll to bottom on new entries */
  autoScroll?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show portraits in history */
  showPortraits?: boolean;
  /** Player name (for "You" replacement) */
  playerName?: string;
  /** Click handler for entry (e.g., to replay voice line) */
  onEntryClick?: (entry: DialogHistoryEntry) => void;
  /** Render function for custom entry content */
  renderEntry?: (entry: DialogHistoryEntry) => React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/** Props for HistoryEntry component */
interface HistoryEntryProps {
  entry: DialogHistoryEntry;
  showTimestamp: boolean;
  showPortrait: boolean;
  onClick?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format timestamp to readable time */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Get mood indicator */
const MOOD_INDICATORS: Record<DialogMood, string> = {
  neutral: "",
  happy: "",
  sad: "",
  angry: "",
  surprised: "",
  thinking: "",
  worried: "",
  laughing: "",
  confused: "",
  serious: "",
};

// ============================================================================
// Components
// ============================================================================

/**
 * Individual history entry component
 */
const HistoryEntry = memo(function HistoryEntry({
  entry,
  showTimestamp,
  showPortrait,
  onClick,
}: HistoryEntryProps): React.ReactElement {
  const theme = useTheme();

  // Get style based on entry type
  const getEntryStyle = (): {
    align: "left" | "right" | "center";
    bgColor: string;
    textColor: string;
    nameColor: string;
  } => {
    switch (entry.type) {
      case "player":
        return {
          align: "right",
          bgColor:
            theme.name === "hyperia"
              ? "rgba(201, 165, 74, 0.15)"
              : "rgba(74, 158, 255, 0.15)",
          textColor: theme.colors.text.primary,
          nameColor: theme.colors.accent.secondary,
        };
      case "system":
        return {
          align: "center",
          bgColor: theme.colors.background.tertiary,
          textColor: theme.colors.text.muted,
          nameColor: theme.colors.text.muted,
        };
      case "action":
        return {
          align: "center",
          bgColor: "transparent",
          textColor: theme.colors.state.info,
          nameColor: theme.colors.state.info,
        };
      case "npc":
      default:
        return {
          align: "left",
          bgColor: theme.colors.background.secondary,
          textColor: theme.colors.text.primary,
          nameColor: theme.colors.accent.primary,
        };
    }
  };

  const entryStyle = getEntryStyle();

  // Container style
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems:
      entryStyle.align === "left"
        ? "flex-start"
        : entryStyle.align === "right"
          ? "flex-end"
          : "center",
    marginBottom: theme.spacing.sm,
  };

  // Message bubble style
  const bubbleStyle: CSSProperties = {
    display: "flex",
    gap: theme.spacing.sm,
    maxWidth:
      entry.type === "system" || entry.type === "action" ? "100%" : "80%",
    padding:
      entry.type === "action"
        ? `${theme.spacing.xs}px 0`
        : `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: entryStyle.bgColor,
    cursor: onClick ? "pointer" : "default",
    transition: theme.transitions.fast,
  };

  // Portrait style
  const portraitStyle: CSSProperties = {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.background.tertiary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.muted,
  };

  // Content style
  const contentStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  // Header style (name + mood + time)
  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginBottom: 2,
  };

  // Speaker name style
  const nameStyle: CSSProperties = {
    fontWeight: theme.typography.fontWeight.semibold,
    fontSize: theme.typography.fontSize.sm,
    color: entryStyle.nameColor,
  };

  // Mood indicator style
  const moodStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
  };

  // Timestamp style
  const timestampStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.muted,
    marginLeft: "auto",
  };

  // Text style
  const textStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.normal,
    color: entryStyle.textColor,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontStyle: entry.type === "action" ? "italic" : "normal",
  };

  // Get initials for fallback portrait
  const getInitials = (): string => {
    return entry.speaker
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  // System/action entries have simpler layout
  if (entry.type === "system" || entry.type === "action") {
    return (
      <div
        style={containerStyle}
        data-entry-id={entry.id}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div style={bubbleStyle}>
          <div style={contentStyle}>
            <span style={textStyle}>{entry.text}</span>
            {showTimestamp && (
              <span style={{ ...timestampStyle, marginLeft: theme.spacing.sm }}>
                {formatTime(entry.timestamp)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      data-entry-id={entry.id}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={bubbleStyle}>
        {/* Portrait */}
        {showPortrait && entry.type === "npc" && (
          <div style={portraitStyle}>
            {entry.portrait ? (
              <img
                src={entry.portrait}
                alt={entry.speaker}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              getInitials()
            )}
          </div>
        )}

        {/* Content */}
        <div style={contentStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <span style={nameStyle}>{entry.speaker}</span>
            {entry.mood && entry.mood !== "neutral" && (
              <span style={moodStyle}>{MOOD_INDICATORS[entry.mood]}</span>
            )}
            {showTimestamp && (
              <span style={timestampStyle}>{formatTime(entry.timestamp)}</span>
            )}
          </div>

          {/* Text */}
          <p style={{ ...textStyle, margin: 0 }}>{entry.text}</p>
        </div>
      </div>
    </div>
  );
});

/**
 * Dialog history/conversation log component
 *
 * @example
 * ```tsx
 * const history = useDialogHistory({ maxEntries: 100 });
 *
 * return (
 *   <DialogHistory
 *     entries={history.entries}
 *     scrollRef={history.scrollRef}
 *     maxHeight={300}
 *     showTimestamps
 *     showPortraits
 *     onEntryClick={(entry) => {
 *       if (entry.voiceLineId) {
 *         playVoiceLine(entry.voiceLineId);
 *       }
 *     }}
 *   />
 * );
 * ```
 */
export const DialogHistory = memo(function DialogHistory({
  entries,
  scrollRef: externalScrollRef,
  maxHeight = 300,
  autoScroll = true,
  showTimestamps = false,
  showPortraits = true,
  playerName: _playerName,
  onEntryClick,
  renderEntry,
  className,
  style,
}: DialogHistoryProps): React.ReactElement {
  const theme = useTheme();
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef || internalScrollRef;

  // Auto-scroll to bottom when entries change
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, autoScroll, scrollRef]);

  // Container style
  const containerStyle: CSSProperties = {
    maxHeight: typeof maxHeight === "number" ? maxHeight : maxHeight,
    overflowY: "auto",
    overflowX: "hidden",
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary + "80",
    borderRadius: theme.borderRadius.md,
    // Custom scrollbar styling
    scrollbarWidth: "thin",
    scrollbarColor: `${theme.colors.border.default} transparent`,
    ...style,
  };

  // Empty state style
  const emptyStyle: CSSProperties = {
    padding: theme.spacing.lg,
    textAlign: "center",
    color: theme.colors.text.muted,
    fontStyle: "italic",
    fontSize: theme.typography.fontSize.sm,
  };

  if (entries.length === 0) {
    return (
      <div className={className} style={containerStyle} ref={scrollRef}>
        <div style={emptyStyle}>No conversation history</div>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle} ref={scrollRef}>
      {entries.map((entry) =>
        renderEntry ? (
          <div key={entry.id} data-entry-id={entry.id}>
            {renderEntry(entry)}
          </div>
        ) : (
          <HistoryEntry
            key={entry.id}
            entry={entry}
            showTimestamp={showTimestamps}
            showPortrait={showPortraits}
            onClick={onEntryClick ? () => onEntryClick(entry) : undefined}
          />
        ),
      )}
    </div>
  );
});

// ============================================================================
// Compact History Component
// ============================================================================

/** Props for CompactHistory component */
export interface CompactHistoryProps {
  /** History entries */
  entries: DialogHistoryEntry[];
  /** Number of recent entries to show */
  recentCount?: number;
  /** Click to expand */
  onExpand?: () => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Compact history showing only recent entries with expand option
 *
 * @example
 * ```tsx
 * <CompactHistory
 *   entries={history.entries}
 *   recentCount={3}
 *   onExpand={() => setShowFullHistory(true)}
 * />
 * ```
 */
export const CompactHistory = memo(function CompactHistory({
  entries,
  recentCount = 3,
  onExpand,
  className,
  style,
}: CompactHistoryProps): React.ReactElement | null {
  const theme = useTheme();

  const recentEntries = entries.slice(-recentCount);
  const hiddenCount = entries.length - recentCount;

  if (entries.length === 0) return null;

  const containerStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    ...style,
  };

  const entryStyle: CSSProperties = {
    marginBottom: theme.spacing.xs,
    padding: `${theme.spacing.xs}px`,
    borderLeft: `2px solid ${theme.colors.border.default}`,
    paddingLeft: theme.spacing.sm,
  };

  const expandButtonStyle: CSSProperties = {
    background: "none",
    border: "none",
    padding: `${theme.spacing.xs}px`,
    color: theme.colors.accent.primary,
    cursor: "pointer",
    fontSize: theme.typography.fontSize.xs,
    textDecoration: "underline",
  };

  return (
    <div className={className} style={containerStyle}>
      {hiddenCount > 0 && onExpand && (
        <button style={expandButtonStyle} onClick={onExpand}>
          Show {hiddenCount} more message{hiddenCount !== 1 ? "s" : ""}...
        </button>
      )}
      {recentEntries.map((entry) => (
        <div key={entry.id} style={entryStyle}>
          <strong style={{ color: theme.colors.text.primary }}>
            {entry.speaker}:
          </strong>{" "}
          {entry.text.length > 50
            ? `${entry.text.slice(0, 50)}...`
            : entry.text}
        </div>
      ))}
    </div>
  );
});

export default DialogHistory;
