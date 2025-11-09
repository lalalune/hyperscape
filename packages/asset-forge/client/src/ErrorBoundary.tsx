import React, { ErrorInfo } from 'react';
import { errorReporting } from './error-reporting';

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * React Error Boundary that catches component errors and reports them to the backend
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report the error to our error reporting service
    errorReporting.reportReactError(error, { 
      componentStack: errorInfo.componentStack || '' 
    });
    
    // Also log to console for development
    console.error('[ErrorBoundary] Caught React error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-5 m-5 border-2 border-red-400 rounded-lg bg-red-100 text-red-700">
          <h2 className="text-xl font-bold mb-2">🚨 Something went wrong</h2>
          <p className="mb-2">A component error occurred and has been reported to the development team.</p>
          <details className="mt-2">
            <summary className="cursor-pointer">Error Details</summary>
            <pre className="whitespace-pre-wrap text-xs mt-2 p-2 bg-gray-100 border border-gray-300 rounded">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-2 px-4 py-2 bg-red-700 text-white border-none rounded cursor-pointer hover:bg-red-800"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}