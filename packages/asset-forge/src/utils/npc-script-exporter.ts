/**
 * NPC Script Exporter
 * 
 * Exports NPC scripts in format suitable for game integration.
 * Converts NPCScript (rich editor format) to GameNPCScript (minimal runtime format).
 * 
 * Functions:
 * - exportScriptForGame: Convert single script to game format
 * - exportScriptsForGame: Convert multiple scripts
 * - exportScriptPackJSON: Create complete script pack JSON
 * - downloadScriptPack: Trigger browser download
 * 
 * The GameNPCScript format strips out editor metadata and keeps only
 * what's needed for dialogue execution and event emission.
 * 
 * Used by: ContentGenerationPage export functionality
 */

import type { GeneratedQuest } from '../types/content-generation'
import type { NPCScript, GameNPCScript, NPCEventPayload } from '../types/npc-scripts'

export function exportScriptForGame(script: NPCScript): GameNPCScript {
  return {
    npcId: script.npcId,
    dialogueTree: {
      entryNodeId: script.dialogueTree.entryNodeId,
      nodes: script.dialogueTree.nodes
    },
    questsOffered: script.questsOffered,
    services: script.services,
    shopInventory: script.shopInventory,
    voice: script.voice // Include voice configuration
  }
}

export function exportScriptsForGame(scripts: NPCScript[]): GameNPCScript[] {
  return scripts.map(exportScriptForGame)
}

export function exportScriptPackJSON(scripts: NPCScript[], packName: string = 'NPC Scripts'): string {
  const pack = {
    name: packName,
    version: '1.0.0',
    scripts: exportScriptsForGame(scripts),
    metadata: {
      exportedAt: new Date().toISOString(),
      scriptCount: scripts.length,
      tool: 'Asset Forge Content Builder'
    }
  }
  
  return JSON.stringify(pack, null, 2)
}

export function downloadScriptPack(scripts: NPCScript[], packName: string = 'npc-scripts'): void {
  const json = exportScriptPackJSON(scripts, packName)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${packName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Generate event payload preview for ElizaOS agents
 * Shows what data agents will receive when NPC dialogue event fires
 */
export function generateEventPayloadPreview(
  script: NPCScript,
  quests: GeneratedQuest[],
  currentNodeId?: string
): NPCEventPayload {
  const nodeId = currentNodeId || script.dialogueTree.entryNodeId
  const currentNode = script.dialogueTree.nodes.find(n => n.id === nodeId)
  
  if (!currentNode) {
    throw new Error(`Node ${nodeId} not found in dialogue tree`)
  }
  
  // Get full quest data for quests this NPC offers
  const questsAvailable = script.questsOffered
    .map(questId => quests.find(q => q.id === questId))
    .filter((q): q is GeneratedQuest => q !== undefined)
    .map(quest => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      difficulty: quest.difficulty,
      objectives: quest.objectives.map(obj => ({
        type: obj.type,
        actionHandler: obj.actionHandler,
        target: obj.target,
        quantity: obj.quantity || 1,
        description: obj.description
      })),
      rewards: {
        xp: quest.rewards.experience,
        gold: quest.rewards.gold,
        items: quest.rewards.items?.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity
        }))
      },
      requirements: quest.prerequisites
    }))
  
  const voiceClipUrl = script.voice?.clips[currentNode?.id]?.audioUrl

  return {
    npcId: script.npcId,
    npcName: script.npcName,
    npcType: script.services.includes('quest') ? 'quest_giver'
      : script.services.includes('shop') ? 'merchant'
      : script.services.includes('bank') ? 'banker'
      : 'generic',
    dialogue: {
      nodeId: currentNode.id,
      text: currentNode.text,
      voiceClipUrl,
      responses: currentNode.responses.map(r => ({
        id: r.id,
        text: r.text,
        nextNodeId: r.nextNodeId,
        offersQuest: r.questReference,
        requiresQuest: r.conditions?.find(c => c.type === 'HAS_QUEST')?.data?.questId,
        completesQuest: r.effects?.find(e => e.type === 'COMPLETE_QUEST')?.data as string | undefined,
        requiresLevel: r.conditions?.find(c => c.type === 'LEVEL_REQUIREMENT')?.data?.level
      }))
    },
    questsAvailable,
    services: script.services,
    shopInventory: script.shopInventory,
    voiceEnabled: script.voice !== undefined && Object.keys(script.voice.clips).length > 0,
    metadata: {
      canAcceptQuests: script.services.includes('quest'),
      hasActiveDialogue: true,
      questCount: questsAvailable.length,
      scriptVersion: script.version,
      hasVoice: script.voice !== undefined && Object.keys(script.voice.clips).length > 0
    }
  }
}

