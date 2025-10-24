/**
 * Quest Tracker Component
 * 
 * Real-time quest progress tracking and simulation interface.
 * 
 * Features:
 * - Stats dashboard: Active quests, completed count, event log
 * - Available quests: List with validation status
 * - Active quests: Progress bars and objective completion tracking
 * - Completed quests: Historical record
 * - Simulate Progress: Test quest execution flow
 * 
 * Quest Flow:
 * 1. Available → User clicks "Start" → Active
 * 2. Active → Objectives complete → Quest completes
 * 3. Completed → Stored in history
 * 
 * Validation:
 * - Shows errors for invalid quests (missing action handlers, targets)
 * - Prevents starting invalid quests
 * 
 * Used by: ContentGenerationPage "Tracking" tab
 */

import { CheckCircle, Circle, Target, Trophy, Play, RotateCcw } from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'

import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { useQuestTrackingStore } from '../../store/useQuestTrackingStore'
import { validateQuest } from '../../utils/quest-validator'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'

export const QuestTracker: React.FC = () => {
  const {
    activeQuests,
    completedQuests,
    events,
    startQuest,
    updateObjectiveProgress,
//     completeObjective,
    resetTracking,
    getActiveQuestCount,
    getCompletedQuestCount
  } = useQuestTrackingStore()

  // Selective subscription for performance
  const quests = useContentGenerationStore(state => state.quests)
  const [simulatingQuest, setSimulatingQuest] = useState<string | null>(null)
  const simulateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (simulateTimeoutRef.current) {
        clearTimeout(simulateTimeoutRef.current)
      }
    }
  }, [])

  const activeQuestsArray = Array.from(activeQuests.values())
  const availableQuests = quests.filter(q => !activeQuests.has(q.id) && !completedQuests.has(q.id))

  const handleStartQuest = (questId: string) => {
    const quest = quests.find(q => q.id === questId)
    if (quest) {
      startQuest(quest)
    }
  }

  const handleSimulateProgress = (questId: string) => {
    const progress = activeQuests.get(questId)
    if (!progress) return

    // Clear any existing timeout
    if (simulateTimeoutRef.current) {
      clearTimeout(simulateTimeoutRef.current)
    }

    setSimulatingQuest(questId)

    // Simulate completing one objective at a time
    const objectives = Object.entries(progress.objectives).filter(([_, obj]) => !obj.completed)
    if (objectives.length > 0) {
      const [objId, obj] = objectives[0]
      const newCurrent = Math.min(obj.current + 1, obj.required)
      updateObjectiveProgress(questId, objId, newCurrent)
    }

    simulateTimeoutRef.current = setTimeout(() => {
      setSimulatingQuest(null)
      simulateTimeoutRef.current = null
    }, 300)
  }
  
  const getObjectiveProgressPercent = (current: number, required: number): number => {
    return Math.min((current / required) * 100, 100)
  }
  
  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Target className="text-accent" size={24} />
            <div>
              <div className="text-2xl font-bold text-text-primary">{getActiveQuestCount()}</div>
              <div className="text-xs text-text-secondary">Active Quests</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-primary" size={24} />
            <div>
              <div className="text-2xl font-bold text-text-primary">{getCompletedQuestCount()}</div>
              <div className="text-xs text-text-secondary">Completed</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Play className="text-accent" size={24} />
            <div>
              <div className="text-2xl font-bold text-text-primary">{events.length}</div>
              <div className="text-xs text-text-secondary">Total Events</div>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Available Quests */}
      {availableQuests.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Available Quests</h3>
            <Badge variant="secondary">{availableQuests.length} quests</Badge>
          </div>
          <div className="space-y-3">
            {availableQuests.map((quest) => {
              const validation = validateQuest(quest)
              return (
                <div key={quest.id} className="p-4 bg-bg-secondary border border-border-primary rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-text-primary">{quest.title}</h4>
                      <p className="text-sm text-text-secondary mt-1">{quest.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary">{quest.difficulty}</Badge>
                        <Badge variant="secondary">{quest.objectives.length} objectives</Badge>
                        {validation.errors.length > 0 && (
                          <Badge variant="error">{validation.errors.length} errors</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleStartQuest(quest.id)}
                      variant="primary"
                      size="sm"
                      disabled={!validation.valid}
                    >
                      <Play size={14} className="mr-1" />
                      Start
                    </Button>
                  </div>
                  {validation.errors.length > 0 && (
                    <div className="mt-2 p-2 bg-red-500 bg-opacity-10 rounded text-xs text-red-400">
                      {validation.errors[0]}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
      
      {/* Active Quests */}
      {activeQuestsArray.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Active Quests</h3>
            <Button onClick={resetTracking} variant="ghost" size="sm">
              <RotateCcw size={14} className="mr-1" />
              Reset All
            </Button>
          </div>
          <div className="space-y-4">
            {activeQuestsArray.map((progress) => {
              const quest = progress.quest
              const objectivesArray = Object.entries(progress.objectives)
              const completedCount = objectivesArray.filter(([_, obj]) => obj.completed).length
              const totalCount = objectivesArray.length
              const overallPercent = (completedCount / totalCount) * 100
              
              return (
                <div key={quest.id} className="p-4 bg-primary bg-opacity-5 border border-primary rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-text-primary">{quest.title}</h4>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">{quest.difficulty}</Badge>
                        <Badge variant="secondary">
                          {completedCount}/{totalCount} objectives
                        </Badge>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSimulateProgress(quest.id)}
                      variant="secondary"
                      size="sm"
                      disabled={simulatingQuest === quest.id || completedCount === totalCount}
                    >
                      Simulate Progress
                    </Button>
                  </div>
                  
                  {/* Overall Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                      <span>Overall Progress</span>
                      <span>{Math.round(overallPercent)}%</span>
                    </div>
                    <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${overallPercent}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Objectives List */}
                  <div className="space-y-2">
                    {quest.objectives.map((obj) => {
                      const objProgress = progress.objectives[obj.id]
                      if (!objProgress) return null
                      
                      const percent = getObjectiveProgressPercent(objProgress.current, objProgress.required)
                      
                      return (
                        <div key={obj.id} className="p-2 bg-bg-secondary rounded">
                          <div className="flex items-start gap-2">
                            {objProgress.completed ? (
                              <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                            ) : (
                              <Circle size={16} className="text-text-tertiary flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm ${objProgress.completed ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                                  {obj.description}
                                </span>
                                <span className="text-xs text-text-tertiary ml-2">
                                  {objProgress.current}/{objProgress.required}
                                </span>
                              </div>
                              {!objProgress.completed && (
                                <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-accent transition-all duration-300"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              )}
                              {obj.actionHandler && (
                                <div className="mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {obj.actionHandler}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
      
      {/* Completed Quests */}
      {completedQuests.size > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Completed Quests</h3>
          <div className="space-y-2">
            {Array.from(completedQuests).map((questId) => {
              const quest = quests.find(q => q.id === questId)
              if (!quest) return null
              
              return (
                <div key={questId} className="p-3 bg-primary bg-opacity-10 border border-primary rounded-lg flex items-center gap-3">
                  <CheckCircle size={20} className="text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-text-primary">{quest.title}</div>
                    <div className="text-xs text-text-secondary">{quest.objectives.length} objectives completed</div>
                  </div>
                  <Badge variant="secondary">✓ Complete</Badge>
                </div>
              )
            })}
          </div>
        </Card>
      )}
      
      {/* Empty State */}
      {activeQuestsArray.length === 0 && completedQuests.size === 0 && availableQuests.length === 0 && (
        <Card className="p-12 text-center">
          <Target size={48} className="mx-auto text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Quests Available</h3>
          <p className="text-sm text-text-secondary">
            Create quests in the Quests tab to start tracking
          </p>
        </Card>
      )}
    </div>
  )
}

