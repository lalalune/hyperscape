/**
 * Voice Library Browser
 *
 * Browse and select voices from ElevenLabs voice library.
 *
 * Features:
 * - Grid view of available voices
 * - Filter by category
 * - Search by name
 * - Preview voice with sample text
 * - Select voice for NPC assignment
 *
 * Used by: VoiceGenerator component
 */

import React, { useState, useEffect } from 'react'
import { Play, Check, RotateCcw } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { Badge } from '../common/Badge'
import { useVoiceGenerationStore } from '../../store/useVoiceGenerationStore'
import { voiceGenerationService } from '../../services/VoiceGenerationService'
import type { ElevenLabsVoice } from '../../types/voice-generation'

interface VoiceLibraryBrowserProps {
  onSelect?: (voiceId: string, voiceName: string) => void
  selectedVoiceId?: string | null
}

export const VoiceLibraryBrowser: React.FC<VoiceLibraryBrowserProps> = ({
  onSelect,
  selectedVoiceId: externalSelectedVoiceId
}) => {
  const {
    availableVoices,
    voicesLoaded,
    voicesCachedAt,
    voicesLoading,
    fetchVoicesWithCache,
    clearVoiceCache,
    selectedVoiceId: storeSelectedVoiceId,
    setSelectedVoice
  } = useVoiceGenerationStore()

  const selectedVoiceId = externalSelectedVoiceId !== undefined ? externalSelectedVoiceId : storeSelectedVoiceId

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)

  const loadVoicesFromAPI = useCallback(async () => {
    setError(null)
    try {
      await fetchVoicesWithCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voices')
    }
  }, [fetchVoicesWithCache])

  // Load voices on mount with caching
  useEffect(() => {
    if (!voicesLoaded && !voicesLoading) {
      loadVoicesFromAPI()
    }
  }, [voicesLoaded, voicesLoading, loadVoicesFromAPI])

  const handleRefreshVoices = async () => {
    setError(null)
    try {
      await clearVoiceCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh voices')
    }
  }

  // Calculate cache age for display
  const getCacheAgeString = () => {
    if (!voicesCachedAt) return null
    const ageSeconds = Math.floor((Date.now() - voicesCachedAt) / 1000)
    if (ageSeconds < 60) return `${ageSeconds}s ago`
    const ageMinutes = Math.floor(ageSeconds / 60)
    if (ageMinutes < 60) return `${ageMinutes}m ago`
    const ageHours = Math.floor(ageMinutes / 60)
    return `${ageHours}h ago`
  }

  const handlePreviewVoice = async (voice: ElevenLabsVoice) => {
    if (playingVoiceId === voice.voiceId) {
      return // Already playing
    }

    setPlayingVoiceId(voice.voiceId)

    try {
      const audioBlob = await voiceGenerationService.generateVoiceClip({
        text: 'Hello, traveler! How can I assist you today?',
        voiceId: voice.voiceId,
        modelId: 'eleven_multilingual_v2'
      })

      const audio = voiceGenerationService.playAudioPreview(audioBlob)
      audio.addEventListener('ended', () => {
        setPlayingVoiceId(null)
      })
    } catch (err) {
      console.error('Error previewing voice:', err)
      setPlayingVoiceId(null)
    }
  }

  const handleSelectVoice = (voice: ElevenLabsVoice) => {
    setSelectedVoice(voice.voiceId)
    if (onSelect) {
      onSelect(voice.voiceId, voice.name)
    }
  }

  // Get unique categories
  const categories = ['all', ...new Set(availableVoices.map(v => v.category).filter(Boolean))]

  // Filter voices
  const filteredVoices = availableVoices.filter(voice => {
    const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         voice.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || voice.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  if (voicesLoading && !voicesLoaded) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-400">Loading voice library...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="p-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={loadVoicesFromAPI}>Retry</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cache Status and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400">
            {filteredVoices.length} voices available
          </p>
          {voicesCachedAt && (
            <Badge variant="secondary" className="text-xs">
              Cached {getCacheAgeString()}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefreshVoices}
          disabled={voicesLoading}
          title="Refresh voice library"
        >
          <RotateCcw className={`w-4 h-4 ${voicesLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <Input
          placeholder="Search voices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVoices.map(voice => (
          <Card
            key={voice.voiceId}
            variant="interactive"
            selected={selectedVoiceId === voice.voiceId}
            className="cursor-pointer"
            onClick={() => handleSelectVoice(voice)}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-1">{voice.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {voice.category}
                  </Badge>
                </div>
                {selectedVoiceId === voice.voiceId && (
                  <Check className="w-5 h-5 text-green-400" />
                )}
              </div>

              {voice.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                  {voice.description}
                </p>
              )}

              {voice.labels && Object.keys(voice.labels).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(voice.labels).slice(0, 3).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {value}
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePreviewVoice(voice)
                }}
                disabled={playingVoiceId !== null}
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                {playingVoiceId === voice.voiceId ? 'Playing...' : 'Preview'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredVoices.length === 0 && (
        <Card>
          <div className="p-8 text-center text-gray-400">
            No voices found matching your search.
          </div>
        </Card>
      )}

      <div className="text-sm text-gray-400 text-center">
        Showing {filteredVoices.length} of {availableVoices.length} voices
      </div>
    </div>
  )
}
