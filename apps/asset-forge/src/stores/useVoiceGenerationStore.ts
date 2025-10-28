/**
 * Voice Generation Store
 *
 * Manages state for ElevenLabs voice generation system.
 *
 * Features:
 * - Browse and select voices from library
 * - Assign voices to NPCs
 * - Track voice generation progress
 * - Manage generated voice clips
 *
 * Used by: VoiceGenerator, VoiceLibraryBrowser, NPCScriptBuilder
 */

import { create } from 'zustand'
import { temporal } from 'zundo'

import { voiceGenerationService } from '../services/VoiceGenerationService'
import type {
  ElevenLabsVoice,
  NPCVoiceConfig,
  VoiceSettings,
  VoiceClip,
  VoiceCacheEntry
} from '../types/voice-generation'
import { VOICE_CACHE_TTL, VOICE_CACHE_KEY } from '../types/voice-generation'
import { createLogger } from '../utils/logger'

const logger = createLogger('VoiceGenerationStore')

interface VoiceAssignment {
  npcId: string
  voiceId: string
  voiceName: string
}

interface VoiceGenerationState {
  // Available voices from ElevenLabs library
  availableVoices: ElevenLabsVoice[]
  voicesLoaded: boolean
  voicesCachedAt: number | null
  voicesLoading: boolean

  // NPC voice assignments
  npcVoices: Map<string, NPCVoiceConfig> // npcId -> config

  // Generation state
  isGenerating: boolean
  generationProgress: {
    current: number
    total: number
    npcId?: string
  }
  generationError: string | null

  // Selected voice for preview/assignment
  selectedVoiceId: string | null

  // Voice settings (UI state)
  currentSettings: VoiceSettings

  // Actions
  loadVoices: (voices: ElevenLabsVoice[], fromCache?: boolean) => void
  fetchVoicesWithCache: () => Promise<void>
  clearVoiceCache: () => Promise<void>
  setSelectedVoice: (voiceId: string | null) => void
  setCurrentSettings: (settings: Partial<VoiceSettings>) => void

  assignVoiceToNPC: (npcId: string, voiceId: string, voiceName: string) => void
  unassignVoiceFromNPC: (npcId: string) => void

  setGenerating: (generating: boolean) => void
  setGenerationProgress: (current: number, total: number, npcId?: string) => void
  setGenerationError: (error: string | null) => void

  updateNPCVoiceConfig: (npcId: string, config: Partial<NPCVoiceConfig>) => void
  addVoiceClip: (npcId: string, nodeId: string, clip: VoiceClip) => void
  removeVoiceClip: (npcId: string, nodeId: string) => void

  getNPCVoiceConfig: (npcId: string) => NPCVoiceConfig | undefined
  clearAll: () => void

  // Voice assignment persistence
  saveVoiceAssignments: (manifestId: string, assignments: VoiceAssignment[], name?: string, description?: string) => Promise<void>
  loadVoiceAssignments: (manifestId: string) => Promise<VoiceAssignment[]>
}

export const useVoiceGenerationStore = create<VoiceGenerationState>()(
  temporal(
    (set, get) => ({
  // Initial state
  availableVoices: [],
  voicesLoaded: false,
  voicesCachedAt: null,
  voicesLoading: false,
  npcVoices: new Map(),
  isGenerating: false,
  generationProgress: {
    current: 0,
    total: 0
  },
  generationError: null,
  selectedVoiceId: null,
  currentSettings: {
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true
  },

  // Actions
  loadVoices: (voices, fromCache = false) => set({
    availableVoices: voices,
    voicesLoaded: true,
    voicesLoading: false,
    voicesCachedAt: fromCache ? get().voicesCachedAt : Date.now()
  }),

  fetchVoicesWithCache: async () => {
    // Check cache first
    try {
      const cached = localStorage.getItem(VOICE_CACHE_KEY)
      if (cached) {
        const entry: VoiceCacheEntry = JSON.parse(cached)
        if (Date.now() < entry.expiresAt) {
          logger.info('Using cached voices', { age: Math.floor((Date.now() - entry.cachedAt) / 1000) })
          set({
            availableVoices: entry.voices,
            voicesLoaded: true,
            voicesCachedAt: entry.cachedAt,
            voicesLoading: false
          })
          return
        } else {
          logger.info('Cache expired, fetching fresh voices')
        }
      }
    } catch (error) {
      logger.error('Error reading cache', { error: (error as Error).message })
    }

    // Fetch fresh data
    set({ voicesLoading: true })
    try {
      const voices = await voiceGenerationService.getVoiceLibrary()

      // Cache result
      const cacheEntry: VoiceCacheEntry = {
        voices,
        cachedAt: Date.now(),
        expiresAt: Date.now() + VOICE_CACHE_TTL
      }
      localStorage.setItem(VOICE_CACHE_KEY, JSON.stringify(cacheEntry))
      logger.info('Cached voices', { count: voices.length, ttl: '15 minutes' })

      set({
        availableVoices: voices,
        voicesLoaded: true,
        voicesCachedAt: Date.now(),
        voicesLoading: false
      })
    } catch (error) {
      logger.error('Error fetching voices', { error: (error as Error).message })
      set({ voicesLoading: false })
      throw error
    }
  },

  clearVoiceCache: async () => {
    logger.info('Clearing cache and fetching fresh voices')
    localStorage.removeItem(VOICE_CACHE_KEY)
    set({ voicesCachedAt: null })
    await get().fetchVoicesWithCache()
  },

  setSelectedVoice: (voiceId) => set({
    selectedVoiceId: voiceId
  }),

  setCurrentSettings: (settings) => set((state) => ({
    currentSettings: {
      ...state.currentSettings,
      ...settings
    }
  })),

  assignVoiceToNPC: (npcId, voiceId, voiceName) => set((state) => {
    const newNpcVoices = new Map(state.npcVoices)
    newNpcVoices.set(npcId, {
      npcId,
      voiceId,
      voiceName,
      settings: state.currentSettings,
      clips: {},
      totalClips: 0,
      generatedAt: new Date().toISOString()
    })
    return { npcVoices: newNpcVoices }
  }),

  unassignVoiceFromNPC: (npcId) => set((state) => {
    const newNpcVoices = new Map(state.npcVoices)
    newNpcVoices.delete(npcId)
    return { npcVoices: newNpcVoices }
  }),

  setGenerating: (generating) => set({
    isGenerating: generating
  }),

  setGenerationProgress: (current, total, npcId) => set({
    generationProgress: {
      current,
      total,
      npcId
    }
  }),

  setGenerationError: (error) => set({
    generationError: error
  }),

  updateNPCVoiceConfig: (npcId, configUpdate) => set((state) => {
    const newNpcVoices = new Map(state.npcVoices)
    const existing = newNpcVoices.get(npcId)

    if (existing) {
      newNpcVoices.set(npcId, {
        ...existing,
        ...configUpdate,
        clips: configUpdate.clips || existing.clips
      })
    }

    return { npcVoices: newNpcVoices }
  }),

  addVoiceClip: (npcId, nodeId, clip) => set((state) => {
    const newNpcVoices = new Map(state.npcVoices)
    const existing = newNpcVoices.get(npcId)

    if (existing) {
      const newClips = { ...existing.clips, [nodeId]: clip }
      newNpcVoices.set(npcId, {
        ...existing,
        clips: newClips,
        totalClips: Object.keys(newClips).length
      })
    }

    return { npcVoices: newNpcVoices }
  }),

  removeVoiceClip: (npcId, nodeId) => set((state) => {
    const newNpcVoices = new Map(state.npcVoices)
    const existing = newNpcVoices.get(npcId)

    if (existing) {
      const newClips = { ...existing.clips }
      delete newClips[nodeId]
      newNpcVoices.set(npcId, {
        ...existing,
        clips: newClips,
        totalClips: Object.keys(newClips).length
      })
    }

    return { npcVoices: newNpcVoices }
  }),

  getNPCVoiceConfig: (npcId) => {
    return get().npcVoices.get(npcId)
  },

  clearAll: () => set({
    npcVoices: new Map(),
    isGenerating: false,
    generationProgress: {
      current: 0,
      total: 0
    },
    generationError: null,
    selectedVoiceId: null,
    currentSettings: {
      modelId: 'eleven_multilingual_v2',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: true
    }
  }),

  saveVoiceAssignments: async (manifestId, assignments, name, description) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3004'

    try {
      logger.info('Saving voice assignments', { manifestId, count: assignments.length })

      const response = await fetch(`${apiUrl}/api/voice-assignments/${manifestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          assignments
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save voice assignments')
      }

      const result = await response.json()
      logger.info('Voice assignments saved successfully', { manifestId, version: result.version })
    } catch (error) {
      logger.error('Failed to save voice assignments', { error: (error as Error).message })
      throw error
    }
  },

  loadVoiceAssignments: async (manifestId) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3004'

    try {
      logger.info('Loading voice assignments', { manifestId })

      const response = await fetch(`${apiUrl}/api/voice-assignments/${manifestId}`)

      if (response.status === 404) {
        logger.info('No voice assignments found for manifest', { manifestId })
        return []
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to load voice assignments')
      }

      const result = await response.json()
      logger.info('Voice assignments loaded successfully', { manifestId, count: result.assignments.length })

      return result.assignments
    } catch (error) {
      logger.error('Failed to load voice assignments', { error: (error as Error).message })
      throw error
    }
  }
    }),
    {
      limit: 100,
      partialize: (state) => {
        // Exclude loading/progress/error states from history
        // Track only NPC voice assignments and settings
        const {
          voicesLoading,
          isGenerating,
          generationProgress,
          generationError,
          selectedVoiceId,
          availableVoices,
          voicesLoaded,
          voicesCachedAt,
          ...rest
        } = state
        return rest
      }
    }
  )
)
