/**
 * Tester Persona Selector
 *
 * Reusable component for selecting AI playtester personas.
 * Displays predefined persona cards with descriptions and allows multi-select.
 */

import { CheckSquare, Square, Info } from 'lucide-react'
import React, { useEffect, useState, useCallback } from 'react'

import { API_ENDPOINTS } from '../../config/api'
import { useMultiAgentStore } from '../../store/useMultiAgentStore'
import type { TesterArchetype, PlaytesterPersonasResponse } from '../../types/multi-agent'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'

interface TesterPersonaSelectorProps {
  selectedPersonas: TesterArchetype[]
  onSelectionChange: (personas: TesterArchetype[]) => void
  maxSelection?: number
  minSelection?: number
}

const PERSONA_COLORS: Record<TesterArchetype, string> = {
  completionist: 'bg-blue-500',
  speedrunner: 'bg-red-500',
  explorer: 'bg-green-500',
  casual: 'bg-yellow-500',
  minmaxer: 'bg-purple-500',
  roleplayer: 'bg-pink-500',
  breaker: 'bg-orange-500',
}

const KNOWLEDGE_LEVEL_BADGES: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
}

export const TesterPersonaSelector: React.FC<TesterPersonaSelectorProps> = ({
  selectedPersonas,
  onSelectionChange,
  maxSelection,
  minSelection = 1,
}) => {
  const {
    availablePersonas,
    loadingPersonas,
    setAvailablePersonas,
    setLoadingPersonas,
  } = useMultiAgentStore()

  const [showInfo, setShowInfo] = useState<TesterArchetype | null>(null)

  const loadPersonas = useCallback(async () => {
    setLoadingPersonas(true)
    try {
      const response = await fetch(API_ENDPOINTS.playtesterPersonas)
      if (!response.ok) {
        throw new Error('Failed to load playtester personas')
      }
      const data: PlaytesterPersonasResponse = await response.json()
      setAvailablePersonas(data)
    } catch (error) {
      console.error('Error loading personas:', error)
    } finally {
      setLoadingPersonas(false)
    }
  }, [setLoadingPersonas, setAvailablePersonas])

  useEffect(() => {
    if (!availablePersonas && !loadingPersonas) {
      loadPersonas()
    }
  }, [availablePersonas, loadingPersonas, loadPersonas])

  const togglePersona = (archetype: TesterArchetype) => {
    const isSelected = selectedPersonas.includes(archetype)

    if (isSelected) {
      // Don't allow deselecting if at minimum
      if (selectedPersonas.length <= minSelection) {
        return
      }
      onSelectionChange(selectedPersonas.filter((p) => p !== archetype))
    } else {
      // Don't allow selecting if at maximum
      if (maxSelection && selectedPersonas.length >= maxSelection) {
        return
      }
      onSelectionChange([...selectedPersonas, archetype])
    }
  }

  const selectAll = () => {
    if (!availablePersonas) return
    const all = availablePersonas.availablePersonas
    const limited = maxSelection ? all.slice(0, maxSelection) : all
    onSelectionChange(limited)
  }

  const clearAll = () => {
    // Don't allow clearing below minSelection
    if (minSelection > 0) {
      return
    }
    onSelectionChange([])
  }

  const selectDefault = () => {
    if (!availablePersonas) return
    const defaultSelection = availablePersonas.defaultSwarm
    const limited = maxSelection ? defaultSelection.slice(0, maxSelection) : defaultSelection
    onSelectionChange(limited)
  }

  if (loadingPersonas) {
    return (
      <Card className="p-6">
        <div className="text-center text-text-secondary">
          Loading playtester personas...
        </div>
      </Card>
    )
  }

  if (!availablePersonas) {
    return (
      <Card className="p-6">
        <div className="text-center text-text-secondary">
          Failed to load playtester personas
        </div>
        <Button onClick={loadPersonas} variant="primary" className="mt-4 mx-auto">
          Retry
        </Button>
      </Card>
    )
  }

  const personas = availablePersonas.personas

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-secondary">
          {selectedPersonas.length} of {availablePersonas.availablePersonas.length} selected
          {minSelection > 0 && ` (min: ${minSelection})`}
          {maxSelection && ` (max: ${maxSelection})`}
        </div>
        <div className="flex gap-2">
          <Button onClick={selectDefault} variant="ghost" size="sm">
            Use Default ({availablePersonas?.defaultSwarm?.length ?? 0})
          </Button>
          <Button onClick={selectAll} variant="ghost" size="sm">
            Select All
          </Button>
          <Button
            onClick={clearAll}
            variant="ghost"
            size="sm"
            disabled={selectedPersonas.length === 0 || selectedPersonas.length <= minSelection}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Persona Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {availablePersonas.availablePersonas.map((archetype) => {
          const persona = personas[archetype]
          const isSelected = selectedPersonas.includes(archetype)
          const knowledgeLevel = getKnowledgeLevelForArchetype(archetype)

          return (
            <Card
              key={archetype}
              className={`p-4 cursor-pointer transition-all relative ${
                isSelected
                  ? 'border-2 border-primary bg-primary bg-opacity-5'
                  : 'hover:bg-bg-tertiary border border-border-primary'
              }`}
              onClick={() => togglePersona(archetype)}
            >
              {/* Selection Indicator */}
              <div className="absolute top-2 right-2">
                {isSelected ? (
                  <CheckSquare size={18} className="text-primary" />
                ) : (
                  <Square size={18} className="text-text-tertiary" />
                )}
              </div>

              {/* Persona Badge */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${PERSONA_COLORS[archetype]}`} />
                <h4 className="font-semibold text-text-primary capitalize">
                  {archetype}
                </h4>
              </div>

              {/* Persona Name */}
              <p className="text-sm text-text-secondary mb-2">{persona.name}</p>

              {/* Knowledge Level */}
              <div className="mb-2">
                <Badge variant="secondary" className="text-xs">
                  {KNOWLEDGE_LEVEL_BADGES[knowledgeLevel] || knowledgeLevel}
                </Badge>
              </div>

              {/* Personality Preview */}
              <p className="text-xs text-text-tertiary line-clamp-2 mb-2">
                {persona.personality}
              </p>

              {/* Info Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowInfo(showInfo === archetype ? null : archetype)
                }}
                className="text-xs text-primary hover:text-primary-light flex items-center gap-1"
              >
                <Info size={12} />
                {showInfo === archetype ? 'Hide' : 'Show'} Details
              </button>

              {/* Expanded Info */}
              {showInfo === archetype && (
                <div
                  className="mt-3 pt-3 border-t border-border-primary space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <div className="text-xs font-semibold text-text-secondary uppercase mb-1">
                      Expectations
                    </div>
                    <ul className="text-xs text-text-tertiary space-y-1">
                      {persona.expectations.map((exp, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Description */}
      <div className="text-xs text-text-tertiary text-center">
        {availablePersonas.description}
      </div>
    </div>
  )
}

function getKnowledgeLevelForArchetype(archetype: TesterArchetype): string {
  const levelMap: Record<TesterArchetype, string> = {
    completionist: 'intermediate',
    speedrunner: 'expert',
    explorer: 'intermediate',
    casual: 'beginner',
    minmaxer: 'expert',
    roleplayer: 'intermediate',
    breaker: 'expert',
  }
  return levelMap[archetype] || 'intermediate'
}
