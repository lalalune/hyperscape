/**
 * NPC Script Builder
 * 
 * Main component for building executable NPC scripts with dialogue trees,
 * quest integration, and behavior patterns.
 * 
 * Features:
 * - Select NPC from generated NPCs
 * - Build dialogue tree with visual editor
 * - Link quests to dialogue responses
 * - Configure shop inventory (for shop NPCs)
 * - Preview event payload for ElizaOS agents
 * - Validate and export scripts
 * 
 * Used by: ContentGenerationPage "Scripts" tab
 */

import { FileCode, Download, Sparkles } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { API_ENDPOINTS } from '../../config/api'
import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { useNPCScriptsStore } from '../../store/useNPCScriptsStore'
import type { DialogueNode, DialogueResponse } from '../../types/npc-scripts'
import { downloadScriptPack } from '../../utils/npc-script-exporter'
import { validateNPCScript } from '../../utils/npc-script-validator'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { ModelSelector } from '../common/ModelSelector'

import { DialogueTreeEditor } from './DialogueTreeEditor'
import { EventPayloadPreview } from './EventPayloadPreview'
import { VoiceGenerator } from './VoiceGenerator'

export const NPCScriptBuilder: React.FC = () => {
  // Selective subscriptions for performance
  const npcs = useContentGenerationStore(state => state.npcs)
  const quests = useContentGenerationStore(state => state.quests)
  const {
    npcScripts,
    selectedScript,
    editingNodeId,
    addScript,
//     updateScript,
    setSelectedScript,
    addDialogueNode,
    updateDialogueNode,
    deleteDialogueNode,
    setEditingNodeId,
    addResponse,
    updateResponse,
    deleteResponse,
    createScriptFromNPC,
    getScriptByNPC
  } = useNPCScriptsStore()
  
  const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  
  // Load script when NPC is selected
  useEffect(() => {
    if (selectedNPCId) {
      const existingScript = getScriptByNPC(selectedNPCId)
      if (existingScript) {
        setSelectedScript(existingScript)
      } else {
        // Create new script from NPC
        const npc = npcs.find(n => n.id === selectedNPCId)
        if (npc) {
          const newScript = createScriptFromNPC(npc)
          addScript(newScript)
          setSelectedScript(newScript)
        }
      }
    }
  }, [selectedNPCId, getScriptByNPC, setSelectedScript, createScriptFromNPC, addScript, npcs])
  
  const handleAddNode = () => {
    if (!selectedScript) return
    
    const newNode: DialogueNode = {
      id: `node_${Date.now()}`,
      text: '',
      responses: []
    }
    
    addDialogueNode(selectedScript.id, newNode)
    setEditingNodeId(newNode.id)
  }
  
  const handleAddResponse = (nodeId: string) => {
    if (!selectedScript) return
    
    const newResponse: DialogueResponse = {
      id: `response_${Date.now()}`,
      text: '',
      nextNodeId: ''
    }
    
    addResponse(selectedScript.id, nodeId, newResponse)
  }
  
  const handleExport = () => {
    if (npcScripts.length === 0) return
    downloadScriptPack(npcScripts, 'NPC Scripts')
  }
  
  const handleGenerateDialogue = async () => {
    if (!selectedScript) return
    
    setIsGenerating(true)
    setGenerationError(null)
    
    try {
      const npc = npcs.find(n => n.id === selectedScript.npcId)
      if (!npc) {
        throw new Error('NPC not found')
      }
      
      const response = await fetch(API_ENDPOINTS.generateDialogue, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          npcName: selectedScript.npcName,
          npcPersonality: JSON.stringify({
            archetype: npc.personality.archetype,
            traits: npc.personality.traits,
            goals: npc.personality.goals,
            alignment: npc.personality.moralAlignment
          }),
          context: npc.personality.backstory || '',
          existingNodes: selectedScript.dialogueTree.nodes.map(n => ({
            id: n.id,
            text: n.text
          })),
          model: selectedModel
        })
      })
      
      if (!response.ok) {
        let errorMessage = `API error: ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error) errorMessage = errorData.error
          if (errorData.details) errorMessage += ` - ${errorData.details}`
          if (errorData.rawResponse) {
            console.error('Raw AI response:', errorData.rawResponse)
            errorMessage += ' (check console for raw response)'
          }
        } catch {
          // Response not JSON, use default error
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Add generated nodes to script
      data.nodes.forEach((node: DialogueNode) => {
        addDialogueNode(selectedScript.id, node)
      })

    } catch (error) {
      console.error('Generation error:', error)
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate dialogue')
    } finally {
      setIsGenerating(false)
    }
  }
  
  const validation = selectedScript ? validateNPCScript(selectedScript, quests.map(q => q.id)) : null
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-text-primary">NPC Script Builder</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{npcScripts.length} scripts</Badge>
            {npcScripts.length > 0 && (
              <Button onClick={handleExport} size="sm" variant="secondary">
                <Download size={14} className="mr-1" />
                Export Scripts
              </Button>
            )}
          </div>
        </div>
      </Card>
      
      {/* NPC Selection */}
      <Card className="p-4">
        <label className="text-sm font-medium text-text-secondary block mb-2">Select NPC</label>
        <select
          value={selectedNPCId || ''}
          onChange={(e) => setSelectedNPCId(e.target.value || null)}
          className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary"
        >
          <option value="">Choose an NPC...</option>
          {npcs.map((npc) => (
            <option key={npc.id} value={npc.id}>
              {npc.personality.name} ({npc.personality.archetype})
            </option>
          ))}
        </select>
        
        {npcs.length === 0 && (
          <p className="text-xs text-text-tertiary mt-2 text-center">
            Create NPCs in the NPCs tab first
          </p>
        )}
        
        {selectedScript && (
          <div className="mt-4 space-y-3">
            {/* AI Generation Controls */}
            <div className="p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-text-primary">AI Dialogue Generation</h5>
                <Sparkles size={16} className="text-primary" />
              </div>
              
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                className="mb-3"
              />
              
              <Button
                onClick={handleGenerateDialogue}
                disabled={isGenerating}
                variant="primary"
                size="sm"
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Sparkles size={14} className="mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="mr-2" />
                    Generate Dialogue Nodes
                  </>
                )}
              </Button>
              
              {generationError && (
                <div className="mt-2 p-2 bg-red-500 bg-opacity-10 rounded text-xs text-red-400">
                  {generationError}
                </div>
              )}
            </div>
            
            {/* Validation Status */}
            {validation && (
              <div className="flex items-center gap-2">
                {validation.valid ? (
                  <Badge variant="secondary" className="text-green-500 text-xs">✓ Valid Script</Badge>
                ) : (
                  <Badge variant="error" className="text-xs">{validation.errors.length} errors</Badge>
                )}
                {validation.warnings.length > 0 && (
                  <Badge variant="warning" className="text-xs">{validation.warnings.length} warnings</Badge>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
      
      {selectedScript && (
        <>
          {/* Dialogue Tree Editor */}
          <DialogueTreeEditor
            nodes={selectedScript.dialogueTree.nodes}
            entryNodeId={selectedScript.dialogueTree.entryNodeId}
            selectedNodeId={editingNodeId}
            onNodeSelect={setEditingNodeId}
            onNodeAdd={handleAddNode}
            onNodeUpdate={(nodeId, updates) => updateDialogueNode(selectedScript.id, nodeId, updates)}
            onNodeDelete={(nodeId) => deleteDialogueNode(selectedScript.id, nodeId)}
            onResponseAdd={handleAddResponse}
            onResponseUpdate={(nodeId, responseId, updates) => 
              updateResponse(selectedScript.id, nodeId, responseId, updates)
            }
            onResponseDelete={(nodeId, responseId) =>
              deleteResponse(selectedScript.id, nodeId, responseId)
            }
          />
          
          {/* Event Payload Preview */}
          <EventPayloadPreview
            script={selectedScript}
            quests={quests}
            selectedNodeId={editingNodeId || selectedScript.dialogueTree.entryNodeId}
          />

          {/* Voice Generation */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4">🎙️ Voice Generation</h3>
            <VoiceGenerator
              npcScript={selectedScript}
              onVoiceGenerated={() => {
                // Reload script to show updated voice data
                const updatedScript = getScriptByNPC(selectedScript.npcId)
                if (updatedScript) {
                  setSelectedScript(updatedScript)
                }
              }}
            />
          </Card>

          {/* Validation Errors/Warnings */}
          {validation && (!validation.valid || validation.warnings.length > 0) && (
            <Card className="p-4">
              {validation.errors.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-red-400 mb-2">Errors</h5>
                  <div className="space-y-1">
                    {validation.errors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-400">• {error}</p>
                    ))}
                  </div>
                </div>
              )}
              
              {validation.warnings.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-amber-400 mb-2">Warnings</h5>
                  <div className="space-y-1">
                    {validation.warnings.map((warning, idx) => (
                      <p key={idx} className="text-xs text-amber-400">• {warning}</p>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
      
      {!selectedScript && npcs.length > 0 && (
        <Card className="p-12 text-center">
          <FileCode size={48} className="mx-auto text-text-tertiary mb-4" />
          <h4 className="text-lg font-semibold text-text-primary mb-2">No Script Selected</h4>
          <p className="text-sm text-text-secondary">
            Select an NPC above to create or edit their dialogue script
          </p>
        </Card>
      )}
    </div>
  )
}

