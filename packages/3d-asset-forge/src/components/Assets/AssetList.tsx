import React, { useState, useMemo } from 'react'
import { Asset } from '../../types'
import { useAssetsStore } from '../../store'
import { getTierColor } from '../../constants'

import {
  Package, Shield, Swords, Diamond, Hammer, Building,
  User, Trees, Box, Target, HelpCircle, Sparkles,
  ChevronRight, Layers
} from 'lucide-react'

interface AssetListProps {
  assets: Asset[]
  onAssetDelete?: (asset: Asset) => void
}

interface AssetGroup {
  base: Asset
  variants: Asset[]
}

const AssetList: React.FC<AssetListProps> = ({
  assets,
}) => {
  // Get state and actions from store
  const { selectedAsset, handleAssetSelect } = useAssetsStore()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')

  // Group assets by base/variants
  const assetGroups = useMemo(() => {
    const groups: Record<string, AssetGroup> = {}
    const standaloneAssets: Asset[] = []

    // First pass: identify base models
    assets.forEach(asset => {
      if (asset.metadata.isBaseModel) {
        groups[asset.id] = { base: asset, variants: [] }
      }
    })

    // Second pass: assign variants to their base models
    assets.forEach(asset => {
      if (asset.metadata.isVariant && asset.metadata.parentBaseModel) {
        const baseId = asset.metadata.parentBaseModel
        if (groups[baseId]) {
          groups[baseId].variants.push(asset)
        } else {
          standaloneAssets.push(asset)
        }
      } else if (!asset.metadata.isBaseModel) {
        standaloneAssets.push(asset)
      }
    })

    // Sort variants by tier
    Object.values(groups).forEach(group => {
      group.variants.sort((a, b) => {
        const tierOrder = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'wood', 'oak', 'willow', 'leather', 'standard']
        const aIndex = tierOrder.indexOf(a.metadata.tier || '')
        const bIndex = tierOrder.indexOf(b.metadata.tier || '')
        return aIndex - bIndex
      })
    })

    return { groups: Object.values(groups), standalone: standaloneAssets }
  }, [assets])

  // Group assets by type for flat view
  const assetsByType = useMemo(() => {
    const typeGroups: Record<string, Asset[]> = {}

    assets.forEach(asset => {
      const type = asset.type || 'other'
      if (!typeGroups[type]) {
        typeGroups[type] = []
      }
      typeGroups[type].push(asset)
    })

    // Sort assets within each type group by name
    Object.values(typeGroups).forEach(group => {
      group.sort((a, b) => a.name.localeCompare(b.name))
    })

    // Order types by priority
    const typeOrder = ['character', 'weapon', 'armor', 'shield', 'tool', 'resource', 'building', 'environment', 'prop', 'ammunition', 'other']
    const orderedTypes: Record<string, Asset[]> = {}

    typeOrder.forEach(type => {
      if (typeGroups[type]) {
        orderedTypes[type] = typeGroups[type]
      }
    })

    // Add any remaining types not in the order
    Object.keys(typeGroups).forEach(type => {
      if (!orderedTypes[type]) {
        orderedTypes[type] = typeGroups[type]
      }
    })

    return orderedTypes
  }, [assets])

  // Group the grouped view by type as well
  const groupedAssetsByType = useMemo(() => {
    const typeGroups: Record<string, { groups: typeof assetGroups.groups, standalone: Asset[] }> = {}

    // Group base/variant groups by type
    assetGroups.groups.forEach(group => {
      const type = group.base.type || 'other'
      if (!typeGroups[type]) {
        typeGroups[type] = { groups: [], standalone: [] }
      }
      typeGroups[type].groups.push(group)
    })

    // Group standalone assets by type
    assetGroups.standalone.forEach(asset => {
      const type = asset.type || 'other'
      if (!typeGroups[type]) {
        typeGroups[type] = { groups: [], standalone: [] }
      }
      typeGroups[type].standalone.push(asset)
    })

    // Apply the same type ordering
    const typeOrder = ['character', 'weapon', 'armor', 'shield', 'tool', 'resource', 'building', 'environment', 'prop', 'ammunition', 'other']
    const orderedTypes: typeof typeGroups = {}

    typeOrder.forEach(type => {
      if (typeGroups[type]) {
        orderedTypes[type] = typeGroups[type]
      }
    })

    // Add any remaining types
    Object.keys(typeGroups).forEach(type => {
      if (!orderedTypes[type]) {
        orderedTypes[type] = typeGroups[type]
      }
    })

    return orderedTypes
  }, [assetGroups])

  const toggleGroup = (baseId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(baseId)) {
      newExpanded.delete(baseId)
    } else {
      newExpanded.add(baseId)
    }
    setExpandedGroups(newExpanded)
  }

  const getAssetIcon = (type: string, subtype?: string) => {
    switch (type) {
      case 'weapon':
        return <Swords size={20} />
      case 'armor':
        return <Shield size={20} />
      case 'resource':
        return <Diamond size={20} />
      case 'tool':
        return <Hammer size={20} />
      case 'building':
        return <Building size={20} />
      case 'character':
        return <User size={20} />
      case 'environment':
        return <Trees size={20} />
      case 'prop':
        return <Box size={20} />
      case 'ammunition':
        return <Target size={20} />
      default:
        return <HelpCircle size={20} />
    }
  }



  // Clean up asset names for display
  const cleanAssetName = (name: string, isBase: boolean = false): string => {
    // For base items, preserve the number but clean up the format
    if (isBase) {
      // Handle cases like "body-leather-base-01" or "legs-metal-base-02"
      const baseMatch = name.match(/^(.+?)-base-?(\d+)?$/i)
      if (baseMatch) {
        const [, itemName, number] = baseMatch
        const cleaned = itemName.replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        return number ? `${cleaned} ${number}` : cleaned
      }
    }

    // For variants, check if it's a numbered variant with redundant material names
    const variantMatch = name.match(/^(.+?)[-\s](\d+)[-\s](.+)$/)
    if (variantMatch && !isBase) {
      const [, baseName, number, material] = variantMatch
      // If the base name and material are similar, just return the material
      const baseWords = baseName.toLowerCase().split(/[-\s]+/)
      const materialWords = material.toLowerCase().split(/[-\s]+/)

      // Check if material name contains base name parts (redundant)
      const isRedundant = materialWords.some(word => baseWords.includes(word))

      if (isRedundant || baseWords.some(word => word === 'body' || word === 'legs' || word === 'helmet')) {
        // Just return the material name, capitalized
        return material
          .split(/[-\s]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
    }

    // Default cleaning
    let cleaned = name
      .replace(/-base$/i, '')
      .replace(/-standard$/i, '')
      .replace(/-/g, ' ')

    // Capitalize words
    return cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (assets.length === 0) {
    return (
      <div className="card overflow-hidden flex flex-col h-full bg-gradient-to-br from-bg-primary to-bg-secondary animate-scale-in">
        <div className="p-4 border-b border-border-primary bg-bg-primary bg-opacity-30">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Package size={18} className="text-primary" />
            Assets <span className="text-text-tertiary font-normal text-sm">(0)</span>
          </h2>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-bg-primary bg-opacity-40 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Package size={32} className="text-text-muted opacity-50" />
            </div>
            <p className="text-text-secondary text-sm font-medium">No assets found</p>
            <p className="text-text-tertiary text-xs mt-1.5">Try adjusting your search filters</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden flex flex-col h-full bg-gradient-to-br from-bg-primary to-bg-secondary animate-scale-in">
      <div className="p-4 border-b border-border-primary bg-bg-primary bg-opacity-30 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Package size={18} className="text-primary" />
            Assets <span className="text-text-tertiary font-normal text-sm">({assets.length})</span>
          </h2>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grouped'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
                }`}
              title="Group by base models"
            >
              <Layers size={14} />
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'flat'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
                }`}
              title="Show all items"
            >
              <Package size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-1">
          {viewMode === 'grouped' ? (
            <>
              {/* Render grouped view with type headers */}
              {Object.entries(groupedAssetsByType).map(([type, typeData], typeIndex) => {
                // Better pluralization
                const typeLabel = (() => {
                  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
                  switch (type) {
                    case 'ammunition': return 'Ammunition'
                    case 'armor': return 'Armor'
                    default: return capitalizedType + 's'
                  }
                })()

                const totalCount = typeData.groups.length + typeData.standalone.length
                if (totalCount === 0) return null

                return (
                  <div key={type} className="mb-4">
                    {/* Type Header */}
                    <div className="flex items-center gap-2 mb-2 px-2">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        {typeLabel} ({totalCount})
                      </h3>
                      <div className="flex-1 h-px bg-border-secondary opacity-30" />
                    </div>

                    {/* Base Items with Variants */}
                    {typeData.groups.map((group, groupIndex) => (
                      <div key={group.base.id} className="animate-scale-in-top" style={{ animationDelay: `${(typeIndex * 50) + (groupIndex * 30)}ms` }}>
                        {/* Base Item */}
                        <div className={`group relative rounded-lg transition-all duration-200 ${selectedAsset?.id === group.base.id
                            ? 'bg-primary bg-opacity-5'
                            : 'hover:bg-bg-primary hover:bg-opacity-50'
                          }`}>
                          <div className="flex items-center p-3">
                            {/* Chevron for expand/collapse */}
                            {group.variants.length > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleGroup(group.base.id)
                                }}
                                className="p-1.5 -ml-1 mr-2 hover:bg-bg-secondary rounded-md transition-all duration-200 hover:scale-110"
                              >
                                <ChevronRight
                                  size={16}
                                  className={`text-text-tertiary transition-transform duration-200 ${expandedGroups.has(group.base.id) ? 'rotate-90' : ''
                                    }`}
                                />
                              </button>
                            ) : (
                              <div className="w-7 h-7 -ml-1 mr-2" />
                            )}

                            <div
                              className="flex-1 flex items-center gap-3 cursor-pointer py-1"
                              onClick={() => handleAssetSelect(group.base)}
                            >
                              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${selectedAsset?.id === group.base.id
                                  ? 'bg-primary bg-opacity-10 text-text-primary shadow-sm ring-2 ring-primary'
                                  : 'bg-bg-secondary bg-opacity-70 text-text-tertiary group-hover:bg-bg-tertiary group-hover:text-text-secondary'
                                }`}>
                                {React.cloneElement(getAssetIcon(group.base.type, group.base.metadata.subtype), { size: 18 })}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-sm text-text-primary truncate">
                                    {cleanAssetName(group.base.name, true)}
                                  </h3>
                                  {group.variants.length > 0 && (
                                    <span className="text-xs text-text-secondary">
                                      ({group.variants.length})
                                    </span>
                                  )}
                                  {group.base.hasModel && (
                                    <Sparkles size={12} className="text-success flex-shrink-0" />
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-[0.6875rem] mt-0.5">
                                  <span className="px-1.5 py-0.5 bg-primary bg-opacity-20 text-primary rounded text-[0.625rem] font-medium">
                                    BASE
                                  </span>
                                  <span className="text-text-tertiary capitalize">{group.base.type}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {selectedAsset?.id === group.base.id && (
                                <div className="w-1 h-8 bg-primary rounded-full" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Variants */}
                        {expandedGroups.has(group.base.id) && (
                          <div className="ml-10 mt-0.5 space-y-0.5 animate-scale-in-top">
                            {group.variants.map((variant, variantIndex) => (
                              <div
                                key={variant.id}
                                className={`group relative rounded-md cursor-pointer transition-all duration-200 ${selectedAsset?.id === variant.id
                                    ? 'bg-primary bg-opacity-5'
                                    : 'hover:bg-bg-primary hover:bg-opacity-30'
                                  }`}
                                onClick={() => handleAssetSelect(variant)}
                                style={{ animationDelay: `${(typeIndex * 50) + (groupIndex * 30) + (variantIndex * 10)}ms` }}
                              >
                                <div className="flex items-center gap-3 p-2 pl-3">
                                  <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${selectedAsset?.id === variant.id
                                      ? 'bg-primary bg-opacity-10 text-text-primary ring-2 ring-primary'
                                      : 'bg-bg-secondary bg-opacity-50 text-text-tertiary group-hover:bg-bg-tertiary group-hover:text-text-secondary'
                                    }`}>
                                    {React.cloneElement(getAssetIcon(variant.type, variant.metadata.subtype), { size: 16 })}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-xs text-text-primary truncate">
                                      {cleanAssetName(variant.name)}
                                    </h3>

                                    {variant.metadata.tier && (
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <div
                                          className="w-2 h-2 rounded-full shadow-sm"
                                          style={{ backgroundColor: getTierColor(variant.metadata.tier) }}
                                        />
                                        <span
                                          className="text-[0.625rem] font-medium capitalize"
                                          style={{ color: getTierColor(variant.metadata.tier) }}
                                        >
                                          {variant.metadata.tier}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {variant.hasModel && (
                                      <Sparkles size={10} className="text-success" />
                                    )}
                                    {selectedAsset?.id === variant.id && (
                                      <div className="w-0.5 h-6 bg-primary rounded-full" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Standalone Items in this type */}
                    {typeData.standalone.map((asset, index) => (
                      <div
                        key={asset.id}
                        className={`group relative rounded-lg transition-all duration-200 animate-scale-in-top ${selectedAsset?.id === asset.id
                            ? 'bg-primary bg-opacity-5'
                            : 'hover:bg-bg-primary hover:bg-opacity-50'
                          }`}
                        style={{ animationDelay: `${(typeIndex * 50) + (typeData.groups.length * 30) + (index * 30)}ms` }}
                        onClick={() => handleAssetSelect(asset)}
                      >
                        <div className="flex items-center gap-3 p-2 hover:bg-bg-primary hover:bg-opacity-40 rounded-lg transition-colors">
                          <div className="w-6" /> {/* Spacer for alignment */}

                          <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${selectedAsset?.id === asset.id
                              ? 'bg-primary bg-opacity-10 text-text-primary shadow-sm ring-2 ring-primary'
                              : 'bg-bg-secondary bg-opacity-70 text-text-tertiary'
                            }`}>
                            {React.cloneElement(getAssetIcon(asset.type, asset.metadata.subtype), { size: 18 })}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm text-text-primary truncate">
                                {cleanAssetName(asset.name, asset.metadata.isBaseModel)}
                              </h3>
                              {asset.hasModel && (
                                <Sparkles size={12} className="text-success flex-shrink-0" />
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[0.6875rem] mt-0.5">
                              {asset.metadata.isBaseModel && (
                                <>
                                  <span className="px-1.5 py-0.5 bg-primary bg-opacity-20 text-primary rounded text-[0.625rem] font-medium">
                                    BASE
                                  </span>
                                  <span className="text-text-muted">•</span>
                                </>
                              )}
                              <span className="text-text-tertiary capitalize">{asset.type}</span>

                              {asset.metadata.tier && asset.metadata.tier !== 'base' && (
                                <>
                                  <span className="text-text-muted">•</span>
                                  <div className="flex items-center gap-1">
                                    <div
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: getTierColor(asset.metadata.tier) }}
                                    />
                                    <span
                                      className="font-medium capitalize"
                                      style={{ color: getTierColor(asset.metadata.tier) }}
                                    >
                                      {asset.metadata.tier}
                                    </span>
                                  </div>
                                </>
                              )}

                              {asset.metadata.isPlaceholder && (
                                <>
                                  <span className="text-text-muted">•</span>
                                  <span className="bg-warning bg-opacity-15 text-warning px-1.5 py-0.5 rounded text-[0.625rem] font-medium">
                                    PLACEHOLDER
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {selectedAsset?.id === asset.id && (
                              <div className="w-1 h-8 bg-primary rounded-full" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          ) : (
            /* Flat view - grouped by type */
            <>
              {Object.entries(assetsByType).map(([type, typeAssets], typeIndex) => {
                // Better pluralization
                const typeLabel = (() => {
                  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
                  switch (type) {
                    case 'ammunition': return 'Ammunition'
                    case 'armor': return 'Armor'
                    default: return capitalizedType + 's'
                  }
                })()

                return (
                  <div key={type} className="mb-4">
                    {/* Type Header */}
                    <div className="flex items-center gap-2 mb-2 px-2">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        {typeLabel} ({typeAssets.length})
                      </h3>
                      <div className="flex-1 h-px bg-border-secondary opacity-30" />
                    </div>

                    {/* Assets in this type */}
                    {typeAssets.map((asset, index) => {
                      const isBase = asset.metadata.isBaseModel
                      const variantCount = isBase ? assetGroups.groups.find(g => g.base.id === asset.id)?.variants.length || 0 : 0

                      return (
                        <div
                          key={asset.id}
                          className={`group relative rounded-lg transition-all duration-200 animate-scale-in-top ${selectedAsset?.id === asset.id
                              ? 'bg-primary bg-opacity-5'
                              : 'hover:bg-bg-primary hover:bg-opacity-50'
                            }`}
                          style={{ animationDelay: `${(typeIndex * 50) + (index * 10)}ms` }}
                          onClick={() => handleAssetSelect(asset)}
                        >
                          <div className="flex items-center gap-3 p-2 hover:bg-bg-primary hover:bg-opacity-40 rounded-lg transition-colors">
                            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${selectedAsset?.id === asset.id
                                ? 'bg-primary bg-opacity-10 text-text-primary shadow-sm ring-2 ring-primary'
                                : 'bg-bg-secondary bg-opacity-70 text-text-tertiary'
                              }`}>
                              {React.cloneElement(getAssetIcon(asset.type, asset.metadata.subtype), { size: 18 })}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm text-text-primary truncate">
                                  {cleanAssetName(asset.name, asset.metadata.isBaseModel)}
                                </h3>
                                {asset.hasModel && (
                                  <Sparkles size={12} className="text-success flex-shrink-0" />
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[0.6875rem] mt-0.5">
                                {asset.metadata.isBaseModel && (
                                  <>
                                    <span className="px-1.5 py-0.5 bg-primary bg-opacity-20 text-primary rounded text-[0.625rem] font-medium">
                                      BASE
                                    </span>
                                    <span className="text-text-muted">•</span>
                                  </>
                                )}
                                <span className="text-text-tertiary capitalize">{asset.type}</span>

                                {asset.metadata.isBaseModel && variantCount > 0 && (
                                  <>
                                    <span className="text-text-muted">•</span>
                                    <span className="text-text-secondary flex items-center gap-1">
                                      <Layers size={10} className="text-text-tertiary" />
                                      {variantCount} variant{variantCount !== 1 ? 's' : ''}
                                    </span>
                                  </>
                                )}

                                {asset.metadata.tier && asset.metadata.tier !== 'base' && (
                                  <>
                                    <span className="text-text-muted">•</span>
                                    <div className="flex items-center gap-1">
                                      <div
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: getTierColor(asset.metadata.tier) }}
                                      />
                                      <span
                                        className="font-medium capitalize"
                                        style={{ color: getTierColor(asset.metadata.tier) }}
                                      >
                                        {asset.metadata.tier}
                                      </span>
                                    </div>
                                  </>
                                )}

                                {asset.metadata.isPlaceholder && (
                                  <>
                                    <span className="text-text-muted">•</span>
                                    <span className="bg-warning bg-opacity-15 text-warning px-1.5 py-0.5 rounded text-[0.625rem] font-medium">
                                      PLACEHOLDER
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {selectedAsset?.id === asset.id && (
                                <div className="w-1 h-8 bg-primary rounded-full" />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AssetList