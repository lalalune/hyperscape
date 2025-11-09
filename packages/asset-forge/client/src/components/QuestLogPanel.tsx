import React, { useState, useEffect } from 'react'
import { GameWindow } from './shared/GameWindow'
import type { ClientWorld } from '../types'
import { EventType } from '@hyperscape/shared'
import type {
  QuestProgress,
  QuestSummary,
  QuestObjective,
  QuestDefinition
} from '@hyperscape/shared'

interface QuestLogPanelProps {
  world: ClientWorld
  onClose: () => void
}

interface QuestWithDefinition extends QuestProgress {
  definition: QuestDefinition
}

export function QuestLogPanel({ world, onClose }: QuestLogPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [activeQuests, setActiveQuests] = useState<QuestWithDefinition[]>([])
  const [completedQuests, setCompletedQuests] = useState<QuestSummary[]>([])
  const [selectedQuest, setSelectedQuest] = useState<QuestWithDefinition | QuestSummary | null>(null)

  useEffect(() => {
    const player = world.entities?.player as { data?: { id?: string } }
    if (!player?.data?.id) return

    const playerId = player.data.id

    const handleQuestStarted = (data: {
      playerId: string
      questId: string
      quest: QuestDefinition
      progress: QuestProgress
    }) => {
      if (data.playerId !== playerId) return

      const questWithDef: QuestWithDefinition = {
        ...data.progress,
        definition: data.quest
      }

      setActiveQuests(prev => {
        const exists = prev.find(q => q.questId === data.questId)
        if (exists) return prev
        return [...prev, questWithDef]
      })
    }

    const handleQuestProgressed = (data: {
      playerId: string
      questId: string
      progress: QuestProgress
    }) => {
      if (data.playerId !== playerId) return

      setActiveQuests(prev =>
        prev.map(quest =>
          quest.questId === data.questId
            ? { ...quest, ...data.progress }
            : quest
        )
      )
    }

    const handleQuestCompleted = (data: {
      playerId: string
      questId: string
      quest: QuestDefinition
    }) => {
      if (data.playerId !== playerId) return

      setActiveQuests(prev => prev.filter(q => q.questId !== data.questId))

      const summary: QuestSummary = {
        questId: data.questId,
        name: data.quest.name,
        category: data.quest.category,
        status: 'completed',
        completionPercentage: 100,
        minLevel: data.quest.minLevel,
        isRepeatable: data.quest.isRepeatable
      }

      setCompletedQuests(prev => {
        const exists = prev.find(q => q.questId === data.questId)
        if (exists) return prev
        return [...prev, summary]
      })
    }

    world.on(EventType.QUEST_STARTED as never, handleQuestStarted as never)
    world.on(EventType.QUEST_PROGRESSED as never, handleQuestProgressed as never)
    world.on(EventType.QUEST_COMPLETED as never, handleQuestCompleted as never)

    return () => {
      world.off(EventType.QUEST_STARTED as never, handleQuestStarted as never)
      world.off(EventType.QUEST_PROGRESSED as never, handleQuestProgressed as never)
      world.off(EventType.QUEST_COMPLETED as never, handleQuestCompleted as never)
    }
  }, [world])

  const questsToDisplay = activeTab === 'active' ? activeQuests : completedQuests

  const isActiveQuest = (quest: QuestWithDefinition | QuestSummary): quest is QuestWithDefinition => {
    return 'definition' in quest
  }

  return (
    <GameWindow title="Quest Log" windowId="quest-log" onClose={onClose}>
      <div className="flex flex-col h-full">
        {/* Tab buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('active')}
            className="flex-1 px-4 py-2 rounded transition-all duration-150"
            style={{
              background: activeTab === 'active'
                ? 'linear-gradient(to bottom right, rgba(139, 69, 19, 0.9), rgba(101, 50, 15, 0.95))'
                : 'linear-gradient(to bottom right, rgba(60, 30, 10, 0.6), rgba(40, 20, 8, 0.7))',
              border: activeTab === 'active'
                ? '2px solid rgba(242, 208, 138, 0.6)'
                : '1px solid rgba(139, 69, 19, 0.6)',
              color: '#f2d08a',
              fontFamily: "'Cinzel', serif",
              fontWeight: activeTab === 'active' ? 'bold' : 'normal',
              boxShadow: activeTab === 'active'
                ? '0 4px 8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(242, 208, 138, 0.2)'
                : '0 2px 4px rgba(0, 0, 0, 0.4)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
            }}
          >
            Active ({activeQuests.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className="flex-1 px-4 py-2 rounded transition-all duration-150"
            style={{
              background: activeTab === 'completed'
                ? 'linear-gradient(to bottom right, rgba(139, 69, 19, 0.9), rgba(101, 50, 15, 0.95))'
                : 'linear-gradient(to bottom right, rgba(60, 30, 10, 0.6), rgba(40, 20, 8, 0.7))',
              border: activeTab === 'completed'
                ? '2px solid rgba(242, 208, 138, 0.6)'
                : '1px solid rgba(139, 69, 19, 0.6)',
              color: '#f2d08a',
              fontFamily: "'Cinzel', serif",
              fontWeight: activeTab === 'completed' ? 'bold' : 'normal',
              boxShadow: activeTab === 'completed'
                ? '0 4px 8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(242, 208, 138, 0.2)'
                : '0 2px 4px rgba(0, 0, 0, 0.4)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
            }}
          >
            Completed ({completedQuests.length})
          </button>
        </div>

        {/* Quest list and details */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Quest list */}
          <div
            className="w-1/2 overflow-y-auto pr-2"
            style={{
              borderRight: '1px solid rgba(139, 69, 19, 0.6)'
            }}
          >
            {questsToDisplay.length === 0 ? (
              <div
                className="text-center py-8"
                style={{
                  color: 'rgba(242, 208, 138, 0.6)',
                  fontStyle: 'italic'
                }}
              >
                {activeTab === 'active' ? 'No active quests' : 'No completed quests'}
              </div>
            ) : (
              questsToDisplay.map(quest => (
                <div
                  key={quest.questId}
                  onClick={() => setSelectedQuest(quest)}
                  className="mb-2 p-3 rounded cursor-pointer transition-all duration-150"
                  style={{
                    background: selectedQuest?.questId === quest.questId
                      ? 'linear-gradient(to bottom right, rgba(139, 69, 19, 0.6), rgba(101, 50, 15, 0.7))'
                      : 'linear-gradient(to bottom right, rgba(40, 20, 10, 0.4), rgba(30, 15, 8, 0.5))',
                    border: selectedQuest?.questId === quest.questId
                      ? '2px solid rgba(242, 208, 138, 0.5)'
                      : '1px solid rgba(139, 69, 19, 0.4)',
                    boxShadow: selectedQuest?.questId === quest.questId
                      ? '0 2px 8px rgba(242, 208, 138, 0.3)'
                      : '0 1px 4px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <div
                    className="font-semibold mb-1"
                    style={{
                      color: '#f2d08a',
                      fontFamily: "'Cinzel', serif",
                      fontSize: '0.95rem'
                    }}
                  >
                    {isActiveQuest(quest) ? quest.definition.name : quest.name}
                  </div>
                  {isActiveQuest(quest) && (
                    <div
                      className="text-sm"
                      style={{ color: 'rgba(242, 208, 138, 0.8)' }}
                    >
                      Progress: {quest.completionPercentage}%
                    </div>
                  )}
                  <div
                    className="text-xs mt-1"
                    style={{ color: 'rgba(242, 208, 138, 0.6)' }}
                  >
                    Level {isActiveQuest(quest) ? quest.definition.minLevel : quest.minLevel}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quest details */}
          <div className="w-1/2 overflow-y-auto pl-2">
            {selectedQuest ? (
              <div>
                <h3
                  className="text-lg font-bold mb-2"
                  style={{
                    color: '#f2d08a',
                    fontFamily: "'Cinzel', serif",
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  {isActiveQuest(selectedQuest) ? selectedQuest.definition.name : selectedQuest.name}
                </h3>

                {isActiveQuest(selectedQuest) && (
                  <>
                    <p
                      className="text-sm mb-4"
                      style={{
                        color: 'rgba(242, 208, 138, 0.9)',
                        lineHeight: '1.5'
                      }}
                    >
                      {selectedQuest.definition.description}
                    </p>

                    <div className="mb-4">
                      <h4
                        className="font-semibold mb-2"
                        style={{
                          color: '#f2d08a',
                          fontFamily: "'Cinzel', serif"
                        }}
                      >
                        Objectives:
                      </h4>
                      {selectedQuest.objectives.map((obj: QuestObjective) => (
                        <div
                          key={obj.id}
                          className="flex items-start mb-2 text-sm"
                          style={{ color: 'rgba(242, 208, 138, 0.9)' }}
                        >
                          <div
                            className="mr-2 mt-0.5"
                            style={{
                              width: '16px',
                              height: '16px',
                              border: '2px solid rgba(139, 69, 19, 0.8)',
                              borderRadius: '3px',
                              background: obj.completed
                                ? 'linear-gradient(to bottom right, rgba(34, 139, 34, 0.8), rgba(0, 100, 0, 0.9))'
                                : 'rgba(20, 15, 10, 0.6)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {obj.completed && (
                              <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div
                              style={{
                                textDecoration: obj.completed ? 'line-through' : 'none',
                                opacity: obj.completed ? 0.7 : 1
                              }}
                            >
                              {obj.description}
                            </div>
                            {!obj.completed && (
                              <div
                                className="text-xs mt-0.5"
                                style={{ color: 'rgba(242, 208, 138, 0.6)' }}
                              >
                                {obj.currentProgress}/{obj.requiredProgress}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedQuest.definition.rewards && (
                      <div>
                        <h4
                          className="font-semibold mb-2"
                          style={{
                            color: '#f2d08a',
                            fontFamily: "'Cinzel', serif"
                          }}
                        >
                          Rewards:
                        </h4>
                        {selectedQuest.definition.rewards.xp && Object.entries(selectedQuest.definition.rewards.xp).map(([skill, amount]) => (
                          <div
                            key={skill}
                            className="text-sm mb-1"
                            style={{ color: 'rgba(242, 208, 138, 0.8)' }}
                          >
                            • {amount} {skill} XP
                          </div>
                        ))}
                        {selectedQuest.definition.rewards.coins && selectedQuest.definition.rewards.coins > 0 && (
                          <div
                            className="text-sm mb-1"
                            style={{ color: 'rgba(242, 208, 138, 0.8)' }}
                          >
                            • {selectedQuest.definition.rewards.coins} coins
                          </div>
                        )}
                        {selectedQuest.definition.rewards.items && selectedQuest.definition.rewards.items.length > 0 && (
                          selectedQuest.definition.rewards.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="text-sm mb-1"
                              style={{ color: 'rgba(242, 208, 138, 0.8)' }}
                            >
                              • {item.quantity}x {item.itemId}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}

                {!isActiveQuest(selectedQuest) && (
                  <div
                    className="text-sm"
                    style={{
                      color: 'rgba(34, 139, 34, 0.9)',
                      fontWeight: 'bold'
                    }}
                  >
                    Quest Completed!
                  </div>
                )}
              </div>
            ) : (
              <div
                className="text-center py-8"
                style={{
                  color: 'rgba(242, 208, 138, 0.6)',
                  fontStyle: 'italic'
                }}
              >
                Select a quest to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </GameWindow>
  )
}
