/**
 * Panel-level Error Boundary
 *
 * Provides isolated error handling for individual panels.
 * When a panel crashes, only that panel shows an error fallback,
 * while the rest of the UI continues to function.
 *
 * @packageDocumentation
 */

import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { ErrorCode, getErrorMeta, ErrorSeverity } from "./errorCodes";
import { errorReporting } from "./error-reporting";

/**
 * Props for PanelErrorBoundary
 */
interface PanelErrorBoundaryProps {
  /** Panel name for error reporting */
  panelName: string;
  /** Children to render */
  children: ReactNode;
  /** Optional custom fallback component */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to attempt automatic recovery */
  autoRecover?: boolean;
  /** Recovery delay in milliseconds */
  recoveryDelay?: number;
}

/**
 * State for PanelErrorBoundary
 */
interface PanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
}

/**
 * Default fallback component for panel errors
 */
function PanelErrorFallback({
  panelName,
  error,
  onRetry,
  isRecovering,
}: {
  panelName: string;
  error: Error | null;
  onRetry: () => void;
  isRecovering: boolean;
}): React.ReactElement {
  const meta = getErrorMeta(ErrorCode.UI_PANEL_ERROR);

  return (
    <div
      style={{
        padding: "16px",
        background: "rgba(239, 68, 68, 0.1)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        borderRadius: "8px",
        textAlign: "center",
        color: "#ef4444",
      }}
    >
      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {panelName} Error
      </div>
      <div
        style={{
          marginBottom: "12px",
          fontSize: "12px",
          color: "rgba(255, 255, 255, 0.7)",
        }}
      >
        {meta.userMessage}
      </div>
      {error && import.meta.env.DEV && (
        <div
          style={{
            marginBottom: "12px",
            fontSize: "10px",
            color: "rgba(255, 255, 255, 0.5)",
            fontFamily: "monospace",
            textAlign: "left",
            padding: "8px",
            background: "rgba(0, 0, 0, 0.2)",
            borderRadius: "4px",
            overflow: "auto",
            maxHeight: "100px",
          }}
        >
          {error.message}
        </div>
      )}
      <button
        onClick={onRetry}
        disabled={isRecovering}
        style={{
          padding: "6px 16px",
          background: isRecovering ? "#666" : "#ef4444",
          border: "none",
          borderRadius: "4px",
          color: "white",
          cursor: isRecovering ? "not-allowed" : "pointer",
          fontSize: "12px",
        }}
      >
        {isRecovering ? "Recovering..." : "Retry"}
      </button>
    </div>
  );
}

/**
 * Panel-level error boundary component
 *
 * Wraps individual panels to isolate errors. When a panel crashes,
 * it shows an error fallback while allowing other panels to continue.
 *
 * @example
 * ```tsx
 * <PanelErrorBoundary panelName="Inventory">
 *   <InventoryPanel />
 * </PanelErrorBoundary>
 * ```
 */
export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  private recoveryTimeout: ReturnType<typeof setTimeout> | null = null;

  static defaultProps = {
    autoRecover: false,
    recoveryDelay: 5000,
  };

  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<PanelErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Report error to backend
    errorReporting.reportReactError(error, {
      componentStack: errorInfo.componentStack || "",
    });

    // Log panel-specific context
    if (import.meta.env.DEV) {
      console.debug("[PanelErrorBoundary] Error context:", {
        panelName: this.props.panelName,
        errorCode: ErrorCode.UI_PANEL_ERROR,
        severity: ErrorSeverity.WARNING,
      });
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Log in development
    if (import.meta.env.DEV) {
      console.error(
        `[PanelErrorBoundary] ${this.props.panelName} crashed:`,
        error,
        errorInfo,
      );
    }

    // Attempt auto-recovery if enabled
    if (this.props.autoRecover) {
      this.scheduleRecovery();
    }
  }

  componentWillUnmount(): void {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }
  }

  private scheduleRecovery(): void {
    this.setState({ isRecovering: true });

    this.recoveryTimeout = setTimeout(() => {
      this.handleRetry();
    }, this.props.recoveryDelay);
  }

  private handleRetry = (): void => {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <PanelErrorFallback
          panelName={this.props.panelName}
          error={this.state.error}
          onRetry={this.handleRetry}
          isRecovering={this.state.isRecovering}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for wrapping components with error boundary
 *
 * @example
 * ```tsx
 * const WrappedInventory = withPanelErrorBoundary(InventoryPanel, "Inventory");
 * ```
 */
export function withPanelErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  panelName: string,
  options: Omit<PanelErrorBoundaryProps, "panelName" | "children"> = {},
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const WithErrorBoundary: React.FC<P> = (props) => (
    <PanelErrorBoundary panelName={panelName} {...options}>
      <WrappedComponent {...props} />
    </PanelErrorBoundary>
  );

  WithErrorBoundary.displayName = `withPanelErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}

export default PanelErrorBoundary;
