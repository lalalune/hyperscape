/**
 * Voice Generation Page
 * Standalone page for ElevenLabs voice generation
 * Users can generate voice clips directly without needing to create NPCs first
 */

import { Mic, Download, Play, Volume2, Settings } from 'lucide-react'
import React, { useState } from 'react'

import { VoiceGenerator } from '../components/GameContent/VoiceGenerator'
import { Card } from '../components/common'

export const VoiceGenerationPage: React.FC = () => {
  const [_selectedDialogue, _setSelectedDialogue] = useState<string>('')
  const [_voiceId, _setVoiceId] = useState<string>('')

  return (
    <div className="w-full h-full overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-slide-in-down">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Mic size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Voice Generation</h1>
              <p className="text-text-secondary mt-1">
                Generate AI voice clips with ElevenLabs • 20+ voices • Professional quality
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex gap-2 mt-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 bg-opacity-10 text-green-400 border border-green-500 border-opacity-20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2"></span>
              ElevenLabs Active
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500 bg-opacity-10 text-blue-400 border border-blue-500 border-opacity-20">
              20+ Voices Available
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-500 bg-opacity-10 text-purple-400 border border-purple-500 border-opacity-20">
              Multiple Languages
            </span>
          </div>
        </div>

        {/* Quick Start Guide */}
        <Card className="mb-6 bg-gradient-to-br from-purple-500 from-opacity-5 to-pink-500 to-opacity-5 border-purple-500 border-opacity-20">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Volume2 size={18} className="text-purple-400" />
              Quick Start Guide
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500 bg-opacity-20 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Enter Text</p>
                  <p className="text-xs text-text-secondary mt-1">Type or paste the dialogue you want to generate</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500 bg-opacity-20 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Choose Voice</p>
                  <p className="text-xs text-text-secondary mt-1">Browse and preview from 20+ professional voices</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500 bg-opacity-20 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Generate</p>
                  <p className="text-xs text-text-secondary mt-1">Create and download your voice clips instantly</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Voice Generator Component */}
        <div className="animate-slide-in-up">
          <VoiceGenerator
            dialogueTree={[]}
            npcId=""
            onVoiceGenerated={() => {}}
          />
        </div>

        {/* Features Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-4 hover:border-primary hover:border-opacity-30 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 bg-opacity-10 flex items-center justify-center flex-shrink-0">
                <Settings size={16} className="text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-1">Advanced Controls</h4>
                <p className="text-xs text-text-secondary">
                  Fine-tune stability, similarity, style, and speaker boost settings
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:border-primary hover:border-opacity-30 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500 bg-opacity-10 flex items-center justify-center flex-shrink-0">
                <Download size={16} className="text-green-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-1">Batch Export</h4>
                <p className="text-xs text-text-secondary">
                  Generate multiple clips and download as ZIP archive
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:border-primary hover:border-opacity-30 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500 bg-opacity-10 flex items-center justify-center flex-shrink-0">
                <Play size={16} className="text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-1">Preview Voices</h4>
                <p className="text-xs text-text-secondary">
                  Listen to voice samples before generating your clips
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom Spacer */}
        <div className="h-8" />
      </div>
    </div>
  )
}
