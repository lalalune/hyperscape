import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { errorReportingService } from "../../lib/error-reporting";

/**
 * Props for WindowErrorBoundary component
 */
export interface WindowErrorBoundaryProps {
  /** The window ID for error reporting */
  windowId: string;
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback UI to show on error */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo, windowId: string) => void;
  /** Whether to show the default error UI (default: true) */
  showErrorUI?: boolean;
}

/**
 * State for WindowErrorBoundary component
 */
interface WindowErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for UI windows.
 *
 * Catches JavaScript errors in child components and displays a fallback UI
 * instead of crashing the entire application.
 *
 * @example
 * ```tsx
 * <WindowErrorBoundary
 *   windowId="inventory-window"
 *   onError={(error, info, id) => logError(error, id)}
 * >
 *   <InventoryPanel />
 * </WindowErrorBoundary>
 * ```
 */
export class WindowErrorBoundary extends Component<
  WindowErrorBoundaryProps,
  WindowErrorBoundaryState
> {
  constructor(props: WindowErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WindowErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, windowId } = this.props;

    // Report to error reporting service with window context
    const enhancedStack = `[Window: ${windowId}]\n${errorInfo.componentStack || ""}`;
    errorReportingService.reportReactError(error, {
      componentStack: enhancedStack,
    });

    // Log error in development for easier debugging
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      console.error(
        `[Hyperia UI] Error in window "${windowId}":`,
        error,
        errorInfo,
      );
    }

    // Call optional error handler
    onError?.(error, errorInfo, windowId);
  }

  /**
   * Reset the error boundary state
   */
  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, windowId, showErrorUI = true } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback !== undefined) {
        return fallback;
      }

      // Show default error UI if enabled
      if (showErrorUI) {
        return (
          <div
            style={{
              padding: 16,
              backgroundColor: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              borderRadius: 4,
              color: "#fca5a5",
              fontSize: 12,
              fontFamily: "monospace",
              minHeight: 80,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>Window Error</span>
            </div>
            <div style={{ color: "#f87171", fontSize: 11 }}>
              {error?.message || "An unexpected error occurred"}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>
              Window: {windowId}
            </div>
            <button
              onClick={this.resetError}
              style={{
                marginTop: 4,
                padding: "4px 8px",
                backgroundColor: "rgba(220, 38, 38, 0.2)",
                border: "1px solid rgba(220, 38, 38, 0.4)",
                borderRadius: 4,
                color: "#fca5a5",
                fontSize: 11,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Try Again
            </button>
          </div>
        );
      }

      // If no fallback and showErrorUI is false, render nothing
      return null;
    }

    return children;
  }
}
