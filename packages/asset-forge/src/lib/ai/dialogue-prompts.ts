/**
 * Few-Shot Dialogue Prompts
 * 
 * Rich examples for AI dialogue generation using few-shot learning.
 * Based on pipeline project's npc-prompts.ts pattern.
 * 
 * Format: Pipe-delimited structured output for easy parsing
 */

export const makeDialogueNodePrompt = (
  npcName: string,
  npcPersonality: string,
  context: string,
  existingNodes: Array<{ id: string; text: string }>
) => {
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

Dialogue: prophecy_talk | NPC: Brother Aldric | Text: "The darkness stirs... Three relics must be united before the moon turns crimson, lest all fall to shadow." | Conditions: quest_complete:shadows_rising | Effects: start_quest:prophecy_unfolds, flag:prophecy_revealed | Responses: [Tell me more:prophecy_details:none] [How do I stop it?:quest_accept:none] [This is madness:deny_prophecy:reputation:monastery:-10]

Dialogue: greeting | NPC: Tessa Quickblade | Text: "Well, well. You look like someone who appreciates... discretion." | Conditions: none | Responses: [I need information:info_trade:gold>=50] [I'm looking for work:quest_check:class:rogue] [I don't deal with criminals:hostile:reputation:thieves_guild:-25]

Dialogue: info_trade | NPC: Tessa Quickblade | Text: "Information isn't cheap, friend. 50 gold, and I'll tell you what I know about..." | Conditions: gold>=50 | Effects: remove_gold:50, reveal_info:merchant_routes | Responses: [Deal:accept_trade:reputation:thieves_guild:+10] [Too rich for my blood:cancel_trade:none]

Dialogue: greeting | NPC: Sir Dorian | Text: "*takes a swig from flask* What do you want? Can't you see I'm busy drowning my sorrows?" | Conditions: time:night | Responses: [I heard you were a great warrior:story_request:none] [The garrison needs you:duty_call:reputation:city_guard>=20] [Never mind:farewell:none]

Dialogue: duty_call | NPC: Sir Dorian | Text: "*slams fist on table* The garrison needs me? I FAILED them! Every last one of my men died because of me!" | Conditions: reputation:city_guard>=20 | Effects: emotion:anger | Responses: [The past is past:convince:skill:persuasion>=7] [You're right. You're useless:provoke:reputation:city_guard:-15] [I'm sorry:empathy:none]

Dialogue: greeting | NPC: Old Jeb | Text: "Top o' the mornin'! Come to see the finest crops in three counties?" | Conditions: time:day | Responses: [Your farm looks wonderful:compliment:reputation:village:+2] [I need supplies:shop_open:none] [Need any help?:quest_check:none]

Dialogue: quest_check | NPC: Old Jeb | Text: "Actually, yes! These goblins have been stealing my chickens. Could you deal with 'em?" | Conditions: none | Effects: start_quest:jeb_goblins | Responses: [I'll handle it:accept_quest:reputation:village:+5] [Find someone else:reject_quest:none]

Dialogue: greeting | NPC: Maven Blackwood | Text: "*without looking up* Another interruption. What is it this time?" | Conditions: none | Responses: [I need research help:research_request:none] [What are you working on?:curiosity:none] [Sorry to bother:leave:none]

Dialogue: research_request | NPC: Maven Blackwood | Text: "Hmm. *looks up* You want MY help? That will cost you. Bring me three ancient tomes and I'll consider it." | Conditions: none | Effects: start_quest:maven_tomes | Responses: [Where do I find them?:tome_locations:none] [Deal:accept_quest:reputation:scholars:+10] [Too much trouble:reject:none]

---
CRITICAL INSTRUCTION: Output ONLY dialogue lines in the EXACT format shown above. Start each line with "Dialogue:" and use pipes "|" to separate fields. Include:
- dialogue_id | NPC: name | Text: "dialogue text" | Conditions: conditions_or_none | Effects: effects_if_any | Responses: [text:nextNodeId:condition]

Generate 3-5 new dialogue nodes that expand the conversation naturally based on the context and existing nodes.
NO markdown, NO headings, NO extra text. ONLY the dialogue lines.
---

${existingNodes.length > 0 ? `Expand from existing nodes for ${npcName}:` : `Create initial greeting dialogue for ${npcName}:`}
`
}

export const parseDialogueResponse = (resp: string) => {
  const lines = resp.split('\n').filter(line => line.trim().startsWith('Dialogue:'))
  
  return lines.map(line => {
    const parts = line.split('|').map(p => p.trim())
    
    const id = parts[0]?.replace('Dialogue:', '').trim() || `dialogue_${Date.now()}`
    const text = parts[2]?.replace('Text:', '').replace(/"/g, '').trim() || ''
    
    const conditionsStr = parts[3]?.replace('Conditions:', '').trim()
    const conditions = conditionsStr && conditionsStr !== 'none'
      ? conditionsStr.split(',').map(c => c.trim())
      : undefined
    
    // Parse effects if present
    const effectsStr = parts.find(p => p.includes('Effects:'))
    const effects = effectsStr && effectsStr.replace('Effects:', '').trim() !== 'none'
      ? effectsStr.replace('Effects:', '').split(',').map(e => {
          const [type, ...data] = e.trim().split(':')
          return { type, data: data.join(':') }
        })
      : undefined
    
    // Parse responses: [text:nextNodeId:condition]
    const responsesStr = parts.find(p => p.includes('Responses:'))
    const responses = responsesStr
      ? (responsesStr.match(/\[(.*?)\]/g) || []).map(r => {
          const cleaned = r.replace(/[[\]]/g, '').trim()
          const [text, nextNodeId, ...condParts] = cleaned.split(':')
          return {
            id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: text?.trim() || '',
            nextNodeId: nextNodeId?.trim() || 'end',
            effects: condParts.length > 0 ? condParts.map(c => ({
              type: c.split(':')[0],
              data: c.split(':').slice(1).join(':')
            })) : undefined
          }
        })
      : []
    
    return {
      id,
      text,
      conditions,
      effects,
      responses
    }
  })
}

export const makeDialogueExpansionPrompt = (
  npcName: string,
  currentNodeId: string,
  currentNodeText: string,
  responseText: string
) => {
  return `\
Create a single follow-up dialogue node for ${npcName}.

Current node: ${currentNodeId} - "${currentNodeText}"
Player chose: "${responseText}"

Generate the next dialogue node in pipe-delimited format:
Dialogue: [id] | NPC: ${npcName} | Text: "[response to player]" | Conditions: [if_any_or_none] | Effects: [if_any] | Responses: [text:next_id:condition] [text:next_id:condition]

Output ONLY the dialogue line, no other text.
`
}

