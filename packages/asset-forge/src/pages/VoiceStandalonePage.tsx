/**
 * Voice Standalone Page
 *
 * Dedicated page for voice experimentation and testing.
 * Allows users to generate voice clips without NPCs or dialogue trees.
 *
 * Features:
 * - Text input with character counter and validation
 * - Voice browser with advanced filtering
 * - Settings presets for quick configuration
 * - Instant preview and download
 * - Real-time cost estimation
 * - Subscription quota tracking
 *
 * Performance:
 * - Memoized cost calculations
 * - Proper audio cleanup
 * - Optimized re-renders
 */

import { Mic, Play, Download, Sparkles, DollarSign, Settings as SettingsIcon, Volume2, Info } from 'lucide-react'
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'

import { SubscriptionWidget } from '../components/Voice/SubscriptionWidget'
import { VoiceBrowser } from '../components/Voice/VoiceBrowser'
import { VoicePresets } from '../components/Voice/VoicePresets'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card, CardHeader, CardContent } from '../components/common/Card'
import { RangeInput } from '../components/common/RangeInput'
import { voiceGenerationService } from '../services/VoiceGenerationService'
import { useVoiceGenerationStore } from '../store/useVoiceGenerationStore'

const MAX_CHARACTERS = 5000 // ElevenLabs limit per request
const WARNING_THRESHOLD = 4500 // Show warning at 90%

export const VoiceStandalonePage: React.FC = () => {
  // Selective subscriptions for performance
  const selectedVoiceId = useVoiceGenerationStore(state => state.selectedVoiceId)
  const currentSettings = useVoiceGenerationStore(state => state.currentSettings)
  const setSelectedVoice = useVoiceGenerationStore(state => state.setSelectedVoice)
  const setCurrentSettings = useVoiceGenerationStore(state => state.setCurrentSettings)
  const isGenerating = useVoiceGenerationStore(state => state.isGenerating)
  const setGenerating = useVoiceGenerationStore(state => state.setGenerating)
  const generationError = useVoiceGenerationStore(state => state.generationError)
  const setGenerationError = useVoiceGenerationStore(state => state.setGenerationError)

  const [inputText, setInputText] = useState('')
  const [debouncedText, setDebouncedText] = useState('')
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('')
  const [showVoiceLibrary, setShowVoiceLibrary] = useState(false)
  const [generatedAudio, setGeneratedAudio] = useState<Blob | null>(null)
  const [costEstimate, setCostEstimate] = useState<{ characterCount: number; cost: string } | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Debounce text for expensive operations (character count, cost calc)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(inputText)
    }, 100) // Short debounce for UI updates

    return () => clearTimeout(timer)
  }, [inputText])

  // Calculate cost estimate when debounced text or model changes
  useEffect(() => {
    if (debouncedText.length === 0) {
      setCostEstimate(null)
      return
    }

    voiceGenerationService.estimateCost(debouncedText.length, currentSettings.modelId)
      .then(estimate => {
        setCostEstimate({
          characterCount: estimate.characterCount,
          cost: estimate.estimatedCostUSD
        })
      })
      .catch(err => console.error('[VoiceStandalonePage] Cost estimation failed:', err))
  }, [debouncedText, currentSettings.modelId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleVoiceSelect = useCallback((voiceId: string, voiceName: string) => {
    setSelectedVoice(voiceId)
    setSelectedVoiceName(voiceName)
    setShowVoiceLibrary(false)
  }, [setSelectedVoice])

  const handleGenerate = useCallback(async () => {
    if (!selectedVoiceId || !inputText.trim()) {
      setGenerationError('Please select a voice and enter text')
      return
    }

    if (inputText.length > MAX_CHARACTERS) {
      setGenerationError(`Text exceeds maximum length of ${MAX_CHARACTERS} characters`)
      return
    }

    setGenerating(true)
    setGenerationError(null)
    setGeneratedAudio(null)

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const audioBlob = await voiceGenerationService.generateVoiceClip({
        text: inputText.trim(),
        voiceId: selectedVoiceId,
        modelId: currentSettings.modelId,
        outputFormat: currentSettings.outputFormat,
        stability: currentSettings.stability,
        similarityBoost: currentSettings.similarityBoost,
        style: currentSettings.style,
        useSpeakerBoost: currentSettings.useSpeakerBoost
      })

      setGeneratedAudio(audioBlob)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setGenerationError('Generation cancelled')
      } else {
        setGenerationError(error instanceof Error ? error.message : 'Voice generation failed')
      }
    } finally {
      setGenerating(false)
      abortControllerRef.current = null
    }
  }, [selectedVoiceId, inputText, currentSettings, setGenerating, setGenerationError])

  const handlePlay = useCallback(() => {
    if (!generatedAudio) return

    // Stop current audio if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    const audio = voiceGenerationService.playAudioPreview(generatedAudio)
    currentAudioRef.current = audio
  }, [generatedAudio])

  const handleDownload = useCallback(() => {
    if (!generatedAudio) return
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `voice-${selectedVoiceName || 'clip'}-${timestamp}`
    voiceGenerationService.downloadVoiceClip(generatedAudio, filename)
  }, [generatedAudio, selectedVoiceName])

  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  // Computed values
  const characterCount = inputText.length
  const isOverLimit = characterCount > MAX_CHARACTERS
  const isNearLimit = characterCount > WARNING_THRESHOLD
  const canGenerate = selectedVoiceId && inputText.trim().length > 0 && !isOverLimit && !isGenerating

  // Character count color
  const characterCountColor = useMemo(() => {
    if (isOverLimit) return 'text-red-400'
    if (isNearLimit) return 'text-yellow-400'
    return 'text-gray-400'
  }, [isOverLimit, isNearLimit])

  return (
    <div className="w-full h-full overflow-auto" data-testid="voice-standalone-page">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Mic size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary" data-testid="page-title">Voice Experimentation</h1>
              <p className="text-text-secondary mt-1 text-sm sm:text-base">
                Test voices and settings without creating NPCs • Generate instant previews
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="success" className="text-xs">
              <Volume2 className="w-3 h-3 mr-1" />
              Instant Preview
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <DollarSign className="w-3 h-3 mr-1" />
              Cost Tracking
            </Badge>
            <Badge variant="secondary" className="text-xs">
              20+ Voices
            </Badge>
          </div>
        </div>

        {/* Subscription Widget */}
        <SubscriptionWidget compact={true} showRefresh={true} />

        {/* Voice Selection */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Voice Selection
            </h3>
          </CardHeader>
          <CardContent>
            {selectedVoiceId && selectedVoiceName ? (
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <p className="font-medium text-white">Selected Voice</p>
                  <p className="text-sm text-gray-400">{selectedVoiceName}</p>
                </div>
                <Button variant="secondary" onClick={() => setShowVoiceLibrary(true)} data-testid="voice-browser-toggle">
                  Change Voice
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowVoiceLibrary(true)} className="w-full" size="lg" data-testid="voice-browser-toggle">
                <Mic className="w-4 h-4 mr-2" />
                Choose Voice from Library
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Voice Library Modal */}
        {showVoiceLibrary && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 sm:p-8 animate-fade-in"
            style={{
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 1)'
            }}
          >
            <div
              className="bg-gray-50 rounded-lg p-4 sm:p-6 max-w-6xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-gray-200"
              style={{
                position: 'relative',
                zIndex: 10000
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Voice Library</h2>
                <Button variant="ghost" onClick={() => setShowVoiceLibrary(false)}>
                  Close
                </Button>
              </div>
              <VoiceBrowser
                onSelect={handleVoiceSelect}
                selectedVoiceId={selectedVoiceId}
                useStore={true}
              />
            </div>
          </div>
        )}

        {/* Text Input */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-lg font-semibold">Text Input</h3>
              <div className="flex items-center gap-3 flex-wrap">
                {costEstimate && (
                  <Badge variant="secondary" className="flex items-center gap-1" data-testid="cost-estimate">
                    <DollarSign className="w-3 h-3" />
                    ${costEstimate.cost}
                  </Badge>
                )}
                <span className={`text-sm font-medium ${characterCountColor}`} data-testid="character-counter">
                  {characterCount.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter the text you want to generate as voice...

Example:
Welcome to our shop! Looking for something special? We've got the finest wares in all the land..."
              className={`
                w-full h-40 sm:h-48 p-4 bg-gray-800 border rounded-lg text-white placeholder-gray-400
                focus:outline-none focus:ring-2 resize-none transition-all
                ${isOverLimit
                  ? 'border-red-500 focus:ring-red-500'
                  : isNearLimit
                    ? 'border-yellow-500 focus:ring-yellow-500'
                    : 'border-gray-700 focus:ring-purple-500'
                }
              `}
              maxLength={MAX_CHARACTERS + 100} // Allow slight overflow to show error
              aria-label="Text to generate"
              aria-describedby="character-count"
              data-testid="voice-input-text"
            />
            {isOverLimit && (
              <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                <Info className="w-4 h-4" />
                Text exceeds maximum character limit by {(characterCount - MAX_CHARACTERS).toLocaleString()} characters
              </p>
            )}
            {isNearLimit && !isOverLimit && (
              <p className="text-yellow-400 text-sm mt-2 flex items-center gap-1">
                <Info className="w-4 h-4" />
                Approaching character limit ({MAX_CHARACTERS - characterCount} remaining)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Voice Settings */}
        {selectedVoiceId && (
          <>
            {/* Voice Presets */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Voice Presets</h3>
                <p className="text-sm text-gray-400 mt-1">Quick access to common voice configurations</p>
              </CardHeader>
              <CardContent>
                <VoicePresets
                  currentSettings={currentSettings}
                  onApplyPreset={(settings) => {
                    setCurrentSettings(settings)
                    setGeneratedAudio(null) // Clear previous audio when settings change
                  }}
                />
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  Advanced Settings
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Model
                    </label>
                    <select
                      value={currentSettings.modelId}
                      onChange={(e) => {
                        setCurrentSettings({ modelId: e.target.value })
                        setGeneratedAudio(null)
                      }}
                      className="input w-full"
                    >
                      <option value="eleven_multilingual_v2">Multilingual v2 (Highest Quality)</option>
                      <option value="eleven_turbo_v2_5">Turbo v2.5 (Faster, Lower Cost)</option>
                      <option value="eleven_flash_v2_5">Flash v2.5 (Fastest, Lowest Cost)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Stability: {(currentSettings.stability || 0.5).toFixed(2)}
                    </label>
                    <RangeInput
                      value={currentSettings.stability || 0.5}
                      onChange={(e) => setCurrentSettings({ stability: parseFloat(e.target.value) })}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Higher values produce more consistent and predictable voice output
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Similarity Boost: {(currentSettings.similarityBoost || 0.75).toFixed(2)}
                    </label>
                    <RangeInput
                      value={currentSettings.similarityBoost || 0.75}
                      onChange={(e) => setCurrentSettings({ similarityBoost: parseFloat(e.target.value) })}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Higher values make the voice closer to the original sample
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Style: {(currentSettings.style || 0).toFixed(2)}
                    </label>
                    <RangeInput
                      value={currentSettings.style || 0}
                      onChange={(e) => setCurrentSettings({ style: parseFloat(e.target.value) })}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Higher values add more expressiveness and emotion to the voice
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Generate & Preview */}
        <Card>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  loading={isGenerating}
                  className="flex-1"
                  size="lg"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Voice Clip'}
                </Button>
                {isGenerating && (
                  <Button
                    onClick={handleCancelGeneration}
                    variant="danger"
                    size="lg"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {generationError && (
                <div className="p-4 bg-red-900 bg-opacity-20 border border-red-500 rounded-lg text-red-400 text-sm flex items-start gap-2">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{generationError}</span>
                </div>
              )}

              {generatedAudio && (
                <div className="p-4 bg-green-900 bg-opacity-10 border border-green-500 rounded-lg space-y-3 animate-fade-in">
                  <p className="text-green-400 font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Voice clip generated successfully!
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handlePlay} variant="secondary">
                      <Play className="w-4 h-4 mr-2" />
                      Play Preview
                    </Button>
                    <Button onClick={handleDownload} variant="secondary">
                      <Download className="w-4 h-4 mr-2" />
                      Download MP3
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Tips */}
        <Card className="bg-gradient-to-br from-purple-500 from-opacity-5 to-pink-500 to-opacity-5 border-purple-500 border-opacity-20">
          <CardHeader>
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Info className="w-5 h-5" />
              Tips for Best Results
            </h3>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>Use proper punctuation to control pacing and intonation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>Try different stability values: lower for varied delivery, higher for consistency</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>Use ellipsis (...) for dramatic pauses and commas (,) for brief pauses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>CAPS can emphasize words, but use sparingly for best results</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>Experiment with presets before fine-tuning advanced settings</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
