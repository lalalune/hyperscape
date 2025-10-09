/**
 * Regenerate Base Modal
 * Allows regenerating the base model for an asset
 */

import React, { useState } from 'react'
import { Asset } from '../../types'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalSection, Button } from '../common'
import { formatAssetName } from '../../utils/formatAssetName'
import { RefreshCw, CheckCircle, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'

interface RegenerateModalProps {
  asset: Asset
  onClose: () => void
  onComplete: () => void
}

const RegenerateModal: React.FC<RegenerateModalProps> = ({
  asset,
  onClose,
  onComplete
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setStatus('processing')
    setMessage('Initializing regeneration...')
    setProgress(10)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 2000)

      const response = await fetch(`/api/regenerate-base/${asset.id}`, {
        method: 'POST'
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error('Regeneration failed')
      }

      const result = await response.json()
      
      setProgress(100)
      setStatus('success')
      setMessage(result.message || 'Base model regenerated successfully!')
      
      // Show success for 2 seconds then close
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Regeneration failed')
      setProgress(0)
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <Modal open={true} onClose={onClose} size="md">
      <ModalHeader title="Regenerate Base Model" onClose={onClose} />

      <ModalBody>
        {status === 'idle' && (
          <>
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-warning font-medium">
                    Warning: Regenerating the base model will:
                  </p>
                  <ul className="list-disc list-inside text-sm text-warning/80 space-y-1">
                    <li>Create a new 3D model from the original description</li>
                    <li>Replace the existing base model</li>
                    <li>Require re-retexturing for material variants</li>
                  </ul>
                </div>
              </div>
            </div>

            <ModalSection title="Selected Asset">
              <div className="bg-bg-secondary rounded-lg p-4">
                <h4 className="font-semibold text-text-primary mb-1">
                  {formatAssetName(asset.name)}
                </h4>
                {asset.description && (
                  <p className="text-sm text-text-secondary">
                    {asset.description}
                  </p>
                )}
              </div>
            </ModalSection>
          </>
        )}

        {status === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h4 className="text-lg font-semibold text-text-primary">
              Regenerating Base Model
            </h4>
            <p className="text-sm text-text-secondary text-center max-w-sm">
              {message}
            </p>
            <div className="w-full max-w-xs space-y-2">
              <div className="bg-bg-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary text-center">
                {Math.round(progress)}% Complete
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h4 className="text-lg font-semibold text-text-primary">
              Success!
            </h4>
            <p className="text-sm text-text-secondary text-center max-w-sm">
              {message}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
              <div>
                <p className="text-error font-medium">
                  Regeneration Failed
                </p>
                <p className="text-sm text-error/80 mt-1">
                  {message}
                </p>
              </div>
            </div>
          </div>
        )}
      </ModalBody>

      {(status === 'idle' || status === 'error') && (
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="primary"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            <RefreshCw className="w-4 h-4" />
            {status === 'error' ? 'Try Again' : 'Regenerate Base'}
          </Button>
        </ModalFooter>
      )}
    </Modal>
  )
}

export default RegenerateModal