/**
 * Voice Browser Component - Matches App Design System
 *
 * Voice library browser with filtering and search
 */

import { Search, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'

import { voiceGenerationService } from '../../services/VoiceGenerationService'
import { useVoiceGenerationStore } from '../../store/useVoiceGenerationStore'
import type { ElevenLabsVoice } from '../../types/voice-generation'

import { VoiceCard } from './VoiceCard'

interface VoiceBrowserProps {
  onSelect: (voiceId: string, voiceName: string) => void
  selectedVoiceId: string | null
  useStore?: boolean
}

interface VoiceFilters {
  search: string
  gender: string
  accent: string
  age: string
  useCase: string
}

export const VoiceBrowser: React.FC<VoiceBrowserProps> = ({
  onSelect,
  selectedVoiceId,
  useStore = false
}) => {
  const store = useStore ? useVoiceGenerationStore() : null

  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const [filters, setFilters] = useState<VoiceFilters>({
    search: '',
    gender: 'all',
    accent: 'all',
    age: 'all',
    useCase: 'all'
  })

  // Define loadVoices before useEffect that uses it
  const loadVoices = useCallback(async () => {
    // Only load voices directly when NOT using store
    // When using store, fetchVoicesWithCache is called from the useEffect
    setLoading(true)
    setError(null)
    try {
      const voiceList = await voiceGenerationService.getVoiceLibrary()
      setVoices(voiceList)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load voices'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load voices on mount
  useEffect(() => {
    if (useStore && store) {
      if (!store.voicesLoaded && !store.voicesLoading) {
        store.fetchVoicesWithCache()
      }
    } else {
      loadVoices()
    }
  }, [useStore, store, loadVoices])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [])

  const handleRefreshVoices = async () => {
    if (useStore && store) {
      await store.clearVoiceCache()
    } else {
      await loadVoices()
    }
  }

  // Sync voices from store
  useEffect(() => {
    if (useStore && store) {
      setVoices(store.availableVoices)
      setLoading(store.voicesLoading)
    }
  }, [useStore, store])

  const handlePlayPreview = useCallback(async (voice: ElevenLabsVoice) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
      setPlayingVoiceId(null)
    }

    const voiceId = voice.voiceId

    if (playingVoiceId === voiceId) {
      return
    }

    setPlayingVoiceId(voiceId)

    try {
      // Always generate dynamic previews for better reliability
      // ElevenLabs preview URLs may have CORS restrictions or be unavailable
      const audioBlob = await voiceGenerationService.generateVoiceClip({
        text: 'Greetings, brave adventurer! I have a quest that requires someone of your caliber. The ancient ruins hold secrets that must be uncovered. Will you aid me in this perilous journey?',
        voiceId: voiceId,
        modelId: 'eleven_turbo_v2_5',
        stability: 0.5,
        similarityBoost: 0.75
      })

      const audio = voiceGenerationService.playAudioPreview(audioBlob)
      currentAudioRef.current = audio

      audio.addEventListener('ended', () => {
        setPlayingVoiceId(null)
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null
        }
      })
    } catch (error) {
      console.error('[VoiceBrowser] Error playing preview:', error)
      setPlayingVoiceId(null)
    }
  }, [playingVoiceId])

  // Extract unique filter options from voices
  const filterOptions = useMemo(() => {
    const genders = new Set<string>()
    const accents = new Set<string>()
    const ages = new Set<string>()
    const useCases = new Set<string>()

    voices.forEach(voice => {
      if (voice.labels) {
        if (voice.labels.gender) genders.add(voice.labels.gender)
        if (voice.labels.accent) accents.add(voice.labels.accent)
        if (voice.labels.age) ages.add(voice.labels.age)
        if (voice.labels.use_case) useCases.add(voice.labels.use_case)
      }
    })

    return {
      genders: Array.from(genders).sort(),
      accents: Array.from(accents).sort(),
      ages: Array.from(ages).sort(),
      useCases: Array.from(useCases).sort()
    }
  }, [voices])

  // Filtered voices
  const filteredVoices = useMemo(() => {
    return voices.filter(voice => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const nameMatch = voice.name.toLowerCase().includes(searchLower)
        const descMatch = voice.description?.toLowerCase().includes(searchLower)
        if (!nameMatch && !descMatch) return false
      }

      if (filters.gender !== 'all' && voice.labels?.gender !== filters.gender) {
        return false
      }

      if (filters.accent !== 'all' && voice.labels?.accent !== filters.accent) {
        return false
      }

      if (filters.age !== 'all' && voice.labels?.age !== filters.age) {
        return false
      }

      if (filters.useCase !== 'all' && voice.labels?.use_case !== filters.useCase) {
        return false
      }

      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [voices, filters])

  const handleVoiceSelect = useCallback((voice: ElevenLabsVoice) => {
    onSelect(voice.voiceId, voice.name)
  }, [onSelect])

  const updateFilter = useCallback((key: keyof VoiceFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      gender: 'all',
      accent: 'all',
      age: 'all',
      useCase: 'all'
    })
  }, [])

  const getCacheAgeString = (cachedAt: number) => {
    const ageSeconds = Math.floor((Date.now() - cachedAt) / 1000)
    if (ageSeconds < 60) return `${ageSeconds}s ago`
    const ageMinutes = Math.floor(ageSeconds / 60)
    if (ageMinutes < 60) return `${ageMinutes}m ago`
    const ageHours = Math.floor(ageMinutes / 60)
    return `${ageHours}h ago`
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 rounded-lg bg-[var(--bg-secondary)]">
        <div className="text-center">
          <Loader2 className="inline-block animate-spin h-12 w-12 text-[var(--color-primary)]" />
          <p className="mt-4 text-[var(--text-primary)] font-medium">Loading voice library...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-12 rounded-lg bg-[var(--bg-secondary)]">
        <div className="text-center max-w-md">
          <AlertCircle className="inline-block h-12 w-12 text-[var(--color-error)] mb-4" />
          <p className="text-[var(--color-error)] font-semibold mb-4">{error}</p>
          <button onClick={loadVoices} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          placeholder="Search voices by name or description..."
          className="input w-full pl-10"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <select
          value={filters.gender}
          onChange={(e) => updateFilter('gender', e.target.value)}
          className="input"
        >
          <option value="all">All Genders</option>
          {filterOptions.genders.map(gender => (
            <option key={gender} value={gender}>{gender}</option>
          ))}
        </select>

        <select
          value={filters.accent}
          onChange={(e) => updateFilter('accent', e.target.value)}
          className="input"
        >
          <option value="all">All Accents</option>
          {filterOptions.accents.map(accent => (
            <option key={accent} value={accent}>{accent}</option>
          ))}
        </select>

        <select
          value={filters.age}
          onChange={(e) => updateFilter('age', e.target.value)}
          className="input"
        >
          <option value="all">All Ages</option>
          {filterOptions.ages.map(age => (
            <option key={age} value={age}>{age}</option>
          ))}
        </select>

        <select
          value={filters.useCase}
          onChange={(e) => updateFilter('useCase', e.target.value)}
          className="input"
        >
          <option value="all">All Use Cases</option>
          {filterOptions.useCases.map(useCase => (
            <option key={useCase} value={useCase}>{useCase}</option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">
          {filteredVoices.length} {filteredVoices.length === 1 ? 'voice' : 'voices'} found
        </span>
        {useStore && store?.voicesCachedAt && (
          <div className="flex items-center gap-2">
            <span className="badge-primary">
              Cached {getCacheAgeString(store.voicesCachedAt)}
            </span>
            <button
              onClick={handleRefreshVoices}
              disabled={loading}
              className="icon-btn"
              title="Refresh voices"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Voice Grid */}
      {filteredVoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVoices.map(voice => {
            const isSelected = voice.voiceId === selectedVoiceId
            const isPlaying = playingVoiceId === voice.voiceId

            return (
              <VoiceCard
                key={voice.voiceId}
                voice={voice}
                isSelected={isSelected}
                isPlaying={isPlaying}
                onSelect={() => handleVoiceSelect(voice)}
                onPlayPreview={() => handlePlayPreview(voice)}
              />
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 card">
          <p className="text-[var(--text-secondary)] mb-4">No voices match your filters</p>
          <button onClick={clearFilters} className="btn-secondary">
            Clear Filters
          </button>
        </div>
      )}
    </div>
  )
}
