import React, { ErrorInfo, ReactNode } from 'react';
import { errorReporting } from './error-reporting';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * React Error Boundary that catches component errors and reports them to the backend
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
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
      // Render fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#ffe0e0',
          color: '#d63447'
        }}>
          <h2>🚨 Something went wrong</h2>
          <p>A component error occurred and has been reported to the development team.</p>
          <details style={{ marginTop: '10px' }}>
            <summary>Error Details</summary>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              fontSize: '12px', 
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f8f8f8',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#d63447',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}