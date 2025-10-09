import React, { useState, useEffect } from 'react'
import { Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useAssetsStore } from '../../store'

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
  
  // Get filter state and actions from store
  const {
    searchTerm,
    typeFilter,
    materialFilter,
    setSearchTerm,
    setTypeFilter,
    setMaterialFilter
  } = useAssetsStore()
  
  // Load material presets
  useEffect(() => {
    fetch('/prompts/material-presets.json')
      .then(res => res.json())
      .then(data => {
        // Sort by tier to display in logical order
        const sorted = data.sort((a: MaterialPreset, b: MaterialPreset) => a.tier - b.tier)
        setMaterialPresets(sorted)
      })
      .catch(err => console.error('Failed to load material presets:', err))
  }, [])
  
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
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-bg-secondary rounded transition-all"
              title={isExpanded ? "Collapse filters" : "Expand filters"}
            >
              {isExpanded ? (
                <ChevronUp size={16} className="text-text-secondary" />
              ) : (
                <ChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
          </div>
        </div>
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
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-bg-secondary rounded transition-colors"
              >
                <X size={14} className="text-text-tertiary hover:text-text-primary" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-lg
                       text-text-primary
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary
                       transition-all duration-200 cursor-pointer hover:border-border-secondary"
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
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Material</label>
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-lg
                       text-text-primary
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary
                       transition-all duration-200 cursor-pointer hover:border-border-secondary"
            >
              <option value="">All Materials</option>
              {materialPresets.map(preset => (
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