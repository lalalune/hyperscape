import { AlertTriangle, Home, RefreshCw, Mic } from 'lucide-react'
import React from 'react'

import { Button } from '../common'

interface VoiceErrorFallbackProps {
  error?: Error
  onReset?: () => void
}

export const VoiceErrorFallback: React.FC<VoiceErrorFallbackProps> = ({ error, onReset }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-bg-primary to-bg-secondary p-6">
      <div className="max-w-2xl w-full bg-bg-secondary rounded-lg shadow-lg p-8 border border-border-primary">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-text-primary mb-2">Voice Generation Error</h2>
            <p className="text-text-secondary mb-4">
              An error occurred during voice generation or playback. Common issues include:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mb-6">
              <li>Voice synthesis service unavailable</li>
              <li>Invalid voice preset or parameters</li>
              <li>Audio file loading failure</li>
              <li>Browser audio permission issues</li>
            </ul>
          </div>
        </div>

        {error && (
          <details className="mb-6 bg-bg-tertiary rounded p-4 border border-border-secondary">
            <summary className="cursor-pointer text-text-primary font-medium mb-2">
              Error Details
            </summary>
            <pre className="text-xs text-text-secondary overflow-auto max-h-40 font-mono">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        <div className="flex flex-wrap gap-3">
          {onReset && (
            <Button
              onClick={onReset}
              variant="primary"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          )}
          <Button
            onClick={() => window.location.href = '/content/voice'}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Mic className="w-4 h-4" />
            New Voice Generation
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}
