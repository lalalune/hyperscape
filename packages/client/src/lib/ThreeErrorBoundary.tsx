import React, { ErrorInfo } from "react";
import { errorReporting } from "./error-reporting";

interface ThreeErrorBoundaryProps {
  children: React.ReactNode;
  /** Component name for error reporting */
  componentName?: string;
  /** Custom fallback UI */
  fallback?: React.ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ThreeErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorType?: "webgl" | "render" | "unknown";
}

/**
 * Error Boundary specialized for Three.js components
 *
 * Catches and handles Three.js specific errors including:
 * - WebGL context errors
 * - Shader compilation errors
 * - Renderer initialization failures
 * - GPU resource exhaustion
 *
 * Use this to wrap components that render Three.js content:
 * - CharacterPreview
 * - Minimap
 * - 3D viewport overlays
 *
 * @example
 * ```tsx
 * <ThreeErrorBoundary componentName="CharacterPreview">
 *   <CharacterPreview />
 * </ThreeErrorBoundary>
 * ```
 */
export class ThreeErrorBoundary extends React.Component<
  ThreeErrorBoundaryProps,
  ThreeErrorBoundaryState
> {
  constructor(props: ThreeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ThreeErrorBoundaryState {
    // Categorize the error type
    const errorMessage = error.message.toLowerCase();
    let errorType: "webgl" | "render" | "unknown" = "unknown";

    if (
      errorMessage.includes("webgl") ||
      errorMessage.includes("context") ||
      errorMessage.includes("gpu")
    ) {
      errorType = "webgl";
    } else if (
      errorMessage.includes("render") ||
      errorMessage.includes("shader") ||
      errorMessage.includes("three")
    ) {
      errorType = "render";
    }

    return { hasError: true, error, errorType };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { componentName, onError } = this.props;

    // Report to error reporting service with Three.js context
    // Include component name in the stack trace for debugging
    const enhancedStack = componentName
      ? `[${componentName}]\n${errorInfo.componentStack || ""}`
      : errorInfo.componentStack || "";

    errorReporting.reportReactError(error, {
      componentStack: enhancedStack,
    });

    // Log for development
    console.error(
      `[ThreeErrorBoundary] ${componentName || "Three.js component"} error:`,
      error,
    );

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorType: undefined });
  };

  private getErrorMessage(): string {
    const { errorType } = this.state;

    switch (errorType) {
      case "webgl":
        return "WebGL initialization failed. Your browser or device may not support 3D graphics, or GPU resources are exhausted.";
      case "render":
        return "3D rendering failed. There may be an issue with graphics resources.";
      default:
        return "The 3D component encountered an error.";
    }
  }

  private getSuggestion(): string {
    const { errorType } = this.state;

    switch (errorType) {
      case "webgl":
        return "Try refreshing the page, closing other browser tabs, or updating your graphics drivers.";
      case "render":
        return "Try refreshing the page. If the problem persists, please report this issue.";
      default:
        return "Try clicking 'Retry' or refresh the page.";
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: "16px",
            margin: "8px",
            border: "1px solid #ff6b6b",
            borderRadius: "8px",
            backgroundColor: "rgba(255, 107, 107, 0.1)",
            color: "#ff6b6b",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
            ⚠️ 3D Rendering Error
          </h3>
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", opacity: 0.9 }}>
            {this.getErrorMessage()}
          </p>
          <p style={{ margin: "0 0 12px 0", fontSize: "11px", opacity: 0.7 }}>
            {this.getSuggestion()}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details style={{ marginTop: "12px", fontSize: "10px" }}>
              <summary style={{ cursor: "pointer" }}>Error Details</summary>
              <pre
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  backgroundColor: "rgba(0,0,0,0.2)",
                  borderRadius: "4px",
                  overflow: "auto",
                  maxHeight: "200px",
                }}
              >
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ThreeErrorBoundary;
