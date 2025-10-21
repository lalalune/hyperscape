/**
 * Content Generation Page
 * Generate quests, NPCs, and lore using real game data
 */

import { Download, FileJson, Trash2, Target, FileCode } from 'lucide-react'
import React from 'react'

import { QuestBuilder, NPCScriptGenerator, LoreGenerator, QuestTracker, NPCScriptBuilder } from '../components/GameContent'
import { Button, Card } from '../components/common'
import { Badge } from '../components/common/Badge'
import { useContentGenerationStore } from '../store/useContentGenerationStore'
import { validateQuest } from '../utils/quest-validator'
import type { GeneratedQuest, GeneratedNPC, LoreEntry } from '../types/content-generation'

export const ContentGenerationPage: React.FC = () => {
  const {
    activeTab,
    quests,
    npcs,
    loreEntries,
    selectedQuest,
    selectedNPC,
    selectedLore,
    setActiveTab,
    addQuest,
    addNPC,
    addLore,
    setSelectedQuest,
    setSelectedNPC,
    setSelectedLore,
    deleteQuest,
    deleteNPC,
    deleteLore,
    createPack,
    clearAll
  } = useContentGenerationStore()

  const handleExportPack = () => {
    const pack = createPack('My Content Pack', 'Generated with Asset Forge')
    
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-pack-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalItems = quests.length + npcs.length + loreEntries.length

  return (
    <div className="page-container-no-padding flex-col">
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden min-h-0">
        {/* Header */}
        <div className="animate-slide-in-down">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Game Content Generator</h1>
              <p className="text-text-secondary mt-1">
                Create quests, NPCs, and lore using real game data
              </p>
            </div>
            <div className="flex items-center gap-2">
              {totalItems > 0 && (
                <>
                  <Button onClick={handleExportPack} variant="primary">
                    <Download size={16} className="mr-2" />
                    Export Pack ({totalItems})
                  </Button>
                  <Button onClick={clearAll} variant="ghost">
                    <Trash2 size={16} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 bg-bg-secondary border border-border-primary rounded-xl p-2">
            <button
              onClick={() => setActiveTab('quest')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'quest'
                  ? 'bg-primary bg-opacity-10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              Quests ({quests.length})
            </button>
            <button
              onClick={() => setActiveTab('npc')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'npc'
                  ? 'bg-primary bg-opacity-10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              NPCs ({npcs.length})
            </button>
            <button
              onClick={() => setActiveTab('lore')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'lore'
                  ? 'bg-primary bg-opacity-10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              Lore ({loreEntries.length})
            </button>
            {npcs.length > 0 && (
              <button
                onClick={() => setActiveTab('scripts')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'scripts'
                    ? 'bg-primary bg-opacity-10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                <FileCode size={14} className="inline mr-1" />
                Scripts
              </button>
            )}
            {quests.length > 0 && (
              <button
                onClick={() => setActiveTab('tracking')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'tracking'
                    ? 'bg-primary bg-opacity-10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                <Target size={14} className="inline mr-1" />
                Tracking
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Special full-width tabs: Tracking and Scripts */}
          {activeTab === 'tracking' ? (
            <div className="flex-1 overflow-auto animate-fade-in">
              <QuestTracker />
            </div>
          ) : activeTab === 'scripts' ? (
            <div className="flex-1 overflow-auto animate-fade-in">
              <NPCScriptBuilder />
            </div>
          ) : (
            <>
              {/* Builder Section */}
              <div className="w-96 min-w-[24rem] overflow-auto animate-slide-in-left">
                {activeTab === 'quest' && <QuestBuilder onQuestGenerated={addQuest} />}
                {activeTab === 'npc' && <NPCScriptGenerator onNPCGenerated={addNPC} />}
                {activeTab === 'lore' && <LoreGenerator onLoreGenerated={addLore} />}
              </div>

          {/* Generated Items List */}
          <div className="flex-1 overflow-auto animate-fade-in">
            <Card className="h-full p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Generated {activeTab === 'quest' ? 'Quests' : activeTab === 'npc' ? 'NPCs' : 'Lore'}
              </h3>

              {activeTab === 'quest' && (
                <div className="space-y-3">
                  {quests.map((quest) => {
                    const validation = validateQuest(quest)
                    return (
                      <Card
                        key={quest.id}
                        className={`p-4 cursor-pointer transition-all ${
                          selectedQuest?.id === quest.id
                            ? 'border-2 border-primary bg-primary bg-opacity-5'
                            : 'hover:bg-bg-tertiary'
                        }`}
                        onClick={() => setSelectedQuest(quest)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-text-primary">{quest.title}</h4>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteQuest(quest.id)
                            }}
                            variant="ghost"
                            size="sm"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <p className="text-sm text-text-secondary mb-2 line-clamp-2">{quest.description}</p>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="secondary">{quest.difficulty}</Badge>
                          <Badge variant="secondary">{quest.objectives.length} objectives</Badge>
                          <Badge variant="secondary">{quest.rewards.experience} XP</Badge>
                          {validation.valid ? (
                            <Badge variant="secondary" className="text-green-500">✓ Valid</Badge>
                          ) : (
                            <Badge variant="error">{validation.errors.length} errors</Badge>
                          )}
                        </div>
                        {!validation.valid && validation.errors.length > 0 && (
                          <div className="mt-2 p-2 bg-red-500 bg-opacity-10 rounded text-xs text-red-400">
                            {validation.errors[0]}
                          </div>
                        )}
                      </Card>
                    )
                  })}
                  {quests.length === 0 && (
                    <p className="text-text-tertiary text-center py-8">No quests generated yet</p>
                  )}
                </div>
              )}

              {activeTab === 'npc' && (
                <div className="space-y-3">
                  {npcs.map((npc) => (
                    <Card
                      key={npc.id}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedNPC?.id === npc.id
                          ? 'border-2 border-primary bg-primary bg-opacity-5'
                          : 'hover:bg-bg-tertiary'
                      }`}
                      onClick={() => setSelectedNPC(npc)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-text-primary">{npc.personality.name}</h4>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNPC(npc.id)
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{npc.personality.archetype}</Badge>
                        {npc.services?.map(service => (
                          <Badge key={service} variant="secondary">{service}</Badge>
                        ))}
                      </div>
                    </Card>
                  ))}
                  {npcs.length === 0 && (
                    <p className="text-text-tertiary text-center py-8">No NPCs generated yet</p>
                  )}
                </div>
              )}

              {activeTab === 'lore' && (
                <div className="space-y-3">
                  {loreEntries.map((lore) => (
                    <Card
                      key={lore.id}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedLore?.id === lore.id
                          ? 'border-2 border-primary bg-primary bg-opacity-5'
                          : 'hover:bg-bg-tertiary'
                      }`}
                      onClick={() => setSelectedLore(lore)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-text-primary">{lore.title}</h4>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteLore(lore.id)
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <p className="text-sm text-text-secondary mb-2 line-clamp-2">{lore.content}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{lore.category}</Badge>
                        {lore.relatedEntities.length > 0 && (
                          <Badge variant="secondary">{lore.relatedEntities.length} entities</Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                  {loreEntries.length === 0 && (
                    <p className="text-text-tertiary text-center py-8">No lore entries generated yet</p>
                  )}
                </div>
              )}
            </Card>
          </div>

              {/* Details Panel */}
              {(selectedQuest || selectedNPC || selectedLore) && (
                <div className="w-96 min-w-[24rem] overflow-auto animate-slide-in-right">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">Details</h3>
                
                {selectedQuest && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Objectives</label>
                      <div className="mt-2 space-y-2">
                        {selectedQuest.objectives.map((obj) => (
                          <div key={obj.id} className="p-2 bg-bg-tertiary rounded text-sm">
                            <p className="text-text-primary">{obj.description}</p>
                            {obj.targetData && (
                              <p className="text-text-tertiary text-xs mt-1">
                                Target: {'name' in obj.targetData ? obj.targetData.name : ''}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Rewards</label>
                      <div className="mt-2 space-y-1 text-sm text-text-primary">
                        <p>{selectedQuest.rewards.experience} XP</p>
                        <p>{selectedQuest.rewards.gold} Gold</p>
                        {selectedQuest.rewards.items?.map((item, idx) => (
                          <p key={idx}>
                            {item.quantity}x {item.itemData?.name || item.itemId}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedNPC && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Personality</label>
                      <div className="mt-2 space-y-1 text-sm text-text-primary">
                        <p><strong>Archetype:</strong> {selectedNPC.personality.archetype}</p>
                        <p><strong>Traits:</strong> {selectedNPC.personality.traits.join(', ')}</p>
                        {selectedNPC.personality.backstory && (
                          <p className="text-text-secondary mt-2">{selectedNPC.personality.backstory}</p>
                        )}
                      </div>
                    </div>
                    
                    {selectedNPC.services && selectedNPC.services.length > 0 && (
                      <div>
                        <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Services</label>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {selectedNPC.services.map(service => (
                            <Badge key={service} variant="secondary">{service}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedLore && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Content</label>
                      <p className="mt-2 text-sm text-text-primary whitespace-pre-wrap">
                        {selectedLore.content}
                      </p>
                    </div>
                    
                    {selectedLore.relatedEntities.length > 0 && (
                      <div>
                        <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Related Entities</label>
                        <div className="mt-2 space-y-1">
                          {selectedLore.relatedEntities.map((entity) => (
                            <div key={entity.id} className="flex items-center gap-2 text-sm">
                              <Badge variant="secondary" className="text-xs">{entity.type}</Badge>
                              <span className="text-text-primary">{entity.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                    {/* Raw JSON */}
                    <details className="mt-4 cursor-pointer">
                      <summary className="text-sm font-semibold text-text-secondary uppercase tracking-wide select-none">
                        Raw JSON
                      </summary>
                      <pre className="mt-2 bg-bg-primary rounded-lg p-3 text-xs overflow-auto max-h-60">
                        {JSON.stringify(selectedQuest || selectedNPC || selectedLore, null, 2)}
                      </pre>
                    </details>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

