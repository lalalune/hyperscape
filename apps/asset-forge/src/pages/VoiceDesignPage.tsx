/**
 * Voice Design Page
 * Design custom voices from text descriptions using ElevenLabs Text-to-Voice API
 */

import { Palette, Play, Pause, Save, Sparkles, RotateCw, Settings as SettingsIcon } from 'lucide-react'
import React, { useState, useRef, useCallback } from 'react'

import { Card } from '../components/common'
import { voiceGenerationService } from '../services/VoiceGenerationService'
import type { VoiceDesignRequest, VoiceDesignResponse, VoicePreview, CreateVoiceRequest, CreateVoiceResponse } from '../types/voice-generation'

export const VoiceDesignPage: React.FC = () => {
  // Design state
  const [voiceDescription, setVoiceDescription] = useState('')
  const [customText, setCustomText] = useState('')
  const [useCustomText, setUseCustomText] = useState(false)

  // Results
  const [previews, setPreviews] = useState<VoicePreview[]>([])
  const [generatedText, setGeneratedText] = useState('')
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>('')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string>('')

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [voiceName, setVoiceName] = useState('')

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [loudness, setLoudness] = useState(1.0)
  const [guidanceScale, setGuidanceScale] = useState(3.0)
  const [seed, setSeed] = useState<number | null>(null)

  // Audio playback
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  const handleGenerate = async () => {
    if (!voiceDescription.trim()) {
      setGenerationError('Please enter a voice description')
      return
    }

    setGenerating(true)
    setGenerationError('')
    setPreviews([])
    setGeneratedText('')
    setSelectedPreviewId('')

    try {
      const data = await voiceGenerationService.designVoice({
        voiceDescription: voiceDescription.trim(),
        text: useCustomText && customText.trim() ? customText.trim() : undefined,
        autoGenerateText: !useCustomText || !customText.trim(),
        loudness,
        guidanceScale,
        seed: seed !== null ? seed : undefined,
      })

      setPreviews(data.previews)
      setGeneratedText(data.text)

      if (data.previews.length > 0) {
        setSelectedPreviewId(data.previews[0].generatedVoiceId)
      }
    } catch (error) {
      console.error('Voice design error:', error)
      setGenerationError(error instanceof Error ? error.message : 'Failed to design voice')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = () => {
    // Generate with a new random seed
    setSeed(Math.floor(Math.random() * 1000000))
    handleGenerate()
  }

  const togglePreviewPlayback = useCallback((preview: VoicePreview) => {
    const audioElement = audioRefs.current[preview.generatedVoiceId]

    if (!audioElement) {
      // Create audio element
      const audio = new Audio(`data:audio/mpeg;base64,${preview.audioBase64}`)
      audioRefs.current[preview.generatedVoiceId] = audio

      audio.onended = () => {
        setPlayingPreviewId(null)
      }

      audio.play()
      setPlayingPreviewId(preview.generatedVoiceId)
    } else {
      // Toggle existing audio
      if (playingPreviewId === preview.generatedVoiceId) {
        audioElement.pause()
        audioElement.currentTime = 0
        setPlayingPreviewId(null)
      } else {
        // Pause other audios
        Object.values(audioRefs.current).forEach(a => a.pause())

        audioElement.currentTime = 0
        audioElement.play()
        setPlayingPreviewId(preview.generatedVoiceId)
      }
    }
  }, [playingPreviewId])

  const handleSaveVoice = async () => {
    if (!selectedPreviewId) {
      setGenerationError('Please select a voice preview to save')
      return
    }

    if (!voiceName.trim()) {
      setGenerationError('Please enter a name for the voice')
      return
    }

    setSaving(true)
    setGenerationError('')
    setSaveSuccess(false)

    try {
      await voiceGenerationService.createVoiceFromPreview({
        voiceName: voiceName.trim(),
        voiceDescription: voiceDescription.trim(),
        generatedVoiceId: selectedPreviewId,
        playedNotSelectedVoiceIds: previews
          .filter(p => p.generatedVoiceId !== selectedPreviewId)
          .map(p => p.generatedVoiceId),
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      // Reset form
      setVoiceName('')
      setSelectedPreviewId('')
    } catch (error) {
      console.error('Save voice error:', error)
      setGenerationError(error instanceof Error ? error.message : 'Failed to save voice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full h-full overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Palette size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Voice Design</h1>
              <p className="text-text-secondary mt-1">
                Create custom voices from descriptions • AI-powered voice generation
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex gap-2 mt-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 bg-opacity-10 text-green-400 border border-green-500 border-opacity-20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2"></span>
              AI Voice Generation
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500 bg-opacity-10 text-blue-400 border border-blue-500 border-opacity-20">
              Multiple Previews
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-500 bg-opacity-10 text-purple-400 border border-purple-500 border-opacity-20">
              Save to Library
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Voice Description & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description Input */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Describe Your Voice</h2>

              <div className="mb-4">
                <label className="text-sm text-text-secondary mb-2 block">
                  Voice Description
                </label>
                <textarea
                  value={voiceDescription}
                  onChange={(e) => setVoiceDescription(e.target.value)}
                  placeholder="e.g., A deep, authoritative male narrator with a British accent"
                  className="w-full px-4 py-3 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:border-primary resize-none text-text-primary"
                  rows={3}
                />
                <p className="text-xs text-text-secondary mt-2">
                  Describe characteristics like age, gender, accent, tone, emotion, etc.
                </p>
              </div>

              {/* Custom Preview Text */}
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="use-custom-text"
                  checked={useCustomText}
                  onChange={(e) => setUseCustomText(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="use-custom-text" className="text-sm text-text-primary">
                  Use custom preview text
                </label>
              </div>

              {useCustomText && (
                <div>
                  <label className="text-sm text-text-secondary mb-2 block">
                    Custom Text
                  </label>
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Enter text for voice preview..."
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:border-primary resize-none text-text-primary"
                    rows={2}
                  />
                </div>
              )}
            </Card>

            {/* Advanced Settings */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-primary">Advanced Settings</h2>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-bg-secondary rounded-lg transition-colors"
                >
                  <SettingsIcon size={18} className="text-text-secondary" />
                </button>
              </div>

              {showSettings && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">
                      Loudness: {loudness.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={loudness}
                      onChange={(e) => setLoudness(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">
                      Guidance Scale: {guidanceScale.toFixed(1)}
                      <span className="ml-2 text-xs">(how closely to follow description)</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={guidanceScale}
                      onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Generate Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={!voiceDescription.trim() || generating}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate Voices
                  </>
                )}
              </button>

              {previews.length > 0 && (
                <button
                  onClick={handleRegenerate}
                  disabled={generating}
                  className="px-6 py-4 bg-bg-secondary hover:bg-bg-primary text-text-primary rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RotateCw size={20} />
                  Regenerate
                </button>
              )}
            </div>

            {generationError && (
              <div className="p-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 rounded-lg">
                <p className="text-red-400 text-sm">{generationError}</p>
              </div>
            )}

            {saveSuccess && (
              <div className="p-4 bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 rounded-lg">
                <p className="text-green-400 text-sm">Voice saved successfully!</p>
              </div>
            )}
          </div>

          {/* Right column: Voice Previews & Save */}
          <div className="space-y-6">
            {/* Generated Text */}
            {generatedText && (
              <Card className="p-6">
                <h2 className="text-sm font-semibold text-text-secondary mb-3">Preview Text</h2>
                <p className="text-sm text-text-primary italic">&ldquo;{generatedText}&rdquo;</p>
              </Card>
            )}

            {/* Voice Previews */}
            {previews.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4">
                  Voice Previews ({previews.length})
                </h2>

                <div className="space-y-3">
                  {previews.map((preview, index) => (
                    <div
                      key={preview.generatedVoiceId}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedPreviewId === preview.generatedVoiceId
                          ? 'border-primary bg-primary bg-opacity-10'
                          : 'border-border-primary hover:border-primary hover:border-opacity-30'
                      }`}
                      onClick={() => setSelectedPreviewId(preview.generatedVoiceId)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-text-primary">Voice {index + 1}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePreviewPlayback(preview)
                          }}
                          className="p-2 bg-primary bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                        >
                          {playingPreviewId === preview.generatedVoiceId ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span>{preview.durationSecs.toFixed(1)}s</span>
                        {preview.language && <span>• {preview.language}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Save Voice */}
            {previews.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Save to Library</h2>

                <div className="mb-4">
                  <label className="text-sm text-text-secondary mb-2 block">Voice Name</label>
                  <input
                    type="text"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    placeholder="My Custom Voice"
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  />
                </div>

                <button
                  onClick={handleSaveVoice}
                  disabled={!selectedPreviewId || !voiceName.trim() || saving}
                  className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      Save Selected Voice
                    </>
                  )}
                </button>

                <p className="text-xs text-text-secondary mt-3 text-center">
                  Selected voices will be available in your voice library
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
