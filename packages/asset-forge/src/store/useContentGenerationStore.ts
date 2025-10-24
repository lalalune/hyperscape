/**
 * Content Generation Store
 * Manages state for quest, NPC, and lore generation
 *
 * Includes localStorage persistence and seed data loading
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { API_ENDPOINTS } from '../config/api'
import { loadSeedContent } from '../services/SeedDataService'
import type { GeneratedQuest, GeneratedNPC, LoreEntry, ContentPack } from '../types/content-generation'
import { createLogger } from '../utils/logger'

const logger = createLogger('ContentGenerationStore')

interface SelectedContext {
  items: string[]
  mobs: string[]
  npcs: string[]
  resources: string[]
  lore: string[]
}

interface PlaytesterPersona {
  name: string
  personality: string
  expectations: string[]
}

interface ContentGenerationState {
  // Active content type
  contentType: 'quest' | 'npc' | 'lore' | 'pack'

  // Generated content
  quests: GeneratedQuest[]
  npcs: GeneratedNPC[]
  loreEntries: LoreEntry[]

  // Current pack being built
  currentPack: ContentPack | null

  // Context selection for AI generation
  selectedContext: SelectedContext

  // Playtester personas
  playtesterPersonas: Record<string, PlaytesterPersona> | null

  // UI state
  activeTab: 'quest' | 'npc' | 'lore' | 'scripts' | 'tracking' | 'relationships' | 'suggestions' | 'collaboration' | 'playtest'
  selectedQuest: GeneratedQuest | null
  selectedNPC: GeneratedNPC | null
  selectedLore: LoreEntry | null

  // Actions
  setContentType: (type: 'quest' | 'npc' | 'lore' | 'pack') => void
  setActiveTab: (tab: 'quest' | 'npc' | 'lore' | 'scripts' | 'tracking' | 'relationships' | 'suggestions' | 'collaboration' | 'playtest') => void

  addQuest: (quest: GeneratedQuest) => void
  addNPC: (npc: GeneratedNPC) => void
  addLore: (lore: LoreEntry) => void

  setSelectedQuest: (quest: GeneratedQuest | null) => void
  setSelectedNPC: (npc: GeneratedNPC | null) => void
  setSelectedLore: (lore: LoreEntry | null) => void

  deleteQuest: (id: string) => void
  deleteNPC: (id: string) => void
  deleteLore: (id: string) => void

  // Context selection
  setSelectedContext: (context: Partial<SelectedContext>) => void
  toggleContextItem: (type: keyof SelectedContext, id: string) => void
  clearContext: () => void
  buildAIContext: () => SelectedContext

  // Playtester personas
  loadPlaytesterPersonas: () => Promise<void>

  // Seed data
  loadSeedData: () => Promise<void>
  resetToSeedData: () => Promise<void>
  exportToJSON: () => void
  importFromJSON: (jsonData: string) => boolean
  clearCache: () => void

  createPack: (name: string, description: string) => ContentPack
  clearAll: () => void
}

export const useContentGenerationStore = create<ContentGenerationState>()(
  persist(
    (set, get) => ({
      // Initial state
      contentType: 'quest',
      quests: [],
      npcs: [],
      loreEntries: [],
      currentPack: null,
      selectedContext: {
        items: [],
        mobs: [],
        npcs: [],
        resources: [],
        lore: []
      },
      playtesterPersonas: null,
      activeTab: 'quest',
      selectedQuest: null,
      selectedNPC: null,
      selectedLore: null,
  
  // Actions
  setContentType: (type) => set({ contentType: type }),
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  addQuest: (quest) => set((state) => ({
    quests: [...state.quests, quest],
    selectedQuest: quest
  })),
  
  addNPC: (npc) => set((state) => ({
    npcs: [...state.npcs, npc],
    selectedNPC: npc
  })),
  
  addLore: (lore) => set((state) => ({
    loreEntries: [...state.loreEntries, lore],
    selectedLore: lore
  })),
  
  setSelectedQuest: (quest) => set({ selectedQuest: quest }),
  setSelectedNPC: (npc) => set({ selectedNPC: npc }),
  setSelectedLore: (lore) => set({ selectedLore: lore }),
  
  deleteQuest: (id) => set((state) => ({
    quests: state.quests.filter(q => q.id !== id),
    selectedQuest: state.selectedQuest?.id === id ? null : state.selectedQuest
  })),
  
  deleteNPC: (id) => set((state) => ({
    npcs: state.npcs.filter(n => n.id !== id),
    selectedNPC: state.selectedNPC?.id === id ? null : state.selectedNPC
  })),
  
  deleteLore: (id) => set((state) => ({
    loreEntries: state.loreEntries.filter(l => l.id !== id),
    selectedLore: state.selectedLore?.id === id ? null : state.selectedLore
  })),
  
  // Context selection
  setSelectedContext: (context) => set((state) => ({
    selectedContext: {
      ...state.selectedContext,
      ...context
    }
  })),
  
  toggleContextItem: (type, id) => set((state) => {
    const current = state.selectedContext[type]
    const newSelection = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]
    
    return {
      selectedContext: {
        ...state.selectedContext,
        [type]: newSelection
      }
    }
  }),
  
  clearContext: () => set({
    selectedContext: {
      items: [],
      mobs: [],
      npcs: [],
      resources: [],
      lore: []
    }
  }),

  buildAIContext: () => {
    return get().selectedContext
  },

  loadPlaytesterPersonas: async () => {
    try {
      const response = await fetch(API_ENDPOINTS.playtesterPersonas)
      if (!response.ok) {
        throw new Error(`Failed to load playtester personas: ${response.statusText}`)
      }
      const data = await response.json()
      set({ playtesterPersonas: data.personas })
    } catch (error) {
      logger.error('Failed to load playtester personas', { error: (error as Error).message })
      set({ playtesterPersonas: null })
    }
  },

  loadSeedData: async () => {
    try {
      logger.info('Loading seed content')
      const seedData = await loadSeedContent()

      set({
        quests: seedData.quests,
        npcs: seedData.npcs,
        loreEntries: seedData.lore
      })

      logger.info('Seed data loaded', {
        quests: seedData.quests.length,
        npcs: seedData.npcs.length,
        lore: seedData.lore.length
      })
    } catch (error) {
      logger.error('Failed to load seed data', { error: (error as Error).message })
    }
  },

  resetToSeedData: async () => {
    try {
      logger.info('Resetting to seed data')

      // Clear everything first
      set({
        quests: [],
        npcs: [],
        loreEntries: [],
        currentPack: null,
        selectedQuest: null,
        selectedNPC: null,
        selectedLore: null
      })

      // Load fresh seed data
      const seedData = await loadSeedContent()

      set({
        quests: seedData.quests,
        npcs: seedData.npcs,
        loreEntries: seedData.lore
      })

      logger.info('Reset to seed data complete')
    } catch (error) {
      logger.error('Failed to reset to seed data', { error: (error as Error).message })
    }
  },

  exportToJSON: () => {
    const state = get()
    const exportData = {
      quests: state.quests,
      npcs: state.npcs,
      loreEntries: state.loreEntries,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    logger.info('Content exported', {
      quests: exportData.quests.length,
      npcs: exportData.npcs.length,
      lore: exportData.loreEntries.length
    })
  },

  importFromJSON: (jsonData) => {
    try {
      const parsed = JSON.parse(jsonData)

      // Validate structure
      if (!parsed.quests || !parsed.npcs || !parsed.loreEntries) {
        logger.error('Invalid backup file: missing required fields')
        return false
      }

      // Validate arrays
      if (!Array.isArray(parsed.quests) || !Array.isArray(parsed.npcs) || !Array.isArray(parsed.loreEntries)) {
        logger.error('Invalid backup file: fields must be arrays')
        return false
      }

      // Import data
      set({
        quests: parsed.quests,
        npcs: parsed.npcs,
        loreEntries: parsed.loreEntries
      })

      logger.info('Content imported', {
        quests: parsed.quests.length,
        npcs: parsed.npcs.length,
        lore: parsed.loreEntries.length
      })
      return true
    } catch (error) {
      logger.error('Failed to import JSON', { error: (error as Error).message })
      return false
    }
  },

  clearCache: () => {
    // Clear localStorage
    try {
      localStorage.removeItem('content-generation-cache')
      logger.info('Cache cleared from localStorage')
    } catch (error) {
      logger.error('Failed to clear cache', { error: (error as Error).message })
    }

    // Reset store to empty state
    set({
      quests: [],
      npcs: [],
      loreEntries: [],
      currentPack: null,
      selectedQuest: null,
      selectedNPC: null,
      selectedLore: null,
      selectedContext: {
        items: [],
        mobs: [],
        npcs: [],
        resources: [],
        lore: []
      }
    })

    logger.info('Store reset to empty state')
  },

  createPack: (name, description) => {
    const { quests, npcs, loreEntries } = get()

    const pack: ContentPack = {
      id: `pack_${crypto.randomUUID()}`,
      name,
      version: '1.0.0',
      description,
      quests,
      npcs,
      lore: loreEntries,
      metadata: {
        createdAt: new Date().toISOString(),
        author: 'Asset Forge',
        manifestVersion: '1.0.0'
      }
    }

    set({ currentPack: pack })
    return pack
  },

  clearAll: () => set({
    quests: [],
    npcs: [],
    loreEntries: [],
    currentPack: null,
    selectedQuest: null,
    selectedNPC: null,
    selectedLore: null
  })
}),
    {
      name: 'content-generation-cache',
      version: 1,
      partialize: (state) => ({
        // Only persist content, not UI state
        quests: state.quests,
        npcs: state.npcs,
        loreEntries: state.loreEntries,
        selectedContext: state.selectedContext
      })
    }
  )
)
