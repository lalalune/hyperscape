import React, { useState, useEffect } from 'react'
import type { ClientWorld } from '../types'
import { EventType } from '@hyperscape/shared'
import type {
  QuestProgress,
  QuestDefinition,
  QuestObjective
} from '@hyperscape/shared'

interface QuestTrackerProps {
  world: ClientWorld
}

interface TrackedQuest {
  questId: string
  name: string
  objectives: QuestObjective[]
}

export function QuestTracker({ world }: QuestTrackerProps) {
  const [activeQuests, setActiveQuests] = useState<TrackedQuest[]>([])
  const [collapsed, setCollapsed] = useState(false)

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

      const trackedQuest: TrackedQuest = {
        questId: data.questId,
        name: data.quest.name,
        objectives: data.progress.objectives
      }

      setActiveQuests(prev => {
        const exists = prev.find(q => q.questId === data.questId)
        if (exists) return prev
        return [...prev, trackedQuest]
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
            ? { ...quest, objectives: data.progress.objectives }
            : quest
        )
      )
    }

    const handleQuestCompleted = (data: {
      playerId: string
      questId: string
    }) => {
      if (data.playerId !== playerId) return

      setActiveQuests(prev => prev.filter(q => q.questId !== data.questId))
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

  if (activeQuests.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 pointer-events-auto z-[100]"
      style={{
        background: 'linear-gradient(135deg, rgba(20, 15, 10, 0.85) 0%, rgba(15, 10, 5, 0.9) 100%)',
        backdropFilter: 'blur(8px)',
        border: '2px solid rgba(139, 69, 19, 0.6)',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '250px',
        maxWidth: '300px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(242, 208, 138, 0.15)'
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3
          style={{
            color: '#f2d08a',
            fontFamily: "'Cinzel', serif",
            fontSize: '1rem',
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
          }}
        >
          Quests
        </h3>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-6 h-6 rounded flex items-center justify-center transition-all duration-150 hover:scale-110"
          style={{
            background: 'linear-gradient(to bottom right, rgba(139, 69, 19, 0.7), rgba(101, 50, 15, 0.8))',
            border: '1px solid rgba(242, 208, 138, 0.4)',
            color: '#f2d08a',
            fontSize: '0.75rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.6)'
          }}
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div>
          {activeQuests.slice(0, 3).map(quest => {
            const incompleteObjectives = quest.objectives.filter(obj => !obj.completed)
            const objectivesToShow = incompleteObjectives.length > 0 ? incompleteObjectives : quest.objectives

            return (
              <div
                key={quest.questId}
                className="mb-3 pb-3"
                style={{
                  borderBottom: '1px solid rgba(139, 69, 19, 0.4)'
                }}
              >
                <div
                  className="mb-1.5 font-semibold"
                  style={{
                    color: '#f2d08a',
                    fontSize: '0.9rem',
                    fontFamily: "'Cinzel', serif"
                  }}
                >
                  {quest.name}
                </div>
                {objectivesToShow.slice(0, 3).map(obj => (
                  <div
                    key={obj.id}
                    className="flex items-start text-sm mb-1"
                    style={{ color: 'rgba(242, 208, 138, 0.85)' }}
                  >
                    <div
                      className="mr-2 mt-0.5"
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '1.5px solid rgba(139, 69, 19, 0.8)',
                        borderRadius: '2px',
                        background: obj.completed
                          ? 'linear-gradient(to bottom right, rgba(34, 139, 34, 0.8), rgba(0, 100, 0, 0.9))'
                          : 'rgba(20, 15, 10, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.6)'
                      }}
                    >
                      {obj.completed && (
                        <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                      )}
                    </div>
                    <div
                      className="flex-1"
                      style={{
                        textDecoration: obj.completed ? 'line-through' : 'none',
                        opacity: obj.completed ? 0.6 : 1
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.85rem',
                          lineHeight: '1.3'
                        }}
                      >
                        {obj.description}
                      </div>
                      {!obj.completed && obj.requiredProgress > 1 && (
                        <div
                          className="text-xs mt-0.5"
                          style={{
                            color: 'rgba(242, 208, 138, 0.6)',
                            fontFamily: 'monospace'
                          }}
                        >
                          {obj.currentProgress}/{obj.requiredProgress}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          {activeQuests.length > 3 && (
            <div
              className="text-xs text-center mt-2"
              style={{
                color: 'rgba(242, 208, 138, 0.5)',
                fontStyle: 'italic'
              }}
            >
              +{activeQuests.length - 3} more quest{activeQuests.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
