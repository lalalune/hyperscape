import { AlertTriangle, X } from 'lucide-react'
import React from 'react'

import { Button } from '../common'

interface ModalErrorFallbackProps {
  error?: Error
  onClose?: () => void
}

export const ModalErrorFallback: React.FC<ModalErrorFallbackProps> = ({ error, onClose }) => {
  return (
    <div className="bg-bg-secondary rounded-lg shadow-lg p-6 border border-border-primary max-w-md mx-auto">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-text-primary mb-1">Modal Error</h3>
          <p className="text-sm text-text-secondary">
            An error occurred in this modal. Please close and try again.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && process.env.NODE_ENV === 'development' && (
        <details className="mb-4 bg-bg-tertiary rounded p-3 border border-border-secondary">
          <summary className="cursor-pointer text-xs text-text-primary font-medium mb-1">
            Error Details
          </summary>
          <pre className="text-xs text-text-secondary overflow-auto max-h-32 font-mono">
            {error.message}
          </pre>
        </details>
      )}

      {onClose && (
        <div className="flex justify-end">
          <Button onClick={onClose} variant="secondary" size="sm">
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
