/**
 * Quest Builder
 * Create quests using real items, mobs, and NPCs from game manifests
 */

import { Plus, Trash2, Target, Gift, Sparkles } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { API_ENDPOINTS } from '../../config/api'
import { manifestService } from '../../services/ManifestService'
import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { usePreviewManifestsStore } from '../../store/usePreviewManifestsStore'
import { useRelationshipsStore } from '../../store/useRelationshipsStore'
import type { GeneratedQuest, QuestObjective, QuestReward } from '../../types/content-generation'
import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest } from '../../types/manifests'
import type { ManifestGap } from '../../types/preview-manifests'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'
import { ModelSelector } from '../common/ModelSelector'

import { ActionHandlerSelector } from './ActionHandlerSelector'

interface QuestBuilderProps {
  onQuestGenerated: (quest: GeneratedQuest) => void
}

export const QuestBuilder: React.FC<QuestBuilderProps> = ({ onQuestGenerated }) => {
  // Get store data for context-aware generation - selective subscriptions
  const selectedContext = useContentGenerationStore(state => state.selectedContext)
  const existingQuests = useContentGenerationStore(state => state.quests)
  const { relationships } = useRelationshipsStore()
  const { addGap, addPreviews } = usePreviewManifestsStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<GeneratedQuest['difficulty']>('medium')
  const [objectives, setObjectives] = useState<QuestObjective[]>([])
  const [rewards, setRewards] = useState<QuestReward>({
    experience: 100,
    gold: 50,
    items: []
  })
  
  // Manifest data
  const [items, setItems] = useState<ItemManifest[]>([])
  const [mobs, setMobs] = useState<MobManifest[]>([])
  const [npcs, setNPCs] = useState<NPCManifest[]>([])
  const [resources, setResources] = useState<ResourceManifest[]>([])
  const [loading, setLoading] = useState(true)
  
  // Quest giver
  const [questGiver, setQuestGiver] = useState<string | undefined>()
  const [questGiverData, setQuestGiverData] = useState<NPCManifest | undefined>()
  
  // AI Generation
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiPrompt, setAIPrompt] = useState('')
  const [aiQuestType, setAIQuestType] = useState('combat')
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  // Load manifests
  useEffect(() => {
    loadManifests()
  }, [])

  const loadManifests = async () => {
    try {
      const [itemsData, mobsData, npcsData, resourcesData] = await Promise.all([
        manifestService.getItems(),
        manifestService.getMobs(),
        manifestService.getNPCs(),
        manifestService.getResources()
      ])
      setItems(itemsData)
      setMobs(mobsData)
      setNPCs(npcsData)
      setResources(resourcesData)
    } catch (error) {
      console.error('Failed to load manifests:', error)
    } finally {
      setLoading(false)
    }
  }

  const addObjective = () => {
    const newObjective: QuestObjective = {
      id: `obj_${Date.now()}`,
      type: 'combat',
      description: '',
      optional: false
    }
    setObjectives([...objectives, newObjective])
  }

  const updateObjective = (id: string, updates: Partial<QuestObjective>) => {
    setObjectives(objectives.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    ))
  }

  const deleteObjective = (id: string) => {
    setObjectives(objectives.filter(obj => obj.id !== id))
  }

  const addRewardItem = () => {
    if (rewards.items) {
      setRewards({
        ...rewards,
        items: [...rewards.items, { itemId: '', quantity: 1 }]
      })
    } else {
      setRewards({
        ...rewards,
        items: [{ itemId: '', quantity: 1 }]
      })
    }
  }

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      setGenerationError('Please describe the quest you want to generate')
      return
    }
    
    setIsGenerating(true)
    setGenerationError(null)
    
    try {
      const response = await fetch(API_ENDPOINTS.generateQuest, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questType: aiQuestType,
          prompt: aiPrompt,
          difficulty,
          selectedContext,
          existingQuests,
          relationships: relationships,
          manifests: {
            items,
            mobs,
            npcs,
            resources
          },
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
      const quest = data.quest

      // Populate form with generated quest
      setTitle(quest.title)
      setDescription(quest.description)
      setDifficulty(quest.difficulty)
      setObjectives(quest.objectives || [])
      setRewards(quest.rewards)
      if (quest.questGiver) {
        setQuestGiver(quest.questGiver)
      }

      // Handle manifest gaps and suggestions
      if (data.manifestGaps && data.manifestGaps.length > 0) {
        console.log(`[QuestBuilder] Found ${data.manifestGaps.length} manifest gaps`)
        data.manifestGaps.forEach((gap: ManifestGap) => addGap(gap))
      }

      if (data.manifestSuggestions && data.manifestSuggestions.length > 0) {
        console.log(`[QuestBuilder] Received ${data.manifestSuggestions.length} AI suggestions`)
        addPreviews(data.manifestSuggestions)
      }

      // Close AI generator
      setShowAIGenerator(false)
      setAIPrompt('')
      
    } catch (error) {
      console.error('Generation error:', error)
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate quest')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerate = () => {
    if (!title || !description) {
      return
    }

    const quest: GeneratedQuest = {
      id: `quest_${Date.now()}`,
      title,
      description,
      difficulty,
      estimatedDuration: objectives.length * 10, // Rough estimate
      questGiver,
      questGiverData,
      objectives,
      rewards,
      tags: [difficulty, ...objectives.map(o => o.type)],
      metadata: {
        createdAt: new Date().toISOString(),
        author: 'Asset Forge',
        version: '1.0.0'
      }
    }

    onQuestGenerated(quest)
    
    // Reset form
    setTitle('')
    setDescription('')
    setObjectives([])
    setRewards({ experience: 100, gold: 50, items: [] })
    setQuestGiver(undefined)
    setQuestGiverData(undefined)
  }

  if (loading) {
    return <div className="p-6 text-text-secondary">Loading game data...</div>
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
            AI Quest Generator
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Describe Your Quest</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAIPrompt(e.target.value)}
                placeholder="e.g., A beginner quest where players hunt goblins that are terrorizing a village..."
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary resize-none focus:outline-none focus:border-primary"
                rows={3}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Quest Type</label>
              <select
                value={aiQuestType}
                onChange={(e) => setAIQuestType(e.target.value)}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary"
              >
                <option value="combat">Combat</option>
                <option value="gathering">Gathering</option>
                <option value="crafting">Crafting</option>
                <option value="exploration">Exploration</option>
                <option value="social">Social/Investigation</option>
                <option value="epic_chain">Epic Chain</option>
              </select>
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
                  Generating Quest...
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-2" />
                  Generate Quest with AI
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
      
      {/* Quest Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Quest Details</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Missing Hatchet..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A woodcutter has lost his bronze hatchet..."
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Quest Giver (Optional)</label>
            <select
              value={questGiver || ''}
              onChange={(e) => {
                const npc = npcs.find(n => n.id === e.target.value)
                setQuestGiver(e.target.value || undefined)
                setQuestGiverData(npc)
              }}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary"
            >
              <option value="">No Quest Giver</option>
              {npcs.map((npc) => (
                <option key={npc.id} value={npc.id}>
                  {npc.name} ({npc.type})
                </option>
              ))}
            </select>
            {questGiverData && (
              <p className="text-xs text-text-tertiary mt-1">
                {questGiverData.description}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as GeneratedQuest['difficulty'])}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary"
            >
              <option value="trivial">Trivial</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="epic">Epic</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Objectives */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-text-primary">Objectives</h3>
          </div>
          <Button onClick={addObjective} size="sm">
            <Plus size={16} className="mr-2" />
            Add Objective
          </Button>
        </div>

        <div className="space-y-3">
          {objectives.map((obj) => (
            <Card key={obj.id} className="p-4 bg-bg-tertiary">
              <div className="space-y-3">
                {/* Action Handler Selector */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-2">Action Handler</label>
                  <ActionHandlerSelector
                    value={obj.actionHandler}
                    onChange={(action) => {
                      updateObjective(obj.id, {
                        actionHandler: action,
                        target: undefined,
                        targetData: undefined,
                        targetMob: undefined,
                        targetResource: undefined
                      })
                    }}
                  />
                </div>

                {/* Target Selection Based on Action Handler */}
                {obj.actionHandler === 'ATTACK_MOB' && (
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-2">Target Mob</label>
                    <select
                      value={obj.target || ''}
                      onChange={(e) => {
                        const mobData = mobs.find(m => m.id === e.target.value)
                        updateObjective(obj.id, {
                          target: e.target.value,
                          targetMob: mobData,
                          targetData: mobData,
                          description: `Kill ${obj.quantity || 1} ${mobData?.name || 'mob'}`
                        })
                      }}
                      className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm"
                    >
                      <option value="">Select Mob...</option>
                      {mobs.map((mob) => (
                        <option key={mob.id} value={mob.id}>
                          {mob.name} (Lv{mob.stats?.level || mob.level || '?'}) - {mob.xpReward || 0} XP
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {obj.actionHandler === 'CHOP_TREE' && (
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-2">Resource Type</label>
                    <select
                      value={obj.target || ''}
                      onChange={(e) => {
                        const resourceData = resources.find(r => r.id === e.target.value)
                        updateObjective(obj.id, {
                          target: e.target.value,
                          targetResource: resourceData,
                          description: `Chop ${obj.quantity || 1} ${resourceData?.name || 'tree'}`
                        })
                      }}
                      className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm"
                    >
                      <option value="">Select Resource...</option>
                      {resources.filter(r => r.type === 'tree').map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name} (Level {resource.requiredLevel})
                        </option>
                      ))}
                    </select>
                    {obj.targetResource && (
                      <p className="text-xs text-text-tertiary mt-1">
                        Harvest time: {obj.targetResource.harvestTime}ms | 
                        Yields: {obj.targetResource.harvestYield.map(y => `${y.quantity}x ${y.itemId}`).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {obj.actionHandler === 'CATCH_FISH' && (
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-2">Fish Type</label>
                    <select
                      value={obj.target || ''}
                      onChange={(e) => {
                        const resourceData = resources.find(r => r.id === e.target.value)
                        updateObjective(obj.id, {
                          target: e.target.value,
                          targetResource: resourceData,
                          description: `Catch ${obj.quantity || 1} ${resourceData?.name || 'fish'}`
                        })
                      }}
                      className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm"
                    >
                      <option value="">Any Fish</option>
                      {resources.filter(r => r.type === 'fishing').map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quantity and Delete */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-text-secondary block mb-2">Quantity</label>
                    <Input
                      type="number"
                      value={obj.quantity || 1}
                      onChange={(e) => updateObjective(obj.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="w-full"
                      placeholder="Quantity"
                    />
                  </div>
                  <Button
                    onClick={() => deleteObjective(obj.id)}
                    variant="ghost"
                    size="sm"
                    className="mt-5"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-2">Description</label>
                  <Input
                    value={obj.description}
                    onChange={(e) => updateObjective(obj.id, { description: e.target.value })}
                    placeholder="Objective description..."
                    className="text-sm"
                  />
                </div>

                {/* Target Data Display */}
                {obj.targetMob && (
                  <div className="p-2 bg-bg-secondary rounded text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Mob:</span>
                      <span className="text-text-primary font-medium">{obj.targetMob.name}</span>
                    </div>
                    {obj.targetMob.stats && (
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Level:</span>
                        <span className="text-text-primary">{obj.targetMob.stats.level || obj.targetMob.level || '?'}</span>
                      </div>
                    )}
                    {obj.targetMob.xpReward && (
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">XP Reward:</span>
                        <span className="text-text-primary">{obj.targetMob.xpReward} XP</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}

          {objectives.length === 0 && (
            <p className="text-text-tertiary text-sm text-center py-4">
              No objectives yet. Click "Add Objective" to start.
            </p>
          )}
        </div>
      </Card>

      {/* Rewards */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift size={20} className="text-accent" />
          <h3 className="text-lg font-semibold text-text-primary">Rewards</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Experience</label>
              <Input
                type="number"
                value={rewards.experience}
                onChange={(e) => setRewards({ ...rewards, experience: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Gold</label>
              <Input
                type="number"
                value={rewards.gold}
                onChange={(e) => setRewards({ ...rewards, gold: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-secondary">Item Rewards</label>
              <Button onClick={addRewardItem} size="sm" variant="ghost">
                <Plus size={16} className="mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {rewards.items?.map((rewardItem, idx) => (
                <div key={rewardItem.itemId || `reward-${idx}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={rewardItem.itemId}
                      onChange={(e) => {
                        const itemData = items.find(i => i.id === e.target.value)
                        const newItems = [...(rewards.items || [])]
                        newItems[idx] = { ...rewardItem, itemId: e.target.value, itemData }
                        setRewards({ ...rewards, items: newItems })
                      }}
                      className="flex-1 px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm"
                    >
                      <option value="">Select Item...</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} - {item.value || 0}g
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      value={rewardItem.quantity}
                      onChange={(e) => {
                        const newItems = [...(rewards.items || [])]
                        newItems[idx] = { ...rewardItem, quantity: parseInt(e.target.value) || 1 }
                        setRewards({ ...rewards, items: newItems })
                      }}
                      className="w-20"
                      placeholder="Qty"
                    />
                    <Button
                      onClick={() => {
                        const newItems = rewards.items?.filter((_, i) => i !== idx)
                        setRewards({ ...rewards, items: newItems })
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  {rewardItem.itemData && (
                    <div className="p-2 bg-bg-secondary rounded text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Type:</span>
                        <span className="text-text-primary">{rewardItem.itemData.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Value:</span>
                        <span className="text-text-primary">{rewardItem.itemData.value || 0}g</span>
                      </div>
                      {rewardItem.itemData.description && (
                        <p className="text-text-tertiary italic">{rewardItem.itemData.description}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!title || !description || objectives.length === 0}
        className="w-full"
        size="lg"
      >
        Generate Quest
      </Button>
    </div>
  )
}

