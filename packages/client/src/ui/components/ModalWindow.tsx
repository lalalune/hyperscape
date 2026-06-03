/**
 * Modal Window Component
 *
 * A modal wrapper that displays a Window component with a backdrop overlay.
 * Used for Bank, Store, Dialogue, and other modal panels.
 *
 * Features:
 * - Semi-transparent backdrop overlay
 * - Centered positioning
 * - Click-outside-to-close behavior (optional)
 * - Escape key to close (optional)
 * - Smooth enter/exit animations
 *
 * @packageDocumentation
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  getPanelHeaderStyle,
  getPanelSurfaceStyle,
  getShellControlButtonStyle,
  type ShellControlButtonStyle,
} from "../theme/themes";
import { useTheme } from "../stores/themeStore";

let _modalOverflowCount = 0;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    return element.offsetParent !== null;
  });
}

/** Modal window props */
export interface ModalWindowProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Modal title (displayed in header) */
  title: string;
  /** Modal content */
  children: ReactNode;
  /** Close when clicking backdrop (default: true) */
  closeOnBackdropClick?: boolean;
  /** Close when pressing Escape (default: true) */
  closeOnEscape?: boolean;
  /** Modal width (default: auto) */
  width?: number | string;
  /** Modal max width (default: 90vw) */
  maxWidth?: number | string;
  /** Modal max height (default: 90vh) */
  maxHeight?: number | string;
  /** Custom z-index (defaults to theme modal layer) */
  zIndex?: number;
  /** Show close button in header (default: true) */
  showCloseButton?: boolean;
  /** Additional class name for the modal container */
  className?: string;
  /** Additional style for the modal container */
  style?: CSSProperties;
  /** Additional style for the modal content area */
  contentStyle?: CSSProperties;
}

/**
 * Modal Window component
 *
 * @example
 * ```tsx
 * function BankModal() {
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   return (
 *     <ModalWindow
 *       visible={isOpen}
 *       onClose={() => setIsOpen(false)}
 *       title="Bank"
 *       width={800}
 *     >
 *       <BankPanel />
 *     </ModalWindow>
 *   );
 * }
 * ```
 */
export const ModalWindow = memo(function ModalWindow({
  visible,
  onClose,
  title,
  children,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  width,
  maxWidth = "90vw",
  maxHeight = "90vh",
  zIndex,
  showCloseButton = true,
  className,
  style,
  contentStyle: contentStyleOverride,
}: ModalWindowProps): React.ReactElement | null {
  const theme = useTheme();
  const resolvedZIndex = zIndex ?? theme.zIndex.modal;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const contentId = useId();
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!visible) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = modalRef.current;
    if (!container) {
      return;
    }

    const focusableElements = getFocusableElements(container);
    const initialFocusTarget = focusableElements[0] ?? container;
    initialFocusTarget.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") {
        return;
      }

      const liveContainer = modalRef.current;
      if (!liveContainer) {
        return;
      }

      const liveFocusableElements = getFocusableElements(liveContainer);
      if (liveFocusableElements.length === 0) {
        e.preventDefault();
        liveContainer.focus();
        return;
      }

      const firstElement = liveFocusableElements[0];
      const lastElement =
        liveFocusableElements[liveFocusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (!activeElement || !liveContainer.contains(activeElement)) {
        e.preventDefault();
        firstElement.focus();
        return;
      }

      if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const previousActiveElement = previousActiveElementRef.current;
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, [visible, closeOnEscape, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose],
  );

  // Prevent body scroll when modal is open (ref-counted for stacked modals)
  useEffect(() => {
    if (visible) {
      _modalOverflowCount += 1;
      if (_modalOverflowCount === 1) {
        document.body.style.overflow = "hidden";
      }
      return () => {
        _modalOverflowCount -= 1;
        if (_modalOverflowCount <= 0) {
          _modalOverflowCount = 0;
          document.body.style.overflow = "";
        }
      };
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  // Backdrop styles
  const backdropStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(7, 9, 12, 0.74)",
    backgroundImage:
      theme.name === "hyperia"
        ? "radial-gradient(circle at top, rgba(190, 165, 123, 0.07), transparent 30%), radial-gradient(circle at center, rgba(255, 255, 255, 0.028), transparent 44%)"
        : "radial-gradient(circle at top, rgba(255, 255, 255, 0.04), transparent 42%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: resolvedZIndex,
    animation: reduceMotion ? undefined : "modalFadeIn 0.2s ease-out",
    overscrollBehavior: "contain",
    // CRITICAL: Enable pointer events to block clicks from reaching the game canvas
    // CoreUI parent has pointer-events: none, so we must explicitly enable them here
    pointerEvents: "auto",
  };

  // Modal container styles
  const modalStyle: CSSProperties = {
    position: "relative",
    width: width ?? "auto",
    maxWidth,
    maxHeight,
    display: "flex",
    flexDirection: "column",
    ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
    borderRadius: theme.borderRadius.xl,
    boxShadow: `${theme.shadows.xl}, inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -24px 36px rgba(0, 0, 0, 0.14)`,
    overflow: "hidden",
    animation: reduceMotion ? undefined : "modalSlideIn 0.22s ease-out",
    outline: "none",
    willChange: reduceMotion ? "auto" : "transform, opacity",
    ...style,
  };

  // Header styles
  const headerStyle: CSSProperties = {
    ...getPanelHeaderStyle(theme),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    userSelect: "none",
    position: "relative",
    zIndex: 5,
    pointerEvents: "auto",
    minHeight: 52,
  };

  // Title styles
  const titleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    letterSpacing: "0.01em",
    margin: 0,
  };

  // Close button styles
  const closeButtonStyle: ShellControlButtonStyle = {
    ...getShellControlButtonStyle(theme, "danger"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    fontSize: 18,
    position: "relative",
    zIndex: 10,
    pointerEvents: "auto",
  };

  // Content styles
  const contentStyle: CSSProperties = {
    flex: 1,
    overflow: "auto",
    padding: theme.spacing.md,
    overscrollBehavior: "contain",
    background:
      theme.name === "hyperia"
        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.028) 0%, rgba(255, 255, 255, 0.014) 18%, rgba(0, 0, 0, 0.08) 100%)"
        : "transparent",
    pointerEvents: "auto",
    ...contentStyleOverride,
  };

  return (
    <>
      {/* Global keyframes for animations */}
      <style>
        {`
          @keyframes modalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalSlideIn {
            from { 
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to { 
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}
      </style>

      {/* Backdrop */}
      <div
        style={backdropStyle}
        onClick={handleBackdropClick}
        onMouseDown={(e) => {
          (e.nativeEvent as PointerEvent & { isCoreUI?: boolean }).isCoreUI =
            true;
        }}
        onPointerDown={(e) => {
          (e.nativeEvent as PointerEvent & { isCoreUI?: boolean }).isCoreUI =
            true;
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        role="presentation"
      >
        {/* Modal */}
        <div
          ref={modalRef}
          style={modalStyle}
          className={className}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={contentId}
          tabIndex={-1}
          onMouseDown={(e) => {
            (e.nativeEvent as PointerEvent & { isCoreUI?: boolean }).isCoreUI =
              true;
          }}
          onPointerDown={(e) => {
            (e.nativeEvent as PointerEvent & { isCoreUI?: boolean }).isCoreUI =
              true;
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                theme.name === "hyperia"
                  ? "linear-gradient(180deg, rgba(255, 255, 255, 0.045) 0%, transparent 14%, transparent 82%, rgba(0, 0, 0, 0.055) 100%)"
                  : "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 16%, transparent 84%, rgba(0, 0, 0, 0.06) 100%)",
              zIndex: 0,
            }}
          />
          {/* Header */}
          <div style={headerStyle}>
            <h2 id={titleId} style={titleStyle}>
              {title}
            </h2>
            {showCloseButton && (
              <button
                style={closeButtonStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = String(
                    closeButtonStyle["--shell-button-hover-bg"],
                  );
                  e.currentTarget.style.color = String(
                    closeButtonStyle["--shell-button-hover-fg"],
                  );
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = String(
                    closeButtonStyle.background,
                  );
                  e.currentTarget.style.color = String(closeButtonStyle.color);
                }}
                aria-label="Close modal"
                type="button"
              >
                ✕
              </button>
            )}
          </div>

          {/* Content */}
          <div id={contentId} style={contentStyle}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
});

export default ModalWindow;
