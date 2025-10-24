/**
 * Voice Generator Component
 *
 * Main interface for generating NPC voices with ElevenLabs.
 *
 * Features:
 * - Voice selection from library
 * - Voice settings (stability, similarity, etc.)
 * - Batch generation for dialogue tree
 * - Progress tracking
 * - Download individual clips or bulk ZIP
 * - Cost estimation
 *
 * Used by: NPCScriptBuilder Voice tab
 */

import JSZip from 'jszip'
import { Mic, Download, Trash2, Play, Sparkles, DollarSign, RotateCcw } from 'lucide-react'
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react'

import { CDN_URL } from '../../config/api'
import { voiceGenerationService } from '../../services/VoiceGenerationService'
import { useVoiceGenerationStore } from '../../store/useVoiceGenerationStore'
import type { NPCScript, DialogueNode } from '../../types/npc-scripts'
import type { VoiceClip } from '../../types/voice-generation'
import { VoiceBrowser } from '../Voice/VoiceBrowser'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardHeader, CardContent } from '../common/Card'
import { Progress } from '../common/Progress'
import { RangeInput } from '../common/RangeInput'

interface VoiceGeneratorProps {
  npcScript?: NPCScript
  // Alternative props for standalone use (without full NPCScript)
  dialogueTree?: DialogueNode[]
  npcId?: string
  npcName?: string
  onVoiceGenerated?: () => void
}

export const VoiceGenerator: React.FC<VoiceGeneratorProps> = memo(({
  npcScript,
  dialogueTree: standaloneDialogueTree,
  npcId: standaloneNpcId,
  npcName: standaloneNpcName,
  onVoiceGenerated
}) => {
  // Support both modes: full npcScript OR standalone props
  const npcId = npcScript?.npcId || standaloneNpcId || 'standalone'
  const npcName = npcScript?.npcName || standaloneNpcName || 'Voice Generation'
  const dialogueNodes = useMemo(() => npcScript?.dialogueTree.nodes || standaloneDialogueTree || [], [npcScript?.dialogueTree.nodes, standaloneDialogueTree])
  // Selective subscriptions for performance
  const selectedVoiceId = useVoiceGenerationStore(state => state.selectedVoiceId)
  const currentSettings = useVoiceGenerationStore(state => state.currentSettings)
  const setSelectedVoice = useVoiceGenerationStore(state => state.setSelectedVoice)
  const setCurrentSettings = useVoiceGenerationStore(state => state.setCurrentSettings)
  const isGenerating = useVoiceGenerationStore(state => state.isGenerating)
  const generationProgress = useVoiceGenerationStore(state => state.generationProgress)
  const generationError = useVoiceGenerationStore(state => state.generationError)
  const setGenerating = useVoiceGenerationStore(state => state.setGenerating)
  const setGenerationProgress = useVoiceGenerationStore(state => state.setGenerationProgress)
  const setGenerationError = useVoiceGenerationStore(state => state.setGenerationError)
  const getNPCVoiceConfig = useVoiceGenerationStore(state => state.getNPCVoiceConfig)
  const updateNPCVoiceConfig = useVoiceGenerationStore(state => state.updateNPCVoiceConfig)
  const assignVoiceToNPC = useVoiceGenerationStore(state => state.assignVoiceToNPC)

  const [showVoiceLibrary, setShowVoiceLibrary] = useState(false)
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('')
  const [costEstimate, setCostEstimate] = useState<{ characterCount: number; cost: string } | null>(null)

  const voiceConfig = getNPCVoiceConfig(npcId)

  // Memoize voice selection handler
  const handleVoiceSelect = useCallback((voiceId: string, voiceName: string) => {
    setSelectedVoice(voiceId)
    setSelectedVoiceName(voiceName)
    assignVoiceToNPC(npcId, voiceId, voiceName)
    setShowVoiceLibrary(false)
  }, [setSelectedVoice, assignVoiceToNPC, npcId])

  // Memoize generated clips data
  const generatedClips = useMemo(() => voiceConfig?.clips || {}, [voiceConfig?.clips])
  const generatedCount = useMemo(() => Object.keys(generatedClips).length, [generatedClips])
  const totalNodes = useMemo(() => dialogueNodes.length, [dialogueNodes.length])

  // Load existing voice config
  useEffect(() => {
    if (voiceConfig) {
      setSelectedVoice(voiceConfig.voiceId)
      setSelectedVoiceName(voiceConfig.voiceName)
      setCurrentSettings(voiceConfig.settings)
    }
  }, [npcId, voiceConfig, setSelectedVoice, setCurrentSettings])

  // Calculate cost estimate
  useEffect(() => {
    if (dialogueNodes.length > 0) {
      const characterCount = voiceGenerationService.calculateCharacterCount(dialogueNodes)
      voiceGenerationService.estimateCost(characterCount, currentSettings.modelId)
        .then(estimate => {
          setCostEstimate({
            characterCount: estimate.characterCount,
            cost: estimate.estimatedCostUSD
          })
        })
        .catch(err => console.error('Cost estimation failed:', err))
    }
  }, [dialogueNodes, currentSettings.modelId])

  const handleGenerateAll = useCallback(async () => {
    if (!selectedVoiceId) {
      setGenerationError('Please select a voice first')
      return
    }

    if (dialogueNodes.length === 0) {
      setGenerationError('No dialogue nodes to generate')
      return
    }

    setGenerating(true)
    setGenerationError(null)
    setGenerationProgress(0, dialogueNodes.length, npcId)

    try {
      const result = await voiceGenerationService.generateBatchVoices({
        npcId: npcId,
        dialogueNodes: dialogueNodes.map(node => ({ id: node.id, text: node.text })),
        voiceId: selectedVoiceId,
        settings: currentSettings
      })

      // Filter out failed clips (those with empty audioUrl or error property)
      const successfulClips = Object.fromEntries(
        Object.entries(result.clips).filter(([_, clip]) =>
          clip.audioUrl && clip.audioUrl.trim() !== '' && !clip.error
        )
      )

      // Update voice config with only successful clips
      updateNPCVoiceConfig(npcId, {
        clips: successfulClips,
        totalClips: result.totalGenerated
      })

      // Show failure summary if any clips failed
      const failedCount = result.totalRequested - result.totalGenerated
      if (failedCount > 0) {
        const failedClips = Object.entries(result.clips)
          .filter(([_, clip]) => clip.error)
          .map(([nodeId, clip]) => `• ${nodeId}: ${clip.error}`)

        setGenerationError(
          `⚠️ ${failedCount} of ${result.totalRequested} clip(s) failed to generate:\n${failedClips.join('\n')}\n\n${result.totalGenerated} clips generated successfully.`
        )
      }

      if (onVoiceGenerated) {
        onVoiceGenerated()
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Voice generation failed')
    } finally {
      setGenerating(false)
    }
  }, [selectedVoiceId, dialogueNodes, npcId, currentSettings, setGenerating, setGenerationError, setGenerationProgress, updateNPCVoiceConfig, onVoiceGenerated])

  // BUG FIX: Move audio state to component level to properly cleanup blob URLs
  const currentAudioRef = React.useRef<{ audio: HTMLAudioElement; url: string } | null>(null)

  // Cleanup audio on unmount
  React.useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.audio.pause()
        URL.revokeObjectURL(currentAudioRef.current.url)
        currentAudioRef.current = null
      }
    }
  }, [])

  const handlePlayClip = useCallback(async (clip: VoiceClip) => {
    try {
      // Validate audioUrl exists
      if (!clip.audioUrl) {
        throw new Error('Audio clip has no URL - generation may have failed')
      }

      // BUG FIX: Always cleanup previous audio to prevent memory leaks
      if (currentAudioRef.current) {
        currentAudioRef.current.audio.pause()
        URL.revokeObjectURL(currentAudioRef.current.url)
        currentAudioRef.current = null
      }

      const response = await fetch(`${CDN_URL}/gdd-assets/${npcId}/${clip.audioUrl}`)
      if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`)
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      currentAudioRef.current = { audio, url: audioUrl }

      audio.onended = () => {
        // BUG FIX: Cleanup blob URL when audio ends, regardless of which audio is currently playing
        URL.revokeObjectURL(audioUrl)
        if (currentAudioRef.current && currentAudioRef.current.url === audioUrl) {
          currentAudioRef.current = null
        }
      }

      await audio.play()
    } catch (error) {
      console.error('Failed to play clip:', error)
      setGenerationError(error instanceof Error ? error.message : 'Failed to play audio clip')
    }
  }, [npcId, setGenerationError])

  const handleDownloadClip = useCallback(async (nodeId: string, clip: VoiceClip) => {
    try {
      const response = await fetch(`${CDN_URL}/gdd-assets/${npcId}/${clip.audioUrl}`)
      if (!response.ok) throw new Error('Failed to fetch audio')
      const audioBlob = await response.blob()
      const url = URL.createObjectURL(audioBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nodeId}.mp3`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download clip:', error)
      setGenerationError('Failed to download audio clip')
    }
  }, [npcId, setGenerationError])

  const handleDownloadAllZip = useCallback(async () => {
    try {
      const zip = new JSZip()
      const voiceFolder = zip.folder('voices')

      if (!voiceFolder) throw new Error('Failed to create ZIP folder')

      for (const [nodeId, clip] of Object.entries(generatedClips)) {
        if (clip.audioUrl) {
          const response = await fetch(`${CDN_URL}/gdd-assets/${npcId}/${clip.audioUrl}`)
          if (response.ok) {
            const audioBlob = await response.blob()
            voiceFolder.file(`${nodeId}.mp3`, audioBlob)
          }
        }
      }

      // Add voice profile metadata
      const profileData = JSON.stringify({
        npcId: npcId,
        npcName: npcName,
        voiceId: selectedVoiceId,
        voiceName: selectedVoiceName,
        settings: currentSettings,
        totalClips: generatedCount,
        generatedAt: new Date().toISOString()
      }, null, 2)
      zip.file('voiceProfile.json', profileData)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${npcName}_voices_${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to create ZIP:', error)
      setGenerationError('Failed to create ZIP file')
    }
  }, [generatedClips, npcId, npcName, selectedVoiceId, selectedVoiceName, currentSettings, generatedCount, setGenerationError])

  const handleDeleteAllClips = useCallback(async () => {
    if (!confirm(`Delete all ${generatedCount} voice clips for ${npcName}? This cannot be undone.`)) return

    try {
      setGenerating(true)
      const response = await fetch(`${CDN_URL}/api/voice/${npcId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete clips')

      updateNPCVoiceConfig(npcId, { clips: {}, totalClips: 0 })
      setGenerationError(null)
    } catch (error) {
      console.error('Failed to delete clips:', error)
      setGenerationError('Failed to delete voice clips')
    } finally {
      setGenerating(false)
    }
  }, [generatedCount, npcName, npcId, setGenerating, updateNPCVoiceConfig, setGenerationError])

  const handleRetryClip = useCallback(async (node: DialogueNode) => {
    if (!selectedVoiceId) return

    setGenerating(true)
    setGenerationError(null)

    try {
      const result = await voiceGenerationService.generateBatchVoices({
        npcId: npcId,
        dialogueNodes: [{ id: node.id, text: node.text }],
        voiceId: selectedVoiceId,
        settings: currentSettings
      })

      updateNPCVoiceConfig(npcId, {
        clips: { ...generatedClips, ...result.clips }
      })
    } catch (error) {
      console.error('Retry failed:', error)
      setGenerationError(error instanceof Error ? error.message : 'Failed to retry clip generation')
    } finally {
      setGenerating(false)
    }
  }, [selectedVoiceId, npcId, currentSettings, generatedClips, setGenerating, setGenerationError, updateNPCVoiceConfig])

  return (
    <div className="space-y-6">
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
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-white">Selected Voice</p>
                <p className="text-sm text-gray-400">{selectedVoiceName}</p>
              </div>
              <Button variant="secondary" onClick={() => setShowVoiceLibrary(true)}>
                Change Voice
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowVoiceLibrary(true)} className="w-full">
              <Mic className="w-4 h-4 mr-2" />
              Choose Voice from Library
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Voice Library Modal */}
      {showVoiceLibrary && (
        <div
          className="fixed inset-0 flex items-center justify-center p-8"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 1)'
          }}
        >
          <div
            className="bg-gray-50 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-gray-200"
            style={{
              position: 'relative',
              zIndex: 10000
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Voice Library</h2>
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

      {/* Voice Settings */}
      {selectedVoiceId && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Voice Settings</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Model
                </label>
                <select
                  value={currentSettings.modelId}
                  onChange={(e) => setCurrentSettings({ modelId: e.target.value })}
                  className="input w-full"
                >
                  <option value="eleven_multilingual_v2">Multilingual v2 (Highest Quality)</option>
                  <option value="eleven_turbo_v2_5">Turbo v2.5 (Faster)</option>
                  <option value="eleven_flash_v2_5">Flash v2.5 (Fastest)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Audio Format
                </label>
                <select
                  value={currentSettings.outputFormat || 'mp3_44100_128'}
                  onChange={(e) => setCurrentSettings({ outputFormat: e.target.value as import('../../types/voice-generation').AudioFormat })}
                  className="input w-full"
                >
                  <optgroup label="MP3 (Compressed - Best Compatibility)">
                    <option value="mp3_44100_128">MP3 - 44.1kHz @ 128kbps (Default)</option>
                    <option value="mp3_44100_192">MP3 - 44.1kHz @ 192kbps (Creator+)</option>
                    <option value="mp3_44100_96">MP3 - 44.1kHz @ 96kbps</option>
                    <option value="mp3_44100_64">MP3 - 44.1kHz @ 64kbps</option>
                    <option value="mp3_44100_32">MP3 - 44.1kHz @ 32kbps</option>
                    <option value="mp3_24000_48">MP3 - 24kHz @ 48kbps</option>
                    <option value="mp3_22050_32">MP3 - 22.05kHz @ 32kbps</option>
                  </optgroup>
                  <optgroup label="PCM (Uncompressed - Highest Quality)">
                    <option value="pcm_24000">PCM - 24kHz</option>
                    <option value="pcm_22050">PCM - 22.05kHz</option>
                    <option value="pcm_16000">PCM - 16kHz</option>
                    <option value="pcm_48000">PCM - 48kHz</option>
                    <option value="pcm_44100">PCM - 44.1kHz (Pro+)</option>
                    <option value="pcm_32000">PCM - 32kHz</option>
                    <option value="pcm_8000">PCM - 8kHz</option>
                  </optgroup>
                  <optgroup label="Opus (Modern Compression)">
                    <option value="opus_48000_128">Opus - 48kHz @ 128kbps</option>
                    <option value="opus_48000_96">Opus - 48kHz @ 96kbps</option>
                    <option value="opus_48000_64">Opus - 48kHz @ 64kbps</option>
                    <option value="opus_48000_192">Opus - 48kHz @ 192kbps</option>
                    <option value="opus_48000_32">Opus - 48kHz @ 32kbps</option>
                  </optgroup>
                  <optgroup label="Telephony (Specialized)">
                    <option value="ulaw_8000">µ-law - 8kHz</option>
                    <option value="alaw_8000">a-law - 8kHz</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Higher quality = larger files. Creator+ and Pro+ tiers unlock premium formats.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stability: {currentSettings.stability || 0.5}
                </label>
                <RangeInput
                  value={currentSettings.stability || 0.5}
                  onChange={(e) => setCurrentSettings({ stability: parseFloat(e.target.value) })}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <p className="text-xs text-gray-400 mt-1">Higher = more consistent voice</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Similarity Boost: {currentSettings.similarityBoost || 0.75}
                </label>
                <RangeInput
                  value={currentSettings.similarityBoost || 0.75}
                  onChange={(e) => setCurrentSettings({ similarityBoost: parseFloat(e.target.value) })}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <p className="text-xs text-gray-400 mt-1">Higher = closer to original voice</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Style: {currentSettings.style || 0}
                </label>
                <RangeInput
                  value={currentSettings.style || 0}
                  onChange={(e) => setCurrentSettings({ style: parseFloat(e.target.value) })}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <p className="text-xs text-gray-400 mt-1">Exaggerate emotion and style</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Voice Generation</h3>
            {costEstimate && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Est. ${costEstimate.cost} ({costEstimate.characterCount} chars)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Generated {generatedCount} of {totalNodes} dialogue clips
                </p>
                {isGenerating && (
                  <Progress
                    value={(generationProgress.current / generationProgress.total) * 100}
                    className="mt-2"
                  />
                )}
              </div>
              <Button
                onClick={handleGenerateAll}
                disabled={!selectedVoiceId || isGenerating || totalNodes === 0}
                loading={isGenerating}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {generatedCount > 0 ? 'Regenerate All' : 'Generate All Voices'}
              </Button>
            </div>

            {generationError && (
              <div className="p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
                {generationError}
              </div>
            )}

            {/* Generated Clips List */}
            {generatedCount > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-sm text-gray-300">Generated Clips</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dialogueNodes.map(node => {
                    const clip = generatedClips[node.id]
                    return (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {node.id}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{node.text}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {clip ? (
                            <>
                              <Badge variant="success">✓</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Play"
                                onClick={() => handlePlayClip(clip)}
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Download"
                                onClick={() => handleDownloadClip(node.id, clip)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge variant="secondary">Pending</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Retry"
                                onClick={() => handleRetryClip(node)}
                                disabled={isGenerating}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {generatedCount > 0 && (
        <Card>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleDownloadAllZip}
                disabled={isGenerating}
              >
                <Download className="w-4 h-4 mr-2" />
                Download All (ZIP)
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteAllClips}
                disabled={isGenerating}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Clips
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if critical props change
  return (
    prevProps.npcScript?.npcId === nextProps.npcScript?.npcId &&
    prevProps.npcId === nextProps.npcId &&
    prevProps.npcName === nextProps.npcName &&
    prevProps.dialogueTree?.length === nextProps.dialogueTree?.length &&
    prevProps.npcScript?.dialogueTree.nodes.length === nextProps.npcScript?.dialogueTree.nodes.length
  )
})

VoiceGenerator.displayName = 'VoiceGenerator'
