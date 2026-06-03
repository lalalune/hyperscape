/**
 * DialogChoices Component
 *
 * Response options list for player choices in dialog.
 * Supports keyboard navigation (1-9 hotkeys, arrow keys).
 *
 * @packageDocumentation
 */

import React, { memo, useCallback, useEffect, type CSSProperties } from "react";
import { useTheme } from "@/ui";
import type { DialogChoice } from "@/game/systems";

// ============================================================================
// Types
// ============================================================================

/** Props for DialogChoices component */
export interface DialogChoicesProps {
  /** Available choices */
  choices: DialogChoice[];
  /** Currently highlighted/focused choice index */
  highlightedIndex?: number;
  /** Callback when choice is selected */
  onSelect?: (choiceId: string) => void;
  /** Callback when choice is hovered/highlighted */
  onHighlight?: (index: number) => void;
  /** Whether choices are currently selectable */
  disabled?: boolean;
  /** Whether to show hotkey numbers */
  showHotkeys?: boolean;
  /** Whether to enable keyboard navigation (arrow keys, enter) */
  enableKeyboard?: boolean;
  /** Whether to enable number key selection (1-9) */
  enableNumberKeys?: boolean;
  /** Layout direction */
  layout?: "vertical" | "horizontal" | "grid";
  /** Number of columns for grid layout */
  columns?: number;
  /** Choice button variant */
  variant?: "default" | "compact" | "minimal";
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/** Props for individual choice button */
export interface ChoiceButtonProps {
  /** Choice data */
  choice: DialogChoice;
  /** Position index */
  index: number;
  /** Whether this choice is highlighted */
  isHighlighted: boolean;
  /** Selection handler */
  onSelect: () => void;
  /** Highlight handler */
  onHighlight: () => void;
  /** Whether to show hotkey */
  showHotkey: boolean;
  /** Button variant */
  variant: "default" | "compact" | "minimal";
}

// ============================================================================
// Components
// ============================================================================

/**
 * Individual choice button component
 */
export const ChoiceButton = memo(function ChoiceButton({
  choice,
  index,
  isHighlighted,
  onSelect,
  onHighlight,
  showHotkey,
  variant,
}: ChoiceButtonProps): React.ReactElement {
  const theme = useTheme();
  const isDisabled = choice.disabled;

  // Get size based on variant
  const getPadding = () => {
    switch (variant) {
      case "compact":
        return `${theme.spacing.xs}px ${theme.spacing.sm}px`;
      case "minimal":
        return `${theme.spacing.xs}px`;
      default:
        return `${theme.spacing.sm}px ${theme.spacing.md}px`;
    }
  };

  // Button style
  const buttonStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: getPadding(),
    width: "100%",
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${
      isHighlighted ? theme.colors.accent.primary : theme.colors.border.default
    }`,
    backgroundColor: isHighlighted
      ? theme.name === "hyperia"
        ? "rgba(201, 165, 74, 0.2)"
        : "rgba(74, 158, 255, 0.2)"
      : "transparent",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    transition: theme.transitions.fast,
    fontFamily: theme.typography.fontFamily.body,
    fontSize:
      variant === "compact"
        ? theme.typography.fontSize.sm
        : theme.typography.fontSize.base,
    color: isHighlighted
      ? theme.colors.text.primary
      : theme.colors.text.secondary,
    textAlign: "left",
    // Remove default button styles
    outline: "none",
    WebkitAppearance: "none",
  };

  // Hotkey badge style
  const hotkeyStyle: CSSProperties = {
    flexShrink: 0,
    minWidth: variant === "compact" ? 16 : 20,
    height: variant === "compact" ? 16 : 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize:
      variant === "compact"
        ? theme.typography.fontSize.xs
        : theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: isHighlighted
      ? theme.colors.text.primary
      : theme.colors.accent.primary,
    backgroundColor: isHighlighted
      ? theme.colors.accent.primary + "40"
      : theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.sm,
  };

  // Text style
  const textStyle: CSSProperties = {
    flex: 1,
    lineHeight: theme.typography.lineHeight.tight,
  };

  // Arrow indicator for highlighted choice
  const arrowStyle: CSSProperties = {
    marginLeft: "auto",
    color: theme.colors.accent.primary,
    opacity: isHighlighted ? 1 : 0,
    transition: theme.transitions.fast,
  };

  return (
    <button
      style={buttonStyle}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDisabled) {
          onSelect();
        }
      }}
      onMouseEnter={onHighlight}
      onFocus={onHighlight}
      disabled={isDisabled}
      title={isDisabled ? choice.disabledReason : undefined}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? -1 : 0}
    >
      {showHotkey && (
        <span style={hotkeyStyle}>{choice.hotkey ?? index + 1}</span>
      )}
      <span style={textStyle}>{choice.text}</span>
      {variant !== "minimal" && <span style={arrowStyle}>&gt;</span>}
    </button>
  );
});

/**
 * Dialog choices list component
 *
 * @example
 * ```tsx
 * <DialogChoices
 *   choices={[
 *     { id: "buy", text: "I'd like to buy something", nextNodeId: "shop" },
 *     { id: "sell", text: "I'd like to sell some items", nextNodeId: "sell" },
 *     { id: "quest", text: "Do you have any quests?", nextNodeId: "quest_check", conditions: [...] },
 *     { id: "goodbye", text: "Goodbye", nextNodeId: "end" },
 *   ]}
 *   highlightedIndex={highlightedIndex}
 *   onSelect={(id) => dialog.selectChoice(id)}
 *   onHighlight={setHighlightedIndex}
 *   showHotkeys
 *   enableKeyboard
 *   enableNumberKeys
 * />
 * ```
 */
export const DialogChoices = memo(function DialogChoices({
  choices,
  highlightedIndex = 0,
  onSelect,
  onHighlight,
  disabled = false,
  showHotkeys = true,
  enableKeyboard = true,
  enableNumberKeys = true,
  layout = "vertical",
  columns = 2,
  variant = "default",
  className,
  style,
}: DialogChoicesProps): React.ReactElement | null {
  const theme = useTheme();

  // Handle choice selection - must be before any conditional returns
  const handleSelect = useCallback(
    (choiceId: string) => {
      if (!disabled) {
        onSelect?.(choiceId);
      }
    },
    [disabled, onSelect],
  );

  // Handle choice highlight - must be before any conditional returns
  const handleHighlight = useCallback(
    (index: number) => {
      onHighlight?.(index);
    },
    [onHighlight],
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!enableKeyboard && !enableNumberKeys) return;
    if (disabled || choices.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow key navigation
      if (enableKeyboard) {
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          const newIndex = Math.max(0, highlightedIndex - 1);
          onHighlight?.(newIndex);
        } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          const newIndex = Math.min(choices.length - 1, highlightedIndex + 1);
          onHighlight?.(newIndex);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const choice = choices[highlightedIndex];
          if (choice && !choice.disabled) {
            onSelect?.(choice.id);
          }
        }
      }

      // Number key selection
      if (enableNumberKeys && e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (index < choices.length) {
          const choice = choices[index];
          if (choice && !choice.disabled) {
            onSelect?.(choice.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enableKeyboard,
    enableNumberKeys,
    disabled,
    choices,
    highlightedIndex,
    onSelect,
    onHighlight,
  ]);

  if (choices.length === 0) return null;

  // Container style based on layout
  const getContainerStyle = (): CSSProperties => {
    const base: CSSProperties = {
      display: "flex",
      gap: theme.spacing.xs,
      ...style,
    };

    switch (layout) {
      case "horizontal":
        return {
          ...base,
          flexDirection: "row",
          flexWrap: "wrap",
        };
      case "grid":
        return {
          ...base,
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        };
      case "vertical":
      default:
        return {
          ...base,
          flexDirection: "column",
        };
    }
  };

  return (
    <div
      className={className}
      style={getContainerStyle()}
      role="listbox"
      aria-label="Dialog choices"
    >
      {choices.map((choice, index) => (
        <ChoiceButton
          key={choice.id}
          choice={choice}
          index={index}
          isHighlighted={index === highlightedIndex}
          onSelect={() => handleSelect(choice.id)}
          onHighlight={() => handleHighlight(index)}
          showHotkey={showHotkeys}
          variant={variant}
        />
      ))}
    </div>
  );
});

// ============================================================================
// Quick Reply Component
// ============================================================================

/** Props for QuickReply component */
export interface QuickReplyProps {
  /** Reply options (simplified choices) */
  options: Array<{
    id: string;
    text: string;
    icon?: string;
  }>;
  /** Selection handler */
  onSelect: (id: string) => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Quick reply bubbles for simple responses
 *
 * @example
 * ```tsx
 * <QuickReply
 *   options={[
 *     { id: "yes", text: "Yes" },
 *     { id: "no", text: "No" },
 *     { id: "maybe", text: "Maybe later" },
 *   ]}
 *   onSelect={(id) => console.log(`Selected: ${id}`)}
 * />
 * ```
 */
export const QuickReply = memo(function QuickReply({
  options,
  onSelect,
  className,
  style,
}: QuickReplyProps): React.ReactElement {
  const theme = useTheme();

  const containerStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    justifyContent: "center",
    ...style,
  };

  const bubbleStyle: CSSProperties = {
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.accent.primary}`,
    backgroundColor: "transparent",
    color: theme.colors.accent.primary,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    cursor: "pointer",
    transition: theme.transitions.fast,
  };

  const bubbleHoverStyle: CSSProperties = {
    backgroundColor: theme.colors.accent.primary + "20",
  };

  return (
    <div className={className} style={containerStyle}>
      {options.map((option) => (
        <button
          key={option.id}
          style={bubbleStyle}
          onClick={() => onSelect(option.id)}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, bubbleHoverStyle);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {option.icon && <span style={{ marginRight: 4 }}>{option.icon}</span>}
          {option.text}
        </button>
      ))}
    </div>
  );
});

export default DialogChoices;
