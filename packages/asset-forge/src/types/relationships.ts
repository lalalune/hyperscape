/**
 * Entity Relationship Types
 * 
 * Defines relationships between NPCs, mobs, factions, and the player
 * Similar to pipeline's relationship system
 */

export type RelationshipType = 
  | 'ally'
  | 'rival'
  | 'neutral'
  | 'enemy'
  | 'family'
  | 'romantic'
  | 'mentor'

export type EntityType = 'npc' | 'mob' | 'faction' | 'player' | 'generated_npc'

export type QuestRole = 'giver' | 'helper' | 'obstacle' | 'beneficiary' | 'observer'

export interface EntityRelationship {
  id: string
  fromId: string
  fromType: EntityType
  fromName: string
  toId: string
  toType: EntityType
  toName: string
  type: RelationshipType
  strength: number // -100 (mortal enemies) to +100 (inseparable allies)
  history: string
  questRole?: QuestRole
  metadata?: {
    createdAt: string
    source: 'manual' | 'ai_generated'
    verified: boolean
  }
}

export interface RelationshipStats {
  totalRelationships: number
  byType: Record<RelationshipType, number>
  strongestAlliance: EntityRelationship | null
  strongestRivalry: EntityRelationship | null
  averageStrength: number
}

// Helper functions
export function getRelationshipColor(type: RelationshipType): string {
  const colors: Record<RelationshipType, string> = {
    ally: 'text-green-500',
    rival: 'text-orange-500',
    neutral: 'text-gray-500',
    enemy: 'text-red-500',
    family: 'text-blue-500',
    romantic: 'text-pink-500',
    mentor: 'text-purple-500'
  }
  return colors[type]
}

export function getRelationshipLabel(type: RelationshipType): string {
  const labels: Record<RelationshipType, string> = {
    ally: 'Ally',
    rival: 'Rival',
    neutral: 'Neutral',
    enemy: 'Enemy',
    family: 'Family',
    romantic: 'Romantic',
    mentor: 'Mentor'
  }
  return labels[type]
}

export function calculateRelationshipStats(relationships: EntityRelationship[]): RelationshipStats {
  const byType: Record<RelationshipType, number> = {
    ally: 0,
    rival: 0,
    neutral: 0,
    enemy: 0,
    family: 0,
    romantic: 0,
    mentor: 0
  }
  
  relationships.forEach(rel => {
    byType[rel.type]++
  })
  
  const strongestAlliance = relationships
    .filter(r => r.strength > 0)
    .sort((a, b) => b.strength - a.strength)[0] || null
    
  const strongestRivalry = relationships
    .filter(r => r.strength < 0)
    .sort((a, b) => a.strength - b.strength)[0] || null
    
  const averageStrength = relationships.length > 0
    ? relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length
    : 0
  
  return {
    totalRelationships: relationships.length,
    byType,
    strongestAlliance,
    strongestRivalry,
    averageStrength
  }
}

