/**
 * Fuzzy Search Utility
 * 
 * Provides intelligent fuzzy matching for game content (items, mobs, NPCs, quests, lore)
 * Uses fuse.js for fast, configurable fuzzy search
 */

import Fuse, { type IFuseOptions } from 'fuse.js'

import type { GeneratedQuest, GeneratedNPC, LoreEntry } from '../types/content-generation'
import type { 
  ItemManifest, 
  MobManifest, 
  NPCManifest, 
  ResourceManifest,
  AnyManifest 
} from '../types/manifests'

// Default fuzzy search options
const defaultOptions = {
  includeScore: true,
  threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
  distance: 100,
  minMatchCharLength: 2,
  ignoreLocation: true
}

// Search configurations for different content types
const searchConfigs = {
  items: {
    ...defaultOptions,
    keys: [
      { name: 'id', weight: 2 },
      { name: 'name', weight: 3 },
      { name: 'description', weight: 1 },
      { name: 'category', weight: 1.5 }
    ]
  },
  mobs: {
    ...defaultOptions,
    keys: [
      { name: 'id', weight: 2 },
      { name: 'name', weight: 3 },
      { name: 'description', weight: 1 },
      { name: 'type', weight: 1.5 }
    ]
  },
  npcs: {
    ...defaultOptions,
    keys: [
      { name: 'id', weight: 2 },
      { name: 'name', weight: 3 },
      { name: 'description', weight: 1 },
      { name: 'npcType', weight: 1.5 },
      { name: 'services', weight: 1 }
    ]
  },
  resources: {
    ...defaultOptions,
    keys: [
      { name: 'id', weight: 2 },
      { name: 'name', weight: 3 },
      { name: 'description', weight: 1 },
      { name: 'type', weight: 1.5 }
    ]
  },
  quests: {
    ...defaultOptions,
    keys: [
      { name: 'id', weight: 2 },
      { name: 'title', weight: 3 },
      { name: 'description', weight: 2 },
      { name: 'difficulty', weight: 1 },
      { name: 'type', weight: 1.5 },
      { name: 'loreContext', weight: 1 },
      { name: 'questGiver', weight: 1.5 }
    ]
  },
  generatedNPCs: {
    ...defaultOptions,
    keys: [
      { name: 'id', weight: 2 },
      { name: 'personality.name', weight: 3 },
      { name: 'personality.archetype', weight: 2 },
      { name: 'personality.backstory', weight: 1.5 },
      { name: 'personality.traits', weight: 1 },
      { name: 'services', weight: 1.5 }
    ]
  },
  lore: {
    ...defaultOptions,
    keys: [
      { name: 'id', weight: 2 },
      { name: 'title', weight: 3 },
      { name: 'content', weight: 2 },
      { name: 'category', weight: 1.5 },
      { name: 'tags', weight: 1 }
    ]
  }
}

export class FuzzySearch<T> {
  private fuse: Fuse<T>

  constructor(items: T[], config: IFuseOptions<T>) {
    this.fuse = new Fuse(items, config)
  }
  
  search(query: string): T[] {
    if (!query || query.trim() === '') {
      return []
    }
    
    const results = this.fuse.search(query)
    return results.map(result => result.item)
  }
  
  searchWithScore(query: string): Array<{ item: T; score: number }> {
    if (!query || query.trim() === '') {
      return []
    }
    
    const results = this.fuse.search(query)
    return results.map(result => ({
      item: result.item,
      score: result.score || 0
    }))
  }
  
  updateItems(items: T[]): void {
    this.fuse.setCollection(items)
  }
}

// Factory functions for different content types
export function createItemSearch(items: ItemManifest[]) {
  return new FuzzySearch(items, searchConfigs.items)
}

export function createMobSearch(mobs: MobManifest[]) {
  return new FuzzySearch(mobs, searchConfigs.mobs)
}

export function createNPCSearch(npcs: NPCManifest[]) {
  return new FuzzySearch(npcs, searchConfigs.npcs)
}

export function createResourceSearch(resources: ResourceManifest[]) {
  return new FuzzySearch(resources, searchConfigs.resources)
}

export function createQuestSearch(quests: GeneratedQuest[]) {
  return new FuzzySearch(quests, searchConfigs.quests)
}

export function createGeneratedNPCSearch(npcs: GeneratedNPC[]) {
  return new FuzzySearch(npcs, searchConfigs.generatedNPCs)
}

export function createLoreSearch(lore: LoreEntry[]) {
  return new FuzzySearch(lore, searchConfigs.lore)
}

// Global search across all content types
export interface SearchResult {
  type: 'item' | 'mob' | 'npc' | 'resource' | 'quest' | 'generated_npc' | 'lore'
  item: AnyManifest | GeneratedQuest | GeneratedNPC | LoreEntry
  score: number
}

export function globalSearch(
  query: string,
  content: {
    items?: ItemManifest[]
    mobs?: MobManifest[]
    npcs?: NPCManifest[]
    resources?: ResourceManifest[]
    quests?: GeneratedQuest[]
    generatedNPCs?: GeneratedNPC[]
    lore?: LoreEntry[]
  }
): SearchResult[] {
  const results: SearchResult[] = []
  
  if (content.items) {
    const search = createItemSearch(content.items)
    const itemResults = search.searchWithScore(query)
    results.push(...itemResults.map(r => ({
      type: 'item' as const,
      item: r.item,
      score: r.score
    })))
  }
  
  if (content.mobs) {
    const search = createMobSearch(content.mobs)
    const mobResults = search.searchWithScore(query)
    results.push(...mobResults.map(r => ({
      type: 'mob' as const,
      item: r.item,
      score: r.score
    })))
  }
  
  if (content.npcs) {
    const search = createNPCSearch(content.npcs)
    const npcResults = search.searchWithScore(query)
    results.push(...npcResults.map(r => ({
      type: 'npc' as const,
      item: r.item,
      score: r.score
    })))
  }
  
  if (content.resources) {
    const search = createResourceSearch(content.resources)
    const resourceResults = search.searchWithScore(query)
    results.push(...resourceResults.map(r => ({
      type: 'resource' as const,
      item: r.item,
      score: r.score
    })))
  }
  
  if (content.quests) {
    const search = createQuestSearch(content.quests)
    const questResults = search.searchWithScore(query)
    results.push(...questResults.map(r => ({
      type: 'quest' as const,
      item: r.item,
      score: r.score
    })))
  }
  
  if (content.generatedNPCs) {
    const search = createGeneratedNPCSearch(content.generatedNPCs)
    const npcResults = search.searchWithScore(query)
    results.push(...npcResults.map(r => ({
      type: 'generated_npc' as const,
      item: r.item,
      score: r.score
    })))
  }
  
  if (content.lore) {
    const search = createLoreSearch(content.lore)
    const loreResults = search.searchWithScore(query)
    results.push(...loreResults.map(r => ({
      type: 'lore' as const,
      item: r.item,
      score: r.score
    })))
  }
  
  // Sort by score (lower is better in fuse.js)
  return results.sort((a, b) => a.score - b.score)
}

