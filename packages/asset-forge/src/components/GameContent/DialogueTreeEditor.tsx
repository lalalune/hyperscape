/**
 * Dialogue Tree Editor
 * 
 * Simple dialogue tree editor for NPC scripts.
 * Allows creating branching conversations with quest integration.
 * 
 * Features:
 * - Add/edit/delete dialogue nodes
 * - Create player response options
 * - Link responses to quests
 * - Add effects (ACCEPT_QUEST, GIVE_ITEM, etc.)
 * - Visual flow preview
 * 
 * Used by: NPCScriptBuilder component
 */

import React from 'react'
import { Plus, Trash2, MessageSquare, ArrowRight } from 'lucide-react'
import type { DialogueNode, DialogueResponse, DialogueEffect } from '../../types/npc-scripts'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'
import { Badge } from '../common/Badge'

interface DialogueTreeEditorProps {
  nodes: DialogueNode[]
  entryNodeId: string
  selectedNodeId: string | null
  onNodeSelect: (nodeId: string) => void
  onNodeAdd: () => void
  onNodeUpdate: (nodeId: string, updates: Partial<DialogueNode>) => void
  onNodeDelete: (nodeId: string) => void
  onResponseAdd: (nodeId: string) => void
  onResponseUpdate: (nodeId: string, responseId: string, updates: Partial<DialogueResponse>) => void
  onResponseDelete: (nodeId: string, responseId: string) => void
}

export const DialogueTreeEditor: React.FC<DialogueTreeEditorProps> = ({
  nodes,
  entryNodeId,
  selectedNodeId,
  onNodeSelect,
  onNodeAdd,
  onNodeUpdate,
  onNodeDelete,
  onResponseAdd,
  onResponseUpdate,
  onResponseDelete
}) => {
  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Node List */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            <h4 className="font-semibold text-text-primary">Dialogue Nodes</h4>
          </div>
          <Button onClick={onNodeAdd} size="sm" variant="ghost">
            <Plus size={14} className="mr-1" />
            Add Node
          </Button>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => onNodeSelect(node.id)}
              className={`w-full p-3 text-left rounded-lg border transition-all ${
                selectedNodeId === node.id
                  ? 'border-primary bg-primary bg-opacity-10'
                  : 'border-border-primary bg-bg-tertiary hover:bg-bg-secondary'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <Badge variant={node.id === entryNodeId ? 'primary' : 'secondary'} className="text-xs">
                  {node.id === entryNodeId ? '▶ Start' : node.id}
                </Badge>
                {selectedNodeId === node.id && node.id !== entryNodeId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNodeDelete(node.id)
                    }}
                    className="text-text-tertiary hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm text-text-primary line-clamp-2">{node.text || 'Empty node'}</p>
              <p className="text-xs text-text-tertiary mt-1">{node.responses.length} responses</p>
            </button>
          ))}
          
          {nodes.length === 0 && (
            <p className="text-text-tertiary text-sm text-center py-8">
              No dialogue nodes yet
            </p>
          )}
        </div>
      </Card>
      
      {/* Node Editor */}
      <Card className="p-4">
        <h4 className="font-semibold text-text-primary mb-3">
          {selectedNode ? 'Edit Node' : 'Select a Node'}
        </h4>
        
        {selectedNode ? (
          <div className="space-y-4">
            {/* Node ID */}
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-2">Node ID</label>
              <Input
                value={selectedNode.id}
                disabled
                className="text-xs font-mono"
              />
            </div>
            
            {/* Dialogue Text */}
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-2">NPC Says</label>
              <textarea
                value={selectedNode.text}
                onChange={(e) => onNodeUpdate(selectedNode.id, { text: e.target.value })}
                placeholder="What does the NPC say?"
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm resize-none focus:outline-none focus:border-primary"
                rows={3}
              />
            </div>
            
            {/* Player Responses */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-secondary">Player Responses</label>
                <Button onClick={() => onResponseAdd(selectedNode.id)} size="sm" variant="ghost">
                  <Plus size={12} className="mr-1" />
                  Add
                </Button>
              </div>
              
              <div className="space-y-2">
                {selectedNode.responses.map((response, idx) => (
                  <Card key={response.id} className="p-3 bg-bg-tertiary">
                    <div className="space-y-2">
                      {/* Response Text */}
                      <div className="flex items-center gap-2">
                        <Input
                          value={response.text}
                          onChange={(e) => onResponseUpdate(selectedNode.id, response.id, { text: e.target.value })}
                          placeholder="Player response..."
                          className="flex-1 text-xs"
                        />
                        <button
                          onClick={() => onResponseDelete(selectedNode.id, response.id)}
                          className="text-text-tertiary hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      {/* Next Node */}
                      <div className="flex items-center gap-2">
                        <ArrowRight size={14} className="text-text-tertiary" />
                        <select
                          value={response.nextNodeId}
                          onChange={(e) => onResponseUpdate(selectedNode.id, response.id, { nextNodeId: e.target.value })}
                          className="flex-1 px-2 py-1 bg-bg-secondary border border-border-primary rounded text-text-primary text-xs"
                        >
                          <option value="">Select next node...</option>
                          {nodes.map(node => (
                            <option key={node.id} value={node.id}>
                              {node.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Quest Reference (if applicable) */}
                      {response.questReference && (
                        <Badge variant="secondary" className="text-xs">
                          Quest: {response.questReference}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
                
                {selectedNode.responses.length === 0 && (
                  <p className="text-text-tertiary text-xs text-center py-4">
                    No responses (terminal node)
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-text-tertiary text-sm text-center py-8">
            Select a dialogue node to edit
          </p>
        )}
      </Card>
    </div>
  )
}

