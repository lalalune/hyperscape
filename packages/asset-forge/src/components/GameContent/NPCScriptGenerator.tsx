/**
 * NPC Script Generator
 * Generate NPC scripts with personality, dialogue, and services
 */

import { Users, Sparkles } from 'lucide-react'
import React, { useState } from 'react'

import type { GeneratedNPC } from '../../types/content-generation'
import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'
import { Badge } from '../common/Badge'

interface NPCScriptGeneratorProps {
  onNPCGenerated: (npc: GeneratedNPC) => void
  onAIGenerate?: (prompt: string, archetype: string) => Promise<GeneratedNPC>
}

export const NPCScriptGenerator: React.FC<NPCScriptGeneratorProps> = ({
  onNPCGenerated,
  onAIGenerate
}) => {
  const { quests } = useContentGenerationStore()
  const [name, setName] = useState('')
  const [archetype, setArchetype] = useState('merchant')
  const [backstory, setBackstory] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [assignedQuests, setAssignedQuests] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  const archetypes = [
    { id: 'merchant', label: 'Merchant', traits: ['friendly', 'greedy', 'shrewd'] },
    { id: 'guard', label: 'Guard', traits: ['vigilant', 'stern', 'protective'] },
    { id: 'quest-giver', label: 'Quest Giver', traits: ['wise', 'mysterious', 'helpful'] },
    { id: 'banker', label: 'Banker', traits: ['trustworthy', 'formal', 'precise'] },
    { id: 'hermit', label: 'Hermit', traits: ['reclusive', 'wise', 'cryptic'] }
  ]

  const handleGenerate = async () => {
    if (!name) return

    const selectedArchetype = archetypes.find(a => a.id === archetype)!

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

