/**
 * Preview Card
 * Display individual AI-suggested manifest with approval/rejection actions
 */

import { CheckCircle, XCircle, AlertTriangle, Package, Users, Swords, Eye, Sparkles, Brain, Info } from 'lucide-react'
import React, { useState } from 'react'

import type { AnyPreviewManifest, ItemSuggestion, MobSuggestion, NPCSuggestion } from '../../types/preview-manifests'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardHeader, CardContent, CardFooter } from '../common/Card'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../common/Modal'

interface PreviewCardProps {
  preview: AnyPreviewManifest
  onApprove: () => void
  onReject: (reason: string) => void
}

const PreviewCardComponent: React.FC<PreviewCardProps> = ({ preview, onApprove, onReject }) => {
  const [showDetails, setShowDetails] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleReject = () => {
    onReject(rejectReason || 'User rejected')
    setShowRejectModal(false)
    setRejectReason('')
  }

  // Get manifest type icon
  const getManifestIcon = () => {
    switch (preview.manifestType) {
      case 'items':
        return <Package className="w-4 h-4" />
      case 'mobs':
        return <Swords className="w-4 h-4" />
      case 'npcs':
        return <Users className="w-4 h-4" />
      default:
        return <Package className="w-4 h-4" />
    }
  }

  // Get manifest name
  const getManifestName = () => {
    if (preview.canUseExisting && preview.suggestedExistingId) {
      return `Use Existing: ${preview.suggestedExistingId}`
    }

    if (!preview.data) return 'Unknown'

    if (preview.manifestType === 'items') {
      const item = preview.data as ItemSuggestion['data']
      return item.name || item.id
    } else if (preview.manifestType === 'mobs') {
      const mob = preview.data as MobSuggestion['data']
      return mob.name || mob.id
    } else if (preview.manifestType === 'npcs') {
      const npc = preview.data as NPCSuggestion['data']
      return npc.name || npc.id
    }

    return 'Unknown'
  }

  // Get conflict severity color
  const getConflictColor = (severity: string) => {
    switch (severity) {
      case 'blocker':
        return 'error'
      case 'high':
        return 'warning'
      case 'medium':
        return 'warning'
      case 'low':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  // Check if has blocker conflicts
  const hasBlockerConflicts = preview.conflicts.some(c => c.severity === 'blocker')

  return (
    <>
      <Card
        className={`overflow-hidden transition-all ${
          preview.canUseExisting
            ? 'border-primary/50 bg-primary/5'
            : hasBlockerConflicts
            ? 'border-error/50 bg-error/5'
            : preview.conflicts.length > 0
            ? 'border-warning/50 bg-warning/5'
            : 'border-border-primary hover:border-primary/30'
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Icon */}
              <div
                className={`p-2 rounded-lg ${
                  preview.canUseExisting
                    ? 'bg-primary/10'
                    : hasBlockerConflicts
                    ? 'bg-error/10'
                    : preview.conflicts.length > 0
                    ? 'bg-warning/10'
                    : 'bg-bg-tertiary'
                }`}
              >
                {getManifestIcon()}
              </div>

              {/* Title and badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-text-primary truncate">
                    {getManifestName()}
                  </h3>
                  {preview.canUseExisting && (
                    <Badge variant="primary" size="sm">
                      Reuse Existing
                    </Badge>
                  )}
                  {!preview.canUseExisting && (
                    <Badge variant="success" size="sm">
                      Create New
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {preview.reason}
                </p>

                {/* Metadata badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary" size="sm" className="capitalize">
                    {preview.manifestType}
                  </Badge>

                  <div className="flex items-center gap-1 text-xs text-text-secondary">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span>{preview.aiConfidence}% confidence</span>
                  </div>

                  {preview.suggestedBy === 'ai' && (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <Brain className="w-3 h-3 text-primary" />
                      <span>AI Suggested</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(true)}
                className="text-text-secondary hover:text-text-primary"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Conflicts Warning */}
        {preview.conflicts.length > 0 && (
          <CardContent className="py-3 border-t border-border-primary bg-bg-secondary/30">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-xs font-medium text-text-primary">
                  {preview.conflicts.length} Conflict{preview.conflicts.length > 1 ? 's' : ''} Detected
                </span>
              </div>
              {preview.conflicts.slice(0, 2).map((conflict, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant={getConflictColor(conflict.severity) as any}
                    size="sm"
                    className="capitalize mt-0.5"
                  >
                    {conflict.severity}
                  </Badge>
                  <span className="text-text-secondary flex-1">
                    {conflict.message}
                    {conflict.autoResolution && (
                      <span className="text-success ml-1">(Auto-fix available)</span>
                    )}
                  </span>
                </div>
              ))}
              {preview.conflicts.length > 2 && (
                <button
                  onClick={() => setShowDetails(true)}
                  className="text-xs text-primary hover:underline"
                >
                  +{preview.conflicts.length - 2} more conflicts
                </button>
              )}
            </div>
          </CardContent>
        )}

        {/* Reuse Recommendation */}
        {preview.manifestType === 'npcs' && (preview as NPCSuggestion).reuseRecommendation?.shouldReuse && (
          <CardContent className="py-3 border-t border-primary/20 bg-primary/5">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-text-primary mb-1">
                  Reuse Recommendation
                </p>
                <p className="text-xs text-text-secondary">
                  {(preview as NPCSuggestion).reuseRecommendation.reuseReason}
                </p>
                {(preview as NPCSuggestion).reuseRecommendation.existingNPCName && (
                  <p className="text-xs text-primary mt-1">
                    → Suggested: <strong>{(preview as NPCSuggestion).reuseRecommendation.existingNPCName}</strong>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        )}

        {/* Required by */}
        {preview.requiredBy.length > 0 && (
          <CardContent className="py-2 border-t border-border-primary/50">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>Required by:</span>
              <div className="flex gap-1 flex-wrap">
                {preview.requiredBy.map((req, idx) => (
                  <Badge key={idx} variant="secondary" size="sm">
                    {req}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        )}

        {/* Action buttons */}
        <CardFooter className="flex items-center justify-between gap-3 border-t border-border-primary bg-bg-secondary/20 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRejectModal(true)}
            className="text-error hover:text-error-dark hover:bg-error/10"
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            Reject
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onApprove}
            disabled={hasBlockerConflicts}
            className={hasBlockerConflicts ? 'opacity-50 cursor-not-allowed' : ''}
          >
            <CheckCircle className="w-4 h-4 mr-1.5" />
            {preview.canUseExisting ? 'Use Existing' : 'Approve & Create'}
          </Button>
        </CardFooter>
      </Card>

      {/* Details Modal */}
      <Modal open={showDetails} onClose={() => setShowDetails(false)} size="lg">
        <ModalHeader title="Manifest Details" onClose={() => setShowDetails(false)} />
        <ModalBody>
          <div className="space-y-4">
            {/* Basic info */}
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">Basic Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Name:</span>
                  <span className="text-text-primary font-medium">{getManifestName()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Type:</span>
                  <Badge variant="secondary" size="sm" className="capitalize">
                    {preview.manifestType}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">AI Confidence:</span>
                  <span className="text-text-primary">{preview.aiConfidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Validation Score:</span>
                  <span className="text-text-primary">{preview.validationScore}%</span>
                </div>
              </div>
            </div>

            {/* Full data */}
            {preview.data && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2">Full Data</h4>
                <pre className="p-3 bg-bg-tertiary rounded-lg text-xs text-text-secondary overflow-auto max-h-64">
                  {JSON.stringify(preview.data, null, 2)}
                </pre>
              </div>
            )}

            {/* All conflicts */}
            {preview.conflicts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2">
                  All Conflicts ({preview.conflicts.length})
                </h4>
                <div className="space-y-2">
                  {preview.conflicts.map((conflict, idx) => (
                    <div key={idx} className="p-3 bg-bg-secondary rounded-lg">
                      <div className="flex items-start gap-2 mb-1">
                        <Badge
                          variant={getConflictColor(conflict.severity) as any}
                          size="sm"
                          className="capitalize"
                        >
                          {conflict.severity}
                        </Badge>
                        <span className="text-xs font-medium text-text-primary capitalize">
                          {conflict.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary">{conflict.message}</p>
                      {conflict.autoResolution && (
                        <p className="text-xs text-success mt-1">
                          Auto-fix: {conflict.autoResolution}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowDetails(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reject Modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} size="md">
        <ModalHeader title="Reject Suggestion" onClose={() => setShowRejectModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Are you sure you want to reject this suggestion? You can optionally provide a reason.
            </p>
            <div className="flex items-center gap-3 p-4 bg-error bg-opacity-10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
              <p className="text-sm text-text-primary">
                <strong>{getManifestName()}</strong> will not be created.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Doesn't fit game lore, too similar to existing item..."
                rows={3}
                className="w-full px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all resize-none"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="bg-error hover:bg-error-dark"
            onClick={handleReject}
          >
            Reject Suggestion
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

// Memoize component to prevent unnecessary re-renders
export const PreviewCard = React.memo(PreviewCardComponent, (prevProps, nextProps) => {
  // Only re-render if preview data, approval state, or conflicts change
  return (
    prevProps.preview.id === nextProps.preview.id &&
    prevProps.preview.state === nextProps.preview.state &&
    prevProps.preview.conflicts.length === nextProps.preview.conflicts.length &&
    prevProps.preview.aiConfidence === nextProps.preview.aiConfidence
  )
})
