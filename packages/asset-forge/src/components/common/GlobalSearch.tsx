/**
 * Global Search Component
 * 
 * Wiki-style global search across all game content with fuzzy matching
 * Allows jumping to any item, mob, NPC, quest, or lore entry
 */

import { Search, X, FileJson, Sword, Users, Target, Scroll, Box } from 'lucide-react'
import React, { useState, useEffect, useRef, useMemo } from 'react'

import { NAVIGATION_VIEWS } from '../../constants/navigation'
import { useNavigation } from '../../hooks/useNavigation'
import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { useManifestsStore } from '../../store/useManifestsStore'
import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest } from '../../types/manifests'
import { globalSearch, type SearchResult } from '../../utils/fuzzy-search'

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Selective subscriptions for performance
  const manifests = useManifestsStore(state => state.manifests)
  const setSelectedType = useManifestsStore(state => state.setSelectedType)
  const setSearchQuery = useManifestsStore(state => state.setSearchQuery)
  const quests = useContentGenerationStore(state => state.quests)
  const generatedNPCs = useContentGenerationStore(state => state.npcs)
  const loreEntries = useContentGenerationStore(state => state.loreEntries)
  const setActiveTab = useContentGenerationStore(state => state.setActiveTab)
  const { navigateTo } = useNavigation()

  // Extract manifest arrays with proper typing - memoized to prevent re-renders
  const items = useMemo(() => (manifests.items || []) as ItemManifest[], [manifests.items])
  const mobs = useMemo(() => (manifests.mobs || []) as MobManifest[], [manifests.mobs])
  const npcs = useMemo(() => (manifests.npcs || []) as NPCManifest[], [manifests.npcs])
  const resources = useMemo(() => (manifests.resources || []) as ResourceManifest[], [manifests.resources])
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])
  
  useEffect(() => {
    if (query.trim() === '') {
      setResults([])
      return
    }

    const searchResults = globalSearch(query, {
      items,
      mobs,
      npcs,
      resources,
      quests,
      generatedNPCs,
      lore: loreEntries
    })

    setResults(searchResults.slice(0, 20)) // Limit to top 20 results
  }, [query, items, mobs, npcs, resources, quests, generatedNPCs, loreEntries])
  
  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'item': return <Box size={16} className="text-blue-400" />
      case 'mob': return <Sword size={16} className="text-red-400" />
      case 'npc': return <Users size={16} className="text-green-400" />
      case 'resource': return <FileJson size={16} className="text-amber-400" />
      case 'quest': return <Target size={16} className="text-purple-400" />
      case 'generated_npc': return <Users size={16} className="text-teal-400" />
      case 'lore': return <Scroll size={16} className="text-orange-400" />
    }
  }
  
  const getResultLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'item': return 'Item'
      case 'mob': return 'Mob'
      case 'npc': return 'NPC'
      case 'resource': return 'Resource'
      case 'quest': return 'Quest'
      case 'generated_npc': return 'Generated NPC'
      case 'lore': return 'Lore'
    }
  }
  
  const getResultName = (result: SearchResult) => {
    const item = result.item
    if ('title' in item && result.type === 'quest') return item.title
    if ('title' in item && result.type === 'lore') return item.title
    if ('personality' in item) return item.personality.name
    if ('name' in item) return item.name
    return result.type
  }
  
  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'item':
        navigateTo(NAVIGATION_VIEWS.GAME_DATA)
        setSelectedType('items')
        setSearchQuery((result.item as ItemManifest).name)
        break
      case 'mob':
        navigateTo(NAVIGATION_VIEWS.GAME_DATA)
        setSelectedType('mobs')
        setSearchQuery((result.item as MobManifest).name)
        break
      case 'npc':
        navigateTo(NAVIGATION_VIEWS.GAME_DATA)
        setSelectedType('npcs')
        setSearchQuery((result.item as NPCManifest).name)
        break
      case 'resource':
        navigateTo(NAVIGATION_VIEWS.GAME_DATA)
        setSelectedType('resources')
        setSearchQuery((result.item as ResourceManifest).name)
        break
      case 'quest':
        navigateTo(NAVIGATION_VIEWS.CONTENT_BUILDER)
        setActiveTab('quest')
        break
      case 'generated_npc':
        navigateTo(NAVIGATION_VIEWS.CONTENT_BUILDER)
        setActiveTab('npc')
        break
      case 'lore':
        navigateTo(NAVIGATION_VIEWS.CONTENT_BUILDER)
        setActiveTab('lore')
        break
    }
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-bg-primary border border-border-primary rounded-xl shadow-2xl overflow-hidden animate-slide-in-down">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-border-primary">
          <Search size={20} className="text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, mobs, NPCs, quests, lore..."
            className="flex-1 bg-transparent text-text-primary placeholder-text-tertiary focus:outline-none"
            aria-label="Search items, mobs, NPCs, quests, and lore"
          />
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Close search dialog"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="divide-y divide-border-primary">
              {results.map((result, idx) => (
                <button
                  key={`${result.type}-${idx}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full p-4 text-left hover:bg-bg-secondary transition-colors flex items-center gap-3"
                >
                  {getResultIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary truncate">
                        {getResultName(result)}
                      </span>
                      <span className="text-xs text-text-tertiary px-2 py-0.5 bg-bg-tertiary rounded">
                        {getResultLabel(result.type)}
                      </span>
                    </div>
                    {'description' in result.item && result.item.description && (
                      <p className="text-sm text-text-secondary truncate">
                        {result.item.description}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {Math.round((1 - result.score) * 100)}% match
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() !== '' ? (
            <div className="p-8 text-center text-text-tertiary">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-8 text-center text-text-tertiary">
              Start typing to search across all content...
            </div>
          )}
        </div>
        
        {/* Footer Hint */}
        <div className="p-3 border-t border-border-primary bg-bg-secondary text-xs text-text-tertiary text-center">
          Press <kbd className="px-2 py-0.5 bg-bg-tertiary rounded">Esc</kbd> to close
        </div>
      </div>
    </div>
  )
}

