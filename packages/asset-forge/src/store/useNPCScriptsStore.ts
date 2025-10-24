/**
 * NPC Scripts Store
 * 
 * Zustand store for managing NPC dialogue scripts and behavior patterns.
 * 
 * State:
 * - npcScripts: All created NPC scripts
 * - selectedScript: Currently editing script
 * - scriptsByNPC: Map of NPC ID to script IDs
 * 
 * Actions:
 * - addScript: Create new NPC script
 * - updateScript: Modify existing script
 * - deleteScript: Remove script
 * - addDialogueNode: Add node to dialogue tree
 * - updateDialogueNode: Modify dialogue node
 * - deleteDialogueNode: Remove dialogue node
 * - linkQuestToNPC: Associate quest with NPC script
 * 
 * Used by: NPCScriptBuilder, ContentGenerationPage
 */

import { create } from 'zustand'

import type { GeneratedNPC } from '../types/content-generation'
import type { NPCScript, DialogueNode, DialogueResponse, ShopItem, DialogueEffect } from '../types/npc-scripts'

interface NPCScriptsState {
  // Data
  npcScripts: NPCScript[]
  selectedScript: NPCScript | null
  scriptsByNPC: Map<string, string> // npcId -> scriptId
  
  // UI State
  editingNodeId: string | null
  
  // Actions
  addScript: (script: NPCScript) => void
  updateScript: (id: string, updates: Partial<NPCScript>) => void
  deleteScript: (id: string) => void
  setSelectedScript: (script: NPCScript | null) => void
  
  // Dialogue Tree Actions
  addDialogueNode: (scriptId: string, node: DialogueNode) => void
  updateDialogueNode: (scriptId: string, nodeId: string, updates: Partial<DialogueNode>) => void
  deleteDialogueNode: (scriptId: string, nodeId: string) => void
  setEditingNodeId: (nodeId: string | null) => void
  
  // Response Actions
  addResponse: (scriptId: string, nodeId: string, response: DialogueResponse) => void
  updateResponse: (scriptId: string, nodeId: string, responseId: string, updates: Partial<DialogueResponse>) => void
  deleteResponse: (scriptId: string, nodeId: string, responseId: string) => void
  
  // Quest Integration
  linkQuestToScript: (scriptId: string, questId: string) => void
  unlinkQuestFromScript: (scriptId: string, questId: string) => void
  
  // Shop Integration
  addShopItem: (scriptId: string, item: ShopItem) => void
  updateShopItem: (scriptId: string, itemId: string, updates: Partial<ShopItem>) => void
  deleteShopItem: (scriptId: string, itemId: string) => void
  
  // Utilities
  getScriptByNPC: (npcId: string) => NPCScript | undefined
  createScriptFromNPC: (npc: GeneratedNPC) => NPCScript
}

export const useNPCScriptsStore = create<NPCScriptsState>((set, get) => ({
  // Initial state
  npcScripts: [],
  selectedScript: null,
  scriptsByNPC: new Map(),
  editingNodeId: null,
  
  // Actions
  addScript: (script) => set((state) => ({
    npcScripts: [...state.npcScripts, script],
    scriptsByNPC: new Map(state.scriptsByNPC).set(script.npcId, script.id),
    selectedScript: script
  })),
  
  updateScript: (id, updates) => set((state) => ({
    npcScripts: state.npcScripts.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ),
    selectedScript: state.selectedScript?.id === id 
      ? { ...state.selectedScript, ...updates }
      : state.selectedScript
  })),
  
  deleteScript: (id) => set((state) => {
    const script = state.npcScripts.find(s => s.id === id)
    const newScriptsByNPC = new Map(state.scriptsByNPC)
    if (script) {
      newScriptsByNPC.delete(script.npcId)
    }
    return {
      npcScripts: state.npcScripts.filter(s => s.id !== id),
      scriptsByNPC: newScriptsByNPC,
      selectedScript: state.selectedScript?.id === id ? null : state.selectedScript
    }
  }),
  
  setSelectedScript: (script) => set({ selectedScript: script }),
  
  // Dialogue Tree Actions
  addDialogueNode: (scriptId, node) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      dialogueTree: {
        ...script.dialogueTree,
        nodes: [...script.dialogueTree.nodes, node]
      }
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  updateDialogueNode: (scriptId, nodeId, updates) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      dialogueTree: {
        ...script.dialogueTree,
        nodes: script.dialogueTree.nodes.map(n =>
          n.id === nodeId ? { ...n, ...updates } : n
        )
      }
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  deleteDialogueNode: (scriptId, nodeId) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      dialogueTree: {
        ...script.dialogueTree,
        nodes: script.dialogueTree.nodes.filter(n => n.id !== nodeId)
      }
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  setEditingNodeId: (nodeId) => set({ editingNodeId: nodeId }),
  
  // Response Actions
  addResponse: (scriptId, nodeId, response) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      dialogueTree: {
        ...script.dialogueTree,
        nodes: script.dialogueTree.nodes.map(n =>
          n.id === nodeId 
            ? { ...n, responses: [...n.responses, response] }
            : n
        )
      }
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  updateResponse: (scriptId, nodeId, responseId, updates) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      dialogueTree: {
        ...script.dialogueTree,
        nodes: script.dialogueTree.nodes.map(n =>
          n.id === nodeId
            ? {
                ...n,
                responses: n.responses.map(r =>
                  r.id === responseId ? { ...r, ...updates } : r
                )
              }
            : n
        )
      }
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  deleteResponse: (scriptId, nodeId, responseId) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      dialogueTree: {
        ...script.dialogueTree,
        nodes: script.dialogueTree.nodes.map(n =>
          n.id === nodeId
            ? { ...n, responses: n.responses.filter(r => r.id !== responseId) }
            : n
        )
      }
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  // Quest Integration
  linkQuestToScript: (scriptId, questId) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      questsOffered: [...new Set([...script.questsOffered, questId])]
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  unlinkQuestFromScript: (scriptId, questId) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      questsOffered: script.questsOffered.filter(q => q !== questId)
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  // Shop Integration
  addShopItem: (scriptId, item) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script) return state
    
    const updatedScript = {
      ...script,
      shopInventory: [...(script.shopInventory || []), item]
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  updateShopItem: (scriptId, itemId, updates) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script || !script.shopInventory) return state
    
    const updatedScript = {
      ...script,
      shopInventory: script.shopInventory.map(item =>
        item.itemId === itemId ? { ...item, ...updates } : item
      )
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  deleteShopItem: (scriptId, itemId) => set((state) => {
    const script = state.npcScripts.find(s => s.id === scriptId)
    if (!script || !script.shopInventory) return state
    
    const updatedScript = {
      ...script,
      shopInventory: script.shopInventory.filter(item => item.itemId !== itemId)
    }
    
    return {
      npcScripts: state.npcScripts.map(s => s.id === scriptId ? updatedScript : s),
      selectedScript: state.selectedScript?.id === scriptId ? updatedScript : state.selectedScript
    }
  }),
  
  // Utilities
  getScriptByNPC: (npcId) => {
    const scriptId = get().scriptsByNPC.get(npcId)
    if (!scriptId) return undefined
    return get().npcScripts.find(s => s.id === scriptId)
  },
  
  createScriptFromNPC: (npc) => {
    // Convert GeneratedNPC to NPCScript format
    const script: NPCScript = {
      id: `script_${Date.now()}`,
      npcId: npc.id,
      npcName: npc.personality.name,
      version: '1.0.0',
      dialogueTree: {
        entryNodeId: npc.dialogues[0]?.id || 'greeting',
        nodes: npc.dialogues.map(d => ({
          id: d.id,
          text: d.text,
          responses: d.responses.map((r, idx) => ({
            id: `response_${idx}`,
            text: r.text,
            nextNodeId: r.nextNodeId,
            effects: r.effects as DialogueEffect[] | undefined,
            questReference: r.questReference
          }))
        }))
      },
      questsOffered: npc.personality.questsOffered || [],
      questRequirements: {},
      services: (npc.services || []) as Array<'bank' | 'shop' | 'quest' | 'training'>,
      shopInventory: npc.inventory?.map(item => ({
        itemId: item.itemId,
        itemName: item.itemData?.name || item.itemId,
        stock: item.stock,
        buyPrice: item.price,
        sellPrice: Math.floor(item.price * 0.6)
      })),
      behaviors: {
        idle: {
          type: 'stand',
          animations: ['idle']
        },
        schedule: npc.behavior.schedule
      },
      metadata: {
        createdAt: new Date().toISOString(),
        author: 'Asset Forge',
        version: '1.0.0',
        tags: []
      }
    }

    return script
  }
}))

