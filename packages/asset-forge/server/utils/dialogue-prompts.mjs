/**
 * Dialogue Prompts (Server-side)
 * Few-shot prompts for dialogue generation
 */

export const makeDialogueNodePrompt = (npcName, npcPersonality, context, existingNodes) => {
  return `\
You are generating NPC dialogue in a STRICT pipe-delimited format. DO NOT use markdown, headings, or any formatting. ONLY output pipe-delimited lines.

# MMORPG NPC Dialogue Trees
Branching conversations with conditions, effects, and personality-driven responses for Runescape-style MMORPG.

## NPC Context
Name: ${npcName}
Personality: ${npcPersonality}
${context ? `Additional Context: ${context}` : ''}

${existingNodes.length > 0 ? `## Existing Dialogue Nodes\n${existingNodes.map(n => `${n.id}: "${n.text}"`).join('\n')}` : ''}

## Dialogue Examples (FOLLOW THIS EXACT FORMAT)

Dialogue: greeting | NPC: Grenda Ironforge | Text: "Back again, are ye? My forge doesn't run on compliments. What do ye need?" | Conditions: none | Responses: [Show me your wares:shop_open:none] [I need a custom weapon:quest_offer:reputation:ironforge>=10] [Just passing through:farewell:none]

Dialogue: shop_open | NPC: Grenda Ironforge | Text: "Aye, these are my finest works. Prices are non-negotiable." | Conditions: none | Effects: open_shop | Responses: [I'll take a look:end:none] [Too expensive:leave_shop:reputation:ironforge:-5]

Dialogue: quest_offer | NPC: Grenda Ironforge | Text: "Hmph. My lazy apprentice ran off to the tavern again. Fetch him back and I'll make it worth your while." | Conditions: reputation:ironforge>=10 | Effects: start_quest:blacksmith_apprentice | Responses: [I'll find him:accept_quest:reputation:ironforge:+5] [Not my problem:reject_quest:none]

Dialogue: greeting | NPC: Brother Aldric | Text: "The threads of fate have brought you here... or perhaps you walk of your own accord?" | Conditions: none | Responses: [I seek wisdom:wisdom_request:none] [What do you know of the prophecy?:prophecy_talk:quest_complete:shadows_rising] [Goodbye:farewell:none]

Dialogue: greeting | NPC: Tessa Quickblade | Text: "Well, well. You look like someone who appreciates... discretion." | Conditions: none | Responses: [I need information:info_trade:gold>=50] [I'm looking for work:quest_check:class:rogue] [I don't deal with criminals:hostile:reputation:thieves_guild:-25]

Dialogue: greeting | NPC: Old Jeb | Text: "Top o' the mornin'! Come to see the finest crops in three counties?" | Conditions: time:day | Responses: [Your farm looks wonderful:compliment:reputation:village:+2] [I need supplies:shop_open:none] [Need any help?:quest_check:none]

---
CRITICAL INSTRUCTION: Output ONLY dialogue lines in the EXACT format shown above. Start each line with "Dialogue:" and use pipes "|" to separate fields. Include:
- dialogue_id | NPC: name | Text: "dialogue text" | Conditions: conditions_or_none | Effects: effects_if_any | Responses: [text:nextNodeId:condition]

Generate 3-5 new dialogue nodes that expand the conversation naturally based on the context and existing nodes.
NO markdown, NO headings, NO extra text. ONLY the dialogue lines.
---

${existingNodes.length > 0 ? `Expand from existing nodes for ${npcName}:` : `Create initial greeting dialogue for ${npcName}:`}
`
}

export const parseDialogueResponse = (resp) => {
  const lines = resp.split('\n').filter(line => line.trim().startsWith('Dialogue:'))
  
  return lines.map(line => {
    const parts = line.split('|').map(p => p.trim())
    
    const id = parts[0]?.replace('Dialogue:', '').trim() || `dialogue_${Date.now()}`
    const text = parts[2]?.replace('Text:', '').replace(/"/g, '').trim() || ''
    
    const responsesStr = parts.find(p => p.includes('Responses:'))
    const responses = responsesStr
      ? (responsesStr.match(/\[(.*?)\]/g) || []).map(r => {
          const cleaned = r.replace(/[\[\]]/g, '')
          const [text, nextNodeId] = cleaned.split(':')
          return {
            id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: text?.trim() || '',
            nextNodeId: nextNodeId?.trim() || 'end'
          }
        })
      : []
    
    return {
      id,
      text,
      responses
    }
  })
}

