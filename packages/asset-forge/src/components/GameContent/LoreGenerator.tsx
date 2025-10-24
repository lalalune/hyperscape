/**
 * Lore Generator
 * Generate lore entries tied to real game entities
 */

import { BookOpen, Sparkles, Plus } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { manifestService } from '../../services/ManifestService'
import type { LoreEntry } from '../../types/content-generation'
import type { ItemManifest, MobManifest, NPCManifest } from '../../types/manifests'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'

interface LoreGeneratorProps {
  onLoreGenerated: (lore: LoreEntry) => void
  onAIGenerate?: (title: string, category: string, relatedEntities: LoreEntry['relatedEntities']) => Promise<string>
}

export const LoreGenerator: React.FC<LoreGeneratorProps> = ({
  onLoreGenerated,
  onAIGenerate
}) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<LoreEntry['category']>('history')
  const [relatedEntities, setRelatedEntities] = useState<LoreEntry['relatedEntities']>([])
  const [generating, setGenerating] = useState(false)
  
  // Manifest data for entity selection
  const [items, setItems] = useState<ItemManifest[]>([])
  const [mobs, setMobs] = useState<MobManifest[]>([])
  const [npcs, setNPCs] = useState<NPCManifest[]>([])

  useEffect(() => {
    loadManifests()
  }, [])

  const loadManifests = async () => {
    try {
      const [itemsData, mobsData, npcsData] = await Promise.all([
        manifestService.getItems(),
        manifestService.getMobs(),
        manifestService.getNPCs()
      ])
      setItems(itemsData)
      setMobs(mobsData)
      setNPCs(npcsData)
    } catch (error) {
      console.error('Failed to load manifests:', error)
    }
  }

  const addRelatedEntity = (type: 'item' | 'mob' | 'npc', id: string, name: string) => {
    if (!relatedEntities.find(e => e.id === id)) {
      setRelatedEntities([...relatedEntities, { type, id, name }])
    }
  }

  const removeRelatedEntity = (id: string) => {
    setRelatedEntities(relatedEntities.filter(e => e.id !== id))
  }

  const handleGenerate = async () => {
    if (!title) return

    if (onAIGenerate && !content) {
      setGenerating(true)
      try {
        const aiContent = await onAIGenerate(title, category, relatedEntities)
        setContent(aiContent)
        
        const lore: LoreEntry = {
          id: `lore_${Date.now()}`,
          title,
          content: aiContent,
          category,
          tags: [category, ...relatedEntities.map(e => e.type)],
          relatedEntities,
          createdAt: new Date().toISOString()
        }
        
        onLoreGenerated(lore)
      } catch (error) {
        console.error('AI generation failed:', error)
      } finally {
        setGenerating(false)
      }
    } else if (content) {
      const lore: LoreEntry = {
        id: `lore_${Date.now()}`,
        title,
        content,
        category,
        tags: [category, ...relatedEntities.map(e => e.type)],
        relatedEntities,
        createdAt: new Date().toISOString()
      }

      onLoreGenerated(lore)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-text-primary">Create Lore Entry</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Origin of the Bronze Sword..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as LoreEntry['category'])}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary"
            >
              <option value="history">History</option>
              <option value="faction">Faction</option>
              <option value="character">Character</option>
              <option value="location">Location</option>
              <option value="artifact">Artifact</option>
              <option value="event">Event</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">
              Content {onAIGenerate && '(optional - AI can generate)'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={onAIGenerate ? "Leave empty to let AI generate..." : "Enter lore content..."}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary"
              rows={4}
            />
          </div>

          {/* Related Entities */}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Related Entities</label>
            <div className="space-y-2">
              {relatedEntities.map((entity) => (
                <div key={entity.id} className="flex items-center justify-between p-2 bg-bg-tertiary rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {entity.type}
                    </Badge>
                    <span className="text-sm text-text-primary">{entity.name}</span>
                  </div>
                  <button
                    onClick={() => removeRelatedEntity(entity.id)}
                    className="text-text-tertiary hover:text-error transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <select
                onChange={(e) => {
                  const [type, id] = e.target.value.split(':')
                  if (!type || !id) return

                  const entity = type === 'item' ? items.find(i => i.id === id) :
                                type === 'mob' ? mobs.find(m => m.id === id) :
                                npcs.find(n => n.id === id)

                  if (entity) {
                    addRelatedEntity(type as 'item' | 'mob' | 'npc', id, entity.name)
                  }
                  e.target.value = ''
                }}
                className="flex-1 px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm"
              >
                <option value="">Link entity...</option>
                <optgroup key="items" label="Items">
                  {items.map((item) => (
                    <option key={item.id} value={`item:${item.id}`}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup key="mobs" label="Mobs">
                  {mobs.map((mob) => (
                    <option key={mob.id} value={`mob:${mob.id}`}>
                      {mob.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup key="npcs" label="NPCs">
                  {npcs.map((npc) => (
                    <option key={npc.id} value={`npc:${npc.id}`}>
                      {npc.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Button
        onClick={handleGenerate}
        disabled={!title || generating}
        className="w-full"
        size="lg"
      >
        {generating ? (
          <>Generating Lore...</>
        ) : onAIGenerate && !content ? (
          <>
            <Sparkles size={16} className="mr-2" />
            AI Generate Lore
          </>
        ) : (
          <>
            <Plus size={16} className="mr-2" />
            Add Lore Entry
          </>
        )}
      </Button>
    </div>
  )
}

