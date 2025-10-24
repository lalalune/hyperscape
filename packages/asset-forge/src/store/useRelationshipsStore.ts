/**
 * Relationships Store
 * 
 * Zustand store for managing entity relationships
 */

import { create } from 'zustand'

import type { EntityRelationship, RelationshipStats } from '../types/relationships'
import { calculateRelationshipStats } from '../types/relationships'

interface RelationshipsState {
  // Data
  relationships: EntityRelationship[]
  
  // Actions
  addRelationship: (relationship: EntityRelationship) => void
  updateRelationship: (id: string, updates: Partial<EntityRelationship>) => void
  deleteRelationship: (id: string) => void
  clearRelationships: () => void
  
  // Queries
  getRelationshipsFor: (entityId: string) => EntityRelationship[]
  getRelationshipsBetween: (entity1Id: string, entity2Id: string) => EntityRelationship | undefined
  getStats: () => RelationshipStats
}

export const useRelationshipsStore = create<RelationshipsState>((set, get) => ({
  // Initial state
  relationships: [],
  
  // Actions
  addRelationship: (relationship) => set((state) => ({
    relationships: [...state.relationships, relationship]
  })),
  
  updateRelationship: (id, updates) => set((state) => ({
    relationships: state.relationships.map(r =>
      r.id === id ? { ...r, ...updates } : r
    )
  })),
  
  deleteRelationship: (id) => set((state) => ({
    relationships: state.relationships.filter(r => r.id !== id)
  })),
  
  clearRelationships: () => set({ relationships: [] }),
  
  // Queries
  getRelationshipsFor: (entityId) => {
    return get().relationships.filter(
      r => r.fromId === entityId || r.toId === entityId
    )
  },
  
  getRelationshipsBetween: (entity1Id, entity2Id) => {
    return get().relationships.find(
      r => (r.fromId === entity1Id && r.toId === entity2Id) ||
           (r.fromId === entity2Id && r.toId === entity1Id)
    )
  },
  
  getStats: () => {
    return calculateRelationshipStats(get().relationships)
  }
}))

