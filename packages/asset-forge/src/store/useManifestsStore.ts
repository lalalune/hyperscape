/**
 * Manifests Store
 * Zustand store for managing game data manifests state
 */

import { create } from 'zustand'

import type { ManifestType, AnyManifest } from '../types/manifests'
import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest } from '../types/manifests'
import {
  createItemSearch,
  createMobSearch,
  createNPCSearch,
  createResourceSearch
} from '../utils/fuzzy-search'

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
    
    if (!searchQuery || searchQuery.trim() === '') {
      return items
    }
    
    // Use fuzzy search based on type
    switch (selectedType) {
      case 'items': {
        const search = createItemSearch(items as ItemManifest[])
        return search.search(searchQuery)
      }
      case 'mobs': {
        const search = createMobSearch(items as MobManifest[])
        return search.search(searchQuery)
      }
      case 'npcs': {
        const search = createNPCSearch(items as NPCManifest[])
        return search.search(searchQuery)
      }
      case 'resources': {
        const search = createResourceSearch(items as ResourceManifest[])
        return search.search(searchQuery)
      }
      default:
        return items
    }
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

