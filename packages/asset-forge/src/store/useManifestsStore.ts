/**
 * Manifests Store
 * Zustand store for managing game data manifests state
 */

import { create } from 'zustand'
import type { ManifestType, AnyManifest } from '../types/manifests'

interface ManifestsState {
  // Data
  manifests: Partial<Record<ManifestType, AnyManifest[]>>
  selectedType: ManifestType | null
  selectedItem: AnyManifest | null
  
  // UI State
  loading: boolean
  error: string | null
  searchQuery: string
  
  // Actions
  setManifests: (manifests: Partial<Record<ManifestType, AnyManifest[]>>) => void
  setSelectedType: (type: ManifestType | null) => void
  setSelectedItem: (item: AnyManifest | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSearchQuery: (query: string) => void
  
  // Helpers
  getFilteredItems: () => AnyManifest[]
  getStats: () => Record<ManifestType, number>
}

export const useManifestsStore = create<ManifestsState>((set, get) => ({
  // Initial state
  manifests: {},
  selectedType: null,
  selectedItem: null,
  loading: false,
  error: null,
  searchQuery: '',
  
  // Actions
  setManifests: (manifests) => set({ manifests }),
  
  setSelectedType: (type) => set({ 
    selectedType: type,
    selectedItem: null, // Clear selection when changing type
    searchQuery: '' // Clear search when changing type
  }),
  
  setSelectedItem: (item) => set({ selectedItem: item }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Helpers
  getFilteredItems: () => {
    const { manifests, selectedType, searchQuery } = get()
    
    if (!selectedType || !manifests[selectedType]) {
      return []
    }
    
    const items = manifests[selectedType]!
    
    if (!searchQuery) {
      return items
    }
    
    const query = searchQuery.toLowerCase()
    
    return items.filter((item: AnyManifest) => {
      // Search by name
      if ('name' in item && item.name.toLowerCase().includes(query)) {
        return true
      }
      
      // Search by ID
      if ('id' in item && item.id.toLowerCase().includes(query)) {
        return true
      }
      
      // Search by description
      if ('description' in item && item.description.toLowerCase().includes(query)) {
        return true
      }
      
      // Search by type (for items)
      if ('type' in item && String(item.type).toLowerCase().includes(query)) {
        return true
      }
      
      return false
    })
  },
  
  getStats: () => {
    const { manifests } = get()
    const stats: Partial<Record<ManifestType, number>> = {}
    
    const types: ManifestType[] = [
      'items',
      'mobs',
      'npcs',
      'resources',
      'world-areas',
      'biomes',
      'zones',
      'banks',
      'stores'
    ]
    
    types.forEach((type) => {
      stats[type] = manifests[type]?.length || 0
    })
    
    return stats as Record<ManifestType, number>
  }
}))

