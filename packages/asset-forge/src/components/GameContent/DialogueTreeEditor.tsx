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

import { Plus, Trash2, MessageSquare, ArrowRight } from 'lucide-react'
import React, { useMemo } from 'react'

import type { DialogueNode, DialogueResponse } from '../../types/npc-scripts'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'

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

// Memoized dialogue node item component
const DialogueNodeItem = React.memo<{
  node: DialogueNode
  isSelected: boolean
  isEntry: boolean
  onSelect: () => void
  onDelete: () => void
}>(({ node, isSelected, isEntry, onSelect, onDelete }) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 text-left rounded-lg border transition-all ${
        isSelected
          ? 'border-primary bg-primary bg-opacity-10'
          : 'border-border-primary bg-bg-tertiary hover:bg-bg-secondary'
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <Badge variant={isEntry ? 'primary' : 'secondary'} className="text-xs">
          {isEntry ? '▶ Start' : node.id}
        </Badge>
        {isSelected && !isEntry && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-text-tertiary hover:text-red-400 cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onDelete()
              }
            }}
          >
            <Trash2 size={14} />
          </div>
        )}
      </div>
      <p className="text-sm text-text-primary line-clamp-2">{node.text || 'Empty node'}</p>
      <p className="text-xs text-text-tertiary mt-1">{node.responses.length} responses</p>
    </button>
  )
}, (prev, next) => {
  return prev.node.id === next.node.id &&
    prev.isSelected === next.isSelected &&
    prev.isEntry === next.isEntry &&
    prev.node.text === next.node.text &&
    prev.node.responses.length === next.node.responses.length
})

DialogueNodeItem.displayName = 'DialogueNodeItem'

// Memoized response item component
const ResponseItem = React.memo<{
  response: DialogueResponse
  nodes: DialogueNode[]
  onUpdate: (responseId: string, updates: Partial<DialogueResponse>) => void
  onDelete: (responseId: string) => void
}>(({ response, nodes, onUpdate, onDelete }) => {
  const handleTextChange = useMemo(() => (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(response.id, { text: e.target.value })
  }, [response.id, onUpdate])

  const handleNextNodeChange = useMemo(() => (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate(response.id, { nextNodeId: e.target.value })
  }, [response.id, onUpdate])

  const handleDelete = useMemo(() => () => {
    onDelete(response.id)
  }, [response.id, onDelete])

  const handleKeyDown = useMemo(() => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onDelete(response.id)
    }
  }, [response.id, onDelete])

  return (
    <Card key={response.id} className="p-3 bg-bg-tertiary">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={response.text}
            onChange={handleTextChange}
            placeholder="Player response..."
            className="flex-1 text-xs"
          />
          <div
            onClick={handleDelete}
            className="text-text-tertiary hover:text-red-400 cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            <Trash2 size={14} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ArrowRight size={14} className="text-text-tertiary" />
          <select
            value={response.nextNodeId}
            onChange={handleNextNodeChange}
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

        {response.questReference && (
          <Badge variant="secondary" className="text-xs">
            Quest: {response.questReference}
          </Badge>
        )}
      </div>
    </Card>
  )
}, (prev, next) => {
  return prev.response.id === next.response.id &&
    prev.response.text === next.response.text &&
    prev.response.nextNodeId === next.response.nextNodeId &&
    prev.response.questReference === next.response.questReference &&
    prev.nodes.length === next.nodes.length
})

ResponseItem.displayName = 'ResponseItem'

export const DialogueTreeEditor: React.FC<DialogueTreeEditorProps> = React.memo(({
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
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId])
  
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
            <DialogueNodeItem
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isEntry={node.id === entryNodeId}
              onSelect={() => onNodeSelect(node.id)}
              onDelete={() => onNodeDelete(node.id)}
            />
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
                {selectedNode.responses.map((response) => (
                  <ResponseItem
                    key={response.id}
                    response={response}
                    nodes={nodes}
                    onUpdate={(responseId, updates) => onResponseUpdate(selectedNode.id, responseId, updates)}
                    onDelete={(responseId) => onResponseDelete(selectedNode.id, responseId)}
                  />
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
}, (prevProps, nextProps) => {
  return (
    prevProps.nodes === nextProps.nodes &&
    prevProps.entryNodeId === nextProps.entryNodeId &&
    prevProps.selectedNodeId === nextProps.selectedNodeId
  )
})

