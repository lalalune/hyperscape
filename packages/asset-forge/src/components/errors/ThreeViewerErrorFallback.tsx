import { AlertTriangle, RefreshCw } from 'lucide-react'
import React from 'react'

import { Button } from '../common'

interface ThreeViewerErrorFallbackProps {
  error?: Error
  onReset?: () => void
}

export const ThreeViewerErrorFallback: React.FC<ThreeViewerErrorFallbackProps> = ({ error, onReset }) => {
  return (
    <div className="flex items-center justify-center w-full h-full bg-bg-primary p-6">
      <div className="max-w-md w-full bg-bg-secondary rounded-lg shadow-lg p-6 border border-border-primary">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-primary mb-1">3D Viewer Error</h3>
            <p className="text-sm text-text-secondary mb-3">
              Failed to render the 3D model. This could be due to:
            </p>
            <ul className="list-disc list-inside text-xs text-text-secondary space-y-1 mb-4">
              <li>Corrupted model file</li>
              <li>WebGL initialization failure</li>
              <li>Insufficient GPU memory</li>
              <li>Unsupported file format</li>
            </ul>
          </div>
        </div>

        {error && process.env.NODE_ENV === 'development' && (
          <details className="mb-4 bg-bg-tertiary rounded p-3 border border-border-secondary">
            <summary className="cursor-pointer text-sm text-text-primary font-medium mb-1">
              Error Details
            </summary>
            <pre className="text-xs text-text-secondary overflow-auto max-h-32 font-mono">
              {error.message}
            </pre>
          </details>
        )}

        <div className="flex gap-2">
          {onReset && (
            <Button
              onClick={onReset}
              variant="primary"
              size="sm"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          )}
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  )
}
