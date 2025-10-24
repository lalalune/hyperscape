/**
 * Batch Preview
 * Display grouped AI suggestions from the same quest/NPC for bulk approval
 */

import { CheckCircle, Package, Users, Swords, ChevronDown, ChevronUp, AlertTriangle, Sparkles } from 'lucide-react'
import React, { useState, useMemo } from 'react'

import type { PreviewBatch } from '../../types/preview-manifests'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardHeader, CardContent, CardFooter } from '../common/Card'

interface BatchPreviewProps {
  batch: PreviewBatch
  onApprove: () => void
}

const BatchPreviewComponent: React.FC<BatchPreviewProps> = ({ batch, onApprove }) => {
  const [expanded, setExpanded] = useState(false)

  // Memoize counts to avoid recalculating on every render
  const counts = useMemo(() => {
    const itemCount = batch.previews.filter(p => p.manifestType === 'items').length
    const mobCount = batch.previews.filter(p => p.manifestType === 'mobs').length
    const npcCount = batch.previews.filter(p => p.manifestType === 'npcs').length
    const conflictCount = batch.previews.reduce((sum, p) => sum + p.conflicts.length, 0)
    const hasBlockers = batch.previews.some(p =>
      p.conflicts.some(c => c.severity === 'blocker')
    )

    return { itemCount, mobCount, npcCount, conflictCount, hasBlockers }
  }, [batch.previews])

  const { itemCount, mobCount, npcCount, conflictCount, hasBlockers } = counts

  // Get icon for source type
  const getSourceIcon = () => {
    switch (batch.source) {
      case 'quest_generation':
        return '🎯'
      case 'npc_generation':
        return '👤'
      case 'ai_gap_detection':
        return '✨'
      case 'manual':
        return '📝'
      default:
        return '✨'
    }
  }

  return (
    <Card
      className={`overflow-hidden transition-all ${
        hasBlockers
          ? 'border-error/50 bg-error/5'
          : conflictCount > 0
          ? 'border-warning/50 bg-warning/5'
          : 'border-border-primary hover:border-primary/30'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Batch Icon */}
            <div
              className={`p-2 rounded-lg text-xl ${
                hasBlockers
                  ? 'bg-error/10'
                  : conflictCount > 0
                  ? 'bg-warning/10'
                  : 'bg-primary/10'
              }`}
            >
              {getSourceIcon()}
            </div>

            {/* Batch info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-text-primary">
                  {batch.name}
                </h3>
                <Badge variant="primary" size="sm">
                  Batch
                </Badge>
              </div>

              <p className="text-xs text-text-secondary mt-1">
                {batch.previews.length} suggestion{batch.previews.length > 1 ? 's' : ''} from {batch.source.replace(/_/g, ' ')}
              </p>

              {/* Counts */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {itemCount > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <Package className="w-3.5 h-3.5 text-primary" />
                    <span className="text-text-secondary">{itemCount} item{itemCount > 1 ? 's' : ''}</span>
                  </div>
                )}
                {mobCount > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <Swords className="w-3.5 h-3.5 text-primary" />
                    <span className="text-text-secondary">{mobCount} mob{mobCount > 1 ? 's' : ''}</span>
                  </div>
                )}
                {npcCount > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="text-text-secondary">{npcCount} NPC{npcCount > 1 ? 's' : ''}</span>
                  </div>
                )}
                {conflictCount > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    <span className="text-warning">{conflictCount} conflict{conflictCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expand button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-text-secondary hover:text-text-primary"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Expanded details */}
      {expanded && (
        <CardContent className="py-3 border-t border-border-primary bg-bg-secondary/20">
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-2 uppercase tracking-wider">
                Included Suggestions
              </h4>
              <div className="space-y-2">
                {batch.previews.map((preview, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2.5 bg-bg-primary/50 rounded-lg border border-border-primary/30"
                  >
                    {/* Type icon */}
                    <div className="p-1.5 bg-bg-tertiary rounded-lg">
                      {preview.manifestType === 'items' && <Package className="w-3.5 h-3.5 text-primary" />}
                      {preview.manifestType === 'mobs' && <Swords className="w-3.5 h-3.5 text-primary" />}
                      {preview.manifestType === 'npcs' && <Users className="w-3.5 h-3.5 text-primary" />}
                    </div>

                    {/* Preview info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-primary">
                          {preview.data?.name || preview.data?.id || preview.suggestedExistingId || 'Unknown'}
                        </span>
                        <Badge variant="secondary" size="sm" className="capitalize">
                          {preview.manifestType}
                        </Badge>
                        {preview.canUseExisting && (
                          <Badge variant="primary" size="sm">
                            Reuse
                          </Badge>
                        )}
                        {preview.conflicts.length > 0 && (
                          <Badge variant="warning" size="sm">
                            {preview.conflicts.length} conflict{preview.conflicts.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                        {preview.reason}
                      </p>
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span>{preview.aiConfidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary stats */}
            <div className="pt-2 border-t border-border-primary/50">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-text-secondary mb-1">Total Items</p>
                  <p className="text-lg font-semibold text-text-primary">{batch.previews.length}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Avg Confidence</p>
                  <p className="text-lg font-semibold text-text-primary">
                    {Math.round(
                      batch.previews.reduce((sum, p) => sum + p.aiConfidence, 0) / batch.previews.length
                    )}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Conflicts</p>
                  <p className={`text-lg font-semibold ${conflictCount > 0 ? 'text-warning' : 'text-success'}`}>
                    {conflictCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}

      {/* Warning for blockers */}
      {hasBlockers && (
        <CardContent className="py-3 border-t border-error/20 bg-error/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-error mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-text-primary mb-1">
                Blocker Conflicts Detected
              </p>
              <p className="text-xs text-text-secondary">
                This batch contains items with blocker-level conflicts. Please resolve them before approving.
              </p>
            </div>
          </div>
        </CardContent>
      )}

      {/* Batch actions */}
      <CardFooter className="flex items-center justify-between gap-3 border-t border-border-primary bg-bg-secondary/20 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" size="sm" className="capitalize">
            {batch.source.replace(/_/g, ' ')}
          </Badge>
          <span className="text-xs text-text-secondary">
            Created {new Date(batch.createdAt).toLocaleString()}
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onApprove}
          disabled={hasBlockers}
          className={hasBlockers ? 'opacity-50 cursor-not-allowed' : ''}
        >
          <CheckCircle className="w-4 h-4 mr-1.5" />
          Approve All ({batch.previews.length})
        </Button>
      </CardFooter>
    </Card>
  )
}

// Memoize component for performance
export const BatchPreview = React.memo(BatchPreviewComponent)
