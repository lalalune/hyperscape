import { Search, Filter, ChevronDown, ChevronUp, X, Database } from 'lucide-react'
import React, { useState, useEffect, useMemo } from 'react'

import { useAssetsStore } from '../../store'
import { useCacheStats } from '@/hooks/useCacheStats'

interface MaterialPreset {
  id: string
  displayName: string
  category: string
  tier: number
  color: string
}

interface AssetFiltersProps {
  totalAssets: number
  filteredCount: number
}

const AssetFilters: React.FC<AssetFiltersProps> = ({
  totalAssets,
  filteredCount
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [materialPresets, setMaterialPresets] = useState<MaterialPreset[]>([])
  const [showCacheStats, setShowCacheStats] = useState(false)

  // Get filter state and actions from store - selective subscriptions
  const searchTerm = useAssetsStore(state => state.searchTerm)
  const typeFilter = useAssetsStore(state => state.typeFilter)
  const materialFilter = useAssetsStore(state => state.materialFilter)
  const setSearchTerm = useAssetsStore(state => state.setSearchTerm)
  const setTypeFilter = useAssetsStore(state => state.setTypeFilter)
  const setMaterialFilter = useAssetsStore(state => state.setMaterialFilter)

  // Cache stats
  const { stats, clearCache } = useCacheStats(showCacheStats)
  
  // Load material presets from public directory
  useEffect(() => {
    fetch('/prompts/material-presets.json')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load material presets: ${res.status} ${res.statusText}`)
        }
        return res.json()
      })
      .then(data => {
        setMaterialPresets(data)
      })
      .catch(err => console.error('Failed to load material presets:', err))
  }, [])

  // Memoize sorted material presets
  const sortedMaterialPresets = useMemo(() => {
    return materialPresets.sort((a, b) => a.tier - b.tier)
  }, [materialPresets])
  
  const hasActiveFilters = searchTerm || typeFilter || materialFilter

  return (
    <div className="card bg-gradient-to-br from-bg-primary to-bg-secondary border-border-primary animate-scale-in">
      {/* Compact Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary bg-opacity-10 rounded">
              <Filter size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Filters</h2>
              {!isExpanded && hasActiveFilters && (
                <p className="text-xs text-primary">Active</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs bg-bg-primary bg-opacity-50 px-2 py-1 rounded-full">
              <span className="text-primary font-bold">{filteredCount}</span>
              <span className="text-text-tertiary">/ {totalAssets}</span>
            </div>
            <button
              onClick={() => setShowCacheStats(!showCacheStats)}
              className={`p-1 hover:bg-bg-secondary rounded transition-all ${showCacheStats ? 'bg-primary bg-opacity-10' : ''}`}
              title={showCacheStats ? "Hide cache stats" : "Show cache stats"}
              aria-label={showCacheStats ? "Hide cache stats" : "Show cache stats"}
            >
              <Database size={14} className={showCacheStats ? "text-primary" : "text-text-tertiary"} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-bg-secondary rounded transition-all"
              title={isExpanded ? "Collapse filters" : "Expand filters"}
              aria-label={isExpanded ? "Collapse filters" : "Expand filters"}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronUp size={16} className="text-text-secondary" />
              ) : (
                <ChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
          </div>
        </div>

        {/* Cache Stats */}
        {showCacheStats && stats && (
          <div className="mx-4 mb-3 p-2 bg-bg-primary bg-opacity-50 rounded-lg border border-border-primary animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Database size={12} className="text-primary" />
                <span className="text-xs font-semibold text-text-primary">Cache Stats</span>
              </div>
              <button
                onClick={clearCache}
                className="text-xs text-text-tertiary hover:text-error transition-colors"
                title="Clear cache"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Hit Rate:</span>
                <span className="text-primary font-semibold">{stats.hitRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Size:</span>
                <span className="text-text-primary">{stats.size}/{stats.capacity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Hits:</span>
                <span className="text-success">{stats.hits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Misses:</span>
                <span className="text-warning">{stats.misses}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          {/* Search */}
          <div className="relative">
            <Search 
              size={16} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary pointer-events-none" 
            />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-lg
                       text-text-primary placeholder-text-tertiary
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary
                       transition-all duration-200"
              aria-label="Search assets by name"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-bg-secondary rounded transition-colors"
                aria-label="Clear search"
              >
                <X size={14} className="text-text-tertiary hover:text-text-primary" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <label htmlFor="asset-type-filter" className="block text-xs font-medium text-text-secondary mb-1.5">Type</label>
            <select
              id="asset-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-lg
                       text-text-primary
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary
                       transition-all duration-200 cursor-pointer hover:border-border-secondary"
              aria-label="Filter assets by type"
            >
              <option value="">All Types</option>
              <option value="weapon">Weapons</option>
              <option value="armor">Armor</option>
              <option value="consumable">Consumables</option>
              <option value="tool">Tools</option>
              <option value="resource">Resources</option>
              <option value="character">Characters</option>
              <option value="environment">Environment</option>
              <option value="misc">Miscellaneous</option>
            </select>
          </div>

          {/* Material Filter */}
          <div>
            <label htmlFor="asset-material-filter" className="block text-xs font-medium text-text-secondary mb-1.5">Material</label>
            <select
              id="asset-material-filter"
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-lg
                       text-text-primary
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary
                       transition-all duration-200 cursor-pointer hover:border-border-secondary"
              aria-label="Filter assets by material"
            >
              <option value="">All Materials</option>
              {sortedMaterialPresets.map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm('')
                setTypeFilter('')
                setMaterialFilter('')
              }}
              className="w-full py-2 text-sm text-text-secondary hover:text-primary 
                       bg-bg-primary hover:bg-primary hover:bg-opacity-10 
                       border border-border-primary hover:border-primary
                       rounded-lg transition-all duration-200 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AssetFilters