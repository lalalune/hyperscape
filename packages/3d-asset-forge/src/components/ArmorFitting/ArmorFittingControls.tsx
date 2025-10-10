import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Checkbox } from '../common'
import { FittingConfig } from '../../services/fitting/ArmorFittingService'
import { cn } from '../../styles'
import { 
  Sliders, Save, Download, RefreshCw, Eye, EyeOff,
  Activity, Sparkles,
  Grid3X3, Wand2, Zap, Target, Layers, Play, Pause, RotateCcw, Link
} from 'lucide-react'
import { EQUIPMENT_SLOTS } from '../../constants'

interface ArmorFittingControlsProps {
  // Fitting config
  fittingConfig: FittingConfig
  onFittingConfigChange: (updates: Partial<FittingConfig>) => void

  
  // Options
  enableWeightTransfer: boolean
  onEnableWeightTransferChange: (enabled: boolean) => void
  showWireframe: boolean
  onShowWireframeChange: (show: boolean) => void
  equipmentSlot: string
  onEquipmentSlotChange: (slot: string) => void
  
  // Visualization
  visualizationMode: 'none' | 'regions' | 'collisions' | 'weights' | 'hull'
  onVisualizationModeChange: (mode: ArmorFittingControlsProps['visualizationMode']) => void
  
  // Actions
  onPerformFitting: () => void
  onResetFitting: () => void
  onExportArmor: () => void
  onSaveConfiguration: () => void
  
  // State
  isFitting: boolean
  fittingProgress: number
  canFit: boolean
  isArmorFitted?: boolean
  isArmorBound?: boolean
  onBindArmorToSkeleton?: () => void
  
  // Helmet fitting - NEW
  helmetFittingMethod?: 'auto' | 'manual'
  onHelmetFittingMethodChange?: (method: 'auto' | 'manual') => void
  helmetSizeMultiplier?: number
  onHelmetSizeMultiplierChange?: (value: number) => void
  helmetFitTightness?: number
  onHelmetFitTightnessChange?: (value: number) => void
  helmetVerticalOffset?: number
  onHelmetVerticalOffsetChange?: (value: number) => void
  helmetForwardOffset?: number
  onHelmetForwardOffsetChange?: (value: number) => void
  helmetRotation?: { x: number; y: number; z: number }
  onHelmetRotationChange?: (axis: 'x' | 'y' | 'z', value: number) => void
  onPerformHelmetFitting?: () => void
  onResetHelmetSettings?: () => void
  isHelmetFitted?: boolean
  isHelmetAttached?: boolean
  onAttachHelmetToHead?: () => void
  onDetachHelmetFromHead?: () => void
  hasHelmet?: boolean
  
  // Animation
  currentAnimation?: 'tpose' | 'walking' | 'running'
  isAnimationPlaying?: boolean
  onCurrentAnimationChange?: (animation: 'tpose' | 'walking' | 'running') => void
  onAnimationPlayingChange?: (playing: boolean) => void
  onToggleAnimation?: () => void
}

const RangeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <input
      type="range"
      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
      {...props}
    />
  )
}

// Using shrinkwrap algorithm from MeshFittingDebugger



export const ArmorFittingControls: React.FC<ArmorFittingControlsProps> = ({
  fittingConfig,
  onFittingConfigChange,
  enableWeightTransfer,
  onEnableWeightTransferChange,
  showWireframe,
  onShowWireframeChange,
  equipmentSlot,
  onEquipmentSlotChange,
  visualizationMode,
  onVisualizationModeChange,
  onPerformFitting,
  onResetFitting,
  onExportArmor,
  onSaveConfiguration,
  isFitting,
  fittingProgress,
  canFit,
  isArmorFitted = false,
  isArmorBound = false,
  onBindArmorToSkeleton,
  // Helmet fitting props - NEW
  helmetFittingMethod = 'auto',
  onHelmetFittingMethodChange,
  helmetSizeMultiplier = 1.0,
  onHelmetSizeMultiplierChange,
  helmetFitTightness = 0.85,
  onHelmetFitTightnessChange,
  helmetVerticalOffset = 0,
  onHelmetVerticalOffsetChange,
  helmetForwardOffset = 0,
  onHelmetForwardOffsetChange,
  helmetRotation = { x: 0, y: 0, z: 0 },
  onHelmetRotationChange,
  onPerformHelmetFitting,
  onResetHelmetSettings,
  isHelmetFitted = false,
  isHelmetAttached = false,
  onAttachHelmetToHead,
  onDetachHelmetFromHead,
  hasHelmet = false,
  // Animation props
  currentAnimation = 'tpose',
  isAnimationPlaying = false,
  onCurrentAnimationChange,
  onAnimationPlayingChange,
  onToggleAnimation
}) => {
  // Filter out weapon slots - only show armor slots (Head, Chest, Legs)
  const armorSlots = EQUIPMENT_SLOTS.filter(slot => 
    slot.id === 'Head' || slot.id === 'Spine2' || slot.id === 'Hips'
  )
  
  return (
    <div className="space-y-4">
      {/* Equipment Slot Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Equipment Slot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {armorSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => onEquipmentSlotChange(slot.id)}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 flex flex-col items-center gap-1.5",
                  equipmentSlot === slot.id
                    ? "bg-primary/10 border-primary"
                    : "bg-bg-secondary/40 border-white/10 hover:border-white/20"
                )}
              >
                <div className={cn(equipmentSlot === slot.id ? 'text-primary' : 'text-text-secondary')}>
                                      <slot.icon size={20} />
                </div>
                <span className={cn("text-xs font-medium", equipmentSlot === slot.id ? 'text-primary' : 'text-text-primary')}>
                  {slot.name}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conditional Rendering Based on Equipment Slot */}
      {equipmentSlot === 'Head' ? (
        // Helmet Fitting Controls (matches MeshFittingDebugger)
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Helmet Fitting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fitting Method */}
              <div>
                <label className="text-xs font-medium block mb-2">Fitting Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onHelmetFittingMethodChange?.('auto')}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                      helmetFittingMethod === 'auto'
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/70 border border-border-primary"
                    )}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => onHelmetFittingMethodChange?.('manual')}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                      helmetFittingMethod === 'manual'
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/70 border border-border-primary"
                    )}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {/* Size Multiplier */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Size</label>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {(helmetSizeMultiplier * 100).toFixed(0)}%
                  </span>
                </div>
                <RangeInput
                  min="0.8"
                  max="1.2"
                  step="0.01"
                  value={helmetSizeMultiplier}
                  onChange={(e) => onHelmetSizeMultiplierChange?.(parseFloat(e.target.value))}
                />
              </div>

              {/* Fit Tightness */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Fit Tightness</label>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {(helmetFitTightness * 100).toFixed(0)}%
                  </span>
                </div>
                <RangeInput
                  min="0.7"
                  max="1.0"
                  step="0.01"
                  value={helmetFitTightness}
                  onChange={(e) => onHelmetFitTightnessChange?.(parseFloat(e.target.value))}
                />
                <p className="text-xs text-text-tertiary mt-1">How snug the helmet fits (lower = tighter)</p>
              </div>

              {/* Position Offsets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Vertical Offset</label>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {helmetVerticalOffset.toFixed(2)}m
                  </span>
                </div>
                <RangeInput
                  min="-0.1"
                  max="0.1"
                  step="0.005"
                  value={helmetVerticalOffset}
                  onChange={(e) => onHelmetVerticalOffsetChange?.(parseFloat(e.target.value))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Forward Offset</label>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {helmetForwardOffset.toFixed(2)}m
                  </span>
                </div>
                <RangeInput
                  min="-0.1"
                  max="0.1"
                  step="0.005"
                  value={helmetForwardOffset}
                  onChange={(e) => onHelmetForwardOffsetChange?.(parseFloat(e.target.value))}
                />
              </div>

              {/* Rotation Controls */}
              <div className="space-y-2">
                <label className="text-xs font-medium">Rotation</label>
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <div key={axis}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-text-secondary">{axis.toUpperCase()}</label>
                      <span className="text-[10px] text-text-secondary font-mono">
                        {helmetRotation[axis].toFixed(0)}°
                      </span>
                    </div>
                    <RangeInput
                      min="-45"
                      max="45"
                      step="1"
                      value={helmetRotation[axis]}
                      onChange={(e) => onHelmetRotationChange?.(axis, parseFloat(e.target.value))}
                    />
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={onPerformHelmetFitting}
                  disabled={!canFit || isFitting}
                  className="w-full"
                  size="sm"
                >
                  <Wand2 className="w-3 h-3 mr-1.5" />
                  Fit Helmet
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={onAttachHelmetToHead}
                    disabled={!isHelmetFitted || isHelmetAttached}
                    variant="secondary"
                    size="sm"
                  >
                    Attach
                  </Button>
                  <Button
                    onClick={onDetachHelmetFromHead}
                    disabled={!isHelmetAttached}
                    variant="secondary"
                    size="sm"
                  >
                    Detach
                  </Button>
                </div>

                <Button
                  onClick={onResetHelmetSettings}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Reset Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        // Armor Fitting Controls (for chest/Spine2)
        null // No method selection - just using shrinkwrap algorithm
      )}

      {/* Fitting Parameters - Only show for armor (chest) */}
      {equipmentSlot === 'Spine2' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Fitting Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Match MeshFittingDebugger parameters exactly */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Iterations</label>
                <span className="text-[10px] text-text-secondary font-mono">
                  {fittingConfig.iterations || 8}
                </span>
              </div>
              <RangeInput
                min="1"
                max="20"
                step="1"
                value={fittingConfig.iterations || 8}
                onChange={(e) => onFittingConfigChange({ 
                  iterations: parseInt(e.target.value) 
                })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Step Size</label>
                <span className="text-[10px] text-text-secondary font-mono">
                  {(fittingConfig.stepSize || 0.1).toFixed(2)}
                </span>
              </div>
              <RangeInput
                min="0"
                max="1"
                step="0.05"
                value={fittingConfig.stepSize || 0.1}
                onChange={(e) => onFittingConfigChange({ 
                  stepSize: parseFloat(e.target.value) 
                })}
              />
              <p className="text-xs text-text-tertiary mt-1">Movement per iteration</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Smoothing Radius</label>
                <span className="text-[10px] text-text-secondary font-mono">
                  {(fittingConfig.smoothingRadius || 2).toFixed(1)}
                </span>
              </div>
              <RangeInput
                min="0"
                max="5"
                step="0.5"
                value={fittingConfig.smoothingRadius || 2}
                onChange={(e) => onFittingConfigChange({ 
                  smoothingRadius: parseFloat(e.target.value) 
                })}
              />
              <p className="text-xs text-text-tertiary mt-1">Neighbor influence radius</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Smoothing Strength</label>
                <span className="text-[10px] text-text-secondary font-mono">
                  {(fittingConfig.smoothingStrength || 0.2).toFixed(2)}
                </span>
              </div>
              <RangeInput
                min="0"
                max="1"
                step="0.05"
                value={fittingConfig.smoothingStrength || 0.2}
                onChange={(e) => onFittingConfigChange({ 
                  smoothingStrength: parseFloat(e.target.value) 
                })}
              />
              <p className="text-xs text-text-tertiary mt-1">Influence on neighbors</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Target Offset</label>
                <span className="text-[10px] text-text-secondary font-mono">
                  {((fittingConfig.targetOffset || 0.01) * 100).toFixed(1)}cm
                </span>
              </div>
              <RangeInput
                min="0"
                max="0.1"
                step="0.005"
                value={fittingConfig.targetOffset || 0.01}
                onChange={(e) => onFittingConfigChange({ 
                  targetOffset: parseFloat(e.target.value) 
                })}
              />
              <p className="text-xs text-text-tertiary mt-1">Distance from surface</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Sample Rate</label>
                <span className="text-[10px] text-text-secondary font-mono">
                  {((fittingConfig.sampleRate || 0.5) * 100).toFixed(0)}%
                </span>
              </div>
              <RangeInput
                min="0.1"
                max="1.0"
                step="0.1"
                value={fittingConfig.sampleRate || 0.5}
                onChange={(e) => onFittingConfigChange({ 
                  sampleRate: parseFloat(e.target.value) 
                })}
              />
              <p className="text-xs text-text-tertiary mt-1">Vertices processed per iteration</p>
            </div>

            <div className="pt-2 space-y-2">
              <Checkbox
                checked={fittingConfig.preserveFeatures || false}
                onChange={(e) => onFittingConfigChange({ preserveFeatures: e.target.checked })}
                label="Preserve Features"
                description="Preserve sharp edges and flat surfaces during smoothing"
                size="sm"
              />
              <Checkbox
                checked={fittingConfig.useImprovedShrinkwrap || false}
                onChange={(e) => onFittingConfigChange({ useImprovedShrinkwrap: e.target.checked })}
                label="Improved Shrinkwrap"
                description="Use improved shrinkwrap algorithm with surface relaxation"
                size="sm"
              />
              <Checkbox
                checked={fittingConfig.preserveOpenings || false}
                onChange={(e) => onFittingConfigChange({ preserveOpenings: e.target.checked })}
                label="Preserve Openings"
                description="Lock vertices around neck and arm regions to preserve armor openings"
                size="sm"
              />
              <Checkbox
                checked={fittingConfig.pushInteriorVertices || false}
                onChange={(e) => onFittingConfigChange({ pushInteriorVertices: e.target.checked })}
                label="Push Interior Vertices"
                description="Restore vertices that end up inside the avatar back to their pre-shrinkwrap positions"
                size="sm"
              />
              <Checkbox
                checked={enableWeightTransfer}
                onChange={(e) => onEnableWeightTransferChange(e.target.checked)}
                label="Enable Weight Transfer"
                description="Copy vertex weights from avatar"
                size="sm"
              />
            </div>
          </CardContent>
        </Card>
      )}





      {/* Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4" />
            Visualization
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { mode: 'none', label: 'None', icon: <EyeOff className="w-3 h-3" /> },
              { mode: 'regions', label: 'Regions', icon: <Layers className="w-3 h-3" /> },
              { mode: 'collisions', label: 'Collisions', icon: <Zap className="w-3 h-3" /> },
              { mode: 'weights', label: 'Weights', icon: <Activity className="w-3 h-3" /> }
            ].map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => onVisualizationModeChange(mode as 'none' | 'regions' | 'collisions' | 'weights' | 'hull')}
                className={cn(
                  "px-2 py-1.5 text-[11px] rounded-md transition-colors flex items-center gap-1.5 justify-center",
                  visualizationMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => onShowWireframeChange(!showWireframe)}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            <Grid3X3 className="w-3 h-3 mr-1.5" />
            {showWireframe ? 'Hide' : 'Show'} Wireframe
          </Button>
        </CardContent>
      </Card>

      {/* Animation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Activity className="w-4 h-4 mr-2 inline" />
            Animation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Note about animations */}
          <div className="text-xs text-text-tertiary bg-bg-tertiary/30 p-2 rounded">
            Note: Animations use built-in avatar animations or separate animation files (anim_walk.glb, anim_run.glb) if available
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onCurrentAnimationChange?.('tpose')}
              className={cn(
                "px-2 py-1.5 rounded text-xs font-medium transition-all",
                currentAnimation === 'tpose'
                  ? "bg-primary text-white"
                  : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
              )}
            >
              T-Pose
            </button>
            <button
              onClick={() => onCurrentAnimationChange?.('walking')}
              className={cn(
                "px-2 py-1.5 rounded text-xs font-medium transition-all",
                currentAnimation === 'walking'
                  ? "bg-primary text-white"
                  : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
              )}
            >
              Walk
            </button>
            <button
              onClick={() => onCurrentAnimationChange?.('running')}
              className={cn(
                "px-2 py-1.5 rounded text-xs font-medium transition-all",
                currentAnimation === 'running'
                  ? "bg-primary text-white"
                  : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
              )}
            >
              Run
            </button>
          </div>
          
          <Button
            onClick={onToggleAnimation}
            disabled={currentAnimation === 'tpose'}
            variant={isAnimationPlaying ? "secondary" : "primary"}
            size="sm"
            className="w-full"
          >
            {isAnimationPlaying ? (
              <>
                <Pause className="w-3 h-3 mr-1.5" />
                Pause Animation
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1.5" />
                Play Animation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Actions - Only show for armor (chest) */}
      {equipmentSlot === 'Spine2' && (
        <div className="space-y-2 pt-2">
          <Button
            onClick={onPerformFitting}
            disabled={!canFit || isFitting}
            variant="primary"
            className="w-full"
          >
            {isFitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Fitting... {Math.round(fittingProgress)}%
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                Perform Fitting
              </>
            )}
          </Button>

          {isArmorFitted && !isArmorBound && onBindArmorToSkeleton && (
            <Button
              onClick={onBindArmorToSkeleton}
              disabled={isFitting}
              variant="secondary"
              className="w-full"
            >
              {isFitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Binding...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4 mr-2" />
                  Bind Armor to Skeleton
                </>
              )}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={onExportArmor}
              disabled={!canFit}
              variant="secondary"
              size="sm"
            >
              <Download className="w-3 h-3 mr-1.5" />
              Export
            </Button>

            <Button
              onClick={onSaveConfiguration}
              disabled={!canFit}
              variant="secondary"
              size="sm"
            >
              <Save className="w-3 h-3 mr-1.5" />
              Save Config
            </Button>
          </div>

          <Button
            onClick={onResetFitting}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Reset Fitting
          </Button>
        </div>
      )}
    </div>
  )
} 