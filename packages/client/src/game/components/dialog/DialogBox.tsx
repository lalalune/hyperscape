/**
 * DialogBox Component
 *
 * Main container for dialog/conversation UI.
 * RS3-style dialog panel with glassmorphism and gold accents.
 *
 * @packageDocumentation
 */

import React, {
  memo,
  useCallback,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTheme } from "@/ui";
import {
  getThemedGlassmorphismStyle,
  getDecorativeBorderStyle,
} from "@/ui/theme/themes";
import type { DialogMood, DialogChoice } from "@/game/systems";

// ============================================================================
// Types
// ============================================================================

/** Props for DialogBox component */
export interface DialogBoxProps {
  /** Whether dialog is visible */
  isOpen: boolean;
  /** Speaker name */
  speaker: string;
  /** Current displayed text (may be partial during typewriter effect) */
  text: string;
  /** Current NPC mood */
  mood?: DialogMood;
  /** Portrait component or URL */
  portrait?: ReactNode | string;
  /** Available choices (if in choice mode) */
  choices?: DialogChoice[];
  /** Currently highlighted choice index */
  highlightedChoiceIndex?: number;
  /** Whether typewriter is still typing */
  isTyping?: boolean;
  /** Show continue prompt */
  showContinuePrompt?: boolean;
  /** Continue prompt text */
  continuePromptText?: string;
  /** Click handler for continue */
  onContinue?: () => void;
  /** Click handler for skip typing */
  onSkip?: () => void;
  /** Choice selection handler */
  onChoiceSelect?: (choiceId: string) => void;
  /** Choice hover handler */
  onChoiceHover?: (index: number) => void;
  /** Close handler */
  onClose?: () => void;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Position of the dialog box */
  position?: "bottom" | "center" | "top";
  /** Width of the dialog box */
  width?: number | string;
  /** Maximum height */
  maxHeight?: number | string;
  /** Additional content below main text */
  children?: ReactNode;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Main dialog box container component
 *
 * @example
 * ```tsx
 * <DialogBox
 *   isOpen={dialog.state.isOpen}
 *   speaker={dialog.state.speaker}
 *   text={dialog.state.displayedText}
 *   mood={dialog.state.mood}
 *   portrait={<DialogPortrait npcId={npcId} mood={mood} />}
 *   choices={dialog.state.availableChoices}
 *   highlightedChoiceIndex={dialog.state.highlightedChoiceIndex}
 *   isTyping={!dialog.state.isTypingComplete}
 *   showContinuePrompt={dialog.canContinue}
 *   onContinue={dialog.continue}
 *   onSkip={dialog.skipTyping}
 *   onChoiceSelect={dialog.selectChoice}
 *   onChoiceHover={dialog.highlightChoice}
 * />
 * ```
 */
export const DialogBox = memo(function DialogBox({
  isOpen,
  speaker,
  text,
  mood = "neutral",
  portrait,
  choices = [],
  highlightedChoiceIndex = 0,
  isTyping = false,
  showContinuePrompt = false,
  continuePromptText = "Click to continue...",
  onContinue,
  onSkip,
  onChoiceSelect,
  onChoiceHover,
  onClose,
  showCloseButton = false,
  position = "bottom",
  width = 600,
  maxHeight = 400,
  children,
  className,
  style,
}: DialogBoxProps): React.ReactElement | null {
  const theme = useTheme();

  // Handle click on dialog area
  const handleClick = useCallback(() => {
    if (isTyping) {
      onSkip?.();
    } else if (choices.length === 0) {
      onContinue?.();
    }
  }, [isTyping, choices.length, onSkip, onContinue]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Space or Enter to continue/skip
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (isTyping) {
          onSkip?.();
        } else if (choices.length === 0) {
          onContinue?.();
        } else {
          // Select highlighted choice
          const choice = choices[highlightedChoiceIndex];
          if (choice && !choice.disabled) {
            onChoiceSelect?.(choice.id);
          }
        }
      }

      // Arrow keys for choice navigation
      if (choices.length > 0) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const newIndex = Math.max(0, highlightedChoiceIndex - 1);
          onChoiceHover?.(newIndex);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const newIndex = Math.min(
            choices.length - 1,
            highlightedChoiceIndex + 1,
          );
          onChoiceHover?.(newIndex);
        }
      }

      // Number keys 1-9 for quick choice selection
      if (e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (index < choices.length) {
          const choice = choices[index];
          if (choice && !choice.disabled) {
            onChoiceSelect?.(choice.id);
          }
        }
      }

      // Escape to close
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isTyping,
    choices,
    highlightedChoiceIndex,
    onSkip,
    onContinue,
    onChoiceSelect,
    onChoiceHover,
    onClose,
  ]);

  if (!isOpen) return null;

  // Position styles
  const getPositionStyle = (): CSSProperties => {
    switch (position) {
      case "top":
        return {
          top: theme.spacing.lg,
          left: "50%",
          transform: "translateX(-50%)",
        };
      case "center":
        return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
      case "bottom":
      default:
        return {
          bottom: theme.spacing.lg,
          left: "50%",
          transform: "translateX(-50%)",
        };
    }
  };

  // Container style
  const containerStyle: CSSProperties = {
    position: "fixed",
    width: typeof width === "number" ? width : width,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: typeof maxHeight === "number" ? maxHeight : maxHeight,
    zIndex: theme.zIndex.modal,
    display: "flex",
    flexDirection: "column",
    ...getThemedGlassmorphismStyle(theme, 0),
    ...getDecorativeBorderStyle(theme),
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    ...getPositionStyle(),
    ...style,
  };

  // Header style (speaker name)
  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderBottom: `1px solid ${theme.colors.border.default}`,
    backgroundColor:
      theme.name === "hyperia"
        ? "rgba(139, 90, 43, 0.2)"
        : "rgba(255, 255, 255, 0.05)",
  };

  // Speaker name style
  const speakerStyle: CSSProperties = {
    fontFamily: theme.typography.fontFamily.heading,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accent.primary,
    margin: 0,
  };

  // Close button style
  const closeButtonStyle: CSSProperties = {
    background: "none",
    border: "none",
    padding: theme.spacing.xs,
    cursor: "pointer",
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.lg,
    lineHeight: 1,
    transition: theme.transitions.fast,
  };

  // Content area style
  const contentStyle: CSSProperties = {
    display: "flex",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    flex: 1,
    overflow: "auto",
  };

  // Portrait container style
  const portraitContainerStyle: CSSProperties = {
    flexShrink: 0,
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    border: `2px solid ${theme.colors.border.decorative}`,
    overflow: "hidden",
    backgroundColor: theme.colors.background.tertiary,
  };

  // Text container style
  const textContainerStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minHeight: 80,
  };

  // Text style
  const textStyle: CSSProperties = {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.relaxed,
    color: theme.colors.text.primary,
    margin: 0,
    whiteSpace: "pre-wrap",
  };

  // Typing indicator style
  const typingIndicatorStyle: CSSProperties = {
    display: "inline-block",
    width: 8,
    height: 16,
    backgroundColor: theme.colors.text.primary,
    marginLeft: 2,
    animation: "blink 1s step-end infinite",
  };

  // Continue prompt style
  const continuePromptStyle: CSSProperties = {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.muted,
    fontStyle: "italic",
    animation: "pulse 2s ease-in-out infinite",
  };

  // Mood indicator style
  const moodIndicatorStyle: CSSProperties = {
    display: "inline-block",
    fontSize: theme.typography.fontSize.sm,
    marginLeft: theme.spacing.sm,
    color: theme.colors.text.secondary,
  };

  // Get mood emoji
  const getMoodEmoji = (m: DialogMood): string => {
    const moods: Record<DialogMood, string> = {
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
    return moods[m] || "";
  };

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={handleClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Dialog with ${speaker}`}
    >
      {/* Add keyframe animations */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header with speaker name */}
      <div style={headerStyle}>
        <h3 style={speakerStyle}>
          {speaker}
          {mood !== "neutral" && (
            <span style={moodIndicatorStyle}>{getMoodEmoji(mood)}</span>
          )}
        </h3>
        {showCloseButton && onClose && (
          <button
            style={closeButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close dialog"
          >
            x
          </button>
        )}
      </div>

      {/* Main content area */}
      <div style={contentStyle}>
        {/* Portrait */}
        {portrait && (
          <div style={portraitContainerStyle}>
            {typeof portrait === "string" ? (
              <img
                src={portrait}
                alt={`${speaker} portrait`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              portrait
            )}
          </div>
        )}

        {/* Text content */}
        <div style={textContainerStyle}>
          <p style={textStyle}>
            {text}
            {isTyping && <span style={typingIndicatorStyle} />}
          </p>

          {/* Continue prompt */}
          {showContinuePrompt && !isTyping && choices.length === 0 && (
            <p style={continuePromptStyle}>{continuePromptText}</p>
          )}
        </div>
      </div>

      {/* Choices */}
      {choices.length > 0 && (
        <DialogChoicesInternal
          choices={choices}
          highlightedIndex={highlightedChoiceIndex}
          onSelect={onChoiceSelect}
          onHover={onChoiceHover}
        />
      )}

      {/* Additional content */}
      {children}
    </div>
  );
});

// Internal choices component
interface DialogChoicesInternalProps {
  choices: DialogChoice[];
  highlightedIndex: number;
  onSelect?: (choiceId: string) => void;
  onHover?: (index: number) => void;
}

const DialogChoicesInternal = memo(function DialogChoicesInternal({
  choices,
  highlightedIndex,
  onSelect,
  onHover,
}: DialogChoicesInternalProps): React.ReactElement {
  const theme = useTheme();

  const containerStyle: CSSProperties = {
    borderTop: `1px solid ${theme.colors.border.default}`,
    padding: theme.spacing.sm,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.xs,
  };

  return (
    <div style={containerStyle}>
      {choices.map((choice, index) => {
        const isHighlighted = index === highlightedIndex;
        const isDisabled = choice.disabled;

        const choiceStyle: CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: theme.spacing.sm,
          padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
          borderRadius: theme.borderRadius.md,
          border: `1px solid ${
            isHighlighted
              ? theme.colors.accent.primary
              : theme.colors.border.default
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
          fontSize: theme.typography.fontSize.base,
          color: isHighlighted
            ? theme.colors.text.primary
            : theme.colors.text.secondary,
          textAlign: "left",
        };

        const hotkeyStyle: CSSProperties = {
          flexShrink: 0,
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.accent.primary,
          backgroundColor: theme.colors.background.tertiary,
          borderRadius: theme.borderRadius.sm,
        };

        return (
          <button
            key={choice.id}
            style={choiceStyle}
            onClick={(e) => {
              e.stopPropagation();
              if (!isDisabled) {
                onSelect?.(choice.id);
              }
            }}
            onMouseEnter={() => onHover?.(index)}
            disabled={isDisabled}
            title={isDisabled ? choice.disabledReason : undefined}
          >
            <span style={hotkeyStyle}>{choice.hotkey ?? index + 1}</span>
            <span>{choice.text}</span>
          </button>
        );
      })}
    </div>
  );
});

export default DialogBox;
