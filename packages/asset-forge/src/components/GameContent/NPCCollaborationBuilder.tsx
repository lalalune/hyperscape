/**
 * NPC Collaboration Builder
 *
 * UI for setting up and running multi-agent NPC collaborations.
 * Multiple AI agents roleplay as different NPCs to create authentic dialogue,
 * relationships, quests, and emergent storylines.
 */

import { Plus, X, Users, Sparkles, AlertCircle } from 'lucide-react'
import React, { useState } from 'react'

import { API_ENDPOINTS } from '../../config/api'
import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { useMultiAgentStore } from '../../store/useMultiAgentStore'
import type { GeneratedNPC } from '../../types/content-generation'
import type {
  NPCPersona,
  CollaborationType,
  CollaborationRequest,
  CollaborationSession,
} from '../../types/multi-agent'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'
import { ModelSelector } from '../common/ModelSelector'

interface NPCCollaborationBuilderProps {
  onCollaborationComplete: (session: CollaborationSession) => void
}

const COLLABORATION_TYPES: Array<{
  value: CollaborationType
  label: string
  description: string
}> = [
  {
    value: 'dialogue',
    label: 'Dialogue',
    description: 'Natural conversation to establish personalities and relationships',
  },
  {
    value: 'quest',
    label: 'Quest Co-Creation',
    description: 'NPCs collaborate to design a quest together',
  },
  {
    value: 'lore',
    label: 'Lore Building',
    description: 'NPCs share knowledge and stories to build world lore',
  },
  {
    value: 'relationship',
    label: 'Relationship Development',
    description: 'NPCs interact to build or develop relationship dynamics',
  },
  {
    value: 'freeform',
    label: 'Freeform',
    description: 'Open-ended interaction without specific structure',
  },
]

export const NPCCollaborationBuilder: React.FC<NPCCollaborationBuilderProps> = ({
  onCollaborationComplete,
}) => {
  const {
    isCollaborating,
    collaborationError,
    setCollaborating,
    setCollaborationError,
    addCollaboration,
  } = useMultiAgentStore()

  // Selective subscription for performance
  const generatedNPCs = useContentGenerationStore(state => state.npcs)

  // NPC Personas
  const [npcPersonas, setNpcPersonas] = useState<NPCPersona[]>([])

  // Collaboration Settings
  const [collaborationType, setCollaborationType] = useState<CollaborationType>('dialogue')
  const [rounds, setRounds] = useState(6)
  const [enableCrossValidation, setEnableCrossValidation] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)

  // Context
  const [location, setLocation] = useState('')
  const [situation, setSituation] = useState('')

  // NPC Creation Modal State
  const [showNPCModal, setShowNPCModal] = useState(false)
  const [newNPCName, setNewNPCName] = useState('')
  const [newNPCPersonality, setNewNPCPersonality] = useState('')
  const [newNPCArchetype, setNewNPCArchetype] = useState('')

  const handleAddNPC = () => {
    if (!newNPCName || !newNPCPersonality) {
      return
    }

    const persona: NPCPersona = {
      id: `npc_${Date.now()}`,
      name: newNPCName,
      personality: newNPCPersonality,
      archetype: newNPCArchetype || undefined,
      goals: [],
      specialties: [],
    }

    setNpcPersonas([...npcPersonas, persona])
    setNewNPCName('')
    setNewNPCPersonality('')
    setNewNPCArchetype('')
    setShowNPCModal(false)
  }

  const handleImportFromGenerated = (npc: GeneratedNPC) => {
    const persona: NPCPersona = {
      id: npc.id,
      name: npc.personality.name,
      personality: npc.personality.traits.join(', '),
      archetype: npc.personality.archetype,
      background: npc.personality.backstory,
      goals: npc.personality.goals || [],
    }

    setNpcPersonas([...npcPersonas, persona])
  }

  const handleRemoveNPC = (id: string) => {
    setNpcPersonas(npcPersonas.filter((npc) => npc.id !== id))
  }

  const handleStartCollaboration = async () => {
    if (npcPersonas.length < 2) {
      setCollaborationError('You need at least 2 NPCs for collaboration')
      return
    }

    setCollaborating(true)
    setCollaborationError(null)

    try {
      const request: CollaborationRequest = {
        npcPersonas,
        collaborationType,
        context: {
          location: location || undefined,
          situation: situation || undefined,
        },
        rounds,
        model: selectedModel,
        enableCrossValidation,
      }

      const response = await fetch(API_ENDPOINTS.npcCollaboration, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to start collaboration')
      }

      const session: CollaborationSession = await response.json()

      addCollaboration(session)
      onCollaborationComplete(session)

      // Reset form
      setNpcPersonas([])
      setLocation('')
      setSituation('')
    } catch (error) {
      console.error('Collaboration error:', error)
      setCollaborationError(
        error instanceof Error ? error.message : 'Failed to start collaboration'
      )
    } finally {
      setCollaborating(false)
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
          <Users size={20} />
          NPC Collaboration
        </h3>
        <p className="text-sm text-text-secondary">
          Multiple AI agents roleplay as NPCs to create authentic dialogue and emergent content
        </p>
      </div>

      {/* Error Display */}
      {collaborationError && (
        <Card className="p-4 bg-red-500 bg-opacity-10 border-red-500">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-400">{collaborationError}</div>
          </div>
        </Card>
      )}

      {/* NPC Personas */}
      <div>
        <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2 block">
          NPCs ({npcPersonas.length} selected, min: 2)
        </label>

        {/* NPC Cards */}
        <div className="space-y-2 mb-3">
          {npcPersonas.map((npc) => (
            <Card key={npc.id} className="p-3 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-text-primary">{npc.name}</h4>
                  {npc.archetype && (
                    <Badge variant="secondary" className="text-xs">
                      {npc.archetype}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-text-secondary">{npc.personality}</p>
              </div>
              <Button
                onClick={() => handleRemoveNPC(npc.id!)}
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
              >
                <X size={14} />
              </Button>
            </Card>
          ))}
        </div>

        {/* Add NPC Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => setShowNPCModal(true)}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            <Plus size={14} className="mr-1" />
            Create New NPC
          </Button>

          {generatedNPCs.length > 0 && (
            <div className="relative group">
              <Button variant="secondary" size="sm">
                <Plus size={14} className="mr-1" />
                Import from Generated ({generatedNPCs.length})
              </Button>

              {/* Dropdown */}
              <div className="absolute top-full left-0 mt-1 w-64 bg-bg-secondary border border-border-primary rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <div className="p-2 max-h-60 overflow-y-auto">
                  {generatedNPCs.map((npc) => (
                    <button
                      key={npc.id}
                      onClick={() => handleImportFromGenerated(npc)}
                      className="w-full text-left p-2 rounded hover:bg-bg-tertiary transition-colors"
                    >
                      <div className="font-medium text-text-primary text-sm">
                        {npc.personality.name}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {npc.personality.archetype}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NPC Creation Modal */}
      {showNPCModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h4 className="text-lg font-semibold text-text-primary">Create NPC Persona</h4>

            <div>
              <label className="text-sm font-semibold text-text-secondary mb-1 block">
                Name
              </label>
              <Input
                value={newNPCName}
                onChange={(e) => setNewNPCName(e.target.value)}
                placeholder="e.g., Wizard Aldric"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-text-secondary mb-1 block">
                Personality
              </label>
              <Input
                value={newNPCPersonality}
                onChange={(e) => setNewNPCPersonality(e.target.value)}
                placeholder="e.g., Wise, mysterious, patient"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-text-secondary mb-1 block">
                Archetype (optional)
              </label>
              <Input
                value={newNPCArchetype}
                onChange={(e) => setNewNPCArchetype(e.target.value)}
                placeholder="e.g., wizard, merchant, guard"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddNPC} variant="primary" className="flex-1">
                Add NPC
              </Button>
              <Button
                onClick={() => setShowNPCModal(false)}
                variant="ghost"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Collaboration Type */}
      <div>
        <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2 block">
          Collaboration Type
        </label>
        <div className="grid grid-cols-1 gap-2">
          {COLLABORATION_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setCollaborationType(type.value)}
              className={`p-3 rounded-lg text-left transition-all ${
                collaborationType === type.value
                  ? 'bg-primary bg-opacity-10 border-2 border-primary'
                  : 'bg-bg-tertiary border border-border-primary hover:bg-bg-primary'
              }`}
            >
              <div className="font-medium text-text-primary text-sm">{type.label}</div>
              <div className="text-xs text-text-tertiary mt-1">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Context */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide block">
          Context (Optional)
        </label>

        <div>
          <label className="text-xs text-text-tertiary mb-1 block">Location</label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Town square, Forest clearing"
          />
        </div>

        <div>
          <label className="text-xs text-text-tertiary mb-1 block">Situation</label>
          <Input
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g., First meeting, Discussing a problem"
          />
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide block">
          Settings
        </label>

        <div>
          <label className="text-xs text-text-tertiary mb-1 block">
            Conversation Rounds: {rounds}
          </label>
          <input
            type="range"
            min="3"
            max="15"
            value={rounds}
            onChange={(e) => setRounds(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs text-text-tertiary mb-1 block">AI Model (Optional)</label>
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableCrossValidation}
            onChange={(e) => setEnableCrossValidation(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-text-secondary">
            Enable Cross-Validation (reduces hallucinations by 40%)
          </span>
        </label>
      </div>

      {/* Start Button */}
      <Button
        onClick={handleStartCollaboration}
        disabled={isCollaborating || npcPersonas.length < 2}
        variant="primary"
        className="w-full"
      >
        {isCollaborating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
            Collaborating...
          </>
        ) : (
          <>
            <Sparkles size={16} className="mr-2" />
            Start Collaboration
          </>
        )}
      </Button>
    </Card>
  )
}
