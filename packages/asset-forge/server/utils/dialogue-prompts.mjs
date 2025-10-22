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

Dialogue: accept_quest | NPC: Grenda Ironforge | Text: "Good. He'll be at the Rusty Tankard. Bring him back and I'll pay ye." | Conditions: none | Effects: add_objective:find_apprentice | Responses: [I'm on it:greeting:none]

Dialogue: greeting | NPC: Brother Aldric | Text: "The threads of fate have brought you here... or perhaps you walk of your own accord?" | Conditions: none | Responses: [I seek wisdom:wisdom_request:none] [What do you know of the prophecy?:prophecy_talk:quest_complete:shadows_rising] [Goodbye:farewell:none]

Dialogue: greeting | NPC: Tessa Quickblade | Text: "Well, well. You look like someone who appreciates... discretion." | Conditions: none | Responses: [I need information:info_trade:gold>=50] [I'm looking for work:quest_check:class:rogue] [I don't deal with criminals:hostile:reputation:thieves_guild:-25]

Dialogue: greeting | NPC: Old Jeb | Text: "Top o' the mornin'! Come to see the finest crops in three counties?" | Conditions: time:day | Responses: [Your farm looks wonderful:compliment:reputation:village:+2] [I need supplies:shop_open:none] [Need any help?:quest_check:none]

---
CRITICAL INSTRUCTIONS - CLOSED CIRCUIT DIALOGUE:
1. Output ONLY dialogue lines in the EXACT format shown above
2. Start each line with "Dialogue:" and use pipes "|" to separate fields
3. Format: dialogue_id | NPC: name | Text: "dialogue text" | Conditions: conditions_or_none | Effects: effects_if_any | Responses: [text:nextNodeId:condition]
4. EVERY conversation MUST include these MANDATORY nodes:
   - "greeting" node (entry point)
   - "end" node (polite goodbye/exit - REQUIRED)
   - "farewell" node (alternate exit point - OPTIONAL but recommended)
5. EVERY response nextNodeId MUST reference:
   - "end" (terminates conversation)
   - "greeting" (loops back to start)
   - Another node you are generating in THIS output
   - An existing node from the context
6. NO BROKEN REFERENCES: If you reference a node like "quest_offer", you MUST generate that node in your output
7. ALWAYS generate an "end" node with a friendly goodbye message
8. Include at least ONE "Goodbye" or "I must go" response that leads to "end"
9. Avoid duplicate node IDs - use suffixes like greeting_2, quest_offer_variant, etc.
10. Generate 4-6 new dialogue nodes that form a COMPLETE, CLOSED conversation tree

EXAMPLE OF REQUIRED END NODE:
Dialogue: end | NPC: ${npcName} | Text: "Farewell, traveler. Safe journey!" | Conditions: none | Responses: []

NO markdown, NO headings, NO extra text. ONLY the dialogue lines.
---

${existingNodes.length > 0 ? `Expand from existing nodes for ${npcName}:` : `Create initial greeting dialogue for ${npcName}:`}
`
}

export const parseDialogueResponse = (resp) => {
  const lines = resp.split('\n').filter(line => line.trim().startsWith('Dialogue:'))

  const nodes = lines.map(line => {
    const parts = line.split('|').map(p => p.trim())

    const id = parts[0]?.replace('Dialogue:', '').trim() || `dialogue_${Date.now()}`
    const text = parts[2]?.replace('Text:', '').replace(/"/g, '').trim() || ''

    const responsesStr = parts.find(p => p.includes('Responses:'))
    const responses = responsesStr
      ? (responsesStr.match(/\[.*?\]/g) || []).map(r => {
          const cleaned = r.replace(/[[\]]/g, '')
          const parts = cleaned.split(':')
          const text = parts[0]
          const nextNodeId = parts[1]
          const condition = parts.slice(2).join(':')
          return {
            id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: text?.trim() || '',
            nextNodeId: nextNodeId?.trim() || 'end',
            condition: condition?.trim() || ''
          }
        })
      : []

    return {
      id,
      text,
      responses
    }
  })

  // Validation: Check for duplicate IDs
  const nodeIds = nodes.map(n => n.id)
  const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index)
  if (duplicateIds.length > 0) {
    console.warn('[Dialogue Parser] Duplicate node IDs detected:', duplicateIds)
    // Rename duplicates by adding timestamp
    nodes.forEach((node, index) => {
      if (duplicateIds.includes(node.id)) {
        const newId = `${node.id}_${Date.now()}_${index}`
        console.warn(`[Dialogue Parser] Renaming duplicate '${node.id}' to '${newId}'`)
        node.id = newId
      }
    })
  }

  // AUTO-FIX: Ensure "end" node exists
  const hasEndNode = nodes.some(n => n.id === 'end')
  if (!hasEndNode) {
    console.warn('[Dialogue Parser] Missing "end" node - auto-generating')
    nodes.push({
      id: 'end',
      text: 'Farewell, traveler. Safe journey!',
      responses: []
    })
  }

  // Build set of all node IDs including auto-generated ones
  const allNodeIds = new Set(nodes.map(n => n.id))
  allNodeIds.add('greeting') // 'greeting' should exist or be assumed valid

  // AUTO-FIX: Generate missing nodes that are referenced
  const referencedNodes = new Set()
  for (const node of nodes) {
    for (const response of node.responses) {
      if (response.nextNodeId && response.nextNodeId !== 'end' && response.nextNodeId !== 'greeting') {
        referencedNodes.add(response.nextNodeId)
      }
    }
  }

  // Find missing nodes
  const missingNodes = [...referencedNodes].filter(nodeId => !allNodeIds.has(nodeId))

  if (missingNodes.length > 0) {
    console.warn(`[Dialogue Parser] Auto-generating ${missingNodes.length} missing nodes:`, missingNodes)

    for (const missingNodeId of missingNodes) {
      // Generate appropriate stub node based on name
      let stubText = 'I should go now.'
      let stubResponses = [
        {
          id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          text: 'Goodbye',
          nextNodeId: 'end',
          condition: ''
        }
      ]

      // Special cases for common node names
      if (missingNodeId.includes('farewell') || missingNodeId.includes('goodbye')) {
        stubText = 'Safe travels, friend. May we meet again.'
        stubResponses = [] // Terminal node
      } else if (missingNodeId.includes('quest')) {
        stubText = 'Come back when you\'re ready to help.'
        stubResponses = [
          {
            id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: 'I\'ll return',
            nextNodeId: 'greeting',
            condition: ''
          },
          {
            id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: 'Goodbye',
            nextNodeId: 'end',
            condition: ''
          }
        ]
      } else {
        // Generic stub - return to greeting or end
        stubResponses = [
          {
            id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: 'Tell me more',
            nextNodeId: 'greeting',
            condition: ''
          },
          {
            id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: 'Goodbye',
            nextNodeId: 'end',
            condition: ''
          }
        ]
      }

      nodes.push({
        id: missingNodeId,
        text: stubText,
        responses: stubResponses
      })

      allNodeIds.add(missingNodeId)
    }
  }

  // Final validation: Check for any remaining broken references
  for (const node of nodes) {
    for (const response of node.responses) {
      if (response.nextNodeId && !allNodeIds.has(response.nextNodeId)) {
        console.error(`[Dialogue Parser] CRITICAL: Node '${node.id}' references non-existent node '${response.nextNodeId}' - fixing to 'end'`)
        response.nextNodeId = 'end'
      }
    }
  }

  // Check for conversation continuation (at least one node loops back)
  const hasLoop = nodes.some(node =>
    node.responses.some(r => r.nextNodeId === 'greeting' || (allNodeIds.has(r.nextNodeId) && r.nextNodeId !== 'end'))
  )
  if (!hasLoop && nodes.length > 1) {
    console.warn('[Dialogue Parser] No conversation loops detected - conversation may feel too linear')
  }

  console.log(`[Dialogue Parser] ✅ Parsed ${nodes.length} nodes (${missingNodes.length} auto-generated)`)

  return nodes
}
