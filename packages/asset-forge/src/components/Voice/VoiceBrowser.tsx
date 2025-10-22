/**
 * Voice Browser Component
 *
 * Advanced voice library browser with filtering, search, and preview.
 * Enhances the basic VoiceLibraryBrowser with more features.
 *
 * Features:
 * - Search by name/description
 * - Filter by gender, age, accent, use case
 * - Sort by name, popularity
 * - Voice preview samples
 * - Favorite voices
 * - Grid/list view toggle
 *
 * Performance optimizations:
 * - Memoized filter options
 * - Memoized filtered results
 * - Proper cleanup of audio resources
 * - Debounced search (optional)
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Search, Heart, Play, Check, Grid3x3, List, Star, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import type { ElevenLabsVoice } from '../../types/voice-generation'
import { voiceGenerationService } from '../../services/VoiceGenerationService'

interface VoiceBrowserProps {
  onSelect: (voiceId: string, voiceName: string) => void
  selectedVoiceId: string | null
  showFavorites?: boolean
  initialViewMode?: 'grid' | 'list'
}

type ViewMode = 'grid' | 'list'

interface VoiceFilters {
  search: string
  gender: string
  accent: string
  age: string
  useCase: string
}

const FAVORITE_VOICES_KEY = 'voice-favorites'

export const VoiceBrowser: React.FC<VoiceBrowserProps> = ({
  onSelect,
  selectedVoiceId,
  showFavorites = true,
  initialViewMode = 'grid'
}) => {
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const [filters, setFilters] = useState<VoiceFilters>({
    search: '',
    gender: 'all',
    accent: 'all',
    age: 'all',
    useCase: 'all'
  })

  // Load voices on mount
  useEffect(() => {
    loadVoices()
  }, [])

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITE_VOICES_KEY)
      if (stored) {
        const favArray = JSON.parse(stored)
        if (Array.isArray(favArray)) {
          setFavorites(new Set(favArray))
        }
      }
    } catch (error) {
      console.error('[VoiceBrowser] Error loading favorites:', error)
    }
  }, [])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [])

  const loadVoices = async () => {
    setLoading(true)
    setError(null)
    try {
      const voiceList = await voiceGenerationService.getVoiceLibrary()
      setVoices(voiceList)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load voices'
      setError(errorMessage)
      console.error('[VoiceBrowser] Error loading voices:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = useCallback((voiceId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(voiceId)) {
        newFavorites.delete(voiceId)
      } else {
        newFavorites.add(voiceId)
      }

      // Persist to localStorage
      try {
        localStorage.setItem(FAVORITE_VOICES_KEY, JSON.stringify(Array.from(newFavorites)))
      } catch (error) {
        console.error('[VoiceBrowser] Error saving favorites:', error)
      }

      return newFavorites
    })
  }, [])

  const handlePlayPreview = useCallback(async (voice: ElevenLabsVoice) => {
    // Stop current audio if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
      setPlayingVoiceId(null)
    }

    // If clicking the same voice, just stop
    if (playingVoiceId === voice.voice_id) {
      return
    }

    if (!voice.preview_url) {
      console.warn('[VoiceBrowser] No preview URL available for voice:', voice.name)
      return
    }

    setPlayingVoiceId(voice.voice_id)

    try {
      const audio = new Audio(voice.preview_url)

      // Setup event handlers for cleanup
      const cleanup = () => {
        setPlayingVoiceId(null)
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null
        }
      }

      audio.addEventListener('ended', cleanup)
      audio.addEventListener('error', cleanup)

      await audio.play()
      currentAudioRef.current = audio
    } catch (error) {
      console.error('[VoiceBrowser] Error playing preview:', error)
      setPlayingVoiceId(null)
    }
  }, [playingVoiceId])

  // Extract unique filter options from voices (memoized)
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

  // Filtered and sorted voices (memoized)
  const filteredVoices = useMemo(() => {
    return voices.filter(voice => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const nameMatch = voice.name.toLowerCase().includes(searchLower)
        const descMatch = voice.description?.toLowerCase().includes(searchLower)
        if (!nameMatch && !descMatch) return false
      }

      // Gender filter
      if (filters.gender !== 'all' && voice.labels?.gender !== filters.gender) {
        return false
      }

      // Accent filter
      if (filters.accent !== 'all' && voice.labels?.accent !== filters.accent) {
        return false
      }

      // Age filter
      if (filters.age !== 'all' && voice.labels?.age !== filters.age) {
        return false
      }

      // Use case filter
      if (filters.useCase !== 'all' && voice.labels?.use_case !== filters.useCase) {
        return false
      }

      return true
    }).sort((a, b) => {
      // Sort favorites first
      const aFav = favorites.has(a.voice_id)
      const bFav = favorites.has(b.voice_id)
      if (aFav && !bFav) return -1
      if (!aFav && bFav) return 1

      // Then alphabetically
      return a.name.localeCompare(b.name)
    })
  }, [voices, filters, favorites])

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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="inline-block animate-spin h-12 w-12 text-purple-500" />
          <p className="mt-4 text-gray-400">Loading voice library...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center max-w-md">
          <AlertCircle className="inline-block h-12 w-12 text-red-400 mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={loadVoices} variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search voices by name or description..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
            aria-label="Search voices"
          />
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={filters.gender}
            onChange={(e) => updateFilter('gender', e.target.value)}
            className="input"
            aria-label="Filter by gender"
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
            aria-label="Filter by accent"
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
            aria-label="Filter by age"
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
            aria-label="Filter by use case"
          >
            <option value="all">All Use Cases</option>
            {filterOptions.useCases.map(useCase => (
              <option key={useCase} value={useCase}>{useCase}</option>
            ))}
          </select>
        </div>

        {/* View Toggle and Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {filteredVoices.length} {filteredVoices.length === 1 ? 'voice' : 'voices'} found
            {voices.length > filteredVoices.length && (
              <span className="ml-2 text-gray-500">
                (filtered from {voices.length})
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Voice List */}
      {filteredVoices.length > 0 ? (
        <div className={`
          ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}
        `}>
          {filteredVoices.map(voice => {
            const isSelected = voice.voice_id === selectedVoiceId
            const isFavorite = favorites.has(voice.voice_id)
            const isPlaying = playingVoiceId === voice.voice_id

            return (
              <div
                key={voice.voice_id}
                className={`
                  p-4 rounded-lg border transition-all cursor-pointer
                  ${isSelected
                    ? 'bg-purple-900 bg-opacity-20 border-purple-500 shadow-lg'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:shadow-md'
                  }
                `}
                onClick={() => onSelect(voice.voice_id, voice.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(voice.voice_id, voice.name)
                  }
                }}
                aria-label={`Select voice ${voice.name}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate flex items-center gap-2">
                      {voice.name}
                      {isSelected && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" aria-label="Selected" />}
                      {isFavorite && <Star className="w-4 h-4 text-yellow-400 flex-shrink-0 fill-current" aria-label="Favorite" />}
                    </h4>
                    {voice.description && (
                      <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                        {voice.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Labels */}
                {voice.labels && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {voice.labels.gender && (
                      <Badge variant="secondary" size="sm">{voice.labels.gender}</Badge>
                    )}
                    {voice.labels.age && (
                      <Badge variant="secondary" size="sm">{voice.labels.age}</Badge>
                    )}
                    {voice.labels.accent && (
                      <Badge variant="secondary" size="sm">{voice.labels.accent}</Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {voice.preview_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlayPreview(voice)
                      }}
                      className={isPlaying ? 'text-green-400' : ''}
                      aria-label={isPlaying ? 'Playing preview' : 'Play preview'}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      {isPlaying ? 'Playing...' : 'Preview'}
                    </Button>
                  )}
                  {showFavorites && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(voice.voice_id)
                      }}
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current text-red-400' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No voices match your filters</p>
          <Button onClick={clearFilters} variant="secondary">
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}
