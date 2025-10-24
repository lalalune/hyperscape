/**
 * Manifests Page
 * Browse and view game data manifests (items, mobs, NPCs, etc.)
 */

import React, { useEffect, useCallback } from 'react'

import { LoadingState } from '../components/Assets/LoadingState'
import { ManifestSelector, ManifestTable, ManifestDetails } from '../components/Manifests'
import { manifestService } from '../services/ManifestService'
import { useManifestsStore } from '../store/useManifestsStore'
import type { ManifestType } from '../types/manifests'

export const ManifestsPage: React.FC = () => {
  // Selective subscriptions for performance
  const manifests = useManifestsStore(state => state.manifests)
  const selectedType = useManifestsStore(state => state.selectedType)
  const selectedItem = useManifestsStore(state => state.selectedItem)
  const loading = useManifestsStore(state => state.loading)
  const error = useManifestsStore(state => state.error)
  const searchQuery = useManifestsStore(state => state.searchQuery)
  const setManifests = useManifestsStore(state => state.setManifests)
  const setSelectedType = useManifestsStore(state => state.setSelectedType)
  const setSelectedItem = useManifestsStore(state => state.setSelectedItem)
  const setLoading = useManifestsStore(state => state.setLoading)
  const setError = useManifestsStore(state => state.setError)
  const setSearchQuery = useManifestsStore(state => state.setSearchQuery)
  const getFilteredItems = useManifestsStore(state => state.getFilteredItems)
  const getStats = useManifestsStore(state => state.getStats)

  const loadManifests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await manifestService.fetchAllManifests()
      setManifests(data)

      // Select first type by default
      if (!selectedType && Object.keys(data).length > 0) {
        const firstKey = Object.keys(data)[0] as ManifestType
        setSelectedType(firstKey)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load manifests'
      setError(errorMessage)
      console.error('Error loading manifests:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedType, setManifests, setSelectedType, setLoading, setError])

  // Load manifests on mount
  useEffect(() => {
    loadManifests()
  }, [loadManifests])

  const handleRefresh = async () => {
    if (selectedType) {
      setLoading(true)
      try {
        const data = await manifestService.refreshManifest(selectedType)
        setManifests({
          ...manifests,
          [selectedType]: data
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(`Failed to refresh ${selectedType} manifest: ${errorMessage}`)
        console.error('Error refreshing manifest:', err)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleTypeSelect = (type: ManifestType) => {
    setSelectedType(type)
    setSelectedItem(null)
  }

  const filteredItems = getFilteredItems()
  const stats = getStats()

  if (loading && Object.keys(manifests).length === 0) {
    return <LoadingState />
  }

  if (error && Object.keys(manifests).length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={loadManifests}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container-no-padding flex-col">
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden min-h-0">
        {/* Header */}
        <div className="animate-slide-in-down">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-text-primary">Game Data Manifests</h1>
            <p className="text-text-secondary mt-1">
              Browse and inspect game data loaded from manifests
            </p>
          </div>

          {/* Manifest Type Selector */}
          <ManifestSelector
            selectedType={selectedType}
            onSelect={handleTypeSelect}
            stats={stats}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0 animate-fade-in">
          {/* Table */}
          <div className="flex-1 min-w-0">
            <ManifestTable
              items={filteredItems}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectItem={setSelectedItem}
              selectedItem={selectedItem}
              onRefresh={handleRefresh}
              loading={loading}
            />
          </div>

          {/* Details Panel */}
          {selectedItem && (
            <div className="w-96 min-w-[24rem] animate-slide-in-right">
              <ManifestDetails
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

