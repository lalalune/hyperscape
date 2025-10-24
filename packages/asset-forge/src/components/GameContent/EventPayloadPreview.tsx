/**
 * Event Payload Preview
 * 
 * Shows the event data that will be sent when players interact with NPCs.
 * Useful for understanding what ElizaOS agents will see.
 * 
 * Displays:
 * - NPC_DIALOGUE event structure
 * - Available quests with full data
 * - Dialogue options and flow
 * - Services and metadata
 * 
 * Used by: NPCScriptBuilder for validation and preview
 */

import { Eye, Code } from 'lucide-react'
import React, { useState } from 'react'

import type { GeneratedQuest } from '../../types/content-generation'
import type { NPCScript, NPCEventPayload } from '../../types/npc-scripts'
import { generateEventPayloadPreview } from '../../utils/npc-script-exporter'
import { Badge } from '../common/Badge'
import { Card } from '../common/Card'

interface EventPayloadPreviewProps {
  script: NPCScript
  quests: GeneratedQuest[]
  selectedNodeId?: string
}

export const EventPayloadPreview: React.FC<EventPayloadPreviewProps> = ({
  script,
  quests,
  selectedNodeId
}) => {
  const [showRawJSON, setShowRawJSON] = useState(false)
  
  let payload: NPCEventPayload
  try {
    payload = generateEventPayloadPreview(script, quests, selectedNodeId)
  } catch (error) {
    return (
      <Card className="p-4 bg-red-500 bg-opacity-10 border-red-500">
        <p className="text-sm text-red-400">
          Error generating payload: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    )
  }
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-accent" />
          <h4 className="font-semibold text-text-primary">Event Payload Preview</h4>
        </div>
        <button
          onClick={() => setShowRawJSON(!showRawJSON)}
          className={`p-2 rounded-lg transition-all ${
            showRawJSON
              ? 'bg-primary bg-opacity-20 text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          title="Toggle Raw JSON"
        >
          {showRawJSON ? <Eye size={14} /> : <Code size={14} />}
        </button>
      </div>
      
      {showRawJSON ? (
        /* Raw JSON View */
        <pre className="bg-bg-primary rounded-lg p-3 text-xs overflow-auto max-h-96">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : (
        /* Formatted View */
        <div className="space-y-3">
          {/* NPC Info */}
          <div className="p-3 bg-bg-tertiary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary">NPC Information</span>
              <Badge variant="secondary">{payload.npcType}</Badge>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">ID:</span>
                <span className="text-text-primary font-mono">{payload.npcId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Name:</span>
                <span className="text-text-primary">{payload.npcName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Services:</span>
                <span className="text-text-primary">{payload.services.join(', ')}</span>
              </div>
            </div>
          </div>
          
          {/* Current Dialogue */}
          <div className="p-3 bg-bg-tertiary rounded-lg">
            <span className="text-xs font-medium text-text-secondary block mb-2">
              Current Dialogue (Node: {payload.dialogue.nodeId})
            </span>
            <p className="text-sm text-text-primary italic mb-2">"{payload.dialogue.text}"</p>
            
            <div className="space-y-1">
              {payload.dialogue.responses.map((response, idx) => (
                <div key={response.id} className="flex items-start gap-2 text-xs">
                  <span className="text-text-tertiary">{idx + 1}.</span>
                  <div className="flex-1">
                    <span className="text-text-primary">{response.text}</span>
                    {response.offersQuest && (
                      <Badge variant="primary" className="text-xs ml-2">Quest: {response.offersQuest}</Badge>
                    )}
                    <span className="text-text-tertiary block mt-0.5">→ {response.nextNodeId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Available Quests */}
          {payload.questsAvailable.length > 0 && (
            <div className="p-3 bg-primary bg-opacity-5 border border-primary rounded-lg">
              <span className="text-xs font-medium text-text-secondary block mb-2">
                Quests Available ({payload.questsAvailable.length})
              </span>
              {payload.questsAvailable.map((quest) => (
                <div key={quest.id} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text-primary">{quest.title}</span>
                    <Badge variant="secondary" className="text-xs">{quest.difficulty}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary">{quest.description}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{quest.objectives.length} objectives</Badge>
                    <Badge variant="secondary" className="text-xs">{quest.rewards.xp} XP</Badge>
                    <Badge variant="secondary" className="text-xs">{quest.rewards.gold}g</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Metadata */}
          <div className="p-3 bg-bg-tertiary rounded-lg">
            <span className="text-xs font-medium text-text-secondary block mb-2">
              ElizaOS Agent Metadata
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Can Accept Quests:</span>
                <span className="text-text-primary">{payload.metadata.canAcceptQuests ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Quest Count:</span>
                <span className="text-text-primary">{payload.metadata.questCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Has Dialogue:</span>
                <span className="text-text-primary">{payload.metadata.hasActiveDialogue ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Script Version:</span>
                <span className="text-text-primary font-mono">{payload.metadata.scriptVersion}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

