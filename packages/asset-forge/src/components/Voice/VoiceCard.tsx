/**
 * VoiceCard Component - Matches App Design System
 *
 * Consistent with dark theme and existing UI patterns
 */

import { Play, Pause } from 'lucide-react'
import React from 'react'

import type { ElevenLabsVoice } from '../../types/voice-generation'

import { VoiceOrb } from './VoiceOrb'


interface VoiceCardProps {
  voice: ElevenLabsVoice
  isSelected: boolean
  isPlaying: boolean
  onSelect: () => void
  onPlayPreview: () => void
}

export const VoiceCard: React.FC<VoiceCardProps> = ({
  voice,
  isSelected,
  isPlaying,
  onSelect,
  onPlayPreview
}) => {
  return (
    <div
      onClick={onSelect}
      className={`
        relative w-full h-[200px] rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200
        ${isSelected
          ? 'bg-[var(--bg-card)] border-2 border-[var(--color-primary)] shadow-lg'
          : 'bg-[var(--bg-card)] border border-[var(--border-primary)] hover:border-[var(--border-hover)]'
        }
        ${isPlaying ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)]' : ''}
      `}
    >
      {/* Voice Orb - Shows when playing */}
      {isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <VoiceOrb isActive={true} size={120} />
        </div>
      )}

      {/* Content */}
      <div className={`relative z-20 h-full p-4 flex flex-col ${isPlaying ? 'bg-black/30' : ''}`}>
        {/* Voice Name */}
        <h3 className={`text-lg font-semibold mb-2 transition-colors ${
          isPlaying ? 'text-white drop-shadow-lg' : 'text-[var(--text-primary)]'
        }`}>
          {voice.name}
        </h3>

        {/* Description */}
        <p className={`text-sm line-clamp-2 flex-grow transition-colors ${
          isPlaying ? 'text-white/90 drop-shadow-md' : 'text-[var(--text-secondary)]'
        }`}>
          {voice.description || 'Voice character'}
        </p>

        {/* Preview Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPlayPreview()
          }}
          className={`
            mt-3 w-full py-2.5 px-4 rounded-md font-medium text-sm
            transition-all duration-200 flex items-center justify-center gap-2
            ${isPlaying
              ? 'bg-white text-[var(--color-primary)] hover:bg-opacity-90'
              : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
            }
            active:scale-[0.98]
          `}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" fill="currentColor" />
              <span>Playing</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" fill="currentColor" />
              <span>Preview</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default VoiceCard
