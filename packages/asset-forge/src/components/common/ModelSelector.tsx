/**
 * Model Selector
 * 
 * Dropdown for selecting AI models with cost/quality/speed indicators
 */

import { Zap, DollarSign, Sparkles } from 'lucide-react'
import React from 'react'

import { AVAILABLE_MODELS } from '../../lib/ai-router'

interface ModelSelectorProps {
  selectedModel?: string
  onModelChange: (model: string) => void
  className?: string
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  className = ''
}) => {
  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'cost':
        return <DollarSign size={14} className="text-green-400" />
      case 'speed':
        return <Zap size={14} className="text-blue-400" />
      case 'quality':
        return <Sparkles size={14} className="text-purple-400" />
      default:
        return null
    }
  }

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'cost':
        return 'Cost-Effective'
      case 'speed':
        return 'Fast'
      case 'quality':
        return 'High Quality'
      default:
        return ''
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-xs font-medium text-text-secondary">AI Model</label>
      <select
        value={selectedModel || ''}
        onChange={(e) => onModelChange(e.target.value)}
        className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
      >
        <option value="">Default (Cost-effective)</option>
        {AVAILABLE_MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} • {getTierLabel(model.tier)}
          </option>
        ))}
      </select>
      {selectedModel && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          {getTierIcon(AVAILABLE_MODELS.find(m => m.id === selectedModel)?.tier || 'cost')}
          <span>{getTierLabel(AVAILABLE_MODELS.find(m => m.id === selectedModel)?.tier || 'cost')}</span>
        </div>
      )}
    </div>
  )
}

