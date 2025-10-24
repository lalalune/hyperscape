/**
 * Voice Presets Component
 *
 * UI for managing and applying voice settings presets.
 *
 * Features:
 * - Display built-in and custom presets
 * - Apply preset to current settings
 * - Save new presets
 * - Delete custom presets
 */

import { Wand2, Plus, Trash2, Check } from 'lucide-react'
import React, { useState, useEffect, useMemo } from 'react'

import { useVoicePresetsStore } from '../../store/useVoicePresetsStore'
import type { VoiceSettings } from '../../types/voice-generation'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'

interface VoicePresetsProps {
  currentSettings: VoiceSettings
  onApplyPreset: (settings: VoiceSettings) => void
  onSaveAsPreset?: (settings: VoiceSettings) => void
}

export const VoicePresets: React.FC<VoicePresetsProps> = ({
  currentSettings,
  onApplyPreset,
  onSaveAsPreset
}) => {
  const {
    presets,
    selectedPresetId,
    loadPresets,
    savePreset,
    deletePreset,
    selectPreset
  } = useVoicePresetsStore()

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetDescription, setPresetDescription] = useState('')

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  const handleApplyPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      onApplyPreset(preset.settings)
      selectPreset(presetId)
    }
  }

  const handleSaveNewPreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name')
      return
    }

    savePreset(presetName.trim(), presetDescription.trim(), currentSettings)
    setPresetName('')
    setPresetDescription('')
    setShowSaveDialog(false)

    if (onSaveAsPreset) {
      onSaveAsPreset(currentSettings)
    }
  }

  const handleDeletePreset = (presetId: string) => {
    if (confirm('Are you sure you want to delete this preset?')) {
      deletePreset(presetId)
    }
  }

  // Memoize preset filtering
  const { builtInPresets, customPresets } = useMemo(() => {
    return {
      builtInPresets: presets.filter(p => p.isBuiltIn),
      customPresets: presets.filter(p => !p.isBuiltIn)
    }
  }, [presets])

  return (
    <div className="space-y-6">
      {/* Save Preset Button */}
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setShowSaveDialog(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Save Current Settings as Preset
      </Button>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-white">Save Preset</h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preset Name *
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., My Custom Preset"
                  className="input w-full"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  placeholder="Describe when to use this preset..."
                  className="input w-full h-20 resize-none"
                />
              </div>

              <div className="p-3 bg-gray-800 rounded-lg text-sm space-y-1">
                <p className="text-gray-400">Current Settings:</p>
                <p className="text-white">Model: {currentSettings.modelId}</p>
                <p className="text-white">Stability: {currentSettings.stability}</p>
                <p className="text-white">Similarity: {currentSettings.similarityBoost}</p>
                <p className="text-white">Style: {currentSettings.style}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSaveNewPreset}
                  disabled={!presetName.trim()}
                >
                  Save Preset
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowSaveDialog(false)
                    setPresetName('')
                    setPresetDescription('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Built-in Presets */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Built-in Presets</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {builtInPresets.map(preset => (
            <div
              key={preset.id}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all
                ${selectedPresetId === preset.id
                  ? 'bg-purple-900 bg-opacity-20 border-purple-500'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }
              `}
              onClick={() => handleApplyPreset(preset.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h5 className="font-medium text-white flex items-center gap-2">
                    {preset.name}
                    {selectedPresetId === preset.id && (
                      <Check className="w-4 h-4 text-purple-400" />
                    )}
                  </h5>
                  <p className="text-sm text-gray-400 mt-1">{preset.description}</p>
                </div>
                <Wand2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
              </div>

              <div className="flex flex-wrap gap-1 mt-3">
                <Badge variant="secondary" size="sm">
                  {preset.settings.modelId?.replace('eleven_', '').replace('_', ' ') || 'Default'}
                </Badge>
                <Badge variant="secondary" size="sm">
                  Stab: {preset.settings.stability}
                </Badge>
                <Badge variant="secondary" size="sm">
                  Sim: {preset.settings.similarityBoost}
                </Badge>
                <Badge variant="secondary" size="sm">
                  Style: {preset.settings.style}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Presets */}
      {customPresets.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">My Presets</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customPresets.map(preset => (
              <div
                key={preset.id}
                className={`
                  p-4 rounded-lg border transition-all
                  ${selectedPresetId === preset.id
                    ? 'bg-purple-900 bg-opacity-20 border-purple-500'
                    : 'bg-gray-800 border-gray-700'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleApplyPreset(preset.id)}
                  >
                    <h5 className="font-medium text-white flex items-center gap-2">
                      {preset.name}
                      {selectedPresetId === preset.id && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </h5>
                    <p className="text-sm text-gray-400 mt-1">{preset.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeletePreset(preset.id)}
                    title="Delete preset"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>

                <div
                  className="flex flex-wrap gap-1 mt-3 cursor-pointer"
                  onClick={() => handleApplyPreset(preset.id)}
                >
                  <Badge variant="secondary" size="sm">
                    {preset.settings.modelId?.replace('eleven_', '').replace('_', ' ') || 'Default'}
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    Stab: {preset.settings.stability}
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    Sim: {preset.settings.similarityBoost}
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    Style: {preset.settings.style}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
