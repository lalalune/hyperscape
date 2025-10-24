/**
 * NPC Script Generator
 * Generate NPC scripts with personality, dialogue, and services
 */

import { Users, Sparkles } from 'lucide-react'
import React, { useState } from 'react'

import { API_ENDPOINTS } from '../../config/api'
import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { usePreviewManifestsStore } from '../../store/usePreviewManifestsStore'
import { useRelationshipsStore } from '../../store/useRelationshipsStore'
import type { GeneratedNPC } from '../../types/content-generation'
import type { NPCManifest } from '../../types/manifests'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'
import { ModelSelector } from '../common/ModelSelector'

interface NPCReuseValidation {
  shouldReuse: boolean
  canReuse?: NPCManifest
  justification: string
  reuseScore?: number
}

interface NPCScriptGeneratorProps {
  onNPCGenerated: (npc: GeneratedNPC) => void
  onAIGenerate?: (prompt: string, archetype: string) => Promise<GeneratedNPC>
}

export const NPCScriptGenerator: React.FC<NPCScriptGeneratorProps> = ({
  onNPCGenerated,
  onAIGenerate
}) => {
  // Get store data for context-aware generation - selective subscriptions
  const quests = useContentGenerationStore(state => state.quests)
  const generatedNPCs = useContentGenerationStore(state => state.npcs)
  const { relationships } = useRelationshipsStore()
  const { addPreviews } = usePreviewManifestsStore()

  const [name, setName] = useState('')
  const [archetype, setArchetype] = useState('merchant')
  const [backstory, setBackstory] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [assignedQuests, setAssignedQuests] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [_reuseValidation, setReuseValidation] = useState<NPCReuseValidation | null>(null)
  
  // AI Generation
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiPrompt, setAIPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const archetypes = [
    { id: 'merchant', label: 'Merchant', traits: ['friendly', 'greedy', 'shrewd'] },
    { id: 'guard', label: 'Guard', traits: ['vigilant', 'stern', 'protective'] },
    { id: 'quest-giver', label: 'Quest Giver', traits: ['wise', 'mysterious', 'helpful'] },
    { id: 'banker', label: 'Banker', traits: ['trustworthy', 'formal', 'precise'] },
    { id: 'hermit', label: 'Hermit', traits: ['reclusive', 'wise', 'cryptic'] }
  ]

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      setGenerationError('Please describe the NPC you want to generate')
      return
    }
    
    setIsGenerating(true)
    setGenerationError(null)
    
    try {
      const response = await fetch(API_ENDPOINTS.generateNPC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archetype,
          prompt: aiPrompt,
          generatedNPCs,
          availableQuests: quests,
          relationships: relationships,
          model: selectedModel
        })
      })
      
      if (!response.ok) {
        let errorMessage = `API error: ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`
          }
          if (errorData.rawResponse) {
            console.error('Raw AI response:', errorData.rawResponse)
            errorMessage += ' (check console for raw response)'
          }
        } catch {
          // Couldn't parse error response, use status text
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const npcData = data.npc

      // Populate form with generated NPC
      setName(npcData.personality?.name || '')
      setBackstory(npcData.personality?.backstory || '')
      setServices(npcData.services || [])

      // Handle reuse validation
      if (data.reuseValidation) {
        setReuseValidation(data.reuseValidation)

        // BUG FIX: Check shouldReuse (boolean) instead of canReuse (NPC object)
        if (data.reuseValidation.shouldReuse) {
          console.log(`[NPCGenerator] REUSE RECOMMENDED: ${data.reuseValidation.justification}`)

          // Create preview manifest for the reuse recommendation
          addPreviews([{
            id: `reuse_${Date.now()}`,
            state: 'preview',
            manifestType: 'npcs',
            data: data.reuseValidation.canReuse,
            suggestedBy: 'ai',
            reason: data.reuseValidation.justification,
            requiredBy: [],
            conflicts: [],
            aiConfidence: data.reuseValidation.reuseScore || 80,
            validationScore: data.reuseValidation.reuseScore || 80,
            canUseExisting: true,
            suggestedExistingId: data.reuseValidation.canReuse?.id,
            reuseRecommendation: {
              shouldReuse: true,
              existingNPCId: data.reuseValidation.canReuse?.id,
              existingNPCName: data.reuseValidation.canReuse?.name,
              reuseReason: data.reuseValidation.justification
            },
            loreConsistency: data.reuseValidation.canReuse?.loreConsistency || {
              score: 0,
              referencesExistingCharacters: [],
              referencesExistingEvents: [],
              relationshipCount: 0,
              minimumRelationships: 2
            },
            metadata: {
              createdAt: new Date().toISOString(),
              source: 'npc_generation'
            }
          }])
        } else {
          console.log(`[NPCGenerator] New NPC justified: ${data.reuseValidation.justification}`)
        }
      }

      // Close AI generator
      setShowAIGenerator(false)
      setAIPrompt('')
      
    } catch (error) {
      console.error('Generation error:', error)
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate NPC')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerate = async () => {
    if (!name) return

//     const _selectedArchetype = archetypes.find(a => a.id === archetype)!

    if (onAIGenerate && backstory) {
      setGenerating(true)
      try {
        const npc = await onAIGenerate(backstory, archetype)
        onNPCGenerated(npc)
      } catch (error) {
        console.error('AI generation failed:', error)
        generateManually()
      } finally {
        setGenerating(false)
      }
    } else {
      generateManually()
    }
  }

  const generateManually = () => {
    const selectedArchetype = archetypes.find(a => a.id === archetype)!
    
    // Generate dialogues based on archetype
    const dialogues = archetype === 'quest-giver' && assignedQuests.length > 0
      ? [
          {
            id: 'greeting',
            text: `Greetings, traveler! I am ${name}. I have matters that need attention.`,
            responses: [
              {
                text: 'What do you need?',
                nextNodeId: 'quest_offer',
                questReference: assignedQuests[0]
              },
              { text: 'Goodbye', nextNodeId: 'farewell' }
            ]
          },
          {
            id: 'quest_offer',
            text: quests.find(q => q.id === assignedQuests[0])?.description || 'I need your help with something important.',
            responses: [
              {
                text: 'I accept',
                nextNodeId: 'quest_accepted',
                effects: [{ type: 'ACCEPT_QUEST', value: assignedQuests[0] }],
                questReference: assignedQuests[0]
              },
              { text: 'Not right now', nextNodeId: 'farewell' }
            ]
          },
          {
            id: 'quest_accepted',
            text: 'Excellent! Return to me when you have completed the task.',
            responses: [
              { text: 'I will', nextNodeId: 'farewell' }
            ]
          },
          {
            id: 'farewell',
            text: 'Safe travels, friend.',
            responses: []
          }
        ]
      : [
          {
            id: 'greeting',
            text: `Greetings, traveler! I am ${name}.`,
            responses: [
              { text: 'Hello', nextNodeId: 'main_menu' },
              { text: 'Goodbye', nextNodeId: 'farewell' }
            ]
          }
        ]
    
    const npc: GeneratedNPC = {
      id: `npc_${Date.now()}`,
      personality: {
        name,
        archetype,
        traits: selectedArchetype.traits,
        goals: [`Provide ${archetype} services`],
        moralAlignment: 'neutral',
        backstory: backstory || `A ${archetype} in the town`,
        questsOffered: assignedQuests
      },
      dialogues,
      behavior: {
        schedule: [
          { time: '08:00', location: 'shop', activity: 'working' },
          { time: '18:00', location: 'home', activity: 'resting' }
        ]
      },
      services,
      metadata: {
        createdAt: new Date().toISOString(),
        author: 'Asset Forge',
        version: '1.0.0'
      }
    }

    onNPCGenerated(npc)
    
    // Reset form
    setName('')
    setBackstory('')
    setServices([])
    setAssignedQuests([])
  }

  return (
    <div className="space-y-6">
      {/* AI Generator Toggle */}
      <Card className="p-4">
        <Button
          onClick={() => setShowAIGenerator(!showAIGenerator)}
          variant={showAIGenerator ? 'primary' : 'secondary'}
          size="sm"
          className="w-full"
        >
          <Sparkles size={14} className="mr-2" />
          {showAIGenerator ? 'Hide AI Generator' : 'Generate with AI'}
        </Button>
      </Card>
      
      {/* AI Generator Panel */}
      {showAIGenerator && (
        <Card className="p-6 bg-primary bg-opacity-5 border-primary animate-fade-in">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            AI NPC Generator
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Archetype</label>
              <select
                value={archetype}
                onChange={(e) => setArchetype(e.target.value)}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary"
              >
                {archetypes.map((arch) => (
                  <option key={arch.id} value={arch.id}>
                    {arch.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Describe Your NPC</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAIPrompt(e.target.value)}
                placeholder="e.g., A grumpy old blacksmith who lost his leg to a dragon and now runs the town's only smithy..."
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary resize-none focus:outline-none focus:border-primary"
                rows={3}
              />
            </div>
            
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
            
            <Button
              onClick={handleAIGenerate}
              disabled={isGenerating || !aiPrompt.trim()}
              variant="primary"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Sparkles size={14} className="mr-2 animate-spin" />
                  Generating NPC...
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-2" />
                  Generate NPC with AI
                </>
              )}
            </Button>
            
            {generationError && (
              <div className="p-3 bg-red-500 bg-opacity-10 rounded-lg text-sm text-red-400">
                {generationError}
              </div>
            )}
          </div>
        </Card>
      )}
      
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-text-primary">Create NPC</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Merchant Bob..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Archetype</label>
            <select
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary"
            >
              {archetypes.map((arch) => (
                <option key={arch.id} value={arch.id}>
                  {arch.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Backstory (Optional - for AI)</label>
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="A grumpy merchant who lost his best customer..."
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Services</label>
            <div className="flex flex-wrap gap-2">
              {['bank', 'shop', 'quest', 'teleport'].map((service) => (
                <button
                  key={service}
                  onClick={() => {
                    if (services.includes(service)) {
                      setServices(services.filter(s => s !== service))
                    } else {
                      setServices([...services, service])
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    services.includes(service)
                      ? 'bg-primary bg-opacity-20 text-primary border-2 border-primary'
                      : 'bg-bg-secondary text-text-secondary border-2 border-border-primary hover:border-primary'
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          {/* Quest Assignment - only show for quest-giver archetype */}
          {archetype === 'quest-giver' && quests.length > 0 && (
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">
                Assigned Quests
              </label>
              <div className="space-y-2">
                {quests.map((quest) => (
                  <button
                    key={quest.id}
                    onClick={() => {
                      if (assignedQuests.includes(quest.id)) {
                        setAssignedQuests(assignedQuests.filter(q => q !== quest.id))
                      } else {
                        setAssignedQuests([...assignedQuests, quest.id])
                      }
                    }}
                    className={`w-full p-3 text-left rounded-lg transition-all ${
                      assignedQuests.includes(quest.id)
                        ? 'bg-primary bg-opacity-20 text-primary border-2 border-primary'
                        : 'bg-bg-secondary text-text-secondary border-2 border-border-primary hover:border-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{quest.title}</span>
                      <Badge variant="secondary">{quest.difficulty}</Badge>
                    </div>
                    <p className="text-xs mt-1 opacity-75">{quest.objectives.length} objectives</p>
                  </button>
                ))}
              </div>
              {assignedQuests.length > 0 && (
                <p className="text-xs text-text-tertiary mt-2">
                  {assignedQuests.length} quest{assignedQuests.length !== 1 ? 's' : ''} assigned
                </p>
              )}
            </div>
          )}

          {archetype === 'quest-giver' && quests.length === 0 && (
            <div className="p-3 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-tertiary text-center">
              Create quests in the Quests tab first to assign them to this NPC
            </div>
          )}
        </div>
      </Card>

      <Button
        onClick={handleGenerate}
        disabled={!name || generating}
        className="w-full"
        size="lg"
      >
        {generating ? (
          <>Generating NPC...</>
        ) : onAIGenerate && backstory ? (
          <>
            <Sparkles size={16} className="mr-2" />
            AI Generate NPC
          </>
        ) : (
          <>Create NPC</>
        )}
      </Button>
    </div>
  )
}

