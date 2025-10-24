/**
 * Manifest Preview Panel
 * Display and manage AI-suggested manifest items before approval
 */

import { Package, Swords, Users, Filter, ChevronDown, AlertCircle } from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import { usePreviewManifestsStore } from '../../store/usePreviewManifestsStore'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'

import { BatchPreview } from './BatchPreview'
import { PreviewCard } from './PreviewCard'

type ManifestFilter = 'all' | 'items' | 'mobs' | 'npcs'
type SuggestionFilter = 'all' | 'new' | 'reuse' | 'conflicts'

export const ManifestPreviewPanel: React.FC = () => {
  const { previews, gaps, batches, approvePreview, rejectPreview, approveBatch } = usePreviewManifestsStore()

  const [manifestFilter, setManifestFilter] = useState<ManifestFilter>('all')
  const [suggestionFilter, setSuggestionFilter] = useState<SuggestionFilter>('all')
  const [showBatches, setShowBatches] = useState(false)

  // Memoize preview items to avoid recalculation
  const previewItems = useMemo(() =>
    previews.filter(p => p.state === 'preview'),
    [previews]
  )

  // Filter previews by manifest type and suggestion type (optimized)
  const filteredPreviews = useMemo(() => {
    return previewItems.filter(p => {
      // Manifest type filter
      if (manifestFilter !== 'all' && p.manifestType !== manifestFilter) {
        return false
      }

      // Suggestion type filter
      if (suggestionFilter === 'new' && p.canUseExisting) {
        return false
      }
      if (suggestionFilter === 'reuse' && !p.canUseExisting) {
        return false
      }
      if (suggestionFilter === 'conflicts' && (!p.conflicts || p.conflicts.length === 0)) {
        return false
      }

      return true
    })
  }, [previewItems, manifestFilter, suggestionFilter])

  // Count by manifest type (optimized with single pass)
  const counts = useMemo(() => {
    const result = {
      all: previewItems.length,
      items: 0,
      mobs: 0,
      npcs: 0,
      conflicts: 0,
      new: 0,
      reuse: 0
    }

    // Single pass counting
    previewItems.forEach(p => {
      if (p.manifestType === 'items') result.items++
      else if (p.manifestType === 'mobs') result.mobs++
      else if (p.manifestType === 'npcs') result.npcs++

      if (p.conflicts && p.conflicts.length > 0) result.conflicts++
      if (p.canUseExisting) result.reuse++
      else result.new++
    })

    return result
  }, [previewItems])

  const handleApprove = useCallback((id: string) => {
    const approved = approvePreview(id)
    if (approved) {
      console.log('[ManifestPreview] Approved manifest:', approved.id)
    }
  }, [approvePreview])

  const handleReject = useCallback((id: string, reason: string) => {
    rejectPreview(id, reason)
    console.log('[ManifestPreview] Rejected preview:', id)
  }, [rejectPreview])

  const handleApproveBatch = useCallback((batchId: string) => {
    const result = approveBatch(batchId)
    console.log(`[ManifestPreview] Batch approved: ${result.approved.length} items, ${result.rejected.length} rejected`)
  }, [approveBatch])

  if (counts.all === 0 && gaps.length === 0) {
    return (
      <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary">
        <CardContent className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-bg-tertiary/50 rounded-2xl">
              <Package className="w-12 h-12 text-text-tertiary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No AI Suggestions Yet
              </h3>
              <p className="text-sm text-text-secondary max-w-md">
                Generate quests or NPCs with AI, and any missing items, mobs, or NPCs will appear here for your approval.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  AI Suggestions
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Review and approve manifest suggestions from AI generation
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                {counts.all} Pending
              </Badge>
              {counts.conflicts > 0 && (
                <Badge variant="warning" size="sm">
                  {counts.conflicts} Conflicts
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card className="border-border-primary">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Manifest Type Filter */}
            <div>
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 block">
                Manifest Type
              </label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={manifestFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setManifestFilter('all')}
                  className="text-sm"
                >
                  All
                  <Badge
                    variant={manifestFilter === 'all' ? 'secondary' : 'primary'}
                    size="sm"
                    className="ml-2"
                  >
                    {counts.all}
                  </Badge>
                </Button>
                <Button
                  variant={manifestFilter === 'items' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setManifestFilter('items')}
                  className="text-sm"
                >
                  <Package className="w-3.5 h-3.5 mr-1.5" />
                  Items
                  <Badge
                    variant={manifestFilter === 'items' ? 'secondary' : 'primary'}
                    size="sm"
                    className="ml-2"
                  >
                    {counts.items}
                  </Badge>
                </Button>
                <Button
                  variant={manifestFilter === 'mobs' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setManifestFilter('mobs')}
                  className="text-sm"
                >
                  <Swords className="w-3.5 h-3.5 mr-1.5" />
                  Mobs
                  <Badge
                    variant={manifestFilter === 'mobs' ? 'secondary' : 'primary'}
                    size="sm"
                    className="ml-2"
                  >
                    {counts.mobs}
                  </Badge>
                </Button>
                <Button
                  variant={manifestFilter === 'npcs' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setManifestFilter('npcs')}
                  className="text-sm"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  NPCs
                  <Badge
                    variant={manifestFilter === 'npcs' ? 'secondary' : 'primary'}
                    size="sm"
                    className="ml-2"
                  >
                    {counts.npcs}
                  </Badge>
                </Button>
              </div>
            </div>

            {/* Suggestion Type Filter */}
            <div>
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 block">
                Suggestion Type
              </label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={suggestionFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSuggestionFilter('all')}
                  className="text-sm"
                >
                  All Suggestions
                </Button>
                <Button
                  variant={suggestionFilter === 'new' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSuggestionFilter('new')}
                  className="text-sm"
                >
                  <Badge variant="success" size="sm" className="mr-1.5">
                    New
                  </Badge>
                  Create New ({counts.new})
                </Button>
                <Button
                  variant={suggestionFilter === 'reuse' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSuggestionFilter('reuse')}
                  className="text-sm"
                >
                  <Badge variant="primary" size="sm" className="mr-1.5">
                    Reuse
                  </Badge>
                  Use Existing ({counts.reuse})
                </Button>
                {counts.conflicts > 0 && (
                  <Button
                    variant={suggestionFilter === 'conflicts' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSuggestionFilter('conflicts')}
                    className="text-sm"
                  >
                    <Badge variant="warning" size="sm" className="mr-1.5">
                      ⚠
                    </Badge>
                    Has Conflicts ({counts.conflicts})
                  </Button>
                )}
              </div>
            </div>

            {/* Batch View Toggle */}
            {batches.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border-primary">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Group by Quest/NPC
                </label>
                <Button
                  variant={showBatches ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowBatches(!showBatches)}
                  className="text-sm"
                >
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  {showBatches ? 'Show Individual' : 'Show Batches'}
                  <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform ${showBatches ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview List */}
      {showBatches && batches.length > 0 ? (
        // Batch View
        <div className="space-y-3">
          {batches.map(batch => (
            <BatchPreview
              key={batch.id}
              batch={batch}
              onApprove={() => handleApproveBatch(batch.id)}
            />
          ))}
        </div>
      ) : (
        // Individual Preview Cards
        <div className="space-y-3">
          {filteredPreviews.length === 0 ? (
            <Card className="border-border-primary">
              <CardContent className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-bg-tertiary/50 rounded-xl">
                    <Filter className="w-8 h-8 text-text-tertiary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary mb-1">
                      No suggestions match these filters
                    </p>
                    <p className="text-xs text-text-secondary">
                      Try adjusting your filter settings
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredPreviews.map(preview => (
              <PreviewCard
                key={preview.id}
                preview={preview}
                onApprove={() => handleApprove(preview.id)}
                onReject={(reason) => handleReject(preview.id, reason)}
              />
            ))
          )}
        </div>
      )}

      {/* Gaps List (if any) */}
      {gaps.length > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-warning/10 rounded-xl">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-text-primary">
                  Missing Manifests Detected
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  These items were referenced but don't exist yet
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {gaps.map(gap => (
              <div
                key={gap.id}
                className="flex items-start gap-3 p-3 bg-bg-secondary/50 rounded-lg border border-border-primary"
              >
                <div className="p-1.5 bg-warning/10 rounded-lg">
                  {gap.type === 'item' && <Package className="w-4 h-4 text-warning" />}
                  {gap.type === 'mob' && <Swords className="w-4 h-4 text-warning" />}
                  {gap.type === 'npc' && <Users className="w-4 h-4 text-warning" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {gap.suggestedName}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {gap.reason}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" size="sm" className="capitalize">
                      {gap.type}
                    </Badge>
                    <Badge variant="primary" size="sm">
                      {gap.tier}
                    </Badge>
                    <Badge
                      variant={gap.priority === 'critical' ? 'error' : gap.priority === 'high' ? 'warning' : 'secondary'}
                      size="sm"
                      className="capitalize"
                    >
                      {gap.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
