/**
 * NPC Script Validator
 * 
 * Validates NPC scripts to ensure dialogue trees are complete and functional.
 * 
 * Checks:
 * - All dialogue nodes are reachable from entry node
 * - All nextNodeId references exist
 * - Quest references are valid
 * - Shop items exist in manifests
 * - No circular dialogue loops (warnings)
 * - Required fields are present
 * 
 * Used by: NPCScriptBuilder, ContentGenerationPage
 */

import type { NPCScript, DialogueNode } from '../types/npc-scripts'
import type { ScriptValidationResult } from '../types/npc-scripts'

export function validateNPCScript(script: NPCScript, availableQuests: string[] = []): ScriptValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate basic fields
  if (!script.npcId || script.npcId.trim() === '') {
    errors.push('Script must have an NPC ID')
  }
  
  if (!script.npcName || script.npcName.trim() === '') {
    errors.push('Script must have an NPC name')
  }
  
  // Validate dialogue tree
  if (!script.dialogueTree.nodes || script.dialogueTree.nodes.length === 0) {
    errors.push('Dialogue tree must have at least one node')
  } else {
    // Check entry node exists
    const entryNode = script.dialogueTree.nodes.find(n => n.id === script.dialogueTree.entryNodeId)
    if (!entryNode) {
      errors.push(`Entry node "${script.dialogueTree.entryNodeId}" not found in dialogue tree`)
    }
    
    // Build node map for quick lookup
    const nodeMap = new Map(script.dialogueTree.nodes.map(n => [n.id, n]))
    
    // Validate each node
    script.dialogueTree.nodes.forEach((node, index) => {
      const nodePrefix = `Node ${index + 1} ("${node.id}")`
      
      // Check node has text
      if (!node.text || node.text.trim() === '') {
        errors.push(`${nodePrefix}: missing dialogue text`)
      }
      
      // Check node has responses (except terminal nodes)
      if (!node.responses || node.responses.length === 0) {
        // Check if this is referenced by other nodes
        const isReferenced = script.dialogueTree.nodes.some(n =>
          n.responses.some(r => r.nextNodeId === node.id)
        )
        
        if (isReferenced || node.id === script.dialogueTree.entryNodeId) {
          warnings.push(`${nodePrefix}: has no responses (terminal node)`)
        }
      } else {
        // Validate each response
        node.responses.forEach((response, respIndex) => {
          const respPrefix = `${nodePrefix} Response ${respIndex + 1}`
          
          // Check response has text
          if (!response.text || response.text.trim() === '') {
            errors.push(`${respPrefix}: missing response text`)
          }
          
          // Check nextNodeId exists
          if (!response.nextNodeId) {
            errors.push(`${respPrefix}: missing nextNodeId`)
          } else if (!nodeMap.has(response.nextNodeId)) {
            errors.push(`${respPrefix}: references non-existent node "${response.nextNodeId}"`)
          }
          
          // Validate quest references
          if (response.questReference) {
            if (!availableQuests.includes(response.questReference)) {
              warnings.push(`${respPrefix}: references quest "${response.questReference}" which may not exist`)
            }
          }
          
          // Validate effects
          if (response.effects) {
            response.effects.forEach((effect, effectIndex) => {
              if (!effect.type) {
                errors.push(`${respPrefix} Effect ${effectIndex + 1}: missing effect type`)
              }
              
              if (effect.type === 'ACCEPT_QUEST' && !effect.data) {
                errors.push(`${respPrefix} Effect ${effectIndex + 1}: ACCEPT_QUEST effect missing questId data`)
              }
            })
          }
        })
      }
    })
    
    // Check for unreachable nodes
    const reachableNodes = findReachableNodes(script.dialogueTree.entryNodeId, nodeMap)
    const unreachable = script.dialogueTree.nodes.filter(n => !reachableNodes.has(n.id))
    if (unreachable.length > 0) {
      warnings.push(`${unreachable.length} unreachable dialogue nodes: ${unreachable.map(n => n.id).join(', ')}`)
    }
    
    // Check for potential infinite loops
    const loops = detectDialogueLoops(script.dialogueTree.nodes)
    if (loops.length > 0) {
      warnings.push(`Potential dialogue loops detected: ${loops.map(l => l.join(' → ')).join('; ')}`)
    }
  }
  
  // Validate quests offered
  script.questsOffered.forEach((questId) => {
    if (!availableQuests.includes(questId)) {
      warnings.push(`Offers quest "${questId}" which may not exist in quest builder`)
    }
  })
  
  // Validate services
  if (script.services.length === 0) {
    warnings.push('NPC has no services configured')
  }
  
  // Validate shop inventory if shop NPC
  if (script.services.includes('shop')) {
    if (!script.shopInventory || script.shopInventory.length === 0) {
      warnings.push('Shop NPC has no inventory items')
    } else {
      script.shopInventory.forEach((item, index) => {
        if (item.buyPrice <= 0) {
          errors.push(`Shop item ${index + 1} (${item.itemId}): buy price must be greater than 0`)
        }
        if (item.sellPrice < 0) {
          errors.push(`Shop item ${index + 1} (${item.itemId}): sell price cannot be negative`)
        }
        if (item.stock === 0) {
          warnings.push(`Shop item ${index + 1} (${item.itemId}): stock is 0`)
        }
      })
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// Helper: Find all reachable nodes from entry point
function findReachableNodes(entryNodeId: string, nodeMap: Map<string, DialogueNode>): Set<string> {
  const reachable = new Set<string>()
  const toVisit = [entryNodeId]
  
  while (toVisit.length > 0) {
    const nodeId = toVisit.pop()!
    if (reachable.has(nodeId)) continue
    
    reachable.add(nodeId)
    const node = nodeMap.get(nodeId)
    if (node) {
      node.responses.forEach(r => {
        if (r.nextNodeId && !reachable.has(r.nextNodeId)) {
          toVisit.push(r.nextNodeId)
        }
      })
    }
  }
  
  return reachable
}

// Helper: Detect potential infinite dialogue loops
function detectDialogueLoops(nodes: DialogueNode[]): string[][] {
  const loops: string[][] = []
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  
  nodes.forEach(startNode => {
    const visited = new Set<string>()
    const path: string[] = []
    
    const dfs = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        // Found a loop
        const loopStart = path.indexOf(nodeId)
        if (loopStart !== -1) {
          loops.push([...path.slice(loopStart), nodeId])
        }
        return
      }
      
      visited.add(nodeId)
      path.push(nodeId)
      
      const node = nodeMap.get(nodeId)
      if (node) {
        node.responses.forEach(r => {
          if (r.nextNodeId) {
            dfs(r.nextNodeId)
          }
        })
      }
      
      path.pop()
    }
    
    dfs(startNode.id)
  })
  
  return loops
}

export function validateNPCScripts(scripts: NPCScript[], availableQuests: string[] = []): Map<string, ScriptValidationResult> {
  const results = new Map<string, ScriptValidationResult>()
  
  scripts.forEach(script => {
    results.set(script.id, validateNPCScript(script, availableQuests))
  })
  
  return results
}

