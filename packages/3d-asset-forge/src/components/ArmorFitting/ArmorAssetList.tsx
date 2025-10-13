import React, { useState, useMemo } from 'react'
import { Badge, Input } from '../common'
import { cn } from '../../styles'
import { Search, User, ChevronRight, Loader2, Sword, Box, HardHat, Shirt } from 'lucide-react'
import { Asset } from '../../types'

interface ArmorAssetListProps {
  assets: Asset[]
  loading: boolean
  assetType: 'avatar' | 'armor' | 'helmet' // UPDATED
  selectedAsset: Asset | null
  selectedAvatar?: Asset | null
  selectedArmor?: Asset | null
  selectedHelmet?: Asset | null // NEW
  onAssetSelect: (asset: Asset) => void
  onAssetTypeChange: (type: 'avatar' | 'armor' | 'helmet') => void // UPDATED
  hideTypeToggle?: boolean // NEW - for armor fitting page
  equipmentSlot?: 'Head' | 'Spine2' | 'Pelvis' // NEW - to determine which equipment to show
}

export const ArmorAssetList: React.FC<ArmorAssetListProps> = ({
  assets,
  loading,
  assetType,
  selectedAsset,
  selectedAvatar,
  selectedArmor,
  selectedHelmet, // NEW
  onAssetSelect,
  onAssetTypeChange,
  hideTypeToggle = false, // NEW
  equipmentSlot = 'Spine2' // NEW - default to chest
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter assets
  const avatarAssets = useMemo(() =>
    assets.filter(a => a.type === 'character'),
    [assets]
  )

  const armorAssets = useMemo(() =>
    assets.filter(a => {
      const name = a.name.toLowerCase()
      // Exclude shields and helmets - only include chest and leg armor
      if (name.includes('shield') || name.includes('helmet') || name.includes('head')) return false

      return (
        a.type === 'armor' ||
        name.includes('chest') ||
        name.includes('legs') ||
        name.includes('leg') ||
        name.includes('body') ||
        name.includes('torso')
      )
    }),
    [assets]
  )
  
  // NEW - Separate helmet assets
  const helmetAssets = useMemo(() =>
    assets.filter(a => {
      const name = a.name.toLowerCase()
      return name.includes('helmet') || name.includes('head')
    }),
    [assets]
  )

  const filteredAssets = useMemo(() => {
    // Filter based on equipment slot
    let baseAssets: Asset[] = []
    
    if (assetType === 'avatar') {
      baseAssets = avatarAssets
    } else if (assetType === 'armor' && equipmentSlot === 'Spine2') {
      baseAssets = armorAssets
    } else if (assetType === 'helmet' && equipmentSlot === 'Head') {
      baseAssets = helmetAssets
    }
    
    return baseAssets.filter(a =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [assetType, avatarAssets, armorAssets, helmetAssets, searchTerm, equipmentSlot])

  // Group armor by slot
  const groupedArmorAssets = useMemo(() => {
    if (assetType !== 'armor') return {}

    const groups: Record<string, Asset[]> = {
      helmet: [],
      chest: [],
      legs: []
    }

    filteredAssets.forEach(asset => {
      const name = asset.name.toLowerCase()
      if (name.includes('helmet') || name.includes('head')) {
        groups.helmet.push(asset)
      } else if (name.includes('chest') || name.includes('body') || name.includes('torso')) {
        groups.chest.push(asset)
      } else if (name.includes('leg') || name.includes('legs')) {
        groups.legs.push(asset)
      }
    })

    return groups
  }, [assetType, filteredAssets])

  // Get icon for asset type
  const getAssetIcon = (asset: Asset) => {
    if (asset.type === 'character') return User
    const name = asset.name.toLowerCase()
    if (name.includes('helmet') || name.includes('head')) return HardHat
    if (name.includes('chest') || name.includes('body') || name.includes('torso')) return Shirt
    if (name.includes('leg') || name.includes('legs')) return Box
    return Box
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border-primary bg-bg-primary bg-opacity-30">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          {hideTypeToggle 
            ? assetType === 'avatar' 
              ? 'Select Avatar'
              : assetType === 'helmet'
                ? 'Select Helmet' 
                : 'Select Armor'
            : 'Asset Library'}
        </h2>

        {/* Asset Type Toggle - Show avatars and appropriate equipment type */}
        {hideTypeToggle && (
          <div className="flex gap-2 p-1 bg-bg-tertiary/30 rounded-xl">
            <button
              onClick={() => onAssetTypeChange('avatar')}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "flex items-center justify-center gap-2",
                assetType === 'avatar'
                  ? "bg-primary/80 text-white shadow-lg shadow-primary/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/20"
              )}
            >
              <User size={16} />
              Avatars
            </button>
            <button
              onClick={() => onAssetTypeChange(equipmentSlot === 'Head' ? 'helmet' : 'armor')}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "flex items-center justify-center gap-2",
                assetType === (equipmentSlot === 'Head' ? 'helmet' : 'armor')
                  ? "bg-primary/80 text-white shadow-lg shadow-primary/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/20"
              )}
            >
              {equipmentSlot === 'Head' ? (
                <>
                  <HardHat size={16} />
                  Helmets
                </>
              ) : (
                <>
                  <Sword size={16} />
                  Armor
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Search */}
        <div className="p-4 sticky top-0 bg-bg-primary bg-opacity-95 z-10 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
            <Input
              type="text"
              placeholder={`Search ${assetType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3"
            />
          </div>
        </div>

        {/* Asset List */}
        <div className="p-2 pt-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="text-sm text-text-tertiary">Loading assets...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-bg-secondary/50 rounded-2xl mb-4">
                {assetType === 'avatar' ? <User size={24} className="text-text-tertiary" /> : <HardHat size={24} className="text-text-tertiary" />}
              </div>
              <p className="text-text-tertiary text-sm">No {assetType}s found</p>
              {searchTerm && (
                <p className="text-text-tertiary/60 text-xs mt-1">Try a different search term</p>
              )}
            </div>
          ) : assetType === 'avatar' || assetType === 'helmet' ? (
            // Avatar or Helmet list
            <div className="space-y-2">
              {filteredAssets.map((asset) => {
                const Icon = getAssetIcon(asset)
                return (
                  <button
                    key={asset.id}
                    onClick={() => onAssetSelect(asset)}
                    className={cn(
                      "w-full p-4 rounded-xl border transition-all duration-200 text-left group",
                      selectedAsset?.id === asset.id
                        ? "bg-primary/20 border-primary shadow-md shadow-primary/20"
                        : "bg-bg-tertiary/20 border-white/10 hover:border-white/20 hover:bg-bg-tertiary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-bg-tertiary rounded flex items-center justify-center">
                          <Icon className="w-5 h-5 text-text-secondary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">{asset.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" size="sm" className="capitalize bg-bg-tertiary/50 text-text-secondary border border-white/10">
                              {assetType === 'avatar' ? 'Character' : 'Helmet'}
                            </Badge>
                            <Badge variant="primary" size="sm" className="bg-primary/20 text-primary border border-primary/30">
                              <Box size={10} className="mr-1" />
                              3D
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 transition-transform",
                          selectedAsset?.id === asset.id
                            ? "text-primary"
                            : "text-text-tertiary group-hover:text-text-secondary group-hover:translate-x-0.5"
                        )}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            // Armor list grouped by slot
            <div className="space-y-6">
              {Object.entries(groupedArmorAssets).map(([slot, slotAssets]) => {
                if (slotAssets.length === 0) return null

                return (
                  <div key={slot}>
                    <h3 className="text-sm font-medium text-text-secondary mb-3 capitalize">
                      {slot} ({slotAssets.length})
                    </h3>
                    <div className="space-y-2">
                      {slotAssets.map((asset) => {
                        const Icon = getAssetIcon(asset)
                        return (
                          <button
                            key={asset.id}
                            onClick={() => onAssetSelect(asset)}
                            className={cn(
                              "w-full p-4 rounded-xl border transition-all duration-200 text-left group",
                              selectedAsset?.id === asset.id
                                ? "bg-primary/20 border-primary shadow-md shadow-primary/20"
                                : "bg-bg-tertiary/20 border-white/10 hover:border-white/20 hover:bg-bg-tertiary/30"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-10 h-10 bg-bg-tertiary rounded flex items-center justify-center">
                                  <Icon className="w-5 h-5 text-text-secondary" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-text-primary">{asset.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" size="sm" className="capitalize bg-bg-tertiary/50 text-text-secondary border border-white/10">
                                      {asset.type}
                                    </Badge>
                                    <Badge variant="primary" size="sm" className="bg-primary/20 text-primary border border-primary/30">
                                      <Box size={10} className="mr-1" />
                                      3D
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <ChevronRight
                                className={cn(
                                  "w-4 h-4 transition-transform",
                                  selectedAsset?.id === asset.id
                                    ? "text-primary"
                                    : "text-text-tertiary group-hover:text-text-secondary group-hover:translate-x-0.5"
                                )}
                              />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Assets Summary */}
      <div className="p-4 border-t border-border-primary bg-bg-primary bg-opacity-30">
        <div>
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Current Selection</h3>
          <div className="space-y-3">
            {/* Always show avatar */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-text-tertiary">Avatar</p>
                <p className="text-sm font-medium text-text-primary">
                  {selectedAvatar?.name || 'None selected'}
                </p>
              </div>
            </div>
            
            {/* Show armor only for chest slot */}
            {equipmentSlot === 'Spine2' && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Sword size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-tertiary">Armor</p>
                  <p className="text-sm font-medium text-text-primary">
                    {selectedArmor?.name || 'None selected'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Show helmet only for head slot */}
            {equipmentSlot === 'Head' && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                  <HardHat size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-tertiary">Helmet</p>
                  <p className="text-sm font-medium text-text-primary">
                    {selectedHelmet?.name || 'None selected'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}