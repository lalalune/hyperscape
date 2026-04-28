/**
 * Frontend Error Reporting Service
 *
 * This service captures and reports frontend errors to the backend for logging.
 * It handles JavaScript errors and unhandled promise rejections.
 */

import { GAME_API_URL } from "./api-config";

interface ErrorReport {
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  timestamp: string;
  context: unknown;
  componentStack: string;
  userId: string;
  sessionId: string;
}

/**
 * ErrorReportingService - Frontend error tracking and reporting
 *
 * Captures and reports frontend errors to the backend for centralized logging.
 * Automatically hooks into global error handlers to catch uncaught exceptions
 * and unhandled promise rejections.
 *
 * @remarks
 * Errors are sent to the backend via POST /api/errors/frontend for logging.
 * The service generates a unique session ID on instantiation to track errors
 * across a single browser session.
 *
 * @public
 */
class ErrorReportingService {
  /** Backend endpoint for error reporting */
  private endpoint = "/errors/frontend";

  /** Unique session ID for tracking errors in this browser session */
  private sessionId: string;

  /** User ID (set after authentication) */
  private userId: string;

  /** Stored handler references for cleanup */
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null =
    null;

  /**
   * Constructs the error reporting service
   *
   * Automatically sets up global error handlers for window.error and
   * window.unhandledrejection events.
   */
  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = "";
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sets the user ID for error attribution
   *
   * Call this after user authentication to associate errors with specific users.
   *
   * @param userId - The authenticated user's ID
   *
   * @public
   */
  public setUserId(userId: string) {
    this.userId = userId;
  }

  /** CSP violation handler reference for cleanup */
  private cspHandler: ((event: SecurityPolicyViolationEvent) => void) | null =
    null;

  /**
   * Sets up global error handlers for uncaught errors
   *
   * Registers listeners for window.error, window.unhandledrejection,
   * and securitypolicyviolation (CSP violations) to automatically report
   * any uncaught exceptions, promise rejections, or CSP policy violations.
   *
   * @private
   */
  private setupGlobalErrorHandlers() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // Store handler reference for cleanup
    this.errorHandler = (event: ErrorEvent) => {
      const errorData: ErrorReport = {
        message: event.error?.message || event.message || "Unknown error",
        stack: event.error?.stack || "No stack trace available",
        url: event.filename,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        context: {
          line: event.lineno,
          column: event.colno,
          type: "uncaught-error",
        },
        componentStack: "",
        userId: this.userId,
        sessionId: this.sessionId,
      };

      this.reportError(errorData);
    };

    // Store handler reference for cleanup
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      const errorData: ErrorReport = {
        message:
          event.reason?.toString() ||
          String(event.reason) ||
          "Unhandled promise rejection",
        stack: event.reason?.stack || "No stack trace available",
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        context: {
          type: "unhandled-rejection",
          promise: event.promise,
        },
        componentStack: "",
        userId: this.userId,
        sessionId: this.sessionId,
      };

      this.reportError(errorData);
    };

    // CSP violation handler for security monitoring
    this.cspHandler = (event: SecurityPolicyViolationEvent) => {
      this.reportCSPViolation(event);
    };

    window.addEventListener("error", this.errorHandler);
    window.addEventListener("unhandledrejection", this.rejectionHandler);
    document.addEventListener("securitypolicyviolation", this.cspHandler);
  }

  /**
   * Disposes of the error reporting service
   *
   * Removes global error handlers to prevent memory leaks.
   * Call this when the service is no longer needed.
   *
   * @public
   */
  public dispose(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    if (this.errorHandler) {
      window.removeEventListener("error", this.errorHandler);
      this.errorHandler = null;
    }
    if (this.rejectionHandler) {
      window.removeEventListener("unhandledrejection", this.rejectionHandler);
      this.rejectionHandler = null;
    }
    if (this.cspHandler) {
      document.removeEventListener("securitypolicyviolation", this.cspHandler);
      this.cspHandler = null;
    }
  }

  /**
   * Reports a Content Security Policy (CSP) violation
   *
   * CSP violations indicate potential XSS attacks or misconfigured policies.
   * These are reported separately for security monitoring.
   *
   * @param event - The CSP violation event from the browser
   *
   * @remarks
   * Common violations to watch for:
   * - script-src violations may indicate XSS attempts
   * - connect-src violations may indicate CSRF or data exfiltration
   * - style-src violations are usually benign (inline styles)
   *
   * @public
   */
  public reportCSPViolation(event: SecurityPolicyViolationEvent): void {
    // Throttle CSP reports to prevent flooding
    // Some violations (like inline styles) can fire repeatedly
    const violationKey = `${event.violatedDirective}:${event.blockedURI}`;
    const now = Date.now();

    // Track recent violations to prevent flooding
    if (!this.recentCSPViolations) {
      this.recentCSPViolations = new Map();
    }

    const lastReported = this.recentCSPViolations.get(violationKey);
    if (lastReported && now - lastReported < 60000) {
      // Skip if reported within last minute
      return;
    }
    this.recentCSPViolations.set(violationKey, now);

    // Clean up old entries
    if (this.recentCSPViolations.size > 100) {
      const cutoff = now - 300000; // 5 minutes
      for (const [key, time] of this.recentCSPViolations) {
        if (time < cutoff) {
          this.recentCSPViolations.delete(key);
        }
      }
    }

    const errorData: ErrorReport = {
      message: `CSP Violation: ${event.violatedDirective}`,
      stack: `Blocked URI: ${event.blockedURI}\nSource: ${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
      url: event.documentURI,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      context: {
        type: "csp-violation",
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        originalPolicy: event.originalPolicy,
        disposition: event.disposition,
        sample: event.sample, // First 40 chars of blocked content
      },
      componentStack: "",
      userId: this.userId,
      sessionId: this.sessionId,
    };

    // Log CSP violations prominently for debugging
    console.warn(
      `[CSP Violation] ${event.violatedDirective}: ${event.blockedURI}`,
      {
        source: `${event.sourceFile}:${event.lineNumber}`,
        directive: event.effectiveDirective,
      },
    );

    this.reportError(errorData);
  }

  /** Track recent CSP violations to prevent report flooding */
  private recentCSPViolations: Map<string, number> | null = null;

  /**
   * Reports an error to the backend for logging
   *
   * Sends error data to the backend via POST request. Includes user ID,
   * session ID, and timestamp for tracking and debugging.
   *
   * @param errorData - Complete error information to report
   * @returns Promise resolving to the backend response
   * @throws {Error} If the backend request fails
   *
   * @example
   * ```typescript
   * await errorReporting.reportError({
   *   message: 'Failed to load asset',
   *   stack: error.stack,
   *   url: window.location.href,
   *   userAgent: navigator.userAgent,
   *   timestamp: new Date().toISOString(),
   *   context: { assetId: '123' },
   *   componentStack: '',
   *   userId: user.id,
   *   sessionId: session.id
   * });
   * ```
   *
   * @public
   */
  public async reportError(errorData: ErrorReport) {
    // Construct URL from centralized config
    const baseUrl = GAME_API_URL;
    const endpoint = `${baseUrl}/api${this.endpoint}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...errorData,
          userId: this.userId,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        // Log to console but don't throw - prevents cascading errors
        console.warn(
          `[ErrorReporting] Failed to report error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return response.json();
    } catch (error) {
      // Silently fail if error reporting itself fails
      // This prevents cascading errors during startup or when backend is unavailable
      console.warn(
        "[ErrorReporting] Could not send error to backend (server may be starting):",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Reports a React error with component stack trace
   *
   * Specialized error reporting for React component errors caught by
   * Error Boundaries. Includes component stack for easier debugging.
   *
   * @param error - The error object thrown by React
   * @param errorInfo - React error info with component stack
   *
   * @example
   * ```typescript
   * class ErrorBoundary extends React.Component {
   *   componentDidCatch(error, errorInfo) {
   *     errorReporting.reportReactError(error, errorInfo);
   *   }
   * }
   * ```
   *
   * @public
   */
  public reportReactError(error: Error, errorInfo: { componentStack: string }) {
    const errorData: ErrorReport = {
      message: error.message,
      stack: error.stack!,
      url: typeof window !== "undefined" ? window.location.href : "about:blank",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      timestamp: new Date().toISOString(),
      context: {
        type: "react-error",
      },
      componentStack: errorInfo.componentStack,
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.reportError(errorData);
  }

  /**
   * Reports a custom error with additional context
   *
   * Allows manual error reporting with custom context data.
   * Useful for reporting non-Error conditions or adding custom metadata.
   *
   * @param message - Error message describing what went wrong
   * @param context - Additional context data (arbitrary object)
   *
   * @example
   * ```typescript
   * errorReporting.reportCustomError('Failed to connect to server', {
   *   attemptNumber: 3,
   *   serverUrl: wsUrl,
   *   lastError: previousError.message
   * });
   * ```
   *
   * @public
   */
  public reportCustomError(message: string, context: unknown) {
    const error = new Error(message);
    const errorData: ErrorReport = {
      message: message,
      stack: error.stack!,
      url: typeof window !== "undefined" ? window.location.href : "about:blank",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      timestamp: new Date().toISOString(),
      context: context,
      componentStack: "",
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.reportError(errorData);
  }
}

/**
 * Singleton instance of ErrorReportingService
 *
 * Use this instance throughout the application for error reporting.
 * Global error handlers are automatically set up on instantiation.
 *
 * @public
 */
export const errorReportingService = new ErrorReportingService();

/**
 * Alias for errorReportingService (backward compatibility)
 *
 * @public
 */
export const errorReporting = errorReportingService;
