import React, { Component, ReactNode } from 'react'

import { createLogger } from '../../utils/logger'

const logger = createLogger('ErrorBoundary')

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  resetKeys?: Array<string | number | boolean | undefined>
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Use centralized logger instead of console.error
    logger.error('React error boundary caught error', error)
    logger.error('Component stack', { componentStack: errorInfo.componentStack })

    // Store error info in state for display
    this.setState({ errorInfo })

    // Call optional error callback
    this.props.onError?.(error, errorInfo)

    // GitHub Issue #2: Integrate error monitoring service (Sentry/LogRocket)
    // Example:
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       react: {
    //         componentStack: errorInfo.componentStack
    //       }
    //     }
    //   })
    // }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error boundary when resetKeys change
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      prevProps.resetKeys?.toString() !== this.props.resetKeys.toString()
    ) {
      this.resetError()
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI with reset button
      return (
        <div className="flex items-center justify-center min-h-screen bg-bg-primary p-6">
          <div className="max-w-md w-full bg-bg-secondary rounded-lg shadow-lg p-6 border border-border-primary">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
                <p className="text-sm text-text-tertiary">An error occurred in the application</p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 p-3 bg-bg-tertiary rounded border border-border-secondary">
                <p className="text-xs font-mono text-text-secondary break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.resetError}
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-text-primary rounded hover:bg-bg-hover transition-colors border border-border-primary"
              >
                Go Home
              </button>
            </div>

            <p className="mt-4 text-xs text-text-tertiary text-center">
              If this problem persists, please contact support
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary 