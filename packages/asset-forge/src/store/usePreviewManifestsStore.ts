/**
 * Preview Manifests Store
 *
 * Zustand store for managing AI-generated manifest suggestions
 * before they are approved and added to canonical manifests
 */

import { create } from 'zustand'

import type { AnyManifest } from '../types/manifests'
import type {
  AnyPreviewManifest,
  ManifestGap,
  PreviewBatch,
  ManifestApprovalResult,
  ManifestState,
  ManifestConflict,



//   ResourceSuggestion
} from '../types/preview-manifests'

interface PreviewManifestsState {
  // Preview items awaiting approval
  previews: AnyPreviewManifest[]

  // Detected gaps
  gaps: ManifestGap[]

  // Batches (grouped suggestions from same source)
  batches: PreviewBatch[]

  // UI State
  selectedPreview: AnyPreviewManifest | null
  selectedBatch: PreviewBatch | null
  filterState: ManifestState | 'all'
  showConflictsOnly: boolean

  // Actions - Preview Management
  addPreview: (preview: AnyPreviewManifest) => void
  addPreviews: (previews: AnyPreviewManifest[]) => void
  removePreview: (id: string) => void
  updatePreview: (id: string, updates: Partial<AnyPreviewManifest>) => void

  // Actions - Approval Workflow
  approvePreview: (id: string) => AnyManifest | null
  rejectPreview: (id: string, reason: string) => void
  approveAll: (ids: string[]) => ManifestApprovalResult
  approveBatch: (batchId: string) => ManifestApprovalResult

  // Actions - Gap Management
  addGap: (gap: ManifestGap) => void
  removeGap: (id: string) => void
  clearGaps: () => void
  getGapsForQuest: (questId: string) => ManifestGap[]

  // Actions - Batch Management
  createBatch: (previews: AnyPreviewManifest[], name: string, description: string) => PreviewBatch
  removeBatch: (id: string) => void

  // Queries
  getPreviewsByState: (state: ManifestState) => AnyPreviewManifest[]
  getPreviewsByType: (type: 'items' | 'mobs' | 'npcs' | 'resources') => AnyPreviewManifest[]
  getConflictingPreviews: () => AnyPreviewManifest[]
  getAutoResolvablePreviews: () => AnyPreviewManifest[]
  getStats: () => {
    total: number
    byState: Record<ManifestState, number>
    withConflicts: number
    autoResolvable: number
    highPriority: number
  }

  // UI Actions
  setSelectedPreview: (preview: AnyPreviewManifest | null) => void
  setSelectedBatch: (batch: PreviewBatch | null) => void
  setFilterState: (state: ManifestState | 'all') => void
  setShowConflictsOnly: (show: boolean) => void
  clearAll: () => void
}

export const usePreviewManifestsStore = create<PreviewManifestsState>((set, get) => ({
  // Initial state
  previews: [],
  gaps: [],
  batches: [],
  selectedPreview: null,
  selectedBatch: null,
  filterState: 'all',
  showConflictsOnly: false,

  // Preview Management
  addPreview: (preview) => set((state) => ({
    previews: [...state.previews, preview]
  })),

  addPreviews: (newPreviews) => set((state) => ({
    previews: [...state.previews, ...newPreviews]
  })),

  removePreview: (id) => set((state) => ({
    previews: state.previews.filter(p => p.id !== id),
    selectedPreview: state.selectedPreview?.id === id ? null : state.selectedPreview
  })),

  updatePreview: (id, updates) => set((state) => ({
    previews: state.previews.map(p =>
      p.id === id ? { ...p, ...updates } as AnyPreviewManifest : p
    )
  })),

  // Approval Workflow
  approvePreview: (id) => {
    const preview = get().previews.find(p => p.id === id)
    if (!preview) return null

    // Update preview state
    set((state) => ({
      previews: state.previews.map(p =>
        p.id === id
          ? {
              ...p,
              state: 'staging' as ManifestState,
              metadata: {
                ...p.metadata,
                approvedAt: new Date().toISOString()
              }
            }
          : p
      )
    }))

    // Return the manifest data for saving
    return preview.data
  },

  rejectPreview: (id, reason) => set((state) => ({
    previews: state.previews.map(p =>
      p.id === id
        ? {
            ...p,
            state: 'rejected' as ManifestState,
            metadata: {
              ...p.metadata,
              rejectedAt: new Date().toISOString(),
              rejectionReason: reason
            }
          }
        : p
    )
  })),

  approveAll: (ids) => {
    const approved: AnyManifest[] = []
    const rejected: string[] = []
    const conflicts: ManifestConflict[] = []
    const warnings: string[] = []

    ids.forEach(id => {
      const preview = get().previews.find(p => p.id === id)
      if (!preview) {
        rejected.push(id)
        warnings.push(`Preview ${id} not found`)
        return
      }

      // Check for blocker conflicts
      const hasBlockers = preview.conflicts.some(c => c.severity === 'blocker')
      if (hasBlockers) {
        rejected.push(id)
        conflicts.push(...preview.conflicts.filter(c => c.severity === 'blocker'))
        return
      }

      // Approve
      const manifest = get().approvePreview(id)
      if (manifest) {
        approved.push(manifest)
      }
    })

    return { approved, rejected, conflicts, warnings }
  },

  approveBatch: (batchId) => {
    const batch = get().batches.find(b => b.id === batchId)
    if (!batch) {
      return {
        approved: [],
        rejected: [],
        conflicts: [],
        warnings: [`Batch ${batchId} not found`]
      }
    }

    const ids = batch.previews.map(p => p.id)
    return get().approveAll(ids)
  },

  // Gap Management
  addGap: (gap) => set((state) => ({
    gaps: [...state.gaps, gap]
  })),

  removeGap: (id) => set((state) => ({
    gaps: state.gaps.filter(g => g.id !== id)
  })),

  clearGaps: () => set({ gaps: [] }),

  getGapsForQuest: (questId) => {
    return get().gaps.filter(g => g.requiredBy === questId)
  },

  // Batch Management
  createBatch: (previews, name, description) => {
    const batch: PreviewBatch = {
      id: `batch_${crypto.randomUUID()}`,
      name,
      description,
      previews,
      source: previews[0]?.metadata?.source ?? 'manual',
      createdAt: new Date().toISOString(),
      totalConflicts: previews.reduce((sum, p) => sum + (p.conflicts?.length ?? 0), 0),
      autoResolvable: previews.filter(p =>
        p.conflicts?.every(c => c.autoResolution !== undefined) ?? false
      ).length,
      requiresReview: previews.filter(p =>
        p.conflicts?.some(c => c.autoResolution === undefined) ?? false
      ).length
    }

    set((state) => ({
      batches: [...state.batches, batch]
    }))

    return batch
  },

  removeBatch: (id) => set((state) => ({
    batches: state.batches.filter(b => b.id !== id),
    selectedBatch: state.selectedBatch?.id === id ? null : state.selectedBatch
  })),

  // Queries
  getPreviewsByState: (state) => {
    return get().previews.filter(p => p.state === state)
  },

  getPreviewsByType: (type) => {
    return get().previews.filter(p => p.manifestType === type)
  },

  getConflictingPreviews: () => {
    return get().previews.filter(p => p.conflicts.length > 0)
  },

  getAutoResolvablePreviews: () => {
    return get().previews.filter(p =>
      p.conflicts.length > 0 &&
      p.conflicts.every(c => c.autoResolution !== undefined)
    )
  },

  getStats: () => {
    const previews = get().previews

    return {
      total: previews.length,
      byState: {
        canonical: previews.filter(p => p.state === 'canonical').length,
        preview: previews.filter(p => p.state === 'preview').length,
        staging: previews.filter(p => p.state === 'staging').length,
        rejected: previews.filter(p => p.state === 'rejected').length
      },
      withConflicts: previews.filter(p => p.conflicts.length > 0).length,
      autoResolvable: get().getAutoResolvablePreviews().length,
      highPriority: get().gaps.filter(g => g.priority === 'high' || g.priority === 'critical').length
    }
  },

  // UI Actions
  setSelectedPreview: (preview) => set({ selectedPreview: preview }),

  setSelectedBatch: (batch) => set({ selectedBatch: batch }),

  setFilterState: (filterState) => set({ filterState }),

  setShowConflictsOnly: (show) => set({ showConflictsOnly: show }),

  clearAll: () => set({
    previews: [],
    gaps: [],
    batches: [],
    selectedPreview: null,
    selectedBatch: null
  })
}))
