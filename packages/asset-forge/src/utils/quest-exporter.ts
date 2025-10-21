/**
 * Quest Exporter Utility
 * 
 * Exports quests in a simplified format suitable for game integration.
 * Converts GeneratedQuest (rich editor format) to GameQuestFormat (minimal runtime format).
 * 
 * Functions:
 * - exportQuestForGame: Convert single quest to game format
 * - exportQuestsForGame: Convert multiple quests
 * - exportQuestPackJSON: Create complete pack JSON string
 * - downloadQuestPack: Trigger browser download of quest pack
 * 
 * The GameQuestFormat strips out editor-specific data (metadata, full manifest objects)
 * and keeps only what's needed for quest execution in the game.
 * 
 * Used by: ContentGenerationPage export functionality
 */

import type { GeneratedQuest } from '../types/content-generation'
import type { GameQuestFormat } from '../types/quest-tracking'

export function exportQuestForGame(quest: GeneratedQuest): GameQuestFormat {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    questGiver: quest.questGiver,
    objectives: quest.objectives.map(obj => ({
      id: obj.id,
      type: obj.type,
      actionHandler: obj.actionHandler,
      target: obj.target || '',
      targetType: obj.targetMob ? 'mob' 
        : obj.targetResource ? 'resource' 
        : obj.targetData && 'npcType' in obj.targetData ? 'npc'
        : obj.targetData && 'type' in obj.targetData ? 'item'
        : 'none',
      quantity: obj.quantity || 1,
      description: obj.description
    })),
    rewards: {
      xp: quest.rewards.experience,
      gold: quest.rewards.gold,
      items: quest.rewards.items?.map(i => ({
        itemId: i.itemId,
        quantity: i.quantity
      }))
    },
    requirements: quest.prerequisites
  }
}

export function exportQuestsForGame(quests: GeneratedQuest[]): GameQuestFormat[] {
  return quests.map(exportQuestForGame)
}

export function exportQuestPackJSON(quests: GeneratedQuest[], packName: string = 'Quest Pack'): string {
  const pack = {
    name: packName,
    version: '1.0.0',
    quests: exportQuestsForGame(quests),
    metadata: {
      exportedAt: new Date().toISOString(),
      questCount: quests.length,
      tool: 'Asset Forge Content Builder'
    }
  }
  
  return JSON.stringify(pack, null, 2)
}

export function downloadQuestPack(quests: GeneratedQuest[], packName: string = 'quest-pack'): void {
  const json = exportQuestPackJSON(quests, packName)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${packName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

