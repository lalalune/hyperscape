/**
 * Voice Presets Store
 *
 * Manages voice settings presets for quick access to common configurations.
 *
 * Features:
 * - Built-in presets (Dialogue, Narration, etc.)
 * - Custom user presets
 * - Save/load/delete presets
 * - Apply presets to current settings
 */

import { create } from 'zustand'

import type { VoiceSettings } from '../types/voice-generation'
import { createLogger } from '../utils/logger'

const logger = createLogger('VoicePresetsStore')

export interface VoicePreset {
  id: string
  name: string
  description: string
  settings: VoiceSettings
  isBuiltIn: boolean
  createdAt: string
}

interface VoicePresetsState {
  presets: VoicePreset[]
  selectedPresetId: string | null

  // Actions
  loadPresets: () => void
  savePreset: (name: string, description: string, settings: VoiceSettings) => void
  deletePreset: (id: string) => void
  selectPreset: (id: string | null) => void
  getPreset: (id: string) => VoicePreset | undefined
}

const PRESETS_STORAGE_KEY = 'voice-presets'

// Built-in presets
const BUILT_IN_PRESETS: VoicePreset[] = [
  {
    id: 'dialogue',
    name: 'Dialogue',
    description: 'Natural conversational dialogue for NPCs',
    settings: {
      modelId: 'eleven_multilingual_v2',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.3,
      useSpeakerBoost: true
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'narration',
    name: 'Narration',
    description: 'Smooth narration for storytelling and lore',
    settings: {
      modelId: 'eleven_multilingual_v2',
      stability: 0.7,
      similarityBoost: 0.8,
      style: 0.1,
      useSpeakerBoost: true
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'character-acting',
    name: 'Character Acting',
    description: 'Expressive and emotional for dramatic characters',
    settings: {
      modelId: 'eleven_multilingual_v2',
      stability: 0.3,
      similarityBoost: 0.6,
      style: 0.7,
      useSpeakerBoost: true
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'news-reading',
    name: 'News Reading',
    description: 'Clear and authoritative for announcements',
    settings: {
      modelId: 'eleven_multilingual_v2',
      stability: 0.8,
      similarityBoost: 0.85,
      style: 0,
      useSpeakerBoost: true
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'fast-draft',
    name: 'Fast Draft',
    description: 'Quick generation for testing (Turbo model)',
    settings: {
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.2,
      useSpeakerBoost: true
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z'
  }
]

export const useVoicePresetsStore = create<VoicePresetsState>((set, get) => ({
  presets: BUILT_IN_PRESETS,
  selectedPresetId: null,

  loadPresets: () => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY)
      if (stored) {
        const customPresets: VoicePreset[] = JSON.parse(stored)
        set({ presets: [...BUILT_IN_PRESETS, ...customPresets] })
      }
    } catch (error) {
      logger.error('Error loading presets', { error: (error as Error).message })
    }
  },

  savePreset: (name, description, settings) => {
    const newPreset: VoicePreset = {
      id: `custom-${Date.now()}`,
      name,
      description,
      settings,
      isBuiltIn: false,
      createdAt: new Date().toISOString()
    }

    const customPresets = get().presets.filter(p => !p.isBuiltIn)
    customPresets.push(newPreset)

    // Save to localStorage
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets))

    // Update state
    set({ presets: [...BUILT_IN_PRESETS, ...customPresets] })
  },

  deletePreset: (id) => {
    const preset = get().presets.find(p => p.id === id)
    if (preset?.isBuiltIn) {
      logger.warn('Cannot delete built-in preset')
      return
    }

    const customPresets = get().presets.filter(p => !p.isBuiltIn && p.id !== id)

    // Save to localStorage
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets))

    // Update state
    set({
      presets: [...BUILT_IN_PRESETS, ...customPresets],
      selectedPresetId: get().selectedPresetId === id ? null : get().selectedPresetId
    })
  },

  selectPreset: (id) => set({ selectedPresetId: id }),

  getPreset: (id) => get().presets.find(p => p.id === id)
}))
