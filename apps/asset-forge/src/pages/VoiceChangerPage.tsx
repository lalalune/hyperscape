/**
 * Voice Changer Page
 * Transform uploaded audio to different voices using ElevenLabs Speech-to-Speech API
 */

import { Upload, Play, Pause, Download, Shuffle, Settings as SettingsIcon, X } from 'lucide-react'
import React, { useState, useRef, useCallback } from 'react'

import { Card } from '../components/common'
import { voiceGenerationService } from '../services/VoiceGenerationService'
import type { ElevenLabsVoice, SpeechToSpeechRequest, SpeechToSpeechResponse } from '../types/voice-generation'

export const VoiceChangerPage: React.FC = () => {
  // Audio state
  const [originalAudio, setOriginalAudio] = useState<File | null>(null)
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string>('')
  const [convertedAudioUrl, setConvertedAudioUrl] = useState<string>('')

  // Voice selection
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('')
  const [loadingVoices, setLoadingVoices] = useState(false)

  // Conversion state
  const [converting, setConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string>('')

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [stability, setStability] = useState(0.5)
  const [similarityBoost, setSimilarityBoost] = useState(0.75)
  const [removeBackgroundNoise, setRemoveBackgroundNoise] = useState(false)

  // Audio playback
  const [playingOriginal, setPlayingOriginal] = useState(false)
  const [playingConverted, setPlayingConverted] = useState(false)
  const originalAudioRef = useRef<HTMLAudioElement>(null)
  const convertedAudioRef = useRef<HTMLAudioElement>(null)

  // Load voices on mount
  React.useEffect(() => {
    loadVoices()
  }, [])

  const loadVoices = async () => {
    setLoadingVoices(true)
    try {
      const voices = await voiceGenerationService.getVoiceLibrary()
      setVoices(voices)
      if (voices.length > 0) {
        setSelectedVoiceId(voices[0].voiceId)
      }
    } catch (error) {
      console.error('Failed to load voices:', error)
    } finally {
      setLoadingVoices(false)
    }
  }

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
    if (!validTypes.includes(file.type)) {
      setConversionError('Please upload a valid audio file (MP3, WAV, OGG)')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setConversionError('File size must be less than 10MB')
      return
    }

    setOriginalAudio(file)
    setOriginalAudioUrl(URL.createObjectURL(file))
    setConvertedAudioUrl('')
    setConversionError('')
  }, [])

  const handleConvert = async () => {
    if (!originalAudio || !selectedVoiceId) {
      setConversionError('Please upload audio and select a voice')
      return
    }

    setConverting(true)
    setConversionError('')

    try {
      const audioBlob = await voiceGenerationService.speechToSpeech({
        audio: originalAudio,
              voiceId: selectedVoiceId,
              stability,
              similarityBoost,
              removeBackgroundNoise,
      })

            const audioUrl = URL.createObjectURL(audioBlob)
            setConvertedAudioUrl(audioUrl)
    } catch (error) {
      console.error('Conversion error:', error)
      setConversionError(error instanceof Error ? error.message : 'Failed to convert audio')
    } finally {
      setConverting(false)
    }
  }

  const handleDownload = () => {
    if (!convertedAudioUrl) return

    const a = document.createElement('a')
    a.href = convertedAudioUrl
    a.download = `voice-changed-${Date.now()}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const toggleOriginalPlayback = () => {
    if (!originalAudioRef.current) return

    if (playingOriginal) {
      originalAudioRef.current.pause()
      setPlayingOriginal(false)
    } else {
      originalAudioRef.current.play()
      setPlayingOriginal(true)
    }
  }

  const toggleConvertedPlayback = () => {
    if (!convertedAudioRef.current) return

    if (playingConverted) {
      convertedAudioRef.current.pause()
      setPlayingConverted(false)
    } else {
      convertedAudioRef.current.play()
      setPlayingConverted(true)
    }
  }

  return (
    <div className="w-full h-full overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Shuffle size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Voice Changer</h1>
              <p className="text-text-secondary mt-1">
                Transform any audio to a different voice • Maintain emotion and timing
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex gap-2 mt-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 bg-opacity-10 text-green-400 border border-green-500 border-opacity-20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2"></span>
              Speech-to-Speech
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500 bg-opacity-10 text-blue-400 border border-blue-500 border-opacity-20">
              Preserve Timing & Emotion
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-500 bg-opacity-10 text-purple-400 border border-purple-500 border-opacity-20">
              Background Noise Removal
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Upload & Voice Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">1. Upload Audio</h2>

              <div className="border-2 border-dashed border-border-primary rounded-lg p-8 text-center hover:border-primary hover:border-opacity-50 transition-colors">
                <input
                  type="file"
                  id="audio-upload"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="audio-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto text-text-secondary mb-3" />
                  <p className="text-text-primary font-medium mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-text-secondary text-sm">
                    MP3, WAV, OGG (max 10MB)
                  </p>
                </label>
              </div>

              {originalAudio && (
                <div className="mt-4 p-4 bg-bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-primary font-medium">{originalAudio.name}</p>
                      <p className="text-text-secondary text-sm">
                        {(originalAudio.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setOriginalAudio(null)
                        setOriginalAudioUrl('')
                        setConvertedAudioUrl('')
                      }}
                      className="p-2 hover:bg-bg-primary rounded-lg transition-colors"
                    >
                      <X size={18} className="text-text-secondary" />
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Voice Selection */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">2. Select Target Voice</h2>

              {loadingVoices ? (
                <div className="text-center py-8 text-text-secondary">Loading voices...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {voices.slice(0, 8).map((voice) => (
                    <button
                      key={voice.voiceId}
                      onClick={() => setSelectedVoiceId(voice.voiceId)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedVoiceId === voice.voiceId
                          ? 'border-primary bg-primary bg-opacity-10'
                          : 'border-border-primary hover:border-primary hover:border-opacity-30'
                      }`}
                    >
                      <p className="font-medium text-text-primary">{voice.name}</p>
                      <p className="text-sm text-text-secondary mt-1">{voice.category}</p>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Convert Button */}
            <button
              onClick={handleConvert}
              disabled={!originalAudio || !selectedVoiceId || converting}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {converting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Shuffle size={20} />
                  Convert Voice
                </>
              )}
            </button>

            {conversionError && (
              <div className="p-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 rounded-lg">
                <p className="text-red-400 text-sm">{conversionError}</p>
              </div>
            )}
          </div>

          {/* Right column: Settings & Preview */}
          <div className="space-y-6">
            {/* Settings */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
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
                      Stability: {stability.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={stability}
                      onChange={(e) => setStability(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">
                      Similarity Boost: {similarityBoost.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={similarityBoost}
                      onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remove-noise"
                      checked={removeBackgroundNoise}
                      onChange={(e) => setRemoveBackgroundNoise(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="remove-noise" className="text-sm text-text-primary">
                      Remove Background Noise
                    </label>
                  </div>
                </div>
              )}
            </Card>

            {/* Audio Previews */}
            {originalAudioUrl && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Preview</h2>

                {/* Original Audio */}
                <div className="mb-4">
                  <p className="text-sm text-text-secondary mb-2">Original</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleOriginalPlayback}
                      className="p-2 bg-bg-secondary hover:bg-bg-primary rounded-lg transition-colors"
                    >
                      {playingOriginal ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <audio
                      ref={originalAudioRef}
                      src={originalAudioUrl}
                      onEnded={() => setPlayingOriginal(false)}
                      className="hidden"
                    />
                    <div className="flex-1 h-2 bg-bg-secondary rounded-full" />
                  </div>
                </div>

                {/* Converted Audio */}
                {convertedAudioUrl && (
                  <div>
                    <p className="text-sm text-text-secondary mb-2">Converted</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleConvertedPlayback}
                        className="p-2 bg-primary bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                      >
                        {playingConverted ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <audio
                        ref={convertedAudioRef}
                        src={convertedAudioUrl}
                        onEnded={() => setPlayingConverted(false)}
                        className="hidden"
                      />
                      <div className="flex-1 h-2 bg-primary bg-opacity-20 rounded-full" />
                      <button
                        onClick={handleDownload}
                        className="p-2 bg-green-500 bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download size={18} className="text-green-400" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
