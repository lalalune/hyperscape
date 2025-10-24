/**
 * Collaboration Result Viewer
 *
 * Displays the results of a multi-agent NPC collaboration session.
 * Shows conversation rounds, emergent relationships, validation scores, and structured output.
 */

import { Download, MessageSquare, Heart, FileJson, CheckCircle } from 'lucide-react'
import React, { useState } from 'react'

import type { CollaborationSession } from '../../types/multi-agent'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'

interface CollaborationResultViewerProps {
  session: CollaborationSession
}

type ViewTab = 'conversation' | 'relationships' | 'output' | 'validation'

export const CollaborationResultViewer: React.FC<CollaborationResultViewerProps> = ({
  session,
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('conversation')

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `collaboration-${session.sessionId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="p-6 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary capitalize">
            {session.collaborationType} Collaboration
          </h3>
          <p className="text-sm text-text-secondary">
            {session.npcCount} NPCs, {session.rounds} rounds
          </p>
        </div>
        <Button onClick={handleExport} variant="ghost" size="sm">
          <Download size={16} className="mr-1" />
          Export
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-primary">
        <button
          onClick={() => setActiveTab('conversation')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'conversation'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <MessageSquare size={14} className="inline mr-1" />
          Conversation ({session.conversation.length})
        </button>
        <button
          onClick={() => setActiveTab('relationships')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'relationships'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Heart size={14} className="inline mr-1" />
          Relationships ({session.emergentContent.relationships.length})
        </button>
        {session.emergentContent.structuredOutput && (
          <button
            onClick={() => setActiveTab('output')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'output'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileJson size={14} className="inline mr-1" />
            Structured Output
          </button>
        )}
        {session.validation && (
          <button
            onClick={() => setActiveTab('validation')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'validation'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <CheckCircle size={14} className="inline mr-1" />
            Validation
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {activeTab === 'conversation' && (
          <div className="space-y-3">
            {session.conversation.map((round, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Round {round.round + 1}
                    </Badge>
                    <span className="font-semibold text-text-primary">
                      {round.agentName}
                    </span>
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {new Date(round.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">
                  {round.content}
                </p>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'relationships' && (
          <div className="space-y-3">
            {session.emergentContent.relationships.length === 0 ? (
              <div className="text-center text-text-tertiary py-8">
                No relationships detected
              </div>
            ) : (
              session.emergentContent.relationships.map((rel, idx) => (
                <Card key={idx} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-text-primary">
                        {rel.agents.join(' & ')}
                      </div>
                      <div className="text-sm text-text-secondary capitalize mt-1">
                        {rel.type} relationship
                      </div>
                    </div>
                    <Badge variant="secondary">{rel.interactionCount} interactions</Badge>
                  </div>

                  {rel.sentiment && (
                    <div className="mt-3 flex gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-text-tertiary">
                          Positive: {rel.sentiment.positive}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-gray-500" />
                        <span className="text-text-tertiary">
                          Neutral: {rel.sentiment.neutral}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-text-tertiary">
                          Negative: {rel.sentiment.negative}
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'output' && session.emergentContent.structuredOutput && (
          <div>
            <pre className="bg-bg-primary rounded-lg p-4 text-xs overflow-auto">
              {JSON.stringify(session.emergentContent.structuredOutput, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === 'validation' && session.validation && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-text-secondary">
                  Validation Status
                </span>
                <Badge
                  variant={session.validation.validated ? 'secondary' : 'error'}
                  className="text-xs"
                >
                  {session.validation.validated ? 'Validated' : 'Not Validated'}
                </Badge>
              </div>
              <div className="text-lg font-bold text-text-primary">
                Confidence: {(session.validation.confidence * 100).toFixed(1)}%
              </div>
            </Card>

            {session.validation.scores && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4">
                  <div className="text-xs text-text-tertiary mb-1">Consistency</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {session.validation.scores.consistency.toFixed(1)}
                    <span className="text-sm text-text-tertiary">/10</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-text-tertiary mb-1">Authenticity</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {session.validation.scores.authenticity.toFixed(1)}
                    <span className="text-sm text-text-tertiary">/10</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-text-tertiary mb-1">Quality</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {session.validation.scores.quality.toFixed(1)}
                    <span className="text-sm text-text-tertiary">/10</span>
                  </div>
                </Card>
              </div>
            )}

            {session.validation.validatorCount && (
              <div className="text-sm text-text-tertiary text-center">
                Validated by {session.validation.validatorCount} agents
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata Footer */}
      <div className="pt-4 border-t border-border-primary text-xs text-text-tertiary">
        <div className="flex justify-between">
          <span>Model: {session.metadata.model}</span>
          <span>{new Date(session.metadata.timestamp).toLocaleString()}</span>
        </div>
      </div>
    </Card>
  )
}
