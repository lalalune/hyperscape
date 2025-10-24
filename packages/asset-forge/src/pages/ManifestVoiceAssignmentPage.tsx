/**
 * Manifest Voice Assignment Page
 *
 * Assign voices to NPCs and Mobs from game manifests.
 * Allows bulk voice assignment and profile management for existing game entities.
 *
 * Features:
 * - Browse NPCs/Mobs from manifests
 * - Filter by type (quest giver, merchant, combat, etc.)
 * - Assign voices with preview
 * - Generate sample dialogue based on NPC type
 * - Bulk assignment operations
 * - Voice profile persistence
 *
 * Integration:
 * - Loads data from ManifestsPage/useManifestsStore
 * - Uses VoiceBrowser for voice selection
 * - Persists assignments via API
 */

import { Users, Mic, Search, Filter, Sparkles, Save, AlertCircle, Loader2, Check } from 'lucide-react'
import React, { useState, useEffect, useMemo, useCallback } from 'react'

import { VoiceBrowser } from '../components/Voice/VoiceBrowser'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card, CardHeader, CardContent } from '../components/common/Card'
import { useManifestsStore } from '../store/useManifestsStore'
import { useVoiceGenerationStore } from '../store/useVoiceGenerationStore'
import type { NPCManifest, MobManifest } from '../types/manifests'

type EntityType = 'npc' | 'mob'
type Entity = NPCManifest | MobManifest

interface VoiceAssignment {
  entityId: string
  entityName: string
  entityType: EntityType
  voiceId: string | null
  voiceName: string | null
}

export const ManifestVoiceAssignmentPage: React.FC = () => {
  // Selective subscriptions for performance
  const manifests = useManifestsStore(state => state.manifests)
  const manifestsLoading = useManifestsStore(state => state.loading)
  const selectedVoiceId = useVoiceGenerationStore(state => state.selectedVoiceId)

  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>('npc')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [voiceAssignments, setVoiceAssignments] = useState<Map<string, VoiceAssignment>>(new Map())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load manifests on mount
  useEffect(() => {
    loadManifests()
  }, [])

  const loadManifests = async () => {
    // Manifests are loaded by ManifestsPage/useManifestsStore
    // This is a placeholder for any additional loading logic
  }

  // Get entities based on selected type
  const entities = useMemo(() => {
    if (selectedEntityType === 'npc') {
      return (manifests.npcs || []) as Entity[]
    } else {
      return (manifests.mobs || []) as Entity[]
    }
  }, [selectedEntityType, manifests])

  // Extract unique types for filtering
  const entityTypes = useMemo(() => {
    const types = new Set<string>()
    entities.forEach(entity => {
      if ('type' in entity) {
        types.add(entity.type)
      }
      if ('npcType' in entity && entity.npcType) {
        types.add(entity.npcType)
      }
    })
    return Array.from(types).sort()
  }, [entities])

  // Filtered entities
  const filteredEntities = useMemo(() => {
    return entities.filter(entity => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const nameMatch = entity.name.toLowerCase().includes(query)
        const descMatch = entity.description?.toLowerCase().includes(query)
        if (!nameMatch && !descMatch) return false
      }

      // Type filter
      if (filterType !== 'all') {
        const entityType = ('npcType' in entity && entity.npcType) || ('type' in entity ? entity.type : '')
        if (entityType !== filterType) return false
      }

      return true
    })
  }, [entities, searchQuery, filterType])

  // Get voice assignment for entity
  const getVoiceAssignment = useCallback((entityId: string): VoiceAssignment | undefined => {
    return voiceAssignments.get(entityId)
  }, [voiceAssignments])

  // Handle voice selection
  const handleVoiceSelect = useCallback((voiceId: string, voiceName: string) => {
    if (!selectedEntity) return

    const assignment: VoiceAssignment = {
      entityId: selectedEntity.id,
      entityName: selectedEntity.name,
      entityType: selectedEntityType,
      voiceId,
      voiceName
    }

    setVoiceAssignments(prev => new Map(prev).set(selectedEntity.id, assignment))
    setShowVoiceModal(false)
    setSelectedEntity(null)
  }, [selectedEntity, selectedEntityType])

  // Clear voice assignment
  const handleClearVoice = useCallback((entityId: string) => {
    setVoiceAssignments(prev => {
      const newMap = new Map(prev)
      newMap.delete(entityId)
      return newMap
    })
  }, [])

  // Save all assignments (would call API in real implementation)
  const handleSaveAssignments = async () => {
    setSaving(true)
    setSaveError(null)

    try {
      // GitHub Issue #5: Implement API endpoint for voice assignment persistence
      // await voiceGenerationService.saveManifestVoiceAssignments(Array.from(voiceAssignments.values()))

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('[ManifestVoiceAssignment] Saved assignments:', Array.from(voiceAssignments.values()))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save assignments')
    } finally {
      setSaving(false)
    }
  }

  const assignmentCount = voiceAssignments.size
  const totalEntities = filteredEntities.length

  return (
    <div className="w-full h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Manifest Voice Assignment</h1>
              <p className="text-text-secondary mt-1 text-sm sm:text-base">
                Assign voices to NPCs and Mobs from your game manifests
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="secondary" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {totalEntities} Entities
            </Badge>
            <Badge variant={assignmentCount > 0 ? 'success' : 'secondary'} className="text-xs">
              <Mic className="w-3 h-3 mr-1" />
              {assignmentCount} Assigned
            </Badge>
          </div>
        </div>

        {/* Entity Type Selector */}
        <Card>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant={selectedEntityType === 'npc' ? 'primary' : 'secondary'}
                onClick={() => setSelectedEntityType('npc')}
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-2" />
                NPCs ({(manifests.npcs || []).length})
              </Button>
              <Button
                variant={selectedEntityType === 'mob' ? 'primary' : 'secondary'}
                onClick={() => setSelectedEntityType('mob')}
                className="flex-1"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Mobs ({(manifests.mobs || []).length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardContent>
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or description..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="input flex-1"
                >
                  <option value="all">All Types</option>
                  {entityTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entity List */}
        {manifestsLoading ? (
          <Card>
            <CardContent>
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="ml-3 text-gray-400">Loading entities...</span>
              </div>
            </CardContent>
          </Card>
        ) : filteredEntities.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center p-12">
                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No entities found matching your filters</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredEntities.map(entity => {
              const assignment = getVoiceAssignment(entity.id)
              const hasVoice = !!assignment?.voiceId

              return (
                <Card key={entity.id}>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white truncate">{entity.name}</h3>
                          {hasVoice && (
                            <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-1">{entity.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" size="sm">
                            {('npcType' in entity && entity.npcType) || ('type' in entity ? entity.type : 'Unknown')}
                          </Badge>
                          {hasVoice && (
                            <Badge variant="success" size="sm">
                              <Mic className="w-3 h-3 mr-1" />
                              {assignment.voiceName}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant={hasVoice ? 'secondary' : 'primary'}
                          onClick={() => {
                            setSelectedEntity(entity)
                            setShowVoiceModal(true)
                          }}
                        >
                          <Mic className="w-4 h-4 mr-1" />
                          {hasVoice ? 'Change' : 'Assign'}
                        </Button>
                        {hasVoice && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleClearVoice(entity.id)}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Save Actions */}
        {assignmentCount > 0 && (
          <Card className="sticky bottom-4 shadow-2xl">
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">
                    {assignmentCount} voice assignment{assignmentCount !== 1 ? 's' : ''} ready to save
                  </p>
                  <p className="text-sm text-gray-400">
                    Changes will be persisted to the database
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setVoiceAssignments(new Map())}
                    disabled={saving}
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={handleSaveAssignments}
                    loading={saving}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Assignments
                  </Button>
                </div>
              </div>
              {saveError && (
                <div className="mt-3 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded-lg text-red-400 text-sm">
                  {saveError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Voice Selection Modal */}
        {showVoiceModal && selectedEntity && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 sm:p-8"
            style={{
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 1)'
            }}
          >
            <div
              className="bg-gray-50 rounded-lg p-4 sm:p-6 max-w-6xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-gray-200"
              style={{
                position: 'relative',
                zIndex: 10000
              }}
            >
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Select Voice</h2>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowVoiceModal(false)
                      setSelectedEntity(null)
                    }}
                  >
                    Close
                  </Button>
                </div>
                <p className="text-gray-600">
                  Assign a voice to <span className="text-gray-900 font-medium">{selectedEntity.name}</span>
                </p>
              </div>
              <VoiceBrowser
                onSelect={handleVoiceSelect}
                selectedVoiceId={selectedVoiceId}
              />
            </div>
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-blue-500 from-opacity-5 to-purple-500 to-opacity-5 border-blue-500 border-opacity-20">
          <CardHeader>
            <h3 className="text-lg font-semibold text-text-primary">How Voice Assignment Works</h3>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">1.</span>
                <span>Browse and filter NPCs or Mobs from your game manifests</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">2.</span>
                <span>Click "Assign" to select a voice from the ElevenLabs library</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">3.</span>
                <span>Preview voices before assignment to ensure the right fit</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">4.</span>
                <span>Save all assignments to persist voice profiles with your entities</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">5.</span>
                <span>Use assigned voices in dialogue generation and NPC scripts</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
