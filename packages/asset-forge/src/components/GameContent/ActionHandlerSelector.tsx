/**
 * Action Handler Selector Component
 * 
 * Interactive UI for selecting game action handlers for quest objectives.
 * 
 * Features:
 * - Category filtering (Combat, Gathering, Processing, Economy, Navigation, Social)
 * - Displays action metadata (description, required items, valid targets)
 * - Shows selected action with detailed info
 * - Clear selection button
 * 
 * Props:
 * - value: Currently selected action handler
 * - onChange: Callback when action is selected/cleared
 * - category: Optional filter to show only specific category
 * - className: Additional CSS classes
 * 
 * Used by: QuestBuilder for objective action handler selection
 */

import React, { useState } from 'react'

import type { ActionHandlerName, ActionCategory } from '../../types/action-handlers'
import { ACTION_HANDLERS, ACTION_CATEGORIES, getActionsByCategory } from '../../types/action-handlers'
import { Badge } from '../common/Badge'

interface ActionHandlerSelectorProps {
  value: ActionHandlerName | undefined
  onChange: (action: ActionHandlerName | undefined) => void
  category?: ActionCategory
  className?: string
}

export const ActionHandlerSelector: React.FC<ActionHandlerSelectorProps> = ({
  value,
  onChange,
  category,
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory | 'all'>(category || 'all')

  const categories: ActionCategory[] = Object.keys(ACTION_CATEGORIES) as ActionCategory[]

  const filteredActions = selectedCategory === 'all'
    ? Object.values(ACTION_HANDLERS)
    : getActionsByCategory(selectedCategory)
  
  const selectedAction = value ? ACTION_HANDLERS[value] : undefined
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Category Tabs */}
      {!category && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-primary bg-opacity-10 text-primary border border-primary'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-border-primary'
            }`}
          >
            All Actions
          </button>
          {categories.map((cat) => {
            const catInfo = ACTION_CATEGORIES[cat]
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary bg-opacity-10 text-primary border border-primary'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-border-primary'
                }`}
              >
                <span className="mr-1">{catInfo.icon}</span>
                {catInfo.name}
              </button>
            )
          })}
        </div>
      )}
      
      {/* Selected Action Display */}
      {selectedAction && (
        <div className="p-3 bg-primary bg-opacity-5 border border-primary rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{selectedAction.icon}</span>
                <span className="font-semibold text-text-primary">{selectedAction.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {ACTION_CATEGORIES[selectedAction.category].name}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary">{selectedAction.description}</p>
              {selectedAction.requiredItems && selectedAction.requiredItems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs text-text-tertiary">Requires:</span>
                  {selectedAction.requiredItems.map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              )}
              {selectedAction.targetTypes && selectedAction.targetTypes.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-xs text-text-tertiary">Targets:</span>
                  {selectedAction.targetTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onChange(undefined)}
              className="text-xs text-text-tertiary hover:text-text-primary ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Action Grid */}
      {!selectedAction && (
        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {filteredActions.map((action) => (
            <button
              key={action.name}
              onClick={() => onChange(action.name)}
              className="p-3 text-left bg-bg-secondary hover:bg-bg-tertiary border border-border-primary hover:border-accent rounded-lg transition-all"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">{action.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-text-primary">{action.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {ACTION_CATEGORIES[action.category].name}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">{action.description}</p>
                  {action.requiredItems && action.requiredItems.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {action.requiredItems.map((item) => (
                        <Badge key={item} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
          {filteredActions.length === 0 && (
            <div className="text-center py-8 text-text-tertiary text-sm">
              No actions available in this category
            </div>
          )}
        </div>
      )}
    </div>
  )
}

