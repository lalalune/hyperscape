/**
 * Seed Data Service
 *
 * Loads pre-generated content (quests, NPCs, lore) for immediate user experience.
 * Transforms server seed data into frontend types with proper IDs and timestamps.
 */

import { API_ENDPOINTS } from '../config/api.ts'
import { apiFetch } from '../utils/api.ts'
import type { GeneratedQuest, GeneratedNPC, LoreEntry } from '../types/content-generation'

interface SeedContentResponse {
  quests: GeneratedQuest[]
  npcs: GeneratedNPC[]
  lore: LoreEntry[]
  version: string
  generatedAt: string
}

/**
 * Load seed content from the backend API
 * Uses automatic request deduplication for concurrent calls
 */
export async function loadSeedContent(): Promise<SeedContentResponse> {
  try {
    // Construct seed content URL from API_ENDPOINTS base
    const apiUrl = API_ENDPOINTS.playtesterPersonas.replace('/api/playtester-personas', '')
    const response = await apiFetch(`${apiUrl}/api/seed-content`)

    if (!response.ok) {
      throw new Error(`Failed to load seed content: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error loading seed content from backend, using inline fallback:', error)

    // Fallback: return inline seed data if backend fails
    return getInlineSeedData()
  }
}

/**
 * Fallback inline seed data (subset for offline capability)
 */
function getInlineSeedData(): SeedContentResponse {
  const now = new Date().toISOString()

  return {
    quests: [
      {
        id: 'quest_goblin_invasion',
        title: 'Goblin Invasion',
        description: 'A horde of goblins has been spotted near the village outskirts. Help defend the settlement.',
        difficulty: 'medium',
        estimatedDuration: 15,
        questGiver: 'npc_gareth_guard',
        objectives: [
          {
            id: 'obj_kill_goblins',
            type: 'combat',
            description: 'Defeat 10 goblins threatening the village',
            target: 'mob_goblin',
            quantity: 10,
            optional: false
          }
        ],
        rewards: {
          experience: 250,
          gold: 100,
          items: [{ itemId: 'item_iron_sword', quantity: 1 }]
        },
        tags: ['combat', 'defense', 'goblin'],
        metadata: {
          createdAt: now,
          author: 'Asset Forge Team',
          version: '1.0.0'
        }
      },
      {
        id: 'quest_herb_gathering',
        title: 'The Healing Herb',
        description: 'Luna the Herbalist needs fresh healing herbs from the forest.',
        difficulty: 'easy',
        estimatedDuration: 10,
        questGiver: 'npc_luna_herbalist',
        objectives: [
          {
            id: 'obj_gather_herbs',
            type: 'gathering',
            description: 'Collect 5 healing herbs from the forest',
            target: 'resource_healing_herb',
            quantity: 5,
            location: 'Forest Glen',
            optional: false
          }
        ],
        rewards: {
          experience: 100,
          gold: 50,
          items: [{ itemId: 'item_health_potion', quantity: 3 }]
        },
        tags: ['gathering', 'peaceful', 'herbalism'],
        metadata: {
          createdAt: now,
          author: 'Asset Forge Team',
          version: '1.0.0'
        }
      }
    ],
    npcs: [
      {
        id: 'npc_gareth_guard',
        personality: {
          name: 'Gareth the Guard',
          archetype: 'Warrior',
          traits: ['disciplined', 'protective', 'gruff', 'honorable'],
          goals: ['Protect the village', 'Train new fighters'],
          moralAlignment: 'Lawful Neutral',
          backstory: 'A veteran guard who has defended the village for 20 years.',
          questsOffered: ['quest_goblin_invasion']
        },
        dialogues: [
          {
            id: 'greeting',
            text: 'State your business. I have no time for idle chatter.',
            responses: [
              {
                text: 'I want to help defend the village.',
                nextNodeId: 'quest_offer',
                effects: []
              },
              {
                text: 'Sorry to bother you.',
                nextNodeId: 'end',
                effects: []
              }
            ]
          }
        ],
        behavior: {
          schedule: [
            { time: '06:00', location: 'Guard Post', activity: 'patrol_prep' },
            { time: '12:00', location: 'Village Gates', activity: 'patrolling' }
          ],
          wanderRadius: 20,
          stayInZone: false
        },
        services: ['quest'],
        metadata: {
          createdAt: now,
          author: 'Asset Forge Team',
          version: '1.0.0'
        }
      },
      {
        id: 'npc_luna_herbalist',
        personality: {
          name: 'Luna the Herbalist',
          archetype: 'Healer',
          traits: ['kind', 'nurturing', 'gentle'],
          goals: ['Heal the sick', 'Preserve nature'],
          moralAlignment: 'Neutral Good',
          backstory: 'Learned healing arts from her grandmother.',
          questsOffered: ['quest_herb_gathering']
        },
        dialogues: [
          {
            id: 'greeting',
            text: 'Hello dear. Do you need healing?',
            responses: [
              {
                text: 'I can help gather herbs.',
                nextNodeId: 'quest_offer',
                effects: []
              }
            ]
          }
        ],
        behavior: {
          schedule: [
            { time: '07:00', location: 'Herb Garden', activity: 'tending_plants' }
          ],
          wanderRadius: 15,
          stayInZone: true
        },
        services: ['quest'],
        metadata: {
          createdAt: now,
          author: 'Asset Forge Team',
          version: '1.0.0'
        }
      }
    ],
    lore: [
      {
        id: 'lore_goblin_territories',
        title: 'Goblin Territories',
        content: 'Goblins organize in clans led by chieftains. Recent human expansion has caused conflicts.',
        category: 'location',
        tags: ['goblins', 'conflict'],
        relatedEntities: [
          { type: 'npc', id: 'npc_gareth_guard', name: 'Gareth the Guard' }
        ],
        createdAt: now
      },
      {
        id: 'lore_healing_arts',
        title: 'The Healing Arts',
        content: 'Herbalism uses natural plant properties to heal without magic.',
        category: 'artifact',
        tags: ['healing', 'herbs'],
        relatedEntities: [
          { type: 'npc', id: 'npc_luna_herbalist', name: 'Luna the Herbalist' }
        ],
        createdAt: now
      }
    ],
    version: '1.0.0',
    generatedAt: now
  }
}

/**
 * Check if seed data should be loaded (store is empty)
 */
export function shouldLoadSeedData(
  questCount: number,
  npcCount: number,
  loreCount: number
): boolean {
  return questCount === 0 && npcCount === 0 && loreCount === 0
}

/**
 * Clear seed data from localStorage (for testing/reset)
 */
export function clearStoredContent(): void {
  try {
    localStorage.removeItem('content-generation-cache')
    console.log('Content generation cache cleared')
  } catch (error) {
    console.error('Failed to clear cache:', error)
  }
}
