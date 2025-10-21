/**
 * Content Generation Store
 * Manages state for quest, NPC, and lore generation
 */

import { create } from 'zustand'
import type { GeneratedQuest, GeneratedNPC, LoreEntry, ContentPack } from '../types/content-generation'

interface SelectedContext {
  items: string[]
  mobs: string[]
  npcs: string[]
  resources: string[]
  lore: string[]
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

  createPack: (name: string, description: string) => ContentPack
  clearAll: () => void
}

export const useContentGenerationStore = create<ContentGenerationState>((set, get) => ({
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
}))

