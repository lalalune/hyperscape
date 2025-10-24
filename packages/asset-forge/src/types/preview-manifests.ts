/**
 * Preview Manifest Types
 *
 * Types for AI-generated manifest suggestions that require user approval
 * before being added to canonical manifests
 */

import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest, ManifestType, AnyManifest } from './manifests'

export type ManifestState = 'canonical' | 'preview' | 'staging' | 'rejected'

export type SuggestionSource = 'quest_generation' | 'npc_generation' | 'manual' | 'ai_gap_detection'

export type ConflictType =
  | 'name_similar'
  | 'id_collision'
  | 'stats_duplicate'
  | 'tier_mismatch'
  | 'already_exists'

export interface ManifestConflict {
  type: ConflictType
  severity: 'low' | 'medium' | 'high' | 'blocker'
  existingId: string
  existingName: string
  message: string
  similarity?: number // 0-1 for name similarity
  autoResolution?: 'use_existing' | 'rename' | 'merge'
}

export interface PreviewManifest<T extends AnyManifest = AnyManifest> {
  id: string // Preview ID (not the manifest ID)
  state: ManifestState
  manifestType: ManifestType
  data: T

  // AI suggestion metadata
  suggestedBy: 'ai' | 'user'
  reason: string // Why AI suggested this
  requiredBy: string[] // Quest/NPC IDs that need this
  conflicts: ManifestConflict[]

  // Confidence and validation
  aiConfidence: number // 0-100
  validationScore: number // 0-100 (based on conflicts, completeness)
  canUseExisting: boolean // True if existing manifest could work
  suggestedExistingId?: string // ID of existing manifest that could work

  // Metadata
  metadata: {
    createdAt: string
    source: SuggestionSource
    reviewedBy?: string
    approvedAt?: string
    rejectedAt?: string
    rejectionReason?: string
  }
}

export interface ManifestGap {
  id: string
  type: 'item' | 'mob' | 'npc' | 'resource'
  reason: string
  suggestedId: string
  suggestedName: string
  tier: string
  requiredBy: string // Quest/NPC ID that needs it
  requiredByType: 'quest' | 'npc' | 'lore'
  priority: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: string
}

export interface ItemSuggestion extends PreviewManifest<ItemManifest> {
  manifestType: 'items'
  alternativeIds: string[] // Existing items that could work
}

export interface MobSuggestion extends PreviewManifest<MobManifest> {
  manifestType: 'mobs'
  alternativeIds: string[]
}

export interface NPCSuggestion extends PreviewManifest<NPCManifest> {
  manifestType: 'npcs'
  reuseRecommendation: {
    shouldReuse: boolean
    existingNPCId?: string
    existingNPCName?: string
    reuseReason?: string
    newNPCJustification?: string
  }
  loreConsistency: {
    score: number // 0-100
    referencesExistingCharacters: string[] // NPC names referenced
    referencesExistingEvents: string[] // Event/lore names referenced
    relationshipCount: number
    minimumRelationships: number // Should be >= 2
  }
}

export interface ResourceSuggestion extends PreviewManifest<ResourceManifest> {
  manifestType: 'resources'
  alternativeIds: string[]
}

export type AnyPreviewManifest =
  | ItemSuggestion
  | MobSuggestion
  | NPCSuggestion
  | ResourceSuggestion

export interface PreviewBatch {
  id: string
  name: string
  description: string
  previews: AnyPreviewManifest[]
  source: SuggestionSource
  createdAt: string
  totalConflicts: number
  autoResolvable: number
  requiresReview: number
}

export interface ManifestApprovalResult {
  approved: AnyManifest[]
  rejected: string[]
  conflicts: ManifestConflict[]
  warnings: string[]
}

// Helper type guards
export function isItemSuggestion(preview: AnyPreviewManifest): preview is ItemSuggestion {
  return preview.manifestType === 'items'
}

export function isMobSuggestion(preview: AnyPreviewManifest): preview is MobSuggestion {
  return preview.manifestType === 'mobs'
}

export function isNPCSuggestion(preview: AnyPreviewManifest): preview is NPCSuggestion {
  return preview.manifestType === 'npcs'
}

export function isResourceSuggestion(preview: AnyPreviewManifest): preview is ResourceSuggestion {
  return preview.manifestType === 'resources'
}

// Validation helpers
export function getConflictSeverity(conflicts: ManifestConflict[]): 'none' | 'low' | 'medium' | 'high' | 'blocker' {
  if (conflicts.length === 0) return 'none'
  if (conflicts.some(c => c.severity === 'blocker')) return 'blocker'
  if (conflicts.some(c => c.severity === 'high')) return 'high'
  if (conflicts.some(c => c.severity === 'medium')) return 'medium'
  return 'low'
}

export function canAutoResolve(preview: AnyPreviewManifest): boolean {
  return preview.conflicts.every(c => c.autoResolution !== undefined)
}

export function calculateValidationScore(preview: AnyPreviewManifest): number {
  let score = 100

  // Deduct for conflicts
  preview.conflicts.forEach(conflict => {
    switch (conflict.severity) {
      case 'blocker': score -= 50; break
      case 'high': score -= 20; break
      case 'medium': score -= 10; break
      case 'low': score -= 5; break
    }
  })

  // Bonus for low conflicts
  if (preview.conflicts.length === 0) score += 10

  // Bonus for high AI confidence
  if (preview.aiConfidence > 90) score += 5

  // Check NPC-specific criteria
  if (isNPCSuggestion(preview)) {
    // Deduct if not enough relationships
    if (preview.loreConsistency.relationshipCount < preview.loreConsistency.minimumRelationships) {
      score -= 20
    }

    // Deduct if low lore consistency
    if (preview.loreConsistency.score < 50) {
      score -= 15
    }
  }

  return Math.max(0, Math.min(100, score))
}
