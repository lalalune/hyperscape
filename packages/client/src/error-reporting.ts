/**
 * Frontend Error Reporting Service
 * 
 * This service captures and reports frontend errors to the backend for logging.
 * It handles JavaScript errors and unhandled promise rejections.
 */

import type { ErrorReport } from '@hyperscape/shared'

/**
 * Service for reporting frontend errors to the backend
 */
class ErrorReportingService {
  private endpoint = '/errors/frontend';
  private sessionId: string;
  private userId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = '';
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Sets up global error handlers for uncaught errors
   */
  private setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      const errorData: ErrorReport = {
        message: event.error?.message || event.message || 'Unknown error',
        stack: event.error?.stack || 'No stack trace available',
        url: event.filename,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        context: {
          line: event.lineno,
          column: event.colno,
          type: 'uncaught-error'
        },
        componentStack: '',
        userId: this.userId,
        sessionId: this.sessionId
      };
      
      this.reportError(errorData);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const errorData: ErrorReport = {
        message: event.reason?.toString() || String(event.reason) || 'Unhandled promise rejection',
        stack: event.reason?.stack || 'No stack trace available',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        context: {
          type: 'unhandled-rejection',
          promise: event.promise
        },
        componentStack: '',
        userId: this.userId,
        sessionId: this.sessionId
      };
      
      this.reportError(errorData);
    });
  }

  /**
   * Reports an error to the backend
   */
  public async reportError(errorData: ErrorReport) {
    // Ensure no double slashes in the URL
    const baseUrl = (import.meta.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const endpoint = this.endpoint.startsWith('/') ? this.endpoint : '/' + this.endpoint;
    const response = await fetch(baseUrl + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...errorData,
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to report error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Reports a React error with component stack
   */
  public reportReactError(error: Error, errorInfo: { componentStack: string }) {
    const errorData: ErrorReport = {
      message: error.message,
      stack: error.stack!,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      context: {
        type: 'react-error'
      },
      componentStack: errorInfo.componentStack,
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.reportError(errorData);
  }

  /**
   * Reports a custom error with additional context
   */
  public reportCustomError(message: string, context: unknown) {
    const error = new Error(message);
    const errorData: ErrorReport = {
      message: message,
      stack: error.stack!,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      context: context,
      componentStack: '',
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.reportError(errorData);
  }
}

// Export singleton instance
export const errorReportingService = new ErrorReportingService();
// Also export with the expected name for backward compatibility
export const errorReporting = errorReportingService;