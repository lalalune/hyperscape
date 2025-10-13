import React, { useState, useMemo } from 'react'
import { Card, CardContent, Badge, Input } from '../common'
import { cn } from '../../styles'
import { Search, ChevronRight, Package } from 'lucide-react'
import { Asset } from '../../types'
import { EQUIPMENT_SLOTS } from '../../constants'

interface EquipmentListProps {
  assets: Asset[]
  selectedAssetId?: string | null
  selectedSlot?: string
  onAssetSelect: (asset: Asset) => void
  onSlotChange?: (slot: string) => void
  isLoading?: boolean
}

export const EquipmentList: React.FC<EquipmentListProps> = ({
  assets,
  selectedAssetId,
  selectedSlot = 'Hand_R',
  onAssetSelect,
  onSlotChange,
  isLoading
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // Filter assets based on search and equipment type
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Filter by search query
      if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      
      // Filter by equipment type based on selected slot
      if (selectedSlot === 'Hand_R' || selectedSlot === 'Hand_L') {
        // Hands can hold weapons and tools
        return ['sword', 'axe', 'mace', 'bow', 'crossbow', 'shield', 'tool', 'weapon'].includes(asset.type)
      } else if (selectedSlot === 'Head') {
        // Head slot for helmets
        return asset.type === 'armor' && asset.name.toLowerCase().includes('helmet')
      } else if (selectedSlot === 'Spine2') {
        // Chest slot for body armor
        return asset.type === 'armor' && (
          asset.name.toLowerCase().includes('body') || 
          asset.name.toLowerCase().includes('chest') ||
          asset.name.toLowerCase().includes('armor')
        )
      } else if (selectedSlot === 'Hips') {
        // Leg slot for leg armor
        return asset.type === 'armor' && asset.name.toLowerCase().includes('leg')
      }
      
      return true
    })
  }, [assets, searchQuery, selectedSlot])

  // Group assets by type
  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset[]> = {}
    filteredAssets.forEach(asset => {
      const type = asset.type || 'misc'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(asset)
    })
    return groups
  }, [filteredAssets])

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-4 border-b border-border-primary">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary w-4 h-4" />
          <Input
            type="text"
            placeholder="Search equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Slot Selection */}
      {onSlotChange && (
        <div className="p-4 border-b border-border-primary">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-secondary">Equipment Slot</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              {showFilters ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showFilters && (
            <div className="space-y-2">
              {EQUIPMENT_SLOTS.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => onSlotChange(slot.id)}
                  className={cn(
                    "w-full p-3 rounded-lg border transition-all",
                    "flex items-center gap-3 text-left",
                    selectedSlot === slot.id
                      ? "border-primary bg-primary bg-opacity-10"
                      : "border-border-primary hover:border-border-secondary"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded",
                    selectedSlot === slot.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-bg-tertiary text-text-secondary"
                  )}>
                    <slot.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{slot.name}</div>
                    {slot.description && (
                      <div className="text-xs text-text-secondary">{slot.description}</div>
                    )}
                  </div>
                  {selectedSlot === slot.id && (
                    <ChevronRight className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Asset List */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-secondary">Loading equipment...</div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-secondary text-center">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No equipment found</p>
              {searchQuery && (
                <p className="text-sm mt-1">Try adjusting your search</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAssets).map(([type, typeAssets]) => (
              <div key={type}>
                <h3 className="text-sm font-medium text-text-secondary mb-3 capitalize">
                  {type} ({typeAssets.length})
                </h3>
                <div className="grid gap-2">
                  {typeAssets.map(asset => (
                    <Card
                      key={asset.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedAssetId === asset.id && "ring-2 ring-primary"
                      )}
                      onClick={() => onAssetSelect(asset)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-12 h-12 bg-bg-tertiary rounded flex items-center justify-center overflow-hidden">
                            {asset.hasModel ? (
                              <img
                                src={`/api/assets/${asset.id}/concept-art.png`}
                                alt={asset.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                }}
                              />
                            ) : null}
                            <Package className={`w-6 h-6 text-text-secondary ${asset.hasModel ? 'hidden' : ''}`} />
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {asset.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {asset.type}
                              </Badge>
                              {asset.metadata?.tier && (
                                <Badge variant="secondary" className="text-xs">
                                  {asset.metadata.tier}
                                </Badge>
                              )}
                              {asset.metadata?.gripDetected && (
                                <Badge variant="success" className="text-xs">
                                  Grip
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {selectedAssetId === asset.id && (
                            <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 