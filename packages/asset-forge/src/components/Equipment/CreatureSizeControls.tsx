import React from 'react'
import { cn } from '../../styles'
import { Ruler, RefreshCw, Info } from 'lucide-react'
import { RangeInput, Button, Badge, Checkbox } from '../common'
import { CREATURE_PRESETS, CREATURE_SIZE_CATEGORIES, getCreatureCategory } from '../../constants'
import { CreatureScalingService } from '../../services/processing/CreatureScalingService'

interface CreatureSizeControlsProps {
  avatarHeight: number
  setAvatarHeight: (height: number) => void
  creatureCategory: string
  setCreatureCategory: (category: string) => void
  autoScaleWeapon: boolean
  setAutoScaleWeapon: (scale: boolean) => void
  weaponScaleOverride: number
  setWeaponScaleOverride: (scale: number) => void
  selectedEquipment: { type?: string } | null
  onReset: () => void
}

export const CreatureSizeControls: React.FC<CreatureSizeControlsProps> = ({
  avatarHeight,
  setAvatarHeight,
  creatureCategory,
  setCreatureCategory,
  autoScaleWeapon,
  setAutoScaleWeapon,
  weaponScaleOverride,
  setWeaponScaleOverride,
  selectedEquipment,
  onReset
}) => {
  return (
    <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Ruler className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Creature Size</h3>
            <p className="text-xs text-text-secondary mt-0.5">Adjust avatar size and weapon scaling</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Size Category */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-text-primary flex items-center gap-2">
            Creature Category
            <Badge variant="secondary" size="sm" className="capitalize">
              {creatureCategory}
            </Badge>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CREATURE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  setAvatarHeight(preset.height)
                  setCreatureCategory(preset.category)
                }}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center",
                  creatureCategory === preset.category
                    ? "bg-primary/80 text-white shadow-lg shadow-primary/20"
                    : "bg-bg-tertiary/20 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/30 border border-white/10"
                )}
              >
                <span className="text-xs font-medium">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Height Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-text-primary">Height</label>
            <span className="text-sm font-mono text-primary">{avatarHeight.toFixed(1)}m</span>
          </div>
          <RangeInput
            type="range"
            min="0.3"
            max="10"
            step="0.1"
            value={avatarHeight}
            onChange={(e) => {
              const height = parseFloat(e.target.value)
              setAvatarHeight(height)
              setCreatureCategory(getCreatureCategory(height))
            }}
          />
          <div className="flex justify-between text-xs text-text-tertiary">
            <span>0.3m</span>
            <span>1.8m (Human)</span>
            <span>10m</span>
          </div>
        </div>
        
        {/* Weapon Scaling */}
        <div className="space-y-3">
          <Checkbox
            checked={autoScaleWeapon}
            onChange={(e) => setAutoScaleWeapon(e.target.checked)}
            label="Auto-scale weapon to creature size"
          />
          
          {!autoScaleWeapon && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-text-primary">Manual Scale</label>
                <span className="text-sm font-mono text-primary">{weaponScaleOverride.toFixed(1)}x</span>
              </div>
              <RangeInput
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={weaponScaleOverride}
                onChange={(e) => setWeaponScaleOverride(parseFloat(e.target.value))}
              />
            </div>
          )}
          
          {autoScaleWeapon && selectedEquipment && (
            <div className="p-3 bg-bg-tertiary/20 rounded-lg border border-white/10 space-y-2">
              <p className="text-xs text-text-tertiary flex items-center gap-1">
                <Info size={12} />
                Recommended weapons for {CREATURE_SIZE_CATEGORIES[creatureCategory as keyof typeof CREATURE_SIZE_CATEGORIES].name}:
              </p>
              <div className="flex flex-wrap gap-1">
                {CreatureScalingService.getRecommendedWeapons(avatarHeight).map(weapon => (
                  <Badge key={weapon} variant="secondary" size="sm">
                    {weapon}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Reset Button */}
        <Button
          onClick={onReset}
          variant="secondary"
          size="sm"
          className="w-full gap-2"
        >
          <RefreshCw size={16} />
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
} 